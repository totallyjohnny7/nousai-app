/**
 * QuizResults — Session summary with score breakdown
 */
import React, { useMemo } from 'react'
import type { JpQuizSession, JpQuizQuestion, JpQuizAnswer } from './types'
import { PRESET_INFO } from './types'
import { exportQuizLogAsJSON } from '../../utils/quizLog'
import type { QuizLogEntry } from '../../utils/quizLog'

interface Props {
  session: JpQuizSession
  questions: JpQuizQuestion[]
  subject?: string
  onNewQuiz: () => void
  onReview: () => void
}

export default function QuizResults({ session, questions, subject, onNewQuiz, onReview }: Props) {
  const stats = useMemo(() => {
    const answers = session.answers
    const total = answers.length
    if (total === 0) return { avg: 0, total: 0, perfect: 0, good: 0, partial: 0, wrong: 0, totalTime: 0 }

    const avg = Math.round(answers.reduce((s, a) => s + a.aiScore, 0) / total)
    const perfect = answers.filter(a => a.aiScore >= 95).length
    const good = answers.filter(a => a.aiScore >= 80 && a.aiScore < 95).length
    const partial = answers.filter(a => a.aiScore >= 50 && a.aiScore < 80).length
    const wrong = answers.filter(a => a.aiScore < 50).length
    const totalTime = answers.reduce((s, a) => s + a.timeMs, 0)

    return { avg, total, perfect, good, partial, wrong, totalTime }
  }, [session.answers])

  const formatTime = (ms: number) => {
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    return `${m}m ${s % 60}s`
  }

  const getGrade = (avg: number) => {
    if (avg >= 90) return { emoji: '🏆', label: 'Excellent!', color: '#2ecc71' }
    if (avg >= 80) return { emoji: '🎉', label: 'Great job!', color: '#27ae60' }
    if (avg >= 70) return { emoji: '👍', label: 'Good effort!', color: '#f39c12' }
    if (avg >= 50) return { emoji: '📚', label: 'Keep practicing!', color: '#e67e22' }
    return { emoji: '💪', label: 'Don\'t give up!', color: '#e74c3c' }
  }

  const grade = getGrade(stats.avg)
  const hasWrongAnswers = session.answers.some(a => a.aiScore < 80)

  const qMap = useMemo(() => {
    const m = new Map<string, JpQuizQuestion>()
    for (const q of questions) m.set(q.id, q)
    return m
  }, [questions])

  const handleSaveLog = () => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    const entry: QuizLogEntry = {
      id: `${dateStr}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now.toISOString(),
      subject: subject || 'General',
      name: session.preset,
      score: stats.avg,
      correct: stats.perfect + stats.good,
      total: stats.total,
      answers: session.answers.map(a => {
        const q = qMap.get(a.questionId)
        return {
          question: q?.questionText || '',
          userAnswer: a.userAnswer,
          correctAnswer: q?.expectedAnswer || '',
          correct: a.aiScore >= 80,
          timeMs: a.timeMs,
        }
      }),
    }
    exportQuizLogAsJSON(entry)
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Score header */}
      <div style={{
        textAlign: 'center', padding: '28px 20px',
        background: 'var(--bg-secondary)', borderRadius: 16,
        border: `2px solid ${grade.color}`,
        marginBottom: 20,
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{grade.emoji}</div>
        <div style={{ fontSize: 42, fontWeight: 800, color: grade.color, marginBottom: 4 }}>
          {stats.avg}%
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {grade.label}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {PRESET_INFO[session.preset]?.icon} {PRESET_INFO[session.preset]?.label} · {stats.total} questions · {formatTime(stats.totalTime)}
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Perfect', count: stats.perfect, color: '#2ecc71', icon: '✅' },
          { label: 'Good', count: stats.good, color: '#27ae60', icon: '👍' },
          { label: 'Partial', count: stats.partial, color: '#f39c12', icon: '⚠️' },
          { label: 'Wrong', count: stats.wrong, color: '#e74c3c', icon: '❌' },
        ].map(s => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '12px 8px',
            background: 'var(--bg-secondary)', borderRadius: 10,
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Answer breakdown */}
      <h4 style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
        margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5,
      }}>
        Answer Breakdown
      </h4>
      <div style={{ marginBottom: 20 }}>
        {session.answers.map((a, i) => {
          const q = qMap.get(a.questionId)
          const scoreColor = a.aiScore >= 80 ? '#2ecc71' : a.aiScore >= 50 ? '#f39c12' : '#e74c3c'
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 10,
              marginBottom: 6,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>
                {a.aiScore >= 80 ? '✅' : a.aiScore >= 50 ? '⚠️' : '❌'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q?.questionText || `Q${i + 1}`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  You: {a.userAnswer} → Expected: {q?.expectedAnswer}
                </div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 700, color: scoreColor, flexShrink: 0 }}>
                {a.aiScore}%
              </span>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={handleSaveLog} style={{
          flex: 1, padding: '12px 16px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)', borderRadius: 10,
          color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          💾 Save Log
        </button>
        {hasWrongAnswers && (
          <button onClick={onReview} style={{
            flex: 1, padding: '12px 16px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)', borderRadius: 10,
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            🔄 Review Mistakes
          </button>
        )}
        <button onClick={onNewQuiz} style={{
          flex: 1, padding: '12px 16px',
          background: 'var(--accent-color, #6C5CE7)',
          border: 'none', borderRadius: 10,
          color: '#fff', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          🏠 Back to Menu
        </button>
      </div>
    </div>
  )
}
