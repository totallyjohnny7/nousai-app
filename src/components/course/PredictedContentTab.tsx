import { useState } from 'react'
import { Sparkles, X, BookOpen } from 'lucide-react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import { predictExamTopics } from '../../utils/examPredictor'
import type { PredictedTopic, PredictionResult } from '../../utils/examPredictor'
import type { Course } from '../../types'

const CONFIDENCE_STYLE: Record<PredictedTopic['confidence'], { bg: string; color: string; label: string }> = {
  high: { bg: 'rgba(34,197,94,0.12)', color: 'var(--green)', label: 'High' },
  medium: { bg: 'rgba(245,166,35,0.12)', color: 'var(--yellow)', label: 'Medium' },
  low: { bg: 'rgba(156,163,175,0.12)', color: 'var(--text-muted)', label: 'Low' },
}

export default function PredictedContentTab({ course, accentColor: _accentColor }: { course: Course; accentColor: string }) {
  const { data } = useStore()
  const courseSpaces = data?.pluginData?.courseSpaces ?? undefined
  const space = getCourseSpace(courseSpaces, course.id)

  const [result, setResult] = useState<PredictionResult | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const hasSyllabus = (space.syllabus?.weeklyTopics?.length ?? 0) > 0
  const hasExam = space.calendarEvents.some(e => {
    if (e.type !== 'exam') return false
    const n = new Date()
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
    return e.date >= today
  })

  async function generate() {
    setStatus('loading')
    setErrorMsg(null)
    setResult(null)
    try {
      const prediction = await predictExamTopics(space.calendarEvents, space.syllabus, course.name)
      if (!prediction) {
        setStatus('error')
        setErrorMsg('No predictions generated. Make sure you have a syllabus and upcoming exam date set.')
        return
      }
      setResult(prediction)
      setStatus('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setStatus('error')
      if (msg === 'OFFLINE') setErrorMsg("You're offline — predictions require an internet connection.")
      else if (msg === 'TIMEOUT') setErrorMsg('Request timed out. Check your connection and try again.')
      else setErrorMsg('Prediction failed. Check your AI API key in Settings.')
    }
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Predicted Exam Content</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            AI analyzes your syllabus to predict the most likely exam topics.
          </p>
        </div>
      </div>

      {/* Prerequisites */}
      {!hasSyllabus && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, borderLeft: '3px solid var(--yellow)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={16} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Upload a syllabus first — the AI needs weekly topics to make predictions.
          </span>
        </div>
      )}
      {hasSyllabus && !hasExam && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, borderLeft: '3px solid var(--yellow)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <BookOpen size={16} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Set an exam date in the Syllabus tab to enable predictions.
          </span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && errorMsg && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => { setStatus('idle'); setErrorMsg(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 0 }} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Generate button */}
      {(status === 'idle' || status === 'error') && (
        <button
          className="btn btn-primary"
          onClick={generate}
          disabled={!hasSyllabus || !hasExam}
          aria-label="Generate exam predictions"
          style={{ marginBottom: 16 }}
        >
          <Sparkles size={15} /> Predict Exam Topics
        </button>
      )}

      {/* Loading */}
      {status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--text-muted)', fontSize: 14 }}>
          <Sparkles size={16} style={{ color: 'var(--color-accent)', animation: 'pulse 1.4s infinite' }} />
          Analyzing your syllabus…
        </div>
      )}

      {/* Results */}
      {status === 'done' && result && (
        <div>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            Predictions for <strong style={{ color: 'var(--text-primary)' }}>{result.examTitle}</strong> on {result.examDate}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {result.predictedTopics.map((pt, i) => {
              const cs = CONFIDENCE_STYLE[pt.confidence] ?? CONFIDENCE_STYLE.low
              return (
                <li key={i} className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{pt.topic}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)', background: cs.bg, color: cs.color,
                    }}>
                      {cs.label}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{pt.reason}</p>
                </li>
              )
            })}
          </ul>
          <button
            className="btn btn-secondary"
            onClick={generate}
            style={{ marginTop: 14 }}
            aria-label="Regenerate predictions"
          >
            <Sparkles size={14} /> Regenerate
          </button>
        </div>
      )}
    </div>
  )
}
