/**
 * PhysicsStats — Full analytics dashboard for the Physics Practicum.
 * Sections: overview cards, confidence calibration, topic radar, error frequency,
 * score trend, activity heatmap, most-missed questions, storage indicator.
 */
import React, { useMemo, useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid, ReferenceLine,
} from 'recharts'
import type { PhysicsCourseData, PhysicsTopic } from './types'
import {
  TOPIC_LABELS,
  ERROR_LABELS,
  ERROR_COLORS,
  type PhysicsErrorCategory,
} from './types'

interface Props {
  courseData: PhysicsCourseData
  onBack: () => void
  onPracticeNow?: (questionId: string) => void
}

// ─── helpers ───────────────────────────────────────────────────────────────

function sectionHead(label: string) {
  return (
    <h3 style={{
      fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: 0.5,
      margin: '0 0 12px',
    }}>
      {label}
    </h3>
  )
}

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 12,
      border: '1px solid var(--border-color)', padding: '16px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function statVal(value: string | number, color?: string) {
  return (
    <div style={{
      fontSize: 28, fontWeight: 700,
      fontFamily: 'DM Mono, monospace',
      color: color ?? 'var(--text-primary)',
      lineHeight: 1,
    }}>
      {value}
    </div>
  )
}

// Rolling average helper
function rollingAvg(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1)
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length)
  })
}

// ─── Activity heatmap ──────────────────────────────────────────────────────

interface HeatmapCell {
  date: string      // YYYY-MM-DD
  count: number
  week: number
  day: number       // 0=Sun
}

function buildHeatmap(sessionHistory: PhysicsCourseData['sessionHistory']): HeatmapCell[] {
  const countMap = new Map<string, number>()
  for (const s of sessionHistory) {
    if (s.date) countMap.set(s.date, (countMap.get(s.date) ?? 0) + 1)
  }

  const cells: HeatmapCell[] = []
  const today = new Date()
  // Start 52 weeks ago, aligned to Sunday
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

function getMonthLabels(cells: HeatmapCell[]): { label: string; week: number }[] {
  const seen = new Set<string>()
  const out: { label: string; week: number }[] = []
  for (const c of cells) {
    if (c.day !== 0) continue
    const d = new Date(c.date)
    const key = `${d.getFullYear()}-${d.getMonth()}`
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ label: d.toLocaleString('default', { month: 'short' }), week: c.week })
    }
  }
  return out
}

function ActivityHeatmap({ sessionHistory }: { sessionHistory: PhysicsCourseData['sessionHistory'] }) {
  const cells = useMemo(() => buildHeatmap(sessionHistory), [sessionHistory])
  const monthLabels = useMemo(() => getMonthLabels(cells), [cells])
  const [tooltip, setTooltip] = useState<{ date: string; count: number; x: number; y: number } | null>(null)

  const CELL = 12
  const GAP = 2
  const step = CELL + GAP

  return (
    <div style={{ overflowX: 'auto', position: 'relative' }}>
      <svg
        width={52 * step}
        height={7 * step + 20}
        style={{ display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text key={i} x={m.week * step} y={12} fontSize={9} fill="var(--text-muted, #9ca3af)">
            {m.label}
          </text>
        ))}
        {/* Cells */}
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.week * step}
            y={20 + c.day * step}
            width={CELL}
            height={CELL}
            rx={2}
            ry={2}
            fill={cellColor(c.count)}
            stroke={c.count === 0 ? 'var(--border-color, #333)' : 'none'}
            strokeWidth={0.5}
            style={{ cursor: c.count > 0 ? 'pointer' : 'default' }}
            onMouseEnter={(e) => {
              const rect = (e.target as SVGRectElement).getBoundingClientRect()
              setTooltip({ date: c.date, count: c.count, x: rect.left, y: rect.top })
            }}
          />
        ))}
      </svg>
      {tooltip && tooltip.count > 0 && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 16,
          top: tooltip.y - 8,
          background: 'var(--bg-secondary, #1a1a1a)',
          border: '1px solid var(--border-color, #333)',
          borderRadius: 6,
          padding: '4px 10px',
          fontSize: 11,
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 9999,
          whiteSpace: 'nowrap',
        }}>
          {tooltip.date} · {tooltip.count} session{tooltip.count !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function PhysicsStats({ courseData, onBack, onPracticeNow }: Props) {
  const { questions, sessionHistory, currentStreak } = courseData

  // ── Overview cards ──────────────────────────────────────────────────────
  const overview = useMemo(() => {
    const totalSessions = sessionHistory.length
    const allGradedScores: number[] = []
    for (const s of sessionHistory) {
      if (typeof s.averageScore === 'number' && s.gradedCount > 0) {
        for (let i = 0; i < s.gradedCount; i++) allGradedScores.push(s.averageScore)
      }
    }
    const overallAvg = allGradedScores.length > 0
      ? Math.round(allGradedScores.reduce((a, b) => a + b, 0) / allGradedScores.length)
      : 0
    return { totalSessions, overallAvg, totalQuestions: questions.length }
  }, [sessionHistory, questions])

  // ── Confidence calibration ──────────────────────────────────────────────
  const calibration = useMemo(() => {
    const agg = {
      'not-sure': { correct: 0, total: 0 },
      'pretty-sure': { correct: 0, total: 0 },
      confident: { correct: 0, total: 0 },
    }
    for (const s of sessionHistory) {
      const cc = s.confidenceCalibration
      if (!cc) continue
      agg['not-sure'].correct += cc.notSure.correct
      agg['not-sure'].total += cc.notSure.total
      agg['pretty-sure'].correct += cc.prettySure.correct
      agg['pretty-sure'].total += cc.prettySure.total
      agg.confident.correct += cc.confident.correct
      agg.confident.total += cc.confident.total
    }
    const pct = (c: { correct: number; total: number }) =>
      c.total > 0 ? Math.round((c.correct / c.total) * 100) : 0

    const confidentTotal = agg.confident.total
    const confidentWrong = confidentTotal - agg.confident.correct
    const confidentWrongRate = confidentTotal > 0 ? Math.round((confidentWrong / confidentTotal) * 100) : 0

    return {
      bars: [
        { label: 'Not Sure', pct: pct(agg['not-sure']), color: '#9ca3af' },
        { label: 'Pretty Sure', pct: pct(agg['pretty-sure']), color: '#f59e0b' },
        { label: 'Confident', pct: pct(agg.confident), color: '#22c55e' },
      ],
      confidentWrongRate,
    }
  }, [sessionHistory])

  // ── Topic radar ─────────────────────────────────────────────────────────
  const radarData = useMemo(() => {
    const allTime = new Map<string, { total: number; count: number }>()
    const last30 = new Map<string, { total: number; count: number }>()
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    for (const s of sessionHistory) {
      const isRecent = s.date >= cutoffStr
      for (const [topic, data] of Object.entries(s.topicBreakdown ?? {})) {
        const cur = allTime.get(topic) ?? { total: 0, count: 0 }
        allTime.set(topic, { total: cur.total + data.averageScore * data.attempted, count: cur.count + data.attempted })
        if (isRecent) {
          const cur2 = last30.get(topic) ?? { total: 0, count: 0 }
          last30.set(topic, { total: cur2.total + data.averageScore * data.attempted, count: cur2.count + data.attempted })
        }
      }
    }

    const topics = Array.from(allTime.keys())
    return topics.map(t => ({
      topic: TOPIC_LABELS[t as PhysicsTopic] ?? t,
      allTime: allTime.has(t) ? Math.round(allTime.get(t)!.total / allTime.get(t)!.count) : 0,
      last30: last30.has(t) ? Math.round(last30.get(t)!.total / last30.get(t)!.count) : 0,
    }))
  }, [sessionHistory])

  // ── Error frequency ─────────────────────────────────────────────────────
  const errorData = useMemo(() => {
    const agg = new Map<string, number>()
    for (const s of sessionHistory) {
      for (const [cat, count] of Object.entries(s.errorCategories ?? {})) {
        agg.set(cat, (agg.get(cat) ?? 0) + count)
      }
    }
    return Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([cat, count]) => ({
        cat,
        label: ERROR_LABELS[cat as PhysicsErrorCategory] ?? cat,
        count,
        color: ERROR_COLORS[cat as PhysicsErrorCategory] ?? '#F5A623',
      }))
  }, [sessionHistory])

  // ── Score trend ─────────────────────────────────────────────────────────
  const trendData = useMemo(() => {
    const scores = sessionHistory
      .filter(s => s.gradedCount > 0)
      .map(s => s.averageScore)
    const rolling = rollingAvg(scores, 7)
    return rolling.map((avg, i) => ({ session: i + 1, avg }))
  }, [sessionHistory])

  // ── Most missed ─────────────────────────────────────────────────────────
  const mostMissed = useMemo(() => {
    return [...questions]
      .filter(q => (q.wrongCount ?? 0) > 0)
      .sort((a, b) => (b.wrongCount ?? 0) - (a.wrongCount ?? 0))
      .slice(0, 10)
  }, [questions])

  // ── Storage indicator ────────────────────────────────────────────────────
  const storageMB = useMemo(() => {
    try {
      const used = Object.keys(localStorage).reduce(
        (sum, k) => sum + new Blob([localStorage.getItem(k) ?? '']).size,
        0,
      )
      return parseFloat((used / (1024 * 1024)).toFixed(1))
    } catch {
      return 0
    }
  }, [])

  const AMBER = '#F5A623'
  const noData = sessionHistory.length === 0

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Back */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', color: AMBER,
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', padding: 0,
        }}>
          ← Back
        </button>
      </div>

      <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 700, margin: '0 0 20px', color: 'var(--text-primary)' }}>
        Analytics
      </h2>

      {/* ── Section 1: Overview cards ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Sessions', value: overview.totalSessions, color: AMBER },
          { label: 'Overall Avg', value: noData ? '—' : `${overview.overallAvg}%`, color: overview.overallAvg >= 70 ? '#22c55e' : '#f59e0b' },
          { label: 'Current Streak', value: `${currentStreak}d`, color: '#3b82f6' },
          { label: 'Questions', value: overview.totalQuestions, color: 'var(--text-primary)' },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-secondary)', borderRadius: 12,
            border: '1px solid var(--border-color)', padding: '14px 12px',
            textAlign: 'center',
          }}>
            {statVal(c.value, c.color)}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* ── Confidence calibration ───────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        {sectionHead('Confidence Calibration')}
        {card(
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 90 }}>
              {calibration.bars.map(b => (
                <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{b.pct}%</div>
                  <div style={{
                    width: '100%', background: `${b.color}33`,
                    borderRadius: '4px 4px 0 0',
                    height: `${Math.max(4, b.pct * 0.6)}px`,
                    border: `1px solid ${b.color}`,
                  }} />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{b.label}</div>
                </div>
              ))}
            </div>
            {calibration.confidentWrongRate > 20 && (
              <div style={{
                marginTop: 10, padding: '6px 10px',
                background: '#ef444422', border: '1px solid #ef4444',
                borderRadius: 8, fontSize: 12, color: '#ef4444', fontWeight: 600,
              }}>
                Confident + Wrong rate: {calibration.confidentWrongRate}% — Review your confident answers carefully
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Section 2: Topic Radar ───────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        {sectionHead('Topic Accuracy')}
        {card(
          noData || radarData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              No data yet — complete a session to see topic accuracy.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', marginBottom: 4 }}>
                <LegendDot color={AMBER} label="All Time" />
                <LegendDot color="#3b82f6" label="Last 30 Days" />
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                  <PolarGrid stroke="var(--border-color, #333)" />
                  <PolarAngleAxis dataKey="topic" tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'var(--text-muted, #9ca3af)' }} tickCount={5} />
                  <Radar name="All Time" dataKey="allTime" stroke={AMBER} fill={AMBER} fillOpacity={0.25} />
                  <Radar name="Last 30 Days" dataKey="last30" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.20} />
                </RadarChart>
              </ResponsiveContainer>
            </>
          )
        )}
      </div>

      {/* ── Section 3: Error Frequency ───────────────────────────── */}
      {errorData.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Top Error Categories')}
          {card(
            <ResponsiveContainer width="100%" height={errorData.length * 32 + 20}>
              <BarChart
                data={errorData}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--text-muted, #9ca3af)' }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-secondary, #1a1a1a)',
                    border: '1px solid var(--border-color, #333)',
                    borderRadius: 8, fontSize: 12, color: 'var(--text-primary, #fff)',
                  }}
                  formatter={((val: number) => [val, 'Occurrences']) as never}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {errorData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Section 4: Score Trend ───────────────────────────────── */}
      {trendData.length >= 2 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Score Trend (7-Session Rolling Avg)')}
          {card(
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #333)" />
                <XAxis
                  dataKey="session"
                  tick={{ fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Session', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: 'var(--text-muted, #9ca3af)' }}
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
                    borderRadius: 8, fontSize: 12, color: 'var(--text-primary, #fff)',
                  }}
                  formatter={((val: number) => [`${val}%`, 'Avg Score']) as never}
                />
                <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 3" label={{ value: 'Target', position: 'right', fontSize: 10, fill: '#ef4444' }} />
                <Line type="monotone" dataKey="avg" stroke={AMBER} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Section 5: Activity Heatmap ──────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        {sectionHead('Activity Heatmap')}
        {card(
          sessionHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 14 }}>
              No sessions yet.
            </div>
          ) : (
            <ActivityHeatmap sessionHistory={sessionHistory} />
          )
        )}
      </div>

      {/* ── Section 6: Most Missed Questions ─────────────────────── */}
      {mostMissed.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {sectionHead('Most Missed Questions')}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {mostMissed.map(q => (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: 'var(--bg-secondary)', borderRadius: 10,
                border: '1px solid var(--border-color)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {q.questionText}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: `${AMBER}22`, color: AMBER, border: `1px solid ${AMBER}`,
                  flexShrink: 0,
                }}>
                  {TOPIC_LABELS[q.topic]}
                </span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 6,
                  background: '#ef444422', color: '#ef4444', border: '1px solid #ef4444',
                  flexShrink: 0,
                }}>
                  {q.wrongCount}x wrong
                </span>
                {onPracticeNow && (
                  <button
                    onClick={() => onPracticeNow(q.id)}
                    style={{
                      fontSize: 11, padding: '4px 10px',
                      background: AMBER, color: '#000', border: 'none',
                      borderRadius: 6, cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    Practice Now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Storage indicator ─────────────────────────────────────── */}
      <div style={{ marginTop: 8, marginBottom: 24 }}>
        {storageMB > 4 && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 8,
            background: `${AMBER}22`, border: `1px solid ${AMBER}`,
            fontSize: 12, color: AMBER, fontWeight: 600,
          }}>
            Storage is almost full — consider exporting or deleting old sessions.
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right' }}>
          Storage: ~{storageMB} MB / ~5 MB limit
        </div>
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}
