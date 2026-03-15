/**
 * Proficiency Tracking & Adaptive Learning
 * Ported from NousAI Obsidian plugin
 */

export interface ProficiencySettings {
  proficiencyThreshold: number; // 85 = must score >= 85%
  minAttempts: number;          // 3 = need 3+ attempts
  recentWeight: number;         // 0.7 = 70% weight on recent half
}

export const DEFAULT_PROF_SETTINGS: ProficiencySettings = {
  proficiencyThreshold: 85,
  minAttempts: 3,
  recentWeight: 0.7,
};

export interface TopicStats {
  attempts: number[];     // Array of percentage scores
  streak: number;         // Consecutive passes
  lastAttempt: string;    // ISO date
}

/** Calculate proficiency score for a topic using weighted recent/older split */
export function calculateProficiency(
  attempts: number[],
  settings: ProficiencySettings = DEFAULT_PROF_SETTINGS
): number {
  if (!attempts.length) return 0;

  const half = Math.ceil(attempts.length / 2);
  const recent = attempts.slice(-half);
  const older = attempts.slice(0, attempts.length - half);

  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const olderAvg = older.length
    ? older.reduce((s, v) => s + v, 0) / older.length
    : recentAvg;

  return Math.max(0, Math.min(100, Math.round(recentAvg * settings.recentWeight + olderAvg * (1 - settings.recentWeight))));
}

/** Check if a topic is considered proficient */
export function isProficient(
  attempts: number[],
  settings: ProficiencySettings = DEFAULT_PROF_SETTINGS
): boolean {
  return (
    attempts.length >= settings.minAttempts &&
    calculateProficiency(attempts, settings) >= settings.proficiencyThreshold
  );
}

/** Get weak topics sorted by proficiency (ascending) */
export function getWeakTopics(
  subjects: Record<string, Record<string, TopicStats>>,
  settings: ProficiencySettings = DEFAULT_PROF_SETTINGS
): Array<{ subject: string; topic: string; proficiency: number; attempts: number }> {
  const weak: Array<{ subject: string; topic: string; proficiency: number; attempts: number }> = [];

  for (const [subject, topics] of Object.entries(subjects)) {
    for (const [topic, stats] of Object.entries(topics)) {
      if (stats.attempts.length === 0) continue;
      const prof = calculateProficiency(stats.attempts, settings);
      if (!isProficient(stats.attempts, settings)) {
        weak.push({ subject, topic, proficiency: prof, attempts: stats.attempts.length });
      }
    }
  }

  return weak.sort((a, b) => a.proficiency - b.proficiency);
}

/** Calculate subject-level proficiency (average of all topic scores) */
export function subjectProficiency(
  topics: Record<string, TopicStats>,
  settings: ProficiencySettings = DEFAULT_PROF_SETTINGS
): number {
  const scores = Object.values(topics)
    .filter(t => t.attempts.length > 0)
    .map(t => calculateProficiency(t.attempts, settings));

  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
}

/** Update mastery using exponential moving average (from quiz results) */
export function updateMastery(oldMastery: number, quizPercent: number): number {
  return Math.round(oldMastery * 0.7 + quizPercent * 0.3);
}

/** Record a quiz attempt for a topic */
export function recordAttempt(
  stats: TopicStats | undefined,
  percentage: number,
  threshold: number = 85
): TopicStats {
  const existing = stats || { attempts: [], streak: 0, lastAttempt: '' };
  const newStreak = percentage >= threshold ? existing.streak + 1 : 0;

  return {
    attempts: [...existing.attempts, percentage],
    streak: newStreak,
    lastAttempt: new Date().toISOString(),
  };
}
