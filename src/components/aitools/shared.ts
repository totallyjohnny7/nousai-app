import type React from 'react';

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export const inputStyle: React.CSSProperties = {
  width: '100%', padding: 12, border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
  outline: 'none',
};

export const selectStyle: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
};

/* ── AI Transparency Levels ── */
export type TransparencyLevel = 'minimal' | 'standard' | 'full' | 'research';

export const TRANSPARENCY_LEVELS: { id: TransparencyLevel; label: string; desc: string; maxTokens: number }[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Just the content, no extras', maxTokens: 2048 },
  { id: 'standard', label: 'Standard', desc: 'Difficulty tags + brief explanations', maxTokens: 3000 },
  { id: 'full', label: 'Full', desc: 'Difficulty, why tested, misconceptions, source reasoning', maxTokens: 4096 },
  { id: 'research', label: 'Research', desc: 'Full + confidence, source notes, gap analysis', maxTokens: 6000 },
];

/** Get the recommended maxTokens for a transparency level */
export function getTransparencyTokenLimit(level: TransparencyLevel): number {
  return TRANSPARENCY_LEVELS.find(t => t.id === level)?.maxTokens ?? 2048;
}

/**
 * Extract key terms from source text for completeness verification.
 * Returns a list of unique terms (bold text, capitalized phrases, quoted terms, JP vocab).
 */
export function extractKeyTerms(text: string): string[] {
  const terms = new Set<string>();
  // Bold/strong patterns: **term**, __term__
  for (const m of text.matchAll(/\*\*([^*]+)\*\*|__([^_]+)__/g)) {
    terms.add((m[1] || m[2]).trim());
  }
  // Quoted terms: "term" or 'term'
  for (const m of text.matchAll(/["']([^"']{2,30})["']/g)) {
    terms.add(m[1].trim());
  }
  // Japanese vocab: kanji/katakana sequences 2+ chars
  for (const m of text.matchAll(/[\u4e00-\u9faf\u3400-\u4dbf\u30a0-\u30ff]{2,}/g)) {
    terms.add(m[0]);
  }
  // ALL CAPS terms (3+ chars, not common words)
  for (const m of text.matchAll(/\b[A-Z]{3,}\b/g)) {
    if (!['THE', 'AND', 'FOR', 'ARE', 'NOT', 'BUT', 'ALL', 'CAN', 'HAS', 'HER', 'WAS', 'ONE', 'OUR', 'OUT'].includes(m[0])) {
      terms.add(m[0]);
    }
  }
  return [...terms].slice(0, 50); // Cap at 50 to avoid prompt bloat
}

export function getTransparencyPrompt(level: TransparencyLevel, sourceText?: string): string {
  const keyTerms = sourceText ? extractKeyTerms(sourceText) : [];
  const termList = keyTerms.length > 0
    ? `\n\nREQUIRED KEY TERMS (you MUST include items covering these — do NOT skip any):\n${keyTerms.map(t => `• ${t}`).join('\n')}`
    : '';

  switch (level) {
    case 'minimal':
      return termList; // Still enforce key terms even at minimal
    case 'standard':
      return `\nFor each item, include a "difficulty" field ("easy", "medium", or "hard").${termList}`;
    case 'full':
      return `
TRANSPARENCY (Full):
- Add "difficulty": "easy" | "medium" | "hard" to each item
- Add "why_tested": one sentence explaining exam/real-world relevance
- Include at least 1 item targeting a common misconception
- For language content: include original language text (hiragana, kanji, etc.)
- Never skip terms — cover ALL concepts from the source material${termList}`;
    case 'research':
      return `
TRANSPARENCY (Research-Grade):
- Add "difficulty": "easy" | "medium" | "hard" to each item
- Add "why_tested": one sentence explaining exam/real-world relevance
- Add "confidence": "high" | "medium" | "low" — your confidence in the answer's accuracy
- Add "source_note": brief note on where this fact comes from (textbook standard, community consensus, etc.)
- Include items targeting common misconceptions with "is_trap": true
- For language content: include original language text (hiragana, kanji, etc.)
- Never skip terms — cover ALL concepts from the source material
- Flag any areas where sources might conflict or where the student should verify independently
- At the END, add a "coverage_report" field listing any source terms you could NOT cover and why${termList}`;
  }
}
