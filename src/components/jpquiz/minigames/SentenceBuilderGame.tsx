/**
 * SentenceBuilderGame — Click tiles to assemble a Japanese sentence in order.
 *
 * Features:
 *  • Per-tile grammatical role labels (PRN, N, V, COP, TOP, OBJ, …)
 *    colour-coded by category so learners can see sentence structure at a glance.
 *  • Reads `notes: "breakdown:ROLE,ROLE,…"` from VocabBankItem entries produced
 *    by jpSentenceBank.ts (one label per space-separated token).
 *  • 8 sentences per round, "New Round" button on completion screen.
 */
import React, { useState, useCallback, useMemo } from 'react'
import { getAllGrammar } from '../../../data/nakama1StudyContent'
import type { VocabBankItem } from '../types'

// ─── Data types ───────────────────────────────────────────────────────────────

interface SentencePair {
  example: string
  exampleEn: string
  breakdown?: string[] // one label per space-separated token
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTENCES_PER_ROUND = 8

// Colour map for grammatical role labels
const ROLE_COLORS: Record<string, string> = {
  PRN:  '#6C5CE7', // purple  — pronoun
  N:    '#00b894', // green   — noun
  V:    '#e17055', // orange  — verb
  COP:  '#d63031', // red     — copula
  ADJ:  '#a29bfe', // lavender— adjective
  ADV:  '#00cec9', // teal    — adverb
  TOP:  '#636e72', // gray    — topic は
  OBJ:  '#fdcb6e', // amber   — object を
  SUBJ: '#55efc4', // mint    — subject が
  LOC:  '#74b9ff', // sky     — location に/で
  PTCL: '#b2bec3', // silver  — other particles
  DEM:  '#0984e3', // blue    — demonstrative
  QW:   '#ffeaa7', // yellow  — question word
  TIME: '#81ecec', // aqua    — time word
  NEG:  '#ff7675', // pink    — negative
  CONJ: '#fab1a0', // peach   — conjunction
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Parse breakdown labels from the item's notes field ("breakdown:PRN,TOP,N,COP")
 * or from the dedicated breakdown array if it was set in-memory.
 */
function extractBreakdown(item: VocabBankItem): string[] | undefined {
  if (item.breakdown?.length) return item.breakdown
  if (item.notes?.startsWith('breakdown:')) {
    return item.notes.slice('breakdown:'.length).split(',')
  }
  return undefined
}

function buildRound(bank: VocabBankItem[]): SentencePair[] {
  const bankSentences: SentencePair[] = bank
    .filter(v => v.example && v.exampleEn)
    .map(v => ({
      example: v.example!,
      exampleEn: v.exampleEn!,
      breakdown: extractBreakdown(v),
    }))

  const pool: SentencePair[] = bankSentences.length >= 1
    ? bankSentences
    : getAllGrammar()
        .filter(g => g.example && g.exampleEn)
        .map(g => ({ example: g.example!, exampleEn: g.exampleEn! }))

  return shuffle(pool).slice(0, SENTENCES_PER_ROUND)
}

/**
 * Tokenize a Japanese sentence into tile-sized units.
 * Space-separated strings (all jpSentenceBank entries) split cleanly on spaces.
 * Legacy un-spaced entries fall through to the particle heuristic.
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

// ─── Tile state ───────────────────────────────────────────────────────────────

interface TileState {
  id: string
  word: string
  role?: string       // grammatical role label (from breakdown)
  placedIndex: number | null
}

function initTiles(example: string, breakdown?: string[]): TileState[] {
  return shuffle(
    tokenizeJapanese(example).map((word, i) => ({
      id: `tile-${i}`,
      word,
      role: breakdown?.[i],
      placedIndex: null,
    }))
  )
}

type FeedbackState = 'idle' | 'correct' | 'wrong'

// ─── Component ────────────────────────────────────────────────────────────────

export default function SentenceBuilderGame({
  onBack,
  bank: vocabBank = [],
}: {
  onBack: () => void
  bank?: VocabBankItem[]
}) {
  const buildNew = useCallback(() => buildRound(vocabBank), [vocabBank])

  const [sentences, setSentences] = useState<SentencePair[]>(buildNew)
  const [idx, setIdx]             = useState(0)
  const [tiles, setTiles]         = useState<TileState[]>(() =>
    initTiles(sentences[0].example, sentences[0].breakdown)
  )
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null)
  const [feedback, setFeedback]             = useState<FeedbackState>('idle')
  const [wrongAttempts, setWrongAttempts]   = useState(0)
  const [showAnswer, setShowAnswer]         = useState(false)
  const [score, setScore]                   = useState(0)
  const [done, setDone]                     = useState(false)
  const [shaking, setShaking]               = useState(false)
  const [showLabels, setShowLabels]         = useState(true)

  const current      = sentences[idx]
  const correctWords = useMemo(() => tokenizeJapanese(current.example), [current])
  const slotCount    = correctWords.length

  const placed = useMemo<(TileState | null)[]>(() => {
    const arr: (TileState | null)[] = Array(slotCount).fill(null)
    tiles.forEach(t => { if (t.placedIndex !== null) arr[t.placedIndex] = t })
    return arr
  }, [tiles, slotCount])

  const bank = tiles.filter(t => t.placedIndex === null)

  // ── Navigation ─────────────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    const nextIdx = idx + 1
    if (nextIdx >= SENTENCES_PER_ROUND) {
      setDone(true)
    } else {
      setIdx(nextIdx)
      setTiles(initTiles(sentences[nextIdx].example, sentences[nextIdx].breakdown))
      setSelectedTileId(null)
      setFeedback('idle')
      setWrongAttempts(0)
      setShowAnswer(false)
    }
  }, [idx, sentences])

  const startNewRound = useCallback(() => {
    const next = buildNew()
    setSentences(next)
    setIdx(0)
    setTiles(initTiles(next[0].example, next[0].breakdown))
    setSelectedTileId(null)
    setFeedback('idle')
    setWrongAttempts(0)
    setShowAnswer(false)
    setScore(0)
    setDone(false)
  }, [buildNew])

  // ── Tile interactions ──────────────────────────────────────────────────────

  const handleTileClick = useCallback((tileId: string) => {
    if (feedback === 'correct' || showAnswer) return
    setSelectedTileId(prev => prev === tileId ? null : tileId)
  }, [feedback, showAnswer])

  const handleSlotClick = useCallback((slotIndex: number) => {
    if (feedback === 'correct' || showAnswer) return
    const existing = placed[slotIndex]

    if (existing) {
      if (selectedTileId === existing.id) {
        setTiles(prev => prev.map(t => t.id === existing.id ? { ...t, placedIndex: null } : t))
        setSelectedTileId(null)
      } else if (selectedTileId) {
        setTiles(prev => prev.map(t => {
          if (t.id === existing.id) return { ...t, placedIndex: null }
          if (t.id === selectedTileId) return { ...t, placedIndex: slotIndex }
          return t
        }))
        setSelectedTileId(null)
      } else {
        setTiles(prev => prev.map(t => t.id === existing.id ? { ...t, placedIndex: null } : t))
      }
    } else if (selectedTileId) {
      setTiles(prev => prev.map(t => t.id === selectedTileId ? { ...t, placedIndex: slotIndex } : t))
      setSelectedTileId(null)
    }
  }, [placed, selectedTileId, feedback, showAnswer])

  const checkAnswer = useCallback(() => {
    if (!placed.every(p => p !== null)) return
    const correct = placed.every((p, i) => p!.word === correctWords[i])
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

  // ── Done screen ────────────────────────────────────────────────────────────

  if (done) {
    const stars = score >= 7 ? 3 : score >= 5 ? 2 : 1
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
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={startNewRound}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent-color, #6C5CE7)', color: '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            New Round
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '12px 28px', borderRadius: 10,
              border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Back to Menu
          </button>
        </div>
      </div>
    )
  }

  // ── Game screen ────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}
        >
          ← Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>📝 Sentence Builder</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {idx + 1} / {SENTENCES_PER_ROUND} · Score: {score}
          </div>
        </div>
        {/* Label toggle */}
        <button
          onClick={() => setShowLabels(v => !v)}
          title={showLabels ? 'Hide grammar labels' : 'Show grammar labels'}
          style={{
            background: showLabels ? 'var(--accent-color, #6C5CE7)' : 'var(--bg-secondary)',
            border: 'none', borderRadius: 6, color: showLabels ? '#fff' : 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
            padding: '4px 8px',
          }}
        >
          {showLabels ? '🏷 ON' : '🏷 OFF'}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border-color)', borderRadius: 2, marginBottom: 20 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: 'var(--accent-color, #6C5CE7)',
          width: `${(idx / SENTENCES_PER_ROUND) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      {/* English prompt */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '14px 18px', marginBottom: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Translate to Japanese
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{current.exampleEn}</div>
      </div>

      {/* Answer slots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20, minHeight: 64 }}>
        {Array.from({ length: slotCount }).map((_, i) => {
          const tile = placed[i]
          const isCorrect = feedback === 'correct' || (showAnswer && tile && correctWords[i] === tile.word)
          const isWrong   = showAnswer && tile && correctWords[i] !== tile.word
          return (
            <div
              key={i}
              onClick={() => handleSlotClick(i)}
              style={{
                minWidth: 56, padding: showLabels ? '8px 12px 4px' : '10px 14px',
                border: feedback === 'correct'
                  ? '2px solid var(--success-color, #2ecc71)'
                  : isWrong   ? '2px solid var(--danger-color, #e74c3c)'
                  : isCorrect ? '2px solid var(--success-color, #2ecc71)'
                  : tile      ? '2px solid var(--accent-color, #6C5CE7)'
                  :             '2px dashed var(--border-color)',
                borderRadius: 8,
                background: feedback === 'correct' ? 'rgba(46,204,113,0.1)'
                  : isWrong ? 'rgba(231,76,60,0.1)' : 'var(--bg-card)',
                cursor: 'pointer', textAlign: 'center',
                fontSize: tile ? 16 : 12, fontWeight: 600,
                color: tile ? 'var(--text-primary)' : 'var(--text-muted)',
                transition: 'all 0.2s',
                animation: shaking && tile ? 'shake 0.4s' : 'none',
              }}
            >
              {tile ? tile.word : '　'}
              {showLabels && tile?.role && (
                <div style={{
                  fontSize: 9, fontWeight: 700, marginTop: 3, letterSpacing: 0.3,
                  color: ROLE_COLORS[tile.role] ?? 'var(--text-muted)',
                }}>
                  {tile.role}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Correct answer reveal */}
      {showAnswer && (
        <div style={{
          background: 'rgba(46,204,113,0.08)', border: '1px solid var(--success-color, #2ecc71)',
          borderRadius: 10, padding: '12px 16px', marginBottom: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Correct answer:</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{correctWords.join(' ')}。</div>
        </div>
      )}

      {/* Tile bank */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
        {bank.map(tile => {
          const selected = selectedTileId === tile.id
          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile.id)}
              style={{
                padding: showLabels ? '8px 14px 4px' : '10px 16px',
                borderRadius: 8, border: 'none',
                background: selected ? 'var(--accent-color, #6C5CE7)' : 'var(--bg-secondary)',
                color: selected ? '#fff' : 'var(--text-primary)',
                fontFamily: 'inherit', fontSize: 16, fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s, transform 0.1s',
                transform: selected ? 'scale(1.05)' : 'scale(1)',
                boxShadow: selected ? '0 2px 8px rgba(108,92,231,0.4)' : 'none',
                textAlign: 'center',
              }}
            >
              {tile.word}
              {showLabels && tile.role && (
                <div style={{
                  fontSize: 9, fontWeight: 700, marginTop: 3, letterSpacing: 0.3,
                  color: selected ? 'rgba(255,255,255,0.75)' : (ROLE_COLORS[tile.role] ?? 'var(--text-muted)'),
                }}>
                  {tile.role}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend — only when labels are shown */}
      {showLabels && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center', marginBottom: 16 }}>
          {Object.entries(ROLE_COLORS).map(([role, color]) => (
            <span key={role} style={{ fontSize: 9, fontWeight: 700, color, letterSpacing: 0.3 }}>
              {role}
            </span>
          ))}
        </div>
      )}

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

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 14 }}>
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
