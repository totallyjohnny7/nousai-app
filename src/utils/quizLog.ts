// Quiz session log — persisted in IndexedDB (survives SW/cache clears)
// Each completed quiz session writes one log entry.

const DB_NAME = 'nousai-quiz-logs'
const STORE = 'sessions'
const DB_VERSION = 1

export interface QuizLogEntry {
  id: string            // YYYY-MM-DD_HH-MM-SS + random suffix
  timestamp: string     // ISO string
  subject: string
  name: string
  score: number         // 0-100
  correct: number
  total: number
  answers: {
    question: string
    userAnswer: string
    correctAnswer: string
    correct: boolean
    timeMs: number
  }[]
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveQuizLog(entry: QuizLogEntry): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(entry)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[QuizLog] Failed to save log:', e)
  }
}

export async function getAllQuizLogs(): Promise<QuizLogEntry[]> {
  try {
    const db = await openDB()
    const result = await new Promise<QuizLogEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result as QuizLogEntry[])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return result.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  } catch (e) {
    console.warn('[QuizLog] Failed to read logs:', e)
    return []
  }
}

export async function deleteQuizLog(id: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[QuizLog] Failed to delete log:', e)
  }
}

export function makeQuizLogEntry(attempt: {
  id: string
  name: string
  subject?: string
  score: number
  correct: number
  questionCount: number
  answers: {
    question: { question: string; correctAnswer: string }
    userAnswer: string
    correct: boolean
    timeMs: number
  }[]
}): QuizLogEntry {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return {
    id: `${dateStr}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.toISOString(),
    subject: attempt.subject || 'General',
    name: attempt.name,
    score: attempt.score,
    correct: attempt.correct,
    total: attempt.questionCount,
    answers: attempt.answers.map(a => ({
      question: a.question?.question || '',
      userAnswer: a.userAnswer,
      correctAnswer: a.question?.correctAnswer || '',
      correct: a.correct,
      timeMs: a.timeMs,
    })),
  }
}

export function exportQuizLogAsJSON(entry: QuizLogEntry): void {
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `quiz-log_${entry.id}.json`
  a.click()
  URL.revokeObjectURL(url)
}
