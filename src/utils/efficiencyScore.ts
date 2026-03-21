/**
 * Efficiency Score — real-time study performance metric.
 *
 * Formula: (cardsReviewed × retentionRate) ÷ minutesSpent × 100
 * Nous-specific metric (not from academic literature).
 *
 * Uses rolling 5-minute window. Starts calculating after 5 minutes
 * to avoid infinity spike at session start.
 */

export type EfficiencyStatus = 'excellent' | 'good' | 'warning' | 'critical';

export interface EfficiencyState {
  score: number;           // 0-100+
  cardsReviewed: number;
  correctCount: number;
  retentionRate: number;   // 0-1
  minutesSpent: number;
  status: EfficiencyStatus;
  shouldBreak: boolean;    // true if score < 60 for > 2 min
}

const MIN_MINUTES = 5; // Don't calculate before this

export function calculateEfficiency(
  cardsReviewed: number,
  correctCount: number,
  minutesSpent: number
): EfficiencyState {
  const retentionRate = cardsReviewed > 0 ? correctCount / cardsReviewed : 0;

  let score = 0;
  if (minutesSpent >= MIN_MINUTES && cardsReviewed > 0) {
    score = Math.round((cardsReviewed * retentionRate) / minutesSpent * 100);
  }

  // Clamp to 0-150 (can exceed 100 for very fast, accurate sessions)
  score = Math.max(0, Math.min(150, score));

  let status: EfficiencyStatus;
  if (score >= 80) status = 'excellent';
  else if (score >= 60) status = 'good';
  else if (score >= 40) status = 'warning';
  else status = 'critical';

  const shouldBreak = minutesSpent >= MIN_MINUTES && score < 60;

  return { score, cardsReviewed, correctCount, retentionRate, minutesSpent, status, shouldBreak };
}

/**
 * Color for the efficiency badge based on status.
 */
export function efficiencyColor(status: EfficiencyStatus): string {
  switch (status) {
    case 'excellent': return '#22C55E'; // green
    case 'good':      return '#F5A623'; // amber
    case 'warning':   return '#EAB308'; // yellow
    case 'critical':  return '#EF4444'; // red
  }
}

/**
 * Human-readable label for the status.
 */
export function efficiencyLabel(status: EfficiencyStatus): string {
  switch (status) {
    case 'excellent': return 'Excellent';
    case 'good':      return 'Good';
    case 'warning':   return 'Take a break soon';
    case 'critical':  return 'Break recommended';
  }
}
