/**
 * ⚠️ AI CODER WARNING ⚠️
 * This file is a DATA SAFETY LAYER. Do not weaken, simplify, or remove checks.
 * Read DANGER_FILES.md and AI_CONTEXT.md before modifying.
 *
 * Write-Ahead Validation: validates data BEFORE committing to IDB or cloud.
 * Catches empty/malformed/catastrophically shrunken writes at the gate.
 * Science: PostgreSQL CHECK constraints, SQLite NOT NULL, fail-fast (Shore 2004).
 */
import type { NousAIData } from '../types';

/** Percentage drop threshold — reject writes that lose more than this fraction of cards */
const CARD_DROP_THRESHOLD = 0.5;

/** Max entries in the write audit log (circular buffer in localStorage) */
const MAX_WRITE_LOG = 50;

export interface WriteValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * SYNC FIX #20 — 2026-03-27
 * Bug: Blocked legitimate bulk deletes (>50% card drop)
 * Fix: Added `userInitiated` flag to bypass card-drop guard for intentional deletes
 *
 * Validates incoming data before writing to IDB or cloud.
 * Returns { valid: false, reason } if the write should be blocked.
 * Set userInitiated=true to bypass the catastrophic shrinkage check for intentional deletes.
 */
export function validateBeforeWrite(
  incoming: NousAIData,
  existing: NousAIData | null,
  userInitiated = false,
): WriteValidationResult {
  // Structural: top-level shape
  if (!incoming || typeof incoming !== 'object') {
    return { valid: false, reason: 'Incoming data is not an object' };
  }
  if (typeof incoming.settings !== 'object' || incoming.settings === null) {
    return { valid: false, reason: 'Missing or invalid settings object' };
  }
  if (typeof incoming.pluginData !== 'object' || incoming.pluginData === null) {
    return { valid: false, reason: 'Missing or invalid pluginData object' };
  }

  // Structural: courses array
  const courses = incoming.pluginData?.coachData?.courses;
  if (!Array.isArray(courses)) {
    return { valid: false, reason: `courses is ${typeof courses}, expected array` };
  }

  // Per-course: each must have id, name, and flashcards array
  for (let i = 0; i < courses.length; i++) {
    const c = courses[i];
    if (!c || typeof c !== 'object') {
      return { valid: false, reason: `courses[${i}] is not an object` };
    }
    if (!c.id || typeof c.id !== 'string') {
      return { valid: false, reason: `courses[${i}] missing id` };
    }
    if (!c.name || typeof c.name !== 'string') {
      return { valid: false, reason: `courses[${i}] missing name` };
    }
    if (!Array.isArray(c.flashcards)) {
      return { valid: false, reason: `courses[${i}].flashcards is not an array` };
    }
  }

  // Catastrophic shrinkage: total card count must not drop by more than CARD_DROP_THRESHOLD
  if (existing) {
    const existingCourses = existing.pluginData?.coachData?.courses;
    if (Array.isArray(existingCourses)) {
      const existingCardCount = existingCourses.reduce(
        (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
      );
      const incomingCardCount = courses.reduce(
        (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
      );

      // Only flag if existing had cards (don't flag when starting from 0)
      // SYNC FIX #20: Skip this guard for user-initiated operations (intentional bulk deletes)
      if (existingCardCount > 0 && !userInitiated) {
        const dropRatio = 1 - (incomingCardCount / existingCardCount);
        if (dropRatio > CARD_DROP_THRESHOLD) {
          return {
            valid: false,
            reason: `Card count dropped from ${existingCardCount} to ${incomingCardCount} (${Math.round(dropRatio * 100)}% loss, threshold: ${CARD_DROP_THRESHOLD * 100}%)`,
          };
        }
      }

      // Empty courses overwriting non-empty courses — extra protection
      if (existingCourses.length > 0 && courses.length === 0 && !userInitiated) {
        return {
          valid: false,
          reason: `Would overwrite ${existingCourses.length} courses with empty array`,
        };
      }
    }
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

/**
 * Counts total flashcards across all courses.
 */
export function countCards(data: NousAIData): number {
  const courses = data?.pluginData?.coachData?.courses;
  if (!Array.isArray(courses)) return 0;
  return courses.reduce(
    (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
  );
}

interface WriteLogEntry {
  key: string;
  sizeBytes: number;
  source: string;
  timestamp: string;
  cardCount: number;
}

/**
 * Logs a write to the audit trail (localStorage circular buffer).
 * Detects rapid empty-array writes (same key written empty twice in 5s).
 */
export function logWrite(key: string, sizeBytes: number, source: string, cardCount: number): void {
  try {
    const raw = localStorage.getItem('nous_write_log');
    const log: WriteLogEntry[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();

    // Detect rapid empty writes — abort pattern
    if (cardCount === 0) {
      const recent = log.filter(
        e => e.key === key && e.cardCount === 0 &&
        (Date.now() - new Date(e.timestamp).getTime()) < 5000
      );
      if (recent.length >= 1) {
        console.error(`[WRITE-GUARD] RAPID EMPTY WRITE DETECTED: "${key}" written empty twice in 5s`);
        window.dispatchEvent(new CustomEvent('nousai-write-blocked', {
          detail: { reason: `Rapid empty write on key "${key}"`, source }
        }));
        return;
      }
    }

    log.push({ key, sizeBytes, source, timestamp: now, cardCount });
    // Circular buffer: keep last MAX_WRITE_LOG
    const trimmed = log.length > MAX_WRITE_LOG ? log.slice(-MAX_WRITE_LOG) : log;
    localStorage.setItem('nous_write_log', JSON.stringify(trimmed));
  } catch {
    // Don't let logging failures break the app
  }
}
