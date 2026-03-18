/**
 * Gap Report utilities for Exam Review (Phase 7)
 * Generates weak-concept analysis, AI summaries, and FSRS boosts.
 */

import type { ExamQuestion, GapReport, SRCard } from '../types'
import { callAI, aiCallWithGuards } from './ai'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/**
 * Compute a GapReport from a list of exam questions (sync).
 * Partial answers contribute half-weight to pointsLost.
 * Priority: score = wrongCount * 2 + pointsLost; ≥10=high, ≥4=medium, else low
 */
export function generateGapReport(
  questions: ExamQuestion[],
  _examTitle: string,
  _courseName: string
): GapReport {
  const wrongQuestions = questions.filter(
    q => q.status === 'incorrect' || q.status === 'partial'
  )

  if (wrongQuestions.length === 0) {
    return { weakConcepts: [], summary: null, flashcardsGenerated: false }
  }

  // Group by conceptTag
  const conceptMap = new Map<string, { wrongCount: number; pointsLost: number }>()
  for (const q of wrongQuestions) {
    const tag = q.conceptTag || 'Uncategorized'
    const existing = conceptMap.get(tag) ?? { wrongCount: 0, pointsLost: 0 }
    const effectiveLoss =
      q.status === 'partial'
        ? (q.pointsPossible - q.pointsEarned) * 0.5
        : q.pointsPossible - q.pointsEarned
    conceptMap.set(tag, {
      wrongCount: existing.wrongCount + 1,
      pointsLost: existing.pointsLost + effectiveLoss,
    })
  }

  const weakConcepts = Array.from(conceptMap.entries())
    .map(([concept, stats]) => {
      const score = stats.wrongCount * 2 + stats.pointsLost
      return {
        concept,
        wrongCount: stats.wrongCount,
        pointsLost: stats.pointsLost,
        priority: (
          score >= 10 ? 'high' : score >= 4 ? 'medium' : 'low'
        ) as 'high' | 'medium' | 'low',
      }
    })
    .sort(
      (a, b) =>
        b.wrongCount * 2 + b.pointsLost - (a.wrongCount * 2 + a.pointsLost)
    )

  return { weakConcepts, summary: null, flashcardsGenerated: false }
}

/**
 * Generate an AI narrative summary for a gap report (async, optional).
 * Returns null on failure — callers must handle gracefully.
 */
export async function generateGapSummary(
  weakConcepts: GapReport['weakConcepts'],
  examTitle: string,
  courseName: string
): Promise<string | null> {
  if (weakConcepts.length === 0) return null

  const wrongList = weakConcepts
    .slice(0, 5)
    .map(
      c =>
        `- "${c.concept}" (wrong ${c.wrongCount}x, lost ${c.pointsLost.toFixed(1)} pts)`
    )
    .join('\n')

  const prompt = `System: You are a study coach. Be direct and specific. Return plain text, 2-3 sentences max.

User: A student got these wrong on ${examTitle} (${courseName}):
${wrongList}

Identify the specific root conceptual gap(s) — not just the surface topic.
Example good: "You're confusing meiosis I vs II steps — specifically when homologs separate vs chromatids."
Example bad: "You need to study cell division more."
Be direct. Max 3 sentences.`

  try {
    const text = await aiCallWithGuards(() =>
      callAI([{ role: 'user', content: prompt }], { maxTokens: 100 })
    )
    return text.trim() || null
  } catch {
    return null // AI summary is optional — silently fail
  }
}

/**
 * Boost FSRS cards for gap concepts.
 * - Existing cards: set to high difficulty + learning state (forces relearning).
 * - New concepts: creates a new SRCard.
 * Errors per concept are caught so other concepts still get boosted.
 */
export async function boostGapCardsInFSRS(
  weakConcepts: GapReport['weakConcepts'],
  courseId: string,
  existingSRCards: SRCard[],
  saveCard: (card: SRCard) => Promise<void>,
  reviewCard: (card: SRCard, grade: number) => Promise<void>
): Promise<void> {
  for (const gap of weakConcepts) {
    try {
      const existing = existingSRCards.find(
        c => c.subject === courseId && c.subtopic === gap.concept
      )
      if (existing) {
        await reviewCard(existing, 1) // grade 1 = Again → forces relearning
      } else {
        const newCard: SRCard = {
          key: generateId(),
          subject: courseId,
          subtopic: gap.concept,
          S: 0.1,
          D: 8, // high difficulty
          reps: 0,
          lapses: 0,
          state: 'learning',
          lastReview: new Date().toISOString(),
          nextReview: new Date().toISOString(),
          elapsedDays: 0,
          scheduledDays: 1,
          history: [],
        }
        await saveCard(newCard)
      }
    } catch (err) {
      console.error(`[gapReport] Failed to boost card for ${gap.concept}:`, err)
      // Continue with remaining concepts — don't abort
    }
  }
}
