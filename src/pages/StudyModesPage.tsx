import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  Brain, Box, Clock, FileText, MapPin, Trophy,
  ChevronRight, ChevronLeft, RotateCcw, Play, Pause,
  Check, X, Eye, EyeOff, Plus, Trash2, Star,
  Flame, Target, Award, Zap, Calendar, Lock,
  ArrowRight, ArrowUp, ArrowDown, Shuffle, Save,
  Upload, Download, Copy, ClipboardCheck
} from 'lucide-react'
import { useStore } from '../store'
import type { FlashcardItem, Course } from '../types'
import RichTextEditor, { markdownToHtml } from '../components/RichTextEditor'
import { callAI, isAIConfigured } from '../utils/ai'
import { sanitizeHtml } from '../utils/sanitize'
import { Sparkles } from 'lucide-react'

/* ================================================================
   TYPES & HELPERS
   ================================================================ */
type StudyMode = 'recall' | 'leitner' | 'pomodoro' | 'cornell' | 'palace' | 'streaks'

interface ModeTab {
  key: StudyMode
  label: string
  icon: React.ReactNode
  desc: string
}

const MODES: ModeTab[] = [
  { key: 'recall', label: 'Active Recall', icon: <Brain size={16} />, desc: 'Test your memory' },
  { key: 'leitner', label: 'Leitner', icon: <Box size={16} />, desc: '5-box system' },
  { key: 'pomodoro', label: 'Pomodoro', icon: <Clock size={16} />, desc: 'Focus timer' },
  { key: 'cornell', label: 'Cornell Notes', icon: <FileText size={16} />, desc: 'Structured notes' },
  { key: 'palace', label: 'Mind Palace', icon: <MapPin size={16} />, desc: 'Memory rooms' },
  { key: 'streaks', label: 'Streaks', icon: <Trophy size={16} />, desc: 'Goals & XP' },
]

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem('nousai-' + key)
    return v ? JSON.parse(v) : fallback
  } catch { return fallback }
}

function lsSet(key: string, val: unknown) {
  localStorage.setItem('nousai-' + key, JSON.stringify(val))
}

function getAllFlashcards(courses: Course[]): (FlashcardItem & { course: string; courseId: string })[] {
  return courses.flatMap(c =>
    (c.flashcards || []).map(f => ({ ...f, course: c.name, courseId: c.id }))
  )
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function buildCourseTopicList(courses: Course[], courseId: string): { id: string; label: string; name: string }[] {
  if (!courseId) return []
  const c = courses.find(c => c.id === courseId)
  if (!c) return []
  const items: { id: string; label: string; name: string }[] = []
  ;(c.topics || []).forEach(t => {
    items.push({ id: t.id, label: t.name, name: t.name })
    ;(t.subtopics || []).forEach((st) =>
      items.push({ id: st.id, label: `${t.name} › ${st.name}`, name: st.name })
    )
  })
  return items
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
export default function StudyModesPage({ embedded = false, initialMode }: { embedded?: boolean; initialMode?: string } = {}) {
  const { loaded } = useStore()
  const [mode, setMode] = useState<StudyMode>((initialMode as StudyMode) ?? 'recall')

  if (!loaded && !embedded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading study modes...</div>
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'animate-in'}>
      {!embedded && (
        <div style={{ marginBottom: 20 }}>
          <h1 className="page-title">Study Modes</h1>
          <p className="page-subtitle">Popular techniques to boost retention and focus</p>
        </div>
      )}

      {/* Horizontal chip selector */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12,
        marginBottom: 20, WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
      }}>
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 20, border: 'none',
              background: mode === m.key ? 'var(--text-primary)' : 'var(--bg-card)',
              color: mode === m.key ? 'var(--bg-primary)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
              borderBottom: mode === m.key ? 'none' : '1px solid var(--border)',
            }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      {mode === 'recall' && <ActiveRecallMode />}
      {mode === 'leitner' && <LeitnerMode />}
      {mode === 'pomodoro' && <PomodoroFocusMode />}
      {mode === 'cornell' && <CornellNotesMode />}
      {mode === 'palace' && <MindPalaceMode />}
      {mode === 'streaks' && <StudyStreaksMode />}
    </div>
  )
}

/* ================================================================
   1. ACTIVE RECALL
   ================================================================ */
interface RecallScore { topic: string; course: string; rating: string; date: string }

function ActiveRecallMode() {
  const { courses } = useStore()
  const allCards = useMemo(() => getAllFlashcards(courses), [courses])

  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [phase, setPhase] = useState<'pick' | 'recall' | 'reveal' | 'rate' | 'done'>('pick')
  const [currentIdx, setCurrentIdx] = useState(0)
  const [userRecall, setUserRecall] = useState('')
  const [recallTime, setRecallTime] = useState(0)
  const [timerActive, setTimerActive] = useState(false)
  const [scores, setScores] = useState<RecallScore[]>(() => lsGet('recall-scores', []))
  const [sessionResults, setSessionResults] = useState<RecallScore[]>([])
  const intervalRef = useRef<number | null>(null)

  const courseTopics = useMemo(() => buildCourseTopicList(courses, selectedCourse), [courses, selectedCourse])

  const filtered = useMemo(() => {
    let cards = allCards
    if (selectedCourse) cards = cards.filter(c => c.courseId === selectedCourse)
    if (selectedTopic) {
      const topicItem = courseTopics.find(t => t.id === selectedTopic)
      if (topicItem) cards = cards.filter(c => c.topic === topicItem.name)
    }
    return cards
  }, [allCards, selectedCourse, selectedTopic, courseTopics])

  const [shuffled, setShuffled] = useState<typeof filtered>([])

  function startSession() {
    const s = [...filtered].sort(() => Math.random() - 0.5)
    setShuffled(s)
    setCurrentIdx(0)
    setSessionResults([])
    setPhase('recall')
    setUserRecall('')
    setRecallTime(0)
    setTimerActive(true)
  }

  useEffect(() => {
    if (timerActive) {
      intervalRef.current = window.setInterval(() => setRecallTime(t => t + 1), 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [timerActive])

  function revealAnswer() {
    setTimerActive(false)
    setPhase('reveal')
  }

  function rateAndNext(rating: string) {
    const card = shuffled[currentIdx]
    const entry: RecallScore = {
      topic: card.front, course: card.course, rating, date: new Date().toISOString()
    }
    const newScores = [...scores, entry]
    setScores(newScores)
    lsSet('recall-scores', newScores)
    setSessionResults(prev => [...prev, entry])

    if (currentIdx + 1 < shuffled.length) {
      setCurrentIdx(currentIdx + 1)
      setPhase('recall')
      setUserRecall('')
      setRecallTime(0)
      setTimerActive(true)
    } else {
      setPhase('done')
    }
  }

  const card = shuffled[currentIdx]

  const sessionStats = useMemo(() => {
    const knew = sessionResults.filter(s => s.rating === 'knew').length
    const partial = sessionResults.filter(s => s.rating === 'partial').length
    const missed = sessionResults.filter(s => s.rating === 'missed').length
    return { knew, partial, missed, total: sessionResults.length }
  }, [sessionResults])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', resize: 'vertical' as const,
  }

  if (allCards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <Brain size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontWeight: 600, marginBottom: 4 }}>No flashcards found</p>
        <p style={{ fontSize: 12 }}>Import data or add flashcards to your courses first.</p>
      </div>
    )
  }

  return (
    <div>
      {phase === 'pick' && (
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              <Brain size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Select a Course
            </div>
            <select
              value={selectedCourse}
              onChange={e => { setSelectedCourse(e.target.value); setSelectedTopic('') }}
              style={{ ...inputStyle, marginBottom: 12 }}
            >
              <option value="">All Courses ({allCards.length} cards)</option>
              {courses.filter(c => c.flashcards?.length > 0).map(c => (
                <option key={c.id} value={c.id}>{c.shortName || c.name} ({c.flashcards.length} cards)</option>
              ))}
            </select>
            {courseTopics.length > 0 && (
              <select
                value={selectedTopic}
                onChange={e => setSelectedTopic(e.target.value)}
                style={{ ...inputStyle, marginBottom: 12 }}
              >
                <option value="">All Topics</option>
                {courseTopics.map(t => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            )}
            <button
              onClick={startSession}
              disabled={filtered.length === 0}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                opacity: filtered.length === 0 ? 0.4 : 1,
              }}
            >
              <Play size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Start Recall Session ({filtered.length} cards)
            </button>
          </div>

          {/* History */}
          {scores.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Recent Scores</div>
                <button onClick={() => { setScores([]); lsSet('recall-scores', []) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
                  Clear
                </button>
              </div>
              {scores.slice(-10).reverse().map((s, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                  borderBottom: '1px solid var(--border)', fontSize: 12,
                }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: s.rating === 'knew' ? 'var(--green)' : s.rating === 'partial' ? 'var(--yellow)' : 'var(--red)',
                  }} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{s.topic}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{s.course}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(phase === 'recall' || phase === 'reveal') && card && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              Card {currentIdx + 1} / {shuffled.length}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {recallTime}s
            </span>
          </div>

          {/* Question card */}
          <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>
              {card.course}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4 }}>
              {card.front}
            </div>
          </div>

          {/* Recall text area */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              Type everything you can recall:
            </div>
            <textarea
              value={userRecall}
              onChange={e => setUserRecall(e.target.value)}
              placeholder="Write your recall here..."
              rows={4}
              style={inputStyle}
              disabled={phase === 'reveal'}
            />
          </div>

          {phase === 'recall' && (
            <button
              onClick={revealAnswer}
              style={{
                width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
                background: 'var(--text-primary)', color: 'var(--bg-primary)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Reveal Answer
            </button>
          )}

          {phase === 'reveal' && (
            <div>
              <div className="card" style={{ marginBottom: 16, borderLeft: '3px solid var(--green)', padding: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>
                  Correct Answer
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>
                  {card.back}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, textAlign: 'center', color: 'var(--text-secondary)' }}>
                How did you do?
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <button onClick={() => rateAndNext('knew')} style={{
                  padding: '12px 8px', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--green-dim)', color: 'var(--green)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> I knew it
                </button>
                <button onClick={() => rateAndNext('partial')} style={{
                  padding: '12px 8px', border: '1px solid var(--yellow)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--yellow-dim)', color: 'var(--yellow)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <ArrowRight size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Partially
                </button>
                <button onClick={() => rateAndNext('missed')} style={{
                  padding: '12px 8px', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--red-dim)', color: 'var(--red)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <X size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Missed it
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <Award size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Session Complete!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {sessionStats.total} cards reviewed
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ padding: 12, background: 'var(--green-dim)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{sessionStats.knew}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Knew it</div>
            </div>
            <div style={{ padding: 12, background: 'var(--yellow-dim)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--yellow)' }}>{sessionStats.partial}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Partial</div>
            </div>
            <div style={{ padding: 12, background: 'var(--red-dim)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{sessionStats.missed}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Missed</div>
            </div>
          </div>
          <button onClick={() => setPhase('pick')} style={{
            padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> New Session
          </button>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   2. LEITNER SYSTEM
   ================================================================ */
interface LeitnerCard {
  id: string
  front: string
  back: string
  course: string
  topic?: string
  box: number // 1-5
  lastReview: string
  nextReview: string
}

const BOX_INTERVALS = [0, 1, 2, 4, 7, 14] // days: box 1=daily, box 2=2d, etc.
const BOX_LABELS = ['', 'Daily', '2 Days', '4 Days', 'Weekly', 'Biweekly']
const BOX_COLORS = ['', 'var(--red)', 'var(--orange)', 'var(--yellow)', 'var(--blue)', 'var(--green)']

function LeitnerMode() {
  const { courses } = useStore()
  const allCards = useMemo(() => getAllFlashcards(courses), [courses])

  const [filterCourse, setFilterCourse] = useState('')
  const [filterTopic, setFilterTopic] = useState('')
  const courseTopics = useMemo(() => buildCourseTopicList(courses, filterCourse), [courses, filterCourse])

  const [leitnerCards, setLeitnerCards] = useState<LeitnerCard[]>(() => {
    const saved = lsGet<LeitnerCard[]>('leitner-cards', [])
    if (saved.length > 0) return saved
    // Initialize from flashcards
    return allCards.map((c, i) => ({
      id: `lc-${i}`,
      front: c.front,
      back: c.back,
      course: c.course,
      topic: c.topic || '',
      box: 1,
      lastReview: '',
      nextReview: todayStr(),
    }))
  })

  const [reviewMode, setReviewMode] = useState(false)
  const [currentReviewIdx, setCurrentReviewIdx] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [reviewResults, setReviewResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 })

  // Sync new flashcards that aren't in leitner yet
  useEffect(() => {
    const existingFronts = new Set(leitnerCards.map(c => c.front + '||' + c.course))
    const newCards = allCards
      .filter(c => !existingFronts.has(c.front + '||' + c.course))
      .map((c, i) => ({
        id: `lc-new-${Date.now()}-${i}`,
        front: c.front,
        back: c.back,
        course: c.course,
        topic: c.topic || '',
        box: 1,
        lastReview: '',
        nextReview: todayStr(),
      }))
    if (newCards.length > 0) {
      const updated = [...leitnerCards, ...newCards]
      setLeitnerCards(updated)
      lsSet('leitner-cards', updated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards])

  function saveLeitner(cards: LeitnerCard[]) {
    setLeitnerCards(cards)
    lsSet('leitner-cards', cards)
  }

  const dueCards = useMemo(() => {
    const today = todayStr()
    let cards = leitnerCards.filter(c => c.nextReview <= today)
    if (filterCourse) {
      const courseName = courses.find(c => c.id === filterCourse)?.name || ''
      cards = cards.filter(c => c.course === courseName)
    }
    if (filterTopic) {
      const topicItem = courseTopics.find(t => t.id === filterTopic)
      if (topicItem) cards = cards.filter(c => c.topic === topicItem.name)
    }
    return cards
  }, [leitnerCards, filterCourse, filterTopic, courseTopics, courses])

  const boxCounts = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0]
    leitnerCards.forEach(c => { counts[c.box] = (counts[c.box] || 0) + 1 })
    return counts
  }, [leitnerCards])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  function startReview() {
    if (dueCards.length === 0) return
    setReviewMode(true)
    setCurrentReviewIdx(0)
    setShowAnswer(false)
    setReviewResults({ correct: 0, wrong: 0 })
  }

  function answerCard(correct: boolean) {
    const card = dueCards[currentReviewIdx]
    const today = todayStr()

    const updatedCards = leitnerCards.map(c => {
      if (c.id !== card.id) return c
      const newBox = correct ? Math.min(5, c.box + 1) : 1
      const nextDate = new Date()
      nextDate.setDate(nextDate.getDate() + BOX_INTERVALS[newBox])
      return { ...c, box: newBox, lastReview: today, nextReview: nextDate.toISOString().split('T')[0] }
    })

    saveLeitner(updatedCards)
    setReviewResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
    }))
    setShowAnswer(false)

    if (currentReviewIdx + 1 < dueCards.length) {
      setCurrentReviewIdx(currentReviewIdx + 1)
    } else {
      setReviewMode(false)
    }
  }

  if (leitnerCards.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
        <Box size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
        <p style={{ fontWeight: 600, marginBottom: 4 }}>No cards in the Leitner system</p>
        <p style={{ fontSize: 12 }}>Add flashcards to your courses to use this feature.</p>
      </div>
    )
  }

  if (reviewMode && dueCards[currentReviewIdx]) {
    const card = dueCards[currentReviewIdx]
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Review {currentReviewIdx + 1} / {dueCards.length}
          </span>
          <button onClick={() => setReviewMode(false)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit'
          }}>
            Exit
          </button>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 16 }}>
          <div style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 10,
            background: BOX_COLORS[card.box] + '22', color: BOX_COLORS[card.box],
            fontSize: 10, fontWeight: 700, marginBottom: 16,
          }}>
            Box {card.box} - {BOX_LABELS[card.box]}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, fontWeight: 700 }}>
            {card.course}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 16 }}>
            {card.front}
          </div>

          {showAnswer && (
            <div style={{
              marginTop: 16, padding: 16, background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--green)',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>
            </div>
          )}
        </div>

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} style={{
            width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Show Answer
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => answerCard(false)} style={{
              padding: '12px', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)',
              background: 'var(--red-dim)', color: 'var(--red)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <ArrowDown size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Wrong - Box 1
            </button>
            <button onClick={() => answerCard(true)} style={{
              padding: '12px', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)',
              background: 'var(--green-dim)', color: 'var(--green)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <ArrowUp size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Correct - Up
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Review results */}
      {(reviewResults.correct > 0 || reviewResults.wrong > 0) && !reviewMode && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center', padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Review Complete</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>
              <Check size={14} style={{ verticalAlign: 'middle' }} /> {reviewResults.correct} correct
            </span>
            <span style={{ color: 'var(--red)', fontWeight: 700 }}>
              <X size={14} style={{ verticalAlign: 'middle' }} /> {reviewResults.wrong} wrong
            </span>
          </div>
        </div>
      )}

      {/* Course/Topic filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          <Target size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Filter Cards
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <select value={filterCourse} onChange={e => { setFilterCourse(e.target.value); setFilterTopic('') }} style={inputStyle}>
            <option value="">All Courses</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
          </select>
          {courseTopics.length > 0 && (
            <select value={filterTopic} onChange={e => setFilterTopic(e.target.value)} style={inputStyle}>
              <option value="">All Topics</option>
              {courseTopics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* 5 Boxes visualization */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          <Box size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Leitner Boxes
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(box => (
            <div key={box} style={{
              padding: 12, textAlign: 'center', borderRadius: 'var(--radius-sm)',
              border: `1px solid ${BOX_COLORS[box]}33`, background: `${BOX_COLORS[box]}11`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: BOX_COLORS[box] }}>{boxCounts[box] || 0}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginTop: 2 }}>Box {box}</div>
              <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{BOX_LABELS[box]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Due cards button */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Due Today</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {dueCards.length} card{dueCards.length !== 1 ? 's' : ''} ready for review
            </div>
          </div>
          <button
            onClick={startReview}
            disabled={dueCards.length === 0}
            style={{
              padding: '10px 20px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: dueCards.length > 0 ? 'var(--text-primary)' : 'var(--bg-card)',
              color: dueCards.length > 0 ? 'var(--bg-primary)' : 'var(--text-dim)',
              fontSize: 13, fontWeight: 700, cursor: dueCards.length > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}
          >
            <Play size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Review
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Progress</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{leitnerCards.length}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Cards</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{boxCounts[5] || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mastered</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--red)' }}>{boxCounts[1] || 0}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Needs Work</div>
          </div>
        </div>
        {leitnerCards.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className="progress-fill" style={{
                width: `${Math.round(((boxCounts[4] || 0) + (boxCounts[5] || 0)) / leitnerCards.length * 100)}%`,
                background: 'var(--green)'
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
              {Math.round(((boxCounts[4] || 0) + (boxCounts[5] || 0)) / leitnerCards.length * 100)}% in boxes 4-5
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   3. POMODORO FOCUS
   ================================================================ */
type PomoPhase = 'idle' | 'focus' | 'break' | 'longBreak'

interface FocusSession { date: string; courseId: string; topic: string; minutes: number; completed: boolean }

function PomodoroFocusMode() {
  const { courses } = useStore()

  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [workMin, setWorkMin] = useState(25)
  const [breakMin, setBreakMin] = useState(5)
  const [phase, setPhase] = useState<PomoPhase>('idle')
  const [running, setRunning] = useState(false)
  const [remainMs, setRemainMs] = useState(25 * 60 * 1000)
  const [sessionCount, setSessionCount] = useState(0)
  const [treeAlive, setTreeAlive] = useState(true)
  const [sessions, setSessions] = useState<FocusSession[]>(() => lsGet('pomo-sessions', []))
  const [breatheMode, setBreatheMode] = useState(false)

  const intervalRef = useRef<number | null>(null)
  const endTimeRef = useRef(0)

  const totalMs = phase === 'focus' ? workMin * 60000
    : phase === 'break' ? breakMin * 60000
    : phase === 'longBreak' ? 15 * 60000
    : workMin * 60000

  const circumference = 2 * Math.PI * 100
  const progress = remainMs / totalMs
  const dashOffset = circumference * (1 - progress)

  const phaseColor = phase === 'focus' ? 'var(--accent)' : phase === 'break' ? 'var(--green)' : phase === 'longBreak' ? 'var(--blue)' : 'var(--accent)'
  const phaseLabel = phase === 'focus' ? 'FOCUS' : phase === 'break' ? 'SHORT BREAK' : phase === 'longBreak' ? 'LONG BREAK' : 'READY'

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    endTimeRef.current = Date.now() + remainMs
    intervalRef.current = window.setInterval(() => {
      const left = endTimeRef.current - Date.now()
      if (left <= 0) {
        clearInterval(intervalRef.current!)
        setRemainMs(0)
        setRunning(false)
        handlePhaseEnd()
      } else {
        setRemainMs(left)
      }
    }, 200)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  function handlePhaseEnd() {
    if (phase === 'focus') {
      const newCount = sessionCount + 1
      setSessionCount(newCount)
      // Log session
      const sess: FocusSession = {
        date: new Date().toISOString(), courseId: selectedCourse,
        topic: selectedTopic, minutes: workMin, completed: true,
      }
      const updated = [...sessions, sess]
      setSessions(updated)
      lsSet('pomo-sessions', updated)

      if (newCount % 4 === 0) {
        setPhase('longBreak')
        setRemainMs(15 * 60000)
      } else {
        setPhase('break')
        setRemainMs(breakMin * 60000)
      }
    } else {
      setPhase('focus')
      setRemainMs(workMin * 60000)
    }
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('NousAI Pomodoro', { body: phase === 'focus' ? 'Time for a break!' : 'Back to focusing!' })
      }
    } catch {}
  }

  function startFocus() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    if (phase === 'idle') {
      setPhase('focus')
      setRemainMs(workMin * 60000)
    }
    setTreeAlive(true)
    setRunning(true)
  }

  function pauseTimer() {
    setRunning(false)
    if (phase === 'focus') setTreeAlive(false) // tree dies if you leave during focus
  }

  function resetTimer() {
    setRunning(false)
    setPhase('idle')
    setRemainMs(workMin * 60000)
    setTreeAlive(true)
  }

  const mins = Math.floor(remainMs / 60000)
  const secs = Math.floor((remainMs % 60000) / 1000)
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  // Today's stats
  const todayKey = todayStr()
  const todaySessions = sessions.filter(s => s.date.startsWith(todayKey))
  const todayMinutes = todaySessions.reduce((a, s) => a + s.minutes, 0)
  const todayCount = todaySessions.length

  const courseTopics = useMemo(() => buildCourseTopicList(courses, selectedCourse), [courses, selectedCourse])

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div>
      {/* Course/Topic selector */}
      {phase === 'idle' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
            <Target size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Focus Session Setup
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedTopic('') }} style={inputStyle}>
              <option value="">Select course (optional)...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
            </select>
            {courseTopics.length > 0 && (
              <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} style={inputStyle}>
                <option value="">Select topic (optional)...</option>
                {courseTopics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Focus (min)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setWorkMin(Math.max(5, workMin - 5))} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>-</button>
                  <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{workMin}</span>
                  <button onClick={() => setWorkMin(workMin + 5)} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>+</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Break (min)</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setBreakMin(Math.max(1, breakMin - 1))} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>-</button>
                  <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{breakMin}</span>
                  <button onClick={() => setBreakMin(breakMin + 1)} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timer Ring */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 20 }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <svg viewBox="0 0 220 220" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <circle cx="110" cy="110" r="100" fill="none" stroke="var(--border)" strokeWidth={4} />
            <circle cx="110" cy="110" r="100" fill="none" stroke={phaseColor}
              strokeWidth={4} strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s linear' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{timeStr}</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700 }}>
              {phaseLabel}
            </span>
          </div>
        </div>

        {/* Tree gamification */}
        {phase === 'focus' && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>{treeAlive ? '🌱' : '🥀'}</div>
            <div style={{ fontSize: 10, color: treeAlive ? 'var(--green)' : 'var(--red)', fontWeight: 700, marginTop: 4 }}>
              {treeAlive ? 'Your tree is growing! Stay focused.' : 'Your tree wilted! Stay on the page next time.'}
            </div>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={resetTimer} style={{
            padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)', color: 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 13,
          }}>
            <RotateCcw size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Reset
          </button>
          {running ? (
            <button onClick={pauseTimer} style={{
              padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>
              <Pause size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Pause
            </button>
          ) : (
            <button onClick={startFocus} style={{
              padding: '10px 24px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14,
            }}>
              <Play size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {phase === 'idle' ? 'Start Focus' : 'Resume'}
            </button>
          )}
        </div>
      </div>

      {/* Break activity - breathing */}
      {(phase === 'break' || phase === 'longBreak') && !running && (
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Break Time Activities</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => setBreatheMode(!breatheMode)} style={{
              padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: breatheMode ? 'var(--blue-dim)' : 'var(--bg-card)',
              color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            }}>
              Breathing Exercise
            </button>
            <div style={{
              padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600,
            }}>
              Stand up & stretch!
            </div>
          </div>
          {breatheMode && (
            <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%', margin: '0 auto 12px',
                background: 'var(--blue-dim)', border: '2px solid var(--blue)',
                animation: 'pulse 4s infinite',
              }} />
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Breathe in 4s... Hold 4s... Out 4s...
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session counter & daily stats */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          <Flame size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Today's Focus Stats
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent)' }}>{sessionCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Current Session</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>{todayCount}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Today</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--blue)' }}>{todayMinutes}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Minutes</div>
          </div>
        </div>
        {/* Session dots */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, justifyContent: 'center' }}>
          {Array.from({ length: Math.max(4, sessionCount + 1) }, (_, i) => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i < sessionCount ? 'var(--accent)' : i === sessionCount && phase === 'focus' && running ? 'var(--accent-light)' : 'var(--border)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   4. CORNELL NOTES
   ================================================================ */
interface CornellNote {
  id: string
  courseId: string
  topic: string
  cues: string        // HTML (rich text) or plain text (legacy)
  notes: string       // HTML (rich text) or plain text (legacy)
  summary: string     // HTML (rich text) or plain text (legacy)
  topicIds?: string[] // linked course topic IDs
  createdAt: string
  updatedAt: string
}

function CornellNotesMode() {
  const { courses, data, updatePluginData } = useStore()

  const [savedNotes, setSavedNotes] = useState<CornellNote[]>(() => lsGet('cornell-notes', []))
  const [editing, setEditing] = useState<CornellNote | null>(null)
  const [showList, setShowList] = useState(true)
  const [topicIds, setTopicIds] = useState<string[]>([])

  // Refs for RichTextEditor content (onContentChange callbacks)
  const cuesRef = useRef('')
  const notesRef = useRef('')
  const summaryRef = useRef('')

  // Check localStorage for prefill (from Study Tools panel)
  useEffect(() => {
    const prefill = localStorage.getItem('nousai-cornell-prefill')
    if (prefill) {
      try {
        const p = JSON.parse(prefill)
        const note: CornellNote = {
          id: Date.now().toString(),
          courseId: p.courseId || '', topic: p.topic || '',
          cues: p.aiCues || '',
          notes: p.aiNotes || markdownToHtml(p.content || ''),
          summary: p.aiSummary || '',
          topicIds: p.topicIds || [],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        setEditing(note)
        setTopicIds(note.topicIds || [])
        cuesRef.current = note.cues
        notesRef.current = note.notes
        summaryRef.current = note.summary
        setShowList(false)
        localStorage.removeItem('nousai-cornell-prefill')
      } catch { /* ignore */ }
    }
  }, [])

  // Build topic list for selected course (same pattern as LibraryPage)
  const selectedCourseTopics = useMemo(() => {
    const cid = editing?.courseId
    if (!cid) return []
    const c = courses.find(c => c.id === cid)
    if (!c) return []
    const items: { id: string; label: string }[] = []
    ;(c.topics || []).forEach(t => {
      items.push({ id: t.id, label: t.name })
      ;(t.subtopics || []).forEach((st) =>
        items.push({ id: st.id, label: `${t.name} > ${st.name}` })
      )
    })
    return items
  }, [editing?.courseId, courses])

  function createNew() {
    const note: CornellNote = {
      id: Date.now().toString(),
      courseId: '', topic: '', cues: '', notes: '', summary: '',
      topicIds: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    setEditing(note)
    setTopicIds([])
    cuesRef.current = ''
    notesRef.current = ''
    summaryRef.current = ''
    setShowList(false)
  }

  function saveNote() {
    if (!editing) return
    const updated: CornellNote = {
      ...editing,
      cues: cuesRef.current,
      notes: notesRef.current,
      summary: summaryRef.current,
      topicIds,
      updatedAt: new Date().toISOString(),
    }
    const existingIdx = savedNotes.findIndex(n => n.id === updated.id)
    let newNotes: CornellNote[]
    if (existingIdx >= 0) {
      newNotes = savedNotes.map(n => n.id === updated.id ? updated : n)
    } else {
      newNotes = [...savedNotes, updated]
    }
    setSavedNotes(newNotes)
    lsSet('cornell-notes', newNotes)

    // Cross-save to Library (store → IndexedDB)
    crossSaveToLibrary(updated)

    setEditing(null)
    setShowList(true)
  }

  function crossSaveToLibrary(note: CornellNote) {
    if (!data) return
    const libNoteId = `cornell-${note.id}`
    const existingNotes = data.pluginData.notes || []
    // Combine Cornell sections into formatted HTML
    const combinedHtml = `<h2>Cues / Questions</h2>${note.cues || '<p></p>'}<h2>Notes</h2>${note.notes || '<p></p>'}<h2>Summary</h2>${note.summary || '<p></p>'}`
    const libNote = {
      id: libNoteId,
      type: 'note' as const,
      title: note.topic || 'Cornell Note',
      content: combinedHtml,
      folder: 'Cornell Notes',
      courseId: note.courseId || undefined,
      topicIds: note.topicIds?.length ? note.topicIds : undefined,
      tags: ['cornell'],
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }
    const idx = existingNotes.findIndex((n) => n.id === libNoteId)
    const updatedNotes = idx >= 0
      ? existingNotes.map((n, i) => i === idx ? libNote : n)
      : [...existingNotes, libNote]

    updatePluginData({ notes: updatedNotes })
  }

  function deleteNote(id: string) {
    const newNotes = savedNotes.filter(n => n.id !== id)
    setSavedNotes(newNotes)
    lsSet('cornell-notes', newNotes)
    // Also remove from Library
    if (data) {
      const libNotes = (data.pluginData.notes || []).filter((n) => n.id !== `cornell-${id}`)
      updatePluginData({ notes: libNotes })
    }
  }

  function editNote(note: CornellNote) {
    const n = { ...note }
    // Convert legacy plain text to HTML for TipTap
    n.cues = markdownToHtml(n.cues || '')
    n.notes = markdownToHtml(n.notes || '')
    n.summary = markdownToHtml(n.summary || '')
    cuesRef.current = n.cues
    notesRef.current = n.notes
    summaryRef.current = n.summary
    setEditing(n)
    setTopicIds(n.topicIds || [])
    setShowList(false)
  }

  // ── Import / Export ──
  function handleExport() {
    const json = JSON.stringify(savedNotes, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'cornell-notes-export.json'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Auto-format & Import ──
  function autoFormatJson(raw: string): { notes: any[]; fixes: string[] } {
    const fixes: string[] = []
    let text = raw.trim()

    // 1. Strip markdown code fences (```json ... ``` or ``` ... ```)
    if (/^```/.test(text)) {
      text = text.replace(/^```(?:json|JSON)?\s*\n?/, '').replace(/\n?```\s*$/, '')
      fixes.push('Stripped markdown code fences')
    }

    // 2. Try direct JSON.parse first
    let parsed: any
    try {
      parsed = JSON.parse(text)
    } catch {
      // 3. Try fixing common JSON issues
      let fixed = text
      // Remove trailing commas before } or ]
      fixed = fixed.replace(/,\s*([}\]])/g, '$1')
      if (fixed !== text) fixes.push('Removed trailing commas')
      // Replace single quotes with double quotes (careful with apostrophes in content)
      // Only do this if it looks like single-quoted keys/values
      if (/^\s*\[\s*\{\s*'/.test(fixed) || /^\s*\{\s*'/.test(fixed)) {
        fixed = fixed.replace(/'/g, '"')
        fixes.push('Converted single quotes to double quotes')
      }
      // Try parsing the fixed version
      try {
        parsed = JSON.parse(fixed)
      } catch {
        // 4. Last resort: try to extract JSON array/object from the text
        const arrMatch = text.match(/\[[\s\S]*\]/)
        const objMatch = text.match(/\{[\s\S]*\}/)
        const candidate = arrMatch?.[0] || objMatch?.[0]
        if (candidate) {
          try {
            parsed = JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'))
            fixes.push('Extracted JSON from surrounding text')
          } catch {
            throw new Error('Could not parse JSON even after auto-format attempts')
          }
        } else {
          throw new Error('No valid JSON found in file')
        }
      }
    }

    // 5. Normalize to array
    let arr: any[]
    if (Array.isArray(parsed)) {
      arr = parsed
    } else if (parsed && typeof parsed === 'object') {
      // Check for nested array: { "notes": [...] }, { "data": [...] }, etc.
      const possibleKeys = ['notes', 'data', 'items', 'cornellNotes', 'cornell_notes', 'results']
      const nestedKey = possibleKeys.find(k => Array.isArray(parsed[k]))
      if (nestedKey) {
        arr = parsed[nestedKey]
        fixes.push(`Unwrapped array from "${nestedKey}" key`)
      } else {
        // Single object → wrap in array
        arr = [parsed]
        fixes.push('Wrapped single note object into array')
      }
    } else {
      throw new Error('Parsed JSON is not an object or array')
    }

    // 6. Auto-fix each note
    const now = new Date().toISOString()
    const usedIds = new Set<string>()
    const fixedNotes = arr.map((n: any, i: number) => {
      if (!n || typeof n !== 'object') return null
      const noteFixLabels: string[] = []

      // Fix ID: generate unique if missing or duplicate
      let id = n.id
      if (!id || typeof id !== 'string' || usedIds.has(id)) {
        id = Date.now().toString() + '-' + i + '-' + Math.random().toString(36).slice(2, 6)
        noteFixLabels.push('generated ID')
      }
      usedIds.add(id)

      // Fix topicIds: ensure array
      let topicIds = n.topicIds
      if (typeof topicIds === 'string') {
        topicIds = topicIds.split(',').map((s: string) => s.trim()).filter(Boolean)
        noteFixLabels.push('converted topicIds string→array')
      } else if (!Array.isArray(topicIds)) {
        topicIds = []
      }

      // Fix content: handle "content" field that some AI formats use
      let cues = n.cues || n.questions || n.keywords || ''
      let notes = n.notes || n.content || n.details || n.explanation || ''
      let summary = n.summary || n.recap || n.overview || ''
      if (n.questions && !n.cues) noteFixLabels.push('mapped "questions"→cues')
      if (n.content && !n.notes) noteFixLabels.push('mapped "content"→notes')

      // Fix topic/title field
      const topic = n.topic || n.title || n.name || `Note ${i + 1}`
      if (!n.topic && (n.title || n.name)) noteFixLabels.push('mapped title→topic')

      if (noteFixLabels.length > 0 && i < 3) {
        fixes.push(`Note ${i + 1}: ${noteFixLabels.join(', ')}`)
      }

      return {
        id,
        courseId: n.courseId || n.course_id || '',
        topic,
        cues: markdownToHtml(cues),
        notes: markdownToHtml(notes),
        summary: markdownToHtml(summary),
        topicIds,
        createdAt: n.createdAt || n.created_at || now,
        updatedAt: n.updatedAt || n.updated_at || now,
      }
    }).filter(Boolean) as CornellNote[]

    if (fixedNotes.length < arr.length) {
      fixes.push(`Skipped ${arr.length - fixedNotes.length} invalid entries`)
    }

    return { notes: fixedNotes, fixes }
  }

  function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json,.txt'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const { notes: newNotes, fixes } = autoFormatJson(text)

        if (newNotes.length === 0) {
          alert('No valid notes found in file.')
          return
        }

        // Merge: skip duplicates by ID
        const existingIds = new Set(savedNotes.map(n => n.id))
        const toAdd = newNotes.filter(n => !existingIds.has(n.id))
        const merged = [...savedNotes, ...toAdd]
        setSavedNotes(merged)
        lsSet('cornell-notes', merged)

        const fixReport = fixes.length > 0
          ? `\n\nAuto-fixes applied:\n• ${fixes.join('\n• ')}`
          : ''
        alert(`Imported ${toAdd.length} new note(s). ${newNotes.length - toAdd.length} duplicate(s) skipped.${fixReport}`)
      } catch (err: any) {
        alert(`Import failed: ${err.message || 'Could not parse file.'}`)
      }
    }
    input.click()
  }

  // ── Generate Import Prompt ──
  const [showPromptGen, setShowPromptGen] = useState(false)
  const [promptCourseId, setPromptCourseId] = useState('')
  const [promptTopicIds, setPromptTopicIds] = useState<string[]>([])
  const [promptCopied, setPromptCopied] = useState(false)
  const [promptNoteCount, setPromptNoteCount] = useState(3)

  const promptCourseTopics = useMemo(() => {
    if (!promptCourseId) return []
    const c = courses.find(c => c.id === promptCourseId)
    if (!c) return []
    const items: { id: string; label: string }[] = []
    ;(c.topics || []).forEach(t => {
      items.push({ id: t.id, label: t.name })
      ;(t.subtopics || []).forEach((st) =>
        items.push({ id: st.id, label: `${t.name} > ${st.name}` })
      )
    })
    return items
  }, [promptCourseId, courses])

  function generateImportPrompt(): string {
    const course = courses.find(c => c.id === promptCourseId)
    const courseName = course?.name || 'Unknown Course'
    const selectedTopicLabels = promptTopicIds.map(id => {
      const item = promptCourseTopics.find(t => t.id === id)
      return item?.label || id
    })

    const exampleNote = {
      topic: selectedTopicLabels[0] ? `[Fill: Title for ${selectedTopicLabels[0]}]` : '[Note title]',
      courseId: promptCourseId,
      topicIds: promptTopicIds,
      cues: '[Key questions, keywords — use markdown: **bold**, bullet lists, etc.]',
      notes: '[Detailed notes — use markdown formatting: headings, lists, bold, etc.]',
      summary: '[2-3 sentence summary of the key points]',
    }

    return `Generate ${promptNoteCount} Cornell Notes in JSON array format for the following course and topics.

**Course**: ${courseName}
**Course ID**: ${promptCourseId}
**Topics to cover** (create ${promptNoteCount === 1 ? '1 note' : `${promptNoteCount} separate notes`}):
${selectedTopicLabels.length > 0 ? selectedTopicLabels.map((t, i) => `${i + 1}. ${t}`).join('\n') : '(Select topics above)'}

**Topic IDs** (use these exact values in the topicIds field):
${JSON.stringify(promptTopicIds)}

Return ONLY a valid JSON array (no markdown code fences). Each note should follow this exact structure:

${JSON.stringify([exampleNote], null, 2)}

**Rules:**
- Each note must have a unique descriptive "topic" title
- "courseId" must be "${promptCourseId}" for every note
- "topicIds" should contain the relevant topic IDs from the list above (a note can link to multiple topics)
- "cues" should contain key questions and keywords for the left column (markdown)
- "notes" should contain detailed explanations for the right column (markdown with headings, lists, bold)
- "summary" should be a 2-3 sentence recap (markdown)
- Content should be educational, specific, and detailed
- Make each note substantive — at least 200 words in the notes field`
  }

  function copyPrompt() {
    const prompt = generateImportPrompt()
    navigator.clipboard.writeText(prompt).then(() => {
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    })
  }

  // ── One-click AI Bulk Generate ──
  const [bulkAiLoading, setBulkAiLoading] = useState(false)
  const [bulkAiStatus, setBulkAiStatus] = useState('')

  async function aiBulkGenerate() {
    if (!promptCourseId || promptTopicIds.length === 0) return
    if (!isAIConfigured()) {
      alert('AI is not configured. Go to Settings to set up an AI provider and API key.')
      return
    }
    setBulkAiLoading(true)
    setBulkAiStatus('Generating notes with AI...')
    try {
      const prompt = generateImportPrompt()
      const result = await callAI([{ role: 'user', content: prompt }], {}, 'analysis')

      setBulkAiStatus('Parsing & importing...')
      const { notes: newNotes, fixes } = autoFormatJson(result)

      if (newNotes.length === 0) {
        setBulkAiStatus('')
        alert('AI returned no valid notes. Try again or adjust your selection.')
        return
      }

      // Merge
      const existingIds = new Set(savedNotes.map(n => n.id))
      const toAdd = newNotes.filter(n => !existingIds.has(n.id))
      const merged = [...savedNotes, ...toAdd]
      setSavedNotes(merged)
      lsSet('cornell-notes', merged)

      setBulkAiStatus(`✓ ${toAdd.length} note(s) generated & imported!`)
      setTimeout(() => {
        setShowPromptGen(false)
        setBulkAiStatus('')
      }, 1500)
    } catch (err: any) {
      console.error('AI bulk generate failed:', err)
      setBulkAiStatus('')
      alert(`AI generation failed: ${err.message || 'Check your AI settings and try again.'}`)
    } finally {
      setBulkAiLoading(false)
    }
  }

  // Strip HTML to plain text for preview
  function stripHtml(html: string): string {
    const div = document.createElement('div')
    div.innerHTML = html
    return div.textContent || div.innerText || ''
  }

  // ── AI Generation ──
  const [aiLoading, setAiLoading] = useState(false)

  async function aiGenerate() {
    if (!editing?.topic && !editing?.courseId) {
      alert('Please enter a topic or select a course first.')
      return
    }
    if (!isAIConfigured()) {
      alert('AI is not configured. Go to Settings to set up an AI provider and API key.')
      return
    }
    setAiLoading(true)
    try {
      const courseName = courses.find(c => c.id === editing.courseId)?.name || ''
      const prompt = `Create comprehensive Cornell Notes for the following topic.
${courseName ? `Course: ${courseName}` : ''}
Topic: ${editing.topic || 'General review'}

Return ONLY a JSON object with three fields (no markdown code fences):
{
  "cues": "HTML formatted key questions, keywords, and main ideas (use <ul><li> for bullet points)",
  "notes": "HTML formatted detailed notes with explanations (use <h3>, <p>, <ul><li>, <strong> tags)",
  "summary": "HTML formatted brief summary in 2-3 sentences"
}

Make the content educational, specific, and detailed. Use proper HTML formatting.`

      const result = await callAI([{ role: 'user', content: prompt }], {}, 'analysis')
      // Parse JSON from result (handle possible markdown code fences)
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      if (parsed.cues) {
        cuesRef.current = parsed.cues
        notesRef.current = parsed.notes || ''
        summaryRef.current = parsed.summary || ''
        // Force re-render by updating editing with new content
        setEditing({
          ...editing,
          cues: parsed.cues,
          notes: parsed.notes || '',
          summary: parsed.summary || '',
        })
      }
    } catch (err) {
      console.error('AI generation failed:', err)
      alert('AI generation failed. Please check your AI settings and try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
    outline: 'none', resize: 'vertical' as const,
  }

  const [previewMode, setPreviewMode] = useState(false)

  const previewHtmlStyle: React.CSSProperties = {
    padding: 14, fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)',
    overflowY: 'auto',
  }

  if (!showList && editing) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => { setShowList(true); setEditing(null); setPreviewMode(false) }} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}>
            <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Back
          </button>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPreviewMode(!previewMode)} style={{
              padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: previewMode ? 'var(--accent, #6366f1)' : 'var(--bg-card)',
              color: previewMode ? '#fff' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {previewMode ? <><EyeOff size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Edit</> : <><Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Preview</>}
            </button>
            <button onClick={aiGenerate} disabled={aiLoading} style={{
              padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--accent, #6366f1)',
              fontSize: 12, fontWeight: 700, cursor: aiLoading ? 'wait' : 'pointer', fontFamily: 'inherit',
              opacity: aiLoading ? 0.6 : 1,
            }}>
              <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {aiLoading ? 'Generating...' : 'AI Generate'}
            </button>
            <button onClick={saveNote} style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Save size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Save
            </button>
          </div>
        </div>

        {/* Course selector + Topic title */}
        {!previewMode && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <select value={editing.courseId} onChange={e => { setEditing({ ...editing, courseId: e.target.value }); setTopicIds([]) }} style={inputStyle}>
                <option value="">Course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
              </select>
              <input
                type="text" placeholder="Note title / topic..."
                value={editing.topic} onChange={e => setEditing({ ...editing, topic: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* Topic tag pills */}
            {editing.courseId && selectedCourseTopics.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Link to Topics</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {selectedCourseTopics.map(t => {
                    const selected = topicIds.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => setTopicIds(prev => selected ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                        style={{
                          padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: selected ? 'var(--accent, #6366f1)20' : 'var(--bg-secondary)',
                          border: `1px solid ${selected ? 'var(--accent, #6366f1)' : 'var(--border)'}`,
                          color: selected ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                          fontFamily: 'inherit',
                        }}
                      >
                        {selected && <Check size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />}
                        {t.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Template hint */}
            {!editing.cues && !editing.notes && (
              <div style={{
                padding: 12, marginBottom: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                border: '1px dashed var(--border)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Cornell Method:</strong><br />
                <strong>Cues (left):</strong> Key questions, keywords, main ideas<br />
                <strong>Notes (right):</strong> Detailed notes during lecture/reading<br />
                <strong>Summary (bottom):</strong> Brief summary in your own words
              </div>
            )}
          </>
        )}

        {/* Preview mode — title bar */}
        {previewMode && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{editing.topic || 'Untitled'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {courses.find(c => c.id === editing.courseId)?.name || 'No course'}
              {topicIds.length > 0 && ` · ${topicIds.length} linked topic${topicIds.length > 1 ? 's' : ''}`}
            </div>
          </div>
        )}

        {/* Cornell layout — Cues + Summary (left), Notes (right) */}
        <div style={{
          display: 'grid', gridTemplateColumns: '30% 70%', gridTemplateRows: '1fr auto',
          border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
        }}>
          {/* Cues / Questions — top left */}
          <div style={{ borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ padding: '12px 12px 0', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
              Cues / Questions
            </div>
            {previewMode ? (
              <div style={previewHtmlStyle} className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(cuesRef.current || editing.cues || '<span style="color:var(--text-dim)">(empty)</span>') }} />
            ) : (
              <RichTextEditor
                key={`cues-${editing.id}`}
                initialContent={editing.cues}
                onContentChange={html => { cuesRef.current = html }}
                placeholder="Key questions, keywords, main ideas..."
                minHeight={180}
                autoFocus={false}
              />
            )}
          </div>

          {/* Notes — right column spanning both rows */}
          <div style={{ gridColumn: 2, gridRow: '1 / 3', background: 'var(--bg-card)' }}>
            <div style={{ padding: '12px 12px 0', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
              Notes
            </div>
            {previewMode ? (
              <div style={{ ...previewHtmlStyle, maxHeight: 500, overflowY: 'auto' }} className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(notesRef.current || editing.notes || '<span style="color:var(--text-dim)">(empty)</span>') }} />
            ) : (
              <RichTextEditor
                key={`notes-${editing.id}`}
                initialContent={editing.notes}
                onContentChange={html => { notesRef.current = html }}
                placeholder="Detailed notes from lecture or reading..."
                minHeight={350}
                autoFocus={false}
              />
            )}
          </div>

          {/* Summary — bottom left, level with cues */}
          <div style={{ borderRight: '1px solid var(--border)', borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ padding: '12px 12px 0', fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
              Summary
            </div>
            {previewMode ? (
              <div style={previewHtmlStyle} className="prose" dangerouslySetInnerHTML={{ __html: sanitizeHtml(summaryRef.current || editing.summary || '<span style="color:var(--text-dim)">(empty)</span>') }} />
            ) : (
              <RichTextEditor
                key={`summary-${editing.id}`}
                initialContent={editing.summary}
                onContentChange={html => { summaryRef.current = html }}
                placeholder="Summarize the key points in your own words..."
                minHeight={100}
                autoFocus={false}
              />
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Cornell Notes
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {savedNotes.length > 0 && (
            <>
              <button onClick={handleImport} title="Import JSON" style={{
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Upload size={12} style={{ verticalAlign: 'middle' }} />
              </button>
              <button onClick={handleExport} title="Export JSON" style={{
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Download size={12} style={{ verticalAlign: 'middle' }} />
              </button>
            </>
          )}
          {savedNotes.length === 0 && (
            <button onClick={handleImport} title="Import JSON" style={{
              padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Upload size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Import
            </button>
          )}
          <button onClick={() => { setShowPromptGen(true); setPromptCopied(false) }} title="Generate Import Prompt" style={{
            padding: '8px 10px', border: '1px solid var(--accent, #6366f1)40', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent, #6366f1)10', color: 'var(--accent, #6366f1)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Copy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Prompt
          </button>
          <button onClick={createNew} style={{
            padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> New Note
          </button>
        </div>
      </div>

      {savedNotes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
          <p style={{ fontWeight: 600, marginBottom: 4 }}>No Cornell notes yet</p>
          <p style={{ fontSize: 12 }}>Create your first structured note or import from JSON.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {savedNotes.slice().reverse().map(note => {
            const courseName = courses.find(c => c.id === note.courseId)?.name || 'No course'
            const summaryText = stripHtml(note.summary)
            return (
              <div key={note.id} className="card" style={{ padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}
                onClick={() => editNote(note)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    {note.topic || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {courseName} &bull; {new Date(note.updatedAt).toLocaleDateString()}
                  </div>
                  {/* Topic pills in list view */}
                  {note.topicIds && note.topicIds.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                      {note.topicIds.slice(0, 3).map(tid => {
                        const c = courses.find(c => c.id === note.courseId)
                        let label = tid
                        if (c) {
                          for (const t of (c.topics || [])) {
                            if (t.id === tid) { label = t.name; break }
                            for (const st of (t.subtopics || [])) {
                              if (st.id === tid) { label = st.name; break }
                            }
                          }
                        }
                        return (
                          <span key={tid} style={{
                            padding: '1px 6px', borderRadius: 8, fontSize: 9, fontWeight: 600,
                            background: 'var(--accent, #6366f1)15', color: 'var(--accent, #6366f1)',
                            border: '1px solid var(--accent, #6366f1)30',
                          }}>{label}</span>
                        )
                      })}
                      {note.topicIds.length > 3 && (
                        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{note.topicIds.length - 3}</span>
                      )}
                    </div>
                  )}
                  {summaryText && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4 }}>
                      {summaryText.slice(0, 100)}{summaryText.length > 100 ? '...' : ''}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); deleteNote(note.id) }} style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4,
                  }}>
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Generate Import Prompt Modal ── */}
      {showPromptGen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }} onClick={() => setShowPromptGen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'var(--bg-primary)', borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid var(--border)', width: '100%', maxWidth: 560,
            maxHeight: '85vh', overflow: 'auto', padding: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                <Copy size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Generate Import Prompt
              </div>
              <button onClick={() => setShowPromptGen(false)} style={{
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
              }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              Select a course and topics below. A prompt will be generated that you can copy and paste into any AI (ChatGPT, Claude, etc.) to create Cornell Notes JSON ready for import.
            </p>

            {/* Course selector */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Course</label>
              <select value={promptCourseId} onChange={e => { setPromptCourseId(e.target.value); setPromptTopicIds([]) }} style={{
                width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
              }}>
                <option value="">Select a course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
              </select>
            </div>

            {/* Topic tag pills */}
            {promptCourseId && promptCourseTopics.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Topics ({promptTopicIds.length} selected)
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {promptCourseTopics.map(t => {
                    const sel = promptTopicIds.includes(t.id)
                    return (
                      <button key={t.id} onClick={() => setPromptTopicIds(sel ? promptTopicIds.filter(x => x !== t.id) : [...promptTopicIds, t.id])} style={{
                        padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                        border: sel ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border)',
                        background: sel ? 'var(--accent, #6366f1)15' : 'var(--bg-card)',
                        color: sel ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>{t.label}</button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Note count */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Number of notes to generate
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                {[1, 3, 5, 10].map(n => (
                  <button key={n} onClick={() => setPromptNoteCount(n)} style={{
                    padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 700,
                    border: promptNoteCount === n ? '1px solid var(--accent, #6366f1)' : '1px solid var(--border)',
                    background: promptNoteCount === n ? 'var(--accent, #6366f1)' : 'var(--bg-card)',
                    color: promptNoteCount === n ? '#fff' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Generated Prompt */}
            {promptCourseId && promptTopicIds.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Generated Prompt
                </label>
                <pre style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: 12, fontSize: 11,
                  color: 'var(--text-secondary)', lineHeight: 1.5,
                  maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontFamily: 'ui-monospace, "SF Mono", Monaco, "Cascadia Code", monospace',
                }}>
                  {generateImportPrompt()}
                </pre>
              </div>
            )}

            {/* Status message */}
            {bulkAiStatus && (
              <div style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginBottom: 12,
                background: bulkAiStatus.startsWith('✓') ? '#22c55e15' : 'var(--accent, #6366f1)10',
                border: `1px solid ${bulkAiStatus.startsWith('✓') ? '#22c55e40' : 'var(--accent, #6366f1)30'}`,
                color: bulkAiStatus.startsWith('✓') ? '#22c55e' : 'var(--accent, #6366f1)',
                fontSize: 12, fontWeight: 600, textAlign: 'center',
              }}>
                {bulkAiLoading && <span style={{ marginRight: 6 }}>⏳</span>}
                {bulkAiStatus}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button onClick={() => setShowPromptGen(false)} style={{
                padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', color: 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>Cancel</button>
              <button onClick={handleImport} style={{
                padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <Upload size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Import File
              </button>
              <button
                onClick={copyPrompt}
                disabled={!promptCourseId || promptTopicIds.length === 0}
                style={{
                  padding: '10px 16px', borderRadius: 'var(--radius-sm)',
                  background: promptCopied ? '#22c55e' : 'var(--bg-card)',
                  color: promptCopied ? '#22c55e' : 'var(--text-primary)',
                  border: promptCopied ? '1px solid #22c55e' : '1px solid var(--border)',
                  fontSize: 12, fontWeight: 700, cursor: (!promptCourseId || promptTopicIds.length === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: (!promptCourseId || promptTopicIds.length === 0) ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {promptCopied ? (
                  <><ClipboardCheck size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Copied!</>
                ) : (
                  <><Copy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Copy Prompt</>
                )}
              </button>
              <button
                onClick={aiBulkGenerate}
                disabled={!promptCourseId || promptTopicIds.length === 0 || bulkAiLoading}
                style={{
                  padding: '10px 20px', border: 'none', borderRadius: 'var(--radius-sm)',
                  background: bulkAiLoading ? 'var(--accent, #6366f1)' : 'var(--accent, #6366f1)',
                  color: '#fff',
                  fontSize: 12, fontWeight: 700,
                  cursor: (!promptCourseId || promptTopicIds.length === 0 || bulkAiLoading) ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  opacity: (!promptCourseId || promptTopicIds.length === 0 || bulkAiLoading) ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                {bulkAiLoading ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   5. MIND PALACE
   ================================================================ */
interface PalaceRoom {
  id: string
  name: string
  description: string
  items: PalaceItem[]
}

interface PalaceItem {
  id: string
  term: string
  association: string
  source: string // course name
}

function MindPalaceMode() {
  const { courses } = useStore()
  const allCards = useMemo(() => getAllFlashcards(courses), [courses])

  const [rooms, setRooms] = useState<PalaceRoom[]>(() => lsGet('palace-rooms', []))
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomDesc, setNewRoomDesc] = useState('')
  const [walkMode, setWalkMode] = useState(false)
  const [walkIdx, setWalkIdx] = useState(0)
  const [walkRevealed, setWalkRevealed] = useState(false)
  const [walkScore, setWalkScore] = useState(0)
  const [walkTotal, setWalkTotal] = useState(0)
  const [showAddItem, setShowAddItem] = useState(false)
  const [addCourse, setAddCourse] = useState('')
  const [addTopic, setAddTopic] = useState('')
  const addCourseTopics = useMemo(() => buildCourseTopicList(courses, addCourse), [courses, addCourse])

  function saveRooms(r: PalaceRoom[]) {
    setRooms(r)
    lsSet('palace-rooms', r)
  }

  function addRoom() {
    if (!newRoomName.trim()) return
    const room: PalaceRoom = {
      id: Date.now().toString(), name: newRoomName.trim(),
      description: newRoomDesc.trim(), items: [],
    }
    saveRooms([...rooms, room])
    setNewRoomName('')
    setNewRoomDesc('')
    setShowAddRoom(false)
    setActiveRoomId(room.id)
  }

  function deleteRoom(id: string) {
    saveRooms(rooms.filter(r => r.id !== id))
    if (activeRoomId === id) setActiveRoomId(null)
  }

  function addItemToRoom(roomId: string, term: string, association: string, source: string) {
    const updated = rooms.map(r => {
      if (r.id !== roomId) return r
      return { ...r, items: [...r.items, { id: Date.now().toString(), term, association, source }] }
    })
    saveRooms(updated)
  }

  function removeItem(roomId: string, itemId: string) {
    const updated = rooms.map(r => {
      if (r.id !== roomId) return r
      return { ...r, items: r.items.filter(i => i.id !== itemId) }
    })
    saveRooms(updated)
  }

  function addRandomItems(roomId: string, count: number) {
    let pool = [...allCards]
    if (addCourse) pool = pool.filter(c => c.courseId === addCourse)
    if (addTopic) {
      const topicItem = addCourseTopics.find(t => t.id === addTopic)
      if (topicItem) pool = pool.filter(c => c.topic === topicItem.name)
    }
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, count)
    const updated = rooms.map(r => {
      if (r.id !== roomId) return r
      const newItems = shuffled.map(c => ({
        id: Date.now().toString() + Math.random(),
        term: c.front, association: c.back, source: c.course,
      }))
      return { ...r, items: [...r.items, ...newItems] }
    })
    saveRooms(updated)
  }

  const activeRoom = rooms.find(r => r.id === activeRoomId)

  function startWalk() {
    if (!activeRoom || activeRoom.items.length === 0) return
    setWalkMode(true)
    setWalkIdx(0)
    setWalkRevealed(false)
    setWalkScore(0)
    setWalkTotal(0)
  }

  function walkNext(remembered: boolean) {
    setWalkTotal(t => t + 1)
    if (remembered) setWalkScore(s => s + 1)
    if (activeRoom && walkIdx + 1 < activeRoom.items.length) {
      setWalkIdx(walkIdx + 1)
      setWalkRevealed(false)
    } else {
      setWalkMode(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  // Walk-through mode
  if (walkMode && activeRoom) {
    const item = activeRoom.items[walkIdx]
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Room: {activeRoom.name} &bull; Stop {walkIdx + 1} / {activeRoom.items.length}
          </span>
          <button onClick={() => setWalkMode(false)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          }}>
            Exit
          </button>
        </div>

        {/* Path visualization */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, overflowX: 'auto', padding: '4px 0' }}>
          {activeRoom.items.map((_, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700,
                background: i < walkIdx ? 'var(--green)' : i === walkIdx ? 'var(--text-primary)' : 'var(--bg-card)',
                color: i < walkIdx ? 'white' : i === walkIdx ? 'var(--bg-primary)' : 'var(--text-dim)',
                border: '1px solid var(--border)',
              }}>
                {i + 1}
              </div>
              {i < activeRoom.items.length - 1 && (
                <div style={{ width: 16, height: 2, background: i < walkIdx ? 'var(--green)' : 'var(--border)' }} />
              )}
            </div>
          ))}
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 32, marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700, marginBottom: 8 }}>
            {item.source}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 12 }}>
            {item.term}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            What is associated with this location?
          </div>

          {walkRevealed && (
            <div style={{
              marginTop: 16, padding: 16, background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--green)',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{item.association}</div>
            </div>
          )}
        </div>

        {!walkRevealed ? (
          <button onClick={() => setWalkRevealed(true)} style={{
            width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Eye size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Reveal
          </button>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button onClick={() => walkNext(false)} style={{
              padding: '12px', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)',
              background: 'var(--red-dim)', color: 'var(--red)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <X size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Forgot
            </button>
            <button onClick={() => walkNext(true)} style={{
              padding: '12px', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)',
              background: 'var(--green-dim)', color: 'var(--green)',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Check size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Remembered
            </button>
          </div>
        )}

        {/* Walk results when done */}
        {!walkMode && walkTotal > 0 && (
          <div className="card" style={{ textAlign: 'center', padding: 20, marginTop: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Walk Complete!</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)' }}>
              {walkScore} / {walkTotal}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>items recalled</div>
          </div>
        )}
      </div>
    )
  }

  // Walk results shown after exiting
  if (!walkMode && walkTotal > 0 && !activeRoomId) {
    // reset when they go back
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          <MapPin size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {activeRoom ? activeRoom.name : 'Mind Palace'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeRoom && (
            <button onClick={() => setActiveRoomId(null)} style={{
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
            }}>
              <ChevronLeft size={14} style={{ verticalAlign: 'middle' }} /> Rooms
            </button>
          )}
          {!activeRoom && (
            <button onClick={() => setShowAddRoom(!showAddRoom)} style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Plus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> New Room
            </button>
          )}
        </div>
      </div>

      {/* Add room form */}
      {showAddRoom && (
        <div className="card" style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="text" placeholder="Room name (e.g., Kitchen, Library...)"
            value={newRoomName} onChange={e => setNewRoomName(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="Description (optional)"
            value={newRoomDesc} onChange={e => setNewRoomDesc(e.target.value)} style={inputStyle} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addRoom} style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Create Room</button>
            <button onClick={() => setShowAddRoom(false)} style={{
              padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Room list */}
      {!activeRoom && (
        <div>
          {rooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <MapPin size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No rooms yet</p>
              <p style={{ fontSize: 12 }}>Create rooms and associate items to build your memory palace.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {rooms.map((room, i) => (
                <div key={room.id} className="card" style={{
                  padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
                }} onClick={() => setActiveRoomId(room.id)}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{room.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {room.items.length} item{room.items.length !== 1 ? 's' : ''}
                      {room.description && ` - ${room.description}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={e => { e.stopPropagation(); deleteRoom(room.id) }} style={{
                      background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4,
                    }}>
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} style={{ color: 'var(--text-dim)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Path visualization */}
          {rooms.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 20, padding: 16 }}>
              {rooms.map((room, i) => (
                <div key={room.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)',
                  }}>
                    {i + 1}
                  </div>
                  {i < rooms.length - 1 && (
                    <ArrowRight size={14} style={{ color: 'var(--text-dim)', margin: '0 2px' }} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active room detail */}
      {activeRoom && (
        <div>
          {activeRoom.description && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              {activeRoom.description}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <button onClick={startWalk} disabled={activeRoom.items.length === 0} style={{
              padding: '10px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: activeRoom.items.length > 0 ? 'var(--text-primary)' : 'var(--bg-card)',
              color: activeRoom.items.length > 0 ? 'var(--bg-primary)' : 'var(--text-dim)',
              fontSize: 13, fontWeight: 700, cursor: activeRoom.items.length > 0 ? 'pointer' : 'default',
              fontFamily: 'inherit',
            }}>
              <Play size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Walk Through
            </button>
            <button onClick={() => addRandomItems(activeRoom.id, 5)} disabled={allCards.length === 0} style={{
              padding: '10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Shuffle size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add 5 Random
            </button>
          </div>

          {/* Course/Topic filter for random items */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
            <select value={addCourse} onChange={e => { setAddCourse(e.target.value); setAddTopic('') }} style={inputStyle}>
              <option value="">All courses</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
            </select>
            {addCourseTopics.length > 0 ? (
              <select value={addTopic} onChange={e => setAddTopic(e.target.value)} style={inputStyle}>
                <option value="">All topics</option>
                {addCourseTopics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            ) : (
              <div />
            )}
          </div>

          {/* Add custom item */}
          <AddItemForm
            show={showAddItem}
            setShow={setShowAddItem}
            onAdd={(term, assoc, src) => addItemToRoom(activeRoom.id, term, assoc, src)}
            courses={courses}
          />

          {/* Items list */}
          {activeRoom.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 12 }}>
              No items in this room yet. Add items from your flashcards or create custom ones.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {activeRoom.items.map((item, i) => (
                <div key={item.id} style={{
                  display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px',
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'var(--bg-primary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{item.term}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.association}</div>
                  </div>
                  <button onClick={() => removeItem(activeRoom.id, item.id)} style={{
                    background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 4,
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function AddItemForm({ show, setShow, onAdd, courses }: {
  show: boolean; setShow: (v: boolean) => void
  onAdd: (term: string, assoc: string, src: string) => void
  courses: Course[]
}) {
  const [term, setTerm] = useState('')
  const [assoc, setAssoc] = useState('')
  const [src, setSrc] = useState('')

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {!show ? (
        <button onClick={() => setShow(true)} style={{
          width: '100%', padding: '10px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'transparent', color: 'var(--text-muted)',
          fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Add Custom Item
        </button>
      ) : (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input type="text" placeholder="Term / item to remember" value={term} onChange={e => setTerm(e.target.value)} style={inputStyle} />
          <input type="text" placeholder="Association / answer" value={assoc} onChange={e => setAssoc(e.target.value)} style={inputStyle} />
          <select value={src} onChange={e => setSrc(e.target.value)} style={inputStyle}>
            <option value="">Source (optional)...</option>
            {courses.map(c => <option key={c.id} value={c.shortName || c.name}>{c.shortName || c.name}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { if (term && assoc) { onAdd(term, assoc, src); setTerm(''); setAssoc(''); setSrc('') } }} style={{
              padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: 'var(--text-primary)', color: 'var(--bg-primary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}>Add</button>
            <button onClick={() => setShow(false)} style={{
              padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', color: 'var(--text-secondary)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================================================================
   6. STUDY STREAKS & GOALS
   ================================================================ */
interface DailyLog { date: string; xp: number; minutes: number; quizzes: number; flashcards: number; sessions: number }

const ACHIEVEMENTS = [
  { id: 'first_quiz', name: 'First Quiz', desc: 'Complete your first quiz', icon: '1', xpReq: 0, quizReq: 1 },
  { id: 'ten_quizzes', name: 'Quiz Master', desc: 'Complete 10 quizzes', icon: '10', xpReq: 0, quizReq: 10 },
  { id: 'fifty_quizzes', name: 'Quiz Legend', desc: 'Complete 50 quizzes', icon: '50', xpReq: 0, quizReq: 50 },
  { id: 'xp_100', name: 'Rookie', desc: 'Earn 100 XP', icon: 'XP', xpReq: 100, quizReq: 0 },
  { id: 'xp_500', name: 'Scholar', desc: 'Earn 500 XP', icon: 'XP', xpReq: 500, quizReq: 0 },
  { id: 'xp_1000', name: 'Expert', desc: 'Earn 1000 XP', icon: 'XP', xpReq: 1000, quizReq: 0 },
  { id: 'xp_5000', name: 'Genius', desc: 'Earn 5000 XP', icon: 'XP', xpReq: 5000, quizReq: 0 },
  { id: 'streak_3', name: '3-Day Streak', desc: 'Study 3 days in a row', icon: '3', xpReq: 0, quizReq: 0, streakReq: 3 },
  { id: 'streak_7', name: 'Week Warrior', desc: 'Study 7 days in a row', icon: '7', xpReq: 0, quizReq: 0, streakReq: 7 },
  { id: 'streak_30', name: 'Monthly Master', desc: 'Study 30 days in a row', icon: '30', xpReq: 0, quizReq: 0, streakReq: 30 },
  { id: 'perfect_score', name: 'Perfect', desc: 'Get a perfect quiz score', icon: '*', xpReq: 0, quizReq: 0 },
  { id: 'night_owl', name: 'Night Owl', desc: 'Study after midnight', icon: 'N', xpReq: 0, quizReq: 0 },
] as const

function StudyStreaksMode() {
  const { gamification, quizHistory, courses } = useStore()

  const [goals, setGoals] = useState(() => lsGet('streak-goals', {
    dailyXp: 100, dailyMinutes: 45, dailyQuizzes: 3, weeklyQuizzes: 15,
  }))
  const [editGoals, setEditGoals] = useState(false)

  function saveGoals(g: typeof goals) {
    setGoals(g)
    lsSet('streak-goals', g)
  }

  // Build streak calendar (last 12 weeks = 84 days)
  const streakData = useMemo(() => {
    const days: { date: string; count: number }[] = []
    const dateMap = new Map<string, number>()
    quizHistory.forEach(q => {
      const d = new Date(q.date).toISOString().split('T')[0]
      dateMap.set(d, (dateMap.get(d) || 0) + 1)
    })
    const today = new Date()
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      days.push({ date: key, count: dateMap.get(key) || 0 })
    }
    return days
  }, [quizHistory])

  // Current week
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  // Level info
  const level = gamification.level || 1
  const xp = gamification.xp || 0
  const xpForLevel = level * 100
  const xpProgress = xp % 100
  const xpPct = Math.min(100, Math.round((xpProgress / xpForLevel) * 100))

  // Achievements
  const unlockedAchievements = useMemo(() => {
    const unlocked = new Set<string>()
    if (gamification.totalQuizzes >= 1) unlocked.add('first_quiz')
    if (gamification.totalQuizzes >= 10) unlocked.add('ten_quizzes')
    if (gamification.totalQuizzes >= 50) unlocked.add('fifty_quizzes')
    if (xp >= 100) unlocked.add('xp_100')
    if (xp >= 500) unlocked.add('xp_500')
    if (xp >= 1000) unlocked.add('xp_1000')
    if (xp >= 5000) unlocked.add('xp_5000')
    if (gamification.streak >= 3) unlocked.add('streak_3')
    if (gamification.streak >= 7) unlocked.add('streak_7')
    if (gamification.streak >= 30) unlocked.add('streak_30')
    if (gamification.perfectScores > 0) unlocked.add('perfect_score')
    return unlocked
  }, [gamification, xp])

  // XP breakdown
  const xpBreakdown = useMemo(() => {
    const quizXp = gamification.totalCorrect * 5
    const perfectXp = gamification.perfectScores * 20
    const streakXp = gamification.streak * 10
    const other = Math.max(0, xp - quizXp - perfectXp - streakXp)
    return [
      { label: 'Quiz Answers', xp: quizXp, color: 'var(--accent)' },
      { label: 'Perfect Scores', xp: perfectXp, color: 'var(--green)' },
      { label: 'Streak Bonus', xp: streakXp, color: 'var(--orange)' },
      { label: 'Other', xp: other, color: 'var(--blue)' },
    ]
  }, [gamification, xp])

  const totalBreakdownXp = xpBreakdown.reduce((a, b) => a + b.xp, 0) || 1

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div>
      {/* Level + XP Header */}
      <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
          background: 'var(--bg-primary)', border: '2px solid var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{level}</div>
          <div style={{ fontSize: 8, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>Level</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 800 }}>{xp} XP</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <Flame size={12} style={{ verticalAlign: 'middle', color: 'var(--orange)' }} /> {gamification.streak} day streak
            </span>
          </div>
          <div className="progress-bar" style={{ marginTop: 8, height: 8 }}>
            <div className="progress-fill" style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-light))' }} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {xpProgress} / {xpForLevel} XP to level {level + 1}
          </div>
        </div>
      </div>

      {/* Streak Calendar */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Study Streak
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Last 12 weeks</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          {streakData.map((d, i) => {
            const intensity = d.count === 0 ? 0 : Math.min(1, d.count / 3)
            return (
              <div key={i} title={`${d.date}: ${d.count} activities`} style={{
                width: '100%', aspectRatio: '1', borderRadius: 2,
                background: d.count === 0
                  ? 'var(--bg-primary)'
                  : `rgba(204, 204, 204, ${0.15 + intensity * 0.85})`,
                border: '1px solid var(--border)',
              }} />
            )
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Less</span>
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: 2,
              background: intensity === 0 ? 'var(--bg-primary)' : `rgba(204, 204, 204, ${0.15 + intensity * 0.85})`,
              border: '1px solid var(--border)',
            }} />
          ))}
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>More</span>
        </div>
      </div>

      {/* Daily Goals */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            <Target size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Daily Goals
          </div>
          <button onClick={() => setEditGoals(!editGoals)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 11,
          }}>
            {editGoals ? 'Done' : 'Edit'}
          </button>
        </div>

        {editGoals ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Daily XP Target</div>
              <input type="number" value={goals.dailyXp} onChange={e => saveGoals({ ...goals, dailyXp: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Daily Minutes</div>
              <input type="number" value={goals.dailyMinutes} onChange={e => saveGoals({ ...goals, dailyMinutes: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Daily Quizzes</div>
              <input type="number" value={goals.dailyQuizzes} onChange={e => saveGoals({ ...goals, dailyQuizzes: +e.target.value })} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Weekly Quizzes</div>
              <input type="number" value={goals.weeklyQuizzes} onChange={e => saveGoals({ ...goals, weeklyQuizzes: +e.target.value })} style={inputStyle} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'XP Today', current: gamification.dailyGoal.todayXp, target: goals.dailyXp, color: 'var(--accent)' },
              { label: 'Minutes', current: gamification.dailyGoal.todayMinutes, target: goals.dailyMinutes, color: 'var(--blue)' },
              { label: 'Questions', current: gamification.dailyGoal.todayQuestions, target: goals.dailyQuizzes * 10, color: 'var(--green)' },
              { label: 'Quizzes', current: gamification.totalQuizzes, target: goals.weeklyQuizzes, color: 'var(--orange)' },
            ].map(g => {
              const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100))
              return (
                <div key={g.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: pct >= 100 ? 'var(--green)' : 'var(--text-muted)' }}>
                      {pct >= 100 ? 'Done!' : `${g.current}/${g.target}`}
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 6 }}>
                    <div className="progress-fill" style={{ width: `${pct}%`, background: g.color }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          <Award size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Achievements ({unlockedAchievements.size} / {ACHIEVEMENTS.length})
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {ACHIEVEMENTS.map(ach => {
            const unlocked = unlockedAchievements.has(ach.id)
            return (
              <div key={ach.id} style={{
                padding: 10, textAlign: 'center', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                background: unlocked ? 'var(--accent-glow)' : 'var(--bg-primary)',
                opacity: unlocked ? 1 : 0.35,
              }} title={ach.desc}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', margin: '0 auto 6px',
                  background: unlocked ? 'var(--text-primary)' : 'var(--bg-card)',
                  color: unlocked ? 'var(--bg-primary)' : 'var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 900,
                }}>
                  {unlocked ? ach.icon : <Lock size={12} />}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: unlocked ? 'var(--text-primary)' : 'var(--text-dim)' }}>
                  {ach.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>{ach.desc}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* XP Breakdown */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          <Zap size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          XP Breakdown
        </div>
        {xpBreakdown.map(b => (
          <div key={b.label} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{b.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: b.color }}>{b.xp} XP</span>
            </div>
            <div className="progress-bar" style={{ height: 6 }}>
              <div className="progress-fill" style={{ width: `${Math.round((b.xp / totalBreakdownXp) * 100)}%`, background: b.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Leaderboard placeholder */}
      <div className="card" style={{ textAlign: 'center', padding: 24 }}>
        <Trophy size={32} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Leaderboard
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Coming soon - compete with friends!
        </div>
        <div style={{
          display: 'inline-block', marginTop: 12, padding: '6px 16px', borderRadius: 20,
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-dim)', fontWeight: 600,
        }}>
          <Lock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Feature Locked
        </div>
      </div>
    </div>
  )
}
