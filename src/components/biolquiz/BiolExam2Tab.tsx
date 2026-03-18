import type { Course } from '../../types'
interface Props { course: Course }
export default function BiolExam2Tab({ course }: Props) {
  return <div style={{ padding: 24, color: 'var(--text-muted)' }}>BIOL 3020 Exam 2 Practicum — Coming soon for {course.name}</div>
}
