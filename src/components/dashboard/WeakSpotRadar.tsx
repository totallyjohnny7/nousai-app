import { AlertTriangle } from 'lucide-react'
import { useStore } from '../../store'
import { getWeakSpots } from '../../utils/weakSpots'

export default function WeakSpotRadar() {
  const { srData, courses, data } = useStore()

  if (courses.length === 0 && (srData?.cards?.length ?? 0) === 0) return null

  const proficiency = data?.pluginData?.proficiencyData ?? null
  const spots = getWeakSpots(srData, proficiency, courses)

  const priorityColor = {
    high: 'var(--red)',
    medium: 'var(--orange)',
    low: 'var(--yellow)',
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <h3 className="section-title"><AlertTriangle size={18} /> Weak Spots</h3>

      {spots.length === 0 ? (
        <div className="card" style={{ padding: '12px 16px' }}>
          <span className="text-muted text-xs">No weak spots — all topics well retained! 🎉</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {spots.map((spot, i) => (
            <div key={`${spot.courseId}-${spot.subtopic}-${i}`} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                {/* Subtopic name */}
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', flex: 1, minWidth: 0 }}>
                  {spot.subtopic}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {/* Course badge */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border)',
                    maxWidth: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {spot.courseName}
                  </span>

                  {/* Priority badge */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 4,
                    color: '#fff',
                    background: priorityColor[spot.priority],
                    textTransform: 'uppercase',
                  }}>
                    {spot.priority}
                  </span>
                </div>
              </div>

              {/* Retention bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  background: 'var(--border)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.round(spot.retentionR * 100)}%`,
                    background: spot.retentionR >= 0.5 ? 'var(--yellow)' : 'var(--red)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                {spot.retentionR === 0 ? (
                  <span className="text-xs text-muted" style={{ minWidth: 72, textAlign: 'right' }}>Not reviewed</span>
                ) : (
                  <span className="text-xs text-muted" style={{ minWidth: 72, textAlign: 'right' }}>
                    {Math.round(spot.retentionR * 100)}% retention
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
