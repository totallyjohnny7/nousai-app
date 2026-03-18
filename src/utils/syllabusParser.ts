import { callAI, safeParseAIJSON, aiCallWithGuards } from './ai'
import type { GradeCategory, SyllabusParseResult } from '../types'

const MAX_SYLLABUS_CHARS = 50_000

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export async function parseSyllabus(
  rawText: string,
  courseId: string  // unused in parse but available for future
): Promise<SyllabusParseResult> {
  void courseId // suppress unused warning
  const today = new Date().toISOString().slice(0, 10)
  const truncated = rawText.length > MAX_SYLLABUS_CHARS
    ? rawText.slice(0, MAX_SYLLABUS_CHARS) + '\n[TRUNCATED — first ~50k chars only]'
    : rawText

  const prompt = `System: You are an academic assistant extracting structured data from course syllabi.
Return ONLY valid JSON. No markdown fences. No explanation.

User: Extract from this syllabus. Today's date is ${today} (use this to convert relative dates like "next Monday" or "Week 3" to absolute YYYY-MM-DD dates).

Return exactly this shape:
{
  "examDates": [{ "title": string, "date": "YYYY-MM-DD", "topics": string[] }],
  "assignmentDates": [{ "title": string, "date": "YYYY-MM-DD", "type": "quiz|exam|homework|lab|project|other" }],
  "weeklyTopics": [{ "week": number, "topics": string[] }],
  "gradingBreakdown": [{ "id": "auto", "name": string, "weight": number }],
  "parseConfidence": "high|medium|low"
}

Rules:
- Convert ALL relative dates to YYYY-MM-DD using today as reference
- If you can't determine a date precisely, use your best estimate and set parseConfidence to "low"
- gradingBreakdown weights should sum to 100; if syllabus is unclear, omit this field entirely
- Only include items that are clearly deadlines or assessments

Syllabus text:
${truncated}`

  type AIResponse = {
    examDates: { title: string; date: string; topics: string[] }[]
    assignmentDates: { title: string; date: string; type: string }[]
    weeklyTopics: { week: number; topics: string[] }[]
    gradingBreakdown: { id: string; name: string; weight: number }[]
    parseConfidence: 'high' | 'medium' | 'low'
  }
  const fallback: AIResponse = {
    examDates: [], assignmentDates: [], weeklyTopics: [],
    gradingBreakdown: [], parseConfidence: 'low'
  }

  const aiText = await aiCallWithGuards(() =>
    callAI(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1500 },
    )
  )

  const { data, parseError } = safeParseAIJSON<AIResponse>(aiText, fallback)
  if (parseError) {
    console.error('[syllabusParser] JSON parse error:', parseError)
  }

  // Fix auto-generated IDs for gradingBreakdown
  const gradingBreakdown: GradeCategory[] = (data.gradingBreakdown ?? []).map(c => ({
    ...c,
    id: c.id === 'auto' || !c.id ? generateId() : c.id,
  }))

  return {
    examDates: data.examDates ?? [],
    assignmentDates: data.assignmentDates ?? [],
    weeklyTopics: data.weeklyTopics ?? [],
    gradingBreakdown,
    rawText: rawText.slice(0, MAX_SYLLABUS_CHARS),  // Store trimmed (no truncation marker)
    parseConfidence: data.parseConfidence ?? 'low',
  }
}
