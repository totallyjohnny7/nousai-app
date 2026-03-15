import { useRef, useState, useCallback } from 'react'
import { Upload, FileJson, Wifi, Sparkles, ArrowRight, BookOpen, FolderPlus } from 'lucide-react'
import { useStore } from '../store'
import NousLogo from '../components/Logo'
import type { NousAIData } from '../types'

type OnboardingPath = 'choose' | 'import' | 'fresh'

export default function Onboarding() {
  const { importData, setData } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [path, setPath] = useState<OnboardingPath>('choose')

  const handleFile = useCallback((file: File) => {
    setLoading(true)
    const reader = new FileReader()
    reader.onload = (e) => {
      importData(e.target?.result as string)
      setLoading(false)
    }
    reader.onerror = () => { alert('Failed to read file'); setLoading(false) }
    reader.readAsText(file)
  }, [importData])

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function startFresh() {
    const blankData: NousAIData = {
      settings: {
        aiProvider: 'none',
        canvasUrl: '',
        canvasToken: '',
        canvasIcalUrl: '',
        canvasEvents: [],
      },
      pluginData: {
        quizHistory: [],
        coachData: { courses: [], sessions: [], streak: 0, totalStudyMinutes: 0, weeklyPlan: null },
        proficiencyData: { settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }, subjects: {} },
        srData: { cards: [] },
        timerState: {
          swRunning: false, swAccumulatedMs: 0, swResumedAt: null, swCourseId: '', swType: 'review',
          pomoRunning: false, pomoEndTime: null, pomoWorkMin: 20, pomoBreakMin: 10,
          pomoLongBreakMin: 15, pomoPhase: 'idle', pomoSession: 0, pomoTotalSessions: 0,
          pomoRemainingMs: 0, savedAt: Date.now()
        },
        gamificationData: {
          xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
          totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
          lastStudyDate: null, perfectScores: 0,
          badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 }
        },
        quizBank: {},
      },
    }
    setData(blankData)
  }

  // Path chooser screen
  if (path === 'choose') {
    return (
      <div className="onboarding animate-in">
        <NousLogo size={48} />
        <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          NOUSAI
        </div>
        <h1>Welcome to NousAI</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          Your all-in-one study companion. Choose how you want to get started.
        </p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
          {/* Start Fresh */}
          <button
            onClick={() => setPath('fresh')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: 20,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', color: 'var(--text-primary)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Start Fresh</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Create a new blank workspace. You can add courses, flashcards, and quizzes from scratch.
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          </button>

          {/* Import Data File */}
          <button
            onClick={() => setPath('import')}
            style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: 20,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', color: 'var(--text-primary)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 'var(--radius-sm)', flexShrink: 0,
              background: 'var(--bg-primary)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Upload size={22} style={{ color: 'var(--accent)' }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Import Data File</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Import an existing data.json file to restore your quizzes, flashcards, and study progress.
              </div>
            </div>
            <ArrowRight size={18} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          </button>
        </div>
      </div>
    )
  }

  // Start Fresh confirmation screen
  if (path === 'fresh') {
    return (
      <div className="onboarding animate-in">
        <NousLogo size={48} />
        <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          NOUSAI
        </div>
        <h1>Start Fresh</h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
          Create a brand new workspace with empty data. You can always import data later from Settings.
        </p>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 400 }}>
          {/* Features list */}
          <div style={{
            padding: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>
              Your new workspace includes:
            </div>
            {[
              { icon: <BookOpen size={14} />, label: 'Course manager with topics and flashcards' },
              { icon: <FolderPlus size={14} />, label: 'Quiz generation and study tools' },
              { icon: <Sparkles size={14} />, label: 'AI-powered learning features' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
                fontSize: 12, color: 'var(--text-secondary)',
              }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </div>

          <button onClick={startFresh} style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: 'var(--radius-sm)',
            background: 'var(--text-primary)', color: 'var(--bg-primary)',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Create Workspace
          </button>

          <button onClick={() => setPath('choose')} style={{
            width: '100%', padding: '12px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  // Import data file screen (existing flow, enhanced)
  return (
    <div className="onboarding animate-in">
      <NousLogo size={48} />
      <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, letterSpacing: 4, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
        NOUSAI
      </div>
      <h1>Import Data File</h1>
      <p>Import your data.json file to restore your quizzes, flashcards, and study progress.</p>

      <div
        className={`drop-zone${dragging ? ' active' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input type="file" ref={fileRef} accept=".json" onChange={onFileSelect} />
        {loading ? (
          <>
            <FileJson size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
            <p style={{ color: 'var(--accent)' }}>Importing...</p>
          </>
        ) : (
          <>
            <Upload size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p style={{ fontWeight: 600 }}>Drop data.json here</p>
            <p className="text-xs text-muted">or click to browse</p>
          </>
        )}
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 400 }}>
        <button onClick={() => setPath('choose')} style={{
          width: '100%', padding: '12px', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Back
        </button>
      </div>

      <div style={{ marginTop: 32, padding: 16, background: 'var(--bg-card)', borderRadius: 'var(--radius)', maxWidth: 400, width: '100%' }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-secondary)' }}>Where is data.json?</strong><br />
          You can export your data from Settings &gt; Data &gt; Export. The file is a standard JSON backup of your NousAI data.
        </p>
      </div>
    </div>
  )
}
