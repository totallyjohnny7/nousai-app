/**
 * PhysicsMenu — Start screen for the Physics Practicum.
 * Shows mode cards, options toggles, stats row, and action buttons.
 */
import React, { useState } from 'react'
import { Play, Clock, AlertTriangle, Target, Repeat, BarChart3, Plus, Download, ChevronDown, ChevronUp } from 'lucide-react'
import type { PhysicsCourseData, PhysicsSessionMode, PhysicsTopic } from './types'
import { TOPIC_LABELS, todayDateStr } from './types'

interface StartOptions {
  topicFilter?: PhysicsTopic
  chapterFilter?: string[]
  scrambleValues: boolean
  stepMode: boolean
}

const BUILT_IN_CHAPTERS = [
  { id: 'ch19', label: 'Ch 19', name: 'Current & DC Circuits' },
  { id: 'ch20', label: 'Ch 20', name: 'Magnetic Forces' },
  { id: 'ch21', label: 'Ch 21', name: 'EM Induction' },
  { id: 'ch22', label: 'Ch 22', name: 'Alternating Current' },
  { id: 'ch23', label: 'Ch 23', name: 'EM Waves' },
  { id: 'ch24', label: 'Ch 24', name: 'Geometric Optics' },
  { id: 'ch25', label: 'Ch 25', name: 'Optical Instruments' },
  { id: 'ch26', label: 'Ch 26', name: 'Interference & Diffraction' },
]

interface Props {
  data: PhysicsCourseData
  onStart: (mode: PhysicsSessionMode, options: StartOptions) => void
  onManage: () => void
  onStats: () => void
  onMindMap: () => void
  onLoadChapter?: (chapters: string[]) => Promise<void>
}

interface ModeCard {
  mode: PhysicsSessionMode
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
    desc: 'Free practice — hints available, untimed',
    color: '#22c55e',
  },
  {
    mode: 'timed',
    icon: <Clock size={22} />,
    label: 'Timed Exam',
    desc: '45-min exam simulation — no hints',
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
    mode: 'due-review',
    icon: <Repeat size={22} />,
    label: 'Due for Review',
    desc: 'Spaced-repetition cards due today',
    color: '#8b5cf6',
  },
]

const TOPICS_ORDERED: PhysicsTopic[] = [
  'mechanics', 'kinematics', 'thermodynamics', 'waves',
  'optics', 'electromagnetism', 'circuits', 'modern', 'nuclear', 'other',
]

export default function PhysicsMenu({ data, onStart, onManage, onStats, onMindMap, onLoadChapter }: Props) {
  const [selectedMode, setSelectedMode]   = useState<PhysicsSessionMode | null>(null)
  const [topicFilter, setTopicFilter]     = useState<PhysicsTopic>('mechanics')
  const [scramble, setScramble]           = useState(false)
  const [stepMode, setStepMode]           = useState(false)
  const [chapterFilter, setChapterFilter] = useState<string[]>([])
  const [loadSel, setLoadSel]             = useState<string[]>([])
  const [loading, setLoading]             = useState(false)
  const [loadSuccess, setLoadSuccess]     = useState<string | null>(null)
  const [bankExpanded, setBankExpanded]   = useState(false)

  const qCount       = data.questions.length
  const sessionCount = data.sessionHistory.length
  const today        = todayDateStr()

  // Derived counts for badge display
  const weakCount = data.questions.filter(q => (q.wrongCount ?? 0) >= 2).length
  const dueCount  = data.questions.filter(q => q.srNextReview && q.srNextReview <= today).length

  // Options availability
  const hasVariableRanges = data.questions.some(q => q.variableRanges && q.variableRanges.length > 0)
  const hasFreeResponse   = data.questions.some(q => q.questionType !== 'mcq')

  // Avg score from sessions
  const avgScore = sessionCount > 0
    ? Math.round(
        data.sessionHistory
          .filter(s => s.gradedCount > 0)
          .reduce((sum, s) => sum + s.averageScore, 0) /
        Math.max(1, data.sessionHistory.filter(s => s.gradedCount > 0).length)
      )
    : null

  function handleStart() {
    if (!selectedMode) return
    if (qCount === 0) return
    onStart(selectedMode, {
      topicFilter: selectedMode === 'topic-drill' ? topicFilter : undefined,
      chapterFilter: chapterFilter.length > 0 ? chapterFilter : undefined,
      scrambleValues: scramble && hasVariableRanges,
      stepMode: stepMode && hasFreeResponse,
    })
  }

  async function handleLoadChapters() {
    if (loadSel.length === 0) return
    setLoading(true)
    setLoadSuccess(null)
    try {
      await onLoadChapter?.(loadSel)
      setLoadSuccess(`Loaded ${loadSel.map(c => c.toUpperCase()).join(', ')} into your bank`)
      setLoadSel([])
    } finally {
      setLoading(false)
    }
  }

  // Count loaded questions per chapter
  const loadedPerChapter: Record<string, number> = {}
  for (const q of data.questions) {
    if (q.chapterTag) loadedPerChapter[q.chapterTag] = (loadedPerChapter[q.chapterTag] ?? 0) + 1
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          ⚛️ Physics Practicum
        </h2>
        {/* Stats row */}
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
          width: '100%', marginBottom: 16, padding: '14px 16px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #0f172a 50%, #1e1b4b 100%)',
          border: '1px solid #3b82f6', borderRadius: 14, cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 10, color: '#93c5fd', fontSize: 15, fontWeight: 600,
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#60a5fa'; e.currentTarget.style.boxShadow = '0 0 16px #3b82f633' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = 'none' }}
      >
        <span style={{ fontSize: 20 }}>🗺️</span>
        <div style={{ textAlign: 'left' }}>
          <div>Physics Mind Map</div>
          <div style={{ fontSize: 12, color: '#60a5fa', fontWeight: 400 }}>10 topic bubbles — tap to explore</div>
        </div>
      </button>

      {/* ── Built-in Question Bank ── */}
      <div style={{
        marginBottom: 16, border: '1px solid var(--border-color)',
        borderRadius: 12, overflow: 'hidden',
        background: 'var(--bg-card, var(--bg-secondary))',
      }}>
        <button
          onClick={() => setBankExpanded(e => !e)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
            <Download size={15} color="#3b82f6" />
            Built-in Question Bank (Ch 19–26)
          </span>
          {bankExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>

        {bankExpanded && (
          <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 10px' }}>
              Select chapters to load into your question bank. Already-loaded questions are skipped.
            </p>

            {/* Chapter chips — load selection */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {BUILT_IN_CHAPTERS.map(ch => {
                const sel = loadSel.includes(ch.id)
                const loaded = loadedPerChapter[ch.id] ?? 0
                return (
                  <button
                    key={ch.id}
                    onClick={() => setLoadSel(prev => sel ? prev.filter(x => x !== ch.id) : [...prev, ch.id])}
                    title={ch.name}
                    style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                      border: `1px solid ${sel ? '#3b82f6' : 'var(--border-color)'}`,
                      background: sel ? '#3b82f622' : 'transparent',
                      color: sel ? '#3b82f6' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit', position: 'relative',
                    }}
                  >
                    {ch.label}
                    {loaded > 0 && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: '#22c55e' }}>✓{loaded}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                onClick={handleLoadChapters}
                disabled={loadSel.length === 0 || loading}
                style={{
                  flex: 1, padding: '8px 12px', background: '#3b82f6', color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: loadSel.length === 0 || loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', opacity: loadSel.length === 0 || loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Loading…' : `Load ${loadSel.length > 0 ? loadSel.map(c=>c.toUpperCase()).join(', ') : 'Selected'}`}
              </button>
              {loadSel.length < BUILT_IN_CHAPTERS.length && (
                <button
                  onClick={() => setLoadSel(BUILT_IN_CHAPTERS.map(c => c.id))}
                  style={{ padding: '8px 12px', background: 'transparent', color: '#3b82f6', border: '1px solid #3b82f6', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  All
                </button>
              )}
            </div>

            {loadSuccess && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', padding: '6px 10px', background: '#22c55e18', borderRadius: 6, border: '1px solid #22c55e' }}>
                ✓ {loadSuccess}
              </div>
            )}
          </div>
        )}
      </div>

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
              {/* Badge */}
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
            onChange={e => setTopicFilter(e.target.value as PhysicsTopic)}
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

      {/* ── Options toggles ── */}
      <div style={{
        marginBottom: 20,
        padding: '14px 16px',
        background: 'var(--bg-card, var(--bg-secondary))',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <ToggleRow
          label="Scramble Variable Values"
          desc="Randomises numeric values in questions each attempt"
          checked={scramble}
          disabled={!hasVariableRanges}
          disabledHint="No questions have variable ranges defined"
          onChange={setScramble}
        />
        <div style={{ borderTop: '1px solid var(--border-color)' }} />
        <ToggleRow
          label="Step-by-Step Mode"
          desc="Break free-response questions into guided steps"
          checked={stepMode}
          disabled={!hasFreeResponse}
          disabledHint="No free-response questions in bank"
          onChange={setStepMode}
        />
      </div>

      {/* ── Chapter filter for session ── */}
      {selectedMode && qCount > 0 && data.questions.some(q => q.chapterTag) && (
        <div style={{
          marginBottom: 16, padding: '12px 16px',
          background: 'var(--bg-card, var(--bg-secondary))',
          border: '1px solid var(--border-color)', borderRadius: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
            FILTER BY CHAPTER (optional — empty = all)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BUILT_IN_CHAPTERS.filter(ch => (loadedPerChapter[ch.id] ?? 0) > 0).map(ch => {
              const active = chapterFilter.includes(ch.id)
              return (
                <button
                  key={ch.id}
                  onClick={() => setChapterFilter(prev => active ? prev.filter(x=>x!==ch.id) : [...prev, ch.id])}
                  style={{
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${active ? '#F5A623' : 'var(--border-color)'}`,
                    background: active ? '#F5A62322' : 'transparent',
                    color: active ? '#F5A623' : 'var(--text-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {ch.label} <span style={{ fontSize: 10 }}>({loadedPerChapter[ch.id]})</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

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
          Manage Bank ({qCount})
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
                  {modeInfo?.label ?? s.mode} · {s.totalQuestions}Q
                  {s.pendingCount > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                      ({s.pendingCount} pending)
                    </span>
                  )}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(s.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ fontWeight: 700, color: scoreColor }}>
                    {s.gradedCount > 0 ? `${s.averageScore}%` : '—'}
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

// ── Small helper components ──────────────────────────────────────────────────

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

interface ToggleRowProps {
  label: string
  desc: string
  checked: boolean
  disabled: boolean
  disabledHint: string
  onChange: (v: boolean) => void
}

function ToggleRow({ label, desc, checked, disabled, disabledHint, onChange }: ToggleRowProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      opacity: disabled ? 0.45 : 1,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {disabled ? disabledHint : desc}
        </div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          flexShrink: 0,
          width: 40, height: 22,
          borderRadius: 999,
          border: 'none',
          background: checked && !disabled ? 'var(--accent-color, #F5A623)' : 'var(--border-color)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          padding: 0,
        }}
      >
        <span style={{
          display: 'block',
          width: 16, height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: checked && !disabled ? 21 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }} />
      </button>
    </div>
  )
}
