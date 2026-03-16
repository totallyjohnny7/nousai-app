import { useState } from 'react'
import { useStore } from '../../store'
import { calculateGpa } from '../../utils/canvasGpa'
import type { GpaCourse } from '../../types'

const DEFAULT_CREDITS = 3

function gpaColor(gpa: number): string {
  if (gpa >= 3.7) return 'var(--green, #22c55e)'
  if (gpa >= 3.0) return '#eab308'
  if (gpa >= 2.0) return '#f97316'
  return 'var(--red, #ef4444)'
}

export default function GpaWidget() {
  const { data } = useStore()
  const canvasLive = data?.pluginData?.canvasLive
  const liveCourses = canvasLive?.courses ?? []

  const [credits, setCredits] = useState<Record<number, number>>({})

  if (liveCourses.length === 0) return null

  const gpaCourses: GpaCourse[] = liveCourses
    .filter(c => c.currentScore !== null)
    .map(c => ({
      name: c.courseCode || c.name,
      currentScore: c.currentScore!,
      creditHours: credits[c.canvasId] ?? DEFAULT_CREDITS,
    }))

  if (gpaCourses.length === 0) {
    return (
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Sync Canvas to see GPA estimate
        </div>
      </div>
    )
  }

  const result = calculateGpa(gpaCourses)

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: gpaColor(result.semesterGpa), fontFamily: 'var(--font-mono, DM Mono, monospace)' }}>
          {result.semesterGpa.toFixed(2)}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
          Semester GPA (est.)
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textAlign: 'left' }}>
            <th style={{ paddingBottom: 4, fontWeight: 700 }}>Course</th>
            <th style={{ paddingBottom: 4, fontWeight: 700, textAlign: 'right' }}>Score</th>
            <th style={{ paddingBottom: 4, fontWeight: 700, textAlign: 'center' }}>Grade</th>
            <th style={{ paddingBottom: 4, fontWeight: 700, textAlign: 'center' }}>Credits</th>
            <th style={{ paddingBottom: 4, fontWeight: 700, textAlign: 'right' }}>Pts</th>
          </tr>
        </thead>
        <tbody>
          {result.courses.map((c, i) => {
            const lc = liveCourses.find(l => (l.courseCode || l.name) === c.name || l.currentScore === c.score)
            return (
              <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '5px 0', color: 'var(--text-primary)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono, DM Mono, monospace)' }}>
                  {c.score.toFixed(1)}%
                </td>
                <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: gpaColor(c.gradePoints),
                    color: '#000',
                    borderRadius: 3,
                    padding: '1px 5px',
                  }}>
                    {c.letterGrade}
                  </span>
                </td>
                <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={lc ? (credits[lc.canvasId] ?? DEFAULT_CREDITS) : DEFAULT_CREDITS}
                    onClick={e => e.stopPropagation()}
                    onChange={e => {
                      if (!lc) return
                      const val = Math.max(0, Math.min(6, Number(e.target.value)))
                      setCredits(prev => ({ ...prev, [lc.canvasId]: val }))
                    }}
                    style={{
                      width: 38,
                      textAlign: 'center',
                      background: 'var(--bg-hover, rgba(255,255,255,0.06))',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      padding: '2px 4px',
                    }}
                  />
                </td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontWeight: 700, color: gpaColor(c.gradePoints), fontFamily: 'var(--font-mono, DM Mono, monospace)' }}>
                  {c.gradePoints.toFixed(1)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
        Based on current Canvas scores. Adjust credit hours above to refine estimate.
      </div>
    </div>
  )
}
