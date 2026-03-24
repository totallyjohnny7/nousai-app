/**
 * ⚠️ AI CODER WARNING ⚠️
 * Boot-time data integrity checker. Runs after loadFromIDB + normalizeData.
 * Detects corruption before the user sees broken state.
 *
 * Science: TCP checksums (RFC 793) + filesystem fsck — detect errors at
 * read time before they propagate. Hamming (1950): early detection reduces
 * recovery cost exponentially.
 */
import type { NousAIData } from '../types';

export interface HealthIssue {
  severity: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface HealthReport {
  healthy: boolean;
  score: number; // 0-100
  issues: HealthIssue[];
  autoRepaired: string[];
}

/**
 * Run structural integrity checks on data loaded from IDB.
 * Returns a report + auto-repairs safe deterministic issues.
 * Does NOT mutate the input — returns a new object if repairs were made.
 */
export function dataHealthCheck(data: NousAIData): { report: HealthReport; repairedData: NousAIData } {
  const issues: HealthIssue[] = [];
  const autoRepaired: string[] = [];
  let repaired = data;

  // 1. CRITICAL: pluginData exists
  if (!data.pluginData || typeof data.pluginData !== 'object') {
    issues.push({ severity: 'critical', code: 'MISSING_PLUGIN_DATA', message: 'pluginData is missing or invalid' });
    return { report: buildReport(issues, autoRepaired), repairedData: repaired };
  }

  // 2. CRITICAL: courses is array
  const courses = data.pluginData?.coachData?.courses;
  if (courses !== undefined && !Array.isArray(courses)) {
    issues.push({ severity: 'critical', code: 'COURSES_NOT_ARRAY', message: `courses is ${typeof courses}, not array` });
    // Auto-repair: try Object.values if truthy object
    if (courses && typeof courses === 'object') {
      try {
        const recovered = Object.values(courses);
        if (Array.isArray(recovered) && recovered.length > 0) {
          repaired = {
            ...repaired,
            pluginData: {
              ...repaired.pluginData,
              coachData: { ...repaired.pluginData.coachData, courses: recovered as typeof courses[] & unknown[] }
            }
          } as NousAIData;
          autoRepaired.push('Recovered courses from object via Object.values()');
        }
      } catch { /* can't recover */ }
    }
  }

  const validCourses = Array.isArray(repaired.pluginData?.coachData?.courses)
    ? repaired.pluginData.coachData.courses
    : [];

  // 3. CRITICAL: each course has id + name + flashcards
  for (let i = 0; i < validCourses.length; i++) {
    const c = validCourses[i];
    if (!c || typeof c !== 'object') {
      issues.push({ severity: 'critical', code: 'INVALID_COURSE', message: `courses[${i}] is not an object` });
      continue;
    }
    if (!c.id) issues.push({ severity: 'critical', code: 'COURSE_NO_ID', message: `courses[${i}] ("${c.name || 'unnamed'}") has no id` });
    if (!c.name) issues.push({ severity: 'critical', code: 'COURSE_NO_NAME', message: `courses[${i}] (id: ${c.id || '?'}) has no name` });
    if (!Array.isArray(c.flashcards)) {
      issues.push({ severity: 'critical', code: 'COURSE_NO_FLASHCARDS', message: `courses[${i}].flashcards is not an array` });
    }
  }

  // 4. CRITICAL: card count vs checkpoint
  const checkpoint = parseInt(localStorage.getItem('nous_card_count_checkpoint') || '0', 10);
  const currentCount = validCourses.reduce(
    (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
  );
  if (checkpoint > 0 && currentCount < checkpoint * 0.5) {
    issues.push({
      severity: 'critical',
      code: 'CARD_COUNT_DROP',
      message: `Card count ${currentCount} is <50% of checkpoint ${checkpoint} — possible data loss`,
    });
  }

  // 5. WARNING: duplicate course IDs
  const idCounts = new Map<string, number>();
  for (const c of validCourses) {
    if (c.id) idCounts.set(c.id, (idCounts.get(c.id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      issues.push({ severity: 'warning', code: 'DUPLICATE_COURSE_ID', message: `Course ID "${id}" appears ${count} times` });
    }
  }

  // 6. WARNING: courses with suspiciously many flashcards
  for (const c of validCourses) {
    if (Array.isArray(c.flashcards) && c.flashcards.length > 10000) {
      issues.push({ severity: 'warning', code: 'HUGE_COURSE', message: `"${c.name}" has ${c.flashcards.length} flashcards — possible duplication` });
    }
  }

  // 7. INFO: quiz history large (will be trimmed)
  const qh = data.pluginData?.quizHistory;
  if (Array.isArray(qh) && qh.length > 500) {
    issues.push({ severity: 'info', code: 'LARGE_QUIZ_HISTORY', message: `Quiz history has ${qh.length} entries (will be trimmed to 500)` });
  }

  return { report: buildReport(issues, autoRepaired), repairedData: repaired };
}

function buildReport(issues: HealthIssue[], autoRepaired: string[]): HealthReport {
  const hasCritical = issues.some(i => i.severity === 'critical');
  const hasWarning = issues.some(i => i.severity === 'warning');
  // Score: start at 100, deduct for issues
  let score = 100;
  for (const i of issues) {
    if (i.severity === 'critical') score -= 25;
    if (i.severity === 'warning') score -= 10;
    if (i.severity === 'info') score -= 2;
  }
  score = Math.max(0, score);

  return {
    healthy: !hasCritical && !hasWarning,
    score,
    issues,
    autoRepaired,
  };
}
