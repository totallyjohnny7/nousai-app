/**
 * Shared FSRS-aware due card count — single source of truth for the
 * nav badge (App.tsx) and the dashboard stat (Dashboard.tsx).
 * Matches Flashcards.tsx logic: reads nousai-fc-fsrs, applies per-course daily caps.
 */

const FSRS_KEY = 'nousai-fc-fsrs'
const DAILY_KEY = 'nousai-daily-card-progress'
const DEFAULT_CAP = 50

interface MinCourse {
  id: string
  flashcards?: Array<{ front: string }>
}

export function getDueCount(
  courses: MinCourse[],
  courseCardCaps?: Record<string, number>
): number {
  try {
    const allFSRS: Record<string, { state?: string; nextReview?: string }> =
      JSON.parse(localStorage.getItem(FSRS_KEY) || '{}')
    const dailyRaw = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}')
    const todayStr = new Date().toISOString().split('T')[0]
    const dailyCounts: Record<string, number> =
      dailyRaw.date === todayStr ? (dailyRaw.counts ?? {}) : {}
    const caps = courseCardCaps ?? {}
    const now = Date.now()
    let total = 0
    for (const c of courses) {
      const cap = caps[c.id] ?? DEFAULT_CAP
      const remaining = Math.max(0, cap - (dailyCounts[c.id] ?? 0))
      let due = 0
      for (const card of (c.flashcards ?? [])) {
        const key = `${c.id}::${card.front.slice(0, 50)}`
        const fc = allFSRS[key]
        if (!fc || fc.state === 'new' || new Date(fc.nextReview ?? 0).getTime() <= now) due++
      }
      total += Math.min(due, remaining)
    }
    return total
  } catch {
    return 0
  }
}
