import type { Course } from '../../types'
interface Props { course: Course }
export default function EvolutionExam2Tab({ course }: Props) {
  return <div style={{ padding: 24, color: 'var(--text-muted)' }}>Evolution Exam 2 Practicum — Coming soon for {course.name}</div>
}
