/**
 * Browser Push Notification utilities for NousAI Companion.
 *
 * Handles:
 * - Permission requests
 * - Pomodoro phase-completion notifications
 * - Spaced-repetition review reminders
 * - Generic one-off notifications
 * - Periodic background checks for due SR cards
 */

import type { SRCard, CanvasLiveAssignment, ReminderTarget } from '../types'

/* ─── internal state ──────────────────────────────────────── */

let reviewCheckInterval: ReturnType<typeof setInterval> | null = null
let assignmentReminderInterval: ReturnType<typeof setInterval> | null = null
// Track which assignment IDs we've already notified (persists for session)
const notifiedAssignments = new Set<string>()

/* ─── helpers ─────────────────────────────────────────────── */

function isSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function isGranted(): boolean {
  return isSupported() && Notification.permission === 'granted'
}

/* ─── public API ──────────────────────────────────────────── */

/**
 * Request notification permission from the user.
 * Returns `true` if permission was granted, `false` otherwise.
 */
export async function requestPermission(): Promise<boolean> {
  if (!isSupported()) return false

  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Show a Pomodoro phase-completion notification.
 *
 * @param phase - The phase that just finished, e.g. "work", "break", "longBreak".
 */
export function notifyPomodoroComplete(phase: string): void {
  if (!isGranted()) return

  const isWork = phase === 'work'
  const title = isWork ? 'Focus session complete!' : 'Break is over!'
  const body = isWork
    ? 'Great work! Time to take a well-deserved break.'
    : 'Feeling refreshed? Let\'s get back to studying.'
  const icon = isWork ? '/icons/break.png' : '/icons/focus.png'

  try {
    new Notification(title, {
      body,
      icon,
      tag: 'nousai-pomodoro',          // replaces previous pomodoro notification
      requireInteraction: false,
    })
  } catch {
    // Fallback: some environments (e.g. older mobile browsers) may throw
  }
}

/**
 * Notify the user that spaced-repetition cards are due for review.
 *
 * @param count - Number of cards currently due.
 */
export function notifySRDue(count: number): void {
  if (!isGranted() || count <= 0) return

  const plural = count === 1 ? 'card is' : 'cards are'

  try {
    new Notification('Cards due for review', {
      body: `${count} ${plural} ready for review. Keep your streak going!`,
      icon: '/icons/flashcard.png',
      tag: 'nousai-sr-due',            // collapse repeated reminders
      requireInteraction: false,
    })
  } catch {
    // silently ignore
  }
}

/**
 * Start a periodic check (default: every hour) that fires a notification
 * whenever SR cards become due.
 *
 * Calling this again will restart the interval with the latest card list.
 *
 * @param cards - The full list of SR cards from srData.cards.
 * @param intervalMs - How often to check, in ms (default 3 600 000 = 1 hour).
 */
export function scheduleReviewCheck(
  cards: SRCard[],
  intervalMs: number = 60 * 60 * 1000,
): void {
  // Clear any previous interval so we don't stack timers
  if (reviewCheckInterval !== null) {
    clearInterval(reviewCheckInterval)
    reviewCheckInterval = null
  }

  // Immediately check once, then set up the recurring check
  checkAndNotify(cards)

  reviewCheckInterval = setInterval(() => {
    checkAndNotify(cards)
  }, intervalMs)
}

/**
 * Show a generic notification.
 *
 * @param title - Notification title.
 * @param body  - Notification body text.
 */
export function notifyGeneric(title: string, body: string): void {
  if (!isGranted()) return

  try {
    new Notification(title, {
      body,
      icon: '/icons/nousai.png',
      tag: `nousai-generic-${Date.now()}`,
      requireInteraction: false,
    })
  } catch {
    // silently ignore
  }
}

/**
 * Stop the periodic SR review check (if running).
 */
export function stopReviewCheck(): void {
  if (reviewCheckInterval !== null) {
    clearInterval(reviewCheckInterval)
    reviewCheckInterval = null
  }
}

/**
 * Notify about a single assignment that is coming due soon.
 */
export function notifyAssignmentDue(target: ReminderTarget, hoursLeft: number): void {
  if (!isGranted()) return
  const key = `${target.name}-${hoursLeft}h`
  if (notifiedAssignments.has(key)) return
  notifiedAssignments.add(key)

  const when = hoursLeft <= 1 ? 'in under 1 hour' : `in ~${Math.round(hoursLeft)} hours`
  try {
    new Notification(`Assignment due ${when}`, {
      body: `${target.courseCode}: ${target.name}`,
      icon: '/icons/nousai.png',
      tag: `nousai-asgn-${key}`,
      requireInteraction: false,
    })
  } catch {
    // silently ignore
  }
}

/**
 * Check Canvas live assignments and fire reminders at 24h and 1h before due.
 */
function checkAssignmentsDue(assignments: CanvasLiveAssignment[], courseCodeMap: Map<number, string>): void {
  const now = Date.now()
  const H24 = 24 * 60 * 60 * 1000
  const H1  =  1 * 60 * 60 * 1000

  for (const a of assignments) {
    if (!a.dueAt) continue
    if (a.submissionState === 'submitted' || a.submissionState === 'graded') continue
    const dueMs = new Date(a.dueAt).getTime()
    const diffMs = dueMs - now
    if (diffMs <= 0) continue // already past due

    const target: ReminderTarget = {
      name: a.name,
      dueAt: a.dueAt,
      courseCode: courseCodeMap.get(a.courseId) ?? '',
      htmlUrl: a.htmlUrl,
    }

    if (diffMs <= H1) {
      notifyAssignmentDue(target, diffMs / (60 * 60 * 1000))
    } else if (diffMs <= H24 && diffMs > H1) {
      notifyAssignmentDue(target, 24)
    }
  }
}

/**
 * Start periodic assignment reminder checks (every 15 minutes).
 * Pass updated data whenever Canvas live data changes.
 */
export function scheduleAssignmentReminders(
  assignments: CanvasLiveAssignment[],
  courseCodeMap: Map<number, string>,
  intervalMs = 15 * 60 * 1000,
): void {
  if (assignmentReminderInterval !== null) {
    clearInterval(assignmentReminderInterval)
  }
  checkAssignmentsDue(assignments, courseCodeMap)
  assignmentReminderInterval = setInterval(() => {
    checkAssignmentsDue(assignments, courseCodeMap)
  }, intervalMs)
}

export function stopAssignmentReminders(): void {
  if (assignmentReminderInterval !== null) {
    clearInterval(assignmentReminderInterval)
    assignmentReminderInterval = null
  }
}

/* ─── internal ────────────────────────────────────────────── */

/**
 * Count how many cards have a nextReview date <= now and fire a notification
 * if any are due.
 */
function checkAndNotify(cards: SRCard[]): void {
  const now = Date.now()
  const dueCount = cards.filter((c) => {
    const reviewTime = new Date(c.nextReview).getTime()
    return !Number.isNaN(reviewTime) && reviewTime <= now
  }).length

  if (dueCount > 0) {
    notifySRDue(dueCount)
  }
}
