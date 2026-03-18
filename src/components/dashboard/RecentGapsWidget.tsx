import { useMemo } from 'react'
import { Target } from 'lucide-react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import type { ExamReview } from '../../types'

interface FlatWeakConcept {
  concept: string
  wrongCount: number
  pointsLost: number
  priority: 'high' | 'medium' | 'low'
  courseId: string
  courseName: string
  examTitle: string
  examDate: string
}

const PRIORITY_ORDER: Record<'high' | 'medium' | 'low', number> = {
  high: 0,
  medium: 1,
  low: 2,
}

const PRIORITY_COLORS: Record<'high' | 'medium' | 'low', string> = {
  high: 'var(--red)',
  medium: 'var(--orange)',
  low: 'var(--yellow)',
}

export default function RecentGapsWidget() {
  const { courses, data } = useStore()
  const courseSpaces = data?.pluginData?.courseSpaces ?? undefined

  const topConcepts = useMemo((): FlatWeakConcept[] => {
    if (courses.length === 0) return []

    const flat: FlatWeakConcept[] = []

    for (const course of courses) {
      const space = getCourseSpace(courseSpaces, course.id)
      // Find the most recent completed gap report review
      const reviews: ExamReview[] = (space.examReviews ?? [])
        .filter(r => r.gapReportComplete)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

      if (reviews.length === 0) continue

      const review = reviews[0]
      for (const wc of review.gapReport.weakConcepts) {
        flat.push({
          concept: wc.concept,
          wrongCount: wc.wrongCount,
          pointsLost: wc.pointsLost,
          priority: wc.priority,
          courseId: course.id,
          courseName: course.name,
          examTitle: review.title,
          examDate: review.date,
        })
      }
    }

    flat.sort((a, b) => {
      const po = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      if (po !== 0) return po
      return b.pointsLost - a.pointsLost
    })

    return flat.slice(0, 3)
  }, [courses, courseSpaces])

  if (courses.length === 0) return null

  return (
    <div className="mb-5">
      <h3 className="section-title">
        <Target size={18} /> Recent Gaps
      </h3>
      <div className="card" style={{ padding: '12px 16px' }}>
        {topConcepts.length === 0 ? (
          <p
            className="text-muted"
            style={{ margin: 0, fontSize: 14, textAlign: 'center', padding: '4px 0' }}
          >
            No gap reports yet — log an exam review to see weak concepts.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {topConcepts.map((item, idx) => (
              <li key={`${item.courseId}-${item.concept}-${idx}`} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  {/* Concept name */}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.concept}
                  >
                    {item.concept}
                  </span>
                  {/* Priority badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm, 4px)',
                      background: `${PRIORITY_COLORS[item.priority]}22`,
                      color: PRIORITY_COLORS[item.priority],
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      textTransform: 'capitalize',
                    }}
                  >
                    {item.priority}
                  </span>
                </div>
                {/* Course + exam info */}
                <div
                  className="text-xs text-muted"
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={`${item.courseName} · ${item.examTitle}`}
                >
                  {item.courseName} · {item.examTitle}
                </div>
                {/* Stats */}
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  {item.wrongCount} wrong answer{item.wrongCount !== 1 ? 's' : ''}, {item.pointsLost} pt{item.pointsLost !== 1 ? 's' : ''} lost
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
