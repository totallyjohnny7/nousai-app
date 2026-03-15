import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, SkipForward, Coffee, Zap, Sun } from 'lucide-react'
import { useStore } from '../store'
import { requestWakeLock, releaseWakeLock, isWakeLockActive, isWakeLockSupported, getPermPref } from '../utils/permissions'
import type { Course } from '../types'

type Phase = 'idle' | 'work' | 'break' | 'longBreak'

const PHASE_LABELS: Record<Phase, string> = {
  idle: 'Ready',
  work: 'Focus',
  break: 'Short Break',
  longBreak: 'Long Break',
}

const PHASE_COLORS: Record<Phase, string> = {
  idle: 'var(--accent)',
  work: 'var(--accent)',
  break: 'var(--green)',
  longBreak: 'var(--blue)',
}

export default function Timer() {
  const { loaded, timerState, setTimerState, data } = useStore()
  const courses: Course[] = data?.pluginData?.coachData?.courses ?? []
  const [studyCourseId, setStudyCourseId] = useState('')

  const [workMin, setWorkMin] = useState(timerState.pomoWorkMin || 20)
  const [breakMin, setBreakMin] = useState(timerState.pomoBreakMin || 10)
  const [longBreakMin, setLongBreakMin] = useState(timerState.pomoLongBreakMin || 15)

  const [phase, setPhase] = useState<Phase>((timerState.pomoPhase as Phase) || 'idle')
  const [running, setRunning] = useState(false)
  const [remainMs, setRemainMs] = useState(workMin * 60 * 1000)
  const [session, setSession] = useState(timerState.pomoSession || 0)
  const [totalSessions, setTotalSessions] = useState(timerState.pomoTotalSessions || 0)

  const intervalRef = useRef<number | null>(null)
  const endTimeRef = useRef<number>(0)
  const [wakeLockOn, setWakeLockOn] = useState(false)
  const wakeLockEnabled = getPermPref('wakelock', true)

  // Wake Lock: acquire/release based on running state
  useEffect(() => {
    if (!wakeLockEnabled || !isWakeLockSupported()) return
    if (running) {
      requestWakeLock().then(r => setWakeLockOn(r.granted))
    } else {
      releaseWakeLock().then(() => setWakeLockOn(false))
    }
    return () => { releaseWakeLock().then(() => setWakeLockOn(false)) }
  }, [running, wakeLockEnabled])

  // Re-acquire wake lock on visibility change (per spec, lock is released when tab hidden)
  useEffect(() => {
    if (!wakeLockEnabled || !isWakeLockSupported()) return
    function handleVisibility() {
      if (document.visibilityState === 'visible' && running) {
        requestWakeLock().then(r => setWakeLockOn(r.granted))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [running, wakeLockEnabled])

  const totalMs = phase === 'work' ? workMin * 60000
    : phase === 'break' ? breakMin * 60000
    : phase === 'longBreak' ? longBreakMin * 60000
    : workMin * 60000

  const circumference = 2 * Math.PI * 100
  const progress = remainMs / totalMs
  const dashOffset = circumference * (1 - progress)

  // Timer tick
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
    // Notify
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('NousAI Timer', { body: phase === 'work' ? 'Time for a break!' : 'Back to work!' })
    }
    // Auto-advance
    if (phase === 'work') {
      const newSession = session + 1
      setSession(newSession)
      setTotalSessions(t => t + 1)
      if (newSession % 4 === 0) {
        setPhase('longBreak')
        setRemainMs(longBreakMin * 60000)
      } else {
        setPhase('break')
        setRemainMs(breakMin * 60000)
      }
    } else {
      setPhase('work')
      setRemainMs(workMin * 60000)
    }
  }

  const start = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
    if (phase === 'idle') { setPhase('work'); setRemainMs(workMin * 60000) }
    setRunning(true)
  }, [phase, workMin])

  const pause = useCallback(() => setRunning(false), [])

  const reset = useCallback(() => {
    setRunning(false)
    setPhase('idle')
    setRemainMs(workMin * 60000)
    setSession(0)
  }, [workMin])

  const skip = useCallback(() => {
    setRunning(false)
    handlePhaseEnd()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session, workMin, breakMin, longBreakMin])

  // Save state back
  useEffect(() => {
    setTimerState({
      ...timerState,
      pomoRunning: running,
      pomoPhase: phase,
      pomoSession: session,
      pomoTotalSessions: totalSessions,
      pomoRemainingMs: remainMs,
      pomoWorkMin: workMin,
      pomoBreakMin: breakMin,
      pomoLongBreakMin: longBreakMin,
      savedAt: Date.now(),
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, session, totalSessions])

  const mins = Math.floor(remainMs / 60000)
  const secs = Math.floor((remainMs % 60000) / 1000)
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  const selectedCourseName = courses.find(c => c.id === studyCourseId)?.name ?? ''

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading timer...</div>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">Pomodoro Timer</h1>
      <p className="page-subtitle">Session {session} &bull; {totalSessions} total completed</p>

      {/* Timer ring */}
      <div className="timer-display">
        <div className="timer-ring">
          <svg viewBox="0 0 220 220">
            <circle className="ring-bg" cx="110" cy="110" r="100" />
            <circle className="ring-fg"
              cx="110" cy="110" r="100"
              style={{ stroke: PHASE_COLORS[phase], strokeDasharray: circumference, strokeDashoffset: dashOffset }}
            />
          </svg>
          <div className="timer-time">
            <span className="time">{timeStr}</span>
            <span className="phase">{PHASE_LABELS[phase]}</span>
            {running && selectedCourseName && (
              <span style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, fontWeight: 600 }}>{selectedCourseName}</span>
            )}
            {wakeLockOn && (
              <span style={{ fontSize: 10, color: 'var(--green, #22c55e)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 4 }}>
                <Sun size={10} /> Screen on
              </span>
            )}
          </div>
        </div>

        {/* Course context dropdown */}
        {!running && courses.length > 0 && (
          <div style={{ marginBottom: 12, textAlign: 'center' }}>
            <select
              value={studyCourseId}
              onChange={e => setStudyCourseId(e.target.value)}
              style={{
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                cursor: 'pointer',
                maxWidth: 220,
                width: '100%',
              }}
            >
              <option value="">Select a course (optional)</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Controls */}
        <div className="timer-controls">
          <button className="btn btn-secondary" onClick={reset} title="Reset"><RotateCcw size={18} /></button>
          {running ? (
            <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={pause}><Pause size={20} /></button>
          ) : (
            <button className="btn btn-primary" style={{ padding: '12px 32px' }} onClick={start}><Play size={20} /></button>
          )}
          <button className="btn btn-secondary" onClick={skip} title="Skip"><SkipForward size={18} /></button>
        </div>
      </div>

      {/* Duration settings */}
      <div className="card mt-4">
        <div className="card-title mb-3">Timer Settings</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <DurationPicker icon={<Zap size={14} />} label="Work" value={workMin} onChange={v => { setWorkMin(v); if (phase === 'idle') setRemainMs(v * 60000) }} />
          <DurationPicker icon={<Coffee size={14} />} label="Break" value={breakMin} onChange={setBreakMin} />
          <DurationPicker icon={<Coffee size={14} />} label="Long" value={longBreakMin} onChange={setLongBreakMin} />
        </div>
      </div>

      {/* Session dots */}
      <div className="card mt-4">
        <div className="card-title mb-2">Sessions</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Array.from({ length: Math.max(4, session + 1) }, (_, i) => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: i < session ? 'var(--accent)' : i === session && phase === 'work' && running ? 'var(--accent-light)' : 'var(--border)',
              transition: 'background 0.3s'
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DurationPicker({ icon, label, value, onChange }: { icon: React.ReactNode; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="flex items-center justify-center gap-2 mb-2" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <div className="flex items-center justify-center gap-2">
        <button className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }} onClick={() => onChange(Math.max(1, value - 5))}>-</button>
        <span style={{ fontWeight: 700, minWidth: 30, textAlign: 'center' }}>{value}</span>
        <button className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }} onClick={() => onChange(value + 5)}>+</button>
      </div>
      <div className="text-xs text-muted mt-2">min</div>
    </div>
  )
}
