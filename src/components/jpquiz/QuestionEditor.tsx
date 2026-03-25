/**
 * QuestionEditor — CRUD for quiz questions with image support
 */
import React, { useState, useRef, useCallback } from 'react'
import type { JpQuizQuestion } from './types'
import { generateQuizId } from './types'
import { compressImage } from '../../utils/imageCompress'
import { callAI } from '../../utils/ai'

const JP_QUIZ_SYSTEM_PROMPT = `You are a Japanese quiz question generator. Output ONLY a valid JSON array — no markdown, no code fences, no explanation.
Each item: { "questionText": string, "expectedAnswer": string, "reading"?: string, "answerType"?: "typed"|"spoken"|"both", "hint"?: string, "tags"?: string[], "difficulty"?: 1|2|3|4|5 }
Rules:
- For vocabulary: questionText = English word/phrase, expectedAnswer = Japanese
- For reverse cards: questionText = Japanese, expectedAnswer = English
- Always include "reading" (furigana or romaji) for Japanese answers
- Default answerType is "typed"; difficulty 1=very easy 3=medium 5=very hard
- Generate as many items as the request implies
- Output ONLY the JSON array, nothing else`

const MAX_QUESTIONS = 50

type CustomMap = { question: string; answer: string; hint: string; explanation: string }

function getTemplate(format: 'mcq' | 'tf' | 'frq' | 'vocab' | 'custom', customMap: CustomMap): string {
  switch (format) {
    case 'mcq':
      return JSON.stringify([{ question: 'What is mitosis?', type: 'mcq', choices: ['Cell division', 'DNA replication', 'Transcription', 'Translation'], answer: 'Cell division', explanation: 'Optional' }], null, 2)
    case 'tf':
      return JSON.stringify([{ question: 'Mitosis creates 2 cells.', type: 'tf', answer: 'True', explanation: 'Optional' }], null, 2)
    case 'frq':
      return JSON.stringify([{ question: 'Explain mitosis', type: 'frq', answer: 'Short explanation...', explanation: 'Optional' }], null, 2)
    case 'vocab':
      return JSON.stringify([{ term: '食べる', reading: 'たべる', definition: 'to eat', example: 'Optional sentence' }], null, 2)
    case 'custom': {
      const q = customMap.question || 'question'
      const a = customMap.answer || 'answer'
      const h = customMap.hint || 'hint'
      const e = customMap.explanation || 'explanation'
      return JSON.stringify([{ [q]: 'Your question here', [a]: 'Your answer here', [h]: 'Optional', [e]: 'Optional' }], null, 2)
    }
  }
}

function parseByFormat(
  item: Record<string, unknown>,
  format: 'mcq' | 'tf' | 'frq' | 'vocab' | 'custom',
  customMap: CustomMap,
): Partial<JpQuizQuestion> | null {
  switch (format) {
    case 'vocab': {
      if (!item.term || !item.definition) return null
      return {
        questionText: String(item.term),
        expectedAnswer: String(item.definition),
        hint: item.reading ? String(item.reading) : '',
        explanation: item.example ? String(item.example) : '',
        acceptableAnswers: [],
      }
    }
    case 'mcq': {
      if (!item.question || !item.answer) return null
      const choices = Array.isArray(item.choices) ? item.choices.map(String) : []
      return {
        questionText: String(item.question),
        expectedAnswer: String(item.answer),
        acceptableAnswers: choices.filter(c => c !== String(item.answer)),
        explanation: item.explanation ? String(item.explanation) : '',
        hint: '',
      }
    }
    case 'tf':
    case 'frq': {
      if (!item.question || !item.answer) return null
      return {
        questionText: String(item.question),
        expectedAnswer: String(item.answer),
        explanation: item.explanation ? String(item.explanation) : '',
        acceptableAnswers: [],
        hint: '',
      }
    }
    case 'custom': {
      const qKey = customMap.question
      const aKey = customMap.answer
      if (!qKey || !aKey || !item[qKey] || !item[aKey]) return null
      return {
        questionText: String(item[qKey]),
        expectedAnswer: String(item[aKey]),
        hint: customMap.hint && item[customMap.hint] ? String(item[customMap.hint]) : '',
        explanation: customMap.explanation && item[customMap.explanation] ? String(item[customMap.explanation]) : '',
        acceptableAnswers: [],
      }
    }
  }
}

interface Props {
  questions: JpQuizQuestion[]
  onChange: (questions: JpQuizQuestion[]) => void
  onBack: () => void
}

const emptyQ = (): Partial<JpQuizQuestion> => ({
  questionText: '',
  expectedAnswer: '',
  acceptableAnswers: [],
  answerType: 'typed',
  difficulty: 3,
  tags: [],
  hint: '',
  explanation: '',
})

export default function QuestionEditor({ questions, onChange, onBack }: Props) {
  const [editing, setEditing] = useState<Partial<JpQuizQuestion> | null>(null)
  const [editId, setEditId] = useState<string | null>(null) // null = new
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFormat, setImportFormat] = useState<'mcq' | 'tf' | 'frq' | 'vocab' | 'custom'>('vocab')
  const [copyDone, setCopyDone] = useState(false)
  const [showAiSection, setShowAiSection] = useState(false)
  const [customMap, setCustomMap] = useState<CustomMap>(() => {
    try { return JSON.parse(localStorage.getItem('nousai-import-custom-map') || '{}') }
    catch { return { question: '', answer: '', hint: '', explanation: '' } }
  })
  const jsonFileRef = useRef<HTMLInputElement>(null)
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiOutput, setAiOutput] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiPreview, setAiPreview] = useState<JpQuizQuestion[]>([])

  const startNew = () => {
    if (questions.length >= MAX_QUESTIONS) {
      alert(`Maximum ${MAX_QUESTIONS} questions reached.`)
      return
    }
    setEditing(emptyQ())
    setEditId(null)
    setImagePreview(null)
  }

  const startEdit = (q: JpQuizQuestion) => {
    setEditing({ ...q })
    setEditId(q.id)
    setImagePreview(q.questionImageBase64 ? `data:${q.questionImageMime || 'image/jpeg'};base64,${q.questionImageBase64}` : null)
  }

  const handleImage = useCallback(async (file: File) => {
    setIsCompressing(true)
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.7 })
      setEditing(prev => prev ? {
        ...prev,
        questionImageBase64: compressed.base64,
        questionImageMime: compressed.mimeType,
      } : prev)
      setImagePreview(`data:${compressed.mimeType};base64,${compressed.base64}`)
    } catch (e) {
      console.error('Image compress failed:', e)
      alert('Failed to process image')
    }
    setIsCompressing(false)
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleImage(file)
        return
      }
    }
  }, [handleImage])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) handleImage(file)
  }, [handleImage])

  const save = () => {
    if (!editing?.questionText?.trim() || !editing?.expectedAnswer?.trim()) {
      alert('Question and expected answer are required.')
      return
    }
    const now = new Date().toISOString()
    if (editId) {
      // Update existing
      onChange(questions.map(q => q.id === editId ? {
        ...q,
        ...editing,
        id: q.id,
        createdAt: q.createdAt,
      } as JpQuizQuestion : q))
    } else {
      // Add new
      const newQ: JpQuizQuestion = {
        id: generateQuizId(),
        questionText: editing.questionText!.trim(),
        expectedAnswer: editing.expectedAnswer!.trim(),
        acceptableAnswers: editing.acceptableAnswers?.filter(a => a.trim()) || [],
        answerType: editing.answerType || 'typed',
        difficulty: editing.difficulty || 3,
        tags: editing.tags || [],
        hint: editing.hint || '',
        explanation: editing.explanation || '',
        questionImageBase64: editing.questionImageBase64,
        questionImageMime: editing.questionImageMime,
        createdAt: now,
      }
      onChange([...questions, newQ])
    }
    setEditing(null)
    setEditId(null)
    setImagePreview(null)
  }

  const deleteQ = (id: string) => {
    if (confirm('Delete this question?')) {
      onChange(questions.filter(q => q.id !== id))
    }
  }

  const removeImage = () => {
    setEditing(prev => prev ? { ...prev, questionImageBase64: undefined, questionImageMime: undefined } : prev)
    setImagePreview(null)
  }

  // Import from JSON file
  const doFileImport = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      const imported = JSON.parse(text)
      const arr: Record<string, unknown>[] = Array.isArray(imported) ? imported : (imported.questions || [])
      let count = 0
      const newQs = [...questions]
      for (const item of arr) {
        if (newQs.length >= MAX_QUESTIONS) break
        const parsed = parseByFormat(item, importFormat, customMap)
        if (!parsed || !parsed.questionText || !parsed.expectedAnswer) continue
        newQs.push({
          id: generateQuizId(),
          questionText: parsed.questionText.trim(),
          expectedAnswer: parsed.expectedAnswer.trim(),
          acceptableAnswers: parsed.acceptableAnswers || [],
          answerType: (['typed', 'spoken', 'both'] as const).includes(item.answerType as 'typed') ? item.answerType as 'typed' | 'spoken' | 'both' : 'typed',
          difficulty: ([1, 2, 3, 4, 5] as const).includes(item.difficulty as 1) ? item.difficulty as 1 | 2 | 3 | 4 | 5 : 3,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          hint: parsed.hint || '',
          explanation: parsed.explanation || '',
          createdAt: new Date().toISOString(),
        })
        count++
      }
      onChange(newQs)
      alert(`Imported ${count} question${count !== 1 ? 's' : ''}`)
      setShowImportModal(false)
      setShowAiSection(false)
    } catch {
      alert('Failed to import. Ensure valid JSON format.')
    }
  }, [questions, onChange, importFormat, customMap])

  // AI generation
  const handleAiGenerate = useCallback(async () => {
    if (!aiPrompt.trim() || aiGenerating) return
    setAiGenerating(true)
    setAiOutput('')
    setAiPreview([])
    let accumulated = ''
    try {
      await callAI(
        [
          { role: 'system', content: JP_QUIZ_SYSTEM_PROMPT },
          { role: 'user', content: aiPrompt.trim() },
        ],
        {
          onChunk: (chunk) => {
            accumulated += chunk
            setAiOutput(accumulated)
          },
        },
        'japanese',
      )
      const cleaned = accumulated.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)
      const arr = Array.isArray(parsed) ? parsed : []
      const valid: JpQuizQuestion[] = []
      for (const item of arr) {
        if (!item.questionText || !item.expectedAnswer) continue
        const readingHint = item.reading ? `Reading: ${item.reading}` : ''
        const baseHint = item.hint || ''
        const hint = [baseHint, readingHint].filter(Boolean).join(' · ')
        valid.push({
          id: generateQuizId(),
          questionText: String(item.questionText),
          expectedAnswer: String(item.expectedAnswer),
          acceptableAnswers: item.reading ? [String(item.reading)] : [],
          answerType: (['typed', 'spoken', 'both'] as const).includes(item.answerType) ? item.answerType : 'typed',
          hint,
          explanation: '',
          difficulty: ([1, 2, 3, 4, 5] as const).includes(item.difficulty) ? item.difficulty : 3,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          createdAt: new Date().toISOString(),
        })
      }
      if (valid.length === 0) {
        alert(`AI returned 0 valid questions. Check the response below and try rephrasing your request.`)
      }
      setAiPreview(valid)
    } catch (e) {
      alert(`Generation failed: ${e instanceof Error ? e.message : 'Could not parse AI response as JSON. Try rephrasing your request.'}`)
    }
    setAiGenerating(false)
  }, [aiPrompt, aiGenerating])

  const handleAcceptAiPreview = useCallback(() => {
    const remaining = MAX_QUESTIONS - questions.length
    const toAdd = aiPreview.slice(0, remaining)
    if (toAdd.length < aiPreview.length) {
      alert(`Added first ${toAdd.length} questions (limit: ${MAX_QUESTIONS}).`)
    }
    onChange([...questions, ...toAdd])
    setAiPreview([])
    setAiOutput('')
    setAiPrompt('')
    setShowImportModal(false)
    setShowAiSection(false)
  }, [aiPreview, questions, onChange])

  const handleCopyTemplate = useCallback(() => {
    navigator.clipboard.writeText(getTemplate(importFormat, customMap))
      .then(() => { setCopyDone(true); setTimeout(() => setCopyDone(false), 2000) })
      .catch(() => {})
  }, [importFormat, customMap])

  const handleCustomMapChange = useCallback((field: keyof CustomMap, value: string) => {
    setCustomMap(prev => {
      const next = { ...prev, [field]: value }
      localStorage.setItem('nousai-import-custom-map', JSON.stringify(next))
      return next
    })
  }, [])

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  }

  // Edit form
  if (editing) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto' }}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {editId ? '✏️ Edit Question' : '➕ New Question'}
          </h3>
          <button onClick={() => { setEditing(null); setImagePreview(null) }}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        {/* Question text */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
          Question Text *
        </label>
        <textarea
          value={editing.questionText || ''}
          onChange={e => setEditing({ ...editing, questionText: e.target.value })}
          placeholder="e.g. 「おはようございます」を英語で何と言いますか？"
          style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
        />

        {/* Image */}
        <div style={{ margin: '12px 0' }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
            Image (paste, drop, or upload)
          </label>
          {imagePreview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={imagePreview} alt="question" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, border: '1px solid var(--border-color)' }} />
              <button onClick={removeImage} style={{
                position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff',
                border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={isCompressing}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                textAlign: 'center',
                color: 'var(--text-muted)',
                borderStyle: 'dashed',
                padding: '20px 12px',
              }}
            >
              {isCompressing ? '⏳ Compressing...' : '📷 Click, paste, or drop image'}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = '' }}
          />
        </div>

        {/* Expected answer */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
          Expected Answer *
        </label>
        <input
          value={editing.expectedAnswer || ''}
          onChange={e => setEditing({ ...editing, expectedAnswer: e.target.value })}
          placeholder="e.g. Good morning"
          style={inputStyle}
        />

        {/* Acceptable alt answers */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block', marginTop: 12 }}>
          Alternative Answers (comma-separated)
        </label>
        <input
          value={(editing.acceptableAnswers || []).join(', ')}
          onChange={e => setEditing({ ...editing, acceptableAnswers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
          placeholder="e.g. Good morning!, Morning"
          style={inputStyle}
        />

        {/* Answer type + Difficulty row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              Answer Type
            </label>
            <select
              value={editing.answerType || 'typed'}
              onChange={e => setEditing({ ...editing, answerType: e.target.value as any })}
              style={inputStyle}
            >
              <option value="typed">Typed (IME)</option>
              <option value="spoken">Spoken</option>
              <option value="both">Both</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>
              Difficulty
            </label>
            <select
              value={editing.difficulty || 3}
              onChange={e => setEditing({ ...editing, difficulty: Number(e.target.value) as any })}
              style={inputStyle}
            >
              {[1, 2, 3, 4, 5].map(d => <option key={d} value={d}>{'⭐'.repeat(d)}</option>)}
            </select>
          </div>
        </div>

        {/* Hint + Explanation */}
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block', marginTop: 12 }}>
          Hint (shown on request)
        </label>
        <input
          value={editing.hint || ''}
          onChange={e => setEditing({ ...editing, hint: e.target.value })}
          placeholder="Optional hint..."
          style={inputStyle}
        />
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, display: 'block', marginTop: 12 }}>
          Explanation (shown after answer)
        </label>
        <textarea
          value={editing.explanation || ''}
          onChange={e => setEditing({ ...editing, explanation: e.target.value })}
          placeholder="Optional explanation..."
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
        />

        {/* Save button */}
        <button onClick={save} style={{
          width: '100%', padding: '12px 16px', marginTop: 16,
          background: 'var(--accent-color, #6C5CE7)', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {editId ? '💾 Save Changes' : '➕ Add Question'}
        </button>
      </div>
    )
  }

  // Question list view
  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ← Back
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowImportModal(true)} style={{
            padding: '8px 14px', background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', borderRadius: 8,
            color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            📥 Import
          </button>
          <button onClick={startNew} style={{
            padding: '8px 14px', background: 'var(--accent-color, #6C5CE7)',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            + Add
          </button>
        </div>
      </div>

      {questions.length >= 40 && (
        <div style={{ padding: '8px 12px', background: 'rgba(243, 156, 18, 0.15)', borderRadius: 8, fontSize: 12, color: 'var(--warning-color, #f39c12)', marginBottom: 12 }}>
          ⚠️ {questions.length}/{MAX_QUESTIONS} questions — approaching limit
        </div>
      )}

      {questions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
          <p style={{ fontSize: 14 }}>No questions yet. Add or import to get started!</p>
        </div>
      ) : (
        <div>
          {questions.map((q, i) => (
            <div key={q.id} style={{
              padding: '12px 14px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 10,
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {q.questionImageBase64 && (
                <img
                  src={`data:${q.questionImageMime || 'image/jpeg'};base64,${q.questionImageBase64}`}
                  alt=""
                  style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.questionText}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  {'⭐'.repeat(q.difficulty)} · {q.answerType}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button onClick={() => startEdit(q)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4,
                }}>✏️</button>
                <button onClick={() => deleteQ(q.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4,
                }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Import Modal ── */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: 16,
          }}
          onClick={() => { if (!aiGenerating) { setShowImportModal(false); setShowAiSection(false) } }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 12, padding: 24, width: '100%', maxWidth: 520,
              maxHeight: '80vh', overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              marginTop: 'auto', marginBottom: 'auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>📥 Import Questions</h3>
              {!aiGenerating && (
                <button
                  onClick={() => { setShowImportModal(false); setShowAiSection(false); setAiOutput(''); setAiPreview([]) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}
                >✕</button>
              )}
            </div>

            {/* ── Section 1: Format Selector ── */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-primary)', borderRadius: 8, padding: 3 }}>
              {(['mcq', 'tf', 'frq', 'vocab', 'custom'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => setImportFormat(fmt)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: importFormat === fmt ? 'var(--bg-card)' : 'transparent',
                    color: importFormat === fmt ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: importFormat === fmt ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    transition: 'all 0.15s',
                    textTransform: 'uppercase',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* ── Section 2: Live Example ── */}
            <div style={{ marginBottom: 16 }}>
              {importFormat === 'custom' ? (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Define your JSON keys — map them to quiz fields:
                  </div>
                  {([
                    { field: 'question' as const, label: 'Question key' },
                    { field: 'answer' as const, label: 'Answer key' },
                    { field: 'hint' as const, label: 'Hint key (optional)' },
                    { field: 'explanation' as const, label: 'Explanation key (optional)' },
                  ]).map(({ field, label }) => (
                    <div key={field} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: 'var(--text-muted)', width: 150, flexShrink: 0 }}>{label}</label>
                      <input
                        value={customMap[field]}
                        onChange={e => handleCustomMapChange(field, e.target.value)}
                        placeholder={field}
                        style={{
                          flex: 1, padding: '6px 10px',
                          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                          borderRadius: 6, color: 'var(--text-primary)', fontSize: 12,
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>
                  ))}
                  <pre style={{
                    fontSize: 11, lineHeight: 1.6,
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '10px 12px', marginTop: 8,
                    color: 'var(--text-muted)', overflowX: 'auto', fontFamily: 'monospace', margin: '8px 0 0',
                  }}>
                    {getTemplate('custom', customMap)}
                  </pre>
                </div>
              ) : (
                <pre style={{
                  fontSize: 11, lineHeight: 1.6,
                  background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '10px 12px',
                  color: 'var(--text-muted)', overflowX: 'auto', fontFamily: 'monospace', margin: 0,
                }}>
                  {getTemplate(importFormat, customMap)}
                </pre>
              )}
            </div>

            {/* ── Section 3: Action Buttons ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={handleCopyTemplate}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: copyDone ? 'rgba(39,174,96,0.15)' : 'var(--bg-secondary)',
                  color: copyDone ? '#27ae60' : 'var(--text-primary)',
                  border: `1px solid ${copyDone ? '#27ae60' : 'var(--border-color)'}`,
                  borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s',
                }}
              >
                {copyDone ? '✓ Copied!' : '📋 Copy Template'}
              </button>

              {/* Persistent hidden file input — no memory leak */}
              <input
                ref={jsonFileRef}
                type="file"
                accept=".json"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) doFileImport(file)
                  e.target.value = ''
                }}
              />

              <button
                onClick={() => jsonFileRef.current?.click()}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: 'var(--accent-color, #6C5CE7)', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                📁 Choose JSON File
              </button>

              <button
                onClick={() => setShowAiSection(s => !s)}
                disabled={aiGenerating}
                style={{
                  width: '100%', padding: '11px 16px',
                  background: showAiSection ? 'var(--bg-secondary)' : 'transparent',
                  color: showAiSection ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  fontSize: 14, fontWeight: 600,
                  cursor: aiGenerating ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ✨ AI Generate {showAiSection ? '▲' : '▼'}
              </button>
            </div>

            {/* ── Inline AI Section ── */}
            {showAiSection && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                  Describe what to generate
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={'e.g. "Chapter 3 adjectives, English → Japanese"\n"Days of the week vocab"\n"Verb て-form conjugation practice"'}
                  disabled={aiGenerating}
                  style={{
                    width: '100%', minHeight: 80, padding: '10px 12px', boxSizing: 'border-box',
                    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: 8, color: 'var(--text-primary)', fontSize: 13,
                    fontFamily: 'inherit', resize: 'vertical', outline: 'none',
                  }}
                />
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  style={{
                    width: '100%', padding: '11px 16px', marginTop: 10,
                    background: aiGenerating || !aiPrompt.trim() ? 'var(--bg-secondary)' : 'var(--accent-color, #6C5CE7)',
                    color: aiGenerating || !aiPrompt.trim() ? 'var(--text-muted)' : '#fff',
                    border: '1px solid var(--border-color)', borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    cursor: aiGenerating || !aiPrompt.trim() ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {aiGenerating ? '⏳ Generating...' : '✨ Generate'}
                </button>

                {aiOutput && aiPreview.length === 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                      {aiGenerating ? 'Generating…' : 'Parsing…'}
                    </div>
                    <pre style={{
                      fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                      borderRadius: 8, padding: 10, maxHeight: 140, overflowY: 'auto',
                      color: 'var(--text-muted)', fontFamily: 'monospace', margin: 0, whiteSpace: 'pre-wrap',
                    }}>
                      {aiOutput}
                    </pre>
                  </div>
                )}

                {aiPreview.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Preview: {aiPreview.length} question{aiPreview.length !== 1 ? 's' : ''}
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aiPreview.map((q, i) => (
                        <div key={q.id} style={{
                          padding: '8px 10px', background: 'var(--bg-primary)',
                          border: '1px solid var(--border-color)', borderRadius: 8,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{i + 1}. {q.questionText}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>→ {q.expectedAnswer}</div>
                          {q.hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 1 }}>{q.hint}</div>}
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button
                        onClick={handleAcceptAiPreview}
                        style={{
                          flex: 1, padding: '10px 16px',
                          background: 'var(--accent-color, #6C5CE7)', color: '#fff',
                          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        ✓ Add {Math.min(aiPreview.length, MAX_QUESTIONS - questions.length)} to Bank
                      </button>
                      <button
                        onClick={() => { setAiPreview([]); setAiOutput('') }}
                        style={{
                          padding: '10px 16px',
                          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                          border: '1px solid var(--border-color)', borderRadius: 10,
                          fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
