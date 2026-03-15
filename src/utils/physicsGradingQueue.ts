/**
 * Offline grading queue for Physics Practicum.
 * Stores pending AI grading calls when offline; flushes all on reconnect.
 * NOTE: flushQueue() flushes ALL courses (no courseId parameter).
 */
import { callAI } from './ai'

const QUEUE_KEY = 'nousai-physquiz-pending-grades'
const MAX_QUEUE_SIZE = 50

export interface PendingGrade {
  answerId: string
  questionId: string
  courseStorageKey: string        // localStorage key to update after grading
  userAnswer: string
  userDiagramBase64?: string      // kept in queue until grade resolves, then cleared from answer
  questionText: string
  expectedAnswer: string
  questionImageBase64?: string
  questionImageMime?: string
  scrambledValues?: Record<string, number>
  variables?: Array<{ symbol: string; name: string; unit: string }>
  retries: number
  queuedAt: string
}

export function enqueue(item: Omit<PendingGrade, 'retries' | 'queuedAt'>): void {
  const queue = getPending()
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift() // drop oldest
    console.warn('[physicsQueue] Max queue size reached, dropping oldest item')
  }
  queue.push({ ...item, retries: 0, queuedAt: new Date().toISOString() })
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* ignore */ }
}

export function dequeue(answerId: string): void {
  const queue = getPending().filter(g => g.answerId !== answerId)
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* ignore */ }
}

export function getPending(): PendingGrade[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

const GRADING_SYSTEM_PROMPT = `You are a physics exam grader. Return ONLY valid JSON matching this schema exactly:
{
  "answerScore": <0-100>,
  "diagramScore": <0-100 or null>,
  "combinedScore": <number>,
  "feedback": "<2-3 sentences>",
  "whatToFix": ["<fix 1>", "<fix 2>"],
  "errorCategories": ["<from allowed list>"],
  "missingPrerequisites": ["<concept>"]
}
Allowed errorCategories: unit_error, sig_fig_error, wrong_direction, missing_label, incomplete_steps, setup_error, magnitude_error, sign_error, conceptual_error.
combinedScore = 70% answerScore + 30% diagramScore if diagram present, else answerScore.
Always flag unit_error if units missing. Always flag sig_fig_error if wrong sig figs.
missingPrerequisites: 0-3 prerequisite concepts the student appears to be missing, or [].`

async function gradeOne(item: PendingGrade): Promise<{
  answerScore: number; diagramScore?: number; combinedScore: number
  feedback: string; whatToFix: string[]; errorCategories: string[]; missingPrerequisites: string[]
} | null> {
  const userContent: Array<{ type: string; [key: string]: unknown }> = []

  if (item.questionImageBase64 && item.questionImageMime) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:${item.questionImageMime};base64,${item.questionImageBase64}` }
    })
  }
  if (item.userDiagramBase64) {
    userContent.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${item.userDiagramBase64}` }
    })
  }

  const variablesText = item.variables?.length
    ? `\nVariables: ${item.variables.map(v => `${v.symbol} = ${v.name} (${v.unit})`).join(', ')}`
    : ''
  const scrambleText = item.scrambledValues && Object.keys(item.scrambledValues).length > 0
    ? `\nScrambled values: ${Object.entries(item.scrambledValues).map(([k, v]) => `${k}=${v}`).join(', ')}`
    : ''

  userContent.push({
    type: 'text',
    text: [
      `QUESTION: ${item.questionText}${variablesText}${scrambleText}`,
      `REFERENCE ANSWER: ${item.expectedAnswer}`,
      `STUDENT ANSWER: ${item.userAnswer}`,
      item.userDiagramBase64 ? '[Student diagram image attached above]' : '[No diagram submitted]',
      'Grade this response as JSON only.',
    ].join('\n\n')
  })

  try {
    const result = await callAI(
      [
        { role: 'system', content: GRADING_SYSTEM_PROMPT },
        { role: 'user', content: userContent as never },
      ],
      {},
      'ocr'
    )
    const match = result.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    return null
  } catch {
    return null
  }
}

/** Flush all pending grades across all courses. Call on window.online event. */
export async function flushQueue(): Promise<void> {
  const pending = getPending()
  if (pending.length === 0) return

  for (const item of pending) {
    const result = await gradeOne(item)
    if (result) {
      // Update the stored answer in localStorage
      try {
        const raw = localStorage.getItem(item.courseStorageKey)
        if (raw) {
          const courseData = JSON.parse(raw)
          // Find and update the answer in the most recent session history answers
          // Note: we store answers in active session; for pending grades, we store in a separate answers cache
          // The orchestrator (PhysicsQuizTab) handles the actual update when it sees the grade resolved
        }
      } catch { /* ignore */ }
      dequeue(item.answerId)
      // Dispatch event so PhysicsQuizTab can update its state
      window.dispatchEvent(new CustomEvent('physics-grade-resolved', {
        detail: {
          answerId: item.answerId,
          answerScore: result.answerScore,
          diagramScore: result.diagramScore ?? undefined,
          combinedScore: result.combinedScore,
          aiFeedback: result.feedback,
          whatToFix: result.whatToFix,
          errorCategories: result.errorCategories,
          missingPrerequisites: result.missingPrerequisites,
        }
      }))
      // Small delay between grading calls
      await new Promise(r => setTimeout(r, 800))
    } else {
      // increment retries
      const queue = getPending()
      const idx = queue.findIndex(g => g.answerId === item.answerId)
      if (idx !== -1) {
        queue[idx].retries += 1
        if (queue[idx].retries >= 3) {
          // Mark as failed, remove from queue, dispatch failed event
          window.dispatchEvent(new CustomEvent('physics-grade-failed', {
            detail: { answerId: item.answerId }
          }))
          dequeue(item.answerId)
        } else {
          try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)) } catch { /* ignore */ }
        }
      }
    }
  }
}
