/**
 * SpeedPreviewPage — Rapid card familiarity builder.
 *
 * Auto-flips through flashcards at configurable speed.
 * Simplified rating: HARD (re-queue to end) or EASY (done for session).
 * Does NOT affect FSRS scheduling — purely a preview/familiarity pass.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Pause, Play, Settings2, X } from 'lucide-react'
import { useStore } from '../store'
import { matchesShortcut, formatKey, getShortcutKey } from '../utils/shortcuts'
import { registerActions } from '../utils/actionRegistry'
import type { FlashcardItem } from '../types'

// ── localStorage keys ──
const LS_FRONT = 'nousai-sp-front-speed'
const LS_BACK = 'nousai-sp-back-speed'
const LS_STATS = 'nousai-sp-last-session'

interface SessionStats {
  total: number
  easy: number
  hard: number
  elapsedMs: number
  date: string
}

function loadSpeed(key: string, fallback: number): number {
  try { const v = localStorage.getItem(key); return v ? Number(v) : fallback } catch { return fallback }
}

// ── Main component ──
export default function SpeedPreviewPage() {
  const navigate = useNavigate()
  const { courses } = useStore()

  // ── Deck selection ──
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)
  const [sessionActive, setSessionActive] = useState(false)

  // All courses with flashcards
  const coursesWithCards = useMemo(
    () => courses.filter(c => (c.flashcards.length) > 0),
    [courses]
  )

  const selectedCourse = useMemo(
    () => coursesWithCards.find(c => c.id === selectedCourseId) ?? null,
    [coursesWithCards, selectedCourseId]
  )

  // Topics for selected course
  const topics = useMemo(() => {
    if (!selectedCourse) return []
    const topicSet = new Set<string>()
    selectedCourse.flashcards.forEach(f => topicSet.add(f.topic || 'Uncategorized'))
    return Array.from(topicSet).sort()
  }, [selectedCourse])

  // Cards for session
  const sourceCards = useMemo(() => {
    if (!selectedCourse) return []
    if (selectedTopic && selectedTopic !== '_all') {
      return selectedCourse.flashcards.filter(f => (f.topic || 'Uncategorized') === selectedTopic)
    }
    return selectedCourse.flashcards
  }, [selectedCourse, selectedTopic])

  function startSession() {
    if (sourceCards.length === 0) return
    setSessionActive(true)
  }

  if (!sessionActive) {
    return <DeckSelector
      courses={coursesWithCards}
      selectedCourseId={selectedCourseId}
      setSelectedCourseId={setSelectedCourseId}
      selectedTopic={selectedTopic}
      setSelectedTopic={setSelectedTopic}
      topics={topics}
      cardCount={sourceCards.length}
      onStart={startSession}
      onBack={() => navigate(-1)}
    />
  }

  return <SpeedSession
    cards={sourceCards}
    onExit={() => setSessionActive(false)}
    onBack={() => navigate(-1)}
  />
}

// ── Deck Selector Screen ──
function DeckSelector({ courses, selectedCourseId, setSelectedCourseId, selectedTopic, setSelectedTopic, topics, cardCount, onStart, onBack }: {
  courses: { id: string; name: string; flashcards: FlashcardItem[] }[]
  selectedCourseId: string | null
  setSelectedCourseId: (id: string | null) => void
  selectedTopic: string | null
  setSelectedTopic: (t: string | null) => void
  topics: string[]
  cardCount: number
  onStart: () => void
  onBack: () => void
}) {
  // Load last session stats
  const [lastStats, setLastStats] = useState<SessionStats | null>(null)
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_STATS)
      if (s) setLastStats(JSON.parse(s))
    } catch { /* ignore */ }
  }, [])

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}><ArrowLeft size={20} /></button>
        <Zap size={22} color="var(--accent)" />
        <h2 style={{ margin: 0, fontSize: 20, fontFamily: 'Sora, sans-serif' }}>Speed Preview</h2>
      </div>

      <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>Flash through cards to build familiarity before deep study. No FSRS impact.</p>

      {/* Last session stats */}
      {lastStats && (
        <div style={{ padding: '10px 14px', background: '#1a1a1a', borderRadius: 10, border: '1px solid #333', marginBottom: 16, fontSize: 12, color: '#aaa' }}>
          <span style={{ fontWeight: 600, color: '#ddd' }}>Last session:</span>{' '}
          {lastStats.total} cards in {Math.round(lastStats.elapsedMs / 1000)}s
          {' — '}
          <span style={{ color: 'var(--green, #22C55E)' }}>{lastStats.easy} easy</span>
          {', '}
          <span style={{ color: 'var(--red, #EF4444)' }}>{lastStats.hard} hard</span>
        </div>
      )}

      {/* Course selector */}
      <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, display: 'block' }}>Select Course</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {courses.map(c => (
          <button key={c.id} onClick={() => { setSelectedCourseId(c.id); setSelectedTopic(null) }} style={{
            padding: '10px 14px', background: selectedCourseId === c.id ? 'var(--accent-glow, #F5A62322)' : '#1a1a1a',
            border: `2px solid ${selectedCourseId === c.id ? 'var(--accent, #F5A623)' : '#333'}`,
            borderRadius: 10, cursor: 'pointer', textAlign: 'left', color: '#ddd', fontSize: 13, fontWeight: 500,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>{c.name}</span>
            <span style={{ fontSize: 11, color: '#888' }}>{c.flashcards.length} cards</span>
          </button>
        ))}
        {courses.length === 0 && <p style={{ color: '#666', fontSize: 13 }}>No courses with flashcards found.</p>}
      </div>

      {/* Topic selector */}
      {selectedCourseId && topics.length > 1 && (
        <>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6, display: 'block' }}>Topic (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            <button onClick={() => setSelectedTopic('_all')} style={{
              padding: '6px 12px', fontSize: 11, borderRadius: 20, cursor: 'pointer', fontWeight: 600,
              background: !selectedTopic || selectedTopic === '_all' ? 'var(--accent-glow, #F5A62322)' : '#1a1a1a',
              border: `1px solid ${!selectedTopic || selectedTopic === '_all' ? 'var(--accent)' : '#444'}`,
              color: !selectedTopic || selectedTopic === '_all' ? 'var(--accent)' : '#aaa',
            }}>All Topics</button>
            {topics.map(t => (
              <button key={t} onClick={() => setSelectedTopic(t)} style={{
                padding: '6px 12px', fontSize: 11, borderRadius: 20, cursor: 'pointer', fontWeight: 500,
                background: selectedTopic === t ? 'var(--accent-glow, #F5A62322)' : '#1a1a1a',
                border: `1px solid ${selectedTopic === t ? 'var(--accent)' : '#444'}`,
                color: selectedTopic === t ? 'var(--accent)' : '#aaa',
              }}>{t}</button>
            ))}
          </div>
        </>
      )}

      {/* Start button */}
      <button onClick={onStart} disabled={cardCount === 0} style={{
        width: '100%', padding: '14px 0', fontSize: 15, fontWeight: 700, fontFamily: 'Sora, sans-serif',
        background: cardCount > 0 ? 'var(--accent, #F5A623)' : '#333', color: cardCount > 0 ? '#000' : '#666',
        border: 'none', borderRadius: 12, cursor: cardCount > 0 ? 'pointer' : 'not-allowed',
        transition: 'transform 0.1s', letterSpacing: 0.5,
      }}>
        <Zap size={16} style={{ verticalAlign: -2, marginRight: 6 }} />
        Start Preview ({cardCount} cards)
      </button>
    </div>
  )
}

// ── Speed Session (the core auto-flip loop) ──
function SpeedSession({ cards: initialCards, onExit, onBack }: {
  cards: FlashcardItem[]
  onExit: () => void
  onBack: () => void
}) {
  // ── Speed settings ──
  const [frontSpeed, setFrontSpeed] = useState(() => loadSpeed(LS_FRONT, 1.5))
  const [backSpeed, setBackSpeed] = useState(() => loadSpeed(LS_BACK, 1.0))
  const [showSettings, setShowSettings] = useState(false)

  // Persist speed changes
  useEffect(() => { try { localStorage.setItem(LS_FRONT, String(frontSpeed)) } catch {} }, [frontSpeed])
  useEffect(() => { try { localStorage.setItem(LS_BACK, String(backSpeed)) } catch {} }, [backSpeed])

  // ── Session state ──
  const [queue, setQueue] = useState<FlashcardItem[]>(() => [...initialCards])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isWaitingRating, setIsWaitingRating] = useState(false)
  const [hardSet, setHardSet] = useState<Set<number>>(() => new Set())
  const [easyCount, setEasyCount] = useState(0)
  const [hardRequeueCount, setHardRequeueCount] = useState(0)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [zen, setZen] = useState(false)
  const startTimeRef = useRef(Date.now())

  // Timer countdown display
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const targetTimeRef = useRef(0)

  const card = queue[currentIdx] ?? null

  // ── Auto-advance timer ──
  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  const startTimer = useCallback((duration: number, onComplete: () => void) => {
    clearTimers()
    const endTime = Date.now() + duration * 1000
    targetTimeRef.current = endTime

    // Countdown animation
    function tick() {
      const remaining = Math.max(0, (targetTimeRef.current - Date.now()) / 1000)
      setCountdown(remaining)
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    timerRef.current = window.setTimeout(onComplete, duration * 1000)
  }, [clearTimers])

  // State machine: show front → auto-flip → show back → wait for rating
  useEffect(() => {
    if (!card || isPaused || isWaitingRating || sessionComplete) return
    clearTimers()

    if (!flipped) {
      // Showing front — auto-flip after frontSpeed
      startTimer(frontSpeed, () => setFlipped(true))
    } else {
      // Showing back — wait briefly then show rating buttons
      startTimer(backSpeed, () => setIsWaitingRating(true))
    }

    return clearTimers
  }, [card, flipped, isPaused, isWaitingRating, sessionComplete, frontSpeed, backSpeed, startTimer, clearTimers])

  // ── Rating actions ──
  const rateEasy = useCallback(() => {
    if (!isWaitingRating && flipped) setIsWaitingRating(true) // Force show rating
    setEasyCount(c => c + 1)
    // Remove card from queue
    setQueue(q => {
      const next = [...q]
      next.splice(currentIdx, 1)
      return next
    })
    setFlipped(false)
    setIsWaitingRating(false)
    // If queue is now empty or currentIdx past end, handle
    setCurrentIdx(i => {
      const newLen = queue.length - 1
      if (newLen <= 0) { setSessionComplete(true); return 0 }
      return i >= newLen ? 0 : i
    })
  }, [currentIdx, queue.length, isWaitingRating, flipped])

  const rateHard = useCallback(() => {
    if (!isWaitingRating && flipped) setIsWaitingRating(true)
    setHardRequeueCount(c => c + 1)
    // Move card to end of queue
    setQueue(q => {
      const next = [...q]
      const [removed] = next.splice(currentIdx, 1)
      next.push(removed)
      return next
    })
    setHardSet(s => { const n = new Set(s); n.add(queue.length - 1); return n })
    setFlipped(false)
    setIsWaitingRating(false)
    // Stay at same index (next card slides in)
    setCurrentIdx(i => {
      const newLen = queue.length // length didn't change, just reordered
      return i >= newLen - 1 ? 0 : i
    })
  }, [currentIdx, queue.length, isWaitingRating, flipped])

  const flipCard = useCallback(() => {
    if (isWaitingRating) return
    setFlipped(f => !f)
  }, [isWaitingRating])

  const togglePause = useCallback(() => {
    setIsPaused(p => !p)
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (matchesShortcut(e, 'sp_flip') || matchesShortcut(e, 'sp_flip2')) { e.preventDefault(); flipCard() }
      else if (matchesShortcut(e, 'sp_easy') || matchesShortcut(e, 'fc_conf4_alt')) { e.preventDefault(); if (flipped) rateEasy() }
      else if (matchesShortcut(e, 'sp_hard') || matchesShortcut(e, 'fc_conf2_alt')) { e.preventDefault(); if (flipped) rateHard() }
      else if (matchesShortcut(e, 'sp_again')) { e.preventDefault(); if (flipped) rateHard() }
      else if (matchesShortcut(e, 'sp_good')) { e.preventDefault(); if (flipped) rateEasy() }
      else if (matchesShortcut(e, 'sp_zen')) { e.preventDefault(); setZen(z => !z) }
      else if (e.key === 'Escape') { if (zen) setZen(false); else onExit() }
      else if (e.key === 'p' || e.key === 'P') { e.preventDefault(); togglePause() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [flipCard, rateEasy, rateHard, togglePause, flipped, zen, onExit])

  // ── Stream Deck actions ──
  useEffect(() => {
    return registerActions([
      ['fc_flip', flipCard],
      ['fc_conf1', rateHard],  // AGAIN → treat as HARD in speed mode
      ['fc_conf2', rateHard],
      ['fc_conf3', rateEasy],  // GOOD → treat as EASY in speed mode
      ['fc_conf4', rateEasy],
      ['fc_zen', () => setZen(z => !z)],
      ['fc_rsvp', togglePause], // RSVP button toggles pause
      ['nav_speed', () => {}],  // Already on speed preview
    ])
  }, [flipCard, rateHard, rateEasy, togglePause])

  // ── Session complete: save stats ──
  useEffect(() => {
    if (!sessionComplete) return
    const stats: SessionStats = {
      total: initialCards.length,
      easy: easyCount,
      hard: hardRequeueCount,
      elapsedMs: Date.now() - startTimeRef.current,
      date: new Date().toISOString(),
    }
    try { localStorage.setItem(LS_STATS, JSON.stringify(stats)) } catch {}
  }, [sessionComplete, initialCards.length, easyCount, hardRequeueCount])

  // ── Session summary ──
  if (sessionComplete) {
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000)
    const mins = Math.floor(elapsed / 60)
    const secs = elapsed % 60
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '40px 16px', textAlign: 'center' }}>
        <Zap size={40} color="var(--accent)" style={{ marginBottom: 12 }} />
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, marginBottom: 4 }}>Session Complete</h2>
        <p style={{ color: '#888', fontSize: 13, marginBottom: 24 }}>{mins > 0 ? `${mins}m ${secs}s` : `${secs}s`} elapsed</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          <StatCard label="Total" value={initialCards.length} color="#ddd" />
          <StatCard label="Easy" value={easyCount} color="var(--green, #22C55E)" />
          <StatCard label="Hard" value={hardRequeueCount} color="var(--red, #EF4444)" />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={onExit} style={btnStyle('#333', '#ddd')}>
            <ArrowLeft size={14} /> Back to Selector
          </button>
          <button onClick={() => { setQueue([...initialCards]); setCurrentIdx(0); setFlipped(false); setEasyCount(0); setHardRequeueCount(0); setHardSet(new Set()); setSessionComplete(false); setIsWaitingRating(false); startTimeRef.current = Date.now() }} style={btnStyle('var(--accent, #F5A623)', '#000')}>
            <RotateCcw size={14} /> Again
          </button>
        </div>
      </div>
    )
  }

  if (!card) return null

  // ── Active session UI ──
  const remaining = queue.length
  const progress = ((initialCards.length - remaining) / initialCards.length) * 100
  const timerProgress = flipped
    ? Math.max(0, countdown / backSpeed) * 100
    : Math.max(0, countdown / frontSpeed) * 100

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: zen ? '12px 8px' : '16px', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      {!zen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <button onClick={onExit} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
          <Zap size={16} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{remaining} remaining</span>
          <span style={{ fontSize: 11, color: hardRequeueCount > 0 ? 'var(--red, #EF4444)' : '#666' }}>
            {hardRequeueCount > 0 ? `${hardRequeueCount} hard` : ''}
          </span>
          <button onClick={togglePause} title="Pause/Resume (P)" style={{ background: 'none', border: 'none', color: isPaused ? 'var(--accent)' : '#888', cursor: 'pointer', padding: 4 }}>
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>
          <button onClick={() => setShowSettings(s => !s)} title="Speed settings" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 4 }}>
            <Settings2 size={16} />
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div style={{ height: 3, background: '#222', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent, #F5A623)', borderRadius: 2, transition: 'width 0.3s' }} />
      </div>

      {/* Timer countdown bar */}
      <div style={{ height: 2, background: '#111', borderRadius: 1, marginBottom: 12, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${timerProgress}%`, background: isWaitingRating ? 'transparent' : (flipped ? 'var(--green, #22C55E)' : 'var(--blue, #3B82F6)'), transition: 'width 0.05s linear' }} />
      </div>

      {/* Speed settings panel */}
      {showSettings && (
        <div style={{ padding: '12px 14px', background: '#1a1a1a', border: '1px solid #333', borderRadius: 10, marginBottom: 12, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ color: '#aaa', minWidth: 70 }}>Front: {frontSpeed.toFixed(1)}s</span>
            <input type="range" min={0.5} max={5} step={0.1} value={frontSpeed} onChange={e => setFrontSpeed(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#aaa', minWidth: 70 }}>Back: {backSpeed.toFixed(1)}s</span>
            <input type="range" min={0.5} max={5} step={0.1} value={backSpeed} onChange={e => setBackSpeed(Number(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
          </div>
        </div>
      )}

      {/* Card */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 0 }}>
        <div
          onClick={flipCard}
          style={{
            background: flipped ? 'var(--bg-secondary, #1a1a1a)' : 'var(--bg-card, #141414)',
            border: `2px solid ${isWaitingRating ? 'var(--accent)' : '#333'}`,
            borderRadius: 16, padding: '28px 20px', minHeight: 200,
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
            textAlign: 'center', position: 'relative', userSelect: 'text',
          }}
        >
          {/* Card side indicator */}
          <span style={{ position: 'absolute', top: 10, left: 14, fontSize: 10, color: '#555', fontWeight: 600, letterSpacing: 1 }}>
            {flipped ? 'BACK' : 'FRONT'}
          </span>
          {card.topic && (
            <span style={{ position: 'absolute', top: 10, right: 14, fontSize: 10, color: '#444' }}>{card.topic}</span>
          )}

          <p style={{
            fontSize: (flipped ? card.back : card.front).length > 200 ? 14 : 17,
            lineHeight: 1.5, color: '#ddd', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {flipped ? card.back : card.front}
          </p>

          {isPaused && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, color: '#aaa', fontWeight: 600 }}>PAUSED — press P to resume</span>
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons (shown when timer pauses after back) */}
      {isWaitingRating && (
        <div style={{ display: 'flex', gap: 12, marginTop: 16, justifyContent: 'center' }}>
          <button onClick={rateHard} title={`Hard — re-queue (${formatKey(getShortcutKey('sp_hard'))})`} style={{
            flex: 1, maxWidth: 180, padding: '14px 0', fontSize: 15, fontWeight: 800,
            background: '#EF444428', color: '#EF4444', border: '2px solid #EF444455',
            borderRadius: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', letterSpacing: 1,
          }}>
            HARD
            <span style={{ display: 'block', fontSize: 9, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{formatKey(getShortcutKey('sp_hard'))}</span>
          </button>
          <button onClick={rateEasy} title={`Easy — done (${formatKey(getShortcutKey('sp_easy'))})`} style={{
            flex: 1, maxWidth: 180, padding: '14px 0', fontSize: 15, fontWeight: 800,
            background: '#22C55E28', color: '#22C55E', border: '2px solid #22C55E55',
            borderRadius: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', letterSpacing: 1,
          }}>
            EASY
            <span style={{ display: 'block', fontSize: 9, fontWeight: 400, marginTop: 2, opacity: 0.7 }}>{formatKey(getShortcutKey('sp_easy'))}</span>
          </button>
        </div>
      )}

      {/* Navigation hints (bottom) */}
      {!zen && !isWaitingRating && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, fontSize: 10, color: '#555' }}>
          <span>F/Space = flip</span>
          <span>P = pause</span>
          <span>Z = zen</span>
          <span>Esc = exit</span>
        </div>
      )}
    </div>
  )
}

// ── Helpers ──
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: '14px 8px', background: '#1a1a1a', borderRadius: 10, border: '1px solid #333' }}>
      <div style={{ fontSize: 28, fontWeight: 900, fontFamily: 'DM Mono, monospace', color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
    fontSize: 13, fontWeight: 600, background: bg, color, border: 'none',
    borderRadius: 10, cursor: 'pointer',
  }
}
