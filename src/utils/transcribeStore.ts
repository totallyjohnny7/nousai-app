/**
 * Transcribe Store — module-level singleton
 * Recording persists across navigation (component unmounts/remounts safely).
 * Uses Groq Whisper API (whisper-large-v3) for transcription.
 *
 * Fix: Instead of MediaRecorder.start(timeslice), we stop/restart a fresh
 * MediaRecorder every 8 s so each segment is a self-contained valid audio
 * file (with its own container header).  Raw partial chunks sent alone cause
 * Whisper 400 "could not process file" errors.
 */

export interface TranscribeChunk {
  text: string;
  timestamp: string; // ISO string
}

export interface TranscribeState {
  isRecording: boolean;
  language: string;
  transcript: string;
  chunks: TranscribeChunk[];
  autosaveStatus: 'idle' | 'saving' | 'saved';
  noteId: string | null;
  noteTitle: string | null;
  error: string | null;
}

type SaveCallback = (
  noteId: string | null,
  noteTitle: string | null,
  fullText: string,
  chunks: TranscribeChunk[]
) => Promise<string>;

type Listener = () => void;

// ─── Singleton ────────────────────────────────────────

let state: TranscribeState = {
  isRecording: false,
  language: 'auto',
  transcript: '',
  chunks: [],
  autosaveStatus: 'idle',
  noteId: null,
  noteTitle: null,
  error: null,
};

let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let processingQueue: Blob[] = [];
let isProcessing = false;
let saveCallback: SaveCallback | null = null;
const listeners = new Set<Listener>();

// ── Segment cycling vars ───────────────────────────────
let segmentChunks: Blob[] = [];
let segmentTimer: number | null = null;
let currentMimeType = '';
let isRestartingSegment = false;

// ─── Pub/Sub ──────────────────────────────────────────

function emit() {
  listeners.forEach(fn => fn());
  // Crash recovery: persist transcript to localStorage
  try {
    localStorage.setItem('nousai-transcribe-session', JSON.stringify({
      transcript: state.transcript,
      chunks: state.chunks,
      noteId: state.noteId,
      noteTitle: state.noteTitle,
    }));
  } catch { /* ignore */ }
}

function set(partial: Partial<TranscribeState>) {
  state = { ...state, ...partial };
  emit();
}

export function getTranscribeState(): Readonly<TranscribeState> {
  return state;
}

export function subscribeToTranscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function registerSaveCallback(cb: SaveCallback): void {
  saveCallback = cb;
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

// ─── Groq Whisper API ─────────────────────────────────

function getGroqApiKey(): string | null {
  const provider = localStorage.getItem('nousai-ai-provider');
  if (provider === 'groq') {
    return localStorage.getItem('nousai-ai-apikey');
  }
  return null;
}

/**
 * Send a Blob (recording segment) or File (upload) to Groq Whisper.
 * For Files we pass the original filename so Groq detects the format.
 * For recording Blobs we derive a filename from the MIME type.
 */
async function sendToGroqWhisper(data: Blob | File): Promise<string> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error(
      'No Groq API key configured. Go to Settings → AI Provider → select Groq and enter your API key.'
    );
  }

  const filename = data instanceof File
    ? data.name
    : data.type.includes('webm') ? 'audio.webm'
    : data.type.includes('mp4') ? 'audio.mp4'
    : 'audio.ogg';

  const form = new FormData();
  form.append('file', data, filename);
  form.append('model', 'whisper-large-v3');
  if (state.language !== 'auto' && state.language !== 'other') {
    form.append('language', state.language);
  }
  form.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => res.status.toString());
    throw new Error(`Whisper API error (${res.status}): ${msg}`);
  }

  return (await res.text()).trim();
}

// ─── Sequential chunk processing ─────────────────────

async function drainQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (processingQueue.length > 0) {
    const blob = processingQueue.shift()!;
    if (blob.size < 500) continue; // skip near-silent chunks

    set({ autosaveStatus: 'saving' });

    try {
      const text = await sendToGroqWhisper(blob);
      if (!text) { set({ autosaveStatus: 'idle' }); continue; }

      const chunk: TranscribeChunk = { text, timestamp: new Date().toISOString() };
      const newChunks = [...state.chunks, chunk];
      const newTranscript = state.transcript ? `${state.transcript} ${text}` : text;
      set({ chunks: newChunks, transcript: newTranscript });

      if (saveCallback) {
        try {
          const id = await saveCallback(state.noteId, state.noteTitle, newTranscript, newChunks);
          set({ noteId: id, autosaveStatus: 'saved' });
          setTimeout(() => set({ autosaveStatus: 'idle' }), 2000);
        } catch (e) {
          console.error('[Transcribe] autosave failed:', e);
          set({ autosaveStatus: 'idle' });
        }
      } else {
        set({ autosaveStatus: 'idle' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ error: msg, autosaveStatus: 'idle' });
    }
  }

  isProcessing = false;
}

// ─── Segment helper ───────────────────────────────────
/**
 * Start a fresh MediaRecorder segment.  Each segment produces a complete,
 * self-contained audio file (EBML/container header included), which Whisper
 * can process without errors.
 */
function startSegment(): void {
  if (!mediaStream) return;
  segmentChunks = [];

  const mr = new MediaRecorder(
    mediaStream,
    currentMimeType ? { mimeType: currentMimeType } : undefined,
  );

  mr.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) segmentChunks.push(e.data);
  };

  mr.onstop = () => {
    if (segmentChunks.length > 0) {
      const blob = new Blob(segmentChunks, { type: currentMimeType || 'audio/webm' });
      if (blob.size >= 500) {
        processingQueue.push(blob);
        drainQueue();
      }
    }
    segmentChunks = [];

    // Auto-restart only when cycling (not on a manual stop)
    if (isRestartingSegment && state.isRecording && mediaStream) {
      isRestartingSegment = false;
      startSegment();
    }
  };

  mr.start(); // no timeslice — full, valid file every cycle
  mediaRecorder = mr;
}

// ─── Public API ───────────────────────────────────────

export async function startTranscribeRecording(language: string): Promise<void> {
  if (state.isRecording) return;

  if (!getGroqApiKey()) {
    set({
      error: 'No Groq API key configured. Go to Settings → AI Provider → select Groq and enter your API key.',
    });
    return;
  }

  set({ error: null });

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Microphone access denied.';
    set({ error: `Microphone error: ${msg}` });
    return;
  }

  // Set up Web Audio analyser for waveform visualisation
  try {
    audioContext = new AudioContext();
    const src = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    src.connect(analyser);
  } catch {
    analyser = null;
    audioContext = null;
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const noteTitle = `Transcribe_${dateStr}_${timeStr}`;

  processingQueue = [];
  isProcessing = false;
  isRestartingSegment = false;

  set({
    isRecording: true,
    language,
    transcript: '',
    chunks: [],
    noteId: null,
    noteTitle,
    error: null,
    autosaveStatus: 'idle',
  });

  // Pick the best supported MIME type
  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', '']
    .find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
  currentMimeType = mimeType || 'audio/webm';

  // Start first segment and cycle every 8 s.
  // Each restart produces a brand-new, header-complete audio file.
  startSegment();
  segmentTimer = window.setInterval(() => {
    if (state.isRecording && mediaRecorder && mediaRecorder.state === 'recording') {
      isRestartingSegment = true;
      mediaRecorder.stop(); // onstop → drains segment → calls startSegment()
    }
  }, 8000);
}

export function stopTranscribeRecording(): void {
  if (!state.isRecording) return;

  // Kill the cycling timer first so no new segment starts after this
  if (segmentTimer !== null) {
    clearInterval(segmentTimer);
    segmentTimer = null;
  }
  isRestartingSegment = false;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop(); // triggers final onstop → drains last segment
  }
  mediaRecorder = null;

  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
    analyser = null;
  }

  set({ isRecording: false });
}

export function clearTranscribeSession(): void {
  if (state.isRecording) stopTranscribeRecording();
  set({
    transcript: '',
    chunks: [],
    noteId: null,
    noteTitle: null,
    error: null,
    autosaveStatus: 'idle',
  });
  try { localStorage.removeItem('nousai-transcribe-session'); } catch { /* ignore */ }
}

// ─── File Upload Transcription ────────────────────────
/**
 * Transcribe a local audio/video file via Groq Whisper.
 * Appends the result to the existing transcript (same panel, same note).
 * Supported: mp3, mp4, m4a, wav, ogg, webm, flac.
 */
export async function transcribeFile(file: File): Promise<void> {
  if (!getGroqApiKey()) {
    set({ error: 'No Groq API key configured. Go to Settings → AI Provider → select Groq and enter your API key.' });
    return;
  }

  set({ error: null, autosaveStatus: 'saving' });

  // Build a note title from the filename if we don't have one yet
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const fallbackTitle = `Transcribe_${baseName}`;

  try {
    const text = await sendToGroqWhisper(file);
    if (!text) { set({ autosaveStatus: 'idle' }); return; }

    const chunk: TranscribeChunk = { text, timestamp: new Date().toISOString() };
    const newChunks = [...state.chunks, chunk];
    const newTranscript = state.transcript ? `${state.transcript} ${text}` : text;

    set({
      chunks: newChunks,
      transcript: newTranscript,
      noteTitle: state.noteTitle || fallbackTitle,
    });

    if (saveCallback) {
      try {
        const id = await saveCallback(state.noteId, state.noteTitle || fallbackTitle, newTranscript, newChunks);
        set({ noteId: id, autosaveStatus: 'saved' });
        setTimeout(() => set({ autosaveStatus: 'idle' }), 2000);
      } catch (e) {
        console.error('[Transcribe] autosave failed:', e);
        set({ autosaveStatus: 'idle' });
      }
    } else {
      set({ autosaveStatus: 'idle' });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    set({ error: msg, autosaveStatus: 'idle' });
  }
}
