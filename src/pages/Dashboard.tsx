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
import GpaWidget from '../components/dashboard/GpaWidget'
import { generateFSRSAwarePlan } from '../utils/studyPlan'
import type { StudyPlanInput } from '../utils/studyPlan'
import { TooltipPopup, useTip } from '../components/Tooltip'
import AnalyticsTab from './dashboard/AnalyticsTab'
import PlanTab from './dashboard/PlanTab'
import MonochromeBanner from './dashboard/MonochromeBanner'

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

  const allBadgeDefs = useMemo(() => getAllBadgeDefs(), [])
  const earnedIds = new Set((gamification.badges ?? []).map(b => b.id))

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
  const dailyGoal = gamification.dailyGoal ?? { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 }
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

      {/* New-user welcome CTA — shown when no courses have been added yet */}
      {courses.length === 0 && (
        <div className="card mb-4" style={{ border: '1px solid rgba(245,166,35,0.35)', background: 'linear-gradient(135deg, rgba(245,166,35,0.08), rgba(245,166,35,0.03))', textAlign: 'center', padding: '24px 16px' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>Welcome to NousAI!</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, maxWidth: 320, margin: '0 auto 16px' }}>
            Start by adding a course — then create flashcards, take quizzes, and let AI power your study sessions.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => navigate('/library?tab=courses')}>
              <GraduationCap size={14} /> Add Your First Course
            </button>
            <button className="btn" onClick={() => navigate('/ai?tool=flashcardgen')}>
              <Sparkles size={14} /> Generate Flashcards with AI
            </button>
          </div>
        </div>
      )}

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

      {/* Watermark */}
      <div style={{ textAlign: 'right', marginTop: 24, paddingBottom: 8 }}>
        <span style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 0.5, opacity: 0.5 }}>
          studynous.com
        </span>
      </div>
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


