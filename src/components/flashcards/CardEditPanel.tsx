// CardEditPanel — bottom-sheet card editor (media, paste, file upload)
// Used in: Flashcards.tsx (ManageFlashcards) + SpacedRepMode.tsx (inline review edit)
import { useState, useEffect, useRef } from 'react'
import { X, Image, Youtube, Save, Paperclip, Trash2, Link } from 'lucide-react'

// ── Manual card templates ──────────────────────────────────────────────────────
interface CardTemplate {
  id: string
  label: string
  emoji: string
  front: string
  back: string
}

const CARD_TEMPLATES: CardTemplate[] = [
  {
    id: 'procedural',
    label: 'Procedural Chain',
    emoji: '🔗',
    front: `SKILL NAME
─────────────────────────────────
SUPPLIES:
─────────────────────────────────
⭐ CRITICAL:
⭐ CRITICAL:
⭐ CRITICAL:
─────────────────────────────────
Q: Walk me through the full procedure.`,
    back: `PHASE 1 — ENTRY
1. Knock, wait
2. ID self + resident
3. Wash hands
4. Explain procedure (clearly, slowly, face-to-face)
5. Privacy (curtain/screen/door)

PHASE 2 — SETUP
6.
7.

PHASE 3 — THE SKILL
8. ⭐
   →
9. ⭐
   →
10.

PHASE 4 — WRAP-UP
[N]. Call light within reach
[N+1]. Wash hands
[N+2]. Record:
[N+3]. ⭐ Report to nurse if `,
  },
]
import type { FlashcardItem } from '../../types'
import type { FlashcardMedia } from '../../utils/mediaUtils'
import { getYouTubeId } from '../../utils/mediaUtils'
import FlashcardMediaComponent from '../FlashcardMedia'

interface CardEditPanelProps {
  isOpen: boolean
  card: FlashcardItem | null
  onSave: (updated: FlashcardItem) => void
  onClose: () => void
  title?: string
}

export default function CardEditPanel({
  isOpen,
  card,
  onSave,
  onClose,
  title = 'Edit Card',
}: CardEditPanelProps) {
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [topic, setTopic] = useState('')
  const [mediaType, setMediaType] = useState<'youtube' | 'image' | 'video' | null>(null)
  const [mediaSrc, setMediaSrc] = useState('')
  const [mediaCaption, setMediaCaption] = useState('')
  const [mediaSide, setMediaSide] = useState<'front' | 'back' | 'both'>('back')
  const [mediaUrlInput, setMediaUrlInput] = useState('')
  const [mediaError, setMediaError] = useState('')
  const imageFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)

  // Sync state whenever card changes
  useEffect(() => {
    if (!card) return
    setFront(card.front)
    setBack(card.back)
    setTopic(card.topic || '')
    setMediaType(card.media?.type ?? null)
    setMediaSrc(card.media?.src ?? '')
    setMediaCaption(card.media?.caption ?? '')
    setMediaSide(card.media?.side ?? 'back')
    setMediaUrlInput('')
    setMediaError('')
  }, [card])

  function handleFileToBase64(file: File, type: 'image' | 'video') {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      setMediaSrc(result)
      setMediaType(type)
      setMediaError('')
    }
    reader.readAsDataURL(file)
  }

  // Paste image from clipboard directly into front/back textareas
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) handleFileToBase64(file, 'image')
      }
    }
  }

  function applyMediaUrl() {
    const url = mediaUrlInput.trim()
    if (!url) return
    if (getYouTubeId(url)) {
      setMediaType('youtube')
      setMediaSrc(url)
      setMediaError('')
    } else if (/\.(jpe?g|png|gif|webp|svg)(\?|$)/i.test(url)) {
      setMediaType('image')
      setMediaSrc(url)
      setMediaError('')
    } else {
      setMediaError('Paste a YouTube URL or direct image URL (.jpg, .png, etc.)')
    }
    setMediaUrlInput('')
  }

  function clearMedia() {
    setMediaType(null)
    setMediaSrc('')
    setMediaCaption('')
    setMediaUrlInput('')
    setMediaError('')
  }

  function handleSave() {
    if (!front.trim() || !back.trim()) return
    const media: FlashcardMedia | undefined =
      mediaType && mediaSrc
        ? { type: mediaType, src: mediaSrc, side: mediaSide, caption: mediaCaption || undefined }
        : undefined
    onSave({
      front: front.trim(),
      back: back.trim(),
      ...(topic.trim() ? { topic: topic.trim() } : {}),
      ...(media ? { media } : {}),
    })
  }

  if (!isOpen) return null

  const builtMedia: FlashcardMedia | null =
    mediaType && mediaSrc
      ? { type: mediaType, src: mediaSrc, side: mediaSide, caption: mediaCaption || undefined }
      : null

  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
    letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 4,
  }

  const textareaStyle: React.CSSProperties = {
    width: '100%', resize: 'vertical',
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px',
    fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  const urlInputStyle: React.CSSProperties = {
    flex: 1,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 8, color: 'var(--text-primary)', padding: '6px 10px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 999, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Bottom-sheet panel */}
      <div
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          maxHeight: '90vh', overflowY: 'auto',
          background: 'var(--bg-primary)', borderTop: '2px solid var(--accent)',
          borderRadius: '16px 16px 0 0', zIndex: 1000, padding: 20,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Template shortcuts */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', alignSelf: 'center', fontWeight: 600 }}>
            <Link size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />Template:
          </span>
          {CARD_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              className="btn btn-secondary btn-sm"
              title={`Pre-fill with ${tpl.label} structure`}
              onClick={() => {
                // Only fill if fields are empty or user confirms overwrite
                if (!front.trim() && !back.trim()) {
                  setFront(tpl.front)
                  setBack(tpl.back)
                } else if (window.confirm(`Replace current content with the ${tpl.label} template?`)) {
                  setFront(tpl.front)
                  setBack(tpl.back)
                }
              }}
              style={{ fontSize: 11, padding: '3px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {tpl.emoji} {tpl.label}
            </button>
          ))}
        </div>

        {/* Front */}
        <label style={labelStyle}>Front</label>
        <textarea
          value={front}
          onChange={e => setFront(e.target.value)}
          onPaste={handlePaste}
          rows={3}
          placeholder="Question or term…"
          style={{ ...textareaStyle, marginBottom: 12 }}
        />

        {/* Back */}
        <label style={labelStyle}>Back</label>
        <textarea
          value={back}
          onChange={e => setBack(e.target.value)}
          onPaste={handlePaste}
          rows={4}
          placeholder="Answer or definition…"
          style={{ ...textareaStyle, marginBottom: 12 }}
        />

        {/* Topic */}
        <label style={labelStyle}>Topic (optional)</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Cell Biology"
          style={{
            ...textareaStyle, resize: undefined, marginBottom: 16,
            padding: '8px 10px',
          }}
        />

        {/* ── Media section ──────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Media (optional)</label>

          {!mediaType ? (
            <div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => imageFileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Image size={13} /> Upload Image
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => videoFileRef.current?.click()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Paperclip size={13} /> Upload Video
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setMediaType('youtube'); setMediaUrlInput('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Youtube size={13} /> YouTube
                </button>
              </div>
              {/* URL paste row */}
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={mediaUrlInput}
                  onChange={e => setMediaUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyMediaUrl()}
                  placeholder="Paste image or YouTube URL…"
                  style={urlInputStyle}
                />
                <button className="btn btn-secondary btn-sm" onClick={applyMediaUrl}>Add</button>
              </div>
              {mediaError && (
                <p style={{ fontSize: 12, color: 'var(--red)', margin: '4px 0 0' }}>{mediaError}</p>
              )}
            </div>
          ) : (
            <div>
              {/* YouTube URL input (before src is set) */}
              {mediaType === 'youtube' && !mediaSrc && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={mediaUrlInput}
                    onChange={e => setMediaUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyMediaUrl()}
                    placeholder="Paste YouTube URL…"
                    style={urlInputStyle}
                    autoFocus
                  />
                  <button className="btn btn-secondary btn-sm" onClick={applyMediaUrl}>Add</button>
                </div>
              )}

              {/* Preview */}
              {builtMedia && (
                <div style={{ marginBottom: 10 }}>
                  <FlashcardMediaComponent media={builtMedia} isActive />
                </div>
              )}

              {/* Side selector + remove */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Show on:</span>
                {(['front', 'back', 'both'] as const).map(s => (
                  <button
                    key={s}
                    className={`btn btn-sm ${mediaSide === s ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setMediaSide(s)}
                    style={{ fontSize: 11, padding: '3px 10px' }}
                  >
                    {s}
                  </button>
                ))}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={clearMedia}
                  style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }}
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>

              {/* Caption */}
              <input
                value={mediaCaption}
                onChange={e => setMediaCaption(e.target.value)}
                placeholder="Caption (optional)"
                style={{ ...textareaStyle, padding: '6px 10px', resize: undefined }}
              />
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFileToBase64(f, 'image')
              e.target.value = ''
            }}
          />
          <input
            ref={videoFileRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFileToBase64(f, 'video')
              e.target.value = ''
            }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!front.trim() || !back.trim()}
            style={{ flex: 1 }}
          >
            <Save size={14} /> Save Card
          </button>
          <button className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
