/**
 * AI-powered 7-day study plan generator.
 *
 * Uses safeParseAIJSON + aiCallWithGuards for all AI calls.
 * Returns a structured day-by-day plan aligned with FSRS weak cards
 * and nearest exam dates.
 */

import { callAI } from './ai';
import { safeParseAIJSON, aiCallWithGuards } from './ai';
import type { CourseCalendarEvent } from '../types';
import { getNextExamDays } from './fsrsStorage';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AIPlanBlock {
  courseId: string;
  courseName: string;
  topic: string;
  durationMin: number;
  type: 'review' | 'learn' | 'practice' | 'exam-prep';
  cardCount: number;
}

export interface AIPlanDay {
  date: string; // YYYY-MM-DD
  blocks: AIPlanBlock[];
}

export interface AIPlanResult {
  days: AIPlanDay[];
}

export interface StudyPlanInput {
  courseId: string;
  courseName: string;
  examDate: string | null;    // null = no exam date set
  weakCardCount: number;      // # of FSRS cards with R < 0.75
  weakTopics: string[];       // top subtopics with low retention
  calendarEvents: CourseCalendarEvent[];
}

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate a 7-day FSRS-aware study plan.
 * Throws Error('OFFLINE') or Error('TIMEOUT') on guard failures.
 */
export async function generateFSRSAwarePlan(
  inputs: StudyPlanInput[],
  hoursPerDay: number
): Promise<AIPlanResult> {
  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  })();

  const coursesWithExam = inputs.filter(c => c.examDate !== null);
  const coursesNoExam = inputs.filter(c => c.examDate === null);

  const examLines = coursesWithExam.map(c => {
    const days = getNextExamDays(c.calendarEvents);
    return `- ${c.courseName}: exam ${c.examDate}, ${c.weakCardCount} weak FSRS cards${days !== null ? `, ${days} days away` : ''}`;
  }).join('\n');

  const noExamLines = coursesNoExam.length > 0
    ? `Courses without exam dates (include maintenance review only):\n${coursesNoExam.map(c => `- ${c.courseName}`).join('\n')}`
    : '';

  const weakTopicsLine = inputs
    .flatMap(c => c.weakTopics.slice(0, 3).map(t => `${c.courseName}: ${t}`))
    .slice(0, 5)
    .join(', ');

  const prompt = `You are a study planner. Return ONLY valid JSON with YYYY-MM-DD date strings.

Create a 7-day study plan starting ${today}.

Courses with exam dates:
${examLines || '(none)'}

${noExamLines}

Available study time: ${hoursPerDay} hours/day max
Most urgent weak topics: ${weakTopicsLine || '(none)'}

Return:
{
  "days": [{
    "date": "YYYY-MM-DD",
    "blocks": [{
      "courseId": string,
      "courseName": string,
      "topic": string,
      "durationMin": number,
      "type": "review|learn|practice|exam-prep",
      "cardCount": number
    }]
  }]
}

Rules:
- Total durationMin per day must not exceed ${hoursPerDay * 60}
- Prioritize courses with nearest exam dates
- Courses with no exam date get at most 15 min maintenance review per day
- cardCount = number of FSRS cards to review in that block`;

  const raw = await aiCallWithGuards(
    () => callAI([
      { role: 'system', content: 'You are a study planner. Return ONLY valid JSON. No markdown fences.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 2000 }),
    30_000
  );

  const fallback: AIPlanResult = { days: [] };
  const { data, parseError } = safeParseAIJSON<AIPlanResult>(raw, fallback);

  if (parseError) {
    console.error('[studyPlan] AI JSON parse error:', parseError);
  }

  // Validate structure — ensure days array exists
  if (!Array.isArray(data?.days)) return fallback;

  return data;
}
