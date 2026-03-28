/**
 * Write Guard V3 — Simple validation before IDB writes
 */
import type { NousAIData, Course } from '../types';

interface WriteValidation {
  valid: boolean;
  reason?: string;
}

export function validateWrite(newData: NousAIData, oldData: NousAIData | null): WriteValidation {
  // Basic structure check
  if (!newData || typeof newData !== 'object') {
    return { valid: false, reason: 'Data is not an object' };
  }
  if (!newData.pluginData) {
    return { valid: false, reason: 'Missing pluginData' };
  }
  if (!newData.settings) {
    return { valid: false, reason: 'Missing settings' };
  }

  const courses = newData.pluginData?.coachData?.courses;
  if (!Array.isArray(courses)) {
    return { valid: false, reason: 'Missing courses array' };
  }

  if (!oldData) return { valid: true };

  // Count non-deleted cards
  const countNonDeleted = (cs: Course[]) =>
    cs.filter(c => !c.deleted).reduce((sum, c) =>
      sum + (c.flashcards?.filter(f => !f.deleted)?.length || 0), 0);

  const oldCards = countNonDeleted(oldData.pluginData?.coachData?.courses || []);
  const newCards = countNonDeleted(courses);

  // Catastrophic drop check: >90% card loss when old had >10 cards
  if (oldCards > 10 && newCards < oldCards * 0.1) {
    return { valid: false, reason: `Card count dropped ${oldCards} -> ${newCards} (>90% loss)` };
  }

  // All courses gone check
  const oldCourseCount = (oldData.pluginData?.coachData?.courses || []).filter(c => !c.deleted).length;
  const newCourseCount = courses.filter(c => !c.deleted).length;
  if (oldCourseCount > 0 && newCourseCount === 0) {
    return { valid: false, reason: `All ${oldCourseCount} courses would be deleted` };
  }

  return { valid: true };
}
