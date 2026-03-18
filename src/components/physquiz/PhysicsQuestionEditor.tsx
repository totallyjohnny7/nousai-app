/**
 * PhysicsQuestionEditor — CRUD for physics question bank
 * Manages question list, edit modal, bulk import modal, and export.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react'
import {
  ArrowLeft, Plus, Upload, Download, Search, Star,
  Edit2, Trash2, X, ChevronDown, ChevronUp, Check,
} from 'lucide-react'
import type {
  PhysicsQuestion, PhysicsQuestionType, PhysicsTopic,
  PhysicsVariable, PhysicsSubPart, PhysicsDifficulty,
  PhysicsSource, VariableRange,
} from './types'
import {
  TOPIC_LABELS, generatePhysicsId, todayDateStr,
} from './types'
import { compressImage } from '../../utils/imageCompress'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  questions: PhysicsQuestion[]
  onChange: (questions: PhysicsQuestion[]) => void
  onBack: () => void
  onImport: () => void // opens PhysicsAiImport panel
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as PhysicsTopic[]
const DIFFICULTIES: PhysicsDifficulty[] = [1, 2, 3, 4, 5]
const SOURCES: PhysicsSource[] = ['manual', 'ai-generated', 'image-import', 'teacher', 'json-import']
const SOURCE_LABELS: Record<PhysicsSource, string> = {
  'manual': 'Manual',
  'ai-generated': 'AI Generated',
  'image-import': 'Image Import',
  'teacher': 'Teacher',
  'json-import': 'JSON Import',
}

function emptyQuestion(): Partial<PhysicsQuestion> {
  return {
    questionText: '',
    questionType: 'free-response',
    topic: 'mechanics',
    subtopic: '',
    difficulty: 3,
    source: 'manual',
    tags: [],
    expectedAnswer: '',
    acceptableAnswers: [],
    choices: ['', '', '', ''],
    parts: [],
    variables: [],
    variableRanges: [],
    prerequisiteConcepts: [],
    hint: '',
    explanation: '',
    starred: false,
    examTag: '',
    chapterTag: '',
    supportsStepMode: false,
  }
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-muted)',
  marginBottom: 4,
  display: 'block',
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={labelStyle}>{children}</label>
}

function DifficultyPicker({
  value,
  onChange,
}: { value: PhysicsDifficulty; onChange: (d: PhysicsDifficulty) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {DIFFICULTIES.map(d => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          title={`Difficulty ${d}`}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: '2px solid',
            borderColor: d <= value ? 'var(--accent-color, #F5A623)' : 'var(--border-color)',
            background: d <= value ? 'var(--accent-color, #F5A623)' : 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: d <= value ? '#fff' : 'var(--text-muted)',
            flexShrink: 0,
          }}
        >
          {d}
        </button>
      ))}
    </div>
  )
}

// ─── Bulk Import Parse ────────────────────────────────────────────────────────

function parseImportItem(item: Record<string, unknown>): Partial<PhysicsQuestion> | null {
  const text = String(item.question ?? item.questionText ?? '').trim()
  if (!text) return null
  const answer = String(item.answer ?? item.expectedAnswer ?? '').trim()
  const choices = Array.isArray(item.choices)
    ? item.choices.map(String)
    : undefined
  const topicRaw = String(item.topic ?? 'other').toLowerCase()
  const topic: PhysicsTopic = ALL_TOPICS.includes(topicRaw as PhysicsTopic)
    ? (topicRaw as PhysicsTopic)
    : 'other'
  const diffRaw = Number(item.difficulty)
  const difficulty: PhysicsDifficulty = DIFFICULTIES.includes(diffRaw as PhysicsDifficulty)
    ? (diffRaw as PhysicsDifficulty)
    : 3
  return {
    questionText: text,
    expectedAnswer: answer,
    topic,
    difficulty,
    choices: choices ?? ['', '', '', ''],
    questionType: choices ? 'mcq' : 'free-response',
    source: 'json-import',
    tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
    hint: String(item.hint ?? ''),
    explanation: String(item.explanation ?? ''),
    parts: [],
    variables: [],
    variableRanges: [],
    prerequisiteConcepts: [],
    starred: false,
    examTag: '',
    chapterTag: '',
    supportsStepMode: false,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PhysicsQuestionEditor({ questions, onChange, onBack, onImport }: Props) {
  // List filters
  const [filterTopic, setFilterTopic] = useState<PhysicsTopic | 'all'>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<PhysicsDifficulty | 0>(0)
  const [filterSource, setFilterSource] = useState<PhysicsSource | 'all'>('all')
  const [filterStarred, setFilterStarred] = useState(false)
  const [searchText, setSearchText] = useState('')

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Partial<PhysicsQuestion>>(emptyQuestion())
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [expandRanges, setExpandRanges] = useState(false)
  const [expandParts, setExpandParts] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Bulk import modal
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkTab, setBulkTab] = useState<'json' | 'manual' | 'single' | 'patch'>('json')
  const [bulkJson, setBulkJson] = useState('')
  const [bulkManualText, setBulkManualText] = useState('')
  const [bulkSingleText, setBulkSingleText] = useState('')
  const [bulkPreview, setBulkPreview] = useState<Partial<PhysicsQuestion>[]>([])
  const [bulkError, setBulkError] = useState('')
  const jsonFileRef = useRef<HTMLInputElement>(null)
  const patchFileRef = useRef<HTMLInputElement>(null)
  const [patchEntries, setPatchEntries] = useState<Array<{ id: string; questionImageBase64: string; questionImageMime: string }>>([])
  const [patchPreview, setPatchPreview] = useState<{ matched: number; unmatched: number; samples: string[] } | null>(null)
  const [patchApplied, setPatchApplied] = useState(false)
  const [patchError, setPatchError] = useState('')

  // ── Filtered list ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const search = searchText.toLowerCase().trim()
    let list = questions.slice()

    if (filterTopic !== 'all') list = list.filter(q => q.topic === filterTopic)
    if (filterDifficulty !== 0) list = list.filter(q => q.difficulty === filterDifficulty)
    if (filterSource !== 'all') list = list.filter(q => q.source === filterSource)
    if (filterStarred) list = list.filter(q => q.starred)
    if (search) list = list.filter(q =>
      q.questionText.toLowerCase().includes(search) ||
      (q.subtopic ?? '').toLowerCase().includes(search) ||
      q.tags.some(t => t.toLowerCase().includes(search))
    )

    // Starred first, then by dateAdded desc
    list.sort((a, b) => {
      if (a.starred && !b.starred) return -1
      if (!a.starred && b.starred) return 1
      return b.dateAdded.localeCompare(a.dateAdded)
    })

    return list
  }, [questions, filterTopic, filterDifficulty, filterSource, filterStarred, searchText])

  // ── Edit helpers ────────────────────────────────────────────────────────────

  const openNew = () => {
    setEditing(emptyQuestion())
    setEditId(null)
    setImagePreview(null)
    setExpandRanges(false)
    setExpandParts(false)
    setShowEditModal(true)
  }

  const openEdit = (q: PhysicsQuestion) => {
    setEditing({
      ...q,
      choices: q.choices?.length ? q.choices : ['', '', '', ''],
      parts: q.parts ?? [],
      variables: q.variables ?? [],
      variableRanges: q.variableRanges ?? [],
      prerequisiteConcepts: q.prerequisiteConcepts ?? [],
    })
    setEditId(q.id)
    setImagePreview(
      q.questionImageBase64
        ? `data:${q.questionImageMime ?? 'image/jpeg'};base64,${q.questionImageBase64}`
        : null
    )
    setExpandRanges(false)
    setExpandParts(false)
    setShowEditModal(true)
  }

  const closeEdit = () => {
    setShowEditModal(false)
    setEditing(emptyQuestion())
    setEditId(null)
    setImagePreview(null)
  }

  const handleImage = useCallback(async (file: File) => {
    setIsCompressing(true)
    try {
      const compressed = await compressImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.75 })
      setEditing(prev => ({
        ...prev,
        questionImageBase64: compressed.base64,
        questionImageMime: compressed.mimeType,
      }))
      setImagePreview(`data:${compressed.mimeType};base64,${compressed.base64}`)
    } catch (e) {
      console.error('Image compress failed:', e)
      alert('Failed to process image.')
    }
    setIsCompressing(false)
  }, [])

  const setField = <K extends keyof PhysicsQuestion>(key: K, value: PhysicsQuestion[K]) => {
    setEditing(prev => ({ ...prev, [key]: value }))
  }

  const saveQuestion = () => {
    if (!editing.questionText?.trim()) {
      alert('Question text is required.')
      return
    }
    if (editing.questionType !== 'multi-part' && !editing.expectedAnswer?.trim()) {
      alert('Expected answer is required (or use Multi-Part type).')
      return
    }

    const now = todayDateStr()

    if (editId) {
      onChange(questions.map(q =>
        q.id === editId
          ? {
              ...q,
              ...editing,
              id: q.id,
              dateAdded: q.dateAdded,
              variables: (editing.variables ?? []).filter(v => v.symbol.trim()),
              variableRanges: (editing.variableRanges ?? []).filter(r => r.symbol.trim()),
              prerequisiteConcepts: (editing.prerequisiteConcepts ?? []).filter(Boolean),
              tags: (editing.tags ?? []).filter(Boolean),
              choices: editing.questionType === 'mcq'
                ? (editing.choices ?? []).filter(c => c.trim())
                : undefined,
              parts: editing.questionType === 'multi-part'
                ? (editing.parts ?? [])
                : undefined,
            } as PhysicsQuestion
          : q
      ))
    } else {
      const newQ: PhysicsQuestion = {
        id: generatePhysicsId(),
        questionText: editing.questionText!.trim(),
        questionType: editing.questionType ?? 'free-response',
        topic: editing.topic ?? 'other',
        subtopic: editing.subtopic?.trim() || undefined,
        difficulty: editing.difficulty ?? 3,
        source: editing.source ?? 'manual',
        tags: (editing.tags ?? []).filter(Boolean),
        expectedAnswer: (editing.expectedAnswer ?? '').trim(),
        acceptableAnswers: editing.acceptableAnswers?.filter(a => a.trim()) ?? [],
        choices: editing.questionType === 'mcq'
          ? (editing.choices ?? []).filter(c => c.trim())
          : undefined,
        parts: editing.questionType === 'multi-part'
          ? (editing.parts ?? [])
          : undefined,
        variables: (editing.variables ?? []).filter(v => v.symbol.trim()),
        variableRanges: (editing.variableRanges ?? []).filter(r => r.symbol.trim()),
        prerequisiteConcepts: (editing.prerequisiteConcepts ?? []).filter(Boolean),
        hint: editing.hint?.trim() || undefined,
        explanation: editing.explanation?.trim() || undefined,
        questionImageBase64: editing.questionImageBase64,
        questionImageMime: editing.questionImageMime,
        starred: editing.starred ?? false,
        examTag: editing.examTag?.trim() || undefined,
        chapterTag: editing.chapterTag?.trim() || undefined,
        dateAdded: now,
        wrongCount: 0,
        supportsStepMode: editing.supportsStepMode ?? false,
      }
      onChange([...questions, newQ])
    }
    closeEdit()
  }

  const deleteQuestion = (id: string) => {
    if (confirm('Delete this question?')) {
      onChange(questions.filter(q => q.id !== id))
    }
  }

  const toggleStarred = (id: string) => {
    onChange(questions.map(q => q.id === id ? { ...q, starred: !q.starred } : q))
  }

  // ── Patch Figures handler ─────────────────────────────────────────────────

  function handlePatchFile(file: File) {
    setPatchError('')
    setPatchPreview(null)
    setPatchApplied(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        if (!Array.isArray(raw)) throw new Error('Expected a JSON array')
        const entries = raw.filter(
          (x): x is { id: string; questionImageBase64: string; questionImageMime: string } =>
            typeof x?.id === 'string' &&
            typeof x?.questionImageBase64 === 'string' &&
            typeof x?.questionImageMime === 'string'
        )
        if (entries.length === 0) throw new Error('No valid patch entries found')
        setPatchEntries(entries)

        // Preview: count matched vs unmatched
        const bankIds = new Set(questions.map(q => q.id))
        const matched = entries.filter(e => bankIds.has(e.id))
        const unmatched = entries.filter(e => !bankIds.has(e.id))
        if (unmatched.length > 0) {
          console.log(`[Patch] ${unmatched.length} unmatched IDs:`, unmatched.map(e => e.id))
        }
        const samples = matched.slice(0, 3).map(e => {
          const q = questions.find(q => q.id === e.id)
          return q ? q.questionText.slice(0, 60) + '…' : e.id
        })
        setPatchPreview({ matched: matched.length, unmatched: unmatched.length, samples })
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to parse file')
      }
    }
    reader.readAsText(file)
  }

  function applyPatch() {
    if (!patchPreview || patchPreview.matched === 0) return
    const figureMap = new Map(patchEntries.map(e => [e.id, e]))
    const updated = questions.map(q => {
      const fig = figureMap.get(q.id)
      if (!fig) return q
      return { ...q, questionImageBase64: fig.questionImageBase64, questionImageMime: fig.questionImageMime }
    })
    onChange(updated)
    setPatchApplied(true)
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  const handleExport = () => {
    const data = JSON.stringify(questions, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `physics-bank-${todayDateStr()}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── Bulk import logic ─────────────────────────────────────────────────────────

  const parseJsonImport = useCallback((text: string) => {
    setBulkError('')
    setBulkPreview([])
    try {
      const raw = JSON.parse(text.trim())
      const arr: Record<string, unknown>[] = Array.isArray(raw)
        ? raw
        : (raw.questions ?? [])
      const parsed: Partial<PhysicsQuestion>[] = []
      for (const item of arr) {
        const q = parseImportItem(item as Record<string, unknown>)
        if (q) parsed.push(q)
      }
      if (parsed.length === 0) {
        setBulkError('No valid questions found. Check format.')
        return
      }
      setBulkPreview(parsed)
    } catch {
      setBulkError('Invalid JSON. Please check the format.')
    }
  }, [])

  const commitBulkImport = () => {
    if (bulkPreview.length === 0) return
    const now = todayDateStr()
    const toAdd: PhysicsQuestion[] = bulkPreview.map(p => ({
      id: generatePhysicsId(),
      questionText: p.questionText ?? '',
      questionType: p.questionType ?? 'free-response',
      topic: p.topic ?? 'other',
      difficulty: p.difficulty ?? 3,
      source: p.source ?? 'json-import',
      tags: p.tags ?? [],
      expectedAnswer: p.expectedAnswer ?? '',
      acceptableAnswers: [],
      choices: p.choices,
      parts: p.parts,
      variables: p.variables ?? [],
      variableRanges: p.variableRanges ?? [],
      prerequisiteConcepts: p.prerequisiteConcepts ?? [],
      hint: p.hint || undefined,
      explanation: p.explanation || undefined,
      starred: false,
      dateAdded: now,
      wrongCount: 0,
      supportsStepMode: false,
    }))
    onChange([...questions, ...toAdd])
    setBulkPreview([])
    setBulkJson('')
    setBulkManualText('')
    setBulkSingleText('')
    setShowBulkModal(false)
    alert(`Imported ${toAdd.length} question${toAdd.length !== 1 ? 's' : ''}.`)
  }

  const parseSinglePaste = () => {
    const text = bulkSingleText.trim()
    if (!text) return
    // Try to split on an answer key line like "Answer: ..." or "A: ..."
    const answerMatch = text.match(/\n(?:answer|ans|key)[:\s]+(.+)/i)
    const questionText = answerMatch
      ? text.slice(0, answerMatch.index).trim()
      : text
    const expectedAnswer = answerMatch ? answerMatch[1].trim() : ''
    setBulkPreview([{
      questionText,
      expectedAnswer,
      questionType: 'free-response',
      topic: 'other',
      difficulty: 3,
      source: 'manual',
      tags: [],
    }])
    setBulkError('')
  }

  const handleJsonFileImport = useCallback(async (file: File) => {
    try {
      const text = await file.text()
      setBulkJson(text)
      parseJsonImport(text)
    } catch {
      setBulkError('Failed to read file.')
    }
  }, [parseJsonImport])

  // ── Storage size ──────────────────────────────────────────────────────────────

  const estimatedKB = Math.round(new Blob([JSON.stringify(questions)]).size / 1024)

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            gap: 4, fontSize: 14, fontWeight: 600, fontFamily: 'inherit', padding: '4px 0',
          }}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>Question Bank</span>
          <span style={{
            marginLeft: 8, padding: '2px 8px', borderRadius: 20,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            {questions.length}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleExport}
            title="Export Bank"
            style={{
              padding: '7px 12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={() => { setShowBulkModal(true); setBulkPreview([]); setBulkError('') }}
            style={{
              padding: '7px 12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <Upload size={14} /> Bulk Import
          </button>
          <button
            onClick={onImport}
            style={{
              padding: '7px 12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              color: 'var(--text-primary)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
              fontFamily: 'inherit',
            }}
          >
            <Upload size={14} /> Image/PDF
          </button>
          <button
            onClick={openNew}
            style={{
              padding: '7px 13px', background: 'var(--accent-color, #F5A623)',
              border: 'none', borderRadius: 8, color: '#fff',
              fontWeight: 700, cursor: 'pointer', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit',
            }}
          >
            <Plus size={14} /> Add Question
          </button>
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search questions..."
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
        <select
          value={filterTopic}
          onChange={e => setFilterTopic(e.target.value as PhysicsTopic | 'all')}
          style={{ ...inputStyle, width: 'auto', minWidth: 120 }}
        >
          <option value="all">All Topics</option>
          {ALL_TOPICS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
        </select>
        <select
          value={filterDifficulty}
          onChange={e => setFilterDifficulty(Number(e.target.value) as PhysicsDifficulty | 0)}
          style={{ ...inputStyle, width: 'auto', minWidth: 110 }}
        >
          <option value={0}>Any Difficulty</option>
          {DIFFICULTIES.map(d => <option key={d} value={d}>{'● '.repeat(d).trim()}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value as PhysicsSource | 'all')}
          style={{ ...inputStyle, width: 'auto', minWidth: 120 }}
        >
          <option value="all">All Sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
        <button
          onClick={() => setFilterStarred(s => !s)}
          title="Starred only"
          style={{
            padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
            border: '1px solid var(--border-color)',
            background: filterStarred ? 'rgba(245,166,35,0.15)' : 'var(--bg-secondary)',
            color: filterStarred ? 'var(--accent-color, #F5A623)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
            fontFamily: 'inherit', fontWeight: filterStarred ? 700 : 400,
          }}
        >
          <Star size={14} fill={filterStarred ? 'currentColor' : 'none'} />
          Starred
        </button>
      </div>

      {/* ── Question List ─────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.5 }}>⚛</div>
          <p style={{ fontSize: 14 }}>
            {questions.length === 0
              ? 'No questions yet. Add your first question or import from a file.'
              : 'No questions match your filters.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(q => (
            <div
              key={q.id}
              style={{
                padding: '10px 14px',
                background: 'var(--bg-secondary)',
                border: `1px solid ${q.starred ? 'rgba(245,166,35,0.4)' : 'var(--border-color)'}`,
                borderRadius: 10,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              {/* Topic badge */}
              <span style={{
                padding: '2px 8px', borderRadius: 20,
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {TOPIC_LABELS[q.topic]}
              </span>

              {/* Question snippet */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {q.questionText.length > 70
                    ? q.questionText.slice(0, 70) + '…'
                    : q.questionText}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                  <span>{q.questionType}</span>
                  {q.subtopic && <span>· {q.subtopic}</span>}
                </div>
              </div>

              {/* Difficulty circles */}
              <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                {DIFFICULTIES.map(d => (
                  <div
                    key={d}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: d <= q.difficulty
                        ? 'var(--accent-color, #F5A623)'
                        : 'var(--border-color)',
                    }}
                  />
                ))}
              </div>

              {/* Star toggle */}
              <button
                onClick={() => toggleStarred(q.id)}
                title={q.starred ? 'Unstar' : 'Star'}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: q.starred ? 'var(--accent-color, #F5A623)' : 'var(--text-muted)',
                  display: 'flex', flexShrink: 0,
                }}
              >
                <Star size={15} fill={q.starred ? 'currentColor' : 'none'} />
              </button>

              {/* Edit */}
              <button
                onClick={() => openEdit(q)}
                title="Edit"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: 'var(--text-muted)', display: 'flex', flexShrink: 0,
                }}
              >
                <Edit2 size={15} />
              </button>

              {/* Delete */}
              <button
                onClick={() => deleteQuestion(q.id)}
                title="Delete"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  color: 'var(--text-muted)', display: 'flex', flexShrink: 0,
                }}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Storage indicator ─────────────────────────────────────────────── */}
      {questions.length > 0 && (
        <div style={{
          marginTop: 16, padding: '8px 12px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          <span>📦 Bank: ~{estimatedKB} KB</span>
          <button
            onClick={handleExport}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent-color, #F5A623)', fontSize: 12,
              fontWeight: 600, fontFamily: 'inherit', padding: 0,
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <Download size={12} /> Export Backup
          </button>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          EDIT MODAL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showEditModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 9998, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', overflowY: 'auto', padding: '24px 16px',
          }}
          onClick={closeEdit}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 24, width: '100%', maxWidth: 620,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                {editId ? 'Edit Question' : 'New Question'}
              </h3>
              <button
                onClick={closeEdit}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* ── Question Text ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Question Text * (use $...$ for LaTeX)</FieldLabel>
              <textarea
                value={editing.questionText ?? ''}
                onChange={e => setField('questionText', e.target.value)}
                placeholder="e.g. A ball is launched at $v_0 = 20$ m/s at $\theta = 45°$. Find the range."
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
              />
            </div>

            {/* ── Question Type tabs ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Question Type</FieldLabel>
              <div style={{ display: 'flex', gap: 0, background: 'var(--bg-primary)', borderRadius: 8, padding: 3 }}>
                {(['mcq', 'free-response', 'multi-part'] as PhysicsQuestionType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setField('questionType', t)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.15s',
                      background: editing.questionType === t ? 'var(--bg-card)' : 'transparent',
                      color: editing.questionType === t ? 'var(--text-primary)' : 'var(--text-muted)',
                      boxShadow: editing.questionType === t ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {t === 'mcq' ? 'MCQ' : t === 'free-response' ? 'Free Response' : 'Multi-Part'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Topic + Subtopic ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Topic</FieldLabel>
                <select
                  value={editing.topic ?? 'other'}
                  onChange={e => setField('topic', e.target.value as PhysicsTopic)}
                  style={inputStyle}
                >
                  {ALL_TOPICS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Subtopic</FieldLabel>
                <input
                  value={editing.subtopic ?? ''}
                  onChange={e => setField('subtopic', e.target.value)}
                  placeholder="e.g. Projectile motion"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* ── Difficulty ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Difficulty</FieldLabel>
              <DifficultyPicker
                value={editing.difficulty ?? 3}
                onChange={d => setField('difficulty', d)}
              />
            </div>

            {/* ── MCQ Choices ── */}
            {editing.questionType === 'mcq' && (
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Choices (A, B, C, D)</FieldLabel>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 20, flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <input
                      value={(editing.choices ?? ['', '', '', ''])[i] ?? ''}
                      onChange={e => {
                        const choices = [...(editing.choices ?? ['', '', '', ''])]
                        choices[i] = e.target.value
                        setField('choices', choices)
                      }}
                      placeholder={`Choice ${String.fromCharCode(65 + i)}`}
                      style={inputStyle}
                    />
                  </div>
                ))}
                <FieldLabel>Correct Answer</FieldLabel>
                <select
                  value={editing.expectedAnswer ?? ''}
                  onChange={e => setField('expectedAnswer', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select correct choice</option>
                  {(editing.choices ?? []).map((c, i) => c.trim() ? (
                    <option key={i} value={c}>{String.fromCharCode(65 + i)}: {c}</option>
                  ) : null)}
                </select>
              </div>
            )}

            {/* ── Free Response: Expected Answer ── */}
            {editing.questionType === 'free-response' && (
              <div style={{ marginBottom: 14 }}>
                <FieldLabel>Expected Answer (use $...$ for LaTeX math)</FieldLabel>
                <textarea
                  value={editing.expectedAnswer ?? ''}
                  onChange={e => setField('expectedAnswer', e.target.value)}
                  placeholder="e.g. $R = \frac{v_0^2 \sin(2\theta)}{g} \approx 40.8$ m"
                  style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
                />
              </div>
            )}

            {/* ── Multi-Part ── */}
            {editing.questionType === 'multi-part' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <FieldLabel>Parts</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setExpandParts(s => !s)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                  >
                    {expandParts ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
                {(editing.parts ?? []).map((part, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12, marginBottom: 8,
                      background: 'var(--bg-primary)', borderRadius: 8,
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Part ({part.label || String.fromCharCode(97 + i)})</span>
                      <button
                        type="button"
                        onClick={() => {
                          const parts = (editing.parts ?? []).filter((_, j) => j !== i)
                          setField('parts', parts)
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <input
                      value={part.label}
                      onChange={e => {
                        const parts = [...(editing.parts ?? [])]
                        parts[i] = { ...parts[i], label: e.target.value }
                        setField('parts', parts)
                      }}
                      placeholder="Label (e.g. a)"
                      style={{ ...inputStyle, marginBottom: 6 }}
                    />
                    <textarea
                      value={part.question}
                      onChange={e => {
                        const parts = [...(editing.parts ?? [])]
                        parts[i] = { ...parts[i], question: e.target.value }
                        setField('parts', parts)
                      }}
                      placeholder="Part question..."
                      style={{ ...inputStyle, minHeight: 55, resize: 'vertical', marginBottom: 6 }}
                    />
                    <textarea
                      value={part.expectedAnswer}
                      onChange={e => {
                        const parts = [...(editing.parts ?? [])]
                        parts[i] = { ...parts[i], expectedAnswer: e.target.value }
                        setField('parts', parts)
                      }}
                      placeholder="Expected answer..."
                      style={{ ...inputStyle, minHeight: 45, resize: 'vertical' }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const parts = editing.parts ?? []
                    const newLabel = String.fromCharCode(97 + parts.length)
                    setField('parts', [...parts, { label: newLabel, question: '', expectedAnswer: '' }])
                    setExpandParts(true)
                  }}
                  style={{
                    width: '100%', padding: '8px 12px',
                    background: 'transparent', border: '1px dashed var(--border-color)',
                    borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: 13, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <Plus size={13} /> Add Part
                </button>
              </div>
            )}

            {/* ── Variables ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Variables (symbol, name, unit)</FieldLabel>
              {(editing.variables ?? []).map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <input
                    value={v.symbol}
                    onChange={e => {
                      const vars = [...(editing.variables ?? [])]
                      vars[i] = { ...vars[i], symbol: e.target.value }
                      setField('variables', vars)
                    }}
                    placeholder="v₀"
                    style={{ ...inputStyle, width: 70, flexShrink: 0 }}
                  />
                  <input
                    value={v.name}
                    onChange={e => {
                      const vars = [...(editing.variables ?? [])]
                      vars[i] = { ...vars[i], name: e.target.value }
                      setField('variables', vars)
                    }}
                    placeholder="Initial velocity"
                    style={inputStyle}
                  />
                  <input
                    value={v.unit}
                    onChange={e => {
                      const vars = [...(editing.variables ?? [])]
                      vars[i] = { ...vars[i], unit: e.target.value }
                      setField('variables', vars)
                    }}
                    placeholder="m/s"
                    style={{ ...inputStyle, width: 70, flexShrink: 0 }}
                  />
                  <button
                    type="button"
                    onClick={() => setField('variables', (editing.variables ?? []).filter((_, j) => j !== i))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setField('variables', [...(editing.variables ?? []), { symbol: '', name: '', unit: '' }])}
                style={{
                  padding: '6px 12px', background: 'transparent',
                  border: '1px dashed var(--border-color)', borderRadius: 8,
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                  fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <Plus size={12} /> Add Variable
              </button>
            </div>

            {/* ── Variable Ranges (collapsible) ── */}
            <div style={{ marginBottom: 14 }}>
              <button
                type="button"
                onClick={() => setExpandRanges(s => !s)}
                style={{
                  width: '100%', background: 'none',
                  border: '1px solid var(--border-color)', borderRadius: 8,
                  padding: '8px 12px', cursor: 'pointer', fontFamily: 'inherit',
                  color: 'var(--text-muted)', fontSize: 13,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <span>Variable Ranges ({(editing.variableRanges ?? []).length})</span>
                {expandRanges ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {expandRanges && (
                <div style={{ marginTop: 8 }}>
                  {(editing.variableRanges ?? []).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 5, marginBottom: 6, alignItems: 'center' }}>
                      <input
                        value={r.symbol}
                        onChange={e => {
                          const ranges = [...(editing.variableRanges ?? [])]
                          ranges[i] = { ...ranges[i], symbol: e.target.value }
                          setField('variableRanges', ranges)
                        }}
                        placeholder="sym"
                        style={{ ...inputStyle, width: 55, flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        value={r.min}
                        onChange={e => {
                          const ranges = [...(editing.variableRanges ?? [])]
                          ranges[i] = { ...ranges[i], min: Number(e.target.value) }
                          setField('variableRanges', ranges)
                        }}
                        placeholder="min"
                        style={{ ...inputStyle, width: 65, flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        value={r.max}
                        onChange={e => {
                          const ranges = [...(editing.variableRanges ?? [])]
                          ranges[i] = { ...ranges[i], max: Number(e.target.value) }
                          setField('variableRanges', ranges)
                        }}
                        placeholder="max"
                        style={{ ...inputStyle, width: 65, flexShrink: 0 }}
                      />
                      <input
                        type="number"
                        value={r.step}
                        onChange={e => {
                          const ranges = [...(editing.variableRanges ?? [])]
                          ranges[i] = { ...ranges[i], step: Number(e.target.value) }
                          setField('variableRanges', ranges)
                        }}
                        placeholder="step"
                        style={{ ...inputStyle, width: 65, flexShrink: 0 }}
                      />
                      <input
                        value={r.unit}
                        onChange={e => {
                          const ranges = [...(editing.variableRanges ?? [])]
                          ranges[i] = { ...ranges[i], unit: e.target.value }
                          setField('variableRanges', ranges)
                        }}
                        placeholder="unit"
                        style={{ ...inputStyle, width: 65, flexShrink: 0 }}
                      />
                      <button
                        type="button"
                        onClick={() => setField('variableRanges', (editing.variableRanges ?? []).filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', flexShrink: 0 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setField('variableRanges', [...(editing.variableRanges ?? []), { symbol: '', min: 0, max: 100, step: 1, unit: '' }])}
                    style={{
                      padding: '6px 12px', background: 'transparent',
                      border: '1px dashed var(--border-color)', borderRadius: 8,
                      color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
                      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Plus size={12} /> Add Range
                  </button>
                </div>
              )}
            </div>

            {/* ── Prerequisite Concepts ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Prerequisite Concepts (comma-separated)</FieldLabel>
              <input
                value={(editing.prerequisiteConcepts ?? []).join(', ')}
                onChange={e => setField('prerequisiteConcepts', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="e.g. Newton's 2nd law, kinematics equations"
                style={inputStyle}
              />
            </div>

            {/* ── Hint ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Hint (shown on request)</FieldLabel>
              <textarea
                value={editing.hint ?? ''}
                onChange={e => setField('hint', e.target.value)}
                placeholder="Optional hint for students..."
                style={{ ...inputStyle, minHeight: 55, resize: 'vertical' }}
              />
            </div>

            {/* ── Explanation ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Explanation (shown after grading)</FieldLabel>
              <textarea
                value={editing.explanation ?? ''}
                onChange={e => setField('explanation', e.target.value)}
                placeholder="Step-by-step solution or explanation..."
                style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              />
            </div>

            {/* ── Tags + Exam/Chapter ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Tags (comma-separated)</FieldLabel>
              <input
                value={(editing.tags ?? []).join(', ')}
                onChange={e => setField('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="e.g. AP Physics, midterm, kinematics"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Exam Tag</FieldLabel>
                <input
                  value={editing.examTag ?? ''}
                  onChange={e => setField('examTag', e.target.value)}
                  placeholder="e.g. AP 2024"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Chapter Tag</FieldLabel>
                <input
                  value={editing.chapterTag ?? ''}
                  onChange={e => setField('chapterTag', e.target.value)}
                  placeholder="e.g. Ch. 3"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* ── Question Image ── */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel>Question Image</FieldLabel>
              {imagePreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={imagePreview}
                    alt="question"
                    style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, border: '1px solid var(--border-color)', display: 'block' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(prev => ({ ...prev, questionImageBase64: undefined, questionImageMime: undefined }))
                      setImagePreview(null)
                    }}
                    style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                      width: 24, height: 24, cursor: 'pointer', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={isCompressing}
                  style={{
                    ...inputStyle, cursor: 'pointer', textAlign: 'center',
                    color: 'var(--text-muted)', borderStyle: 'dashed',
                    padding: '18px 12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                  }}
                >
                  <Upload size={15} />
                  {isCompressing ? 'Compressing...' : 'Click to upload image (image/*)'}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) handleImage(f)
                  e.target.value = ''
                }}
              />
            </div>

            {/* ── Toggles ── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={editing.starred ?? false}
                  onChange={e => setField('starred', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <Star size={13} style={{ color: editing.starred ? 'var(--accent-color, #F5A623)' : 'var(--text-muted)' }} />
                Starred
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={editing.supportsStepMode ?? false}
                  onChange={e => setField('supportsStepMode', e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                Supports Step Mode
              </label>
            </div>

            {/* ── Source ── */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel>Source</FieldLabel>
              <select
                value={editing.source ?? 'manual'}
                onChange={e => setField('source', e.target.value as PhysicsSource)}
                style={inputStyle}
              >
                {SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
            </div>

            {/* ── Save / Cancel ── */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={saveQuestion}
                style={{
                  flex: 1, padding: '12px 16px',
                  background: 'var(--accent-color, #F5A623)', color: '#fff',
                  border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Check size={15} />
                {editId ? 'Save Question' : 'Add Question'}
              </button>
              <button
                onClick={closeEdit}
                style={{
                  padding: '12px 20px', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)', borderRadius: 10,
                  color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          BULK IMPORT MODAL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {showBulkModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 9999, display: 'flex', alignItems: 'flex-start',
            justifyContent: 'center', overflowY: 'auto', padding: '24px 16px',
          }}
          onClick={() => setShowBulkModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 24, width: '100%', maxWidth: 560,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Bulk Import</h3>
              <button
                onClick={() => setShowBulkModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: 0, background: 'var(--bg-primary)', borderRadius: 8, padding: 3, marginBottom: 16 }}>
              {(['json', 'manual', 'single', 'patch'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setBulkTab(tab); setBulkPreview([]); setBulkError('') }}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: bulkTab === tab ? 'var(--bg-card)' : 'transparent',
                    color: bulkTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                    boxShadow: bulkTab === tab ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
                    textTransform: 'uppercase',
                  }}
                >
                  {tab === 'single' ? 'Single Paste' : tab === 'patch' ? 'Patch Figures' : tab.toUpperCase()}
                </button>
              ))}
            </div>

            {/* ── JSON tab ── */}
            {bulkTab === 'json' && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
                  Paste a JSON array of questions. Supported fields:
                  <code style={{ display: 'block', marginTop: 6, padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {`[{ "question": "...", "answer": "...", "topic": "mechanics", "difficulty": 3, "choices": [...] }]`}
                  </code>
                </p>
                <pre style={{
                  fontSize: 10, background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '8px 10px', marginBottom: 10, overflowX: 'auto',
                  color: 'var(--text-muted)', fontFamily: 'monospace',
                }}>
                  {JSON.stringify([
                    { question: 'A car accelerates at $a=3$ m/s². Find velocity after $t=5$ s.', answer: '$v = 15$ m/s', topic: 'kinematics', difficulty: 2 },
                    { question: 'What is Ohm\'s Law?', answer: '$V = IR$', topic: 'circuits', difficulty: 1, choices: ['$V=IR$', '$P=IV$', '$F=ma$', '$E=mc^2$'] },
                  ], null, 2)}
                </pre>
                <textarea
                  value={bulkJson}
                  onChange={e => { setBulkJson(e.target.value); setBulkPreview([]); setBulkError('') }}
                  placeholder="Paste JSON array here..."
                  style={{ ...inputStyle, minHeight: 140, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, marginBottom: 10 }}
                />
                {bulkError && (
                  <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{bulkError}</div>
                )}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <button
                    onClick={() => parseJsonImport(bulkJson)}
                    disabled={!bulkJson.trim()}
                    style={{
                      flex: 1, padding: '10px 16px',
                      background: bulkJson.trim() ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                      border: '1px solid var(--border-color)', borderRadius: 10,
                      color: bulkJson.trim() ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: 13, fontWeight: 600, cursor: bulkJson.trim() ? 'pointer' : 'not-allowed',
                      fontFamily: 'inherit',
                    }}
                  >
                    Parse &amp; Preview
                  </button>
                  <input
                    ref={jsonFileRef}
                    type="file"
                    accept=".json"
                    hidden
                    onChange={e => {
                      const f = e.target.files?.[0]
                      if (f) handleJsonFileImport(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => jsonFileRef.current?.click()}
                    style={{
                      padding: '10px 16px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: 10, color: 'var(--text-primary)',
                      fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    <Upload size={13} /> File
                  </button>
                </div>
              </div>
            )}

            {/* ── Manual tab ── */}
            {bulkTab === 'manual' && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
                  Paste one question's text here. It will be added to the bank — you can fill in the remaining fields in the editor.
                </p>
                <textarea
                  value={bulkManualText}
                  onChange={e => { setBulkManualText(e.target.value); setBulkPreview([]); setBulkError('') }}
                  placeholder="Paste question text here..."
                  style={{ ...inputStyle, minHeight: 130, resize: 'vertical', marginBottom: 10 }}
                />
                <button
                  onClick={() => {
                    if (!bulkManualText.trim()) return
                    setBulkPreview([{
                      questionText: bulkManualText.trim(),
                      expectedAnswer: '',
                      questionType: 'free-response',
                      topic: 'other',
                      difficulty: 3,
                      source: 'manual',
                      tags: [],
                    }])
                    setBulkError('')
                  }}
                  style={{
                    width: '100%', padding: '10px 16px', marginBottom: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 10, color: 'var(--text-primary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Preview
                </button>
              </div>
            )}

            {/* ── Single Paste tab ── */}
            {bulkTab === 'single' && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
                  Paste one question and optional answer. Use <code style={{ fontFamily: 'monospace' }}>Answer: ...</code> on a new line to auto-extract.
                </p>
                <textarea
                  value={bulkSingleText}
                  onChange={e => { setBulkSingleText(e.target.value); setBulkPreview([]); setBulkError('') }}
                  placeholder={'A projectile is launched at 30 m/s at 60°. Find max height.\n\nAnswer: $h = 34.4$ m'}
                  style={{ ...inputStyle, minHeight: 130, resize: 'vertical', marginBottom: 10 }}
                />
                <button
                  onClick={parseSinglePaste}
                  style={{
                    width: '100%', padding: '10px 16px', marginBottom: 10,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 10, color: 'var(--text-primary)',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Parse into Fields
                </button>
              </div>
            )}

            {/* ── Patch Figures tab ── */}
            {bulkTab === 'patch' && (
              <div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
                  Upload <code>figures-patch.json</code> generated by{' '}
                  <code>node scripts/generate-figures.mjs</code>. Matches by question ID and
                  updates only the figure — session history and scores are untouched.
                </p>

                <input
                  ref={patchFileRef}
                  type="file"
                  accept=".json"
                  hidden
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) handlePatchFile(f)
                    e.target.value = ''
                  }}
                />

                {!patchApplied && (
                  <button
                    onClick={() => patchFileRef.current?.click()}
                    style={{
                      width: '100%', padding: '10px 16px', marginBottom: 12,
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: 10, color: 'var(--text-primary)',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    📂 Choose figures-patch.json
                  </button>
                )}

                {patchError && (
                  <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{patchError}</div>
                )}

                {patchPreview && !patchApplied && (
                  <div style={{
                    padding: '12px 14px', background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                      Preview
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                      ✅ <strong>{patchPreview.matched}</strong> questions matched
                      {patchPreview.unmatched > 0 && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                          ({patchPreview.unmatched} unmatched — see console)
                        </span>
                      )}
                    </div>
                    {patchPreview.samples.map((s, i) => (
                      <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        · {s}
                      </div>
                    ))}
                    <button
                      onClick={applyPatch}
                      style={{
                        marginTop: 12, width: '100%', padding: '10px 16px',
                        background: 'var(--accent-color, #F5A623)', color: '#fff',
                        border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      Apply Patch ({patchPreview.matched} figures)
                    </button>
                  </div>
                )}

                {patchApplied && (
                  <div style={{
                    padding: '14px 16px', background: '#22c55e11',
                    border: '1px solid #22c55e44', borderRadius: 10,
                    fontSize: 14, color: '#22c55e', fontWeight: 600, textAlign: 'center',
                  }}>
                    ✅ {patchPreview?.matched} figures applied — close this panel and start practicing!
                  </div>
                )}
              </div>
            )}

            {/* ── Preview ── */}
            {bulkPreview.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Preview — {bulkPreview.length} question{bulkPreview.length !== 1 ? 's' : ''}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {bulkPreview.map((q, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '8px 10px', background: 'var(--bg-primary)',
                        border: '1px solid var(--border-color)', borderRadius: 8,
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                        {i + 1}. {(q.questionText ?? '').slice(0, 80)}{(q.questionText ?? '').length > 80 ? '…' : ''}
                      </div>
                      {q.expectedAnswer && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {q.expectedAnswer}</div>
                      )}
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {TOPIC_LABELS[q.topic ?? 'other']} · difficulty {q.difficulty} · {q.questionType}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={commitBulkImport}
                    style={{
                      flex: 1, padding: '11px 16px',
                      background: 'var(--accent-color, #F5A623)', color: '#fff',
                      border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}
                  >
                    <Check size={15} /> Import {bulkPreview.length} Question{bulkPreview.length !== 1 ? 's' : ''}
                  </button>
                  <button
                    onClick={() => setBulkPreview([])}
                    style={{
                      padding: '11px 16px', background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)', borderRadius: 10,
                      color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    Discard
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
