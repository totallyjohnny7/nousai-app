/**
 * Progressive Disclosure — unlock features over time.
 * Based on Vygotsky (1978) Zone of Proximal Development.
 *
 * Day 1:  10 core features (grading, OMNI, RSVP, etc.)
 * Day 7:  +10 intermediate (Feynman, Dual Coding, etc.)
 * Day 30: +11 genius techniques (Visualize, Simulate, etc.)
 */

export type FeatureTier = 'day1' | 'day7' | 'day30';

export interface FeatureGate {
  id: string;
  name: string;
  tier: FeatureTier;
  description: string;
}

const FEATURE_GATES: FeatureGate[] = [
  // Day 1 — Core (available immediately)
  { id: 'grading', name: 'Card Grading', tier: 'day1', description: 'Again/Hard/Good/Easy' },
  { id: 'omni-protocol', name: 'Omni Protocol', tier: 'day1', description: '60-min auto session' },
  { id: 'rsvp', name: 'RSVP Preview', tier: 'day1', description: 'Rapid card preview' },
  { id: 'pre-test', name: 'Pre-Test', tier: 'day1', description: 'Baseline assessment' },
  { id: 'focus-lock', name: 'Focus Lock', tier: 'day1', description: 'Deep focus mode' },
  { id: 'interleave', name: 'Interleave', tier: 'day1', description: 'Mix subjects' },
  { id: 'efficiency', name: 'Efficiency Score', tier: 'day1', description: 'Live performance metric' },
  { id: 'type-recall', name: 'Type-to-Recall', tier: 'day1', description: 'Generation effect' },
  { id: 'stats', name: 'Session Stats', tier: 'day1', description: 'Performance tracking' },

  // Day 7 — Intermediate
  { id: 'feynman', name: 'Feynman Mode', tier: 'day7', description: 'Explain like teaching' },
  { id: 'dual-coding', name: 'Dual Coding', tier: 'day7', description: 'AI visual per card' },
  { id: 'examples', name: 'Concrete Examples', tier: 'day7', description: 'Real-world analogies' },
  { id: 'why-chain', name: 'Why? Chain', tier: 'day7', description: 'Elaborative interrogation' },
  { id: 'voice-recall', name: 'Voice Recall', tier: 'day7', description: 'Speak answers' },
  { id: 'context-guard', name: 'Context Switch Guard', tier: 'day7', description: 'Alt-Tab detection' },
  { id: 'cram', name: 'Cram Mode', tier: 'day7', description: 'Emergency review' },
  { id: 'day-summary', name: 'Day Summary', tier: 'day7', description: 'End-of-day report' },
  { id: 'mnemonic', name: 'AI Mnemonic', tier: 'day7', description: 'Memory aids' },
  { id: 'adaptive-session', name: 'Adaptive Session', tier: 'day7', description: 'Smart duration' },

  // Day 30 — Genius Stack
  { id: 'visualize', name: 'Einstein Visualization', tier: 'day30', description: 'Mental movies' },
  { id: 'simulate', name: 'Tesla Simulation', tier: 'day30', description: 'Walk through from memory' },
  { id: 'confused', name: 'Confusion Tracker', tier: 'day30', description: 'Diagnose WHY you failed' },
  { id: 'models', name: 'Mental Models', tier: 'day30', description: 'Framework overlays' },
  { id: 'first-principles', name: 'First Principles', tier: 'day30', description: 'Strip assumptions' },
  { id: 'devil', name: "Devil's Advocate", tier: 'day30', description: 'Counter-arguments' },
  { id: 'compress', name: 'Pattern Compression', tier: 'day30', description: '12 cards → 1 pattern' },
  { id: 'tool-gap', name: 'Tool Gap Detector', tier: 'day30', description: 'Find missing prerequisites' },
  { id: 'bridge', name: 'Bridge Cards', tier: 'day30', description: 'Cross-subject connections' },
  { id: 'shuffle', name: 'Context Shuffler', tier: 'day30', description: '5 framings per concept' },
  { id: 'palace', name: 'Memory Palace', tier: 'day30', description: 'Spatial memory walks' },
];

export function getUnlockedFeatures(
  streakDays: number,
  totalCardsReviewed: number,
  averageRetention: number
): Set<string> {
  const unlocked = new Set<string>();

  // Day 1 — always unlocked
  FEATURE_GATES.filter(f => f.tier === 'day1').forEach(f => unlocked.add(f.id));

  // Day 7 — 7-day streak + 100 cards
  if (streakDays >= 7 && totalCardsReviewed >= 100) {
    FEATURE_GATES.filter(f => f.tier === 'day7').forEach(f => unlocked.add(f.id));
  }

  // Day 30 — 30-day streak + 500 cards + 75% retention
  if (streakDays >= 30 && totalCardsReviewed >= 500 && averageRetention >= 0.75) {
    FEATURE_GATES.filter(f => f.tier === 'day30').forEach(f => unlocked.add(f.id));
  }

  return unlocked;
}

export function isFeatureUnlocked(
  featureId: string,
  streakDays: number,
  totalCardsReviewed: number,
  averageRetention: number
): boolean {
  return getUnlockedFeatures(streakDays, totalCardsReviewed, averageRetention).has(featureId);
}

export function getFeatureGate(featureId: string): FeatureGate | undefined {
  return FEATURE_GATES.find(f => f.id === featureId);
}

export function getAllFeatureGates(): FeatureGate[] {
  return FEATURE_GATES;
}
