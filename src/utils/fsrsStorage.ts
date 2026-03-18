/**
 * FSRS Storage — IDB-backed persistence for flashcard scheduling state.
 *
 * Uses a module-level in-memory cache so reads remain synchronous everywhere
 * in the app, while writes go to IndexedDB (not localStorage).
 *
 * Call initFsrsCache() once on app startup. After that, loadFcFSRS() and
 * saveFcFSRS() work synchronously via the in-memory cache.
 */

import { DataRepository } from './dataRepository';
import type { FSRSCard } from './fsrs';
import type { CourseCalendarEvent, SRData } from '../types';

export const FC_FSRS_KEY = 'nousai-fc-fsrs';
export const DAILY_PROGRESS_KEY = 'nousai-daily-card-progress';

// ── Module-level caches ────────────────────────────────────────────────────────

let _fsrsCache: Record<string, FSRSCard> = {};
let _fsrsCacheReady = false;

export interface DailyProgress { date: string; counts: Record<string, number> }

let _dailyCache: DailyProgress | null = null;

// ── Init / migration ───────────────────────────────────────────────────────────

/**
 * Load FSRS data from IDB into memory. Migrates from localStorage if needed.
 * Must be called once before the Flashcards page is used (e.g., in App.tsx).
 */
export async function initFsrsCache(): Promise<void> {
  if (_fsrsCacheReady) return;

  const fromIdb = await DataRepository.get<Record<string, FSRSCard>>(FC_FSRS_KEY);
  if (fromIdb !== null) {
    _fsrsCache = fromIdb;
  } else {
    // Migration: read from LS, save to IDB, delete from LS
    try { _fsrsCache = JSON.parse(localStorage.getItem(FC_FSRS_KEY) || '{}'); } catch { _fsrsCache = {}; }
    if (Object.keys(_fsrsCache).length > 0) {
      await DataRepository.set(FC_FSRS_KEY, _fsrsCache);
      localStorage.removeItem(FC_FSRS_KEY);
    }
  }

  // Migrate daily progress key while we're here
  const fromIdbDaily = await DataRepository.get<DailyProgress>(DAILY_PROGRESS_KEY);
  if (fromIdbDaily !== null) {
    _dailyCache = fromIdbDaily;
  } else {
    try { _dailyCache = JSON.parse(localStorage.getItem(DAILY_PROGRESS_KEY) || 'null'); } catch { _dailyCache = null; }
    if (_dailyCache !== null) {
      await DataRepository.set(DAILY_PROGRESS_KEY, _dailyCache);
      localStorage.removeItem(DAILY_PROGRESS_KEY);
    }
  }

  _fsrsCacheReady = true;
}

// ── FSRS read/write ────────────────────────────────────────────────────────────

export function loadFcFSRS(): Record<string, FSRSCard> {
  return _fsrsCache;
}

export function saveFcFSRS(cards: Record<string, FSRSCard>): void {
  _fsrsCache = cards;
  DataRepository.set(FC_FSRS_KEY, cards).catch(() => {});
  localStorage.removeItem(FC_FSRS_KEY); // cleanup LS if still present
}

// ── Daily progress read/write ─────────────────────────────────────────────────

export function todayDateStr(): string { return new Date().toISOString().split('T')[0]; }

export function loadDailyProgress(): DailyProgress {
  if (_dailyCache) {
    if (_dailyCache.date !== todayDateStr()) return { date: todayDateStr(), counts: {} };
    return _dailyCache;
  }
  // Pre-init fallback (should not normally be reached after initFsrsCache runs)
  try {
    const raw = JSON.parse(localStorage.getItem(DAILY_PROGRESS_KEY) || '{}') as Partial<DailyProgress>;
    if (raw.date !== todayDateStr()) return { date: todayDateStr(), counts: {} };
    return { date: raw.date!, counts: raw.counts ?? {} };
  } catch { return { date: todayDateStr(), counts: {} }; }
}

export function saveDailyProgress(p: DailyProgress): void {
  _dailyCache = p;
  DataRepository.set(DAILY_PROGRESS_KEY, p).catch(() => {});
  localStorage.removeItem(DAILY_PROGRESS_KEY);
}

/**
 * Returns average retention (0–100) for all cards belonging to a course.
 * Uses the most recent R value from card history, or 100 for new cards.
 * Returns 100 if the course has no cards.
 */
export function getDeckHealthByCourse(srData: SRData | null, courseId: string): number {
  const cards = srData?.cards?.filter(c => c.subject === courseId) ?? [];
  if (cards.length === 0) return 100;
  const retentions = cards.map(card => {
    const last = card.history?.[card.history.length - 1];
    return last?.R != null ? Math.round(last.R * 100) : 100;
  });
  return Math.round(retentions.reduce((a, b) => a + b, 0) / retentions.length);
}

/**
 * Returns the number of days until the next exam found in calendarEvents,
 * or null if no future exam event is present.
 */
export function getNextExamDays(events: CourseCalendarEvent[]): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const examEvents = events.filter(e => /exam|midterm|final/i.test(e.title ?? ''));
  const future = examEvents
    .map(e => new Date(e.date))
    .filter(d => d >= today)
    .sort((a, b) => a.getTime() - b.getTime());
  if (future.length === 0) return null;
  return Math.ceil((future[0].getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
