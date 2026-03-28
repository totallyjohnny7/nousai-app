import { useState, useEffect } from 'react'
import {
  Download, ArrowUpCircle, RefreshCw, Smartphone, ChevronDown, Cloud,
  Brain, BookOpen, Palette, Globe, Settings, Shield, Database,
  Info, Bug, Lightbulb, Keyboard, Zap, AlertTriangle
} from 'lucide-react'
import type { NousAIData } from '../../types'
import { useStore } from '../../store'
import { checkForUpdates, getAppVersion, getStoredUpdate, dismissUpdate, getPlatform } from '../../utils/updater'
import { onAuthChange, type AuthUser } from '../../utils/auth'
import { checkAllPermissions, type AllPermissions } from '../../utils/permissions'
import { getSpotifyAuthUrl, isSpotifyConnected, disconnectSpotify } from '../../utils/spotify'
import { K20_KEYS, K20_ACTIONS, K20_ACTION_ICONS, K20_DEFAULT_BINDINGS, type K20ActionId } from '../../utils/k20Types'
import { useK20Bindings } from '../../hooks/useK20Bindings'
import { scanK20Conflicts } from '../../utils/k20ConflictScanner'
import { getLevel, THEME_PRESETS } from '../../utils/gamification'

import type { SectionId, AIConfig, AIFeatureSlot, SlotConfig } from './settingsTypes'
import { PROVIDER_INFO, SLOT_INFO } from './settingsConstants'
import { getAIConfig, saveAIConfig, getSlotConfig, saveSlotConfig, getStudyPrefs, saveStudyPrefs, getDisplayPrefs, saveDisplayPrefs, formatBytes } from './settingsHelpers'
import { cardStyle, cardHeaderStyle, cardBodyStyle, inputStyle, selectStyle, rowStyle } from './settingsStyles'

import AccountSection from './AccountSection'
import AISection from './AISection'
import StudySection from './StudySection'
import DisplaySection from './DisplaySection'
import PermissionsSection from './PermissionsSection'
import DataSection from './DataSection'
import ExtensionsSection from './ExtensionsSection'

// ─── K20 Layout constants (used by inline inputdevices section) ────────
const K20_LAYOUT_KEYS: { label: string; shortcut: string; color?: string }[][] = [
  [
    { label: 'UNDO',  shortcut: 'Ctrl+Z', color: '#888' },
    { label: 'REDO',  shortcut: 'Ctrl+Y', color: '#888' },
    { label: 'COPY',  shortcut: 'Ctrl+C', color: '#888' },
    { label: 'PASTE', shortcut: 'Ctrl+V', color: '#888' },
  ],
  [
    { label: 'AGAIN', shortcut: '1', color: '#EF4444' },
    { label: 'HARD',  shortcut: '2', color: '#F97316' },
    { label: 'GOOD',  shortcut: '3', color: '#22C55E' },
    { label: 'EASY',  shortcut: '4', color: '#3B82F6' },
  ],
  [
    { label: 'VISUAL',  shortcut: 'Ctrl+Shift+V', color: '#A78BFA' },
    { label: 'EXPLAIN', shortcut: 'Ctrl+Shift+E', color: '#A78BFA' },
    { label: 'QUIZ',    shortcut: 'Ctrl+Shift+Q', color: '#A78BFA' },
    { label: 'SEND AI', shortcut: 'Ctrl+Enter',   color: '#F5A623' },
  ],
  [
    { label: 'FLIP',       shortcut: 'Ctrl+Shift+Space', color: '#22D3EE' },
    { label: 'POMODORO',   shortcut: 'Ctrl+Shift+P',     color: '#F43F5E' },
    { label: 'TRANSCRIBE', shortcut: 'Ctrl+Shift+T',     color: '#34D399' },
    { label: 'SEARCH',     shortcut: 'Ctrl+Shift+F',     color: '#60A5FA' },
  ],
  [
    { label: 'ESC / BACK', shortcut: 'Escape',       color: '#888' },
    { label: 'NEW CARD',   shortcut: 'Ctrl+Shift+N', color: '#F5A623' },
    { label: '', shortcut: '' },
    { label: '', shortcut: '' },
  ],
]

const K20_DIAL = [
  { label: 'Zoom In',      shortcut: 'Ctrl+=' },
  { label: 'Zoom Out',     shortcut: 'Ctrl+-' },
  { label: 'Cycle AI Mode', shortcut: 'Ctrl+Tab' },
]

// ─── HUION K20 Layout visual component ────────────────────────
function HuionK20Layout() {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>HUION K20 KeyDial Mini — Key Map</div>
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div style={{
          background: '#111', borderRadius: 20, padding: 20,
          border: '2px solid #33333380', maxWidth: 320, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, #555, #222)',
              border: '3px solid #444',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#888' }} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', letterSpacing: 1 }}>HUION</div>
              <div style={{ fontSize: 9, color: '#666' }}>KeyDial Mini</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {K20_LAYOUT_KEYS.flat().map((k, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '8px 4px 6px',
                background: k.label ? '#1a1a1a' : 'transparent', borderRadius: 8,
                border: k.label ? `1px solid ${k.color || '#333'}30` : 'none',
                minHeight: 52, cursor: 'default', transition: 'background 0.15s',
              }}>
                {k.label && (
                  <>
                    <span style={{ fontSize: 9, fontWeight: 700, color: k.color || '#aaa', letterSpacing: 0.3, textAlign: 'center', lineHeight: 1.2 }}>{k.label}</span>
                    <span style={{ fontSize: 7, color: '#555', fontFamily: 'var(--font-mono, monospace)', textAlign: 'center', lineHeight: 1.1 }}>{k.shortcut}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 6 }}>Dial Knob</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {K20_DIAL.map(d => (
                <div key={d.shortcut} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <kbd style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 6px', fontSize: 10, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{d.shortcut}</kbd>
                  <span style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>
          {[
            { title: 'Row 1 — System', desc: 'Native browser shortcuts (always active)', color: '#888' },
            { title: 'Row 2 — FSRS Ratings', desc: 'Active during flashcard review only', color: '#22C55E' },
            { title: 'Row 3 — AI Modes', desc: 'Switch AI tool mode or send prompt', color: '#A78BFA' },
            { title: 'Row 4 — Actions', desc: 'Flip card, pomodoro, transcribe, search', color: '#22D3EE' },
            { title: 'Row 5 — Navigation', desc: 'Escape/back, create new card', color: '#F5A623' },
          ].map(row => (
            <div key={row.title} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: row.color }}>{row.title}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{row.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── K20 Settings component ────────────────────────────────
function K20SettingsSection({ onToast }: { onToast: (msg: string) => void }) {
  const k20 = useK20Bindings();
  const rows = new Map<number, typeof K20_KEYS>();
  for (const key of K20_KEYS) {
    if (!rows.has(key.row)) rows.set(key.row, []);
    rows.get(key.row)!.push(key);
  }
  const sortedRows = [...rows.entries()].sort(([a], [b]) => a - b);
  const conflictSet = new Set(k20.conflicts);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>🎛️ HUION K20 KeyDial Mini</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '2px 7px', borderRadius: 20 }}>
          Keyboard shortcuts · fully remappable
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Click any key to reassign its action. The K20 sends keyboard shortcuts that NousAI intercepts.
      </div>
      {k20.conflicts.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius)', fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: '#EF4444', marginBottom: 4 }}>⚠ Binding Conflicts</div>
          {k20.conflicts.map((combo, i) => (
            <div key={i} style={{ color: 'var(--text-secondary)', marginTop: 2 }}>• {String(combo)} conflicts with a browser shortcut</div>
          ))}
        </div>
      )}
      <div style={{ background: '#111', borderRadius: 20, padding: 16, border: '2px solid rgba(245,166,35,0.25)', maxWidth: 420, boxShadow: '0 0 20px rgba(245,166,35,0.05)' }}>
        {sortedRows.map(([rowIdx, keys]) => (
          <div key={rowIdx} style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: rowIdx < sortedRows.length - 1 ? 6 : 0 }}>
            {keys.map(keyDef => {
              const rawActionId = k20.bindings[keyDef.id];
              const actionId = (typeof rawActionId === 'string' ? rawActionId : 'none') as K20ActionId;
              const icon = String(K20_ACTION_ICONS[actionId] ?? '⬜');
              const hasConflict = conflictSet.has(keyDef.combo?.toLowerCase?.() ?? '');
              const isDial = keyDef.isDial;
              return (
                <div key={keyDef.id} style={{
                  position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  padding: isDial ? '8px 6px 6px' : '8px 6px 4px',
                  background: isDial ? '#1a1a2e' : '#1e1e1e',
                  borderRadius: isDial ? '50%' : 10,
                  border: hasConflict ? '2px solid #EF4444' : isDial ? '2px solid #F5A62340' : '1px solid #333',
                  minWidth: isDial ? 56 : 80, minHeight: isDial ? 56 : 68,
                  cursor: 'pointer', transition: 'border-color 0.15s, transform 0.1s',
                }}>
                  {hasConflict && (
                    <div title={`${keyDef.combo} conflicts with a browser shortcut`} style={{
                      position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: '50%',
                      background: '#EF4444', color: '#fff', fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>!</div>
                  )}
                  <div style={{ fontSize: 8, color: '#666', fontWeight: 600, letterSpacing: 0.5 }}>{keyDef.label}</div>
                  <div style={{ fontSize: isDial ? 16 : 20, lineHeight: 1 }}>{icon}</div>
                  <select
                    style={{ width: '100%', fontSize: 8, fontWeight: 600, background: 'transparent', color: '#F5A623', border: 'none', textAlign: 'center', cursor: 'pointer', appearance: 'none', padding: 0, outline: 'none' }}
                    value={actionId}
                    onChange={e => k20.updateBinding(keyDef.id, e.target.value as K20ActionId)}
                  >
                    {K20_ACTIONS.map(a => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bindings saved to localStorage · persists across sessions</span>
        <button className="btn btn-ghost btn-sm" onClick={() => { k20.resetToDefaults(); onToast('K20 bindings reset to defaults'); }}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

// ─── Guide Hub inline component ────────────────────────────
interface GuideEntry { id: string; title: string; tldr: string; content: string }

const GUIDE_ENTRIES: GuideEntry[] = [
  { id: 'quickkeys', title: 'Elgato Stream Deck — Setup & Modes', tldr: 'A 15-button LCD controller for every NousAI action, one-handed control of the whole app.', content: `Requirements: Chrome or Edge on Windows or macOS, Stream Deck MK.2 connected via USB.\n\nSetup (3 steps):\n1. Open Settings → Input Devices\n2. Click "Connect Stream Deck" → browser asks for USB permission → allow\n3. The LCD keys update with labels for the current mode\n\nModes (auto-switch by page):\n• Flashcard Mode — on /flashcards: Btn 1=FLIP, 2=RECALL, 3=NEXT, 4=PREV, 5=AGAIN, 6=HARD, 7=GOOD, 8=EASY, 9-15 configurable\n• Quiz Mode — on /quiz: Btn 1-4 = select options, Btn 5=SUBMIT, Btn 6=NEXT\n• Drawing Mode — on /draw: Btn 1=UNDO, Btn 2=REDO\n• Navigation Mode — all other pages: Btn 1-15 = jump to any NousAI page\n• Notes Mode — on /library or /learn: Btn 4=LASSO\n\nRemapping: Settings → Input Devices → choose mode → click any button → select new action\n\n⚡ Pro Tip: Use the 15 LCD buttons to map your most-used actions per mode — the labels update live on the device display.` },
  { id: 'cloze', title: 'Cloze Cards — Syntax & Tips', tldr: 'Fill-in-the-blank cards. Wrap terms in {{double braces}} to create blanks.', content: `Creating a Cloze Card:\n1. Click "New Card" → select type "Cloze"\n2. Front: "The {{mitochondria}} is the {{powerhouse}} of the cell."\n3. Back: Optional explanation / extra context\n\nReview Flow:\n• Card shows: "The [_____] is the [_____] of the cell."\n• Press Space → reveals first blank: "mitochondria"\n• Press Space again → reveals second blank: "powerhouse"\n• Back shown → rate 1-4\n\nTips for Great Cloze Cards:\n✓ One concept per card: "The {{nucleus}} controls cell activity"\n✓ Keep blanks to 1-3 per card\n✗ Avoid too many blanks per card\n\n⚡ Pro Tip: After making cloze cards from vocab, use RSVP Speed Preview to see all terms fast, then let FSRS schedule the actual review.` },
  { id: 'type-recall', title: 'Type-to-Recall Mode — The Generation Effect', tldr: 'Type your answer before seeing it. Research shows 40-60% better retention than passive flip.', content: `Enable: Press T on any flashcard page, or Settings → Flashcards → "Type-to-Recall Mode" toggle.\n\nHow it works:\n1. Card front shows\n2. You type your answer in the text box\n3. Press Enter or "Check"\n4. If AI grading is on: EXACT → 4, PARTIAL → 2 (shows what was missing), WRONG → 1\n5. If AI grading is off: correct answer shown, you self-grade\n\nWhy it works (The Science):\nGenerating an answer — even incorrectly — activates more memory pathways than simply recognizing it. This is the "generation effect" (Slamecka & Graf, 1978). Even failed recall attempts strengthen long-term memory.\n\n⚡ Pro Tip: Keep AI grading OFF for speed. Keep it ON for high-stakes subjects where accuracy matters most.` },
  { id: 'rsvp', title: 'RSVP Speed Preview — When & How to Use', tldr: 'Flash through an entire deck in minutes to build familiarity before deep study.', content: `Open: Learn → "⚡ Speed Preview" or Flashcard page header → "Speed Preview" button.\n\nSpeed Settings:\n100 WPM — Slow, good for complex material\n200 WPM — Default\n300 WPM — Fast, good for vocabulary you mostly know\n500 WPM — Very fast, good for warm-up on familiar decks\n\nControls: Space = pause · → = skip card · Stream Deck buttons = adjust WPM live\n\nWhen to Use:\n✓ Before starting a new deck (reduces first-review overwhelm)\n✓ Before an exam (rapid exposure refresher)\n✓ When returning after a long break (re-familiarize before deep review)\n✗ Not a replacement for FSRS active recall — always follow with real review\n\n⚡ Pro Tip: Run RSVP at the START of every study session as a 3-minute warm-up. Retention improves significantly vs. jumping straight to flashcards cold.` },
  { id: 'leeches', title: 'Leech Cards — What They Are & How to Fix', tldr: 'Leeches are cards you keep failing. The system detects them and helps you fix them.', content: `What is a Leech?\nA card that has failed (graded "Again") 4+ times OR has average recall below 50%. These cards take 80% of your effort for 20% of the value.\n\nHow to find them: Learn → Leech Manager tool, or FlashcardAnalytics → "Leeches" tab.\n\nWhat to do:\nOption 1 — Suspend: Removes from review queue temporarily\nOption 2 — AI Rewrite: AI suggests a simpler rewrite or how to split into 2 atomic cards\nOption 3 — Add Context: Add more info to the back of the card\n\nWhy this matters:\nSuspending 10 leeches = saving 20-30 minutes per week. Keeping leeches active = scheduling bad cards every 1-3 days forever.\n\n⚡ Pro Tip: Run leech detection monthly. Aim for 0 active leeches. If you have 20+ leeches, your cards need restructuring before FSRS can work effectively.` },
  { id: 'fsrs', title: 'How FSRS Schedules Your Cards (Plain English)', tldr: 'FSRS predicts when you\'ll forget each card and shows it right before that moment.', content: `The Core Idea:\nEvery card has a "stability" (how long your memory will last) and a "difficulty" (how hard the card is for you). FSRS uses these + 19 calibration weights to predict when you'll recall the card with 92% confidence.\n\nYour Ratings Explained:\n1 = Again — "I forgot completely" → interval resets to 1 day\n2 = Hard — "I remembered but struggled" → short interval\n3 = Good — "I remembered normally" → interval doubles-ish\n4 = Easy — "Instant recall" → large interval jump\n\nWhat happens over time:\n• New card: shown again in 1-2 days (building initial memory)\n• After 3-4 good reviews: shown weekly, then monthly\n• Mature card (21+ day stability): shown every few months\n\nDaily Cap: 50 cards per course per day (configurable in Settings). This prevents overwhelm when you add a large deck all at once.\n\n⚡ Pro Tip: Grade honestly. Rating "Easy" when it was "Hard" corrupts the schedule. The algorithm only works if your self-ratings are accurate.` },
  { id: 'pretest', title: 'Pre-Test Mode — Hypercorrection Effect', tldr: 'Test before learning → 15-20% better retention. High-confidence wrong answers corrected most strongly.', content: `What it does:\nBefore each card: "Do you think you know this? Yes / No" (confidence prediction)\nYou type an answer → correct answer shown immediately (no FSRS grading during pretest)\n\nPost-run summary shows:\n• "Knew correctly" — good!\n• "Thought you knew, got wrong" — these get reviewed first (hypercorrection)\n• "Knew you didn't know" — normal review order\n\nScience: The hypercorrection effect means that when you're WRONG with high confidence, your brain is primed for deeper correction. These cards stick much faster than ones you were uncertain about.\n\nOpen it: Learn → "🎯 Pre-Test Mode"\n\n⚡ Pro Tip: Use Pre-Test Mode on a brand new deck before you've studied anything. Even guessing wrong primes your memory for the correct answers.` },
]

function GuideHubInline() {
  const [search, setSearch] = useState('')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const filtered = GUIDE_ENTRIES.filter(g => {
    const q = search.toLowerCase()
    return !q || g.title.toLowerCase().includes(q) || g.tldr.toLowerCase().includes(q) || g.content.toLowerCase().includes(q)
  })
  const toggle = (id: string) => {
    setOpenIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }
  return (
    <div>
      <input type="text" placeholder="Search guides…" value={search} onChange={e => setSearch(e.target.value)}
        style={{ width: '100%', marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 13 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(guide => (
          <div key={guide.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
            <button onClick={() => toggle(guide.id)} style={{ width: '100%', textAlign: 'left', padding: '10px 12px', background: 'var(--bg-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{guide.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{guide.tldr}</div>
            </button>
            {openIds.has(guide.id) && (
              <div style={{ padding: '12px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                {guide.content}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 16 }}>No guides match "{search}"</p>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// Main SettingsPage Component
// ═══════════════════════════════════════════════════════════
export default function SettingsPage() {
  const { data, setData, updatePluginData, importData, exportData, einkMode, setEinkMode, betaMode, setBetaMode, backupNow, startRemoteWatch, stopRemoteWatch, deviceSettings, setDeviceSettings, triggerSyncToCloud, triggerSyncFromCloud } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [updateInfo, setUpdateInfo] = useState(getStoredUpdate())
  const [checking, setChecking] = useState(false)
  const platform = getPlatform()

  // Section expand/collapse
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    account: true, ai: false, extensions: false, study: false,
    display: false, permissions: false, data: false, howto: false,
    appinfo: false, spotify: false, inputdevices: false, guide: false,
  })

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Permissions state
  const [permStatus, setPermStatus] = useState<AllPermissions | null>(null)

  // AI config state
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const local = getAIConfig()
    if (!local.apiKey && !local.provider || local.provider === 'none') {
      const cloud = (data?.pluginData as Record<string, unknown>)?.aiSettings as { provider: string; apiKey: string; model: string; baseUrl?: string; customModel?: string } | undefined
      if (cloud?.apiKey && cloud.provider && cloud.provider !== 'none') {
        localStorage.setItem('nousai-ai-provider', cloud.provider)
        localStorage.setItem('nousai-ai-apikey', cloud.apiKey)
        localStorage.setItem('nousai-ai-model', cloud.model || '')
        if (cloud.baseUrl) localStorage.setItem('nousai-ai-baseurl', cloud.baseUrl)
        if (cloud.customModel) localStorage.setItem('nousai-ai-custom-model', cloud.customModel)
        return getAIConfig()
      }
    }
    return local
  })

  // Feature slot overrides state
  const SLOTS: AIFeatureSlot[] = ['chat', 'generation', 'analysis', 'ocr', 'japanese', 'physics']
  const [slotConfigs, setSlotConfigs] = useState<Record<AIFeatureSlot, SlotConfig>>(() =>
    Object.fromEntries(SLOTS.map(s => [s, getSlotConfig(s)])) as Record<AIFeatureSlot, SlotConfig>
  )
  const [expandedSlot, setExpandedSlot] = useState<AIFeatureSlot | null>(null)

  // Study prefs state
  const [studyPrefs, setStudyPrefsState] = useState(getStudyPrefs)

  // Display prefs state
  const [displayPrefs, setDisplayPrefsState] = useState(getDisplayPrefs)

  // ─── Effects ───────────────────────────────────────────
  useEffect(() => {
    checkForUpdates().then(r => { if (r.available && r.info) setUpdateInfo(r.info) })
  }, [])

  useEffect(() => {
    checkAllPermissions().then(setPermStatus)
  }, [])

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
      stopRemoteWatch()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ─── AI Config Handlers ───────────────────────────────
  function updateAiConfig(patch: Partial<AIConfig>) {
    const next = { ...aiConfig, ...patch }
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
    updatePluginData({ aiSettings: { provider: next.provider, apiKey: next.apiKey, model: next.model, baseUrl: next.baseUrl, customModel: next.customModel } } as never)
  }

  function updateSlotConfigHandler(slot: AIFeatureSlot, patch: Partial<SlotConfig>) {
    const next = { ...slotConfigs[slot], ...patch }
    if (patch.provider && patch.provider !== slotConfigs[slot].provider) {
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

  function clearSlotConfigHandler(slot: AIFeatureSlot) {
    const cleared: SlotConfig = { provider: '', apiKey: '', model: '' }
    setSlotConfigs(prev => ({ ...prev, [slot]: cleared }))
    saveSlotConfig(slot, cleared)
  }

  // ─── Study/Display Prefs Handlers ─────────────────────
  function updateStudyPrefs(patch: Partial<typeof studyPrefs>) {
    const next = { ...studyPrefs, ...patch }
    setStudyPrefsState(next)
    saveStudyPrefs(next)
  }

  function updateDisplayPrefs(patch: Partial<typeof displayPrefs>) {
    const next = { ...displayPrefs, ...patch }
    setDisplayPrefsState(next)
    saveDisplayPrefs(next)
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

  // ─── Stats for data section subtitle ──────────────────
  const dataSize = data ? new Blob([JSON.stringify(data)]).size : 0

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
                <span style={{ fontWeight: 700 }}>Update Available: v{String(updateInfo.version ?? '')}</span>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: 4, fontFamily: 'inherit' }}
                onClick={() => { dismissUpdate(); setUpdateInfo(null) }}
              >&times;</button>
            </div>
            {updateInfo.releaseNotes && <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{String(updateInfo.releaseNotes)}</p>}
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

      {/* ── SECTION 1: Account & Cloud Sync ── */}
      <div style={cardStyle}>
        <SectionHeader id="account" icon={<Cloud size={18} />} title="Account & Cloud Sync" subtitle={authUser ? authUser.email : 'Sign in to sync data across devices'} />
        {expanded.account && (
          <AccountSection
            authUser={authUser}
            authLoading={authLoading}
            data={data}
            updatePluginData={updatePluginData}
            showToast={showToast}
            triggerSyncToCloud={triggerSyncToCloud}
            triggerSyncFromCloud={triggerSyncFromCloud}
            startRemoteWatch={startRemoteWatch}
          />
        )}
      </div>

      {/* ── SECTION 2: AI Configuration ── */}
      <div style={cardStyle}>
        <SectionHeader
          id="ai"
          icon={<Brain size={18} />}
          title="AI Configuration"
          subtitle={aiConfig.provider === 'none' ? 'No AI provider configured' : `${PROVIDER_INFO[aiConfig.provider]?.label || 'Custom'} - ${aiConfig.model || aiConfig.customModel || 'No model'}`}
        />
        {expanded.ai && (
          <AISection
            aiConfig={aiConfig}
            updateAiConfig={updateAiConfig}
            slotConfigs={slotConfigs}
            updateSlotConfig={updateSlotConfigHandler}
            clearSlotConfig={clearSlotConfigHandler}
            expandedSlot={expandedSlot}
            setExpandedSlot={setExpandedSlot}
            showToast={showToast}
          />
        )}
      </div>

      {/* ── SECTION 2b: Feature AI Slot Overrides ── */}
      <div style={cardStyle}>
        <SectionHeader
          id="ai"
          icon={<Zap size={18} />}
          title="AI Providers — Feature Overrides"
          subtitle="Assign different AI providers to specific features (optional)"
        />
      </div>

      {/* ── SECTION 3: Study Preferences ── */}
      <div style={cardStyle}>
        <SectionHeader id="study" icon={<BookOpen size={18} />} title="Study Preferences" subtitle="Quiz, flashcard, timer & learning defaults" />
        {expanded.study && (
          <StudySection studyPrefs={studyPrefs} updateStudyPrefs={updateStudyPrefs} showToast={showToast} />
        )}
      </div>

      {/* ── SECTION 4: Display & Theme ── */}
      <div style={cardStyle}>
        <SectionHeader id="display" icon={<Palette size={18} />} title="Display & Theme" subtitle={einkMode ? 'E-Ink mode' : 'Standard mode'} />
        {expanded.display && (
          <DisplaySection
            displayPrefs={displayPrefs}
            updateDisplayPrefs={updateDisplayPrefs}
            einkMode={einkMode}
            setEinkMode={setEinkMode}
            betaMode={betaMode}
            setBetaMode={setBetaMode}
            data={data}
            setData={setData}
            showToast={showToast}
          />
        )}
      </div>

      {/* ── SECTION: Permissions ── */}
      <div style={cardStyle}>
        <SectionHeader id="permissions" icon={<Shield size={18} />} title="Permissions" subtitle="PWA feature access" />
        {expanded.permissions && (
          <PermissionsSection permStatus={permStatus} setPermStatus={setPermStatus} showToast={showToast} />
        )}
      </div>

      {/* ── SECTION 5: Data Management ── */}
      <div style={cardStyle}>
        <SectionHeader id="data" icon={<Database size={18} />} title="Data Management" subtitle={data ? formatBytes(dataSize) + ' stored' : 'No data loaded'} />
        {expanded.data && (
          <DataSection
            data={data}
            setData={setData}
            importData={importData}
            exportData={exportData}
            backupNow={backupNow}
            showToast={showToast}
            setExpanded={setExpanded}
          />
        )}
      </div>

      {/* ── SECTION: Extensions & Integrations ── */}
      <div style={cardStyle}>
        <SectionHeader id="extensions" icon={<Globe size={18} />} title="Extensions & Integrations" subtitle="Connect external tools" />
        {expanded.extensions && (
          <ExtensionsSection
            data={data}
            setData={setData}
            updatePluginData={updatePluginData}
            authUser={authUser}
            showToast={showToast}
            setExpanded={setExpanded}
          />
        )}
      </div>

      {/* ── SECTION: How to Use NousAI (inline) ── */}
      <div style={cardStyle}>
        <SectionHeader id="howto" icon={<BookOpen size={18} />} title="How to Use NousAI" subtitle="Feature guide" />
        {expanded.howto && (
          <div style={cardBodyStyle}>
            {[
              { title: '🏠 Dashboard', desc: 'Your home base. See your streak, XP, daily goals, quick launch buttons, course cards, analytics charts, and weekly plan.' },
              { title: '🏆 Quiz', desc: 'Generate AI-powered quizzes from your courses. Choose subject, subtopic, question type, and difficulty.' },
              { title: '📖 Learn (15 Study Modes)', desc: 'Access all study techniques: Rapid Learn, Feynman Technique, Exam Simulator, and more.' },
              { title: '🎯 Study Modes', desc: 'Advanced study tools including Cornell Notes, Active Recall, Leitner Box System, and Mind Palace.' },
              { title: '📚 Library', desc: 'Course Spaces and Notes tabs for organizing all your study materials.' },
              { title: '📝 Notes & Drawings', desc: 'Create drawings with 10 tools, 5 templates, multi-page support, and rich text notes.' },
              { title: '🧠 Flashcards (Spaced Reps)', desc: 'Review flashcards using the FSRS-4.5 spaced repetition algorithm with 3D flip animation.' },
              { title: '⏱️ Timer', desc: 'Pomodoro timer with customizable work/break intervals and stopwatch mode.' },
              { title: '📅 Calendar', desc: 'View and manage study events. Import Canvas calendar via iCal feed.' },
              { title: '🤖 AI Tools', desc: 'Suite of AI-powered tools: Quiz Generator, Flashcard Maker, Summarizer, Study Planner, and more.' },
              { title: '🔬 Visual Lab', desc: 'Generate interactive AI-powered HTML5 canvas simulations for any topic.' },
              { title: '📊 Course Space', desc: 'Each course has a full workspace with 20 sections.' },
              { title: '⚙️ Settings', desc: 'Configure AI provider, connect extensions, adjust preferences, theme, import/export data, and manage your account.' },
              { title: '🔄 Data Sync', desc: 'Sign in with email to sync across all devices automatically.' },
              { title: '📱 Mobile & Desktop', desc: 'NousAI is a PWA — install it on any device with responsive layouts.' },
            ].map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < 14 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Spotify (inline) ── */}
      <div style={cardStyle}>
        <SectionHeader id="spotify" icon={<span style={{ fontSize: 16 }}>🎵</span>} title="Spotify" subtitle="Now playing widget on dashboard" />
        {expanded.spotify && (
          <div style={cardBodyStyle}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, lineHeight: 1.6 }}>
              Connect Spotify to show what you're listening to on the Dashboard.<br />
              <strong>Setup:</strong> Go to <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>developer.spotify.com/dashboard</a> → Create App → Add Redirect URI: <code>https://studynous.com</code> → Copy Client ID below.
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

      {/* ── App Info (inline) ── */}
      <div style={cardStyle}>
        <SectionHeader id="appinfo" icon={<Info size={18} />} title="App Info" subtitle={`v${getAppVersion()} - ${platform}`} />
        {expanded.appinfo && (
          <div style={cardBodyStyle}>
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
            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Install App</div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                On mobile: use your browser's "Add to Home Screen" option.<br />
                On desktop: look for the install icon in the address bar.<br />
                On Boox: install the Android APK directly.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <a href="https://github.com/nousai/nousai-app/issues/new?template=bug_report.md" target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
                <Bug size={13} /> Report Bug
              </a>
              <a href="https://github.com/nousai/nousai-app/issues/new?template=feature_request.md" target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
                <Lightbulb size={13} /> Feature Request
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Input Devices (inline) ── */}
      <div className="settings-section">
        <SectionHeader id="inputdevices" icon={<Keyboard size={16} />} title="Input Devices" subtitle="HUION K20 KeyDial Mini" />
        {expanded.inputdevices && (
          <div style={{ padding: '12px 0', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18 }}>🎛️</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>HUION K20 KeyDial Mini</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>20 programmable keys + dial knob</div>
              </div>
              <label style={{ position: 'relative', width: 40, height: 22, cursor: 'pointer' }}>
                <input type="checkbox" checked={deviceSettings.k20} onChange={e => setDeviceSettings({ ...deviceSettings, k20: e.target.checked })}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                <span style={{ position: 'absolute', inset: 0, borderRadius: 11, background: deviceSettings.k20 ? 'var(--color-accent)' : 'var(--bg-card)', border: '1px solid var(--border)', transition: 'background 0.2s' }} />
                <span style={{ position: 'absolute', top: 2, left: deviceSettings.k20 ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
              </label>
            </div>
            {(() => {
              const conflicts = scanK20Conflicts();
              if (conflicts.length === 0) return null;
              return (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(239,68,68,0.07)', borderRadius: 'var(--radius)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 700, color: '#ef4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={14} /> K20 Shortcut Conflicts
                  </div>
                  <div>
                    The following K20 combos conflict with reserved browser shortcuts and may not work:{' '}
                    {conflicts.map((c, i) => (
                      <kbd key={c} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'var(--font-mono, monospace)', marginRight: i < conflicts.length - 1 ? 4 : 0 }}>{c}</kbd>
                    ))}
                  </div>
                </div>
              );
            })()}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8 }} />
            {deviceSettings.k20 && <HuionK20Layout />}
            <div style={{ borderTop: '1px solid var(--border)' }} />
            <K20SettingsSection onToast={showToast} />
          </div>
        )}
      </div>

      {/* ── Guide Hub (inline) ── */}
      <div className="settings-section">
        <SectionHeader id="guide" icon={<BookOpen size={16} />} title="How to Use NousAI" subtitle="Interactive guides for all features" />
        {expanded.guide && (
          <div style={{ padding: '12px 0' }}>
            <GuideHubInline />
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
            position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--bg-secondary, #1a1a1a)', color: 'var(--text-primary)',
            border: '1px solid var(--border)', padding: '10px 20px',
            borderRadius: 'var(--radius)', fontSize: 13, fontWeight: 600,
            zIndex: 9999, boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            animation: 'fadeIn 0.2s ease-out', maxWidth: '90vw', textAlign: 'center',
          }}>
          {toast}
        </div>
      )}
    </div>
  )
}
