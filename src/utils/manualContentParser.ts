/**
 * manualContentParser.ts — Parses user-pasted study content into structured types.
 *
 * Supports multiple paste formats:
 *  Cards:  Q:/A: pairs, pipe-separated, numbered, JSON arrays
 *  Quiz:   Numbered MC with A-D options, optional answer line, JSON
 *  Exam:   Numbered questions (auto-detects MC vs FRQ), JSON
 *
 * All parsers are fault-tolerant — never throw, return [] on failure.
 */
import type { ManualCard, ManualMCQuestion, ManualExamQuestion } from '../types';

// ── Card Parser ──────────────────────────────────────────────────────────────

export function parseManualCards(raw: string): ManualCard[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: any) => (item.front && item.back) || (item.question && item.answer))
        .map((item: any) => ({
          front: (item.front || item.question || '').trim(),
          back: (item.back || item.answer || '').trim(),
          source: 'manual' as const,
          rawInput: JSON.stringify(item),
        }));
    }
  } catch { /* not JSON, continue */ }

  // Format B: pipe-separated (term | definition)
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.some(l => l.includes('|') && l.split('|').length === 2)) {
    return lines
      .filter(l => l.includes('|'))
      .map(l => {
        const [front, back] = l.split('|').map(s => s.trim());
        if (!front || !back) return null;
        const card: ManualCard = { front, back, source: 'manual', rawInput: l };
        return card;
      })
      .filter((c): c is ManualCard => c !== null);
  }

  // Format A/C: Q:/A: pairs (with optional numbered prefix)
  const cards: ManualCard[] = [];
  let currentQ = '';
  let currentRaw = '';

  for (const line of lines) {
    const cleaned = line.replace(/^\d+\.\s*/, ''); // strip leading number
    if (/^Q:\s*/i.test(cleaned)) {
      if (currentQ) {
        console.warn('[PARSER] Card missing answer for:', currentQ);
      }
      currentQ = cleaned.replace(/^Q:\s*/i, '').trim();
      currentRaw = line;
    } else if (/^A:\s*/i.test(cleaned) && currentQ) {
      const back = cleaned.replace(/^A:\s*/i, '').trim();
      cards.push({ front: currentQ, back, source: 'manual', rawInput: currentRaw + '\n' + line });
      currentQ = '';
      currentRaw = '';
    }
  }

  if (cards.length > 0) return cards;

  // Fallback: treat double-newline separated blocks as front/back pairs
  const blocks = trimmed.split(/\n\s*\n/).filter(Boolean);
  for (const block of blocks) {
    const blockLines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (blockLines.length >= 2) {
      cards.push({
        front: blockLines[0],
        back: blockLines.slice(1).join(' '),
        source: 'manual',
        rawInput: block,
      });
    }
  }

  return cards;
}

// ── Quiz MC Question Parser ──────────────────────────────────────────────────

export function parseManualQuizQuestions(raw: string): ManualMCQuestion[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: any) => item.question || item.q)
        .map((item: any) => ({
          question: (item.question || item.q || '').trim(),
          options: Array.isArray(item.options) ? item.options.map((o: string) => o.trim()) : [],
          correct: typeof item.correct === 'number' ? item.correct : -1,
          source: 'manual' as const,
          rawInput: JSON.stringify(item),
        }));
    }
  } catch { /* not JSON, continue */ }

  // Text format: numbered questions with A-D options
  const questions: ManualMCQuestion[] = [];
  const blocks = splitIntoQuestionBlocks(trimmed);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // First line is the question (strip leading number)
    const question = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();

    // Extract options (A-D)
    const options: string[] = [];
    let correctIdx = -1;
    const answerLine = lines.find(l => /^Answer:\s*/i.test(l));

    for (const line of lines.slice(1)) {
      const optMatch = line.match(/^([A-Da-d])[\.\)]\s*(.+)/);
      if (optMatch) {
        options.push(optMatch[2].trim());
      }
    }

    // Extract answer
    if (answerLine) {
      const ans = answerLine.replace(/^Answer:\s*/i, '').trim().toUpperCase();
      const idx = 'ABCD'.indexOf(ans.charAt(0));
      if (idx >= 0) correctIdx = idx;
    }

    if (question && options.length >= 2) {
      questions.push({ question, options, correct: correctIdx, source: 'manual', rawInput: block });
    }
  }

  return questions;
}

// ── Exam Question Parser ─────────────────────────────────────────────────────

export function parseManualExamQuestions(raw: string): ManualExamQuestion[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // Try JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item: any) => item.question || item.q)
        .map((item: any) => ({
          question: (item.question || item.q || '').trim(),
          type: (item.type || (Array.isArray(item.options) ? 'mc' : 'frq')) as 'mc' | 'frq' | 'unknown',
          options: Array.isArray(item.options) ? item.options : undefined,
          answer: item.answer ? String(item.answer).trim() : undefined,
          source: 'manual' as const,
          rawInput: JSON.stringify(item),
        }));
    }
  } catch { /* not JSON, continue */ }

  // Text format: numbered questions — auto-detect MC vs FRQ
  const questions: ManualExamQuestion[] = [];
  const blocks = splitIntoQuestionBlocks(trimmed);

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 1) continue;

    const question = lines[0].replace(/^\d+[\.\)]\s*/, '').trim();
    const optionLines = lines.slice(1).filter(l => /^[A-Da-d][\.\)]\s*.+/.test(l));
    const answerLine = lines.find(l => /^Answer:\s*/i.test(l));

    if (optionLines.length >= 2) {
      // MC question
      const options = optionLines.map(l => l.replace(/^[A-Da-d][\.\)]\s*/, '').trim());
      const answer = answerLine ? answerLine.replace(/^Answer:\s*/i, '').trim() : undefined;
      questions.push({ question, type: 'mc', options, answer, source: 'manual', rawInput: block });
    } else {
      // FRQ
      const answer = answerLine ? answerLine.replace(/^Answer:\s*/i, '').trim() : undefined;
      questions.push({ question, type: 'frq', answer, source: 'manual', rawInput: block });
    }
  }

  return questions;
}

// ── Format Detector ──────────────────────────────────────────────────────────

export function detectFormatType(raw: string): 'cards' | 'quiz' | 'exam' | 'unknown' {
  const trimmed = raw.trim();
  if (!trimmed) return 'unknown';

  // Try JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (first.front || (first.question && first.answer && !first.options)) return 'cards';
      if (first.options) return 'quiz';
      return 'exam';
    }
  } catch { /* not JSON */ }

  // Heuristic: presence of Q:/A: or | → cards
  if (/^Q:\s/im.test(trimmed) || (trimmed.includes('|') && !trimmed.includes('A)'))) return 'cards';
  // Presence of A) B) C) → quiz or exam MC
  if (/^[A-D][\.\)]/m.test(trimmed)) return 'quiz';
  // Numbered paragraphs without options → exam FRQ
  if (/^\d+[.)]\s/m.test(trimmed)) return 'exam';

  return 'unknown';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Split raw text into question blocks by numbered prefix (1. 2. 3. etc.) */
function splitIntoQuestionBlocks(text: string): string[] {
  // Split on lines that start with a number followed by . or )
  const blocks: string[] = [];
  let current = '';

  for (const line of text.split('\n')) {
    if (/^\d+[\.\)]\s/.test(line.trim()) && current.trim()) {
      blocks.push(current.trim());
      current = line + '\n';
    } else {
      current += line + '\n';
    }
  }
  if (current.trim()) blocks.push(current.trim());

  return blocks;
}
