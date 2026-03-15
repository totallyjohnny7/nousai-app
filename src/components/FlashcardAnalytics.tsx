import { useMemo, useRef, useEffect, useState } from 'react'
import { TrendingDown, Calendar, Zap, AlertTriangle, BarChart2, Filter } from 'lucide-react'
import type { Course } from '../types'
import type { FSRSCard } from '../utils/fsrs'
import { retrievability } from '../utils/fsrs'
import { TooltipPopup, useTip } from './Tooltip'

interface Props {
  fsrsMap: Record<string, FSRSCard>
  courses: Course[]
}

// ── Container width hook ─────────────────────────────────────────────────────

function useContainerWidth(fallback = 320) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w > 0) setWidth(w)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

// ── Time frame config ────────────────────────────────────────────────────────

const TIMEFRAMES = [
  { label: '1D',  days: 1 },
  { label: '3D',  days: 3 },
  { label: '1W',  days: 7 },
  { label: '1M',  days: 30 },
  { label: '2M',  days: 60 },
  { label: '6M',  days: 180 },
  { label: '1Y',  days: 365 },
]

function bucketSize(days: number): number {
  if (days <= 14)  return 1   // daily
  if (days <= 60)  return 7   // weekly
  if (days <= 180) return 14  // bi-weekly
  return 30                   // monthly
}

// ── Chart: Review Forecast ───────────────────────────────────────────────────

function ReviewForecast({ cards }: { cards: FSRSCard[] }) {
  const { ref, width } = useContainerWidth()
  const { tip, show, move, hide } = useTip()
  const [tfDays, setTfDays] = useState(14)
  const H = 130, padL = 32, padR = 8, padT = 8, padB = 28

  const buckets = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const bSize = bucketSize(tfDays)
    const numBuckets = Math.ceil(tfDays / bSize)
    const arr = Array.from({ length: numBuckets }, (_, i) => {
      const startDay = i * bSize
      const endDay = Math.min(startDay + bSize - 1, tfDays - 1)
      const startD = new Date(today); startD.setDate(startD.getDate() + startDay)
      const endD   = new Date(today); endD.setDate(endD.getDate() + endDay)
      const label = bSize === 1
        ? (startDay === 0 ? 'Today' : startDay === 1 ? 'Tmrw' : `+${startDay}`)
        : bSize === 7
          ? (startDay === 0 ? 'This wk' : `Wk +${startDay}`)
          : startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return { label, startDay, endDay, startD, endD, count: 0, overdue: 0 }
    })
    cards.forEach(c => {
      if (!c.nextReview) return
      const nr = new Date(c.nextReview); nr.setHours(0, 0, 0, 0)
      const diff = Math.round((nr.getTime() - today.getTime()) / 86400000)
      if (diff < 0) { arr[0].count++; arr[0].overdue++ }
      else {
        const bi = Math.floor(diff / bSize)
        if (bi < arr.length) arr[bi].count++
      }
    })
    return arr
  }, [cards, tfDays])

  const maxVal = Math.max(...buckets.map(b => b.count), 1)
  const innerW = width - padL - padR
  const innerH = H - padT - padB
  const n = buckets.length
  const gap = Math.max(1, n > 30 ? 0 : 2)
  const barW = Math.max(2, innerW / n - gap)
  const stepX = innerW / n

  const tabStyle = (active: boolean) => ({
    padding: '2px 7px',
    fontSize: 10,
    fontWeight: 600,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    cursor: 'pointer',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#000' : 'var(--text-muted)',
    transition: 'background 0.15s',
  })

  return (
    <div style={{ width: '100%' }}>
      {/* Time frame selector */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 10, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 2, width: 'fit-content' }}>
        {TIMEFRAMES.map(tf => (
          <button key={tf.days} style={tabStyle(tfDays === tf.days)} onClick={() => setTfDays(tf.days)}>
            {tf.label}
          </button>
        ))}
      </div>
      <div ref={ref} style={{ width: '100%' }}>
        {tip && <TooltipPopup tip={tip} />}
        <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
          {[0, 0.5, 1].map(pct => {
            const y = padT + innerH * (1 - pct)
            return (
              <g key={pct}>
                <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
                <text x={padL - 4} y={y + 4} fill="var(--text-muted)" fontSize={9} textAnchor="end">{Math.round(maxVal * pct)}</text>
              </g>
            )
          })}
          {buckets.map((b, i) => {
            const barH = Math.max(b.count > 0 ? 2 : 0, (b.count / maxVal) * innerH)
            const x = padL + i * stepX + (stepX - barW) / 2
            const y = padT + innerH - barH
            const isToday = i === 0
            const isHighLoad = b.count > maxVal * 0.7 && b.count > 10
            const fill = isToday ? 'var(--accent)' : isHighLoad ? '#ef4444' : '#3b82f6'
            // Only render label every N bars to avoid overlap
            const showLabel = n <= 14 || i % Math.ceil(n / 14) === 0 || i === n - 1
            const rangeStr = bucketSize(tfDays) === 1
              ? b.startD.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
              : `${b.startD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${b.endD.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
            const tipContent = (
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4, color: fill }}>{rangeStr}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Due: </span><strong>{b.count}</strong> card{b.count !== 1 ? 's' : ''}</div>
                {b.overdue > 0 && <div style={{ color: '#ef4444', fontSize: 11 }}>{b.overdue} overdue (counted here)</div>}
                {isHighLoad && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>⚠ Heavy review period</div>}
              </div>
            )
            return (
              <g key={i}
                onMouseEnter={e => show(e, tipContent)}
                onMouseMove={move}
                onMouseLeave={hide}
                style={{ cursor: 'default' }}
              >
                <rect x={x - 1} y={padT} width={barW + 2} height={innerH} fill="transparent" />
                <rect x={x} y={y} width={barW} height={barH} rx={1} fill={fill} opacity={0.85} />
                {b.count > 0 && barW > 10 && (
                  <text x={x + barW / 2} y={y - 2} fill={fill} fontSize={8} textAnchor="middle">{b.count}</text>
                )}
                {showLabel && (
                  <text x={x + barW / 2} y={H - 4} fill={isToday ? 'var(--accent)' : 'var(--text-muted)'} fontSize={7} textAnchor="middle">{b.label}</text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ── Chart: Forgetting Curves ─────────────────────────────────────────────────

function ForgettingCurves({ cards }: { cards: FSRSCard[] }) {
  const { ref, width } = useContainerWidth()
  const { tip, show, move, hide } = useTip()
  const H = 160, padL = 34, padR = 12, padT = 10, padB = 28
  const maxDays = 60
  const TARGET_R = 0.92

  const tiers = useMemo(() => {
    const buckets = [
      { max: 4,        label: '≤4d',    color: '#ef4444' },
      { max: 10,       label: '5-10d',  color: '#f97316' },
      { max: 21,       label: '11-21d', color: '#eab308' },
      { max: 60,       label: '22-60d', color: '#22c55e' },
      { max: Infinity, label: '60d+',   color: '#3b82f6' },
    ]
    return buckets.map(({ max, label, color }, i) => {
      const prev = i === 0 ? 0 : buckets[i - 1].max
      const group = cards.filter(c => c.stability > prev && c.stability <= max)
      const s = group.length > 0 ? group.reduce((a, c) => a + c.stability, 0) / group.length : [3, 7, 14, 30, 90][i]
      const avgDiff = group.length > 0 ? group.reduce((a, c) => a + c.difficulty, 0) / group.length : null
      return { s, label, color, count: group.length, avgDiff }
    })
  }, [cards])

  const innerW = width - padL - padR
  const innerH = H - padT - padB
  const xScale = (t: number) => padL + (t / maxDays) * innerW
  const yScale = (r: number) => padT + innerH * (1 - r)
  const targetY = yScale(TARGET_R)

  function curvePath(s: number) {
    const pts: string[] = []
    for (let t = 0; t <= maxDays; t += 0.5) {
      const r = retrievability(t, s)
      pts.push(`${t === 0 ? 'M' : 'L'}${xScale(t).toFixed(1)},${yScale(r).toFixed(1)}`)
    }
    return pts.join(' ')
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {tip && <TooltipPopup tip={tip} />}
      <svg width={width} height={H} style={{ display: 'block', overflow: 'visible' }}>
        {[0.5, 0.7, 0.9, 1.0].map(r => (
          <g key={r}>
            <line x1={padL} y1={yScale(r)} x2={width - padR} y2={yScale(r)} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={padL - 4} y={yScale(r) + 4} fill="var(--text-muted)" fontSize={9} textAnchor="end">{Math.round(r * 100)}%</text>
          </g>
        ))}
        {[0, 10, 20, 30, 40, 50, 60].map(t => (
          <g key={t}>
            <line x1={xScale(t)} y1={padT} x2={xScale(t)} y2={padT + innerH} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
            <text x={xScale(t)} y={H - 4} fill="var(--text-muted)" fontSize={9} textAnchor="middle">{t}d</text>
          </g>
        ))}
        <line x1={padL} y1={targetY} x2={width - padR} y2={targetY} stroke="var(--accent)" strokeWidth={1} strokeDasharray="5 3" opacity={0.6} />
        <text x={width - padR + 2} y={targetY + 4} fill="var(--accent)" fontSize={8}>92%</text>
        <rect x={padL} y={yScale(0.7)} width={innerW} height={yScale(0) - yScale(0.7)} fill="#ef444408" />
        {tiers.filter(t => t.count > 0).map(tier => (
          <path key={tier.label} d={curvePath(tier.s)} fill="none" stroke={tier.color} strokeWidth={1.5} opacity={0.9} />
        ))}
        {cards.filter(c => c.stability > 0 && c.lastReview).slice(0, 200).map((c, i) => {
          const t = Math.max(0, (Date.now() - new Date(c.lastReview).getTime()) / 86400000)
          if (t > maxDays) return null
          const r = retrievability(t, c.stability)
          return <circle key={i} cx={xScale(t)} cy={yScale(r)} r={2} fill={r < 0.7 ? '#ef4444' : r < 0.85 ? '#eab308' : '#22c55e'} opacity={0.35} />
        })}
      </svg>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {tiers.filter(t => t.count > 0).map(t => {
          const drop70 = t.s * Math.log(0.7) / Math.log(TARGET_R)
          const tipContent = (
            <div>
              <div style={{ fontWeight: 700, color: t.color, marginBottom: 4 }}>Stability tier: {t.label}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Cards: </span><strong>{t.count}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Avg stability: </span><strong>{t.s.toFixed(1)}d</strong></div>
              {t.avgDiff !== null && <div><span style={{ color: 'var(--text-muted)' }}>Avg difficulty: </span><strong>{t.avgDiff!.toFixed(1)}/10</strong></div>}
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--accent)' }}>Drops to 92% in ~{t.s.toFixed(0)}d</div>
              <div style={{ fontSize: 11, color: '#ef4444' }}>Drops to 70% in ~{drop70.toFixed(0)}d</div>
            </div>
          )
          return (
            <span key={t.label}
              style={{ fontSize: 10, color: t.color, display: 'flex', alignItems: 'center', gap: 4, cursor: 'default' }}
              onMouseEnter={e => show(e, tipContent)} onMouseMove={move} onMouseLeave={hide}
            >
              <span style={{ width: 16, height: 2, background: t.color, display: 'inline-block', borderRadius: 1 }} />
              {t.label} ({t.count})
            </span>
          )
        })}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Your cards
        </span>
      </div>
    </div>
  )
}

// ── Chart: Difficulty Distribution ──────────────────────────────────────────

const DIFF_LABELS: Record<number, string> = {
  1: 'Trivial — recalled instantly every time',
  2: 'Very easy — rarely causes trouble',
  3: 'Easy — minor effort needed',
  4: 'Somewhat easy — occasionally hesitant',
  5: 'Moderate — consistent but effortful',
  6: 'Slightly hard — frequent pauses',
  7: 'Hard — often requires prompting',
  8: 'Very hard — lapses regularly',
  9: 'Extremely hard — almost always fails',
  10: 'Near impossible — consider re-studying',
}

function DifficultyDistribution({ cards }: { cards: FSRSCard[] }) {
  const { ref, width } = useContainerWidth()
  const { tip, show, move, hide } = useTip()

  const buckets = useMemo(() => {
    const arr = Array.from({ length: 10 }, (_, i) => ({ label: `${i + 1}`, count: 0 }))
    cards.forEach(c => { arr[Math.min(9, Math.max(0, Math.round(c.difficulty) - 1))].count++ })
    return arr
  }, [cards])

  const maxVal = Math.max(...buckets.map(b => b.count), 1)
  const H = 90, padL = 18, padR = 8, padT = 4, padB = 20
  const innerW = width - padL - padR
  const innerH = H - padT - padB
  const barW = Math.max(4, innerW / 10 - 2)
  const stepX = innerW / 10

  function barColor(i: number) {
    if (i <= 2) return '#22c55e'; if (i <= 5) return '#eab308'; if (i <= 7) return '#f97316'; return '#ef4444'
  }

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {tip && <TooltipPopup tip={tip} />}
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#22c55e' }}>Easy (1-3)</span><span style={{ color: '#eab308' }}>Medium (4-6)</span><span style={{ color: '#ef4444' }}>Hard (7-10)</span>
      </div>
      <svg width={width} height={H} style={{ display: 'block' }}>
        {buckets.map((b, i) => {
          const barH = Math.max(2, (b.count / maxVal) * innerH)
          const x = padL + i * stepX + (stepX - barW) / 2
          const y = padT + innerH - barH
          const color = barColor(i)
          const pct = Math.round((b.count / cards.length) * 100)
          const tipContent = (
            <div>
              <div style={{ fontWeight: 700, color, marginBottom: 4 }}>Difficulty {i + 1}/10</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{DIFF_LABELS[i + 1]}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Cards: </span><strong>{b.count}</strong> ({pct}%)</div>
            </div>
          )
          return (
            <g key={i} onMouseEnter={e => show(e, tipContent)} onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'default' }}>
              <rect x={x - 2} y={padT} width={barW + 4} height={innerH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={color} opacity={0.8} />
              {b.count > 0 && <text x={x + barW / 2} y={y - 2} fill={color} fontSize={8} textAnchor="middle">{b.count}</text>}
              <text x={x + barW / 2} y={H - 4} fill="var(--text-muted)" fontSize={9} textAnchor="middle">{b.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Chart: Interval Spread ───────────────────────────────────────────────────

const INTERVAL_BUCKETS = [
  { label: '<1d',    max: 1,        desc: 'Just introduced — in active learning phase' },
  { label: '1-3d',   max: 3,        desc: 'Early review — memory still fragile' },
  { label: '4-7d',   max: 7,        desc: 'Short-term retention building' },
  { label: '8-14d',  max: 14,       desc: 'Approaching medium-term stability' },
  { label: '15-30d', max: 30,       desc: 'Monthly review — solid retention' },
  { label: '31-60d', max: 60,       desc: 'Good stability — reviewed every 1-2 months' },
  { label: '61-180d',max: 180,      desc: 'Long-term retention — strong memory' },
  { label: '180d+',  max: Infinity, desc: 'Mature — approaching permanent memory' },
]

function IntervalSpread({ cards }: { cards: FSRSCard[] }) {
  const { ref, width } = useContainerWidth()
  const { tip, show, move, hide } = useTip()

  const buckets = useMemo(() => {
    const arr = INTERVAL_BUCKETS.map(b => ({ ...b, count: 0 }))
    cards.filter(c => c.interval > 0).forEach(c => {
      const idx = arr.findIndex(b => c.interval <= b.max)
      if (idx >= 0) arr[idx].count++
    })
    return arr
  }, [cards])

  const maxVal = Math.max(...buckets.map(b => b.count), 1)
  const H = 90, padL = 24, padR = 8, padT = 4, padB = 20
  const innerW = width - padL - padR
  const innerH = H - padT - padB
  const n = INTERVAL_BUCKETS.length
  const barW = Math.max(4, innerW / n - 2)
  const stepX = innerW / n
  const total = cards.filter(c => c.interval > 0).length

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {tip && <TooltipPopup tip={tip} />}
      <svg width={width} height={H} style={{ display: 'block' }}>
        {[0, 0.5, 1].map(pct => {
          const y = padT + innerH * (1 - pct)
          return (
            <g key={pct}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="var(--border)" strokeWidth={0.5} strokeDasharray="3 3" />
              <text x={padL - 3} y={y + 4} fill="var(--text-muted)" fontSize={8} textAnchor="end">{Math.round(maxVal * pct)}</text>
            </g>
          )
        })}
        {buckets.map((b, i) => {
          const barH = Math.max(b.count > 0 ? 2 : 0, (b.count / maxVal) * innerH)
          const x = padL + i * stepX + (stepX - barW) / 2
          const y = padT + innerH - barH
          const fill = `hsl(${Math.min(120, i * 17)},70%,55%)`
          const pct = total > 0 ? Math.round((b.count / total) * 100) : 0
          const tipContent = (
            <div>
              <div style={{ fontWeight: 700, color: fill, marginBottom: 4 }}>Interval: {b.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{b.desc}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Cards: </span><strong>{b.count}</strong> ({pct}%)</div>
            </div>
          )
          return (
            <g key={i} onMouseEnter={e => show(e, tipContent)} onMouseMove={move} onMouseLeave={hide} style={{ cursor: 'default' }}>
              <rect x={x - 2} y={padT} width={barW + 4} height={innerH} fill="transparent" />
              <rect x={x} y={y} width={barW} height={barH} rx={2} fill={fill} opacity={0.8} />
              {b.count > 0 && <text x={x + barW / 2} y={y - 2} fill={fill} fontSize={8} textAnchor="middle">{b.count}</text>}
              <text x={x + barW / 2} y={H - 4} fill="var(--text-muted)" fontSize={7} textAnchor="middle">{b.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Weak Cards Table ─────────────────────────────────────────────────────────

function WeakCardsTable({ cards, courses }: { cards: FSRSCard[]; courses: Course[] }) {
  const { tip, show, move, hide } = useTip()

  const courseMap = useMemo(() => {
    const m: Record<string, string> = {}
    courses.forEach(c => { m[c.id] = c.shortName || c.name })
    return m
  }, [courses])

  const weakCards = useMemo(() => {
    return cards
      .map(c => {
        const ret = c.reps > 0 ? Math.round(((c.reps - c.lapses) / c.reps) * 100) : 100
        const daysSince = c.lastReview ? Math.round((Date.now() - new Date(c.lastReview).getTime()) / 86400000) : null
        const r = c.stability > 0 && daysSince !== null ? retrievability(daysSince, c.stability) : null
        const courseId = c.key.split('::')[0]
        return { c, ret, r, daysSince, courseId }
      })
      .sort((a, b) => {
        if (a.r !== null && b.r !== null) return a.r - b.r
        return b.c.lapses - a.c.lapses
      })
      .slice(0, 12)
  }, [cards])

  if (weakCards.length === 0) return <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No reviewed cards yet.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {tip && <TooltipPopup tip={tip} />}
      {weakCards.map(({ c, ret, r, daysSince, courseId }, i) => {
        const rPct = r !== null ? Math.round(r * 100) : null
        const retriColor = rPct === null ? 'var(--text-muted)' : rPct < 50 ? '#ef4444' : rPct < 75 ? '#f97316' : rPct < 90 ? '#eab308' : '#22c55e'
        const retColor = ret < 60 ? '#ef4444' : ret < 80 ? '#f97316' : ret < 90 ? '#eab308' : '#22c55e'
        const nextDate = c.nextReview ? new Date(c.nextReview).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
        const lastDate = c.lastReview ? new Date(c.lastReview).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'
        const tipContent = (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{c.front}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontStyle: 'italic' }}>{c.back}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              {rPct !== null && (
                <div><span style={{ color: 'var(--text-muted)' }}>Current recall: </span>
                  <span style={{ color: retriColor, fontWeight: 700 }}>{rPct}%</span>
                  {rPct < 70 && <span style={{ color: '#ef4444' }}> ← likely forgotten</span>}
                </div>
              )}
              <div><span style={{ color: 'var(--text-muted)' }}>Historical retention: </span><span style={{ color: retColor, fontWeight: 700 }}>{ret}%</span></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Lapses / Reviews: </span><strong>{c.lapses} / {c.reps}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Stability: </span><strong>{c.stability.toFixed(1)}d</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Difficulty: </span><strong>{c.difficulty.toFixed(1)}/10</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Last reviewed: </span>{lastDate} {daysSince !== null ? `(${daysSince}d ago)` : ''}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Next due: </span>{nextDate} (every {c.interval}d)</div>
            </div>
          </div>
        )
        return (
          <div key={i}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: `1px solid ${rPct !== null && rPct < 50 ? '#ef444330' : 'var(--border)'}`, cursor: 'default' }}
            onMouseEnter={e => show(e, tipContent)} onMouseMove={move} onMouseLeave={hide}
          >
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', width: 16, flexShrink: 0 }}>#{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.front}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{courseMap[courseId] ?? courseId} · {c.lapses} lapse{c.lapses !== 1 ? 's' : ''} · {c.reps} reviews</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
              {rPct !== null && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: retriColor }}>{rPct}%</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>now</div>
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: retColor }}>{ret}%</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>hist.</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{c.interval > 0 ? `${c.interval}d` : '—'}</div>
                <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>intv.</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────────

export default function FlashcardAnalytics({ fsrsMap, courses }: Props) {
  const [selectedCourse, setSelectedCourse] = useState<string>('all')

  // Filter FSRS map by selected course
  const filteredFsrs = useMemo(() => {
    if (selectedCourse === 'all') return fsrsMap
    const out: Record<string, FSRSCard> = {}
    Object.entries(fsrsMap).forEach(([k, v]) => {
      if (k.startsWith(`${selectedCourse}::`)) out[k] = v
    })
    return out
  }, [fsrsMap, selectedCourse])

  const cards    = useMemo(() => Object.values(filteredFsrs), [filteredFsrs])
  const reviewed = useMemo(() => cards.filter(c => c.reps > 0), [cards])

  // Courses that have at least one FSRS entry
  const coursesWithData = useMemo(() => {
    const ids = new Set(Object.keys(fsrsMap).map(k => k.split('::')[0]))
    return courses.filter(c => ids.has(c.id))
  }, [fsrsMap, courses])

  const selCourse = courses.find(c => c.id === selectedCourse)

  if (Object.keys(fsrsMap).length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
        <BarChart2 size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Study some cards to see analytics</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Course filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Filter size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <button
            onClick={() => setSelectedCourse('all')}
            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: `1px solid ${selectedCourse === 'all' ? 'var(--accent)' : 'var(--border)'}`, background: selectedCourse === 'all' ? 'rgba(245,166,35,0.15)' : 'transparent', color: selectedCourse === 'all' ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            All Courses
          </button>
          {coursesWithData.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCourse(c.id)}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 'var(--radius-sm)', border: `1px solid ${selectedCourse === c.id ? c.color : 'var(--border)'}`, background: selectedCourse === c.id ? `${c.color}22` : 'transparent', color: selectedCourse === c.id ? c.color : 'var(--text-muted)', cursor: 'pointer' }}
            >
              {c.shortName || c.name}
            </button>
          ))}
        </div>
        {selCourse && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
            — {cards.length} cards, {reviewed.length} reviewed
          </span>
        )}
      </div>

      {/* Review Forecast */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <span className="card-title"><Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Review Forecast</span>
        </div>
        <ReviewForecast cards={cards} />
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
          Overdue cards counted in first bucket. <span style={{ color: '#ef4444' }}>Red</span> = heavy load. Hover bars for detail.
        </div>
      </div>

      {/* Forgetting Curves */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <span className="card-title"><TrendingDown size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Forgetting Curves (FSRS-4.5)</span>
        </div>
        {reviewed.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No reviewed cards in this selection.</div>
        ) : (
          <ForgettingCurves cards={reviewed} />
        )}
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
          Lines = stability tiers · Dots = cards right now · <span style={{ color: 'var(--accent)' }}>— 92% target</span> · <span style={{ color: '#ef4444' }}>danger zone &lt;70%</span> · hover legend for tier stats
        </div>
      </div>

      {/* Difficulty + Interval */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 10 }}>
            <span className="card-title"><Zap size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Difficulty Distribution</span>
          </div>
          {reviewed.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data.</div> : <DifficultyDistribution cards={reviewed} />}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>FSRS difficulty 1–10. Hover bars for meaning.</div>
        </div>
        <div className="card">
          <div className="card-header" style={{ marginBottom: 10 }}>
            <span className="card-title"><BarChart2 size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Interval Spread</span>
          </div>
          {reviewed.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No data.</div> : <IntervalSpread cards={cards} />}
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>Cards by scheduled interval. Hover bars for meaning.</div>
        </div>
      </div>

      {/* Weak Cards */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 12 }}>
          <span className="card-title"><AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />Weakest Cards</span>
          <span className="badge" style={{ background: '#ef444420', color: '#ef4444', border: '1px solid #ef444440' }}>sorted by current recall</span>
        </div>
        <WeakCardsTable cards={reviewed} courses={courses} />
      </div>

    </div>
  )
}
