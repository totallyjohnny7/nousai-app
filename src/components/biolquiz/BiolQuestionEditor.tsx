/**
 * BiolQuestionEditor — CRUD for BIOL question bank.
 * Question list, edit/add form, AI import, export.
 */
import React, { useState, useCallback, useMemo } from 'react'
import { ArrowLeft, Plus, Search, Edit2, Trash2, X, Check } from 'lucide-react'
import type { BiolQuestion, BiolQuestionType, BiolTopic, BiolHeading, BiolOption } from './types'
import { TOPIC_LABELS, HEADING_LABELS, generateBiolId, todayDateStr } from './types'
import { callAI, isAIConfigured } from '../../utils/ai'

interface Props {
  questions: BiolQuestion[]
  onChange: (questions: BiolQuestion[]) => void
  onBack: () => void
}

const ALL_TOPICS = Object.keys(TOPIC_LABELS) as BiolTopic[]
const ALL_HEADINGS = Object.keys(HEADING_LABELS) as BiolHeading[]
const DIFFICULTIES = [1, 2, 3, 4, 5] as const

function emptyQuestion(): Partial<BiolQuestion> {
  return {
    topic: 'genomes',
    heading: 'apply-it',
    questionType: 'mcq',
    questionText: '',
    options: [
      { label: 'A', text: '' },
      { label: 'B', text: '' },
      { label: 'C', text: '' },
      { label: 'D', text: '' },
    ],
    expectedAnswer: '',
    explanation: '',
    examTag: 'exam2',
    difficulty: 3,
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

export default function BiolQuestionEditor({ questions, onChange, onBack }: Props) {
  const [search, setSearch]         = useState('')
  const [editingId, setEditingId]   = useState<string | 'new' | null>(null)
  const [draft, setDraft]           = useState<Partial<BiolQuestion>>(emptyQuestion())
  const [aiPrompt, setAiPrompt]     = useState('')
  const [aiLoading, setAiLoading]   = useState(false)
  const [aiError, setAiError]       = useState('')
  const [topicFilter, setTopicFilter] = useState<BiolTopic | 'all'>('all')

  const filtered = useMemo(() => {
    let qs = questions
    if (topicFilter !== 'all') qs = qs.filter(q => q.topic === topicFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      qs = qs.filter(q =>
        q.questionText.toLowerCase().includes(s) ||
        q.expectedAnswer.toLowerCase().includes(s)
      )
    }
    return qs
  }, [questions, search, topicFilter])

  const startEdit = (q: BiolQuestion) => {
    setDraft({ ...q })
    setEditingId(q.id)
  }

  const startNew = () => {
    setDraft(emptyQuestion())
    setEditingId('new')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraft(emptyQuestion())
  }

  const saveEdit = useCallback(() => {
    if (!draft.questionText?.trim() || !draft.expectedAnswer?.trim()) return
    if (editingId === 'new') {
      const newQ: BiolQuestion = {
        id: generateBiolId(),
        topic: draft.topic ?? 'genomes',
        heading: draft.heading ?? 'apply-it',
        questionType: draft.questionType ?? 'mcq',
        questionText: draft.questionText ?? '',
        options: draft.questionType === 'mcq' ? draft.options : undefined,
        expectedAnswer: draft.expectedAnswer ?? '',
        explanation: draft.explanation ?? '',
        examTag: draft.examTag,
        examRef: draft.examRef,
        difficulty: draft.difficulty ?? 3,
      }
      onChange([...questions, newQ])
    } else if (editingId) {
      onChange(questions.map(q => q.id === editingId ? { ...q, ...draft, id: editingId } as BiolQuestion : q))
    }
    cancelEdit()
  }, [draft, editingId, questions, onChange])

  const deleteQuestion = (id: string) => {
    if (!confirm('Delete this question?')) return
    onChange(questions.filter(q => q.id !== id))
  }

  const handleAiImport = useCallback(async () => {
    if (!aiPrompt.trim() || !isAIConfigured()) return
    setAiLoading(true)
    setAiError('')
    try {
      const systemPrompt = `You are a BIOL 3020 exam question generator. Given a topic prompt, generate 5 high-quality exam questions in JSON array format.
Each question must have:
- questionType: "mcq" or "free-response"
- topic: one of ${ALL_TOPICS.join(', ')}
- heading: one of ${ALL_HEADINGS.join(', ')}
- questionText: string
- options: array of {label, text} ONLY for mcq type (labels A-D)
- expectedAnswer: string (for mcq: the letter like "A"; for free-response: full answer)
- explanation: string
- difficulty: 1-5
- examTag: "exam2"
Return ONLY valid JSON array, no markdown.`

      const response = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Generate BIOL 3020 questions about: ${aiPrompt}` },
      ])

      const parsed = JSON.parse(response)
      if (!Array.isArray(parsed)) {
        setAiError('AI returned unexpected format. Please try again.')
        return
      }
      const newQuestions: BiolQuestion[] = (parsed as Partial<BiolQuestion>[]).map(q => ({
        id: generateBiolId(),
        topic: q.topic ?? 'genomes',
        heading: q.heading ?? 'apply-it',
        questionType: q.questionType ?? 'mcq',
        questionText: q.questionText ?? '',
        options: q.questionType === 'mcq' ? q.options : undefined,
        expectedAnswer: q.expectedAnswer ?? '',
        explanation: q.explanation ?? '',
        examTag: 'exam2',
        difficulty: q.difficulty ?? 3,
      }))
      onChange([...questions, ...newQuestions])
      setAiPrompt('')
    } catch (e) {
      setAiError(`AI import failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setAiLoading(false)
    }
  }, [aiPrompt, questions, onChange])

  const patchDraft = (patch: Partial<BiolQuestion>) => setDraft(prev => ({ ...prev, ...patch }))

  const updateOption = (index: number, text: string) => {
    const options: BiolOption[] = (draft.options ?? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }])
      .map((o, i) => i === index ? { ...o, text } : o)
    patchDraft({ options })
  }

  if (editingId !== null) {
    return (
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
            <X size={20} />
          </button>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
            {editingId === 'new' ? 'New Question' : 'Edit Question'}
          </h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Topic</label>
              <select value={draft.topic} onChange={e => patchDraft({ topic: e.target.value as BiolTopic })} style={inputStyle}>
                {ALL_TOPICS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Heading</label>
              <select value={draft.heading} onChange={e => patchDraft({ heading: e.target.value as BiolHeading })} style={inputStyle}>
                {ALL_HEADINGS.map(h => <option key={h} value={h}>{HEADING_LABELS[h]}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={draft.questionType} onChange={e => patchDraft({ questionType: e.target.value as BiolQuestionType })} style={inputStyle}>
                <option value="mcq">MCQ</option>
                <option value="free-response">Free Response</option>
                <option value="scenario">Scenario</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Exam Tag</label>
              <select value={draft.examTag ?? ''} onChange={e => patchDraft({ examTag: e.target.value as 'exam1' | 'exam2' | 'exam3' | undefined })} style={inputStyle}>
                <option value="">None</option>
                <option value="exam1">Exam 1</option>
                <option value="exam2">Exam 2</option>
                <option value="exam3">Exam 3</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <div style={{ display: 'flex', gap: 4, paddingTop: 6 }}>
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => patchDraft({ difficulty: d })}
                    style={{
                      width: 30, height: 30, borderRadius: '50%',
                      border: '2px solid',
                      borderColor: d <= (draft.difficulty ?? 3) ? 'var(--accent-color, #F5A623)' : 'var(--border-color)',
                      background: d <= (draft.difficulty ?? 3) ? 'var(--accent-color, #F5A623)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 11, fontWeight: 700,
                      color: d <= (draft.difficulty ?? 3) ? '#fff' : 'var(--text-muted)',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Question Text</label>
            <textarea
              value={draft.questionText ?? ''}
              onChange={e => patchDraft({ questionText: e.target.value })}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          {draft.questionType === 'mcq' && (
            <div>
              <label style={labelStyle}>Options (A–D)</label>
              {(draft.options ?? [{ label: 'A', text: '' }, { label: 'B', text: '' }, { label: 'C', text: '' }, { label: 'D', text: '' }]).map((opt, i) => (
                <div key={opt.label} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                    background: draft.expectedAnswer === opt.label ? 'var(--accent-color, #F5A623)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    color: draft.expectedAnswer === opt.label ? '#fff' : 'var(--text-muted)',
                  }}
                  onClick={() => patchDraft({ expectedAnswer: opt.label })}
                  title="Click to mark as correct"
                  >
                    {opt.label}
                  </span>
                  <input
                    value={opt.text}
                    onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Option ${opt.label}`}
                    style={inputStyle}
                  />
                </div>
              ))}
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Click a letter to mark it as the correct answer.
              </p>
            </div>
          )}

          {draft.questionType !== 'mcq' && (
            <div>
              <label style={labelStyle}>Correct Answer / Model Answer</label>
              <textarea
                value={draft.expectedAnswer ?? ''}
                onChange={e => patchDraft({ expectedAnswer: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>Explanation</label>
            <textarea
              value={draft.explanation ?? ''}
              onChange={e => patchDraft({ explanation: e.target.value })}
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Exam Reference (optional)</label>
            <input
              value={draft.examRef ?? ''}
              onChange={e => patchDraft({ examRef: e.target.value })}
              placeholder="e.g. 2021 Q4"
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={saveEdit}
              style={{
                flex: 1, padding: '12px', background: 'var(--accent-color, #F5A623)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Check size={16} /> Save Question
            </button>
            <button
              onClick={cancelEdit}
              style={{
                flex: 1, padding: '12px', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', border: '1px solid var(--border-color)',
                borderRadius: 10, fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-color, #F5A623)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: 0 }}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Back
        </button>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', flex: 1 }}>
          Question Bank ({questions.length})
        </h3>
        <button
          onClick={startNew}
          style={{
            padding: '8px 14px', background: 'var(--accent-color, #F5A623)',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <Plus size={14} /> New Question
        </button>
      </div>

      {/* ── AI Import ── */}
      {isAIConfigured() && (
        <div style={{
          marginBottom: 16, padding: '14px 16px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12,
        }}>
          <label style={{ ...labelStyle, marginBottom: 8 }}>AI Generate Questions</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="e.g. telomere shortening and cancer, NER repair mechanism..."
              style={{ ...inputStyle, flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') handleAiImport() }}
            />
            <button
              onClick={handleAiImport}
              disabled={aiLoading || !aiPrompt.trim()}
              style={{
                padding: '9px 14px', background: '#3b82f6',
                color: '#fff', border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: aiLoading ? 0.7 : 1, whiteSpace: 'nowrap',
              }}
            >
              {aiLoading ? 'Generating…' : 'Generate 5'}
            </button>
          </div>
          {aiError && <p style={{ color: '#ef4444', fontSize: 12, margin: '6px 0 0' }}>{aiError}</p>}
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search questions…"
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
        <select
          value={topicFilter}
          onChange={e => setTopicFilter(e.target.value as BiolTopic | 'all')}
          style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
        >
          <option value="all">All Topics</option>
          {ALL_TOPICS.map(t => <option key={t} value={t}>{TOPIC_LABELS[t]}</option>)}
        </select>
      </div>

      {/* ── Question list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          {questions.length === 0 ? 'No questions yet. Add one above!' : 'No matching questions.'}
        </div>
      ) : (
        filtered.map(q => (
          <div key={q.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px',
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 10, marginBottom: 6,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {q.questionText}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 8 }}>
                <span>{TOPIC_LABELS[q.topic]}</span>
                <span>·</span>
                <span style={{ textTransform: 'capitalize' }}>{q.questionType.replace('-', ' ')}</span>
                <span>·</span>
                <span>{'★'.repeat(q.difficulty)}</span>
                {q.examTag && <><span>·</span><span style={{ color: '#F5A623' }}>{q.examTag.toUpperCase()}</span></>}
              </div>
            </div>
            <button
              onClick={() => startEdit(q)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <Edit2 size={15} />
            </button>
            <button
              onClick={() => deleteQuestion(q.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
