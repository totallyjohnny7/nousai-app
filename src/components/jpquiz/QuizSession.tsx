/**
 * QuizSession — Active quiz: shows questions, collects answers, AI-rates
 * Two-tier scoring: instant local checkAnswer() → async AI streaming
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import type { JpQuizSession, JpQuizQuestion, JpQuizAnswer, JpQuizPreset } from './types'
import { PRESET_INFO } from './types'
import { callAI } from '../../utils/ai'
import { speak, stopSpeaking } from '../../utils/speechTools'
import AnswerInput from './AnswerInput'
import StudyFloatingRail from '../StudyFloatingRail'
import StudyAnnotationSidecar from '../StudyAnnotationSidecar'
import { useSessionStore } from '../../store/sessionStore'

interface Props {
  session: JpQuizSession
  questions: JpQuizQuestion[]
  onFinish: (session: JpQuizSession) => void
  onQuit: () => void
  subject?: string
}

type Phase = 'answering' | 'grading' | 'result'

export default function QuizSession({ session: initialSession, questions, onFinish, onQuit, subject = 'Japanese' }: Props) {
  const [session, setSession] = useState(initialSession)
  const [phase, setPhase] = useState<Phase>('answering')
  const [currentAnswer, setCurrentAnswer] = useState<JpQuizAnswer | null>(null)
  const [aiStreaming, setAiStreaming] = useState('')
  const [showSidecar, setShowSidecar] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const startTimeRef = useRef(Date.now())
  const streamRef = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopSpeaking()
    }
  }, [])

  // Reset timer on new question
  useEffect(() => {
    startTimeRef.current = Date.now()
    setShowHint(false)
    setCurrentAnswer(null)
    setAiStreaming('')
    setPhase('answering')
  }, [session.currentIndex])

  const currentQ = useMemo(() => {
    const qId = session.questionIds[session.currentIndex]
    return questions.find(q => q.id === qId) || null
  }, [session.currentIndex, session.questionIds, questions])

  // TTS for oral/final modes
  useEffect(() => {
    if (!currentQ) return
    if (session.preset === 'oral' || session.preset === 'final') {
      speak(currentQ.questionText, { voiceLang: 'ja-JP' })
    }
    return () => stopSpeaking()
  }, [currentQ, session.preset])

  // Determine input mode based on preset + question
  const inputMode = useMemo((): 'typed' | 'spoken' | 'both' => {
    if (!currentQ) return 'typed'
    if (session.preset === 'written') return 'typed'
    if (session.preset === 'oral') return 'spoken'
    if (session.preset === 'final') return currentQ.answerType
    // free mode
    return 'both'
  }, [session.preset, currentQ])

  // Local fuzzy check
  const localCheck = useCallback((userAnswer: string, q: JpQuizQuestion): boolean => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[\s。、！？!?,.\-]/g, '')
    const norm = normalize(userAnswer)
    if (norm === normalize(q.expectedAnswer)) return true
    if (q.acceptableAnswers?.some(a => norm === normalize(a))) return true
    return false
  }, [])

  // Submit answer
  const handleSubmit = useCallback(async (userAnswer: string, method: 'typed' | 'spoken') => {
    if (!currentQ) return
    const timeMs = Date.now() - startTimeRef.current
    const exact = localCheck(userAnswer, currentQ)

    if (exact) {
      // Perfect match — instant score
      const answer: JpQuizAnswer = {
        questionId: currentQ.id,
        userAnswer,
        inputMethod: method,
        exactMatch: true,
        aiScore: 100,
        aiFeedback: 'Perfect match! ✅',
        timeMs,
      }
      setCurrentAnswer(answer)
      setPhase('result')
      return
    }

    // Not exact → AI grading
    setPhase('grading')
    streamRef.current = ''
    setAiStreaming('')

    const messages: any[] = [
      {
        role: 'system',
        content: `You are a Japanese language quiz grader. Grade the student's answer.
Return a JSON object with exactly: { "score": <0-100>, "feedback": "<brief feedback in English>" }
Scoring guide:
- 100: Perfect or semantically identical answer
- 80-99: Minor errors (typo, particle, extra politeness)
- 50-79: Partially correct, key meaning conveyed
- 20-49: Some relevant content but significant errors
- 0-19: Incorrect or irrelevant
Be encouraging but honest. Keep feedback under 2 sentences.`,
      },
    ]

    // Build user message with optional image
    const userContent: any[] = []
    if (currentQ.questionImageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${currentQ.questionImageMime || 'image/jpeg'};base64,${currentQ.questionImageBase64}` },
      })
    }
    userContent.push({
      type: 'text',
      text: `Question: ${currentQ.questionText}\nExpected answer: ${currentQ.expectedAnswer}${currentQ.acceptableAnswers?.length ? '\nAlso acceptable: ' + currentQ.acceptableAnswers.join(', ') : ''}\nStudent answered: ${userAnswer}\n\nGrade this answer as JSON.`,
    })
    messages.push({ role: 'user', content: userContent })

    try {
      const result = await callAI(messages, {
        temperature: 0.3,
        maxTokens: 200,
        onChunk: (chunk) => {
          if (!mountedRef.current) return
          streamRef.current += chunk
          setAiStreaming(streamRef.current)
        },
      }, 'japanese')

      if (!mountedRef.current) return

      // Parse AI response
      let score = 50
      let feedback = result
      try {
        const jsonMatch = result.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          score = Math.max(0, Math.min(100, Number(parsed.score) || 50))
          feedback = parsed.feedback || result
        }
      } catch { /* use raw */ }

      const answer: JpQuizAnswer = {
        questionId: currentQ.id,
        userAnswer,
        inputMethod: method,
        exactMatch: false,
        aiScore: score,
        aiFeedback: feedback,
        timeMs,
      }
      setCurrentAnswer(answer)
      setPhase('result')
    } catch (e) {
      console.error('AI grading failed:', e)
      // Fallback score
      const answer: JpQuizAnswer = {
        questionId: currentQ.id,
        userAnswer,
        inputMethod: method,
        exactMatch: false,
        aiScore: 50,
        aiFeedback: 'Could not grade automatically. Review your answer.',
        timeMs,
      }
      setCurrentAnswer(answer)
      setPhase('result')
    }
  }, [currentQ, localCheck])

  // Next question or finish
  const handleNext = useCallback(() => {
    if (!currentAnswer) return
    const updatedSession = {
      ...session,
      answers: [...session.answers, currentAnswer],
      currentIndex: session.currentIndex + 1,
    }

    if (updatedSession.currentIndex >= session.questionIds.length) {
      updatedSession.finishedAt = new Date().toISOString()
      onFinish(updatedSession)
    } else {
      setSession(updatedSession)
    }
  }, [session, currentAnswer, onFinish])

  if (!currentQ) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No question found.</div>
  }

  const progress = session.currentIndex + 1
  const total = session.questionIds.length
  const scoreColor = currentAnswer
    ? currentAnswer.aiScore >= 80 ? '#2ecc71' : currentAnswer.aiScore >= 50 ? '#f39c12' : '#e74c3c'
    : undefined

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          {PRESET_INFO[session.preset]?.icon} {progress}/{total}
        </div>
        <button onClick={onQuit} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
        }}>
          ✕ Quit
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-color, #6C5CE7)',
          width: `${(progress / total) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Question card */}
      <div style={{
        padding: '20px 18px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 14,
        marginBottom: 16,
      }}>
        {currentQ.questionImageBase64 && (
          <img
            src={`data:${currentQ.questionImageMime || 'image/jpeg'};base64,${currentQ.questionImageBase64}`}
            alt="question"
            style={{ maxWidth: '100%', maxHeight: 250, borderRadius: 10, marginBottom: 12, display: 'block' }}
          />
        )}
        <div style={{
          fontSize: 18, fontWeight: 500, lineHeight: 1.6,
          fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
        }}>
          {currentQ.questionText}
        </div>
        {showHint && currentQ.hint && (
          <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            💡 {currentQ.hint}
          </div>
        )}
        {!showHint && currentQ.hint && session.preset === 'free' && phase === 'answering' && (
          <button onClick={() => setShowHint(true)} style={{
            marginTop: 10, background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}>
            💡 Show Hint
          </button>
        )}
      </div>

      {/* Answer phase */}
      {phase === 'answering' && (
        <AnswerInput mode={inputMode} onSubmit={handleSubmit} />
      )}

      {/* Grading phase */}
      {phase === 'grading' && (
        <div style={{
          padding: '20px 18px', background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)', borderRadius: 14,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🤔</div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>AI is grading...</div>
          {aiStreaming && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic', maxHeight: 80, overflow: 'hidden' }}>
              {aiStreaming.slice(0, 200)}
            </div>
          )}
        </div>
      )}

      {/* Result phase */}
      {phase === 'result' && currentAnswer && (
        <div style={{
          padding: '20px 18px', background: 'var(--bg-secondary)',
          border: `2px solid ${scoreColor}`,
          borderRadius: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>
              {currentAnswer.aiScore >= 80 ? '✅' : currentAnswer.aiScore >= 50 ? '⚠️' : '❌'}
            </span>
            <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor }}>
              {currentAnswer.aiScore}%
            </span>
          </div>

          <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 8 }}>
            {currentAnswer.aiFeedback}
          </div>

          {currentAnswer.aiScore < 80 && (
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              ❓ {currentQ.questionText}
            </div>
          )}

          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
            Your answer: <strong>{currentAnswer.userAnswer}</strong>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Expected: <strong>{currentQ.expectedAnswer}</strong>
          </div>

          {currentQ.explanation && (
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic',
              padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 12,
            }}>
              📖 {currentQ.explanation}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleNext}
              style={{
                flex: 1, padding: '10px 14px',
                background: 'var(--accent-color, #6C5CE7)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {session.currentIndex + 1 >= session.questionIds.length ? '🏁 Finish' : 'Next ➜'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Rail + Annotation Sidecar */}
      <JpSessionAnnotation
        questionId={currentQ.id}
        questionText={currentQ.questionText}
        subject={subject}
        quizId={session.id}
        showSidecar={showSidecar}
        setShowSidecar={setShowSidecar}
      />
    </div>
  )
}

/* ── Inner component so hooks can depend on questionId ── */
function JpSessionAnnotation({
  questionId, questionText, subject, quizId, showSidecar, setShowSidecar,
}: {
  questionId: string; questionText: string; subject: string; quizId: string;
  showSidecar: boolean; setShowSidecar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { questionMap, sessions } = useSessionStore(s => ({ questionMap: s.questionMap, sessions: s.sessions }))
  const _sid = questionMap[questionId]
  const hasAnnotation = _sid
    ? (sessions[_sid]?.hasCanvas || !!sessions[_sid]?.textContent || (sessions[_sid]?.chatLog.length ?? 0) > 0)
    : false

  // Keyboard shortcut: N to toggle sidecar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'n' || e.key === 'N') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        setShowSidecar(v => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setShowSidecar])

  return (
    <>
      <StudyFloatingRail onToggle={() => setShowSidecar(v => !v)} hasAnnotation={hasAnnotation} isOpen={showSidecar} />
      {showSidecar && (
        <StudyAnnotationSidecar
          questionId={questionId}
          questionText={questionText}
          subject={subject}
          quizId={quizId}
          onClose={() => setShowSidecar(false)}
        />
      )}
    </>
  )
}
