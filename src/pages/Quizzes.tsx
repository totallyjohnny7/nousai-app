import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import {
  Trophy, ChevronLeft, CheckCircle, XCircle, Search, Filter,
  Plus, FileText, Upload, History, Layers, Download, Trash2,
  Copy, ChevronDown, ChevronUp, Edit3, Save, FolderOpen, Folder, FolderPlus,
  AlertCircle, RefreshCw, Star, Clock, BarChart3, X, Loader, Play, Tag, BookOpen
} from 'lucide-react'
import { useStore } from '../store'
import { callAI, isAIConfigured } from '../utils/ai'
import { buildQuizPrompt, parseAIQuizResponse, checkAnswer as engineCheckAnswer, type QuizQuestion, type QuestionType } from '../utils/quizEngine'
import { matchesShortcut, getShortcutKey, formatKey } from '../utils/shortcuts'
import type { QuizAttempt, QuizAnswer } from '../types'
import { awardQuizXp, getComboMultiplier, getComboLabel } from '../utils/gamification'
import { exportQuizzesAsCSV } from '../utils/exportFormats'
import { recordAttempt, calculateProficiency, isProficient } from '../utils/proficiency'
import type { ProficiencyEntry } from '../types'
import StudyAnnotationSidecar from '../components/StudyAnnotationSidecar'
import StudyFloatingRail from '../components/StudyFloatingRail'
import ReadAloudButton from '../components/ReadAloudButton'
import { useSessionStore } from '../store/sessionStore'
import { saveQuizLog, makeQuizLogEntry } from '../utils/quizLog'

type QuizTab = 'create' | 'bank' | 'history' | 'merge'

interface PlayableQuiz {
  questions: { question: string; correctAnswer: string; options?: string[]; type: string; explanation?: string }[]
  name: string
  subject: string
  subtopic: string
}

// ─── Quiz Folders ──────────────────────────────────────
interface QuizFolder {
  id: string
  name: string
  color: string
}

const FOLDER_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4']

function loadQuizFolders(): QuizFolder[] {
  try {
    const raw = localStorage.getItem('nousai-quiz-folders')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveQuizFolders(folders: QuizFolder[]) {
  localStorage.setItem('nousai-quiz-folders', JSON.stringify(folders))
}

function loadFolderMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem('nousai-quiz-folder-map')
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveFolderMap(map: Record<string, string>) {
  localStorage.setItem('nousai-quiz-folder-map', JSON.stringify(map))
}

// ─── Progressive Quiz Session ──────────────────────────
interface ProgressiveQuizSession {
  id: string
  tabId: string
  subject: string
  subjectDisplay: string
  startedAt: string
  lastActivityAt: string
  allQuestionKeys: string[]
  answeredKeys: string[]
  wrongKeys: string[]
  answers: QuizAnswer[]
  phase: 'initial' | 'review-wrong' | 'complete'
  reviewRound: number
  batchNumber: number
  questionSnapshots: Record<string, { question: string; correctAnswer: string; options?: string[]; type: string; explanation?: string }>
  pendingAnswers?: number
}

const SESSION_KEY = 'nousai-progressive-session'
const BATCH_SIZE = 20
const MAX_REVIEW_ROUNDS = 3
const TAB_ID = Math.random().toString(36).slice(2)

function loadSession(): ProgressiveQuizSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (!s.id || !Array.isArray(s.allQuestionKeys) || !s.questionSnapshots || typeof s.phase !== 'string') {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s as ProgressiveQuizSession
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

function saveSessionToStorage(session: ProgressiveQuizSession | null) {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, lastActivityAt: new Date().toISOString() }))
  } catch (e) {
    console.warn('[QUIZ] Failed to save session:', e)
  }
}

function buildBatchFromSession(session: ProgressiveQuizSession): PlayableQuiz | null {
  let keys: string[]
  if (session.phase === 'initial') {
    keys = session.allQuestionKeys.filter(k => !session.answeredKeys.includes(k))
  } else if (session.phase === 'review-wrong') {
    keys = session.wrongKeys.filter(k => !session.answeredKeys.includes(k))
  } else {
    return null
  }
  if (keys.length === 0) return null
  const batch = keys.slice(0, BATCH_SIZE)
  const questions = batch.map(k => session.questionSnapshots[k]).filter(Boolean)
  if (questions.length === 0) return null
  return {
    questions,
    name: `${session.subjectDisplay} Session`,
    subject: session.subjectDisplay,
    subtopic: `Batch ${session.batchNumber + 1}`,
  }
}

export default function Quizzes() {
  const { loaded, data, setData, setPageContext } = useStore()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const initialTab = (['create', 'bank', 'history', 'merge'].includes(searchParams.get('tab') || '') ? searchParams.get('tab') : 'history') as QuizTab
  const [tab, setTab] = useState<QuizTab>(initialTab)
  const [selectedAttempt, setSelectedAttempt] = useState<QuizAttempt | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<PlayableQuiz | null>(null)

  // ── Progressive Session State ──
  const [activeSession, setActiveSession] = useState<ProgressiveQuizSession | null>(loadSession)
  const [sessionConflict, setSessionConflict] = useState(false)
  const [pendingResume, setPendingResume] = useState(false)
  const activeSessionRef = useRef(activeSession)
  activeSessionRef.current = activeSession

  // Failsafe 12: Tab lock — warn if another tab owns the session
  useEffect(() => {
    const s = activeSession
    if (s && s.phase !== 'complete' && s.tabId && s.tabId !== TAB_ID) {
      setSessionConflict(true)
    }
  }, [])

  // Failsafe 9: Save session on browser close
  useEffect(() => {
    const handler = () => {
      if (activeSessionRef.current && activeSessionRef.current.phase !== 'complete') {
        saveSessionToStorage(activeSessionRef.current)
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // Show resume prompt on mount if session exists — do NOT auto-start (user must click Resume)
  useEffect(() => {
    if (activeSession && activeSession.phase !== 'complete' && !activeQuiz && !sessionConflict) {
      const batch = buildBatchFromSession(activeSession)
      if (batch) {
        setPendingResume(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-play quiz when navigated from CoursePage with state (Failsafe 5: check session first)
  useEffect(() => {
    const state = location.state as { autoPlay?: PlayableQuiz } | null
    if (state?.autoPlay) {
      if (activeSession && activeSession.phase !== 'complete') {
        // Don't overwrite active session — just clear the nav state
        window.history.replaceState({}, '')
        return
      }
      setActiveQuiz(state.autoPlay)
      window.history.replaceState({}, '')
    }
  }, [location.state, activeSession])

  // ── Page context publisher ──
  useEffect(() => {
    if (activeQuiz) {
      setPageContext({
        page: 'Quiz',
        summary: `Quiz: ${activeQuiz.subject} — ${activeQuiz.questions.length} questions`,
        activeItem: activeQuiz.questions[0]
          ? `Q: ${activeQuiz.questions[0].question}\nOptions: ${(activeQuiz.questions[0].options ?? []).join(', ')}`
          : undefined,
      })
    } else {
      const recentCount = (data?.pluginData?.quizHistory ?? []).length
      setPageContext({
        page: 'Quizzes',
        summary: `Quiz history — ${recentCount} attempts`,
      })
    }
    return () => setPageContext(null)
  }, [activeQuiz, data?.pluginData?.quizHistory])

  // ── Shared folder state (lifted from tabs so both Bank & History stay in sync) ──
  const [folders, setFolders] = useState<QuizFolder[]>(loadQuizFolders)
  const [folderMap, setFolderMap] = useState<Record<string, string>>(loadFolderMap)

  const sharedFolderActions = useMemo(() => ({
    createFolder(name: string) {
      if (!name.trim()) return
      const folder: QuizFolder = {
        id: `folder-${Date.now()}`,
        name: name.trim(),
        color: FOLDER_COLORS[folders.length % FOLDER_COLORS.length],
      }
      const next = [...folders, folder]
      setFolders(next)
      saveQuizFolders(next)
    },
    renameFolder(id: string, name: string) {
      const next = folders.map(f => f.id === id ? { ...f, name } : f)
      setFolders(next)
      saveQuizFolders(next)
    },
    deleteFolder(id: string) {
      const next = folders.filter(f => f.id !== id)
      setFolders(next)
      saveQuizFolders(next)
      const nextMap = { ...folderMap }
      for (const [qId, fId] of Object.entries(nextMap)) {
        if (fId === id) delete nextMap[qId]
      }
      setFolderMap(nextMap)
      saveFolderMap(nextMap)
    },
    assignToFolder(itemId: string, folderId: string | null) {
      const nextMap = { ...folderMap }
      if (folderId) { nextMap[itemId] = folderId } else { delete nextMap[itemId] }
      setFolderMap(nextMap)
      saveFolderMap(nextMap)
    },
  }), [folders, folderMap])

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading quizzes...</div>
      </div>
    )
  }

  const tabs: { key: QuizTab; label: string; icon: React.ReactNode }[] = [
    { key: 'create', label: 'Create', icon: <Plus size={14} /> },
    { key: 'bank', label: 'Bank', icon: <FolderOpen size={14} /> },
    { key: 'history', label: 'History', icon: <History size={14} /> },
    { key: 'merge', label: 'Merge', icon: <Layers size={14} /> },
  ]

  // ── Session helper: save final attempt to quizHistory + proficiency ──
  const saveFinalAttempt = useCallback((attempt: QuizAttempt) => {
    if (!data) return
    setData(prev => {
      // Use prev (always current state) to avoid stale closure overwriting streak/XP
      const currentGam = prev.pluginData.gamificationData
      const updatedGam = awardQuizXp(currentGam, attempt.correct, attempt.questionCount)
      const profData = prev.pluginData.proficiencyData || {
        settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 },
        subjects: {},
      }
      const subjectKey = attempt.subject || 'General'
      const topicKey = attempt.subtopic || attempt.name || 'General'
      const existingSubject = profData.subjects[subjectKey] || {}
      const existingEntry = existingSubject[topicKey]
      const pct = attempt.questionCount > 0 ? Math.round((attempt.correct / attempt.questionCount) * 100) : 0
      const updatedStats = recordAttempt(
        existingEntry ? { attempts: existingEntry.attempts.map(a => typeof a === 'object' ? (a as { percentage: number }).percentage : a), streak: existingEntry.currentStreak || 0, lastAttempt: '' } : undefined,
        pct, profData.settings.proficiencyThreshold
      )
      const updatedEntry: ProficiencyEntry = {
        subject: subjectKey, subtopic: topicKey,
        attempts: updatedStats.attempts.map(p => ({ date: new Date().toISOString(), percentage: p })),
        proficiencyScore: calculateProficiency(updatedStats.attempts, profData.settings),
        isProficient: isProficient(updatedStats.attempts, profData.settings),
        currentStreak: updatedStats.streak,
        bestStreak: Math.max(updatedStats.streak, existingEntry?.bestStreak || 0),
      }
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          quizHistory: [...prev.pluginData.quizHistory, attempt],
          gamificationData: updatedGam,
          proficiencyData: { ...profData, subjects: { ...profData.subjects, [subjectKey]: { ...existingSubject, [topicKey]: updatedEntry } } },
        },
      }
    })
    // Persist raw session data to IndexedDB as a local backup
    saveQuizLog(makeQuizLogEntry(attempt))
  }, [data, setData])

  // ── Session batch completion handler ──
  // Track individual answers in real-time so partial batch progress isn't lost on pause
  const partialBatchAnswersRef = useRef<QuizAnswer[]>([])
  const handleSessionAnswer = useCallback((answer: QuizAnswer) => {
    if (!activeSessionRef.current) return
    partialBatchAnswersRef.current = [...partialBatchAnswersRef.current, answer]
    const session = { ...activeSessionRef.current }
    const key = answer.question?.question?.substring(0, 80)
    if (key && !session.answeredKeys.includes(key)) {
      session.answeredKeys.push(key)
      if (!answer.correct && !session.wrongKeys.includes(key)) session.wrongKeys.push(key)
    }
    session.answers = [...session.answers, answer]
    session.pendingAnswers = (session.pendingAnswers || 0) + 1
    session.lastActivityAt = new Date().toISOString()
    setActiveSession(session)
    activeSessionRef.current = session
    // Save every 5 answers or always (Failsafe 2 adapted: save each answer since pause can happen anytime)
    saveSessionToStorage(session)
  }, [])

  const handleSessionBatchComplete = useCallback((attempt: QuizAttempt) => {
    if (!activeSessionRef.current) return
    const session = { ...activeSessionRef.current }
    // Answers already tracked via handleSessionAnswer — just advance batch
    // But if somehow answers weren't tracked (e.g., onAnswer not called), merge them
    const batchAnswers = attempt.answers || []
    const existingKeys = new Set(session.answeredKeys)
    batchAnswers.forEach(a => {
      const key = a.question?.question?.substring(0, 80)
      if (key && !existingKeys.has(key)) {
        session.answeredKeys.push(key)
        session.answers.push(a)
        if (!a.correct && !session.wrongKeys.includes(key)) session.wrongKeys.push(key)
      }
    })
    session.batchNumber += 1
    partialBatchAnswersRef.current = [] // reset partial tracker

    if (session.phase === 'initial') {
      // Check if initial pass is done
      const remaining = session.allQuestionKeys.filter(k => !session.answeredKeys.includes(k))
      if (remaining.length === 0) {
        if (session.wrongKeys.length > 0 && session.reviewRound < MAX_REVIEW_ROUNDS) {
          // Start review phase
          session.phase = 'review-wrong'
          session.reviewRound += 1
          session.answeredKeys = [] // reset for review pass
        } else {
          session.phase = 'complete'
        }
      }
    } else if (session.phase === 'review-wrong') {
      // Track review answers — remove from wrongKeys if correct
      batchAnswers.forEach(a => {
        const key = a.question?.question?.substring(0, 80)
        if (key) {
          if (!session.answeredKeys.includes(key)) session.answeredKeys.push(key)
          if (a.correct) session.wrongKeys = session.wrongKeys.filter(k => k !== key)
        }
      })
      // Check if review pass is done
      const reviewRemaining = session.wrongKeys.filter(k => !session.answeredKeys.includes(k))
      if (reviewRemaining.length === 0) {
        if (session.wrongKeys.length > 0 && session.reviewRound < MAX_REVIEW_ROUNDS) {
          session.reviewRound += 1
          session.answeredKeys = [] // reset for next review round
        } else {
          session.phase = 'complete'
        }
      }
    }

    saveSessionToStorage(session)
    setActiveSession(session)

    if (session.phase === 'complete') {
      // Build final attempt and save to quizHistory (Failsafe 3: only on final completion)
      const initialAnswers = session.answers.filter((_, i) => i < session.allQuestionKeys.length)
      const correctCount = initialAnswers.filter(a => a.correct).length
      const finalAttempt: QuizAttempt = {
        id: `quiz-session-${session.id}`,
        name: `${session.subjectDisplay} Session`,
        subject: session.subjectDisplay,
        subtopic: 'Session Complete',
        date: new Date().toISOString(),
        questionCount: session.allQuestionKeys.length,
        score: session.allQuestionKeys.length > 0 ? Math.round((correctCount / session.allQuestionKeys.length) * 100) : 0,
        correct: correctCount,
        mode: 'session',
        questions: [],
        answers: initialAnswers,
      }
      saveFinalAttempt(finalAttempt)
      setActiveQuiz(null)
    } else {
      // Serve next batch (Failsafe 11: don't set selectedAttempt)
      const nextBatch = buildBatchFromSession(session)
      if (nextBatch) {
        setActiveQuiz(nextBatch)
      } else {
        // No more questions — force complete
        session.phase = 'complete'
        saveSessionToStorage(session)
        setActiveSession(session)
        setActiveQuiz(null)
      }
    }
  }, [activeSession, saveFinalAttempt])

  // If playing a quiz
  if (activeQuiz) {
    const isSessionBatch = !!(activeSession && activeSession.phase !== 'complete')
    const sessionProgress = isSessionBatch ? (() => {
      const s = activeSession!
      const total = s.phase === 'review-wrong' ? s.wrongKeys.length : s.allQuestionKeys.length
      const answered = s.answeredKeys.length
      const wrong = s.wrongKeys.length
      const remaining = total - answered
      const pct = total > 0 ? Math.round((answered / total) * 100) : 0
      return { total, answered, wrong, remaining, pct, phase: s.phase, round: s.reviewRound }
    })() : null

    return (
      <div>
        {/* Session progress bar (Failsafe 10: rendered outside QuizPlayer) */}
        {sessionProgress && (
          <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', marginBottom: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {activeSession!.subjectDisplay} Session
                {sessionProgress.phase === 'review-wrong' ? ` — Review Round ${sessionProgress.round}` : ''}
              </span>
              <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => {
                // Pause & Save
                saveSessionToStorage(activeSession!)
                setActiveQuiz(null)
              }}>
                <Save size={12} /> Pause & Save
              </button>
            </div>
            <div className="progress-bar" style={{ height: 6, marginBottom: 6 }}>
              <div className="progress-fill" style={{ width: `${sessionProgress.pct}%`, transition: 'width 0.3s', background: sessionProgress.phase === 'review-wrong' ? '#f59e0b' : 'var(--accent)' }} />
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{sessionProgress.answered}/{sessionProgress.total} answered</span>
              {sessionProgress.wrong > 0 && <span style={{ color: '#ef4444' }}>{sessionProgress.wrong} wrong</span>}
              <span>{sessionProgress.remaining} remaining</span>
            </div>
          </div>
        )}
        <QuizPlayer
          key={isSessionBatch ? `session-${activeSession!.id}-${activeSession!.batchNumber}` : 'oneshot'}
          quiz={activeQuiz}
          onComplete={isSessionBatch ? handleSessionBatchComplete : (attempt) => {
            saveFinalAttempt(attempt)
            setActiveQuiz(null)
            setSelectedAttempt(attempt)
          }}
          onCancel={() => {
            if (isSessionBatch) {
              // Pause session, don't delete it
              saveSessionToStorage(activeSession!)
            }
            setActiveQuiz(null)
          }}
          onAnswer={isSessionBatch ? handleSessionAnswer : undefined}
        />
      </div>
    )
  }

  // Failsafe 12: Tab conflict warning
  if (sessionConflict && activeSession) {
    return (
      <div className="animate-in" style={{ textAlign: 'center', padding: 40 }}>
        <AlertCircle size={32} style={{ color: '#f59e0b', marginBottom: 12 }} />
        <h3>Session Active in Another Tab</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 16px' }}>
          A {activeSession.subjectDisplay} session ({activeSession.answeredKeys.length}/{activeSession.allQuestionKeys.length} answered) may be running in another tab.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => {
            setSessionConflict(false)
            const updated = { ...activeSession, tabId: TAB_ID }
            setActiveSession(updated)
            saveSessionToStorage(updated)
            const batch = buildBatchFromSession(updated)
            if (batch) setActiveQuiz(batch)
          }}>Take Over Session</button>
          <button className="btn" onClick={() => {
            setSessionConflict(false)
            setActiveSession(null)
          }}>Ignore</button>
        </div>
      </div>
    )
  }

  // Pending resume prompt — user must explicitly choose to resume or dismiss
  if (pendingResume && activeSession && activeSession.phase !== 'complete') {
    const answered = activeSession.answeredKeys.length
    const total = activeSession.phase === 'review-wrong' ? activeSession.wrongKeys.length : activeSession.allQuestionKeys.length
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0
    return (
      <div className="animate-in" style={{ textAlign: 'center', padding: 40 }}>
        <BookOpen size={32} style={{ color: 'var(--accent)', marginBottom: 12 }} />
        <h3>Resume Session?</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '8px 0 4px' }}>
          You have an unfinished <strong>{activeSession.subjectDisplay}</strong> session.
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, margin: '0 0 16px' }}>
          {answered}/{total} answered ({pct}%){activeSession.phase === 'review-wrong' ? ' — Review Round' : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => {
            setPendingResume(false)
            const updated = { ...activeSession, tabId: TAB_ID }
            setActiveSession(updated)
            saveSessionToStorage(updated)
            const batch = buildBatchFromSession(updated)
            if (batch) {
              setActiveQuiz(batch)
              setTab('bank')
            }
          }}>Resume Session</button>
          <button className="btn" onClick={() => {
            setPendingResume(false)
            saveSessionToStorage(null)
            setActiveSession(null)
          }}>Start Fresh</button>
        </div>
      </div>
    )
  }

  // Session complete screen
  if (activeSession && activeSession.phase === 'complete') {
    return <SessionComplete session={activeSession} onNewSession={() => {
      saveSessionToStorage(null)
      setActiveSession(null)
      setTab('bank')
    }} onReviewMistakes={() => {
      if (activeSession.wrongKeys.length === 0) return
      const questions = activeSession.wrongKeys
        .map(k => activeSession.questionSnapshots[k])
        .filter(Boolean)
      setActiveQuiz({
        questions, name: `${activeSession.subjectDisplay} Review`,
        subject: activeSession.subjectDisplay, subtopic: 'Mistakes Review',
      })
      saveSessionToStorage(null)
      setActiveSession(null)
    }} onBack={() => {
      saveSessionToStorage(null)
      setActiveSession(null)
      setTab('bank')
    }} />
  }

  // If viewing a specific quiz detail, show that instead
  if (selectedAttempt) {
    return <QuizDetail attempt={selectedAttempt} onBack={() => setSelectedAttempt(null)} onRetake={(attempt) => {
      // Build PlayableQuiz from attempt's questions or answers
      let questions: PlayableQuiz['questions'] = []
      // Try from attempt.questions first (saved/imported quizzes)
      if (attempt.questions && Array.isArray(attempt.questions) && (attempt.questions as any[]).length > 0) {
        questions = (attempt.questions as any[]).map(q => ({
          question: q.question || q.q || '',
          correctAnswer: q.correctAnswer || q.answer || '',
          options: Array.isArray(q.options) ? q.options : undefined,
          type: q.type || 'multiple-choice',
          explanation: q.explanation,
        })).filter(q => q.question && q.correctAnswer)
      }
      // Fallback: reconstruct from answers (taken quizzes)
      if (questions.length === 0 && (attempt.answers?.length || 0) > 0) {
        questions = (attempt.answers || []).map(a => ({
          question: a.question.question,
          correctAnswer: a.question.correctAnswer,
          options: a.question.options,
          type: a.question.type || 'multiple-choice',
          explanation: a.question.explanation,
        })).filter(q => q.question && q.correctAnswer)
      }
      if (questions.length > 0) {
        setActiveQuiz({ questions, name: attempt.name, subject: attempt.subject, subtopic: attempt.subtopic })
        setSelectedAttempt(null)
      }
    }} />
  }

  return (
    <div className="animate-in">
      <div className="mb-5">
        <h1 className="page-title">Quizzes</h1>
        <p className="page-subtitle">Create, manage, and review your quizzes</p>
      </div>

      {/* Sub-tab navigation */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)',
        padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)'
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 6px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'create' && <CreateTab onPlay={setActiveQuiz} />}
      {tab === 'bank' && <BankTab onPlay={setActiveQuiz} folders={folders} folderMap={folderMap} folderActions={sharedFolderActions}
        activeSession={activeSession}
        onStartSession={(subject, subjectDisplay, questions) => {
          // Failsafe 4: Only 1 session at a time
          if (activeSession && activeSession.phase !== 'complete') {
            if (!confirm(`Abandon current ${activeSession.subjectDisplay} session and start new?`)) return
          }
          const keys = questions.map(q => q.question.substring(0, 80))
          const shuffled = [...keys].sort(() => Math.random() - 0.5)
          const snapshots: ProgressiveQuizSession['questionSnapshots'] = {}
          questions.forEach(q => {
            const key = q.question.substring(0, 80)
            snapshots[key] = { question: q.question, correctAnswer: q.correctAnswer, options: q.options, type: q.type, explanation: q.explanation }
          })
          const session: ProgressiveQuizSession = {
            id: Date.now().toString(36),
            tabId: TAB_ID,
            subject, subjectDisplay,
            startedAt: new Date().toISOString(),
            lastActivityAt: new Date().toISOString(),
            allQuestionKeys: shuffled,
            answeredKeys: [], wrongKeys: [], answers: [],
            phase: 'initial', reviewRound: 0, batchNumber: 0,
            questionSnapshots: snapshots,
          }
          saveSessionToStorage(session)
          setActiveSession(session)
          activeSessionRef.current = session
          partialBatchAnswersRef.current = []
          const batch = buildBatchFromSession(session)
          if (batch) setActiveQuiz(batch)
        }}
        onResumeSession={() => {
          if (!activeSession || activeSession.phase === 'complete') return
          const updated = { ...activeSession, tabId: TAB_ID }
          setActiveSession(updated)
          activeSessionRef.current = updated
          saveSessionToStorage(updated)
          partialBatchAnswersRef.current = []
          const batch = buildBatchFromSession(updated)
          if (batch) setActiveQuiz(batch)
        }}
        onAbandonSession={() => {
          if (confirm('Abandon this session? All progress will be lost.')) {
            saveSessionToStorage(null)
            setActiveSession(null)
          }
        }}
      />}
      {tab === 'history' && <HistoryTab onSelectAttempt={setSelectedAttempt} onPlay={setActiveQuiz} folders={folders} folderMap={folderMap} folderActions={sharedFolderActions} />}
      {tab === 'merge' && <MergeTab />}
    </div>
  )
}

/* ================================================================
   CREATE TAB
   ================================================================ */
function CreateTab({ onPlay }: { onPlay: (quiz: PlayableQuiz) => void }) {
  const { courses, data, setData, updatePluginData } = useStore()

  const [quizName, setQuizName] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(() => parseInt(localStorage.getItem('nousai-pref-quiz-count') || '20'))
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium')
  const [questionTypes, setQuestionTypes] = useState({
    multipleChoice: true,
    trueFalse: true,
    shortAnswer: true,
    fillBlank: false,
  })
  const [sourceText, setSourceText] = useState('')
  const [useAI, setUseAI] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([])
  // Manual entry
  const [manualMode, setManualMode] = useState(false)
  const [manualQuestions, setManualQuestions] = useState<{ question: string; answer: string; options: string; type: 'multiple_choice' | 'true_false' | 'short_answer' }[]>([
    { question: '', answer: '', options: '', type: 'multiple_choice' },
  ])
  const [showNotePicker, setShowNotePicker] = useState(false)

  // Load lecture notes for the selected course
  const courseNotes = useMemo(() => {
    if (!selectedCourse) return []
    const courseObj = courses.find(c => c.id === selectedCourse || c.shortName === selectedCourse)
    if (!courseObj) return []
    try {
      const raw = localStorage.getItem(`nousai-lectures-${courseObj.id}`)
      return raw ? JSON.parse(raw) as { id: string; title: string; content: string; createdAt: string; updatedAt: string }[] : []
    } catch { return [] }
  }, [selectedCourse, courses])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  // Import section state
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState<'json' | 'text' | 'csv'>('json')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)

  const selectedCourseObj = courses.find(c => c.id === selectedCourse || c.shortName === selectedCourse)
  const topics = selectedCourseObj?.topics || []

  function toggleType(key: keyof typeof questionTypes) {
    setQuestionTypes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  const getTypes = useCallback((): QuestionType[] => {
    const t: QuestionType[] = []
    if (questionTypes.multipleChoice) t.push('multiple_choice')
    if (questionTypes.trueFalse) t.push('true_false')
    if (questionTypes.shortAnswer) t.push('short_answer')
    if (questionTypes.fillBlank) t.push('fill_blank')
    return t.length ? t : ['multiple_choice']
  }, [questionTypes])

  const generateWithAI = useCallback(async () => {
    if (!isAIConfigured()) {
      setGenError('AI not configured. Go to Settings → AI Provider to set up your API key.')
      return
    }
    setGenerating(true)
    setGenError('')
    try {
      const diffMap = { easy: 1, medium: 3, hard: 5, mixed: undefined }
      const source = sourceText.trim() ||
        (selectedCourseObj?.flashcards || []).map(f => `${f.front}: ${f.back}`).join('\n') ||
        'General knowledge quiz'
      const prompt = buildQuizPrompt(
        { count: questionCount, types: getTypes(), difficulty: diffMap[difficulty], focusArea: selectedTopic || undefined },
        source,
      )
      const response = await callAI([{ role: 'user', content: prompt }], { json: true })
      const questions = parseAIQuizResponse(response)
      if (questions.length === 0) {
        setGenError('AI returned no valid questions. Try adding more source material or adjusting settings.')
      } else {
        setGeneratedQuestions(questions)
      }
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate quiz')
    }
    setGenerating(false)
  }, [sourceText, selectedCourseObj, questionCount, getTypes, difficulty, selectedTopic])

  const addManualQuestion = () => {
    setManualQuestions(prev => [...prev, { question: '', answer: '', options: '', type: 'multiple_choice' }])
  }

  const updateManualQ = (idx: number, field: string, value: string) => {
    setManualQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const removeManualQ = (idx: number) => {
    setManualQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const buildFromManual = () => {
    const questions: QuizQuestion[] = manualQuestions
      .filter(q => q.question.trim() && q.answer.trim())
      .map((q, i) => ({
        id: `manual-${Date.now()}-${i}`,
        question: q.question.trim(),
        type: q.type,
        answer: q.answer.trim(),
        options: q.type === 'multiple_choice' ? q.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      }))
    if (questions.length === 0) {
      setGenError('Add at least one question with a question and answer.')
      return
    }
    setGeneratedQuestions(questions)
  }

  const parseBulkText = () => {
    if (!bulkText.trim()) return
    const blocks = bulkText.split('---').map(b => b.trim()).filter(Boolean)
    const parsed: typeof manualQuestions = []
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      let question = '', answer = '', options = '', type: 'multiple_choice' | 'true_false' | 'short_answer' = 'short_answer'
      for (const line of lines) {
        if (/^Q:\s*/i.test(line)) question = line.replace(/^Q:\s*/i, '').trim()
        else if (/^A:\s*/i.test(line)) answer = line.replace(/^A:\s*/i, '').trim()
        else if (/^Options:\s*/i.test(line)) options = line.replace(/^Options:\s*/i, '').trim()
        else if (/^Type:\s*/i.test(line)) {
          const t = line.replace(/^Type:\s*/i, '').trim().toLowerCase()
          if (t === 'multiple_choice' || t === 'true_false' || t === 'short_answer') type = t
        }
      }
      if (!question || !answer) continue
      if (options && type === 'short_answer') type = 'multiple_choice'
      parsed.push({ question, answer, options, type })
    }
    if (parsed.length === 0) {
      setGenError('No valid questions found. Use the format: Q: ... / A: ... separated by ---')
      return
    }
    // Append to existing manual questions (replace the initial empty one if it's blank)
    setManualQuestions(prev => {
      const existing = prev.filter(q => q.question.trim() || q.answer.trim())
      return [...existing, ...parsed]
    })
    setBulkText('')
    setBulkMode(false)
    setGenError('')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportText(text)
      try { JSON.parse(text); setImportFormat('json') } catch {
        setImportFormat(text.includes(',') && text.includes('\n') ? 'csv' : 'text')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    if (!importText.trim() || !data) { setImportStatus('error'); setImportMessage('No data to import.'); return }
    try {
      let parsedQs: { question: string; correctAnswer: string; options?: string[]; type: string; explanation?: string }[] = []
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        parsedQs = items.map((item: Record<string, unknown>) => ({
          question: String(item.question || item.q || ''),
          correctAnswer: String(item.correctAnswer || item.answer || item.a || ''),
          options: Array.isArray(item.options) ? item.options.map(String) : undefined,
          type: String(item.type || 'multiple-choice'),
          explanation: item.explanation ? String(item.explanation) : undefined,
        })).filter(q => q.question && q.correctAnswer)
      } else if (importFormat === 'csv') {
        const lines = importText.trim().split('\n')
        if (lines.length < 2) throw new Error('CSV must have header + data rows')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
        parsedQs = lines.slice(1).map(line => {
          const vals: string[] = []; let cur = '', inQ = false
          for (const ch of line) { if (ch === '"') { inQ = !inQ; continue } if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue } cur += ch }
          vals.push(cur.trim())
          const row: Record<string, string> = {}; headers.forEach((h, i) => { row[h] = vals[i] || '' })
          const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean)
          return { question: row.question || '', correctAnswer: row.correctanswer || row.answer || '', options: opts.length ? opts : undefined, type: row.type || 'multiple-choice', explanation: row.explanation || undefined }
        }).filter(q => q.question && q.correctAnswer)
      } else {
        parsedQs = importText.trim().split(/\n\n+/).map(pair => {
          const lines = pair.split('\n').map(l => l.trim()).filter(Boolean)
          if (lines.length < 2) return null
          return { question: lines[0].replace(/^Q:\s*/i, ''), correctAnswer: lines[1].replace(/^A:\s*/i, ''), type: 'short-answer', explanation: lines.length > 2 ? lines.slice(2).join(' ') : undefined }
        }).filter((q): q is NonNullable<typeof q> => q !== null && !!q.question && !!q.correctAnswer)
      }
      if (parsedQs.length === 0) { setImportStatus('error'); setImportMessage('No valid questions found.'); return }
      const answers: QuizAnswer[] = parsedQs.map(q => ({ question: { type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation }, userAnswer: '', correct: false, timeMs: 0 }))
      const attempt: QuizAttempt = {
        id: 'import-' + Date.now(), name: quizName.trim() || `Imported Quiz ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        subject: selectedCourseObj?.shortName || 'Imported', subtopic: selectedTopic || '',
        date: new Date().toISOString(), questionCount: parsedQs.length, score: -1, correct: 0, mode: 'imported', questions: parsedQs, answers,
      }
      updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
      setImportStatus('success'); setImportMessage(`Imported ${parsedQs.length} questions as "${attempt.name}".`); setImportText('')
    } catch (err) { setImportStatus('error'); setImportMessage(`Import failed: ${err instanceof Error ? err.message : 'Invalid format.'}`) }
  }

  const saveQuiz = useCallback(() => {
    if (!data || generatedQuestions.length === 0) return
    const name = quizName.trim() || `Quiz ${new Date().toLocaleDateString()}`
    const attempt: QuizAttempt = {
      id: `quiz-${Date.now()}`,
      name,
      subject: selectedCourseObj?.shortName || selectedCourseObj?.name || selectedCourse || 'General',
      subtopic: selectedTopic || '',
      date: new Date().toISOString(),
      questionCount: generatedQuestions.length,
      score: -1,
      correct: 0,
      mode: manualMode ? 'manual' : 'ai-generated',
      questions: generatedQuestions,
      answers: [],
    }
    updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
    setGeneratedQuestions([])
    setQuizName('')
    setSourceText('')
    setGenError('')
  }, [data, setData, generatedQuestions, quizName, selectedCourse, selectedTopic, manualMode, selectedCourseObj])

  // Show generated questions review
  if (generatedQuestions.length > 0) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            Generated {generatedQuestions.length} Questions
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setGeneratedQuestions([])}>
              <ChevronLeft size={13} /> Back
            </button>
            <button className="btn btn-sm" onClick={saveQuiz}>
              <Save size={13} /> Save to Bank
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const playable = {
                questions: generatedQuestions.map(q => ({
                  question: q.question,
                  correctAnswer: q.answer,
                  options: q.options,
                  type: q.type,
                  explanation: q.explanation,
                })),
                name: quizName || `Quiz ${new Date().toLocaleDateString()}`,
                subject: selectedCourseObj?.shortName || selectedCourseObj?.name || selectedCourse || 'General',
                subtopic: selectedTopic,
              }
              // Auto-save to bank so questions are never lost
              saveQuiz()
              onPlay(playable)
            }}>
              <Play size={13} /> Play Quiz
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {generatedQuestions.map((q, i) => (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Q{i + 1}</span>
                <span className="badge" style={{ fontSize: 10 }}>{q.type.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{q.question}</div>
              {q.options && q.options.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {q.options.map((o, j) => (
                    <div key={j} style={{ padding: '2px 0', color: o === q.answer ? 'var(--green)' : undefined, fontWeight: o === q.answer ? 700 : 400 }}>
                      {String.fromCharCode(65 + j)}. {o}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Answer: {q.answer}</div>
              {q.explanation && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{q.explanation}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mode toggle: AI vs Manual */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`btn btn-sm ${!manualMode ? 'btn-primary' : ''}`} onClick={() => setManualMode(false)}>
          <Layers size={13} /> AI Generate
        </button>
        <button className={`btn btn-sm ${manualMode ? 'btn-primary' : ''}`} onClick={() => setManualMode(true)}>
          <Edit3 size={13} /> Manual Entry
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Quiz Settings</span>
        </div>

        {/* Quiz name */}
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Quiz Name</div>
          <input type="text" value={quizName} onChange={e => setQuizName(e.target.value)}
            placeholder="e.g., Biology Ch.5 Review" style={inputStyle} />
        </div>

        {/* Course + Topic */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Course / Subject</div>
            <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedTopic('') }} style={inputStyle}>
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Topic</div>
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} style={inputStyle}>
              <option value="">All topics</option>
              {topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {!manualMode && (
          <>
            {/* Question count + Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Number of Questions</div>
                <input type="number" value={questionCount} onChange={e => setQuestionCount(+e.target.value)} min={1} max={50} style={inputStyle} />
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Difficulty</div>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} style={inputStyle}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            {/* Question types */}
            <div style={{ marginBottom: 14 }}>
              <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Question Types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {([
                  ['multipleChoice', 'Multiple Choice'],
                  ['trueFalse', 'True/False'],
                  ['shortAnswer', 'Short Answer'],
                  ['fillBlank', 'Fill in the Blank'],
                ] as const).map(([key, label]) => (
                  <button key={key}
                    onClick={() => toggleType(key)}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                      border: questionTypes[key] ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: questionTypes[key] ? 'var(--accent-glow)' : 'var(--bg-card)',
                      color: questionTypes[key] ? 'var(--accent-light)' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit'
                    }}
                  >
                    {questionTypes[key] && <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {!manualMode ? (
        <>
          {/* Source material for AI */}
          <div className="card mb-4">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title"><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Source Material</span>
              {courseNotes.length > 0 && (
                <button className="btn btn-sm" onClick={() => setShowNotePicker(!showNotePicker)}
                  style={{ fontSize: 11 }}>
                  <FileText size={12} /> Load from Notes ({courseNotes.length})
                </button>
              )}
            </div>
            {showNotePicker && courseNotes.length > 0 && (
              <div style={{ marginBottom: 10, maxHeight: 200, overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <button
                  onClick={() => {
                    const allText = courseNotes.map(n => {
                      const plain = n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                      return `--- ${n.title} ---\n${plain}`
                    }).join('\n\n')
                    setSourceText(allText)
                    setShowNotePicker(false)
                  }}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--accent-glow)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', textAlign: 'left', fontFamily: 'inherit' }}>
                  📚 Load ALL Notes ({courseNotes.length} notes)
                </button>
                {courseNotes.map(note => (
                  <button key={note.id}
                    onClick={() => {
                      const plain = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                      setSourceText(prev => prev ? `${prev}\n\n--- ${note.title} ---\n${plain}` : `--- ${note.title} ---\n${plain}`)
                      setShowNotePicker(false)
                    }}
                    style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{note.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80)}...
                    </div>
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={sourceText} onChange={e => setSourceText(e.target.value)}
              placeholder="Paste notes, textbook content, or lecture transcript here for AI to generate questions from..."
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
            />
            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
              {selectedCourse && courseNotes.length > 0
                ? 'Click "Load from Notes" to use your lecture notes, or paste material manually.'
                : 'Paste study material above, or leave empty to generate from course flashcards.'}
            </div>
          </div>

          {genError && (
            <div style={{ padding: 10, marginBottom: 12, borderRadius: 'var(--radius-sm)', background: genError.includes('not configured') ? 'var(--bg-card)' : 'var(--red-dim)', border: `1px solid ${genError.includes('not configured') ? 'var(--border)' : 'var(--red)'}`, fontSize: 12, color: genError.includes('not configured') ? 'var(--text-muted)' : 'var(--red)' }}>
              <AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{genError}
            </div>
          )}

          <button className="btn btn-primary btn-full" style={{ marginBottom: 8 }} onClick={generateWithAI} disabled={generating}>
            {generating ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Plus size={16} /> Generate Quiz with AI</>}
          </button>
          {!isAIConfigured() && (
            <div className="text-xs text-muted text-center" style={{ marginBottom: 8 }}>
              Configure AI in Settings → AI Provider to enable generation.
            </div>
          )}

          {/* Copy Prompt + Paste AI Response (manual fallback) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => {
              const courseName = selectedCourseObj?.name || selectedCourseObj?.shortName || 'General'
              const topicName = selectedTopic || 'all topics'
              const types = getTypes().map(t => t.replace('_', ' ')).join(', ')
              const prompt = `Generate a quiz with the following specifications:

- **Course**: ${courseName}
- **Topic**: ${topicName}
- **Number of Questions**: ${questionCount}
- **Difficulty**: ${difficulty}
- **Question Types**: ${types}
${sourceText.trim() ? `\n**Source Material**:\n${sourceText.trim()}\n` : ''}
Return a JSON array of question objects. Each object must have:
- "question": string (the question text)
- "type": "multiple_choice" | "true_false" | "short_answer"
- "correctAnswer": string (the correct answer)
- "options": string[] (array of 4 choices, required for multiple_choice)
- "explanation": string (brief explanation of the answer)

Example format:
[
  {
    "question": "What is...?",
    "type": "multiple_choice",
    "correctAnswer": "Answer A",
    "options": ["Answer A", "Answer B", "Answer C", "Answer D"],
    "explanation": "Because..."
  }
]

Return ONLY the JSON array, no other text.`
              navigator.clipboard.writeText(prompt).then(() => {
                setPromptCopied(true)
                setTimeout(() => setPromptCopied(false), 2000)
              })
            }}>
              <Copy size={13} /> {promptCopied ? 'Copied!' : 'Copy Prompt'}
            </button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setPasteText(prev => prev ? '' : ' ')}>
              <FileText size={13} /> Paste AI Response
            </button>
          </div>

          {pasteText !== '' && (
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={pasteText === ' ' ? '' : pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste the AI-generated JSON response here, then click Parse..."
                style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={() => {
                  const questions = parseAIQuizResponse(pasteText)
                  if (questions.length === 0) {
                    setGenError('Could not parse any questions from the pasted text. Make sure it\'s a valid JSON array.')
                  } else {
                    setGeneratedQuestions(questions)
                    setPasteText('')
                    setGenError('')
                  }
                }}>
                  <Play size={13} /> Parse ({pasteText.trim().length > 0 ? 'ready' : 'paste first'})
                </button>
                <button className="btn btn-sm" onClick={() => setPasteText('')}>
                  <X size={13} /> Close
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual question entry */}
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title"><Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Add Questions</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button className={`btn btn-sm ${!bulkMode ? 'btn-primary' : ''}`} onClick={() => setBulkMode(false)}>
                Single Entry
              </button>
              <button className={`btn btn-sm ${bulkMode ? 'btn-primary' : ''}`} onClick={() => setBulkMode(true)}>
                <Upload size={13} /> Bulk Entry
              </button>
            </div>
            {bulkMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={`Paste multiple questions using this format:\n\nQ: What is mitosis?\nA: Cell division process\n---\nQ: What is DNA?\nA: Deoxyribonucleic acid\nOptions: Deoxyribonucleic acid, Ribonucleic acid, Amino acid, Lipid acid\nType: multiple_choice\n---\nQ: The sun is a star.\nA: True\nType: true_false\n\nSeparate questions with ---\nOptions and Type lines are optional.\nType defaults to short_answer (or multiple_choice if Options given).`}
                  style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
                />
                <button className="btn btn-sm btn-primary" onClick={parseBulkText}>
                  <Plus size={13} /> Parse & Add
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {manualQuestions.map((mq, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Question {i + 1}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select value={mq.type} onChange={e => updateManualQ(i, 'type', e.target.value)}
                            style={{ ...inputStyle, width: 'auto', fontSize: 11, padding: '4px 8px' }}>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="true_false">True/False</option>
                            <option value="short_answer">Short Answer</option>
                          </select>
                          {manualQuestions.length > 1 && (
                            <button onClick={() => removeManualQ(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input value={mq.question} onChange={e => updateManualQ(i, 'question', e.target.value)}
                        placeholder="Question text..." style={{ ...inputStyle, marginBottom: 6 }} />
                      {mq.type === 'multiple_choice' && (
                        <input value={mq.options} onChange={e => updateManualQ(i, 'options', e.target.value)}
                          placeholder="Options (comma-separated, e.g.: Option A, Option B, Option C, Option D)"
                          style={{ ...inputStyle, marginBottom: 6, fontSize: 11 }} />
                      )}
                      <input value={mq.answer} onChange={e => updateManualQ(i, 'answer', e.target.value)}
                        placeholder="Correct answer..." style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-sm mt-3" onClick={addManualQuestion}>
                  <Plus size={13} /> Add Question
                </button>
              </>
            )}
          </div>

          {genError && (
            <div style={{ padding: 10, marginBottom: 12, borderRadius: 'var(--radius-sm)', background: genError.includes('not configured') ? 'var(--bg-card)' : 'var(--red-dim)', border: `1px solid ${genError.includes('not configured') ? 'var(--border)' : 'var(--red)'}`, fontSize: 12, color: genError.includes('not configured') ? 'var(--text-muted)' : 'var(--red)' }}>
              <AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{genError}
            </div>
          )}

          <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }} onClick={buildFromManual}>
            <Plus size={16} /> Create Quiz
          </button>
        </>
      )}

      {/* ── Import Section (collapsed by default) ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <button
          onClick={() => setShowImport(!showImport)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Import Quiz from File
          </span>
          {showImport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showImport && (
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['json', 'text', 'csv'] as const).map(f => (
                <button key={f} onClick={() => setImportFormat(f)} style={{
                  padding: '5px 14px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                  border: importFormat === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: importFormat === f ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: importFormat === f ? 'var(--accent-light)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
                }}>{f}</button>
              ))}
            </div>
            <input ref={importFileRef} type="file" accept=".json,.txt,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
            <button className="btn btn-sm btn-full" style={{ marginBottom: 10 }} onClick={() => importFileRef.current?.click()}>
              <Upload size={13} /> Upload File
            </button>
            <textarea
              value={importText} onChange={e => { setImportText(e.target.value); setImportStatus('idle') }}
              placeholder={importFormat === 'json' ? '[\n  { "question": "...", "correctAnswer": "...", "options": [...] }\n]'
                : importFormat === 'csv' ? 'question,correctAnswer,option1,option2\n"What is...","Answer","A","B"'
                : 'Question text\nAnswer text\n\nNext question\nNext answer'}
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }}
            />
            <button className="btn btn-primary btn-full btn-sm" onClick={handleImport}>
              <Download size={13} /> Import Questions
            </button>
            {importStatus !== 'idle' && (
              <div style={{
                marginTop: 10, padding: 8, borderRadius: 'var(--radius-sm)',
                background: importStatus === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                border: `1px solid ${importStatus === 'success' ? 'var(--green)' : 'var(--red)'}`,
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {importStatus === 'success' ? <CheckCircle size={14} style={{ color: 'var(--green)' }} /> : <AlertCircle size={14} style={{ color: 'var(--red)' }} />}
                {importMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   BANK TAB
   ================================================================ */
interface BankQuestion {
  id: string
  question: string
  correctAnswer: string
  options?: string[]
  type: string
  subject: string
  topic: string
  explanation?: string
}

interface SharedFolderProps {
  folders: QuizFolder[]
  folderMap: Record<string, string>
  folderActions: {
    createFolder: (name: string) => void
    renameFolder: (id: string, name: string) => void
    deleteFolder: (id: string) => void
    assignToFolder: (itemId: string, folderId: string | null) => void
  }
}

function BankTab({ onPlay, folders, folderMap, folderActions, activeSession, onStartSession, onResumeSession, onAbandonSession }: {
  onPlay: (quiz: PlayableQuiz) => void
  activeSession: ProgressiveQuizSession | null
  onStartSession: (subject: string, subjectDisplay: string, questions: BankQuestion[]) => void
  onResumeSession: () => void
  onAbandonSession: () => void
} & SharedFolderProps) {
  const { quizHistory, data, courses, updatePluginData } = useStore()
  const [searchQ, setSearchQ] = useState('')
  const [filterSubject, setFilterSubject] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'default' | 'a-z' | 'type' | 'subject'>('default')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<{ question: string; correctAnswer: string; options?: string[]; explanation?: string }>({ question: '', correctAnswer: '' })

  // Quiz folders - use shared state from parent
  const [filterFolder, setFilterFolder] = useState<string>('all')
  const [showFolderManager, setShowFolderManager] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  // Reset filter if active folder was deleted
  useEffect(() => {
    if (filterFolder !== 'all' && filterFolder !== 'unfiled' && !folders.find(f => f.id === filterFolder)) {
      setFilterFolder('all')
    }
  }, [folders, filterFolder])

  function handleCreateFolder(name: string) {
    folderActions.createFolder(name)
    setNewFolderName('')
  }

  function handleRenameFolder(id: string, name: string) {
    folderActions.renameFolder(id, name)
    setRenamingFolderId(null)
  }

  function handleDeleteFolder(id: string) {
    folderActions.deleteFolder(id)
    if (filterFolder === id) setFilterFolder('all')
  }

  function assignToFolder(questionId: string, folderId: string | null) {
    folderActions.assignToFolder(questionId, folderId)
    setAssigningId(null)
  }

  // Load deleted IDs and edits from localStorage
  const [deletedIds, setDeletedIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('nousai-bank-deleted')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [editsMap, setEditsMap] = useState<Record<string, { question?: string; correctAnswer?: string; options?: string[]; explanation?: string }>>(() => {
    try {
      const stored = localStorage.getItem('nousai-bank-edits')
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  // Recovery: rebuild bank from active session's question snapshots
  function handleRecoverFromSession() {
    if (!activeSession || !data) return
    const snapshots = activeSession.questionSnapshots
    if (!snapshots || Object.keys(snapshots).length === 0) return
    const questions = Object.values(snapshots).map(q => ({
      question: q.question,
      correctAnswer: q.correctAnswer,
      options: q.options,
      type: q.type || 'multiple-choice',
      explanation: q.explanation,
    }))
    const answers: QuizAnswer[] = questions.map(q => ({
      question: { type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation },
      userAnswer: '', correct: false, timeMs: 0
    }))
    const attempt: QuizAttempt = {
      id: `recovered-${Date.now()}`,
      name: `${activeSession.subjectDisplay} (Recovered)`,
      subject: activeSession.subject,
      subtopic: '',
      date: new Date().toISOString(),
      questionCount: questions.length,
      score: -1,
      correct: 0,
      mode: 'imported',
      questions,
      answers,
    }
    updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
  }

  // Extract unique questions from quiz history and quiz bank
  const bankQuestions = useMemo(() => {
    const qMap = new Map<string, BankQuestion>()

    // From quiz history answers
    quizHistory.forEach(attempt => {
      (attempt.answers || []).forEach((a, i) => {
        const qText = a?.question?.question || '';
        if (!qText) return;
        const key = qText.substring(0, 80)
        if (!qMap.has(key)) {
          qMap.set(key, {
            id: `${attempt.id}-${i}`,
            question: qText,
            correctAnswer: a.question?.correctAnswer || '',
            options: a.question?.options,
            type: a.question?.type || 'multiple-choice',
            subject: attempt.subject,
            topic: attempt.subtopic || '',
            explanation: a.question?.explanation
          })
        }
      })
      // Also extract from attempt.questions (for saved/untaken quizzes with answers: [])
      if (attempt.questions && Array.isArray(attempt.questions)) {
        (attempt.questions as any[]).forEach((q, i) => {
          const qText = q?.question || q?.q || ''
          if (!qText) return
          const key = qText.substring(0, 80)
          if (!qMap.has(key)) {
            qMap.set(key, {
              id: `${attempt.id}-q-${i}`,
              question: qText,
              correctAnswer: q.correctAnswer || q.answer || '',
              options: Array.isArray(q.options) ? q.options : undefined,
              type: q.type || 'multiple-choice',
              subject: attempt.subject,
              topic: attempt.subtopic || '',
              explanation: q.explanation,
            })
          }
        })
      }
    })

    // From quiz bank (current format: { quizzes: [{id, name, subject, questions: [...]}], folders: [] })
    if (Array.isArray(data?.pluginData?.quizBank?.quizzes)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.pluginData.quizBank.quizzes.forEach((attempt: any) => {
        if (!Array.isArray(attempt.questions)) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attempt.questions.forEach((q: any, i: number) => {
          const qText = String(q?.question || '')
          if (!qText) return
          const mapKey = qText.substring(0, 80)
          if (!qMap.has(mapKey)) {
            qMap.set(mapKey, {
              id: `qbank-${attempt.id}-${i}`,
              question: qText,
              correctAnswer: String(q?.correctAnswer || q?.answer || ''),
              options: Array.isArray(q?.options) ? q.options as string[] : undefined,
              type: String(q?.type || 'multiple-choice').replace('_', '-'),
              subject: attempt.subject || '',
              topic: attempt.subtopic || '',
              explanation: q?.explanation ? String(q.explanation) : undefined,
            })
          }
        })
      })
    }

    // From course-space quiz banks (nousai-jpquiz-{courseId})
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('nousai-jpquiz-')) continue
      const courseId = key.slice('nousai-jpquiz-'.length)
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const jpData = JSON.parse(raw)
        if (!Array.isArray(jpData?.questions)) continue
        const course = courses.find(c => c.id === courseId)
        const subject = course?.shortName || course?.name || courseId
        jpData.questions.forEach((q: { id: string; questionText: string; expectedAnswer: string; explanation?: string; tags?: string[]; difficulty?: number }) => {
          if (!q.id || !q.questionText) return
          const bankId = `jpq-${courseId}-${q.id}`
          if (!qMap.has(bankId)) {
            qMap.set(bankId, {
              id: bankId,
              question: q.questionText,
              correctAnswer: q.expectedAnswer || '',
              options: undefined,
              type: 'short-answer',
              subject,
              topic: Array.isArray(q.tags) && q.tags.length ? q.tags.join(', ') : '',
              explanation: q.explanation,
            })
          }
        })
      } catch { /* ignore corrupt keys */ }
    }

    // Filter out deleted and apply edits
    let results = Array.from(qMap.values()).filter(q => !deletedIds.has(q.id))
    results = results.map(q => {
      const edit = editsMap[q.id]
      if (edit) {
        return { ...q, ...edit }
      }
      return q
    })
    return results
  }, [quizHistory, data, deletedIds, editsMap])

  // Get unique subjects
  const subjects = useMemo(() => {
    const set = new Set(bankQuestions.map(q => q.subject).filter(Boolean))
    return Array.from(set).sort()
  }, [bankQuestions])

  // Filter and sort
  const filtered = useMemo(() => {
    let list = bankQuestions
    if (filterSubject !== 'all') list = list.filter(q => q.subject === filterSubject)
    if (filterFolder !== 'all') {
      if (filterFolder === 'unfiled') {
        list = list.filter(q => !folderMap[q.id])
      } else {
        list = list.filter(q => folderMap[q.id] === filterFolder)
      }
    }
    if (searchQ) {
      const s = searchQ.toLowerCase()
      list = list.filter(q => q.question.toLowerCase().includes(s) || q.topic.toLowerCase().includes(s))
    }
    // Sort
    if (sortBy === 'a-z') list = [...list].sort((a, b) => a.question.localeCompare(b.question))
    else if (sortBy === 'type') list = [...list].sort((a, b) => a.type.localeCompare(b.type))
    else if (sortBy === 'subject') list = [...list].sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic))
    return list
  }, [bankQuestions, filterSubject, filterFolder, folderMap, searchQ, sortBy])

  // Delete a question
  function handleDelete(id: string) {
    const next = new Set(deletedIds)
    next.add(id)
    setDeletedIds(next)
    localStorage.setItem('nousai-bank-deleted', JSON.stringify(Array.from(next)))
    if (expandedId === id) setExpandedId(null)
    if (editingId === id) setEditingId(null)
  }

  // Start editing
  function startEdit(q: BankQuestion) {
    setEditingId(q.id)
    setEditDraft({
      question: q.question,
      correctAnswer: q.correctAnswer,
      options: q.options ? [...q.options] : undefined,
      explanation: q.explanation || ''
    })
  }

  // Save edit
  function saveEdit(id: string) {
    const next = { ...editsMap, [id]: { ...editDraft } }
    setEditsMap(next)
    localStorage.setItem('nousai-bank-edits', JSON.stringify(next))
    setEditingId(null)
  }

  // Export all questions as JSON
  function handleExport() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quiz-bank-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Group by subject -> topic
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, BankQuestion[]>>()
    filtered.forEach(q => {
      const subj = q.subject || 'Uncategorized'
      const topic = q.topic || 'General'
      if (!map.has(subj)) map.set(subj, new Map())
      const topicMap = map.get(subj)!
      if (!topicMap.has(topic)) topicMap.set(topic, [])
      topicMap.get(topic)!.push(q)
    })
    return map
  }, [filtered])

  // Map raw subject keys to friendly display names
  const friendlySubject = useCallback((raw: string) => {
    const low = raw.toLowerCase()
    const course = courses.find(co => co.shortName === raw || co.id === raw || co.name === raw
      || co.shortName?.toLowerCase() === low || co.name.toLowerCase() === low)
    if (course) return course.shortName || course.name
    if (low === 'katakana') return 'Katakana'
    if (low.includes('biol 4230') || low.includes('4230/8236') || low.includes('evolution')) return 'Evolution'
    if (low.includes('biol 3020') || low.includes('cell') || low.includes('molecular')) return 'Molecular Biology'
    if (low === 'quizzes' || low === 'general') return 'General'
    if (low === 'imported') return 'Imported'
    if (low.includes('japn') || low === 'japanese') return 'Japanese'
    return raw
  }, [courses])

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit'
  }

  return (
    <div>
      {/* Search + filter bar */}
      <div className="flex gap-2 mb-4">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search questions..."
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34 }} />
        </div>
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} style={{ ...inputStyle, width: 'auto' }}>
          <option value="all">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{friendlySubject(s)}</option>)}
        </select>
      </div>

      {/* Folder bar */}
      <div className="flex gap-2 mb-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Folder size={14} style={{ color: 'var(--text-muted)' }} />
        <button onClick={() => setFilterFolder('all')} style={{
          padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          border: filterFolder === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
          background: filterFolder === 'all' ? 'var(--accent-glow)' : 'transparent',
          color: filterFolder === 'all' ? 'var(--accent-light)' : 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'inherit'
        }}>All</button>
        {folders.map(f => (
          <button key={f.id} onClick={() => setFilterFolder(f.id)} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
            border: filterFolder === f.id ? `1px solid ${f.color}` : '1px solid var(--border)',
            background: filterFolder === f.id ? `${f.color}22` : 'transparent',
            color: filterFolder === f.id ? f.color : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
            {f.name}
            <span style={{ opacity: 0.6 }}>({bankQuestions.filter(q => folderMap[q.id] === f.id).length})</span>
          </button>
        ))}
        <button onClick={() => setFilterFolder('unfiled')} style={{
          padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          border: filterFolder === 'unfiled' ? '1px solid var(--border)' : '1px solid var(--border)',
          background: filterFolder === 'unfiled' ? 'var(--bg-input)' : 'transparent',
          color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit'
        }}>Unfiled</button>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowFolderManager(!showFolderManager)} style={{
          padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          border: '1px solid var(--border)', background: showFolderManager ? 'var(--accent-glow)' : 'transparent',
          color: showFolderManager ? 'var(--accent-light)' : 'var(--text-muted)',
          cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4
        }}>
          <FolderPlus size={12} /> Manage
        </button>
      </div>

      {/* Folder Manager Panel */}
      {showFolderManager && (
        <div className="card mb-4" style={{ padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <FolderPlus size={14} /> Quiz Folders
          </div>
          {/* Create new folder */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <input type="text" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name..." onKeyDown={e => e.key === 'Enter' && handleCreateFolder(newFolderName)}
              style={{ ...inputStyle, flex: 1 }} />
            <button className="btn btn-sm btn-primary" onClick={() => handleCreateFolder(newFolderName)} disabled={!newFolderName.trim()}>
              <Plus size={13} /> Create
            </button>
          </div>
          {/* List existing folders */}
          {folders.length === 0 ? (
            <div className="text-xs text-muted">No folders yet. Create one above to organize your questions.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {folders.map(f => {
                const count = bankQuestions.filter(q => folderMap[q.id] === f.id).length
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-primary)'
                  }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                    {renamingFolderId === f.id ? (
                      <input type="text" value={renameDraft} onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRenameFolder(f.id, renameDraft); if (e.key === 'Escape') setRenamingFolderId(null) }}
                        onBlur={() => handleRenameFolder(f.id, renameDraft)}
                        autoFocus
                        style={{ ...inputStyle, flex: 1, padding: '4px 8px', fontSize: 12 }} />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{f.name}</span>
                    )}
                    <span className="text-xs text-muted">{count} Q</span>
                    <button onClick={() => { setRenamingFolderId(f.id); setRenameDraft(f.name) }} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex'
                    }}><Edit3 size={12} /></button>
                    <button onClick={() => handleDeleteFolder(f.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-muted)', display: 'flex'
                    }}><Trash2 size={12} /></button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sort + Export bar */}
      <div className="flex gap-2 mb-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="text-xs text-muted">Sort:</span>
        {(['default', 'a-z', 'type', 'subject'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
            border: sortBy === s ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: sortBy === s ? 'var(--accent-glow)' : 'transparent',
            color: sortBy === s ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
          }}>{s === 'a-z' ? 'A-Z' : s}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm"
          style={{ fontSize: 11, padding: '5px 12px', opacity: filtered.length === 0 ? 0.4 : 1 }}
          disabled={filtered.length === 0}
          onClick={() => {
            const shuffled = [...filtered].sort(() => Math.random() - 0.5)
            onPlay({
              questions: shuffled.map(q => ({ question: q.question, correctAnswer: q.correctAnswer, options: q.options, type: q.type, explanation: q.explanation })),
              name: `Bank Quiz`,
              subject: filterSubject === 'all' ? 'All Subjects' : friendlySubject(filterSubject),
              subtopic: '',
            })
          }}
          title="Play all visible questions immediately">
          <Play size={12} /> Play All ({filtered.length})
        </button>
        {activeSession && activeSession.subject === '__bank_all__' && activeSession.phase !== 'complete' ? (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px', background: 'var(--accent)', color: '#fff' }} onClick={onResumeSession}>
              <RefreshCw size={11} /> Resume ({activeSession.answeredKeys.length}/{activeSession.allQuestionKeys.length})
            </button>
            <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 8px', color: '#ef4444' }} onClick={onAbandonSession}>
              <X size={11} />
            </button>
          </div>
        ) : (
          <button className="btn btn-sm"
            style={{ fontSize: 11, padding: '5px 12px', opacity: filtered.length === 0 ? 0.4 : 1 }}
            disabled={filtered.length === 0}
            onClick={() => onStartSession('__bank_all__', 'All Questions', filtered)}
            title="Start a progressive study session with all visible questions">
            <BarChart3 size={12} /> Study All ({filtered.length})
          </button>
        )}
        <button onClick={handleExport} style={{
          padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
          border: '1px solid var(--border)', background: 'transparent',
          color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', gap: 4
        }}>
          <Download size={12} /> Export
        </button>
      </div>

      {/* Session resume banner */}
      {activeSession && activeSession.phase !== 'complete' && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: 12, background: 'var(--bg-elevated)', border: '1px solid var(--accent)', borderRadius: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                {activeSession.subjectDisplay} Session in Progress
                {activeSession.phase === 'review-wrong' ? ` (Review Round ${activeSession.reviewRound})` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {activeSession.answeredKeys.length}/{activeSession.allQuestionKeys.length} answered
                {activeSession.wrongKeys.length > 0 && <span style={{ color: '#ef4444' }}> · {activeSession.wrongKeys.length} wrong</span>}
                {' · '}{activeSession.phase === 'initial'
                  ? `${activeSession.allQuestionKeys.length - activeSession.answeredKeys.length} remaining`
                  : `${activeSession.wrongKeys.length - activeSession.answeredKeys.length} to review`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-primary btn-sm" onClick={onResumeSession}>
                <Play size={12} /> Resume
              </button>
              <button className="btn btn-sm" style={{ color: '#ef4444' }} onClick={onAbandonSession}>
                Abandon
              </button>
            </div>
          </div>
          <div className="progress-bar" style={{ height: 4, marginTop: 8 }}>
            <div className="progress-fill" style={{ width: `${activeSession.allQuestionKeys.length > 0 ? Math.round((activeSession.answeredKeys.length / activeSession.allQuestionKeys.length) * 100) : 0}%` }} />
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <span className="badge badge-accent">{filtered.length} questions</span>
        <span className="badge badge-blue">{subjects.length} subjects</span>
      </div>

      {/* Recovery banner: session has questions but bank is empty */}
      {bankQuestions.length === 0 && activeSession && Object.keys(activeSession.questionSnapshots || {}).length > 0 && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12, border: '1px solid #f59e0b', borderRadius: 8, background: 'rgba(245,158,11,0.08)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', marginBottom: 4 }}>
            Bank questions missing — recovery available
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
            Your {Object.keys(activeSession.questionSnapshots).length} questions from the <strong>{activeSession.subjectDisplay}</strong> session
            are still available. Click below to restore them to the bank.
          </div>
          <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#000', fontWeight: 700, border: 'none' }}
            onClick={handleRecoverFromSession}>
            <RefreshCw size={12} /> Recover {Object.keys(activeSession.questionSnapshots).length} Questions
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <FolderOpen />
          <h3>Question Bank Empty</h3>
          <p>Take quizzes or import questions to build your bank.</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([subject, topicMap]) => {
          const subjectQCount = Array.from(topicMap.values()).reduce((acc, arr) => acc + arr.length, 0)
          return (
          <div key={subject} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <h3 className="section-title" style={{ fontSize: 14, marginBottom: 0 }}>
                <FolderOpen size={16} /> {friendlySubject(subject)}
                <span className="badge badge-accent" style={{ marginLeft: 8 }}>{subjectQCount}</span>
              </h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => {
                  const allQs = Array.from(topicMap.values()).flat()
                  const shuffled = [...allQs].sort(() => Math.random() - 0.5)
                  onPlay({
                    questions: shuffled.map(q => ({ question: q.question, correctAnswer: q.correctAnswer, options: q.options, type: q.type, explanation: q.explanation })),
                    name: `${friendlySubject(subject)} Quiz`,
                    subject: friendlySubject(subject),
                    subtopic: '',
                  })
                }}>
                  <Play size={12} /> Play ({subjectQCount})
                </button>
                {activeSession && activeSession.subject === subject && activeSession.phase !== 'complete' ? (
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 10px', background: 'var(--accent)', color: '#fff' }} onClick={onResumeSession}>
                      <RefreshCw size={11} /> Resume ({activeSession.answeredKeys.length}/{activeSession.allQuestionKeys.length})
                    </button>
                    <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 8px', color: '#ef4444' }} onClick={onAbandonSession}>
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-sm" style={{ fontSize: 11, padding: '5px 12px' }} onClick={() => {
                    const allQs = Array.from(topicMap.values()).flat()
                    onStartSession(subject, friendlySubject(subject), allQs)
                  }}>
                    <BarChart3 size={12} /> Session ({subjectQCount})
                  </button>
                )}
              </div>
            </div>
            {Array.from(topicMap.entries()).map(([topic, questions]) => (
              <div key={topic} style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: 'var(--text-muted)',
                  padding: '6px 0', borderBottom: '1px solid var(--border)', marginBottom: 6
                }}>
                  {topic} ({questions.length})
                </div>
                {questions.map(q => (
                  <div key={q.id} className="card" style={{ padding: 10, marginBottom: 6, cursor: 'pointer' }}
                    onClick={() => { if (editingId !== q.id) setExpandedId(expandedId === q.id ? null : q.id) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{q.question}</div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8, alignItems: 'center' }}>
                        {folderMap[q.id] && (() => {
                          const f = folders.find(fl => fl.id === folderMap[q.id])
                          return f ? <span style={{
                            fontSize: 10, padding: '2px 6px', borderRadius: 8,
                            background: `${f.color}22`, color: f.color, fontWeight: 600
                          }}>{f.name}</span> : null
                        })()}
                        <span className="text-xs text-muted">{q.type}</span>
                        <button onClick={e => { e.stopPropagation(); setAssigningId(assigningId === q.id ? null : q.id) }} title="Assign to folder" style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          color: folderMap[q.id] ? folders.find(fl => fl.id === folderMap[q.id])?.color || 'var(--text-muted)' : 'var(--text-muted)',
                          display: 'flex', alignItems: 'center'
                        }}>
                          <Tag size={13} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); handleDelete(q.id) }} title="Delete question" style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                          color: 'var(--text-muted)', display: 'flex', alignItems: 'center'
                        }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {assigningId === q.id && (
                      <div style={{ marginTop: 6, padding: 6, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', display: 'flex', gap: 4, flexWrap: 'wrap' }}
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => assignToFolder(q.id, null)} style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                          border: !folderMap[q.id] ? '1px solid var(--accent)' : '1px solid var(--border)',
                          background: !folderMap[q.id] ? 'var(--accent-glow)' : 'transparent',
                          color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit'
                        }}>None</button>
                        {folders.map(f => (
                          <button key={f.id} onClick={() => assignToFolder(q.id, f.id)} style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                            border: folderMap[q.id] === f.id ? `1px solid ${f.color}` : '1px solid var(--border)',
                            background: folderMap[q.id] === f.id ? `${f.color}22` : 'transparent',
                            color: f.color, cursor: 'pointer', fontFamily: 'inherit',
                            display: 'flex', alignItems: 'center', gap: 3
                          }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color }} />
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {expandedId === q.id && editingId !== q.id && (
                      <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                        <div className="text-sm" style={{ marginBottom: 4 }}>
                          <strong>Answer:</strong> <span style={{ color: 'var(--green)' }}>{q.correctAnswer}</span>
                        </div>
                        {q.options && (
                          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>
                            Options: {q.options.join(' | ')}
                          </div>
                        )}
                        {q.explanation && (
                          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Explanation: {q.explanation}</div>
                        )}
                        <button onClick={e => { e.stopPropagation(); startEdit(q) }} style={{
                          marginTop: 6, padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                          border: '1px solid var(--border)', background: 'transparent',
                          color: 'var(--accent-light)', cursor: 'pointer', fontFamily: 'inherit',
                          display: 'inline-flex', alignItems: 'center', gap: 4
                        }}>
                          <Edit3 size={11} /> Edit
                        </button>
                      </div>
                    )}
                    {editingId === q.id && (
                      <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}
                        onClick={e => e.stopPropagation()}>
                        <div style={{ marginBottom: 6 }}>
                          <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Question</div>
                          <textarea value={editDraft.question}
                            onChange={e => setEditDraft(d => ({ ...d, question: e.target.value }))}
                            style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }} />
                        </div>
                        <div style={{ marginBottom: 6 }}>
                          <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Correct Answer</div>
                          <input type="text" value={editDraft.correctAnswer}
                            onChange={e => setEditDraft(d => ({ ...d, correctAnswer: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        {editDraft.options && (
                          <div style={{ marginBottom: 6 }}>
                            <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Options (one per line)</div>
                            <textarea value={editDraft.options.join('\n')}
                              onChange={e => setEditDraft(d => ({ ...d, options: e.target.value.split('\n') }))}
                              style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
                          </div>
                        )}
                        <div style={{ marginBottom: 6 }}>
                          <div className="text-xs text-muted" style={{ marginBottom: 2 }}>Explanation</div>
                          <input type="text" value={editDraft.explanation || ''}
                            onChange={e => setEditDraft(d => ({ ...d, explanation: e.target.value }))}
                            style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => saveEdit(q.id)} style={{
                            padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                            border: '1px solid var(--green)', background: 'var(--green-dim)',
                            color: 'var(--green)', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <Save size={11} /> Save
                          </button>
                          <button onClick={() => setEditingId(null)} style={{
                            padding: '4px 12px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                            border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                            display: 'inline-flex', alignItems: 'center', gap: 4
                          }}>
                            <X size={11} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )})
      )}
    </div>
  )
}

/* ================================================================
   HISTORY TAB
   ================================================================ */
function HistoryTab({ onSelectAttempt, onPlay, folders, folderMap, folderActions }: { onSelectAttempt: (a: QuizAttempt) => void; onPlay: (quiz: PlayableQuiz) => void } & SharedFolderProps) {
  const { quizHistory, data, setData, updatePluginData } = useStore()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'perfect' | 'failed'>('all')
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date')
  const [filterFolder, setFilterFolder] = useState<string>('all')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Reset filter if active folder was deleted
  useEffect(() => {
    if (filterFolder !== 'all' && filterFolder !== 'unfiled' && !folders.find(f => f.id === filterFolder)) {
      setFilterFolder('all')
    }
  }, [folders, filterFolder])

  function assignQuizToFolder(quizId: string, folderId: string | null) {
    folderActions.assignToFolder(quizId, folderId)
    setAssigningId(null)
  }

  function deleteQuiz(quizId: string) {
    if (!data) return
    // Preserve questions in bank before removing from history
    const rawBank = data.pluginData.quizBank as { quizzes?: QuizAttempt[]; folders?: unknown[] } | undefined
    const existingBank = rawBank || { quizzes: [], folders: [] }
    const bankIds = new Set((existingBank.quizzes ?? []).map(q => q.id))
    const toSave = data.pluginData.quizHistory.filter(q => q.id === quizId && !bankIds.has(q.id))
    const updatedBank = toSave.length ? { ...existingBank, quizzes: [...(existingBank.quizzes ?? []), ...toSave] } : existingBank
    updatePluginData({
      quizHistory: data.pluginData.quizHistory.filter(q => q.id !== quizId),
      ...(toSave.length ? { quizBank: updatedBank } : {}),
    })
  }

  function toggleSelectItem(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function getTypedBank() {
    if (!data) return { quizzes: [] as QuizAttempt[], folders: [] as unknown[] }
    const raw = data.pluginData.quizBank as { quizzes?: QuizAttempt[]; folders?: unknown[] } | undefined
    return { quizzes: raw?.quizzes ?? [], folders: raw?.folders ?? [] }
  }

  function deleteSelected() {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} quiz attempt${selectedIds.size !== 1 ? 's' : ''} from history? Questions will be preserved in the Bank.`)) return
    if (!data) return
    const bank = getTypedBank()
    const bankIds = new Set(bank.quizzes.map(q => q.id))
    const toSave = data.pluginData.quizHistory.filter(q => selectedIds.has(q.id) && !bankIds.has(q.id))
    updatePluginData({
      quizHistory: data.pluginData.quizHistory.filter(q => !selectedIds.has(q.id)),
      ...(toSave.length ? { quizBank: { ...bank, quizzes: [...bank.quizzes, ...toSave] } } : {}),
    })
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  function clearAll() {
    if (!confirm(`Clear ALL ${quizHistory.length} quiz attempts from history? Questions will be preserved in the Bank.`)) return
    if (!data) return
    const bank = getTypedBank()
    const bankIds = new Set(bank.quizzes.map(q => q.id))
    const toSave = quizHistory.filter(q => !bankIds.has(q.id))
    updatePluginData({
      quizHistory: [],
      ...(toSave.length ? { quizBank: { ...bank, quizzes: [...bank.quizzes, ...toSave] } } : {}),
    })
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const sorted = useMemo(() => {
    let list = [...quizHistory]

    // Filter
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.subject.toLowerCase().includes(q))
    }
    if (filter === 'perfect') list = list.filter(a => a.score === 100)
    if (filter === 'failed') list = list.filter(a => a.score >= 0 && a.score < 70)
    if (filterFolder !== 'all') {
      if (filterFolder === 'unfiled') {
        list = list.filter(q => !folderMap[q.id])
      } else {
        list = list.filter(q => folderMap[q.id] === filterFolder)
      }
    }

    // Sort
    if (sortBy === 'date') list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    else if (sortBy === 'score') list.sort((a, b) => b.score - a.score)
    else if (sortBy === 'name') list.sort((a, b) => a.name.localeCompare(b.name))

    return list
  }, [quizHistory, search, filter, filterFolder, folderMap, sortBy])

  // Stats summary
  const stats = useMemo(() => {
    if (quizHistory.length === 0) return { avg: 0, best: 0, total: 0, perfect: 0 }
    const taken = quizHistory.filter(q => q.score >= 0)
    const scores = taken.map(q => q.score)
    return {
      avg: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      best: scores.length > 0 ? Math.max(...scores) : 0,
      total: quizHistory.length,
      perfect: taken.filter(q => q.score === 100).length
    }
  }, [quizHistory])

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit'
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--accent-light)' }}>{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--blue)' }}>{stats.avg}%</div>
          <div className="stat-label">Average</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--green)' }}>{stats.best}%</div>
          <div className="stat-label">Best</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: 20, color: 'var(--yellow)' }}>{stats.perfect}</div>
          <div className="stat-label">Perfect</div>
        </div>
      </div>

      {/* Search + filter + sort */}
      <div className="flex gap-2 mb-4">
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" placeholder="Search quizzes..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: '100%', paddingLeft: 34 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'perfect', 'failed'] as const).map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter(f)}>
              {f === 'all' ? <Filter size={14} /> : f === 'perfect' ? <CheckCircle size={14} /> : <XCircle size={14} />}
            </button>
          ))}
        </div>
        {quizHistory.length > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={() => exportQuizzesAsCSV(quizHistory)} title="Export quiz history as CSV">
            <Download size={14} /> CSV
          </button>
        )}
        {quizHistory.length > 0 && (
          <button className="btn btn-sm btn-secondary" onClick={() => { setSelectMode(s => !s); setSelectedIds(new Set()) }} title="Select multiple to delete">
            <CheckCircle size={14} /> {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
        {quizHistory.length > 0 && !selectMode && (
          <button className="btn btn-sm" onClick={clearAll} style={{ color: 'var(--red)', borderColor: 'var(--red)' }} title="Clear all quiz history">
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', marginBottom: 12, border: '1px solid var(--border)' }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setSelectedIds(selectedIds.size === sorted.length ? new Set() : new Set(sorted.map(q => q.id)))}>
            {selectedIds.size === sorted.length ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-xs text-muted" style={{ flex: 1 }}>{selectedIds.size} selected</span>
          {selectedIds.size > 0 && (
            <button className="btn btn-sm" onClick={deleteSelected} style={{ background: 'var(--red)', color: '#fff', border: 'none' }}>
              <Trash2 size={13} /> Delete {selectedIds.size}
            </button>
          )}
        </div>
      )}

      {/* Folder filter */}
      {folders.length > 0 && (
        <div className="flex gap-2 mb-4" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Folder size={14} style={{ color: 'var(--text-muted)' }} />
          <button onClick={() => setFilterFolder('all')} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
            border: filterFolder === 'all' ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: filterFolder === 'all' ? 'var(--accent-glow)' : 'transparent',
            color: filterFolder === 'all' ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit'
          }}>All</button>
          {folders.map(f => (
            <button key={f.id} onClick={() => setFilterFolder(f.id)} style={{
              padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
              border: filterFolder === f.id ? `1px solid ${f.color}` : '1px solid var(--border)',
              background: filterFolder === f.id ? `${f.color}22` : 'transparent',
              color: filterFolder === f.id ? f.color : 'var(--text-muted)',
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: f.color, display: 'inline-block' }} />
              {f.name}
            </button>
          ))}
          <button onClick={() => setFilterFolder('unfiled')} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
            border: filterFolder === 'unfiled' ? '1px solid var(--border)' : '1px solid var(--border)',
            background: filterFolder === 'unfiled' ? 'var(--bg-input)' : 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit'
          }}>Unfiled</button>
        </div>
      )}

      {/* Sort selector */}
      <div className="flex gap-2 mb-4" style={{ alignItems: 'center' }}>
        <span className="text-xs text-muted">Sort by:</span>
        {(['date', 'score', 'name'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
            border: sortBy === s ? '1px solid var(--accent)' : '1px solid var(--border)',
            background: sortBy === s ? 'var(--accent-glow)' : 'transparent',
            color: sortBy === s ? 'var(--accent-light)' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize'
          }}>{s}</button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <Trophy />
          <h3>No quizzes yet</h3>
          <p>Create a quiz from the Quiz tab or study your flashcards to build quiz history.</p>
        </div>
      ) : (
        sorted.map(q => {
          const isUntaken = q.score < 0
          const scoreColor = isUntaken ? 'var(--text-muted)' : q.score >= 90 ? 'var(--green)' : q.score >= 70 ? 'var(--yellow)' : 'var(--red)'
          const qFolder = folders.find(f => f.id === folderMap[q.id])
          return (
            <div key={q.id} className="quiz-attempt" style={{ position: 'relative', opacity: selectMode && !selectedIds.has(q.id) ? 0.7 : 1 }}>
              <div className="quiz-attempt-header" onClick={() => selectMode ? toggleSelectItem(q.id) : onSelectAttempt(q)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectMode && (
                  <input type="checkbox" checked={selectedIds.has(q.id)} onChange={() => toggleSelectItem(q.id)}
                    onClick={e => e.stopPropagation()}
                    style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }} />
                )}
                <div>
                  <div className="quiz-attempt-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {q.name || q.subject || 'Quiz'}
                    {qFolder && <span style={{
                      fontSize: 9, padding: '1px 6px', borderRadius: 6,
                      background: `${qFolder.color}22`, color: qFolder.color, fontWeight: 600
                    }}>{qFolder.name}</span>}
                  </div>
                  <div className="quiz-attempt-meta">
                    {new Date(q.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    &nbsp;&bull;&nbsp; {q.correct}/{q.questionCount} &nbsp;&bull;&nbsp; {q.mode}
                    {q.subject && <>&nbsp;&bull;&nbsp; {q.subject}</>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="quiz-score" style={{ color: scoreColor }}>{isUntaken ? 'Bank' : `${q.score}%`}</div>
                  <button onClick={e => {
                    e.stopPropagation()
                    // Build PlayableQuiz from attempt
                    let questions: PlayableQuiz['questions'] = []
                    if (q.questions && Array.isArray(q.questions) && (q.questions as any[]).length > 0) {
                      questions = (q.questions as any[]).map(qq => ({
                        question: qq.question || qq.q || '', correctAnswer: qq.correctAnswer || qq.answer || '',
                        options: Array.isArray(qq.options) ? qq.options : undefined, type: qq.type || 'multiple-choice', explanation: qq.explanation,
                      })).filter(qq => qq.question && qq.correctAnswer)
                    }
                    if (questions.length === 0 && (q.answers?.length || 0) > 0) {
                      questions = (q.answers || []).map(a => ({
                        question: a.question.question, correctAnswer: a.question.correctAnswer,
                        options: a.question.options, type: a.question.type || 'multiple-choice', explanation: a.question.explanation,
                      })).filter(qq => qq.question && qq.correctAnswer)
                    }
                    if (questions.length > 0) onPlay({ questions, name: q.name, subject: q.subject, subtopic: q.subtopic })
                  }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: 'var(--accent-light)', display: 'flex'
                  }} title="Play quiz"><Play size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); setAssigningId(assigningId === q.id ? null : q.id) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: qFolder ? qFolder.color : 'var(--text-muted)', display: 'flex'
                  }}><Tag size={14} /></button>
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete this quiz?')) deleteQuiz(q.id) }} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                    color: 'var(--text-muted)', display: 'flex'
                  }}><Trash2 size={14} /></button>
                </div>
              </div>
              {assigningId === q.id && (
                <div style={{ padding: '6px 8px', display: 'flex', gap: 4, flexWrap: 'wrap' }}
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => assignQuizToFolder(q.id, null)} style={{
                    padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    border: !folderMap[q.id] ? '1px solid var(--accent)' : '1px solid var(--border)',
                    background: !folderMap[q.id] ? 'var(--accent-glow)' : 'transparent',
                    color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit'
                  }}>None</button>
                  {folders.map(f => (
                    <button key={f.id} onClick={() => assignQuizToFolder(q.id, f.id)} style={{
                      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                      border: folderMap[q.id] === f.id ? `1px solid ${f.color}` : '1px solid var(--border)',
                      background: folderMap[q.id] === f.id ? `${f.color}22` : 'transparent',
                      color: f.color, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 3
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color }} />
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="progress-bar" style={{ marginTop: 8 }}>
                <div className="progress-fill" style={{ width: `${isUntaken ? 0 : q.score}%`, background: scoreColor }} />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

/* ================================================================
   MERGE TAB
   ================================================================ */
function MergeTab() {
  const { quizHistory, data, updatePluginData } = useStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mergeName, setMergeName] = useState('')
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'success'>('idle')

  // Get unique subjects with question counts
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subject: string; quizIds: string[]; questionCount: number }>()
    quizHistory.forEach(q => {
      const subj = q.subject || 'Uncategorized'
      if (!map.has(subj)) map.set(subj, { subject: subj, quizIds: [], questionCount: 0 })
      const entry = map.get(subj)!
      entry.quizIds.push(q.id)
      entry.questionCount += (q.answers?.length || 0)
    })
    return Array.from(map.values()).sort((a, b) => b.questionCount - a.questionCount)
  }, [quizHistory])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFromSubject(quizIds: string[]) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = quizIds.every(id => next.has(id))
      if (allSelected) {
        quizIds.forEach(id => next.delete(id))
      } else {
        quizIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  // Count total questions in selection
  const selectedQuestionCount = useMemo(() => {
    return quizHistory
      .filter(q => selectedIds.has(q.id))
      .reduce((acc, q) => acc + Math.max((q.answers?.length || 0), Array.isArray(q.questions) ? (q.questions as any[]).length : 0), 0)
  }, [quizHistory, selectedIds])

  function handleMerge() {
    if (selectedIds.size < 2 || !data) return

    const isJapanese = (text: string, subject: string) => {
      if (subject.toLowerCase() === 'japanese' || /japn/i.test(subject)) return true
      return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)
    }

    // Collect questions grouped by subject
    const bySubject = new Map<string, any[]>()
    const seen = new Set<string>()

    quizHistory.filter(q => selectedIds.has(q.id)).forEach(q => {
      const subj = q.subject || 'Uncategorized'
      if (!bySubject.has(subj)) bySubject.set(subj, [])
      const bucket = bySubject.get(subj)!

      // Collect from answers (taken quizzes)
      ;(q.answers || []).forEach(a => {
        const key = (a.question?.question || '').substring(0, 80)
        if (!key || seen.has(key)) return
        seen.add(key)
        const jp = isJapanese(a.question.question, subj)
        bucket.push({
          question: a.question.question, correctAnswer: a.question.correctAnswer,
          options: jp ? undefined : a.question.options,
          type: jp ? 'written' : (a.question.type || 'multiple-choice'),
          explanation: a.question.explanation,
          subject: subj,
        })
      })

      // Collect from questions array (saved/imported quizzes)
      ;(q.questions as any[] || []).forEach(qq => {
        const key = (qq?.question || '').substring(0, 80)
        if (!key || seen.has(key)) return
        seen.add(key)
        const jp = isJapanese(qq.question || '', subj)
        bucket.push({
          question: qq.question, correctAnswer: qq.correctAnswer || qq.answer,
          options: jp ? undefined : qq.options,
          type: jp ? 'written' : (qq.type || 'multiple-choice'),
          explanation: qq.explanation,
          subject: subj,
        })
      })
    })

    // Shuffle within each subject group, then concatenate groups
    const shuffle = <T,>(arr: T[]) => arr.sort(() => Math.random() - 0.5)
    const allQuestions: any[] = []
    bySubject.forEach(bucket => allQuestions.push(...shuffle(bucket)))

    if (allQuestions.length === 0) return
    const subjects = Array.from(bySubject.keys()).join(', ')
    const name = mergeName.trim() || `Merged Quiz ${new Date().toLocaleDateString()}`
    const attempt: QuizAttempt = {
      id: `merge-${Date.now()}`, name,
      subject: subjects, subtopic: '',
      date: new Date().toISOString(), questionCount: allQuestions.length,
      score: -1, correct: 0, mode: 'merged',
      questions: allQuestions, answers: [],
    }
    updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
    setMergeStatus('success')
    setSelectedIds(new Set())
    setTimeout(() => setMergeStatus('idle'), 3000)
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Layers size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Merge Quiz Banks</span>
          <span className="badge badge-accent">{selectedIds.size} selected</span>
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Select quiz attempts to combine their questions into a single merged bank. Duplicates will be removed automatically.
        </p>

        {/* Merge name */}
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Merged Bank Name</div>
          <input type="text" value={mergeName} onChange={e => setMergeName(e.target.value)}
            placeholder="e.g., Final Exam Review" style={inputStyle} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span className="badge badge-blue">{selectedIds.size} quizzes</span>
          <span className="badge badge-green">{selectedQuestionCount} questions</span>
        </div>
      </div>

      {/* Subject groups with quiz selectors */}
      {subjectGroups.length === 0 ? (
        <div className="empty-state">
          <Layers />
          <h3>No quizzes to merge</h3>
          <p>Take quizzes first, then come back to merge question banks.</p>
        </div>
      ) : (
        subjectGroups.map(group => {
          const groupQuizzes = quizHistory.filter(q => (q.subject || 'Uncategorized') === group.subject)
          const allSelected = group.quizIds.every(id => selectedIds.has(id))
          return (
            <div key={group.subject} className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: '1px solid var(--border)', cursor: 'pointer'
              }} onClick={() => selectAllFromSubject(group.quizIds)}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, border: '2px solid var(--border)',
                  background: allSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {allSelected && <CheckCircle size={12} style={{ color: 'white' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{group.subject}</div>
                  <div className="text-xs text-muted">{group.quizIds.length} quizzes, {group.questionCount} questions</div>
                </div>
              </div>

              {/* Individual quizzes */}
              <div style={{ padding: '0 16px' }}>
                {groupQuizzes.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  return (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer'
                    }} onClick={() => toggleSelect(q.id)}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isSelected && <CheckCircle size={10} style={{ color: 'white' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{q.name}</div>
                        <div className="text-xs text-muted">
                          {new Date(q.date).toLocaleDateString()} - {q.answers?.length || 0} questions - {q.score < 0 ? 'Bank' : `${q.score}%`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Merge button */}
      {selectedIds.size >= 2 && (
        <button className="btn btn-primary btn-full" onClick={handleMerge} style={{ marginBottom: 16 }}>
          <Layers size={16} /> Merge {selectedIds.size} Quizzes ({selectedQuestionCount} questions)
        </button>
      )}

      {mergeStatus === 'success' && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'var(--green-dim)', border: '1px solid var(--green)',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle size={16} style={{ color: 'var(--green)' }} />
          Merged bank created successfully with {selectedQuestionCount} unique questions!
        </div>
      )}
    </div>
  )
}

/* ================================================================
   QUIZ PLAYER — Actually take/play a quiz
   ================================================================ */
function QuizPlayer({ quiz, onComplete, onCancel, onAnswer: onAnswerCb }: {
  quiz: PlayableQuiz
  onComplete: (attempt: QuizAttempt) => void
  onCancel: () => void
  onAnswer?: (answer: QuizAnswer) => void
}) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [selected, setSelected] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [qStartTime, setQStartTime] = useState(Date.now())
  const [showSidecar, setShowSidecar] = useState(false)
  const [combo, setCombo] = useState(0)


  const questions = quiz.questions || []
  const q = questions[idx]

  // Scribe OS: stable questionId (useSessionStore lives in child QuizAnnotation to avoid render-phase setState)
  const questionId = `quiz-${quiz.name}-q${idx}`
  const total = questions.length
  const progress = total > 0 ? ((idx) / total) * 100 : 0

  if (!q) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No questions available. <button onClick={onCancel} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Go back</button></div>

  function checkAnswer() {
    if (!selected.trim()) return
    const timeMs = Date.now() - qStartTime
    // Use quizEngine's robust checkAnswer (handles letter answers, fuzzy matching, etc.)
    const engineQ: QuizQuestion = {
      id: String(idx),
      question: q.question,
      type: (q.type.replace(/-/g, '_') as QuestionType) || 'multiple_choice',
      options: q.options,
      answer: q.correctAnswer,
      explanation: q.explanation,
    }
    const isCorrect = engineCheckAnswer(engineQ, selected)
    const newCombo = isCorrect ? combo + 1 : 0
    setCombo(newCombo)
    const answer: QuizAnswer = {
      question: { type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation },
      userAnswer: selected,
      correct: isCorrect,
      timeMs,
    }
    setAnswers(prev => [...prev, answer])
    setShowFeedback(true)
    onAnswerCb?.(answer)
  }

  // Keyboard: 1-4 to select MC option, Enter to submit, Space/Enter for feedback (customizable)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't intercept when typing in an input or during IME composition
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.isComposing || (e as any).keyCode === 229) return;
    if (showFeedback) {
      if (matchesShortcut(e, 'qz_submit') || matchesShortcut(e, 'qz_continue')) { e.preventDefault(); nextQuestion() }
    } else {
      // Customizable option selection keys
      const q = questions[idx];
      if (q && (q.type === 'multiple_choice' || q.type === 'multiple-choice') && q.options) {
        if (matchesShortcut(e, 'qz_opt1') && q.options[0]) { setSelected(q.options[0]); e.preventDefault(); return; }
        if (matchesShortcut(e, 'qz_opt2') && q.options[1]) { setSelected(q.options[1]); e.preventDefault(); return; }
        if (matchesShortcut(e, 'qz_opt3') && q.options[2]) { setSelected(q.options[2]); e.preventDefault(); return; }
        if (matchesShortcut(e, 'qz_opt4') && q.options[3]) { setSelected(q.options[3]); e.preventDefault(); return; }
      } else if (q && (q.type === 'true_false' || q.type === 'true-false')) {
        if (matchesShortcut(e, 'qz_opt1')) { setSelected('True'); e.preventDefault(); return; }
        if (matchesShortcut(e, 'qz_opt2')) { setSelected('False'); e.preventDefault(); return; }
      }
      if (selected.trim() && matchesShortcut(e, 'qz_submit')) {
        e.preventDefault(); checkAnswer()
      }
    }
  }, [showFeedback, selected, idx, questions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  function nextQuestion() {
    setShowFeedback(false)
    setSelected('')
    if (idx + 1 >= total) {
      // Quiz finished — build result
      const allAnswers = [...answers]
      const correctCount = allAnswers.filter(a => a.correct).length
      onComplete({
        id: `quiz-${Date.now()}`,
        name: quiz.name,
        subject: quiz.subject,
        subtopic: quiz.subtopic,
        date: new Date().toISOString(),
        questionCount: total,
        score: Math.round((correctCount / total) * 100),
        correct: correctCount,
        mode: 'practice',
        questions: questions,
        answers: allAnswers,
      })
    } else {
      setIdx(idx + 1)
      setQStartTime(Date.now())
    }
  }

  // Feedback screen
  if (showFeedback) {
    const lastAnswer = answers[answers.length - 1]
    return (
      <div style={{ display: 'flex', position: 'relative' }}>
        <div className="animate-in" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <span className="text-sm text-muted">{idx + 1} of {total}</span>
            <span className="badge">{quiz.name}</span>
          </div>
          <div className="progress-bar" style={{ marginBottom: 20 }}>
            <div className="progress-fill" style={{ width: `${((idx + 1) / total) * 100}%` }} />
          </div>
          <div className="card" style={{ padding: 24, textAlign: 'center' }}>
            {lastAnswer.correct ? (
              <CheckCircle size={48} style={{ color: 'var(--green)', marginBottom: 12 }} />
            ) : (
              <XCircle size={48} style={{ color: 'var(--red)', marginBottom: 12 }} />
            )}
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              {lastAnswer.correct ? 'Correct!' : 'Incorrect'}
            </div>
            {combo >= 5 && (() => {
              const label = getComboLabel(combo)
              const mult = getComboMultiplier(combo)
              return label ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent, #F5A623)', marginBottom: 10, padding: '6px 12px', background: 'rgba(245,166,35,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245,166,35,0.3)' }}>
                  {label} <span style={{ opacity: 0.7, fontSize: 11 }}>({combo} in a row · XP ×{mult})</span>
                </div>
              ) : null
            })()}
            {!lastAnswer.correct && (
              <div style={{ textAlign: 'left', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 6, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Question: </span>{q.question}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4, padding: '6px 12px' }}>
                  <span style={{ fontWeight: 600 }}>Your answer: </span>
                  <span style={{ color: 'var(--red)' }}>{lastAnswer.userAnswer || '(no answer)'}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '6px 12px' }}>
                  <span style={{ fontWeight: 600 }}>Correct answer: </span>
                  <strong style={{ color: 'var(--green)' }}>{q.correctAnswer}</strong>
                </div>
              </div>
            )}
            {q.explanation && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 16, fontStyle: 'italic', lineHeight: 1.5 }}>
                {q.explanation}
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <div style={{ flex: 1, padding: 8, background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{answers.filter(a => a.correct).length}</div>
                <div className="text-xs text-muted">Correct</div>
              </div>
              <div style={{ flex: 1, padding: 8, background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>{answers.filter(a => !a.correct).length}</div>
                <div className="text-xs text-muted">Wrong</div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={nextQuestion} style={{ marginTop: 8 }}>
              {idx + 1 < total ? `Next Question (${idx + 2}/${total}) →` : 'See Results'}
            </button>
          </div>
        </div>
        <QuizAnnotation
          questionId={questionId}
          questionText={q.question}
          questionType={q.type}
          options={q.options}
          subject={quiz.subject || quiz.name}
          quizId={`quiz-${quiz.name}`}
          showSidecar={showSidecar}
          setShowSidecar={setShowSidecar}
        />
      </div>
    )
  }

  // Question screen
  return (
    <div style={{ display: 'flex', position: 'relative' }}>
      <div className="animate-in" style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={onCancel}>
            <ChevronLeft size={13} /> Quit
          </button>
          <span className="badge">{quiz.name}</span>
          <span className="text-sm" style={{ fontWeight: 700, color: 'var(--accent-light)' }}>{idx + 1} / {total}</span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 20 }}>
          <div className="progress-fill" style={{ width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>

        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span className="badge" style={{ fontSize: 10 }}>{q.type.replace(/_/g, ' ')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ReadAloudButton text={q.options?.length ? `${q.question}. Options: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}, ${o}`).join('. ')}` : q.question} label="Read" />
              {answers.length > 0 && (
                <span className="text-xs text-muted">
                  {answers.filter(a => a.correct).length}/{answers.length} correct
                </span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.6, marginBottom: 20 }}>
            {q.question}
          </div>

          {/* Multiple choice options */}
          {(q.type === 'multiple_choice' || q.type === 'multiple-choice') && q.options ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => setSelected(opt)} style={{
                  padding: '12px 16px', borderRadius: 'var(--radius)', textAlign: 'left',
                  border: selected === opt ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selected === opt ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                  fontWeight: selected === opt ? 700 : 400, transition: 'all 0.15s',
                }}>
                  <span style={{ fontWeight: 700, marginRight: 10, color: 'var(--accent-light)', opacity: 0.7 }}>{String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
            </div>
          ) : (q.type === 'true_false' || q.type === 'true-false') ? (
            <div style={{ display: 'flex', gap: 12 }}>
              {['True', 'False'].map(opt => (
                <button key={opt} onClick={() => setSelected(opt)} style={{
                  flex: 1, padding: '16px 20px', borderRadius: 'var(--radius)', textAlign: 'center',
                  border: selected === opt ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: selected === opt ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: 'var(--text-primary)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            /* Short answer / fill in blank */
            <div>
              <input type="text" value={selected} onChange={e => setSelected(e.target.value)}
                placeholder={(() => {
                  // Show format hint if answer has structured labels
                  const labels = q.correctAnswer.match(/(\w[\w\s]*?)\s*:/g);
                  if (labels && labels.length >= 2) {
                    return labels.map((l: string) => l.replace(':', '').trim() + ': ...').join(', ');
                  }
                  return 'Type your answer...';
                })()}
                autoFocus
                lang="ja"
                onCompositionStart={() => { (window as any).__imeComposing = true }}
                onCompositionEnd={() => { (window as any).__imeComposing = false }}
                onKeyDown={e => { if (e.nativeEvent.isComposing || (e as any).keyCode === 229 || (window as any).__imeComposing) return; if (e.key === 'Enter' && selected.trim()) checkAnswer() }}
                style={{
                  width: '100%', padding: '14px 16px', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', background: 'var(--bg-input)', color: 'var(--text-primary)',
                  fontSize: 15, outline: 'none', fontFamily: 'inherit',
                  imeMode: 'active',
                } as React.CSSProperties} />
              {(() => {
                const labels = q.correctAnswer.match(/(\w[\w\s]*?)\s*:/g);
                if (labels && labels.length >= 2) {
                  return (
                    <p className="text-xs text-muted" style={{ marginTop: 6, opacity: 0.7 }}>
                      Tip: You can answer with just the values separated by commas, or use the format shown in the placeholder.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-full" onClick={checkAnswer} disabled={!selected.trim()}
          style={{ fontSize: 15, padding: '14px 20px' }}>
          <CheckCircle size={16} /> Submit Answer
        </button>
        <p className="text-xs text-muted text-center mt-2" style={{ opacity: 0.6 }}>
          Press <b>{formatKey(getShortcutKey('qz_opt1'))}-{formatKey(getShortcutKey('qz_opt4'))}</b> to select &middot; <b>{formatKey(getShortcutKey('qz_submit'))}</b> to submit &middot; <b>{formatKey(getShortcutKey('qz_continue'))}</b> to continue
        </p>
      </div>
      <QuizAnnotation
        questionId={questionId}
        questionText={q.question}
        questionType={q.type}
        options={q.options}
        subject={quiz.subject || quiz.name}
        quizId={`quiz-${quiz.name}`}
        showSidecar={showSidecar}
        setShowSidecar={setShowSidecar}
      />
    </div>
  )
}

/* ── Inner component: keeps useSessionStore out of QuizPlayer to prevent render-phase setState ── */
function QuizAnnotation({
  questionId, questionText, questionType, options, subject, quizId, showSidecar, setShowSidecar,
}: {
  questionId: string; questionText: string; questionType: string; options?: string[]; subject: string; quizId: string;
  showSidecar: boolean; setShowSidecar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const questionMap = useSessionStore(s => s.questionMap)
  const sessions = useSessionStore(s => s.sessions)
  const _sid = questionMap[questionId]
  const hasAnnotation = _sid
    ? (sessions[_sid]?.hasCanvas || !!sessions[_sid]?.textContent || (sessions[_sid]?.chatLog.length ?? 0) > 0)
    : false
  return (
    <>
      <StudyFloatingRail onToggle={() => setShowSidecar(v => !v)} hasAnnotation={hasAnnotation} isOpen={showSidecar} />
      {showSidecar && (
        <StudyAnnotationSidecar
          questionId={questionId}
          questionText={questionText}
          questionType={questionType}
          options={options}
          subject={subject}
          quizId={quizId}
          onClose={() => setShowSidecar(false)}
        />
      )}
    </>
  )
}

/* ================================================================
   QUIZ DETAIL (Review)
   ================================================================ */
/* ================================================================
   SESSION COMPLETE — Final analysis after progressive quiz session
   ================================================================ */
function SessionComplete({ session, onNewSession, onReviewMistakes, onBack }: {
  session: ProgressiveQuizSession
  onNewSession: () => void
  onReviewMistakes: () => void
  onBack: () => void
}) {
  // Separate initial-pass answers from review answers
  const totalQuestions = session.allQuestionKeys.length
  const initialAnswers = session.answers.slice(0, totalQuestions)
  const reviewAnswers = session.answers.slice(totalQuestions)
  const correctFirst = initialAnswers.filter(a => a.correct).length
  const wrongFirst = totalQuestions - correctFirst
  const masteredInReview = reviewAnswers.filter(a => a.correct).length
  const stillWrong = session.wrongKeys.length
  const score = totalQuestions > 0 ? Math.round((correctFirst / totalQuestions) * 100) : 0

  // Group by topic (using question snapshots)
  const topicStats: Record<string, { correct: number; total: number }> = {}
  initialAnswers.forEach(a => {
    const qText = a.question?.question || ''
    // Try to find topic from question key matching
    const topic = 'General'  // Simplified — could be enhanced later
    if (!topicStats[topic]) topicStats[topic] = { correct: 0, total: 0 }
    topicStats[topic].total++
    if (a.correct) topicStats[topic].correct++
  })

  const avgTimeMs = initialAnswers.length > 0
    ? Math.round(initialAnswers.reduce((sum, a) => sum + (a.timeMs || 0), 0) / initialAnswers.length)
    : 0

  const scoreColor = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <div className="animate-in" style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
      <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>
        <ChevronLeft size={13} /> Back to Bank
      </button>

      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Session Complete</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{session.subjectDisplay} — {totalQuestions} questions</p>
      </div>

      {/* Big score */}
      <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 48, fontWeight: 900, color: scoreColor }}>{score}%</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{correctFirst} of {totalQuestions} correct on first attempt</div>
        {avgTimeMs > 0 && <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Avg {(avgTimeMs / 1000).toFixed(1)}s per question</div>}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <div className="card" style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>{correctFirst}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Correct</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{masteredInReview}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mastered in Review</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#ef4444' }}>{stillWrong}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Still Struggling</div>
        </div>
      </div>

      {/* Review rounds summary */}
      {session.reviewRound > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Review Summary</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {session.reviewRound} review round{session.reviewRound > 1 ? 's' : ''} completed
            {wrongFirst > 0 && ` · Started with ${wrongFirst} wrong`}
            {masteredInReview > 0 && ` · Mastered ${masteredInReview} through review`}
          </div>
        </div>
      )}

      {/* Still struggling questions */}
      {stillWrong > 0 && (
        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#ef4444' }}>
            Still Struggling ({stillWrong})
          </div>
          {session.wrongKeys.map((key, i) => {
            const q = session.questionSnapshots[key]
            return q ? (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < stillWrong - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{q.question}</div>
                <div style={{ fontSize: 11, color: '#10b981', marginTop: 2 }}>Answer: {q.correctAnswer}</div>
              </div>
            ) : null
          })}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary btn-full" onClick={onNewSession}>
          <RefreshCw size={14} /> Start New Session
        </button>
        {stillWrong > 0 && (
          <button className="btn btn-full" style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }} onClick={onReviewMistakes}>
            <Play size={14} /> Review Mistakes ({stillWrong})
          </button>
        )}
      </div>
    </div>
  )
}

function QuizDetail({ attempt, onBack, onRetake }: { attempt: QuizAttempt; onBack: () => void; onRetake: (attempt: QuizAttempt) => void }) {
  const { updatePluginData, data } = useStore()
  const isUntaken = attempt.score < 0
  const scoreColor = isUntaken ? 'var(--text-muted)' : attempt.score >= 90 ? 'var(--green)' : attempt.score >= 70 ? 'var(--yellow)' : 'var(--red)'
  const [showMistakesOnly, setShowMistakesOnly] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(attempt.name)
  const [editSubject, setEditSubject] = useState(attempt.subject)

  // Per-question timing stats
  const avgTime = useMemo(() => {
    if (!attempt.answers || attempt.answers.length === 0) return 0
    const total = attempt.answers.reduce((acc, a) => acc + a.timeMs, 0)
    return Math.round(total / attempt.answers.length / 1000)
  }, [attempt])

  const mistakes = useMemo(() => (attempt.answers || []).filter(a => !a.correct), [attempt])

  function saveMetadata() {
    if (!data) return
    const updated = data.pluginData.quizHistory.map((q: QuizAttempt) =>
      q.id === attempt.id ? { ...q, name: editName.trim() || q.name, subject: editSubject.trim() } : q
    )
    updatePluginData({ quizHistory: updated })
    setEditing(false)
  }

  return (
    <div className="animate-in">
      <button className="btn btn-secondary btn-sm mb-4" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>

      {editing ? (
        <div style={{ marginBottom: 16 }}>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Quiz name"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 18, fontWeight: 700, fontFamily: 'inherit', marginBottom: 8 }} />
          <input type="text" value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Subject"
            style={{ width: '100%', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={saveMetadata}><Save size={14} /> Save</button>
            <button className="btn btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title" style={{ flex: 1, margin: 0 }}>{attempt.name}</h1>
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <Edit3 size={16} />
            </button>
          </div>
          <p className="page-subtitle">
            {new Date(attempt.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            {attempt.subject && <> &bull; {attempt.subject}</>}
          </p>
        </>
      )}

      {/* Score summary */}
      <div className="card mb-4" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: scoreColor }}>{isUntaken ? 'Imported' : `${attempt.score}%`}</div>
        <div className="text-sm text-muted">
          {attempt.correct || 0} of {attempt.questionCount || 0} correct &nbsp;&bull;&nbsp; Mode: {attempt.mode || 'practice'}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{avgTime}s</div>
            <div className="text-xs text-muted">Avg time</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)' }}>{attempt.correct}</div>
            <div className="text-xs text-muted">Correct</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--red)' }}>{(attempt.questionCount || 0) - (attempt.correct || 0)}</div>
            <div className="text-xs text-muted">Wrong</div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onRetake(attempt)}>
          <RefreshCw size={16} /> {isUntaken ? 'Take Quiz' : 'Retake Quiz'}
        </button>
        {mistakes.length > 0 && (
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMistakesOnly(!showMistakesOnly)}>
            <Copy size={16} /> {showMistakesOnly ? 'Show All' : `Review Mistakes (${mistakes.length})`}
          </button>
        )}
      </div>

      {/* Questions review */}
      <h3 className="section-title">{showMistakesOnly ? `Mistakes (${mistakes.length})` : 'Questions'}</h3>
      {!isUntaken && (attempt.answers?.length || 0) > 0 ? (
        (showMistakesOnly ? mistakes : (attempt.answers || [])).map((a, i) => (
          <div key={i} className="quiz-question">
            <div className="flex items-center gap-2 mb-2">
              {a.correct ? <CheckCircle size={16} style={{ color: 'var(--green)' }} /> : <XCircle size={16} style={{ color: 'var(--red)' }} />}
              <span className="text-xs text-muted">Q{i + 1} &bull; {Math.round(a.timeMs / 1000)}s</span>
            </div>
            <div className="quiz-question-text">{a.question.question}</div>
            {a.question.options?.map((opt, j) => {
              let cls = 'quiz-option'
              if (opt === a.question.correctAnswer) cls += ' correct'
              else if (opt === a.userAnswer && !a.correct) cls += ' wrong'
              if (opt === a.userAnswer) cls += ' selected'
              return <div key={j} className={cls}>{opt}</div>
            })}
            {!a.question.options && (
              <div style={{ marginTop: 8 }}>
                <div className="text-sm">
                  <strong>Your answer:</strong> <span style={{ color: a.correct ? 'var(--green)' : 'var(--red)' }}>{a.userAnswer}</span>
                </div>
                {!a.correct && <div className="text-sm"><strong>Correct:</strong> {a.question.correctAnswer}</div>}
              </div>
            )}
            {a.question.explanation && (
              <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {a.question.explanation}
              </div>
            )}
          </div>
        ))
      ) : attempt.questions && attempt.questions.length > 0 ? (
        /* Show question bank preview when quiz hasn't been taken yet */
        (attempt.questions as QuizQuestion[]).map((q, i) => (
          <div key={i} className="quiz-question">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs text-muted">Q{i + 1} &bull; {q.type?.replace(/_/g, ' ') || 'question'}</span>
            </div>
            <div className="quiz-question-text">{q.question}</div>
            {q.options?.map((opt, j) => (
              <div key={j} className="quiz-option" style={{ opacity: 0.7 }}>{opt}</div>
            ))}
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--green)' }}>
              <strong>Answer:</strong> {q.answer || (q as any).correctAnswer}
            </div>
            {q.explanation && (
              <div style={{ marginTop: 6, padding: 8, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)' }}>
                {q.explanation}
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="text-sm text-muted" style={{ padding: 20, textAlign: 'center' }}>No questions recorded for this quiz.</div>
      )}
    </div>
  )
}
