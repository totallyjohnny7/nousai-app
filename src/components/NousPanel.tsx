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
  const [attachments, setAttachments] = useState<AttachedFile[]>([])
  const [attachError, setAttachError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; currentX: number; currentY: number } | null>(null)
  const posRef = useRef(pos)
  const panelRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { courses, srData, activePageContext } = useStore()

  // ── Settings state ───────────────────────────────────────
  const [showSettings, setShowSettings] = useState(false)
  const [contextDepth, setContextDepthState] = useState<'minimal' | 'smart' | 'deep'>(() =>
    (localStorage.getItem('nous_context_depth') as 'minimal' | 'smart' | 'deep') || 'smart'
  )
  const [maxAttachments, setMaxAttachmentsState] = useState<number>(() =>
    parseInt(localStorage.getItem('nous_max_attachments') || '4', 10)
  )
  const [floatOnOpen, setFloatOnOpenState] = useState(() =>
    localStorage.getItem('nous_float_on_open') === 'true'
  )
  const [clearOnNavigate, setClearOnNavigateState] = useState(() =>
    localStorage.getItem('nous_clear_on_navigate') === 'true'
  )

  // Persist panel open/closed state
  useEffect(() => {
    try { localStorage.setItem('nous_panel_open', String(open)) } catch { /* ignore */ }
  }, [open])

  useEffect(() => {
    try { localStorage.setItem('nous_panel_floating', String(isFloating)) } catch { /* ignore */ }
  }, [isFloating])

  const posSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (posSaveTimer.current) clearTimeout(posSaveTimer.current)
    posSaveTimer.current = setTimeout(() => {
      try { localStorage.setItem('nous_panel_pos', JSON.stringify(pos)) } catch { /* ignore */ }
    }, 200)
    return () => {
      if (posSaveTimer.current) clearTimeout(posSaveTimer.current)
    }
  }, [pos])

  const setContextDepth = useCallback((v: 'minimal' | 'smart' | 'deep') => {
    setContextDepthState(v)
    try { localStorage.setItem('nous_context_depth', v) } catch { /* ignore */ }
  }, [])

  const setMaxAttachments = useCallback((v: number) => {
    setMaxAttachmentsState(v)
    try { localStorage.setItem('nous_max_attachments', String(v)) } catch { /* ignore */ }
  }, [])

  const setFloatOnOpen = useCallback((v: boolean) => {
    setFloatOnOpenState(v)
    try { localStorage.setItem('nous_float_on_open', String(v)) } catch { /* ignore */ }
  }, [])

  const setClearOnNavigate = useCallback((v: boolean) => {
    setClearOnNavigateState(v)
    try { localStorage.setItem('nous_clear_on_navigate', String(v)) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (open && floatOnOpen) setIsFloating(true)
  }, [open, floatOnOpen])

  useEffect(() => {
    if (clearOnNavigate) setMessages([])
  }, [location.pathname, clearOnNavigate])

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const courseNames = (courses || []).map((c: any) => c.name).join(', ')
    const cards = srData?.cards || []
    const total = cards.length
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mastered = cards.filter((c: any) => (c.stability || 0) > 10).length
    const learning = total - mastered
    const provider = localStorage.getItem('nousai-ai-provider') || 'none'
    const model = localStorage.getItem('nousai-ai-model') || 'default'

    let pageCtxBlock = ''
    if (activePageContext && contextDepth !== 'minimal') {
      const lines = [
        `- Current page summary: ${activePageContext.summary}`,
      ]
      if (contextDepth === 'smart' && activePageContext.activeItem) {
        lines.push(`- Active item:\n${activePageContext.activeItem}`)
      }
      if (contextDepth === 'deep') {
        if (activePageContext.activeItem) lines.push(`- Active item:\n${activePageContext.activeItem}`)
        if (activePageContext.fullContent) lines.push(`- Full page content:\n${activePageContext.fullContent}`)
      }
      pageCtxBlock = '\n\nPage context:\n' + lines.join('\n')
    }

    return buildSystemPrompt(activeView, courseNames, total, mastered, learning, provider, model) + pageCtxBlock
  }, [location.pathname, courses, srData, activePageContext, contextDepth])

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
      // Build attachment block to append to user message
      // TODO: upgrade to vision content array when callAI supports image_url content blocks
      const attachBlock = attachments.length > 0
        ? '\n\n---\nAttached files:\n' + attachments.map(a => {
            if (a.type === 'image') return `[Image: ${a.name}]`
            if (a.type === 'pdf') return `[PDF: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
            return `[File: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
          }).join('\n\n')
        : ''
      // Build messages array: inject fresh system prompt on every send
      const history = [...messages, { ...userMsg, content: userMsg.content + attachBlock }]
        .filter(m => m.content) // skip empty placeholder
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      // Clear attachments after send
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
      if (err instanceof FileExtractError) {
        setAttachError(err.message)
      } else {
        setAttachError('Failed to read file')
      }
    }
  }, [maxAttachments])

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Paste handler for images
  useEffect(() => {
    if (!open) return
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
  }, [open, addAttachment])

  // Keep posRef in sync so handleDragStart doesn't need pos as a dependency
  posRef.current = pos

  const handleDragStart = useCallback((e: React.PointerEvent) => {
    if (!isFloating) return
    // Don't start drag if clicking a button or interactive element
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      originX: posRef.current.x, originY: posRef.current.y,
      currentX: posRef.current.x, currentY: posRef.current.y,
    }
  }, [isFloating])

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const newX = dragRef.current.originX + dx
    const newY = dragRef.current.originY + dy
    // Clamp so at least 80px of the panel remains visible on each axis
    const clampedX = Math.max(-300, Math.min(newX, window.innerWidth - 80))
    const clampedY = Math.max(0, Math.min(newY, window.innerHeight - 80))
    // Direct DOM mutation — no React re-render during drag (smooth 60fps)
    dragRef.current.currentX = clampedX
    dragRef.current.currentY = clampedY
    if (panelRef.current) {
      panelRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`
    }
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!dragRef.current) return
    const { currentX, currentY } = dragRef.current
    dragRef.current = null
    // Commit final position to React state (triggers save to localStorage)
    setPos({ x: currentX, y: currentY })
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
        ref={panelRef}
        className={`nous-panel${open ? ' nous-panel--open' : ''}${isFloating ? ' nous-panel--floating' : ''}`}
        style={isFloating ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
        role="complementary"
        aria-label="Nous AI assistant panel"
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
        onDrop={async (e) => {
          e.preventDefault()
          const files = Array.from(e.dataTransfer.files)
          for (const file of files.slice(0, maxAttachments)) {
            await addAttachment(file)
          }
        }}
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
          <div className="nous-panel-header-actions" onPointerDown={(e) => e.stopPropagation()}>
            <button
              className="nous-panel-icon-btn"
              onClick={() => setIsFloating(f => !f)}
              title={isFloating ? 'Dock panel' : 'Float panel'}
            >
              {isFloating ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
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
            <button
              className="nous-panel-icon-btn"
              onClick={() => setOpen(false)}
              title="Collapse"
            >
              <X size={14} />
            </button>
          </div>
        </div>

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
                    >
                      {label}
                    </button>
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
                    >
                      {val}
                    </button>
                    <SettingTooltip text={tip} />
                  </span>
                ))}
              </div>
            </div>
            <div className="nous-settings-row">
              <span className="nous-settings-label">Float on open</span>
              <span className="nous-setting-tip-target">
                <button
                  className={`nous-settings-toggle${floatOnOpen ? ' nous-settings-toggle--on' : ''}`}
                  onClick={() => setFloatOnOpen(!floatOnOpen)}
                >
                  {floatOnOpen ? 'On' : 'Off'}
                </button>
                <SettingTooltip text="Panel detaches and floats freely when opened. Drag the header to reposition." />
              </span>
            </div>
            <div className="nous-settings-row">
              <span className="nous-settings-label">Clear on navigate</span>
              <span className="nous-setting-tip-target">
                <button
                  className={`nous-settings-toggle${clearOnNavigate ? ' nous-settings-toggle--on' : ''}`}
                  onClick={() => setClearOnNavigate(!clearOnNavigate)}
                >
                  {clearOnNavigate ? 'On' : 'Off'}
                </button>
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

        {/* Attachment chips */}
        {(attachments.length > 0 || attachError) && (
          <div className="nous-attachments">
            {attachError && (
              <span className="nous-attach-error">{attachError}</span>
            )}
            {attachments.map((a, i) => (
              <span key={i} className="nous-attach-chip">
                <span className="nous-attach-chip-name">
                  {a.type === 'image' ? '[img] ' : a.type === 'pdf' ? '[pdf] ' : '[txt] '}
                  {a.name}
                </span>
                <button
                  className="nous-attach-chip-remove"
                  onClick={() => removeAttachment(i)}
                  aria-label={`Remove ${a.name}`}
                >
                  ×
                </button>
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
    </>
  )
}
