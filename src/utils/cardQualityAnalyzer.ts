/**
 * Card Quality Analyzer — NousAI
 *
 * AI-powered batch scoring of flashcard quality.
 * Good cards: atomic, single-concept, clear question, specific answer.
 * Uses Gemini Flash for cost-efficient batch scoring.
 */

import type { CardQualityScore, CardIssueType, FlashcardItem } from '../types';
import { callAI } from './ai';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 200;

interface CardInput {
  key: string;
  front: string;
  back: string;
}

async function scoreBatch(cards: CardInput[]): Promise<CardQualityScore[]> {
  const result = await callAI([{
    role: 'user',
    content: `Rate each flashcard 0-100 for atomic clarity (100 = perfect single-concept card).
Flag any issues from: too-long, ambiguous, no-context, multi-part, vague-answer, unclear-question.
Return ONLY a JSON array, no markdown:

[{ "cardKey": "...", "score": 0-100, "issues": ["issue1"], "suggestion": "one-sentence tip" }]

Cards:
${JSON.stringify(cards.map(c => ({ cardKey: c.key, front: c.front, back: c.back })))}`,
  }], { temperature: 0.2, maxTokens: 1200 });

  try {
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed: { cardKey: string; score: number; issues: CardIssueType[]; suggestion: string }[] = JSON.parse(cleaned);
    return parsed.map((p) => ({
      cardKey: p.cardKey,
      score: Math.max(0, Math.min(100, p.score ?? 50)),
      issues: Array.isArray(p.issues) ? p.issues : [],
      suggestion: p.suggestion ?? '',
    }));
  } catch {
    // If parse fails, return neutral scores so the UI doesn't crash
    return cards.map((c) => ({
      cardKey: c.key,
      score: 50,
      issues: [],
      suggestion: 'Could not analyze — try again',
    }));
  }
}

export async function scoreCardBatch(
  cards: FlashcardItem[],
  courseId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<CardQualityScore[]> {
  const inputs: CardInput[] = cards.map((c, i) => ({
    key: `${courseId}::${i}`,
    front: c.front,
    back: c.back,
  }));

  const results: CardQualityScore[] = [];
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const scores = await scoreBatch(batch);
    results.push(...scores);
    onProgress?.(Math.min(i + BATCH_SIZE, inputs.length), inputs.length);
    if (i + BATCH_SIZE < inputs.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return results;
}

export async function improveCard(card: FlashcardItem, courseId?: string): Promise<{ front: string; back: string }> {
  const result = await callAI([{
    role: 'user',
    content: `Improve this flashcard to be more atomic, clear, and memorable.
${courseId ? `Subject: ${courseId}` : ''}
Front: "${card.front}"
Back: "${card.back}"

Return ONLY JSON: { "front": "improved front", "back": "improved back" }`,
  }], { temperature: 0.4, maxTokens: 200 });

  try {
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    return { front: parsed.front ?? card.front, back: parsed.back ?? card.back };
  } catch {
    return { front: card.front, back: card.back };
  }
}
