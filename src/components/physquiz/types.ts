/** Physics Practicum — Type Definitions */

// ─── Taxonomy ──────────────────────────────────────────────────────────────

export type PhysicsTopic =
  | 'mechanics' | 'kinematics' | 'thermodynamics' | 'waves'
  | 'optics' | 'electromagnetism' | 'circuits' | 'modern' | 'nuclear' | 'other'

export type PhysicsQuestionType = 'mcq' | 'free-response' | 'multi-part'
export type PhysicsDifficulty = 1 | 2 | 3 | 4 | 5
export type PhysicsSource = 'manual' | 'ai-generated' | 'image-import' | 'teacher' | 'json-import'
export type PhysicsSessionMode = 'timed' | 'practice' | 'weak-topics' | 'topic-drill' | 'due-review'
export type GradingStatus = 'graded' | 'pending' | 'failed'
export type ConfidenceRating = 'not-sure' | 'pretty-sure' | 'confident'
export type PhysicsErrorCategory =
  | 'unit_error' | 'sig_fig_error' | 'wrong_direction' | 'missing_label'
  | 'incomplete_steps' | 'setup_error' | 'magnitude_error' | 'sign_error' | 'conceptual_error'

// ─── Supporting types ──────────────────────────────────────────────────────

export interface PhysicsVariable {
  symbol: string   // e.g. 'v_0'
  name: string     // e.g. 'initial velocity'
  unit: string     // e.g. 'm/s'
  definition?: string
}

export interface VariableRange {
  symbol: string
  min: number; max: number; step: number; unit: string
}

export interface PhysicsSubPart {
  label: string           // 'a', 'b', 'c'
  question: string        // LaTeX-capable
  expectedAnswer: string
  points?: number
}

export interface StepAnswer {
  stepIndex: number
  userStep: string
  aiScore: number
  aiFeedback: string
}

export interface ConfidenceCalibration {
  notSure: { correct: number; total: number }
  prettySure: { correct: number; total: number }
  confident: { correct: number; total: number }
}

// ─── Core question ─────────────────────────────────────────────────────────

export interface PhysicsQuestion {
  id: string
  questionText: string            // supports $latex$ and $$display$$
  questionType: PhysicsQuestionType
  topic: PhysicsTopic
  subtopic?: string
  difficulty: PhysicsDifficulty
  source: PhysicsSource
  tags: string[]
  expectedAnswer: string
  acceptableAnswers?: string[]
  choices?: string[]              // MCQ only
  parts?: PhysicsSubPart[]        // multi-part only
  variables?: PhysicsVariable[]
  variableRanges?: VariableRange[]
  prerequisiteConcepts?: string[]
  hint?: string
  explanation?: string
  questionImageBase64?: string
  questionImageMime?: string
  diagramData?: string            // JSON.stringify(ExcalidrawScene), gzip-compressed → base64
  diagramThumbnailBase64?: string
  starred?: boolean
  examTag?: string
  chapterTag?: string
  dateAdded: string               // YYYY-MM-DD (date-only, no time)
  wrongCount?: number
  srInterval?: number             // days (null = never reviewed)
  srNextReview?: string           // YYYY-MM-DD (date-only)
  supportsStepMode?: boolean
}

// ─── Answer ────────────────────────────────────────────────────────────────

export interface PhysicsAnswer {
  questionId: string
  userAnswer: string
  userDiagramBase64?: string      // cleared after grading resolves (see plan)
  gradingStatus: GradingStatus
  answerScore: number             // 0-100
  diagramScore?: number           // 0-100 or undefined if no diagram
  combinedScore: number           // 70% answer + 30% diagram if diagram, else answerScore
  aiFeedback: string
  errorCategories: PhysicsErrorCategory[]
  whatToFix?: string[]
  steps?: StepAnswer[]
  confidence?: ConfidenceRating
  confidenceCorrect?: boolean
  timeMs: number
  gradedAt: string
  missingPrerequisites?: string[]
  scrambledValues?: Record<string, number>
}

// ─── Session ───────────────────────────────────────────────────────────────

export interface PhysicsSession {
  id: string
  mode: PhysicsSessionMode
  topicFilter?: PhysicsTopic
  questionIds: string[]
  answers: PhysicsAnswer[]
  currentIndex: number
  startedAt: string
  finishedAt?: string
  scrambleValues: boolean
  stepMode: boolean
  computedScrambledValues?: Record<string, Record<string, number>> // questionId → symbol → value
}

// ─── Session summary (stored in history) ──────────────────────────────────

export interface PhysicsSessionSummary {
  id: string
  mode: PhysicsSessionMode
  date: string                    // YYYY-MM-DD
  totalQuestions: number
  gradedCount: number
  pendingCount: number
  failedCount: number
  averageScore: number            // graded answers only; never includes pending/failed as 0
  totalTimeMs: number
  topicBreakdown: Record<string, { attempted: number; averageScore: number }>
  errorCategories: Record<string, number>
  confidenceCalibration: ConfidenceCalibration
}

// ─── Persisted course data ─────────────────────────────────────────────────

export interface PhysicsCourseData {
  questions: PhysicsQuestion[]
  sessionHistory: PhysicsSessionSummary[]
  currentStreak: number
  lastStreakDate: string           // YYYY-MM-DD
  version: number
}

// ─── Formula sheet ─────────────────────────────────────────────────────────

export interface FormulaEntry {
  label: string
  latex: string
  variables?: string
}

export type FormulaSheetTopic = 'mechanics' | 'em' | 'thermo' | 'waves' | 'modern'

// ─── Helpers ───────────────────────────────────────────────────────────────

let _idCounter = 0
export function generatePhysicsId(): string {
  return `phq_${Date.now().toString(36)}_${(++_idCounter).toString(36)}`
}

export function todayDateStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function createEmptyPhysicsData(): PhysicsCourseData {
  return {
    questions: [],
    sessionHistory: [],
    currentStreak: 0,
    lastStreakDate: '',
    version: 1,
  }
}

/** Migration: ensures all required fields exist on loaded data */
export function migratePhysicsCourseData(raw: unknown): PhysicsCourseData {
  if (!raw || typeof raw !== 'object') return createEmptyPhysicsData()
  const r = raw as Partial<PhysicsCourseData>
  return {
    questions: Array.isArray(r.questions) ? r.questions.map(migrateQuestion) : [],
    sessionHistory: Array.isArray(r.sessionHistory) ? r.sessionHistory : [],
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : 0,
    lastStreakDate: typeof r.lastStreakDate === 'string' ? r.lastStreakDate : '',
    version: typeof r.version === 'number' ? r.version : 1,
  }
}

function migrateQuestion(q: Partial<PhysicsQuestion>): PhysicsQuestion {
  return {
    id: q.id ?? generatePhysicsId(),
    questionText: q.questionText ?? '',
    questionType: q.questionType ?? 'free-response',
    topic: q.topic ?? 'other',
    difficulty: q.difficulty ?? 3,
    source: q.source ?? 'manual',
    tags: q.tags ?? [],
    expectedAnswer: q.expectedAnswer ?? '',
    dateAdded: q.dateAdded ?? todayDateStr(),
    wrongCount: q.wrongCount ?? 0,
    ...q,
  }
}

export const TOPIC_LABELS: Record<PhysicsTopic, string> = {
  mechanics: 'Mechanics',
  kinematics: 'Kinematics',
  thermodynamics: 'Thermodynamics',
  waves: 'Waves',
  optics: 'Optics',
  electromagnetism: 'E&M',
  circuits: 'Circuits',
  modern: 'Modern Physics',
  nuclear: 'Nuclear',
  other: 'Other',
}

export const TOPIC_COLORS: Record<PhysicsTopic, string> = {
  mechanics: '#3b82f6',
  kinematics: '#06b6d4',
  thermodynamics: '#ef4444',
  waves: '#8b5cf6',
  optics: '#22c55e',
  electromagnetism: '#f59e0b',
  circuits: '#ec4899',
  modern: '#6366f1',
  nuclear: '#f97316',
  other: '#6b7280',
}

export const ERROR_LABELS: Record<PhysicsErrorCategory, string> = {
  unit_error: 'Unit Error',
  sig_fig_error: 'Sig Fig',
  wrong_direction: 'Wrong Direction',
  missing_label: 'Missing Label',
  incomplete_steps: 'Incomplete Steps',
  setup_error: 'Setup Error',
  magnitude_error: 'Magnitude Error',
  sign_error: 'Sign Error',
  conceptual_error: 'Conceptual Error',
}

export const ERROR_COLORS: Record<PhysicsErrorCategory, string> = {
  unit_error: '#f97316',
  sig_fig_error: '#eab308',
  wrong_direction: '#ef4444',
  missing_label: '#f59e0b',
  incomplete_steps: '#8b5cf6',
  setup_error: '#ec4899',
  magnitude_error: '#06b6d4',
  sign_error: '#3b82f6',
  conceptual_error: '#6b7280',
}
