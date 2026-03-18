import { useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import type { CourseCalendarEvent } from '../../types'

// ─── Sorting priority for event types ──────────────────────────────────────

const TYPE_ORDER: Record<CourseCalendarEvent['type'], number> = {
  exam: 0,
  quiz: 1,
  assignment: 2,
  lab: 3,
  other: 4,
}

// ─── Type chip styles ───────────────────────────────────────────────────────

const TYPE_CHIP_STYLE: Record<
  CourseCalendarEvent['type'],
  { background: string; color: string }
> = {
  exam: {
    background: 'color-mix(in srgb, var(--red) 15%, transparent)',
    color: 'var(--red)',
  },
  quiz: {
    background: 'color-mix(in srgb, var(--yellow) 15%, transparent)',
    color: 'var(--yellow)',
  },
  assignment: {
    background: 'color-mix(in srgb, var(--blue) 15%, transparent)',
    color: 'var(--blue)',
  },
  lab: {
    background: 'color-mix(in srgb, var(--green) 15%, transparent)',
    color: 'var(--green)',
  },
  other: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-muted)',
  },
}

// ─── Date helpers ───────────────────────────────────────────────────────────

function localMidnightMs(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

function toYMD(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatDateHeader(dateStr: string, today: string, tomorrow: string): string {
  if (dateStr === today) return 'Today'
  if (dateStr === tomorrow) return 'Tomorrow'
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ─── Component ──────────────────────────────────────────────────────────────

interface EnrichedEvent extends CourseCalendarEvent {
  courseName: string
}

export default function GlobalCalendarWidget() {
  const { data, courses } = useStore()
  const courseSpaces = data?.pluginData?.courseSpaces

  const { today, tomorrow, sevenDaysOut } = useMemo(() => {
    const now = new Date()
    const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowDate = new Date(todayDate)
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const sevenOut = new Date(todayDate)
    sevenOut.setDate(sevenOut.getDate() + 6) // inclusive: today + 6 more = 7 days total
    return {
      today: toYMD(todayDate),
      tomorrow: toYMD(tomorrowDate),
      sevenDaysOut: toYMD(sevenOut),
    }
  }, [])

  const grouped = useMemo(() => {
    const enriched: EnrichedEvent[] = []

    for (const course of courses) {
      const space = getCourseSpace(courseSpaces, course.id)
      for (const event of space.calendarEvents) {
        if (event.date >= today && event.date <= sevenDaysOut) {
          enriched.push({ ...event, courseName: course.name })
        }
      }
    }

    // Sort: date → type priority → title alpha
    enriched.sort((a, b) => {
      const dateDiff = localMidnightMs(a.date) - localMidnightMs(b.date)
      if (dateDiff !== 0) return dateDiff
      const typeDiff = TYPE_ORDER[a.type] - TYPE_ORDER[b.type]
      if (typeDiff !== 0) return typeDiff
      return a.title.localeCompare(b.title)
    })

    // Group by date
    const map = new Map<string, EnrichedEvent[]>()
    for (const ev of enriched) {
      const existing = map.get(ev.date)
      if (existing) {
        existing.push(ev)
      } else {
        map.set(ev.date, [ev])
      }
    }
    return map
  }, [courses, courseSpaces, today, sevenDaysOut])

  const isEmpty = grouped.size === 0

  return (
    <div className="card mb-4">
      <h3 className="section-title" style={{ marginBottom: 14 }}>
        <Calendar size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        This Week
      </h3>

      {isEmpty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 0',
            color: 'var(--text-muted)',
            fontSize: 13,
          }}
        >
          No upcoming deadlines this week 🎉
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Array.from(grouped.entries()).map(([dateStr, events]) => (
            <div key={dateStr}>
              {/* Date header */}
              <h4
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: dateStr === today ? 'var(--color-accent)' : 'var(--text-dim)',
                  marginBottom: 6,
                }}
              >
                {formatDateHeader(dateStr, today, tomorrow)}
              </h4>

              {/* Events for this date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {events.map(ev => {
                  const chipStyle = TYPE_CHIP_STYLE[ev.type]
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {/* Type chip */}
                      <span
                        aria-label={ev.type}
                        style={{
                          display: 'inline-block',
                          padding: '2px 7px',
                          borderRadius: 99,
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'capitalize',
                          flexShrink: 0,
                          background: chipStyle.background,
                          color: chipStyle.color,
                        }}
                      >
                        {ev.type}
                      </span>

                      {/* Event title */}
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
                      >
                        {ev.title}
                      </span>

                      {/* Course name */}
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          flexShrink: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 100,
                        }}
                      >
                        {ev.courseName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
