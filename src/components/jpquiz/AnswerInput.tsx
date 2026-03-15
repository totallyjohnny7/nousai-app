/**
 * AnswerInput — Type (IME) + Speak input for Japanese quiz answers
 * Handles both keyboard input and Web Speech API dictation
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { startDictation, stopDictation } from '../../utils/speechTools'

interface Props {
  mode: 'typed' | 'spoken' | 'both'
  onSubmit: (answer: string, method: 'typed' | 'spoken') => void
  disabled?: boolean
  placeholder?: string
}

export default function AnswerInput({ mode, onSubmit, disabled, placeholder }: Props) {
  const [text, setText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      stopDictation()
    }
  }, [])

  // Focus input on mount
  useEffect(() => {
    if (mode !== 'spoken') inputRef.current?.focus()
  }, [mode])

  const handleSubmit = useCallback(() => {
    const answer = text.trim()
    if (!answer) return
    onSubmit(answer, isListening ? 'spoken' : 'typed')
    setText('')
    setInterim('')
  }, [text, onSubmit, isListening])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Allow Enter to submit (but not during IME composition)
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleDictation = useCallback(async () => {
    if (isListening) {
      stopDictation()
      setIsListening(false)
      setInterim('')
      return
    }

    setIsListening(true)
    setInterim('')
    try {
      await startDictation(
        {
          onResult: (result, isFinal) => {
            if (!mountedRef.current) return
            if (isFinal) {
              setText(prev => {
                const combined = prev ? prev + ' ' + result : result
                return combined.trim()
              })
              setInterim('')
            } else {
              setInterim(result)
            }
          },
          onError: (err) => {
            if (!mountedRef.current) return
            console.warn('Dictation error:', err)
            setIsListening(false)
            setInterim('')
          },
          onEnd: () => {
            if (!mountedRef.current) return
            setIsListening(false)
            setInterim('')
          },
        },
        { language: 'ja-JP', interimResults: true },
      )
    } catch {
      setIsListening(false)
    }
  }, [isListening])

  const canType = mode === 'typed' || mode === 'both'
  const canSpeak = mode === 'spoken' || mode === 'both'

  return (
    <div>
      {/* Text input */}
      {canType && (
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type your answer in Japanese...'}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          lang="ja"
          style={{
            width: '100%',
            padding: '14px 16px',
            fontSize: 18,
            fontFamily: '"Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif, inherit',
            background: 'var(--bg-primary)',
            border: `2px solid ${isListening ? '#e74c3c' : 'var(--border-color)'}`,
            borderRadius: 12,
            color: 'var(--text-primary)',
            boxSizing: 'border-box',
            transition: 'border-color 0.2s',
          }}
        />
      )}

      {/* Interim speech text */}
      {(isListening || interim) && (
        <div style={{
          fontSize: 16, color: 'var(--text-muted)', fontStyle: 'italic',
          padding: '8px 4px', minHeight: 28,
          fontFamily: '"Noto Sans JP", sans-serif',
        }}>
          {interim || (isListening ? '🎤 Listening...' : '')}
        </div>
      )}

      {/* Spoken-only mode: show the recognized text */}
      {mode === 'spoken' && text && (
        <div style={{
          fontSize: 18, padding: '14px 16px', marginBottom: 8,
          background: 'var(--bg-secondary)', borderRadius: 12,
          fontFamily: '"Noto Sans JP", sans-serif',
          border: '1px solid var(--border-color)',
        }}>
          {text}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {canSpeak && (
          <button
            onMouseDown={e => e.preventDefault()}
            onClick={toggleDictation}
            disabled={disabled}
            style={{
              flex: canType ? '0 0 auto' : 1,
              padding: '12px 20px',
              background: isListening ? '#e74c3c' : 'var(--bg-secondary)',
              border: `1px solid ${isListening ? '#e74c3c' : 'var(--border-color)'}`,
              borderRadius: 10,
              color: isListening ? '#fff' : 'var(--text-primary)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            {isListening ? '⏹️ Stop' : '🎤 Speak'}
          </button>
        )}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          style={{
            flex: 1,
            padding: '12px 20px',
            background: text.trim() ? 'var(--accent-color, #6C5CE7)' : 'var(--bg-secondary)',
            border: 'none',
            borderRadius: 10,
            color: text.trim() ? '#fff' : 'var(--text-muted)',
            fontSize: 14,
            fontWeight: 600,
            cursor: text.trim() ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
          }}
        >
          Submit ➜
        </button>
      </div>
    </div>
  )
}
