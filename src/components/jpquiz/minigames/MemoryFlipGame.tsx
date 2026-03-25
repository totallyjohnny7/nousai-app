/**
 * MemoryFlipGame — Classic card-flip matching game.
 * Uses custom vocab bank when provided (>= 4 entries), otherwise falls back to Nakama 1.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getAllVocabulary } from '../../../data/nakama1StudyContent'
import type { MiniGameStats, VocabBankItem } from '../types'
import { loadMiniGameStats, saveMiniGameStats } from '../types'

interface Card {
  id: string
  pairId: string
  content: string
  isJapanese: boolean
  flipped: boolean
  matched: boolean
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildCards(pairCount: number, bank: VocabBankItem[]): Card[] {
  // Use bank if it has enough non-pattern entries; else fall back to Nakama 1
  const bankPairs = bank.filter(v => v.word && v.meaning && !v.word.startsWith('〜') && v.category !== 'grammar')
  const useBank = bankPairs.length >= 4
  const pool = useBank
    ? shuffle(bankPairs).slice(0, pairCount).map(v => ({ word: v.word, meaning: v.meaning }))
    : shuffle(getAllVocabulary().filter(v => !v.word.startsWith('〜'))).slice(0, pairCount)

  const cards: Card[] = []
  pool.forEach((v, i) => {
    const pairId = `pair-${i}`
    cards.push(
      { id: `jp-${i}`, pairId, content: v.word, isJapanese: true, flipped: false, matched: false },
      { id: `en-${i}`, pairId, content: v.meaning, isJapanese: false, flipped: false, matched: false },
    )
  })
  return shuffle(cards)
}

function starRating(flips: number, pairs: number): number {
  const perfect = pairs * 2
  if (flips <= perfect) return 3
  if (flips <= perfect * 1.5) return 2
  return 1
}

export default function MemoryFlipGame({ onBack, bank = [], courseId = '' }: { onBack: () => void; bank?: VocabBankItem[]; courseId?: string }) {
  const [cards, setCards] = useState<Card[]>(() => buildCards(8, bank))
  const [selected, setSelected] = useState<string[]>([]) // up to 2 card ids
  const [flips, setFlips] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [won, setWon] = useState(false)
  const [locked, setLocked] = useState(false)
  const [stats, setStats] = useState<MiniGameStats | null>(() => loadMiniGameStats('memory-flip', courseId))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const matchedCount = cards.filter(c => c.matched).length

  // Start timer
  useEffect(() => {
    if (won) { if (timerRef.current) clearInterval(timerRef.current); return }
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [won])

  const flipCard = useCallback((id: string) => {
    if (locked || won) return
    setCards(prev => {
      const card = prev.find(c => c.id === id)
      if (!card || card.flipped || card.matched) return prev
      return prev.map(c => c.id === id ? { ...c, flipped: true } : c)
    })
    setSelected(prev => {
      if (prev.includes(id) || prev.length >= 2) return prev
      return [...prev, id]
    })
  }, [locked, won])

  // Check match when 2 cards selected
  useEffect(() => {
    if (selected.length !== 2) return
    setLocked(true)
    setFlips(f => f + 1)
    const [a, b] = selected
    const cardA = cards.find(c => c.id === a)!
    const cardB = cards.find(c => c.id === b)!
    if (cardA.pairId === cardB.pairId) {
      // Match!
      setCards(prev => prev.map(c =>
        c.id === a || c.id === b ? { ...c, matched: true } : c
      ))
      setSelected([])
      setLocked(false)
    } else {
      // No match — flip back after delay
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === a || c.id === b ? { ...c, flipped: false } : c
        ))
        setSelected([])
        setLocked(false)
      }, 900)
    }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Win detection
  useEffect(() => {
    if (cards.length > 0 && cards.every(c => c.matched)) setWon(true)
  }, [cards])

  // Persist stats on win
  useEffect(() => {
    if (!won) return
    const currentStars = starRating(flips, 8)
    const prev = loadMiniGameStats('memory-flip', courseId)
    const updated: MiniGameStats = {
      highScore: Math.max(currentStars, prev?.highScore ?? 0),
      totalPlayed: (prev?.totalPlayed ?? 0) + 1,
      lastPlayed: new Date().toISOString(),
      totalCorrect: (prev?.totalCorrect ?? 0) + currentStars,
      totalQuestions: (prev?.totalQuestions ?? 0) + 3,
      bestFlips: prev?.bestFlips !== undefined ? Math.min(flips, prev.bestFlips) : flips,
      bestTime: prev?.bestTime !== undefined ? Math.min(seconds, prev.bestTime) : seconds,
    }
    saveMiniGameStats('memory-flip', courseId, updated)
    setStats(updated)
  }, [won]) // eslint-disable-line react-hooks/exhaustive-deps

  const restart = () => {
    setCards(buildCards(8, bank))
    setSelected([])
    setFlips(0)
    setSeconds(0)
    setWon(false)
    setLocked(false)
  }

  const stars = won ? starRating(flips, 8) : 0
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')

  if (won) {
    const bestMins = stats?.bestTime !== undefined ? String(Math.floor(stats.bestTime / 60)).padStart(2, '0') : '--'
    const bestSecs = stats?.bestTime !== undefined ? String(stats.bestTime % 60).padStart(2, '0') : '--'
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>You matched them all!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
          {flips} flips · {mins}:{secs}
        </p>
        <div style={{ fontSize: 40, marginBottom: 24 }}>
          {'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}
        </div>
        {stats && (
          <div style={{
            display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 24,
            background: 'var(--bg-secondary)', borderRadius: 12, padding: '12px 20px',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Best</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{'⭐'.repeat(stats.highScore)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Fewest Flips</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{stats.bestFlips ?? '--'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Best Time</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{bestMins}:{bestSecs}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>Played</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{stats.totalPlayed}×</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={restart}
            style={{
              padding: '12px 28px', borderRadius: 10, border: 'none',
              background: 'var(--accent-color, #6C5CE7)', color: '#fff',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Play Again
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '12px 28px', borderRadius: 10, border: '1px solid var(--border-color)',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)',
              fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🃏 Memory Flip</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {matchedCount / 2} / 8 matched · {flips} flips · {mins}:{secs}
          </div>
        </div>
        <button
          onClick={restart}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          }}
        >
          ↺ Reset
        </button>
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
      }}>
        {cards.map(card => {
          const isSelected = selected.includes(card.id)
          const showFront = card.flipped || card.matched
          return (
            <button
              key={card.id}
              onClick={() => flipCard(card.id)}
              disabled={card.matched || card.flipped}
              style={{
                height: 80,
                borderRadius: 10,
                border: card.matched
                  ? '2px solid var(--success-color, #2ecc71)'
                  : isSelected
                  ? '2px solid var(--accent-color, #6C5CE7)'
                  : '1px solid var(--border-color)',
                background: card.matched
                  ? 'rgba(46,204,113,0.12)'
                  : showFront
                  ? (card.isJapanese ? 'var(--bg-secondary)' : 'var(--bg-card)')
                  : 'var(--bg-secondary)',
                cursor: card.matched || card.flipped ? 'default' : 'pointer',
                fontFamily: 'inherit',
                fontSize: card.isJapanese ? 18 : 12,
                fontWeight: card.isJapanese ? 600 : 400,
                color: card.matched ? 'var(--success-color, #2ecc71)' : 'var(--text-primary)',
                transition: 'transform 0.18s, box-shadow 0.18s',
                transform: showFront ? 'scale(1)' : 'scale(0.96)',
                padding: '6px 4px',
                lineHeight: 1.3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
              }}
            >
              {showFront ? card.content : '?'}
            </button>
          )
        })}
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 14 }}>
        Match each Japanese word to its English meaning
      </p>
    </div>
  )
}
