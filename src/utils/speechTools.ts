/**
 * Speech Tools: TTS (Text-to-Speech) and STT (Speech-to-Text / Dictation)
 *
 * These features work natively in browsers and PWAs — no plugins needed.
 * Works on mobile (Android, iOS) and desktop.
 */

// ─── Text-to-Speech (TTS) ──────────────────────────────

export interface TTSConfig {
  rate: number;      // 0.5 - 2.0 (default 1.0)
  pitch: number;     // 0 - 2.0 (default 1.0)
  volume: number;    // 0 - 1.0 (default 1.0)
  voiceLang: string; // BCP 47 tag, e.g. 'en-US', 'ja-JP'
  voiceName?: string; // specific voice name
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceLang: 'en-US',
};

let currentUtterance: SpeechSynthesisUtterance | null = null;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

/** Check if TTS is available */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ─── Voice Preloading (fixes Bluetooth audio routing) ───
// speechSynthesis.getVoices() returns [] on first call in most browsers.
// Voices load asynchronously — we must listen for voiceschanged event.
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): void {
  if (!isTTSAvailable()) return;
  cachedVoices = speechSynthesis.getVoices();
}

// Preload voices on module init + listen for async voice loading
if (isTTSAvailable()) {
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

/** Get available TTS voices, optionally filtered by language */
export function getVoices(lang?: string): SpeechSynthesisVoice[] {
  if (!isTTSAvailable()) return [];
  // Use cached voices; fallback to direct call if cache is empty
  if (cachedVoices.length === 0) loadVoices();
  const voices = cachedVoices.length > 0 ? cachedVoices : speechSynthesis.getVoices();
  if (lang) {
    return voices.filter(v => v.lang.startsWith(lang));
  }
  return voices;
}

/** Speak text using TTS */
export function speak(
  text: string,
  config: Partial<TTSConfig> = {},
  onEnd?: () => void,
  onWord?: (charIndex: number) => void,
): void {
  if (!isTTSAvailable()) return;

  // Stop any current speech
  stopSpeaking();

  const cfg = { ...DEFAULT_TTS_CONFIG, ...config };
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = cfg.rate;
  utterance.pitch = cfg.pitch;
  utterance.volume = cfg.volume;
  utterance.lang = cfg.voiceLang;

  // Find specific voice (uses cached voices for Bluetooth compatibility)
  if (cfg.voiceName) {
    const voice = getVoices().find(v => v.name === cfg.voiceName);
    if (voice) utterance.voice = voice;
  } else {
    // Pick best voice for language
    const voices = getVoices(cfg.voiceLang);
    if (voices.length > 0) {
      // Prefer local/premium voices
      const local = voices.find(v => v.localService) || voices[0];
      utterance.voice = local;
    }
  }

  // Error handler — log TTS failures instead of silent failure
  utterance.onerror = (e) => {
    console.warn('TTS error:', e.error);
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
    onEnd?.();
  };

  utterance.onend = () => {
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
    onEnd?.();
  };

  if (onWord) {
    utterance.onboundary = (e) => {
      if (e.name === 'word') onWord(e.charIndex);
    };
  }

  currentUtterance = utterance;
  speechSynthesis.speak(utterance);

  // Chrome workaround: TTS silently stops after ~15s of continuous speech.
  // Pause/resume every 10s to keep the audio stream alive.
  keepAliveInterval = setInterval(() => {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      speechSynthesis.resume();
    } else if (!speechSynthesis.speaking) {
      clearInterval(keepAliveInterval!);
      keepAliveInterval = null;
    }
  }, 10000);
}

/** Stop TTS */
export function stopSpeaking(): void {
  if (isTTSAvailable()) {
    speechSynthesis.cancel();
    currentUtterance = null;
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
  }
}

/** Check if TTS is currently speaking */
export function isSpeaking(): boolean {
  return isTTSAvailable() && speechSynthesis.speaking;
}

/** Pause TTS */
export function pauseSpeaking(): void {
  if (isTTSAvailable()) speechSynthesis.pause();
}

/** Resume TTS */
export function resumeSpeaking(): void {
  if (isTTSAvailable()) speechSynthesis.resume();
}

/** Read a flashcard aloud (front then back with pause) */
export function readFlashcard(front: string, back: string, lang?: string): Promise<void> {
  if (!isTTSAvailable()) return Promise.resolve(); // Prevent never-resolving promise
  return new Promise((resolve) => {
    speak(front, { voiceLang: lang || 'en-US', rate: 0.9 }, () => {
      // Short pause between front and back
      setTimeout(() => {
        speak('The answer is: ' + back, { voiceLang: lang || 'en-US', rate: 0.9 }, resolve);
      }, 800);
    });
  });
}

/** Read quiz question aloud with options */
export function readQuizQuestion(
  question: string,
  options?: string[],
  lang?: string
): Promise<void> {
  if (!isTTSAvailable()) return Promise.resolve(); // Prevent never-resolving promise
  return new Promise((resolve) => {
    let text = question;
    if (options?.length) {
      text += '. Options: ' + options.map((o, i) => `${String.fromCharCode(65 + i)}, ${o}`).join('. ');
    }
    speak(text, { voiceLang: lang || 'en-US', rate: 0.95 }, resolve);
  });
}

// ─── Speech-to-Text (Dictation) ────────────────────────

export interface STTConfig {
  language: string;    // BCP 47 tag
  continuous: boolean; // Keep listening after pause
  interimResults: boolean; // Show partial results
}

const DEFAULT_STT_CONFIG: STTConfig = {
  language: 'en-US',
  continuous: false,
  interimResults: true,
};

interface DictationCallbacks {
  onResult: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

let recognition: any = null;
let dictationActive = false;

/** Check if STT/dictation is available */
export function isSTTAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

/** Start dictation / speech-to-text — requests mic permission first */
export async function startDictation(
  callbacks: DictationCallbacks,
  config: Partial<STTConfig> = {},
): Promise<void> {
  if (!isSTTAvailable()) {
    callbacks.onError?.('Speech recognition not supported in this browser');
    return;
  }

  // Request explicit microphone permission before starting recognition
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release immediately — we only need the permission grant
    stream.getTracks().forEach(t => t.stop());
  } catch (e: any) {
    if (e.name === 'NotAllowedError') {
      callbacks.onError?.('Microphone permission denied. Please allow mic access in your browser settings.');
      return;
    }
    callbacks.onError?.(e?.message || 'Could not access microphone');
    return;
  }

  // Stop any existing
  stopDictation();

  const cfg = { ...DEFAULT_STT_CONFIG, ...config };
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  recognition.lang = cfg.language;
  recognition.continuous = cfg.continuous;
  recognition.interimResults = cfg.interimResults;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    dictationActive = true;
    callbacks.onStart?.();
  };

  recognition.onresult = (event: any) => {
    let transcript = '';
    let isFinal = false;

    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }

    callbacks.onResult(transcript, isFinal);
  };

  recognition.onerror = (event: any) => {
    dictationActive = false;
    callbacks.onError?.(event.error || 'Recognition error');
  };

  recognition.onend = () => {
    dictationActive = false;
    callbacks.onEnd?.();
  };

  recognition.start();
}

/** Stop dictation */
export function stopDictation(): void {
  if (recognition) {
    try {
      recognition.stop();
    } catch {
      // Ignore
    }
    recognition = null;
    dictationActive = false;
  }
}

/** Check if dictation is active */
export function isDictating(): boolean {
  return dictationActive;
}

// ─── Study-Specific Speech Tools ────────────────────────

/** Oral quiz mode: read question aloud, listen for spoken answer */
export function oralQuiz(
  question: string,
  onAnswer: (spokenAnswer: string) => void,
  lang: string = 'en-US',
): void {
  // Read question
  speak(question, { voiceLang: lang, rate: 0.95 }, () => {
    // Listen for answer after question is read
    setTimeout(() => {
      startDictation({
        onResult: (text, isFinal) => {
          if (isFinal) {
            stopDictation();
            onAnswer(text);
          }
        },
        onError: () => {
          onAnswer(''); // Empty answer on error
        },
      }, { language: lang, continuous: false });
    }, 500);
  });
}

/** Speed reading: read text at increasing speed */
export function speedRead(
  text: string,
  startRate: number = 1.0,
  endRate: number = 2.0,
  chunks: number = 5,
): void {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunkSize = Math.ceil(sentences.length / chunks);
  const rateStep = (endRate - startRate) / chunks;

  let chunkIdx = 0;

  function readChunk() {
    if (chunkIdx >= chunks) return;
    const start = chunkIdx * chunkSize;
    const chunk = sentences.slice(start, start + chunkSize).join(' ');
    const rate = startRate + rateStep * chunkIdx;

    speak(chunk, { rate: Math.min(rate, 2.0) }, () => {
      chunkIdx++;
      readChunk();
    });
  }

  readChunk();
}

/** Get saved TTS preferences */
export function getTTSPrefs(): Partial<TTSConfig> {
  try {
    const stored = localStorage.getItem('nousai-tts-prefs');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/** Save TTS preferences */
export function saveTTSPrefs(prefs: Partial<TTSConfig>): void {
  localStorage.setItem('nousai-tts-prefs', JSON.stringify(prefs));
}

/** Get saved STT preferences */
export function getSTTPrefs(): Partial<STTConfig> {
  try {
    const stored = localStorage.getItem('nousai-stt-prefs');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/** Save STT preferences */
export function saveSTTPrefs(prefs: Partial<STTConfig>): void {
  localStorage.setItem('nousai-stt-prefs', JSON.stringify(prefs));
}
