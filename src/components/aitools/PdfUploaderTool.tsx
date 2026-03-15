/**
 * PdfUploaderTool.tsx
 * NEW FILE — AI tool: PDF → Mistral OCR → quiz flashcards.
 *
 * Phases: upload → processing → preview → done
 */

import { useState, useRef } from 'react'
import { Upload, FileText, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../../store'
import type { FlashcardItem, Course, PdfCard } from '../../types'
import { pdfToCards, type OcrProgress } from '../../utils/mistralOcrService'
import { selectStyle, inputStyle } from './shared'
import { ToolErrorBoundary } from '../ToolErrorBoundary'
import MathRenderer from '../MathRenderer'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_DISPLAY_CARDS = 10

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert a PdfCard to a FlashcardItem that works in all existing study modes. */
function pdfCardToFlashcard(card: PdfCard): FlashcardItem {
  if (card.type === 'vocab') {
    return { front: card.question, back: card.answer, topic: 'PDF Import' }
  }
  // MCQ: embed choices in the front so they render in study modes
  const choicesBlock = card.choices?.length
    ? '\n\n' + card.choices.join('\n')
    : ''
  return {
    front: card.question + choicesBlock,
    back: card.answer,
    topic: 'PDF Import',
  }
}

// ─── Progress bar component ───────────────────────────────────────────────────

const STAGE_LABELS: Record<OcrProgress['stage'], string> = {
  reading:    'Reading PDF',
  ocr:        'OCR Processing',
  generating: 'Generating Cards',
  done:       'Complete',
}
const STAGE_ORDER: OcrProgress['stage'][] = ['reading', 'ocr', 'generating', 'done']

function ProgressDisplay({ progress }: { progress: OcrProgress }) {
  const currentIdx = STAGE_ORDER.indexOf(progress.stage)
  return (
    <div style={{ marginTop: 20 }}>
      {/* Stage steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        {STAGE_ORDER.map((stage, i) => {
          const done    = i < currentIdx
          const active  = i === currentIdx
          const pending = i > currentIdx
          return (
            <div key={stage} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {/* Connector line */}
              <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {i > 0 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: done || active ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
                {/* Circle */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: done ? 'var(--accent)' : active ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  border: `2px solid ${done || active ? 'var(--accent)' : 'var(--border)'}`,
                  color: done ? 'var(--bg-primary)' : active ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'all 0.3s',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div style={{
                    flex: 1, height: 2,
                    background: done ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
              <span style={{
                fontSize: 10, color: pending ? 'var(--text-muted)' : active ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontWeight: active ? 600 : 400,
                textAlign: 'center',
              }}>
                {STAGE_LABELS[stage]}
              </span>
            </div>
          )
        })}
      </div>
      {/* Current message */}
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
        {progress.message}
      </p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type Phase = 'upload' | 'processing' | 'preview' | 'done'

function PdfUploaderTool() {
  const { data, setData, courses } = useStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [phase, setPhase]             = useState<Phase>('upload')
  const [dragging, setDragging]       = useState(false)
  const [error, setError]             = useState('')
  const [sizeWarning, setSizeWarning] = useState('')
  const [progress, setProgress]       = useState<OcrProgress>({ stage: 'reading', message: '' })
  const [cards, setCards]             = useState<PdfCard[]>([])
  const [markdown, setMarkdown]       = useState('')
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [fileName, setFileName]       = useState('')

  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState('__new__')
  const [newCourseName, setNewCourseName]         = useState('')

  // Success
  const [importedCount, setImportedCount]         = useState(0)
  const [importedCourseName, setImportedCourseName] = useState('')

  // ── File handling ──────────────────────────────────────────────────────────

  async function processFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setError('Please upload a PDF file.')
      return
    }

    setError('')
    setSizeWarning('')
    setFileName(file.name)
    setPhase('processing')

    try {
      const result = await pdfToCards(file, (p) => setProgress(p))
      if (result.sizeWarning) setSizeWarning(result.sizeWarning)
      setCards(result.cards)
      setMarkdown(result.markdown)
      setPhase('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
      setPhase('upload')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  function doImport() {
    if (!data) return

    const flashcards: FlashcardItem[] = cards.map(pdfCardToFlashcard)

    if (selectedCourseId === '__new__') {
      const name = newCourseName.trim() || `PDF: ${fileName}`
      const newCourse: Course = {
        id: crypto.randomUUID(),
        name,
        shortName: name.slice(0, 8),
        color: '#6366f1',
        topics: [],
        flashcards,
      }
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          pluginData: {
            ...prev.pluginData,
            coachData: {
              ...prev.pluginData.coachData,
              courses: [...(prev.pluginData.coachData?.courses ?? []), newCourse],
            },
          },
        }
      })
      setImportedCourseName(name)
    } else {
      const targetCourse = courses.find((c) => c.id === selectedCourseId)
      if (!targetCourse) return
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          pluginData: {
            ...prev.pluginData,
            coachData: {
              ...prev.pluginData.coachData,
              courses: (prev.pluginData.coachData?.courses ?? []).map((c) =>
                c.id === selectedCourseId
                  ? { ...c, flashcards: [...(c.flashcards ?? []), ...flashcards] }
                  : c,
              ),
            },
          },
        }
      })
      setImportedCourseName(targetCourse.name)
    }

    setImportedCount(flashcards.length)
    setPhase('done')
  }

  function reset() {
    setPhase('upload')
    setError('')
    setSizeWarning('')
    setCards([])
    setMarkdown('')
    setShowMarkdown(false)
    setFileName('')
    setSelectedCourseId('__new__')
    setNewCourseName('')
    setImportedCount(0)
    setImportedCourseName('')
  }

  // ── Upload phase ───────────────────────────────────────────────────────────

  if (phase === 'upload') {
    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-3">
            <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            PDF → Quiz Cards (Mistral OCR)
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Upload a PDF (physics, science, textbooks, lecture notes) and NousAI will extract
            the text and equations using Mistral OCR, then generate quiz flashcards automatically.
            Supports LaTeX equations, diagrams, and Japanese text.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              transition: 'all 0.2s',
              marginBottom: 12,
            }}
          >
            <Upload
              size={32}
              style={{
                color: dragging ? 'var(--accent)' : 'var(--text-muted)',
                marginBottom: 10,
                transition: 'color 0.2s',
              }}
            />
            <p style={{ fontSize: 14, color: dragging ? 'var(--accent-light)' : 'var(--text-secondary)', margin: 0 }}>
              {dragging ? 'Drop PDF to process' : 'Drag & drop a PDF here'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0' }}>
              or click to browse · max 50 MB · uses OpenRouter API
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {error && (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
          )}

          {/* Cost / info note */}
          <div style={{
            marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            ℹ Mistral OCR costs ~$0.002/page via OpenRouter (e.g. a 30-page PDF ≈ $0.06).
            Requires an OpenRouter API key configured in{' '}
            <strong style={{ color: 'var(--text-secondary)' }}>Settings → AI Provider</strong>.
          </div>
        </div>
      </div>
    )
  }

  // ── Processing phase ───────────────────────────────────────────────────────

  if (phase === 'processing') {
    return (
      <div>
        <div className="card mb-3" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div className="card-title mb-2">
            <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Processing: {fileName}
          </div>
          {sizeWarning && (
            <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 8 }}>
              ⚠ {sizeWarning}
            </p>
          )}
          <ProgressDisplay progress={progress} />
        </div>
      </div>
    )
  }

  // ── Preview phase ──────────────────────────────────────────────────────────

  if (phase === 'preview') {
    const preview = cards.slice(0, MAX_DISPLAY_CARDS)

    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-2">
            <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Review Generated Cards
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Generated{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{cards.length} cards</strong>
            {' '}from <strong style={{ color: 'var(--text-primary)' }}>{fileName}</strong>
          </p>

          {/* OCR markdown toggle */}
          <button
            onClick={() => setShowMarkdown((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 10px',
              color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit', marginBottom: 12,
            }}
          >
            {showMarkdown ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showMarkdown ? 'Hide' : 'Show'} OCR output
          </button>

          {showMarkdown && (
            <pre style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 11,
              color: 'var(--text-secondary)', overflowX: 'auto', maxHeight: 240,
              overflowY: 'auto', whiteSpace: 'pre-wrap', marginBottom: 12,
              fontFamily: 'var(--font-mono)',
            }}>
              {markdown}
            </pre>
          )}

          {/* Card preview table */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {(['Type', 'Question', 'Answer'] as const).map((h) => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '6px 8px',
                      color: 'var(--text-muted)', fontWeight: 600,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((card, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                    }}
                  >
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                        background: card.type === 'mcq' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(74, 222, 128, 0.15)',
                        color: card.type === 'mcq' ? 'var(--blue)' : 'var(--green)',
                      }}>
                        {card.type.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-primary)', maxWidth: 300 }}>
                      <MathRenderer text={card.question} style={{ fontSize: 12 }} />
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 260 }}>
                      <MathRenderer text={card.answer} style={{ fontSize: 12 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cards.length > MAX_DISPLAY_CARDS && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>
                Showing {MAX_DISPLAY_CARDS} of {cards.length} cards
              </p>
            )}
          </div>

          {/* Course selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Import into course:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{ ...selectStyle, width: '100%', marginBottom: 8 }}
            >
              <option value="__new__">+ Create new course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {selectedCourseId === '__new__' && (
              <input
                type="text"
                placeholder={`New course name (e.g. ${fileName.replace('.pdf', '')})`}
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                style={{ ...inputStyle }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doImport}>
              <Upload size={14} /> Import {cards.length} Cards
            </button>
            <button className="btn btn-sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Done phase ─────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Import complete!
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Imported <strong>{importedCount}</strong> cards to{' '}
          <strong>{importedCourseName}</strong>.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={reset}>
            Upload Another PDF
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PdfUploaderToolWrapped() {
  return (
    <ToolErrorBoundary toolName="PDF OCR">
      <PdfUploaderTool />
    </ToolErrorBoundary>
  )
}
