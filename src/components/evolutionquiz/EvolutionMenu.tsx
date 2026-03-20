/**
 * EvolutionMenu — Start screen for the Evolution Practium.
 * Shows mode cards (including heading-drill), topic/heading picker,
 * exam filter, streak, and action buttons.
 */
import React, { useState } from 'react'
import { Play, Clock, AlertTriangle, Target, Repeat, BarChart3, Plus, Map, Sparkles, BookOpen, ChevronDown, ChevronUp, Download } from 'lucide-react'
import type { EvolCourseData, EvolSessionMode, EvolTopic, EvolHeading } from './types'
import { TOPIC_LABELS, HEADING_LABELS, todayDateStr } from './types'

interface StartOptions {
  topicFilter?: EvolTopic
  headingFilter?: EvolHeading
  examFilter?: 'exam1' | 'exam2' | 'exam3' | 'all'
  chapterFilter?: string[]
}

interface Props {
  data: EvolCourseData
  onStart: (mode: EvolSessionMode, options: StartOptions) => void
  onManage: () => void
  onStats: () => void
  onMindMap: () => void
  onLoadChapter?: (chapters: string[]) => Promise<void>
}

const BUILT_IN_CHAPTERS = [
  { id: 'ch1',  label: 'Ch 1 – The Whale & the Virus' },
  { id: 'ch2',  label: 'Ch 2 – Natural Philosophy to Darwin' },
  { id: 'ch3',  label: 'Ch 3 – What the Rocks Say' },
  { id: 'ch4',  label: 'Ch 4 – The Tree of Life' },
  { id: 'ch5',  label: 'Ch 5 – Raw Material' },
  { id: 'ch6',  label: 'Ch 6 – The Ways of Change' },
  { id: 'ch7',  label: 'Ch 7 – Beyond Alleles' },
  { id: 'ch8',  label: 'Ch 8 – Natural Selection' },
  { id: 'ch9',  label: 'Ch 9 – The History in Our Genes' },
  { id: 'ch10', label: 'Ch 10 – Adaptation' },
  { id: 'ch11', label: 'Ch 11 – Sex' },
  { id: 'ch12', label: 'Ch 12 – After Conception' },
  { id: 'ch13', label: 'Ch 13 – The Origin of Species' },
  { id: 'ch14', label: 'Ch 14 – Macroevolution' },
  { id: 'ch15', label: 'Ch 15 – Intimate Partnerships' },
  { id: 'ch16', label: 'Ch 16 – Brains and Behavior' },
  { id: 'ch17', label: 'Ch 17 – Human Evolution' },
  { id: 'ch18', label: 'Ch 18 – Evolutionary Medicine' },
]

interface ModeCard {
  mode: EvolSessionMode
  icon: React.ReactNode
  label: string
  desc: string
  color: string
}

const MODE_CARDS: ModeCard[] = [
  {
    mode: 'practice',
    icon: <Play size={22} />,
    label: 'Practice',
    desc: 'Free practice — untimed, all questions',
    color: '#22c55e',
  },
  {
    mode: 'timed',
    icon: <Clock size={22} />,
    label: 'Timed Exam',
    desc: '20 questions / 10 minutes — exam simulation',
    color: '#3b82f6',
  },
  {
    mode: 'weak-topics',
    icon: <AlertTriangle size={22} />,
    label: 'Weak Topics',
    desc: 'Auto-queues questions you got wrong ≥2×',
    color: '#ef4444',
  },
  {
    mode: 'topic-drill',
    icon: <Target size={22} />,
    label: 'Topic Drill',
    desc: 'Pick one topic and drill every question in it',
    color: '#f59e0b',
  },
  {
    mode: 'heading-drill',
    icon: <BookOpen size={22} />,
    label: 'Practice by Heading',
    desc: 'Drill one heading at a time across all topics',
    color: '#a78bfa',
  },
  {
    mode: 'due-review',
    icon: <Repeat size={22} />,
    label: 'Due for Review',
    desc: 'Spaced-repetition cards due today',
    color: '#8b5cf6',
  },
]

const TOPICS_ORDERED: EvolTopic[] = [
  'evo-devo', 'evolution-of-sex', 'life-history',
  'coevolution', 'behavior', 'natural-selection',
  'genetic-drift', 'speciation', 'phylogenetics',
  'adaptation', 'population-genetics', 'other',
]

const HEADINGS_ORDERED: EvolHeading[] = [
  'what-and-why', 'key-players', 'how-it-works',
  'know-the-differences', 'consequences-and-failures',
  'apply-it', 'exam-traps',
]

const EXAM_FILTERS = [
  { value: 'all', label: 'All Exams' },
  { value: 'exam1', label: 'Exam 1' },
  { value: 'exam2', label: 'Exam 2' },
  { value: 'exam3', label: 'Exam 3' },
] as const

export default function EvolutionMenu({ data, onStart, onManage, onStats, onMindMap, onLoadChapter }: Props) {
  const [selectedMode, setSelectedMode] = useState<EvolSessionMode | null>(null)
  const [topicFilter, setTopicFilter]     = useState<EvolTopic>('evo-devo')
  const [headingFilter, setHeadingFilter] = useState<EvolHeading>('apply-it')
  const [examFilter, setExamFilter]       = useState<'exam1' | 'exam2' | 'exam3' | 'all'>('all')
  const [chapterFilter, setChapterFilter] = useState<string[]>([])
  const [bankExpanded, setBankExpanded]   = useState(false)
  const [loadSel, setLoadSel]             = useState<string[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadSuccess, setLoadSuccess]     = useState('')

  const qCount       = data.questions.length
  const sessionCount = data.sessionHistory.length
  const today        = todayDateStr()

  const weakCount = data.questions.filter(q => (q.wrongCount ?? 0) >= 2).length
  const dueCount  = data.questions.filter(q => q.srNextReview && q.srNextReview <= today).length

  const avgScore = sessionCount > 0
    ? Math.round(
        data.sessionHistory.reduce((s, h) => s + h.averageScore, 0) /
        Math.max(1, sessionCount)
      )
    : null

  const loadedPerChapter = BUILT_IN_CHAPTERS.reduce<Record<string, number>>((acc, ch) => {
    acc[ch.id] = data.questions.filter(q => q.chapterTag === ch.id).length
    return acc
  }, {})

  async function handleLoadChapters() {
    if (!onLoadChapter || loadSel.length === 0) return
    setLoading(true)
    try {
      await onLoadChapter(loadSel)
      setLoadSuccess(`✓ Loaded ${loadSel.length} chapter(s)`)
      setLoadSel([])
      setTimeout(() => setLoadSuccess(''), 3000)
    } catch { /* ignore */ }
    setLoading(false)
  }

  function handleStart() {
    if (!selectedMode) return
    if (qCount === 0) return
    onStart(selectedMode, {
      topicFilter: selectedMode === 'topic-drill' ? topicFilter : undefined,
      headingFilter: selectedMode === 'heading-drill' ? headingFilter : undefined,
      examFilter,
      chapterFilter: chapterFilter.length > 0 ? chapterFilter : undefined,
    })
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          🌿 Evolution Practium
        </h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <StatPill label="Questions" value={String(qCount)} />
          <StatPill label="Sessions" value={String(sessionCount)} />
          {avgScore !== null && <StatPill label="Avg Score" value={`${avgScore}%`} highlight />}
          {data.currentStreak > 0 && (
            <StatPill label="Streak" value={`${data.currentStreak}d 🔥`} />
          )}
        </div>
      </div>

      {/* ── Mind Map button ── */}
      <button
        onClick={onMindMap}
        style={{
          width: '100%',
          marginBottom: 12,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
          border: '1px solid #a78bfa',
          borderRadius: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#c4b5fd',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 0 20px rgba(167,139,250,0.3)'
          e.currentTarget.style.borderColor = '#c4b5fd'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = ''
          e.currentTarget.style.borderColor = '#a78bfa'
        }}
      >
        <Map size={20} />
        Open Visual Mind Map Lab
      </button>

      {/* ── Generate Questions button ── */}
      <button
        onClick={onManage}
        style={{
          width: '100%',
          marginBottom: 16,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0d1a0d 100%)',
          border: '1px solid #22c55e',
          borderRadius: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#86efac',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 0 20px rgba(34,197,94,0.3)'
          e.currentTarget.style.borderColor = '#4ade80'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = ''
          e.currentTarget.style.borderColor = '#22c55e'
        }}
      >
        <Sparkles size={20} />
        AI Generate Questions
      </button>

      {/* ── Mode cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {MODE_CARDS.map(card => {
          const isSelected = selectedMode === card.mode
          const badge =
            card.mode === 'weak-topics' ? weakCount
            : card.mode === 'due-review' ? dueCount
            : null
          const disabled = qCount === 0

          return (
            <button
              key={card.mode}
              disabled={disabled}
              onClick={() => setSelectedMode(isSelected ? null : card.mode)}
              style={{
                background: isSelected
                  ? `${card.color}22`
                  : 'var(--bg-card, var(--bg-secondary))',
                border: `2px solid ${isSelected ? card.color : 'var(--border-color)'}`,
                borderRadius: 14,
                padding: '18px 14px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!disabled) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              {badge !== null && badge > 0 && (
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  background: card.color, color: '#fff',
                  borderRadius: 999, fontSize: 11, fontWeight: 700,
                  padding: '2px 7px', lineHeight: 1.4,
                }}>
                  {badge}
                </span>
              )}
              <div style={{ color: card.color, marginBottom: 10 }}>
                {card.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {card.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {card.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Topic picker (Topic Drill only) ── */}
      {selectedMode === 'topic-drill' && (
        <div style={{
          marginBottom: 16,
          padding: '14px 16px',
          background: 'var(--bg-card, var(--bg-secondary))',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
        }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
            <Target size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Select Topic
          </label>
          <select
            value={topicFilter}
            onChange={e => setTopicFilter(e.target.value as EvolTopic)}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            {TOPICS_ORDERED.map(t => {
              const count = data.questions.filter(q => q.topic === t).length
              return (
                <option key={t} value={t}>
                  {TOPIC_LABELS[t]} ({count})
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* ── Heading picker (Heading Drill only) ── */}
      {selectedMode === 'heading-drill' && (
        <div style={{
          marginBottom: 16,
          padding: '14px 16px',
          background: 'var(--bg-card, var(--bg-secondary))',
          border: '1px solid #a78bfa',
          borderRadius: 12,
        }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd', display: 'block', marginBottom: 10 }}>
            <BookOpen size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Select Heading to Drill
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {HEADINGS_ORDERED.map(h => {
              const count = data.questions.filter(q => q.heading === h).length
              const isActive = headingFilter === h
              return (
                <button
                  key={h}
                  onClick={() => setHeadingFilter(h)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 8,
                    border: `1px solid ${isActive ? '#a78bfa' : 'var(--border-color)'}`,
                    background: isActive ? '#a78bfa22' : 'transparent',
                    color: isActive ? '#c4b5fd' : 'var(--text-primary)',
                    fontSize: 12,
                    fontWeight: isActive ? 700 : 400,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {HEADING_LABELS[h]} ({count})
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Built-in Chapter Bank ── */}
      {onLoadChapter && (
        <div style={{
          marginBottom: 16,
          border: '1px solid #6366f1',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setBankExpanded(e => !e)}
            style={{
              width: '100%', padding: '12px 16px',
              background: '#6366f111',
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              color: '#a5b4fc', fontSize: 13, fontWeight: 700,
            }}
          >
            <span>
              <BookOpen size={13} style={{ marginRight: 7, verticalAlign: 'middle' }} />
              Built-in Question Bank (Ch 1–18)
              {qCount > 0 && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>· {qCount} loaded</span>}
            </span>
            {bankExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {bankExpanded && (
            <div style={{ padding: '12px 16px', background: '#6366f108' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {BUILT_IN_CHAPTERS.map(ch => {
                  const loaded = loadedPerChapter[ch.id] ?? 0
                  const sel = loadSel.includes(ch.id)
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setLoadSel(s => sel ? s.filter(x => x !== ch.id) : [...s, ch.id])}
                      style={{
                        padding: '5px 10px', borderRadius: 7, fontSize: 11, fontFamily: 'inherit',
                        cursor: 'pointer',
                        border: `1px solid ${sel ? '#6366f1' : loaded > 0 ? '#22c55e' : 'var(--border-color)'}`,
                        background: sel ? '#6366f133' : loaded > 0 ? '#22c55e11' : 'transparent',
                        color: sel ? '#a5b4fc' : loaded > 0 ? '#86efac' : 'var(--text-muted)',
                        fontWeight: sel ? 700 : 400,
                      }}
                    >
                      {ch.label}{loaded > 0 ? ` ✓${loaded}` : ''}
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  onClick={() => setLoadSel(BUILT_IN_CHAPTERS.map(c => c.id))}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', fontFamily: 'inherit',
                  }}
                >All</button>
                <button
                  onClick={() => setLoadSel([])}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                    border: '1px solid var(--border-color)', background: 'transparent',
                    color: 'var(--text-muted)', fontFamily: 'inherit',
                  }}
                >None</button>
                <button
                  disabled={loading || loadSel.length === 0}
                  onClick={handleLoadChapters}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12, padding: '6px 14px', borderRadius: 8, cursor: loading || loadSel.length === 0 ? 'not-allowed' : 'pointer',
                    border: 'none', background: loading || loadSel.length === 0 ? '#6366f155' : '#6366f1',
                    color: '#fff', fontWeight: 700, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Download size={12} />
                  {loading ? 'Loading…' : `Load ${loadSel.length > 0 ? `(${loadSel.length})` : ''}`}
                </button>
              </div>
              {loadSuccess && (
                <p style={{ marginTop: 8, color: '#86efac', fontSize: 12, fontWeight: 700 }}>{loadSuccess}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chapter filter chips (when chapter-tagged questions exist) ── */}
      {data.questions.some(q => q.chapterTag) && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
            FILTER BY CHAPTER (optional)
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {BUILT_IN_CHAPTERS.filter(ch => (loadedPerChapter[ch.id] ?? 0) > 0).map(ch => {
              const active = chapterFilter.includes(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => setChapterFilter(s => active ? s.filter(x => x !== ch.id) : [...s, ch.id])}
                  style={{
                    padding: '4px 9px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                    border: `1px solid ${active ? '#6366f1' : 'var(--border-color)'}`,
                    background: active ? '#6366f133' : 'transparent',
                    color: active ? '#a5b4fc' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {ch.label}
                </button>
              )
            })}
            {chapterFilter.length > 0 && (
              <button
                onClick={() => setChapterFilter([])}
                style={{
                  padding: '4px 9px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                  border: '1px solid var(--border-color)', background: 'transparent',
                  color: 'var(--text-muted)',
                }}
              >Clear</button>
            )}
          </div>
        </div>
      )}

      {/* ── Exam filter ── */}
      <div style={{
        marginBottom: 20,
        padding: '14px 16px',
        background: 'var(--bg-card, var(--bg-secondary))',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
      }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
          Filter by Exam
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {EXAM_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setExamFilter(f.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${examFilter === f.value ? 'var(--accent-color, #F5A623)' : 'var(--border-color)'}`,
                background: examFilter === f.value ? 'var(--accent-color, #F5A623)' : 'transparent',
                color: examFilter === f.value ? '#000' : 'var(--text-primary)',
                fontSize: 13,
                fontWeight: examFilter === f.value ? 700 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Start button ── */}
      {selectedMode && (
        <button
          onClick={handleStart}
          disabled={qCount === 0}
          style={{
            width: '100%',
            padding: '14px 16px',
            background: 'var(--accent-color, #F5A623)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            cursor: qCount === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            marginBottom: 16,
            letterSpacing: 0.3,
            opacity: qCount === 0 ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          Start {MODE_CARDS.find(c => c.mode === selectedMode)?.label} →
        </button>
      )}

      {qCount === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
          Add questions to your bank to start a session.
        </p>
      )}

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button
          onClick={onManage}
          style={{
            flex: 1,
            padding: '11px 14px',
            background: 'var(--accent-color, #F5A623)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <Plus size={15} />
          Manage Questions ({qCount})
        </button>
        <button
          onClick={onStats}
          style={{
            flex: 1,
            padding: '11px 14px',
            background: 'var(--bg-card, var(--bg-secondary))',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
          }}
        >
          <BarChart3 size={15} />
          View Analytics
        </button>
      </div>

      {/* ── Recent sessions ── */}
      {sessionCount > 0 && (
        <div>
          <h4 style={{
            fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
            margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.6,
          }}>
            Recent Sessions
          </h4>
          {data.sessionHistory.slice(-5).reverse().map(s => {
            const modeInfo = MODE_CARDS.find(c => c.mode === s.mode)
            const scoreColor =
              s.averageScore >= 80 ? 'var(--success-color, #2ecc71)'
              : s.averageScore >= 50 ? 'var(--warning-color, #f39c12)'
              : 'var(--danger-color, #e74c3c)'
            return (
              <div key={s.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '9px 13px',
                background: 'var(--bg-card, var(--bg-secondary))',
                border: '1px solid var(--border-color)',
                borderRadius: 9,
                marginBottom: 6,
                fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-primary)' }}>
                  {modeInfo?.label ?? s.mode} · {s.questionCount}Q
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ fontWeight: 700, color: scoreColor }}>
                    {s.averageScore > 0 ? `${s.averageScore}%` : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 18, fontWeight: 700,
        color: highlight ? 'var(--accent-color, #F5A623)' : 'var(--text-primary)',
        fontFamily: 'DM Mono, monospace',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
    </div>
  )
}
