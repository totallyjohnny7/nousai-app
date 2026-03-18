import type { SRData, ProficiencyData, ProficiencyEntry } from '../types'

export interface WeakSpot {
  courseId: string
  courseName: string
  subtopic: string
  wrongCount: number
  retentionR: number
  priority: 'high' | 'medium' | 'low'
}

export function getWeakSpots(
  srData: SRData | null,
  proficiency: ProficiencyData | null,
  courses: { id: string; name: string }[]
): WeakSpot[] {
  // Group by (courseId, subtopic) — one WeakSpot per unique subtopic per course
  const groupMap = new Map<string, { courseId: string; courseName: string; subtopic: string; minR: number; wrongCount: number }>()

  for (const course of courses) {
    const cards = (srData?.cards ?? []).filter(c => c.subject === course.id && c.state !== 'new')
    for (const card of cards) {
      const daysSince = (Date.now() - new Date(card.lastReview).getTime()) / 86400000
      const R = card.S > 0 ? Math.exp(-daysSince / card.S) : 0
      if (R >= 0.75) continue

      const key = `${course.id}||${card.subtopic}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.minR = Math.min(existing.minR, R)
      } else {
        const subjectMap = proficiency?.subjects?.[course.id]
        const profEntry: ProficiencyEntry | undefined = subjectMap?.[card.subtopic]
        const wrongCount = profEntry
          ? profEntry.attempts.filter(a => a.percentage < 50).length
          : 0
        groupMap.set(key, { courseId: course.id, courseName: course.name, subtopic: card.subtopic, minR: R, wrongCount })
      }
    }
  }

  return Array.from(groupMap.values())
    .map(g => {
      const combined = (1 - g.minR) * 50 + g.wrongCount * 5
      return {
        courseId: g.courseId,
        courseName: g.courseName,
        subtopic: g.subtopic,
        wrongCount: g.wrongCount,
        retentionR: g.minR,
        priority: (combined >= 30 ? 'high' : combined >= 15 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      }
    })
    .sort((a, b) => a.retentionR - b.retentionR)
    .slice(0, 10)
}
