import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import { gradeTrend } from '../../utils/gradeCalculator'
import { getNextExamDays, getDeckHealthByCourse } from '../../utils/fsrsStorage'
import type { Course, CourseSpace, SRData } from '../../types'

// ── Priority score ────────────────────────────────────────────────────────────

function priorityScore(
  _course: Course,
  space: CourseSpace,
  srData: SRData | null,
  courseId: string,
): number {
  const nearestExam = getNextExamDays(space.calendarEvents)
  const trend = gradeTrend(space.gradeEntries)
  const avgRetention = getDeckHealthByCourse(srData, courseId)
  return (
    (nearestExam !== null && nearestExam < 7
      ? 50
      : nearestExam !== null && nearestExam < 14
        ? 25
        : 0) +
    (trend === 'down' ? 30 : 0) +
    (avgRetention < 0.75 ? 20 : avgRetention < 0.85 ? 10 : 0)
  )
}

// ── Badge config ──────────────────────────────────────────────────────────────

type BadgeKind = 'exam' | 'grade' | 'retention'

const BADGE_CONFIG: Record<BadgeKind, { label: string; bg: string; color: string; ariaLabel: string }> = {
  exam: {
    label: 'Exam soon',
    bg: 'rgba(239,68,68,0.15)',
    color: 'var(--red)',
    ariaLabel: 'Exam coming up soon',
  },
  grade: {
    label: 'Grade trending down',
    bg: 'rgba(245,130,30,0.15)',
    color: 'var(--orange)',
    ariaLabel: 'Grade is trending downward',
  },
  retention: {
    label: 'Retention dropping',
    bg: 'rgba(234,179,8,0.15)',
    color: 'var(--yellow)',
    ariaLabel: 'Flashcard retention is dropping',
  },
}

// Badge tier follows score range as per spec:
// ≥50 = "Exam soon", 30-49 = "Grade trending down", 10-29 = "Retention dropping"
function badgeKindForScore(score: number): BadgeKind | null {
  if (score >= 50) return 'exam'
  if (score >= 30) return 'grade'
  if (score >= 10) return 'retention'
  return null
}

// ── Course dot color (cycles through accent palette) ─────────────────────────

const DOT_COLORS = [
  'var(--color-accent)',
  'var(--green)',
  'var(--yellow)',
  '#8b5cf6',
  '#3b82f6',
  '#ec4899',
]

function dotColor(index: number): string {
  return DOT_COLORS[index % DOT_COLORS.length]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudyPriorityWidget() {
  const { courses, data, srData } = useStore()
  const courseSpaces = data?.pluginData?.courseSpaces ?? undefined

  const ranked = useMemo(() => {
    if (courses.length === 0) return []
    return courses
      .map(course => {
        const space = getCourseSpace(courseSpaces, course.id)
        const score = priorityScore(course, space, srData, course.id)
        return { course, space, score }
      })
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.course.name.localeCompare(b.course.name),
      )
      .slice(0, 3)
  }, [courses, courseSpaces, srData])

  if (courses.length === 0) return null

  const topItems = ranked.filter(item => item.score >= 10)

  return (
    <div className="mb-5">
      <h3 className="section-title">
        <TrendingUp size={18} /> Study Priority
      </h3>
      <div className="card" style={{ padding: '12px 16px' }}>
        {topItems.length === 0 ? (
          <p
            className="text-muted"
            style={{ margin: 0, fontSize: 14, textAlign: 'center', padding: '4px 0' }}
          >
            All courses on track 🎉
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topItems.map(({ course, space, score }, idx) => {
              const kind = badgeKindForScore(score)
              const badge = kind ? BADGE_CONFIG[kind] : null
              return (
                <li
                  key={course.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}
                >
                  {/* Color dot */}
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: dotColor(idx),
                      flexShrink: 0,
                    }}
                    aria-hidden="true"
                  />

                  {/* Course name */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}
                    title={course.name}
                  >
                    {course.name}
                  </span>

                  {/* Priority badge */}
                  {badge && (
                    <span
                      aria-label={badge.ariaLabel}
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm, 4px)',
                        background: badge.bg,
                        color: badge.color,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {badge.label}
                    </span>
                  )}

                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
