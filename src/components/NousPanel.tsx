/**
 * NousPanel — Persistent floating AI assistant panel
 * Pinned to the right side of every page, never interrupts navigation.
 * Collapsed: 40px vertical tab. Expanded: 350px drawer (mobile: full-width bottom sheet).
 * State persisted in localStorage key: nous_panel_open
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Brain, X, Trash2, Copy, Check, Send, Paperclip, Settings, Maximize2, Minimize2 } from 'lucide-react'
import { useStore } from '../store'
import { callAI, isAIConfigured } from '../utils/ai'
import { safeRenderMd } from '../utils/renderMd'

/* ── Types ─────────────────────────────────────────────── */
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

/* ── Helpers ───────────────────────────────────────────── */
function getViewName(pathname: string): string {
  const map: Record<string, string> = {
    '/': 'Dashboard',
    '/quiz': 'Quizzes',
    '/quizzes': 'Quizzes',
    '/learn': 'Learn',
    '/flashcards': 'Flashcards',
    '/library': 'Library',
    '/ai': 'AI Tools',
    '/tools': 'Tools',
    '/timer': 'Timer',
    '/calendar': 'Calendar',
    '/settings': 'Settings',
    '/course': 'Course',
    '/study': 'Study',
  }
  return map[pathname] || pathname
}

function buildSystemPrompt(
  activeView: string,
  courseNames: string,
  total: number,
  mastered: number,
  learning: number,
  provider: string,
  model: string,
): string {
  return `You are the Nous AI assistant embedded inside the Nous AI study app.

Current context:
- Page/View: ${activeView}
- Courses: ${courseNames || 'None loaded'}
- Flashcards Total: ${total} | Mastered: ${mastered} | Learning: ${learning}
- Active Provider: ${provider} (${model})

Answer questions about the user's notes, vocab, quizzes, and study progress. Keep answers concise and formatted in Markdown. You can suggest actions like starting a quiz, reviewing flashcards, or using AI tools.`
}

/* ── Action detection ──────────────────────────────────── */
interface DetectedAction {
  label: string
  path: string
}

function detectActions(text: string): DetectedAction[] {
  const actions: DetectedAction[] = []
  const lower = text.toLowerCase()
  if (lower.includes('start a quiz') || lower.includes('take a quiz') || lower.includes('quiz yourself')) {
    actions.push({ label: 'Start Quiz', path: '/quiz' })
  }
  if (lower.includes('review flashcard') || lower.includes('review your card') || lower.includes('spaced repetition')) {
    actions.push({ label: 'Review Flashcards', path: '/flashcards' })
  }
  if (lower.includes('mind map') || lower.includes('ai tool') || lower.includes('open the ai')) {
    actions.push({ label: 'Open AI Tools', path: '/ai' })
  }
  if (lower.includes('study session') || lower.includes('timer') || lower.includes('pomodoro')) {
    actions.push({ label: 'Start Timer', path: '/timer' })
  }
  return actions
}

/* ── Component ─────────────────────────────────────────── */
export default function NousPanel() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('nous_panel_open') === 'true' } catch { return false }
  })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Floating / drag state ────────────────────────────────
  const [isFloating, setIsFloating] = useState(() => {
    try { return localStorage.getItem('nous_panel_floating') === 'true' } catch { return false }
  })
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('nous_panel_pos')
      return saved ? JSON.parse(saved) : { x: window.innerWidth - 400, y: 80 }
    } catch { return { x: window.innerWidth - 400, y: 80 } }
  })
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { courses, srData } = useStore()

  // Persist panel open/closed state
  useEffect(() => {
    try { localStorage.setItem('nous_panel_open', String(open)) } catch { /* ignore */ }
  }, [open])

  useEffect(() => {
    try { localStorage.setItem('nous_panel_floating', String(isFloating)) } catch { /* ignore */ }
  }, [isFloating])

  useEffect(() => {
    try { localStorage.setItem('nous_panel_pos', JSON.stringify(pos)) } catch { /* ignore */ }
  }, [pos])

  // Auto-scroll to latest message
  useEffect(() => {
    if (open) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, open])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const getContext = useCallback(() => {
    const activeView = getViewName(location.pathname)
    const courseNames = (courses || []).map((c: any) => c.name).join(', ')
    const cards = srData?.cards || []
    const total = cards.length
    const mastered = cards.filter((c: any) => (c.stability || 0) > 10).length
    const learning = total - mastered
    const provider = localStorage.getItem('nousai-ai-provider') || 'none'
    const model = localStorage.getItem('nousai-ai-model') || 'default'
    return buildSystemPrompt(activeView, courseNames, total, mastered, learning, provider, model)
  }, [location.pathname, courses, srData])

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
      // Build messages array: inject fresh system prompt on every send
      const history = [...messages, userMsg]
        .filter(m => m.content) // skip empty placeholder
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

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
      })

      // If no streaming happened (provider returned full response), accumulated may be empty
      // In that case, callAI returned the full text — but we used onChunk so it should stream
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, content: `❌ Error: ${err?.message || 'Request failed'}` }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, getContext])

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

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!isFloating) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
  }, [isFloating, pos])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setPos({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy })
  }, [])

  const handleDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  const provider = localStorage.getItem('nousai-ai-provider') || 'none'
  const model = localStorage.getItem('nousai-ai-model') || ''
  const providerLabel = model ? `${provider}/${model.split('-').slice(-2).join('-')}` : provider

  return (
    <>
      {/* ── Collapsed tab (always visible) ── */}
      {!open && (
        <button
          className="nous-panel-tab"
          onClick={() => setOpen(true)}
          aria-label="Open Nous AI assistant"
        >
          <Brain size={16} />
          <span className="nous-panel-tab-label">✦ Nous</span>
        </button>
      )}

      {/* ── Panel drawer ── */}
      <div
        className={`nous-panel${open ? ' nous-panel--open' : ''}${isFloating ? ' nous-panel--floating' : ''}`}
        style={isFloating ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        role="complementary"
        aria-label="Nous AI assistant panel"
      >
        {/* Header */}
        <div
          className={`nous-panel-header${isFloating ? ' nous-panel-drag-handle' : ''}`}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="nous-panel-header-left">
            <Brain size={16} style={{ color: 'var(--accent)' }} />
            <span className="nous-panel-title">Nous AI</span>
            <span className="nous-panel-badge">{providerLabel}</span>
          </div>
          <div className="nous-panel-header-actions">
            <button
              className="nous-panel-icon-btn"
              onClick={() => setIsFloating(f => !f)}
              title={isFloating ? 'Dock panel' : 'Float panel'}
            >
              {isFloating ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              className="nous-panel-icon-btn"
              onClick={clearChat}
              title="Clear conversation"
              disabled={messages.length === 0}
            >
              <Trash2 size={14} />
            </button>
            <button
              className="nous-panel-icon-btn"
              onClick={() => setOpen(false)}
              title="Collapse"
            >
              <X size={14} />
            </button>
          </div>
        </div>

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
            <div
              key={msg.id}
              className={`nous-msg nous-msg--${msg.role}`}
            >
              {msg.role === 'assistant' ? (
                <>
                  <div
                    className="nous-msg-content"
                    dangerouslySetInnerHTML={{ __html: msg.content ? safeRenderMd(msg.content) : '' }}
                  />
                  {/* Typing indicator while streaming */}
                  {loading && msg.content === '' && (
                    <div className="nous-typing">
                      <span /><span /><span />
                    </div>
                  )}
                  {/* Copy button */}
                  {msg.content && (
                    <button
                      className="nous-msg-copy"
                      onClick={() => copyMessage(msg.id, msg.content)}
                      title="Copy"
                    >
                      {copied === msg.id ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  )}
                  {/* Action suggestions */}
                  {msg.content && !loading && (() => {
                    const actions = detectActions(msg.content)
                    if (!actions.length) return null
                    return (
                      <div className="nous-actions">
                        {actions.map(a => (
                          <button
                            key={a.path}
                            className="nous-action-btn"
                            onClick={() => navigate(a.path)}
                          >
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

        {/* Input */}
        <div className="nous-panel-input-row">
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
    </>
  )
}
