import { useState, useRef, useEffect, useCallback } from 'react';
import type { SavedVideo, VideoCaption, VideoNote, VideoNoteCategory, VideoNoteTemplate } from '../types';
import { useStore } from '../store';
import { getVideoDownloadUrl } from '../utils/videoStorage';
import { callAI } from '../utils/ai';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

const DEFAULT_TEMPLATES: VideoNoteTemplate[] = [
  { id: 'general', label: 'Note',  color: '#888888', template: '' },
  { id: 'why',     label: 'Why',   color: '#F5A623', template: 'Why this matters: ' },
  { id: 'how',     label: 'How',   color: '#2ecc71', template: 'How to do this:\n1. ' },
  { id: 'when',    label: 'When',  color: '#3498db', template: 'When to apply: ' },
  { id: 'fail',    label: 'Fail ⚠', color: '#e63946', template: 'Critical failure point: ' },
];

function fmtTime(secs: number): string {
  if (!isFinite(secs) || isNaN(secs)) return '0:00';
  const s = Math.floor(secs);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

type RightPanel = 'notes' | 'captions' | 'ai';

interface VideoPlayerProps {
  video: SavedVideo;
  onClose: () => void;
}

export default function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const { updateVideoMeta } = useStore();

  const [url, setUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [speed, setSpeed] = useState(video.defaultSpeed || 1);
  const [showCaptions, setShowCaptions] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(video.title);
  const [rightPanel, setRightPanel] = useState<RightPanel>('notes');

  // Captions
  const [captions, setCaptions] = useState<VideoCaption[]>(video.captions ?? []);
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);

  // Notes
  const [notes, setNotes] = useState<VideoNote[]>(video.notes ?? []);
  const [templates, setTemplates] = useState<VideoNoteTemplate[]>(
    video.noteTemplates?.length ? video.noteTemplates : DEFAULT_TEMPLATES
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('general');
  const [noteInput, setNoteInput] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteEditText, setNoteEditText] = useState('');
  const [noteEditCategory, setNoteEditCategory] = useState<VideoNoteCategory>('general');
  const [linkingNoteId, setLinkingNoteId] = useState<string | null>(null);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateColor, setNewTemplateColor] = useState('#888888');
  const [newTemplateText, setNewTemplateText] = useState('');

  // AI Notes
  const [aiNotePrompt, setAiNotePrompt] = useState('');
  const [aiNoteCategory, setAiNoteCategory] = useState<VideoNoteCategory>('general');
  const [aiNotePending, setAiNotePending] = useState(false);

  // AI Caption Chat
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [aiPending, setAiPending] = useState(false);
  const [pendingCaptions, setPendingCaptions] = useState<VideoCaption[] | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  // Direct DOM refs — updated on every timeupdate WITHOUT triggering React re-renders
  const seekBarRef   = useRef<HTMLInputElement>(null);
  const timeTextRef  = useRef<HTMLSpanElement>(null);
  // Tracks last active caption id so we only setState when it actually changes
  const activeCaptionIdRef = useRef<string | undefined>(undefined);
  // Mirrors currentTime for non-render reads (addNote, linking, etc.)
  const currentTimeRef = useRef(0);

  // Load signed URL on mount
  useEffect(() => {
    if (video.downloadUrl) {
      setUrl(video.downloadUrl);
    } else {
      getVideoDownloadUrl(video.storagePath)
        .then(u => { setUrl(u); updateVideoMeta(video.id, { downloadUrl: u }); })
        .catch(() => setUrlError(true));
    }
  }, [video.storagePath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  const handleVideoError = useCallback(async () => {
    try {
      const fresh = await getVideoDownloadUrl(video.storagePath);
      setUrl(fresh);
      updateVideoMeta(video.id, { downloadUrl: fresh });
    } catch {
      setUrlError(true);
    }
  }, [video.storagePath, video.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // High-frequency time updates: update DOM directly, only setState on caption boundary change
  const handleTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime ?? 0;
    currentTimeRef.current = t;
    // Direct DOM — zero React re-renders per tick
    if (seekBarRef.current) seekBarRef.current.value = String(t);
    if (timeTextRef.current) timeTextRef.current.textContent = `${fmtTime(t)} / ${fmtTime(duration)}`;
    // Only trigger re-render when active caption changes (crosses a boundary)
    const newId = showCaptions ? captions.find(c => t >= c.start && t <= c.end)?.id : undefined;
    if (newId !== activeCaptionIdRef.current) {
      activeCaptionIdRef.current = newId;
      setCurrentTime(t);
    }
  }, [captions, duration, showCaptions]);

  const activeCaption = showCaptions
    ? captions.find(c => currentTime >= c.start && currentTime <= c.end)
    : undefined;

  const saveTitleEdit = () => {
    setEditingTitle(false);
    if (title !== video.title) updateVideoMeta(video.id, { title });
  };

  const saveCaptionEdit = (id: string, text: string) => {
    const updated = captions.map(c => c.id === id ? { ...c, text } : c);
    setCaptions(updated);
    updateVideoMeta(video.id, { captions: updated });
    setEditingCaptionId(null);
  };

  const categoryForId = (id: string): VideoNoteCategory => {
    return templates.find(t => t.id === id)?.label ?? 'general';
  };
  const templateForId = (id: string) => templates.find(t => t.id === id);

  // When template selected, pre-fill input with template text
  const selectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    const t = templates.find(tt => tt.id === id);
    if (t?.template && !noteInput) setNoteInput(t.template);
  };

  // ── Notes ──────────────────────────────────────────────

  function persistNotes(updated: VideoNote[]) {
    setNotes(updated);
    updateVideoMeta(video.id, { notes: updated });
  }

  function addNote(text: string, ts?: number, catId?: string) {
    if (!text.trim()) return;
    const tpl = templates.find(t => t.id === (catId ?? selectedTemplateId));
    const note: VideoNote = {
      id: crypto.randomUUID(),
      timestamp: ts ?? currentTimeRef.current,
      text: text.trim(),
      category: tpl?.label ?? 'Note',
      createdAt: new Date().toISOString(),
    };
    const updated = [...notes, note].sort((a, b) => a.timestamp - b.timestamp);
    persistNotes(updated);
    setNoteInput('');
  }

  function deleteNote(id: string) {
    persistNotes(notes.filter(n => n.id !== id));
  }

  function saveNoteEdit(id: string) {
    const tpl = templates.find(t => t.label === noteEditCategory) ?? templates.find(t => t.id === 'general');
    const updated = notes.map(n => n.id === id ? { ...n, text: noteEditText, category: tpl?.label ?? noteEditCategory } : n);
    persistNotes(updated);
    setEditingNoteId(null);
  }

  function addLinkedTimestamp(noteId: string) {
    const updated = notes.map(n => {
      if (n.id !== noteId) return n;
      const existing = n.linkedTimestamps ?? [];
      if (existing.includes(currentTime)) return n;
      return { ...n, linkedTimestamps: [...existing, currentTime].sort((a, b) => a - b) };
    });
    persistNotes(updated);
    setLinkingNoteId(null);
  }

  function removeLinkedTimestamp(noteId: string, ts: number) {
    const updated = notes.map(n =>
      n.id === noteId ? { ...n, linkedTimestamps: (n.linkedTimestamps ?? []).filter(t => t !== ts) } : n
    );
    persistNotes(updated);
  }

  // ── Custom template manager ───────────────────────────

  function addCustomTemplate() {
    if (!newTemplateName.trim()) return;
    const t: VideoNoteTemplate = {
      id: crypto.randomUUID(),
      label: newTemplateName.trim(),
      color: newTemplateColor,
      template: newTemplateText,
    };
    const updated = [...templates, t];
    setTemplates(updated);
    updateVideoMeta(video.id, { noteTemplates: updated });
    setNewTemplateName(''); setNewTemplateColor('#888888'); setNewTemplateText('');
  }

  function deleteTemplate(id: string) {
    if (DEFAULT_TEMPLATES.some(t => t.id === id)) return; // protect defaults
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    updateVideoMeta(video.id, { noteTemplates: updated });
    if (selectedTemplateId === id) setSelectedTemplateId('general');
  }

  // ── AI Note generation ────────────────────────────────

  async function generateAiNote() {
    if (!aiNotePrompt.trim() || aiNotePending) return;
    const prompt = aiNotePrompt.trim();
    const catId = aiNoteCategory;
    setAiNotePrompt('');
    setAiNotePending(true);

    const tpl = templates.find(t => t.id === catId);
    const captionContext = captions.length > 0
      ? `\nVideo captions (up to ${fmtTime(currentTime)}):\n${captions.filter(c => c.end <= currentTime + 5).map(c => `[${fmtTime(c.start)}] ${c.text}`).join('\n')}`
      : '';

    try {
      const response = await callAI([{
        role: 'user',
        content: `You are a study note assistant. Write a concise note in the "${tpl?.label ?? 'Note'}" category.${captionContext}\n\nRequest: ${prompt}\n\nReturn only the note text (can use bullet points, no heading).`,
      }]);
      addNote(response.trim(), currentTime, catId);
    } catch (e: any) {
      addNote(`[AI Error: ${e?.message ?? 'Failed'}]`, currentTime, 'general');
    } finally {
      setAiNotePending(false);
    }
  }

  // ── AI Caption Chat ───────────────────────────────────

  async function sendCaptionChat() {
    const msg = chatInput.trim();
    if (!msg || aiPending) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setAiPending(true);

    const systemPrompt = `You are a transcript/caption editor.
Current captions JSON:
${JSON.stringify(captions, null, 2)}

Return ONLY a valid JSON array: [{id, start, end, text}].
Preserve all id/start/end fields. Only modify text. No explanation — JSON only.`;

    try {
      const raw = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: msg },
      ]);
      let parsed: VideoCaption[] | null = null;
      try { parsed = JSON.parse(raw.trim()); } catch {
        const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || raw.match(/(\[[\s\S]*\])/);
        if (match) { try { parsed = JSON.parse(match[1].trim()); } catch { /* ignore */ } }
      }
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid caption format returned');
      setPendingCaptions(parsed);
      setChatMessages(prev => [...prev, { role: 'ai', text: `Preview ready — ${parsed!.length} captions. Apply or discard.` }]);
    } catch (e: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${e?.message ?? 'AI failed'}. Original captions unchanged.` }]);
    } finally {
      setAiPending(false);
    }
  }

  function applyPendingCaptions() {
    if (!pendingCaptions) return;
    setCaptions(pendingCaptions);
    updateVideoMeta(video.id, { captions: pendingCaptions });
    setPendingCaptions(null);
    setChatMessages(prev => [...prev, { role: 'ai', text: 'Captions applied.' }]);
  }

  const noteCategoryColor = (category: string) => {
    return templates.find(t => t.label === category)?.color ?? '#888';
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.75rem' }}
    >
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 1160, maxHeight: '94vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
        {/* Header */}
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {editingTitle ? (
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onBlur={saveTitleEdit} onKeyDown={e => e.key === 'Enter' && saveTitleEdit()}
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 6, padding: '0.25rem 0.5rem', color: 'var(--text)', fontSize: '0.92rem' }}
            />
          ) : (
            <span style={{ flex: 1, fontFamily: 'Sora, sans-serif', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text)', cursor: 'pointer' }}
              onClick={() => setEditingTitle(true)} title="Click to rename">{title}</span>
          )}
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', padding: '0.15rem 0.45rem', background: 'var(--bg)', borderRadius: 4 }}>
            {video.type === 'recording' ? 'Recording' : 'Upload'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          {/* Left: Video + controls */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            {/* Video */}
            <div style={{ position: 'relative', background: '#000', flex: '0 0 auto', aspectRatio: '16/9', maxHeight: '46vh' }}>
              {urlError ? (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexDirection: 'column', gap: 8 }}>
                  <span>⚠ Could not load video</span>
                  <button onClick={handleVideoError} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem' }}>Retry</button>
                </div>
              ) : url ? (
                <video ref={videoRef} src={url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} playsInline
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                  onError={handleVideoError}
                />
              ) : (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>Loading…</div>
              )}
              {activeCaption && (
                <div style={{ position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.78)', color: '#fff', borderRadius: 6, padding: '0.25rem 0.7rem', fontSize: '0.88rem', maxWidth: '80%', textAlign: 'center', pointerEvents: 'none' }}>
                  {activeCaption.text}
                </div>
              )}
              {/* Linking mode indicator */}
              {linkingNoteId && (
                <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', background: 'var(--accent)', color: '#000', borderRadius: 6, padding: '0.25rem 0.7rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => addLinkedTimestamp(linkingNoteId)}>
                  Click here to link {fmtTime(currentTimeRef.current)} to note
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ padding: '0.5rem 0.7rem', background: 'var(--bg)', borderTop: '1px solid var(--border)', flex: '0 0 auto' }}>
              <input ref={seekBarRef} type="range" min={0} max={duration || 1} step={0.1} defaultValue={0}
                onChange={e => {
                  const t = parseFloat(e.target.value);
                  currentTimeRef.current = t;
                  if (videoRef.current) videoRef.current.currentTime = t;
                  setCurrentTime(t);
                }}
                style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: '0.35rem' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button onClick={() => playing ? videoRef.current?.pause() : videoRef.current?.play()}
                  style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0.25rem 0.6rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                  {playing ? '⏸' : '▶'}
                </button>
                <span ref={timeTextRef} style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  {fmtTime(currentTime)} / {fmtTime(duration)}
                </span>
                <div style={{ display: 'flex', gap: '0.15rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={() => setSpeed(s)} style={{ background: speed === s ? 'var(--accent)' : 'var(--card)', color: speed === s ? '#000' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.15rem 0.35rem', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'DM Mono, monospace' }}>
                      {s === 1 ? '1×' : `${s}×`}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowCaptions(v => !v)}
                  style={{ background: showCaptions ? 'var(--accent)' : 'var(--card)', color: showCaptions ? '#000' : 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.15rem 0.45rem', cursor: 'pointer', fontSize: '0.72rem' }}>CC</button>
                {url && (
                  <a href={url} download={title} style={{ background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.15rem 0.45rem', fontSize: '0.72rem', textDecoration: 'none' }}>↓</a>
                )}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div style={{ width: 310, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg)', flex: '0 0 310px' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {(['notes', 'captions', 'ai'] as RightPanel[]).map(tab => (
                <button key={tab} onClick={() => setRightPanel(tab)} style={{ flex: 1, padding: '0.45rem 0.2rem', border: 'none', cursor: 'pointer', background: rightPanel === tab ? 'var(--card)' : 'transparent', color: rightPanel === tab ? 'var(--accent)' : 'var(--muted)', fontSize: '0.75rem', fontWeight: rightPanel === tab ? 700 : 400, borderBottom: rightPanel === tab ? '2px solid var(--accent)' : '2px solid transparent' }}>
                  {tab === 'notes' ? `Notes (${notes.length})` : tab === 'captions' ? `CC (${captions.length})` : 'AI Chat'}
                </button>
              ))}
            </div>

            {/* NOTES PANEL */}
            {rightPanel === 'notes' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Template manager toggle */}
                <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                    {templates.map(t => (
                      <button key={t.id} onClick={() => selectTemplate(t.id)}
                        style={{ border: `1px solid ${t.color}`, borderRadius: 10, padding: '0.1rem 0.45rem', cursor: 'pointer', fontSize: '0.7rem', background: selectedTemplateId === t.id ? t.color : 'transparent', color: selectedTemplateId === t.id ? '#000' : t.color, fontWeight: selectedTemplateId === t.id ? 700 : 400 }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowTemplateManager(v => !v)}
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem', flexShrink: 0 }} title="Manage categories">
                    ⚙
                  </button>
                </div>

                {/* Template manager */}
                {showTemplateManager && (
                  <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' }}>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>Custom Categories</p>
                    {templates.filter(t => !DEFAULT_TEMPLATES.some(d => d.id === t.id)).map(t => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.25rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: '0.75rem', color: 'var(--text)' }}>{t.label}</span>
                        <button onClick={() => deleteTemplate(t.id)} style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontSize: '0.7rem' }}>✕</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
                      <input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)}
                        placeholder="Category name" style={{ flex: 2, minWidth: 80, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.25rem 0.4rem', color: 'var(--text)', fontSize: '0.75rem' }} />
                      <input type="color" value={newTemplateColor} onChange={e => setNewTemplateColor(e.target.value)}
                        style={{ width: 30, height: 26, border: 'none', cursor: 'pointer', borderRadius: 4, background: 'none', padding: 0 }} />
                    </div>
                    <textarea value={newTemplateText} onChange={e => setNewTemplateText(e.target.value)}
                      placeholder="Template text (optional pre-fill)" rows={2}
                      style={{ width: '100%', marginTop: '0.25rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.25rem 0.4rem', color: 'var(--text)', fontSize: '0.75rem', resize: 'none', boxSizing: 'border-box' }}
                    />
                    <button onClick={addCustomTemplate} style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 4, padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, marginTop: '0.25rem' }}>
                      Add Category
                    </button>
                  </div>
                )}

                {/* Notes list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.4rem' }}>
                  {notes.length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>
                      No notes yet. Add a note below at the current timestamp.
                    </p>
                  )}
                  {notes.map(n => (
                    <div key={n.id} style={{ marginBottom: '0.4rem', background: 'var(--card)', borderRadius: 8, padding: '0.45rem 0.55rem', borderLeft: `3px solid ${noteCategoryColor(n.category)}`, border: `1px solid var(--border)`, borderLeftWidth: 3, borderLeftColor: noteCategoryColor(n.category) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
                        <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = n.timestamp; setCurrentTime(n.timestamp); }}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'DM Mono, monospace', padding: 0 }}>
                          ▶ {fmtTime(n.timestamp)}
                        </button>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: noteCategoryColor(n.category), padding: '0.05rem 0.3rem', border: `1px solid ${noteCategoryColor(n.category)}`, borderRadius: 8 }}>
                          {n.category}
                        </span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.2rem' }}>
                          <button
                            onClick={() => linkingNoteId === n.id ? setLinkingNoteId(null) : setLinkingNoteId(n.id)}
                            title="Link current timestamp to this note"
                            style={{ background: linkingNoteId === n.id ? 'var(--accent)' : 'none', border: 'none', color: linkingNoteId === n.id ? '#000' : 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px', borderRadius: 4 }}>🔗</button>
                          <button onClick={() => { setEditingNoteId(n.id); setNoteEditText(n.text); setNoteEditCategory(n.category); }}
                            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✎</button>
                          <button onClick={() => deleteNote(n.id)}
                            style={{ background: 'none', border: 'none', color: '#e63946', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>✕</button>
                        </div>
                      </div>

                      {editingNoteId === n.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: 2 }}>
                            {templates.map(t => (
                              <button key={t.id} onClick={() => setNoteEditCategory(t.label)}
                                style={{ border: `1px solid ${t.color}`, borderRadius: 8, padding: '0.08rem 0.35rem', cursor: 'pointer', fontSize: '0.65rem', background: noteEditCategory === t.label ? t.color : 'transparent', color: noteEditCategory === t.label ? '#000' : t.color }}>
                                {t.label}
                              </button>
                            ))}
                          </div>
                          <textarea value={noteEditText} onChange={e => setNoteEditText(e.target.value)}
                            style={{ background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 4, padding: '0.3rem 0.4rem', color: 'var(--text)', fontSize: '0.78rem', resize: 'vertical', minHeight: 60 }} />
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveNoteEdit(n.id)} style={{ flex: 1, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 4, padding: '0.2rem', cursor: 'pointer', fontSize: '0.72rem' }}>Save</button>
                            <button onClick={() => setEditingNoteId(null)} style={{ flex: 1, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.2rem', cursor: 'pointer', fontSize: '0.72rem' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{n.text}</p>
                      )}

                      {/* Linked timestamps */}
                      {(n.linkedTimestamps?.length ?? 0) > 0 && (
                        <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          {n.linkedTimestamps!.map(ts => (
                            <span key={ts} style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', background: 'rgba(245,166,35,0.1)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.1rem 0.35rem' }}>
                              <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = ts; setCurrentTime(ts); }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.68rem', fontFamily: 'DM Mono, monospace', padding: 0 }}>
                                ▶ {fmtTime(ts)}
                              </button>
                              <button onClick={() => removeLinkedTimestamp(n.id, ts)}
                                style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.62rem', padding: 0 }}>✕</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add note input */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '0.45rem 0.5rem' }}>
                  <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.35rem' }}>
                    <textarea value={noteInput} onChange={e => setNoteInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote(noteInput); } }}
                      placeholder={`${templateForId(selectedTemplateId)?.label ?? 'Note'} at ${fmtTime(currentTimeRef.current)}… (Enter)`}
                      rows={2}
                      style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.3rem 0.45rem', color: 'var(--text)', fontSize: '0.78rem', resize: 'none' }}
                    />
                    <button onClick={() => addNote(noteInput)}
                      style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0 0.5rem', cursor: 'pointer', fontWeight: 700, alignSelf: 'stretch' }}>+</button>
                  </div>
                  {/* AI note */}
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    <select value={aiNoteCategory} onChange={e => setAiNoteCategory(e.target.value)}
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '0.25rem 0.3rem', color: 'var(--text)', fontSize: '0.72rem', maxWidth: 80 }}>
                      {templates.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    <input value={aiNotePrompt} onChange={e => setAiNotePrompt(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && generateAiNote()}
                      placeholder="✨ AI: summarize this section…"
                      style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.28rem 0.45rem', color: 'var(--text)', fontSize: '0.75rem' }}
                    />
                    <button onClick={generateAiNote} disabled={aiNotePending || !aiNotePrompt.trim()}
                      style={{ background: aiNotePending ? 'var(--border)' : 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0.28rem 0.5rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                      {aiNotePending ? '…' : '✨'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* CAPTIONS PANEL */}
            {rightPanel === 'captions' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                {captions.length === 0 && (
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', textAlign: 'center', padding: '1rem 0' }}>
                    No captions. Record screen with mic to auto-generate.
                  </p>
                )}
                {captions.map(c => (
                  <div key={c.id} onClick={() => { if (videoRef.current) videoRef.current.currentTime = c.start; setCurrentTime(c.start); }}
                    style={{ display: 'flex', gap: '0.4rem', padding: '0.25rem 0.3rem', borderRadius: 6, cursor: 'pointer', marginBottom: 2, background: currentTime >= c.start && currentTime <= c.end ? 'rgba(245,166,35,0.1)' : 'transparent' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.68rem', color: 'var(--accent)', minWidth: 38, paddingTop: 2 }}>{fmtTime(c.start)}</span>
                    {editingCaptionId === c.id ? (
                      <input autoFocus defaultValue={c.text}
                        onBlur={e => saveCaptionEdit(c.id, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveCaptionEdit(c.id, (e.target as HTMLInputElement).value)}
                        style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 4, padding: '0.12rem 0.3rem', color: 'var(--text)', fontSize: '0.78rem' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--text)' }}
                        onDoubleClick={e => { e.stopPropagation(); setEditingCaptionId(c.id); }}>{c.text}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* AI CHAT PANEL */}
            {rightPanel === 'ai' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted)' }}>Ask AI to clean up, merge, translate captions.</p>
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? 'var(--accent)' : 'var(--card)', color: m.role === 'user' ? '#000' : 'var(--text)', borderRadius: 8, padding: '0.3rem 0.5rem', fontSize: '0.77rem', maxWidth: '92%' }}>
                      {m.text}
                    </div>
                  ))}
                  {pendingCaptions && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={applyPendingCaptions} style={{ flex: 1, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0.28rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.75rem' }}>Apply</button>
                      <button onClick={() => setPendingCaptions(null)} style={{ flex: 1, background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.28rem', cursor: 'pointer', fontSize: '0.75rem' }}>Discard</button>
                    </div>
                  )}
                </div>
                <div style={{ padding: '0.3rem 0.5rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', borderTop: '1px solid var(--border)' }}>
                  {['Fix punctuation', 'Merge short lines', 'Remove filler words', 'Translate to Spanish'].map(p => (
                    <button key={p} onClick={() => setChatInput(p)} disabled={aiPending || captions.length === 0}
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.12rem 0.4rem', cursor: 'pointer', fontSize: '0.68rem', color: 'var(--text)' }}>{p}</button>
                  ))}
                </div>
                <div style={{ padding: '0.4rem 0.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.3rem' }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendCaptionChat()}
                    placeholder={captions.length === 0 ? 'No captions to edit' : 'Ask AI to edit captions…'}
                    disabled={aiPending || captions.length === 0}
                    style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.32rem 0.45rem', color: 'var(--text)', fontSize: '0.78rem' }}
                  />
                  <button onClick={sendCaptionChat} disabled={aiPending || !chatInput.trim() || captions.length === 0}
                    style={{ background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 6, padding: '0.32rem 0.5rem', cursor: 'pointer', fontWeight: 700, fontSize: '0.78rem' }}>
                    {aiPending ? '…' : '→'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
