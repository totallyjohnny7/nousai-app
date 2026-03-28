import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  CalendarDays, Plus, Check, X, Trash2, ChevronDown, ChevronUp,
  AlertTriangle, Lightbulb, Sparkles, Star
} from 'lucide-react'
import { useStore } from '../../store'
import { generateFSRSAwarePlan } from '../../utils/studyPlan'
import type { StudyPlanInput } from '../../utils/studyPlan'

interface StudyBlock {
  id: string
  day: string
  course: string
  topic: string
  duration: number // minutes
  completed: boolean
}

export default function PlanTab() {
  const { courses, proficiency, srData, data } = useStore()

  const [blocks, setBlocks] = useState<StudyBlock[]>(() => {
    const saved = localStorage.getItem('nousai-study-plan')
    return saved ? JSON.parse(saved) : []
  })
  const [showAdd, setShowAdd] = useState(false)
  const [addDay, setAddDay] = useState('Mon')
  const [addCourse, setAddCourse] = useState('')
  const [addTopic, setAddTopic] = useState('')
  const [addDuration, setAddDuration] = useState(30)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  async function generateAIPlan() {
    if (courses.length === 0) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const { getCourseSpace } = await import('../../utils/courseSpaceInit')
      const { getDeckHealthByCourse } = await import('../../utils/fsrsStorage')
      const courseSpaces = data?.pluginData?.courseSpaces ?? undefined

      const inputs: StudyPlanInput[] = courses.map(course => {
        const space = getCourseSpace(courseSpaces, course.id)
        // Find nearest exam date for this course
        const examEvents = space.calendarEvents.filter(e => e.type === 'exam').sort((a, b) => a.date.localeCompare(b.date))
        const nextExam = examEvents.find(e => {
          const [y, m, d] = e.date.split('-').map(Number)
          return new Date(y, m - 1, d).getTime() >= Date.now()
        })
        // Collect weak topics from srData
        const courseCards = (srData?.cards ?? []).filter(c => c.subject === course.id)
        const weakTopics: string[] = []
        const seen = new Set<string>()
        for (const card of courseCards) {
          if (!card.S || card.S <= 0 || seen.has(card.subtopic)) continue
          const daysSince = (Date.now() - new Date(card.lastReview).getTime()) / 86400000
          const R = Math.exp(-daysSince / card.S)
          if (R < 0.75 && !seen.has(card.subtopic)) {
            weakTopics.push(card.subtopic)
            seen.add(card.subtopic)
          }
        }
        const weakCardCount = courseCards.filter(c => {
          if (!c.S || c.S <= 0) return false
          const daysSince = (Date.now() - new Date(c.lastReview).getTime()) / 86400000
          return Math.exp(-daysSince / c.S) < 0.75
        }).length
        void getDeckHealthByCourse // imported for side-effect check only
        return {
          courseId: course.id,
          courseName: course.name,
          examDate: nextExam?.date ?? null,
          weakCardCount,
          weakTopics,
          calendarEvents: space.calendarEvents,
        }
      })

      const result = await generateFSRSAwarePlan(inputs, 3)

      // Convert AI date-based blocks → day-name blocks (for existing weekly grid)
      const newBlocks: StudyBlock[] = result.days.flatMap(day => {
        const [y, m, d] = day.date.split('-').map(Number)
        const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
        return day.blocks.map(b => ({
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          day: dayName,
          course: b.courseName,
          topic: b.topic,
          duration: b.durationMin,
          completed: false,
        }))
      })

      saveBlocks([...blocks, ...newBlocks])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'OFFLINE') setAiError('You\'re offline — AI plan generation requires an internet connection.')
      else if (msg === 'TIMEOUT') setAiError('Request timed out. Check your connection and try again.')
      else setAiError('AI plan generation failed. Check your AI API key in Settings.')
    } finally {
      setAiGenerating(false)
    }
  }

  function saveBlocks(newBlocks: StudyBlock[]) {
    setBlocks(newBlocks)
    localStorage.setItem('nousai-study-plan', JSON.stringify(newBlocks))
  }

  function addBlock() {
    if (!addCourse) return
    const newBlock: StudyBlock = {
      id: Date.now().toString(),
      day: addDay,
      course: addCourse,
      topic: addTopic,
      duration: addDuration,
      completed: false
    }
    saveBlocks([...blocks, newBlock])
    setShowAdd(false)
    setAddTopic('')
    setAddDuration(30)
  }

  function toggleComplete(id: string) {
    saveBlocks(blocks.map(b => b.id === id ? { ...b, completed: !b.completed } : b))
  }

  function removeBlock(id: string) {
    saveBlocks(blocks.filter(b => b.id !== id))
  }

  // Auto-suggest: weak topics that need attention
  const suggestions = useMemo(() => {
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
    return weak.sort((a, b) => a.score - b.score).slice(0, 3)
  }, [proficiency])

  // Today's focus
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'short' })
  const todayBlocks = blocks.filter(b => b.day === todayName)

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  return (
    <div>
      {/* Today's focus */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Star size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Today's Focus ({todayName})</span>
          <span className="badge badge-blue">{todayBlocks.length} blocks</span>
        </div>
        {todayBlocks.length === 0 ? (
          <p className="text-sm text-muted">No study blocks scheduled for today.</p>
        ) : (
          todayBlocks.map(b => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--border)', opacity: b.completed ? 0.5 : 1
            }}>
              <button onClick={() => toggleComplete(b.id)} style={{
                width: 20, height: 20, borderRadius: 4, border: '2px solid var(--border)',
                background: b.completed ? 'var(--green)' : 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0
              }}>
                {b.completed && <Check size={12} style={{ color: 'white' }} />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: b.completed ? 'line-through' : 'none' }}>{b.course}</div>
                {b.topic && <div className="text-xs text-muted">{b.topic}</div>}
              </div>
              <span className="text-xs text-muted">{b.duration}m</span>
            </div>
          ))
        )}
      </div>

      {/* Suggestions based on weak areas */}
      {suggestions.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title"><Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Suggested Focus Areas</span>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <AlertTriangle size={14} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.topic}</div>
                <div className="text-xs text-muted">{s.subject} - {Math.max(0, Math.round(s.score))}% proficiency</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => {
                setAddCourse(s.subject)
                setAddTopic(s.topic)
                setShowAdd(true)
              }}>
                <Plus size={12} /> Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI error banner */}
      {aiError && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 0 }} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Weekly schedule grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}><CalendarDays size={18} /> Weekly Schedule</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={generateAIPlan}
            disabled={aiGenerating || courses.length === 0}
            aria-label="Generate AI study plan"
          >
            {aiGenerating ? <><Sparkles size={14} /> Generating…</> : <><Sparkles size={14} /> AI Plan</>}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> Add Block
          </button>
        </div>
      </div>

      {/* Add block form */}
      {showAdd && (
        <div className="card mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Day</div>
              <select value={addDay} onChange={e => setAddDay(e.target.value)} style={inputStyle}>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Duration (min)</div>
              <input type="number" value={addDuration} onChange={e => setAddDuration(+e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Course</div>
            <select value={addCourse} onChange={e => setAddCourse(e.target.value)} style={inputStyle}>
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.id} value={c.shortName || c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Topic (optional)</div>
            <input type="text" value={addTopic} onChange={e => setAddTopic(e.target.value)} placeholder="Topic or chapter..." style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={addBlock}>Add to Plan</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map(day => {
          const dayBlocks = blocks.filter(b => b.day === day)
          const isToday = day === todayName
          return (
            <div key={day} style={{
              background: isToday ? 'var(--accent-glow)' : 'var(--bg-card)',
              border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: 8, minHeight: 120
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textAlign: 'center',
                color: isToday ? 'var(--accent-light)' : 'var(--text-muted)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5
              }}>{day}</div>
              {dayBlocks.map(b => (
                <div key={b.id} style={{
                  padding: '4px 6px', marginBottom: 4, borderRadius: 4,
                  background: b.completed ? 'var(--green-dim)' : 'var(--bg-primary)',
                  border: '1px solid var(--border)', fontSize: 10, cursor: 'pointer',
                  opacity: b.completed ? 0.6 : 1
                }} onClick={() => toggleComplete(b.id)} onContextMenu={e => { e.preventDefault(); removeBlock(b.id) }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.course}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{b.duration}m</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted" style={{ marginTop: 8 }}>Click to toggle complete. Right-click to remove.</p>
    </div>
  )
}

/* ================================================================
   ANIMATED MONOCHROME BANNER
   ================================================================ */
