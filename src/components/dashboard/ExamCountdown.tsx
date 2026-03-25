import { Target } from 'lucide-react'
import { useStore } from '../../store'
import { getNextExamDays, getDeckHealthByCourse } from '../../utils/fsrsStorage'
import { getCourseSpace } from '../../utils/courseSpaceInit'

export default function ExamCountdown() {
  const { courses, srData, data } = useStore()

  if (courses.length === 0) return null

  const courseSpaces = data?.pluginData?.courseSpaces

  const items = courses
    .map(course => {
      const space = getCourseSpace(courseSpaces, course.id)
      const daysUntilExam = getNextExamDays(space.calendarEvents)
      if (daysUntilExam === null || daysUntilExam < 0) return null

      const now = Date.now()
      const weakCards = (srData?.cards ?? []).filter(c => {
        if (c.subject !== course.id) return false
        if (c.state === 'new') return false
        const isDue = new Date(c.nextReview) <= new Date()
        const daysSince = (now - new Date(c.lastReview).getTime()) / 86400000
        const R = c.S > 0 ? Math.exp(-daysSince / c.S) : 0
        return isDue || R < 0.75
      }).length

      const cardsPerDay =
        daysUntilExam > 0 ? Math.ceil(weakCards / daysUntilExam) : null

      const deckHealth = getDeckHealthByCourse(srData, course.id)

      return { course, daysUntilExam, weakCards, cardsPerDay, deckHealth }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 className="section-title"><Target size={18} /> Exam Countdown</h3>

      {items.length === 0 ? (
        <div className="card" style={{ padding: '12px 16px' }}>
          <span className="text-muted text-xs">No upcoming exams scheduled</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(({ course, daysUntilExam, weakCards, cardsPerDay, deckHealth }) => (
            <div key={course.id} className="card" style={{ padding: '14px 16px' }}>
              {/* Course name */}
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 6 }}>
                {course.name}
              </div>

              {/* Exam timing */}
              {daysUntilExam === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--orange)', fontWeight: 600, marginBottom: 6 }}>
                  Exam is today — review all weak cards now
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Exam in {daysUntilExam} day{daysUntilExam !== 1 ? 's' : ''}
                </div>
              )}

              {/* Weak cards / cards per day */}
              {weakCards === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 600, marginBottom: 8 }}>
                  All cards reviewed ✓
                </div>
              ) : daysUntilExam === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {weakCards} weak card{weakCards !== 1 ? 's' : ''} to review
                </div>
              ) : cardsPerDay !== null && cardsPerDay > 40 ? (
                <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 600, marginBottom: 8 }}>
                  High workload — {cardsPerDay} cards/day ({weakCards} weak cards)
                </div>
              ) : cardsPerDay !== null ? (
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {weakCards} weak card{weakCards !== 1 ? 's' : ''} → review {cardsPerDay}/day
                </div>
              ) : null}

              {/* Deck health progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.round(deckHealth))}%`,
                    background: deckHealth >= 75 ? 'var(--green)' : deckHealth >= 50 ? 'var(--yellow)' : 'var(--red)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <span className="text-xs text-muted" style={{ minWidth: 36, textAlign: 'right' }}>
                  {Math.min(100, Math.round(deckHealth))}% R
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
