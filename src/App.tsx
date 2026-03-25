import { Routes, Route, NavLink, useLocation, useParams, Navigate, useNavigate } from 'react-router-dom'
import type { CourseSpace } from './types'
import { Suspense, Component, useEffect, useMemo, useRef, useState, type ReactNode, type ErrorInfo } from 'react'
import { Home, Trophy, BookOpen, Clock, Calendar, Settings, Upload, Brain, Sparkles, Library, Mic, RefreshCw, AlertTriangle, Search, PanelLeftClose, PanelLeftOpen, Keyboard, X, MoreHorizontal, Menu, Film } from 'lucide-react'
import { lazyWithRetry, markAppLoaded, isChunkLoadError, clearCachesAndReload } from './utils/lazyWithRetry'
import { useStore } from './store'
import { resetDailyIfNeeded, getLevel, getLevelProgress, getTitle } from './utils/gamification'
import { scheduleReviewCheck, scheduleAssignmentReminders } from './utils/notifications'
import Onboarding from './pages/Onboarding'
import NousLogo from './components/Logo'
import NousPanel from './components/NousPanel'
import OmniSearch from './components/OmniSearch'
import { useEscapePriority } from './hooks/useEscapePriority'
import SyncStatusBanner from './components/SyncStatusBanner'
import SyncStatusIndicator from './components/SyncStatusIndicator'
import {
  registerSaveCallback, subscribeToTranscribe, getTranscribeState,
} from './utils/transcribeStore'
import { getDueCount } from './utils/getDueCount'
import { initFsrsCache } from './utils/fsrsStorage'
import { detectDeviceProfile } from './utils/deviceDetection'
import { useAuthUser } from './hooks/useAuthUser'
import { streamDeckService, StreamDeckService } from './utils/streamDeckService'
import './App.css'

/* ── Error Boundary to prevent blank page crashes ──── */
interface EBProps { children: ReactNode }
interface EBState { hasError: boolean; error: Error | null }
class ErrorBoundary extends Component<EBProps, EBState> {
  constructor(props: EBProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[NousAI] Render error caught:', error, info.componentStack);
    // Auto-reload on chunk load failure (backup for lazyWithRetry)
    if (isChunkLoadError(error)) {
      const flag = sessionStorage.getItem('nousai-chunk-reload');
      if (!flag) {
        sessionStorage.setItem('nousai-chunk-reload', Date.now().toString());
        clearCachesAndReload();
      }
    }
  }
  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error!);
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '60vh', gap: 16, padding: 24, textAlign: 'center',
        }}>
          <AlertTriangle size={48} style={{ color: '#ef4444' }} />
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
            {isChunk ? 'App Updated' : 'Something went wrong'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 400 }}>
            {isChunk
              ? 'A new version was deployed. Click reload to get the latest version.'
              : (this.state.error?.message || 'An unexpected error occurred.')}
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                if (isChunk) {
                  clearCachesAndReload();
                } else {
                  this.setState({ hasError: false, error: null });
                }
              }}
            >
              <RefreshCw size={14} /> {isChunk ? 'Reload' : 'Try Again'}
            </button>
            {!isChunk && (
              <button
                className="btn"
                onClick={() => { window.location.hash = '#/'; window.location.reload(); }}
              >
                Go Home
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Lazy-loaded pages for code splitting ─────────── */
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'))
const StudyPage = lazyWithRetry(() => import('./pages/StudyPage'))
const Quizzes = lazyWithRetry(() => import('./pages/Quizzes'))
const Flashcards = lazyWithRetry(() => import('./pages/Flashcards'))
const Timer = lazyWithRetry(() => import('./pages/Timer'))
const CalendarPage = lazyWithRetry(() => import('./pages/CalendarPage'))
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'))
const ToolsPage = lazyWithRetry(() => import('./pages/ToolsPage'))
const LearnPage = lazyWithRetry(() => import('./pages/LearnPage'))
const UnifiedLearnPage = lazyWithRetry(() => import('./pages/UnifiedLearnPage'))
const SharedContentPage = lazyWithRetry(() => import('./pages/SharedContentPage'))
const LibraryPage = lazyWithRetry(() => import('./pages/LibraryPage'))
const CoursePage = lazyWithRetry(() => import('./pages/CoursePage'))
const VideosPage = lazyWithRetry(() => import('./pages/VideosPage'))


/* ── Navigation ───── */
// Mobile bottom nav — main 7 + "More" drawer for Timer/Calendar/Tools/Settings
const NAV = [
  { to: '/', icon: Home, label: 'HOME' },
  { to: '/quiz', icon: Trophy, label: 'QUIZ' },
  { to: '/learn', icon: BookOpen, label: 'LEARN' },
  { to: '/flashcards', icon: Brain, label: 'CARDS' },
  { to: '/library', icon: Library, label: 'LIBRARY' },
]
const MORE_NAV = [
  { to: '/videos', icon: Film, label: 'VIDEOS' },
  { to: '/timer', icon: Clock, label: 'TIMER' },
  { to: '/calendar', icon: Calendar, label: 'CALENDAR' },
  { to: '/settings', icon: Settings, label: 'SETTINGS' },
]

// Desktop sidebar
const SIDEBAR_NAV = [
  { to: '/', icon: Home, label: 'HOME' },
  { to: '/quiz', icon: Trophy, label: 'QUIZ' },
  { to: '/learn', icon: BookOpen, label: 'LEARN' },
  { to: '/library', icon: Library, label: 'LIBRARY' },
  { to: '/flashcards', icon: Brain, label: 'CARDS' },
  { to: '/videos', icon: Film, label: 'VIDEOS' },
  { to: '/timer', icon: Clock, label: 'TIMER' },
  { to: '/calendar', icon: Calendar, label: 'CALENDAR' },
  { to: '/settings', icon: Settings, label: 'SETTINGS' },
]

// #44 Preload Routes on Hover — eagerly fetch JS chunks on nav-link hover
const PRELOAD_MAP: Record<string, () => Promise<unknown>> = {
  '/': () => import('./pages/Dashboard'),
  '/quiz': () => import('./pages/Quizzes'),
  '/learn': () => import('./pages/UnifiedLearnPage'),
  '/library': () => import('./pages/LibraryPage'),
  '/flashcards': () => import('./pages/Flashcards'),
  '/timer': () => import('./pages/Timer'),
  '/calendar': () => import('./pages/CalendarPage'),
  '/settings': () => import('./pages/SettingsPage'),
}
function preloadRoute(to: string) {
  PRELOAD_MAP[to]?.()
}

// ─── Keyboard Shortcut Overlay (beta) ───────────────
const SHORTCUTS = [
  { keys: ['Ctrl', 'S'], description: 'Sync to Cloud' },
  { keys: ['Ctrl', '⇧', 'S'], description: 'Load from Cloud' },
  { keys: ['Ctrl', 'F'], description: 'Open search palette' },
  { keys: ['N'], description: 'New note' },
  { keys: ['Q'], description: 'Go to Quiz' },
  { keys: ['F'], description: 'Go to Flashcards' },
  { keys: ['?'], description: 'Show this overlay' },
]

function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: '24px 28px', minWidth: 320, maxWidth: 400,
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={18} style={{ color: 'var(--color-accent)' }} />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Keyboard Shortcuts</span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SHORTCUTS.map(s => (
            <div key={s.description} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{s.description}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                {s.keys.map(k => (
                  <kbd key={k} style={{
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    borderRadius: 4, padding: '2px 7px', fontSize: 12,
                    fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-primary)',
                    boxShadow: '0 1px 0 var(--border)',
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          Press <kbd style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' }}>Esc</kbd> to close
        </p>
      </div>
    </div>
  )
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <p style={{ animation: 'pulse 1.5s infinite', fontFamily: 'monospace' }}>Loading...</p>
    </div>
  )
}

function CourseRedirect() {
  const { id } = useParams();
  return <Navigate to={`/course?id=${id}`} replace />;
}

// ─── Floating Transcribe Indicator ───────────────────
function FloatingTranscribeIndicator() {
  const navigate = useNavigate()
  const [rec, setRec] = useState(() => getTranscribeState().isRecording)

  useEffect(() => {
    return subscribeToTranscribe(() => setRec(getTranscribeState().isRecording))
  }, [])

  if (!rec) return null

  return (
    <button
      onClick={() => navigate('/tools')}
      title="Recording in progress — tap to open Transcribe"
      aria-label="Recording in progress — tap to open Transcribe"
      style={{
        position: 'fixed',
        bottom: 80,
        right: 16,
        zIndex: 999,
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: '#0891b2',
        color: '#fff',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(8,145,178,0.55)',
        animation: 'pulse 1.5s infinite',
      }}
    >
      <Mic size={20} />
    </button>
  )
}

export default function App() {
  const { loaded, data, setData, srData, updatePluginData, syncStatus, lastSyncAt, remoteUpdateAvailable, loadRemoteData, dismissRemoteBanner, betaMode, backupNow, triggerSyncToCloud, triggerSyncFromCloud, courses, setEinkMode } = useStore()
  const { uid } = useAuthUser()
  const location = useLocation()
  const initRef = useRef(false)

  // Auto-connect Quick Keys silently on load (no popup — uses already-granted devices).
  useEffect(() => {
    streamDeckService.setUid(uid ?? null)
    if (uid && StreamDeckService.isSupported() && !streamDeckService.connected) {
      streamDeckService.autoConnect().catch(() => {})
    }
  }, [uid])
  const [omniSearchOpen, setOmniSearchOpen] = useState(false)
  const [shortcutOverlayOpen, setShortcutOverlayOpen] = useState(false)
  const [nousChatOpen, setNousChatOpen] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('nous-chat-window') || '{}'); return s.state && s.state !== 'hidden' } catch { return false }
  })
  const [focusMode, setFocusMode] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [storageWarning, setStorageWarning] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('nousai-sidebar-collapsed') === 'true' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('nousai-sidebar-collapsed', String(sidebarCollapsed)) } catch {}
  }, [sidebarCollapsed])
  useEscapePriority({
    modalOpen: omniSearchOpen || shortcutOverlayOpen,
    nousChatOpen,
    closeNousChat: () => setNousChatOpen(false),
  })

  const updateRef = useRef(updatePluginData)
  const dataRef = useRef(data)
  updateRef.current = updatePluginData
  dataRef.current = data

  // Register Transcribe autosave callback (runs once; always uses latest refs)
  useEffect(() => {
    registerSaveCallback(async (noteId, noteTitle, fullText) => {
      const notes: any[] = dataRef.current?.pluginData?.notes ?? []
      if (noteId) {
        const updated = notes.map((n: any) =>
          n.id === noteId ? { ...n, content: fullText, updatedAt: new Date().toISOString() } : n
        )
        updateRef.current({ notes: updated })
        return noteId
      }
      const id = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const newNote = {
        id,
        title: noteTitle ?? `Transcribe_${new Date().toLocaleDateString()}`,
        content: fullText,
        folder: 'AI Tools',
        tags: ['transcribe'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'ai-output' as const,
      }
      updateRef.current({ notes: [...notes, newNote] })
      return id
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-enable e-ink mode on Boox devices
  useEffect(() => {
    const profile = detectDeviceProfile();
    if (profile === 'boox') setEinkMode(true);
  }, [setEinkMode])

  // Mark app as successfully loaded (clears chunk-reload flag for future attempts)
  useEffect(() => { markAppLoaded(); }, [])

  // Migrate large localStorage keys to IndexedDB on first run
  useEffect(() => { initFsrsCache(); }, [])

  // #46 Online/Offline Sync — trigger backup when connection is restored
  useEffect(() => {
    const handleOnline = () => {
      backupNow()
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [backupNow])

  // Apply stored display preferences on mount
  useEffect(() => {
    const accent = localStorage.getItem('nousai-pref-accent')
    if (accent) document.documentElement.style.setProperty('--color-accent', accent)
    if (localStorage.getItem('nousai-pref-highcontrast') === 'true') document.documentElement.setAttribute('data-high-contrast', '')
    if (localStorage.getItem('nousai-pref-colorblind') === 'true') document.documentElement.setAttribute('data-colorblind', '')
    if (localStorage.getItem('nousai-pref-reducedmotion') === 'true') document.documentElement.setAttribute('data-reduced-motion', '')
    const fontSize = localStorage.getItem('nousai-pref-fontsize')
    if (fontSize) document.documentElement.style.setProperty('--font-size-base', fontSize)
    const fontFamily = localStorage.getItem('nousai-pref-fontfamily')
    if (fontFamily) {
      const fontMap: Record<string, string> = { inherit: 'inherit', serif: 'Georgia, serif', mono: 'ui-monospace, monospace', dyslexic: 'OpenDyslexic, sans-serif' }
      if (fontMap[fontFamily]) document.documentElement.style.setProperty('--font-family-body', fontMap[fontFamily])
      if (fontFamily === 'dyslexic' && !document.getElementById('dyslexic-font-link')) {
        const link = document.createElement('link')
        link.id = 'dyslexic-font-link'
        link.rel = 'stylesheet'
        link.href = 'https://fonts.cdnfonts.com/css/opendyslexic'
        document.head.appendChild(link)
      }
    }
    const density = localStorage.getItem('nousai-pref-density')
    if (density) document.documentElement.setAttribute('data-density', density)
  }, [])

  // Apply theme preset whenever it changes
  useEffect(() => {
    const preset = data?.settings?.themePreset as string | undefined
    const VALID = ['forest', 'ocean', 'dusk', 'amber']
    const html = document.documentElement
    // Remove all known preset data-theme values first
    VALID.forEach(p => { if (html.getAttribute('data-theme') === p) html.removeAttribute('data-theme') })
    if (preset && VALID.includes(preset)) {
      html.setAttribute('data-theme', preset)
    }
  }, [data?.settings?.themePreset])

  // #42 Image lazy loading
  useEffect(() => {
    function addLazy(el: Element) {
      if (el.tagName === 'IMG' && !(el as HTMLImageElement).loading) {
        (el as HTMLImageElement).loading = 'lazy'
      }
      el.querySelectorAll('img:not([loading])').forEach(img => { (img as HTMLImageElement).loading = 'lazy' })
    }
    addLazy(document.body)
    const obs = new MutationObserver(muts => {
      muts.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) addLazy(n as Element) }))
    })
    obs.observe(document.body, { childList: true, subtree: true })
    return () => obs.disconnect()
  }, [])

  // Cmd+F / Ctrl+F / Cmd+K / Ctrl+K — open Omni Search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'k')) {
        // Don't intercept when a native input has focus (let browser handle it)
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        setOmniSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Ctrl+S / Cmd+S — Sync to Cloud; Ctrl+Shift+S / Cmd+Shift+S — Load from Cloud
  const [syncToast, setSyncToast] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        if (e.shiftKey) triggerSyncFromCloud()
        else triggerSyncToCloud()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [triggerSyncToCloud, triggerSyncFromCloud])

  // Global toast listener for sync feedback
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as string
      setSyncToast(msg)
      setTimeout(() => setSyncToast(null), 2500)
    }
    window.addEventListener('nousai-toast', handler)
    return () => window.removeEventListener('nousai-toast', handler)
  }, [])

  // Beta keyboard shortcuts: N=new note, Q=quiz, F=flashcards, ?=overlay, F11=focus mode
  const navigate = useNavigate()
  useEffect(() => {
    if (!betaMode) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'F11') { e.preventDefault(); setFocusMode(m => !m); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '?') { e.preventDefault(); setShortcutOverlayOpen(o => !o) }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); navigate('/library?tab=notes') }
      else if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); navigate('/quiz') }
      else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); navigate('/flashcards') }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [betaMode, navigate])

  // Auto dark mode scheduling — check every minute
  useEffect(() => {
    const schedule = data?.settings?.autoDarkSchedule as { enabled?: boolean; startTime?: string; endTime?: string } | undefined
    if (!schedule?.enabled || !schedule.startTime || !schedule.endTime) return

    function applySchedule() {
      const now = new Date()
      const cur = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const { startTime: s, endTime: e } = schedule!
      // Overnight schedule: e.g. 22:00 → 06:00
      const shouldBeDark = s! > e! ? (cur >= s! || cur < e!) : (cur >= s! && cur < e!)
      setData(prev => {
        const current = prev.settings?.theme
        const want = shouldBeDark ? 'dark' : 'light'
        if (current === want) return prev
        return { ...prev, settings: { ...prev.settings, theme: want } }
      })
    }

    applySchedule()
    const id = setInterval(applySchedule, 60_000)
    return () => clearInterval(id)
  }, [data?.settings?.autoDarkSchedule, setData])

  // Storage usage warning at 80%
  useEffect(() => {
    if (!('storage' in navigator && 'estimate' in navigator.storage)) return
    navigator.storage.estimate().then(({ usage, quota }) => {
      if (usage && quota && usage / quota >= 0.8) setStorageWarning(true)
    }).catch(() => {})
  }, [loaded])

  // Reset daily gamification goals if the day has changed & schedule SR notifications
  useEffect(() => {
    if (!data || initRef.current) return
    initRef.current = true

    // Reset daily goals
    const gam = data.pluginData?.gamificationData
    if (gam) {
      const reset = resetDailyIfNeeded(gam)
      if (reset !== gam) {
        setData(prev => ({ ...prev, pluginData: { ...prev.pluginData, gamificationData: reset } }))
      }
    }

    // Schedule periodic SR review notifications
    const cards = data.pluginData?.srData?.cards
    if (cards?.length) {
      scheduleReviewCheck(cards)
    }

    // Schedule Canvas assignment reminders (24h + 1h before due)
    const canvasLive = data.pluginData?.canvasLive
    const prefs = data.settings?.notificationPrefs as { reviewReminders?: boolean } | undefined
    if (canvasLive?.assignments?.length && prefs?.reviewReminders !== false) {
      const courseCodeMap = new Map<number, string>(
        (canvasLive.courses ?? []).map(c => [c.canvasId, c.courseCode])
      )
      scheduleAssignmentReminders(canvasLive.assignments, courseCodeMap)
    }
  }, [data])

  // Due cards count for nav badges — FSRS-aware, matches Dashboard and Flashcards page
  const dueCount = useMemo(
    () => getDueCount(courses, data?.settings?.courseCardCaps as Record<string, number> | undefined),
    [courses, data?.settings?.courseCardCaps]
  )

  // Close the More drawer and mobile sidebar when the user navigates
  useEffect(() => { setMoreOpen(false); setSidebarOpen(false) }, [location.pathname])

  // NousAI Canvas Extension — expose course list + handle import messages
  useEffect(() => {
    // Getter for extension content script to read current courses
    (window as Window & { __nousaiGetCourses?: () => { id: string; name: string }[] }).__nousaiGetCourses = () =>
      (data?.pluginData?.coachData?.courses ?? []).map(c => ({ id: c.id, name: c.name }))

    const handleExtMessage = (e: MessageEvent) => {
      if (e.source !== window || e.data?.type !== 'NOUSAI_CANVAS_IMPORT') return
      const { courseSpaces } = e.data as { courseSpaces: Record<string, CourseSpace> }
      if (!courseSpaces || typeof courseSpaces !== 'object') return
      setData(prev => {
        if (!prev) return prev
        const existing = prev.pluginData?.courseSpaces ?? {}
        const merged: Record<string, CourseSpace> = { ...existing }
        for (const [id, incoming] of Object.entries(courseSpaces)) {
          const cur = existing[id]
          if (!cur) {
            merged[id] = incoming
          } else {
            // Merge gradeEntries by id — prefer entries with later dates
            const entryMap = new Map<string, CourseSpace['gradeEntries'][number]>()
            for (const entry of [...cur.gradeEntries, ...incoming.gradeEntries]) {
              const ex = entryMap.get(entry.id)
              if (!ex || entry.date > ex.date) entryMap.set(entry.id, entry)
            }
            // Merge calendarEvents by id — same strategy
            const eventMap = new Map<string, CourseSpace['calendarEvents'][number]>()
            for (const ev of [...cur.calendarEvents, ...incoming.calendarEvents]) {
              const ex = eventMap.get(ev.id)
              if (!ex || ev.date > ex.date) eventMap.set(ev.id, ev)
            }
            merged[id] = {
              ...cur,
              gradeCategories: incoming.gradeCategories.length ? incoming.gradeCategories : cur.gradeCategories,
              gradeEntries: Array.from(entryMap.values()),
              calendarEvents: Array.from(eventMap.values()),
              // Canvas modules: replace entirely when incoming has data (Canvas is authoritative)
              canvasModules: (incoming.canvasModules && incoming.canvasModules.length > 0)
                ? incoming.canvasModules
                : cur.canvasModules,
              updatedAt: new Date().toISOString(),
            }
          }
        }
        return { ...prev, pluginData: { ...prev.pluginData, courseSpaces: merged } }
      })
    }

    window.addEventListener('message', handleExtMessage)
    return () => {
      delete (window as Window & { __nousaiGetCourses?: unknown }).__nousaiGetCourses
      window.removeEventListener('message', handleExtMessage)
    }
  }, [data, setData])

  if (!loaded) {
    return (
      <div className="onboarding">
        <NousLogo size={48} />
        <p className="text-muted" style={{ animation: 'pulse 1.5s infinite' }}>Loading...</p>
      </div>
    )
  }

  if (!data) return <Onboarding />

  return (
    <div className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${focusMode ? ' focus-mode' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Mobile hamburger button — only visible on mobile */}
      <button
        className="hamburger-btn"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
      >
        <Menu size={20} />
      </button>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop sidebar (also used as mobile slide-in sidebar) */}
      <nav className={`desktop-sidebar${sidebarOpen ? ' mobile-sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <NousLogo size={28} />
          <span className="sidebar-logo-text">NOUSAI</span>
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(c => !c)}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <div className="sidebar-nav">
          <button
            className="sidebar-item"
            onClick={() => setOmniSearchOpen(true)}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            title="Search (Ctrl+F)"
            aria-label="Open search"
          >
            <Search size={18} />
            <span className="sidebar-label">SEARCH</span>
          </button>
          {SIDEBAR_NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`} title={sidebarCollapsed ? n.label : undefined} onMouseEnter={() => preloadRoute(n.to)} aria-label={n.to === '/flashcards' && dueCount > 0 ? `${n.label}, ${dueCount} cards due` : n.label}>
              <n.icon size={18} />
              <span className="sidebar-label">{n.label}</span>
              {n.to === '/flashcards' && dueCount > 0 && (
                <span className="nav-badge">{dueCount > 99 ? '99+' : dueCount}</span>
              )}
            </NavLink>
          ))}
        </div>
        <div style={{ padding: '0 8px', marginTop: 'auto' }}>
          {(() => {
            const gam = data.pluginData?.gamificationData
            if (!gam) return null
            const level = getLevel(gam.xp)
            const progress = getLevelProgress(gam.xp)
            const title = getTitle(level)
            return (
              <div className="xp-bar-sidebar" title={`${gam.xp} XP total`}>
                {!sidebarCollapsed && <div className="xp-bar-label"><span>Lv.{level} {title}</span><span>{progress}/100 XP</span></div>}
                <div className="xp-bar-track"><div className="xp-bar-fill" style={{ width: `${progress}%` }} /></div>
              </div>
            )
          })()}
          <SyncStatusIndicator status={syncStatus} lastSyncAt={lastSyncAt} />
          <NavLink to="/settings" className="sidebar-item" style={{ fontSize: 12, color: 'var(--text-muted)' }} title={sidebarCollapsed ? 'Sync Data' : undefined}>
            <Upload size={14} /><span className="sidebar-label"> Sync Data</span>
          </NavLink>
        </div>
      </nav>

      {/* Page content */}
      <main id="main-content" className="page-content" key={location.pathname}>
        <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/study" element={<StudyPage />} />
            <Route path="/quiz" element={<Quizzes />} />
            <Route path="/quizzes" element={<Navigate to="/quiz" replace />} />
            <Route path="/learn" element={<UnifiedLearnPage />} />
            <Route path="/share/:shareId" element={<SharedContentPage />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/timer" element={<Timer />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/notes" element={<Navigate to="/library?tab=notes" replace />} />
            <Route path="/draw" element={<Navigate to="/library?tab=drawings" replace />} />
            <Route path="/ai" element={<Navigate to="/learn" replace />} />
            <Route path="/tools" element={<Navigate to="/learn" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/study-modes" element={<Navigate to="/library?tab=study" replace />} />
            <Route path="/course" element={<CoursePage />} />
            <Route path="/course/:id" element={<CourseRedirect />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </ErrorBoundary>
      </main>

      {/* Floating AI assistant panel — persists across all routes */}
      <NousPanel open={nousChatOpen} onOpenChange={setNousChatOpen} />

      {/* Floating mic indicator — shows on any page while Transcribe is recording */}
      <FloatingTranscribeIndicator />


      {/* Omni Search palette — triggered by Cmd+F / Ctrl+F */}
      {omniSearchOpen && (
        <ErrorBoundary>
          <OmniSearch onClose={() => setOmniSearchOpen(false)} />
        </ErrorBoundary>
      )}

      {/* Keyboard shortcut overlay (beta) */}
      {shortcutOverlayOpen && <ShortcutOverlay onClose={() => setShortcutOverlayOpen(false)} />}

      {/* Sync toast — triggered by Ctrl+S / Ctrl+Shift+S */}
      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 16px', fontSize: 13,
            color: 'var(--text-primary)', zIndex: 9999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontFamily: 'var(--font-mono, monospace)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {syncToast}
        </div>
      )}

      {/* Focus mode exit button (beta) */}
      {focusMode && (
        <button className="focus-mode-exit" onClick={() => setFocusMode(false)} title="Exit focus mode (F11)">
          Exit Focus
        </button>
      )}

      {/* Cross-device sync banner — appears when another device has synced newer data */}
      {remoteUpdateAvailable && (
        <SyncStatusBanner onLoad={loadRemoteData} onDismiss={dismissRemoteBanner} />
      )}

      {/* Offline banner — visible on all pages including mobile (sidebar offline dot is not visible on mobile) */}
      {syncStatus === 'offline' && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
          background: 'rgba(75,85,99,0.97)', color: '#fff',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, gap: 6, letterSpacing: '0.2px',
        }}>
          <span style={{ opacity: 0.8 }}>●</span>
          <span>You're offline — changes are being saved locally and will sync when reconnected.</span>
        </div>
      )}

      {/* Storage usage warning (≥80%) */}
      {storageWarning && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'rgba(239,68,68,0.95)', color: '#fff',
          padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 13, fontWeight: 600, gap: 12,
        }}>
          <span>⚠️ Storage is nearly full (≥80%). Export your data to avoid losing progress.</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => { window.location.hash = '#/settings'; setStorageWarning(false); }}
              style={{ background: '#fff', color: '#ef4444', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              Manage Data
            </button>
            <button onClick={() => setStorageWarning(false)}
              style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', padding: 4, fontSize: 16, lineHeight: 1 }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV.map(n => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} onMouseEnter={() => preloadRoute(n.to)} aria-label={n.to === '/flashcards' && dueCount > 0 ? `${n.label}, ${dueCount} cards due` : n.label}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <n.icon />
              {n.to === '/flashcards' && dueCount > 0 && (
                <span className="nav-badge-dot" />
              )}
            </span>
            <span className="nav-label">{n.label}</span>
          </NavLink>
        ))}
        <button
          className={`nav-item${moreOpen ? ' active' : ''}`}
          onClick={() => setMoreOpen(o => !o)}
          aria-label="More navigation options"
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <MoreHorizontal />
          <span className="nav-label">MORE</span>
        </button>
      </nav>

      {/* More drawer — Timer, Calendar, Tools, Settings */}
      {moreOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 199 }}
            onClick={() => setMoreOpen(false)}
          />
          <nav style={{
            position: 'fixed', bottom: 'var(--nav-height, 60px)', left: 0, right: 0,
            background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-around', padding: '10px 0 8px',
            zIndex: 200,
          }}>
            {MORE_NAV.map(n => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                onMouseEnter={() => preloadRoute(n.to)}
                onClick={() => setMoreOpen(false)}
                aria-label={n.label}
              >
                <n.icon />
                <span className="nav-label">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}
