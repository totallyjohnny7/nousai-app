import type { GpaCourse, GpaResult } from '../types'

/** Standard 4.0 scale conversion from percentage score */
function percentToGradePoints(score: number): { letter: string; points: number } {
  if (score >= 93) return { letter: 'A',  points: 4.0 }
  if (score >= 90) return { letter: 'A-', points: 3.7 }
  if (score >= 87) return { letter: 'B+', points: 3.3 }
  if (score >= 83) return { letter: 'B',  points: 3.0 }
  if (score >= 80) return { letter: 'B-', points: 2.7 }
  if (score >= 77) return { letter: 'C+', points: 2.3 }
  if (score >= 73) return { letter: 'C',  points: 2.0 }
  if (score >= 70) return { letter: 'C-', points: 1.7 }
  if (score >= 67) return { letter: 'D+', points: 1.3 }
  if (score >= 63) return { letter: 'D',  points: 1.0 }
  if (score >= 60) return { letter: 'D-', points: 0.7 }
  return { letter: 'F', points: 0.0 }
}

export function calculateGpa(courses: GpaCourse[]): GpaResult {
  const valid = courses.filter(c => c.creditHours > 0)

  const mapped = valid.map(c => {
    const { letter, points } = percentToGradePoints(c.currentScore)
    return {
      name: c.name,
      score: c.currentScore,
      letterGrade: letter,
      gradePoints: points,
      creditHours: c.creditHours,
    }
  })

  const totalCredits = mapped.reduce((s, c) => s + c.creditHours, 0)
  const weightedPoints = mapped.reduce((s, c) => s + c.gradePoints * c.creditHours, 0)
  const semesterGpa = totalCredits > 0 ? weightedPoints / totalCredits : 0

  // Unweighted: simple average of grade points
  const unweightedGpa = mapped.length > 0
    ? mapped.reduce((s, c) => s + c.gradePoints, 0) / mapped.length
    : 0

  return {
    semesterGpa: Math.round(semesterGpa * 100) / 100,
    unweightedGpa: Math.round(unweightedGpa * 100) / 100,
    courses: mapped,
  }
}
