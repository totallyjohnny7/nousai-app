/** BIOL 3020 Exam 2 Practicum — Type Definitions */

import _biolBubbles from '../../data/biolBubbles.json'
import _biolQuestions from '../../data/biolQuestions.json'

// ─── Taxonomy ──────────────────────────────────────────────────────────────

export type BiolTopic =
  | 'genomes'
  | 'chromatin-chromosomes'
  | 'bioinformatics'
  | 'dna-replication'
  | 'dna-repair'
  | 'nucleus'
  | 'other'

export type BiolHeading =
  | 'what-and-why'
  | 'key-players'
  | 'how-it-works'
  | 'know-the-differences'
  | 'consequences-and-failures'
  | 'apply-it'
  | 'exam-traps'

export type BiolSessionMode = 'timed' | 'practice' | 'weak-topics' | 'topic-drill' | 'due-review'

export type BiolQuestionType = 'mcq' | 'free-response' | 'scenario'

export interface BiolOption { label: string; text: string }

export interface BiolQuestion {
  id: string
  topic: BiolTopic
  heading: BiolHeading
  questionType: BiolQuestionType
  questionText: string
  options?: BiolOption[]        // for MCQ
  expectedAnswer: string
  explanation: string
  examTag?: 'exam1' | 'exam2' | 'exam3'
  examRef?: string              // e.g. "2021 Q4"
  difficulty: 1 | 2 | 3 | 4 | 5
  wrongCount?: number
  srNextReview?: string         // YYYY-MM-DD
  srInterval?: number
}

export interface BiolAnswer {
  questionId: string
  userAnswer: string
  correct: boolean
  score: number                 // 0–100
  feedback?: string
  gradingStatus: 'pending' | 'graded' | 'skipped'
  timeMs: number
}

export interface BiolSession {
  id: string
  mode: BiolSessionMode
  topicFilter?: BiolTopic
  questionIds: string[]
  answers: Record<string, BiolAnswer>
  startedAt: string
  finishedAt?: string
  scrambleValues?: boolean
}

export interface BiolSessionSummary {
  id: string
  date: string
  mode: BiolSessionMode
  questionCount: number
  averageScore: number
  topicBreakdown: Record<BiolTopic, { count: number; avgScore: number }>
}

export interface BiolCourseData {
  questions: BiolQuestion[]
  sessionHistory: BiolSessionSummary[]
  currentStreak: number
  lastStreakDate: string
  version: number
}

// ─── Bubble content types ──────────────────────────────────────────────────

export interface BiolBullet {
  text: string
  isTrap?: boolean
  examRef?: string
}

export interface BiolHeadingContent {
  heading: BiolHeading
  label: string
  bullets: BiolBullet[]
}

export interface BiolBubble {
  id: string
  topic: BiolTopic
  title: string
  color: string
  headings: BiolHeadingContent[]
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function generateBiolId(): string {
  return `biol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createEmptyBiolData(): BiolCourseData {
  return {
    questions: [...DEFAULT_BIOL_QUESTIONS],
    sessionHistory: [],
    currentStreak: 0,
    lastStreakDate: '',
    version: 1,
  }
}

export function migrateBiolCourseData(data: unknown): BiolCourseData {
  if (!data || typeof data !== 'object') return createEmptyBiolData()
  const r = data as Partial<BiolCourseData>
  let questions: BiolQuestion[]
  if (Array.isArray(r.questions)) {
    // Merge: keep stored question state (wrongCount, SR data), add any new DEFAULT questions not yet stored
    const storedIds = new Set(r.questions.map(q => q.id))
    const newQuestions = DEFAULT_BIOL_QUESTIONS.filter(q => !storedIds.has(q.id))
    questions = [...r.questions, ...newQuestions]
  } else {
    questions = [...DEFAULT_BIOL_QUESTIONS]
  }
  return {
    questions,
    sessionHistory: Array.isArray(r.sessionHistory) ? r.sessionHistory : [],
    currentStreak: typeof r.currentStreak === 'number' ? r.currentStreak : 0,
    lastStreakDate: typeof r.lastStreakDate === 'string' ? r.lastStreakDate : '',
    version: 1,
  }
}

export const TOPIC_LABELS: Record<BiolTopic, string> = {
  'genomes': 'Genomes',
  'chromatin-chromosomes': 'Chromatin & Chromosomes',
  'bioinformatics': 'Bioinformatics',
  'dna-replication': 'DNA Replication',
  'dna-repair': 'DNA Repair',
  'nucleus': 'The Nucleus',
  'other': 'Other',
}

export const TOPIC_COLORS: Record<BiolTopic, string> = {
  'genomes': '#22c55e',
  'chromatin-chromosomes': '#3b82f6',
  'bioinformatics': '#f59e0b',
  'dna-replication': '#8b5cf6',
  'dna-repair': '#ef4444',
  'nucleus': '#06b6d4',
  'other': '#6b7280',
}

export const HEADING_LABELS: Record<BiolHeading, string> = {
  'what-and-why': 'What & Why',
  'key-players': 'Key Players',
  'how-it-works': 'How It Works',
  'know-the-differences': 'Know the Differences',
  'consequences-and-failures': 'Consequences & Failures',
  'apply-it': 'Apply It',
  'exam-traps': 'Exam Traps',
}

// ─── Data (loaded from JSON) ──────────────────────────────────────────────

export const BIOL_BUBBLES: BiolBubble[] = _biolBubbles as BiolBubble[]

export const DEFAULT_BIOL_QUESTIONS: BiolQuestion[] = _biolQuestions as BiolQuestion[]
