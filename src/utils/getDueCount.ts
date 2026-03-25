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

// Cache parsed localStorage to avoid re-parsing on every call within the same tick
let cachedFSRS: Record<string, { state?: string; nextReview?: string }> | null = null
let cachedFSRSRaw: string | null = null
let cachedDaily: any = null
let cachedDailyRaw: string | null = null

function getCachedFSRS(): Record<string, { state?: string; nextReview?: string }> {
  const raw = localStorage.getItem(FSRS_KEY) || '{}'
  if (raw !== cachedFSRSRaw) {
    cachedFSRSRaw = raw
    try { cachedFSRS = JSON.parse(raw) } catch { cachedFSRS = {} }
  }
  return cachedFSRS!
}

function getCachedDaily(): any {
  const raw = localStorage.getItem(DAILY_KEY) || '{}'
  if (raw !== cachedDailyRaw) {
    cachedDailyRaw = raw
    try { cachedDaily = JSON.parse(raw) } catch { cachedDaily = {} }
  }
  return cachedDaily
}

export function getDueCount(
  courses: MinCourse[],
  courseCardCaps?: Record<string, number>
): number {
  try {
    const allFSRS = getCachedFSRS()
    const dailyRaw = getCachedDaily()
    const todayStr = new Date().toISOString().split('T')[0]
    const dailyCounts: Record<string, number> =
      dailyRaw.date === todayStr ? (dailyRaw.counts ?? {}) : {}
    const caps = courseCardCaps ?? {}
    const now = Date.now()
    let total = 0
    for (const c of courses) {
      const cards = c.flashcards
      if (!cards || cards.length === 0) continue
      const cap = caps[c.id] ?? DEFAULT_CAP
      const remaining = Math.max(0, cap - (dailyCounts[c.id] ?? 0))
      if (remaining === 0) continue
      let due = 0
      for (const card of cards) {
        const key = `${c.id}::${card.front.slice(0, 50)}`
        const fc = allFSRS[key]
        if (!fc || fc.state === 'new' || new Date(fc.nextReview ?? 0).getTime() <= now) due++
        if (due >= remaining) break // no need to count beyond cap
      }
      total += Math.min(due, remaining)
    }
    return total
  } catch {
    return 0
  }
}
