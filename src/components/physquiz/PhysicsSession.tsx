/**
 * PhysicsSession — Active physics quiz session component.
 * Handles: question display, MCQ/free-response/multi-part/step-mode answers,
 * confidence ratings, AI grading with streaming, post-grading feedback,
 * tool panels (calculator, units, diagram, labs), keyboard shortcuts.
 */
import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  lazy,
  Suspense,
  forwardRef,
} from 'react'
import type {
  PhysicsSession,
  PhysicsQuestion,
  PhysicsAnswer,
  ConfidenceRating,
  PhysicsErrorCategory,
  StepAnswer,
} from './types'
import {
  generatePhysicsId,
  todayDateStr,
  ERROR_LABELS,
  ERROR_COLORS,
  TOPIC_LABELS,
} from './types'
import type { Course } from '../../types'
import { callAI, isAIConfigured } from '../../utils/ai'
import type { AIMessage } from '../../utils/ai'
import { enqueue } from '../../utils/physicsGradingQueue'
import MathRenderer from '../../components/MathRenderer'
import PhysicsCalculator from './PhysicsCalculator'
import PhysicsUnitTable from './PhysicsUnitTable'
import type { PhysicsDiagramCanvasHandle } from './PhysicsDiagramCanvas'
import {
  Atom,
  Calculator,
  BookOpen,
  Beaker,
  LayoutGrid,
  ChevronRight,
  X,
  Lightbulb,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  Keyboard,
} from 'lucide-react'

// Lazy load heavy components
const PhysicsDiagramCanvas = lazy(() => import('./PhysicsDiagramCanvas'))

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  session: PhysicsSession
  questions: PhysicsQuestion[]
  course: Course
  onFinish: (completed: PhysicsSession) => void
  onQuit: () => void
  calcActivePanel: 'calc' | 'units' | 'dimcheck' | null
  onCalcPanelChange: (p: 'calc' | 'units' | 'dimcheck' | null) => void
}

type Phase = 'answering' | 'grading' | 'result'

interface GradingResult {
  answerScore: number
  diagramScore?: number
  combinedScore: number
  feedback: string
  whatToFix: string[]
  errorCategories: PhysicsErrorCategory[]
  missingPrerequisites: string[]
}

interface StepState {
  text: string
  graded: boolean
  score: number
  feedback: string
  grading: boolean
}

// ─── Grading system prompt ───────────────────────────────────────────────────

const PHYSICS_GRADING_SYSTEM = `You are a physics exam grader. Return ONLY valid JSON:
{
  "answerScore": <0-100>,
  "diagramScore": <0-100 or null>,
  "combinedScore": <number>,
  "feedback": "<2-3 sentences: what was correct, what was wrong>",
  "whatToFix": ["<specific fix 1>", "<specific fix 2>"],
  "errorCategories": ["<from allowed list>"],
  "missingPrerequisites": ["<prerequisite concepts missing>"]
}
Allowed errorCategories: unit_error, sig_fig_error, wrong_direction, missing_label, incomplete_steps, setup_error, magnitude_error, sign_error, conceptual_error.
combinedScore = 70% answerScore + 30% diagramScore if diagram present, else answerScore.
ALWAYS flag unit_error if numerical answer missing units. ALWAYS flag sig_fig_error if wrong sig figs.
missingPrerequisites: [] if none detected.
Grading: 90-100=correct+right units/sigfigs; 70-89=correct method minor error; 50-69=partial; 20-49=some relevance; 0-19=wrong.`

const GRADING_DEFAULTS: GradingResult = {
  answerScore: 50,
  combinedScore: 50,
  feedback: 'Unable to parse grading response.',
  errorCategories: [],
  whatToFix: [],
  missingPrerequisites: [],
}

// ─── Score color helper ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#eab308'
  return '#ef4444'
}

// ─── Variable popover chip ───────────────────────────────────────────────────

function VariableChip({ symbol, name, unit, definition }: {
  symbol: string; name: string; unit: string; definition?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'inline-block',
          background: '#f59e0b22',
          border: '1px solid #f59e0b55',
          borderRadius: 6,
          padding: '1px 7px',
          fontSize: 13,
          color: '#f59e0b',
          cursor: 'pointer',
          fontFamily: 'DM Mono, monospace',
          margin: '0 2px',
        }}
      >
        {symbol}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '110%',
            left: 0,
            zIndex: 300,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            padding: '10px 14px',
            minWidth: 180,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', fontFamily: 'DM Mono, monospace' }}>
            {symbol}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 2 }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Unit: <strong>{unit}</strong>
          </div>
          {definition && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, maxWidth: 220, whiteSpace: 'normal' }}>
              {definition}
            </div>
          )}
          <button
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', top: 6, right: 8,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 14,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </span>
  )
}

// ─── Question text with inline variable chips ────────────────────────────────

function QuestionTextWithVars({
  text,
  variables,
  scrambledValues,
}: {
  text: string
  variables?: PhysicsQuestion['variables']
  scrambledValues?: Record<string, number>
}) {
  // Substitute scrambled values into text first
  let displayText = text
  if (scrambledValues) {
    Object.entries(scrambledValues).forEach(([sym, val]) => {
      displayText = displayText.replaceAll(`{${sym}}`, String(val))
    })
  }

  if (!variables?.length) {
    return <MathRenderer text={displayText} />
  }

  // Split around variable symbols and insert chips
  const symbols = variables.map(v => v.symbol).sort((a, b) => b.length - a.length)
  const parts: React.ReactNode[] = []
  let remaining = displayText
  let keyIdx = 0

  while (remaining.length > 0) {
    let earliest = -1
    let matchedSym = ''
    for (const sym of symbols) {
      const idx = remaining.indexOf(sym)
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx
        matchedSym = sym
      }
    }

    if (earliest === -1) {
      parts.push(<MathRenderer key={keyIdx++} text={remaining} />)
      break
    }

    if (earliest > 0) {
      parts.push(<MathRenderer key={keyIdx++} text={remaining.slice(0, earliest)} />)
    }
    const vari = variables.find(v => v.symbol === matchedSym)!
    parts.push(
      <VariableChip
        key={keyIdx++}
        symbol={vari.symbol}
        name={vari.name}
        unit={vari.unit}
        definition={vari.definition}
      />
    )
    remaining = remaining.slice(earliest + matchedSym.length)
  }

  return <span>{parts}</span>
}

// ─── Shortcuts modal ─────────────────────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'C', desc: 'Toggle Calculator' },
    { key: 'U', desc: 'Toggle Unit Table' },
    { key: 'D', desc: 'Toggle Diagram' },
    { key: 'L', desc: 'Toggle Labs' },
    { key: 'H', desc: 'Toggle Hint' },
    { key: '→', desc: 'Next question (after grading)' },
    { key: '?', desc: 'Toggle this shortcuts panel' },
    { key: 'Esc', desc: 'Close panels' },
  ]
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 16, padding: '24px 28px', minWidth: 280, maxWidth: 360,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Keyboard Shortcuts</div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}
          >
            ✕
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shortcuts.map(s => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.desc}</span>
              <kbd style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                borderRadius: 5, padding: '2px 8px', fontSize: 12, fontFamily: 'DM Mono, monospace',
                color: 'var(--text-primary)',
              }}>
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Similar problem modal ───────────────────────────────────────────────────

function SimilarProblemModal({
  question,
  abortRef,
  onClose,
}: {
  question: PhysicsQuestion
  abortRef: React.MutableRefObject<AbortController | undefined>
  onClose: () => void
}) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const ctrl = new AbortController()
    abortRef.current = ctrl

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a physics tutor. Generate a similar practice problem based on the question provided. Include: the new problem statement (with LaTeX math where appropriate), hint, and expected answer. Format clearly.',
      },
      {
        role: 'user',
        content: `Generate a similar problem to this one:\n\nQuestion: ${question.questionText}\nTopic: ${TOPIC_LABELS[question.topic]}\nExpected answer: ${question.expectedAnswer}\n\nMake it similar difficulty but with different values.`,
      },
    ]

    callAI(messages, {
      temperature: 0.8,
      maxTokens: 600,
      onChunk: (chunk) => {
        if (!mountedRef.current || ctrl.signal.aborted) return
        streamRef.current += chunk
        setContent(streamRef.current)
      },
    }, 'ocr')
      .then(() => {
        if (mountedRef.current) setLoading(false)
      })
      .catch((err) => {
        if (mountedRef.current && !ctrl.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to generate similar problem.')
          setLoading(false)
        }
      })

    return () => {
      mountedRef.current = false
      ctrl.abort()
    }
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', paddingTop: 60, overflowY: 'auto',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 560,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', margin: '0 16px 40px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Similar Problem
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}
          >
            ✕
          </button>
        </div>
        {error ? (
          <div style={{ color: '#ef4444', fontSize: 13 }}>{error}</div>
        ) : (
          <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
            {content ? (
              <MathRenderer text={content} />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Generating similar problem...</div>
            )}
            {loading && content && (
              <span style={{ display: 'inline-block', width: 8, height: 14, background: '#f59e0b', borderRadius: 2, verticalAlign: 'text-bottom', marginLeft: 2, animation: 'blink 1s steps(1) infinite' }} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function PhysicsSessionComponent({
  session: initialSession,
  questions,
  course,
  onFinish,
  onQuit,
  calcActivePanel,
  onCalcPanelChange,
}: Props) {
  // Session state
  const [session, setSession] = useState<PhysicsSession>(initialSession)
  const [phase, setPhase] = useState<Phase>('answering')

  // Answer state
  const [freeAnswer, setFreeAnswer] = useState('')
  const [mcqChoice, setMcqChoice] = useState<number | null>(null)
  const [partAnswers, setPartAnswers] = useState<Record<string, string>>({})
  const [confidence, setConfidence] = useState<ConfidenceRating | null>(null)

  // Step mode
  const [steps, setSteps] = useState<StepState[]>([{ text: '', graded: false, score: 0, feedback: '', grading: false }])
  const [allStepsGraded, setAllStepsGraded] = useState(false)

  // Grading
  const [gradingStream, setGradingStream] = useState('')
  const [gradingResult, setGradingResult] = useState<GradingResult | null>(null)
  const [gradingStatus, setGradingStatus] = useState<'graded' | 'pending' | 'failed' | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Post-grading extras
  const [feynmanStream, setFeynmanStream] = useState('')
  const [feynmanLoading, setFeynmanLoading] = useState(false)
  const [showSimilar, setShowSimilar] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showVarIndex, setShowVarIndex] = useState<number | null>(null)

  // Panels
  const [diagramOpen, setDiagramOpen] = useState(false)
  const [labsOpen, setLabsOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Mobile
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600)

  // Refs
  const mountedRef = useRef(true)
  const streamRef = useRef('')
  const startTimeRef = useRef(Date.now())
  const diagramRef = useRef<PhysicsDiagramCanvasHandle>(null)
  const similarProblemAbortRef = useRef<AbortController | undefined>(undefined)
  const feynmanAbortRef = useRef<AbortController | undefined>(undefined)
  const answerIdRef = useRef<string>(generatePhysicsId())

  // ── Mobile resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 600)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // ── Mounted guard ──────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      similarProblemAbortRef.current?.abort()
      feynmanAbortRef.current?.abort()
    }
  }, [])

  // ── Current question ───────────────────────────────────────────────────────
  const currentQ = useMemo<PhysicsQuestion | null>(() => {
    const qId = session.questionIds[session.currentIndex]
    return questions.find(q => q.id === qId) ?? null
  }, [session.currentIndex, session.questionIds, questions])

  // ── Reset state on new question ────────────────────────────────────────────
  useEffect(() => {
    startTimeRef.current = Date.now()
    setPhase('answering')
    setFreeAnswer('')
    setMcqChoice(null)
    setPartAnswers({})
    setConfidence(null)
    setSteps([{ text: '', graded: false, score: 0, feedback: '', grading: false }])
    setAllStepsGraded(false)
    setGradingStream('')
    setGradingResult(null)
    setGradingStatus(null)
    setRetryCount(0)
    setFeynmanStream('')
    setFeynmanLoading(false)
    setShowHint(false)
    setShowSimilar(false)
    answerIdRef.current = generatePhysicsId()
    similarProblemAbortRef.current?.abort()
    feynmanAbortRef.current?.abort()
  }, [session.currentIndex])

  // ── Derived: scrambled values for this question ────────────────────────────
  const scrambledValues = useMemo<Record<string, number> | undefined>(() => {
    if (!currentQ || !session.scrambleValues) return undefined
    return session.computedScrambledValues?.[currentQ.id]
  }, [currentQ, session.scrambleValues, session.computedScrambledValues])

  // ── Build answer text from current input ───────────────────────────────────
  const getAnswerText = useCallback((): string => {
    if (!currentQ) return ''
    if (currentQ.questionType === 'mcq') {
      if (mcqChoice === null) return ''
      const letters = ['A', 'B', 'C', 'D']
      return `${letters[mcqChoice]}: ${currentQ.choices?.[mcqChoice] ?? ''}`
    }
    if (currentQ.questionType === 'multi-part') {
      return Object.entries(partAnswers)
        .map(([label, ans]) => `${label}) ${ans}`)
        .join('\n')
    }
    return freeAnswer
  }, [currentQ, mcqChoice, partAnswers, freeAnswer])

  // ── Grade step ─────────────────────────────────────────────────────────────
  const gradeStep = useCallback(async (stepIndex: number) => {
    if (!currentQ) return
    const step = steps[stepIndex]
    if (!step.text.trim()) return

    setSteps(prev => prev.map((s, i) => i === stepIndex ? { ...s, grading: true } : s))

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are grading a single step of a physics problem solution. Return JSON only: {"score": <0-100>, "feedback": "<1-2 sentences>"}',
      },
      {
        role: 'user',
        content: `Question: ${currentQ.questionText}\nExpected final answer: ${currentQ.expectedAnswer}\n\nStudent step ${stepIndex + 1}: ${step.text}\n\nGrade this step.`,
      },
    ]

    try {
      const result = await callAI(messages, { temperature: 0.3, maxTokens: 150 }, 'ocr')
      const match = result.match(/\{[\s\S]*\}/)
      let score = 50
      let feedback = 'Step reviewed.'
      if (match) {
        try {
          const parsed = JSON.parse(match[0])
          score = Math.max(0, Math.min(100, Number(parsed.score) || 50))
          feedback = parsed.feedback || feedback
        } catch { /* use defaults */ }
      }
      if (!mountedRef.current) return
      setSteps(prev => prev.map((s, i) =>
        i === stepIndex ? { ...s, graded: true, score, feedback, grading: false } : s
      ))
    } catch {
      if (!mountedRef.current) return
      setSteps(prev => prev.map((s, i) =>
        i === stepIndex ? { ...s, graded: true, score: 50, feedback: 'Could not grade step.', grading: false } : s
      ))
    }

    // Check if all steps graded
    setSteps(prev => {
      const allGraded = prev.every((s, i) => i === stepIndex ? true : s.graded)
      if (allGraded) setAllStepsGraded(true)
      return prev
    })
  }, [currentQ, steps])

  // ── Core AI grading ────────────────────────────────────────────────────────
  const runGrading = useCallback(async (answerText: string, diagramBase64?: string) => {
    if (!currentQ) return
    setPhase('grading')
    streamRef.current = ''
    setGradingStream('')

    const messages: AIMessage[] = [
      { role: 'system', content: PHYSICS_GRADING_SYSTEM },
    ]

    const userContent: AIMessage['content'] = []
    const contentParts: Array<{ type: string; [k: string]: unknown }> = []

    // Question image
    if (currentQ.questionImageBase64) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${currentQ.questionImageMime ?? 'image/jpeg'};base64,${currentQ.questionImageBase64}`,
        },
      })
    }

    // Student diagram
    if (diagramBase64) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${diagramBase64}` },
      })
    }

    // Build text prompt
    const variablesText = currentQ.variables?.length
      ? `\nVariables: ${currentQ.variables.map(v => `${v.symbol} = ${v.name} (${v.unit})`).join(', ')}`
      : ''
    const scrambleText = scrambledValues && Object.keys(scrambledValues).length > 0
      ? `\nScrambled values used: ${Object.entries(scrambledValues).map(([k, v]) => `${k}=${v}`).join(', ')}`
      : ''

    contentParts.push({
      type: 'text',
      text: [
        `QUESTION: ${currentQ.questionText}${variablesText}${scrambleText}`,
        `REFERENCE ANSWER: ${currentQ.expectedAnswer}`,
        `STUDENT ANSWER: ${answerText}`,
        diagramBase64 ? '[Student diagram attached above]' : '[No diagram submitted]',
        'Grade this response and return JSON only.',
      ].join('\n\n'),
    })

    messages.push({
      role: 'user',
      content: contentParts as AIMessage['content'],
    })

    try {
      const result = await callAI(messages, {
        temperature: 0.2,
        maxTokens: 500,
        onChunk: (chunk) => {
          if (!mountedRef.current) return
          streamRef.current += chunk
          setGradingStream(streamRef.current)
        },
      }, 'ocr')

      if (!mountedRef.current) return

      // Parse JSON
      let parsed: GradingResult = { ...GRADING_DEFAULTS }
      try {
        const match = result.match(/\{[\s\S]*\}/)
        if (match) {
          const raw = JSON.parse(match[0])
          parsed = {
            answerScore: Math.max(0, Math.min(100, Number(raw.answerScore) || 50)),
            diagramScore: raw.diagramScore != null ? Math.max(0, Math.min(100, Number(raw.diagramScore))) : undefined,
            combinedScore: Math.max(0, Math.min(100, Number(raw.combinedScore) || 50)),
            feedback: typeof raw.feedback === 'string' ? raw.feedback : GRADING_DEFAULTS.feedback,
            whatToFix: Array.isArray(raw.whatToFix) ? raw.whatToFix : [],
            errorCategories: Array.isArray(raw.errorCategories) ? raw.errorCategories as PhysicsErrorCategory[] : [],
            missingPrerequisites: Array.isArray(raw.missingPrerequisites) ? raw.missingPrerequisites : [],
          }
        }
      } catch {
        parsed = { ...GRADING_DEFAULTS }
      }

      setGradingResult(parsed)
      setGradingStatus('graded')
      setPhase('result')
    } catch (err) {
      if (!mountedRef.current) return

      if (retryCount < 3) {
        // Enqueue for offline retry
        enqueue({
          answerId: answerIdRef.current,
          questionId: currentQ.id,
          courseStorageKey: `nousai-physquiz-${course.id}`,
          userAnswer: answerText,
          userDiagramBase64: diagramBase64,
          questionText: currentQ.questionText,
          expectedAnswer: currentQ.expectedAnswer,
          questionImageBase64: currentQ.questionImageBase64,
          questionImageMime: currentQ.questionImageMime,
          scrambledValues: scrambledValues,
          variables: currentQ.variables?.map(v => ({ symbol: v.symbol, name: v.name, unit: v.unit })),
        })
        setGradingResult({ ...GRADING_DEFAULTS, feedback: 'Grading queued — will complete when online.' })
        setGradingStatus('pending')
        setPhase('result')
      } else {
        setGradingResult({ ...GRADING_DEFAULTS, feedback: 'Grading failed after multiple attempts.' })
        setGradingStatus('failed')
        setPhase('result')
      }
    }
  }, [currentQ, scrambledValues, course.id, retryCount])

  // ── Retry grading ──────────────────────────────────────────────────────────
  const handleRetryGrading = useCallback(async () => {
    if (!currentQ) return
    setRetryCount(c => c + 1)
    const answerText = getAnswerText()
    await runGrading(answerText)
  }, [currentQ, getAnswerText, runGrading])

  // ── Submit answer ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!currentQ) return
    if (!confidence) return // confidence required

    const answerText = getAnswerText()
    if (!answerText.trim()) return

    // Get diagram if open
    let diagramBase64: string | undefined
    if (diagramOpen && diagramRef.current) {
      try {
        diagramBase64 = await diagramRef.current.exportCurrentDiagram()
      } catch { /* ignore */ }
    }

    await runGrading(answerText, diagramBase64)
  }, [currentQ, confidence, getAnswerText, diagramOpen, runGrading])

  // ── Advance to next question ───────────────────────────────────────────────
  const advanceQuestion = useCallback(() => {
    if (!currentQ || !gradingResult) return
    similarProblemAbortRef.current?.abort()

    const timeMs = Date.now() - startTimeRef.current
    const answerText = getAnswerText()

    const answer: PhysicsAnswer = {
      questionId: currentQ.id,
      userAnswer: answerText,
      gradingStatus: gradingStatus ?? 'graded',
      answerScore: gradingResult.answerScore,
      diagramScore: gradingResult.diagramScore,
      combinedScore: gradingResult.combinedScore,
      aiFeedback: gradingResult.feedback,
      errorCategories: gradingResult.errorCategories,
      whatToFix: gradingResult.whatToFix,
      confidence: confidence ?? undefined,
      confidenceCorrect: confidence != null
        ? (confidence === 'confident' && gradingResult.combinedScore >= 80) ||
          (confidence === 'pretty-sure' && gradingResult.combinedScore >= 60) ||
          (confidence === 'not-sure' && gradingResult.combinedScore < 60)
        : undefined,
      timeMs,
      gradedAt: new Date().toISOString(),
      missingPrerequisites: gradingResult.missingPrerequisites,
      scrambledValues: scrambledValues,
      steps: steps.filter(s => s.graded).map((s, i): StepAnswer => ({
        stepIndex: i,
        userStep: s.text,
        aiScore: s.score,
        aiFeedback: s.feedback,
      })),
    }

    const updatedSession: PhysicsSession = {
      ...session,
      answers: [...session.answers, answer],
      currentIndex: session.currentIndex + 1,
    }

    if (updatedSession.currentIndex >= session.questionIds.length) {
      updatedSession.finishedAt = new Date().toISOString()
      onFinish(updatedSession)
    } else {
      setSession(updatedSession)
    }
  }, [currentQ, gradingResult, gradingStatus, getAnswerText, confidence, session, onFinish, scrambledValues, steps])

  // ── Feynman explanation ────────────────────────────────────────────────────
  const handleFeynman = useCallback(async () => {
    if (!currentQ || feynmanLoading) return
    setFeynmanLoading(true)
    setFeynmanStream('')
    const ctrl = new AbortController()
    feynmanAbortRef.current = ctrl
    const ref = { current: '' }

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: 'You are a physics teacher explaining a concept using the Feynman technique — from scratch, step-by-step, using simple language and analogies. Use LaTeX math where helpful ($ for inline, $$ for display).',
      },
      {
        role: 'user',
        content: `Explain from scratch how to solve this type of problem:\n\nQuestion: ${currentQ.questionText}\nExpected answer: ${currentQ.expectedAnswer}\nTopic: ${TOPIC_LABELS[currentQ.topic]}\n\nTeach me as if I am a beginner. Walk through every step.`,
      },
    ]

    try {
      await callAI(messages, {
        temperature: 0.6,
        maxTokens: 800,
        onChunk: (chunk) => {
          if (!mountedRef.current || ctrl.signal.aborted) return
          ref.current += chunk
          setFeynmanStream(ref.current)
        },
      }, 'ocr')
    } catch {
      if (mountedRef.current && !ctrl.signal.aborted) {
        setFeynmanStream('Failed to load explanation. Please check your AI settings.')
      }
    } finally {
      if (mountedRef.current) setFeynmanLoading(false)
    }
  }, [currentQ, feynmanLoading])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (
        el?.tagName === 'INPUT' ||
        el?.tagName === 'TEXTAREA' ||
        el?.getAttribute('contenteditable') === 'true'
      ) return

      if (e.key === 'c' || e.key === 'C') {
        onCalcPanelChange(calcActivePanel === 'calc' ? null : 'calc')
        if (isMobile) setMobilePanelOpen(calcActivePanel !== 'calc')
      }
      if (e.key === 'u' || e.key === 'U') {
        onCalcPanelChange(calcActivePanel === 'units' ? null : 'units')
        if (isMobile) setMobilePanelOpen(calcActivePanel !== 'units')
      }
      if (e.key === 'd' || e.key === 'D') setDiagramOpen(p => !p)
      if (e.key === 'l' || e.key === 'L') setLabsOpen(p => !p)
      if (e.key === 'h' || e.key === 'H') setShowHint(p => !p)
      if (e.key === 'ArrowRight' && phase === 'result' && e.target === document.body) advanceQuestion()
      if (e.key === '?') setShowShortcuts(p => !p)
      if (e.key === 'Escape') {
        onCalcPanelChange(null)
        setDiagramOpen(false)
        setLabsOpen(false)
        setMobilePanelOpen(false)
        setShowShortcuts(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [calcActivePanel, phase, onCalcPanelChange, advanceQuestion, isMobile])

  // ── Toolbar panel toggle ───────────────────────────────────────────────────
  function handlePanelToggle(panel: 'calc' | 'units' | 'dimcheck') {
    const next = calcActivePanel === panel ? null : panel
    onCalcPanelChange(next)
    if (isMobile) setMobilePanelOpen(next !== null)
  }

  // ── Guard: no question ─────────────────────────────────────────────────────
  if (!currentQ) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
        No question found.
      </div>
    )
  }

  const progress = session.currentIndex + 1
  const total = session.questionIds.length
  const isLastQuestion = session.currentIndex + 1 >= session.questionIds.length
  const isStepMode = session.stepMode && currentQ.supportsStepMode
  const activeLeftPanel = calcActivePanel

  // What to show in left panel
  const leftPanelContent =
    activeLeftPanel === 'calc' ? <PhysicsCalculator /> :
    activeLeftPanel === 'units' ? <PhysicsUnitTable /> :
    activeLeftPanel === 'dimcheck' ? <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 14 }}>Dimensional analysis tool coming soon</div> :
    null

  const hasLeftPanel = leftPanelContent !== null && !isMobile
  const mobileShowPanel = isMobile && mobilePanelOpen && leftPanelContent !== null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative' }}>
      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px',
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)',
        flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Progress */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginRight: 8, whiteSpace: 'nowrap' }}>
          Q {progress}/{total}
        </div>

        {/* Progress bar (mini, inline) */}
        <div style={{
          flex: 1, minWidth: 60, maxWidth: 120, height: 4,
          background: 'var(--border-color)', borderRadius: 2,
        }}>
          <div style={{
            height: '100%', borderRadius: 2,
            background: '#f59e0b',
            width: `${(progress / total) * 100}%`,
            transition: 'width 0.3s',
          }} />
        </div>

        <div style={{ flex: 1 }} />

        {/* Tool buttons */}
        {(
          [
            { panel: 'calc' as const, icon: <Calculator size={14} />, label: 'Calc', key: 'C' },
            { panel: 'units' as const, icon: <BookOpen size={14} />, label: 'Units', key: 'U' },
            { panel: 'dimcheck' as const, icon: <LayoutGrid size={14} />, label: 'Dim', key: 'D' },
          ] as const
        ).map(({ panel, icon, label, key }) => (
          <button
            key={panel}
            title={`${label} (${key})`}
            onClick={() => handlePanelToggle(panel)}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              background: activeLeftPanel === panel ? '#f59e0b22' : 'var(--bg-primary)',
              border: `1px solid ${activeLeftPanel === panel ? '#f59e0b' : 'var(--border-color)'}`,
              color: activeLeftPanel === panel ? '#f59e0b' : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}
          >
            {icon}
            {!isMobile && <span>{label}</span>}
          </button>
        ))}

        {/* Diagram overlay toggle */}
        <button
          title="Diagram (D)"
          onClick={() => setDiagramOpen(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: diagramOpen ? '#6366f122' : 'var(--bg-primary)',
            border: `1px solid ${diagramOpen ? '#6366f1' : 'var(--border-color)'}`,
            color: diagramOpen ? '#6366f1' : 'var(--text-muted)',
          }}
        >
          <Atom size={14} />
          {!isMobile && <span>Diagram</span>}
        </button>

        {/* Labs overlay toggle */}
        <button
          title="Labs (L)"
          onClick={() => setLabsOpen(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: labsOpen ? '#22c55e22' : 'var(--bg-primary)',
            border: `1px solid ${labsOpen ? '#22c55e' : 'var(--border-color)'}`,
            color: labsOpen ? '#22c55e' : 'var(--text-muted)',
          }}
        >
          <Beaker size={14} />
          {!isMobile && <span>Labs</span>}
        </button>

        {/* Shortcuts */}
        <button
          title="Keyboard shortcuts (?)"
          onClick={() => setShowShortcuts(p => !p)}
          style={{
            display: 'flex', alignItems: 'center',
            padding: '5px 8px', borderRadius: 8, fontSize: 12,
            cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-muted)',
          }}
        >
          <Keyboard size={14} />
        </button>

        {/* Quit */}
        <button
          onClick={onQuit}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            color: '#ef4444',
          }}
        >
          <X size={14} />
          {!isMobile && <span>Quit</span>}
        </button>
      </div>

      {/* ── Main body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
        {/* Left panel (desktop) */}
        {hasLeftPanel && (
          <div style={{
            width: 300, flexShrink: 0,
            borderRight: '1px solid var(--border-color)',
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
          }}>
            {leftPanelContent}
          </div>
        )}

        {/* Mobile panel overlay */}
        {mobileShowPanel && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'var(--bg-secondary)',
            overflowY: 'auto',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'flex-end',
              padding: '10px 12px', borderBottom: '1px solid var(--border-color)',
            }}>
              <button
                onClick={() => { setMobilePanelOpen(false); onCalcPanelChange(null) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20 }}
              >
                ✕
              </button>
            </div>
            {leftPanelContent}
          </div>
        )}

        {/* Center: question + answer */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: isMobile ? '16px 12px' : '24px 28px',
          maxWidth: 720,
          margin: '0 auto',
          width: '100%',
        }}>
          {/* Question number */}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.05em' }}>
            QUESTION {progress} OF {total} &nbsp;·&nbsp; {TOPIC_LABELS[currentQ.topic]}
          </div>

          {/* Question card */}
          <div style={{
            padding: '20px 20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: 14,
            marginBottom: 16,
          }}>
            {/* Question image */}
            {currentQ.questionImageBase64 && (
              <img
                src={`data:${currentQ.questionImageMime ?? 'image/jpeg'};base64,${currentQ.questionImageBase64}`}
                alt="Question diagram"
                style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10, marginBottom: 14, display: 'block' }}
              />
            )}

            {/* Question text */}
            <div style={{ fontSize: 16, lineHeight: 1.75, fontWeight: 500, color: 'var(--text-primary)' }}>
              <QuestionTextWithVars
                text={currentQ.questionText}
                variables={currentQ.variables}
                scrambledValues={scrambledValues}
              />
            </div>

            {/* Hint */}
            {currentQ.hint && phase === 'answering' && (
              <div style={{ marginTop: 12 }}>
                {showHint ? (
                  <div style={{
                    padding: '8px 12px', background: '#f59e0b11',
                    border: '1px solid #f59e0b44', borderRadius: 8,
                    fontSize: 13, color: '#f59e0b',
                  }}>
                    <Lightbulb size={13} style={{ display: 'inline', marginRight: 6 }} />
                    {currentQ.hint}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowHint(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-muted)', fontSize: 12, fontFamily: 'inherit',
                    }}
                  >
                    <Lightbulb size={12} /> Show hint (H)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Answering phase ── */}
          {phase === 'answering' && (
            <div>
              {/* MCQ */}
              {currentQ.questionType === 'mcq' && currentQ.choices && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {currentQ.choices.map((choice, idx) => {
                    const letter = ['A', 'B', 'C', 'D'][idx]
                    const selected = mcqChoice === idx
                    return (
                      <button
                        key={idx}
                        onClick={() => setMcqChoice(idx)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 16px', borderRadius: 12, textAlign: 'left',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 14,
                          background: selected ? '#f59e0b22' : 'var(--bg-secondary)',
                          border: `2px solid ${selected ? '#f59e0b' : 'var(--border-color)'}`,
                          color: 'var(--text-primary)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{
                          flexShrink: 0, width: 24, height: 24,
                          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700,
                          background: selected ? '#f59e0b' : 'var(--bg-primary)',
                          color: selected ? '#000' : 'var(--text-muted)',
                          border: `1px solid ${selected ? '#f59e0b' : 'var(--border-color)'}`,
                        }}>
                          {letter}
                        </span>
                        <span style={{ lineHeight: 1.5 }}><MathRenderer text={choice} /></span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Free response */}
              {currentQ.questionType === 'free-response' && !isStepMode && (
                <textarea
                  value={freeAnswer}
                  onChange={e => setFreeAnswer(e.target.value)}
                  placeholder="Type your answer here... (include units for numerical answers)"
                  rows={4}
                  style={{
                    width: '100%', padding: '12px 14px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 12, fontSize: 14, color: 'var(--text-primary)',
                    fontFamily: 'inherit', lineHeight: 1.6, resize: 'vertical',
                    boxSizing: 'border-box', marginBottom: 16, outline: 'none',
                  }}
                />
              )}

              {/* Step mode */}
              {currentQ.questionType === 'free-response' && isStepMode && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                    Step-by-step solution
                  </div>
                  {steps.map((step, i) => (
                    <div key={i} style={{
                      marginBottom: 12, padding: '12px 14px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      borderRadius: 12,
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>
                        Step {i + 1}
                      </div>
                      <textarea
                        value={step.text}
                        onChange={e => setSteps(prev => prev.map((s, si) => si === i ? { ...s, text: e.target.value } : s))}
                        disabled={step.graded || step.grading}
                        placeholder="Describe this step..."
                        rows={2}
                        style={{
                          width: '100%', padding: '8px 10px',
                          background: step.graded ? '#f59e0b08' : 'var(--bg-primary)',
                          border: `1px solid ${step.graded ? '#f59e0b44' : 'var(--border-color)'}`,
                          borderRadius: 8, fontSize: 13, color: 'var(--text-primary)',
                          fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                        }}
                      />
                      {step.graded && (
                        <div style={{ marginTop: 6, fontSize: 12, color: scoreColor(step.score) }}>
                          Step score: {step.score}/100 — {step.feedback}
                        </div>
                      )}
                      {!step.graded && (
                        <button
                          onClick={() => gradeStep(i)}
                          disabled={step.grading || !step.text.trim()}
                          style={{
                            marginTop: 8, padding: '6px 14px', borderRadius: 8,
                            fontSize: 12, fontWeight: 600, cursor: step.grading || !step.text.trim() ? 'default' : 'pointer',
                            background: '#f59e0b22', border: '1px solid #f59e0b55',
                            color: '#f59e0b', fontFamily: 'inherit', opacity: step.text.trim() ? 1 : 0.5,
                          }}
                        >
                          {step.grading ? 'Grading...' : 'Grade This Step'}
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setSteps(prev => [...prev, { text: '', graded: false, score: 0, feedback: '', grading: false }])}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    + Add Step
                  </button>
                </div>
              )}

              {/* Multi-part */}
              {currentQ.questionType === 'multi-part' && currentQ.parts && (
                <div style={{ marginBottom: 16 }}>
                  {currentQ.parts.map((part) => (
                    <details key={part.label} open style={{ marginBottom: 12 }}>
                      <summary style={{
                        padding: '10px 14px',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                        borderRadius: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                        color: 'var(--text-primary)', listStyle: 'none',
                      }}>
                        Part {part.label}{part.points != null ? ` (${part.points} pts)` : ''}: <MathRenderer text={part.question} />
                      </summary>
                      <div style={{ padding: '8px 4px 0' }}>
                        <textarea
                          value={partAnswers[part.label] ?? ''}
                          onChange={e => setPartAnswers(prev => ({ ...prev, [part.label]: e.target.value }))}
                          placeholder={`Answer for part ${part.label}...`}
                          rows={3}
                          style={{
                            width: '100%', padding: '10px 12px',
                            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                            borderRadius: 10, fontSize: 13, color: 'var(--text-primary)',
                            fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </details>
                  ))}
                </div>
              )}

              {/* Confidence rating */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 8, letterSpacing: '0.04em' }}>
                  CONFIDENCE
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(
                    [
                      { value: 'not-sure' as const, label: 'Not Sure' },
                      { value: 'pretty-sure' as const, label: 'Pretty Sure' },
                      { value: 'confident' as const, label: 'Confident' },
                    ]
                  ).map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setConfidence(value)}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: confidence === value ? '#f59e0b' : 'var(--bg-secondary)',
                        border: `1px solid ${confidence === value ? '#f59e0b' : 'var(--border-color)'}`,
                        color: confidence === value ? '#000' : 'var(--text-muted)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={
                  !confidence ||
                  (currentQ.questionType === 'mcq' && mcqChoice === null) ||
                  (currentQ.questionType === 'free-response' && !isStepMode && !freeAnswer.trim()) ||
                  (currentQ.questionType === 'free-response' && isStepMode && !allStepsGraded) ||
                  (currentQ.questionType === 'multi-part' && !currentQ.parts?.every(p => (partAnswers[p.label] ?? '').trim()))
                }
                style={{
                  width: '100%', padding: '12px 20px',
                  background: '#f59e0b', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', color: '#000',
                  opacity: (!confidence) ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                Submit Answer
              </button>

              {!confidence && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                  Select your confidence level before submitting
                </div>
              )}
            </div>
          )}

          {/* ── Grading phase ── */}
          {phase === 'grading' && (
            <div style={{
              padding: '28px 20px',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              borderRadius: 14, textAlign: 'center',
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>
                <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#f59e0b' }} />
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 10 }}>
                AI is grading your answer...
              </div>
              {gradingStream && (
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic',
                  maxHeight: 80, overflow: 'hidden', textAlign: 'left',
                  background: 'var(--bg-primary)', borderRadius: 8, padding: '8px 12px',
                }}>
                  {gradingStream.slice(0, 300)}
                </div>
              )}
            </div>
          )}

          {/* ── Result phase ── */}
          {phase === 'result' && gradingResult && (
            <div>
              {/* Score card */}
              <div style={{
                padding: '20px 20px',
                background: 'var(--bg-secondary)',
                border: `2px solid ${scoreColor(gradingResult.combinedScore)}33`,
                borderRadius: 14, marginBottom: 16,
              }}>
                {/* Score display */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, letterSpacing: '0.05em' }}>
                      COMBINED SCORE
                    </div>
                    <div style={{
                      fontSize: 48, fontWeight: 800,
                      color: scoreColor(gradingResult.combinedScore),
                      fontFamily: 'DM Mono, monospace', lineHeight: 1,
                    }}>
                      {gradingResult.combinedScore}
                      <span style={{ fontSize: 20, opacity: 0.7 }}>/100</span>
                    </div>
                  </div>

                  {gradingResult.diagramScore != null && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
                        ANSWER / DIAGRAM
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>
                        <span style={{ color: scoreColor(gradingResult.answerScore) }}>
                          {gradingResult.answerScore}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}> / </span>
                        <span style={{ color: scoreColor(gradingResult.diagramScore) }}>
                          {gradingResult.diagramScore}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status indicators */}
                {gradingStatus === 'pending' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                    padding: '8px 12px', background: '#eab30822', borderRadius: 8,
                    border: '1px solid #eab30855',
                  }}>
                    <AlertCircle size={14} style={{ color: '#eab308', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#eab308' }}>
                      Grading queued — will complete when online.
                    </span>
                  </div>
                )}
                {gradingStatus === 'failed' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
                    padding: '8px 12px', background: '#ef444422', borderRadius: 8,
                    border: '1px solid #ef444455',
                  }}>
                    <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: '#ef4444', flex: 1 }}>
                      Grading failed after multiple attempts.
                    </span>
                    <button
                      onClick={handleRetryGrading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: '#ef444422', border: '1px solid #ef444488',
                        color: '#ef4444',
                      }}
                    >
                      <RefreshCw size={11} /> Retry
                    </button>
                  </div>
                )}

                {/* Feedback */}
                <div style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', marginBottom: 14 }}>
                  {gradingResult.feedback}
                </div>

                {/* Error category pills */}
                {gradingResult.errorCategories.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {gradingResult.errorCategories.map(cat => (
                      <span key={cat} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: `${ERROR_COLORS[cat]}22`,
                        border: `1px solid ${ERROR_COLORS[cat]}55`,
                        color: ERROR_COLORS[cat],
                      }}>
                        {ERROR_LABELS[cat]}
                      </span>
                    ))}
                  </div>
                )}

                {/* What to fix */}
                {gradingResult.whatToFix.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
                      WHAT TO FIX
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {gradingResult.whatToFix.map((fix, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 2 }}>
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Missing prerequisites warning */}
                {gradingResult.missingPrerequisites.length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '10px 14px', background: '#f59e0b11',
                    border: '1px solid #f59e0b44', borderRadius: 10, marginBottom: 12,
                  }}>
                    <AlertCircle size={14} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', marginBottom: 2 }}>
                        You may be missing:
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {gradingResult.missingPrerequisites.join(', ')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Post-grading action buttons */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {gradingResult.combinedScore < 80 && !feynmanStream && (
                    <button
                      onClick={handleFeynman}
                      disabled={feynmanLoading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        cursor: feynmanLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                        background: '#6366f122', border: '1px solid #6366f155', color: '#6366f1',
                      }}
                    >
                      <HelpCircle size={13} />
                      {feynmanLoading ? 'Loading...' : 'Explain from scratch'}
                    </button>
                  )}
                  {gradingResult.combinedScore < 70 && (
                    <button
                      onClick={() => setShowSimilar(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        background: '#22c55e22', border: '1px solid #22c55e55', color: '#22c55e',
                      }}
                    >
                      <ChevronRight size={13} />
                      Show Similar Problem
                    </button>
                  )}
                </div>

                {/* Feynman explanation stream */}
                {(feynmanStream || feynmanLoading) && (
                  <div style={{
                    marginTop: 16, padding: '14px 16px',
                    background: '#6366f111', border: '1px solid #6366f133',
                    borderRadius: 12,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>
                      FEYNMAN EXPLANATION
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                      {feynmanStream ? <MathRenderer text={feynmanStream} /> : 'Generating explanation...'}
                      {feynmanLoading && feynmanStream && (
                        <span style={{
                          display: 'inline-block', width: 8, height: 14,
                          background: '#6366f1', borderRadius: 2,
                          verticalAlign: 'text-bottom', marginLeft: 2,
                        }} />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Next / Finish button */}
              <button
                onClick={advanceQuestion}
                style={{
                  width: '100%', padding: '14px 20px',
                  background: '#f59e0b', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', color: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                {isLastQuestion ? (
                  <>Finish Session</>
                ) : (
                  <>Next Question <ChevronRight size={16} /></>
                )}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
                Press → to advance
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Diagram overlay ── */}
      {diagramOpen && (
        <div style={{
          position: 'fixed',
          right: 0, top: 0, bottom: 0,
          width: isMobile ? '100%' : 480,
          zIndex: 180,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Diagram</div>
            <button
              onClick={() => setDiagramOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: 13 }}>
                Loading diagram editor...
              </div>
            }>
              <PhysicsDiagramCanvas
                ref={diagramRef}
                mode="annotate"
                initialData={currentQ?.diagramData ?? null}
                height={undefined}
              />
            </Suspense>
          </div>
        </div>
      )}

      {/* ── Labs overlay ── */}
      {labsOpen && (
        <div style={{
          position: 'fixed',
          right: 0, top: 0, bottom: 0,
          width: isMobile ? '100%' : 480,
          zIndex: 190,
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Labs</div>
            <button
              onClick={() => setLabsOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18 }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Labs panel
          </div>
        </div>
      )}

      {/* ── Shortcuts modal ── */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}

      {/* ── Similar problem modal ── */}
      {showSimilar && currentQ && (
        <SimilarProblemModal
          question={currentQ}
          abortRef={similarProblemAbortRef}
          onClose={() => setShowSimilar(false)}
        />
      )}

      {/* ── Spin keyframe ── */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
