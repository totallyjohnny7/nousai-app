/**
 * PhysicsQuizTab — Orchestrator for the Physics Practicum
 * Manages view state, loads/saves quiz data from localStorage,
 * listens for grading queue events, and flushes queue on reconnect.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Course } from '../../types'
import type {
  PhysicsCourseData, PhysicsQuestion, PhysicsSession, PhysicsSessionMode,
  PhysicsAnswer, PhysicsSessionSummary, ConfidenceCalibration,
} from './types'
import {
  createEmptyPhysicsData, generatePhysicsId, migratePhysicsCourseData, todayDateStr,
} from './types'
import { flushQueue } from '../../utils/physicsGradingQueue'
import { useStore } from '../../store'
import PhysicsMenu from './PhysicsMenu'

// ─── Lazy-loaded views ────────────────────────────────────────────────────────
const PhysicsQuestionEditor = React.lazy(() => import('./PhysicsQuestionEditor'))
const PhysicsSessionView    = React.lazy(() => import('./PhysicsSession'))
const PhysicsResultsView    = React.lazy(() => import('./PhysicsResults'))
const PhysicsStatsView      = React.lazy(() => import('./PhysicsStats'))
const PhysMindMap           = React.lazy(() => import('./PhysMindMap'))

type View = 'menu' | 'editor' | 'session' | 'results' | 'stats' | 'mindmap'

const CALC_STATE_KEY = 'nousai-physquiz-calc-state'

function storageKey(courseId: string) { return `nousai-physquiz-${courseId}` }

function loadData(courseId: string): PhysicsCourseData {
  try {
    const raw = localStorage.getItem(storageKey(courseId))
    if (raw) return migratePhysicsCourseData(JSON.parse(raw))
  } catch { /* ignore */ }
  return createEmptyPhysicsData()
}

function loadCalcState(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(CALC_STATE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

interface Props {
  course: Course
}

export default function PhysicsQuizTab({ course }: Props) {
  const { data: storeData, updatePluginData } = useStore()

  const [view, setView]       = useState<View>('menu')
  const [data, setData]       = useState<PhysicsCourseData>(() => {
    const local = loadData(course.id)
    // If localStorage is empty (new device), fall back to cloud copy
    if (local.questions.length === 0 && local.sessionHistory.length === 0) {
      const cloudKey = `physicsQuizData_${course.id}`
      const cloudData = storeData?.pluginData?.[cloudKey]
      if (cloudData) {
        try { return migratePhysicsCourseData(cloudData as PhysicsCourseData) } catch { /* ignore */ }
      }
    }
    return local
  })
  const [session, setSession] = useState<PhysicsSession | null>(null)
  const [calcState, setCalcStateRaw] = useState<Record<string, unknown>>(loadCalcState)
  const [calcActivePanel, setCalcActivePanel] = useState<'calc' | 'units' | 'dimcheck' | null>(null)

  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData  = useRef<PhysicsCourseData>(data)
  latestData.current = data

  // Persist calcState to localStorage on every change
  const setCalcState = useCallback((next: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
    setCalcStateRaw(prev => {
      const resolved = typeof next === 'function' ? next(prev) : next
      try { localStorage.setItem(CALC_STATE_KEY, JSON.stringify(resolved)) } catch { /* ignore */ }
      return resolved
    })
  }, [])

  // ─── Debounced save with QuotaExceededError guard ──────────────────────────
  const saveData = useCallback((next: PhysicsCourseData) => {
    setData(next)
    latestData.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const key = storageKey(course.id)
      try { localStorage.setItem(key, JSON.stringify(next)) }
      catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.error('Physics quiz storage full')
        }
      }
      // Sync to cloud so questions survive clearing localStorage / switching devices
      updatePluginData({ [`physicsQuizData_${course.id}`]: next } as never)
    }, 500)
  }, [course.id, updatePluginData])

  // Cleanup timers
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
  }, [])

  // ─── Flush plugin summary on tab close ─────────────────────────────────────
  useEffect(() => {
    const flush = () => {
      const d = latestData.current
      if (d.sessionHistory.length === 0) return
      const last = d.sessionHistory[d.sessionHistory.length - 1]
      updatePluginData({ physicsQuizSummary: last } as never)
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [updatePluginData])

  // ─── Listen for grading queue events ───────────────────────────────────────
  useEffect(() => {
    const onResolved = (e: Event) => {
      const ev = e as CustomEvent<{
        answerId: string
        answerScore: number
        diagramScore?: number
        combinedScore: number
        aiFeedback: string
        whatToFix: string[]
        errorCategories: string[]
        missingPrerequisites: string[]
      }>
      setSession(prev => {
        if (!prev) return prev
        const answers = prev.answers.map(a =>
          a.questionId === ev.detail.answerId
            ? {
                ...a,
                gradingStatus: 'graded' as const,
                answerScore: ev.detail.answerScore,
                diagramScore: ev.detail.diagramScore,
                combinedScore: ev.detail.combinedScore,
                aiFeedback: ev.detail.aiFeedback,
                whatToFix: ev.detail.whatToFix,
                errorCategories: ev.detail.errorCategories as PhysicsAnswer['errorCategories'],
                missingPrerequisites: ev.detail.missingPrerequisites,
                userDiagramBase64: undefined, // clear after grading resolves
              }
            : a
        )
        return { ...prev, answers }
      })
    }

    const onFailed = (e: Event) => {
      const ev = e as CustomEvent<{ answerId: string }>
      setSession(prev => {
        if (!prev) return prev
        const answers = prev.answers.map(a =>
          a.questionId === ev.detail.answerId
            ? { ...a, gradingStatus: 'failed' as const }
            : a
        )
        return { ...prev, answers }
      })
    }

    window.addEventListener('physics-grade-resolved', onResolved)
    window.addEventListener('physics-grade-failed', onFailed)
    return () => {
      window.removeEventListener('physics-grade-resolved', onResolved)
      window.removeEventListener('physics-grade-failed', onFailed)
    }
  }, [])

  // ─── Flush grading queue on reconnect ──────────────────────────────────────
  useEffect(() => {
    const onOnline = () => { flushQueue() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // ─── Build PhysicsSessionSummary from completed session ────────────────────
  function buildSummary(completed: PhysicsSession): PhysicsSessionSummary {
    const answers = completed.answers

    const gradedAnswers  = answers.filter(a => a.gradingStatus === 'graded')
    const pendingAnswers = answers.filter(a => a.gradingStatus === 'pending')
    const failedAnswers  = answers.filter(a => a.gradingStatus === 'failed')

    const averageScore = gradedAnswers.length > 0
      ? Math.round(gradedAnswers.reduce((sum, a) => sum + a.combinedScore, 0) / gradedAnswers.length)
      : 0

    // Topic breakdown
    const topicBreakdown: Record<string, { attempted: number; averageScore: number }> = {}
    for (const answer of gradedAnswers) {
      const q = data.questions.find(q => q.id === answer.questionId)
      const topic = q?.topic ?? 'other'
      if (!topicBreakdown[topic]) topicBreakdown[topic] = { attempted: 0, averageScore: 0 }
      topicBreakdown[topic].attempted += 1
      topicBreakdown[topic].averageScore += answer.combinedScore
    }
    for (const topic of Object.keys(topicBreakdown)) {
      const tb = topicBreakdown[topic]
      tb.averageScore = Math.round(tb.averageScore / tb.attempted)
    }

    // Error category tallies
    const errorCategories: Record<string, number> = {}
    for (const answer of answers) {
      for (const cat of answer.errorCategories) {
        errorCategories[cat] = (errorCategories[cat] ?? 0) + 1
      }
    }

    // Confidence calibration
    const calibration: ConfidenceCalibration = {
      notSure:    { correct: 0, total: 0 },
      prettySure: { correct: 0, total: 0 },
      confident:  { correct: 0, total: 0 },
    }
    for (const answer of gradedAnswers) {
      if (!answer.confidence) continue
      const correct = answer.combinedScore >= 70
      if (answer.confidence === 'not-sure') {
        calibration.notSure.total += 1
        if (correct) calibration.notSure.correct += 1
      } else if (answer.confidence === 'pretty-sure') {
        calibration.prettySure.total += 1
        if (correct) calibration.prettySure.correct += 1
      } else if (answer.confidence === 'confident') {
        calibration.confident.total += 1
        if (correct) calibration.confident.correct += 1
      }
    }

    return {
      id: completed.id,
      mode: completed.mode,
      date: todayDateStr(),
      totalQuestions: answers.length,
      gradedCount: gradedAnswers.length,
      pendingCount: pendingAnswers.length,
      failedCount: failedAnswers.length,
      averageScore,
      totalTimeMs: answers.reduce((s, a) => s + a.timeMs, 0),
      topicBreakdown,
      errorCategories,
      confidenceCalibration: calibration,
    }
  }

  // ─── Load built-in chapter questions from /physquiz/questions.json ───────
  const loadChapter = useCallback(async (chapters: string[]) => {
    const res = await fetch('/physquiz/questions.json')
    if (!res.ok) throw new Error('Failed to fetch question bank')
    const bank = await res.json() as Record<string, { questions: PhysicsQuestion[] }>
    const existingIds = new Set(latestData.current.questions.map(q => q.id))
    const toAdd: PhysicsQuestion[] = []
    for (const ch of chapters) {
      const chData = bank[ch]
      if (!chData) continue
      for (const q of chData.questions) {
        if (!existingIds.has(q.id)) { toAdd.push(q); existingIds.add(q.id) }
      }
    }
    if (toAdd.length > 0) {
      saveData({ ...latestData.current, questions: [...latestData.current.questions, ...toAdd] })
    }
  }, [saveData])

  // ─── Start a new session ───────────────────────────────────────────────────
  const startSession = useCallback((
    mode: PhysicsSessionMode,
    options: { topicFilter?: import('./types').PhysicsTopic; chapterFilter?: string[]; scrambleValues: boolean; stepMode: boolean },
  ) => {
    let pool = [...data.questions]
    if (pool.length === 0) return

    // Apply chapter filter first (if set)
    if (options.chapterFilter && options.chapterFilter.length > 0) {
      const filtered = pool.filter(q => q.chapterTag && options.chapterFilter!.includes(q.chapterTag))
      if (filtered.length > 0) pool = filtered
    }

    if (mode === 'weak-topics') {
      pool = pool.filter(q => (q.wrongCount ?? 0) >= 2)
      if (pool.length === 0) pool = [...data.questions]
    } else if (mode === 'topic-drill' && options.topicFilter) {
      pool = pool.filter(q => q.topic === options.topicFilter)
      if (pool.length === 0) pool = [...data.questions]
    } else if (mode === 'due-review') {
      const today = todayDateStr()
      pool = pool.filter(q => q.srNextReview && q.srNextReview <= today)
      if (pool.length === 0) pool = [...data.questions]
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5)

    const newSession: PhysicsSession = {
      id: generatePhysicsId(),
      mode,
      topicFilter: options.topicFilter,
      questionIds: shuffled.map(q => q.id),
      answers: [],
      currentIndex: 0,
      startedAt: new Date().toISOString(),
      scrambleValues: options.scrambleValues,
      stepMode: options.stepMode,
    }
    setSession(newSession)
    setView('session')
  }, [data.questions])

  // ─── Finish session → results ──────────────────────────────────────────────
  const finishSession = useCallback((completed: PhysicsSession) => {
    setSession(completed)

    const summary = buildSummary(completed)

    // Update streak
    const today = todayDateStr()
    const prevData = latestData.current
    let newStreak = prevData.currentStreak
    if (prevData.lastStreakDate !== today) {
      newStreak += 1
    }

    const next: PhysicsCourseData = {
      ...prevData,
      sessionHistory: [...prevData.sessionHistory, summary],
      currentStreak: newStreak,
      lastStreakDate: today,
    }
    saveData(next)

    // Push summary to plugin data for cloud sync / dashboard display
    updatePluginData({ physicsQuizSummary: summary } as never)

    setView('results')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveData, updatePluginData])

  const updateQuestions = useCallback((questions: PhysicsQuestion[]) => {
    saveData({ ...latestData.current, questions })
  }, [saveData])

  const backToMenu = useCallback(() => {
    setView('menu')
    setSession(null)
  }, [])

  return (
    <div style={{ padding: '0 4px' }}>
      {view === 'menu' && (
        <PhysicsMenu
          data={data}
          onStart={startSession}
          onManage={() => setView('editor')}
          onStats={() => setView('stats')}
          onMindMap={() => setView('mindmap')}
          onLoadChapter={loadChapter}
        />
      )}

      {view === 'editor' && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading editor…</div>}>
          <PhysicsQuestionEditor
            questions={data.questions}
            onChange={updateQuestions}
            onBack={() => setView('menu')}
            onImport={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'session' && session && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading session…</div>}>
          <PhysicsSessionView
            session={session}
            questions={data.questions}
            course={course}
            onFinish={finishSession}
            onQuit={backToMenu}
            calcActivePanel={calcActivePanel}
            onCalcPanelChange={setCalcActivePanel}
          />
        </React.Suspense>
      )}

      {view === 'results' && session && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading results…</div>}>
          <PhysicsResultsView
            session={session}
            questions={data.questions}
            course={course}
            onNewSession={backToMenu}
            onReviewMistakes={backToMenu}
          />
        </React.Suspense>
      )}

      {view === 'stats' && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading analytics…</div>}>
          <PhysicsStatsView
            courseData={data}
            onBack={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'mindmap' && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading mind map…</div>}>
          <PhysMindMap
            onBack={() => setView('menu')}
            onQuizBubble={(topic) => startSession('topic-drill', { topicFilter: topic, scrambleValues: false, stepMode: false })}
          />
        </React.Suspense>
      )}
    </div>
  )
}

// Export calcState hook-style helper for sibling components that need it
export { CALC_STATE_KEY }
