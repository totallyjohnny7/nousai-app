import { useStore } from '../../store'
import type { CanvasLiveAssignment, CanvasLiveCourse } from '../../types'

interface AssignmentRow extends CanvasLiveAssignment {
  courseName: string
  courseCode: string
  daysLeft: number | null
}

function buildRows(
  assignments: CanvasLiveAssignment[],
  courses: CanvasLiveCourse[],
  nowIso: string
): AssignmentRow[] {
  const courseMap = new Map(courses.map(c => [c.canvasId, c]))
  return assignments
    .filter(a =>
      a.dueAt !== null &&
      a.submissionState !== 'submitted' &&
      a.submissionState !== 'graded'
    )
    .map(a => {
      const c = courseMap.get(a.courseId)
      const daysLeft = a.dueAt
        ? Math.ceil((new Date(a.dueAt).getTime() - Date.now()) / 86400000)
        : null
      return {
        ...a,
        courseName: c?.name ?? 'Unknown',
        courseCode: c?.courseCode ?? '',
        daysLeft,
      }
    })
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

export default function UpcomingAssignmentsWidget() {
  const { data } = useStore()
  const canvasLive = data?.pluginData?.canvasLive
  const courses: CanvasLiveCourse[] = canvasLive?.courses ?? []
  const assignments: CanvasLiveAssignment[] = canvasLive?.assignments ?? []

  if (courses.length === 0 || assignments.length === 0) return null

  const nowIso = new Date().toISOString()
  const rows = buildRows(assignments, courses, nowIso)

  const overdue = rows.filter(r => r.daysLeft !== null && r.daysLeft < 0).slice(0, 3)
  const upcoming = rows.filter(r => r.daysLeft === null || r.daysLeft >= 0).slice(0, 10)

  if (overdue.length === 0 && upcoming.length === 0) return null

  return (
    <div className="mb-5">
      <h3 className="section-title">
        <span style={{ fontSize: 18 }}>📋</span> Canvas Assignments
      </h3>

      <div className="card" style={{ padding: '12px 16px' }}>
        {overdue.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red, #ef4444)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              ⚠ Overdue
            </div>
            {overdue.map(a => (
              <AssignmentLine key={a.id} row={a} overdue />
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Upcoming
            </div>
            {upcoming.map(a => (
              <AssignmentLine key={a.id} row={a} overdue={false} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AssignmentLine({ row, overdue }: { row: AssignmentRow; overdue: boolean }) {
  const dueLabel = row.dueAt
    ? new Date(row.dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null
  const urgent = !overdue && row.daysLeft !== null && row.daysLeft <= 2

  return (
    <a
      href={row.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        textDecoration: 'none',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Course code pill */}
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--text-secondary)',
          background: 'var(--bg-hover, rgba(255,255,255,0.06))',
          borderRadius: 3,
          padding: '1px 5px',
          flexShrink: 0,
          maxWidth: 70,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={row.courseName}
      >
        {row.courseCode || row.courseName}
      </span>

      {/* Assignment name */}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: overdue ? 'var(--red, #ef4444)' : urgent ? '#f97316' : 'var(--text-primary)',
          fontWeight: overdue || urgent ? 600 : 400,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {row.name}
      </span>

      {/* Due date / countdown */}
      {dueLabel && (
        <span
          style={{
            fontSize: 11,
            color: overdue ? 'var(--red, #ef4444)' : urgent ? '#f97316' : 'var(--text-secondary)',
            fontWeight: overdue || urgent ? 700 : 400,
            flexShrink: 0,
            fontFamily: 'var(--font-mono, DM Mono, monospace)',
          }}
        >
          {overdue ? `${Math.abs(row.daysLeft ?? 0)}d ago` : row.daysLeft === 0 ? 'Today' : row.daysLeft === 1 ? 'Tomorrow' : dueLabel}
        </span>
      )}
    </a>
  )
}
