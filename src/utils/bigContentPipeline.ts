/**
 * Big Content → Atomic Cards Pipeline — NousAI
 *
 * Converts large text (paste, notes, OCR output) into reviewed atomic flashcards.
 * Processes in chunks (default 500 words) to stay within model context limits.
 * Uses AbortSignal for cancellation.
 */

import type { PipelineConfig, PipelineResult, CardQualityScore, FlashcardItem } from '../types';
import { callAI } from './ai';

const DEFAULT_CONFIG: Required<PipelineConfig> = {
  chunkWords: 500,
  cardType: 'standard',
  focusMode: 'all',
  maxCardsPerChunk: 5,
  targetCourse: '',
};

function splitIntoChunks(text: string, wordsPerChunk: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  let wordCount = 0;

  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).length;
    if (wordCount + words > wordsPerChunk && current) {
      chunks.push(current.trim());
      current = sentence;
      wordCount = words;
    } else {
      current += ' ' + sentence;
      wordCount += words;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((c) => c.length > 20);
}

async function generateCardsFromChunk(
  chunk: string,
  config: Required<PipelineConfig>,
): Promise<Partial<FlashcardItem>[]> {
  const cardTypeInstruction =
    config.cardType === 'cloze'
      ? 'Use {{double braces}} around key terms for cloze deletion format.'
      : config.cardType === 'mixed'
      ? 'Alternate between standard Q&A and cloze ({{double braces}}) formats.'
      : 'Use standard Q&A format.';

  const result = await callAI([{
    role: 'user',
    content: `Generate ${config.maxCardsPerChunk} atomic flashcards from this text.
${cardTypeInstruction}
Focus on: ${config.focusMode} (facts=specific facts, concepts=underlying principles, vocabulary=term definitions, all=everything important)
Extract ALL terms, definitions, and key concepts from the source material — never skip content. Every distinct concept should get its own card.

Return ONLY a JSON array, no markdown:
[{"front": "...", "back": "...", "type": "standard"|"cloze"}]

Text:
${chunk}`,
  }], { temperature: 0.4, maxTokens: 800 });

  try {
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.map((c: { front?: string; back?: string; type?: string }) => ({
        front: c.front ?? '',
        back: c.back ?? '',
        type: (c.type === 'cloze' ? 'cloze' : 'standard') as FlashcardItem['type'],
        topic: config.targetCourse,
      })).filter((c) => c.front && c.back);
    }
  } catch { /* fall through */ }

  // Regex fallback for partial JSON
  const matches = [...result.matchAll(/"front"\s*:\s*"([^"]+)"[^}]*"back"\s*:\s*"([^"]+)"/g)];
  return matches.map((m) => ({
    front: m[1],
    back: m[2],
    type: 'standard' as FlashcardItem['type'],
    topic: config.targetCourse,
  }));
}

export async function runBigContentPipeline(
  content: string,
  config: Partial<PipelineConfig>,
  onProgress: (chunk: number, total: number, cardsGenerated: number) => void,
  signal: AbortSignal,
): Promise<PipelineResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  const chunks = splitIntoChunks(content, cfg.chunkWords);
  const allCards: Partial<FlashcardItem>[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (signal.aborted) break;

    let cards: Partial<FlashcardItem>[] = [];
    let retries = 0;
    while (retries < 4) {
      try {
        cards = await generateCardsFromChunk(chunks[i], cfg);
        break;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('429') && retries < 3) {
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, retries)));
          retries++;
        } else {
          break;
        }
      }
    }

    allCards.push(...cards);
    onProgress(i + 1, chunks.length, allCards.length);
  }

  // Build placeholder quality scores (full scoring is on-demand in UI)
  const qualityScores: CardQualityScore[] = allCards.map((c, i) => ({
    cardKey: `pipeline-${i}`,
    score: 70, // placeholder
    issues: [],
    suggestion: '',
  }));

  return {
    cards: allCards,
    qualityScores,
    chunks: chunks.length,
    totalCards: allCards.length,
    processingMs: Date.now() - startTime,
  };
}
