import { useState, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SavedVideo, VideoCaption, VideoUploadProgress } from '../../types';
import { useStore } from '../../store';
import { uploadVideoToStorage, generateVideoThumbnail } from '../../utils/videoStorage';

const VideoPlayer = lazy(() => import('../VideoPlayer'));

const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/avi'];
const MAX_CONCURRENT = 3;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getVideoDuration(blob: Blob): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = url;
    v.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(v.duration || 0); };
    v.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    setTimeout(() => { URL.revokeObjectURL(url); resolve(0); }, 8000);
  });
}

function formatDuration(secs: number): string {
  if (!isFinite(secs) || isNaN(secs) || secs === 0) return '--:--';
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function VideoTool() {
  const { addVideo, savedVideos, data } = useStore();
  const navigate = useNavigate();
  const uid = localStorage.getItem('nousai-auth-uid') ?? '';
  const [activeVideo, setActiveVideo] = useState<SavedVideo | null>(null);
  const courses = data?.pluginData?.coachData?.courses ?? [];

  const [uploads, setUploads] = useState<VideoUploadProgress[]>([]);
  const [recording, setRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [liveCaption, setLiveCaption] = useState('');
  const [recordCourse, setRecordCourse] = useState('');
  const [uploadCourse, setUploadCourse] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const captionsRef = useRef<VideoCaption[]>([]);
  const recordStartRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRef = useRef<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Throttle: only update liveCaption state at most once per 200ms to prevent re-render storm
  const captionThrottleRef = useRef<number>(0);

  // ── Upload flow ───────────────────────────────────────

  const updateProgress = useCallback((videoId: string, patch: Partial<VideoUploadProgress>) => {
    setUploads(prev => prev.map(u => u.videoId === videoId ? { ...u, ...patch } : u));
  }, []);

  async function processFile(file: File, courseId: string): Promise<void> {
    const isVideo = ACCEPTED_TYPES.includes(file.type) || file.type.startsWith('video/');
    const videoId = crypto.randomUUID();

    setUploads(prev => [...prev, {
      videoId, filename: file.name,
      progress: 0, status: 'uploading',
    }]);

    if (!isVideo) {
      updateProgress(videoId, { status: 'error', error: 'Not a video file' });
      return;
    }

    if (!uid) {
      updateProgress(videoId, { status: 'error', error: 'Sign in to upload videos' });
      return;
    }

    try {
      // Very large files will work (uploadBytesResumable handles any size) but warn the user.
      // Firebase Storage free tier is 5 GB total; a 40-min 1080p file is ~2–4 GB.
      if (file.size > 1 * 1024 * 1024 * 1024) {
        console.warn('[VideoTool] File >1GB — upload may take a long time:', file.name, formatSize(file.size));
      }

      updateProgress(videoId, { status: 'uploading', progress: 0 });

      const storagePath = await uploadVideoToStorage({
        uid, videoId, blob: file, mimeType: file.type,
        onProgress: p => updateProgress(videoId, { progress: p }),
      });

      updateProgress(videoId, { status: 'processing', progress: 100 });

      const [duration, thumbnail] = await Promise.all([
        getVideoDuration(file),
        generateVideoThumbnail(file),
      ]);

      const video: SavedVideo = {
        id: videoId,
        title: file.name.replace(/\.[^.]+$/, ''),
        storagePath,
        downloadUrl: undefined,
        duration,
        captions: [],
        defaultSpeed: 1,
        courseId: courseId || undefined,
        createdAt: new Date().toISOString(),
        thumbnailBase64: thumbnail ?? undefined,
        size: file.size,
        type: 'upload',
        mimeType: file.type,
      };

      addVideo(video);
      updateProgress(videoId, { status: 'done' });
    } catch (e: any) {
      const msg = e?.code === 'storage/quota-exceeded'
        ? 'Firebase Storage quota reached'
        : e?.message ?? 'Upload failed';
      updateProgress(videoId, { status: 'error', error: msg });
    }
  }

  async function handleFiles(files: FileList) {
    const arr = Array.from(files);
    // Upload in batches of MAX_CONCURRENT
    for (let i = 0; i < arr.length; i += MAX_CONCURRENT) {
      await Promise.all(arr.slice(i, i + MAX_CONCURRENT).map(f => processFile(f, uploadCourse)));
    }
  }

  // ── Screen recording flow ─────────────────────────────

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 24 } },
        audio: true,
      });

      // Prefer VP9 + Opus codec, fallback to plain webm
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      captionsRef.current = [];
      recordStartRef.current = Date.now();

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => finishRecording(mimeType, stream);
      recorder.start(5000); // collect chunk every 5s — reduces GC pressure vs 1s

      // Live captions via Web Speech API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      if (SR) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sr: any = new SR();
        sr.continuous = true;
        sr.interimResults = true;
        sr.onresult = (ev: any) => {
          let interim = '';
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const result = ev.results[i];
            if (result.isFinal) {
              const elapsed = (Date.now() - recordStartRef.current) / 1000;
              const text = result[0].transcript.trim();
              if (text) {
                captionsRef.current.push({
                  id: crypto.randomUUID(),
                  start: Math.max(0, elapsed - 4),
                  end: elapsed,
                  text,
                });
              }
              setLiveCaption('');
              captionThrottleRef.current = 0; // reset throttle on final result
            } else {
              interim += result[0].transcript;
            }
          }
          // Throttle interim caption state updates to max once per 200ms
          // SpeechRecognition fires onresult 5-20×/sec; without throttle this
          // causes a React re-render storm that lags the whole browser tab.
          if (interim) {
            const now = Date.now();
            if (now - captionThrottleRef.current > 400) {
              captionThrottleRef.current = now;
              setLiveCaption(interim);
            }
          }
        };
        sr.onerror = () => {};
        sr.start();
        speechRef.current = sr;
      }

      setRecording(true);
      setRecordingMs(0);
      timerRef.current = setInterval(() => setRecordingMs(ms => ms + 1000), 1000);

      // Auto-stop when user closes the share overlay
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopRecording());
    } catch (e: any) {
      if (e?.name === 'NotAllowedError') {
        alert('Screen recording permission required. Please allow screen capture and try again.');
      } else {
        console.error('[VideoTool] getDisplayMedia failed:', e);
      }
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    speechRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    setLiveCaption('');
  }

  async function finishRecording(mimeType: string, stream: MediaStream) {
    stream.getTracks().forEach(t => t.stop());
    if (!uid) return;

    const videoId = crypto.randomUUID();
    const blob = new Blob(chunksRef.current, { type: mimeType });

    setUploads(prev => [...prev, {
      videoId, filename: 'Screen Recording',
      progress: 0, status: 'uploading',
    }]);

    try {
      const storagePath = await uploadVideoToStorage({
        uid, videoId, blob, mimeType,
        onProgress: p => updateProgress(videoId, { progress: p }),
      });

      updateProgress(videoId, { status: 'processing', progress: 100 });

      const [duration, thumbnail] = await Promise.all([
        getVideoDuration(blob),
        generateVideoThumbnail(blob, 0),
      ]);

      const now = new Date();
      const title = `Recording ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      addVideo({
        id: videoId, title, storagePath, duration,
        captions: captionsRef.current,
        defaultSpeed: 1,
        courseId: recordCourse || undefined,
        createdAt: now.toISOString(),
        thumbnailBase64: thumbnail ?? undefined,
        size: blob.size,
        type: 'recording',
        mimeType,
      });

      updateProgress(videoId, { status: 'done' });
    } catch (e: any) {
      const msg = e?.code === 'storage/quota-exceeded'
        ? 'Firebase Storage quota reached'
        : e?.message ?? 'Upload failed';
      updateProgress(videoId, { status: 'error', error: msg });
    }
  }

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const clearDone = () => setUploads(prev => prev.filter(u => u.status !== 'done'));

  // Memoize — avoids re-sorting on every liveCaption or timer state update
  const recentVideos = useMemo(
    () => [...savedVideos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [savedVideos],
  );

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 640 }}>
      <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.1rem', fontFamily: 'Sora, sans-serif' }}>
        Video Studio
      </h2>

      {/* Upload Section */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Upload Videos
        </h3>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={uploadCourse}
            onChange={e => setUploadCourse(e.target.value)}
            style={{ flex: 1, minWidth: 140, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
          >
            <option value="">No course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            + Upload Video(s)
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => { if (e.target.files?.length) { handleFiles(e.target.files); e.target.value = ''; } }}
        />

        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
          Supports MP4, WebM, MOV, AVI, MKV · Any duration (30 sec to 2+ hours) · Files over 1 GB may take 10–40 min — keep this tab open
        </p>
      </section>

      {/* Screen Recording Section */}
      <section style={{ background: 'var(--card)', borderRadius: 12, padding: '1.25rem', border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Screen Recording
        </h3>

        {!recording ? (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={recordCourse}
              onChange={e => setRecordCourse(e.target.value)}
              style={{ flex: 1, minWidth: 140, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
            >
              <option value="">No course</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <button
              onClick={startRecording}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#e63946', color: '#fff', border: 'none', borderRadius: 8, padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              ● Record Screen
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#e63946', fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>
                <span style={{ animation: 'pulse 1s infinite', display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#e63946' }} />
                {fmtTime(recordingMs)}
              </span>
              <button
                onClick={stopRecording}
                style={{ background: 'var(--border)', color: 'var(--text)', border: 'none', borderRadius: 8, padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ■ Stop
              </button>
            </div>
            {liveCaption && (
              <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', borderRadius: 6, padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
                {liveCaption}
              </div>
            )}
            {!liveCaption && (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)' }}>
                Live captions will appear here (requires microphone access)
              </p>
            )}
          </div>
        )}
      </section>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600 }}>Uploads</span>
            {uploads.some(u => u.status === 'done') && (
              <button onClick={clearDone} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.78rem' }}>
                Clear done
              </button>
            )}
          </div>
          {uploads.map(u => (
            <div key={u.videoId} style={{ background: 'var(--card)', borderRadius: 8, padding: '0.6rem 0.8rem', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: '0.82rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{u.filename}</span>
                <span style={{ fontSize: '0.78rem', color: u.status === 'error' ? '#e63946' : u.status === 'done' ? '#2ecc71' : 'var(--accent)' }}>
                  {u.status === 'done' ? '✓ Done' : u.status === 'error' ? u.error ?? 'Error' : u.status === 'processing' ? 'Processing…' : `${u.progress}%`}
                </span>
              </div>
              {(u.status === 'uploading' || u.status === 'processing') && (
                <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
                  <div style={{ height: '100%', background: 'var(--accent)', borderRadius: 2, width: `${u.progress}%`, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ── Saved Videos Library ───────────────────────────────── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Videos {recentVideos.length > 0 && `(${recentVideos.length})`}
          </span>
          {recentVideos.length > 0 && (
            <button
              onClick={() => navigate('/videos')}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              View all →
            </button>
          )}
        </div>

        {recentVideos.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)' }}>
            No videos yet — upload a file or record your screen above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recentVideos.slice(0, 10).map(v => (
              <button
                key={v.id}
                onClick={() => setActiveVideo(v)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.55rem 0.75rem', cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                {/* Thumbnail / icon */}
                <div style={{ width: 52, height: 36, borderRadius: 6, background: '#111', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
                  {v.thumbnailBase64
                    ? <img src={v.thumbnailBase64} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (v.type === 'recording' ? '⏺' : '▶')}
                </div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.title}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 2 }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontFamily: 'DM Mono, monospace' }}>{formatDuration(v.duration)}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{formatSize(v.size)}</span>
                    <span style={{ fontSize: '0.68rem', color: v.type === 'recording' ? '#e63946' : 'var(--accent)', fontWeight: 700 }}>
                      {v.type === 'recording' ? 'REC' : 'VIDEO'}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>▶</span>
              </button>
            ))}
            {recentVideos.length > 10 && (
              <button onClick={() => navigate('/videos')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', textAlign: 'center', padding: '0.25rem' }}>
                + {recentVideos.length - 10} more — view all
              </button>
            )}
          </div>
        )}
      </section>

      {/* Video player modal */}
      {activeVideo && (
        <Suspense fallback={null}>
          <VideoPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
        </Suspense>
      )}
    </div>
  );
}
