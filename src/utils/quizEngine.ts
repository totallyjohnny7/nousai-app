/**
 * Quiz Engine - Generation, Answer Checking, Adaptive Mode
 * Ported from NousAI Obsidian plugin
 */

import type { QuizAnswer } from '../types';

// ─── Types ──────────────────────────────────────────────

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank' | 'matching';

export interface QuizQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  answer: string;
  explanation?: string;
  difficulty?: number;   // 1-5
  subtopic?: string;
  source?: string;
  _retry?: boolean;      // For adaptive mode
  _retryCount?: number;
}

export interface QuizSession {
  id: string;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  mode: 'standard' | 'adaptive';
  subject?: string;
  subtopic?: string;
  startedAt: string;
  currentIndex: number;
  masteryCount?: Record<string, { correct: number; total: number; mastered: boolean }>;
  finished: boolean;
}

export interface QuizConfig {
  count: number;
  types: QuestionType[];
  difficulty?: number;
  focusArea?: string;
  adaptive?: boolean;
}

// ─── Unique ID Generator ────────────────────────────────

function gid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── Question Normalization ─────────────────────────────

/** Normalize a question from AI response to standard format */
export function normalizeQuestion(q: Record<string, unknown>): QuizQuestion {
  // Normalize answer field
  const answer = String(q.answer || q.correctAnswer || q.correct_answer || q.correct || '');

  // Normalize type
  let type = String(q.type || 'multiple_choice').toLowerCase().trim();
  const typeMap: Record<string, QuestionType> = {
    'mc': 'multiple_choice',
    'mcq': 'multiple_choice',
    'multiple-choice': 'multiple_choice',
    'multiplechoice': 'multiple_choice',
    'tf': 'true_false',
    'truefalse': 'true_false',
    'true-false': 'true_false',
    'sa': 'short_answer',
    'shortanswer': 'short_answer',
    'short-answer': 'short_answer',
    'fb': 'fill_blank',
    'fillblank': 'fill_blank',
    'fill-blank': 'fill_blank',
    'fill_in_the_blank': 'fill_blank',
    'match': 'matching',
  };
  type = typeMap[type] || type;

  // Get options
  let options = (q.options || q.choices || []) as string[];

  // Demote MC to short_answer if fewer than 2 options
  if (type === 'multiple_choice' && (!options || options.length < 2)) {
    type = 'short_answer';
    options = [];
  }

  // Shuffle MC options (Fisher-Yates)
  if (type === 'multiple_choice' && options.length >= 2) {
    options = [...options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
  }

  // Normalize true/false answers
  let normalizedAnswer = answer;
  if (type === 'true_false') {
    const lower = answer.toLowerCase().trim();
    normalizedAnswer = lower === 'true' || lower === 't' || lower === 'yes' ? 'True' : 'False';
  }

  return {
    id: gid(),
    question: String(q.question || ''),
    type: type as QuestionType,
    options: type === 'multiple_choice' ? options : undefined,
    answer: normalizedAnswer,
    explanation: q.explanation ? String(q.explanation) : undefined,
    difficulty: typeof q.difficulty === 'number' ? q.difficulty : undefined,
    subtopic: q.subtopic ? String(q.subtopic) : undefined,
    source: 'ai',
  };
}

// ─── Answer Checking ────────────────────────────────────

/** Normalize a string for comparison */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/** Extract key value parts from structured answers like "Noun: X, Adjective: Y" */
function extractParts(s: string): Map<string, string> {
  const parts = new Map<string, string>();
  // Match "Label: Value" patterns
  const regex = /(\w[\w\s]*?)\s*[:=]\s*([^,;]+)/gi;
  let m;
  while ((m = regex.exec(s)) !== null) {
    parts.set(normalize(m[1]), normalize(m[2]));
  }
  return parts;
}

/** Extract just the values/words from an answer (ignoring labels) */
function extractValues(s: string): string[] {
  return s
    .split(/[,;/\n]+/)
    .map(p => p.replace(/^[\w\s]*?[:=]\s*/, '').trim()) // strip "Label: " prefix
    .map(normalize)
    .filter(Boolean);
}

/** Similarity score 0-1 between two strings */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // Simple character overlap
  let matches = 0;
  const used = new Set<number>();
  for (const ch of shorter) {
    for (let i = 0; i < longer.length; i++) {
      if (!used.has(i) && longer[i] === ch) { matches++; used.add(i); break; }
    }
  }
  return matches / longer.length;
}

/** Check if a user's answer is correct */
export function checkAnswer(question: QuizQuestion, userAnswer: string): boolean {
  const correctRaw = question.answer;
  const userRaw = userAnswer.trim();

  if (!userRaw) return false;

  switch (question.type) {
    case 'true_false': {
      const u = userRaw.toLowerCase();
      const c = correctRaw.toLowerCase();
      const uBool = u === 'true' || u === 't' || u === 'yes';
      const cBool = c === 'true' || c === 't' || c === 'yes';
      return uBool === cBool;
    }

    case 'multiple_choice': {
      const letterMatch = userRaw.match(/^([a-d])$/i);
      if (letterMatch && question.options) {
        const idx = letterMatch[1].toLowerCase().charCodeAt(0) - 97;
        if (idx >= 0 && idx < question.options.length) {
          return normalize(question.options[idx]) === normalize(correctRaw);
        }
      }
      return normalize(userRaw) === normalize(correctRaw);
    }

    case 'short_answer':
    case 'fill_blank': {
      const nUser = normalize(userRaw);
      const nCorrect = normalize(correctRaw);

      // 1. Exact normalized match
      if (nUser === nCorrect) return true;

      // 2. Substring match (both directions)
      if (nCorrect.length > 3 && nUser.length > 3) {
        if (nCorrect.includes(nUser) || nUser.includes(nCorrect)) return true;
      }

      // 3. Structured answer matching ("Noun: X, Adj: Y, Form: Z")
      const correctParts = extractParts(correctRaw);
      if (correctParts.size >= 2) {
        const userParts = extractParts(userRaw);

        // 3a. If user also used labels, match by key-value
        if (userParts.size >= 2) {
          let matched = 0;
          for (const [key, val] of correctParts) {
            for (const [uKey, uVal] of userParts) {
              if ((key === uKey || similarity(key, uKey) > 0.7) &&
                  (val === uVal || similarity(val, uVal) > 0.8)) {
                matched++;
                break;
              }
            }
          }
          if (matched >= correctParts.size) return true;
        }

        // 3b. User gave values without labels (e.g. "toshokan, rippa, negative")
        const correctVals = [...correctParts.values()];
        const userVals = extractValues(userRaw);
        if (userVals.length >= correctVals.length) {
          let matched = 0;
          const usedIndices = new Set<number>();
          for (const cv of correctVals) {
            for (let i = 0; i < userVals.length; i++) {
              if (!usedIndices.has(i) && (userVals[i] === cv || similarity(userVals[i], cv) > 0.8)) {
                matched++;
                usedIndices.add(i);
                break;
              }
            }
          }
          if (matched >= correctVals.length) return true;
        }
      }

      // 4. All key words present (for multi-word answers)
      const correctWords = nCorrect.split(/\s+/).filter(w => w.length > 2);
      if (correctWords.length >= 2) {
        const userWords = nUser.split(/\s+/);
        const matchCount = correctWords.filter(cw =>
          userWords.some(uw => uw === cw || similarity(uw, cw) > 0.85)
        ).length;
        if (matchCount >= correctWords.length * 0.8) return true;
      }

      // 5. High overall similarity for short answers
      if (similarity(nUser, nCorrect) > 0.85) return true;

      return false;
    }

    default:
      return normalize(userRaw) === normalize(correctRaw);
  }
}

// ─── Quiz Session Management ────────────────────────────

/** Create a new quiz session */
export function createQuizSession(
  questions: QuizQuestion[],
  mode: 'standard' | 'adaptive' = 'standard',
  subject?: string,
  subtopic?: string,
): QuizSession {
  return {
    id: gid(),
    questions: [...questions],
    answers: [],
    mode,
    subject,
    subtopic,
    startedAt: new Date().toISOString(),
    currentIndex: 0,
    masteryCount: mode === 'adaptive' ? {} : undefined,
    finished: false,
  };
}

// ─── Adaptive Mode ──────────────────────────────────────

/** Get adaptive question cap based on original question count */
export function getAdaptiveCap(originalCount: number): number {
  if (originalCount <= 10) return originalCount * 2;
  if (originalCount <= 30) return Math.ceil(originalCount * 1.5);
  return Math.ceil(originalCount * 1.3);
}

/** Check if a concept is mastered in adaptive mode */
export function isConceptMastered(
  correct: number,
  total: number,
  conceptQuestionCount: number
): boolean {
  return (
    correct >= 4 &&
    (correct / total) >= 0.9 &&
    total >= Math.max(5, Math.ceil(conceptQuestionCount * 0.6))
  );
}

/** Process an answer in adaptive mode */
export function processAdaptiveAnswer(
  session: QuizSession,
  questionIndex: number,
  isCorrect: boolean,
  responseTimeMs: number,
): QuizSession {
  const question = session.questions[questionIndex];
  const concept = question.subtopic || question.question.slice(0, 30);
  // Deep clone masteryCount to avoid mutating original session
  const updated = {
    ...session,
    masteryCount: session.masteryCount
      ? Object.fromEntries(
          Object.entries(session.masteryCount).map(([k, v]) => [k, { ...v }])
        )
      : {},
  };

  // Update mastery tracking
  if (!updated.masteryCount[concept]) {
    updated.masteryCount[concept] = { correct: 0, total: 0, mastered: false };
  }

  const mc = updated.masteryCount[concept];
  mc.total++;
  if (isCorrect) mc.correct++;

  // Count concept questions
  const conceptTotal = session.questions.filter(
    q => (q.subtopic || q.question.slice(0, 30)) === concept
  ).length;

  mc.mastered = isConceptMastered(mc.correct, mc.total, conceptTotal);

  // Re-drill wrong answers (max 2 retries per question)
  const cap = getAdaptiveCap(session.questions.filter(q => !q._retry).length);
  if (!isCorrect && session.questions.length < cap && (question._retryCount || 0) < 2) {
    const retryQ: QuizQuestion = {
      ...question,
      id: gid(),
      _retry: true,
      _retryCount: (question._retryCount || 0) + 1,
    };
    updated.questions = [...updated.questions, retryQ];
  }

  return updated;
}

/** Skip ahead past mastered concepts in adaptive mode */
export function skipMasteredConcepts(session: QuizSession, fromIndex: number): number {
  if (!session.masteryCount) return fromIndex;

  let idx = fromIndex;
  while (idx < session.questions.length) {
    const q = session.questions[idx];
    if (q._retry) break; // Never skip retries

    const concept = q.subtopic || q.question.slice(0, 30);
    const mc = session.masteryCount[concept];
    if (!mc || !mc.mastered) break; // Not mastered, stop here

    idx++;
  }

  return Math.min(idx, session.questions.length);
}

// ─── Confidence Tracking ────────────────────────────────

export interface ConceptConfidence {
  concept: string;
  status: 'solid' | 'shaky' | 'progressing' | 'gap';
  correct: number;
  total: number;
  fastCorrect: number;
  slowCorrect: number;
}

export function getConceptConfidence(
  concept: string,
  answers: Array<{ correct: boolean; timeMs: number; concept: string }>
): ConceptConfidence {
  const conceptAnswers = answers.filter(a => a.concept === concept);
  const correct = conceptAnswers.filter(a => a.correct).length;
  const total = conceptAnswers.length;
  const fastCorrect = conceptAnswers.filter(a => a.correct && a.timeMs < 5000).length;
  const slowCorrect = conceptAnswers.filter(a => a.correct && a.timeMs > 12000).length;

  const accuracy = total > 0 ? correct / total : 0;

  let status: ConceptConfidence['status'];
  if (accuracy >= 0.9 && fastCorrect >= slowCorrect) {
    status = 'solid';
  } else if (accuracy >= 0.5 && slowCorrect > fastCorrect) {
    status = 'shaky';
  } else if (accuracy >= 0.5) {
    status = 'progressing';
  } else {
    status = 'gap';
  }

  return { concept, status, correct, total, fastCorrect, slowCorrect };
}

// ─── AI Quiz Generation Prompt Builder ──────────────────

/** Build the prompt for AI quiz generation */
export function buildQuizPrompt(config: QuizConfig, sourceText: string): string {
  const truncated = sourceText.slice(0, 25000);
  const types = config.types.join(', ');
  const diffStr = config.difficulty ? ` at difficulty level ${config.difficulty}/5` : '';
  const focusStr = config.focusArea ? ` focusing on: ${config.focusArea}` : '';

  return `Generate ${config.count} study questions from the following text${diffStr}${focusStr}.

Allowed question types: ${types}

Return ONLY a valid JSON array. Each question object must have:
- "question": string
- "type": one of [${types}]
- "options": string array (for multiple_choice, at least 4 options)
- "answer": the correct answer
- "explanation": brief explanation of why this is correct
- "difficulty": number 1-5
- "subtopic": the specific subtopic this tests

Source text:
${truncated}`;
}

/** Parse AI response into normalized questions */
export function parseAIQuizResponse(response: string): QuizQuestion[] {
  try {
    // Try to extract JSON array from response
    let jsonStr = response.trim();

    // Handle markdown code blocks
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find array
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((q: Record<string, unknown>) => normalizeQuestion(q));
  } catch {
    console.error('Failed to parse AI quiz response');
    return [];
  }
}
