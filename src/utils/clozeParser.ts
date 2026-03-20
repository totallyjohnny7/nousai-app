/**
 * Cloze Card Parser — NousAI
 *
 * Parses {{double brace}} cloze deletion syntax into parts.
 * "The {{mitochondria}} is the {{powerhouse}}" →
 * [{ text: 'The ', isCloze: false, id: -1 }, { text: 'mitochondria', isCloze: true, id: 0 }, ...]
 */

import type { ClozePart } from '../types';
import { callAI } from './ai';

const CLOZE_REGEX = /\{\{([^}]+)\}\}/g;

export function parseCloze(text: string): ClozePart[] {
  const parts: ClozePart[] = [];
  let lastIndex = 0;
  let clozeId = 0;

  for (const match of text.matchAll(CLOZE_REGEX)) {
    const matchStart = match.index!;
    if (matchStart > lastIndex) {
      parts.push({ text: text.slice(lastIndex, matchStart), isCloze: false, id: -1 });
    }
    parts.push({ text: match[1], isCloze: true, id: clozeId++ });
    lastIndex = matchStart + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isCloze: false, id: -1 });
  }

  // If no cloze markers found, return the whole text as one non-cloze part
  if (parts.length === 0) {
    parts.push({ text, isCloze: false, id: -1 });
  }

  return parts;
}

export function renderClozePreview(parts: ClozePart[], revealedIds: Set<number>): string {
  return parts
    .map((p) => (p.isCloze ? (revealedIds.has(p.id) ? p.text : '[_____]') : p.text))
    .join('');
}

export function countClozes(text: string): number {
  return [...text.matchAll(CLOZE_REGEX)].length;
}

export function isClozeText(text: string): boolean {
  return CLOZE_REGEX.test(text);
}

export async function generateClozeFromText(text: string): Promise<string[]> {
  const result = await callAI([{
    role: 'user',
    content: `Convert this text into 3-5 fill-in-the-blank cloze sentences using {{double braces}} for key terms.
Rules:
- One key term per pair of braces
- Keep each sentence self-contained
- Focus on the most important facts, names, and definitions
- Return ONLY a JSON array of strings, no explanation

Text:
${text}`,
  }], { temperature: 0.3, maxTokens: 400 });

  try {
    const cleaned = result.trim().replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed.filter((s) => typeof s === 'string');
  } catch { /* fall through to regex */ }

  // Regex fallback — extract quoted strings from partial JSON
  const matches = [...result.matchAll(/"([^"]+\{\{[^"]+)"/g)];
  return matches.map((m) => m[1]).filter(Boolean);
}
