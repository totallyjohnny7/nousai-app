/**
 * FSRS-4.5 Spaced Repetition Scheduler
 * Based on "A Stochastic Shortest Path Algorithm for Optimizing Spaced Repetition Scheduling" by Ye et al.
 * Ported from the NousAI Obsidian plugin.
 */

import type { SRCard } from '../types';

// FSRS-4.5 optimized weights (trained on 20K+ users)
const W = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0092,
  1.5988, 0.1176, 1.0013, 2.1214, 0.0904, 0.3025, 2.1214, 0.2498,
  2.9466, 0.4891, 0.6468
];

const FACTOR = 19 / 81;
const DECAY = -0.5;

interface FSRSConfig {
  retentionTarget: number;   // 0.9 = 90% desired recall
  maxInterval: number;       // 365 days
  minInterval: number;       // 1 day
  interleaveBuckets: number; // 3
}

const DEFAULT_CONFIG: FSRSConfig = {
  retentionTarget: 0.92, // Pre-med requires higher retention (MCAT-level)
  maxInterval: 180,      // Cap at 6 months to keep medical content active
  minInterval: 1,
  interleaveBuckets: 3,
};

export type Grade = 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy
export type CardState = 'new' | 'learning' | 'review' | 'mature';

export interface FSRSCard {
  key: string;
  topic: string;
  front: string;
  back: string;
  state: CardState;
  stability: number;    // S: memory stability in days
  difficulty: number;   // D: item difficulty [1, 10]
  interval: number;     // current interval in days
  lapses: number;       // number of times forgotten
  reps: number;         // total reviews
  lastReview: string;   // ISO date
  nextReview: string;   // ISO date
}

// ─── Core Math ──────────────────────────────────────────

/** Retrievability: probability of recall after t days with stability S */
export function retrievability(t: number, S: number): number {
  if (!S || S <= 0) return 0; // Guard: new card or corrupt stability
  return Math.pow(1 + FACTOR * t / S, DECAY);
}

/** Optimal interval to reach desired retention */
export function optimalInterval(S: number, config: FSRSConfig = DEFAULT_CONFIG): number {
  const t = (S / FACTOR) * (Math.pow(config.retentionTarget, 1 / DECAY) - 1);
  return Math.max(config.minInterval, Math.min(config.maxInterval, Math.round(t)));
}

/** Initial difficulty for a new card based on first grade */
export function initDifficulty(grade: Grade): number {
  const d = W[4] - Math.exp(W[5] * (grade - 1)) + 1;
  return Math.max(1, Math.min(10, d));
}

/** Initial stability for a new card based on first grade */
export function initStability(grade: Grade): number {
  return Math.max(0.1, W[grade - 1]);
}

/** Next difficulty after a review */
export function nextDifficulty(D: number, grade: Grade): number {
  const D0_3 = W[4] - Math.exp(W[5] * 2) + 1; // default difficulty for grade 3
  const dNew = W[7] * D0_3 + (1 - W[7]) * (D - W[6] * (grade - 3));
  return Math.max(1, Math.min(10, dNew));
}

/** Next stability after a successful review (grade >= 2) */
export function nextStabilitySuccess(D: number, S: number, R: number, grade: Grade): number {
  const hardPenalty = grade === 2 ? W[15] : 1;
  const easyBonus = grade === 4 ? W[16] : 1;
  const inner = Math.exp(W[8]) * (11 - D) * Math.pow(S, -W[9]) *
    (Math.exp(W[10] * (1 - R)) - 1) * hardPenalty * easyBonus;
  return Math.max(0.1, S * (1 + inner));
}

/** Next stability after a failed review (grade = 1) */
export function nextStabilityFail(D: number, S: number, R: number): number {
  const sNew = W[11] * Math.pow(D, -W[12]) * (Math.pow(S + 1, W[13]) - 1) * Math.exp(W[14] * (1 - R));
  return Math.max(0.1, Math.min(S, sNew));
}

// ─── Card Review ────────────────────────────────────────

/** Process a review for a card, returning the updated card */
export function reviewCard(card: FSRSCard, grade: Grade, config: FSRSConfig = DEFAULT_CONFIG): FSRSCard {
  const now = new Date();
  const updated = { ...card };

  if (card.state === 'new' || card.reps === 0) {
    // First review
    updated.stability = initStability(grade);
    updated.difficulty = initDifficulty(grade);
    updated.state = 'learning';
  } else {
    // Subsequent review
    const lastReviewDate = new Date(card.lastReview);
    // Guard against invalid dates (NaN propagation)
    const rawElapsed = (now.getTime() - lastReviewDate.getTime()) / (1000 * 60 * 60 * 24);
    const elapsedDays = Number.isFinite(rawElapsed) ? Math.max(0, rawElapsed) : 0;
    const S = card.stability || 0.1; // Guard against S=0 (division by zero)
    const R = retrievability(elapsedDays, S);

    // IMPORTANT: Compute stability BEFORE updating difficulty (FSRS-4.5 spec)
    const oldDifficulty = card.difficulty;

    if (grade === 1) {
      // Failed — compute stability with OLD difficulty per FSRS spec
      updated.stability = nextStabilityFail(oldDifficulty, S, R);
      updated.lapses = card.lapses + 1;
      updated.state = 'learning';
    } else {
      // Success — compute stability with OLD difficulty per FSRS spec
      updated.stability = nextStabilitySuccess(oldDifficulty, S, R, grade);
      if (updated.stability >= 21) {
        updated.state = 'mature';
      } else {
        updated.state = 'review';
      }
    }

    // NOW update difficulty after stability has been calculated
    updated.difficulty = nextDifficulty(oldDifficulty, grade);
  }

  updated.reps = card.reps + 1;
  updated.interval = optimalInterval(updated.stability, config);
  updated.lastReview = now.toISOString();

  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + updated.interval);
  updated.nextReview = nextDate.toISOString();

  return updated;
}

// ─── Quiz-to-FSRS Bridge ───────────────────────────────

/** Map a quiz percentage to an FSRS grade */
export function quizPercentToGrade(pct: number): Grade {
  if (pct >= 90) return 4; // Easy
  if (pct >= 70) return 3; // Good
  if (pct >= 50) return 2; // Hard
  return 1; // Again
}

/** Map a single question result to a grade based on correctness and response time */
export function questionToGrade(correct: boolean, responseTimeMs: number): Grade {
  if (!correct) return 1;
  if (responseTimeMs < 5000) return 4;  // Fast correct = Easy
  if (responseTimeMs > 30000) return 2; // Slow correct = Hard
  return 3; // Normal correct = Good
}

// ─── Due Cards ──────────────────────────────────────────

/** Get all cards that are due for review */
export function getDueCards(cards: FSRSCard[]): FSRSCard[] {
  const now = Date.now();
  return cards
    .filter(c => new Date(c.nextReview).getTime() <= now)
    .sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
}

/** Get due cards interleaved across topics for better learning */
export function getDueInterleaved(cards: FSRSCard[], buckets: number = DEFAULT_CONFIG.interleaveBuckets): FSRSCard[] {
  const due = getDueCards(cards);
  if (due.length === 0) return [];

  // Group by topic
  const byTopic = new Map<string, FSRSCard[]>();
  for (const card of due) {
    const topic = card.topic || 'general';
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic)!.push(card);
  }

  // Round-robin across topics
  const topics = Array.from(byTopic.values());
  const result: FSRSCard[] = [];
  let idx = 0;
  while (result.length < due.length) {
    for (const topicCards of topics) {
      if (idx < topicCards.length) {
        result.push(topicCards[idx]);
      }
    }
    idx++;
  }

  return result;
}

/** Extract display front/back from a legacy SRCard based on its key format */
function extractCardContent(card: SRCard): { front: string; back: string } {
  const key = card.key || '';

  // q:: cards — quiz questions with questionText field
  if (key.startsWith('q::') && card.questionText) {
    return { front: card.questionText, back: card.subtopic || card.subject || '' };
  }

  // match: cards — term is embedded in key like "match:COURSE:term::COURSE"
  if (key.startsWith('match:')) {
    const withoutPrefix = key.replace(/^match:/, '');
    // Format: "COURSE:term::COURSE" — extract term between first : and ::
    const colonIdx = withoutPrefix.indexOf(':');
    const dblColonIdx = withoutPrefix.indexOf('::');
    if (colonIdx >= 0 && dblColonIdx > colonIdx) {
      const term = withoutPrefix.substring(colonIdx + 1, dblColonIdx).trim();
      return { front: term, back: card.subtopic || card.subject || '' };
    }
    return { front: withoutPrefix, back: card.subtopic || '' };
  }

  // jp:write: cards — Japanese writing practice
  if (key.startsWith('jp:write:')) {
    const char = key.replace('jp:write:', '');
    return { front: `Write: ${char}`, back: card.subtopic || `Writing: ${char}` };
  }

  // jp:read: cards — Japanese reading practice
  if (key.startsWith('jp:read:')) {
    const char = key.replace('jp:read:', '');
    return { front: `Read: ${char}`, back: card.subtopic || `Reading: ${char}` };
  }

  // Deck-level entries (e.g. "BIOL 4230/8236::Chapter 10 Termnology")
  // Extract meaningful name from key
  if (key.includes('::')) {
    const parts = key.split('::');
    const deckName = parts[parts.length - 1] || parts[0];
    return { front: deckName, back: card.subject || parts[0] || '' };
  }

  // Fallback
  return { front: card.subtopic || key, back: card.subject || '' };
}

/** Convert legacy SRCard format to FSRSCard */
export function convertFromLegacy(card: SRCard): FSRSCard {
  const { front, back } = extractCardContent(card);
  return {
    key: card.key || String(Date.now()),
    topic: card.subject || card.subtopic || 'general',
    front,
    back,
    state: (card.S ?? 0) >= 21 ? 'mature' : (card.S ?? 0) > 0 ? 'review' : 'new',
    stability: card.S || 0.1, // Guard: S=0 causes division-by-zero in retrievability()
    difficulty: card.D ?? 5,
    interval: card.scheduledDays ?? 0,
    lapses: card.lapses ?? 0,
    reps: card.reps ?? 0,
    lastReview: card.lastReview || new Date().toISOString(),
    nextReview: card.nextReview || new Date().toISOString(),
  };
}
