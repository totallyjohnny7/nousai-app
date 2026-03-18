/**
 * AI-powered exam content predictor.
 *
 * Analyzes syllabus weekly topics up to the exam date and predicts
 * the most likely topics to appear on the exam.
 */

import { callAI } from './ai';
import { safeParseAIJSON, aiCallWithGuards } from './ai';
import type { CourseCalendarEvent, SyllabusParseResult } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PredictedTopic {
  topic: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string; // max 1 sentence, references syllabus content
}

export interface PredictionResult {
  predictedTopics: PredictedTopic[];
  examDate: string;
  examTitle: string;
}

// ── Predictor ─────────────────────────────────────────────────────────────────

/**
 * Predict exam content from syllabus weekly topics.
 * Returns null if no exam date set or no syllabus topics available.
 * Throws Error('OFFLINE') or Error('TIMEOUT') on guard failures.
 */
export async function predictExamTopics(
  calendarEvents: CourseCalendarEvent[],
  syllabus: SyllabusParseResult | null,
  courseName: string
): Promise<PredictionResult | null> {
  // Find next upcoming exam
  const n = new Date();
  const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  const examEvents = calendarEvents
    .filter(e => e.type === 'exam' && e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (examEvents.length === 0) return null;

  const nextExam = examEvents[0];

  // Determine which weekly topics come before exam
  const weeklyTopics = syllabus?.weeklyTopics ?? [];
  if (weeklyTopics.length === 0) return null;

  // Use all topics (we can't always know which "week" the exam falls in without dates)
  const allTopics = weeklyTopics.flatMap(w => w.topics).filter(Boolean);
  if (allTopics.length === 0) return null;

  const prompt = `You are an academic exam predictor. Return ONLY valid JSON. No markdown fences.

A student has an exam on ${nextExam.date} for ${courseName}.
Their syllabus covers these topics:
${allTopics.join(', ')}

Predict the 5-8 most likely tested topics and return:
{
  "predictedTopics": [{
    "topic": string,
    "confidence": "high|medium|low",
    "reason": string
  }]
}

Rules:
- Base predictions ONLY on the syllabus topics provided — do NOT invent course content
- Higher confidence for: later topics (recency), topics appearing multiple times, foundational concepts
- reason must reference specific syllabus content, max 1 sentence`;

  const raw = await aiCallWithGuards(
    () => callAI([
      { role: 'system', content: 'You are an academic exam predictor. Return ONLY valid JSON. No markdown fences.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 600 }),
    30_000
  );

  interface RawResult { predictedTopics?: PredictedTopic[] }
  const fallback: RawResult = { predictedTopics: [] };
  const { data, parseError } = safeParseAIJSON<RawResult>(raw, fallback);

  if (parseError) {
    console.error('[examPredictor] AI JSON parse error:', parseError);
  }

  if (!Array.isArray(data?.predictedTopics) || data.predictedTopics.length === 0) {
    return null;
  }

  return {
    predictedTopics: data.predictedTopics,
    examDate: nextExam.date,
    examTitle: nextExam.title,
  };
}
