/**
 * Write Guard — validates data before committing to IndexedDB.
 * Prevents accidental data loss from stale/empty state writes.
 */

import type { NousAIData } from '../types';

export interface WriteValidationResult {
  valid: boolean;
  reason?: string;
}

/** Count total cards across all courses */
export function countCards(data: NousAIData): number {
  const courses = data.pluginData?.coachData?.courses ?? [];
  return courses.reduce((sum, c) => sum + (c.flashcards?.length ?? 0), 0);
}

/**
 * Validate that a write won't destroy data.
 * Blocks writes if:
 * - New data has 0 courses but old data had some (stale state)
 * - Card count dropped by > 50% (likely corruption)
 */
export function validateBeforeWrite(data: NousAIData, lastSaved: NousAIData | null): WriteValidationResult {
  if (!lastSaved) return { valid: true };

  const oldCourses = lastSaved.pluginData?.coachData?.courses ?? [];
  const newCourses = data.pluginData?.coachData?.courses ?? [];

  // Block empty-state writes when IDB has real data
  if (newCourses.length === 0 && oldCourses.length > 0) {
    return { valid: false, reason: `Blocked: 0 courses would overwrite ${oldCourses.length} existing courses` };
  }

  // Block massive card count drops (> 50%)
  const oldCards = countCards(lastSaved);
  const newCards = countCards(data);
  if (oldCards > 10 && newCards < oldCards * 0.5) {
    return { valid: false, reason: `Blocked: card count dropped from ${oldCards} to ${newCards} (>50% loss)` };
  }

  return { valid: true };
}

/**
 * Deep clones data before mutation to prevent reference corruption.
 * Uses structuredClone (browser-native, <5ms for 1.5MB).
 */
export function deepCloneBeforeMutation(data: NousAIData): NousAIData {
  return structuredClone(data);
}

/** Log write metadata for debugging */
export function logWrite(storeName: string, bytes: number, source: string, cardCount: number): void {
  const entry = {
    ts: new Date().toISOString(),
    store: storeName,
    bytes,
    source,
    cards: cardCount,
  };
  try {
    const log = JSON.parse(localStorage.getItem('nous_write_log') ?? '[]') as unknown[];
    log.push(entry);
    // Keep last 50 entries
    if (log.length > 50) log.splice(0, log.length - 50);
    localStorage.setItem('nous_write_log', JSON.stringify(log));
  } catch { /* storage full — non-critical */ }
}
