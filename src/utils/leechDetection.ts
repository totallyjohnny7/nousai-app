/**
 * Leech Detection — NousAI
 *
 * Leeches: cards failed 4+ times OR avg recall < 50%.
 * Detecting and suspending leeches is one of the highest-ROI
 * optimizations for spaced repetition efficiency.
 */

import type { LeechAnalysis, LeechSuggestedAction, FlashcardItem } from '../types';
import { callAI } from './ai';

interface SRCardLike {
  key: string;
  lapses: number;
  state?: string;
  history?: { grade: number }[];
}

/** Compute severity score 0-100. Higher = worse leech. */
function computeSeverity(lapses: number, avgR: number): number {
  const lapseFactor = Math.min(lapses * 20, 60);
  const recallFactor = (1 - avgR) * 80;
  return Math.round(Math.min(lapseFactor + recallFactor, 100));
}

function computeAvgRetrieval(card: SRCardLike): number {
  const history = card.history ?? [];
  if (history.length === 0) return 1.0;
  const recent = history.slice(-8);
  const avg = recent.reduce((sum, h) => sum + (h.grade >= 3 ? 1 : 0), 0) / recent.length;
  return avg;
}

function suggestAction(lapses: number, avgR: number): LeechSuggestedAction {
  if (lapses >= 6) return 'split';
  if (avgR < 0.3) return 'rewrite';
  if (lapses >= 4) return 'suspend';
  return 'add-context';
}

export function detectLeeches(cards: SRCardLike[]): LeechAnalysis[] {
  const leeches: LeechAnalysis[] = [];

  for (const card of cards) {
    if (card.state === 'suspended') continue; // already handled
    const avgR = computeAvgRetrieval(card);
    const isLeech = card.lapses >= 4 || avgR < 0.5;
    if (!isLeech) continue;

    leeches.push({
      cardKey: card.key,
      lapseCount: card.lapses,
      avgRetrieval: avgR,
      severity: computeSeverity(card.lapses, avgR),
      suggestedAction: suggestAction(card.lapses, avgR),
    });
  }

  return leeches.sort((a, b) => b.severity - a.severity);
}

export async function getAIRewriteSuggestion(card: FlashcardItem): Promise<string> {
  const result = await callAI([{
    role: 'user',
    content: `This flashcard has been failed 4+ times. Suggest how to improve it.

Front: "${card.front}"
Back: "${card.back}"

Respond with ONLY a JSON object:
{
  "action": "rewrite" | "split",
  "card1": { "front": "...", "back": "..." },
  "card2": { "front": "...", "back": "..." },
  "reason": "one sentence explanation"
}

If action is "rewrite", only provide card1. If "split", provide both.`,
  }], { temperature: 0.4, maxTokens: 400 });

  // Parse and return as formatted string for display
  try {
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (parsed.action === 'split') {
      return `Split into 2 cards:\n1. Q: ${parsed.card1?.front} → A: ${parsed.card1?.back}\n2. Q: ${parsed.card2?.front} → A: ${parsed.card2?.back}\nReason: ${parsed.reason}`;
    }
    return `Rewrite: Q: ${parsed.card1?.front} → A: ${parsed.card1?.back}\nReason: ${parsed.reason}`;
  } catch {
    return result.trim();
  }
}

export function suspendCard(cardKey: string, cards: SRCardLike[]): SRCardLike[] {
  return cards.map((c) =>
    c.key === cardKey ? { ...c, state: 'suspended' } : c
  );
}
