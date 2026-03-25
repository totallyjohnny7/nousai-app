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

export const TRANSPARENCY_LEVELS: { id: TransparencyLevel; label: string; desc: string }[] = [
  { id: 'minimal', label: 'Minimal', desc: 'Just the content, no extras' },
  { id: 'standard', label: 'Standard', desc: 'Difficulty tags + brief explanations' },
  { id: 'full', label: 'Full', desc: 'Difficulty, why tested, misconceptions, source reasoning' },
  { id: 'research', label: 'Research', desc: 'Full + community insights, confidence ratings, gap analysis' },
];

export function getTransparencyPrompt(level: TransparencyLevel): string {
  switch (level) {
    case 'minimal':
      return '';
    case 'standard':
      return `\nFor each item, include a "difficulty" field ("easy", "medium", or "hard").`;
    case 'full':
      return `
TRANSPARENCY (Full):
- Add "difficulty": "easy" | "medium" | "hard" to each item
- Add "why_tested": one sentence explaining exam/real-world relevance
- Include at least 1 item targeting a common misconception
- For language content: include original language text (hiragana, kanji, etc.)
- Never skip terms — cover ALL concepts from the source material`;
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
- Flag any areas where sources might conflict or where the student should verify independently`;
  }
}
