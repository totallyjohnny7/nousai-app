/** Japanese Typing/Speaking Quiz — Type Definitions */

export type JpQuizPreset = 'written' | 'oral' | 'final' | 'free'
export type MiniGameType = 'memory-flip' | 'sentence-builder' | 'listening-quiz'

// ─── Vocab Bank ───────────────────────────────────────────────────────────────

export type VocabCategory =
  | 'noun' | 'verbal-noun'
  | 'pronoun' | 'demonstrative'
  | 'verb-u' | 'verb-ru' | 'verb-irregular'
  | 'i-adj' | 'na-adj'
  | 'adverb'
  | 'particle'
  | 'conjunction' | 'interjection'
  | 'question-word' | 'counter'
  | 'grammar'     // sentence patterns for Sentence Builder
  | 'expression'  // conversational phrases, classroom expressions, set patterns
  | 'other'

export interface VocabBankItem {
  id: string
  word: string          // Japanese term / kana / pattern
  meaning: string       // English definition
  category: VocabCategory
  reading?: string      // hiragana if word has kanji
  example?: string      // JP example sentence (Sentence Builder uses these)
  exampleEn?: string    // English translation of example
  notes?: string        // extra tips / warnings
  breakdown?: string[]  // per-token grammatical role labels (PRN, N, V, COP, TOP, OBJ, …)
  source?: 'custom' | 'nakama1' | 'imported'
}

export interface VocabBankData {
  items: VocabBankItem[]
  version: number
}

export interface JpQuizQuestion {
  id: string
  questionText: string
  questionImageBase64?: string   // compressed, max ~200KB
  questionImageMime?: string     // 'image/jpeg'
  expectedAnswer: string
  acceptableAnswers?: string[]   // alternative correct answers
  answerType: 'typed' | 'spoken' | 'both'
  hint?: string
  explanation?: string
  difficulty: 1 | 2 | 3 | 4 | 5
  tags: string[]
  createdAt: string
}

export interface JpQuizAnswer {
  questionId: string
  userAnswer: string
  inputMethod: 'typed' | 'spoken'
  exactMatch: boolean
  aiScore: number              // 0-100
  aiFeedback: string
  timeMs: number
}

export interface JpQuizChatMsg {
  role: 'user' | 'ai'
  text: string
}

export interface JpQuizSession {
  id: string
  preset: JpQuizPreset
  questionIds: string[]
  answers: JpQuizAnswer[]
  currentIndex: number
  startedAt: string
  finishedAt?: string
  chatMessages: Record<string, JpQuizChatMsg[]>  // keyed by questionId
}

export interface JpQuizSessionSummary {
  id: string
  preset: JpQuizPreset
  date: string
  totalQuestions: number
  averageScore: number
  totalTimeMs: number
}

export interface JpQuizCourseData {
  questions: JpQuizQuestion[]
  sessionHistory: JpQuizSessionSummary[]
  version: number
}

export const PRESET_INFO: Record<JpQuizPreset, { label: string; icon: string; desc: string }> = {
  written: { label: 'Written Exam', icon: '📝', desc: 'Type answers with IME. Timed, strict scoring.' },
  oral:    { label: 'Oral Exam',    icon: '🎤', desc: 'Speak answers in Japanese. AI rates pronunciation.' },
  final:   { label: 'Final Exam',   icon: '📋', desc: 'Mixed typing + speaking. Full exam simulation.' },
  free:    { label: 'Free Practice', icon: '🆓', desc: 'Choose per question. Hints available, untimed.' },
}

export function createEmptyData(): JpQuizCourseData {
  return { questions: [], sessionHistory: [], version: 1 }
}

let _idCounter = 0
export function generateQuizId(): string {
  return `jpq_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`
}
