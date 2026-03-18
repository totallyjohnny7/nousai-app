import { useMemo } from 'react'
import { Brain } from 'lucide-react'
import { useStore } from '../../store'
import { getDeckHealthByCourse } from '../../utils/fsrsStorage'

function healthColor(r: number): string {
  if (r >= 0.85) return 'var(--green)'
  if (r >= 0.75) return 'var(--yellow)'
  return 'var(--red)'
}

export default function DecayRadar() {
  const { courses, srData } = useStore()

  const courseHealthList = useMemo(() => {
    if (courses.length === 0) return []
    return courses.map(course => {
      const r = getDeckHealthByCourse(srData, course.id)
      const cards = srData?.cards?.filter(c => c.subject === course.id) ?? []
      const newCount = cards.filter(c => c.state === 'new').length
      return { courseId: course.id, courseName: course.name, r, newCount, totalCards: cards.length }
    })
  }, [courses, srData])

  if (courses.length === 0) return null

  const hasAnyCards = (srData?.cards?.length ?? 0) > 0

  return (
    <div className="mb-5">
      <h3 className="section-title">
        <Brain size={18} /> Deck Health
      </h3>
      <div className="card" style={{ padding: '12px 16px' }}>
        {!hasAnyCards ? (
          <p
            className="text-muted"
            style={{ margin: 0, fontSize: 14, textAlign: 'center', padding: '4px 0' }}
          >
            No flashcard decks yet
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {courseHealthList.map(item => {
              const pct = Math.round(item.r * 100)
              const color = healthColor(item.r)
              return (
                <li key={item.courseId} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Row: course name + percent */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
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
                      title={item.courseName}
                    >
                      {item.courseName}
                    </span>
                    <span
                      style={{
                        fontFamily: 'DM Mono, monospace',
                        fontSize: 12,
                        fontWeight: 700,
                        color,
                        flexShrink: 0,
                      }}
                    >
                      {pct}%
                    </span>
                  </div>

                  {/* Health bar */}
                  <div
                    style={{
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--border)',
                      overflow: 'hidden',
                    }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${item.courseName} deck health: ${pct}%`}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: color,
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* New cards badge */}
                  {item.newCount > 0 && (
                    <div
                      className="text-xs text-muted"
                      title="These cards haven't been reviewed yet"
                      style={{ cursor: 'default' }}
                    >
                      {item.newCount} new
                    </div>
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
