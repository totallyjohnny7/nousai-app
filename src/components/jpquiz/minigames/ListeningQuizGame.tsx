/**
 * ListeningQuizGame — Hear a Japanese word, pick its English meaning.
 * Uses custom vocab bank when provided (>= 4 entries), otherwise falls back to Nakama 1.
 * Uses Web Speech API TTS with lang='ja-JP'.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react'
import { getAllVocabulary } from '../../../data/nakama1StudyContent'
import type { VocabBankItem } from '../types'

const ROUND_SIZE = 10
const OPTION_COUNT = 4

// Unified word shape for internal use
interface WordPair { word: string; meaning: string; reading?: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildPool(bank: VocabBankItem[]): WordPair[] {
  const bankPairs = bank.filter(v => v.word && v.meaning && !v.word.startsWith('〜') && v.category !== 'grammar')
  if (bankPairs.length >= 4) return bankPairs.map(v => ({ word: v.word, meaning: v.meaning, reading: v.reading }))
  return getAllVocabulary().filter(v => !v.word.startsWith('〜') && v.meaning)
}

function buildRound(pool: WordPair[]): WordPair[] {
  return shuffle(pool).slice(0, ROUND_SIZE)
}

function buildOptions(correct: WordPair, pool: WordPair[]): string[] {
  const distractors = shuffle(pool.filter(v => v.word !== correct.word))
    .slice(0, OPTION_COUNT - 1)
    .map(v => v.meaning)
  return shuffle([correct.meaning, ...distractors])
}

function speak(word: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utt = new SpeechSynthesisUtterance(word)
  utt.lang = 'ja-JP'
  utt.rate = 0.85
  window.speechSynthesis.speak(utt)
}

type AnswerState = 'idle' | 'correct' | 'wrong'

export default function ListeningQuizGame({ onBack, bank = [] }: { onBack: () => void; bank?: VocabBankItem[] }) {
  const pool = useRef<WordPair[]>(buildPool(bank))
  const [round] = useState<WordPair[]>(() => buildRound(pool.current))
  const [idx, setIdx] = useState(0)
  const [options, setOptions] = useState<string[]>(() => buildOptions(round[0], pool.current))
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [chosen, setChosen] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [missed, setMissed] = useState<WordPair[]>([])
  const [hasSpoken, setHasSpoken] = useState(false)

  const current = round[idx]

  // Auto-speak on mount and when idx changes
  useEffect(() => {
    setHasSpoken(false)
    const timer = setTimeout(() => {
      speak(current.word)
      setHasSpoken(true)
    }, 300)
    return () => clearTimeout(timer)
  }, [idx, current.word])

  const goNext = useCallback(() => {
    const nextIdx = idx + 1
    if (nextIdx >= ROUND_SIZE) {
      setDone(true)
    } else {
      setIdx(nextIdx)
      setOptions(buildOptions(round[nextIdx], pool.current))
      setAnswerState('idle')
      setChosen(null)
    }
  }, [idx, round])

  const handleAnswer = useCallback((opt: string) => {
    if (answerState !== 'idle') return
    setChosen(opt)
    if (opt === current.meaning) {
      setAnswerState('correct')
      setScore(s => s + 1)
      setTimeout(() => goNext(), 800)
    } else {
      setAnswerState('wrong')
      setMissed(prev => [...prev, current])
      // Auto-advance after showing correct answer
      setTimeout(() => goNext(), 1800)
    }
  }, [answerState, current, goNext])

  if (done) {
    const stars = score >= 9 ? 3 : score >= 6 ? 2 : 1
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🔊</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Round Complete!</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>
            {score} / {ROUND_SIZE} correct
          </p>
          <div style={{ fontSize: 40, marginBottom: 20 }}>
            {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
          </div>
        </div>

        {missed.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Review these words
            </h4>
            {missed.map(v => (
              <div key={v.word} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8,
                marginBottom: 6,
              }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>{v.word}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{v.meaning}</span>
                <button
                  onClick={() => speak(v.word)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4, fontSize: 16,
                  }}
                >
                  🔊
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onBack}
          style={{
            width: '100%', padding: '12px 28px', borderRadius: 10, border: 'none',
            background: 'var(--accent-color, #6C5CE7)', color: '#fff',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
          }}
        >
          Back to Menu
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🔊 Listening Quiz</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {idx + 1} / {ROUND_SIZE} · Score: {score}
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, marginBottom: 32 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-color, #6C5CE7)',
          width: `${(idx / ROUND_SIZE) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* Speaker button */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <button
          onClick={() => { speak(current.word); setHasSpoken(true) }}
          style={{
            width: 100, height: 100, borderRadius: '50%',
            border: '3px solid var(--accent-color, #6C5CE7)',
            background: 'var(--bg-secondary)',
            cursor: 'pointer', fontSize: 36,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.1s, background 0.1s',
            boxShadow: '0 4px 20px rgba(108,92,231,0.2)',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          🔊
        </button>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>
          {hasSpoken ? 'Tap to hear again' : 'Playing...'}
        </p>

        {/* Show reading hint in wrong state */}
        {answerState === 'wrong' && (
          <div style={{
            marginTop: 8, fontSize: 22, fontWeight: 700, color: 'var(--text-primary)',
            animation: 'fadeIn 0.3s',
          }}>
            {current.word}
            {current.reading && current.reading !== current.word && (
              <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 8 }}>
                ({current.reading})
              </span>
            )}
          </div>
        )}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map(opt => {
          const isCorrect = opt === current.meaning
          const isChosen = opt === chosen
          let bg = 'var(--bg-secondary)'
          let border = '1px solid var(--border-color)'
          let color = 'var(--text-primary)'

          if (answerState !== 'idle') {
            if (isCorrect) {
              bg = 'rgba(46,204,113,0.15)'; border = '2px solid var(--success-color, #2ecc71)'; color = 'var(--success-color, #2ecc71)'
            } else if (isChosen && !isCorrect) {
              bg = 'rgba(231,76,60,0.15)'; border = '2px solid var(--danger-color, #e74c3c)'; color = 'var(--danger-color, #e74c3c)'
            }
          }

          return (
            <button
              key={opt}
              onClick={() => handleAnswer(opt)}
              disabled={answerState !== 'idle'}
              style={{
                padding: '14px 18px', borderRadius: 10, border,
                background: bg, color,
                fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
                cursor: answerState === 'idle' ? 'pointer' : 'default',
                textAlign: 'left', transition: 'all 0.2s',
              }}
            >
              {opt}
              {answerState !== 'idle' && isCorrect && ' ✓'}
              {answerState !== 'idle' && isChosen && !isCorrect && ' ✗'}
            </button>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
