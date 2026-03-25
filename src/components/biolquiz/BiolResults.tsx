/**
 * BiolResults — Session summary with score breakdown, topic chart, per-answer accordion.
 */
import React, { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { BiolSession, BiolQuestion, BiolAnswer } from './types'
import { TOPIC_LABELS, TOPIC_COLORS } from './types'
import { formatDate } from '../course/courseHelpers'

interface Props {
  session: BiolSession
  questions: BiolQuestion[]
  onNewSession: () => void
}

const MODE_LABELS: Record<string, string> = {
  practice: 'Practice',
  timed: 'Timed Exam',
  'weak-topics': 'Weak Topics',
  'topic-drill': 'Topic Drill',
  'due-review': 'Due Review',
}

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

function getGrade(avg: number) {
  if (avg >= 90) return { label: 'Excellent!', color: '#22c55e' }
  if (avg >= 80) return { label: 'Great job!', color: '#22c55e' }
  if (avg >= 70) return { label: 'Good effort!', color: '#f59e0b' }
  if (avg >= 50) return { label: 'Keep practicing!', color: '#f97316' }
  return { label: "Don't give up!", color: '#ef4444' }
}

function ScorePill({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 12px', borderRadius: 8, minWidth: 64,
      background: highlight ? `${scoreColor(value)}22` : 'var(--bg-primary, #111)',
      border: `1px solid ${highlight ? scoreColor(value) : 'var(--border-color)'}`,
    }}>
      <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor(value), fontFamily: 'DM Mono, monospace' }}>
        {value}%
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</span>
    </div>
  )
}

function AnswerRow({ answer, question, index }: { answer: BiolAnswer; question: BiolQuestion | undefined; index: number }) {
  const [open, setOpen] = useState(false)
  const score = answer.score

  return (
    <div style={{
      border: '1px solid var(--border-color)', borderRadius: 10,
      marginBottom: 6, background: 'var(--bg-secondary)', overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 12px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: score >= 70 ? '#22c55e22' : score >= 50 ? '#f59e0b22' : '#ef444422',
          color: scoreColor(score),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>
          {index + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {question?.questionText ?? `Question ${index + 1}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {question ? TOPIC_LABELS[question.topic] : '—'} ·{' '}
            {answer.gradingStatus === 'pending' ? 'Pending'
              : answer.gradingStatus === 'skipped' ? 'Skipped'
              : `Score: ${score}%`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {answer.gradingStatus === 'graded' && (
            <span style={{ fontSize: 15, fontWeight: 700, color: scoreColor(score) }}>{score}%</span>
          )}
          {answer.gradingStatus === 'pending' && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b' }}>Pending</span>
          )}
          {answer.gradingStatus === 'skipped' && (
            <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: '#6b728022', color: '#9ca3af', border: '1px solid #6b7280' }}>Skipped</span>
          )}
          <span style={{ fontSize: 14, color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 12px 14px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Your Answer
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>
              {answer.userAnswer || '(no answer)'}
            </p>
          </div>
          {answer.feedback && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'var(--bg-primary, #111)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Feedback</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.55 }}>{answer.feedback}</p>
            </div>
          )}
          {question?.explanation && answer.gradingStatus === 'graded' && score < 100 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>Explanation</p>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>{question.explanation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BiolResults({ session, questions, onNewSession }: Props) {
  const qMap = useMemo(() => {
    const m = new Map<string, BiolQuestion>()
    for (const q of questions) m.set(q.id, q)
    return m
  }, [questions])

  const answers = useMemo(() => Object.values(session.answers), [session.answers])

  const stats = useMemo(() => {
    const graded  = answers.filter(a => a.gradingStatus === 'graded')
    const pending = answers.filter(a => a.gradingStatus === 'pending')
    const skipped = answers.filter(a => a.gradingStatus === 'skipped')
    const avgScore = graded.length > 0
      ? Math.round(graded.reduce((s, a) => s + a.score, 0) / graded.length)
      : 0
    return { graded: graded.length, pending: pending.length, skipped: skipped.length, avgScore }
  }, [answers])

  const topicChartData = useMemo(() => {
    const topicMap = new Map<string, { total: number; count: number }>()
    for (const a of answers) {
      if (a.gradingStatus !== 'graded') continue
      const q = qMap.get(a.questionId)
      if (!q) continue
      const existing = topicMap.get(q.topic) ?? { total: 0, count: 0 }
      topicMap.set(q.topic, { total: existing.total + a.score, count: existing.count + 1 })
    }
    return Array.from(topicMap.entries()).map(([topic, { total, count }]) => ({
      topic,
      label: TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] ?? topic,
      score: Math.round(total / count),
      color: TOPIC_COLORS[topic as keyof typeof TOPIC_COLORS] ?? '#F5A623',
    }))
  }, [answers, qMap])

  const grade = getGrade(stats.avgScore)
  const sessionDate = session.startedAt ? formatDate(session.startedAt) : ''
  const modeLabel = MODE_LABELS[session.mode] ?? session.mode

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      {/* ── Summary header ── */}
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
          {answers.length} questions
        </div>
      </div>

      {/* ── Status breakdown ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Graded', count: stats.graded, color: '#22c55e' },
          { label: 'Pending', count: stats.pending, color: '#f59e0b' },
          { label: 'Skipped', count: stats.skipped, color: '#6b7280' },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '12px 8px',
            background: 'var(--bg-secondary)', borderRadius: 10,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'DM Mono, monospace' }}>{s.count}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Score pills ── */}
      {stats.graded > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <ScorePill label="Average" value={stats.avgScore} highlight />
        </div>
      )}

      {/* ── Topic breakdown chart ── */}
      {topicChartData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Topic Scores
          </h4>
          <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '16px 8px 8px' }}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topicChartData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary, #1a1a1a)', border: '1px solid var(--border-color, #333)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary, #fff)' }}
                  formatter={((val: number) => [`${val}%`, 'Score']) as never}
                />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {topicChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Per-answer accordion ── */}
      <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        Answer Breakdown
      </h4>
      <div style={{ marginBottom: 20 }}>
        {answers.map((a, i) => (
          <AnswerRow
            key={a.questionId + i}
            answer={a}
            question={qMap.get(a.questionId)}
            index={i}
          />
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onNewSession} style={{
          flex: 1, padding: '12px 16px',
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
