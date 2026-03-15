/**
 * QuizChat — Per-question AI side chat with streaming
 * Provides context about the question, expected answer, and student's answer
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { JpQuizQuestion, JpQuizAnswer, JpQuizChatMsg } from './types'
import { callAI } from '../../utils/ai'
import type { AIMessage } from '../../utils/ai'
import { safeRenderMd } from '../../utils/renderMd'

interface Props {
  question: JpQuizQuestion
  answer: JpQuizAnswer
  sessionId: string
  onClose: () => void
}

function chatStorageKey(sessionId: string, questionId: string) {
  return `nousai-jpquiz-chat-${sessionId}-${questionId}`
}

function loadMessages(sessionId: string, questionId: string): JpQuizChatMsg[] {
  try {
    const raw = localStorage.getItem(chatStorageKey(sessionId, questionId))
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return []
}

function saveMessages(sessionId: string, questionId: string, msgs: JpQuizChatMsg[]) {
  try {
    localStorage.setItem(chatStorageKey(sessionId, questionId), JSON.stringify(msgs))
  } catch { /* ignore */ }
}

export default function QuizChat({ question, answer, sessionId, onClose }: Props) {
  const [messages, setMessages] = useState<JpQuizChatMsg[]>(() =>
    loadMessages(sessionId, question.id)
  )
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const streamRef = useRef('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(sessionId, question.id, messages)
    }
  }, [messages, sessionId, question.id])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')

    const newMsgs: JpQuizChatMsg[] = [...messages, { role: 'user', text }]
    setMessages(newMsgs)
    setIsStreaming(true)
    streamRef.current = ''

    // Build AI context
    const systemMsg = `You are a helpful Japanese language tutor. The student just answered a quiz question.

Question: ${question.questionText}
Expected answer: ${question.expectedAnswer}${question.acceptableAnswers?.length ? '\nAlso acceptable: ' + question.acceptableAnswers.join(', ') : ''}
Student's answer: ${answer.userAnswer}
Score: ${answer.aiScore}/100
Input method: ${answer.inputMethod}
${question.explanation ? 'Explanation: ' + question.explanation : ''}

Help the student understand. Be encouraging, concise, and teach relevant Japanese grammar/vocabulary. Reply in English but use Japanese examples with readings when helpful.`

    const aiMessages: AIMessage[] = [
      { role: 'system', content: systemMsg },
    ]

    // Add image if available
    if (question.questionImageBase64) {
      aiMessages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${question.questionImageMime || 'image/jpeg'};base64,${question.questionImageBase64}` } },
          { type: 'text', text: '(This is the question image for context)' },
        ],
      })
      aiMessages.push({ role: 'assistant', content: 'I can see the question image. How can I help?' })
    }

    // Add chat history
    for (const m of newMsgs) {
      aiMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })
    }

    try {
      const result = await callAI(aiMessages, {
        temperature: 0.7,
        maxTokens: 500,
        onChunk: (chunk) => {
          if (!mountedRef.current) return
          streamRef.current += chunk
          setMessages([...newMsgs, { role: 'ai', text: streamRef.current }])
        },
      })

      if (!mountedRef.current) return
      const finalMsgs: JpQuizChatMsg[] = [...newMsgs, { role: 'ai', text: result }]
      setMessages(finalMsgs)
      // Save happens via the useEffect above
    } catch (e) {
      console.error('QuizChat AI error:', e)
      const errorMsgs: JpQuizChatMsg[] = [...newMsgs, { role: 'ai', text: 'Sorry, I couldn\'t respond. Please try again.' }]
      setMessages(errorMsgs)
    }
    setIsStreaming(false)
  }, [input, isStreaming, messages, question, answer, sessionId])

  return (
    <div style={{
      marginTop: 12,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: 14,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: 400,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: '1px solid var(--border-color)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>💬 Ask about this question</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text-muted)',
          cursor: 'pointer', fontSize: 16,
        }}>✕</button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '10px 14px',
        display: 'flex', flexDirection: 'column', gap: 8,
        minHeight: 120, maxHeight: 260,
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: 20 }}>
            Ask anything about this question!
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '8px 12px',
            borderRadius: 10,
            fontSize: 13,
            lineHeight: 1.5,
            background: m.role === 'user' ? 'var(--accent-color, #6C5CE7)' : 'var(--bg-primary)',
            color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
            wordBreak: 'break-word',
          }}>
            {m.role === 'user'
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
              : <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.text || '…') }} />
            }
            {m.role === 'ai' && m.text && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(m.text).then(() => {
                    setCopiedIdx(i)
                    setTimeout(() => setCopiedIdx(null), 1500)
                  })
                }}
                title="Copy response"
                style={{
                  display: 'block', marginTop: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 0, fontSize: 11,
                  fontFamily: 'inherit',
                }}
              >
                {copiedIdx === i ? '✓ Copied' : '⎘ Copy'}
              </button>
            )}
          </div>
        ))}
        {isStreaming && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div style={{
            alignSelf: 'flex-start', padding: '8px 12px', borderRadius: 10,
            fontSize: 13, background: 'var(--bg-primary)', color: 'var(--text-muted)',
          }}>
            ⏳ Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 10px',
        borderTop: '1px solid var(--border-color)',
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendMessage() }}
          placeholder="Ask about this answer..."
          disabled={isStreaming}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 13,
            background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
            borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={isStreaming || !input.trim()}
          style={{
            padding: '8px 14px', background: 'var(--accent-color, #6C5CE7)',
            border: 'none', borderRadius: 8, color: '#fff', fontSize: 13,
            fontWeight: 600, cursor: input.trim() ? 'pointer' : 'not-allowed',
            opacity: input.trim() ? 1 : 0.5, fontFamily: 'inherit',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
