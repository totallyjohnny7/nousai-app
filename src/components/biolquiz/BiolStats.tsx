/**
 * BiolStats — Analytics dashboard for the BIOL 3020 Practicum.
 * Sections: overview cards, topic accuracy heatmap, score trend, activity heatmap, streak.
 */
import React, { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { BiolCourseData } from './types'
import { TOPIC_LABELS, TOPIC_COLORS } from './types'

interface Props {
  courseData: BiolCourseData
  onBack: () => void
}

const AMBER = '#F5A623'

function sectionHead(label: string) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 12px',
    }}>
      {label}
    </h3>
  )
}

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12,
      border: '1px solid var(--border-color)', padding: 16, ...style,
    }}>
      {children}
    </div>
  )
}

// ─── Activity heatmap ──────────────────────────────────────────────────────

interface HeatCell { date: string; count: number; week: number; day: number }

function buildHeatmap(history: BiolCourseData['sessionHistory']): HeatCell[] {
  const countMap = new Map<string, number>()
  for (const s of history) {
    if (s.date) countMap.set(s.date, (countMap.get(s.date) ?? 0) + 1)
  }
  const cells: HeatCell[] = []
  const today = new Date()
  const start = new Date(today)
  start.setDate(start.getDate() - 7 * 51 - start.getDay())
  for (let week = 0; week < 52; week++) {
    for (let day = 0; day < 7; day++) {
      const d = new Date(start)
      d.setDate(start.getDate() + week * 7 + day)
      const dateStr = d.toISOString().split('T')[0]
      cells.push({ date: dateStr, count: countMap.get(dateStr) ?? 0, week, day })
    }
  }
  return cells
}

function cellColor(count: number): string {
  if (count === 0) return 'transparent'
  if (count === 1) return 'rgba(245,166,35,0.20)'
  if (count <= 3) return 'rgba(245,166,35,0.50)'
  return 'rgba(245,166,35,1.00)'
}

function ActivityHeatmap({ history }: { history: BiolCourseData['sessionHistory'] }) {
  const cells = useMemo(() => buildHeatmap(history), [history])
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)
  const CELL = 12, GAP = 2, step = CELL + GAP

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg width={52 * step} height={7 * step + 20} style={{ display: 'block' }} onMouseLeave={() => setTooltip(null)}>
        {cells.map((c, i) => (
          <rect
            key={i} x={c.week * step} y={20 + c.day * step}
            width={CELL} height={CELL} rx={2} ry={2}
            fill={cellColor(c.count)}
            stroke={c.count === 0 ? 'var(--border-color, #333)' : 'none'} strokeWidth={0.5}
            style={{ cursor: c.count > 0 ? 'pointer' : 'default' }}
            onMouseEnter={e => {
              const rect = (e.target as SVGRectElement).getBoundingClientRect()
              setTooltip({ date: c.date, count: c.count, x: rect.left, y: rect.top })
            }}
          />
        ))}
      </svg>
      {tooltip && tooltip.count > 0 && (
        <div style={{
          position: 'fixed', left: tooltip.x + 16, top: tooltip.y - 8,
          background: 'var(--bg-secondary, #1a1a1a)', border: '1px solid var(--border-color, #333)',
          borderRadius: 6, padding: '4px 10px', fontSize: 11,
          color: 'var(--text-primary)', pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
        }}>
          {tooltip.date} · {tooltip.count} session{tooltip.count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ─── Topic accuracy heatmap ────────────────────────────────────────────────

function TopicHeatmap({ history }: { history: BiolCourseData['sessionHistory'] }) {
  const topicScores = useMemo(() => {
    const acc = new Map<string, { total: number; count: number }>()
    for (const s of history) {
      for (const [topic, data] of Object.entries(s.topicBreakdown ?? {})) {
        const cur = acc.get(topic) ?? { total: 0, count: 0 }
        acc.set(topic, { total: cur.total + data.avgScore * data.count, count: cur.count + data.count })
      }
    }
    return Array.from(acc.entries()).map(([topic, { total, count }]) => ({
      topic,
      label: TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] ?? topic,
      score: Math.round(total / count),
      color: TOPIC_COLORS[topic as keyof typeof TOPIC_COLORS] ?? AMBER,
    }))
  }, [history])

  if (topicScores.length === 0) {
    return <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>No data yet — complete a session.</div>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
      {topicScores.map(t => {
        const intensity = t.score / 100
        return (
          <div key={t.topic} style={{
            padding: '12px 10px', borderRadius: 10, textAlign: 'center',
            background: `${t.color}${Math.round(intensity * 40 + 10).toString(16).padStart(2, '0')}`,
            border: `1px solid ${t.color}`,
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: t.color, fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>
              {t.score}%
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.3 }}>{t.label}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function BiolStats({ courseData, onBack }: Props) {
  const { questions, sessionHistory, currentStreak } = courseData
  const noData = sessionHistory.length === 0

  const overview = useMemo(() => {
    const totalSessions = sessionHistory.length
    const allScores = sessionHistory.filter(s => s.averageScore > 0).map(s => s.averageScore)
    const overallAvg = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0
    return { totalSessions, overallAvg, totalQuestions: questions.length }
  }, [sessionHistory, questions])

  const trendData = useMemo(() => {
    const scores = sessionHistory.filter(s => s.averageScore > 0).map(s => s.averageScore)
    // rolling 5-session average
    return scores.map((_, i) => {
      const slice = scores.slice(Math.max(0, i - 4), i + 1)
      return { session: i + 1, avg: Math.round(slice.reduce((a, b) => a + b, 0) / slice.length) }
    })
  }, [sessionHistory])

  const topicBarData = useMemo(() => {
    const acc = new Map<string, { total: number; count: number }>()
    for (const s of sessionHistory) {
      for (const [topic, data] of Object.entries(s.topicBreakdown ?? {})) {
        const cur = acc.get(topic) ?? { total: 0, count: 0 }
        acc.set(topic, { total: cur.total + data.avgScore * data.count, count: cur.count + data.count })
      }
    }
    return Array.from(acc.entries()).map(([topic, { total, count }]) => ({
      topic,
      label: TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] ?? topic,
      score: Math.round(total / count),
      color: TOPIC_COLORS[topic as keyof typeof TOPIC_COLORS] ?? AMBER,
    })).sort((a, b) => a.score - b.score)
  }, [sessionHistory])

  const mostMissed = useMemo(() => {
    return [...questions]
      .filter(q => (q.wrongCount ?? 0) > 0)
      .sort((a, b) => (b.wrongCount ?? 0) - (a.wrongCount ?? 0))
      .slice(0, 10)
  }, [questions])

  const storageMB = useMemo(() => {
    try {
      const used = Object.keys(localStorage).reduce((sum, k) => sum + new Blob([localStorage.getItem(k) ?? '']).size, 0)
      return parseFloat((used / (1024 * 1024)).toFixed(1))
    } catch { return 0 }
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Back */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: AMBER, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
          ← Back
        </button>
      </div>

      <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-primary)' }}>
        Analytics
      </h2>

      {/* ── Overview cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Sessions', value: overview.totalSessions, color: AMBER },
          { label: 'Overall Avg', value: noData ? '—' : `${overview.overallAvg}%`, color: overview.overallAvg >= 70 ? '#22c55e' : '#f59e0b' },
          { label: 'Streak', value: `${currentStreak}d`, color: '#3b82f6' },
          { label: 'Questions', value: overview.totalQuestions, color: 'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border-color)', padding: '14px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'DM Mono, monospace', color: c.color, lineHeight: 1 }}>
              {c.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Topic accuracy heatmap ── */}
      <div style={{ marginBottom: 20 }}>
        {sectionHead('Topic Accuracy')}
        {card(<TopicHeatmap history={sessionHistory} />)}
      </div>

      {/* ── Topic bar chart ── */}
      {topicBarData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Topic Score Breakdown')}
          {card(
            <ResponsiveContainer width="100%" height={topicBarData.length * 36 + 20}>
              <BarChart data={topicBarData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} width={130} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary, #1a1a1a)', border: '1px solid var(--border-color, #333)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary, #fff)' }}
                  formatter={((val: number) => [`${val}%`, 'Avg Score']) as never}
                />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {topicBarData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Score trend ── */}
      {trendData.length >= 2 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Score Trend (5-Session Rolling Avg)')}
          {card(
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #333)" />
                <XAxis dataKey="session" tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-secondary, #1a1a1a)', border: '1px solid var(--border-color, #333)', borderRadius: 8, fontSize: 12, color: 'var(--text-primary, #fff)' }}
                  formatter={((val: number) => [`${val}%`, 'Avg Score']) as never}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="avg" stroke={AMBER} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Activity heatmap ── */}
      <div style={{ marginBottom: 20 }}>
        {sectionHead('Activity Heatmap')}
        {card(
          noData ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>No sessions yet.</div>
          ) : (
            <ActivityHeatmap history={sessionHistory} />
          )
        )}
      </div>

      {/* ── Most missed ── */}
      {mostMissed.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Most Missed Questions')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mostMissed.map(q => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.questionText}
                  </div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${AMBER}22`, color: AMBER, border: `1px solid ${AMBER}`, flexShrink: 0 }}>
                  {TOPIC_LABELS[q.topic]}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444', flexShrink: 0 }}>
                  {q.wrongCount}x wrong
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Storage indicator ── */}
      <div style={{ marginTop: 8, marginBottom: 24 }}>
        {storageMB > 4 && (
          <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 8, background: `${AMBER}22`, border: `1px solid ${AMBER}`, fontSize: 12, color: AMBER, fontWeight: 600 }}>
            Storage is almost full — consider clearing old sessions.
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
          Storage: ~{storageMB} MB / ~5 MB limit
        </div>
      </div>
    </div>
  )
}
