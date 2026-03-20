/**
 * BiolPractiumTab — Orchestrator for the BIOL3020 Practium
 * Manages view state, loads/saves quiz data from localStorage,
 * listens for grading events, and flushes summary on tab close.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Course } from '../../types'
import type {
  BiolCourseData, BiolQuestion, BiolSession, BiolSessionMode,
  BiolAnswer, BiolSessionSummary, BiolTopic,
} from './types'
import {
  createEmptyBiolData, generateBiolId, migrateBiolCourseData, todayDateStr,
} from './types'
import { useStore } from '../../store'
import BiolMenu from './BiolMenu'

// ─── Lazy-loaded views ────────────────────────────────────────────────────────
const BiolQuestionEditor = React.lazy(() => import('./BiolQuestionEditor'))
const BiolSessionView    = React.lazy(() => import('./BiolSession'))
const BiolResultsView    = React.lazy(() => import('./BiolResults'))
const BiolStatsView      = React.lazy(() => import('./BiolStats'))
const BiolMindMap        = React.lazy(() => import('./BiolMindMap'))

type View = 'menu' | 'editor' | 'session' | 'results' | 'stats' | 'mindmap'

function storageKey(courseId: string) { return `nousai-biolquiz-${courseId}` }

function loadData(courseId: string): BiolCourseData {
  try {
    const raw = localStorage.getItem(storageKey(courseId))
    if (raw) return migrateBiolCourseData(JSON.parse(raw))
  } catch { /* ignore */ }
  return createEmptyBiolData()
}

interface Props {
  course: Course
}

export default function BiolPractiumTab({ course }: Props) {
  const { updatePluginData } = useStore()

  const [view, setView]       = useState<View>('menu')
  const [data, setData]       = useState<BiolCourseData>(() => loadData(course.id))
  const [session, setSession] = useState<BiolSession | null>(null)

  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestData = useRef<BiolCourseData>(data)
  latestData.current = data

  // ─── Debounced save with QuotaExceededError guard ──────────────────────────
  const saveData = useCallback((next: BiolCourseData) => {
    setData(next)
    latestData.current = next
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const key = storageKey(course.id)
      try { localStorage.setItem(key, JSON.stringify(next)) }
      catch (e) {
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          console.error('BIOL quiz storage full')
        }
      }
    }, 500)
  }, [course.id])

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
      updatePluginData({ biolQuizSummary: last } as never)
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

    window.addEventListener('biol-grade-resolved', onResolved)
    window.addEventListener('biol-grade-failed', onFailed)
    return () => {
      window.removeEventListener('biol-grade-resolved', onResolved)
      window.removeEventListener('biol-grade-failed', onFailed)
    }
  }, [])

  // ─── Load built-in chapter questions from /biolquiz/questions.json ────────
  const loadChapter = useCallback(async (chapters: string[]) => {
    const res = await fetch('/biolquiz/questions.json')
    if (!res.ok) throw new Error('Failed to fetch BIOL3020 question bank')
    const bank = await res.json() as Record<string, { questions: BiolQuestion[] }>
    const existingIds = new Set(latestData.current.questions.map(q => q.id))
    const toAdd: BiolQuestion[] = []
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
      'ch10','ch11','ch12','ch13','ch14','ch15','ch16','ch17','ch18','ch19',
    ]
    const t = setTimeout(() => {
      loadChapter(ALL_CHAPTERS).catch(console.error)
    }, 300)
    return () => clearTimeout(t)
  }, [loadChapter])

  // ─── Build BiolSessionSummary from completed session ──────────────────────
  function buildSummary(completed: BiolSession): BiolSessionSummary {
    const answers = Object.values(completed.answers)
    const graded  = answers.filter(a => a.gradingStatus === 'graded')

    const averageScore = graded.length > 0
      ? Math.round(graded.reduce((s, a) => s + a.score, 0) / graded.length)
      : 0

    const topicBreakdown = {} as Record<BiolTopic, { count: number; avgScore: number }>
    for (const answer of graded) {
      const q = latestData.current.questions.find(q => q.id === answer.questionId)
      const topic = (q?.topic ?? 'other') as BiolTopic
      if (!topicBreakdown[topic]) topicBreakdown[topic] = { count: 0, avgScore: 0 }
      topicBreakdown[topic].count += 1
      topicBreakdown[topic].avgScore += answer.score
    }
    for (const topic of Object.keys(topicBreakdown) as BiolTopic[]) {
      const tb = topicBreakdown[topic]
      tb.avgScore = Math.round(tb.avgScore / tb.count)
    }

    return {
      id: completed.id,
      date: todayDateStr(),
      mode: completed.mode,
      questionCount: answers.length,
      averageScore,
      topicBreakdown,
    }
  }

  // ─── Start a new session ───────────────────────────────────────────────────
  const startSession = useCallback((
    mode: BiolSessionMode,
    options: { topicFilter?: BiolTopic; examFilter?: 'exam1' | 'exam2' | 'exam3' | 'all' },
  ) => {
    let pool = [...data.questions]
    if (pool.length === 0) return

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

    if (options.examFilter && options.examFilter !== 'all') {
      const filtered = pool.filter(q => q.examTag === options.examFilter)
      if (filtered.length > 0) pool = filtered
    }

    if (mode === 'timed') {
      pool = pool.slice(0, 20)
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5)

    const newSession: BiolSession = {
      id: generateBiolId(),
      mode,
      topicFilter: options.topicFilter,
      questionIds: shuffled.map(q => q.id),
      answers: {},
      startedAt: new Date().toISOString(),
    }
    setSession(newSession)
    setView('session')
  }, [data.questions])

  // ─── Finish session → results ──────────────────────────────────────────────
  const finishSession = useCallback((completed: BiolSession) => {
    setSession(completed)

    const summary = buildSummary(completed)

    const today = todayDateStr()
    const prevData = latestData.current
    let newStreak = prevData.currentStreak
    if (prevData.lastStreakDate !== today) {
      newStreak += 1
    }

    const next: BiolCourseData = {
      ...prevData,
      sessionHistory: [...prevData.sessionHistory, summary],
      currentStreak: newStreak,
      lastStreakDate: today,
    }
    saveData(next)
    updatePluginData({ biolQuizSummary: summary } as never)
    setView('results')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveData, updatePluginData])

  const updateQuestions = useCallback((questions: BiolQuestion[]) => {
    saveData({ ...latestData.current, questions })
  }, [saveData])

  const backToMenu = useCallback(() => {
    setView('menu')
    setSession(null)
  }, [])

  const handleQuizBubble = useCallback((topic: BiolTopic) => {
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
        <BiolMenu
          data={data}
          onStart={startSession}
          onManage={() => setView('editor')}
          onStats={() => setView('stats')}
          onMindMap={() => setView('mindmap')}
        />
      )}

      {view === 'editor' && (
        <React.Suspense fallback={suspenseFallback('editor')}>
          <BiolQuestionEditor
            questions={data.questions}
            onChange={updateQuestions}
            onBack={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'session' && session && (
        <React.Suspense fallback={suspenseFallback('session')}>
          <BiolSessionView
            session={session}
            questions={data.questions}
            onFinish={finishSession}
            onQuit={backToMenu}
          />
        </React.Suspense>
      )}

      {view === 'results' && session && (
        <React.Suspense fallback={suspenseFallback('results')}>
          <BiolResultsView
            session={session}
            questions={data.questions}
            onNewSession={backToMenu}
          />
        </React.Suspense>
      )}

      {view === 'stats' && (
        <React.Suspense fallback={suspenseFallback('analytics')}>
          <BiolStatsView
            courseData={data}
            onBack={() => setView('menu')}
          />
        </React.Suspense>
      )}

      {view === 'mindmap' && (
        <React.Suspense fallback={suspenseFallback('mind map')}>
          <BiolMindMap
            onBack={() => setView('menu')}
            onQuizBubble={handleQuizBubble}
          />
        </React.Suspense>
      )}
    </div>
  )
}
