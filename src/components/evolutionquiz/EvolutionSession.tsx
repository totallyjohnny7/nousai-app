/**
 * EvolutionSession — Active Evolution quiz session.
 * Handles MCQ and free-response/scenario questions,
 * timer for timed mode, AI grading, and skip.
 * Shows heading badge on each question card.
 */
import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { ChevronRight, SkipForward, X, Clock } from 'lucide-react'
import type { EvolSession, EvolQuestion, EvolAnswer } from './types'
import { TOPIC_LABELS, TOPIC_COLORS, HEADING_LABELS } from './types'
import { callAI, isAIConfigured } from '../../utils/ai'
import { formatTime } from '../../utils/formatTime'

interface Props {
  session: EvolSession
  questions: EvolQuestion[]
  onFinish: (completed: EvolSession) => void
  onQuit: () => void
}

const TIMED_DURATION_MS = 10 * 60 * 1000 // 10 minutes

export default function EvolutionSession({ session, questions, onFinish, onQuit }: Props) {
  const qMap = useMemo(() => {
    const m = new Map<string, EvolQuestion>()
    for (const q of questions) m.set(q.id, q)
    return m
  }, [questions])

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers]           = useState<Record<string, EvolAnswer>>(session.answers ?? {})
  const [userInput, setUserInput]       = useState('')
  const [grading, setGrading]           = useState(false)
  const [gradingFeedback, setGradingFeedback] = useState<{ score: number; feedback: string } | null>(null)
  const [timeLeft, setTimeLeft]         = useState(TIMED_DURATION_MS)
  const [questionStartMs, setQuestionStartMs] = useState(Date.now())

  const isTimed = session.mode === 'timed'
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef(Date.now())

  const currentId = session.questionIds[currentIndex]
  const currentQ  = currentId ? qMap.get(currentId) : undefined

  const handleFinish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    const completed: EvolSession = {
      ...session,
      answers,
      finishedAt: new Date().toISOString(),
    }
    onFinish(completed)
  }, [session, answers, onFinish])

  const handleFinishRef = useRef(handleFinish)
  useEffect(() => {
    handleFinishRef.current = handleFinish
  }, [handleFinish])

  // ─── Timer for timed mode ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimed) return
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = TIMED_DURATION_MS - elapsed
      setTimeLeft(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        handleFinishRef.current()
      }
    }, 500)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimed])

  const goNext = useCallback(() => {
    if (currentIndex < session.questionIds.length - 1) {
      setCurrentIndex(i => i + 1)
      setUserInput('')
      setGradingFeedback(null)
      setQuestionStartMs(Date.now())
    } else {
      handleFinish()
    }
  }, [currentIndex, session.questionIds.length, handleFinish])

  const handleSkip = useCallback(() => {
    if (!currentId) return
    const elapsed = Date.now() - questionStartMs
    setAnswers(prev => ({
      ...prev,
      [currentId]: {
        questionId: currentId,
        userAnswer: '',
        correct: false,
        score: 0,
        gradingStatus: 'skipped',
        timeMs: elapsed,
      },
    }))
    goNext()
  }, [currentId, questionStartMs, goNext])

  const handleMcqSelect = useCallback(async (index: number, optionText: string) => {
    if (!currentQ || !currentId) return
    const elapsed = Date.now() - questionStartMs
    const correct = index === (currentQ.correctIndex ?? 0)
    const score = correct ? 100 : 0
    const correctOptionText = currentQ.options?.[currentQ.correctIndex ?? 0] ?? ''
    const feedback = correct
      ? 'Correct!'
      : `Incorrect. The correct answer is: ${correctOptionText}. ${currentQ.expectedAnswer}`
    const answer: EvolAnswer = {
      questionId: currentId,
      userAnswer: optionText,
      correct,
      score,
      feedback,
      gradingStatus: 'graded',
      timeMs: elapsed,
    }
    setAnswers(prev => ({ ...prev, [currentId]: answer }))
    setGradingFeedback({ score, feedback })

    window.dispatchEvent(new CustomEvent('evol-grade-resolved', {
      detail: { questionId: currentId, score, feedback },
    }))
  }, [currentQ, currentId, questionStartMs])

  const handleFreeResponseSubmit = useCallback(async () => {
    if (!currentQ || !currentId || !userInput.trim()) return
    const elapsed = Date.now() - questionStartMs
    setGrading(true)
    setGradingFeedback(null)

    try {
      if (isAIConfigured()) {
        const prompt = `You are an evolution biology exam grader. Grade this student answer.

Question: ${currentQ.questionText}
Expected Answer: ${currentQ.expectedAnswer}
Student Answer: ${userInput}

Respond with ONLY a JSON object: {"score": <0-100>, "feedback": "<1-2 sentence feedback>"}`

        const result = await callAI([
          { role: 'user', content: prompt },
        ], { temperature: 0.2 })

        const parsed = JSON.parse(result) as { score: number; feedback: string }
        const answer: EvolAnswer = {
          questionId: currentId,
          userAnswer: userInput,
          correct: parsed.score >= 70,
          score: parsed.score,
          feedback: parsed.feedback,
          gradingStatus: 'graded',
          timeMs: elapsed,
        }
        setAnswers(prev => ({ ...prev, [currentId]: answer }))
        setGradingFeedback({ score: parsed.score, feedback: parsed.feedback })
        window.dispatchEvent(new CustomEvent('evol-grade-resolved', {
          detail: { questionId: currentId, score: parsed.score, feedback: parsed.feedback },
        }))
      } else {
        const answer: EvolAnswer = {
          questionId: currentId,
          userAnswer: userInput,
          correct: false,
          score: 0,
          gradingStatus: 'pending',
          timeMs: elapsed,
        }
        setAnswers(prev => ({ ...prev, [currentId]: answer }))
        setGradingFeedback({ score: 0, feedback: 'No AI configured — answer saved for manual review.' })
      }
    } catch {
      const answer: EvolAnswer = {
        questionId: currentId,
        userAnswer: userInput,
        correct: false,
        score: 0,
        gradingStatus: 'skipped',
        timeMs: elapsed,
      }
      setAnswers(prev => ({ ...prev, [currentId]: answer }))
      setGradingFeedback({ score: 0, feedback: 'Grading failed.' })
      window.dispatchEvent(new CustomEvent('evol-grade-failed', {
        detail: { questionId: currentId },
      }))
    } finally {
      setGrading(false)
    }
  }, [currentQ, currentId, userInput, questionStartMs])

  if (!currentQ) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ color: 'var(--text-muted)' }}>No questions available.</p>
        <button onClick={onQuit} style={{ marginTop: 16, padding: '10px 20px', background: '#F5A623', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
          Back to Menu
        </button>
      </div>
    )
  }

  const progress    = (currentIndex + 1) / session.questionIds.length
  const alreadyAnswered = !!answers[currentId]
  const currentAnswer   = answers[currentId]

  function scoreColor(score: number) {
    if (score >= 70) return '#22c55e'
    if (score >= 50) return '#f59e0b'
    return '#ef4444'
  }

  const headingColor = currentQ.heading === 'exam-traps' ? '#ef4444'
    : currentQ.heading === 'apply-it' ? '#a78bfa'
    : 'var(--text-muted)'

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onQuit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
          <X size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {currentIndex + 1} / {session.questionIds.length}
            </span>
            {isTimed && (
              <span style={{
                fontSize: 14, fontWeight: 700, fontFamily: 'DM Mono, monospace',
                color: timeLeft < 60000 ? '#ef4444' : 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Clock size={14} />
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
          <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress * 100}%`,
              background: 'var(--accent-color, #F5A623)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      </div>

      {/* ── Question card ── */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 14, padding: '20px 22px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: `${TOPIC_COLORS[currentQ.topic]}22`,
            color: TOPIC_COLORS[currentQ.topic],
            border: `1px solid ${TOPIC_COLORS[currentQ.topic]}`,
          }}>
            {TOPIC_LABELS[currentQ.topic]}
          </span>
          {/* Heading badge */}
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: `${headingColor}22`,
            color: headingColor,
            border: `1px solid ${headingColor}`,
            fontWeight: 600,
          }}>
            {HEADING_LABELS[currentQ.heading]}
          </span>
          <span style={{
            fontSize: 11, padding: '3px 8px', borderRadius: 6,
            background: 'var(--bg-primary)', color: 'var(--text-muted)',
            border: '1px solid var(--border-color)',
          }}>
            {'★'.repeat(currentQ.difficulty)}
          </span>
        </div>

        <p style={{
          fontSize: 15, fontWeight: 500, color: 'var(--text-primary)',
          lineHeight: 1.6, margin: '0 0 18px', whiteSpace: 'pre-wrap',
        }}>
          {currentQ.questionText}
        </p>

        {/* MCQ options */}
        {currentQ.questionType === 'mcq' && currentQ.options && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {currentQ.options.map((opt, i) => {
              const LABELS = ['A', 'B', 'C', 'D']
              const isSelected = currentAnswer?.userAnswer === opt
              const isCorrect  = alreadyAnswered && i === (currentQ.correctIndex ?? 0)
              const isWrong    = alreadyAnswered && isSelected && !isCorrect

              let bg = 'var(--bg-primary)'
              let border = 'var(--border-color)'
              let color = 'var(--text-primary)'

              if (isCorrect) { bg = '#22c55e22'; border = '#22c55e'; color = '#22c55e' }
              else if (isWrong) { bg = '#ef444422'; border = '#ef4444'; color = '#ef4444' }
              else if (isSelected) { bg = '#F5A62322'; border = '#F5A623' }

              return (
                <button
                  key={i}
                  disabled={alreadyAnswered}
                  onClick={() => handleMcqSelect(i, opt)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 10,
                    background: bg, border: `2px solid ${border}`,
                    cursor: alreadyAnswered ? 'default' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'border-color 0.15s, background 0.15s',
                    color,
                  }}
                >
                  <span style={{
                    width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                    background: isSelected || isCorrect ? border : 'var(--border-color)',
                    color: isSelected || isCorrect ? '#fff' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {LABELS[i]}
                  </span>
                  <span style={{ fontSize: 14 }}>{opt}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Free response / scenario */}
        {currentQ.questionType !== 'mcq' && !alreadyAnswered && (
          <div>
            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              rows={5}
              placeholder="Type your answer here…"
              style={{
                width: '100%', padding: '10px 12px', boxSizing: 'border-box',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 8, color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'inherit', resize: 'vertical',
              }}
            />
            <button
              onClick={handleFreeResponseSubmit}
              disabled={grading || !userInput.trim()}
              style={{
                marginTop: 10, width: '100%', padding: '11px',
                background: 'var(--accent-color, #F5A623)', color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, cursor: grading || !userInput.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', opacity: grading ? 0.7 : 1,
              }}
            >
              {grading ? 'Grading…' : 'Submit Answer'}
            </button>
          </div>
        )}
      </div>

      {/* ── Feedback ── */}
      {(gradingFeedback || (alreadyAnswered && currentAnswer)) && (() => {
        const fb = gradingFeedback ?? (currentAnswer ? { score: currentAnswer.score, feedback: currentAnswer.feedback ?? '' } : null)
        if (!fb) return null
        return (
          <div style={{
            padding: '14px 16px', borderRadius: 12, marginBottom: 16,
            background: fb.score >= 70 ? '#22c55e18' : '#ef444418',
            border: `1px solid ${fb.score >= 70 ? '#22c55e' : '#ef4444'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{
                fontSize: 22, fontWeight: 800, fontFamily: 'DM Mono, monospace',
                color: scoreColor(fb.score),
              }}>
                {currentAnswer?.gradingStatus === 'pending' ? '…' : `${fb.score}%`}
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>
                {fb.score >= 70 ? 'Correct!' : fb.score >= 50 ? 'Partially correct' : 'Incorrect'}
              </span>
            </div>
            {fb.feedback && (
              <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.55 }}>
                {fb.feedback}
              </p>
            )}
            {currentAnswer?.gradingStatus === 'graded' && currentAnswer.score < 100 && currentQ.expectedAnswer && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Model Answer
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                  {currentQ.expectedAnswer}
                </p>
              </div>
            )}
          </div>
        )
      })()}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', gap: 10 }}>
        {!alreadyAnswered && currentQ.questionType === 'mcq' && (
          <button
            onClick={handleSkip}
            style={{
              padding: '11px 16px', background: 'var(--bg-secondary)',
              color: 'var(--text-muted)', border: '1px solid var(--border-color)',
              borderRadius: 10, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <SkipForward size={15} /> Skip
          </button>
        )}
        {alreadyAnswered && (
          <button
            onClick={goNext}
            style={{
              flex: 1, padding: '12px 16px',
              background: 'var(--accent-color, #F5A623)', color: '#fff',
              border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {currentIndex < session.questionIds.length - 1 ? 'Next Question' : 'See Results'}
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
