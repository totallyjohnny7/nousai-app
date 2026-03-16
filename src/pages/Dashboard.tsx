import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Flame, Target, Star, Clock, Calendar, BookOpen, Zap, Award,
  LayoutGrid, BarChart3, GraduationCap, CalendarDays, ChevronRight,
  Brain, Lightbulb, MessageCircle, Sparkles, Library, Plus, Check,
  TrendingUp, AlertTriangle, ChevronDown, ChevronUp, X, PenTool, FileText, StickyNote
} from 'lucide-react'
import { useStore } from '../store'
import NousLogo from '../components/Logo'
import { getLevel, getTitle, getLevelProgress, getAllBadgeDefs, buyStreakFreeze, getCurrentWeekQuests } from '../utils/gamification'
import { getWeakTopics, subjectProficiency } from '../utils/proficiency'
import type { QuizAttempt, Course, CourseTopic, ProficiencyEntry, StudyGoal, WeeklyQuest } from '../types'
import { getSpotifyAuthUrl, exchangeSpotifyCode, getCurrentlyPlaying, getSpotifyClientId, isSpotifyConnected, disconnectSpotify, type SpotifyTrack } from '../utils/spotify'
import { getDueCount } from '../utils/getDueCount'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import CourseCards from '../components/dashboard/CourseCards'
import GlobalCalendarWidget from '../components/dashboard/GlobalCalendarWidget'
import StudyPriorityWidget from '../components/dashboard/StudyPriorityWidget'
import RecentGapsWidget from '../components/dashboard/RecentGapsWidget'
import PomodoroWidget from '../components/dashboard/PomodoroWidget'
import DecayRadar from '../components/dashboard/DecayRadar'
import ExamCountdown from '../components/dashboard/ExamCountdown'
import WeakSpotRadar from '../components/dashboard/WeakSpotRadar'
import StickyNotes from '../components/dashboard/StickyNotes'
import UpcomingAssignmentsWidget from '../components/dashboard/UpcomingAssignmentsWidget'
import { generateFSRSAwarePlan } from '../utils/studyPlan'
import type { StudyPlanInput } from '../utils/studyPlan'
import { TooltipPopup, useTip } from '../components/Tooltip'

type DashTab = 'overview' | 'courses' | 'analytics' | 'plan'

export default function Dashboard() {
  const { loaded, gamification, srData, setPageContext } = useStore()
  const [tab, setTab] = useState<DashTab>('overview')

  const tabs = useMemo<{ key: DashTab; label: string; icon: React.ReactNode }[]>(() => [
    { key: 'overview', label: 'Overview', icon: <LayoutGrid size={14} /> },
    { key: 'courses', label: 'Courses', icon: <GraduationCap size={14} /> },
    { key: 'analytics', label: 'Analytics', icon: <BarChart3 size={14} /> },
    { key: 'plan', label: 'Plan', icon: <CalendarDays size={14} /> },
  ], [])

  // Publish page context for Dashboard page
  useEffect(() => {
    const xp = gamification?.xp ?? 0
    const streak = gamification?.streak ?? 0
    const dueCards = (srData?.cards ?? []).filter(c => new Date(c.nextReview) <= new Date()).length

    setPageContext({
      page: 'Dashboard',
      summary: `${xp} XP · ${streak}-day streak · ${dueCards} cards due`,
    })
    return () => setPageContext(null)
  }, [gamification, srData, setPageContext])

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="animate-in">
      <div className="mb-5">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Your study command center</p>
      </div>

      {/* Sub-tab navigation */}
      <div
        role="tablist"
        aria-label="Dashboard sections"
        style={{
          display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)',
          padding: 4, borderRadius: 'var(--radius)', border: '1px solid var(--border)'
        }}
      >
        {tabs.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`dashboard-panel-${t.key}`}
            id={`dashboard-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: tab === t.key ? 'var(--bg-card)' : 'transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
              fontFamily: 'inherit', transition: 'all 0.15s',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <div role="tabpanel" id="dashboard-panel-overview" aria-labelledby="dashboard-tab-overview"><OverviewTab /></div>}
      {tab === 'courses' && <div role="tabpanel" id="dashboard-panel-courses" aria-labelledby="dashboard-tab-courses"><CoursesTab /></div>}
      {tab === 'analytics' && <div role="tabpanel" id="dashboard-panel-analytics" aria-labelledby="dashboard-tab-analytics"><AnalyticsTab /></div>}
      {tab === 'plan' && <div role="tabpanel" id="dashboard-panel-plan" aria-labelledby="dashboard-tab-plan"><PlanTab /></div>}
    </div>
  )
}

/* ================================================================
   OVERVIEW TAB
   ================================================================ */
function OverviewTab() {
  const navigate = useNavigate()
  const { data, setData, updatePluginData, gamification, quizHistory, courses, proficiency, srData } = useStore()
  const [xpSyncing, setXpSyncing] = useState(false)
  const [showWeeklyReport, setShowWeeklyReport] = useState(false)
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null)
  const [spotifyConnected, setSpotifyConnected] = useState(() => isSpotifyConnected())
  const [dismissedWeakKeys, setDismissedWeakKeys] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nousai-dismissed-weak') || '[]') as string[]) }
    catch { return new Set() }
  })
  const [expandedWeakKey, setExpandedWeakKey] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)

  // #96 Weekly Study Report: show on Monday if not dismissed this week
  useEffect(() => {
    const today = new Date();
    if (today.getDay() !== 1) return; // Only Mondays
    const thisWeekKey = `weekly-report-${today.getFullYear()}-W${Math.ceil(today.getDate() / 7)}`;
    if (!localStorage.getItem(thisWeekKey)) {
      setShowWeeklyReport(true);
      localStorage.setItem(thisWeekKey, '1');
    }
  }, []);

  useEffect(() => {
    const onSynced = () => {
      setXpSyncing(true)
      setTimeout(() => setXpSyncing(false), 4500) // 1.5s * 3 iterations
    }
    window.addEventListener('nousai-synced', onSynced)
    return () => window.removeEventListener('nousai-synced', onSynced)
  }, [])

  // Handle Spotify OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (code && state === 'nousai_spotify') {
      const clientId = getSpotifyClientId();
      if (clientId) {
        exchangeSpotifyCode(code, clientId).then(ok => {
          if (ok) {
            setSpotifyConnected(true);
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        });
      }
    }
  }, []);

  // Poll currently playing every 15s
  useEffect(() => {
    if (!spotifyConnected) return;
    const clientId = getSpotifyClientId();
    if (!clientId) return;
    const poll = () => getCurrentlyPlaying(clientId).then(t => setSpotifyTrack(t));
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [spotifyConnected]);

  const level = getLevel(gamification.xp)
  const title = getTitle(level)
  const levelProg = getLevelProgress(gamification.xp)
  const xpForNext = 100
  const xpPct = Math.min(100, Math.round((levelProg / xpForNext) * 100))

  const allBadgeDefs = getAllBadgeDefs()
  const earnedIds = new Set(gamification.badges.map(b => b.id))

  // Due cards count — shared utility keeps badge and stat in sync
  const dueCount = useMemo(
    () => getDueCount(courses, data?.settings?.courseCardCaps as Record<string, number> | undefined),
    [courses, data?.settings?.courseCardCaps]
  )

  // Weak topics for smart study recommendation
  const weakTopics = useMemo(() => {
    if (!proficiency?.subjects) return []
    const weak: { subject: string; topic: string; score: number }[] = []
    Object.entries(proficiency.subjects).forEach(([subject, topics]) => {
      Object.entries(topics).forEach(([topic, entry]) => {
        const e = entry as any
        if (!e.isProficient && e.attempts?.length > 0) {
          weak.push({ subject, topic, score: e.proficiencyScore || 0 })
        }
      })
    })
    return weak.sort((a, b) => a.score - b.score).slice(0, 3)
  }, [proficiency])

  // Recent quizzes
  const recentQuizzes = useMemo(() => {
    return [...quizHistory]
      .filter(q => q.score >= 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [quizHistory])

  // Daily goal
  const dailyGoal = gamification.dailyGoal
  const goalMinTarget = parseInt(localStorage.getItem('nousai-pref-daily-minutes') || '45')
  const goalQTarget = parseInt(localStorage.getItem('nousai-pref-daily-questions') || '20')
  const goalXpPct = Math.min(100, Math.round((dailyGoal.todayXp / dailyGoal.targetXp) * 100))
  const goalQPct = Math.min(100, Math.round((dailyGoal.todayQuestions / goalQTarget) * 100))
  const goalMinPct = Math.min(100, Math.round((dailyGoal.todayMinutes / goalMinTarget) * 100))

  const quickLaunch = [
    { label: 'New Quiz', icon: <Trophy size={20} />, color: 'var(--accent-light)', path: '/quiz?tab=create' },
    { label: 'Match Game', icon: <Target size={20} />, color: 'var(--green)', path: '/learn?mode=match' },
    { label: 'Feynman', icon: <Lightbulb size={20} />, color: 'var(--yellow)', path: '/learn?mode=feynman' },
    { label: 'Socratic', icon: <MessageCircle size={20} />, color: 'var(--blue)', path: '/learn?mode=socratic' },
    { label: 'Mnemonics', icon: <Brain size={20} />, color: 'var(--orange)', path: '/learn?mode=mnemonics' },
    { label: 'AI Tools', icon: <Sparkles size={20} />, color: 'var(--accent-light)', path: '/ai' },
    { label: 'Notes', icon: <StickyNote size={20} />, color: 'var(--yellow)', path: '/library?tab=notes' },
    { label: 'Draw', icon: <PenTool size={20} />, color: 'var(--orange)', path: '/library?tab=drawings' },
    { label: 'Courses', icon: <GraduationCap size={20} />, color: 'var(--green)', path: '/library?tab=courses' },
    { label: 'Library', icon: <Library size={20} />, color: 'var(--blue)', path: '/library' },
    { label: 'Timer', icon: <Clock size={20} />, color: 'var(--accent-light)', path: '/timer' },
  ]

  // Compute last week stats for weekly report
  const lastWeekStats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekQuizzes = quizHistory.filter(q => new Date(q.date) >= weekStart);
    const totalXp = weekQuizzes.reduce((s, q) => s + (Number(q.correct) || 0) * 5 + (q.score === 100 ? 20 : 0), 0);
    const avgScore = weekQuizzes.length > 0 ? Math.round(weekQuizzes.reduce((s, q) => s + (Number(q.score) || 0), 0) / weekQuizzes.length) : 0;
    return { quizzes: weekQuizzes.length, xp: totalXp, avgScore };
  }, [quizHistory]);

  return (
    <div>
      {/* #96 Weekly Study Report modal (beta, Monday only) */}
      {showWeeklyReport && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ maxWidth: 380, width: '100%', padding: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>📊 Weekly Report</div>
            <div className="text-xs text-muted" style={{ marginBottom: 20 }}>Last 7 days recap</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Quizzes', value: lastWeekStats.quizzes, color: 'var(--accent-light)' },
                { label: 'XP Earned', value: lastWeekStats.xp, color: 'var(--yellow)' },
                { label: 'Avg Score', value: `${lastWeekStats.avgScore}%`, color: 'var(--green)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div className="text-xs text-muted">{s.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              {lastWeekStats.quizzes === 0
                ? "No quizzes last week — start fresh this week! 💪"
                : `Great work! You earned ${lastWeekStats.xp} XP across ${lastWeekStats.quizzes} quiz${lastWeekStats.quizzes !== 1 ? 'zes' : ''}.`}
            </div>
            <button className="btn btn-primary btn-full" onClick={() => setShowWeeklyReport(false)}>
              Let's Go This Week! 🚀
            </button>
          </div>
        </div>
      )}

      {/* Animated monochrome banner */}
      <MonochromeBanner />

      {/* Welcome header with streak + XP */}
      <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <NousLogo size={44} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            Welcome back!
            <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 900, fontFamily: 'var(--font-heading)', color: 'var(--accent)' }}>{title}</span>{' '}
              <span className="xp-level" style={{ color: 'var(--text-muted)' }}>(Lv. {level})</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <span className="text-xs" style={{ color: gamification.streak >= 7 ? '#f97316' : 'var(--text-muted)' }}>
              <Flame size={12} style={{ verticalAlign: 'middle', color: '#f97316' }} /> {gamification.streak === 0 ? 'Start your streak today!' : `${gamification.streak} day${gamification.streak !== 1 ? 's' : ''} streak`}
              {(gamification.bestStreak || 0) > gamification.streak && gamification.streak > 0 && (
                <span style={{ marginLeft: 4, color: 'var(--text-dim)', fontSize: 10 }}>
                  (best: {gamification.bestStreak})
                </span>
              )}
            </span>
            <span className="text-xs text-muted">
              <Star size={12} style={{ verticalAlign: 'middle', color: 'var(--yellow)' }} /> {gamification.xp} XP
            </span>
          </div>
          <div
            className={`progress-bar xp-bar${xpSyncing ? ' syncing' : ''}`}
            style={{ marginTop: 8 }}
            role="progressbar"
            aria-valuenow={xpPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`XP progress: ${levelProg} of ${xpForNext} to next level`}
          >
            <div className="progress-fill" style={{ width: `${xpPct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-light))' }} />
          </div>
          <div className="text-xs text-muted" style={{ marginTop: 2 }}>{levelProg} / {xpForNext} XP to next level</div>
        </div>
      </div>

      {/* Daily goal progress */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Daily Goal</span>
          <span className="badge badge-accent">{goalXpPct >= 100 ? 'Done!' : `${goalXpPct}%`}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>XP</div>
            <div className="progress-bar" role="progressbar" aria-valuenow={goalXpPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Daily XP goal: ${dailyGoal.todayXp} of ${dailyGoal.targetXp}`}>
              <div className="progress-fill" style={{ width: `${goalXpPct}%`, background: 'var(--accent)' }} />
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>{dailyGoal.todayXp}/{dailyGoal.targetXp}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Questions</div>
            <div className="progress-bar" role="progressbar" aria-valuenow={goalQPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Daily questions goal: ${dailyGoal.todayQuestions} of ${goalQTarget}`}>
              <div className="progress-fill" style={{ width: `${goalQPct}%`, background: 'var(--green)' }} />
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>{dailyGoal.todayQuestions}/{goalQTarget}</div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Minutes</div>
            <div className="progress-bar" role="progressbar" aria-valuenow={goalMinPct} aria-valuemin={0} aria-valuemax={100} aria-label={`Daily minutes goal: ${dailyGoal.todayMinutes} of ${goalMinTarget} minutes`}>
              <div className="progress-fill" style={{ width: `${goalMinPct}%`, background: 'var(--blue)' }} />
            </div>
            <div className="text-xs text-muted" style={{ marginTop: 2 }}>{dailyGoal.todayMinutes}/{goalMinTarget}</div>
          </div>
        </div>
      </div>

      {/* ── #101 Spotify Now Playing ── */}
      {(() => {
        const clientId = getSpotifyClientId();
        if (!clientId && !spotifyConnected) return null; // Hidden if not set up
        if (!spotifyConnected) {
          return (
            <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 20 }}>🎵</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Connect Spotify</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Show what you're listening to while studying</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={async () => {
                const url = await getSpotifyAuthUrl(clientId);
                window.location.href = url;
              }}>Connect</button>
            </div>
          );
        }
        return (
          <div className="card mb-4" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {spotifyTrack?.albumArt ? (
                <img src={spotifyTrack.albumArt} alt="album" loading="lazy" style={{ width: 44, height: 44, borderRadius: 6, flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎵</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {spotifyTrack ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spotifyTrack.isPlaying ? '▶' : '⏸'} {spotifyTrack.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {spotifyTrack.artist}
                    </div>
                    {spotifyTrack.durationMs > 0 && (
                      <div style={{ marginTop: 4, height: 2, background: 'var(--border)', borderRadius: 1 }}>
                        <div style={{ height: '100%', background: 'var(--accent, #1db954)', borderRadius: 1, width: `${Math.min(100, (spotifyTrack.progressMs / spotifyTrack.durationMs) * 100)}%`, transition: 'width 1s linear' }} />
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nothing playing</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {spotifyTrack?.spotifyUrl && (
                  <a href={spotifyTrack.spotifyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Open</a>
                )}
                <button style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  onClick={() => { disconnectSpotify(); setSpotifyConnected(false); setSpotifyTrack(null); }}>
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* #65 Weekly Quests (beta) */}
      {(() => {
        const quests: WeeklyQuest[] = getCurrentWeekQuests(data?.pluginData?.weeklyQuests);
        return (
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title"><Trophy size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Weekly Quests</span>
              <span className="badge" style={{ fontSize: 10 }}>{quests.filter(q => q.completed).length}/{quests.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {quests.map(quest => {
                const pct = Math.min(100, Math.round((quest.progress / quest.target) * 100));
                return (
                  <div key={quest.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12 }}>
                      <span style={{ fontWeight: quest.completed ? 400 : 600, color: quest.completed ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: quest.completed ? 'line-through' : 'none' }}>
                        {quest.completed ? '✓ ' : ''}{quest.label}
                      </span>
                      <span style={{ color: 'var(--color-accent, #F5A623)', fontWeight: 700, fontSize: 11 }}>+{quest.xpReward} XP</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: quest.completed ? 'var(--green)' : undefined }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{Math.min(quest.progress, quest.target)}/{quest.target}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Smart Study Recommendation */}
      {(dueCount > 0 || weakTopics.length > 0) && (
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div className="card-header" style={{ marginBottom: 8 }}>
            <span className="card-title"><Brain size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Study Now</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dueCount > 0 && (
              <div
                onClick={() => navigate('/flashcards')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} style={{ color: '#ef4444' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{dueCount} cards due for review</div>
                  <div className="text-xs text-muted">Review now to maintain retention</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            {weakTopics.length > 0 && (
              <div
                onClick={() => navigate('/quiz')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)', background: 'rgba(251,191,36,0.08)',
                  border: '1px solid rgba(251,191,36,0.15)', cursor: 'pointer',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.01)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(251,191,36,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TrendingUp size={18} style={{ color: '#f59e0b' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Weakest: {weakTopics[0]?.topic || weakTopics[0]?.subject}</div>
                  <div className="text-xs text-muted">Score: {Math.round(weakTopics[0]?.score || 0)}% — Quiz to improve</div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streak Freeze */}
      <div className="card mb-4" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 22 }}>🛡️</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Streak Freezes</div>
            <div className="text-xs text-muted">{gamification.streakFreezes || 0}/3 — Protects your streak</div>
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => {
              if (!data) return;
              const updated = buyStreakFreeze(gamification);
              if (updated) {
                updatePluginData({ gamificationData: updated });
              }
            }}
            disabled={(gamification.streakFreezes || 0) >= 3 || gamification.xp < 50}
            style={{
              padding: '6px 12px', border: 'none', borderRadius: 'var(--radius-sm)',
              background: (gamification.streakFreezes || 0) >= 3 || gamification.xp < 50 ? 'var(--bg-secondary)' : 'rgba(139,92,246,0.15)',
              color: (gamification.streakFreezes || 0) >= 3 || gamification.xp < 50 ? 'var(--text-dim)' : '#8b5cf6',
              fontSize: 11, fontWeight: 700, cursor: (gamification.streakFreezes || 0) >= 3 || gamification.xp < 50 ? 'default' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {(gamification.streakFreezes || 0) >= 3 ? 'Max (3)' : 'Buy (50 XP)'}
          </button>
        </div>
      </div>

      {/* Course cards — live grade + deadline per course */}
      <CourseCards />

      {/* Canvas upcoming assignments — cross-course sorted list */}
      <UpcomingAssignmentsWidget />

      {/* 7-day global calendar widget */}
      <GlobalCalendarWidget />

      {/* Study Priority Widget — top 3 courses ranked by urgency */}
      <StudyPriorityWidget />

      {/* Recent Gaps — top weak concepts from latest exam reviews */}
      <RecentGapsWidget />

      {/* Pomodoro — compact timer status + XP */}
      <PomodoroWidget />

      {/* Deck Health — FSRS decay bars per course */}
      <DecayRadar />

      {/* Exam Countdown — cards/day required before each exam */}
      <ExamCountdown />

      {/* Weak Spot Radar — lowest-retention subtopics */}
      <WeakSpotRadar />

      {/* Sticky Notes */}
      <StickyNotes />

      {/* Quick launch grid */}
      <div style={{ marginBottom: 20 }}>
        <h3 className="section-title"><Zap size={18} /> Quick Launch</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10 }}>
          {quickLaunch.map(item => (
            <div
              key={item.label}
              className="card"
              onClick={() => navigate(item.path)}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.05)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
              style={{
                textAlign: 'center', padding: '12px 8px', cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', gap: 6,
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                minWidth: 0,
              }}
            >
              <div style={{ color: item.color }}>{item.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Due cards + Stats row — all clickable to navigate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div className="stat-card" onClick={() => navigate('/quiz')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--accent-light)' }}>{quizHistory.filter(q => q.score >= 0).length}</div>
          <div className="stat-label"><Trophy size={12} style={{ verticalAlign: 'middle' }} /> Quizzes</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/study')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--green)' }}>{gamification.totalCorrect}</div>
          <div className="stat-label"><Target size={12} style={{ verticalAlign: 'middle' }} /> Correct</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/quiz')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--yellow)' }}>{quizHistory.filter(q => q.score === 100).length}</div>
          <div className="stat-label"><Award size={12} style={{ verticalAlign: 'middle' }} /> Perfect</div>
        </div>
        <div className="stat-card" onClick={() => navigate('/flashcards')} style={{ cursor: 'pointer' }}>
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{dueCount}</div>
          <div className="stat-label"><BookOpen size={12} style={{ verticalAlign: 'middle' }} /> Due</div>
        </div>
      </div>

      {/* Recent activity feed */}
      {recentQuizzes.length > 0 && (
        <div className="mb-5">
          <h3 className="section-title"><Trophy size={18} /> Recent Activity</h3>
          {recentQuizzes.map(q => {
            const scoreColor = q.score >= 90 ? 'var(--green)' : q.score >= 70 ? 'var(--yellow)' : 'var(--red)'
            return (
              <div key={q.id} className="quiz-attempt" onClick={() => navigate('/quiz?tab=history')} style={{ cursor: 'pointer' }}>
                <div className="quiz-attempt-header">
                  <div>
                    <div className="quiz-attempt-name">{q.name || q.subject || 'Quiz'}</div>
                    <div className="quiz-attempt-meta">
                      {new Date(q.date).toLocaleDateString()}{q.questionCount ? ` - ${q.correct ?? 0}/${q.questionCount} correct` : ''}
                    </div>
                  </div>
                  <div className="quiz-score" style={{ color: scoreColor }}>{q.score}%</div>
                </div>
                <div className="progress-bar" style={{ marginTop: 6 }}>
                  <div className="progress-fill" style={{ width: `${q.score}%`, background: scoreColor }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Badges earned */}
      <div>
        <h3 className="section-title"><Award size={18} /> Badges</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {allBadgeDefs.map(def => {
            const earned = earnedIds.has(def.id)
            return (
              <div key={def.id} className={`badge ${earned ? 'badge-accent' : ''}`}
                style={!earned ? { opacity: 0.35, background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' } : {}}
                title={def.description}
              >
                <span>{def.icon}</span> {def.name}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Learning Path Recommendation (#4) ─────────── */}
      {(() => {
        if (!proficiency?.subjects) return null
        const allTopics: { subject: string; topic: string; score: number }[] = []
        Object.entries(proficiency.subjects).forEach(([subject, topics]) => {
          Object.entries(topics).forEach(([topic, entry]) => {
            const e = entry as ProficiencyEntry
            if (!e.isProficient) allTopics.push({ subject, topic, score: e.proficiencyScore })
          })
        })
        const lowest = allTopics.sort((a, b) => a.score - b.score)[0]
        if (!lowest) return null
        return (
          <div className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(245,166,35,0.03))', border: '1px solid rgba(245,166,35,0.2)' }}>
            <div className="card-header">
              <span className="card-title"><BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--color-accent, #F5A623)' }} />Focus Today</span>
              <span className="badge badge-accent">Recommended</span>
            </div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{lowest.topic}</span>
              <span className="text-muted" style={{ marginLeft: 6 }}>{lowest.subject} · {Math.max(0, Math.round(lowest.score))}% proficiency</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={() => navigate('/quiz')} style={{ fontSize: 11 }}>Quiz it</button>
              <button className="btn btn-sm" onClick={() => navigate('/flashcards')} style={{ fontSize: 11 }}>Review cards</button>
            </div>
          </div>
        )
      })()}

      {/* ── Socratic Challenge Shortcut (#18) ──────────── */}
      {(() => {
        if (!courses?.length) return null
        const recentCourse = courses[courses.length - 1]
        return (
          <div className="card mb-4" style={{ background: 'rgba(139,92,246,0.05)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>🎯 Challenge Me</div>
                <div className="text-xs text-muted">Socratic session on {recentCourse?.name || 'your latest course'}</div>
              </div>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', fontSize: 11 }}
                onClick={() => navigate('/learn?mode=socratic')}
              >Start →</button>
            </div>
          </div>
        )
      })()}

      {/* ── Daily Challenge ────────────────────────────── */}
      {<BetaDailyChallenge weakTopics={weakTopics} navigate={navigate} />}

      {/* ── Needs Work ─────────────────────────────────── */}
      {(() => {
        const activeTopics = weakTopics.filter(w => !dismissedWeakKeys.has(`${w.subject}::${w.topic}`))
        const dismissedTopics = weakTopics.filter(w => dismissedWeakKeys.has(`${w.subject}::${w.topic}`))
        if (weakTopics.length === 0) return null
        return (
          <div className="card mt-4" style={{ border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.04)' }}>
            <div className="card-header" style={{ marginBottom: 10 }}>
              <span className="card-title"><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--red)' }} />Needs Work</span>
              <span className="badge badge-red">{activeTopics.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {activeTopics.map((w) => {
                const key = `${w.subject}::${w.topic}`
                const isExpanded = expandedWeakKey === key
                const recentAttempts = [...quizHistory]
                  .filter(q => q.subject === w.subject && (q.subtopic === w.topic || q.name === w.topic))
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .slice(0, 3)
                return (
                  <div key={key} style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: isExpanded ? '1px solid rgba(239,68,68,0.2)' : '1px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isExpanded ? '8px 8px 6px' : '4px 0' }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: w.score < 40 ? 'rgba(239,68,68,0.15)' : 'rgba(251,191,36,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-mono)',
                        color: w.score < 40 ? 'var(--red)' : 'var(--yellow)',
                      }}>
                        {Math.max(0, Math.round(w.score))}%
                      </div>
                      <div
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                        onClick={() => setExpandedWeakKey(isExpanded ? null : key)}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.topic}</div>
                        <div className="text-xs text-muted">{w.subject}</div>
                      </div>
                      <button
                        onClick={() => navigate('/quiz')}
                        style={{
                          padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
                          background: 'rgba(239,68,68,0.12)', color: 'var(--red)',
                          border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                        }}
                      >Quiz</button>
                      <button
                        title="Mark as done"
                        onClick={() => {
                          const next = new Set([...dismissedWeakKeys, key])
                          setDismissedWeakKeys(next)
                          localStorage.setItem('nousai-dismissed-weak', JSON.stringify([...next]))
                          if (expandedWeakKey === key) setExpandedWeakKey(null)
                        }}
                        style={{
                          width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(34,197,94,0.12)', color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.25)', cursor: 'pointer', flexShrink: 0,
                        }}
                      ><Check size={12} /></button>
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '8px 10px 10px', background: 'rgba(0,0,0,0.15)' }}>
                        {recentAttempts.length === 0 ? (
                          <div className="text-xs text-muted">No quiz attempts yet for this topic.</div>
                        ) : (
                          <>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recent Attempts</div>
                            {recentAttempts.map((q, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginBottom: 4 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{new Date(q.date).toLocaleDateString()}</span>
                                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', color: q.score >= 70 ? '#22c55e' : q.score >= 50 ? 'var(--yellow)' : 'var(--red)' }}>{q.score}%</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {dismissedTopics.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <button
                    onClick={() => setShowDismissed(v => !v)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 0' }}
                  >
                    {showDismissed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {dismissedTopics.length} completed
                  </button>
                  {showDismissed && (
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {dismissedTopics.map(w => {
                        const key = `${w.subject}::${w.topic}`
                        return (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
                            <Check size={12} style={{ color: '#22c55e', flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, textDecoration: 'line-through', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.topic}</div>
                            </div>
                            <button
                              onClick={() => {
                                const next = new Set([...dismissedWeakKeys])
                                next.delete(key)
                                setDismissedWeakKeys(next)
                                localStorage.setItem('nousai-dismissed-weak', JSON.stringify([...next]))
                              }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'var(--text-muted)', padding: '2px 4px' }}
                            >Undo</button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Goals (#100) ───────────────────────────────── */}
      {<GoalsPanel data={data} updatePluginData={updatePluginData} gamification={gamification} courses={courses} />}
    </div>
  )
}

// Beta: Goals panel (#100)
function GoalsPanel({ data, updatePluginData, gamification, courses }: {
  data: any;
  updatePluginData: (patch: Record<string, unknown>) => void;
  gamification: any;
  courses: Course[];
}) {
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newTarget, setNewTarget] = useState('7')
  const [newType, setNewType] = useState<StudyGoal['type']>('streak')
  const goals = (data?.pluginData?.goals || []) as StudyGoal[]

  function getProgress(g: StudyGoal) {
    if (g.type === 'streak') return gamification.streak
    if (g.type === 'xp') return gamification.xp
    if (g.type === 'quizzes') return gamification.totalQuizzes || 0
    if (g.type === 'finish_course' && g.courseId) {
      const c = courses.find(x => x.id === g.courseId)
      const total = c?.topics?.length || 0
      const done = c?.topics?.filter((t: CourseTopic) => t.completed).length || 0
      return total ? Math.round((done / total) * 100) : 0
    }
    return g.progress
  }

  function addGoal() {
    if (!newLabel.trim()) return
    const goal: StudyGoal = {
      id: `goal-${Date.now()}`,
      type: newType,
      label: newLabel.trim(),
      target: Number(newTarget) || 1,
      progress: 0,
      createdAt: new Date().toISOString(),
    }
    updatePluginData({ goals: [...goals, goal] })
    setAdding(false)
    setNewLabel('')
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <span className="card-title">🎯 Goals</span>
        <button className="btn btn-sm" onClick={() => setAdding(a => !a)} style={{ fontSize: 11 }}>
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <select value={newType} onChange={e => setNewType(e.target.value as StudyGoal['type'])}
            style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="streak">Streak days</option>
            <option value="xp">Total XP</option>
            <option value="quizzes">Quizzes</option>
          </select>
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label..." maxLength={40}
            style={{ flex: 1, minWidth: 120, fontSize: 11, padding: '4px 8px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <input value={newTarget} onChange={e => setNewTarget(e.target.value)} type="number" min={1} style={{ width: 60, fontSize: 11, padding: '4px 6px', background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 6 }} />
          <button className="btn btn-sm btn-primary" onClick={addGoal} style={{ fontSize: 11 }}>Save</button>
        </div>
      )}
      {goals.length === 0 && !adding && <div className="text-xs text-muted">No goals yet. Add one to track your progress!</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {goals.map((g) => {
          const prog = getProgress(g)
          const pct = Math.min(100, Math.round((prog / g.target) * 100))
          return (
            <div key={g.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{g.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-xs text-muted">{prog}/{g.target}</span>
                  <button onClick={() => updatePluginData({ goals: goals.filter(x => x.id !== g.id) })}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1 }}>×</button>
                </div>
              </div>
              <div className="progress-bar" style={{ height: 5 }}>
                <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 100 ? 'var(--green)' : 'var(--color-accent, #F5A623)', transition: 'width 0.4s' }} />
              </div>
              {pct >= 100 && <div className="text-xs" style={{ color: 'var(--green)', marginTop: 2 }}>✓ Completed!</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Beta: Daily Challenge widget
function BetaDailyChallenge({ weakTopics, navigate }: {
  weakTopics: { subject: string; topic: string; score: number }[];
  navigate: (path: string) => void;
}) {
  const todayKey = new Date().toISOString().split('T')[0]
  const doneKey = `nousai-challenge-${todayKey}`
  const [done, setDone] = useState(() => localStorage.getItem(doneKey) === 'true')

  const challenge = useMemo(() => {
    if (weakTopics.length === 0) return null
    // Pick a topic different from the #1 weakest (Focus Today already shows that one)
    // Use today's date to vary it; skip index 0 if multiple topics available
    if (weakTopics.length === 1) return null // don't duplicate Focus Today
    const idx = (new Date().getDate() % (weakTopics.length - 1)) + 1
    return weakTopics[idx] ?? weakTopics[1]
  }, [weakTopics])

  if (!challenge) return null

  return (
    <div className="card mt-4" style={{ border: '1px solid rgba(245,166,35,0.3)', background: 'rgba(245,166,35,0.05)' }}>
      <div className="card-header" style={{ marginBottom: 8 }}>
        <span className="card-title">🎯 Daily Challenge</span>
        {done && <span className="badge badge-accent">✓ Completed</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(245,166,35,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>
          ⚡
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{challenge.topic}</div>
          <div className="text-xs text-muted">{challenge.subject} · Current score: {Math.round(challenge.score)}%</div>
        </div>
        <button
          disabled={done}
          onClick={() => { setDone(true); localStorage.setItem(doneKey, 'true'); navigate('/quiz') }}
          style={{
            padding: '8px 14px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
            background: done ? 'var(--bg-secondary)' : 'var(--accent)', color: done ? 'var(--text-muted)' : '#000',
            border: 'none', borderRadius: 'var(--radius-sm)', cursor: done ? 'default' : 'pointer',
          }}
        >
          {done ? 'Done ✓' : 'Start →'}
        </button>
      </div>
    </div>
  )
}

/* ================================================================
   COURSES TAB
   ================================================================ */
function CoursesTab() {
  const navigate = useNavigate()
  const { courses, proficiency, quizHistory } = useStore()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [newCourseName, setNewCourseName] = useState('')

  function quizMatchesCourse(q: any, course: Course): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, '')
    const sub = (q.subject || '').toLowerCase()
    const subN = norm(q.subject || '')
    const qName = (q.name || '').toLowerCase()
    const cId = course.id.toLowerCase()
    const cName = course.name.toLowerCase()
    const cShort = (course.shortName || '').toLowerCase()
    const cShortN = norm(course.shortName || '')
    const cNameN = norm(course.name)
    return (
      sub === cId || sub === cName || sub === cShort ||
      subN === cShortN || subN === cNameN ||
      qName.includes(cName) || qName.includes(cShort) ||
      (cShort && sub.includes(cShort)) ||
      (cShortN && subN.includes(cShortN)) ||
      (subN && cNameN.includes(subN))
    )
  }

  function getCourseMastery(course: Course): number {
    const courseQuizzes = quizHistory.filter(q => quizMatchesCourse(q, course) && q.score >= 0)
    if (courseQuizzes.length === 0) return 0
    const totalScore = courseQuizzes.reduce((sum, q) => sum + (q.score || 0), 0)
    return Math.max(0, Math.round(totalScore / courseQuizzes.length))
  }

  function getTopicStatus(course: Course, topic: CourseTopic): 'mastered' | 'learning' | 'not_started' {
    if (!proficiency?.subjects) return 'not_started'
    const subjectKey = course.shortName || course.name
    const subjectData = proficiency.subjects[subjectKey]
    if (!subjectData) return 'not_started'
    const entry = subjectData[topic.name] || subjectData[topic.id]
    if (!entry) return 'not_started'
    if (entry.isProficient) return 'mastered'
    if (entry.attempts && entry.attempts.length > 0) return 'learning'
    return 'not_started'
  }

  function statusColor(status: 'mastered' | 'learning' | 'not_started'): string {
    if (status === 'mastered') return 'var(--green)'
    if (status === 'learning') return 'var(--yellow)'
    return 'var(--text-muted)'
  }

  function statusLabel(status: 'mastered' | 'learning' | 'not_started'): string {
    if (status === 'mastered') return 'Mastered'
    if (status === 'learning') return 'Learning'
    return 'Not Started'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 className="section-title" style={{ margin: 0 }}><GraduationCap size={18} /> Course Spaces</h3>
        <button className="btn btn-sm btn-primary" onClick={() => setShowAddCourse(!showAddCourse)}>
          <Plus size={14} /> Add Course
        </button>
      </div>

      {showAddCourse && (
        <div className="card mb-4" style={{ display: 'flex', gap: 8 }}>
          <input
            type="text" placeholder="Course name..."
            value={newCourseName} onChange={e => setNewCourseName(e.target.value)}
            style={{
              flex: 1, padding: '9px 12px', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
              fontSize: 13, outline: 'none', fontFamily: 'inherit'
            }}
          />
          <button className="btn btn-sm btn-secondary" onClick={() => setShowAddCourse(false)}>
            <X size={14} />
          </button>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          <GraduationCap />
          <h3>No courses yet</h3>
          <p>Create your first course to organize your study materials.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/library')}>
            <Plus size={14} /> Create Course
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {courses.map(course => {
            const mastery = getCourseMastery(course)
            const isExpanded = expandedId === course.id
            const topicCount = course.topics?.length || 0
            const masteredTopics = course.topics?.filter(t => getTopicStatus(course, t) === 'mastered').length || 0

            return (
              <div key={course.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Course card header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : course.id)}
                  style={{ padding: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <div style={{
                    width: 8, height: 40, borderRadius: 4,
                    background: course.color || 'var(--accent)', flexShrink: 0
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{course.name}</div>
                    <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                      {topicCount} topics &bull; {masteredTopics}/{topicCount} mastered
                    </div>
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div className="progress-fill" style={{ width: `${mastery}%`, background: course.color || 'var(--accent)' }} />
                    </div>
                    {topicCount > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div className="progress-bar" style={{ flex: 1, height: 4, background: 'var(--bg-primary)' }}>
                          <div className="progress-fill" style={{
                            width: `${Math.round((masteredTopics / topicCount) * 100)}%`,
                            background: 'var(--green)', height: '100%'
                          }} />
                        </div>
                        <span className="text-xs" style={{ color: 'var(--green)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {Math.round((masteredTopics / topicCount) * 100)}% complete
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{ textAlign: 'right', flexShrink: 0, cursor: 'help' }}
                    title="Quiz score average across all attempts for this course. Topic proficiency (green checkmarks) uses a separate weighted formula: 85% threshold, min 3 attempts, 70% weight on recent attempts."
                  >
                    <div style={{ fontSize: 20, fontWeight: 800, color: course.color || 'var(--accent)' }}>{mastery}%</div>
                    <div className="text-xs text-muted">mastery ⓘ</div>
                  </div>
                  {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                </div>

                {/* Expanded topic tree */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <button className="btn btn-sm btn-primary" onClick={(e) => { e.stopPropagation(); navigate(`/course?id=${course.id}`); }}
                      style={{ marginTop: 12, marginBottom: 8, width: '100%' }}>
                      <ChevronRight size={14} /> Open Course Space
                    </button>
                    {course.topics && course.topics.map(topic => {
                      const status = getTopicStatus(course, topic)
                      return (
                        <div key={topic.id}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                            borderBottom: '1px solid var(--border)'
                          }}>
                            <div style={{
                              width: 8, height: 8, borderRadius: '50%',
                              background: statusColor(status), flexShrink: 0
                            }} />
                            <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{topic.name}</div>
                            <span className="text-xs" style={{ color: statusColor(status), fontWeight: 600 }}>
                              {statusLabel(status)}
                            </span>
                          </div>
                          {/* Subtopics */}
                          {topic.subtopics && topic.subtopics.map(sub => (
                            <div key={sub.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 8px 24px',
                              borderBottom: '1px solid var(--border)'
                            }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0 }} />
                              <div style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{sub.name}</div>
                              <span className="text-xs text-muted">{sub.status || 'not started'}</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ================================================================
   ANALYTICS TAB
   ================================================================ */
function AnalyticsTab() {
  const { gamification, quizHistory, proficiency, srData, data } = useStore()
  const { tip: atip, show: ashow, move: amove, hide: ahide } = useTip()

  // Study streak calendar (last 12 weeks)
  const streakData = useMemo(() => {
    const days: { date: string; count: number }[] = []
    const dateMap = new Map<string, number>()

    // Count quiz attempts per day
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

  // 52-week heatmap data
  const heatmapData = useMemo(() => {
    const dateMap = new Map<string, number>()
    quizHistory.forEach(q => {
      const d = new Date(q.date).toISOString().split('T')[0]
      dateMap.set(d, (dateMap.get(d) || 0) + 1)
    })
    const today = new Date()
    // Align to start on Sunday of the week 51 weeks ago
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 363)
    const dayOfWeek = startDate.getDay()
    startDate.setDate(startDate.getDate() - dayOfWeek)
    const cells: { date: string; count: number; week: number; day: number }[] = []
    const d = new Date(startDate)
    for (let week = 0; week < 53; week++) {
      for (let day = 0; day < 7; day++) {
        const key = d.toISOString().split('T')[0]
        cells.push({ date: key, count: dateMap.get(key) || 0, week, day })
        d.setDate(d.getDate() + 1)
      }
    }
    return cells
  }, [quizHistory])

  // XP by week (last 8 weeks)
  const weeklyXp = useMemo(() => {
    const weeks: { label: string; xp: number }[] = []
    const now = new Date()
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now)
      weekStart.setDate(weekStart.getDate() - w * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      const label = `W${8 - w}`

      // Estimate XP from quizzes in that week
      let xp = 0
      quizHistory.forEach(q => {
        const qd = new Date(q.date)
        if (qd >= weekStart && qd < weekEnd) {
          xp += (Number(q.correct) || 0) * 5 + (Number(q.score) === 100 ? 20 : 0)
        }
      })
      weeks.push({ label, xp })
    }
    return weeks
  }, [quizHistory])

  const maxWeekXp = Math.max(...weeklyXp.map(w => w.xp), 1)

  // Quiz score distribution
  const scoreDist = useMemo(() => {
    const buckets = [
      { label: '0-49', count: 0, color: 'var(--red)' },
      { label: '50-69', count: 0, color: 'var(--orange)' },
      { label: '70-89', count: 0, color: 'var(--yellow)' },
      { label: '90-100', count: 0, color: 'var(--green)' },
    ]
    quizHistory.forEach(q => {
      if (q.score < 50) buckets[0].count++
      else if (q.score < 70) buckets[1].count++
      else if (q.score < 90) buckets[2].count++
      else buckets[3].count++
    })
    return buckets
  }, [quizHistory])

  const maxScoreCount = Math.max(...scoreDist.map(b => b.count), 1)

  // Proficiency by subject
  const subjProf = useMemo(() => {
    if (!proficiency?.subjects) return []
    return Object.entries(proficiency.subjects).map(([subject, topics]) => {
      const entries = Object.values(topics) as ProficiencyEntry[]
      if (entries.length === 0) return { subject, score: 0 }
      const avg = entries.reduce((acc, e) => acc + e.proficiencyScore, 0) / entries.length
      return { subject, score: Math.round(avg) }
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score)
  }, [proficiency])

  // Time studied per day (last 7 days from quiz count approximation)
  const dailyActivity = useMemo(() => {
    const days: { label: string; quizzes: number }[] = []
    const now = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('en-US', { weekday: 'short' })
      const count = quizHistory.filter(q => new Date(q.date).toISOString().split('T')[0] === key).length
      days.push({ label, quizzes: count })
    }
    return days
  }, [quizHistory])

  const maxDailyQ = Math.max(...dailyActivity.map(d => d.quizzes), 1)

  // Weak topics
  const weakTopics = useMemo(() => {
    if (!proficiency?.subjects) return []
    const weak: { subject: string; topic: string; score: number }[] = []
    Object.entries(proficiency.subjects).forEach(([subject, topics]) => {
      Object.entries(topics).forEach(([topic, entry]) => {
        const e = entry as ProficiencyEntry
        if (!e.isProficient && e.attempts.length > 0) {
          weak.push({ subject, topic, score: e.proficiencyScore })
        }
      })
    })
    return weak.sort((a, b) => a.score - b.score).slice(0, 8)
  }, [proficiency])

  return (
    <div>
      {atip && <TooltipPopup tip={atip} />}
      {/* Empty state when no quiz data */}
      {quizHistory.length === 0 && (
        <div className="card mb-4 empty-state" style={{ textAlign: 'center', padding: '24px 16px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>No quiz data yet</p>
          <p className="text-muted text-sm" style={{ margin: '6px 0 0' }}>Take your first quiz to see analytics here</p>
          <a href="#/quiz?tab=create" className="btn btn-primary btn-sm" style={{ marginTop: 12, display: 'inline-flex' }}>Take your first quiz →</a>
        </div>
      )}

      {/* Streak calendar */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>Study Streak (12 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Each cell is one day. Darker = more quizzes completed that day. Hover a cell for the exact date and count.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Study Streak (12 Weeks)
          </span>
          <span className="badge badge-accent"><Flame size={12} /> {gamification.streak}d</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          {streakData.map((d, i) => {
            const intensity = d.count === 0 ? 0 : Math.min(1, d.count / 3)
            return (
              <div
                key={i}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#6366f1', marginBottom: 4 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.count === 0 ? 'No activity' : `${d.count} quiz${d.count === 1 ? '' : 'zes'} completed`}</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{
                  width: '100%', aspectRatio: '1', borderRadius: 2,
                  background: d.count === 0
                    ? 'var(--bg-primary)'
                    : `rgba(99, 102, 241, ${0.2 + intensity * 0.8})`,
                  border: '1px solid var(--border)',
                  cursor: d.count > 0 ? 'pointer' : 'default'
                }}
              />
            )
          })}
        </div>
      </div>

      {/* 52-Week Contribution Heatmap (beta) */}
      {heatmapData.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Activity Heatmap (52 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>A full year of activity. Each cell = one day. Darker amber = more quizzes. Hover any cell for the date and count.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Activity Heatmap (52 Weeks)
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 3, minWidth: 'max-content' }}>
              {Array.from({ length: 53 }, (_, week) => (
                <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {heatmapData.filter(c => c.week === week).map(cell => {
                    const intensity = cell.count === 0 ? 0 : Math.min(1, cell.count / 4)
                    const isFuture = cell.date > new Date().toISOString().split('T')[0]
                    return (
                      <div
                        key={cell.date}
                        onMouseEnter={isFuture ? undefined : e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{new Date(cell.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cell.count === 0 ? 'No activity' : `${cell.count} quiz${cell.count === 1 ? '' : 'zes'} completed`}</div></div>)}
                        onMouseMove={isFuture ? undefined : amove}
                        onMouseLeave={isFuture ? undefined : ahide}
                        style={{
                          width: 11, height: 11, borderRadius: 2,
                          background: isFuture ? 'transparent' : cell.count === 0
                            ? 'var(--bg-primary)'
                            : `rgba(245, 166, 35, ${0.2 + intensity * 0.8})`,
                          border: isFuture ? 'none' : '1px solid var(--border)',
                          cursor: cell.count > 0 ? 'pointer' : 'default',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Less</span>
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <div key={v} style={{
                width: 11, height: 11, borderRadius: 2,
                background: v === 0 ? 'var(--bg-primary)' : `rgba(245, 166, 35, ${0.2 + v * 0.8})`,
                border: '1px solid var(--border)',
              }} />
            ))}
            <span>More</span>
          </div>
        </div>
      )}

      {/* XP over time */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>XP by Week</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>XP earned per calendar week from quiz completions. Each correct answer earns 5 XP; a perfect score adds a 20 XP bonus. Hover bars for the exact weekly total.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />XP by Week
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
          {weeklyXp.map(w => (
            <div
              key={w.label}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{w.label}</div><div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600 }}>{w.xp} XP</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <div className="text-xs text-muted">{w.xp}</div>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, (w.xp / maxWeekXp) * 80)}px`,
                background: 'var(--accent)', transition: 'height 0.3s'
              }} />
              <div className="text-xs text-muted">{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quiz score distribution */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--yellow)', marginBottom: 4 }}>Score Distribution</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>All quiz scores bucketed by range. 0–49 = needs work, 50–69 = developing, 70–89 = proficient, 90–100 = mastery. Hover a bar for the count and percentage.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Score Distribution
          </span>
          <span className="text-xs text-muted">{quizHistory.length} quizzes</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
          {scoreDist.map(b => {
            const pct = quizHistory.length > 0 ? Math.round((b.count / quizHistory.length) * 100) : 0
            const label = b.label === '0-49' ? 'Needs work' : b.label === '50-69' ? 'Developing' : b.label === '70-89' ? 'Proficient' : 'Mastery'
            return (
              <div
                key={b.label}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: b.color, marginBottom: 4 }}>{b.label} — {label}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.count} quiz{b.count !== 1 ? 'zes' : ''}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of total</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
              >
                <div className="text-xs text-muted">{b.count}</div>
                <div style={{
                  width: '100%', borderRadius: '4px 4px 0 0',
                  height: `${Math.max(4, (b.count / maxScoreCount) * 70)}px`,
                  background: b.color, transition: 'height 0.3s'
                }} />
                <div className="text-xs text-muted">{b.label}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quiz accuracy trend (beta) */}
      {quizHistory.length >= 3 && (() => {
        const recent = [...quizHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(-20)
        const w = 300, h = 80, pad = 4
        const points = recent.map((q, i) => {
          const x = pad + (i / (recent.length - 1)) * (w - pad * 2)
          const y = h - pad - (q.score / 100) * (h - pad * 2)
          return `${x},${y}`
        }).join(' ')
        return (
          <div className="card mb-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Accuracy Trend (Last 20 Quizzes)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your quiz scores in chronological order. The dashed line marks the 70% passing target. Hover any dot for the quiz name and score.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Accuracy Trend (Last 20 Quizzes)
              </span>
            </div>
            <div style={{ padding: '8px 12px 12px', overflowX: 'auto' }}>
              <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ minWidth: 200, height: 80 }}>
                <line x1={pad} y1={h - pad - (70 / 100) * (h - pad * 2)} x2={w - pad} y2={h - pad - (70 / 100) * (h - pad * 2)}
                  stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
                <polyline points={points} fill="none" stroke="var(--color-accent, #F5A623)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                {recent.map((q, i) => {
                  const x = pad + (i / (recent.length - 1)) * (w - pad * 2)
                  const y = h - pad - (q.score / 100) * (h - pad * 2)
                  return <circle key={i} cx={x} cy={y} r="5" fill="var(--color-accent, #F5A623)" opacity={0.9} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => ashow(e as unknown as React.MouseEvent, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{q.name?.slice(0, 30) || `Quiz #${i + 1}`}</div><div style={{ fontSize: 13, fontWeight: 600, color: q.score >= 70 ? 'var(--green)' : 'var(--red)' }}>{q.score}%</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(q.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div></div>)}
                    onMouseMove={e => amove(e as unknown as React.MouseEvent)}
                    onMouseLeave={ahide}
                  />
                })}
              </svg>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                <span>{recent[0]?.name?.slice(0, 14)}</span>
                <span>70% target</span>
                <span>{recent[recent.length - 1]?.name?.slice(0, 14)}</span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Proficiency by subject */}
      {subjProf.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Proficiency by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average correct-answer rate per subject across all quizzes. Green ≥85% (proficient), yellow ≥60% (developing), red &lt;60% (needs work). Hover a row for details.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <GraduationCap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Proficiency by Subject
            </span>
          </div>
          {subjProf.map(s => {
            const status = s.score >= 85 ? 'Proficient' : s.score >= 60 ? 'Developing' : 'Needs work'
            const color = s.score >= 85 ? 'var(--green)' : s.score >= 60 ? 'var(--yellow)' : 'var(--red)'
            return (
              <div
                key={s.subject}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color, marginBottom: 4 }}>{s.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color }}>{s.score}% — {status}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Average proficiency score across all topics in this subject.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ marginBottom: 10, cursor: 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.subject}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{s.score}%</span>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${s.score}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Daily activity */}
      <div className="card mb-4">
        <div className="card-header">
          <span
            className="card-title"
            style={{ cursor: 'default' }}
            onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Daily Activity (Last 7 Days)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Number of quizzes completed each day this week. Hover a bar for the exact count.</div></div>)}
            onMouseMove={amove}
            onMouseLeave={ahide}
          >
            <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Daily Activity (Last 7 Days)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {dailyActivity.map(d => (
            <div
              key={d.label}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{d.label}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.quizzes} quiz{d.quizzes !== 1 ? 'zes' : ''}</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
            >
              <div className="text-xs text-muted">{d.quizzes}</div>
              <div style={{
                width: '100%', borderRadius: '4px 4px 0 0',
                height: `${Math.max(4, (d.quizzes / maxDailyQ) * 50)}px`,
                background: 'var(--blue)', transition: 'height 0.3s'
              }} />
              <div className="text-xs text-muted">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weak topics */}
      {weakTopics.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span
              className="card-title"
              style={{ cursor: 'default' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Weak Topics</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Topics where you haven't reached proficiency, sorted by lowest score first. Focus here for the biggest improvement. Hover a row for details.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Weak Topics
            </span>
            <span className="badge badge-red">{weakTopics.length}</span>
          </div>
          {weakTopics.map((w, i) => {
            const color = w.score < 50 ? 'var(--red)' : 'var(--yellow)'
            return (
              <div
                key={i}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color, marginBottom: 4 }}>{w.topic}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{w.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color }}>{Math.max(0, Math.round(w.score))}% proficiency</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{w.score < 50 ? 'Critical — needs significant review' : 'Getting there — a few more correct answers will unlock proficiency'}</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                  borderBottom: i < weakTopics.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'default'
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{w.topic}</div>
                  <div className="text-xs text-muted">{w.subject}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{Math.max(0, Math.round(w.score))}%</span>
              </div>
            )
          })}
        </div>
      )}

      {/* #98 Error Pattern Analysis */}
      {(() => {
        const missedMap = new Map<string, number>();
        quizHistory.forEach(q => {
          (q.answers || []).forEach((a: any) => {
            if (!a.correct) {
              const key = `${q.subject || 'Unknown'}::${q.subtopic || a.question?.question?.slice(0, 30) || 'Unknown'}`;
              missedMap.set(key, (missedMap.get(key) || 0) + 1);
            }
          });
        });
        const top = Array.from(missedMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, count]) => {
            const [subject, topic] = key.split('::');
            return { subject, topic, count };
          });
        if (top.length === 0) return null;
        return (
          <div className="card">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>Error Patterns</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Question categories you miss most often, ranked by total error count across all quizzes. Reviewing these topics will have the biggest impact on your scores. Hover a row for details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Error Patterns
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Topics you miss most often:</div>
            {top.map((e, i) => (
              <div
                key={i}
                onMouseEnter={ev => ashow(ev, <div><div style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>#{i + 1} — {e.topic}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{e.subject}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)' }}>{e.count}× missed</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Appears across multiple quizzes — prioritize reviewing this area.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < top.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'default' }}
              >
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--red-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--red)', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{e.topic}</div>
                  <div className="text-xs text-muted">{e.subject}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 700 }}>{e.count}× missed</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* #94 Retention Curve */}
      {(() => {
        const cards = srData?.cards || [];
        if (cards.length === 0) return null;
        // Bucket cards by stability (days): <1, 1-3, 3-7, 7-14, 14-30, 30+
        const buckets = [
          { label: '<1d', min: 0, max: 1, count: 0 },
          { label: '1-3d', min: 1, max: 3, count: 0 },
          { label: '3-7d', min: 3, max: 7, count: 0 },
          { label: '7-14d', min: 7, max: 14, count: 0 },
          { label: '14-30d', min: 14, max: 30, count: 0 },
          { label: '30+d', min: 30, max: Infinity, count: 0 },
        ];
        cards.forEach(c => {
          const s = c.S || 0;
          const b = buckets.find(b => s >= b.min && s < b.max);
          if (b) b.count++;
        });
        const maxCount = Math.max(...buckets.map(b => b.count), 1);
        return (
          <div className="card mt-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>Retention Curve</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your flashcards distributed by FSRS stability interval. Cards further right have stronger long-term memory. Ideally most cards should be in the 7d+ buckets. Hover bars for details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Retention Curve
              </span>
              <span className="text-xs text-muted">{cards.length} SR cards</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 4 }}>
              {buckets.map(b => {
                const meanings: Record<string, string> = {
                  '<1d': 'Very new — just introduced or recently failed',
                  '1-3d': 'Early learning — building initial memory',
                  '3-7d': 'Developing — growing stability',
                  '7-14d': 'Established — reliable short-term memory',
                  '14-30d': 'Strong — solid medium-term retention',
                  '30+d': 'Mature — deep long-term memory',
                }
                return (
                  <div
                    key={b.label}
                    onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#f5a623', marginBottom: 4 }}>{b.label} interval</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.count} card{b.count !== 1 ? 's' : ''}</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{meanings[b.label]}</div></div>)}
                    onMouseMove={amove}
                    onMouseLeave={ahide}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
                  >
                    <div className="text-xs text-muted">{b.count}</div>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (b.count / maxCount) * 50)}px`, background: 'var(--color-accent, #F5A623)', transition: 'height 0.3s', opacity: 0.85 }} />
                    <div className="text-xs text-muted">{b.label}</div>
                  </div>
                )
              })}
            </div>
            <div className="text-xs text-muted">Card stability distribution (FSRS)</div>
          </div>
        );
      })()}

      {/* ── #95 Quiz Score History by Subject ── */}
      {(() => {
        // Group quiz history by subject, show last 10 scores per subject as a mini bar chart
        const subjects = [...new Set(quizHistory.map((q: QuizAttempt) => q.subject || 'General').filter(Boolean))];
        if (subjects.length === 0) return null;
        return (
          <div className="card mt-4 mb-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Score History by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your last 10 quiz scores per subject shown as a mini bar chart. The arrow shows the trend from first to last quiz. Hover a subject row for average and trend details.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <TrendingUp size={14} style={{ color: 'var(--accent)' }} /> Score History by Subject
              </span>
            </div>
            <div style={{ padding: '0 4px' }}>
              {subjects.slice(0, 5).map((subject: string) => {
                const scores = quizHistory
                  .filter((q: QuizAttempt) => (q.subject || 'General') === subject)
                  .slice(-10)
                  .map((q: QuizAttempt) => q.score);
                if (scores.length < 2) return null;
                const avg = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
                const trend = scores[scores.length - 1] - scores[0];
                const trendColor = trend >= 0 ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)'
                return (
                  <div
                    key={subject}
                    onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>{subject}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>avg {avg}%</div><div style={{ fontSize: 11, color: trendColor, marginTop: 2 }}>{trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}% trend (first → last quiz)</div><div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{scores.length} quizzes in last 10</div></div>)}
                    onMouseMove={amove}
                    onMouseLeave={ahide}
                    style={{ marginBottom: 14, cursor: 'default' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{subject}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>avg {avg}%</span>
                        <span style={{ color: trendColor, fontWeight: 700 }}>
                          {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
                        </span>
                      </span>
                    </div>
                    {/* Mini bar chart */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 32 }}>
                      {scores.map((s: number, i: number) => (
                        <div
                          key={i}
                          onMouseEnter={e => { e.stopPropagation(); ashow(e, <div><div style={{ fontWeight: 700, color: s >= 80 ? 'var(--green, #22c55e)' : s >= 60 ? 'var(--accent)' : 'var(--red)', marginBottom: 4 }}>Quiz #{i + 1}</div><div style={{ fontSize: 13, fontWeight: 600 }}>{s}%</div></div>) }}
                          onMouseMove={amove}
                          onMouseLeave={ahide}
                          style={{
                            flex: 1, height: `${Math.max(s, 4)}%`, minHeight: 2,
                            background: s >= 80 ? 'var(--green, #22c55e)' : s >= 60 ? 'var(--accent, #6366f1)' : 'var(--red, #ef4444)',
                            borderRadius: '2px 2px 0 0', opacity: i === scores.length - 1 ? 1 : 0.6,
                            cursor: 'default',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* #92 Time-Per-Topic */}
      {(() => {
        const sessions = (data?.pluginData?.studySessions || []) as import('../types').StudySession[];
        const topicMap = new Map<string, number>();
        sessions.forEach(s => {
          if (s.topicId) {
            topicMap.set(s.topicId, (topicMap.get(s.topicId) || 0) + s.durationMs);
          }
        });
        if (topicMap.size === 0) return null;
        const top = Array.from(topicMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([id, ms]) => ({ id, min: Math.round(ms / 60000) }));
        const maxMin = Math.max(...top.map(t => t.min), 1);
        return (
          <div className="card mt-4">
            <div className="card-header">
              <span
                className="card-title"
                style={{ cursor: 'default' }}
                onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>Time Per Topic</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total study session minutes logged per topic (top 6). Tracked from active Learn mode sessions. Hover a bar for the topic name and exact time.</div></div>)}
                onMouseMove={amove}
                onMouseLeave={ahide}
              >
                <Clock size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Time Per Topic
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 4 }}>
              {top.map(t => (
                <div
                  key={t.id}
                  onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{t.id}</div><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.min} min studied</div></div>)}
                  onMouseMove={amove}
                  onMouseLeave={ahide}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'default' }}
                >
                  <div className="text-xs text-muted">{t.min}m</div>
                  <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(4, (t.min / maxMin) * 50)}px`, background: 'var(--blue)', transition: 'height 0.3s' }} />
                  <div className="text-xs text-muted" style={{ fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{t.id.slice(-10)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Weekly Accuracy Line Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const now = new Date();
        const weeklyAccuracy: { label: string; accuracy: number }[] = [];
        for (let w = 7; w >= 0; w--) {
          const weekStart = new Date(now);
          weekStart.setDate(weekStart.getDate() - w * 7);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 7);
          const label = `W${8 - w}`;
          const weekQuizzes = quizHistory.filter(q => {
            const qd = new Date(q.date);
            return qd >= weekStart && qd < weekEnd;
          });
          const accuracy = weekQuizzes.length > 0
            ? Math.round(weekQuizzes.reduce((acc, q) => acc + q.score, 0) / weekQuizzes.length)
            : 0;
          weeklyAccuracy.push({ label, accuracy });
        }
        const hasData = weeklyAccuracy.some(w => w.accuracy > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>Quiz Accuracy (Last 8 Weeks)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average quiz score per week over the last 8 weeks. Hover data points on the chart for exact weekly averages.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Quiz Accuracy (Last 8 Weeks)
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {hasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weeklyAccuracy}>
                    <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0}%`, 'Accuracy']} />
                    <Line type="monotone" dataKey="accuracy" stroke="#60a5fa" strokeWidth={2} dot={{ fill: '#60a5fa', r: 3 }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Daily Study Minutes Bar Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const now = new Date();
        interface DailyEntry { label: string; minutes: number; _key: string }
        const dailyMinutes: DailyEntry[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const _key = d.toISOString().split('T')[0];
          const label = dayNames[d.getDay()];
          dailyMinutes.push({ label, minutes: 0, _key });
        }
        // Try to sum minutes from coachData sessions
        const rawSessions = (data?.pluginData?.coachData?.sessions ?? []) as Record<string, unknown>[];
        if (rawSessions.length > 0) {
          rawSessions.forEach(s => {
            const sDate = typeof s.date === 'string' ? s.date.split('T')[0] : '';
            const mins = typeof s.minutes === 'number' ? s.minutes : typeof s.duration === 'number' ? s.duration : 0;
            const entry = dailyMinutes.find(e => e._key === sDate);
            if (entry) entry.minutes += mins;
          });
        }
        const hasData = dailyMinutes.some(d => d.minutes > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>Study Minutes (Last 14 Days)</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total study session minutes logged per day from coach/timer sessions. Hover bars for exact daily totals.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Study Minutes (Last 14 Days)
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {hasData ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyMinutes}>
                    <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0} min`, 'Study Time']} />
                    <Bar dataKey="minutes" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Card Maturity Pie Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const cards = srData?.cards ?? [];
        const maturityColors: Record<string, string> = {
          new: '#60a5fa',
          learning: '#fbbf24',
          review: '#4ade80',
          mature: '#a78bfa',
          relearning: '#fbbf24',
        };
        const maturityCounts: Record<string, number> = { new: 0, learning: 0, review: 0, mature: 0 };
        cards.forEach(c => {
          const s = (c.state || 'new').toLowerCase();
          if (s === 'new') maturityCounts.new++;
          else if (s === 'learning' || s === 'relearning') maturityCounts.learning++;
          else if (s === 'review') maturityCounts.review++;
          else maturityCounts.mature++;
        });
        const pieData = [
          { name: 'New', value: maturityCounts.new, color: maturityColors.new },
          { name: 'Learning', value: maturityCounts.learning, color: maturityColors.learning },
          { name: 'Review', value: maturityCounts.review, color: maturityColors.review },
          { name: 'Mature', value: maturityCounts.mature, color: maturityColors.mature },
        ].filter(d => d.value > 0);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#a78bfa', marginBottom: 4 }}>Card Maturity Distribution</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Your flashcards by FSRS learning state. New = never studied, Learning = short intervals, Review = graduated, Mature = interval ≥21 days. More mature cards = stronger long-term memory.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Card Maturity Distribution
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={35}>
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(v, name) => [`${v ?? 0} cards`, String(name ?? '')]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', marginTop: 8 }}>
                    {pieData.map(d => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#bbb' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                        <span>{d.name}: {d.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Recharts: Per-Subject Accuracy Bar Chart ── */}
      {(() => {
        const chartTooltipStyle = { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: '8px', color: '#e8e8e8' };
        const subjectMap = new Map<string, number[]>();
        quizHistory.forEach(q => {
          const subj = (q.subject || 'General').slice(0, 12);
          if (!subjectMap.has(subj)) subjectMap.set(subj, []);
          subjectMap.get(subj)!.push(q.score);
        });
        const subjectAccuracy = Array.from(subjectMap.entries()).map(([subject, scores]) => ({
          subject,
          accuracy: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        })).sort((a, b) => b.accuracy - a.accuracy);
        return (
          <div style={{ marginBottom: '24px' }}>
            <h3
              style={{ fontSize: '0.95rem', fontWeight: 600, color: '#e8e8e8', marginBottom: '12px', cursor: 'default', display: 'inline-block' }}
              onMouseEnter={e => ashow(e, <div><div style={{ fontWeight: 700, color: '#4ade80', marginBottom: 4 }}>Accuracy by Subject</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Average quiz score per subject across all quizzes taken. Hover bars for exact percentages.</div></div>)}
              onMouseMove={amove}
              onMouseLeave={ahide}
            >
              Accuracy by Subject
            </h3>
            <div style={{ background: '#161616', borderRadius: '12px', padding: '16px' }}>
              {subjectAccuracy.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={subjectAccuracy} layout="vertical">
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="subject" width={90} tick={{ fill: '#bbb', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(v) => [`${v ?? 0}%`, 'Accuracy']} />
                    <Bar dataKey="accuracy" fill="#4ade80" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13 }}>No data yet</div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  )
}

/* ================================================================
   PLAN TAB
   ================================================================ */
interface StudyBlock {
  id: string
  day: string
  course: string
  topic: string
  duration: number // minutes
  completed: boolean
}

function PlanTab() {
  const { courses, proficiency, srData, data } = useStore()

  const [blocks, setBlocks] = useState<StudyBlock[]>(() => {
    const saved = localStorage.getItem('nousai-study-plan')
    return saved ? JSON.parse(saved) : []
  })
  const [showAdd, setShowAdd] = useState(false)
  const [addDay, setAddDay] = useState('Mon')
  const [addCourse, setAddCourse] = useState('')
  const [addTopic, setAddTopic] = useState('')
  const [addDuration, setAddDuration] = useState(30)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  async function generateAIPlan() {
    if (courses.length === 0) return
    setAiGenerating(true)
    setAiError(null)
    try {
      const { getCourseSpace } = await import('../utils/courseSpaceInit')
      const { getDeckHealthByCourse } = await import('../utils/fsrsStorage')
      const courseSpaces = data?.pluginData?.courseSpaces ?? undefined

      const inputs: StudyPlanInput[] = courses.map(course => {
        const space = getCourseSpace(courseSpaces, course.id)
        // Find nearest exam date for this course
        const examEvents = space.calendarEvents.filter(e => e.type === 'exam').sort((a, b) => a.date.localeCompare(b.date))
        const nextExam = examEvents.find(e => {
          const [y, m, d] = e.date.split('-').map(Number)
          return new Date(y, m - 1, d).getTime() >= Date.now()
        })
        // Collect weak topics from srData
        const courseCards = (srData?.cards ?? []).filter(c => c.subject === course.id)
        const weakTopics: string[] = []
        const seen = new Set<string>()
        for (const card of courseCards) {
          if (!card.S || card.S <= 0 || seen.has(card.subtopic)) continue
          const daysSince = (Date.now() - new Date(card.lastReview).getTime()) / 86400000
          const R = Math.exp(-daysSince / card.S)
          if (R < 0.75 && !seen.has(card.subtopic)) {
            weakTopics.push(card.subtopic)
            seen.add(card.subtopic)
          }
        }
        const weakCardCount = courseCards.filter(c => {
          if (!c.S || c.S <= 0) return false
          const daysSince = (Date.now() - new Date(c.lastReview).getTime()) / 86400000
          return Math.exp(-daysSince / c.S) < 0.75
        }).length
        void getDeckHealthByCourse // imported for side-effect check only
        return {
          courseId: course.id,
          courseName: course.name,
          examDate: nextExam?.date ?? null,
          weakCardCount,
          weakTopics,
          calendarEvents: space.calendarEvents,
        }
      })

      const result = await generateFSRSAwarePlan(inputs, 3)

      // Convert AI date-based blocks → day-name blocks (for existing weekly grid)
      const newBlocks: StudyBlock[] = result.days.flatMap(day => {
        const [y, m, d] = day.date.split('-').map(Number)
        const dayName = new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
        return day.blocks.map(b => ({
          id: `ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          day: dayName,
          course: b.courseName,
          topic: b.topic,
          duration: b.durationMin,
          completed: false,
        }))
      })

      saveBlocks([...blocks, ...newBlocks])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'OFFLINE') setAiError('You\'re offline — AI plan generation requires an internet connection.')
      else if (msg === 'TIMEOUT') setAiError('Request timed out. Check your connection and try again.')
      else setAiError('AI plan generation failed. Check your AI API key in Settings.')
    } finally {
      setAiGenerating(false)
    }
  }

  function saveBlocks(newBlocks: StudyBlock[]) {
    setBlocks(newBlocks)
    localStorage.setItem('nousai-study-plan', JSON.stringify(newBlocks))
  }

  function addBlock() {
    if (!addCourse) return
    const newBlock: StudyBlock = {
      id: Date.now().toString(),
      day: addDay,
      course: addCourse,
      topic: addTopic,
      duration: addDuration,
      completed: false
    }
    saveBlocks([...blocks, newBlock])
    setShowAdd(false)
    setAddTopic('')
    setAddDuration(30)
  }

  function toggleComplete(id: string) {
    saveBlocks(blocks.map(b => b.id === id ? { ...b, completed: !b.completed } : b))
  }

  function removeBlock(id: string) {
    saveBlocks(blocks.filter(b => b.id !== id))
  }

  // Auto-suggest: weak topics that need attention
  const suggestions = useMemo(() => {
    if (!proficiency?.subjects) return []
    const weak: { subject: string; topic: string; score: number }[] = []
    Object.entries(proficiency.subjects).forEach(([subject, topics]) => {
      Object.entries(topics).forEach(([topic, entry]) => {
        const e = entry as ProficiencyEntry
        if (!e.isProficient && e.attempts.length > 0) {
          weak.push({ subject, topic, score: e.proficiencyScore })
        }
      })
    })
    return weak.sort((a, b) => a.score - b.score).slice(0, 3)
  }, [proficiency])

  // Today's focus
  const todayName = new Date().toLocaleDateString('en-US', { weekday: 'short' })
  const todayBlocks = blocks.filter(b => b.day === todayName)

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  return (
    <div>
      {/* Today's focus */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Star size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Today's Focus ({todayName})</span>
          <span className="badge badge-blue">{todayBlocks.length} blocks</span>
        </div>
        {todayBlocks.length === 0 ? (
          <p className="text-sm text-muted">No study blocks scheduled for today.</p>
        ) : (
          todayBlocks.map(b => (
            <div key={b.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: '1px solid var(--border)', opacity: b.completed ? 0.5 : 1
            }}>
              <button onClick={() => toggleComplete(b.id)} style={{
                width: 20, height: 20, borderRadius: 4, border: '2px solid var(--border)',
                background: b.completed ? 'var(--green)' : 'transparent', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0
              }}>
                {b.completed && <Check size={12} style={{ color: 'white' }} />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, textDecoration: b.completed ? 'line-through' : 'none' }}>{b.course}</div>
                {b.topic && <div className="text-xs text-muted">{b.topic}</div>}
              </div>
              <span className="text-xs text-muted">{b.duration}m</span>
            </div>
          ))
        )}
      </div>

      {/* Suggestions based on weak areas */}
      {suggestions.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title"><Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Suggested Focus Areas</span>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
              borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none'
            }}>
              <AlertTriangle size={14} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.topic}</div>
                <div className="text-xs text-muted">{s.subject} - {Math.max(0, Math.round(s.score))}% proficiency</div>
              </div>
              <button className="btn btn-sm btn-secondary" onClick={() => {
                setAddCourse(s.subject)
                setAddTopic(s.topic)
                setShowAdd(true)
              }}>
                <Plus size={12} /> Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI error banner */}
      {aiError && (
        <div style={{
          padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--radius-sm)',
          background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)',
          color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{aiError}</span>
          <button onClick={() => setAiError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', padding: 0 }} aria-label="Dismiss error">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Weekly schedule grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}><CalendarDays size={18} /> Weekly Schedule</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={generateAIPlan}
            disabled={aiGenerating || courses.length === 0}
            aria-label="Generate AI study plan"
          >
            {aiGenerating ? <><Sparkles size={14} /> Generating…</> : <><Sparkles size={14} /> AI Plan</>}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} /> Add Block
          </button>
        </div>
      </div>

      {/* Add block form */}
      {showAdd && (
        <div className="card mb-4" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Day</div>
              <select value={addDay} onChange={e => setAddDay(e.target.value)} style={inputStyle}>
                {days.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Duration (min)</div>
              <input type="number" value={addDuration} onChange={e => setAddDuration(+e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Course</div>
            <select value={addCourse} onChange={e => setAddCourse(e.target.value)} style={inputStyle}>
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.id} value={c.shortName || c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Topic (optional)</div>
            <input type="text" value={addTopic} onChange={e => setAddTopic(e.target.value)} placeholder="Topic or chapter..." style={inputStyle} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={addBlock}>Add to Plan</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Weekly grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {days.map(day => {
          const dayBlocks = blocks.filter(b => b.day === day)
          const isToday = day === todayName
          return (
            <div key={day} style={{
              background: isToday ? 'var(--accent-glow)' : 'var(--bg-card)',
              border: isToday ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: 8, minHeight: 120
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textAlign: 'center',
                color: isToday ? 'var(--accent-light)' : 'var(--text-muted)',
                marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5
              }}>{day}</div>
              {dayBlocks.map(b => (
                <div key={b.id} style={{
                  padding: '4px 6px', marginBottom: 4, borderRadius: 4,
                  background: b.completed ? 'var(--green-dim)' : 'var(--bg-primary)',
                  border: '1px solid var(--border)', fontSize: 10, cursor: 'pointer',
                  opacity: b.completed ? 0.6 : 1
                }} onClick={() => toggleComplete(b.id)} onContextMenu={e => { e.preventDefault(); removeBlock(b.id) }}>
                  <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.course}</div>
                  <div style={{ color: 'var(--text-muted)' }}>{b.duration}m</div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted" style={{ marginTop: 8 }}>Click to toggle complete. Right-click to remove.</p>
    </div>
  )
}

/* ================================================================
   ANIMATED MONOCHROME BANNER
   ================================================================ */
function MonochromeBanner() {
  const { courses, events, data } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef(0);
  const mouseRef = useRef({ x: -999, y: -999, active: false });
  const ripplesRef = useRef<{ x: number; y: number; r: number; maxR: number; alpha: number }[]>([]);
  const [hoveredDesc, setHoveredDesc] = useState<string | null>(null);
  // 'random' rotates each visit, or user picks a specific course id
  const [courseMode, setCourseMode] = useState<'random' | string>('random');

  // Resolve which course to show
  const activeCourse = useMemo(() => {
    if (courses.length === 0) return null;
    let course: typeof courses[number];
    if (courseMode === 'random') {
      course = courses[Math.floor(Math.random() * courses.length)];
    } else {
      course = courses.find(c => c.id === courseMode) || courses[0];
    }
    // Check if this course has an upcoming exam
    const now = Date.now();
    const schedules = (data?.pluginData?.studySchedules || []) as { courseName: string; examDate: string }[];
    const assignments = (data?.pluginData?.assignments || []) as { courseId: string; dueDate: string; completed?: boolean }[];
    let nearestMs = Infinity;
    for (const s of schedules) {
      if (s.courseName === course.name || s.courseName === course.shortName) {
        const ms = new Date(s.examDate).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    for (const a of assignments) {
      if (a.courseId === course.id && !a.completed) {
        const ms = new Date(a.dueDate).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    for (const ev of events) {
      const title = ev.title.toLowerCase();
      if ((title.includes('exam') || title.includes('test') || title.includes('midterm') || title.includes('final'))
        && (title.includes(course.shortName.toLowerCase()) || title.includes(course.name.toLowerCase()))) {
        const ms = new Date(ev.start).getTime() - now;
        if (ms > 0 && ms < nearestMs) nearestMs = ms;
      }
    }
    const daysUntilExam = nearestMs < Infinity ? Math.ceil(nearestMs / 86400000) : null;
    return { course, daysUntilExam };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, events, data, courseMode]);

  type MindNode = {
    x: number; y: number; vx: number; vy: number; r: number;
    label: string; desc: string; group: number; brightness: number;
    anchorX: number; anchorY: number;
    parentIdx: number; // correct parent node index (-1 for root)
    connectReason: string; // why this node connects to its parent
  };
  type Particle = {
    x: number; y: number; vx: number; vy: number; r: number;
    brightness: number; life: number; maxLife: number;
  };
  type Link = { a: number; b: number; strength: number; targetStrength: number; broken: boolean };

  const nodesRef = useRef<MindNode[]>([]);
  const linksRef = useRef<Link[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const selectedRef = useRef(-1); // index of currently "grabbed" node
  const [flickerMsg, setFlickerMsg] = useState<{ text: string; type: 'break' | 'fail' | 'success' } | null>(null);
  const flickerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showFlicker = useCallback((text: string, type: 'break' | 'fail' | 'success') => {
    if (flickerTimer.current) clearTimeout(flickerTimer.current);
    setFlickerMsg({ text, type });
    flickerTimer.current = setTimeout(() => setFlickerMsg(null), type === 'success' ? 3000 : 2200);
  }, []);

  const init = useCallback((w: number, h: number) => {
    const nodes: MindNode[] = [];
    const links: Link[] = [];

    if (!activeCourse) {
      nodes.push({
        x: w / 2, y: h / 2, vx: 0, vy: 0, r: 7,
        label: 'No courses', desc: 'Add a course to get started',
        group: 0, brightness: 0.7, anchorX: w / 2, anchorY: h / 2,
        parentIdx: -1, connectReason: '',
      });
    } else {
      const c = activeCourse.course;
      const daysLeft = activeCourse.daysUntilExam;
      const examUrgency = daysLeft !== null ? Math.max(0.3, 1 - daysLeft / 30) : 0.4;

      // Build all content nodes spread across the banner
      type ItemDef = { label: string; desc: string; group: number; size: number; parentGroup: number; reason: string };
      const items: ItemDef[] = [];

      // Course center node (group 0)
      const examInfo = daysLeft !== null ? ` — Exam in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}` : '';
      const topics = c.topics || [];
      const flashcards = c.flashcards || [];
      items.push({
        label: c.shortName,
        desc: `${c.name}${examInfo} · ${topics.length} topics, ${flashcards.length} cards`,
        group: 0, size: 7, parentGroup: -1, reason: '',
      });

      // Topic nodes (group 1) — random subset each load for variety
      const shuffledTopics = [...topics].sort(() => Math.random() - 0.5);
      const pickedTopics = shuffledTopics.slice(0, Math.min(5, shuffledTopics.length));
      for (const t of pickedTopics) {
        const subs = t.subtopics?.slice(0, 4).map(s => s.name) || [];
        const cleanName = t.name.replace(/^\/\/\s*/, '');
        const tLabel = cleanName.length > 14 ? cleanName.slice(0, 12) + '..' : cleanName;
        // Condensed description: subtopics as key points
        const keyPoints = subs.length > 0
          ? subs.join(' · ')
          : `Core topic in ${c.shortName}`;
        items.push({
          label: tLabel, desc: keyPoints, group: 1, size: 4.5,
          parentGroup: 0,
          reason: `${tLabel} is a core topic in ${c.shortName}`,
        });
      }

      // Flashcard key terms (group 2) — extract actual subject terms, not question stubs
      const extractTerm = (front: string): string => {
        // Strip common question prefixes to get the actual term
        let t = front
          .replace(/^(what|who|where|when|why|how|which|describe|define|explain|list|name|state|identify|compare|contrast)\s+(is|are|does|do|was|were|the|a|an)\s+/i, '')
          .replace(/^(what|who|where|when|why|how|which|describe|define|explain|list|name|state|identify)\s+/i, '')
          .replace(/[?.!]+$/, '')
          .trim();
        // If still starts with "the/a/an", strip it
        t = t.replace(/^(the|a|an)\s+/i, '').trim();
        // Take meaningful portion (up to ~20 chars, break at word boundary)
        if (t.length > 20) {
          const cut = t.lastIndexOf(' ', 18);
          t = t.slice(0, cut > 8 ? cut : 18) + '..';
        }
        // Capitalize first letter
        return t.charAt(0).toUpperCase() + t.slice(1);
      };

      const cards = [...flashcards].sort(() => Math.random() - 0.5).slice(0, Math.min(6, flashcards.length));
      for (const card of cards) {
        const term = extractTerm(card.front);
        if (term.length < 2) continue;
        const desc = card.back;
        items.push({
          label: term, desc, group: 2, size: 3.5,
          parentGroup: 1,
          reason: `Key concept: ${term}`,
        });
      }

      // Subtopic terms as leaf nodes (group 3) — from the selected topics only
      const allSubs: { name: string; parent: string }[] = [];
      for (const t of pickedTopics) {
        for (const s of (t.subtopics || [])) {
          allSubs.push({ name: s.name, parent: t.name });
        }
      }
      const pickedSubs = allSubs.sort(() => Math.random() - 0.5).slice(0, Math.min(3, allSubs.length));
      for (const s of pickedSubs) {
        const label = s.name.length > 18 ? s.name.slice(0, 16) + '..' : s.name;
        items.push({
          label, desc: `Part of ${s.parent}`, group: 3, size: 3,
          parentGroup: 1,
          reason: `Subtopic under ${s.parent}`,
        });
      }

      // Place nodes spread across the FULL banner using force-relaxed positions
      const totalNodes = items.length;
      const padX = 35, padY = 18;
      // Generate well-distributed anchor positions using Halton-like sequence
      const anchors: { x: number; y: number }[] = [];
      // Center node goes to true center
      anchors.push({ x: w * 0.5, y: h * 0.5 });
      // Spread remaining nodes using golden-angle distribution across full area
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 1; i < totalNodes; i++) {
        const t = i / totalNodes;
        const angle = i * goldenAngle;
        const radius = Math.sqrt(t) * Math.min(w * 0.45, h * 0.42);
        let ax = w * 0.5 + Math.cos(angle) * radius * (w / h) * 0.7;
        let ay = h * 0.5 + Math.sin(angle) * radius;
        ax = Math.max(padX, Math.min(w - padX, ax));
        ay = Math.max(padY, Math.min(h - padY, ay));
        anchors.push({ x: ax, y: ay });
      }
      // Relax positions: push overlapping nodes apart
      for (let pass = 0; pass < 8; pass++) {
        for (let i = 0; i < anchors.length; i++) {
          for (let j = i + 1; j < anchors.length; j++) {
            const dx = anchors[j].x - anchors[i].x;
            const dy = anchors[j].y - anchors[i].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const minDist = 55;
            if (d < minDist && d > 0) {
              const push = (minDist - d) / 2;
              anchors[i].x -= (dx / d) * push;
              anchors[i].y -= (dy / d) * push;
              anchors[j].x += (dx / d) * push;
              anchors[j].y += (dy / d) * push;
            }
          }
          anchors[i].x = Math.max(padX, Math.min(w - padX, anchors[i].x));
          anchors[i].y = Math.max(padY, Math.min(h - padY, anchors[i].y));
        }
      }

      for (let i = 0; i < totalNodes; i++) {
        const item = items[i];
        const ax = anchors[i].x;
        const ay = anchors[i].y;

        nodes.push({
          x: ax + (Math.random() - 0.5) * 8,
          y: ay + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.15,
          vy: (Math.random() - 0.5) * 0.12,
          r: item.size * (i === 0 ? 1 + examUrgency * 0.3 : 1),
          label: item.label, desc: item.desc,
          group: item.group,
          brightness: i === 0 ? 1 : (0.4 + Math.random() * 0.4),
          anchorX: ax, anchorY: ay,
          parentIdx: -1, // set below
          connectReason: item.reason,
        });
      }

      // Create links + assign parentIdx
      // Topics (group 1) -> center (0)
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].group === 1) {
          nodes[i].parentIdx = 0;
          links.push({ a: 0, b: i, strength: 1, targetStrength: 1, broken: false });
        }
      }
      // Flashcards/notes/assignments (group 2+) -> nearest topic node
      for (let i = 1; i < nodes.length; i++) {
        if (nodes[i].group >= 2) {
          let nearestTopic = -1, nearestDist = Infinity;
          for (let j = 1; j < nodes.length; j++) {
            if (nodes[j].group !== 1) continue;
            const dx = nodes[i].anchorX - nodes[j].anchorX;
            const dy = nodes[i].anchorY - nodes[j].anchorY;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < nearestDist) { nearestDist = d; nearestTopic = j; }
          }
          if (nearestTopic >= 0) {
            nodes[i].parentIdx = nearestTopic;
            links.push({ a: nearestTopic, b: i, strength: 0.8, targetStrength: 0.8, broken: false });
          }
        }
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    // Ambient particles
    const particles: Particle[] = [];
    const pCount = 20 + Math.floor(Math.random() * 10);
    for (let i = 0; i < pCount; i++) {
      particles.push({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.2,
        r: 1 + Math.random() * 1.2, brightness: 0.08 + Math.random() * 0.2,
        life: Math.random() * 200, maxLife: 250 + Math.random() * 300,
      });
    }
    particlesRef.current = particles;
  }, [activeCourse, data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    init(w, h);

    const getPos = (e: MouseEvent | TouchEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = 'touches' in e ? e.touches[0]?.clientX ?? -999 : e.clientX;
      const cy = 'touches' in e ? e.touches[0]?.clientY ?? -999 : e.clientY;
      return { x: cx - r.left, y: cy - r.top };
    };

    let hoveredIdx = -1;

    // Helper: distance from point to quadratic bezier curve segment
    const distToLink = (px: number, py: number, link: Link) => {
      const na = nodesRef.current[link.a], nb = nodesRef.current[link.b];
      if (!na || !nb) return Infinity;
      const dx = nb.x - na.x, dy = nb.y - na.y;
      const midX = (na.x + nb.x) / 2 + dy * 0.12;
      const midY = (na.y + nb.y) / 2 - dx * 0.12;
      // Sample 6 points along the curve
      let minD = Infinity;
      for (let t = 0; t <= 1; t += 0.17) {
        const cx = (1 - t) * (1 - t) * na.x + 2 * (1 - t) * t * midX + t * t * nb.x;
        const cy = (1 - t) * (1 - t) * na.y + 2 * (1 - t) * t * midY + t * t * nb.y;
        const d = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (d < minD) minD = d;
      }
      return minD;
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e);
      mouseRef.current = { ...pos, active: true };
      hoveredIdx = -1;
      for (let i = 0; i < nodesRef.current.length; i++) {
        const node = nodesRef.current[i];
        const dx = pos.x - node.x, dy = pos.y - node.y;
        if (Math.sqrt(dx * dx + dy * dy) < 24) {
          setHoveredDesc(node.desc);
          hoveredIdx = i;
          break;
        }
      }
      if (hoveredIdx < 0) setHoveredDesc(null);

      // Subtle link proximity effects (non-broken links only)
      for (const link of linksRef.current) {
        if (link.broken) continue;
        const na = nodesRef.current[link.a], nb = nodesRef.current[link.b];
        if (!na || !nb) continue;
        const dma = Math.sqrt((pos.x - na.x) ** 2 + (pos.y - na.y) ** 2);
        const dmb = Math.sqrt((pos.x - nb.x) ** 2 + (pos.y - nb.y) ** 2);
        link.targetStrength = (dma < 60 || dmb < 60) ? 1 : 0.6;
      }
    };
    const onLeave = () => {
      mouseRef.current.active = false;
      hoveredIdx = -1;
      setHoveredDesc(null);
      for (const link of linksRef.current) {
        if (!link.broken) link.targetStrength = 0.8;
      }
    };
    const onClick = (e: MouseEvent | TouchEvent) => {
      const pos = getPos(e);
      ripplesRef.current.push({ x: pos.x, y: pos.y, r: 0, maxR: 100, alpha: 0.4 });

      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Determine which nodes are free
      const freeSet = new Set<number>();
      for (const link of links) { if (link.broken) freeSet.add(link.b); }

      // Find if clicking on a node
      let clickedNodeIdx = -1;
      for (let i = 0; i < nodes.length; i++) {
        const dx = pos.x - nodes[i].x, dy = pos.y - nodes[i].y;
        if (Math.sqrt(dx * dx + dy * dy) < 22) { clickedNodeIdx = i; break; }
      }

      const held = selectedRef.current;

      // If we have a held free node and clicked a target node → try to connect
      if (held >= 0 && clickedNodeIdx >= 0 && clickedNodeIdx !== held) {
        const freeNode = nodes[held];
        const target = nodes[clickedNodeIdx];
        const link = links.find(l => l.broken && l.b === held);

        if (link && clickedNodeIdx === freeNode.parentIdx) {
          // CORRECT — reconnect!
          link.broken = false;
          link.targetStrength = 1;
          link.strength = 0.1;
          freeNode.vx *= 0.1;
          freeNode.vy *= 0.1;
          selectedRef.current = -1;
          showFlicker(`Connected! ${freeNode.connectReason}`, 'success');
        } else {
          // WRONG — reject with reason
          const groupNames: Record<number, string> = { 0: 'course', 1: 'topic', 2: 'term', 3: 'subtopic' };
          const fType = groupNames[freeNode.group] || 'item';
          if (freeNode.group === target.group) {
            showFlicker(`Can't connect: "${freeNode.label}" and "${target.label}" are both ${fType}s`, 'fail');
          } else if (target.group === 0 && freeNode.group > 1) {
            showFlicker(`Can't connect directly to ${target.label} — find the right topic`, 'fail');
          } else {
            showFlicker(`Can't connect: "${freeNode.label}" doesn't belong under "${target.label}"`, 'fail');
          }
          // Push away
          const dx = freeNode.x - target.x, dy = freeNode.y - target.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 1;
          freeNode.vx += (dx / d) * 1.2;
          freeNode.vy += (dy / d) * 0.8;
        }
        return;
      }

      // If clicking on a free node → pick it up (select it)
      if (clickedNodeIdx >= 0 && freeSet.has(clickedNodeIdx)) {
        selectedRef.current = clickedNodeIdx;
        showFlicker(`Holding "${nodes[clickedNodeIdx].label}" — click a node to connect`, 'break');
        return;
      }

      // If holding and clicked empty space → drop / deselect
      if (held >= 0) {
        selectedRef.current = -1;
        showFlicker(`Dropped "${nodes[held].label}"`, 'break');
        return;
      }

      // Check if clicking on a link line → break it
      for (const link of links) {
        if (link.broken) continue;
        const d = distToLink(pos.x, pos.y, link);
        if (d < 12) {
          link.broken = true;
          link.targetStrength = 0;
          const freeNode = nodes[link.b];
          if (freeNode) {
            freeNode.vx = (Math.random() - 0.5) * 1.5;
            freeNode.vy = (Math.random() - 0.5) * 1;
            showFlicker(`Disconnected: "${freeNode.label}" — click it to pick up`, 'break');
          }
          return;
        }
      }

      // Otherwise, ripple burst
      for (const n of nodes) {
        const dx = n.x - pos.x, dy = n.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          n.vx += (dx / dist) * (1 - dist / 80) * 1.2;
          n.vy += (dy / dist) * (1 - dist / 80) * 1.2;
        }
      }
    };

    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('touchmove', onMove, { passive: true });
    canvas.addEventListener('mouseleave', onLeave);
    canvas.addEventListener('touchend', onLeave);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onClick, { passive: true });

    // Auto-disconnect: after 2s, randomly break links one by one so user must reconnect
    const breakTimers: ReturnType<typeof setTimeout>[] = [];
    const allLinks = linksRef.current;
    if (allLinks.length > 0) {
      // Shuffle link indices for random break order
      const indices = allLinks.map((_, i) => i).sort(() => Math.random() - 0.5);
      indices.forEach((li, order) => {
        const delay = 2000 + order * 800; // start at 2s, stagger 0.8s apart
        breakTimers.push(setTimeout(() => {
          const link = allLinks[li];
          if (!link || link.broken) return;
          link.broken = true;
          link.targetStrength = 0;
          const freeNode = nodesRef.current[link.b];
          if (freeNode) {
            freeNode.vx = (Math.random() - 0.5) * 1.2;
            freeNode.vy = (Math.random() - 0.5) * 0.8;
          }
          showFlicker(`"${freeNode?.label || '?'}" disconnected — reconnect it!`, 'break');
        }, delay));
      });
    }

    const draw = () => {
      ctx.fillStyle = 'rgba(10, 10, 14, 0.2)';
      ctx.fillRect(0, 0, w, h);

      const nodes = nodesRef.current;
      const links = linksRef.current;
      const pts = particlesRef.current;
      const mouse = mouseRef.current;

      // Ripples
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const rip = ripplesRef.current[i];
        rip.r += 2;
        rip.alpha *= 0.95;
        if (rip.alpha < 0.01 || rip.r > rip.maxR) { ripplesRef.current.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${rip.alpha})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Animate link strengths (smooth breaking/forming)
      for (const link of links) {
        link.strength += (link.targetStrength - link.strength) * 0.04;
      }

      // Draw links as curved branches
      for (let li = 0; li < links.length; li++) {
        const link = links[li];
        const na = nodes[link.a], nb = nodes[link.b];
        if (!na || !nb || link.strength < 0.02) continue;

        const dx = nb.x - na.x, dy = nb.y - na.y;
        const midX = (na.x + nb.x) / 2 + dy * 0.12;
        const midY = (na.y + nb.y) / 2 - dx * 0.12;

        const isHovered = hoveredIdx === link.a || hoveredIdx === link.b;
        const alpha = link.strength * (isHovered ? 0.55 : 0.18);

        // Branch line
        ctx.beginPath();
        ctx.moveTo(na.x, na.y);
        ctx.quadraticCurveTo(midX, midY, nb.x, nb.y);
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.lineWidth = isHovered ? 1.6 : (link.strength > 0.5 ? 0.9 : 0.4);

        // Breaking effect: dashed when weak
        if (link.strength < 0.4) {
          const gap = Math.round((1 - link.strength / 0.4) * 6) + 2;
          ctx.setLineDash([3, gap]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Traveling dot (only on strong links)
        if (link.strength > 0.3) {
          const t = ((Date.now() / 3000 + li * 0.5) % 1);
          const dotX = (1 - t) * (1 - t) * na.x + 2 * (1 - t) * t * midX + t * t * nb.x;
          const dotY = (1 - t) * (1 - t) * na.y + 2 * (1 - t) * t * midY + t * t * nb.y;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${link.strength * (isHovered ? 0.5 : 0.12)})`;
          ctx.fill();
        }
      }

      // Mouse glow + lines to nearby particles
      if (mouse.active) {
        for (const p of pts) {
          const d = Math.sqrt((p.x - mouse.x) ** 2 + (p.y - mouse.y) ** 2);
          if (d < 70) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 70) * 0.1})`;
            ctx.lineWidth = 0.4;
            ctx.beginPath();
            ctx.moveTo(mouse.x, mouse.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
          }
        }
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 45);
        grad.addColorStop(0, 'rgba(255,255,255,0.05)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 45, 0, Math.PI * 2);
        ctx.fill();
      }

      // Particle-to-particle faint connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const d = Math.sqrt((pts[i].x - pts[j].x) ** 2 + (pts[i].y - pts[j].y) ** 2);
          if (d < 60) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / 60) * 0.06})`;
            ctx.lineWidth = 0.3;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }

      // Determine which nodes are free (their link is broken)
      const freeSet = new Set<number>();
      for (const link of links) {
        if (link.broken) freeSet.add(link.b);
      }

      // Draw & update nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const isFree = freeSet.has(i);
        const isHeld = selectedRef.current === i;

        if (isHeld && mouse.active) {
          // Held node follows cursor smoothly
          node.vx += (mouse.x - node.x) * 0.08;
          node.vy += (mouse.y - node.y) * 0.08;
          node.vx *= 0.7;
          node.vy *= 0.7;
        } else if (isFree) {
          // Free nodes drift randomly, bounce off walls
          node.vx += (Math.random() - 0.5) * 0.04;
          node.vy += (Math.random() - 0.5) * 0.03;
          if (node.x < 20 || node.x > w - 20) node.vx *= -0.8;
          if (node.y < 12 || node.y > h - 12) node.vy *= -0.8;
          node.vx *= 0.99;
          node.vy *= 0.99;
        } else {
          // Connected nodes spring toward anchor
          node.vx += (node.anchorX - node.x) * 0.003;
          node.vy += (node.anchorY - node.y) * 0.003;
          node.vx *= 0.96;
          node.vy *= 0.96;
        }
        // Mouse interaction
        if (mouse.active) {
          const dmx = mouse.x - node.x, dmy = mouse.y - node.y;
          const mDist = Math.sqrt(dmx * dmx + dmy * dmy);
          if (mDist < 70 && mDist > 5) {
            node.vx += (dmx / mDist) * 0.015;
            node.vy += (dmy / mDist) * 0.015;
          }
        }
        if (i === 0) {
          node.anchorX += Math.sin(Date.now() / 5000) * 0.02;
          node.anchorY += Math.cos(Date.now() / 4500) * 0.015;
        }
        node.x += node.vx;
        node.y += node.vy;
        // Keep in bounds
        node.x = Math.max(10, Math.min(w - 10, node.x));
        node.y = Math.max(10, Math.min(h - 10, node.y));

        const hovered = i === hoveredIdx;
        const nodeR = hovered ? node.r * 1.4 : node.r;
        const pulseR = i === 0 ? nodeR + Math.sin(Date.now() / 900) * 1.2 : nodeR;

        // Held node: bright outline following cursor
        if (isHeld) {
          const heldAlpha = 0.4 + Math.sin(Date.now() / 200) * 0.2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR + 8, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(100,200,255,${heldAlpha})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        // Free node: pulsing outline to indicate it's disconnected
        if (isFree && !isHeld) {
          const pulseAlpha = 0.15 + Math.sin(Date.now() / 300) * 0.12;
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeR + 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,100,100,${pulseAlpha})`;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Glow
        const glowR = hovered ? 28 : (i === 0 ? 20 : (isFree ? 16 : 12));
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR);
        const glowBase = isFree ? 'rgba(255,120,120,' : 'rgba(255,255,255,';
        glow.addColorStop(0, `${glowBase}${hovered ? 0.16 : (i === 0 ? 0.08 : 0.04)})`);
        glow.addColorStop(1, `${glowBase}0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, pulseR, 0, Math.PI * 2);
        const nb = Math.round(255 * node.brightness);
        ctx.fillStyle = isHeld
          ? `rgba(${Math.round(nb * 0.5)},${Math.round(nb * 0.8)},${nb},1)`
          : isFree
            ? `rgba(${nb},${Math.round(nb * 0.5)},${Math.round(nb * 0.5)},${hovered ? 1 : 0.85})`
            : `rgba(${nb},${nb},${nb},${hovered ? 1 : 0.8})`;
        ctx.fill();
        if (hovered || i === 0 || isFree) {
          ctx.strokeStyle = isFree
            ? `rgba(255,100,100,${hovered ? 0.7 : 0.35})`
            : `rgba(255,255,255,${hovered ? 0.6 : 0.15})`;
          ctx.lineWidth = hovered ? 1.5 : 0.7;
          ctx.stroke();
        }

        // Label
        const fontSize = i === 0 ? 11 : (hovered ? 10 : 8);
        ctx.font = `${hovered || isFree ? 600 : 400} ${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = isFree
          ? `rgba(255,150,150,${hovered ? 0.9 : 0.5})`
          : `rgba(255,255,255,${i === 0 ? 0.8 : (hovered ? 0.85 : 0.28)})`;
        ctx.fillText(node.label, node.x, node.y + pulseR + 11);
        ctx.textAlign = 'start';
      }

      // Draw ambient particles
      for (const p of pts) {
        if (mouse.active) {
          const dmx = mouse.x - p.x, dmy = mouse.y - p.y;
          const mDist = Math.sqrt(dmx * dmx + dmy * dmy);
          if (mDist < 90 && mDist > 5) {
            p.vx += (dmx / mDist) * 0.006;
            p.vy += (dmy / mDist) * 0.006;
          }
        }
        p.vx *= 0.997;
        p.vy *= 0.997;
        p.x += p.vx;
        p.y += p.vy;
        p.life++;
        if (p.x < -5) p.x = w + 5;
        if (p.x > w + 5) p.x = -5;
        if (p.y < -5) p.y = h + 5;
        if (p.y > h + 5) p.y = -5;

        const lr = p.life / p.maxLife;
        const fade = lr < 0.1 ? lr / 0.1 : lr > 0.9 ? (1 - lr) / 0.1 : 1;
        if (p.life >= p.maxLife) {
          p.life = 0; p.maxLife = 250 + Math.random() * 300;
          p.x = Math.random() * w; p.y = Math.random() * h;
          p.brightness = 0.08 + Math.random() * 0.2;
          p.vx = (Math.random() - 0.5) * 0.3; p.vy = (Math.random() - 0.5) * 0.2;
        }
        const b = Math.round(255 * p.brightness);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${b},${b},${b},${fade * 0.5})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    };

    ctx.fillStyle = '#0a0a0e';
    ctx.fillRect(0, 0, w, h);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      breakTimers.forEach(t => clearTimeout(t));
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('touchmove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      canvas.removeEventListener('touchend', onLeave);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onClick);
    };
  }, [init]);

  const defaultText = activeCourse
    ? (activeCourse.daysUntilExam !== null
        ? `${activeCourse.course.shortName} — Exam in ${activeCourse.daysUntilExam} day${activeCourse.daysUntilExam !== 1 ? 's' : ''}`
        : `Exploring: ${activeCourse.course.shortName}`)
    : 'Add courses to see your mind map';

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Course selector chips */}
      {courses.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setCourseMode('random')}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: courseMode === 'random' ? 700 : 500,
              borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
              background: courseMode === 'random' ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: courseMode === 'random' ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', letterSpacing: 0.3,
            }}
          >Random</button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setCourseMode(c.id)}
              style={{
                padding: '3px 10px', fontSize: 10, fontWeight: courseMode === c.id ? 700 : 500,
                borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
                background: courseMode === c.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: courseMode === c.id ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >{c.shortName}</button>
          ))}
        </div>
      )}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 150,
          borderRadius: 'var(--radius)',
          display: 'block',
          cursor: 'crosshair',
        }}
      />
      {/* Flicker notification for break/connect events */}
      {flickerMsg && (
        <div
          key={flickerMsg.text}
          style={{
            padding: '5px 14px',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
            letterSpacing: 0.5,
            fontFamily: 'monospace',
            color: flickerMsg.type === 'success' ? '#6f6' : flickerMsg.type === 'fail' ? '#f88' : '#fa0',
            animation: 'flicker 0.15s ease-in-out 3',
          }}
        >
          {flickerMsg.type === 'break' ? '! ' : flickerMsg.type === 'fail' ? 'x ' : '+ '}
          {flickerMsg.text}
        </div>
      )}
      {/* Description bar */}
      <div style={{
        minHeight: 20,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 500,
        color: hoveredDesc ? 'var(--text-primary)' : 'var(--text-muted)',
        opacity: hoveredDesc ? 1 : (flickerMsg ? 0.3 : 0.5),
        transition: 'opacity 0.25s, color 0.25s',
        textAlign: 'center',
        letterSpacing: 0.3,
      }}>
        {hoveredDesc || defaultText}
      </div>
    </div>
  );
}
