/**
 * Write Guard — validates data before committing to IndexedDB.
 * Prevents accidental overwrites with corrupt or empty state.
 */
import type { NousAIData } from '../types';

export interface WriteValidation {
  valid: boolean;
  reason?: string;
}

/** Count total SR cards across all courses */
export function countCards(data: NousAIData | null): number {
  if (!data) return 0;
  const srData = data.pluginData?.srData;
  if (!srData || typeof srData !== 'object') return 0;
  return Object.keys(srData).length;
}

/** Log write with context for debugging */
export function logWrite(key: string, size: number, source: string, cardCount: number): void {
  console.log(`[WRITE-GUARD] ${source}: ${key} (${Math.round(size / 1024)}KB, ${cardCount} cards)`);
}

/**
 * Validate data before IDB write.
 * Blocks writes that would lose a significant amount of data compared to last save.
 */
export function validateBeforeWrite(
  data: NousAIData | null,
  lastSaved: NousAIData | null
): WriteValidation {
  if (!data) return { valid: false, reason: 'No data to write' };

  const courses = data.pluginData?.coachData?.courses;
  if (courses !== undefined && !Array.isArray(courses)) {
    return { valid: false, reason: 'courses is not an array — possible corruption' };
  }

  // If we have a previous save, check for catastrophic data loss
  if (lastSaved) {
    const prevCards = countCards(lastSaved);
    const newCards = countCards(data);
    // Block if we'd lose more than 50% of cards (and had a meaningful count)
    if (prevCards > 10 && newCards < prevCards * 0.5) {
      return {
        valid: false,
        reason: `Card count dropped from ${prevCards} to ${newCards} (>${50}% loss)`,
      };
    }
  }

  return { valid: true };
}
