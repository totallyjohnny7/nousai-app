/**
 * PhysicsResults — Session summary with score breakdown, topic chart, and per-answer accordion.
 */
import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { PhysicsSession, PhysicsQuestion, PhysicsAnswer } from './types'
import {
  TOPIC_LABELS,
  ERROR_LABELS,
  ERROR_COLORS,
  type PhysicsTopic,
} from './types'
import type { Course } from '../../types'

interface Props {
  session: PhysicsSession
  questions: PhysicsQuestion[]
  course: Course
  onNewSession: () => void
  onReviewMistakes: () => void
}

const MODE_LABELS: Record<string, string> = {
  practice: 'Practice',
  timed: 'Timed Exam',
  'weak-topics': 'Weak Topics',
  'topic-drill': 'Topic Drill',
  'due-review': 'Due Review',
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem > 0 ? `${rem}s` : ''}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

interface AnswerRowProps {
  answer: PhysicsAnswer
  question: PhysicsQuestion | undefined
  index: number
  onRetry?: (answerId: string) => void
}

function AnswerAccordionRow({ answer, question, index }: AnswerRowProps) {
  const [open, setOpen] = useState(false)

  const combined = answer.combinedScore
  const hasDiagram = answer.diagramScore !== undefined

  const confidenceStyle = (): React.CSSProperties => {
    if (!answer.confidence) return { background: '#6b728022', color: '#9ca3af', border: '1px solid #6b7280' }
    const isCorrect = answer.confidenceCorrect === true
    if (isCorrect) return { background: '#22c55e22', color: '#22c55e', border: '1px solid #22c55e' }
    return { background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444' }
  }

  const confidenceLabel = (): string => {
    if (!answer.confidence) return 'Not rated'
    const map: Record<string, string> = { 'not-sure': 'Not Sure', 'pretty-sure': 'Pretty Sure', confident: 'Confident' }
    return map[answer.confidence] ?? answer.confidence
  }

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 10,
      marginBottom: 6,
      background: 'var(--bg-secondary)',
      overflow: 'hidden',
    }}>
      {/* Header row — always visible */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%',
          background: combined >= 70 ? '#22c55e22' : combined >= 50 ? '#f59e0b22' : '#ef444422',
          color: scoreColor(combined),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            color: 'var(--text-primary)',
          }}>
            {question?.questionText ?? `Question ${index + 1}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {TOPIC_LABELS[question?.topic as PhysicsTopic] ?? 'Unknown'} ·{' '}
            {answer.gradingStatus === 'pending' ? 'Pending' :
              answer.gradingStatus === 'failed' ? 'Failed' :
                `Score: ${combined}%`}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {answer.gradingStatus === 'pending' && (
            <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 6,
              background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b',
            }}>Pending</span>
          )}
          {answer.gradingStatus === 'failed' && (
            <span style={{
              fontSize: 11, padding: '2px 7px', borderRadius: 6,
              background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444',
            }}>Failed</span>
          )}
          {answer.gradingStatus === 'graded' && (
            <span style={{
              fontSize: 15, fontWeight: 700, color: scoreColor(combined),
            }}>{combined}%</span>
          )}
          <span style={{ fontSize: 14, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border-color)' }}>
          {/* Score breakdown */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <ScorePill label="Answer" value={answer.answerScore} />
            {hasDiagram && <ScorePill label="Diagram" value={answer.diagramScore!} />}
            <ScorePill label="Combined" value={combined} highlight />
          </div>

          {/* Confidence + grading status badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 6,
              ...confidenceStyle(),
            }}>
              {confidenceLabel()}
            </span>
            {answer.gradingStatus === 'failed' && (
              <button style={{
                fontSize: 11, padding: '2px 10px', borderRadius: 6,
                background: '#ef4444', color: '#fff', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>
                Retry Grading
              </button>
            )}
          </div>

          {/* Error category pills */}
          {answer.errorCategories.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Error Categories
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {answer.errorCategories.map(cat => (
                  <span key={cat} style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 6,
                    background: `${ERROR_COLORS[cat]}22`,
                    color: ERROR_COLORS[cat],
                    border: `1px solid ${ERROR_COLORS[cat]}`,
                  }}>
                    {ERROR_LABELS[cat]}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* What to Fix */}
          {answer.whatToFix && answer.whatToFix.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                What to Fix
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {answer.whatToFix.map((item, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Missing prerequisites */}
          {answer.missingPrerequisites && answer.missingPrerequisites.length > 0 && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: '#f97316' + '18', border: '1px solid #f97316',
              borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f97316', marginBottom: 4 }}>
                Missing Prerequisites
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                {answer.missingPrerequisites.join(' · ')}
              </div>
            </div>
          )}

          {/* AI feedback */}
          {answer.aiFeedback && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: 'var(--bg-primary, #111)', borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                AI Feedback
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
                {answer.aiFeedback}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ScorePill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 12px', borderRadius: 8,
      background: highlight ? `${scoreColor(value)}22` : 'var(--bg-primary, #111)',
      border: `1px solid ${highlight ? scoreColor(value) : 'var(--border-color)'}`,
      minWidth: 64,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(value), fontFamily: 'DM Mono, monospace' }}>{value}%</span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</span>
    </div>
  )
}

export default function PhysicsResults({ session, questions, onNewSession, onReviewMistakes }: Props) {
  const qMap = useMemo(() => {
    const m = new Map<string, PhysicsQuestion>()
    for (const q of questions) m.set(q.id, q)
    return m
  }, [questions])

  const stats = useMemo(() => {
    const answers = session.answers
    const graded = answers.filter(a => a.gradingStatus === 'graded')
    const pending = answers.filter(a => a.gradingStatus === 'pending')
    const failed = answers.filter(a => a.gradingStatus === 'failed')
    const avgScore = graded.length > 0
      ? Math.round(graded.reduce((s, a) => s + a.combinedScore, 0) / graded.length)
      : 0
    const totalMs = answers.reduce((s, a) => s + a.timeMs, 0)
    return { graded: graded.length, pending: pending.length, failed: failed.length, avgScore, totalMs }
  }, [session.answers])

  const topicChartData = useMemo(() => {
    const topicMap = new Map<string, { total: number; count: number }>()
    for (const a of session.answers) {
      if (a.gradingStatus !== 'graded') continue
      const q = qMap.get(a.questionId)
      if (!q) continue
      const key = q.topic
      const existing = topicMap.get(key) ?? { total: 0, count: 0 }
      topicMap.set(key, { total: existing.total + a.combinedScore, count: existing.count + 1 })
    }
    return Array.from(topicMap.entries()).map(([topic, { total, count }]) => ({
      topic,
      label: TOPIC_LABELS[topic as PhysicsTopic] ?? topic,
      score: Math.round(total / count),
    }))
  }, [session.answers, qMap])

  const hasMistakes = session.answers.some(a => a.gradingStatus === 'graded' && a.combinedScore < 70)

  const sessionDate = session.startedAt ? formatDate(session.startedAt) : ''
  const modeLabel = MODE_LABELS[session.mode] ?? session.mode

  const getGrade = (avg: number) => {
    if (avg >= 90) return { label: 'Excellent!', color: '#22c55e' }
    if (avg >= 80) return { label: 'Great job!', color: '#22c55e' }
    if (avg >= 70) return { label: 'Good effort!', color: '#f59e0b' }
    if (avg >= 50) return { label: 'Keep practicing!', color: '#f97316' }
    return { label: "Don't give up!", color: '#ef4444' }
  }

  const grade = getGrade(stats.avgScore)

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>

      {/* ── Summary header ─────────────────────────────────────────── */}
      <div style={{
        textAlign: 'center', padding: '28px 20px',
        background: 'var(--bg-secondary)', borderRadius: 16,
        border: `2px solid ${grade.color}`, marginBottom: 20,
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, letterSpacing: 0.4 }}>
          {modeLabel} · {sessionDate}
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: grade.color, marginBottom: 4, fontFamily: 'DM Mono, monospace' }}>
          {stats.graded > 0 ? `${stats.avgScore}%` : '—'}
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {grade.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {session.answers.length} questions · {formatDuration(stats.totalMs)}
        </div>
      </div>

      {/* ── Status breakdown ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Graded', count: stats.graded, color: '#22c55e', badge: null },
          { label: 'Pending', count: stats.pending, color: '#f59e0b', badge: 'pending' },
          { label: 'Failed', count: stats.failed, color: '#ef4444', badge: 'failed' },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '12px 8px',
            background: 'var(--bg-secondary)', borderRadius: 10,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.count}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
            {s.badge === 'failed' && s.count > 0 && (
              <button style={{
                marginTop: 6, fontSize: 11, padding: '3px 10px',
                background: '#ef4444', color: '#fff', border: 'none',
                borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
              }}>
                Retry All
              </button>
            )}
          </div>
        ))}
      </div>

      {/* ── Topic breakdown chart ─────────────────────────────────── */}
      {topicChartData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
            margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Topic Scores
          </h4>
          <div style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border-color)', padding: '16px 8px 8px',
          }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topicChartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary, #1a1a1a)',
                    border: '1px solid var(--border-color, #333)',
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--text-primary, #fff)',
                  }}
                  formatter={((val: number) => [`${val}%`, 'Score']) as never}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {topicChartData.map((_, i) => (
                    <Cell key={i} fill="#F5A623" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Per-answer accordion ──────────────────────────────────── */}
      <h4 style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
        margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        Answer Breakdown
      </h4>
      <div style={{ marginBottom: 20 }}>
        {session.answers.map((a, i) => (
          <AnswerAccordionRow
            key={a.questionId + i}
            answer={a}
            question={qMap.get(a.questionId)}
            index={i}
          />
        ))}
      </div>

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {hasMistakes && (
          <button onClick={onReviewMistakes} style={{
            flex: 1, minWidth: 140, padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', borderRadius: 10,
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Review Mistakes
          </button>
        )}
        <button onClick={onNewSession} style={{
          flex: 1, minWidth: 140, padding: '12px 16px',
          background: '#F5A623', border: 'none', borderRadius: 10,
          color: '#000', fontSize: 14, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          New Session
        </button>
      </div>
    </div>
  )
}
