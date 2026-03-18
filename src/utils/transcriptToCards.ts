/**
 * AI-powered lecture transcript → flashcard generator.
 *
 * Takes a lecture transcript and generates 8-15 FlashcardItem objects
 * using safeParseAIJSON + aiCallWithGuards.
 */

import { callAI } from './ai';
import { safeParseAIJSON, aiCallWithGuards } from './ai';
import type { FlashcardItem } from '../types';

const MAX_TRANSCRIPT_CHARS = 8_000;

// ── Generator ─────────────────────────────────────────────────────────────────

/**
 * Generate flashcards from a lecture transcript.
 * Returns an empty array on parse failure (graceful degradation).
 * Throws Error('OFFLINE') or Error('TIMEOUT') on guard failures.
 */
export async function generateCardsFromTranscript(
  transcript: string,
  courseName: string
): Promise<FlashcardItem[]> {
  const capped = transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  const prompt = `You are a flashcard creator. Return ONLY valid JSON. No markdown fences.

Create flashcards from this lecture transcript for ${courseName}.

Return:
{
  "flashcards": [{
    "front": string,
    "back": string,
    "topic": string
  }]
}

Rules:
- Create 8-15 cards from the most important concepts
- Cards should test understanding, not just recall
- front should be a question or fill-in-the-blank, not just a term (max 120 chars)
- back should be the answer or definition (max 300 chars)
- topic = the lecture topic this card belongs to
- Exclude minor details, dates, and tangential remarks

Transcript:
${capped}`;

  const raw = await aiCallWithGuards(
    () => callAI([
      { role: 'system', content: 'You are a flashcard creator. Return ONLY valid JSON. No markdown fences.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 1500 }),
    30_000
  );

  interface RawResult { flashcards?: FlashcardItem[] }
  const fallback: RawResult = { flashcards: [] };
  const { data, parseError } = safeParseAIJSON<RawResult>(raw, fallback);

  if (parseError) {
    console.error('[transcriptToCards] AI JSON parse error:', parseError);
  }

  if (!Array.isArray(data?.flashcards)) return [];

  // Sanitize: ensure front/back are non-empty strings
  return data.flashcards.filter(
    (c): c is FlashcardItem =>
      typeof c.front === 'string' && c.front.trim().length > 0 &&
      typeof c.back === 'string' && c.back.trim().length > 0
  );
}
