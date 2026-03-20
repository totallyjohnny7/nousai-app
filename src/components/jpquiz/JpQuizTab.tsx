/**
 * JpQuizTab — Orchestrator for the Japanese Typing/Speaking Quiz
 * Manages view state, loads/saves quiz data AND vocab bank from localStorage
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import type { Course } from '../../types'
import type {
  JpQuizCourseData, JpQuizPreset, JpQuizSession, JpQuizQuestion,
  MiniGameType, VocabBankItem, VocabBankData,
} from './types'
import { createEmptyData, generateQuizId } from './types'
import { DEFAULT_VOCAB_BANK } from '../../data/jpVocabBank'
import { DEFAULT_CONVERSATION_BANK } from '../../data/jpConversationBank'
import { JP_SENTENCES } from '../../data/jpSentenceBank'
import QuizMenu from './QuizMenu'
import QuestionEditor from './QuestionEditor'
import QuizSession from './QuizSession'
import QuizResults from './QuizResults'
import VocabBankTab from './VocabBankTab'
import MemoryFlipGame from './minigames/MemoryFlipGame'
import SentenceBuilderGame from './minigames/SentenceBuilderGame'
import ListeningQuizGame from './minigames/ListeningQuizGame'

const JpMindMap   = React.lazy(() => import('./JpMindMap'))
const JpStudyTool = React.lazy(() => import('../aitools/JpStudyTool'))

const DEFAULT_FULL_BANK = [...DEFAULT_VOCAB_BANK, ...DEFAULT_CONVERSATION_BANK, ...JP_SENTENCES]

type View = 'menu' | 'editor' | 'session' | 'results' | 'minigame' | 'vocabbank' | 'mindmap' | 'jpstudy'

function storageKey(courseId: string) { return `nousai-jpquiz-${courseId}` }
function bankKey(courseId: string) { return `nousai-jpvocab-${courseId}` }

function loadData(courseId: string): JpQuizCourseData {
  try {
    const raw = localStorage.getItem(storageKey(courseId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return createEmptyData()
}

function loadBank(courseId: string): VocabBankItem[] {
  try {
    const raw = localStorage.getItem(bankKey(courseId))
    if (raw) {
      const parsed: VocabBankData = JSON.parse(raw)
      if (Array.isArray(parsed.items)) return parsed.items
    }
  } catch { /* ignore */ }
  // First load: seed with vocab bank + conversation patterns bank
  return DEFAULT_FULL_BANK
}

interface Props {
  course: Course
  onGoToCourseQuizzes?: () => void
}

export default function JpQuizTab({ course, onGoToCourseQuizzes }: Props) {
  const [view, setView] = useState<View>('menu')
  const [data, setData] = useState<JpQuizCourseData>(() => loadData(course.id))
  const [bank, setBank] = useState<VocabBankItem[]>(() => loadBank(course.id))
  const [session, setSession] = useState<JpQuizSession | null>(null)
  const [miniGame, setMiniGame] = useState<MiniGameType | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bankTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced save — quiz data
  const saveData = useCallback((next: JpQuizCourseData) => {
    setData(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(storageKey(course.id), JSON.stringify(next)) }
      catch (e) { console.warn('jpquiz save failed:', e) }
    }, 500)
  }, [course.id])

  // Debounced save — vocab bank
  const saveBank = useCallback((items: VocabBankItem[]) => {
    setBank(items)
    if (bankTimer.current) clearTimeout(bankTimer.current)
    bankTimer.current = setTimeout(() => {
      try {
        const bankData: VocabBankData = { items, version: 1 }
        localStorage.setItem(bankKey(course.id), JSON.stringify(bankData))
      } catch (e) { console.warn('jpvocab save failed:', e) }
    }, 500)
  }, [course.id])

  // Cleanup timers
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (bankTimer.current) clearTimeout(bankTimer.current)
  }, [])

  // Start a new quiz session
  const startSession = useCallback((preset: JpQuizPreset) => {
    if (data.questions.length === 0) return
    const shuffled = [...data.questions].sort(() => Math.random() - 0.5)
    const newSession: JpQuizSession = {
      id: generateQuizId(),
      preset,
      questionIds: shuffled.map(q => q.id),
      answers: [],
      currentIndex: 0,
      startedAt: new Date().toISOString(),
      chatMessages: {},
    }
    setSession(newSession)
    setView('session')
  }, [data.questions])

  // Finish session → results
  const finishSession = useCallback((completed: JpQuizSession) => {
    setSession(completed)
    const avg = completed.answers.length > 0
      ? Math.round(completed.answers.reduce((s, a) => s + a.aiScore, 0) / completed.answers.length)
      : 0
    const totalTime = completed.answers.reduce((s, a) => s + a.timeMs, 0)
    saveData({
      ...data,
      sessionHistory: [
        ...data.sessionHistory,
        { id: completed.id, preset: completed.preset, date: new Date().toISOString(),
          totalQuestions: completed.answers.length, averageScore: avg, totalTimeMs: totalTime },
      ],
    })
    setView('results')
  }, [data, saveData])

  const updateQuestions = useCallback((questions: JpQuizQuestion[]) => {
    saveData({ ...data, questions })
  }, [data, saveData])

  const startMiniGame = useCallback((game: MiniGameType) => {
    setMiniGame(game)
    setView('minigame')
  }, [])

  const backToMenu = useCallback(() => {
    setView('menu')
    setMiniGame(null)
  }, [])

  const TAB_STYLE = (active: boolean, color: string): React.CSSProperties => ({
    flex: 1, padding: '10px 8px', border: 'none', borderRadius: 8,
    background: active ? color : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-muted)',
    fontFamily: 'inherit', fontSize: 13, fontWeight: active ? 700 : 400,
    cursor: 'pointer', transition: 'all 0.15s',
  })

  const inQuizView = !['mindmap', 'jpstudy'].includes(view)
  const inMindMap = view === 'mindmap'
  const inStudy = view === 'jpstudy'

  return (
    <div style={{ padding: '0 4px' }}>
      {/* ── Top tab bar ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, padding: '4px', background: 'var(--bg-card, var(--bg-primary))', borderRadius: 10, border: '1px solid var(--border-color)' }}>
        <button style={TAB_STYLE(inQuizView, '#F5A623')} onClick={() => { if (!inQuizView) setView('menu') }}>
          🇯🇵 Quiz
        </button>
        <button style={TAB_STYLE(inMindMap, '#ec4899')} onClick={() => setView('mindmap')}>
          🗺️ Mind Map
        </button>
        <button style={TAB_STYLE(inStudy, '#8b5cf6')} onClick={() => setView('jpstudy')}>
          📖 JP Study
        </button>
      </div>

      {inQuizView && view === 'menu' && (
        <QuizMenu
          data={data}
          bank={bank}
          onStart={startSession}
          onManage={() => setView('editor')}
          onStartMiniGame={startMiniGame}
          onManageVocab={() => setView('vocabbank')}
          onGoToCourseQuizzes={onGoToCourseQuizzes ?? (() => {})}
        />
      )}
      {view === 'editor' && (
        <QuestionEditor
          questions={data.questions}
          onChange={updateQuestions}
          onBack={() => setView('menu')}
        />
      )}
      {view === 'vocabbank' && (
        <VocabBankTab
          bank={bank}
          onSave={saveBank}
          onBack={() => setView('menu')}
        />
      )}
      {view === 'session' && session && (
        <QuizSession
          session={session}
          questions={data.questions}
          onFinish={finishSession}
          onQuit={() => setView('menu')}
          subject={course.id}
        />
      )}
      {view === 'results' && session && (
        <QuizResults
          session={session}
          questions={data.questions}
          subject={course.id}
          onNewQuiz={() => setView('menu')}
          onReview={() => {
            const wrongIdx = session.answers.findIndex(a => a.aiScore < 80)
            if (wrongIdx >= 0) {
              setSession({ ...session, currentIndex: wrongIdx, finishedAt: undefined })
              setView('session')
            }
          }}
        />
      )}
      {view === 'minigame' && miniGame === 'memory-flip' && (
        <MemoryFlipGame onBack={backToMenu} bank={bank} />
      )}
      {view === 'minigame' && miniGame === 'sentence-builder' && (
        <SentenceBuilderGame onBack={backToMenu} bank={bank} />
      )}
      {view === 'minigame' && miniGame === 'listening-quiz' && (
        <ListeningQuizGame onBack={backToMenu} bank={bank} />
      )}

      {view === 'mindmap' && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading mind map…</div>}>
          <JpMindMap onBack={() => setView('menu')} />
        </React.Suspense>
      )}

      {view === 'jpstudy' && (
        <React.Suspense fallback={<div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>Loading JP Study…</div>}>
          <JpStudyTool />
        </React.Suspense>
      )}
    </div>
  )
}
