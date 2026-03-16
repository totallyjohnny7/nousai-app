import { useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import { calculateFinalGrade, gradeTrend } from '../../utils/gradeCalculator'
import type { CourseCalendarEvent, CanvasLiveCourse, CanvasLiveAssignment } from '../../types'

// ─── Event type icon map ────────────────────────────────────────────────────

const EVENT_ICONS: Record<CourseCalendarEvent['type'], string> = {
  assignment: '📝',
  exam: '📅',
  quiz: '📋',
  lab: '🔬',
  other: '📌',
}

// ─── Local midnight — avoids UTC offset making YYYY-MM-DD dates off by 1 day ─

function localMidnightMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

// ─── Deadline label helper ───────────────────────────────────────────────────

function deadlineLabel(daysUntil: number, title: string, type: CourseCalendarEvent['type']): string {
  const icon = EVENT_ICONS[type]
  if (daysUntil === 0) return `${icon} ${title} — Today`
  if (daysUntil === 1) return `${icon} ${title} — Tomorrow`
  return `${icon} ${title} — in ${daysUntil} days`
}

// ─── Canvas live course matching ─────────────────────────────────────────────

function matchLiveCourse(live: CanvasLiveCourse[], localName: string): CanvasLiveCourse | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const n = norm(localName)
  return live.find(c => norm(c.name).includes(n) || n.includes(norm(c.courseCode))) ?? null
}

function canvasScoreColor(score: number): string {
  if (score >= 90) return 'var(--green, #22c55e)'
  if (score >= 80) return '#eab308'   // yellow
  if (score >= 70) return '#f97316'   // orange
  return 'var(--red, #ef4444)'
}

// ─── CourseCards ─────────────────────────────────────────────────────────────

export default function CourseCards() {
  const navigate = useNavigate()
  const { data, courses } = useStore()

  if (courses.length === 0) return null

  const courseSpaces = data?.pluginData?.courseSpaces
  const canvasLive = data?.pluginData?.canvasLive
  const liveCourses: CanvasLiveCourse[] = canvasLive?.courses ?? []
  const liveAssignments: CanvasLiveAssignment[] = canvasLive?.assignments ?? []
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  return (
    <div className="mb-5">
      <h3 className="section-title">
        <GraduationCap size={18} /> Courses
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        {courses.map(course => {
          const space = getCourseSpace(courseSpaces, course.id)
          const gradeResult = calculateFinalGrade(space.gradeCategories, space.gradeEntries)
          const hasGrades = gradeResult.letter !== '—'

          // Grade trend — only show if ≥3 entries
          const trend =
            space.gradeEntries.filter(e => e.score !== null).length >= 3
              ? gradeTrend(space.gradeEntries)
              : 'neutral'

          // Nearest upcoming event
          const upcomingEvents = space.calendarEvents
            .filter(e => e.date >= today)
            .sort((a, b) => a.date.localeCompare(b.date))
          const nearest = upcomingEvents[0] ?? null

          const daysUntil = nearest
            ? Math.round(
                (localMidnightMs(nearest.date) - localMidnightMs(today)) / 86400000
              )
            : null

          // Canvas live grade
          const matchedCanvas = matchLiveCourse(liveCourses, course.name)
          const canvasScore = matchedCanvas?.currentScore ?? null

          // Canvas upcoming assignments (top 3, due today or later)
          const courseAssignments = matchedCanvas
            ? liveAssignments
                .filter(a => a.courseId === matchedCanvas.canvasId)
                .filter(a => a.dueAt !== null)
                .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
            : []
          const nowIso = new Date().toISOString()
          const upcomingCanvas = courseAssignments
            .filter(a => (a.dueAt ?? '') >= nowIso && a.submissionState !== 'submitted' && a.submissionState !== 'graded')
            .slice(0, 3)
          const overdueCanvas = courseAssignments
            .filter(a => (a.dueAt ?? '') < nowIso && a.submissionState !== 'submitted' && a.submissionState !== 'graded')
            .slice(0, 2)

          // Handlers
          const handleNavigate = () => navigate(`/course/${course.id}`)
          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleNavigate()
            }
          }

          return (
            <div
              key={course.id}
              className="card"
              role="button"
              tabIndex={0}
              aria-label={`Go to ${course.name}${hasGrades ? `, grade ${gradeResult.letter} ${gradeResult.percent}%` : ', no grades yet'}${nearest && daysUntil !== null ? `, next: ${nearest.title} in ${daysUntil} days` : ''}`}
              onClick={handleNavigate}
              onKeyDown={handleKeyDown}
              style={{
                cursor: 'pointer',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                outline: 'none',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'scale(1.02)'
                el.style.boxShadow = '0 4px 16px var(--shadow, rgba(0,0,0,0.35))'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.transform = 'scale(1)'
                el.style.boxShadow = (document.activeElement === el) ? '0 0 0 2px var(--color-accent)' : ''
              }}
              onFocus={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 0 0 2px var(--color-accent)'
              }}
              onBlur={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = ''
              }}
            >
              {/* Course name row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {course.color && (
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: course.color,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {course.shortName || course.name}
                </span>
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--border)' }} />

              {/* Grade row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Grade:
                </span>
                {hasGrades ? (
                  <>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-mono, DM Mono, monospace)',
                      }}
                    >
                      {gradeResult.letter} ({gradeResult.percent}%)
                    </span>
                    {trend === 'up' && (
                      <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 700 }}>↑</span>
                    )}
                    {trend === 'down' && (
                      <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700 }}>↓</span>
                    )}
                  </>
                ) : (
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    No grades yet
                  </span>
                )}
              </div>

              {/* Canvas live grade badge */}
              {canvasScore !== null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Canvas:
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#000',
                      background: canvasScoreColor(canvasScore),
                      borderRadius: 4,
                      padding: '1px 6px',
                      fontFamily: 'var(--font-mono, DM Mono, monospace)',
                    }}
                  >
                    {canvasScore.toFixed(1)}%
                  </span>
                </div>
              )}

              {/* Canvas upcoming assignments */}
              {(upcomingCanvas.length > 0 || overdueCanvas.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Due Soon
                  </span>
                  {overdueCanvas.map(a => (
                    <a
                      key={a.id}
                      href={a.htmlUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: 11,
                        color: 'var(--red, #ef4444)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textDecoration: 'none',
                      }}
                      title={`Overdue: ${a.name}`}
                    >
                      ⚠ {a.name}
                    </a>
                  ))}
                  {upcomingCanvas.map(a => {
                    const due = a.dueAt ? new Date(a.dueAt) : null
                    const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null
                    const urgent = daysLeft !== null && daysLeft <= 1
                    return (
                      <a
                        key={a.id}
                        href={a.htmlUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 11,
                          color: urgent ? '#f97316' : 'var(--text-primary)',
                          fontWeight: urgent ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          textDecoration: 'none',
                        }}
                        title={due ? `Due: ${due.toLocaleDateString()}` : a.name}
                      >
                        📝 {a.name}{daysLeft !== null ? ` (${daysLeft}d)` : ''}
                      </a>
                    )
                  })}
                </div>
              )}

              {/* Nearest deadline row */}
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Next:{' '}
                </span>
                {nearest !== null && daysUntil !== null ? (
                  <span
                    style={{
                      fontSize: 11,
                      color: daysUntil === 0 ? 'var(--red)' : daysUntil === 1 ? 'var(--yellow)' : 'var(--text-primary)',
                      fontWeight: daysUntil <= 1 ? 700 : 500,
                    }}
                  >
                    {deadlineLabel(daysUntil, nearest.title, nearest.type)}
                  </span>
                ) : (
                  <span className="text-muted" style={{ fontSize: 11 }}>
                    No deadlines
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
