/**
 * FileViewerModal.tsx
 * Full-screen file viewer with AI chat panel.
 * Left (70%): native file preview (PDF iframe, image, text) with draggable divider
 * Right (30%): scoped AI chat with on-demand Mistral OCR
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Loader2, Search, Send, X } from 'lucide-react'
import type { LinkItem } from '../types'
import { callAI } from '../utils/ai'
import { runMistralOcr, type OcrStage } from '../utils/mistralOcrService'
import { loadFile, saveFile } from '../utils/fileStore'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  item: LinkItem
  courseId: string
  accentColor: string
  onClose: () => void
}

// ─── OCR helpers ──────────────────────────────────────────────────────────────

function ocrCacheKey(courseId: string, linkId: string) {
  return `nousai-course-${courseId}-links-ocr-${linkId}`
}

async function dataUrlToFile(dataUrl: string, name: string, type: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], name, { type })
}

const MAX_OCR_CHARS = 80_000

function buildSystemPrompt(filename: string, ocrText: string): string {
  const truncated = ocrText.length > MAX_OCR_CHARS
  const text = truncated ? ocrText.slice(0, MAX_OCR_CHARS) : ocrText
  const truncNote = truncated
    ? '\n[Note: document was truncated to the first ~80,000 characters due to length.]'
    : ''
  return `You are an AI assistant analyzing the file "${filename}".
The full extracted text follows. Answer the user's questions based only on this content.

---
${text}${truncNote}
---`
}

// ─── Search types ─────────────────────────────────────────────────────────────

interface SearchResult {
  snippet: string    // ~120-char window around the match
  matchText: string  // exact matched substring (preserves original casing)
  offset: number     // char position in full text (for stable ordering)
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export function FileViewerModal({ item, courseId, accentColor, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  // leftWidth: percentage of total width for the file viewer panel (default 70)
  const [leftWidth, setLeftWidth] = useState(70)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchIdx, setSearchIdx] = useState(0)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchMsg, setSearchMsg] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Convert dataUrl → blob URL for performant iframe rendering
  useEffect(() => {
    if (!item.dataUrl) return
    let url: string
    let unmounted = false
    fetch(item.dataUrl)
      .then(r => r.blob())
      .then(blob => {
        url = URL.createObjectURL(blob)
        if (!unmounted) setBlobUrl(url)
        else URL.revokeObjectURL(url)
      })
      .catch(() => { if (!unmounted) setBlobUrl(null) })
    return () => {
      unmounted = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [item.dataUrl])

  // Close on Escape (or close search bar first if open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (searchOpen) { setSearchOpen(false); setSearchResults([]); setSearchMsg(null) }
        else onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, searchOpen])

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50)
  }, [searchOpen])

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); setSearchMsg(null); return }
    setSearchLoading(true); setSearchMsg(null)

    let text: string | null = null

    if (item.fileType?.startsWith('text/') || item.fileType?.includes('json') || item.fileType?.includes('xml')) {
      try { text = atob(item.dataUrl?.split(',')[1] ?? '') } catch { /* ignore */ }
    } else {
      text = await loadFile(ocrCacheKey(courseId, item.id))
    }

    if (!text) {
      setSearchMsg('No scan available — ask the AI a question first to enable search.')
      setSearchLoading(false)
      return
    }

    const lower = text.toLowerCase()
    const qLower = query.toLowerCase()
    const results: SearchResult[] = []
    let pos = 0
    while ((pos = lower.indexOf(qLower, pos)) !== -1) {
      const s = Math.max(0, pos - 60)
      const e = Math.min(text.length, pos + query.length + 60)
      results.push({ snippet: text.slice(s, e), matchText: text.slice(pos, pos + query.length), offset: pos })
      pos += query.length
      if (results.length >= 200) break
    }

    setSearchResults(results)
    setSearchIdx(0)
    setSearchLoading(false)
    if (results.length === 0) setSearchMsg(`No matches for "${query}"`)
  }, [item, courseId])

  // Drag divider handlers
  const onDividerMouseDown = () => { isDragging.current = true }
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftWidth(Math.min(85, Math.max(30, pct)))
    }
    const onMouseUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'var(--bg-primary)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
        borderBottom: searchOpen ? 'none' : '1px solid var(--border)', flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
        }}>
          <X size={16} /> Close
        </button>
        <span style={{
          flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {item.name}
        </span>
        {item.fileSize && (
          <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {(item.fileSize / (1024 * 1024)).toFixed(1)} MB
          </span>
        )}
        <button
          onClick={() => {
            setSearchOpen(o => !o)
            if (searchOpen) { setSearchResults([]); setSearchQuery(''); setSearchMsg(null) }
          }}
          title="Search in document (Ctrl+F)"
          style={{
            background: searchOpen ? accentColor : 'none', border: 'none', cursor: 'pointer',
            color: searchOpen ? '#fff' : 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
            padding: '4px 8px', borderRadius: 6,
          }}
        >
          <Search size={14} />
        </button>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div style={{
          padding: '8px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          background: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void performSearch(searchQuery) }}
              placeholder="Search in document…"
              style={{
                flex: 1, fontSize: 13, padding: '6px 10px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-input)',
                color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none',
              }}
            />
            <button
              onClick={() => void performSearch(searchQuery)}
              disabled={!searchQuery.trim() || searchLoading}
              style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: !searchQuery.trim() || searchLoading ? 'var(--border)' : accentColor,
                color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {searchLoading ? <Loader2 size={13} className="spin" /> : 'Search'}
            </button>
            {searchResults.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                  {searchIdx + 1} of {searchResults.length}
                </span>
                <button onClick={() => setSearchIdx(i => Math.max(0, i - 1))} disabled={searchIdx === 0}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}>
                  <ChevronUp size={15} />
                </button>
                <button onClick={() => setSearchIdx(i => Math.min(searchResults.length - 1, i + 1))} disabled={searchIdx === searchResults.length - 1}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}>
                  <ChevronDown size={15} />
                </button>
              </>
            )}
          </div>

          {/* Results strip */}
          {searchMsg && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>{searchMsg}</div>
          )}
          {searchResults.length > 0 && (
            <div style={{
              marginTop: 8, maxHeight: 160, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {searchResults.map((r, i) => (
                <div
                  key={r.offset}
                  onClick={() => setSearchIdx(i)}
                  style={{
                    padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
                    fontFamily: 'DM Mono, monospace', lineHeight: 1.5,
                    background: i === searchIdx ? `${accentColor}22` : 'var(--bg-card)',
                    border: i === searchIdx ? `1px solid ${accentColor}66` : '1px solid transparent',
                    color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                >
                  <SnippetText snippet={r.snippet} matchText={r.matchText} accentColor={accentColor} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Body: resizable split */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: file viewer */}
        <div style={{ width: `${leftWidth}%`, flexShrink: 0, overflow: 'hidden' }}>
          <FilePreview item={item} blobUrl={blobUrl} accentColor={accentColor} />
        </div>

        {/* Drag handle */}
        <div
          onMouseDown={onDividerMouseDown}
          style={{
            width: 5, flexShrink: 0, cursor: 'col-resize',
            background: 'var(--border)',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = accentColor)}
          onMouseOut={e => (e.currentTarget.style.background = 'var(--border)')}
        />

        {/* Right: chat panel */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FileViewerChat item={item} courseId={courseId} accentColor={accentColor} />
        </div>
      </div>
    </div>
  )
}

// ─── File preview renderer ─────────────────────────────────────────────────

function FilePreview({ item, blobUrl, accentColor }: { item: LinkItem; blobUrl: string | null; accentColor: string }) {
  if (!item.dataUrl) {
    return <CenteredMsg>File data unavailable — try re-uploading.</CenteredMsg>
  }

  if (item.fileType === 'application/pdf') {
    if (!blobUrl) return <CenteredMsg>Loading PDF…</CenteredMsg>
    return (
      <iframe
        src={blobUrl}
        title={item.name}
        style={{ width: '100%', height: '100%', border: 'none' }}
      />
    )
  }

  if (item.fileType?.startsWith('image/')) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
        <img src={item.dataUrl} alt={item.name} style={{ maxWidth: '100%', borderRadius: 8 }} />
      </div>
    )
  }

  if (item.fileType?.startsWith('text/') || item.fileType?.includes('json') || item.fileType?.includes('xml')) {
    let text = ''
    try { text = atob(item.dataUrl.split(',')[1] ?? '') } catch { text = '(could not decode file)' }
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'auto', padding: 16 }}>
        <pre style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {text}
        </pre>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <span style={{ fontSize: 40 }}>📎</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Preview not available for this file type.</span>
      <a href={item.dataUrl} download={item.name} style={{
        padding: '8px 16px', borderRadius: 8, background: accentColor,
        color: '#fff', fontWeight: 700, fontSize: 13, textDecoration: 'none',
      }}>Download</a>
    </div>
  )
}

function CenteredMsg({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
      {children}
    </div>
  )
}

function SnippetText({ snippet, matchText, accentColor }: { snippet: string; matchText: string; accentColor: string }) {
  const idx = snippet.toLowerCase().indexOf(matchText.toLowerCase())
  if (idx === -1) return <span>{snippet}</span>
  return (
    <>
      <span style={{ color: 'var(--text-dim)' }}>{snippet.slice(0, idx)}</span>
      <span style={{ background: `${accentColor}55`, borderRadius: 2, padding: '0 1px', color: 'var(--text-primary)', fontWeight: 700 }}>
        {snippet.slice(idx, idx + matchText.length)}
      </span>
      <span style={{ color: 'var(--text-dim)' }}>{snippet.slice(idx + matchText.length)}</span>
    </>
  )
}

// ─── Chat message types ───────────────────────────────────────────────────────

interface ChatMsg {
  role: 'user' | 'ai'
  text: string
}

// ─── FileViewerChat component ─────────────────────────────────────────────────

interface ChatProps {
  item: LinkItem
  courseId: string
  accentColor: string
}

function FileViewerChat({ item, courseId, accentColor }: ChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ocrStage, setOcrStage] = useState<OcrStage | null>(null)
  const [ocrPct, setOcrPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [retryFn, setRetryFn] = useState<(() => void) | null>(null)
  const ocrTextRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function stageToPercent(stage: OcrStage): number {
    if (stage === 'reading') return 15
    if (stage === 'ocr') return 60
    return 100
  }

  const getOcrText = useCallback(async (): Promise<string> => {
    if (ocrTextRef.current) return ocrTextRef.current

    const cached = await loadFile(ocrCacheKey(courseId, item.id))
    if (cached) {
      ocrTextRef.current = cached
      return cached
    }

    if (!item.dataUrl) throw new Error('File data not available. Try re-uploading the file.')
    if (!item.fileType) throw new Error('Unknown file type — cannot run OCR.')

    setOcrStage('reading')
    setOcrPct(15)

    const file = await dataUrlToFile(item.dataUrl, item.name, item.fileType)
    const markdown = await runMistralOcr(file, (stage: OcrStage, _message: string) => {
      setOcrStage(stage)
      setOcrPct(stageToPercent(stage))
    })

    setOcrStage(null)
    setOcrPct(0)

    // Fire-and-forget cache write
    void saveFile(ocrCacheKey(courseId, item.id), markdown)
    ocrTextRef.current = markdown
    return markdown
  }, [item.id, item.dataUrl, item.fileType, item.name, courseId])

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || loading) return
    if (!overrideText) setInput('')
    setError(null)
    setRetryFn(null)

    const userMsg: ChatMsg = { role: 'user', text }
    setMessages(prev => [...prev, userMsg, { role: 'ai', text: '' }])
    setLoading(true)

    try {
      const ocrText = await getOcrText()
      const systemPrompt = buildSystemPrompt(item.name, ocrText)

      const allMsgs = [...messages, userMsg]
      const aiMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...allMsgs.map(m => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        })),
      ]

      let streamed = ''
      await callAI(aiMessages, {
        onChunk: (chunk: string) => {
          streamed += chunk
          setMessages(prev => {
            const copy = [...prev]
            copy[copy.length - 1] = { role: 'ai', text: streamed }
            return copy
          })
        },
      }, 'ocr')

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      const isKeyError = msg.includes('Mistral API key') || msg.includes('Invalid Mistral') || msg.includes('not found')
      const isNetworkError = msg.includes('timed out') || msg.includes('fetch') || msg.includes('network') || msg.toLowerCase().includes('connection')

      let displayMsg: string
      if (isKeyError) {
        displayMsg = 'Set up your OCR key in Settings → AI Providers → PDF & Image OCR to enable full-document AI.'
      } else if (isNetworkError) {
        displayMsg = 'Could not reach OCR service. Check your connection and try again.'
        // Offer retry for network/timeout errors
        setRetryFn(() => () => sendMessage(text))
      } else {
        displayMsg = msg
        setRetryFn(() => () => sendMessage(text))
      }

      setError(displayMsg)
      setMessages(prev => prev.slice(0, -1))
      setOcrStage(null)
      setOcrPct(0)
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, getOcrText, item.name])

  const isOcrRunning = ocrStage !== null && ocrStage !== 'done'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>
        Ask about this file
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && !isOcrRunning && (
          <div style={{ color: 'var(--text-dim)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            Ask anything about <strong>{item.name}</strong>.<br />
            {ocrTextRef.current ? '' : 'The document will be scanned on your first question.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            padding: '8px 12px',
            borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
            background: m.role === 'user' ? accentColor : 'var(--bg-card)',
            color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {m.text || (m.role === 'ai' && loading
              ? <Loader2 size={14} className="spin" />
              : null
            )}
          </div>
        ))}
        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: 12 }}>
            <div>{error}</div>
            {retryFn && (
              <button
                onClick={() => retryFn()}
                style={{ marginTop: 6, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                Retry
              </button>
            )}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* OCR progress bar */}
      {isOcrRunning && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 4 }}>
            {ocrStage === 'reading' ? 'Reading file…' : 'Scanning document with Mistral OCR…'}
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${ocrPct}%`, background: accentColor, borderRadius: 2, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() } }}
          placeholder={isOcrRunning ? 'Scanning document…' : 'Ask anything about this file…'}
          disabled={isOcrRunning || loading}
          style={{ flex: 1, fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }}
        />
        <button
          onClick={() => void sendMessage()}
          disabled={!input.trim() || isOcrRunning || loading}
          style={{
            padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: (!input.trim() || isOcrRunning || loading) ? 'var(--border)' : accentColor,
            color: '#fff', display: 'flex', alignItems: 'center',
          }}
        >
          {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
        </button>
      </div>
    </div>
  )
}
