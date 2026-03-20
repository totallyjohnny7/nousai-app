/**
 * EvolutionExam2Tab — Orchestrator for the Evolution Exam 2 Practicum
 * Manages view state, loads/saves quiz data from localStorage,
 * listens for grading events, and flushes summary on tab close.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Course } from '../../types'
import type {
  EvolCourseData, EvolQuestion, EvolSession, EvolSessionMode,
  EvolSessionSummary, EvolTopic, EvolHeading,
} from './types'
import {
  createEmptyEvolData, generateEvolId, migrateEvolCourseData, todayDateStr,
} from './types'
import { useStore } from '../../store'
import EvolutionMenu from './EvolutionMenu'
import { flushQueue } from '../../utils/physicsGradingQueue'

// ─── Lazy-loaded views ────────────────────────────────────────────────────────
const EvolutionQuestionEditor = React.lazy(() => import('./EvolutionQuestionEditor'))
const EvolutionSessionView    = React.lazy(() => import('./EvolutionSession'))
const EvolutionResultsView    = React.lazy(() => import('./EvolutionResults'))
const EvolutionStatsView      = React.lazy(() => import('./EvolutionStats'))
const EvolutionMindMap        = React.lazy(() => import('./EvolutionMindMap'))

type View = 'menu' | 'editor' | 'session' | 'results' | 'stats' | 'mindmap'

function storageKey(courseId: string) { return `nousai-evolquiz-${courseId}` }

function loadData(courseId: string): EvolCourseData {
  try {
    const raw = localStorage.getItem(storageKey(courseId))
    if (raw) return migrateEvolCourseData(JSON.parse(raw))
  } catch { /* ignore */ }
  return createEmptyEvolData()
}

interface Props {
  course: Course
}

export default function EvolutionExam2Tab({ course }: Props) {
  const { data: storeData, updatePluginData } = useStore()

  const [view, setView]       = useState<View>('menu')
  const [data, setData]       = useState<EvolCourseData>(() => {
    const local = loadData(course.id)
    if (local.questions.length === 0 && local.sessionHistory.length === 0) {
      const cloudKey = `evolQuizData_${course.id}`
      const cloudData = storeData?.pluginData?.[cloudKey]
      if (cloudData) {
        try { return migrateEvolCourseData(cloudData as EvolCourseData) } catch { /* ignore */ }
      }
    }
    return local
  })
  const [session, setSession] = useState<EvolSession | null>(null)

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef<EvolCourseData>(data)
  latestData.current = data

  // ─── Debounced save with QuotaExceededError guard ──────────────────────────
  const saveData = useCallback((next: EvolCourseData) => {
    setData(next)
    latestData.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const key = storageKey(course.id)
      try { localStorage.setItem(key, JSON.stringify(next)) }
      catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.error('Evolution quiz storage full')
        }
      }
      updatePluginData({ [`evolQuizData_${course.id}`]: next } as never)
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
      updatePluginData({ evolutionQuizSummary: last } as never)
    }
    window.addEventListener('beforeunload', flush)
    return () => window.removeEventListener('beforeunload', flush)
  }, [updatePluginData])

  // ─── Listen for grading events ──────────────────────────────────────────────
  useEffect(() => {
    const onResolved = (e: Event) => {
      const ev = e as CustomEvent<{
        questionId: string
        score: number
        feedback: string
      }>
      setSession(prev => {
        if (!prev) return prev
        const answers = { ...prev.answers }
        const existing = answers[ev.detail.questionId]
        if (existing) {
          answers[ev.detail.questionId] = {
            ...existing,
            gradingStatus: 'graded',
            score: ev.detail.score,
            correct: ev.detail.score >= 70,
            feedback: ev.detail.feedback,
          }
        }
        return { ...prev, answers }
      })
    }

    const onFailed = (e: Event) => {
      const ev = e as CustomEvent<{ questionId: string }>
      setSession(prev => {
        if (!prev) return prev
        const answers = { ...prev.answers }
        const existing = answers[ev.detail.questionId]
        if (existing) {
          answers[ev.detail.questionId] = {
            ...existing,
            gradingStatus: 'skipped',
          }
        }
        return { ...prev, answers }
      })
    }

    window.addEventListener('evol-grade-resolved', onResolved)
    window.addEventListener('evol-grade-failed', onFailed)
    return () => {
      window.removeEventListener('evol-grade-resolved', onResolved)
      window.removeEventListener('evol-grade-failed', onFailed)
    }
  }, [])

  // ─── Build EvolSessionSummary from completed session ──────────────────────
  function buildSummary(completed: EvolSession): EvolSessionSummary {
    const answers = Object.values(completed.answers)
    const graded  = answers.filter(a => a.gradingStatus === 'graded')

    const averageScore = graded.length > 0
      ? Math.round(graded.reduce((s, a) => s + a.score, 0) / graded.length)
      : 0

    const topicBreakdown = {} as Record<string, { count: number; avgScore: number }>
    for (const answer of graded) {
      const q = latestData.current.questions.find(q => q.id === answer.questionId)
      const topic = (q?.topic ?? 'other')
      if (!topicBreakdown[topic]) topicBreakdown[topic] = { count: 0, avgScore: 0 }
      topicBreakdown[topic].count += 1
      topicBreakdown[topic].avgScore += answer.score
    }
    for (const topic of Object.keys(topicBreakdown)) {
      const tb = topicBreakdown[topic]
      tb.avgScore = Math.round(tb.avgScore / tb.count)
    }

    const headingBreakdown: Record<string, { count: number; avgScore: number }> = {}
    for (const answer of graded) {
      const q = latestData.current.questions.find(q => q.id === answer.questionId)
      if (!q) continue
      const hk = q.heading
      if (!headingBreakdown[hk]) headingBreakdown[hk] = { count: 0, avgScore: 0 }
      headingBreakdown[hk].count++
      headingBreakdown[hk].avgScore = Math.round(
        (headingBreakdown[hk].avgScore * (headingBreakdown[hk].count - 1) + answer.score) / headingBreakdown[hk].count
      )
    }

    return {
      id: completed.id,
      date: todayDateStr(),
      mode: completed.mode,
      questionCount: answers.length,
      averageScore,
      topicBreakdown,
      headingBreakdown,
    }
  }

  // ─── Flush grading queue on reconnect ──────────────────────────────────────
  useEffect(() => {
    const onOnline = () => { flushQueue() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  // ─── Load built-in chapter questions from /evolquiz/questions.json ────────
  const loadChapter = useCallback(async (chapters: string[]) => {
    const res = await fetch('/evolquiz/questions.json')
    if (!res.ok) throw new Error('Failed to fetch evolution question bank')
    const bank = await res.json() as Record<string, { questions: EvolQuestion[] }>
    const existingIds = new Set(latestData.current.questions.map(q => q.id))
    const toAdd: EvolQuestion[] = []
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

  // ─── Auto-load all built-in chapters on mount ──────────────────────────────
  const bankLoadedRef = useRef(false)
  useEffect(() => {
    if (bankLoadedRef.current) return
    bankLoadedRef.current = true
    const ALL_CHAPTERS = [
      'ch1','ch2','ch3','ch4','ch5','ch6','ch7','ch8','ch9',
      'ch10','ch11','ch12','ch13','ch14','ch15','ch16','ch17','ch18',
    ]
    const t = setTimeout(() => {
      loadChapter(ALL_CHAPTERS).catch(console.error)
    }, 300)
    return () => clearTimeout(t)
  }, [loadChapter])

  // ─── Start a new session ───────────────────────────────────────────────────
  const startSession = useCallback((
    mode: EvolSessionMode,
    options: {
      topicFilter?: EvolTopic
      headingFilter?: EvolHeading
      examFilter?: 'exam1' | 'exam2' | 'exam3' | 'all'
      chapterFilter?: string[]
    },
  ) => {
    let pool = [...data.questions]
    if (pool.length === 0) return

    // Apply chapter filter first
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
    } else if (mode === 'heading-drill' && options.headingFilter) {
      pool = pool.filter(q => q.heading === options.headingFilter)
      if (pool.length === 0) pool = [...data.questions]
    } else if (mode === 'due-review') {
      const today = todayDateStr()
      pool = pool.filter(q => q.srNextReview && q.srNextReview <= today)
      if (pool.length === 0) pool = [...data.questions]
    }

    if (options.examFilter && options.examFilter !== 'all') {
      const filtered = pool.filter(q => q.examTag === options.examFilter)
      if (filtered.length > 0) pool = filtered
    }

    if (mode === 'timed') {
      pool = pool.slice(0, 20)
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5)

    const newSession: EvolSession = {
      id: generateEvolId(),
      mode,
      topicFilter: options.topicFilter ? [options.topicFilter] : undefined,
      headingFilter: options.headingFilter,
      questionIds: shuffled.map(q => q.id),
      answers: {},
      startedAt: new Date().toISOString(),
    }
    setSession(newSession)
    setView('session')
  }, [data.questions])

  // ─── Finish session → results ──────────────────────────────────────────────
  const finishSession = useCallback((completed: EvolSession) => {
    setSession(completed)

    const summary = buildSummary(completed)

    const today = todayDateStr()
    const prevData = latestData.current
    let newStreak = prevData.currentStreak
    if (prevData.lastStreakDate !== today) {
      newStreak += 1
    }

    const next: EvolCourseData = {
      ...prevData,
      sessionHistory: [...prevData.sessionHistory, summary],
      currentStreak: newStreak,
      lastStreakDate: today,
    }
    saveData(next)
    updatePluginData({ evolutionQuizSummary: summary } as never)
    setView('results')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveData, updatePluginData])

  const updateQuestions = useCallback((questions: EvolQuestion[]) => {
    saveData({ ...latestData.current, questions })
  }, [saveData])

  const backToMenu = useCallback(() => {
    setView('menu')
    setSession(null)
  }, [])

  const handleQuizBubble = useCallback((topic: EvolTopic) => {
    startSession('topic-drill', { topicFilter: topic })
  }, [startSession])

  const suspenseFallback = (label: string) => (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
      Loading {label}…
    </div>
  )

  return (
    <div style={{ padding: '0 4px' }}>
      {view === 'menu' && (
        <EvolutionMenu
          data={data}
          onStart={startSession}
          onManage={() => setView('editor')}
          onStats={() => setView('stats')}
          onMindMap={() => setView('mindmap')}
          onLoadChapter={loadChapter}
        />
      )}

      {view === 'editor' && (
        <React.Suspense fallback={suspenseFallback('editor')}>
          <EvolutionQuestionEditor
            questions={data.questions}
            onChange={updateQuestions}
            onBack={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'session' && session && (
        <React.Suspense fallback={suspenseFallback('session')}>
          <EvolutionSessionView
            session={session}
            questions={data.questions}
            onFinish={finishSession}
            onQuit={backToMenu}
          />
        </React.Suspense>
      )}

      {view === 'results' && session && (
        <React.Suspense fallback={suspenseFallback('results')}>
          <EvolutionResultsView
            session={session}
            questions={data.questions}
            onNewSession={backToMenu}
          />
        </React.Suspense>
      )}

      {view === 'stats' && (
        <React.Suspense fallback={suspenseFallback('analytics')}>
          <EvolutionStatsView
            courseData={data}
            onBack={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'mindmap' && (
        <React.Suspense fallback={suspenseFallback('mind map')}>
          <EvolutionMindMap
            onBack={() => setView('menu')}
            onQuizBubble={handleQuizBubble}
          />
        </React.Suspense>
      )}
    </div>
  )
}
