import { useMemo } from 'react'
import {
  TrendingUp, AlertTriangle, Calendar, Clock,
  BarChart3, GraduationCap, Flame
} from 'lucide-react'
import { useStore } from '../../store'
import type { ProficiencyEntry } from '../../types'
import { TooltipPopup, useTip } from '../../components/Tooltip'
import GpaWidget from '../../components/dashboard/GpaWidget'

export default function AnalyticsTab() {
  const { gamification, quizHistory, proficiency, srData, data } = useStore()
  const { tip: atip, show: ashow, move: amove, hide: ahide } = useTip()

  // Single-pass quiz history aggregation — builds dateMap, weeklyXp, scoreDist in one loop
  const { dateMap, weeklyXpArr, scoreDistArr } = useMemo(() => {
    const dm = new Map<string, number>()
    const now = new Date()
    // Pre-compute week boundaries for XP calculation
    const weekBounds: { start: number; end: number }[] = []
    for (let w = 7; w >= 0; w--) {
      const ws = new Date(now)
      ws.setDate(ws.getDate() - w * 7)
      const we = new Date(ws)
      we.setDate(we.getDate() + 7)
      weekBounds.push({ start: ws.getTime(), end: we.getTime() })
    }
    const wxp = new Array(8).fill(0)
    const sd = [0, 0, 0, 0] // buckets: 0-49, 50-69, 70-89, 90-100

    for (const q of quizHistory) {
      const d = new Date(q.date)
      const key = d.toISOString().split('T')[0]
      dm.set(key, (dm.get(key) || 0) + 1)

      // Weekly XP
      const qt = d.getTime()
      for (let i = 0; i < weekBounds.length; i++) {
        if (qt >= weekBounds[i].start && qt < weekBounds[i].end) {
          wxp[i] += (Number(q.correct) || 0) * 5 + (Number(q.score) === 100 ? 20 : 0)
          break
        }
      }

      // Score distribution
      if (q.score < 50) sd[0]++
      else if (q.score < 70) sd[1]++
      else if (q.score < 90) sd[2]++
      else sd[3]++
    }

    return {
      dateMap: dm,
      weeklyXpArr: wxp.map((xp, i) => ({ label: `W${i + 1}`, xp })),
      scoreDistArr: [
        { label: '0-49', count: sd[0], color: 'var(--red)' },
        { label: '50-69', count: sd[1], color: 'var(--orange)' },
        { label: '70-89', count: sd[2], color: 'var(--yellow)' },
        { label: '90-100', count: sd[3], color: 'var(--green)' },
      ],
    }
  }, [quizHistory])

  // Study streak calendar (last 12 weeks) — reuses shared dateMap
  const streakData = useMemo(() => {
    const days: { date: string; count: number }[] = []
    const today = new Date()
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      days.push({ date: key, count: dateMap.get(key) || 0 })
    }
    return days
  }, [dateMap])

  // 52-week heatmap data — reuses shared dateMap
  const heatmapData = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 363)
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)
    const cells: { date: string; count: number; week: number; day: number }[] = []
    const d = new Date(startDate)
    for (let week = 0; week < 53; week++) {
      for (let day = 0; day < 7; day++) {
        const key = d.toISOString().split('T')[0]
        cells.push({ date: key, count: dateMap.get(key) || 0, week, day })
        d.setDate(d.getDate() + 1)
      }
    }
    return cells
  }, [dateMap])

  const weeklyXp = weeklyXpArr
  const maxWeekXp = Math.max(...weeklyXp.map(w => w.xp), 1)

  const scoreDist = scoreDistArr

  const maxScoreCount = Math.max(...scoreDist.map(b => b.count), 1)

  // Proficiency by subject
  const subjProf = useMemo(() => {
    if (!proficiency?.subjects) return []
    return Object.entries(proficiency.subjects).map(([subject, topics]) => {
      const entries = Object.values(topics) as ProficiencyEntry[]
      if (entries.length === 0) return { subject, score: 0 }
      const avg = entries.reduce((acc, e) => acc + e.proficiencyScore, 0) / entries.length
      return { subject, score: Math.round(avg) }
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score)
  }, [proficiency])

  // Time studied per day (last 7 days) — reuses shared dateMap instead of O(n*7) filter
  const dailyActivity = useMemo(() => {
    const days: { label: string; quizzes: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { weekday: 'short' })
      days.push({ label, quizzes: dateMap.get(key) || 0 })
    }
    return days
  }, [dateMap])

  const maxDailyQ = Math.max(...dailyActivity.map(d => d.quizzes), 1)

  // Weak topics
  const weakTopics = useMemo(() => {
    if (!proficiency?.subjects) return []
    const weak: { subject: string; topic: string; score: number }[] = []
    Object.entries(proficiency.subjects).forEach(([subject, topics]) => {
      Object.entries(topics).forEach(([topic, entry]) => {
        const e = entry as ProficiencyEntry
        if (!e.isProficient && e.attempts.length > 0) {
          weak.push({ subject, topic, score: e.proficiencyScore })
        }
      })
    })
    return weak.sort((a, b) => a.score - b.score).slice(0, 8)
  }, [proficiency])

  return (
    <div>
      {atip && <TooltipPopup tip={atip} />}
      {/* Canvas GPA Estimator */}
      <GpaWidget />

      {/* Empty state when no quiz data */}
      {quizHistory.length === 0 && (
        <div className="card mb-4 empty-state" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No quiz data yet</p>
          <p className="text-muted text-sm" style={{ margin: '6px 0 0' }}>Take your first quiz to see analytics here</p>
          <a href="#/quiz?tab=create" className="btn btn-primary btn-sm" style={{ marginTop: 12, display: 'inline-flex' }}>Take your first quiz →</a>
        </div>
      )}

      {/* Streak calendar */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>Study Streak (12 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Each cell is one day. Darker = more quizzes completed that day. Hover a cell for the exact date and count.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Study Streak (12 Weeks)
          </span>
          <span className="badge badge-accent"><Flame size={12} /> {gamification.streak}d</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          {streakData.map((d, i) => {
            const intensity = d.count === 0 ? 0 : Math.min(1, d.count / 3)
            return (
              <div
                key={i}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.count === 0 ? 'No activity' : `${d.count} quiz${d.count === 1 ? '' : 'zes'} completed`}</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 2,
                  background: d.count === 0
                    ? 'var(--bg-primary)'
                    : `rgba(99, 102, 241, ${0.2 + intensity * 0.8})`,
                  border: '1px solid var(--border)',
                  cursor: d.count > 0 ? 'pointer' : 'default'
                }}
              />
            )
          })}
        </div>
      </div>

      {/* 52-Week Contribution Heatmap (beta) */}
      {heatmapData.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Activity Heatmap (52 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>A full year of activity. Each cell = one day. Darker amber = more quizzes. Hover any cell for the date and count.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Activity Heatmap (52 Weeks)
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
              {Array.from({ length: 53 }, (_, week) => (
                <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {heatmapData.filter(c => c.week === week).map(cell => {
                    const intensity = cell.count === 0 ? 0 : Math.min(1, cell.count / 4)
                    const isFuture = cell.date > new Date().toISOString().split('T')[0]
                    return (
                      <div
                        key={cell.date}
                        onMouseEnter={isFuture ? undefined : e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{new Date(cell.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cell.count === 0 ? 'No activity' : `${cell.count} quiz${cell.count === 1 ? '' : 'zes'} completed`}</div></div>)}
                        onMouseMove={isFuture ? undefined : amove}
                        onMouseLeave={isFuture ? undefined : ahide}
                        style={{
                          width: 11, height: 11, borderRadius: 2,
                          background: isFuture ? 'transparent' : cell.count === 0
                            ? 'var(--bg-primary)'
                            : `rgba(245, 166, 35, ${0.2 + intensity * 0.8})`,
                          border: isFuture ? 'none' : '1px solid var(--border)',
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <div key={v} style={{
                width: 11, height: 11, borderRadius: 2,
                background: v === 0 ? 'var(--bg-primary)' : `rgba(245, 166, 35, ${0.2 + v * 0.8})`,
                border: '1px solid var(--border)',
              }} />
            ))}
            <span>More</span>
          </div>
        </div>
      )}

      {/* XP over time */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>XP by Week</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>XP earned per calendar week from quiz completions. Each correct answer earns 5 XP; a perfect score adds a 20 XP bonus. Hover bars for the exact weekly total.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />XP by Week
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {weeklyXp.map(w => (
            <div
              key={w.label}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{w.label}</div><div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{w.xp} XP</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <div className="text-xs text-muted">{w.xp}</div>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, (w.xp / maxWeekXp) * 80)}px`,
                background: 'var(--accent)', transition: 'height 0.3s'
              }} />
              <div className="text-xs text-muted">{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quiz score distribution */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>Score Distribution</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>All quiz scores bucketed by range. 0–49 = needs work, 50–69 = developing, 70–89 = proficient, 90–100 = mastery. Hover a bar for the count and percentage.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Score Distribution
          </span>
          <span className="text-xs text-muted">{quizHistory.length} quizzes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
          {scoreDist.map(b => {
            const pct = quizHistory.length > 0 ? Math.round((b.count / quizHistory.length) * 100) : 0
            const label = b.label === '0-49' ? 'Needs work' : b.label === '50-69' ? 'Developing' : b.label === '70-89' ? 'Proficient' : 'Mastery'
            return (
              <div
                key={b.label}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: b.color, marginBottom: 4 }}>{b.label} — {label}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.count} quiz{b.count !== 1 ? 'zes' : ''}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of total</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
              >
                <div className="text-xs text-muted">{b.count}</div>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  height: `${Math.max(4, (b.count / maxScoreCount) * 70)}px`,
                  background: b.color, transition: 'height 0.3s'
                }} />
                <div className="text-xs text-muted">{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quiz accuracy trend (beta) */}
      {quizHistory.length >= 3 && (() => {
        const recent = [...quizHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-20)
        const w = 300, h = 80, pad = 4
        const points = recent.map((q, i) => {
          const x = pad + (i / (recent.length - 1)) * (w - pad * 2)
          const y = h - pad - (q.score / 100) * (h - pad * 2)
          return `${x},${y}`
        }).join(' ')
        return (
          <div className="card mb-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Accuracy Trend (Last 20 Quizzes)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your quiz scores in chronological order. The dashed line marks the 70% passing target. Hover any dot for the quiz name and score.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Accuracy Trend (Last 20 Quizzes)
              </span>
            </div>
            <div style={{ padding: '8px 12px 12px', overflowX: 'auto' }}>
              <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ minWidth: 200, height: 80 }}>
                <line x1={pad} y1={h - pad - (70 / 100) * (h - pad * 2)} x2={w - pad} y2={h - pad - (70 / 100) * (h - pad * 2)}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <polyline points={points} fill="none" stroke="var(--color-accent, #F5A623)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {recent.map((q, i) => {
                  const x = pad + (i / (recent.length - 1)) * (w - pad * 2)
                  const y = h - pad - (q.score / 100) * (h - pad * 2)
                  return <circle key={i} cx={x} cy={y} r="5" fill="var(--color-accent, #F5A623)" opacity={0.9} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => ashow(e as unknown as React.MouseEvent, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{q.name?.slice(0, 30) || `Quiz #${i + 1}`}</div><div style={{ fontSize: 13, fontWeight: 600, color: q.score >= 70 ? 'var(--green)' : 'var(--red)' }}>{q.score}%</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(q.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>)}
                    onMouseMove={e => amove(e as unknown as React.MouseEvent)}
                    onMouseLeave={ahide}
                  />
                })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>{recent[0]?.name?.slice(0, 14)}</span>
                <span>70% target</span>
                <span>{recent[recent.length - 1]?.name?.slice(0, 14)}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Proficiency by subject */}
      {subjProf.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Proficiency by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average correct-answer rate per subject across all quizzes. Green ≥85% (proficient), yellow ≥60% (developing), red &lt;60% (needs work). Hover a row for details.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <GraduationCap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Proficiency by Subject
            </span>
          </div>
          {subjProf.map(s => {
            const status = s.score >= 85 ? 'Proficient' : s.score >= 60 ? 'Developing' : 'Needs work'
            const color = s.score >= 85 ? 'var(--green)' : s.score >= 60 ? 'var(--yellow)' : 'var(--red)'
            return (
              <div
                key={s.subject}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color, marginBottom: 4 }}>{s.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color }}>{s.score}% — {status}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Average proficiency score across all topics in this subject.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ marginBottom: 10, cursor: 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.subject}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{s.score}%</span>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${s.score}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Daily activity */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Daily Activity (Last 7 Days)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Number of quizzes completed each day this week. Hover a bar for the exact count.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Daily Activity (Last 7 Days)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {dailyActivity.map(d => (
            <div
              key={d.label}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{d.label}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.quizzes} quiz{d.quizzes !== 1 ? 'zes' : ''}</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <div className="text-xs text-muted">{d.quizzes}</div>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, (d.quizzes / maxDailyQ) * 50)}px`,
                background: 'var(--blue)', transition: 'height 0.3s'
              }} />
              <div className="text-xs text-muted">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Weak Topics</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Topics where you haven't reached proficiency, sorted by lowest score first. Focus here for the biggest improvement. Hover a row for details.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Weak Topics
            </span>
            <span className="badge badge-red">{weakTopics.length}</span>
          </div>
          {weakTopics.map((w, i) => {
            const color = w.score < 50 ? 'var(--red)' : 'var(--yellow)'
            return (
              <div
                key={i}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color, marginBottom: 4 }}>{w.topic}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{w.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color }}>{Math.max(0, Math.round(w.score))}% proficiency</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{w.score < 50 ? 'Critical — needs significant review' : 'Getting there — a few more correct answers will unlock proficiency'}</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                  borderBottom: i < weakTopics.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'default'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{w.topic}</div>
                  <div className="text-xs text-muted">{w.subject}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{Math.max(0, Math.round(w.score))}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* #98 Error Pattern Analysis */}
      {(() => {
        const missedMap = new Map<string, number>();
        quizHistory.forEach(q => {
          (q.answers || []).forEach((a: any) => {
            if (!a.correct) {
              const key = `${q.subject || 'Unknown'}::${q.subtopic || a.question?.question?.slice(0, 30) || 'Unknown'}`;
              missedMap.set(key, (missedMap.get(key) || 0) + 1);
            }
          });
        });
        const top = Array.from(missedMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, count]) => {
            const [subject, topic] = key.split('::');
            return { subject, topic, count };
          });
        if (top.length === 0) return null;
        return (
          <div className="card">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Error Patterns</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Question categories you miss most often, ranked by total error count across all quizzes. Reviewing these topics will have the biggest impact on your scores. Hover a row for details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Error Patterns
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Topics you miss most often:</div>
            {top.map((e, i) => (
              <div
                key={i}
                onMouseEnter={ev => ashow(ev, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>#{i + 1} — {e.topic}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{e.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>{e.count}× missed</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Appears across multiple quizzes — prioritize reviewing this area.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'default' }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{e.topic}</div>
                  <div className="text-xs text-muted">{e.subject}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>{e.count}× missed</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* #94 Retention Curve */}
      {(() => {
        const cards = srData?.cards || [];
        if (cards.length === 0) return null;
        // Bucket cards by stability (days): <1, 1-3, 3-7, 7-14, 14-30, 30+
        const buckets = [
          { label: '<1d', min: 0, max: 1, count: 0 },
          { label: '1-3d', min: 1, max: 3, count: 0 },
          { label: '3-7d', min: 3, max: 7, count: 0 },
          { label: '7-14d', min: 7, max: 14, count: 0 },
          { label: '14-30d', min: 14, max: 30, count: 0 },
          { label: '30+d', min: 30, max: Infinity, count: 0 },
        ];
        cards.forEach(c => {
          const s = c.S || 0;
          const b = buckets.find(b => s >= b.min && s < b.max);
          if (b) b.count++;
        });
        const maxCount = Math.max(...buckets.map(b => b.count), 1);
        return (
          <div className="card mt-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Retention Curve</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your flashcards distributed by FSRS stability interval. Cards further right have stronger long-term memory. Ideally most cards should be in the 7d+ buckets. Hover bars for details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Retention Curve
              </span>
              <span className="text-xs text-muted">{cards.length} SR cards</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 4 }}>
              {buckets.map(b => {
                const meanings: Record<string, string> = {
                  '<1d': 'Very new — just introduced or recently failed',
                  '1-3d': 'Early learning — building initial memory',
                  '3-7d': 'Developing — growing stability',
                  '7-14d': 'Established — reliable short-term memory',
                  '14-30d': 'Strong — solid medium-term retention',
                  '30+d': 'Mature — deep long-term memory',
                }
                return (
                  <div
                    key={b.label}
                    onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{b.label} interval</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.count} card{b.count !== 1 ? 's' : ''}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{meanings[b.label]}</div></div>)}
                    onMouseMove={amove}
                    onMouseLeave={ahide}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
                  >
                    <div className="text-xs text-muted">{b.count}</div>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (b.count / maxCount) * 50)}px`, background: 'var(--color-accent, #F5A623)', transition: 'height 0.3s', opacity: 0.85 }} />
                    <div className="text-xs text-muted">{b.label}</div>
                  </div>
                )
              })}
            </div>
            <div className="text-xs text-muted">Card stability distribution (FSRS)</div>
          </div>
        );
      })()}

      {/* ── #95 Quiz Score History by Subject ── */}
      {(() => {
        // Group quiz history by subject, show last 10 scores per subject as a mini bar chart
        const subjects = [...new Set(quizHistory.map((q: QuizAttempt) => q.subject || 'General').filter(Boolean))];
        if (subjects.length === 0) return null;
        return (
          <div className="card mt-4 mb-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Score History by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your last 10 quiz scores per subject shown as a mini bar chart. The arrow shows the trend from first to last quiz. Hover a subject row for average and trend details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <TrendingUp size={14} style={{ color: 'var(--accent)' }} /> Score History by Subject
              </span>
            </div>
            <div style={{ padding: '0 4px' }}>
              {subjects.slice(0, 5).map((subject: string) => {
                const scores = quizHistory
                  .filter((q: QuizAttempt) => (q.subject || 'General') === subject)
                  .slice(-10)
                  .map((q: QuizAttempt) => q.score);
                if (scores.length < 2) return null;
                const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
                const trend = scores[scores.length - 1] - scores[0];
                const trendColor = trend >= 0 ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)'
                return (
                  <div
                    key={subject}
                    onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{subject}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>avg {avg}%</div><div style={{ fontSize: 11, color: trendColor, marginTop: 2 }}>{trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}% trend (first → last quiz)</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{scores.length} quizzes in last 10</div></div>)}
                    onMouseMove={amove}
                    onMouseLeave={ahide}
                    style={{ marginBottom: 14, cursor: 'default' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{subject}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>avg {avg}%</span>
                        <span style={{ color: trendColor, fontWeight: 700 }}>
                          {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
                        </span>
                      </span>
                    </div>
                    {/* Mini bar chart */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
                      {scores.map((s: number, i: number) => (
                        <div
                          key={i}
                          onMouseEnter={e => { e.stopPropagation(); ashow(e, <div><div style={{ fontWeight: 700, color: s >= 80 ? 'var(--green, #22c55e)' : s >= 60 ? 'var(--accent)' : 'var(--red)', marginBottom: 4 }}>Quiz #{i + 1}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s}%</div></div>) }}
                          onMouseMove={amove}
                          onMouseLeave={ahide}
                          style={{
                            flex: 1, height: `${Math.max(s, 4)}%`, minHeight: 2,
                            background: s >= 80 ? 'var(--green, #22c55e)' : s >= 60 ? 'var(--accent, #6366f1)' : 'var(--red, #ef4444)',
                            borderRadius: '2px 2px 0 0', opacity: i === scores.length - 1 ? 1 : 0.6,
                            cursor: 'default',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* #92 Time-Per-Topic */}
      {(() => {
        const sessions = (data?.pluginData?.studySessions || []) as import('../../types').StudySession[];
        const topicMap = new Map<string, number>();
        sessions.forEach(s => {
          if (s.topicId) {
            topicMap.set(s.topicId, (topicMap.get(s.topicId) || 0) + s.durationMs);
          }
        });
        if (topicMap.size === 0) return null;
        const top = Array.from(topicMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([id, ms]) => ({ id, min: Math.round(ms / 60000) }));
        const maxMin = Math.max(...top.map(t => t.min), 1);
        return (
          <div className="card mt-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Time Per Topic</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total study session minutes logged per topic (top 6). Tracked from active Learn mode sessions. Hover a bar for the topic name and exact time.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Time Per Topic
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 4 }}>
              {top.map(t => (
                <div
                  key={t.id}
                  onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{t.id}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.min} min studied</div></div>)}
                  onMouseMove={amove}
                  onMouseLeave={ahide}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
                >
                  <div className="text-xs text-muted">{t.min}m</div>
                  <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (t.min / maxMin) * 50)}px`, background: 'var(--blue)', transition: 'height 0.3s' }} />
                  <div className="text-xs text-muted" style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{t.id.slice(-10)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Weekly Accuracy Line Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const now = new Date();
        const weeklyAccuracy: { label: string; accuracy: number }[] = [];
        for (let w = 7; w >= 0; w--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - w * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const label = `W${8 - w}`;
          const weekQuizzes = quizHistory.filter(q => {
            const qd = new Date(q.date);
            return qd >= weekStart && qd < weekEnd;
          });
          const accuracy = weekQuizzes.length > 0
            ? Math.round(weekQuizzes.reduce((acc, q) => acc + q.score, 0) / weekQuizzes.length)
            : 0;
          weeklyAccuracy.push({ label, accuracy });
        }
        const hasData = weeklyAccuracy.some(w => w.accuracy > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>Quiz Accuracy (Last 8 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average quiz score per week over the last 8 weeks. Hover data points on the chart for exact weekly averages.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Quiz Accuracy (Last 8 Weeks)
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {hasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyAccuracy}>
                    <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0}%`, 'Accuracy']} />
                    <Line type="monotone" dataKey="accuracy" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Daily Study Minutes Bar Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        interface DailyEntry { label: string; minutes: number; _key: string }
        const dailyMinutes: DailyEntry[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const _key = d.toISOString().split('T')[0];
          const label = dayNames[d.getDay()];
          dailyMinutes.push({ label, minutes: 0, _key });
        }
        // Try to sum minutes from coachData sessions
        const rawSessions = (data?.pluginData?.coachData?.sessions ?? []) as Record<string, unknown>[];
        if (rawSessions.length > 0) {
          rawSessions.forEach(s => {
            const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
            const mins = typeof s.minutes === 'number' ? s.minutes : typeof s.duration === 'number' ? s.duration : 0;
            const entry = dailyMinutes.find(e => e._key === sDate);
            if (entry) entry.minutes += mins;
          });
        }
        const hasData = dailyMinutes.some(d => d.minutes > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Study Minutes (Last 14 Days)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total study session minutes logged per day from coach/timer sessions. Hover bars for exact daily totals.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Study Minutes (Last 14 Days)
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {hasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyMinutes}>
                    <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0} min`, 'Study Time']} />
                    <Bar dataKey="minutes" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Card Maturity Pie Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const cards = srData?.cards ?? [];
        const maturityColors: Record<string, string> = {
          new: '#60a5fa',
          learning: '#fbbf24',
          review: '#4ade80',
          mature: '#a78bfa',
          relearning: '#fbbf24',
        };
        const maturityCounts: Record<string, number> = { new: 0, learning: 0, review: 0, mature: 0 };
        cards.forEach(c => {
          const s = (c.state || 'new').toLowerCase();
          if (s === 'new') maturityCounts.new++;
          else if (s === 'learning' || s === 'relearning') maturityCounts.learning++;
          else if (s === 'review') maturityCounts.review++;
          else maturityCounts.mature++;
        });
        const pieData = [
          { name: 'New', value: maturityCounts.new, color: maturityColors.new },
          { name: 'Learning', value: maturityCounts.learning, color: maturityColors.learning },
          { name: 'Review', value: maturityCounts.review, color: maturityColors.review },
          { name: 'Mature', value: maturityCounts.mature, color: maturityColors.mature },
        ].filter(d => d.value > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>Card Maturity Distribution</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your flashcards by FSRS learning state. New = never studied, Learning = short intervals, Review = graduated, Mature = interval ≥21 days. More mature cards = stronger long-term memory.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Card Maturity Distribution
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v, name) => [`${v ?? 0} cards`, String(name ?? '')]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 8 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#bbb' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Per-Subject Accuracy Bar Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const subjectMap = new Map<string, number[]>();
        quizHistory.forEach(q => {
          const subj = (q.subject || 'General').slice(0, 12);
          if (!subjectMap.has(subj)) subjectMap.set(subj, []);
          subjectMap.get(subj)!.push(q.score);
        });
        const subjectAccuracy = Array.from(subjectMap.entries()).map(([subject, scores]) => ({
          subject,
          accuracy: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        })).sort((a, b) => b.accuracy - a.accuracy);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>Accuracy by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average quiz score per subject across all quizzes taken. Hover bars for exact percentages.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Accuracy by Subject
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {subjectAccuracy.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={subjectAccuracy} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="subject" width={90} tick={{ fill: '#bbb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0}%`, 'Accuracy']} />
                    <Bar dataKey="accuracy" fill="#4ade80" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  )
}

/* ================================================================
   PLAN TAB
   ================================================================ */
