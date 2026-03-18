/**
 * Course Space — initialization, migration, and safe access utilities.
 *
 * RULE: Never access pluginData.courseSpaces[courseId] directly anywhere in the codebase.
 *       Always use getCourseSpace() — it returns a safe default if the entry is missing.
 *
 * This prevents crashes when existing users load the app for the first time
 * after the Course Space feature is deployed.
 */

import type { CourseSpace, NousAIData } from '../types';

// ─── Default empty CourseSpace ─────────────────────────────────────────────

const DEFAULT_COURSE_SPACE_BASE: Omit<CourseSpace, 'courseId' | 'updatedAt'> = {
  gradeCategories: [],
  gradeEntries: [],
  whatIfEntries: [],
  syllabus: null,
  examReviews: [],
  calendarEvents: [],
};

export function initCourseSpace(courseId: string): CourseSpace {
  return {
    ...DEFAULT_COURSE_SPACE_BASE,
    courseId,
    updatedAt: new Date().toISOString(),
  };
}

// ─── Safe accessor ─────────────────────────────────────────────────────────

/**
 * THE ONLY SAFE WAY to read a CourseSpace for a given course.
 *
 * Returns the stored CourseSpace if it exists, otherwise returns a fresh
 * default (non-persisted). Components should call updatePluginData() to
 * persist any changes to the returned default.
 */
export function getCourseSpace(
  courseSpaces: Record<string, CourseSpace> | undefined,
  courseId: string
): CourseSpace {
  return courseSpaces?.[courseId] ?? initCourseSpace(courseId);
}

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Returns true only if the value looks like a real CourseSpace object.
 * Guards against corrupted structures like { "spaces": [...] } that can
 * get stored in Firebase from old data models.
 */
function isValidCourseSpace(value: unknown): value is CourseSpace {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.courseId === 'string' &&
    Array.isArray(v.gradeCategories) &&
    Array.isArray(v.gradeEntries)
  );
}

// ─── Migration ─────────────────────────────────────────────────────────────

/**
 * Idempotent migration — safe to call on every app load.
 *
 * Ensures every existing course has a corresponding CourseSpace entry.
 * Also purges any invalid/corrupted keys (e.g. leftover "spaces" array keys
 * from old data models) so they don't persist in IDB or Firebase.
 * Wrapped in try-catch in store.tsx — on failure, app degrades gracefully
 * (Course Space features unavailable) but does NOT crash.
 */
export function migrateCourseSpaces(data: NousAIData): NousAIData {
  try {
    const raw = data.pluginData.courseSpaces ?? {};
    const courses = data.pluginData.coachData?.courses ?? [];

    // Purge any keys whose value is not a valid CourseSpace (e.g. "spaces": [...])
    const courseSpaces: Record<string, CourseSpace> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (isValidCourseSpace(val)) {
        courseSpaces[key] = val;
      } else {
        console.warn(`[NousAI] courseSpaces: purging invalid key "${key}" (not a CourseSpace)`);
      }
    }

    // Ensure every course has an entry
    for (const course of courses) {
      if (!courseSpaces[course.id]) {
        courseSpaces[course.id] = initCourseSpace(course.id);
      }
    }

    return {
      ...data,
      pluginData: {
        ...data.pluginData,
        courseSpaces,
      },
    };
  } catch (err) {
    console.error('[NousAI] courseSpaces migration failed:', err);
    // Degrade gracefully — Course Space features won't work this session
    // but the app will NOT crash. Next load will retry migration.
    return {
      ...data,
      pluginData: {
        ...data.pluginData,
        courseSpaces: data.pluginData.courseSpaces ?? {},
      },
    };
  }
}

// ─── Per-entry id merge (used by mergeCourseSpaces in store.tsx) ───────────

/**
 * Union two arrays by id field. On conflict (same id in both arrays),
 * keeps the entry with the later 'date' field — preserves both devices'
 * additions while resolving same-entry conflicts by recency.
 */
export function mergeById<T extends { id: string; date: string }>(
  primary: T[],
  secondary: T[]
): T[] {
  const map = new Map<string, T>();
  // secondary first so primary overwrites, unless secondary is actually newer
  for (const entry of [...secondary, ...primary]) {
    const existing = map.get(entry.id);
    if (!existing || entry.date > existing.date) {
      map.set(entry.id, entry);
    }
  }
  return Array.from(map.values());
}

/**
 * Merge two courseSpaces maps — called during cloud pull in store.tsx.
 *
 * Strategy:
 * - gradeEntries + calendarEvents: id-merged so both devices' additions survive
 * - gradeCategories, examReviews, syllabus, whatIfEntries: last-write-wins at
 *   CourseSpace level (structural data, rarely edited on two devices at once)
 *
 * KNOWN: concurrent edits to gradeCategories/examReviews across devices
 * within the 30s sync window → last write wins. gradeEntries and calendarEvents
 * are id-merged and always preserved.
 */
export function mergeCourseSpaces(
  local: Record<string, CourseSpace> | undefined,
  remote: Record<string, CourseSpace> | undefined
): Record<string, CourseSpace> {
  const rawLocal = local ?? {};
  const remoteMap = remote ?? {};

  // Purge invalid local entries before merging
  const localMap: Record<string, CourseSpace> = {};
  for (const [key, val] of Object.entries(rawLocal)) {
    if (isValidCourseSpace(val)) localMap[key] = val;
  }
  const merged: Record<string, CourseSpace> = { ...localMap };

  for (const [id, remoteSpace] of Object.entries(remoteMap)) {
    // Skip corrupted entries from Firebase (e.g. "spaces": [...array...])
    if (!isValidCourseSpace(remoteSpace)) {
      console.warn(`[NousAI] mergeCourseSpaces: skipping invalid remote key "${id}"`);
      continue;
    }
    const localSpace = localMap[id];
    if (!localSpace) {
      merged[id] = remoteSpace;
      continue;
    }
    // Determine which is the "primary" (newer) and "secondary" (older) at CourseSpace level
    const [primary, secondary] =
      remoteSpace.updatedAt > localSpace.updatedAt
        ? [remoteSpace, localSpace]
        : [localSpace, remoteSpace];

    merged[id] = {
      ...primary,
      // Additive arrays: id-merge so both devices' additions survive
      gradeEntries: mergeById(primary.gradeEntries, secondary.gradeEntries),
      calendarEvents: mergeById(primary.calendarEvents, secondary.calendarEvents),
      // Structural arrays: last-write-wins (primary already wins via spread above)
    };
  }

  return merged;
}
