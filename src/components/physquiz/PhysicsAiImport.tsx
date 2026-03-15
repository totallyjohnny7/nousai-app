/**
 * PhysicsAiImport — Import physics questions from images and PDFs using AI extraction.
 */

import { useState, useRef, useCallback } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import {
  ArrowLeft,
  Upload,
  CheckSquare,
  Square,
  AlertCircle,
  X,
  FileText,
  Image,
} from 'lucide-react'
import type { PhysicsQuestion, PhysicsTopic } from './types'
import { TOPIC_LABELS, TOPIC_COLORS, generatePhysicsId, todayDateStr } from './types'
import { callAI } from '../../utils/ai'
import type { AIContentPart } from '../../utils/ai'
import { compressImage } from '../../utils/imageCompress'
import { runMistralOcr } from '../../utils/mistralOcrService'

// ─── Constants ──────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  onImport: (questions: PhysicsQuestion[]) => void
  onClose: () => void
}

type ProcessingState = 'idle' | 'processing' | 'done'

interface ExtractedQuestion extends PhysicsQuestion {
  selected: boolean
  noAnswer: boolean
}

/** Raw shape returned by the AI — loosely typed for parse safety */
interface RawAIQuestion {
  questionText?: unknown
  questionType?: unknown
  topic?: unknown
  difficulty?: unknown
  expectedAnswer?: unknown
  choices?: unknown
  variables?: unknown
  examTag?: unknown
  source?: unknown
}

// ─── System prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a physics question extractor. Given an image of a textbook page, worksheet, or exam, extract ALL physics questions visible. Return ONLY a valid JSON array.

Each item must match this exact schema:
{ "questionText": "Full text, with math as $...$ inline and $$...$$ display", "questionType": "mcq" | "free-response" | "multi-part", "topic": "mechanics"|"kinematics"|"thermodynamics"|"waves"|"optics"|"electromagnetism"|"circuits"|"modern"|"nuclear"|"other", "difficulty": 1-5, "expectedAnswer": "", "choices": [], "variables": [], "examTag": "", "source": "image-import" }

Math conversion: θ→$\\theta$, ω→$\\omega$, α→$\\alpha$, μ→$\\mu$, λ→$\\lambda$, Δ→$\\Delta$. Superscripts: x²→$x^2$, v₀→$v_0$. Fractions: a/b in formula→$\\frac{a}{b}$. If diagram visible: add "[Diagram: description]" to questionText. Return ONLY the JSON array.`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidTopic(t: unknown): t is PhysicsTopic {
  const valid: PhysicsTopic[] = [
    'mechanics', 'kinematics', 'thermodynamics', 'waves',
    'optics', 'electromagnetism', 'circuits', 'modern', 'nuclear', 'other',
  ]
  return typeof t === 'string' && (valid as string[]).includes(t)
}

function parseAIResponse(raw: string): RawAIQuestion[] {
  // Strip markdown code fences if present
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  return JSON.parse(cleaned) as RawAIQuestion[]
}

function buildPhysicsQuestion(raw: RawAIQuestion): PhysicsQuestion {
  return {
    id: generatePhysicsId(),
    questionText: typeof raw.questionText === 'string' ? raw.questionText : '',
    questionType:
      raw.questionType === 'mcq' || raw.questionType === 'multi-part'
        ? raw.questionType
        : 'free-response',
    topic: isValidTopic(raw.topic) ? raw.topic : 'other',
    difficulty:
      typeof raw.difficulty === 'number' &&
      raw.difficulty >= 1 &&
      raw.difficulty <= 5
        ? (Math.round(raw.difficulty) as 1 | 2 | 3 | 4 | 5)
        : 3,
    source: 'image-import',
    tags: [],
    expectedAnswer: typeof raw.expectedAnswer === 'string' ? raw.expectedAnswer : '',
    choices: Array.isArray(raw.choices)
      ? (raw.choices as unknown[]).filter((c): c is string => typeof c === 'string')
      : [],
    variables: [],
    examTag: typeof raw.examTag === 'string' ? raw.examTag : '',
    dateAdded: todayDateStr(),
    wrongCount: 0,
  }
}

async function extractQuestionsFromMarkdown(
  markdown: string,
): Promise<{ questions: RawAIQuestion[]; error?: string }> {
  let raw: string
  try {
    raw = await callAI(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Extract all physics questions from the following OCR-extracted text:\n\n${markdown.slice(0, 12000)}` },
      ],
      { temperature: 0.1, maxTokens: 4096 },
      'ocr',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { questions: [], error: `AI error: ${msg}` }
  }

  try {
    const parsed = parseAIResponse(raw)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return { questions: parsed }
  } catch {
    return { questions: [], error: 'AI couldn\'t parse questions from the PDF — try a clearer scan' }
  }
}

async function extractQuestionsFromBase64(
  base64: string,
  pageLabel: string,
): Promise<{ questions: RawAIQuestion[]; error?: string }> {
  const imageContent: AIContentPart = {
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${base64}` },
  }
  const textContent: AIContentPart = {
    type: 'text',
    text: `Extract all physics questions from this ${pageLabel}.`,
  }

  let raw: string
  try {
    raw = await callAI(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: [imageContent, textContent] },
      ],
      { temperature: 0.1, maxTokens: 4096 },
      'ocr',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out')
    return {
      questions: [],
      error: isTimeout ? `__TIMEOUT__${pageLabel}` : `AI error on ${pageLabel}: ${msg}`,
    }
  }

  try {
    const parsed = parseAIResponse(raw)
    if (!Array.isArray(parsed)) throw new Error('Not an array')
    return { questions: parsed }
  } catch {
    return { questions: [], error: `AI couldn't parse ${pageLabel} — try a higher quality image` }
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PhysicsAiImport({ onImport, onClose }: Props) {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [heicWarning, setHeicWarning] = useState(false)
  const [pdfPageWarning, setPdfPageWarning] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Processing ────────────────────────────────────────────────────────────

  const processImageFile = useCallback(async (file: File) => {
    setProcessingState('processing')
    setProgress({ current: 0, total: 1 })
    setErrors([])

    const compressed = await compressImage(file, { maxWidth: 2048, quality: 0.85 })
    setProgress({ current: 1, total: 1 })

    const { questions, error } = await extractQuestionsFromBase64(compressed.base64, 'image')

    const newErrors: string[] = []

    if (error) {
      if (error.startsWith('__TIMEOUT__')) {
        newErrors.push(`image timed out — use "Retry" to try again`)
      } else {
        newErrors.push(error)
      }
    } else if (questions.length === 0) {
      newErrors.push('No questions detected — try a clearer photo or crop to just the questions')
    }

    setErrors(newErrors)
    setExtractedQuestions(
      questions.map(raw => {
        const q = buildPhysicsQuestion(raw)
        return { ...q, selected: true, noAnswer: !q.expectedAnswer }
      }),
    )
    setProcessingState('done')
  }, [])

  const processPdfFile = useCallback(async (file: File) => {
    setProcessingState('processing')
    setErrors([])
    setPdfPageWarning(null)
    setProgress({ current: 0, total: 1 })

    let markdown: string
    try {
      markdown = await runMistralOcr(file, (stage, msg) => {
        if (stage === 'ocr') setProgress({ current: 0, total: 1 })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setErrors([`OCR failed: ${msg}`])
      setProcessingState('done')
      return
    }

    setProgress({ current: 1, total: 1 })

    const { questions, error } = await extractQuestionsFromMarkdown(markdown)
    const newErrors: string[] = []

    if (error) {
      newErrors.push(error)
    } else if (questions.length === 0) {
      newErrors.push('No questions detected — try a clearer scan or check the PDF content')
    }

    setErrors(newErrors)
    setExtractedQuestions(prev => [
      ...prev,
      ...questions.map(raw => {
        const q = buildPhysicsQuestion(raw)
        return { ...q, selected: true, noAnswer: !q.expectedAnswer }
      }),
    ])
    setProcessingState('done')
  }, [])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files)
      if (arr.length === 0) return

      // Check for HEIC
      const hasHeic = arr.some(
        f =>
          f.type === 'image/heic' ||
          f.type === 'image/heif' ||
          f.name.toLowerCase().endsWith('.heic') ||
          f.name.toLowerCase().endsWith('.heif'),
      )
      if (hasHeic) {
        setHeicWarning(true)
        return
      }

      const invalid = arr.filter(f => !ACCEPTED_TYPES.includes(f.type))
      if (invalid.length > 0) {
        setErrors([`Unsupported file type: ${invalid.map(f => f.name).join(', ')}`])
        return
      }

      setHeicWarning(false)
      setExtractedQuestions([])
      setErrors([])
      setPdfPageWarning(null)

      const file = arr[0]
      if (file.type === 'application/pdf') {
        await processPdfFile(file)
      } else {
        await processImageFile(file)
      }
    },
    [processImageFile, processPdfFile],
  )

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(true)
  }
  const onDragLeave = () => setDragOver(false)
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files)
    }
  }
  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files)
      e.target.value = ''
    }
  }

  // ─── Selection ─────────────────────────────────────────────────────────────

  const toggleQuestion = (idx: number) => {
    setExtractedQuestions(prev =>
      prev.map((q, i) => (i === idx ? { ...q, selected: !q.selected } : q)),
    )
  }

  const selectAll = () =>
    setExtractedQuestions(prev => prev.map(q => ({ ...q, selected: true })))

  const deselectAll = () =>
    setExtractedQuestions(prev => prev.map(q => ({ ...q, selected: false })))

  const selectedCount = extractedQuestions.filter(q => q.selected).length

  // ─── Inline edit ──────────────────────────────────────────────────────────

  const openEditor = (idx: number) => {
    setEditingIdx(idx)
    setEditText(extractedQuestions[idx].questionText)
  }

  const saveEdit = () => {
    if (editingIdx === null) return
    setExtractedQuestions(prev =>
      prev.map((q, i) => (i === editingIdx ? { ...q, questionText: editText } : q)),
    )
    setEditingIdx(null)
    setEditText('')
  }

  const cancelEdit = () => {
    setEditingIdx(null)
    setEditText('')
  }

  // ─── Import ────────────────────────────────────────────────────────────────

  const handleAddSelected = () => {
    const toAdd = extractedQuestions
      .filter(q => q.selected)
      .map(({ selected: _s, noAnswer: _n, ...q }) => ({
        ...q,
        id: generatePhysicsId(),
        dateAdded: todayDateStr(),
      }))
    onImport(toAdd)
  }

  // ─── Progress bar ─────────────────────────────────────────────────────────

  const pct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="phys-ai-import">
      {/* Header */}
      <div className="phys-ai-import__header">
        <button className="phys-ai-import__back-btn" onClick={onClose} aria-label="Back">
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <h2 className="phys-ai-import__title">Import from Image / PDF</h2>
      </div>

      {/* Upload zone */}
      {processingState === 'idle' && (
        <div
          className={`phys-ai-import__dropzone${dragOver ? ' phys-ai-import__dropzone--active' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Upload images or PDFs"
        >
          <Upload className="phys-ai-import__dropzone-icon" size={40} />
          <p className="phys-ai-import__dropzone-label">Drop images or PDFs here</p>
          <p className="phys-ai-import__dropzone-sub">or click to browse</p>
          <div className="phys-ai-import__dropzone-formats">
            <span className="phys-ai-import__format-badge">
              <Image size={12} /> JPG
            </span>
            <span className="phys-ai-import__format-badge">
              <Image size={12} /> PNG
            </span>
            <span className="phys-ai-import__format-badge">
              <Image size={12} /> WebP
            </span>
            <span className="phys-ai-import__format-badge">
              <FileText size={12} /> PDF
            </span>
          </div>
          {heicWarning && (
            <div className="phys-ai-import__heic-warning">
              <AlertCircle size={14} />
              HEIC not supported — convert to JPG first (use Photos app: Share → Save as JPEG)
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="phys-ai-import__file-input"
            onChange={onFileInputChange}
            tabIndex={-1}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Processing */}
      {processingState === 'processing' && (
        <div className="phys-ai-import__processing">
          <p className="phys-ai-import__processing-label">
            {progress.total > 1
              ? `Processing page ${progress.current + 1} of ${progress.total}…`
              : 'Processing image…'}
          </p>
          <div className="phys-ai-import__progress-bar-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="phys-ai-import__progress-bar-fill"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="phys-ai-import__progress-pct">{pct}%</p>
        </div>
      )}

      {/* PDF page warning */}
      {pdfPageWarning && (
        <div className="phys-ai-import__banner phys-ai-import__banner--warn">
          <AlertCircle size={14} />
          {pdfPageWarning}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="phys-ai-import__errors">
          {errors.map((err, i) => {
            const isTimeout = err.includes('__RETRY__')
            const pageNumMatch = isTimeout ? err.match(/__RETRY__(\d+)/) : null
            const pageNum = pageNumMatch ? Number(pageNumMatch[1]) : null
            const displayErr = isTimeout
              ? err.replace(/ — __RETRY__\d+/, '')
              : err

            return (
              <div key={i} className="phys-ai-import__error-item">
                <AlertCircle size={14} />
                <span>{displayErr}</span>
                {isTimeout && pageNum !== null && (
                  <button
                    className="phys-ai-import__retry-btn"
                    onClick={() => {
                      // Remove this error and retry is handled by re-upload
                      setErrors(prev => prev.filter((_, j) => j !== i))
                    }}
                  >
                    Retry Page {pageNum}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Extracted questions preview */}
      {processingState === 'done' && extractedQuestions.length > 0 && (
        <div className="phys-ai-import__results">
          <div className="phys-ai-import__results-toolbar">
            <span className="phys-ai-import__results-count">
              {extractedQuestions.length} question{extractedQuestions.length !== 1 ? 's' : ''} extracted
            </span>
            <div className="phys-ai-import__results-actions">
              <button className="phys-ai-import__link-btn" onClick={selectAll}>
                Select All
              </button>
              <button className="phys-ai-import__link-btn" onClick={deselectAll}>
                Deselect All
              </button>
            </div>
          </div>

          <ul className="phys-ai-import__question-list">
            {extractedQuestions.map((q, idx) => (
              <li key={q.id} className="phys-ai-import__question-item">
                {/* Checkbox */}
                <button
                  className="phys-ai-import__checkbox"
                  onClick={() => toggleQuestion(idx)}
                  aria-label={q.selected ? 'Deselect question' : 'Select question'}
                >
                  {q.selected ? (
                    <CheckSquare size={18} className="phys-ai-import__checkbox--checked" />
                  ) : (
                    <Square size={18} className="phys-ai-import__checkbox--unchecked" />
                  )}
                </button>

                {/* Question content */}
                <div className="phys-ai-import__question-content">
                  {editingIdx === idx ? (
                    <div className="phys-ai-import__mini-editor">
                      <textarea
                        className="phys-ai-import__edit-textarea"
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        rows={4}
                        autoFocus
                      />
                      <div className="phys-ai-import__edit-actions">
                        <button className="phys-ai-import__save-btn" onClick={saveEdit}>
                          Save
                        </button>
                        <button className="phys-ai-import__cancel-btn" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="phys-ai-import__question-text"
                      onClick={() => openEditor(idx)}
                      title="Click to edit"
                    >
                      {q.questionText.length > 80
                        ? q.questionText.slice(0, 80) + '…'
                        : q.questionText}
                    </button>
                  )}

                  {/* Badges row */}
                  <div className="phys-ai-import__badges">
                    <span
                      className="phys-ai-import__topic-badge"
                      style={{ backgroundColor: TOPIC_COLORS[q.topic] }}
                    >
                      {TOPIC_LABELS[q.topic]}
                    </span>
                    <span className="phys-ai-import__diff-badge">
                      {'★'.repeat(q.difficulty)}{'☆'.repeat(5 - q.difficulty)}
                    </span>
                    {q.noAnswer && (
                      <span className="phys-ai-import__no-answer-badge">
                        No answer key
                      </span>
                    )}
                  </div>
                </div>

                {/* Remove */}
                <button
                  className="phys-ai-import__remove-btn"
                  onClick={() =>
                    setExtractedQuestions(prev => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove question"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>

          {/* Add button */}
          <div className="phys-ai-import__footer">
            <button
              className="phys-ai-import__import-btn"
              disabled={selectedCount === 0}
              onClick={handleAddSelected}
            >
              Add {selectedCount} Selected to Bank →
            </button>
            <button
              className="phys-ai-import__link-btn"
              onClick={() => {
                setProcessingState('idle')
                setExtractedQuestions([])
                setErrors([])
                setPdfPageWarning(null)
              }}
            >
              Import another file
            </button>
          </div>
        </div>
      )}

      {/* Done but empty */}
      {processingState === 'done' && extractedQuestions.length === 0 && errors.length === 0 && (
        <div className="phys-ai-import__empty">
          <AlertCircle size={24} />
          <p>No questions detected — try a clearer photo or crop to just the questions</p>
          <button
            className="phys-ai-import__link-btn"
            onClick={() => {
              setProcessingState('idle')
              setErrors([])
            }}
          >
            Try another file
          </button>
        </div>
      )}

      {/* Inline-edit backdrop */}
      {editingIdx !== null && (
        <div
          className="phys-ai-import__edit-backdrop"
          onClick={cancelEdit}
          aria-hidden="true"
        />
      )}

      <style>{`
        .phys-ai-import {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          max-width: 720px;
          margin: 0 auto;
          font-family: var(--font-body, Inter, sans-serif);
          color: var(--color-text, #e0e0e0);
          position: relative;
        }

        /* Header */
        .phys-ai-import__header {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .phys-ai-import__back-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--color-text-muted, #888);
          cursor: pointer;
          font-size: 14px;
          padding: 6px 8px;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .phys-ai-import__back-btn:hover {
          background: rgba(255,255,255,0.07);
          color: var(--color-text, #e0e0e0);
        }
        .phys-ai-import__title {
          font-size: 18px;
          font-weight: 600;
          margin: 0;
        }

        /* Drop zone */
        .phys-ai-import__dropzone {
          border: 2px dashed rgba(255,255,255,0.15);
          border-radius: 12px;
          padding: 48px 24px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          outline: none;
        }
        .phys-ai-import__dropzone:focus-visible {
          outline: 2px solid var(--color-accent, #F5A623);
          outline-offset: 2px;
        }
        .phys-ai-import__dropzone--active {
          border-color: var(--color-accent, #F5A623);
          background: rgba(245, 166, 35, 0.06);
        }
        .phys-ai-import__dropzone:hover {
          border-color: rgba(255,255,255,0.3);
          background: rgba(255,255,255,0.03);
        }
        .phys-ai-import__dropzone-icon {
          color: var(--color-text-muted, #888);
          margin-bottom: 8px;
        }
        .phys-ai-import__dropzone-label {
          font-size: 16px;
          font-weight: 500;
          margin: 0;
        }
        .phys-ai-import__dropzone-sub {
          font-size: 13px;
          color: var(--color-text-muted, #888);
          margin: 0;
        }
        .phys-ai-import__dropzone-formats {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: center;
          margin-top: 8px;
        }
        .phys-ai-import__format-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 12px;
          color: var(--color-text-muted, #aaa);
        }
        .phys-ai-import__heic-warning {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 166, 35, 0.12);
          color: #F5A623;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          margin-top: 8px;
          text-align: left;
        }
        .phys-ai-import__file-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
          pointer-events: none;
        }

        /* Processing */
        .phys-ai-import__processing {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
        }
        .phys-ai-import__processing-label {
          font-size: 14px;
          color: var(--color-text-muted, #aaa);
          margin: 0;
        }
        .phys-ai-import__progress-bar-wrap {
          width: 100%;
          max-width: 360px;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          overflow: hidden;
        }
        .phys-ai-import__progress-bar-fill {
          height: 100%;
          background: var(--color-accent, #F5A623);
          border-radius: 999px;
          transition: width 0.3s ease;
        }
        .phys-ai-import__progress-pct {
          font-size: 13px;
          color: var(--color-text-muted, #888);
          margin: 0;
          font-variant-numeric: tabular-nums;
        }

        /* Banners */
        .phys-ai-import__banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 13px;
        }
        .phys-ai-import__banner--warn {
          background: rgba(245, 166, 35, 0.1);
          color: #F5A623;
          border: 1px solid rgba(245, 166, 35, 0.25);
        }

        /* Errors */
        .phys-ai-import__errors {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .phys-ai-import__error-item {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
          color: #f87171;
        }
        .phys-ai-import__retry-btn {
          margin-left: auto;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s;
        }
        .phys-ai-import__retry-btn:hover {
          background: rgba(239, 68, 68, 0.25);
        }

        /* Results */
        .phys-ai-import__results {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .phys-ai-import__results-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
        }
        .phys-ai-import__results-count {
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text, #e0e0e0);
        }
        .phys-ai-import__results-actions {
          display: flex;
          gap: 12px;
        }

        /* Question list */
        .phys-ai-import__question-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 400px;
          overflow-y: auto;
        }
        .phys-ai-import__question-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          padding: 12px;
          transition: border-color 0.15s;
        }
        .phys-ai-import__question-item:hover {
          border-color: rgba(255,255,255,0.15);
        }
        .phys-ai-import__checkbox {
          background: none;
          border: none;
          padding: 2px;
          cursor: pointer;
          flex-shrink: 0;
          margin-top: 2px;
          color: var(--color-text-muted, #888);
          display: flex;
          align-items: center;
        }
        .phys-ai-import__checkbox--checked {
          color: var(--color-accent, #F5A623);
        }
        .phys-ai-import__checkbox--unchecked {
          color: rgba(255,255,255,0.3);
        }
        .phys-ai-import__question-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .phys-ai-import__question-text {
          background: none;
          border: none;
          color: var(--color-text, #e0e0e0);
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          padding: 0;
          line-height: 1.5;
          width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          transition: color 0.15s;
        }
        .phys-ai-import__question-text:hover {
          color: var(--color-accent, #F5A623);
        }
        .phys-ai-import__badges {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .phys-ai-import__topic-badge {
          border-radius: 4px;
          padding: 2px 7px;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          white-space: nowrap;
        }
        .phys-ai-import__diff-badge {
          font-size: 12px;
          color: var(--color-accent, #F5A623);
          letter-spacing: 1px;
        }
        .phys-ai-import__no-answer-badge {
          background: rgba(234, 179, 8, 0.15);
          border: 1px solid rgba(234, 179, 8, 0.3);
          color: #eab308;
          border-radius: 4px;
          padding: 2px 7px;
          font-size: 11px;
        }
        .phys-ai-import__remove-btn {
          background: none;
          border: none;
          color: rgba(255,255,255,0.25);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          transition: color 0.15s, background 0.15s;
        }
        .phys-ai-import__remove-btn:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.1);
        }

        /* Mini editor */
        .phys-ai-import__mini-editor {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .phys-ai-import__edit-textarea {
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 6px;
          color: var(--color-text, #e0e0e0);
          font-size: 13px;
          line-height: 1.5;
          padding: 8px 10px;
          resize: vertical;
          width: 100%;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        .phys-ai-import__edit-textarea:focus {
          border-color: var(--color-accent, #F5A623);
        }
        .phys-ai-import__edit-actions {
          display: flex;
          gap: 8px;
        }
        .phys-ai-import__save-btn {
          background: var(--color-accent, #F5A623);
          color: #0a0a0a;
          border: none;
          border-radius: 6px;
          padding: 5px 14px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .phys-ai-import__save-btn:hover {
          opacity: 0.85;
        }
        .phys-ai-import__cancel-btn {
          background: rgba(255,255,255,0.07);
          color: var(--color-text-muted, #aaa);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          padding: 5px 14px;
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s;
        }
        .phys-ai-import__cancel-btn:hover {
          background: rgba(255,255,255,0.12);
        }

        /* Edit backdrop */
        .phys-ai-import__edit-backdrop {
          position: fixed;
          inset: 0;
          z-index: 1;
        }

        /* Footer */
        .phys-ai-import__footer {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          padding-top: 4px;
        }
        .phys-ai-import__import-btn {
          background: var(--color-accent, #F5A623);
          color: #0a0a0a;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .phys-ai-import__import-btn:hover:not(:disabled) {
          opacity: 0.85;
        }
        .phys-ai-import__import-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        /* Link-style button */
        .phys-ai-import__link-btn {
          background: none;
          border: none;
          color: var(--color-accent, #F5A623);
          font-size: 13px;
          cursor: pointer;
          padding: 4px 0;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: opacity 0.15s;
        }
        .phys-ai-import__link-btn:hover {
          opacity: 0.75;
        }

        /* Empty state */
        .phys-ai-import__empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 40px 24px;
          color: var(--color-text-muted, #888);
          text-align: center;
        }
        .phys-ai-import__empty p {
          margin: 0;
          font-size: 14px;
          max-width: 320px;
        }
      `}</style>
    </div>
  )
}
