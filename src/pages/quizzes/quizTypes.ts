/** Shared types for quiz subcomponents */

export interface PlayableQuiz {
  questions: { question: string; correctAnswer: string; options?: string[]; type: string; explanation?: string }[]
  name: string
  subject: string
  subtopic: string
}

/** Shape of raw question objects stored in QuizAttempt.questions (unknown[]) */
export interface RawQuizQuestion {
  question?: string
  q?: string
  correctAnswer?: string
  answer?: string
  options?: string[]
  type?: string
  explanation?: string
}

/** Shape of merged question objects built during quiz merge */
export interface MergedQuizQuestion {
  question: string
  correctAnswer: string
  options?: string[]
  type: string
  explanation?: string
  subject: string
}
