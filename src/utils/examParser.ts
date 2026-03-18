/**
 * examParser.ts — Phase 8: AI-powered exam OCR
 *
 * Sends exam photo(s) to the configured AI provider (vision-capable)
 * and extracts graded questions into ExamQuestion[].
 */

import { callAI, safeParseAIJSON, aiCallWithGuards } from './ai'
import type { AIContentPart } from './ai'
import type { ExamQuestion } from '../types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface RawQuestion {
  id: string
  questionText: string
  userAnswer: string
  correctAnswer: string
  pointsEarned: number
  pointsPossible: number
  conceptTag: string
  status: 'correct' | 'incorrect' | 'partial'
  ocrConfidence: 'ai_read' | 'ai_uncertain'
}

interface ParsedExamPage {
  questions: RawQuestion[]
}

// ─── Single page parser ───────────────────────────────────────────────────────

export async function parseExamPage(
  imageBase64: string,
  pageNum: number,
  totalPages: number
): Promise<ExamQuestion[]> {
  const prompt = `You are analyzing a photo of a graded student exam. Extract visible questions.
Return ONLY valid JSON. No markdown fences.

Extract all visible questions from this exam image (page ${pageNum} of ${totalPages}).

Return exactly:
{
  "questions": [{
    "id": "q${pageNum}_1",
    "questionText": string,
    "userAnswer": string,
    "correctAnswer": string,
    "pointsEarned": number,
    "pointsPossible": number,
    "conceptTag": string,
    "status": "correct|incorrect|partial",
    "ocrConfidence": "ai_read|ai_uncertain"
  }]
}

Rules:
- conceptTag = the specific concept being tested (e.g. "Histone Octamer Assembly", not just "Biology")
- Use ai_uncertain for any text you're not confident about
- If you cannot read a question at all, omit it
- userAnswer: empty string if student left it blank
- Include the image in your analysis`

  const fallback: ParsedExamPage = { questions: [] }

  const content: AIContentPart[] = [
    { type: 'text', text: prompt },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
  ]

  const aiText = await aiCallWithGuards(() =>
    callAI(
      [{ role: 'user', content: content as unknown as string }],
      { maxTokens: 2000 }
    )
  )

  const { data } = safeParseAIJSON<ParsedExamPage>(aiText, fallback)

  return (data.questions ?? []).map((q: RawQuestion): ExamQuestion => ({
    id: generateId(),
    questionText: q.questionText ?? '',
    userAnswer: q.userAnswer ?? '',
    correctAnswer: q.correctAnswer ?? '',
    pointsEarned: typeof q.pointsEarned === 'number' ? q.pointsEarned : 0,
    pointsPossible: typeof q.pointsPossible === 'number' ? q.pointsPossible : 1,
    conceptTag: q.conceptTag ?? 'Unknown',
    note: undefined,
    status: (['correct', 'incorrect', 'partial'] as const).includes(q.status) ? q.status : 'incorrect',
    ocrConfidence: q.ocrConfidence === 'ai_uncertain' ? 'ai_uncertain' : 'ai_read',
  }))
}

// ─── Multi-page parser ────────────────────────────────────────────────────────

export async function parseExamMultiPage(
  images: string[], // base64 strings (no data: prefix)
  onProgress: (page: number, total: number) => void
): Promise<ExamQuestion[]> {
  const allQuestions: ExamQuestion[] = []

  for (let i = 0; i < images.length; i++) {
    onProgress(i + 1, images.length)
    try {
      const pageQuestions = await parseExamPage(images[i], i + 1, images.length)
      allQuestions.push(...pageQuestions)
    } catch (err) {
      console.error(`[examParser] Failed to parse page ${i + 1}:`, err)
      // Continue with other pages
    }
  }

  // Dedup by questionText (same question appearing on multiple pages)
  const seen = new Set<string>()
  return allQuestions.filter(q => {
    const key = q.questionText.trim().toLowerCase().slice(0, 50)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
