/**
 * Omni Protocol V6 — Pure helpers and Claude prompt builders.
 * No React, no store access. All functions are pure TypeScript.
 */

import type { Course, SRData, OmniArcPhase, OmniDifficulty, OmniProtocolData, OmniFeynmanGap, OmniSessionPlan } from '../types';
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
}): AIMessage[] {
  const { durationConfig: dc } = params;
  const fGaps = params.feynmanGaps.map(g => g.concept);
  const dueKeys = params.fsrsDueCards.map(c => c.key).slice(0, 20);
  const profEmphasis = params.professorEmphasis.trim()
    ? params.professorEmphasis.trim()
    : 'Use MCAT/AP high-frequency topic weighting for this subject';

  const system = `You are an expert learning engineer building a personalized Omni Protocol v6 study session.

RULES (non-negotiable):
1. Return ONLY valid JSON. No markdown fences. No preamble. No text after the JSON.
2. Bloom's escalation is mandatory: Cycle 1 = Remember/Understand, Cycle 2 = Apply/Analyze, Cycle 3 = Evaluate/Create
3. Every Encode phase: mnemonic + analogy BEFORE formal definition. Order: Abstract → Concrete → Formal.
4. Every Cycle must cover DIFFERENT subtopics — zero repeated content across cycles.
5. Domain rules: Biology=pathway diagrams, Chemistry=draw the molecule, Physics=unit analysis, Anatomy=function grouping.
6. WHY chains required in Cycle 1 (e.g., "Na/K pump moves 3 Na out → WHY? → membrane potential → WHY? → neuron fires").
7. Cycle 3 must include "what breaks if this mechanism fails?" and professor-angle questions.
8. Passive review (rereading, highlighting) is FORBIDDEN anywhere in any phase.
9. Every phase must specify visualAnchor, auditoryHook, and kinesthetic — text-only phases are invalid.

PHASE SEQUENCE PER CYCLE (8 phases):
Prime(5min) → Chunk(5min) → Encode(15min) → Connect(10min) → Break(5min) → Test(10min) → Anchor(5min) → Report(5min)
${dc.extended ? 'Extended session: add 5min to Encode and 5min to Test in the last cycle.' : ''}

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

  const user = `Build a ${dc.durationMin}-minute, ${dc.cycleCount}-cycle Omni Protocol v6 session:

TOPIC: "${params.topic}"
COURSE: "${params.courseName}"
DIFFICULTY: ${params.difficulty}
ARC PHASE: ${params.arcPhase}
PROFESSOR EMPHASIS: ${profEmphasis}

INTAKE ANSWERS:
${params.intakeAnswers || 'No intake data — assume baseline knowledge gaps.'}

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
