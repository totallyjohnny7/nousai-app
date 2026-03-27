/**
 * NousPanel — Production-grade floating AI assistant window
 * Uses react-rnd for drag + resize on desktop, pure CSS bottom sheet on mobile.
 * State machine: normal | minimized | maximized | hidden
 * Chat state is component-local (never touches Zustand store).
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Rnd } from 'react-rnd'
import { Brain, X, Trash2, Copy, Check, Send, Paperclip, Settings, Minus, Square, Maximize2 } from 'lucide-react'
import { useStore } from '../store'
import { callAI, isAIConfigured } from '../utils/ai'
import { safeRenderMd } from '../utils/renderMd'
import { extractFileContent, FileExtractError } from '../utils/fileExtract'
import type { AttachedFile } from '../types'

/* ── Inline tooltip ────────────────────────────────────── */
function SettingTooltip({ text }: { text: string }) {
  return (
    <span className="nous-setting-tooltip-wrap">
      <span className="nous-setting-tooltip-box">{text}</span>
    </span>
  )
}

/* ── Types ─────────────────────────────────────────────── */
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type WindowState = 'normal' | 'minimized' | 'maximized' | 'hidden'

interface WindowGeometry {
  x: number
  y: number
  width: number
  height: number
  state: WindowState
}

export interface NousPanelProps {
  open: boolean
  onOpenChange: (v: boolean) => void
}

/* ── Constants ────────────────────────────────────────── */
const LS_KEY = 'nous-chat-window'
const OLD_KEYS = ['nous_panel_open', 'nous_panel_floating', 'nous_panel_pos']
const DEFAULT_W = 380
const DEFAULT_H = 520
const MIN_W = 300
const MIN_H = 400
const TITLE_BAR_H = 44
const SNAP_THRESHOLD = 20
const DEAD_ZONE = { right: 420, bottom: 220 } // bottom-right dead zone
const MOBILE_BP = 768

function defaultGeometry(): WindowGeometry {
  const x = typeof window !== 'undefined' ? window.innerWidth - DEFAULT_W - 24 : 200
  const y = typeof window !== 'undefined' ? Math.max(24, (window.innerHeight - DEFAULT_H) / 2) : 80
  return { x, y, width: DEFAULT_W, height: DEFAULT_H, state: 'hidden' }
}

function loadGeometry(): WindowGeometry {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...defaultGeometry(), ...parsed }
    }
  } catch { /* ignore */ }
  return defaultGeometry()
}

function migrateOldKeys() {
  try {
    OLD_KEYS.forEach(k => localStorage.removeItem(k))
  } catch { /* ignore */ }
}

/* ── Helpers ───────────────────────────────────────────── */
function getViewName(pathname: string): string {
  const map: Record<string, string> = {
    '/': 'Dashboard', '/quiz': 'Quizzes', '/quizzes': 'Quizzes', '/learn': 'Learn',
    '/flashcards': 'Flashcards', '/library': 'Library', '/ai': 'AI Tools', '/tools': 'Tools',
    '/timer': 'Timer', '/calendar': 'Calendar', '/settings': 'Settings', '/course': 'Course', '/study': 'Study',
  }
  return map[pathname] || pathname
}

function buildSystemPrompt(
  activeView: string, courseNames: string, total: number, mastered: number,
  learning: number, provider: string, model: string,
): string {
  return `You are the Nous AI assistant embedded inside the Nous AI study app.

Current context:
- Page/View: ${activeView}
- Courses: ${courseNames || 'None loaded'}
- Flashcards Total: ${total} | Mastered: ${mastered} | Learning: ${learning}
- Active Provider: ${provider} (${model})

Answer questions about the user's notes, vocab, quizzes, and study progress. Keep answers concise and formatted in Markdown. You can suggest actions like starting a quiz, reviewing flashcards, or using AI tools.

IMPORTANT formatting rules:
- NEVER include raw URLs or long encoded URLs in your responses
- If you want to reference a website, use short markdown links: [site name](url) — but keep it brief
- Prefer giving the information directly rather than linking to external sites
- Use bullet points, bold, and tables for clarity`
}

/* ── Action detection ──────────────────────────────────── */
interface DetectedAction { label: string; path: string }

function detectActions(text: string): DetectedAction[] {
  const actions: DetectedAction[] = []
  const lower = text.toLowerCase()
  if (lower.includes('start a quiz') || lower.includes('take a quiz') || lower.includes('quiz yourself'))
    actions.push({ label: 'Start Quiz', path: '/quiz' })
  if (lower.includes('review flashcard') || lower.includes('review your card') || lower.includes('spaced repetition'))
    actions.push({ label: 'Review Flashcards', path: '/flashcards' })
  if (lower.includes('mind map') || lower.includes('ai tool') || lower.includes('open the ai'))
    actions.push({ label: 'Open AI Tools', path: '/ai' })
  if (lower.includes('study session') || lower.includes('timer') || lower.includes('pomodoro'))
    actions.push({ label: 'Start Timer', path: '/timer' })
  return actions
}

/* ── Geometry helpers ─────────────────────────────────── */
function snapToEdges(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  let sx = x, sy = y
  if (x < SNAP_THRESHOLD) sx = 0
  else if (x + w > vw - SNAP_THRESHOLD) sx = vw - w
  if (y < SNAP_THRESHOLD) sy = 0
  else if (y + h > vh - SNAP_THRESHOLD) sy = vh - h
  return { x: sx, y: sy }
}

function enforceDeadZone(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dzLeft = vw - DEAD_ZONE.right
  const dzTop = vh - DEAD_ZONE.bottom
  // If panel overlaps dead zone, push it out
  if (x + w > dzLeft && y + h > dzTop) {
    // Push whichever direction is shorter
    const pushLeft = (x + w) - dzLeft
    const pushUp = (y + h) - dzTop
    if (pushLeft < pushUp) return { x: x - pushLeft, y }
    return { x, y: y - pushUp }
  }
  return { x, y }
}

function clampToViewport(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.max(0, Math.min(x, vw - Math.min(w, 80))),
    y: Math.max(0, Math.min(y, vh - TITLE_BAR_H)),
  }
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < MOBILE_BP
}

/* ── Component ─────────────────────────────────────────── */
export default function NousPanel({ open, onOpenChange }: NousPanelProps) {
  // ── Window state ────────────────────────────────────────
  const [geo, setGeo] = useState<WindowGeometry>(loadGeometry)
  const [winState, setWinState] = useState<WindowState>(() => open ? (loadGeometry().state === 'hidden' ? 'normal' : loadGeometry().state) : 'hidden')
  const [animateClass, setAnimateClass] = useState(true)
  const [zIndex, setZIndex] = useState(9999)
  const zRef = useRef(9999)
  const rndRef = useRef<Rnd | null>(null)

  // ── Chat state ──────────────────────────────────────────
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Settings state ──────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [contextDepth, setContextDepthState] = useState<'minimal' | 'smart' | 'deep'>(() =>
    (localStorage.getItem('nous_context_depth') as 'minimal' | 'smart' | 'deep') || 'smart'
  )
  const [maxAttachments, setMaxAttachmentsState] = useState<number>(() =>
    parseInt(localStorage.getItem('nous_max_attachments') || '4', 10)
  )
  const [clearOnNavigate, setClearOnNavigateState] = useState(() =>
    localStorage.getItem('nous_clear_on_navigate') === 'true'
  )

  const location = useLocation()
  const navigate = useNavigate()
  const { courses, srData, activePageContext } = useStore()

  // ── Mobile swipe state ──────────────────────────────────
  const touchStartY = useRef<number | null>(null)

  // ── Migrate old localStorage keys on mount ──────────────
  useEffect(() => { migrateOldKeys() }, [])

  // ── Sync open prop → winState ───────────────────────────
  useEffect(() => {
    if (open && winState === 'hidden') setWinState('normal')
    if (!open && winState !== 'hidden') setWinState('hidden')
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync winState → open prop ───────────────────────────
  useEffect(() => {
    if (winState === 'hidden' && open) onOpenChange(false)
    if (winState !== 'hidden' && !open) onOpenChange(true)
  }, [winState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist geometry (debounced) ────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ ...geo, state: winState }))
      } catch { /* ignore */ }
    }, 200)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [geo, winState])

  // ── Settings persistence ────────────────────────────────
  const setContextDepth = useCallback((v: 'minimal' | 'smart' | 'deep') => {
    setContextDepthState(v)
    try { localStorage.setItem('nous_context_depth', v) } catch { /* ignore */ }
  }, [])
  const setMaxAttachments = useCallback((v: number) => {
    setMaxAttachmentsState(v)
    try { localStorage.setItem('nous_max_attachments', String(v)) } catch { /* ignore */ }
  }, [])
  const setClearOnNavigate = useCallback((v: boolean) => {
    setClearOnNavigateState(v)
    try { localStorage.setItem('nous_clear_on_navigate', String(v)) } catch { /* ignore */ }
  }, [])

  // ── Clear on navigate ───────────────────────────────────
  useEffect(() => {
    if (clearOnNavigate) setMessages([])
  }, [location.pathname, clearOnNavigate])

  // ── Auto-scroll ─────────────────────────────────────────
  useEffect(() => {
    if (winState === 'normal' || winState === 'maximized') {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, winState])

  // ── Auto-resize textarea ────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  // ── Window resize: re-clamp ─────────────────────────────
  useEffect(() => {
    const handler = () => {
      if (winState !== 'normal') return
      setGeo(prev => {
        const { x, y } = clampToViewport(prev.x, prev.y, prev.width, prev.height)
        if (x === prev.x && y === prev.y) return prev
        return { ...prev, x, y }
      })
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [winState])

  // ── Click outside → minimize (desktop only, normal state) ─
  useEffect(() => {
    if (winState !== 'normal' || isMobile()) return
    const handler = (e: MouseEvent) => {
      const rndEl = document.querySelector('.nous-rnd-wrapper')
      if (rndEl && !rndEl.contains(e.target as Node)) {
        setTimeout(() => setWinState('minimized'), 100)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [winState])

  // ── Paste handler for images ────────────────────────────
  useEffect(() => {
    if (winState === 'hidden') return
    const handler = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imageItem = items.find(i => i.type.startsWith('image/'))
      if (!imageItem) return
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (file) await addAttachment(file)
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [winState]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── AI context ──────────────────────────────────────────
  const getContext = useCallback(() => {
    const activeView = getViewName(location.pathname)
    const courseNames = (courses || []).map((c: { name: string }) => c.name).join(', ')
    const cards = srData?.cards || []
    const total = cards.length
    const mastered = cards.filter((c: { S?: number }) => (c.S || 0) > 10).length
    const learning = total - mastered
    const provider = localStorage.getItem('nousai-ai-provider') || 'none'
    const model = localStorage.getItem('nousai-ai-model') || 'default'

    let pageCtxBlock = ''
    if (activePageContext && contextDepth !== 'minimal') {
      const lines = [`- Current page summary: ${activePageContext.summary}`]
      if (contextDepth === 'smart' && activePageContext.activeItem)
        lines.push(`- Active item:\n${activePageContext.activeItem}`)
      if (contextDepth === 'deep') {
        if (activePageContext.activeItem) lines.push(`- Active item:\n${activePageContext.activeItem}`)
        if (activePageContext.fullContent) lines.push(`- Full page content:\n${activePageContext.fullContent}`)
      }
      pageCtxBlock = '\n\nPage context:\n' + lines.join('\n')
    }

    return buildSystemPrompt(activeView, courseNames, total, mastered, learning, provider, model) + pageCtxBlock
  }, [location.pathname, courses, srData, activePageContext, contextDepth])

  // ── Send message ────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    if (!isAIConfigured()) {
      setMessages(prev => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', content: text },
        { id: crypto.randomUUID(), role: 'assistant', content: '⚠️ AI not configured. Go to **Settings → AI Provider** to add your API key.' },
      ])
      setInput('')
      return
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)

    try {
      const systemPrompt = getContext()
      const attachBlock = attachments.length > 0
        ? '\n\n---\nAttached files:\n' + attachments.map(a => {
            if (a.type === 'image') return `[Image: ${a.name}]`
            if (a.type === 'pdf') return `[PDF: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
            return `[File: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
          }).join('\n\n')
        : ''
      const history = [...messages, { ...userMsg, content: userMsg.content + attachBlock }]
        .filter(m => m.content)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      setAttachments([])

      const allMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...history,
      ]

      let accumulated = ''
      await callAI(allMessages, {
        onChunk: (chunk) => {
          accumulated += chunk
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          ))
        },
      }, 'chat')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Request failed'
      setMessages(prev => prev.map(m =>
        m.id === assistantId ? { ...m, content: `❌ Error: ${message}` } : m
      ))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, getContext, attachments])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }, [sendMessage])

  const copyMessage = useCallback(async (id: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch { /* ignore */ }
  }, [])

  const clearChat = useCallback(() => {
    if (messages.length > 0 && !window.confirm('Clear the conversation? This cannot be undone.')) return
    setMessages([])
  }, [messages.length])

  const addAttachment = useCallback(async (file: File) => {
    setAttachError(null)
    let tooMany = false
    setAttachments(prev => {
      if (prev.length >= maxAttachments) { tooMany = true; return prev }
      return prev
    })
    if (tooMany) {
      setAttachError(`Max ${maxAttachments} attachments per message`)
      return
    }
    try {
      const extracted = await extractFileContent(file)
      setAttachments(prev => {
        if (prev.length >= maxAttachments) return prev
        return [...prev, extracted]
      })
    } catch (err) {
      if (err instanceof FileExtractError) setAttachError(err.message)
      else setAttachError('Failed to read file')
    }
  }, [maxAttachments])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // ── Provider label ──────────────────────────────────────
  const providerLabel = useMemo(() => {
    const provider = localStorage.getItem('nousai-ai-provider') || 'none'
    const model = localStorage.getItem('nousai-ai-model') || ''
    return model ? `${provider}/${model.split('-').slice(-2).join('-')}` : provider
  }, [])

  // ── Window actions ──────────────────────────────────────
  const doMinimize = useCallback(() => setWinState('minimized'), [])
  const doMaximize = useCallback(() => setWinState(s => s === 'maximized' ? 'normal' : 'maximized'), [])
  const doHide = useCallback(() => setWinState('hidden'), [])
  const doRestore = useCallback(() => setWinState('normal'), [])

  const bringToFront = useCallback(() => {
    zRef.current += 1
    setZIndex(zRef.current)
  }, [])

  // ── Mobile swipe handlers ───────────────────────────────
  const onTitleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])
  const onTitleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartY.current = null
    if (dy > 40) setWinState('minimized')     // swipe down → minimize
    else if (dy < -40) setWinState('maximized') // swipe up → maximize
  }, [])

  // ── Title bar ───────────────────────────────────────────
  const titleBar = (
    <div
      className="nous-title-bar"
      onTouchStart={isMobile() ? onTitleTouchStart : undefined}
      onTouchEnd={isMobile() ? onTitleTouchEnd : undefined}
      onClick={winState === 'minimized' ? doRestore : undefined}
    >
      <div className="nous-title-bar-left">
        <Brain size={16} style={{ color: 'var(--accent)' }} />
        <span className="nous-panel-title">Nous AI</span>
        <span className="nous-panel-badge">{providerLabel}</span>
      </div>
      <div className="nous-no-drag nous-title-bar-right">
        <button className="nous-win-btn" onClick={doMinimize} title="Minimize">
          <Minus size={14} />
        </button>
        <button className="nous-win-btn" onClick={doMaximize} title={winState === 'maximized' ? 'Restore' : 'Maximize'}>
          {winState === 'maximized' ? <Square size={12} /> : <Maximize2 size={14} />}
        </button>
        <button className="nous-win-btn nous-win-btn--close" onClick={doHide} title="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  )

  // ── Panel body (shared between desktop & mobile) ────────
  const panelBody = (
    <div
      className="nous-panel-body"
      style={{ display: winState === 'minimized' ? 'none' : undefined }}
    >
      {/* Settings drawer */}
      {showSettings && (
        <div className="nous-panel-settings">
          <div className="nous-settings-row">
            <span className="nous-settings-label">Context depth</span>
            <div className="nous-settings-options">
              {([
                { val: 'minimal', label: 'Minimal', tip: 'Only basic stats — fastest & cheapest. No page content sent.' },
                { val: 'smart',   label: 'Smart',   tip: 'Sends page summary + active item. Best balance of context & cost.' },
                { val: 'deep',    label: 'Deep',    tip: 'Sends full page content. Most context-aware, uses more tokens.' },
              ] as const).map(({ val, label, tip }) => (
                <span key={val} className="nous-setting-tip-target">
                  <button
                    className={`nous-settings-opt${contextDepth === val ? ' nous-settings-opt--active' : ''}`}
                    onClick={() => setContextDepth(val)}
                  >{label}</button>
                  <SettingTooltip text={tip} />
                </span>
              ))}
            </div>
          </div>
          <div className="nous-settings-row">
            <span className="nous-settings-label">Max attachments</span>
            <div className="nous-settings-options">
              {([
                { val: 2, tip: 'Up to 2 files per message. Great for quick questions.' },
                { val: 4, tip: 'Up to 4 files per message. Recommended balance.' },
                { val: 8, tip: 'Up to 8 files per message. For complex multi-file analysis.' },
              ] as const).map(({ val, tip }) => (
                <span key={val} className="nous-setting-tip-target">
                  <button
                    className={`nous-settings-opt${maxAttachments === val ? ' nous-settings-opt--active' : ''}`}
                    onClick={() => setMaxAttachments(val)}
                  >{val}</button>
                  <SettingTooltip text={tip} />
                </span>
              ))}
            </div>
          </div>
          <div className="nous-settings-row">
            <span className="nous-settings-label">Clear on navigate</span>
            <span className="nous-setting-tip-target">
              <button
                className={`nous-settings-toggle${clearOnNavigate ? ' nous-settings-toggle--on' : ''}`}
                onClick={() => setClearOnNavigate(!clearOnNavigate)}
              >{clearOnNavigate ? 'On' : 'Off'}</button>
              <SettingTooltip text="Conversation resets automatically when you navigate to a new page." />
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="nous-panel-messages">
        {messages.length === 0 && (
          <div className="nous-panel-empty">
            <Brain size={28} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', lineHeight: 1.5 }}>
              Ask anything about your notes, quiz history, or study progress.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`nous-msg nous-msg--${msg.role}`}>
            {msg.role === 'assistant' ? (
              <>
                <div
                  className="nous-msg-content"
                  dangerouslySetInnerHTML={{ __html: msg.content ? safeRenderMd(msg.content) : '' }}
                />
                {loading && msg.content === '' && (
                  <div className="nous-typing"><span /><span /><span /></div>
                )}
                {msg.content && (
                  <button className="nous-msg-copy" onClick={() => copyMessage(msg.id, msg.content)} title="Copy">
                    {copied === msg.id ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                )}
                {msg.content && !loading && (() => {
                  const actions = detectActions(msg.content)
                  if (!actions.length) return null
                  return (
                    <div className="nous-actions">
                      {actions.map(a => (
                        <button key={a.path} className="nous-action-btn" onClick={() => navigate(a.path)}>
                          {a.label} →
                        </button>
                      ))}
                    </div>
                  )
                })()}
              </>
            ) : (
              <div className="nous-msg-content">{msg.content}</div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Attachment chips */}
      {(attachments.length > 0 || attachError) && (
        <div className="nous-attachments">
          {attachError && <span className="nous-attach-error">{attachError}</span>}
          {attachments.map((a, i) => (
            <span key={i} className="nous-attach-chip">
              <span className="nous-attach-chip-name">
                {a.type === 'image' ? '[img] ' : a.type === 'pdf' ? '[pdf] ' : '[txt] '}
                {a.name}
              </span>
              <button className="nous-attach-chip-remove" onClick={() => removeAttachment(i)} aria-label={`Remove ${a.name}`}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="nous-panel-input-row">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cs,.cpp,.c,.json,.csv,.html,.css"
          style={{ display: 'none' }}
          onChange={async (e) => {
            const files = Array.from(e.target.files || [])
            for (const file of files) await addAttachment(file)
            e.target.value = ''
          }}
        />
        <button
          className="nous-panel-icon-btn nous-panel-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          disabled={attachments.length >= maxAttachments}
        >
          <Paperclip size={14} />
        </button>
        <textarea
          ref={textareaRef}
          className="nous-panel-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Nous AI… (Enter to send)"
          rows={1}
          disabled={loading}
        />
        <button
          className="nous-panel-send"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          aria-label="Send"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )

  // ── Header actions (settings, clear, etc.) ──────────────
  const headerActions = (
    <div className="nous-no-drag nous-title-bar-actions">
      <button
        className={`nous-panel-icon-btn${showSettings ? ' nous-panel-icon-btn--active' : ''}`}
        onClick={() => setShowSettings(s => !s)}
        title="Panel settings"
      >
        <Settings size={14} />
      </button>
      <button
        className="nous-panel-icon-btn"
        onClick={clearChat}
        title="Clear conversation"
        disabled={messages.length === 0}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )

  // ── FAB (visible when hidden) ───────────────────────────
  if (winState === 'hidden') {
    return (
      <button
        className="nous-fab"
        onClick={() => { setWinState('normal'); onOpenChange(true) }}
        aria-label="Open Nous AI assistant"
      >
        <Brain size={22} />
      </button>
    )
  }

  // ── Mobile rendering ────────────────────────────────────
  if (isMobile()) {
    const mobileClass = [
      'nous-mobile-sheet',
      `nous-mobile-sheet--${winState}`,
    ].join(' ')

    return (
      <div
        className={mobileClass}
        role="complementary"
        aria-label="Nous AI assistant panel"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={async (e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files)
          for (const file of files.slice(0, maxAttachments)) await addAttachment(file)
        }}
      >
        {titleBar}
        {headerActions}
        {panelBody}
      </div>
    )
  }

  // ── Desktop rendering (Rnd) ─────────────────────────────
  const isMax = winState === 'maximized'
  const isMin = winState === 'minimized'

  return (
    <Rnd
      ref={rndRef}
      className={`nous-rnd-wrapper${animateClass ? ' nous-rnd-animate' : ''}`}
      style={{ zIndex, display: 'flex', flexDirection: 'column' }}
      position={isMax ? { x: 0, y: 0 } : { x: geo.x, y: geo.y }}
      size={isMax ? { width: '100vw', height: '100vh' } : isMin ? { width: geo.width, height: TITLE_BAR_H } : { width: geo.width, height: geo.height }}
      minWidth={MIN_W}
      minHeight={isMin ? TITLE_BAR_H : MIN_H}
      maxWidth={window.innerWidth * 0.9}
      maxHeight={window.innerHeight * 0.9}
      dragHandleClassName="nous-title-bar"
      cancel=".nous-no-drag"
      enableResizing={!isMax && !isMin}
      disableDragging={isMax}
      bounds="window"
      onDragStart={() => setAnimateClass(false)}
      onDragStop={(_e, d) => {
        setAnimateClass(true)
        let { x, y } = snapToEdges(d.x, d.y, geo.width, geo.height)
        ;({ x, y } = enforceDeadZone(x, y, geo.width, geo.height))
        ;({ x, y } = clampToViewport(x, y, geo.width, geo.height))
        setGeo(prev => ({ ...prev, x, y }))
      }}
      onResizeStart={() => setAnimateClass(false)}
      onResizeStop={(_e, _dir, ref, _delta, position) => {
        setAnimateClass(true)
        const w = parseInt(ref.style.width, 10)
        const h = parseInt(ref.style.height, 10)
        let { x, y } = enforceDeadZone(position.x, position.y, w, h)
        ;({ x, y } = clampToViewport(x, y, w, h))
        setGeo({ x, y, width: w, height: h, state: winState })
      }}
      onMouseDown={bringToFront}
    >
      <div
        className="nous-rnd-inner"
        role="complementary"
        aria-label="Nous AI assistant panel"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={async (e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files)
          for (const file of files.slice(0, maxAttachments)) await addAttachment(file)
        }}
      >
        {titleBar}
        {headerActions}
        {panelBody}
      </div>
    </Rnd>
  )
}
