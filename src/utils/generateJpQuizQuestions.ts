/**
 * Generates JpQuizQuestions from VocabBankItems — converts passive vocabulary
 * exposure into active retrieval practice.
 *
 * Science: Active Recall (Karpicke & Roediger 2008) increases retention 150%
 * over re-reading. Forward/reverse card types test receptive vs productive
 * vocabulary knowledge (Laufer & Goldstein 2004).
 */
import type { VocabBankItem } from '../components/jpquiz/types';
import type { JpQuizQuestion } from '../components/jpquiz/types';

type VocabCategory = VocabBankItem['category'];

const CATEGORY_DIFFICULTY: Record<string, 1 | 2 | 3 | 4 | 5> = {
  greeting: 1,
  phrase: 1,
  noun: 2,
  pronoun: 2,
  adjective: 3,
  'i-adjective': 3,
  'na-adjective': 3,
  verb: 3,
  adverb: 3,
  particle: 4,
  counter: 4,
  conjunction: 4,
  expression: 2,
  suffix: 4,
  prefix: 4,
  grammar: 5,
  pattern: 5,
};

function difficulty(cat: VocabCategory): 1 | 2 | 3 | 4 | 5 {
  return CATEGORY_DIFFICULTY[cat] ?? 2;
}

function makeId(): string {
  return `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateQuestionsFromVocab(
  items: VocabBankItem[],
  existingQuestions: JpQuizQuestion[] = [],
): JpQuizQuestion[] {
  const existingSet = new Set(
    existingQuestions.map(q => `${q.questionText}||${q.expectedAnswer}`)
  );
  const questions: JpQuizQuestion[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    if (!item.word || !item.meaning) continue;

    // Forward: English → Japanese (productive knowledge)
    const forwardKey = `What is "${item.meaning}" in Japanese?||${item.word}`;
    if (!existingSet.has(forwardKey)) {
      existingSet.add(forwardKey);
      const acceptable = [item.word];
      if (item.reading && item.reading !== item.word) acceptable.push(item.reading);
      questions.push({
        id: makeId(),
        questionText: `What is "${item.meaning}" in Japanese?`,
        expectedAnswer: item.word,
        acceptableAnswers: acceptable,
        answerType: 'typed',
        hint: item.reading ? `Reading: ${item.reading}` : undefined,
        explanation: item.notes || undefined,
        difficulty: difficulty(item.category),
        tags: [item.category, 'auto-generated', 'forward'],
        createdAt: now,
      });
    }

    // Reverse: Japanese → English (receptive knowledge)
    const reverseKey = `What does "${item.word}" mean?||${item.meaning}`;
    if (!existingSet.has(reverseKey)) {
      existingSet.add(reverseKey);
      questions.push({
        id: makeId(),
        questionText: `What does "${item.word}" mean?${item.reading ? ` (${item.reading})` : ''}`,
        expectedAnswer: item.meaning,
        answerType: 'typed',
        hint: item.category !== 'other' ? `Category: ${item.category}` : undefined,
        explanation: item.example ? `Example: ${item.example}${item.exampleEn ? ` — ${item.exampleEn}` : ''}` : undefined,
        difficulty: difficulty(item.category),
        tags: [item.category, 'auto-generated', 'reverse'],
        createdAt: now,
      });
    }
  }

  return questions;
}
