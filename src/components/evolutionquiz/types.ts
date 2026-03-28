/** Evolution Exam 2 Practicum — Type Definitions */

import _evolBubbles from '../../data/evolBubbles.json'
import _evolQuestions from '../../data/evolQuestions.json'

// ─── Taxonomy ──────────────────────────────────────────────────────────────

export type EvolTopic =
  | 'natural-selection'
  | 'genetic-drift'
  | 'speciation'
  | 'phylogenetics'
  | 'adaptation'
  | 'population-genetics'
  | 'evolution-of-sex'
  | 'coevolution'
  | 'evo-devo'
  | 'life-history'
  | 'behavior'
  | 'other'

export type EvolHeading =
  | 'what-and-why'
  | 'key-players'
  | 'how-it-works'
  | 'know-the-differences'
  | 'consequences-and-failures'
  | 'apply-it'
  | 'exam-traps'

export type EvolSessionMode =
  | 'timed'
  | 'practice'
  | 'weak-topics'
  | 'topic-drill'
  | 'heading-drill'
  | 'due-review'

export type EvolQuestionType = 'mcq' | 'free-response' | 'scenario'

export interface EvolQuestion {
  id: string
  topic: EvolTopic
  heading: EvolHeading
  questionType: EvolQuestionType
  questionText: string
  options?: string[]
  correctIndex?: number
  expectedAnswer: string
  difficulty: 1 | 2 | 3 | 4 | 5
  examTag?: 'exam1' | 'exam2' | 'exam3'
  chapterTag?: string
  wrongCount?: number
  lastReviewDate?: string
  srNextReview?: string
  srInterval?: number
}

export interface EvolAnswer {
  questionId: string
  userAnswer: string
  score: number
  correct: boolean
  feedback?: string
  timeTaken?: number
  gradingStatus: 'pending' | 'graded' | 'skipped'
  timeMs: number
}

export interface EvolSession {
  id: string
  mode: EvolSessionMode
  topicFilter?: EvolTopic[]
  headingFilter?: EvolHeading
  questionIds: string[]
  answers: Record<string, EvolAnswer>
  startedAt: string
  finishedAt?: string
}

export interface EvolSessionSummary {
  id: string
  date: string
  mode: EvolSessionMode
  questionCount: number
  averageScore: number
  topicBreakdown: Record<string, { count: number; avgScore: number }>
  headingBreakdown: Record<string, { count: number; avgScore: number }>
}

export interface EvolCourseData {
  version: number
  questions: EvolQuestion[]
  sessionHistory: EvolSessionSummary[]
  currentStreak: number
  lastStreakDate: string
}

export interface EvolBullet {
  text: string
  isTrap?: boolean
  examRef?: string
}

export interface EvolHeadingContent {
  heading: EvolHeading
  bullets: EvolBullet[]
}

export interface EvolBubble {
  id: string
  chapter: 'ch10' | 'ch11' | 'ch12' | 'ch15' | 'ch16'
  chapterLabel: string
  topic: EvolTopic
  title: string
  color: string
  headings: EvolHeadingContent[]
}

// ─── Labels & Colors ───────────────────────────────────────────────────────

export const TOPIC_LABELS: Record<EvolTopic, string> = {
  'natural-selection': 'Natural Selection',
  'genetic-drift': 'Genetic Drift',
  'speciation': 'Speciation',
  'phylogenetics': 'Phylogenetics',
  'adaptation': 'Adaptation',
  'population-genetics': 'Pop. Genetics',
  'evolution-of-sex': 'Evolution of Sex',
  'coevolution': 'Coevolution',
  'evo-devo': 'Evo-Devo',
  'life-history': 'Life History',
  'behavior': 'Behavior',
  'other': 'Other',
}

export const TOPIC_COLORS: Record<EvolTopic, string> = {
  'natural-selection': '#4ade80',
  'genetic-drift': '#fb923c',
  'speciation': '#38bdf8',
  'phylogenetics': '#a78bfa',
  'adaptation': '#facc15',
  'population-genetics': '#f472b6',
  'evolution-of-sex': '#f472b6',
  'coevolution': '#a78bfa',
  'evo-devo': '#4ade80',
  'life-history': '#fb923c',
  'behavior': '#38bdf8',
  'other': '#6b7280',
}

export const CHAPTER_COLORS: Record<string, string> = {
  ch10: '#4ade80',
  ch11: '#f472b6',
  ch12: '#fb923c',
  ch15: '#a78bfa',
  ch16: '#38bdf8',
}

export const CHAPTER_LABELS: Record<string, string> = {
  ch10: 'CH 10 — Evo-Devo',
  ch11: 'CH 11 — Sex',
  ch12: 'CH 12 — Life History',
  ch15: 'CH 15 — Coevolution',
  ch16: 'CH 16 — Behavior',
}

export const HEADING_LABELS: Record<EvolHeading, string> = {
  'what-and-why': '📖 What & Why',
  'key-players': '🔑 Key Players',
  'how-it-works': '⚙️ How It Works',
  'know-the-differences': '⚖️ Know the Differences',
  'consequences-and-failures': '💥 Consequences & Failures',
  'apply-it': '🎯 Apply It',
  'exam-traps': '⚠️ Exam Traps',
}

// ─── Data (loaded from JSON) ──────────────────────────────────────────────

export const EVOL_BUBBLES: EvolBubble[] = _evolBubbles as EvolBubble[]

export const DEFAULT_EVOL_QUESTIONS: EvolQuestion[] = _evolQuestions as EvolQuestion[]

// ─── Helper Functions ──────────────────────────────────────────────────────

export function todayDateStr(): string {
  return new Date().toISOString().split('T')[0]
}

export function generateEvolId(): string {
  return 'evol-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function createEmptyEvolData(): EvolCourseData {
  return {
    version: 1,
    questions: [...DEFAULT_EVOL_QUESTIONS],
    sessionHistory: [],
    currentStreak: 0,
    lastStreakDate: '',
  }
}

export function migrateEvolCourseData(raw: unknown): EvolCourseData {
  const base = createEmptyEvolData()
  if (typeof raw !== 'object' || raw === null) return base
  const r = raw as Record<string, unknown>
  return {
    version: typeof r.version === 'number' ? r.version : 1,
    questions: Array.isArray(r.questions) ? r.questions as EvolQuestion[] : base.questions,
    sessionHistory: Array.isArray(r.sessionHistory) ? r.sessionHistory as EvolSessionSummary[] : [],
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : 0,
    lastStreakDate: typeof r.lastStreakDate === 'string' ? r.lastStreakDate : '',
  }
}
