/**
 * BiolMenu — Start screen for the BIOL 3020 Exam 2 Practicum.
 * Shows mode cards, topic picker, exam filter, streak, and action buttons.
 */
import React, { useState } from 'react'
import { Play, Clock, AlertTriangle, Target, Repeat, BarChart3, Plus, Map, Sparkles } from 'lucide-react'
import type { BiolCourseData, BiolSessionMode, BiolTopic } from './types'
import { TOPIC_LABELS, todayDateStr } from './types'

interface StartOptions {
  topicFilter?: BiolTopic
  examFilter?: 'exam1' | 'exam2' | 'exam3' | 'all'
}

interface Props {
  data: BiolCourseData
  onStart: (mode: BiolSessionMode, options: StartOptions) => void
  onManage: () => void
  onStats: () => void
  onMindMap: () => void
}

interface ModeCard {
  mode: BiolSessionMode
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
    mode: 'due-review',
    icon: <Repeat size={22} />,
    label: 'Due for Review',
    desc: 'Spaced-repetition cards due today',
    color: '#8b5cf6',
  },
]

const TOPICS_ORDERED: BiolTopic[] = [
  'genomes', 'chromatin-chromosomes', 'bioinformatics',
  'dna-replication', 'dna-repair', 'nucleus', 'other',
]

const EXAM_FILTERS = [
  { value: 'all', label: 'All Exams' },
  { value: 'exam1', label: 'Exam 1' },
  { value: 'exam2', label: 'Exam 2' },
  { value: 'exam3', label: 'Exam 3' },
] as const

export default function BiolMenu({ data, onStart, onManage, onStats, onMindMap }: Props) {
  const [selectedMode, setSelectedMode] = useState<BiolSessionMode | null>(null)
  const [topicFilter, setTopicFilter]   = useState<BiolTopic>('genomes')
  const [examFilter, setExamFilter]     = useState<'exam1' | 'exam2' | 'exam3' | 'all'>('all')

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

  function handleStart() {
    if (!selectedMode) return
    if (qCount === 0) return
    onStart(selectedMode, {
      topicFilter: selectedMode === 'topic-drill' ? topicFilter : undefined,
      examFilter,
    })
  }

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', paddingBottom: 32 }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>
          🧬 BIOL 3020 Exam 2 Practicum
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
          marginBottom: 16,
          padding: '14px 16px',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
          border: '1px solid #3b82f6',
          borderRadius: 14,
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          color: '#93c5fd',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: 0.3,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.3)'
          e.currentTarget.style.borderColor = '#60a5fa'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = ''
          e.currentTarget.style.borderColor = '#3b82f6'
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
            onChange={e => setTopicFilter(e.target.value as BiolTopic)}
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
