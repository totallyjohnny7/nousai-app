/**
 * Data Health Check — validates data integrity on boot.
 * Detects corruption and auto-repairs common issues.
 */
import type { NousAIData } from '../types';

export interface HealthIssue {
  severity: 'warning' | 'error';
  code: string;
  message: string;
}

export interface HealthReport {
  healthy: boolean;
  score: number;
  issues: HealthIssue[];
  autoRepaired: string[];
}

export function dataHealthCheck(data: NousAIData): { report: HealthReport; repairedData: NousAIData } {
  const issues: HealthIssue[] = [];
  const autoRepaired: string[] = [];
  let score = 100;

  // Deep clone to avoid mutating original
  const repaired = JSON.parse(JSON.stringify(data)) as NousAIData;

  // Check courses array
  const courses = repaired.pluginData?.coachData?.courses;
  if (courses !== undefined && !Array.isArray(courses)) {
    issues.push({ severity: 'error', code: 'COURSES_NOT_ARRAY', message: 'courses is not an array' });
    score -= 30;
    if (repaired.pluginData?.coachData) {
      (repaired.pluginData.coachData as unknown as Record<string, unknown>).courses = [];
      autoRepaired.push('Reset corrupt courses to empty array');
    }
  }

  // Check quizHistory array
  const quizHistory = repaired.pluginData?.quizHistory;
  if (quizHistory !== undefined && !Array.isArray(quizHistory)) {
    issues.push({ severity: 'error', code: 'QUIZ_HISTORY_NOT_ARRAY', message: 'quizHistory is not an array' });
    score -= 20;
    if (repaired.pluginData) {
      (repaired.pluginData as Record<string, unknown>).quizHistory = [];
      autoRepaired.push('Reset corrupt quizHistory to empty array');
    }
  }

  // Check gamification for NaN values
  const gam = repaired.pluginData?.gamification;
  if (gam) {
    const numFields = ['xp', 'level', 'totalQuizzes', 'totalCorrect', 'totalAnswered', 'totalMinutes', 'streak', 'bestStreak', 'streakFreezes', 'perfectScores'] as const;
    for (const field of numFields) {
      const val = (gam as Record<string, unknown>)[field];
      if (typeof val === 'number' && isNaN(val)) {
        issues.push({ severity: 'warning', code: 'NAN_GAMIFICATION', message: `gamification.${field} is NaN` });
        score -= 5;
        (gam as Record<string, number>)[field] = 0;
        autoRepaired.push(`Clamped NaN gamification.${field} to 0`);
      }
    }
  }

  return {
    report: {
      healthy: issues.filter(i => i.severity === 'error').length === 0,
      score: Math.max(0, score),
      issues,
      autoRepaired,
    },
    repairedData: repaired,
  };
}
