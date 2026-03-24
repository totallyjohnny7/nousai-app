/**
 * Data Health Check — scans NousAIData for corruption and auto-repairs where safe.
 * Run at boot to detect issues before they propagate.
 */

import type { NousAIData } from '../types';

export interface HealthIssue {
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
}

export interface HealthReport {
  healthy: boolean;
  score: number;            // 0-100
  issues: HealthIssue[];
  autoRepaired: string[];   // list of auto-repair actions taken
}

/**
 * Run a full health check on the data. Returns a report and optionally repaired data.
 */
export function dataHealthCheck(data: NousAIData): { report: HealthReport; repairedData: NousAIData } {
  const issues: HealthIssue[] = [];
  const autoRepaired: string[] = [];
  let repaired = structuredClone(data);

  // 1. Check courses array exists
  const courses = repaired.pluginData?.coachData?.courses;
  if (!courses) {
    issues.push({ severity: 'warning', code: 'NO_COURSES', message: 'No courses array found' });
  } else {
    // 2. Check for courses with missing topics
    for (const c of courses) {
      if (c.flashcards && c.flashcards.length > 0 && (!c.topics || c.topics.length === 0)) {
        issues.push({ severity: 'info', code: 'MISSING_TOPICS', message: `Course "${c.name}" has flashcards but no topics array` });
        const topicNames = [...new Set(c.flashcards.map(fc => fc.topic).filter(Boolean))] as string[];
        c.topics = topicNames.map(name => ({ id: name, name }));
        autoRepaired.push(`Rebuilt topics for "${c.name}"`);
      }
    }

    // 3. Check for duplicate course IDs
    const courseIds = courses.map(c => c.id);
    const uniqueIds = new Set(courseIds);
    if (uniqueIds.size < courseIds.length) {
      issues.push({ severity: 'critical', code: 'DUPLICATE_COURSE_IDS', message: `${courseIds.length - uniqueIds.size} duplicate course IDs detected` });
    }

    // 4. Check for flashcards with missing required fields
    for (const c of courses) {
      if (!c.flashcards) continue;
      const badCards = c.flashcards.filter(fc => !fc.front && !fc.back);
      if (badCards.length > 0) {
        issues.push({ severity: 'warning', code: 'EMPTY_CARDS', message: `Course "${c.name}" has ${badCards.length} empty flashcards` });
      }
    }
  }

  // 5. Check settings
  if (!repaired.settings) {
    issues.push({ severity: 'warning', code: 'NO_SETTINGS', message: 'Settings object missing' });
    repaired.settings = {} as NousAIData['settings'];
    autoRepaired.push('Created empty settings object');
  }

  // Calculate score
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, 100 - (criticalCount * 30) - (warningCount * 10) - (issues.length * 2));

  return {
    report: {
      healthy: criticalCount === 0 && warningCount === 0,
      score,
      issues,
      autoRepaired,
    },
    repairedData: repaired,
  };
}
