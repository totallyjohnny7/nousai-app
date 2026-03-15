/**
 * SentenceBuilderGame — Click tiles to assemble a Japanese sentence in order.
 * Uses bank entries with example+exampleEn; falls back to Nakama 1 grammar if none found.
 */
import React, { useState, useCallback, useMemo } from 'react'
import { getAllGrammar } from '../../../data/nakama1StudyContent'
import type { VocabBankItem } from '../types'

// Unified sentence shape
interface SentencePair { example: string; exampleEn: string }

const SENTENCES_PER_ROUND = 6

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildRound(bank: VocabBankItem[]): SentencePair[] {
  // Prefer bank entries that have both example and exampleEn
  const bankSentences = bank
    .filter(v => v.example && v.exampleEn)
    .map(v => ({ example: v.example!, exampleEn: v.exampleEn! }))
  const pool: SentencePair[] = bankSentences.length >= 1
    ? bankSentences
    : getAllGrammar().filter(g => g.example && g.exampleEn).map(g => ({ example: g.example!, exampleEn: g.exampleEn! }))
  return shuffle(pool).slice(0, SENTENCES_PER_ROUND)
}

interface TileState {
  id: string
  word: string
  placedIndex: number | null // slot index, or null = in bank
}

/**
 * Tokenize a Japanese sentence into tile-sized units.
 * If the string already contains spaces (AI-imported entries), split on them.
 * Otherwise use a particle-based heuristic so old un-spaced entries still
 * produce multiple tiles instead of one giant tile.
 * Multi-char patterns are listed first so they beat single-char prefixes
 * (e.g. "ので" wins over "の" when both start at the same position).
 */
function tokenizeJapanese(text: string): string[] {
  const clean = text.trim().replace(/。$/, '')
  if (/\s/.test(clean)) return clean.split(/\s+/).filter(Boolean)

  const PARTICLES = ['から', 'まで', 'より', 'ので', 'のに', 'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'も', 'の']
  const tokens: string[] = []
  let remaining = clean

  while (remaining.length > 0) {
    let bestIdx = remaining.length
    let bestParticle = ''
    for (const p of PARTICLES) {
      const idx = remaining.indexOf(p)
      if (idx > 0 && idx < bestIdx) { bestIdx = idx; bestParticle = p }
    }
    if (bestParticle) {
      tokens.push(remaining.slice(0, bestIdx))
      tokens.push(bestParticle)
      remaining = remaining.slice(bestIdx + bestParticle.length)
    } else {
      tokens.push(remaining)
      break
    }
  }
  return tokens.filter(t => t.length > 0)
}

function initTiles(example: string): TileState[] {
  return shuffle(
    tokenizeJapanese(example).map((word, i) => ({
      id: `tile-${i}`,
      word,
      placedIndex: null,
    }))
  )
}

type FeedbackState = 'idle' | 'correct' | 'wrong'

export default function SentenceBuilderGame({ onBack, bank: vocabBank = [] }: { onBack: () => void; bank?: VocabBankItem[] }) {
  const [sentences] = useState<SentencePair[]>(() => buildRound(vocabBank))
  const [idx, setIdx] = useState(0)
  const [tiles, setTiles] = useState<TileState[]>(() => initTiles(sentences[0].example))
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<FeedbackState>('idle')
  const [wrongAttempts, setWrongAttempts] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [shaking, setShaking] = useState(false)

  const current = sentences[idx]
  const correctWords = useMemo(
    () => tokenizeJapanese(current.example),
    [current]
  )
  const slotCount = correctWords.length

  // Placed tiles in slot order
  const placed = useMemo<(TileState | null)[]>(() => {
    const arr: (TileState | null)[] = Array(slotCount).fill(null)
    tiles.forEach(t => { if (t.placedIndex !== null) arr[t.placedIndex] = t })
    return arr
  }, [tiles, slotCount])

  // Unplaced tiles (bank)
  const bank = tiles.filter(t => t.placedIndex === null)

  const goNext = useCallback(() => {
    const nextIdx = idx + 1
    if (nextIdx >= SENTENCES_PER_ROUND) {
      setDone(true)
    } else {
      setIdx(nextIdx)
      setTiles(initTiles(sentences[nextIdx].example))
      setSelectedTileId(null)
      setFeedback('idle')
      setWrongAttempts(0)
      setShowAnswer(false)
    }
  }, [idx, sentences])

  const handleTileClick = useCallback((tileId: string) => {
    if (feedback === 'correct' || showAnswer) return
    setSelectedTileId(prev => prev === tileId ? null : tileId)
  }, [feedback, showAnswer])

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (feedback === 'correct' || showAnswer) return

    const existing = placed[slotIndex]

    if (existing) {
      // Unplace existing tile back to bank (toggle off)
      if (selectedTileId === existing.id) {
        setTiles(prev => prev.map(t => t.id === existing.id ? { ...t, placedIndex: null } : t))
        setSelectedTileId(null)
      } else {
        // Swap: send existing to bank, place selected here
        if (selectedTileId) {
          setTiles(prev => prev.map(t => {
            if (t.id === existing.id) return { ...t, placedIndex: null }
            if (t.id === selectedTileId) return { ...t, placedIndex: slotIndex }
            return t
          }))
          setSelectedTileId(null)
        } else {
          // No tile selected, just unplace the existing one
          setTiles(prev => prev.map(t => t.id === existing.id ? { ...t, placedIndex: null } : t))
        }
      }
    } else {
      // Empty slot: place selected tile
      if (selectedTileId) {
        setTiles(prev => prev.map(t => t.id === selectedTileId ? { ...t, placedIndex: slotIndex } : t))
        setSelectedTileId(null)
      }
    }
  }, [placed, selectedTileId, feedback, showAnswer])

  const checkAnswer = useCallback(() => {
    const allFilled = placed.every(p => p !== null)
    if (!allFilled) return

    const userAnswer = placed.map(p => p!.word)
    const correct = userAnswer.every((w, i) => w === correctWords[i])
    if (correct) {
      setFeedback('correct')
      setScore(s => s + 1)
      setTimeout(() => goNext(), 1200)
    } else {
      setFeedback('wrong')
      setShaking(true)
      setTimeout(() => { setShaking(false); setFeedback('idle') }, 700)
      const next = wrongAttempts + 1
      setWrongAttempts(next)
      if (next >= 2) setShowAnswer(true)
    }
  }, [placed, correctWords, wrongAttempts, goNext])

  if (done) {
    const stars = score >= 6 ? 3 : score >= 4 ? 2 : 1
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Round Complete!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          {score} / {SENTENCES_PER_ROUND} correct
        </p>
        <div style={{ fontSize: 40, marginBottom: 24 }}>
          {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onBack}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent-color, #6C5CE7)', color: '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
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
          <div style={{ fontSize: 18, fontWeight: 700 }}>📝 Sentence Builder</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {idx + 1} / {SENTENCES_PER_ROUND} · Score: {score}
          </div>
        </div>
        <div style={{ width: 48 }} />
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, marginBottom: 24 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-color, #6C5CE7)',
          width: `${((idx) / SENTENCES_PER_ROUND) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* English prompt */}
      <div style={{
        background: 'var(--bg-secondary)', borderRadius: 12, padding: '16px 20px',
        marginBottom: 24, textAlign: 'center',
      }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Translate to Japanese
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{current.exampleEn}</div>
      </div>

      {/* Answer slots */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
        marginBottom: 24, minHeight: 56,
      }}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const tile = placed[i]
          const isCorrectSlot = showAnswer && correctWords[i] === tile?.word
          const isWrongSlot = showAnswer && tile && correctWords[i] !== tile.word
          return (
            <div
              key={i}
              onClick={() => handleSlotClick(i)}
              style={{
                minWidth: 64, padding: '10px 14px',
                border: feedback === 'correct'
                  ? '2px solid var(--success-color, #2ecc71)'
                  : isWrongSlot
                  ? '2px solid var(--danger-color, #e74c3c)'
                  : isCorrectSlot
                  ? '2px solid var(--success-color, #2ecc71)'
                  : tile ? '2px solid var(--accent-color, #6C5CE7)' : '2px dashed var(--border-color)',
                borderRadius: 8, background: feedback === 'correct'
                  ? 'rgba(46,204,113,0.1)'
                  : isWrongSlot ? 'rgba(231,76,60,0.1)' : 'var(--bg-card)',
                cursor: 'pointer', textAlign: 'center',
                fontSize: tile ? 16 : 12, fontWeight: 600,
                color: tile ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.2s',
                animation: shaking && tile ? 'shake 0.4s' : 'none',
              }}
            >
              {tile ? tile.word : '　'}
            </div>
          )
        })}
      </div>

      {/* Show answer */}
      {showAnswer && (
        <div style={{
          background: 'rgba(46,204,113,0.08)', border: '1px solid var(--success-color, #2ecc71)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Correct answer:</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{correctWords.join(' ')}。</div>
        </div>
      )}

      {/* Tile bank */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
        {bank.map(tile => (
          <button
            key={tile.id}
            onClick={() => handleTileClick(tile.id)}
            style={{
              padding: '10px 16px', borderRadius: 8, border: 'none',
              background: selectedTileId === tile.id
                ? 'var(--accent-color, #6C5CE7)'
                : 'var(--bg-secondary)',
              color: selectedTileId === tile.id ? '#fff' : 'var(--text-primary)',
              fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s, transform 0.1s',
              transform: selectedTileId === tile.id ? 'scale(1.05)' : 'scale(1)',
              boxShadow: selectedTileId === tile.id ? '0 2px 8px rgba(108,92,231,0.4)' : 'none',
            }}
          >
            {tile.word}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        {showAnswer ? (
          <button
            onClick={goNext}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: 'var(--accent-color, #6C5CE7)', color: '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Next →
          </button>
        ) : (
          <button
            onClick={checkAnswer}
            disabled={placed.some(p => p === null)}
            style={{
              padding: '12px 32px', borderRadius: 10, border: 'none',
              background: placed.every(p => p !== null) ? 'var(--accent-color, #6C5CE7)' : 'var(--bg-secondary)',
              color: placed.every(p => p !== null) ? '#fff' : 'var(--text-muted)',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600,
              cursor: placed.every(p => p !== null) ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            {feedback === 'correct' ? '✓ Correct!' : 'Check Answer'}
          </button>
        )}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 16 }}>
        {selectedTileId ? 'Now click a slot to place it' : 'Click a tile to select it, then click a slot'}
      </p>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
