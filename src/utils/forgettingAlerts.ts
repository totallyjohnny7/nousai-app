/**
 * Forgetting Interception Alerts — NousAI
 *
 * Identifies cards approaching the danger zone (R < 0.70) within
 * the next `thresholdDays` days using FSRS retrievability formula.
 * Proactive review right before forgetting maximizes stability gain.
 */

import type { ForgettingAlert } from '../types';

interface SRCardLike {
  key: string;
  S?: number;          // stability in days
  nextReview?: string; // ISO date string
  state?: string;
  questionText?: string;
}

/** FSRS retrievability: R(t, S) = exp(ln(0.9) * t / S) */
function retrievability(daysSince: number, stability: number): number {
  if (!stability || stability <= 0) return 1.0;
  return Math.exp((Math.log(0.9) * daysSince) / stability);
}

/** Binary search: how many days until R drops below threshold? */
function daysUntilThreshold(stability: number, currentR: number, threshold: number): number {
  if (currentR <= threshold) return 0;
  // R(t) = 0.9^(t/S), solve for t when R = threshold
  // t = S * ln(threshold) / ln(0.9)
  return Math.max(0, (stability * Math.log(threshold)) / Math.log(0.9));
}

export function getAtRiskCards(
  cards: SRCardLike[],
  thresholdDays: number = 3,
): ForgettingAlert[] {
  const now = new Date();
  const alerts: ForgettingAlert[] = [];

  for (const card of cards) {
    if (card.state === 'suspended' || card.state === 'new') continue;
    if (!card.S || !card.nextReview) continue;

    const nextReviewDate = new Date(card.nextReview);
    const daysUntilDue = (nextReviewDate.getTime() - now.getTime()) / 86_400_000;

    // Only include cards due within thresholdDays
    if (daysUntilDue < 0 || daysUntilDue > thresholdDays) continue;

    const daysSinceReview = Math.max(0, (now.getTime() - nextReviewDate.getTime() + card.S * 86_400_000) / 86_400_000);
    // Approximate days since last review using scheduled days + overdue
    const actualDaysSince = card.S * (1 - daysUntilDue / card.S);
    const currentR = retrievability(Math.max(0, actualDaysSince), card.S);

    if (currentR > 0.78) continue; // Still comfortable

    alerts.push({
      cardKey: card.key,
      currentR,
      daysUntilBelow70: Math.round(daysUntilThreshold(card.S, currentR, 0.70)),
    });

    void daysSinceReview; // suppress unused warning
  }

  return alerts.sort((a, b) => a.currentR - b.currentR);
}
