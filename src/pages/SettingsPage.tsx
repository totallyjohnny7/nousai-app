import { useRef, useState, useEffect, useCallback } from 'react'
import {
  Upload, Download, Trash2, Database, Info, RefreshCw, Monitor, Tablet,
  ArrowUpCircle, Smartphone, ChevronDown, ChevronRight, User, Cloud,
  Key, Brain, Eye, EyeOff, Palette, BookOpen, Volume2, VolumeX,
  Globe, Zap, Bug, Lightbulb, LogOut, LogIn, UserPlus, Check,
  AlertTriangle, Settings, Shield, Clock, Minus, Plus, ExternalLink, FolderPlus,
  Bell, Mic, Sun, Clipboard, HardDrive, FileText, Wifi, Headphones
} from 'lucide-react'
import { useStore, normalizeData, forceWriteToIDB, clearPWACache, saveBackupHandle, loadBackupHandle, clearBackupHandle } from '../store'
import { checkForUpdates, getAppVersion, getStoredUpdate, dismissUpdate, getPlatform } from '../utils/updater'
import { signUp, signIn, logOut, onAuthChange, syncToCloud, syncFromCloud, saveFirebaseConfig, getFirebaseConfig, signInWithGoogle, signInAsGuest, sendVerificationEmail, deleteAccount, type AuthUser } from '../utils/auth'
// testData is lazy-loaded only when user clicks "Load Test Data" button
import { SHORTCUT_DEFS, getShortcutKey, setShortcutKey, resetAllShortcuts, formatKey } from '../utils/shortcuts'
import { getLevel, THEME_PRESETS } from '../utils/gamification'
import {
  checkAllPermissions, requestMicrophone, requestPersistentStorage,
  registerBackgroundSync, isWakeLockSupported, isClipboardSupported,
  isBackgroundSyncSupported, isFileSystemAccessSupported, isPersistentStorageSupported,
  getPermPref, setPermPref, type AllPermissions
} from '../utils/permissions'
import { requestFCMPermission, getFCMToken, clearFCMToken, isFCMSupported } from '../utils/fcm'
import { getSpotifyAuthUrl, isSpotifyConnected, disconnectSpotify } from '../utils/spotify'
import { runFullCanvasSync } from '../utils/canvasSync'

// ─── Section Collapse State ────────────────────────────────
type SectionId = 'account' | 'ai' | 'extensions' | 'study' | 'display' | 'permissions' | 'data' | 'howto' | 'appinfo' | 'spotify'

// ─── AI Provider Types ─────────────────────────────────────
type AIProvider = 'none' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'mistral' | 'custom'

const PROVIDER_INFO: Record<string, { label: string; color: string; url: string; keyPrefix: string }> = {
  openai: { label: 'OpenAI', color: '#10a37f', url: 'https://platform.openai.com/api-keys', keyPrefix: 'sk-' },
  anthropic: { label: 'Anthropic', color: '#d4a574', url: 'https://console.anthropic.com/settings/keys', keyPrefix: 'sk-ant-' },
  openrouter: { label: 'OpenRouter', color: '#6366f1', url: 'https://openrouter.ai/keys', keyPrefix: 'sk-or-' },
  google: { label: 'Google AI', color: '#4285f4', url: 'https://aistudio.google.com/apikey', keyPrefix: 'AI' },
  groq: { label: 'Groq', color: '#f55036', url: 'https://console.groq.com/keys', keyPrefix: 'gsk_' },
  mistral: { label: 'Mistral', color: '#f97316', url: 'https://console.mistral.ai/api-keys', keyPrefix: '' },
  custom: { label: 'Custom', color: '#888', url: '', keyPrefix: '' },
}

// ─── Feature Slot Types ─────────────────────────────────────
type AIFeatureSlot = 'chat' | 'generation' | 'analysis' | 'ocr' | 'japanese' | 'physics'

const SLOT_INFO: Record<AIFeatureSlot, { label: string; description: string }> = {
  chat:       { label: 'Chat & Tutor',  description: 'AI Tutor, chat, Feynman mode, quiz chat' },
  generation: { label: 'Generation',    description: 'Flashcard, quiz, course & schedule generation' },
  analysis:   { label: 'Analysis',      description: 'Fact-check, TLDR, re-explain, formula analysis' },
  ocr:        { label: 'PDF & Image OCR', description: 'Document / image text extraction (requires Mistral key for OCR)' },
  japanese:   { label: 'Japanese',      description: 'Japanese study tools, JP quiz & flashcards' },
  physics:    { label: 'Physics',       description: 'Physics lab simulation code generation' },
}

interface SlotConfig { provider: string; apiKey: string; model: string }

function getSlotConfig(slot: AIFeatureSlot): SlotConfig {
  return {
    provider: localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || '',
    apiKey:   localStorage.getItem(`nousai-ai-slot-${slot}-apikey`) || '',
    model:    localStorage.getItem(`nousai-ai-slot-${slot}-model`) || '',
  }
}

function saveSlotConfig(slot: AIFeatureSlot, cfg: SlotConfig) {
  if (!cfg.provider) {
    localStorage.removeItem(`nousai-ai-slot-${slot}-provider`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-apikey`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-model`)
  } else {
    localStorage.setItem(`nousai-ai-slot-${slot}-provider`, cfg.provider)
    localStorage.setItem(`nousai-ai-slot-${slot}-apikey`, cfg.apiKey)
    localStorage.setItem(`nousai-ai-slot-${slot}-model`, cfg.model)
  }
}

const OPENAI_MODELS = [
  { value: 'gpt-5.4', label: 'GPT-5.4 (Latest - Mar 2026)' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex (Agentic Coding)' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
  { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
  { value: 'o3-mini', label: 'o3-mini (Reasoning)' },
  { value: 'o1', label: 'o1 (Reasoning)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
]

const ANTHROPIC_MODELS = [
  { value: 'claude-opus-4-6-20260217', label: 'Claude Opus 4.6 (Latest - Feb 2026)' },
  { value: 'claude-sonnet-4-6-20260217', label: 'Claude Sonnet 4.6 (1M context)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
]

const OPENROUTER_MODELS = [
  { value: 'anthropic/claude-opus-4.6', label: 'Claude Opus 4.6 (Latest)' },
  { value: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6' },
  { value: 'openai/gpt-5.4', label: 'GPT-5.4 (Latest)' },
  { value: 'openai/gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { value: 'openai/o3-mini', label: 'o3-mini (Reasoning)' },
  { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro' },
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'meta-llama/llama-4-maverick', label: 'Llama 4 Maverick' },
  { value: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  { value: 'deepseek/deepseek-chat-v3', label: 'DeepSeek V3' },
  { value: 'mistralai/mistral-large-2411', label: 'Mistral Large' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B' },
]

const GOOGLE_MODELS = [
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Latest)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
]

const MISTRAL_MODELS = [
  { value: 'mistral-large-latest', label: 'Mistral Large (Latest)' },
  { value: 'mistral-medium-latest', label: 'Mistral Medium' },
  { value: 'mistral-small-latest', label: 'Mistral Small' },
  { value: 'mistral-nemo', label: 'Mistral Nemo' },
  { value: 'codestral-latest', label: 'Codestral (Code)' },
]

const GROQ_MODELS = [
  { value: 'llama-4-maverick', label: 'Llama 4 Maverick' },
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (Instant)' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B' },
]

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Japanese',
  'Chinese', 'Korean', 'Portuguese', 'Italian', 'Russian',
  'Arabic', 'Hindi',
]

const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

// ─── localStorage helpers for AI config ────────────────────
function getAIConfig() {
  return {
    provider: (localStorage.getItem('nousai-ai-provider') || 'none') as AIProvider,
    apiKey: localStorage.getItem('nousai-ai-apikey') || '',
    model: localStorage.getItem('nousai-ai-model') || '',
    baseUrl: localStorage.getItem('nousai-ai-baseurl') || '',
    customModel: localStorage.getItem('nousai-ai-custom-model') || '',
    temperature: parseFloat(localStorage.getItem('nousai-ai-temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('nousai-ai-max-tokens') || '2048'),
    systemPrompt: localStorage.getItem('nousai-ai-system-prompt') || '',
    streaming: localStorage.getItem('nousai-ai-streaming') !== 'false',
    responseFormat: localStorage.getItem('nousai-ai-response-format') || 'text',
  }
}

function saveAIConfig(config: ReturnType<typeof getAIConfig>) {
  localStorage.setItem('nousai-ai-provider', config.provider)
  localStorage.setItem('nousai-ai-apikey', config.apiKey)
  localStorage.setItem('nousai-ai-model', config.model)
  localStorage.setItem('nousai-ai-baseurl', config.baseUrl)
  localStorage.setItem('nousai-ai-custom-model', config.customModel)
  localStorage.setItem('nousai-ai-temperature', String(config.temperature))
  localStorage.setItem('nousai-ai-max-tokens', String(config.maxTokens))
  localStorage.setItem('nousai-ai-system-prompt', config.systemPrompt)
  localStorage.setItem('nousai-ai-streaming', String(config.streaming))
  localStorage.setItem('nousai-ai-response-format', config.responseFormat)
}

// ─── localStorage helpers for study prefs ──────────────────
function getStudyPrefs() {
  return {
    dailyXpGoal: parseInt(localStorage.getItem('nousai-pref-daily-xp') || '100'),
    quizQuestionCount: parseInt(localStorage.getItem('nousai-pref-quiz-count') || '20'),
    flashcardAutoFlip: localStorage.getItem('nousai-pref-flashcard-flip') || 'off',
    pomoWork: parseInt(localStorage.getItem('nousai-pref-pomo-work') || '20'),
    pomoBreak: parseInt(localStorage.getItem('nousai-pref-pomo-break') || '10'),
    language: localStorage.getItem('nousai-pref-language') || 'English',
    difficulty: localStorage.getItem('nousai-pref-difficulty') || 'Medium',
    soundEffects: localStorage.getItem('nousai-pref-sound') !== 'false',
  }
}

function saveStudyPrefs(prefs: ReturnType<typeof getStudyPrefs>) {
  localStorage.setItem('nousai-pref-daily-xp', String(prefs.dailyXpGoal))
  localStorage.setItem('nousai-pref-quiz-count', String(prefs.quizQuestionCount))
  localStorage.setItem('nousai-pref-flashcard-flip', prefs.flashcardAutoFlip)
  localStorage.setItem('nousai-pref-pomo-work', String(prefs.pomoWork))
  localStorage.setItem('nousai-pref-pomo-break', String(prefs.pomoBreak))
  localStorage.setItem('nousai-pref-language', prefs.language)
  localStorage.setItem('nousai-pref-difficulty', prefs.difficulty)
  localStorage.setItem('nousai-pref-sound', String(prefs.soundEffects))
}

// ─── Display prefs ─────────────────────────────────────────
function getDisplayPrefs() {
  return {
    fontSize: localStorage.getItem('nousai-pref-fontsize') || 'medium',
    compactMode: localStorage.getItem('nousai-pref-compact') === 'true',
    accentColor: localStorage.getItem('nousai-pref-accent') || '#F5A623',
    highContrast: localStorage.getItem('nousai-pref-highcontrast') === 'true',
    colorBlind: localStorage.getItem('nousai-pref-colorblind') === 'true',
    reducedMotion: localStorage.getItem('nousai-pref-reducedmotion') === 'true',
  }
}

function saveDisplayPrefs(prefs: ReturnType<typeof getDisplayPrefs>) {
  localStorage.setItem('nousai-pref-fontsize', prefs.fontSize)
  localStorage.setItem('nousai-pref-compact', String(prefs.compactMode))
  localStorage.setItem('nousai-pref-accent', prefs.accentColor)
  localStorage.setItem('nousai-pref-highcontrast', String(prefs.highContrast))
  localStorage.setItem('nousai-pref-colorblind', String(prefs.colorBlind))
  localStorage.setItem('nousai-pref-reducedmotion', String(prefs.reducedMotion))
  // Apply CSS variable for font size
  const sizes: Record<string, string> = { small: '13px', medium: '15px', large: '17px' }
  document.documentElement.style.setProperty('--base-font-size', sizes[prefs.fontSize] || '15px')
  // Apply compact mode
  document.documentElement.classList.toggle('compact-mode', prefs.compactMode)
  // Apply accent color
  document.documentElement.style.setProperty('--color-accent', prefs.accentColor)
  // Apply accessibility attributes
  document.documentElement.toggleAttribute('data-high-contrast', prefs.highContrast)
  document.documentElement.toggleAttribute('data-colorblind', prefs.colorBlind)
  document.documentElement.toggleAttribute('data-reduced-motion', prefs.reducedMotion)
}

// ─── Minimal empty NousAIData ──────────────────────────────
function createBlankWorkspace() {
  return {
    settings: {
      aiProvider: '',
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
        pomoRemainingMs: 0, savedAt: Date.now(),
      },
      gamificationData: {
        xp: 0, level: 1, totalQuizzes: 0, totalCorrect: 0, totalAnswered: 0,
        totalMinutes: 0, streak: 0, bestStreak: 0, streakFreezes: 0,
        lastStudyDate: null, perfectScores: 0,
        badges: [], dailyGoal: { todayXp: 0, todayMinutes: 0, todayQuestions: 0, targetXp: 100 },
      },
      quizBank: {},
      notes: [],
      drawings: [],
      studySessions: [],
      matchSets: [],
    },
  }
}

// ─── Styles ────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  marginBottom: 16,
  overflow: 'hidden',
  transition: 'border-color 0.2s',
}

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'background 0.15s',
}

const cardBodyStyle: React.CSSProperties = {
  padding: '0 16px 16px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--bg-input, var(--bg-primary))',
  color: 'var(--text-primary)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23888\' stroke-width=\'2\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  backgroundSize: '16px',
  paddingRight: 32,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 6,
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: 14,
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '10px 16px',
  background: active ? 'var(--accent, #fff)' : 'transparent',
  color: active ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
  border: active ? 'none' : '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: active ? 700 : 500,
  fontFamily: 'inherit',
  transition: 'all 0.15s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
})

const toggleStyle = (on: boolean): React.CSSProperties => ({
  width: 44,
  height: 24,
  borderRadius: 12,
  background: on ? 'var(--green, #22c55e)' : 'var(--border)',
  border: 'none',
  cursor: 'pointer',
  position: 'relative',
  transition: 'background 0.2s',
  flexShrink: 0,
})

const toggleKnobStyle = (on: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 3,
  left: on ? 23 : 3,
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: 'var(--text-primary, #fff)',
  transition: 'left 0.2s',
})

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 0',
  borderBottom: '1px solid var(--border)',
}

const dangerCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderColor: 'var(--red, #ef4444)',
  borderWidth: 1,
}

const warningBoxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: 12,
  background: 'rgba(234, 179, 8, 0.08)',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid rgba(234, 179, 8, 0.2)',
  marginTop: 12,
  fontSize: 12,
  color: 'var(--text-secondary)',
  lineHeight: 1.5,
}

// ─── Permission Badge Component ─────────────────────────────
function PermBadge({ status }: { status: 'granted' | 'denied' | 'notyet' | 'na' }) {
  const map = {
    granted: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', text: 'Granted' },
    denied:  { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', text: 'Denied' },
    notyet:  { bg: 'rgba(234,179,8,0.12)', color: '#eab308', text: 'Not Yet' },
    na:      { bg: 'rgba(136,136,136,0.12)', color: '#888', text: 'N/A' },
  }
  const s = map[status]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color }}>
      {s.text}
    </span>
  )
}

// ─── Shortcut Row Component ────────────────────────────────
function ShortcutRow({ shortcut }: { shortcut: (typeof SHORTCUT_DEFS)[number] }) {
  const [listening, setListening] = useState(false);
  const currentKey = getShortcutKey(shortcut.id);
  const isCustom = currentKey !== shortcut.defaultKey;

  useEffect(() => {
    if (!listening) return;
    function handleKey(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key === ' ' ? 'Space' : e.key;
      if (key === 'Escape') { setListening(false); return; }
      setShortcutKey(shortcut.id, key);
      setListening(false);
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [listening, shortcut.id]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '4px 8px', borderRadius: 4,
      background: listening ? 'var(--accent-glow)' : 'transparent',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{shortcut.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => setListening(!listening)}
          style={{
            fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
            padding: '2px 8px', borderRadius: 4, cursor: 'pointer',
            border: listening ? '2px solid var(--accent)' : `1px solid ${isCustom ? 'var(--accent)' : 'var(--border)'}`,
            background: listening ? 'var(--accent-glow)' : isCustom ? 'var(--accent-glow)' : 'var(--bg-primary)',
            color: listening ? 'var(--accent)' : isCustom ? 'var(--accent-light)' : 'var(--text-primary)',
            minWidth: 36, textAlign: 'center',
          }}
        >
          {listening ? '...' : formatKey(currentKey)}
        </button>
        {isCustom && (
          <button
            onClick={() => { setShortcutKey(shortcut.id, shortcut.defaultKey); }}
            title="Reset to default"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-dim)', padding: 2, fontSize: 10,
            }}
          >
            <RefreshCw size={10} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function SettingsPage() {
  const { data, setData, updatePluginData, importData, exportData, einkMode, setEinkMode, betaMode, setBetaMode, backupNow, startRemoteWatch, stopRemoteWatch } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState(getStoredUpdate())
  const [checking, setChecking] = useState(false)
  // Update URL is now hardcoded in updater.ts for security
  const platform = getPlatform()

  // Section expand/collapse
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    account: true,
    ai: false,
    extensions: false,
    study: false,
    display: false,
    permissions: false,
    data: false,
    howto: false,
    appinfo: false,
    spotify: false,
  })

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authTab, setAuthTab] = useState<'signin' | 'create'>('signin')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  // Sign in form
  const [signInEmail, setSignInEmail] = useState('')
  const [signInPassword, setSignInPassword] = useState('')

  // Create account form
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createConfirm, setCreateConfirm] = useState('')

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(localStorage.getItem('nousai-last-sync'))
  const [autoSync, setAutoSync] = useState(localStorage.getItem('nousai-auto-sync') === 'true')

  // Omi device
  const [omiApiKey, setOmiApiKey] = useState(localStorage.getItem('nousai-omi-api-key') || '')
  const [omiKeyInput, setOmiKeyInput] = useState('')
  const [omiTesting, setOmiTesting] = useState(false)
  const [canvasSyncing, setCanvasSyncing] = useState(false)
  const [canvasSyncStatus, setCanvasSyncStatus] = useState<{
    ok: boolean; message: string; lastSync?: string
  } | null>(null)

  // Auto-backup state
  const [autoBackup, setAutoBackup] = useState(localStorage.getItem('nousai-auto-backup') === 'true')
  const [backupFolder, setBackupFolder] = useState<string | null>(null)
  const [lastBackup, setLastBackup] = useState<string | null>(localStorage.getItem('nousai-last-backup'))
  const [backingUp, setBackingUp] = useState(false)

  useEffect(() => {
    loadBackupHandle().then(h => { if (h) setBackupFolder(h.name); });
  }, []);

  async function handlePickBackupFolder() {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      await saveBackupHandle(handle);
      setBackupFolder(handle.name);
      localStorage.setItem('nousai-auto-backup', 'true');
      setAutoBackup(true);
      showToast('Backup folder set: ' + handle.name);
    } catch { /* user cancelled */ }
  }

  async function handleBackupNow() {
    setBackingUp(true);
    const ok = await backupNow();
    setBackingUp(false);
    if (ok) {
      setLastBackup(new Date().toISOString());
      showToast('Backup saved!');
    } else {
      showToast('Backup failed — pick a folder first.');
    }
  }

  function handleToggleAutoBackup() {
    if (!autoBackup && !backupFolder) {
      handlePickBackupFolder();
      return;
    }
    const next = !autoBackup;
    setAutoBackup(next);
    localStorage.setItem('nousai-auto-backup', String(next));
    showToast(next ? 'Auto-backup enabled (hourly)' : 'Auto-backup disabled');
  }

  async function handleClearBackupFolder() {
    await clearBackupHandle();
    setBackupFolder(null);
    setAutoBackup(false);
    localStorage.setItem('nousai-auto-backup', 'false');
    showToast('Backup folder cleared');
  }

  // Custom Firebase config state
  const [showCustomFb, setShowCustomFb] = useState(false)
  const [customFbConfig, setCustomFbConfig] = useState(() => {
    const cfg = getFirebaseConfig()
    return {
      apiKey: localStorage.getItem('nousai-fb-apiKey') || '',
      authDomain: localStorage.getItem('nousai-fb-authDomain') || '',
      projectId: localStorage.getItem('nousai-fb-projectId') || '',
      storageBucket: localStorage.getItem('nousai-fb-storageBucket') || '',
      messagingSenderId: localStorage.getItem('nousai-fb-messagingSenderId') || '',
      appId: localStorage.getItem('nousai-fb-appId') || '',
    }
  })
  const isCustomFb = !!localStorage.getItem('nousai-fb-apiKey')

  // AI config state
  const [aiConfig, setAiConfig] = useState(getAIConfig)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Feature slot overrides state
  const SLOTS: AIFeatureSlot[] = ['chat', 'generation', 'analysis', 'ocr', 'japanese', 'physics']
  const [slotConfigs, setSlotConfigs] = useState<Record<AIFeatureSlot, SlotConfig>>(() =>
    Object.fromEntries(SLOTS.map(s => [s, getSlotConfig(s)])) as Record<AIFeatureSlot, SlotConfig>
  )
  const [expandedSlot, setExpandedSlot] = useState<AIFeatureSlot | null>(null)

  function updateSlotConfig(slot: AIFeatureSlot, patch: Partial<SlotConfig>) {
    const next = { ...slotConfigs[slot], ...patch }
    if (patch.provider && patch.provider !== slotConfigs[slot].provider) {
      // Auto-set default model when changing provider
      if (patch.provider === 'openai') next.model = 'gpt-4.1'
      else if (patch.provider === 'anthropic') next.model = 'claude-sonnet-4-20250514'
      else if (patch.provider === 'openrouter') next.model = 'anthropic/claude-sonnet-4'
      else if (patch.provider === 'google') next.model = 'gemini-2.5-flash'
      else if (patch.provider === 'groq') next.model = 'llama-3.3-70b-versatile'
      else if (patch.provider === 'mistral') next.model = slot === 'ocr' ? 'mistral-large-latest' : 'mistral-large-latest'
      else next.model = ''
    }
    setSlotConfigs(prev => ({ ...prev, [slot]: next }))
    saveSlotConfig(slot, next)
  }

  function clearSlotConfig(slot: AIFeatureSlot) {
    const cleared: SlotConfig = { provider: '', apiKey: '', model: '' }
    setSlotConfigs(prev => ({ ...prev, [slot]: cleared }))
    saveSlotConfig(slot, cleared)
  }

  // Study prefs state
  const [studyPrefs, setStudyPrefsState] = useState(getStudyPrefs)

  // Display prefs state
  const [displayPrefs, setDisplayPrefsState] = useState(getDisplayPrefs)

  // Permissions state
  const [permStatus, setPermStatus] = useState<AllPermissions | null>(null)
  const [permWakelock, setPermWakelock] = useState(getPermPref('wakelock', true))
  const [permBgsync, setPermBgsync] = useState(getPermPref('bgsync', false))
  const [permClipboard, setPermClipboard] = useState(getPermPref('clipboard', true))

  // #89 Profile customization draft
  const [profileDraft, setProfileDraft] = useState<{ avatarEmoji?: string; customDisplayName?: string; bio?: string }>(() => data?.pluginData?.userProfile ?? {})

  // #90 Notification preferences
  const [notifPerms, setNotifPerms] = useState<{ show: boolean; reviewReminders: boolean; streakAlerts: boolean; pomodoroAlerts: boolean; reminderTime: string }>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('nousai-notif-prefs') || '{}');
      return { show: true, reviewReminders: true, streakAlerts: true, pomodoroAlerts: false, reminderTime: '09:00', ...stored };
    } catch { return { show: true, reviewReminders: true, streakAlerts: true, pomodoroAlerts: false, reminderTime: '09:00' }; }
  })

  const [fcmToken, setFcmToken] = useState(() => getFCMToken())
  const [vapidKey, setVapidKey] = useState(() => localStorage.getItem('nousai-fcm-vapid') || '')

  // ─── Effects ───────────────────────────────────────────
  useEffect(() => {
    checkForUpdates().then(r => { if (r.available && r.info) setUpdateInfo(r.info) })
  }, [])

  // Load permission statuses
  useEffect(() => {
    checkAllPermissions().then(setPermStatus)
  }, [])

  // Auth listener
  useEffect(() => {
    let unsubscribe: (() => void) | null = null
    onAuthChange((user) => {
      setAuthUser(user)
      setAuthLoading(false)
      if (user) {
        localStorage.setItem('nousai-auth-uid', user.uid)
        startRemoteWatch(user.uid)
      } else {
        localStorage.removeItem('nousai-auth-uid')
        stopRemoteWatch()
      }
    }).then(unsub => { unsubscribe = unsub })
    return () => {
      if (unsubscribe) unsubscribe()
      stopRemoteWatch() // Unsubscribe Firestore onSnapshot listener on unmount
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Apply display prefs on mount
  useEffect(() => {
    saveDisplayPrefs(displayPrefs)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Helpers ───────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  function toggleSection(id: SectionId) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // ─── Auth Handlers ─────────────────────────────────────
  async function handleSignIn() {
    if (!signInEmail || !signInPassword) {
      setAuthError('Please enter your email and password.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      const authResult = await signIn(signInEmail, signInPassword)
      if (authResult?.uid) localStorage.setItem('nousai-auth-uid', authResult.uid)
      showToast('Signed in successfully!')
      setSignInEmail('')
      setSignInPassword('')
      const deviceType = /Mobi|Android/i.test(navigator.userAgent) ? 'Mobile' : /iPad|Tablet/i.test(navigator.userAgent) ? 'Tablet' : 'Desktop'
      const existing = data?.pluginData?.loginHistory ?? []
      updatePluginData({ loginHistory: [...existing.slice(-9), { timestamp: new Date().toISOString(), device: deviceType }] })
    } catch (e: any) {
      const msg = e?.message || 'Sign in failed.'
      if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('user-not-found')) {
        setAuthError('Invalid email or password.')
      } else if (msg.includes('invalid-email')) {
        setAuthError('Invalid email address.')
      } else if (msg.includes('too-many-requests')) {
        setAuthError('Too many attempts. Please try again later.')
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleCreateAccount() {
    if (!createEmail || !createPassword) {
      setAuthError('Please fill in all required fields.')
      return
    }
    if (createPassword !== createConfirm) {
      setAuthError('Passwords do not match.')
      return
    }
    if (createPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    setAuthBusy(true)
    setAuthError(null)
    try {
      await signUp(createEmail, createPassword, createName || undefined)
      showToast('Account created successfully!')
      setCreateName('')
      setCreateEmail('')
      setCreatePassword('')
      setCreateConfirm('')
    } catch (e: any) {
      const msg = e?.message || 'Account creation failed.'
      if (msg.includes('email-already-in-use')) {
        setAuthError('An account with this email already exists.')
      } else if (msg.includes('invalid-email')) {
        setAuthError('Invalid email address.')
      } else if (msg.includes('weak-password')) {
        setAuthError('Password is too weak. Use at least 6 characters.')
      } else {
        setAuthError(msg)
      }
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleLogOut() {
    try {
      await logOut()
      localStorage.removeItem('nousai-auth-uid')
      showToast('Signed out.')
    } catch {
      showToast('Failed to sign out.')
    }
  }

  async function handleSyncToCloud() {
    console.log('[SYNC] handleSyncToCloud called', { authUser: !!authUser, data: !!data })
    if (!authUser || !data) {
      console.warn('[SYNC] Early return — authUser:', !!authUser, 'data:', !!data)
      if (!data) showToast('No data to sync. Import your data first.')
      return
    }
    // Safety guard: refuse to sync if there are no courses — likely means local data isn't loaded yet.
    // This prevents accidentally overwriting cloud data with an empty state (e.g. on a fresh mobile install).
    const localCourses = data.pluginData?.coachData?.courses || []
    if (localCourses.length === 0) {
      const proceed = confirm(
        'Warning: You have no courses in your local data.\n\n' +
        'Syncing now will overwrite your cloud backup with empty data.\n\n' +
        'If you want to restore your data on this device, use "Load from Cloud" instead.\n\n' +
        'Continue uploading empty data anyway?'
      )
      if (!proceed) {
        showToast('Sync cancelled — your cloud data is safe.')
        return
      }
    }
    setSyncing(true)
    try {
      console.log('[SYNC] Calling syncToCloud with uid:', authUser.uid)
      await syncToCloud(authUser.uid, data)
      console.log('[SYNC] syncToCloud succeeded')
      const now = new Date().toISOString()
      localStorage.setItem('nousai-last-sync', now)
      setLastSync(now)
      const noteCount = (data.pluginData as any)?.notes?.length || 0
      showToast(`Synced to cloud! ${noteCount} notes uploaded.`)
    } catch (e: any) {
      console.error('[SYNC] syncToCloud failed:', e)
      showToast('Sync failed: ' + (e?.message || 'Unknown error'))
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncFromCloud() {
    console.log('[SYNC] handleSyncFromCloud called', { authUser: !!authUser })
    if (!authUser) {
      console.warn('[SYNC] Early return — no authUser')
      return
    }
    setSyncing(true)
    try {
      // Step 1: Clear PWA cache first so stale service worker doesn't interfere
      const cacheCleared = await clearPWACache()
      if (cacheCleared) console.log('[SYNC] PWA cache cleared before sync')

      console.log('[SYNC] Calling syncFromCloud with uid:', authUser.uid)
      const cloudData = await syncFromCloud(authUser.uid)
      console.log('[SYNC] syncFromCloud returned:', cloudData ? 'data found' : 'null')
      if (cloudData) {
        // Conflict detection: warn before overwriting local data
        const localModifiedAt = localStorage.getItem('nousai-data-modified-at')
        const lastSyncAt = localStorage.getItem('nousai-last-sync')
        const localCourses = data?.pluginData?.coachData?.courses || []
        const isFirstSync = !lastSyncAt
        const hasUnsyncedChanges = !!(localModifiedAt && lastSyncAt && localModifiedAt > lastSyncAt)
        if ((isFirstSync && localCourses.length > 0) || hasUnsyncedChanges) {
          const proceed = confirm(
            isFirstSync
              ? `Loading from cloud will replace your local data (${localCourses.length} course${localCourses.length !== 1 ? 's' : ''}).\n\nContinue?`
              : 'Your local data has been modified since the last sync. ' +
                'Loading cloud data will overwrite these local changes.\n\nContinue?'
          )
          if (!proceed) {
            showToast('Cloud sync cancelled.')
            return
          }
        }

        // Safety check: warn if cloud data has no courses but local data does
        const normalized = normalizeData(cloudData)
        const cloudCourses = normalized.pluginData?.coachData?.courses || []
        if (localCourses.length > 0 && cloudCourses.length === 0) {
          const proceed = confirm(
            `Warning: Cloud data has 0 courses, but you have ${localCourses.length} courses locally.\n\n` +
            'This may indicate corrupted cloud data. Continue anyway?'
          )
          if (!proceed) {
            showToast('Cloud sync cancelled — local data preserved.')
            return
          }
        }

        // Step 2: Normalize and set data in React state
        setData(normalized)

        // Step 3: Force-write to IndexedDB immediately (don't wait for 500ms debounce)
        await forceWriteToIDB(normalized)
        console.log('[SYNC] Force-wrote cloud data to IDB')

        const now = new Date().toISOString()
        localStorage.setItem('nousai-last-sync', now)
        localStorage.setItem('nousai-data-modified-at', now)
        setLastSync(now)

        const noteCount = Array.isArray(normalized.settings?.notes) ? normalized.settings.notes.length : 0
        const subjectCount = Array.isArray(normalized.settings?.subjects) ? normalized.settings.subjects.length : 0
        showToast(`Synced from cloud! ${noteCount} notes, ${subjectCount} subjects loaded.`)
      } else {
        showToast('No cloud data found for this account.')
      }
    } catch (e: any) {
      console.error('[SYNC] syncFromCloud failed:', e)
      showToast('Sync failed: ' + (e?.message || 'Unknown error'))
    } finally {
      setSyncing(false)
    }
  }

  function handleAutoSyncToggle() {
    const next = !autoSync
    setAutoSync(next)
    localStorage.setItem('nousai-auto-sync', String(next))
    showToast(next ? 'Auto-sync enabled' : 'Auto-sync disabled')
  }

  // ─── Canvas Sync Handler ──────────────────────────────
  async function handleCanvasSync() {
    const canvasUrl = data?.settings?.canvasUrl
    const canvasToken = data?.settings?.canvasToken
    if (!canvasUrl || !canvasToken) {
      setCanvasSyncStatus({ ok: false, message: 'Canvas URL and token required' })
      return
    }
    setCanvasSyncing(true)
    setCanvasSyncStatus(null)
    try {
      const result = await runFullCanvasSync(canvasUrl, canvasToken)
      updatePluginData({
        canvasLive: {
          courses: result.courses,
          assignments: result.assignments,
          announcements: result.announcements,
          lastFullSync: new Date().toISOString(),
        },
      })
      const msg = result.errors.length > 0
        ? `Synced with ${result.errors.length} error(s): ${result.errors[0]}`
        : `Synced ${result.courses.length} courses, ${result.assignments.length} assignments`
      setCanvasSyncStatus({ ok: result.errors.length === 0, message: msg, lastSync: new Date().toLocaleString() })
    } catch (e) {
      setCanvasSyncStatus({ ok: false, message: e instanceof Error ? e.message : 'Sync failed' })
    } finally {
      setCanvasSyncing(false)
    }
  }

  // ─── Update Handlers ──────────────────────────────────
  async function handleCheckUpdate() {
    setChecking(true)
    const r = await checkForUpdates()
    setChecking(false)
    if (r.available && r.info) {
      setUpdateInfo(r.info)
    } else {
      showToast('You are on the latest version!')
    }
  }

  // ─── Data Handlers ────────────────────────────────────
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      importData(ev.target?.result as string)
      showToast('Data imported successfully!')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function handleExport() {
    const json = exportData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nousai-data-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Data exported!')
  }

  function handleClear() {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      // Clear IndexedDB
      indexedDB.deleteDatabase('nousai-companion')
      // Clear all nousai-* localStorage keys (game data, preferences, etc.)
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('nousai-')) keysToRemove.push(key)
      }
      keysToRemove.forEach(k => localStorage.removeItem(k))
      window.location.reload()
    }
  }

  function handleCreateBlankWorkspace() {
    if (data) {
      if (!confirm('You already have data loaded. Creating a blank workspace will replace it. Continue?')) {
        return
      }
    }
    setData(createBlankWorkspace() as any)
    showToast('Blank workspace created!')
  }

  // ─── AI Config Handlers ───────────────────────────────
  function updateAiConfig(patch: Partial<typeof aiConfig>) {
    const next = { ...aiConfig, ...patch }
    // When switching providers, set default model and base URL
    if (patch.provider && patch.provider !== aiConfig.provider) {
      if (patch.provider === 'openai') { next.model = 'gpt-4.1'; next.baseUrl = '' }
      else if (patch.provider === 'anthropic') { next.model = 'claude-sonnet-4-20250514'; next.baseUrl = '' }
      else if (patch.provider === 'openrouter') { next.model = 'anthropic/claude-sonnet-4'; next.baseUrl = 'https://openrouter.ai/api/v1' }
      else if (patch.provider === 'google') { next.model = 'gemini-2.5-flash-preview-05-20'; next.baseUrl = '' }
      else if (patch.provider === 'groq') { next.model = 'llama-3.3-70b-versatile'; next.baseUrl = 'https://api.groq.com/openai/v1' }
      else if (patch.provider === 'mistral') { next.model = 'mistral-large-latest'; next.baseUrl = '' }
      else if (patch.provider === 'none') { next.model = ''; next.apiKey = ''; next.baseUrl = '' }
      else next.model = ''
    }
    setAiConfig(next)
    saveAIConfig(next)
  }

  async function handleTestConnection() {
    if (aiConfig.provider === 'none') {
      setConnectionResult({ ok: false, msg: 'No AI provider selected.' })
      return
    }
    if (!aiConfig.apiKey) {
      setConnectionResult({ ok: false, msg: 'Please enter an API key.' })
      return
    }
    setTestingConnection(true)
    setConnectionResult(null)
    try {
      if (aiConfig.provider === 'openai') {
        const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1'
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to OpenAI successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': aiConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: aiConfig.model || 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Anthropic successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to OpenRouter successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'google') {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': aiConfig.apiKey },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Google AI successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Groq successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'custom') {
        const res = await fetch(aiConfig.baseUrl || '', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aiConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiConfig.customModel || 'test',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to custom endpoint!' })
        } else {
          setConnectionResult({ ok: false, msg: `HTTP ${res.status}: Check URL and credentials.` })
        }
      }
    } catch (e: any) {
      setConnectionResult({ ok: false, msg: e?.message || 'Network error. Check your connection and URL.' })
    } finally {
      setTestingConnection(false)
    }
  }

  // ─── Study Prefs Handlers ─────────────────────────────
  function updateStudyPrefs(patch: Partial<typeof studyPrefs>) {
    const next = { ...studyPrefs, ...patch }
    setStudyPrefsState(next)
    saveStudyPrefs(next)
  }

  // ─── Display Prefs Handlers ───────────────────────────
  function updateDisplayPrefs(patch: Partial<typeof displayPrefs>) {
    const next = { ...displayPrefs, ...patch }
    setDisplayPrefsState(next)
    saveDisplayPrefs(next)
  }

  // ─── Stats ────────────────────────────────────────────
  const stats = data ? {
    quizzes: data.pluginData?.quizHistory?.length || 0,
    courses: data.pluginData?.coachData?.courses?.length || 0,
    flashcards: data.pluginData?.coachData?.courses?.reduce((sum: number, c: any) => sum + (c.flashcards?.length || 0), 0) || 0,
    events: data.settings?.canvasEvents?.length || 0,
    srCards: data.pluginData?.srData?.cards?.length || 0,
    notes: (data.pluginData as any)?.notes?.length || 0,
    drawings: (data.pluginData as any)?.drawings?.length || 0,
    matchSets: (data.pluginData as any)?.matchSets?.length || 0,
    size: new Blob([JSON.stringify(data)]).size,
  } : null

  // ─── Section Header Component ─────────────────────────
  const SectionHeader = ({ id, icon, title, subtitle }: { id: SectionId; icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div
      style={cardHeaderStyle}
      onClick={() => toggleSection(id)}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
        </div>
      </div>
      <span style={{ color: 'var(--text-muted)', transition: 'transform 0.2s', transform: expanded[id] ? 'rotate(0)' : 'rotate(-90deg)' }}>
        <ChevronDown size={18} />
      </span>
    </div>
  )

  // ─── Render ───────────────────────────────────────────
  return (
    <div className="animate-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Settings size={24} /> Settings
      </h1>
      <p className="page-subtitle" style={{ marginBottom: 20 }}>Account, AI, preferences & data management</p>

      {/* ──────────── Update Banner ──────────── */}
      {updateInfo && (
        <div style={{ ...cardStyle, borderColor: 'var(--green)', borderWidth: 2 }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ArrowUpCircle size={18} style={{ color: 'var(--green)' }} />
                <span style={{ fontWeight: 700 }}>Update Available: v{updateInfo.version}</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 4, fontFamily: 'inherit' }}
                onClick={() => { dismissUpdate(); setUpdateInfo(null) }}
              >&times;</button>
            </div>
            {updateInfo.releaseNotes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{updateInfo.releaseNotes}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              {platform === 'android' && updateInfo.androidUrl && (
                <a href={updateInfo.androidUrl} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <Download size={14} /> Download APK
                </a>
              )}
              {platform === 'ios' && updateInfo.iosUrl && (
                <a href={updateInfo.iosUrl} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <Download size={14} /> App Store
                </a>
              )}
              {platform === 'web' && updateInfo.webUrl && (
                <a href={updateInfo.webUrl} className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
                  <RefreshCw size={14} /> Reload
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
           SECTION 1: Account & Cloud Sync
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="account" icon={<Cloud size={18} />} title="Account & Cloud Sync" subtitle={authUser ? authUser.email : 'Sign in to sync data across devices'} />
        {expanded.account && (
          <div style={cardBodyStyle}>
            {authLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 13, marginTop: 8 }}>Loading account...</p>
              </div>
            ) : authUser ? (
              /* ── Logged In View ── */
              <div>
                {/* User Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', marginBottom: 16 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'var(--accent, #666)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--bg-primary)', fontWeight: 700, fontSize: 18, flexShrink: 0,
                  }}>
                    {(authUser.displayName || authUser.email)?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {authUser.displayName && (
                      <div style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {authUser.displayName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {authUser.email}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'monospace' }}>
                      UID: {authUser.uid.slice(0, 12)}...
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {authUser.emailVerified ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={14} style={{ color: 'var(--green, #22c55e)' }} />
                        <span style={{ fontSize: 11, color: 'var(--green, #22c55e)', fontWeight: 600 }}>Verified</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Shield size={14} style={{ color: '#eab308' }} />
                        <span style={{ fontSize: 11, color: '#eab308', fontWeight: 600 }}>Unverified</span>
                      </div>
                    )}
                    {!authUser.emailVerified && (
                      <button className="btn btn-sm btn-secondary" onClick={async () => {
                        try { await sendVerificationEmail(); showToast('Verification email sent — check your inbox'); }
                        catch { showToast('Failed to send verification email'); }
                      }}>Verify Email</button>
                    )}
                  </div>
                </div>

                {/* ── #89 Customize Profile ── */}
                <div style={{ marginBottom: 16, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Customize Profile</div>
                  {/* Avatar emoji picker */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Avatar</div>
                    <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                      {['🧠','📚','🎯','⚡','🔥','🌟','💡','🏆','🎓','✨'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setProfileDraft(p => ({ ...p, avatarEmoji: emoji }))}
                          style={{
                            fontSize: 20, padding: '4px 6px', borderRadius: 8, cursor: 'pointer', border: '2px solid',
                            borderColor: profileDraft.avatarEmoji === emoji ? 'var(--accent)' : 'transparent',
                            background: profileDraft.avatarEmoji === emoji ? 'var(--accent-dim)' : 'transparent',
                          }}
                        >{emoji}</button>
                      ))}
                    </div>
                  </div>
                  {/* Display name */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Display Name</div>
                    <input
                      type="text"
                      value={profileDraft.customDisplayName ?? ''}
                      onChange={e => setProfileDraft(p => ({ ...p, customDisplayName: e.target.value }))}
                      placeholder={authUser?.displayName || 'Your name'}
                      maxLength={40}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                  </div>
                  {/* Bio */}
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Bio / tagline</div>
                    <input
                      type="text"
                      value={profileDraft.bio ?? ''}
                      onChange={e => setProfileDraft(p => ({ ...p, bio: e.target.value }))}
                      placeholder="e.g. Med student · Tokyo · 🍵"
                      maxLength={80}
                      style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }}
                    />
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const trimmed = {
                        ...profileDraft,
                        customDisplayName: profileDraft.customDisplayName?.trim() || undefined,
                        bio: profileDraft.bio?.trim() || undefined,
                      };
                      updatePluginData({ userProfile: trimmed });
                      showToast('Profile saved');
                    }}
                  >Save Profile</button>
                </div>

                {/* Sync Buttons */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, opacity: syncing ? 0.6 : 1 }}
                    disabled={syncing || !data}
                    onClick={handleSyncToCloud}
                  >
                    <Upload size={15} /> {syncing ? 'Syncing...' : 'Sync to Cloud'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, opacity: syncing ? 0.6 : 1 }}
                    disabled={syncing}
                    onClick={handleSyncFromCloud}
                  >
                    <Download size={15} /> {syncing ? 'Syncing...' : 'Sync from Cloud'}
                  </button>
                </div>

                {/* Last sync */}
                {lastSync && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={12} />
                    Last synced: {new Date(lastSync).toLocaleString()}
                  </div>
                )}

                {/* Auto-sync toggle */}
                <div style={rowStyle}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-sync</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically sync when data changes</div>
                  </div>
                  <button style={toggleStyle(autoSync)} onClick={handleAutoSyncToggle}>
                    <div style={toggleKnobStyle(autoSync)} />
                  </button>
                </div>

                {/* Your account syncs info */}
                <div style={{ ...warningBoxStyle, background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
                  <Cloud size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent, #3b82f6)' }} />
                  <span>Your account syncs your data to the cloud. Access your study progress, quizzes, and flashcards from any device by signing in.</span>
                </div>

                {/* ── Login History ── */}
                {(data?.pluginData?.loginHistory ?? []).length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>Recent logins</div>
                    {(data!.pluginData!.loginHistory!).slice(-5).reverse().map((entry, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{entry.device}</span>
                        <span>{new Date(entry.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom Firebase Config (Advanced) */}
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)' }}
                    onClick={() => setShowCustomFb(!showCustomFb)}
                  >
                    {showCustomFb ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <HardDrive size={13} />
                    <span style={{ fontWeight: 600 }}>Advanced: Use Your Own Firebase</span>
                    {isCustomFb && <span style={{ fontSize: 10, background: 'rgba(34,197,94,0.15)', color: 'var(--green, #22c55e)', padding: '1px 6px', borderRadius: 8 }}>Active</span>}
                  </div>
                  {showCustomFb && (
                    <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.5 }}>
                        Optional — create your own Firebase project at <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>console.firebase.google.com</a> for independent storage. Enable Email/Password auth, create Firestore & Storage.
                      </div>
                      {(['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'] as const).map(field => (
                        <div key={field} style={{ marginBottom: 6 }}>
                          <label style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{field}</label>
                          <input
                            type="text"
                            style={{ ...inputStyle, fontSize: 12, padding: '6px 8px' }}
                            placeholder={field}
                            value={customFbConfig[field]}
                            onChange={e => setCustomFbConfig(prev => ({ ...prev, [field]: e.target.value }))}
                          />
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (!customFbConfig.apiKey || !customFbConfig.projectId) {
                              showToast('At minimum, enter API Key and Project ID.')
                              return
                            }
                            saveFirebaseConfig(customFbConfig)
                          }}
                        >
                          <Check size={13} /> Save & Restart
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(k => localStorage.removeItem(`nousai-fb-${k}`))
                            showToast('Reset to default Firebase. Reloading...')
                            setTimeout(() => window.location.reload(), 500)
                          }}
                        >
                          Reset to Default
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sign out */}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 16, color: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
                  onClick={handleLogOut}
                >
                  <LogOut size={14} /> Sign Out
                </button>

                {/* ── Danger Zone ── */}
                <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red, #ef4444)', marginBottom: 8 }}>Danger Zone</div>
                  {!showDeleteConfirm ? (
                    <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', border: '1px solid rgba(239,68,68,0.3)' }}
                      onClick={() => setShowDeleteConfirm(true)}>
                      Delete Account
                    </button>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>Type DELETE to confirm account deletion. This cannot be undone.</div>
                      <input type="text" placeholder="Type DELETE" value={deleteConfirmText} onChange={e => setDeleteConfirmText(e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--red, #ef4444)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12, marginBottom: 8 }} />
                      <div className="flex gap-2">
                        <button className="btn btn-sm btn-secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}>Cancel</button>
                        <button
                          className="btn btn-sm"
                          style={{ background: deleteConfirmText === 'DELETE' ? '#ef4444' : 'rgba(239,68,68,0.3)', color: 'white' }}
                          disabled={deleteConfirmText !== 'DELETE'}
                          onClick={async () => {
                            const result = await deleteAccount();
                            if (result.error) { showToast(result.error); return; }
                            Object.keys(localStorage).forEach(k => { if (k.startsWith('nousai')) localStorage.removeItem(k); });
                            showToast('Account deleted');
                            window.location.reload();
                          }}>
                          Delete My Account
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Not Logged In View ── */
              <div>
                {/* Tabs */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  <button style={tabStyle(authTab === 'signin')} onClick={() => { setAuthTab('signin'); setAuthError(null) }}>
                    <LogIn size={14} /> Sign In
                  </button>
                  <button style={tabStyle(authTab === 'create')} onClick={() => { setAuthTab('create'); setAuthError(null) }}>
                    <UserPlus size={14} /> Create Account
                  </button>
                </div>

                {/* Error display */}
                {authError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', marginBottom: 14,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 'var(--radius-sm)', color: 'var(--red, #ef4444)', fontSize: 13,
                  }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    {authError}
                  </div>
                )}

                {/* Google OAuth */}
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', marginBottom: 12, gap: 8, justifyContent: 'center' }}
                  onClick={async () => {
                    const result = await signInWithGoogle();
                    if (result.error) showToast(result.error);
                    else showToast('Signed in with Google!');
                  }}
                >
                  <span style={{ fontSize: 16 }}>G</span> Continue with Google
                </button>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>— or —</div>

                {authTab === 'signin' ? (
                  /* ── Sign In Form ── */
                  <div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        style={inputStyle}
                        value={signInEmail}
                        onChange={e => setSignInEmail(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        autoComplete="email"
                      />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Password</label>
                      <input
                        type="password"
                        placeholder="Enter your password"
                        style={inputStyle}
                        value={signInPassword}
                        onChange={e => setSignInPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSignIn()}
                        autoComplete="current-password"
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', opacity: authBusy ? 0.6 : 1 }}
                      disabled={authBusy}
                      onClick={handleSignIn}
                    >
                      {authBusy ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</> : <><LogIn size={15} /> Sign In</>}
                    </button>
                    <div style={{ textAlign: 'center', marginTop: 10 }}>
                      <button className="btn btn-sm btn-secondary" style={{ width: '100%' }}
                        onClick={async () => {
                          const result = await signInAsGuest();
                          if (result.error) showToast(result.error);
                          else showToast('Signed in as guest. Your data is stored locally.');
                        }}>
                        Continue as Guest
                      </button>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Guest data is local only — sign up to sync across devices</div>
                    </div>
                  </div>
                ) : (
                  /* ── Create Account Form ── */
                  <div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Display Name</label>
                      <input
                        type="text"
                        placeholder="Your name (optional)"
                        style={inputStyle}
                        value={createName}
                        onChange={e => setCreateName(e.target.value)}
                        autoComplete="name"
                      />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Email</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        style={inputStyle}
                        value={createEmail}
                        onChange={e => setCreateEmail(e.target.value)}
                        autoComplete="email"
                      />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Password</label>
                      <input
                        type="password"
                        placeholder="At least 6 characters"
                        style={inputStyle}
                        value={createPassword}
                        onChange={e => setCreatePassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Confirm Password</label>
                      <input
                        type="password"
                        placeholder="Re-enter your password"
                        style={inputStyle}
                        value={createConfirm}
                        onChange={e => setCreateConfirm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
                        autoComplete="new-password"
                      />
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', opacity: authBusy ? 0.6 : 1 }}
                      disabled={authBusy}
                      onClick={handleCreateAccount}
                    >
                      {authBusy ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Creating...</> : <><UserPlus size={15} /> Create Account</>}
                    </button>
                  </div>
                )}

                {/* Info box */}
                <div style={{ ...warningBoxStyle, background: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.15)' }}>
                  <Cloud size={16} style={{ flexShrink: 0, marginTop: 1, color: 'var(--accent, #3b82f6)' }} />
                  <span>Your account syncs your data to the cloud. Sign in on any device to access your study progress, quizzes, flashcards, and more.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 2: AI Configuration
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader
          id="ai"
          icon={<Brain size={18} />}
          title="AI Configuration"
          subtitle={aiConfig.provider === 'none' ? 'No AI provider configured' : `${PROVIDER_INFO[aiConfig.provider]?.label || 'Custom'} - ${aiConfig.model || aiConfig.customModel || 'No model'}`}
        />
        {expanded.ai && (
          <div style={cardBodyStyle}>
            {/* Provider selector */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>AI Provider</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {(['none', 'openai', 'anthropic', 'openrouter'] as AIProvider[]).map(p => (
                  <button
                    key={p}
                    style={{
                      padding: '8px 4px',
                      fontSize: 12,
                      fontWeight: aiConfig.provider === p ? 700 : 500,
                      background: aiConfig.provider === p ? (PROVIDER_INFO[p]?.color || 'var(--accent, #fff)') : 'var(--bg-primary)',
                      color: aiConfig.provider === p ? '#fff' : 'var(--text-secondary)',
                      border: aiConfig.provider === p ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => updateAiConfig({ provider: p })}
                  >
                    {p === 'none' ? 'None' : PROVIDER_INFO[p]?.label || p}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
                {(['google', 'groq', 'mistral', 'custom'] as AIProvider[]).map(p => (
                  <button
                    key={p}
                    style={{
                      padding: '8px 4px',
                      fontSize: 12,
                      fontWeight: aiConfig.provider === p ? 700 : 500,
                      background: aiConfig.provider === p ? (PROVIDER_INFO[p]?.color || 'var(--accent, #fff)') : 'var(--bg-primary)',
                      color: aiConfig.provider === p ? '#fff' : 'var(--text-secondary)',
                      border: aiConfig.provider === p ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                    onClick={() => updateAiConfig({ provider: p })}
                  >
                    {PROVIDER_INFO[p]?.label || p}
                  </button>
                ))}
              </div>
            </div>

            {aiConfig.provider !== 'none' && (
              <>
                {/* Provider info badge */}
                {PROVIDER_INFO[aiConfig.provider]?.url && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14,
                    background: `${PROVIDER_INFO[aiConfig.provider].color}12`, border: `1px solid ${PROVIDER_INFO[aiConfig.provider].color}30`,
                    borderRadius: 'var(--radius-sm)', fontSize: 12,
                  }}>
                    <ExternalLink size={12} style={{ color: PROVIDER_INFO[aiConfig.provider].color }} />
                    <a href={PROVIDER_INFO[aiConfig.provider].url} target="_blank" rel="noopener noreferrer"
                      style={{ color: PROVIDER_INFO[aiConfig.provider].color, textDecoration: 'none' }}>
                      Get your {PROVIDER_INFO[aiConfig.provider].label} API key
                    </a>
                  </div>
                )}

                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Your queries are sent directly to {PROVIDER_INFO[aiConfig.provider]?.label || 'your AI provider'}. NousAI does not store or log your conversations.
                </div>

                {/* API Key */}
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>
                    <Key size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    API Key
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={PROVIDER_INFO[aiConfig.provider]?.keyPrefix ? `${PROVIDER_INFO[aiConfig.provider].keyPrefix}...` : 'Enter your API key'}
                      style={{ ...inputStyle, paddingRight: 40 }}
                      value={aiConfig.apiKey}
                      onChange={e => updateAiConfig({ apiKey: e.target.value })}
                    />
                    <button
                      style={{
                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'var(--text-muted)',
                        cursor: 'pointer', padding: 4, display: 'flex',
                      }}
                      onClick={() => setShowApiKey(!showApiKey)}
                      title={showApiKey ? 'Hide API key' : 'Show API key'}
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Model selector - OpenAI */}
                {aiConfig.provider === 'openai' && (
                  <>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Model</label>
                      <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                        {OPENAI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Base URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                      <input type="text" placeholder="https://api.openai.com/v1" style={inputStyle} value={aiConfig.baseUrl} onChange={e => updateAiConfig({ baseUrl: e.target.value })} />
                    </div>
                  </>
                )}

                {/* Model selector - Anthropic */}
                {aiConfig.provider === 'anthropic' && (
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Model</label>
                    <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                      {ANTHROPIC_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Model selector - OpenRouter */}
                {aiConfig.provider === 'openrouter' && (
                  <>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Model</label>
                      <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                        <optgroup label="Anthropic">
                          {OPENROUTER_MODELS.filter(m => m.value.startsWith('anthropic/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </optgroup>
                        <optgroup label="OpenAI">
                          {OPENROUTER_MODELS.filter(m => m.value.startsWith('openai/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </optgroup>
                        <optgroup label="Google">
                          {OPENROUTER_MODELS.filter(m => m.value.startsWith('google/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </optgroup>
                        <optgroup label="Meta">
                          {OPENROUTER_MODELS.filter(m => m.value.startsWith('meta-llama/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </optgroup>
                        <optgroup label="Other">
                          {OPENROUTER_MODELS.filter(m => !['anthropic/', 'openai/', 'google/', 'meta-llama/'].some(p => m.value.startsWith(p))).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </optgroup>
                      </select>
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Or enter a custom model ID</label>
                      <input type="text" placeholder="e.g. anthropic/claude-opus-4" style={inputStyle} value={aiConfig.customModel} onChange={e => updateAiConfig({ customModel: e.target.value })} />
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Browse all models at openrouter.ai/models</p>
                    </div>
                  </>
                )}

                {/* Model selector - Google */}
                {aiConfig.provider === 'google' && (
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Model</label>
                    <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                      {GOOGLE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Model selector - Groq */}
                {aiConfig.provider === 'groq' && (
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Model</label>
                    <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                      {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Model selector - Mistral */}
                {aiConfig.provider === 'mistral' && (
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Model</label>
                    <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                      {MISTRAL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Custom provider fields */}
                {aiConfig.provider === 'custom' && (
                  <>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>API URL</label>
                      <input type="text" placeholder="https://your-api.com/v1/chat/completions" style={inputStyle} value={aiConfig.baseUrl} onChange={e => updateAiConfig({ baseUrl: e.target.value })} />
                    </div>
                    <div style={fieldGroupStyle}>
                      <label style={labelStyle}>Model Name</label>
                      <input type="text" placeholder="model-name" style={inputStyle} value={aiConfig.customModel} onChange={e => updateAiConfig({ customModel: e.target.value })} />
                    </div>
                  </>
                )}

                {/* ─── Advanced Options ─── */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Settings size={12} /> Advanced Options
                  </div>

                  {/* Temperature */}
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Temperature: {aiConfig.temperature.toFixed(1)}</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42 }}>Precise</span>
                      <input
                        type="range" min="0" max="2" step="0.1"
                        value={aiConfig.temperature}
                        onChange={e => updateAiConfig({ temperature: parseFloat(e.target.value) })}
                        style={{ flex: 1, accentColor: PROVIDER_INFO[aiConfig.provider]?.color || 'var(--accent)' }}
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>Creative</span>
                    </div>
                  </div>

                  {/* Max Tokens */}
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Max Tokens</label>
                    <select style={selectStyle} value={aiConfig.maxTokens} onChange={e => updateAiConfig({ maxTokens: parseInt(e.target.value) })}>
                      {[256, 512, 1024, 2048, 4096, 8192, 16384].map(n => (
                        <option key={n} value={n}>{n.toLocaleString()} tokens</option>
                      ))}
                    </select>
                  </div>

                  {/* System Prompt */}
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>System Prompt <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                    <textarea
                      placeholder="Custom instructions for the AI (e.g. &quot;You are a helpful study tutor. Be concise and use examples.&quot;)"
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                      value={aiConfig.systemPrompt}
                      onChange={e => updateAiConfig({ systemPrompt: e.target.value })}
                    />
                  </div>

                  {/* Streaming toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Streaming Responses</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Show tokens as they generate</div>
                    </div>
                    <button style={toggleStyle(aiConfig.streaming)} onClick={() => updateAiConfig({ streaming: !aiConfig.streaming })}>
                      <div style={toggleKnobStyle(aiConfig.streaming)} />
                    </button>
                  </div>

                  {/* Response Format */}
                  <div style={fieldGroupStyle}>
                    <label style={labelStyle}>Response Format</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[{ v: 'text', l: 'Text' }, { v: 'json', l: 'JSON' }, { v: 'markdown', l: 'Markdown' }].map(f => (
                        <button
                          key={f.v}
                          style={{
                            flex: 1, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
                            fontWeight: aiConfig.responseFormat === f.v ? 700 : 500,
                            background: aiConfig.responseFormat === f.v ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                            color: aiConfig.responseFormat === f.v ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                            border: aiConfig.responseFormat === f.v ? 'none' : '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onClick={() => updateAiConfig({ responseFormat: f.v })}
                        >{f.l}</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Test Connection */}
                <div style={{ marginTop: 8, marginBottom: 8 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={testingConnection}
                    onClick={handleTestConnection}
                    style={{ opacity: testingConnection ? 0.6 : 1 }}
                  >
                    {testingConnection
                      ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing...</>
                      : <><Zap size={13} /> Test Connection</>}
                  </button>
                  {connectionResult && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 10,
                      fontSize: 12, color: connectionResult.ok ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)',
                    }}>
                      {connectionResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
                      {connectionResult.msg}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Warning */}
            <div style={warningBoxStyle}>
              <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <strong>API keys are stored locally in your browser.</strong> Never share your keys with anyone.
                {aiConfig.provider === 'openrouter' && <span style={{ display: 'block', marginTop: 4 }}>OpenRouter routes to 200+ models from one API key — great for trying different models.</span>}
              </div>
            </div>

            {/* What uses AI */}
            <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={12} /> Features powered by AI
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['Quiz Generation', 'AI Tutoring', 'Analogy Engine', 'Course Generation', 'OCR Enhancement', 'Flashcard Creation', 'Study Plans', 'Language Practice'].map(f => (
                  <span key={f} style={{
                    fontSize: 11, padding: '3px 8px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                  }}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 2b: Feature AI Slot Overrides
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader
          id="ai"
          icon={<Zap size={18} />}
          title="AI Providers — Feature Overrides"
          subtitle="Assign different AI providers to specific features (optional)"
        />
        {expanded.ai && (
          <div style={cardBodyStyle}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
              Each feature can use a different AI provider and model. Leave a feature on "Using Default" to inherit from the Default configuration above.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
              {SLOTS.map(slot => {
                const cfg = slotConfigs[slot]
                const info = SLOT_INFO[slot]
                const isConfigured = !!cfg.provider
                const isOpen = expandedSlot === slot
                return (
                  <div key={slot} style={{
                    border: `1px solid ${isConfigured ? 'var(--accent, #F5A623)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    opacity: 1,
                  }}>
                    {/* Tile header */}
                    <button
                      onClick={() => setExpandedSlot(isOpen ? null : slot)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', background: 'var(--bg-primary)', border: 'none',
                        cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{info.label}</div>
                        {isConfigured
                          ? <div style={{ fontSize: 11, color: PROVIDER_INFO[cfg.provider]?.color || 'var(--accent)', marginTop: 1 }}>
                              {PROVIDER_INFO[cfg.provider]?.label || cfg.provider} {cfg.model ? `— ${cfg.model}` : ''}
                            </div>
                          : <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Using Default</div>
                        }
                      </div>
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>

                    {/* Tile body */}
                    {isOpen && (
                      <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 10px' }}>{info.description}</p>

                        {/* Provider */}
                        <div style={{ ...fieldGroupStyle }}>
                          <label style={labelStyle}>Provider</label>
                          <select
                            style={selectStyle}
                            value={cfg.provider || ''}
                            onChange={e => updateSlotConfig(slot, { provider: e.target.value })}
                          >
                            <option value="">Using Default</option>
                            {(['openai', 'anthropic', 'openrouter', 'google', 'groq', 'mistral', 'custom'] as AIProvider[]).map(p => (
                              <option key={p} value={p}>{PROVIDER_INFO[p]?.label || p}</option>
                            ))}
                          </select>
                        </div>

                        {cfg.provider && (
                          <>
                            {/* API Key */}
                            <div style={fieldGroupStyle}>
                              <label style={labelStyle}>API Key</label>
                              <input
                                type="password"
                                placeholder={PROVIDER_INFO[cfg.provider]?.keyPrefix ? `${PROVIDER_INFO[cfg.provider].keyPrefix}...` : 'Enter API key'}
                                style={inputStyle}
                                value={cfg.apiKey}
                                onChange={e => updateSlotConfig(slot, { apiKey: e.target.value })}
                              />
                            </div>

                            {/* Model */}
                            {slot === 'ocr' && cfg.provider === 'mistral' ? (
                              <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Model <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(chat, not OCR engine)</span></label>
                                <select style={selectStyle} value={cfg.model} onChange={e => updateSlotConfig(slot, { model: e.target.value })}>
                                  {MISTRAL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                  OCR always uses mistral-ocr-latest. This model is used for card generation.
                                </p>
                              </div>
                            ) : (
                              <div style={fieldGroupStyle}>
                                <label style={labelStyle}>Model</label>
                                <input
                                  type="text"
                                  placeholder="e.g. gpt-4.1, claude-sonnet-4..."
                                  style={inputStyle}
                                  value={cfg.model}
                                  onChange={e => updateSlotConfig(slot, { model: e.target.value })}
                                />
                              </div>
                            )}

                            {/* Clear override */}
                            <button
                              onClick={() => clearSlotConfig(slot)}
                              style={{
                                fontSize: 12, color: 'var(--text-muted)', background: 'none',
                                border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                                textUnderlineOffset: 2,
                              }}
                            >
                              Clear override (revert to Default)
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 3: Study Preferences
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="study" icon={<BookOpen size={18} />} title="Study Preferences" subtitle="Quiz, flashcard, timer & learning defaults" />
        {expanded.study && (
          <div style={cardBodyStyle}>
            {/* Daily XP Goal */}
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Daily XP Goal</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{studyPrefs.dailyXpGoal} XP per day</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-primary)', display: 'flex' }}
                  onClick={() => updateStudyPrefs({ dailyXpGoal: Math.max(50, studyPrefs.dailyXpGoal - 50) })}
                >
                  <Minus size={14} />
                </button>
                <span style={{ fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'center' }}>{studyPrefs.dailyXpGoal}</span>
                <button
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-primary)', display: 'flex' }}
                  onClick={() => updateStudyPrefs({ dailyXpGoal: Math.min(500, studyPrefs.dailyXpGoal + 50) })}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Quiz Question Count */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Default Quiz Questions</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Questions per quiz session</div>
              </div>
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
                value={studyPrefs.quizQuestionCount}
                onChange={e => updateStudyPrefs({ quizQuestionCount: parseInt(e.target.value) })}
              >
                {[5, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            {/* Flashcard Auto-Flip */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Flashcard Auto-Flip</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-reveal answer after delay</div>
              </div>
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
                value={studyPrefs.flashcardAutoFlip}
                onChange={e => updateStudyPrefs({ flashcardAutoFlip: e.target.value })}
              >
                <option value="off">Off</option>
                <option value="3">3 sec</option>
                <option value="5">5 sec</option>
                <option value="10">10 sec</option>
              </select>
            </div>

            {/* Pomodoro Work Duration */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Pomodoro Work</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Focus session length</div>
              </div>
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
                value={studyPrefs.pomoWork}
                onChange={e => updateStudyPrefs({ pomoWork: parseInt(e.target.value) })}
              >
                {[15, 20, 25, 30, 45].map(n => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>

            {/* Pomodoro Break Duration */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Pomodoro Break</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Break session length</div>
              </div>
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: 80 }}
                value={studyPrefs.pomoBreak}
                onChange={e => updateStudyPrefs({ pomoBreak: parseInt(e.target.value) })}
              >
                {[3, 5, 10].map(n => <option key={n} value={n}>{n} min</option>)}
              </select>
            </div>

            {/* Language */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Language</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Preferred study language</div>
              </div>
              <select
                style={{ ...selectStyle, width: 'auto', minWidth: 110 }}
                value={studyPrefs.language}
                onChange={e => updateStudyPrefs({ language: e.target.value })}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Difficulty */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Difficulty</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Default quiz difficulty</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {DIFFICULTIES.map(d => (
                  <button
                    key={d}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
                      fontWeight: studyPrefs.difficulty === d ? 700 : 500,
                      background: studyPrefs.difficulty === d ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                      color: studyPrefs.difficulty === d ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                      border: studyPrefs.difficulty === d ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onClick={() => updateStudyPrefs({ difficulty: d })}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Effects */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {studyPrefs.soundEffects ? <Volume2 size={16} /> : <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Sound Effects</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Audio feedback for actions</div>
                </div>
              </div>
              <button
                style={toggleStyle(studyPrefs.soundEffects)}
                onClick={() => updateStudyPrefs({ soundEffects: !studyPrefs.soundEffects })}
              >
                <div style={toggleKnobStyle(studyPrefs.soundEffects)} />
              </button>
            </div>

            {/* Keyboard Shortcuts */}
            <div style={{ ...rowStyle, borderBottom: 'none', flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Keyboard Shortcuts</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a key to rebind, press new key</div>
                </div>
                <button className="btn btn-sm" onClick={() => { resetAllShortcuts(); showToast('Shortcuts reset to defaults'); }} style={{ fontSize: 11 }}>
                  <RefreshCw size={11} /> Reset All
                </button>
              </div>
              {(['flashcards', 'quiz'] as const).map(cat => (
                <div key={cat}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                    {cat === 'flashcards' ? 'Flashcards' : 'Quizzes'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {SHORTCUT_DEFS.filter(s => s.category === cat).map(s => (
                      <ShortcutRow key={s.id} shortcut={s} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 4: Display & Theme
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="display" icon={<Palette size={18} />} title="Display & Theme" subtitle={einkMode ? 'E-Ink mode' : 'Standard mode'} />
        {expanded.display && (
          <div style={cardBodyStyle}>
            {/* ── #38 Font Family ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Font Family</div>
              <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                {[
                  { label: 'Default', val: 'inherit', css: 'inherit' },
                  { label: 'Inter', val: 'inter', css: "'Inter', system-ui, sans-serif" },
                  { label: 'Sora', val: 'sora', css: "'Sora', system-ui, sans-serif" },
                  { label: 'Nunito', val: 'nunito', css: "'Nunito', system-ui, sans-serif", gfont: 'Nunito:wght@400;600;700' },
                  { label: 'Lato', val: 'lato', css: "'Lato', system-ui, sans-serif", gfont: 'Lato:wght@400;700' },
                  { label: 'Serif', val: 'serif', css: 'Georgia, serif' },
                  { label: 'Mono', val: 'mono', css: 'ui-monospace, monospace' },
                  { label: 'OpenDyslexic', val: 'dyslexic', css: 'OpenDyslexic, sans-serif' },
                ].map(({ label, val, css, gfont } : { label: string; val: string; css: string; gfont?: string }) => {
                  const cur = localStorage.getItem('nousai-pref-fontfamily') || 'inherit';
                  return (
                    <button key={val} className={`btn btn-sm ${cur === val ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontFamily: css }}
                      onClick={() => {
                        localStorage.setItem('nousai-pref-fontfamily', val);
                        if (val === 'dyslexic' && !document.getElementById('dyslexic-font-link')) {
                          const link = document.createElement('link');
                          link.id = 'dyslexic-font-link';
                          link.rel = 'stylesheet';
                          link.href = 'https://fonts.cdnfonts.com/css/opendyslexic';
                          document.head.appendChild(link);
                        }
                        if (gfont && !document.getElementById(`gfont-${val}`)) {
                          const link = document.createElement('link');
                          link.id = `gfont-${val}`;
                          link.rel = 'stylesheet';
                          link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(gfont)}&display=swap`;
                          document.head.appendChild(link);
                        }
                        document.documentElement.style.setProperty('--font-family-body', css);
                        showToast(`Font: ${label}`);
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── #39 Density ── */}
            <div style={{ ...rowStyle, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>UI Density</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Compact mode reduces padding for more content</div>
              </div>
              <div className="flex gap-2">
                {[{ label: 'Comfortable', val: '' }, { label: 'Compact', val: 'compact' }].map(({ label, val }) => {
                  const cur = localStorage.getItem('nousai-pref-density') || '';
                  return (
                    <button key={val} className={`btn btn-sm ${cur === val ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => {
                        localStorage.setItem('nousai-pref-density', val);
                        if (val) document.documentElement.setAttribute('data-density', val);
                        else document.documentElement.removeAttribute('data-density');
                        showToast(`Density: ${label}`);
                      }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Standard / E-Ink */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Display Mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className={`btn ${!einkMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setEinkMode(false)}
                >
                  <Monitor size={16} /> Standard
                </button>
                <button
                  className={`btn ${einkMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setEinkMode(true)}
                >
                  <Tablet size={16} /> E-Ink / Boox
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                E-Ink mode removes animations, increases contrast, and enlarges touch targets for e-ink displays.
              </p>
            </div>

            {/* Font Size */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Font Size</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adjust text size across the app</div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['small', 'medium', 'large'] as const).map(s => (
                  <button
                    key={s}
                    style={{
                      padding: '6px 12px', fontSize: s === 'small' ? 11 : s === 'medium' ? 13 : 15,
                      fontWeight: displayPrefs.fontSize === s ? 700 : 500,
                      fontFamily: 'inherit',
                      background: displayPrefs.fontSize === s ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                      color: displayPrefs.fontSize === s ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                      border: displayPrefs.fontSize === s ? 'none' : '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onClick={() => updateDisplayPrefs({ fontSize: s })}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Compact Mode */}
            <div style={rowStyle}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Compact Mode</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Reduces padding and spacing</div>
              </div>
              <button
                style={toggleStyle(displayPrefs.compactMode)}
                onClick={() => updateDisplayPrefs({ compactMode: !displayPrefs.compactMode })}
              >
                <div style={toggleKnobStyle(displayPrefs.compactMode)} />
              </button>
            </div>

            {/* Accent Color */}
            <div style={{ ...rowStyle }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Accent Color</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Customize the app's accent color.</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="color"
                    value={displayPrefs.accentColor}
                    onChange={e => updateDisplayPrefs({ accentColor: e.target.value })}
                    style={{ width: 36, height: 28, borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', background: 'none', padding: 2 }}
                    title="Pick accent color"
                  />
                  <button
                    onClick={() => updateDisplayPrefs({ accentColor: '#F5A623' })}
                    style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >Reset</button>
                </div>
            </div>

            {/* Unlockable Theme Presets */}
            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Theme Presets</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unlock color themes by leveling up.</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {THEME_PRESETS.map(t => {
                  const userLevel = getLevel(data?.pluginData?.gamificationData?.xp ?? 0)
                  const unlocked = userLevel >= t.unlockLevel
                  const active = displayPrefs.accentColor === t.color
                  return (
                    <button key={t.id}
                      disabled={!unlocked}
                      title={unlocked ? t.name : `Unlock at level ${t.unlockLevel}`}
                      onClick={() => unlocked && updateDisplayPrefs({ accentColor: t.color })}
                      style={{
                        width: 24, height: 24, borderRadius: '50%', border: active ? '2px solid var(--text-primary)' : '2px solid transparent',
                        background: unlocked ? t.color : 'var(--bg-secondary)', cursor: unlocked ? 'pointer' : 'not-allowed',
                        opacity: unlocked ? 1 : 0.35, position: 'relative', flexShrink: 0,
                        boxShadow: active ? `0 0 8px ${t.color}80` : 'none',
                      }}
                    />
                  )
                })}
              </div>
            </div>

            {/* Theme toggle */}
            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Theme</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Switch between dark and light mode.</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['dark', 'light', 'system'] as const).map(t => {
                  const active = (data?.settings?.theme ?? 'dark') === t
                  return (
                    <button
                      key={t}
                      onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, theme: t } }))}
                      style={{
                        padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                        border: active ? '1px solid var(--color-accent, #F5A623)' : '1px solid var(--border)',
                        background: active ? 'rgba(245,166,35,0.15)' : 'var(--bg-secondary)',
                        color: active ? 'var(--color-accent, #F5A623)' : 'var(--text-muted)',
                        textTransform: 'capitalize',
                      }}
                    >{t}</button>
                  )
                })}
              </div>
            </div>

            {/* Theme Presets */}
            {(() => {
              const CANVAS_THEME_PRESETS = [
                { id: 'default', label: 'Default', color: '#ffffff' },
                { id: 'amber',   label: 'Amber',   color: '#F5A623' },
                { id: 'forest',  label: 'Forest',  color: '#4ade80' },
                { id: 'ocean',   label: 'Ocean',   color: '#38bdf8' },
                { id: 'dusk',    label: 'Dusk',    color: '#a78bfa' },
              ]
              const active = (data?.settings?.themePreset as string) ?? 'default'
              return (
                <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>🎨 Color Preset</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Choose a color theme for the app.</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CANVAS_THEME_PRESETS.map(p => (
                      <button
                        key={p.id}
                        title={p.label}
                        onClick={() => setData(prev => ({ ...prev, settings: { ...prev.settings, themePreset: p.id === 'default' ? '' : p.id } }))}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                          fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
                          border: active === p.id || (p.id === 'default' && !active)
                            ? `1px solid ${p.color}` : '1px solid var(--border)',
                          background: active === p.id || (p.id === 'default' && !active)
                            ? `${p.color}22` : 'var(--bg-secondary)',
                          color: active === p.id || (p.id === 'default' && !active)
                            ? p.color : 'var(--text-muted)',
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Auto Dark Mode Schedule */}
            {(() => {
              const sched = (data?.settings?.autoDarkSchedule as { enabled?: boolean; startTime?: string; endTime?: string }) ?? {}
              const enabled = sched.enabled ?? false
              const startTime = sched.startTime ?? '20:00'
              const endTime = sched.endTime ?? '07:00'
              const update = (patch: Record<string, unknown>) => setData(prev => ({
                ...prev,
                settings: { ...prev.settings, autoDarkSchedule: { enabled, startTime, endTime, ...patch } }
              }))
              return (
                <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>🌙 Auto Dark Schedule</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically switch to dark mode on a schedule.</div>
                    </div>
                    <button style={toggleStyle(enabled)} onClick={() => update({ enabled: !enabled })}>
                      <div style={toggleKnobStyle(enabled)} />
                    </button>
                  </div>
                  {enabled && (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 12 }}>
                      <label style={{ color: 'var(--text-secondary)' }}>Dark from</label>
                      <input type="time" value={startTime} onChange={e => update({ startTime: e.target.value })}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12 }} />
                      <label style={{ color: 'var(--text-secondary)' }}>to</label>
                      <input type="time" value={endTime} onChange={e => update({ endTime: e.target.value })}
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', padding: '2px 6px', fontSize: 12 }} />
                    </div>
                  )}
                </div>
              )
            })()}

            {/* High Contrast */}
            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>⬛ High Contrast</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enhance contrast for better readability.</div>
              </div>
              <button style={toggleStyle(displayPrefs.highContrast)} onClick={() => updateDisplayPrefs({ highContrast: !displayPrefs.highContrast })}>
                <div style={toggleKnobStyle(displayPrefs.highContrast)} />
              </button>
            </div>

            {/* Color-Blind Safe */}
            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🔵 Color-Blind Safe</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Replaces red/green with orange/blue.</div>
              </div>
              <button style={toggleStyle(displayPrefs.colorBlind)} onClick={() => updateDisplayPrefs({ colorBlind: !displayPrefs.colorBlind })}>
                <div style={toggleKnobStyle(displayPrefs.colorBlind)} />
              </button>
            </div>

            {/* Reduced Motion */}
            <div style={{ ...rowStyle }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>⏸ Reduced Motion</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Minimizes animations across the app.</div>
              </div>
              <button style={toggleStyle(displayPrefs.reducedMotion)} onClick={() => updateDisplayPrefs({ reducedMotion: !displayPrefs.reducedMotion })}>
                <div style={toggleKnobStyle(displayPrefs.reducedMotion)} />
              </button>
            </div>

            {/* Beta Mode */}
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>🧪 Beta Mode</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Preview experimental features. Your data is always safe — switch back anytime.
                </div>
              </div>
              <button
                style={toggleStyle(betaMode)}
                onClick={() => setBetaMode(!betaMode)}
              >
                <div style={toggleKnobStyle(betaMode)} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION: Permissions
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="permissions" icon={<Shield size={18} />} title="Permissions" subtitle="PWA feature access" />
        {expanded.permissions && (
          <div style={cardBodyStyle}>
            {/* Notifications */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Bell size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Notifications</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Timer alerts & review reminders</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={permStatus?.notification === 'granted' ? 'granted' : permStatus?.notification === 'denied' ? 'denied' : permStatus?.notification === 'unsupported' ? 'na' : 'notyet'} />
                {permStatus?.notification === 'prompt' && (
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
                    const r = await Notification.requestPermission()
                    setPermStatus(await checkAllPermissions())
                    if (r === 'granted') showToast('Notifications enabled')
                  }}>Enable</button>
                )}
              </div>
            </div>

            {/* ── #90 Notification Preferences ── */}
            {notifPerms.show && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Notification Preferences</div>
                {([
                  { key: 'reviewReminders' as const, label: 'Daily review reminders', desc: 'Remind when flashcards are due' },
                  { key: 'streakAlerts' as const, label: 'Streak break alerts', desc: 'Alert when streak is at risk' },
                  { key: 'pomodoroAlerts' as const, label: 'Pomodoro complete', desc: 'Notify when each session ends' },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} style={rowStyle}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
                    </div>
                    <button style={toggleStyle(notifPerms[key])} onClick={() => setNotifPerms(p => ({ ...p, [key]: !p[key] }))}>
                      <div style={toggleKnobStyle(notifPerms[key])} />
                    </button>
                  </div>
                ))}
                <div style={{ ...rowStyle, marginTop: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Reminder time</div>
                  <input type="time" value={notifPerms.reminderTime} onChange={e => setNotifPerms(p => ({ ...p, reminderTime: e.target.value }))}
                    style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
                  />
                </div>
                <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }}
                  onClick={() => { localStorage.setItem('nousai-notif-prefs', JSON.stringify(notifPerms)); showToast('Notification preferences saved'); }}>
                  Save
                </button>
              </div>
            )}

            {/* ── FCM Push Notifications ── */}
            {isFCMSupported() && (
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Push Notifications (FCM)</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.5 }}>
                  Get real push notifications on your device — even when the app is closed.
                  Requires a free Firebase VAPID key from your Firebase project console.
                </div>
                {!vapidKey && (
                  <div style={{ marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Paste VAPID key (Firebase → Project Settings → Cloud Messaging)"
                      value={vapidKey}
                      onChange={e => { setVapidKey(e.target.value); localStorage.setItem('nousai-fcm-vapid', e.target.value); }}
                      style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 11 }}
                    />
                  </div>
                )}
                {fcmToken ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--green, #22c55e)', fontWeight: 600 }}>✓ Push notifications active</span>
                    <button className="btn btn-sm btn-secondary" onClick={() => { clearFCMToken(); setFcmToken(null); showToast('Push notifications disabled'); }}>Disable</button>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!vapidKey}
                    onClick={async () => {
                      const result = await requestFCMPermission(vapidKey);
                      if (result.token) { setFcmToken(result.token); showToast('Push notifications enabled!'); }
                      else showToast(result.error || 'Failed to enable push notifications');
                    }}
                  >Enable Push Notifications</button>
                )}
              </div>
            )}

            {/* Microphone */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Mic size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Microphone</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Speech-to-text dictation</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={permStatus?.microphone === 'granted' ? 'granted' : permStatus?.microphone === 'denied' ? 'denied' : permStatus?.microphone === 'unsupported' ? 'na' : 'notyet'} />
                {permStatus?.microphone === 'prompt' && (
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
                    const r = await requestMicrophone()
                    setPermStatus(await checkAllPermissions())
                    if (r.granted) showToast('Microphone access granted')
                    else if (r.error) showToast(r.error)
                  }}>Enable</button>
                )}
              </div>
            </div>

            {/* Screen Wake Lock */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sun size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Screen Wake Lock</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Keep screen on during timer</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={!isWakeLockSupported() ? 'na' : permWakelock ? 'granted' : 'notyet'} />
                {isWakeLockSupported() && (
                  <button
                    style={toggleStyle(permWakelock)}
                    onClick={() => { const v = !permWakelock; setPermWakelock(v); setPermPref('wakelock', v) }}
                  >
                    <div style={toggleKnobStyle(permWakelock)} />
                  </button>
                )}
              </div>
            </div>

            {/* Persistent Storage */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardDrive size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Persistent Storage</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Prevent browser from clearing data</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={!isPersistentStorageSupported() ? 'na' : permStatus?.persistentStorage === true ? 'granted' : 'notyet'} />
                {isPersistentStorageSupported() && permStatus?.persistentStorage !== true && (
                  <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={async () => {
                    const r = await requestPersistentStorage()
                    setPermStatus(await checkAllPermissions())
                    showToast(r.granted ? 'Storage persisted' : r.error || 'Not granted')
                  }}>Request</button>
                )}
              </div>
            </div>

            {/* Background Sync */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Background Sync</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sync data when back online</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={!isBackgroundSyncSupported() ? 'na' : permBgsync ? 'granted' : 'notyet'} />
                {isBackgroundSyncSupported() && (
                  <button
                    style={toggleStyle(permBgsync)}
                    onClick={async () => {
                      const v = !permBgsync
                      setPermBgsync(v)
                      setPermPref('bgsync', v)
                      if (v) {
                        const r = await registerBackgroundSync()
                        if (!r.granted) showToast(r.error || 'Sync registration failed')
                        else showToast('Background sync enabled')
                      }
                    }}
                  >
                    <div style={toggleKnobStyle(permBgsync)} />
                  </button>
                )}
              </div>
            </div>

            {/* Clipboard */}
            <div style={rowStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clipboard size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Clipboard Access</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Copy/paste flashcards & notes</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PermBadge status={!isClipboardSupported() ? 'na' : permClipboard ? 'granted' : 'notyet'} />
                {isClipboardSupported() && (
                  <button
                    style={toggleStyle(permClipboard)}
                    onClick={() => { const v = !permClipboard; setPermClipboard(v); setPermPref('clipboard', v) }}
                  >
                    <div style={toggleKnobStyle(permClipboard)} />
                  </button>
                )}
              </div>
            </div>

            {/* File System Access */}
            <div style={{ ...rowStyle, borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>File System Access</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Import/export study materials</div>
                </div>
              </div>
              <PermBadge status={isFileSystemAccessSupported() ? 'granted' : 'na'} />
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 5: Data Management
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="data" icon={<Database size={18} />} title="Data Management" subtitle={stats ? formatBytes(stats.size) + ' stored' : 'No data loaded'} />
        {expanded.data && (
          <div style={cardBodyStyle}>
            {/* Import / Export */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={handleImport} />
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()} style={{ flex: '1 1 auto' }}>
                <Upload size={15} /> Import data.json
              </button>
              <button className="btn btn-secondary" onClick={handleExport} style={{ flex: '1 1 auto' }}>
                <Download size={15} /> Export Data
              </button>
            </div>

            {/* Storage warning when approaching browser limit */}
            {stats && stats.size > 4_000_000 && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.4)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--accent)' }}>
                ⚠️ Storage is {formatBytes(stats.size)} — approaching the browser limit (~5–10 MB). Consider exporting a backup and clearing old data to free space.
              </div>
            )}

            {/* Auto-Backup */}
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={rowStyle}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Backup</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Save a local backup every hour</div>
                </div>
                <button style={toggleStyle(autoBackup)} onClick={handleToggleAutoBackup}>
                  <div style={toggleKnobStyle(autoBackup)} />
                </button>
              </div>
              {backupFolder && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <FolderPlus size={13} />
                    <span>Folder: <strong>{backupFolder}</strong></span>
                    <button onClick={handleClearBackupFolder} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, textDecoration: 'underline' }}>Change</button>
                  </div>
                  {lastBackup && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <span>Last backup: {new Date(lastBackup).toLocaleString()}</span>
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handleBackupNow} disabled={backingUp}>
                    <HardDrive size={13} /> {backingUp ? 'Saving...' : 'Backup Now'}
                  </button>
                </div>
              )}
              {!backupFolder && (
                <button className="btn btn-secondary btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handlePickBackupFolder}>
                  <FolderPlus size={13} /> Choose Backup Folder
                </button>
              )}
            </div>

            {/* Create Blank Workspace */}
            <button
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={handleCreateBlankWorkspace}
            >
              <FolderPlus size={15} /> Create Blank Workspace
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -10, marginBottom: 16 }}>
              Start fresh without importing. Creates an empty workspace with default settings.
            </p>

            {/* Data Overview Stats */}
            {stats && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Database size={12} /> Data Overview
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                  <StatRow label="Quiz attempts" value={stats.quizzes} />
                  <StatRow label="Courses" value={stats.courses} />
                  <StatRow label="Flashcards" value={stats.flashcards} />
                  <StatRow label="Canvas events" value={stats.events} />
                  <StatRow label="SR cards" value={stats.srCards} />
                  <StatRow label="Notes" value={stats.notes} />
                  <StatRow label="Drawings" value={stats.drawings} />
                  <StatRow label="Match sets" value={stats.matchSets} />
                  <StatRow label="Data size" value={formatBytes(stats.size)} />
                </div>
              </div>
            )}

            {/* Danger Zone */}
            <div style={{
              padding: 14,
              background: 'rgba(239,68,68,0.04)',
              border: '1px solid rgba(239,68,68,0.15)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <AlertTriangle size={14} style={{ color: 'var(--red, #ef4444)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--red, #ef4444)' }}>Danger Zone</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                Clear all locally stored data. This action cannot be undone.
              </p>
              <button
                className="btn btn-sm"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red, #ef4444)', border: '1px solid var(--red, #ef4444)' }}
                onClick={handleClear}
              >
                <Trash2 size={14} /> Clear All Local Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION: Extensions & Integrations
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="extensions" icon={<Globe size={18} />} title="Extensions & Integrations" subtitle="Connect external tools" />
        {expanded.extensions && (
          <div style={cardBodyStyle}>
            {/* Chrome Extension */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#4285f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Globe size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>NousAI Chrome Extension</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-sync Canvas grades, syllabus & assignments</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
                Install the NousAI Chrome Extension to automatically import your course data from Canvas LMS.
                The extension scans your Canvas dashboard and sends grades, assignments, and syllabus info to NousAI.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { showToast('Extension sync triggered! Open Canvas in Chrome to push data.') }}>
                  <RefreshCw size={13} /> Sync from Extension
                </button>
                <a href="https://chromewebstore.google.com/search/NousAI%20Canvas" target="_blank" rel="noopener noreferrer"
                  className="btn btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', background: '#4285f4', color: '#fff', border: 'none' }}>
                  <ExternalLink size={13} /> Get Extension
                </a>
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {/* Data Import/Export */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Data Import/Export</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Import or export your study data</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
                Import a data.json backup file to restore courses, quizzes, flashcards, and study history, or export your current data.
              </p>
              <button className="btn btn-secondary btn-sm" onClick={() => { setExpanded(p => ({ ...p, extensions: false, data: true })); showToast('Scroll to Data section to import') }}>
                <Upload size={13} /> Go to Import Data
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {/* Canvas LMS */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#e53e3e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Canvas LMS (Direct)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Connect directly to Canvas API</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Canvas URL:</label>
                  <input type="text" placeholder="https://canvas.unl.edu" value={data?.settings?.canvasUrl || ''} onChange={e => {
                    const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasUrl: val } }))
                  }} style={{ ...inputStyle, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>Canvas API Token:</label>
                  <input type="password" placeholder="Enter your Canvas API token" value={data?.settings?.canvasToken || ''} onChange={e => {
                    const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasToken: val } }))
                  }} style={{ ...inputStyle, fontSize: 12 }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 11 }}>iCal Feed URL (for calendar events):</label>
                  <input type="text" placeholder="https://canvas.unl.edu/feeds/calendars/..." value={data?.settings?.canvasIcalUrl || ''} onChange={e => {
                    const val = e.target.value; if (setData) setData(prev => ({ ...prev, settings: { ...prev.settings, canvasIcalUrl: val } }))
                  }} style={{ ...inputStyle, fontSize: 12 }} />
                </div>
                {/* Sync buttons */}
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={handleCanvasSync}
                    disabled={canvasSyncing}
                    className="btn btn-primary btn-sm" style={{ fontSize: 11, gap: 4 }}>
                    <RefreshCw size={11} /> {canvasSyncing ? 'Syncing...' : 'Sync Canvas'}
                  </button>
                </div>
                {canvasSyncStatus && (
                  <div style={{
                    marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
                    background: canvasSyncStatus.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    color: canvasSyncStatus.ok ? '#22c55e' : '#ef4444',
                    border: `1px solid ${canvasSyncStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}>
                    {canvasSyncStatus.message}
                    {canvasSyncStatus.lastSync && (
                      <span style={{ opacity: 0.7 }}> · {canvasSyncStatus.lastSync}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {/* Omi AI Wearable */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1a1a2e', border: '1px solid #F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones size={18} color="#F5A623" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Omi AI Wearable</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sync conversations & transcriptions</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
                Connect your Omi device to sync recorded conversations into your NousAI library.
                Get your Developer API key from the Omi app: <strong>Settings → Developer → Create Key</strong>
              </p>
              {omiApiKey ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                    ✓ API key configured ({omiApiKey.slice(0, 12)}…)
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() => {
                      localStorage.removeItem('nousai-omi-api-key');
                      setOmiApiKey('');
                      setOmiKeyInput('');
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input
                    type="password"
                    placeholder="omi_dev_..."
                    value={omiKeyInput}
                    onChange={e => setOmiKeyInput(e.target.value)}
                    style={{ ...inputStyle, fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1, fontSize: 11 }}
                      disabled={omiTesting || !omiKeyInput.trim()}
                      onClick={async () => {
                        const key = omiKeyInput.trim();
                        if (!key) return;
                        setOmiTesting(true);
                        try {
                          const res = await fetch(`/api/omi-proxy?endpoint=user%2Fconversations&limit=1`, {
                            headers: { 'x-omi-key': key },
                          });
                          if (res.ok) {
                            localStorage.setItem('nousai-omi-api-key', key);
                            setOmiApiKey(key);
                            setOmiKeyInput('');
                            showToast('Omi connected! Go to AI Tools → Omi to sync.');
                          } else {
                            const err = await res.json().catch(() => ({})) as { error?: string };
                            showToast(`Connection failed: ${err.error || res.status}`);
                          }
                        } catch {
                          showToast('Connection failed. Check your API key.');
                        } finally {
                          setOmiTesting(false);
                        }
                      }}
                    >
                      <Key size={12} /> {omiTesting ? 'Testing...' : 'Save & Test'}
                    </button>
                    <a
                      href="https://docs.omi.me/doc/developer/api/overview"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ textDecoration: 'none', fontSize: 11 }}
                    >
                      <ExternalLink size={12} /> Docs
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />

            {/* Test Data */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Database size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>Load Sample Data</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Generate test courses, quizzes & flashcards</div>
                </div>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: '4px 0' }}>
                Load 3 sample university courses (BIOL 3020, CHEM 2010, MATH 2350) with quiz history, flashcards, assignments, study sessions, and more.
                Great for testing and exploring all features.
              </p>
              <button className="btn btn-sm" style={{ background: '#f59e0b', color: '#000', border: 'none', fontWeight: 700 }} onClick={async () => {
                const { injectTestData } = await import('../utils/testData');
                injectTestData(setData as any);
                showToast('Sample data loaded! Explore all features now.');
              }}>
                <Zap size={13} /> Load Test Data
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION: How to Use NousAI
         ════════════════════════════════════════════════════ */}
      <div style={cardStyle}>
        <SectionHeader id="howto" icon={<BookOpen size={18} />} title="How to Use NousAI" subtitle="Feature guide" />
        {expanded.howto && (
          <div style={cardBodyStyle}>
            {[
              { title: '🏠 Dashboard', desc: 'Your home base. See your streak, XP, daily goals, quick launch buttons, course cards, analytics charts, and weekly plan. Tap any quick launch button to jump to that study mode.' },
              { title: '🏆 Quiz', desc: 'Generate AI-powered quizzes from your courses. Choose subject, subtopic, question type (multiple choice, true/false, short answer), and difficulty. View quiz history, merge quizzes, and track scores over time.' },
              { title: '📖 Learn (15 Study Modes)', desc: 'Access all study techniques: Rapid Learn, Feynman Technique, Exam Simulator, Socratic Dialogue, Gap Finder, Mnemonics, Interleaved Practice, Formula Lab, Error Analysis, TL;DR Summaries, Knowledge Web, Match Game, Spaced Repetition, AI Tutors, and Japanese (with JP Format color-coding: verbs, particles, nouns, adjectives, etc. with auto-legend). Select your course at the top to filter content.' },
              { title: '🎯 Study Modes', desc: 'Advanced study tools including Cornell Notes (rich text editor with cues/notes/summary layout, topic linking, preview mode, JSON bulk import/export, and AI generation), Active Recall, Leitner Box System (5-box spaced repetition), and Mind Palace (visual concept mapping). Track mastery across sessions.' },
              { title: '📚 Library', desc: 'Two tabs — Course Spaces shows all your courses as cards (tap to open full course space). Notes tab lets you create, edit, tag, organize, and search your notes by folder and type. Cornell notes also appear here for unified search.' },
              { title: '📝 Notes & Drawings', desc: 'The Notes tab opens your Notes & Drawings studio. Quick-access link to Cornell Notes at the top. Create drawings with 10 tools (pen, highlighter, eraser, shapes, text, image trace), 5 templates (blank, Cornell grid, grid, dot grid, lined), multi-page support, folder organization, and export as PNG. Also create typed notes with the rich text editor.' },
              { title: '📓 Cornell Notes', desc: 'Create structured study notes in the classic Cornell format: Cues/Questions (left 30%), Notes (right 70%), and Summary (bottom-left). Rich text editor with formatting, topic linking, preview mode, JSON bulk import/export with auto-formatting, and AI-powered note generation. Access from Study Modes or the Notes tab.' },
              { title: '🧠 Flashcards (Spaced Reps)', desc: 'Review flashcards from any course using the FSRS-4.5 spaced repetition algorithm. Cards show front/back with 3D flip animation. Rate each card (Again, Hard, Good, Easy) to schedule optimal review intervals. Supports long text answers with scrolling, auto-advance mode, starred cards, and keyboard shortcuts.' },
              { title: '⏱️ Timer', desc: 'Pomodoro timer with customizable work/break intervals and session tracking. Also includes a stopwatch mode. Link sessions to specific courses for study time tracking.' },
              { title: '📅 Calendar', desc: 'View and manage study events. Import Canvas calendar via iCal feed. Mark events as completed and track your schedule.' },
              { title: '🤖 AI Tools', desc: 'Suite of AI-powered tools: Quiz Generator, Flashcard Maker, Summarizer, Study Planner, Concept Explainer, OCR Scanner (photo to text), Cornell Note Generator, and more. Requires an AI provider API key configured in Settings (supports OpenAI, Anthropic, OpenRouter, Google AI, Groq, Ollama).' },
              { title: '🔬 Visual Lab', desc: 'Generate interactive AI-powered HTML5 canvas simulations for any topic. Simulations start paused so you see correct initial values. Split-pane workspace: live interactive lab on left, draggable resizer, and side panel with Notes tab (rich text editor with auto-save) and AI Chat tab (markdown + LaTeX rendered). Notes link to labs and appear in your Lectures tab with live lab playback.' },
              { title: '🔧 Tools', desc: 'Utility tools: Text-to-Speech (read flashcards aloud), Oral Quiz (voice-based quiz practice), Study Statistics, and other helpers.' },
              { title: '📊 Course Space', desc: 'Each course has a full workspace with 20 sections: Home, Chapters, Path (topic outline with linked notes), Notes, Quizzes, Matches, Mind Maps, OCR Scans, AI Outputs, All Files, Modules, Assignments, Grades, Syllabus, Links & Files (upload & preview any file type), Visual Lab (interactive AI sims with split-pane Notes + AI Chat workspace, draggable resizer), Tutor, Vocab, Stats, Lectures (rich text with topic linking, linked lab playback, JP color-coded legend), and Cram Mode.' },
              { title: '🎮 Games', desc: 'Educational games are available within course spaces. Access mini-games and interactive learning activities from your course pages.' },
              { title: '⚙️ Settings', desc: 'Configure AI provider (OpenAI, Anthropic, OpenRouter, Google AI, Groq, Ollama), connect extensions (Chrome, Canvas), adjust study preferences, keyboard shortcuts, theme, e-ink mode, import/export data, and manage your account.' },
              { title: '🔗 Links & Files', desc: 'Inside each course space, store links and upload files of any type (images, PDFs, docs, spreadsheets, code, archives, etc.). Preview images and PDFs in a fullscreen modal. Download non-previewable files. Filter by All, Links, or Files. Files stored locally as base64.' },
              { title: '🔄 Data Sync', desc: 'Sign in with email to sync across all devices. YOUR ACCOUNT: Sign up → Settings → Sync to Cloud → sign in on another device → Sync from Cloud. FRIENDS: They sign up with their own email, study, then Sync to Cloud. Each account is isolated. Enable Auto-sync for automatic background syncing every 2 min. Data is gzip compressed (~78% smaller). Syncs: flashcards, quizzes, notes, drawings, vocab, preferences, study progress. Does NOT sync: API keys, Firebase config, device-specific settings.' },
              { title: '📱 Mobile & Desktop', desc: 'NousAI is a PWA — install it on any device. Mobile shows a bottom nav bar (Home, Learn, Cards, Library, Notes, AI, Settings), desktop shows a full sidebar with all pages. All layouts are responsive.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < 19 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════
           SECTION 6: App Info
         ════════════════════════════════════════════════════ */}
      {/* Spotify Settings */}
      <div style={cardStyle}>
        <SectionHeader id="spotify" icon={<span style={{ fontSize: 16 }}>🎵</span>} title="Spotify" subtitle="Now playing widget on dashboard" />
        {expanded.spotify && (
          <div style={cardBodyStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              Connect Spotify to show what you're listening to on the Dashboard.<br />
              <strong>Setup:</strong> Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>developer.spotify.com/dashboard</a> → Create App → Add Redirect URI: <code>https://nousai-app.vercel.app</code> → Copy Client ID below.
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Spotify Client ID</div>
              <input
                type="text"
                placeholder="Paste your Spotify app Client ID"
                defaultValue={localStorage.getItem('nousai-spotify-client-id') || ''}
                onBlur={e => { localStorage.setItem('nousai-spotify-client-id', e.target.value); }}
                style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
              />
            </div>
            {isSpotifyConnected() ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--green, #22c55e)', fontWeight: 600 }}>✓ Spotify connected</span>
                <button className="btn btn-sm btn-secondary" onClick={() => { disconnectSpotify(); showToast('Spotify disconnected'); }}>Disconnect</button>
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={async () => {
                const clientId = localStorage.getItem('nousai-spotify-client-id') || '';
                if (!clientId) { showToast('Enter your Spotify Client ID first'); return; }
                const url = await getSpotifyAuthUrl(clientId);
                window.location.href = url;
              }}>Connect Spotify</button>
            )}
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <SectionHeader id="appinfo" icon={<Info size={18} />} title="App Info" subtitle={`v${getAppVersion()} - ${platform}`} />
        {expanded.appinfo && (
          <div style={cardBodyStyle}>
            {/* Version & Platform */}
            <div style={rowStyle}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Version</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>v{getAppVersion()}</span>
            </div>
            <div style={rowStyle}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Platform</span>
              <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Smartphone size={10} /> {platform}
              </span>
            </div>

            {/* Update check */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Updates</span>
                <button className="btn btn-secondary btn-sm" onClick={handleCheckUpdate} disabled={checking}>
                  <RefreshCw size={13} /> {checking ? 'Checking...' : 'Check for Updates'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Version {getAppVersion()}
              </div>
            </div>

            {/* PWA Install info */}
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Install App</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                On mobile: use your browser's "Add to Home Screen" option.<br />
                On desktop: look for the install icon in the address bar.<br />
                On Boox: install the Android APK directly.
              </p>
            </div>

            {/* Links */}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <a
                href="https://github.com/nousai/nousai-app/issues/new?template=bug_report.md"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
              >
                <Bug size={13} /> Report Bug
              </a>
              <a
                href="https://github.com/nousai/nousai-app/issues/new?template=feature_request.md"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}
              >
                <Lightbulb size={13} /> Feature Request
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ──────────── Footer ──────────── */}
      <div style={{ textAlign: 'center', padding: '16px 0 32px', fontSize: 11, color: 'var(--text-muted)' }}>
        NousAI v{getAppVersion()} &bull; {platform}
      </div>

      {/* ──────────── Toast ──────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 80,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-secondary, #1a1a1a)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            padding: '10px 20px',
            borderRadius: 'var(--radius)',
            fontSize: 13,
            fontWeight: 600,
            zIndex: 9999,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out',
            maxWidth: '90vw',
            textAlign: 'center',
          }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0', borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
