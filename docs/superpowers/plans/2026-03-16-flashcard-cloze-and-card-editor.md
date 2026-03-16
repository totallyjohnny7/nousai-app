# Flashcard Cloze Formats + Card Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 cloze/generation format options to the AI flashcard generator (with live example preview on click), a shared `CardEditPanel` for editing any card's content+media, per-card edit/delete/duplicate actions in Flashcards.tsx, and an inline edit button during FSRS review sessions.

**Architecture:** Extract a shared `CardEditPanel.tsx` component that handles front/back editing + image/YouTube/video media; wire it into both the Flashcards browse view (per-card toolbar) and `SpacedRepMode` (edit icon during review). The AI generator gets a `FormatPicker` component that drives prompt construction from a data array — each format entry holds its label, description, example front/back, and a `buildPrompt(noteContent)` function.

**Tech Stack:** React 19 + TypeScript, Zustand (`useStore`), Lucide React icons, existing `mediaUtils.ts`, existing `FlashcardMedia.tsx`, `callAI()` from `utils/ai.ts`.

**Note:** Always test with real profile `reallyjustjohnny6@gmail.com` on https://nousai-app.vercel.app.

---

## Chunk 1: Shared CardEditPanel Component

### Task 1: Create `CardEditPanel.tsx`

**Files:**
- Create: `src/components/flashcards/CardEditPanel.tsx`

This component is a bottom-sheet drawer for editing a single `FlashcardItem`. It handles:
- Front / back textareas
- Topic text input
- Media attachment: image file upload, image URL paste, YouTube URL, video file upload
- Image paste from clipboard (paste event on textareas)
- Save / Cancel buttons

- [ ] **Step 1: Create `CardEditPanel.tsx` with the full implementation**

```tsx
// src/components/flashcards/CardEditPanel.tsx
import { useState, useEffect, useRef } from 'react'
import { X, Image, Youtube, Save, Paperclip, Trash2 } from 'lucide-react'
import type { FlashcardItem } from '../../types'
import type { FlashcardMedia } from '../../utils/mediaUtils'
import { validateMedia, getYouTubeId } from '../../utils/mediaUtils'
import FlashcardMediaComponent from '../FlashcardMedia'

interface CardEditPanelProps {
  isOpen: boolean
  card: FlashcardItem | null
  onSave: (updated: FlashcardItem) => void
  onClose: () => void
  title?: string
}

export default function CardEditPanel({ isOpen, card, onSave, onClose, title = 'Edit Card' }: CardEditPanelProps) {
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

  // Reset state whenever the card changes
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
    const media: FlashcardMedia | undefined = mediaType && mediaSrc
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

  const builtMedia: FlashcardMedia | null = mediaType && mediaSrc
    ? { type: mediaType, src: mediaSrc, side: mediaSide, caption: mediaCaption || undefined }
    : null

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
      {/* Panel */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--bg-primary)', borderTop: '2px solid var(--accent)',
        borderRadius: '16px 16px 0 0', zIndex: 1000, padding: 20,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Front */}
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Front</label>
        <textarea
          value={front}
          onChange={e => setFront(e.target.value)}
          onPaste={handlePaste}
          rows={3}
          placeholder="Question or term..."
          style={{
            width: '100%', resize: 'vertical', marginTop: 4, marginBottom: 12,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px',
            fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        {/* Back */}
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Back</label>
        <textarea
          value={back}
          onChange={e => setBack(e.target.value)}
          onPaste={handlePaste}
          rows={4}
          placeholder="Answer or definition..."
          style={{
            width: '100%', resize: 'vertical', marginTop: 4, marginBottom: 12,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px',
            fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        {/* Topic */}
        <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Topic (optional)</label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Cell Biology"
          style={{
            width: '100%', marginTop: 4, marginBottom: 16,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text-primary)', padding: '8px 10px',
            fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />

        {/* Media section */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
            Media (optional)
          </label>

          {!mediaType ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                onClick={() => setMediaType('youtube')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Youtube size={13} /> YouTube
              </button>
              {/* URL input for image/YouTube */}
              <div style={{ display: 'flex', gap: 6, width: '100%', marginTop: 4 }}>
                <input
                  value={mediaUrlInput}
                  onChange={e => setMediaUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyMediaUrl()}
                  placeholder="Paste image or YouTube URL..."
                  style={{
                    flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-primary)', padding: '6px 10px',
                    fontSize: 13, fontFamily: 'inherit',
                  }}
                />
                <button className="btn btn-secondary btn-sm" onClick={applyMediaUrl}>Add</button>
              </div>
              {mediaError && <p style={{ fontSize: 12, color: 'var(--red)', margin: '4px 0 0' }}>{mediaError}</p>}
            </div>
          ) : (
            <div>
              {/* Media preview */}
              {builtMedia && (
                <div style={{ marginBottom: 10 }}>
                  <FlashcardMediaComponent media={builtMedia} isActive />
                </div>
              )}
              {mediaType === 'youtube' && !mediaSrc && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={mediaUrlInput}
                    onChange={e => setMediaUrlInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyMediaUrl()}
                    placeholder="Paste YouTube URL..."
                    style={{
                      flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 8, color: 'var(--text-primary)', padding: '6px 10px',
                      fontSize: 13, fontFamily: 'inherit',
                    }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={applyMediaUrl}>Add</button>
                </div>
              )}
              {/* Media settings */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Show on:</label>
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
                <button className="btn btn-secondary btn-sm" onClick={clearMedia} style={{ marginLeft: 'auto', color: 'var(--red)', borderColor: 'var(--red)' }}>
                  <Trash2 size={12} /> Remove
                </button>
              </div>
              <input
                value={mediaCaption}
                onChange={e => setMediaCaption(e.target.value)}
                placeholder="Caption (optional)"
                style={{
                  width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 8, color: 'var(--text-primary)', padding: '6px 10px',
                  fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Hidden file inputs */}
          <input
            ref={imageFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileToBase64(f, 'image'); e.target.value = '' }}
          />
          <input
            ref={videoFileRef}
            type="file"
            accept="video/*"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileToBase64(f, 'video'); e.target.value = '' }}
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
```

- [ ] **Step 2: Verify it compiles (no TS errors)**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors related to `CardEditPanel.tsx`

- [ ] **Step 3: Commit**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && git add src/components/flashcards/CardEditPanel.tsx && git commit -m "feat: add shared CardEditPanel component with media + clipboard paste"
```

---

## Chunk 2: Cloze Format Picker in FlashcardGenTool

### Task 2: Add `CLOZE_FORMATS` data + `FormatPicker` UI to `FlashcardGenTool.tsx`

**Files:**
- Modify: `src/components/aitools/FlashcardGenTool.tsx`

The format picker shows 7 format chips. Clicking a chip selects it AND toggles a live example preview card directly below the chip. The selected format's `buildPrompt()` function is used when Generate is pressed.

- [ ] **Step 1: Replace `FlashcardGenTool.tsx` with the enhanced version**

```tsx
// src/components/aitools/FlashcardGenTool.tsx
import { useState } from 'react';
import { Layers, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Note } from '../../types';
import { selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

// ── Format definitions ─────────────────────────────────────────────────────────
interface CardFormat {
  id: string;
  label: string;
  emoji: string;
  description: string;
  exampleFront: string;
  exampleBack: string;
  buildPrompt: (title: string, content: string) => string;
}

const CARD_FORMATS: CardFormat[] = [
  {
    id: 'qa',
    label: 'Q&A',
    emoji: '❓',
    description: 'Classic question on front, answer on back',
    exampleFront: 'What is the function of the mitochondria?',
    exampleBack: 'To produce ATP through cellular respiration — the powerhouse of the cell.',
    buildPrompt: (title, content) =>
      `Generate 10 question-and-answer flashcard pairs from the note below. Return ONLY a valid JSON array with "front" (question) and "back" (answer) fields.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Question?","back":"Answer."},...]`,
  },
  {
    id: 'cloze',
    label: 'Cloze',
    emoji: '🔳',
    description: 'Sentence with a key term blanked out (Anki-style)',
    exampleFront: 'The {{c1::mitochondria}} is the powerhouse of the cell.',
    exampleBack: 'mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 cloze deletion flashcards from the note below. Each card hides one KEY term using {{c1::term}} syntax. The "front" is the full sentence with {{c1::term}} notation, the "back" is ONLY the hidden term/phrase. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"The {{c1::term}} does X.","back":"term"},...]`,
  },
  {
    id: 'fillin',
    label: 'Fill-in-Blank',
    emoji: '✏️',
    description: 'Complete the sentence — fill in the blank',
    exampleFront: 'The _____ is responsible for producing ATP in eukaryotic cells.',
    exampleBack: 'mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 fill-in-the-blank flashcards from the note below. Replace one KEY word or phrase in a sentence with "_____". The "front" is the sentence with the blank, the "back" is the missing word/phrase only. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"The _____ does X.","back":"missing term"},...]`,
  },
  {
    id: 'term',
    label: 'Term → Def',
    emoji: '📖',
    description: 'Term on front, full definition on back',
    exampleFront: 'Mitochondria',
    exampleBack: 'A membrane-bound organelle found in eukaryotic cells responsible for producing ATP via aerobic respiration.',
    buildPrompt: (title, content) =>
      `Generate 10 vocabulary flashcards from the note below. "front" is the TERM only, "back" is the full definition or explanation (2-4 sentences). Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Term","back":"Full definition with context."},...]`,
  },
  {
    id: 'reversed',
    label: 'Reversed',
    emoji: '🔄',
    description: 'Definition on front, term on back (tests recall)',
    exampleFront: 'The organelle responsible for producing ATP through cellular respiration in eukaryotic cells.',
    exampleBack: 'Mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 reverse-recall flashcards from the note below. "front" is the DEFINITION or description, "back" is the TERM or concept name. This tests active recall. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Full description of concept...","back":"Term"},...]`,
  },
  {
    id: 'truefalse',
    label: 'True / False',
    emoji: '⚖️',
    description: 'True or false statement with explanation',
    exampleFront: 'Mitochondria are only found in animal cells.',
    exampleBack: 'FALSE — Mitochondria are found in nearly all eukaryotic cells, including plant cells.',
    buildPrompt: (title, content) =>
      `Generate 10 true/false flashcards from the note below. "front" is a statement that is either true or false. "back" begins with "TRUE" or "FALSE" followed by " — " and a brief explanation. Mix true and false statements roughly 50/50. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Statement.","back":"TRUE — explanation."},...]`,
  },
  {
    id: 'elaboration',
    label: 'Elaborate',
    emoji: '🧠',
    description: 'Concept on front — deep explanation + example on back',
    exampleFront: 'Explain oxidative phosphorylation and why it matters.',
    exampleBack: 'Oxidative phosphorylation is the process by which mitochondria use the electron transport chain to generate a proton gradient, driving ATP synthase to produce ~28 ATP per glucose. It matters because it accounts for ~90% of cellular ATP — without it, only 2 ATP come from glycolysis. Analogy: it\'s like a water wheel powered by a chemical current.',
    buildPrompt: (title, content) =>
      `Generate 10 elaboration flashcards from the note below. "front" asks to explain a concept (e.g. "Explain X and why it matters"). "back" gives a thorough 3-5 sentence explanation including: what it is, how it works, why it matters, and a real-world example or analogy. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Explain X and why it matters.","back":"Detailed explanation with example."},...]`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
interface GeneratedCard {
  front: string;
  back: string;
  checked: boolean;
}

function parseJsonArray(response: string): unknown[] | null {
  try {
    let s = response.trim();
    const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) s = codeBlock[1].trim();
    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) s = arrMatch[0];
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

// ── FormatPicker ──────────────────────────────────────────────────────────────
function FormatPicker({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  function handleClick(id: string) {
    onSelect(id);
    setPreviewId(prev => (prev === id ? null : id));
  }

  const previewFormat = CARD_FORMATS.find(f => f.id === previewId);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        Card Format
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CARD_FORMATS.map(fmt => {
          const isSelected = selected === fmt.id;
          const isPreviewing = previewId === fmt.id;
          return (
            <button
              key={fmt.id}
              onClick={() => handleClick(fmt.id)}
              title={fmt.description}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isSelected ? '#000' : 'var(--text-primary)',
                border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border)',
              }}
            >
              {fmt.emoji} {fmt.label}
              {isPreviewing ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          );
        })}
      </div>

      {/* Live preview card */}
      {previewFormat && (
        <div style={{
          marginTop: 10, borderRadius: 10, overflow: 'hidden',
          border: '1px solid var(--accent)', boxShadow: '0 0 12px var(--accent-glow)',
        }}>
          <div style={{
            background: 'var(--bg-primary)', padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              {previewFormat.emoji} {previewFormat.label} — Front
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {previewFormat.exampleFront}
            </div>
          </div>
          <div style={{ background: 'var(--accent-glow)', padding: '10px 14px' }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              Back
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5 }}>
              {previewFormat.exampleBack}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function FlashcardGenTool() {
  const { data, updatePluginData } = useStore();
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('qa');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const notes = data?.pluginData?.notes || [];

  async function generate() {
    if (!selectedNoteId) return;
    const note = notes.find((n: Note) => n.id === selectedNoteId);
    if (!note) return;

    setLoading(true);
    setError('');
    setSaved(false);
    setCards([]);

    const fmt = CARD_FORMATS.find(f => f.id === selectedFormat) || CARD_FORMATS[0];

    try {
      const prompt = fmt.buildPrompt(note.title, note.content.slice(0, 4000));
      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse flashcards from AI response. Please try again.');
        return;
      }
      const generated: GeneratedCard[] = (parsed as Record<string, unknown>[]).map(item => ({
        front: String(item.front || ''),
        back: String(item.back || ''),
        checked: true,
      })).filter(c => c.front && c.back);
      setCards(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function saveFlashcards() {
    if (!data) return;
    const checked = cards.filter(c => c.checked);
    if (checked.length === 0) return;

    const existing = data.pluginData?.srData?.cards || [];
    const newCards = checked.map(c => ({
      key: crypto.randomUUID(),
      subject: 'AI Generated',
      subtopic: notes.find((n: Note) => n.id === selectedNoteId)?.title || 'Flashcards',
      S: 1, D: 5, reps: 0, lapses: 0, state: 'new',
      lastReview: '', nextReview: new Date().toISOString(),
      elapsedDays: 0, scheduledDays: 1, history: [],
      questionText: `${c.front}\n---\n${c.back}`,
    }));

    updatePluginData({
      srData: { ...data.pluginData.srData, cards: [...existing, ...newCards] },
    });
    setSaved(true);
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <Layers size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Generate Flashcards from Notes
        </div>

        {notes.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notes found. Create notes first to generate flashcards.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <select
                value={selectedNoteId}
                onChange={e => { setSelectedNoteId(e.target.value); setCards([]); setSaved(false); }}
                style={{ ...selectStyle, flex: 1, minWidth: 200 }}
              >
                <option value="">Select a note...</option>
                {notes.map((n: Note) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>

            <FormatPicker selected={selectedFormat} onSelect={setSelectedFormat} />

            <button
              className="btn btn-primary w-full"
              onClick={generate}
              disabled={!selectedNoteId || loading}
            >
              {loading ? 'Generating...' : `Generate ${CARD_FORMATS.find(f => f.id === selectedFormat)?.emoji || ''} ${CARD_FORMATS.find(f => f.id === selectedFormat)?.label || ''} Cards`}
            </button>
          </>
        )}

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {cards.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            ⚠ AI-generated content may contain errors. Always verify against your course materials before studying.
          </p>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {cards.filter(c => c.checked).length} of {cards.length} selected
            </span>
            <button
              className="btn btn-sm"
              onClick={() => setCards(prev => prev.map(c => ({ ...c, checked: !prev.every(x => x.checked) })))}
            >
              Toggle All
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {cards.map((card, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderLeftColor: card.checked ? 'var(--accent)' : 'var(--border)',
                  borderLeftWidth: 3,
                  opacity: card.checked ? 1 : 0.5,
                  cursor: 'pointer',
                }}
                onClick={() => setCards(prev => prev.map((c, ci) => ci === i ? { ...c, checked: !c.checked } : c))}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={card.checked}
                    onChange={() => {}}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Q: {card.front}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      A: {card.back}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={saveFlashcards}
            disabled={saved || cards.filter(c => c.checked).length === 0}
          >
            <Save size={14} /> {saved ? 'Saved to Flashcards!' : `Save ${cards.filter(c => c.checked).length} Cards`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FlashcardGenToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Flashcard Generator">
      <FlashcardGenTool />
    </ToolErrorBoundary>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors in `FlashcardGenTool.tsx`

- [ ] **Step 3: Commit**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && git add src/components/aitools/FlashcardGenTool.tsx && git commit -m "feat: add 7 cloze format options to flashcard generator with live preview on click"
```

---

## Chunk 3: Per-Card Edit / Delete / Duplicate in Flashcards.tsx

### Task 3: Add per-card action toolbar to Flashcards.tsx browse view

**Files:**
- Modify: `src/pages/Flashcards.tsx` — search for the card browse/list section and add edit/delete/duplicate buttons per card, wired to `CardEditPanel`

The goal is: in the card browse list (where individual `FlashcardItem` cards are rendered), add a small toolbar with:
- ✏️ Edit → opens `CardEditPanel` pre-filled with that card's data
- 🗑️ Delete → removes the card after confirmation (window.confirm)
- 📋 Duplicate → inserts a copy of the card immediately after it

`onSave` from `CardEditPanel` replaces `course.flashcards[editingIdx]` in-place, updates store via `setData`.

- [ ] **Step 1: Read the card list rendering section of Flashcards.tsx to find where cards are displayed**

Search for the `FlashcardItem` render block (look for `card.front`, `card.back` in JSX) — it is near a `currentCards` or `flashcards.map()` loop.

- [ ] **Step 2: Add import for `CardEditPanel` at top of `Flashcards.tsx`**

Add after existing imports:
```tsx
import CardEditPanel from '../components/flashcards/CardEditPanel'
```

- [ ] **Step 3: Add editing state near other state declarations**

```tsx
const [editingCard, setEditingCard] = useState<{ courseId: string; idx: number } | null>(null)
```

- [ ] **Step 4: Add `handleCardSave` function**

```tsx
function handleCardSave(updated: FlashcardItem) {
  if (!editingCard || !data) return
  const updatedCourses = (data.pluginData?.coachData?.courses || []).map(c =>
    c.id !== editingCard.courseId ? c : {
      ...c,
      flashcards: c.flashcards.map((f, i) => i === editingCard.idx ? updated : f),
    }
  )
  setData(prev => ({
    ...prev,
    pluginData: {
      ...prev.pluginData,
      coachData: { ...prev.pluginData.coachData, courses: updatedCourses },
    },
  }))
  setEditingCard(null)
}
```

- [ ] **Step 5: Add `handleCardDelete` function**

```tsx
function handleCardDelete(courseId: string, idx: number) {
  if (!data) return
  if (!window.confirm('Delete this card?')) return
  const updatedCourses = (data.pluginData?.coachData?.courses || []).map(c =>
    c.id !== courseId ? c : {
      ...c,
      flashcards: c.flashcards.filter((_, i) => i !== idx),
    }
  )
  setData(prev => ({
    ...prev,
    pluginData: {
      ...prev.pluginData,
      coachData: { ...prev.pluginData.coachData, courses: updatedCourses },
    },
  }))
}
```

- [ ] **Step 6: Add `handleCardDuplicate` function**

```tsx
function handleCardDuplicate(courseId: string, idx: number) {
  if (!data) return
  const updatedCourses = (data.pluginData?.coachData?.courses || []).map(c => {
    if (c.id !== courseId) return c
    const copy = { ...c.flashcards[idx] }
    const newCards = [...c.flashcards]
    newCards.splice(idx + 1, 0, copy)
    return { ...c, flashcards: newCards }
  })
  setData(prev => ({
    ...prev,
    pluginData: {
      ...prev.pluginData,
      coachData: { ...prev.pluginData.coachData, courses: updatedCourses },
    },
  }))
}
```

- [ ] **Step 7: Add action buttons to each card in the browse list**

Locate the card render — it will look like `{cards.map((card, i) => ...)}` or similar. Inside each card's JSX, add a small action row at the top-right corner:

```tsx
{/* Per-card action toolbar */}
<div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginBottom: 6 }}>
  <button
    className="btn btn-secondary btn-sm"
    title="Edit card"
    onClick={e => { e.stopPropagation(); setEditingCard({ courseId: activeCourse.id, idx: i }) }}
    style={{ padding: '3px 8px', fontSize: 11 }}
  >
    <Pencil size={11} /> Edit
  </button>
  <button
    className="btn btn-secondary btn-sm"
    title="Duplicate card"
    onClick={e => { e.stopPropagation(); handleCardDuplicate(activeCourse.id, i) }}
    style={{ padding: '3px 8px', fontSize: 11 }}
  >
    <ClipboardCopy size={11} />
  </button>
  <button
    className="btn btn-secondary btn-sm"
    title="Delete card"
    onClick={e => { e.stopPropagation(); handleCardDelete(activeCourse.id, i) }}
    style={{ padding: '3px 8px', fontSize: 11, color: 'var(--red)', borderColor: 'var(--red)' }}
  >
    <Trash2 size={11} />
  </button>
</div>
```

> Note: adjust `activeCourse.id` and `i` to match the actual variable names in context.

- [ ] **Step 8: Add `CardEditPanel` to the JSX (at bottom of component, before closing tag)**

```tsx
<CardEditPanel
  isOpen={editingCard !== null}
  card={editingCard
    ? (courses.find(c => c.id === editingCard.courseId)?.flashcards[editingCard.idx] ?? null)
    : null
  }
  onSave={handleCardSave}
  onClose={() => setEditingCard(null)}
  title="Edit Card"
/>
```

- [ ] **Step 9: Add missing Lucide imports if needed** (`ClipboardCopy`, `Trash2` may already be imported — check line 2 of Flashcards.tsx; they are already present)

- [ ] **Step 10: Verify TypeScript compiles**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors

- [ ] **Step 11: Commit**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && git add src/pages/Flashcards.tsx && git commit -m "feat: add per-card edit/delete/duplicate actions in Flashcards browse view"
```

---

## Chunk 4: In-Review Card Editor in SpacedRepMode

### Task 4: Add edit button + CardEditPanel to SpacedRepMode.tsx

**Files:**
- Modify: `src/components/learn/SpacedRepMode.tsx`

During review (phase === 'review'), add a small ✏️ edit icon button in the card header row (next to the progress counter). Clicking it opens `CardEditPanel`. On save, the card's source `FlashcardItem` in the course is updated, and the live `FSRSCard` front/back is refreshed so the current session reflects the edit immediately.

- [ ] **Step 1: Add import for CardEditPanel and Pencil icon**

```tsx
import { Eye, Play, Repeat, Sparkles, Pencil } from 'lucide-react'
import CardEditPanel from '../flashcards/CardEditPanel'
import type { FlashcardItem } from '../../types'
```

- [ ] **Step 2: Add `editingInReview` state near other state declarations**

```tsx
const [editingInReview, setEditingInReview] = useState(false)
```

- [ ] **Step 3: Add `handleReviewCardSave` function**

This saves to the course flashcards store AND updates the live card in the review session:

```tsx
function handleReviewCardSave(updated: FlashcardItem) {
  const card = dueCards[currentIdx]
  if (!card) return

  // Update card in the live review session so current card reflects edit immediately
  const updatedDue = dueCards.map(c => c.key === card.key ? { ...c, front: updated.front, back: updated.back, topic: updated.topic || c.topic } : c)
  setDueCards(updatedDue)
  const updatedAll = cards.map(c => c.key === card.key ? { ...c, front: updated.front, back: updated.back } : c)
  setCards(updatedAll)

  // Persist to course flashcards in store
  // card.key format for course cards is `${courseId}-${idx}`
  const parts = card.key.split('-')
  if (parts.length >= 2) {
    const courseId = parts.slice(0, -1).join('-')
    const idx = parseInt(parts[parts.length - 1], 10)
    if (!isNaN(idx)) {
      const d = dataRef.current
      if (!d) return
      const updatedCourses = (d.pluginData?.coachData?.courses || []).map(c =>
        c.id !== courseId ? c : {
          ...c,
          flashcards: c.flashcards.map((f, i) => i === idx ? updated : f),
        }
      )
      setData(prev => ({
        ...prev,
        pluginData: {
          ...prev.pluginData,
          coachData: { ...prev.pluginData.coachData, courses: updatedCourses },
        },
      }))
    }
  }

  setEditingInReview(false)
}
```

- [ ] **Step 4: Add edit button to the review card header row**

Find the header row in the review phase (it shows `{currentIdx + 1}/{dueCards.length}` and the state badge). Add the edit button:

```tsx
<div className="flex items-center justify-between mb-2">
  <span className="text-xs text-muted">{currentIdx + 1}/{dueCards.length}</span>
  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
    <button
      className="btn btn-secondary btn-sm"
      title="Edit this card"
      onClick={() => setEditingInReview(true)}
      style={{ padding: '3px 8px', fontSize: 11 }}
    >
      <Pencil size={11} /> Edit
    </button>
    <span className="badge" style={{ fontSize: 10, background: 'var(--accent-glow)', color: 'var(--accent-light)' }}>
      {card.state}
    </span>
  </div>
</div>
```

- [ ] **Step 5: Add `CardEditPanel` below the review JSX return (inside the phase === 'review' block)**

Add just before the closing `</div>` of the review phase:

```tsx
<CardEditPanel
  isOpen={editingInReview}
  card={editingInReview ? { front: card.front, back: card.back, topic: card.topic } : null}
  onSave={handleReviewCardSave}
  onClose={() => setEditingInReview(false)}
  title="Edit Card (Live Review)"
/>
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors

- [ ] **Step 7: Commit**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && git add src/components/learn/SpacedRepMode.tsx && git commit -m "feat: add inline card edit during FSRS review session"
```

---

## Chunk 5: Build, Deploy & Verify

### Task 5: Build and deploy to production

- [ ] **Step 1: Full production build**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build 2>&1 | tail -20
```

Expected: `✓ built in Xs` with zero errors

- [ ] **Step 2: Deploy to Vercel**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && vercel --prod --yes --archive=tgz
```

- [ ] **Step 3: Clear PWA cache in browser after deploy**

```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```

- [ ] **Step 4: Verify on production with real profile (reallyjustjohnny6@gmail.com)**

- Open https://nousai-app.vercel.app
- Go to AI Tools → Flashcard Generator: confirm format chips show, click one → example preview appears below
- Browse Flashcards: confirm ✏️ Edit, 📋 Duplicate, 🗑️ Delete appear on cards
- Click Edit on a card: panel slides in, edit front/back, save → card updates
- Go to LearnPage → Spaced Rep: start review → confirm ✏️ Edit button in header, click → panel slides in, edit, save → card text updates live
