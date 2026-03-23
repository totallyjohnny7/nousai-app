/**
 * Omni Protocol V6 — Pure helpers and Claude prompt builders.
 * No React, no store access. All functions are pure TypeScript.
 */

import type { Course, SRData, OmniArcPhase, OmniDifficulty, OmniProtocolData, OmniFeynmanGap, OmniSessionPlan, OmniAdaptiveAllocation, OmniMCQuestion, OmniCrisisErrorType, OmniCrisisMCAnswer, OmniCrisisAdaptiveAllocation } from '../types';
import type { FSRSCard } from './fsrs';
import type { AIMessage } from './ai';

// ── Constants ────────────────────────────────────────────────────────────────

export const LOW_ACCURACY_THRESHOLD = 40;   // % accuracy threshold for motivation collapse
export const COLLAPSE_TRIGGER_PHASES = 2;   // consecutive phases below threshold → collapse
export const COLLAPSE_EXIT_CORRECT = 3;     // consecutive correct answers → exit collapse

// ── Duration / Cycle Mapping ─────────────────────────────────────────────────

export interface OmniDurationConfig {
  durationMin: number;
  cycleCount: number;
  extended: boolean;  // true = last cycle gets additional phase time
}

export function parseDurationChoice(minutes: number): OmniDurationConfig {
  switch (minutes) {
    case 60:  return { durationMin: 60,  cycleCount: 1, extended: false };
    case 90:  return { durationMin: 90,  cycleCount: 1, extended: true  };
    case 120: return { durationMin: 120, cycleCount: 2, extended: false };
    case 150: return { durationMin: 150, cycleCount: 2, extended: true  };
    case 180: return { durationMin: 180, cycleCount: 3, extended: false };
    default:  return { durationMin: 60,  cycleCount: 1, extended: false };
  }
}

// ── Data Pull Helpers ─────────────────────────────────────────────────────────

/** Get FSRS cards for a session, filtered by course + topic */
export function getOmniDueCards(
  srData: SRData | null,
  filter: { courseIds: string[]; topics: string[] }
): FSRSCard[] {
  if (!srData?.cards?.length) return [];
  const now = new Date().toISOString();
  // SRData uses SRCard format — filter by key prefix (courseId::...) and topic
  const allCards = srData.cards as unknown as FSRSCard[];
  return allCards.filter(c => {
    if (c.state === 'suspended') return false;
    const isDue = !c.nextReview || c.nextReview <= now || c.state === 'new';
    const courseMatch = filter.courseIds.length === 0 ||
      filter.courseIds.some(cid => c.key?.startsWith(cid));
    const topicMatch = filter.topics.length === 0 ||
      filter.topics.some(t => c.topic?.toLowerCase().includes(t.toLowerCase()));
    return isDue && courseMatch && topicMatch;
  }).slice(0, 30); // cap for context size
}

/** Get unresolved Feynman gaps for a course */
export function getPendingFeynmanGaps(
  omniData: OmniProtocolData | undefined,
  courseId: string
): OmniFeynmanGap[] {
  if (!omniData?.feynmanGaps?.length) return [];
  return omniData.feynmanGaps.filter(g => g.courseId === courseId && !g.resolved);
}

/** Extract cross-topic knowledge connections from course topics */
export function getKnowledgeGraphConnections(
  courses: Course[],
  courseId: string,
  topicId: string
): string[] {
  const course = courses.find(c => c.id === courseId);
  if (!course?.topics?.length) return [];
  const topic = course.topics.find(t => t.id === topicId || t.name === topicId);
  if (!topic) return [];
  // Cross-connect to other topics in the same course (simplified knowledge graph)
  return course.topics
    .filter(t => t.id !== topic.id && t.name !== topic.name)
    .slice(0, 5)
    .map(t => `${topic.name} ↔ ${t.name}`);
}

/** Determine arc phase to show as default for a course */
export function getArcPhaseForCourse(
  omniData: OmniProtocolData | undefined,
  courseId: string
): OmniArcPhase {
  return omniData?.currentArcPhase?.[courseId] ?? 'Foundation';
}

// ── Motivation State Machine ──────────────────────────────────────────────────

export interface MotivationState {
  consecutiveLowPhases: number;
  inCollapseMode: boolean;
  collapseEnteredAt?: string;
  consecutiveCorrectSinceCollapse: number;
  xpRevealMultiplier: number;   // 1 = normal, 2 = doubled during collapse
  motivationResets: number;     // total times collapse was triggered
}

export const INITIAL_MOTIVATION: MotivationState = {
  consecutiveLowPhases: 0,
  inCollapseMode: false,
  consecutiveCorrectSinceCollapse: 0,
  xpRevealMultiplier: 1,
  motivationResets: 0,
};

/**
 * Evaluate and update motivation state after a phase completes.
 * @param state  Current motivation state
 * @param phaseAccuracy  Accuracy for the just-completed phase (0–100)
 * @param correctAnswers  Number of correct answers in the phase (for exit tracking)
 */
export function evaluateMotivationState(
  state: MotivationState,
  phaseAccuracy: number,
  correctAnswers: number
): MotivationState {
  const next = { ...state };

  if (next.inCollapseMode) {
    // Track consecutive correct answers since collapse
    if (correctAnswers > 0) {
      next.consecutiveCorrectSinceCollapse += correctAnswers;
    }
    // Exit collapse after 3 consecutive correct
    if (next.consecutiveCorrectSinceCollapse >= COLLAPSE_EXIT_CORRECT) {
      next.inCollapseMode = false;
      next.consecutiveLowPhases = 0;
      next.consecutiveCorrectSinceCollapse = 0;
      next.xpRevealMultiplier = 1;
      next.collapseEnteredAt = undefined;
    }
  } else {
    // Check for collapse trigger
    if (phaseAccuracy < LOW_ACCURACY_THRESHOLD) {
      next.consecutiveLowPhases += 1;
      if (next.consecutiveLowPhases >= COLLAPSE_TRIGGER_PHASES) {
        next.inCollapseMode = true;
        next.collapseEnteredAt = new Date().toISOString();
        next.xpRevealMultiplier = 2;
        next.consecutiveCorrectSinceCollapse = 0;
        next.motivationResets += 1;
      }
    } else {
      // Good phase — reset low phase counter
      next.consecutiveLowPhases = 0;
    }
  }

  return next;
}

// ── Arc Phase Progression ─────────────────────────────────────────────────────

const ARC_PHASES: OmniArcPhase[] = ['Foundation', 'BuildUp', 'Application', 'Synthesis', 'Mastery'];
const ARC_ADVANCE_ACCURACY_THRESHOLD = 70; // % required to advance arc phase

/**
 * Determine the new arc phase after a session completes.
 * Only advances if overall session accuracy >= 70%.
 * Claude's advisory text is ignored — accuracy gate is enforced.
 */
export function determineArcPhaseProgression(
  current: OmniArcPhase,
  sessionAccuracy: number
): OmniArcPhase {
  if (sessionAccuracy < ARC_ADVANCE_ACCURACY_THRESHOLD) return current;
  const idx = ARC_PHASES.indexOf(current);
  if (idx < 0 || idx >= ARC_PHASES.length - 1) return current;
  return ARC_PHASES[idx + 1];
}

// ── Session ID Generator ──────────────────────────────────────────────────────

export function generateSessionId(): string {
  return `omni-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Claude Prompt Builders ────────────────────────────────────────────────────

/**
 * Build the intake call messages (Wizard Step 2).
 * Claude returns: { type: "questions", questions: [...] } or { type: "cold_start", diagnostic: [...] }
 */
export function buildIntakePrompt(params: {
  topic: string;
  courseName: string;
  difficulty: OmniDifficulty;
  arcPhase: OmniArcPhase;
  feynmanGaps: OmniFeynmanGap[];
  fsrsDueCount: number;
}): AIMessage[] {
  const isColdStart = params.arcPhase === 'Foundation' || params.fsrsDueCount === 0;
  const gapList = params.feynmanGaps.map(g => g.concept).join(', ') || 'none';

  const system = `You are a learning scientist conducting a pre-session intake assessment.
Your role: quickly identify what the student knows and doesn't know about the topic.
Be brief. Be diagnostic. Do not teach. Respond ONLY with valid JSON.`;

  const user = isColdStart
    ? `Student is about to study: "${params.topic}" from course "${params.courseName}".
Difficulty: ${params.difficulty}. Arc phase: ${params.arcPhase} (first exposure / minimal prior knowledge).
Prior unresolved Feynman gaps: ${gapList}.

Generate a 5-question diagnostic quiz to assess baseline knowledge.
Return ONLY this JSON (no markdown, no preamble):
{"type":"cold_start","diagnostic":["Question 1?","Question 2?","Question 3?","Question 4?","Question 5?"]}`
    : `Student is about to study: "${params.topic}" from course "${params.courseName}".
Difficulty: ${params.difficulty}. Arc phase: ${params.arcPhase}.
FSRS cards due: ${params.fsrsDueCount}. Prior unresolved Feynman gaps: ${gapList}.

Generate 3-5 clarifying intake questions about:
- Current understanding of the topic
- Specific weak subtopics they're struggling with
- Which WHY chains (causal mechanisms) they have already built
- Preferred format (flashcards, explanations, problems)

Return ONLY this JSON (no markdown, no preamble):
{"type":"questions","questions":["Question 1?","Question 2?","Question 3?"]}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Build the session plan generation messages (Wizard Step 4).
 * Claude returns the full OmniSessionPlan JSON.
 */
export function buildSessionPlanPrompt(params: {
  topic: string;
  courseName: string;
  difficulty: OmniDifficulty;
  arcPhase: OmniArcPhase;
  durationConfig: OmniDurationConfig;
  intakeAnswers: string;
  professorEmphasis: string;
  fsrsDueCards: FSRSCard[];
  feynmanGaps: OmniFeynmanGap[];
  knowledgeConnections: string[];
  sessionId: string;
  // V6.1 optional — study guide flow
  studyGuideSummary?: string;
  studyGuideKeywords?: string[];
  allocation?: OmniAdaptiveAllocation;
  preTestResults?: { correct: number; total: number; pct: number; weakAreas: string[]; strongAreas: string[] };
}): AIMessage[] {
  const { durationConfig: dc, allocation } = params;
  const fGaps = params.feynmanGaps.map(g => g.concept);
  const dueKeys = params.fsrsDueCards.map(c => c.key).slice(0, 20);
  const profEmphasis = params.professorEmphasis.trim()
    ? params.professorEmphasis.trim()
    : 'Use MCAT/AP high-frequency topic weighting for this subject';

  // V6.1: Build adaptive phase sequence if allocation exists
  const phaseSequence = allocation
    ? `Prime(${allocation.phase1_prime}min) → Chunk(${allocation.phase2_chunk}min) → Decode(${allocation.phase2_5_decode}min) → Encode(${allocation.phase3_encode}min) → Connect(${allocation.phase4_connect}min) → Break(${allocation.phase5_break}min) → Test(${allocation.phase6_test}min) → Anchor(${allocation.phase7_anchor}min)`
    : `Prime(5min) → Chunk(5min) → Encode(15min) → Connect(10min) → Break(5min) → Test(10min) → Anchor(5min) → Report(5min)
${dc.extended ? 'Extended session: add 5min to Encode and 5min to Test in the last cycle.' : ''}`;

  const adaptiveConstraint = allocation
    ? '\n10. The adaptive allocation above is a HARD CONSTRAINT. Do not equalize phase times. Weak areas must receive proportionally longer Encode treatment and more WHY-chain depth. Strong areas may be acknowledged briefly and moved past.'
    : '';

  const system = `You are an expert learning engineer building a personalized Omni Protocol v6.1 study session.

RULES (non-negotiable):
1. Return ONLY valid JSON. No markdown fences. No preamble. No text after the JSON.
2. Bloom's escalation is mandatory: Cycle 1 = Remember/Understand, Cycle 2 = Apply/Analyze, Cycle 3 = Evaluate/Create
3. Every Encode phase: mnemonic + analogy BEFORE formal definition. Order: Abstract → Concrete → Formal.
4. Every Cycle must cover DIFFERENT subtopics — zero repeated content across cycles.
5. Domain rules: Biology=pathway diagrams, Chemistry=draw the molecule, Physics=unit analysis, Anatomy=function grouping.
6. WHY chains required in Cycle 1 (e.g., "Na/K pump moves 3 Na out → WHY? → membrane potential → WHY? → neuron fires").
7. Cycle 3 must include "what breaks if this mechanism fails?" and professor-angle questions.
8. Passive review (rereading, highlighting) is FORBIDDEN anywhere in any phase.
9. Every phase must specify visualAnchor, auditoryHook, and kinesthetic — text-only phases are invalid.${adaptiveConstraint}

PHASE SEQUENCE PER CYCLE:
${phaseSequence}

JSON SCHEMA:
{
  "sessionId": "${params.sessionId}",
  "sessionTitle": "string",
  "totalDuration": number,
  "cycleCount": number,
  "studentArcPhase": "Foundation|BuildUp|Application|Synthesis|Mastery",
  "focusSummary": "string",
  "standardsRef": ["string"],
  "professorEmphasis": ["string"],
  "fsrsDueCardKeys": ["string"],
  "feynmanGapIds": ["string"],
  "cycles": [{
    "cycleNumber": number,
    "cycleTheme": "string",
    "bloomsTarget": "string",
    "whyChains": ["string"],
    "phases": [{
      "name": "Prime|Chunk|Encode|Connect|Break|Test|Anchor|Report",
      "duration": number,
      "content": "string",
      "keyPoints": ["string"],
      "mnemonic": "string",
      "analogy": "string",
      "visualAnchor": "string",
      "auditoryHook": "string",
      "kinesthetic": "string",
      "bloomsTag": "Remember|Understand|Apply|Analyze|Evaluate|Create",
      "failurePatterns": ["string"],
      "domainRule": "string"
    }]
  }],
  "flashcardFilter": { "topics": ["string"], "courseIds": ["string"] },
  "generatedAt": "ISO timestamp"
}`;

  // V6.1: Build study guide section if available, otherwise use intake answers
  const studyGuideSection = params.studyGuideSummary && params.allocation
    ? `ADAPTIVE TIME ALLOCATION (computed from pre-test — DO NOT override these):
Phase 1 — Prime:    ${params.allocation.phase1_prime} min
Phase 2 — Chunk:    ${params.allocation.phase2_chunk} min
Phase 2.5 — Decode: ${params.allocation.phase2_5_decode} min
Phase 3 — Encode:   ${params.allocation.phase3_encode} min
Phase 4 — Connect:  ${params.allocation.phase4_connect} min
Phase 5 — Break:    ${params.allocation.phase5_break} min (per cycle)
Phase 6 — Test:     ${params.allocation.phase6_test} min
Phase 7 — Anchor:   ${params.allocation.phase7_anchor} min

STUDY GUIDE SUMMARY (student-reviewed, max 300 words):
${truncateToWords(params.studyGuideSummary, 300)}

KEY TERMS FROM GUIDE:
${(params.studyGuideKeywords ?? []).join(', ')}

PRE-TEST SCORE: ${params.preTestResults?.pct ?? 0}%
WEAK AREAS (expand WHY-chains, slower pace, more examples):
${params.preTestResults?.weakAreas.join(', ') || 'none'}
STRONG AREAS (brief acknowledgment, move fast):
${params.preTestResults?.strongAreas.join(', ') || 'none'}`
    : `INTAKE ANSWERS:
${params.intakeAnswers || 'No intake data — assume baseline knowledge gaps.'}`;

  const user = `Build a ${dc.durationMin}-minute, ${dc.cycleCount}-cycle Omni Protocol v6.1 session:

TOPIC: "${params.topic}"
COURSE: "${params.courseName}"
DIFFICULTY: ${params.difficulty}
ARC PHASE: ${params.arcPhase}
PROFESSOR EMPHASIS: ${profEmphasis}

${studyGuideSection}

FSRS DUE CARD KEYS (prioritize these in Test/Encode phases):
${dueKeys.length ? dueKeys.join(', ') : 'none'}

PRIOR UNRESOLVED FEYNMAN GAPS (must be addressed):
${fGaps.length ? fGaps.join('\n') : 'none'}

KNOWLEDGE GRAPH CONNECTIONS (weave these into Connect + Report phases):
${params.knowledgeConnections.length ? params.knowledgeConnections.join('\n') : 'none'}

Now generate the complete session plan JSON.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Build the final report messages (after all cycles complete).
 * Claude returns a structured narrative with 7 sections.
 */
export function buildFinalReportPrompt(params: {
  plan: OmniSessionPlan;
  phaseAccuracies: { cycleIdx: number; phaseName: string; accuracy: number }[];
  totalXp: number;
  totalTimeSec: number;
  motivationResets: number;
  feynmanGapsDetected: string[];   // concept names flagged as "still unclear"
}): AIMessage[] {
  const avgAccuracy = params.phaseAccuracies.length
    ? Math.round(params.phaseAccuracies.reduce((s, p) => s + p.accuracy, 0) / params.phaseAccuracies.length)
    : 0;
  const minutes = Math.round(params.totalTimeSec / 60);
  const phaseLog = params.phaseAccuracies
    .map(p => `Cycle ${p.cycleIdx + 1} ${p.phaseName}: ${p.accuracy}%`)
    .join(', ');

  const system = `You are a learning coach writing a post-session debrief. Be specific and actionable.
Reference exact concepts from the session plan. No filler. No praise-padding. Max 450 tokens total.
Use ## headers for each section.`;

  const user = `Write the post-session debrief for this Omni Protocol v6 session:

SESSION: "${params.plan.sessionTitle}"
TOPIC: ${params.plan.focusSummary}
ARC PHASE: ${params.plan.studentArcPhase}
WHY CHAINS TARGETED: ${params.plan.cycles.flatMap(c => c.whyChains).join(' | ') || 'none'}
TOTAL XP: ${params.totalXp} | OVERALL ACCURACY: ${avgAccuracy}% | TIME: ${minutes} min | MOTIVATION RESETS: ${params.motivationResets}
PER-PHASE ACCURACY: ${phaseLog}

FEYNMAN GAPS FLAGGED AS "STILL UNCLEAR" THIS SESSION:
${params.feynmanGapsDetected.length ? params.feynmanGapsDetected.join('\n') : 'none'}

Write exactly 7 sections:
## Mastered
## Still Needs Work
## WHY Chains Still Broken
## Feynman Gaps Remaining
## Recommended Next Session
## Arc Phase Progress
## Transfer Question
(The transfer question must be a novel problem that applies today's learning in a new context.)`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Parse Claude's session plan response, with fallback JSON extraction.
 * Returns null if parsing fails after all attempts.
 */
export function parseSessionPlanResponse(raw: string): OmniSessionPlan | null {
  // Attempt 1: direct parse
  try { return JSON.parse(raw); } catch { /* fall through */ }
  // Attempt 2: extract JSON object via regex
  const match = raw.match(/\{[\s\S]+\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  return null;
}

// ── V6.1 — Adaptive Duration Engine ─────────────────────────────────────────

// Duration tier base pools — minutes available before pre-test reallocation
const DURATION_TIERS: Record<number, { baseChunkPool: number; baseTestPool: number }> = {
  60:  { baseChunkPool: 15, baseTestPool: 12 },
  90:  { baseChunkPool: 22, baseTestPool: 18 },
  120: { baseChunkPool: 28, baseTestPool: 22 },
  150: { baseChunkPool: 35, baseTestPool: 28 },
  180: { baseChunkPool: 40, baseTestPool: 35 },
};

// Phase floors (non-negotiable minimums) and ceilings (per cycle, in minutes)
const PHASE_FLOORS   = { chunk: 10, decode: 5, encode: 12, connect: 8, test: 10 };
const PHASE_CEILINGS = { chunk: 30, decode: 15, encode: 35, connect: 20, test: 30 };
const FIXED_OVERHEAD  = { prime: 7, decode: 8, breakPerCycle: 6, anchor: 7 };

/** Truncate text to N words, appending [trimmed] if exceeded */
export function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + ' [trimmed]';
}

/** Count words in text */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Score-bucket multipliers for adaptive allocation — Bjork (1994) desirable difficulties */
function getScoreMultipliers(pct: number): { chunk: number; encode: number; connect: number; test: number } {
  if (pct <= 30) return { chunk: 1.20, encode: 1.15, connect: 1.10, test: 1.00 }; // novice: more encoding
  if (pct <= 60) return { chunk: 1.00, encode: 1.10, connect: 1.00, test: 1.10 }; // developing: balanced
  if (pct <= 80) return { chunk: 0.90, encode: 1.00, connect: 1.10, test: 1.15 }; // solid: more retrieval
  return              { chunk: 0.80, encode: 0.90, connect: 1.10, test: 1.25 }; // strong: max retrieval challenge
}

/** Crisis mode multipliers — encoding bottleneck + retrieval-only focus */
function getCrisisMultipliers(pct: number): { chunk: number; encode: number; connect: number; test: number } {
  return {
    chunk:   pct < 40 ? 1.3 : pct > 70 ? 0.8 : 1.0,
    encode:  1.2,   // always expanded — encoding window is the crisis bottleneck
    connect: 0.4,   // always compressed — schema building is long-term investment
    test:    1.4,   // always expanded — retrieval is the only thing that matters in 48hrs
  };
}

/** Human-readable explanation of adaptive adjustments */
function buildAdaptationNote(
  pct: number,
  weakAreas: string[],
  strongAreas: string[],
  defaults: Record<string, number>,
  adapted: Record<string, number>,
  crisisMode?: boolean
): string {
  const bucket = pct <= 30 ? 'novice' : pct <= 60 ? 'developing' : pct <= 80 ? 'solid' : 'strong';
  const changes: string[] = [];

  for (const [phase, val] of Object.entries(adapted)) {
    const diff = val - (defaults[phase] ?? val);
    if (diff > 0) changes.push(`${phase} expanded +${diff}min`);
    if (diff < 0) changes.push(`${phase} trimmed ${diff}min`);
  }

  const prefix = crisisMode ? 'Crisis Mode. ' : '';
  const weakNote = weakAreas.length ? `Weak areas targeted: ${weakAreas.join(', ')}.` : '';
  const strongNote = strongAreas.length ? `Strong areas will move faster: ${strongAreas.join(', ')}.` : '';

  return `${prefix}You scored ${pct}% (${bucket}). ${changes.join('. ')}. ${weakNote} ${strongNote}`.trim();
}

/**
 * Core adaptive engine — redistributes phase minutes based on pre-test results.
 * Implements Region of Proximal Learning (Metcalfe & Kornell, 2005) and
 * Desirable Difficulties (Bjork, 1994).
 */
export function computeAdaptiveAllocation(
  totalMinutes: number,
  preTestPct: number,
  weakAreas: string[],
  strongAreas: string[],
  cycleCount: number,
  crisisMode = false
): OmniAdaptiveAllocation {
  const tier = DURATION_TIERS[totalMinutes] ?? DURATION_TIERS[60];
  const fixed = FIXED_OVERHEAD.prime + FIXED_OVERHEAD.decode
              + (FIXED_OVERHEAD.breakPerCycle * cycleCount)
              + FIXED_OVERHEAD.anchor;

  // Per-topic adjustments
  const weakPenalty   = Math.min(weakAreas.length * 2, 10);
  const strongBonus   = Math.min(strongAreas.length * 1, 5);

  let chunkPool = tier.baseChunkPool + weakPenalty - strongBonus;
  let testPool  = tier.baseTestPool  + weakPenalty;

  // Score-bucket multipliers
  const mult = crisisMode ? getCrisisMultipliers(preTestPct) : getScoreMultipliers(preTestPct);
  chunkPool = Math.round(chunkPool * mult.chunk);
  testPool  = Math.round(testPool  * mult.test);

  // Distribute remaining budget
  const remaining = totalMinutes - fixed;
  let encode  = Math.round(remaining * 0.30 * mult.encode);
  let connect = Math.round(remaining * 0.18 * mult.connect);
  let chunk   = Math.min(chunkPool, PHASE_CEILINGS.chunk);
  let test    = Math.min(testPool,  PHASE_CEILINGS.test);

  // Enforce floors
  chunk   = Math.max(chunk,   PHASE_FLOORS.chunk);
  encode  = Math.max(encode,  PHASE_FLOORS.encode);
  connect = Math.max(connect, PHASE_FLOORS.connect);
  test    = Math.max(test,    PHASE_FLOORS.test);

  // Reconcile: if total phases exceed remaining, trim Connect first, then Encode
  let phaseTotal = chunk + FIXED_OVERHEAD.decode + encode + connect + test;
  if (phaseTotal > remaining) {
    const overflow = phaseTotal - remaining;
    const connectTrim = Math.min(overflow, connect - PHASE_FLOORS.connect);
    connect -= connectTrim;
    const stillOver = overflow - connectTrim;
    if (stillOver > 0) encode = Math.max(encode - stillOver, PHASE_FLOORS.encode);
  }

  // Build defaults for note comparison
  const defaultChunk   = Math.min(tier.baseChunkPool, PHASE_CEILINGS.chunk);
  const defaultTest    = Math.min(tier.baseTestPool,  PHASE_CEILINGS.test);
  const defaultEncode  = Math.round(remaining * 0.30);
  const defaultConnect = Math.round(remaining * 0.18);

  return {
    phase1_prime:    FIXED_OVERHEAD.prime,
    phase2_chunk:    chunk,
    phase2_5_decode: FIXED_OVERHEAD.decode,
    phase3_encode:   encode,
    phase4_connect:  connect,
    phase5_break:    FIXED_OVERHEAD.breakPerCycle,
    phase6_test:     test,
    phase7_anchor:   FIXED_OVERHEAD.anchor,
    adaptationNote: buildAdaptationNote(
      preTestPct, weakAreas, strongAreas,
      { Chunk: defaultChunk, Encode: defaultEncode, Connect: defaultConnect, Test: defaultTest },
      { Chunk: chunk, Encode: encode, Connect: connect, Test: test },
      crisisMode
    ),
  };
}

/**
 * Dynamically compute maxTokens for session plan API call.
 * V6 used hardcoded 2500 — too small for multi-cycle sessions, wasteful for simple ones.
 */
export function recommendOutputTokens(context: {
  studyGuideSummaryWords: number;
  keywordCount: number;
  weakAreaCount: number;
  strongAreaCount: number;
  totalMinutes: number;
  cycleCount: number;
}): { maxTokens: number; reasoning: string } {
  const { studyGuideSummaryWords, keywordCount, weakAreaCount, totalMinutes, cycleCount } = context;

  let base = cycleCount * 800;
  if (studyGuideSummaryWords > 200) base += 600;
  if (studyGuideSummaryWords > 250) base += 400;
  base += weakAreaCount * 200;
  if (keywordCount > 15) base += 300;
  if (totalMinutes >= 150) base += 800;
  if (totalMinutes >= 180) base += 400;

  const maxTokens = Math.min(Math.max(Math.ceil(base / 500) * 500, 3000), 12000);

  const parts: string[] = [];
  if (cycleCount >= 3)              parts.push(`${cycleCount} cycles = dense plan`);
  if (weakAreaCount >= 3)           parts.push(`${weakAreaCount} weak areas = extended WHY-chains`);
  if (studyGuideSummaryWords > 200) parts.push(`${studyGuideSummaryWords}-word summary = detailed Chunk/Encode`);
  if (totalMinutes >= 150)          parts.push(`${totalMinutes}min session = long per-phase content`);
  const reasoning = `Recommended ${maxTokens} tokens. Reason: ${parts.join(', ') || 'standard single-cycle session'}.`;

  return { maxTokens, reasoning };
}

// ── V6.1 — Study Guide + MC Pre-Test Prompts ────────────────────────────────

/**
 * Build prompt for AI summarization of pasted study guide.
 * Returns: { summary (250 words), keywords (15-25), mainTopics (3-8) }
 */
export function buildStudyGuideSummaryPrompt(params: {
  rawText: string;
  topic: string;
  courseName: string;
}): AIMessage[] {
  const system = `You are a learning scientist. Analyze the study guide below and return a JSON object with:
1. "summary": A 250-word summary focusing on key concepts, mechanisms, causal chains, and testable facts. Prioritize WHY explanations over WHAT definitions.
2. "keywords": An array of 15-25 domain-specific keywords/key terms extracted from the guide.
3. "mainTopics": An array of 3-8 main topic headings detected in the guide.

Return ONLY valid JSON. No markdown fences. No preamble.`;

  const MAX_INPUT_WORDS = 10_000;
  const inputWords = params.rawText.split(/\s+/).filter(Boolean);
  const truncated = inputWords.length > MAX_INPUT_WORDS
    ? inputWords.slice(0, MAX_INPUT_WORDS).join(' ') +
      '\n\n[Document truncated — first 10,000 words processed]'
    : params.rawText;

  const user = `Course: "${params.courseName}"
Topic focus: "${params.topic}"

STUDY GUIDE:
${truncated}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Build prompt for MC pre-test generation from study guide analysis.
 * Returns: { questions: MCQuestion[] } with 10 questions.
 * Bloom's: 3 Remember, 3 Apply, 2 Analyze, 2 Evaluate (escalating).
 */
export function buildMCPreTestPrompt(params: {
  summary: string;
  keywords: string[];
  mainTopics: string[];
  topic: string;
  courseName: string;
  difficulty: OmniDifficulty;
  arcPhase: OmniArcPhase;
  feynmanGaps: OmniFeynmanGap[];
}): AIMessage[] {
  const gapList = params.feynmanGaps.map(g => g.concept).join(', ') || 'none';

  const system = `You are a diagnostic assessment specialist. Generate exactly 10 multiple-choice questions to assess student knowledge.

RULES:
1. Each question: 4 options (A-D), exactly one correct answer.
2. Bloom's distribution: 3 Remember, 3 Apply, 2 Analyze, 2 Evaluate — escalate through the test.
3. Difficulty spread: 3 easy, 4 medium, 3 hard.
4. Must cover at least 60% of the mainTopics provided.
5. Use plausible distractors (common misconceptions), not random wrong answers.
6. ${params.feynmanGaps.length > 0 ? `2 questions MUST target these prior gaps: ${gapList}` : 'No prior gaps to target.'}
7. Each question must include a targetTopic field linking it to one of the mainTopics.
8. Return ONLY valid JSON. No markdown fences.

JSON SCHEMA:
{"questions":[{"q":"string","options":["A","B","C","D"],"correct":0,"difficulty":"easy|medium|hard","bloomsLevel":"Remember|Apply|Analyze|Evaluate","targetTopic":"string"}]}`;

  const user = `Course: "${params.courseName}"
Topic: "${params.topic}"
Difficulty: ${params.difficulty}
Arc phase: ${params.arcPhase}

STUDY GUIDE SUMMARY:
${params.summary}

KEYWORDS: ${params.keywords.join(', ')}

MAIN TOPICS: ${params.mainTopics.join(', ')}

Generate 10 diagnostic MC questions now.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Score MC pre-test results. Maps wrong answers to weak topics, correct to strong.
 * Implements calibration for adaptive allocation — Dunning-Kruger mitigation via objective measurement.
 */
export function scoreMCPreTest(
  questions: OmniMCQuestion[],
  answers: Record<number, number>
): { correct: number; total: number; pct: number; weakAreas: string[]; strongAreas: string[] } {
  let correct = 0;
  const weakSet = new Set<string>();
  const strongSet = new Set<string>();

  questions.forEach((q, i) => {
    if (answers[i] === q.correct) {
      correct++;
      strongSet.add(q.targetTopic);
    } else {
      weakSet.add(q.targetTopic);
    }
  });

  // Remove topics that appear in both (got some right, some wrong) — classify as weak
  for (const topic of weakSet) strongSet.delete(topic);

  return {
    correct,
    total: questions.length,
    pct: questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0,
    weakAreas: [...weakSet],
    strongAreas: [...strongSet],
  };
}

// ── V6.3 — Crisis Mode Functions ─────────────────────────────────────────────

/** Error treatment lookup for crisis mode prompt injection */
export const CRISIS_ERROR_TREATMENTS: Record<OmniCrisisErrorType, string> = {
  conceptual: 'WHY-chain card + Feynman pass required',
  procedural: 'Process card with step-by-step breakdown',
  confusion:  'Contrast card explicitly stating difference between X and Y',
  careless:   'Flag for exam-day attention. One read-aloud repetition only.',
};

/**
 * Categorize pre-test errors by type using confidence heuristic.
 * "Sure but wrong" = confusion error (mixed up two things).
 * "Guessed and wrong" = conceptual gap (don't know it at all).
 * Metcalfe & Finn (2008): error categorization reduces wasted re-study by 30-40%.
 */
export function categorizeCrisisErrors(
  questions: OmniMCQuestion[],
  answers: Record<number, number>,
  userConfidence?: Record<number, 'sure' | 'guess'>
): OmniCrisisMCAnswer[] {
  return questions.map((q, i) => {
    const selected = answers[i] ?? -1;
    const wasCorrect = selected === q.correct;
    let errorType: OmniCrisisErrorType | undefined;
    if (!wasCorrect) {
      errorType = userConfidence?.[i] === 'sure' ? 'confusion' : 'conceptual';
    }
    return { selectedOption: selected, wasCorrect, errorType, targetTopic: q.targetTopic };
  });
}

/**
 * Flag topics with 3+ associated keywords as "dense term" topics needing mnemonic-first encoding.
 * Individual carding of dense terms is the most common study trap in bio-heavy courses.
 * Paivio (1986) dual-coding: mnemonic-encoded lists are more exam-day stable.
 */
export function flagMnemonicTopics(
  keywords: string[],
  mainTopics: string[]
): string[] {
  return mainTopics.filter(topic => {
    const topicLower = topic.toLowerCase();
    const count = keywords.filter(k => k.toLowerCase().includes(topicLower)).length;
    return count >= 3;
  });
}

/**
 * Build crisis-specific session plan prompt.
 * Extends standard prompt with tier structure, error map, mnemonic injection, and adaptive allocation.
 */
export function buildCrisisSessionPlanPrompt(params: {
  topic: string;
  courseName: string;
  difficulty: OmniDifficulty;
  arcPhase: OmniArcPhase;
  durationConfig: OmniDurationConfig;
  professorEmphasis: string;
  fsrsDueCards: FSRSCard[];
  feynmanGaps: OmniFeynmanGap[];
  knowledgeConnections: string[];
  sessionId: string;
  studyGuideSummary: string;
  studyGuideKeywords: string[];
  allocation: OmniAdaptiveAllocation;
  preTestPct: number;
  weakAreas: string[];
  strongAreas: string[];
  tieredTopics: { tier1: string[]; tier2: string[]; tier3: string[] };
  errorMap: Record<string, OmniCrisisErrorType>;
  mnemonicTopics: string[];
}): AIMessage[] {
  const { durationConfig: dc, allocation } = params;
  const fGaps = params.feynmanGaps.map(g => g.concept);
  const dueKeys = params.fsrsDueCards.map(c => c.key).slice(0, 20);
  const profEmphasis = params.professorEmphasis.trim() || 'Use high-frequency topic weighting';

  const system = `You are an expert learning engineer building a CRISIS MODE Omni Protocol study session.

CRISIS MODE RULES (non-negotiable — these override standard rules):
1. Return ONLY valid JSON. No markdown fences. No preamble.
2. The adaptive allocation below is a HARD CONSTRAINT. Do not equalize phase times.
3. Tier 1 content receives WHY-chain depth and mnemonic encoding. Tier 2 receives standard treatment. Tier 3 is acknowledged only if time permits.
4. Conceptual gap topics require Feynman explanation BEFORE flashcard generation.
5. Confusion error topics require a contrast card (X vs Y explicitly stated).
6. Mnemonic topics: generate the mnemonic FIRST, then build cards from it.
7. Passive review is FORBIDDEN. Every phase must produce active output.
8. Every phase must specify visualAnchor, auditoryHook, and kinesthetic.
9. WHY chains required for all weak area topics.

PHASE SEQUENCE PER CYCLE:
Prime(${allocation.phase1_prime}min) → Chunk(${allocation.phase2_chunk}min) → Decode(${allocation.phase2_5_decode}min) → Encode(${allocation.phase3_encode}min) → Connect(${allocation.phase4_connect}min) → Break(${allocation.phase5_break}min) → Test(${allocation.phase6_test}min) → Anchor(${allocation.phase7_anchor}min)

JSON SCHEMA: same as standard Omni Protocol v6.`;

  const errorMapStr = Object.entries(params.errorMap)
    .map(([topic, type]) => `${topic}: ${type} → ${CRISIS_ERROR_TREATMENTS[type]}`)
    .join('\n');

  const user = `Build a ${dc.durationMin}-minute, ${dc.cycleCount}-cycle CRISIS MODE session:

TOPIC: "${params.topic}"
COURSE: "${params.courseName}"
DIFFICULTY: ${params.difficulty}
ARC PHASE: ${params.arcPhase}

CRISIS MODE ACTIVE. 48-hour protocol.

TIER STRUCTURE:
Tier 1 (65% time): ${params.tieredTopics.tier1.join(', ') || 'none'}
Tier 2 (30% time): ${params.tieredTopics.tier2.join(', ') || 'none'}
Tier 3 (5% if time): ${params.tieredTopics.tier3.join(', ') || 'none'}

ERROR MAP (treatment per topic):
${errorMapStr || 'none'}

MNEMONIC TOPICS (generate mnemonic in Encode phase):
${params.mnemonicTopics.join(', ') || 'none'}

ADAPTIVE TIME ALLOCATION (hard constraints — DO NOT override):
Phase 1 — Prime:    ${allocation.phase1_prime} min
Phase 2 — Chunk:    ${allocation.phase2_chunk} min
Phase 2.5 — Decode: ${allocation.phase2_5_decode} min
Phase 3 — Encode:   ${allocation.phase3_encode} min
Phase 4 — Connect:  ${allocation.phase4_connect} min
Phase 5 — Break:    ${allocation.phase5_break} min (per cycle)
Phase 6 — Test:     ${allocation.phase6_test} min
Phase 7 — Anchor:   ${allocation.phase7_anchor} min

STUDY GUIDE SUMMARY (student-reviewed):
${truncateToWords(params.studyGuideSummary, 300)}

KEY TERMS: ${params.studyGuideKeywords.join(', ')}

PRE-TEST SCORE: ${params.preTestPct}%
WEAK AREAS (expand WHY-chains, slower pace, more examples): ${params.weakAreas.join(', ') || 'none'}
STRONG AREAS (brief acknowledgment, move fast): ${params.strongAreas.join(', ') || 'none'}

PROFESSOR EMPHASIS: ${profEmphasis}

FSRS DUE CARD KEYS: ${dueKeys.length ? dueKeys.join(', ') : 'none'}

PRIOR FEYNMAN GAPS: ${fGaps.length ? fGaps.join(', ') : 'none'}

KNOWLEDGE CONNECTIONS: ${params.knowledgeConnections.length ? params.knowledgeConnections.join('\n') : 'none'}

Generate the complete crisis session plan JSON.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
