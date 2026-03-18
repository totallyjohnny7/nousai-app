import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../store'
import { applyPomodoroXP } from '../../utils/gamification'

// Module-level double-fire guard — tab lifetime only
let _lastAwardedPomodoroSession = -1

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function PomodoroWidget() {
  const navigate = useNavigate()
  const { timerState, gamification, setData } = useStore()

  // Live countdown for display when running
  const [displayMs, setDisplayMs] = useState(timerState.pomoRemainingMs)

  useEffect(() => {
    if (!timerState.pomoRunning || !timerState.pomoEndTime) {
      setDisplayMs(timerState.pomoRemainingMs)
      return
    }
    const tick = () => {
      const remaining = new Date(timerState.pomoEndTime!).getTime() - Date.now()
      setDisplayMs(Math.max(0, remaining))
    }
    tick()
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [timerState.pomoRunning, timerState.pomoEndTime, timerState.pomoRemainingMs])

  // Award XP when a session completes (pomoSession increments + not running)
  const prevSessionRef = useRef(timerState.pomoSession)
  useEffect(() => {
    if (
      timerState.pomoSession > prevSessionRef.current &&
      !timerState.pomoRunning
    ) {
      const session = timerState.pomoSession
      if (session !== _lastAwardedPomodoroSession) {
        _lastAwardedPomodoroSession = session
        setData(prev => {
          if (!prev) return prev
          const current = prev.pluginData.gamificationData
          const updated = applyPomodoroXP(current)
          return {
            ...prev,
            pluginData: {
              ...prev.pluginData,
              gamificationData: updated,
            },
          }
        })
      }
    }
    prevSessionRef.current = timerState.pomoSession
  }, [timerState.pomoSession, timerState.pomoRunning, setData])

  const phaseLabel = timerState.pomoPhase === 'work'
    ? 'Work'
    : timerState.pomoPhase === 'break'
      ? 'Break'
      : timerState.pomoPhase === 'longBreak'
        ? 'Long Break'
        : timerState.pomoPhase

  const totalXpEarned = timerState.pomoSession * 25

  return (
    <div className="mb-5">
      <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={18} /> Pomodoro
        </span>
        <button
          onClick={() => navigate('/timer')}
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 4px',
            fontFamily: 'inherit',
          }}
        >
          Go to Timer →
        </button>
      </h3>
      <div className="card" style={{ padding: '12px 16px' }}>
        {!timerState.pomoRunning ? (
          <p
            className="text-muted"
            style={{ margin: 0, fontSize: 14, textAlign: 'center', padding: '4px 0' }}
          >
            No active Pomodoro
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Timer countdown */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 28,
                  fontWeight: 700,
                  color: timerState.pomoPhase === 'work' ? 'var(--color-accent)' : 'var(--green)',
                  letterSpacing: '0.05em',
                }}
              >
                {formatMs(displayMs)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-sm, 4px)',
                  background: timerState.pomoPhase === 'work'
                    ? 'rgba(245,166,35,0.15)'
                    : 'rgba(74,222,128,0.15)',
                  color: timerState.pomoPhase === 'work' ? 'var(--color-accent)' : 'var(--green)',
                }}
              >
                {phaseLabel}
              </span>
            </div>
          </div>
        )}

        {/* Session count + XP info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: timerState.pomoRunning ? 10 : 8,
            paddingTop: timerState.pomoRunning ? 10 : 0,
            borderTop: timerState.pomoRunning ? '1px solid var(--border)' : 'none',
          }}
        >
          <span className="text-xs text-muted">
            Session {timerState.pomoSession} of {timerState.pomoTotalSessions}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-accent)', fontWeight: 600 }}>
            {timerState.pomoSession > 0
              ? `+${totalXpEarned} XP earned`
              : '+25 XP per session'}
          </span>
        </div>

        {/* XP preview */}
        {gamification && (
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>
            Total XP: {gamification.xp}
          </div>
        )}
      </div>
    </div>
  )
}
