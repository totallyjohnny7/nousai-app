/**
 * EvolutionMindMap — Interactive SVG mind map for Evolution Exam 2.
 * 20 bubbles arranged radially (grouped by chapter color).
 * Chapter filter chips to show/hide chapters.
 * Heading filter chips to auto-expand a heading in the detail panel.
 * Pan on drag, zoom on scroll. Detail panel with 7-heading accordion.
 * isTrap bullets in red. Apply It with AI grading. Exam Traps as flip cards.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowLeft, X, Maximize2, Minimize2 } from 'lucide-react'
import type { EvolBubble, EvolHeading, EvolTopic } from './types'
import { EVOL_BUBBLES, HEADING_LABELS, CHAPTER_COLORS, CHAPTER_LABELS } from './types'
import { callAI, isAIConfigured } from '../../utils/ai'

interface Props {
  onBack: () => void
  onQuizBubble: (topic: EvolTopic) => void
}

// ─── Layout constants ──────────────────────────────────────────────────────

const SVG_W = 1000
const SVG_H = 800
const CX = SVG_W / 2
const CY = SVG_H / 2
const ORBIT_R = 310
const BUBBLE_R = 44
const CENTER_R = 58

function getBubblePos(index: number, total: number) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2
  return {
    x: CX + ORBIT_R * Math.cos(angle),
    y: CY + ORBIT_R * Math.sin(angle),
  }
}

// ─── Flip card component for Exam Traps ───────────────────────────────────

function FlipCard({ front, back }: { front: string; back: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      onClick={() => setFlipped(f => !f)}
      title="Click to flip"
      style={{ cursor: 'pointer', perspective: 600, height: 90, marginBottom: 10 }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.5s',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
      }}>
        <div style={{
          position: 'absolute', width: '100%', height: '100%',
          backfaceVisibility: 'hidden',
          background: '#ef444418', border: '1px solid #ef4444', borderRadius: 8,
          padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#ef4444', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>⚠️</span>
          {front}
        </div>
        <div style={{
          position: 'absolute', width: '100%', height: '100%',
          backfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          background: '#22c55e18', border: '1px solid #22c55e', borderRadius: 8,
          padding: '8px 12px', display: 'flex', alignItems: 'center',
          fontSize: 13, color: '#22c55e', lineHeight: 1.4,
        }}>
          <span style={{ marginRight: 8, fontSize: 16 }}>✓</span>
          {back}
        </div>
      </div>
    </div>
  )
}

// ─── Apply It checker ──────────────────────────────────────────────────────

function ApplyItChecker({ bulletText, expectedAnswer }: { bulletText: string; expectedAnswer: string }) {
  const [userAnswer, setUserAnswer] = useState('')
  const [result, setResult] = useState<{ score: number; feedback: string } | null>(null)
  const [loading, setLoading] = useState(false)

  const check = useCallback(async () => {
    if (!userAnswer.trim()) return
    setLoading(true)
    setResult(null)
    try {
      if (isAIConfigured()) {
        const prompt = `You are an evolution biology exam grader. A student is answering a practice question.

Question/Scenario: ${bulletText}
Expected Answer: ${expectedAnswer}
Student Answer: ${userAnswer}

Respond with ONLY JSON: {"score": <0-100>, "feedback": "<2 sentences>"}`
        const res = await callAI([{ role: 'user', content: prompt }], { temperature: 0.2 })
        const parsed = JSON.parse(res) as { score: number; feedback: string }
        setResult(parsed)
      } else {
        setResult({ score: 0, feedback: 'No AI configured. Expected: ' + expectedAnswer })
      }
    } catch {
      setResult({ score: 0, feedback: 'Grading failed. Expected: ' + expectedAnswer })
    } finally {
      setLoading(false)
    }
  }, [userAnswer, bulletText, expectedAnswer])

  const scoreColor = (s: number) => s >= 70 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ marginTop: 6, marginBottom: 10 }}>
      <textarea
        value={userAnswer}
        onChange={e => setUserAnswer(e.target.value)}
        rows={3}
        placeholder="Type your answer…"
        style={{
          width: '100%', padding: '8px 10px', boxSizing: 'border-box',
          background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
          borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
          fontFamily: 'inherit', resize: 'vertical',
        }}
      />
      <button
        onClick={check}
        disabled={loading || !userAnswer.trim()}
        style={{
          marginTop: 6, padding: '7px 14px',
          background: '#F5A623', color: '#000', border: 'none',
          borderRadius: 6, fontSize: 12, fontWeight: 700,
          cursor: loading || !userAnswer.trim() ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Checking…' : 'Check My Answer'}
      </button>
      {result && (
        <div style={{
          marginTop: 8, padding: '8px 10px',
          background: `${scoreColor(result.score)}18`,
          border: `1px solid ${scoreColor(result.score)}`,
          borderRadius: 6,
        }}>
          <span style={{ fontWeight: 700, color: scoreColor(result.score), fontSize: 14, marginRight: 8 }}>
            {result.score}%
          </span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{result.feedback}</span>
        </div>
      )}
    </div>
  )
}

// ─── Detail panel ──────────────────────────────────────────────────────────

interface DetailPanelProps {
  bubble: EvolBubble
  onClose: () => void
  onQuizBubble: (topic: EvolTopic) => void
  focusMode: boolean
  onToggleFocus: () => void
  activeHeading: EvolHeading | null
}

function DetailPanel({ bubble, onClose, onQuizBubble, focusMode, onToggleFocus, activeHeading }: DetailPanelProps) {
  const [expanded, setExpanded] = useState<Set<EvolHeading>>(
    new Set(activeHeading ? [activeHeading] : ['what-and-why'])
  )
  const panelRef = useRef<HTMLDivElement>(null)

  // Auto-expand and scroll when activeHeading changes
  useEffect(() => {
    if (!activeHeading) return
    setExpanded(prev => new Set([...prev, activeHeading]))
    // Scroll to the heading after a tick
    setTimeout(() => {
      const el = panelRef.current?.querySelector(`[data-heading="${activeHeading}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [activeHeading])

  const toggleHeading = (h: EvolHeading) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(h)) next.delete(h)
      else next.add(h)
      return next
    })
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'absolute',
        right: 0, top: 0, bottom: 0,
        width: focusMode ? '100%' : 440,
        background: 'var(--bg-primary, #0a0a0a)',
        borderLeft: `3px solid ${bubble.color}`,
        overflowY: 'auto',
        zIndex: 10,
        transition: 'width 0.25s ease',
      }}
    >
      {/* Panel header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 1,
        background: 'var(--bg-primary, #0a0a0a)',
        padding: '14px 16px',
        borderBottom: `1px solid ${bubble.color}44`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: bubble.color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: bubble.color, fontWeight: 600, marginBottom: 2 }}>{bubble.chapterLabel}</div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {bubble.title}
          </h3>
        </div>
        <button
          onClick={onToggleFocus}
          title={focusMode ? 'Exit focus mode' : 'Focus mode'}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
        >
          {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <button
          onClick={() => onQuizBubble(bubble.topic)}
          style={{
            width: '100%', padding: '9px', background: bubble.color,
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Quiz This Bubble →
        </button>
      </div>

      {/* Headings accordion */}
      <div style={{ padding: '8px 0 24px' }}>
        {bubble.headings.map(hContent => {
          const isOpen = expanded.has(hContent.heading)
          const isExamTraps   = hContent.heading === 'exam-traps'
          const isApplyIt     = hContent.heading === 'apply-it'
          const isDifferences = hContent.heading === 'know-the-differences'

          return (
            <div key={hContent.heading} data-heading={hContent.heading}>
              <button
                onClick={() => toggleHeading(hContent.heading)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: isOpen ? `${bubble.color}18` : 'transparent',
                  border: 'none', borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: isOpen ? bubble.color : 'var(--text-primary)' }}>
                  {HEADING_LABELS[hContent.heading]}
                </span>
                <span style={{
                  fontSize: 13, color: 'var(--text-muted)',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}>▾</span>
              </button>

              {isOpen && (
                <div style={{ padding: '10px 16px 4px' }}>
                  {isExamTraps ? (
                    hContent.bullets.map((b, i) => {
                      const arrow = b.text.indexOf(' — ')
                      const front = arrow > 0 ? b.text.slice(0, arrow).trim() : b.text
                      const back  = arrow > 0 ? b.text.slice(arrow + 3).trim() : 'See correct answer'
                      return (
                        <div key={i}>
                          {b.examRef && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b', marginBottom: 4, display: 'inline-block' }}>
                              {b.examRef}
                            </span>
                          )}
                          <FlipCard front={front} back={back} />
                        </div>
                      )
                    })
                  ) : isApplyIt ? (
                    hContent.bullets.map((b, i) => {
                      const arrow = b.text.lastIndexOf(' → ')
                      const question = arrow > 0 ? b.text.slice(0, arrow).trim() : b.text
                      const expected = arrow > 0 ? b.text.slice(arrow + 3).trim() : ''
                      return (
                        <div key={i} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border-color)' }}>
                          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
                            {question}
                          </p>
                          {b.examRef && (
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b', marginBottom: 6, display: 'inline-block' }}>
                              {b.examRef}
                            </span>
                          )}
                          <ApplyItChecker bulletText={question} expectedAnswer={expected || b.text} />
                        </div>
                      )
                    })
                  ) : isDifferences ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <tbody>
                        {hContent.bullets.map((b, i) => {
                          const colon = b.text.indexOf(': ')
                          const label  = colon > 0 ? b.text.slice(0, colon).trim() : `Item ${i + 1}`
                          const detail = colon > 0 ? b.text.slice(colon + 2).trim() : b.text
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '7px 8px 7px 0', fontWeight: 700, color: bubble.color, whiteSpace: 'nowrap', verticalAlign: 'top', width: '38%' }}>
                                {label}
                              </td>
                              <td style={{ padding: '7px 0', color: 'var(--text-primary)', lineHeight: 1.45, verticalAlign: 'top' }}>
                                {detail}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {hContent.bullets.map((b, i) => (
                        <li key={i} style={{ marginBottom: 8, lineHeight: 1.5 }}>
                          <span style={{ fontSize: 13, color: b.isTrap ? '#ef4444' : 'var(--text-primary)' }}>
                            {b.text}
                          </span>
                          {b.isTrap && (
                            <span style={{
                              marginLeft: 6, fontSize: 10, padding: '1px 6px',
                              borderRadius: 4, background: '#ef444422',
                              color: '#ef4444', border: '1px solid #ef4444',
                              fontWeight: 700,
                            }}>
                              ← trap
                            </span>
                          )}
                          {b.examRef && (
                            <span style={{
                              marginLeft: 6, fontSize: 10, padding: '1px 6px',
                              borderRadius: 4, background: '#f59e0b22',
                              color: '#f59e0b', border: '1px solid #f59e0b',
                            }}>
                              {b.examRef}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function EvolutionMindMap({ onBack, onQuizBubble }: Props) {
  const [selectedBubble, setSelectedBubble] = useState<EvolBubble | null>(null)
  const [focusMode, setFocusMode]           = useState(false)
  const [activeHeading, setActiveHeading]   = useState<EvolHeading | null>(null)

  // Chapter filter state
  const [visibleChapters, setVisibleChapters] = useState<Set<string>>(
    new Set(['ch10', 'ch11', 'ch12', 'ch15', 'ch16'])
  )

  // Pan + zoom state
  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(0.85)
  const dragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.bubble-node, .detail-panel')) return
    dragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }))
  }, [])

  const handleMouseUp = useCallback(() => { dragging.current = false }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 1.1 : 0.9
    setZoom(prev => Math.min(3, Math.max(0.3, prev * delta)))
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Filter visible bubbles
  const visibleBubbles = EVOL_BUBBLES.filter(b => visibleChapters.has(b.chapter))

  // Compute positions for all 20 bubbles (fixed positions based on full array index, not filtered index)
  const bubblePositions = EVOL_BUBBLES.map((b, i) => ({
    ...b,
    ...getBubblePos(i, EVOL_BUBBLES.length),
    visible: visibleChapters.has(b.chapter),
  }))

  const toggleChapter = (ch: string) => {
    setVisibleChapters(prev => {
      const next = new Set(prev)
      if (next.has(ch)) {
        // Don't remove if it's the last one
        if (next.size <= 1) return prev
        next.delete(ch)
        // Deselect bubble if it belongs to this chapter
        if (selectedBubble?.chapter === ch) setSelectedBubble(null)
      } else {
        next.add(ch)
      }
      return next
    })
  }

  const CHAPTERS = ['ch10', 'ch11', 'ch12', 'ch15', 'ch16']
  const HEADINGS_ORDERED: EvolHeading[] = [
    'what-and-why', 'key-players', 'how-it-works',
    'know-the-differences', 'consequences-and-failures',
    'apply-it', 'exam-traps',
  ]

  const handleHeadingFilter = (h: EvolHeading) => {
    setActiveHeading(prev => prev === h ? null : h)
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 120px)',
        minHeight: 500,
        overflow: 'hidden',
        background: 'var(--bg-primary, #0a0a0a)',
        borderRadius: 12,
        border: '1px solid var(--border-color)',
        userSelect: 'none',
      }}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* ── Back button ── */}
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 12, left: 12, zIndex: 20,
          background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-color)',
          borderRadius: 8, color: 'var(--text-primary)', padding: '6px 12px',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          backdropFilter: 'blur(4px)',
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      {/* ── Chapter filter chips ── */}
      <div style={{
        position: 'absolute', top: 12, left: 80, zIndex: 20,
        display: 'flex', gap: 6, flexWrap: 'wrap',
        background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8,
        backdropFilter: 'blur(4px)',
        maxWidth: 'calc(100% - 200px)',
      }}>
        {CHAPTERS.map(ch => {
          const isActive = visibleChapters.has(ch)
          const color = CHAPTER_COLORS[ch]
          return (
            <button
              key={ch}
              onClick={() => toggleChapter(ch)}
              style={{
                padding: '3px 10px', borderRadius: 6,
                border: `1px solid ${isActive ? color : '#444'}`,
                background: isActive ? `${color}22` : 'transparent',
                color: isActive ? color : '#666',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {CHAPTER_LABELS[ch].split(' — ')[0]}
            </button>
          )
        })}
      </div>

      {/* ── Heading filter chips ── */}
      <div style={{
        position: 'absolute', top: 48, left: 12, zIndex: 20,
        display: 'flex', gap: 5, flexWrap: 'wrap',
        background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 8,
        backdropFilter: 'blur(4px)',
        maxWidth: 'calc(100% - 24px)',
      }}>
        <span style={{ fontSize: 10, color: '#666', alignSelf: 'center', marginRight: 4 }}>HEADING:</span>
        {HEADINGS_ORDERED.map(h => {
          const isActive = activeHeading === h
          const hColor = h === 'exam-traps' ? '#ef4444' : h === 'apply-it' ? '#a78bfa' : '#6b7280'
          return (
            <button
              key={h}
              onClick={() => handleHeadingFilter(h)}
              style={{
                padding: '2px 8px', borderRadius: 5,
                border: `1px solid ${isActive ? hColor : '#444'}`,
                background: isActive ? `${hColor}22` : 'transparent',
                color: isActive ? hColor : '#666',
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {HEADING_LABELS[h].replace(/^[^\s]+\s/, '')}
            </button>
          )
        })}
      </div>

      {/* ── Zoom hint ── */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12, zIndex: 20,
        fontSize: 11, color: 'var(--text-muted)',
        background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6,
      }}>
        Scroll to zoom · Drag to pan · Click bubble to explore
      </div>

      {/* ── Visible bubbles count ── */}
      <div style={{
        position: 'absolute', bottom: 12, right: selectedBubble ? 460 : 12, zIndex: 20,
        fontSize: 11, color: 'var(--text-muted)',
        background: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: 6,
      }}>
        {visibleBubbles.length} / {EVOL_BUBBLES.length} bubbles
      </div>

      {/* ── Zoom controls ── */}
      <div style={{ position: 'absolute', top: 12, right: selectedBubble ? 460 : 12, zIndex: 20, display: 'flex', gap: 6 }}>
        {[
          { label: '+', delta: 1.2 },
          { label: '−', delta: 0.8 },
          { label: '⟳', reset: true },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={() => {
              if (btn.reset) { setZoom(0.85); setPan({ x: 0, y: 0 }) }
              else setZoom(prev => Math.min(3, Math.max(0.3, prev * btn.delta!)))
            }}
            style={{
              width: 32, height: 32,
              background: 'rgba(0,0,0,0.6)', border: '1px solid var(--border-color)',
              borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── SVG canvas ── */}
      <svg
        width="100%" height="100%"
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: 'center',
          cursor: dragging.current ? 'grabbing' : 'grab',
          transition: dragging.current ? 'none' : 'transform 0.05s',
        }}
      >
        <defs>
          {EVOL_BUBBLES.map(b => (
            <radialGradient key={b.id + '-grad'} id={`evol-grad-${b.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={b.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={b.color} stopOpacity={0.05} />
            </radialGradient>
          ))}
          <radialGradient id="evol-center-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.05} />
          </radialGradient>
          <filter id="evol-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <style>{`
            .evol-bubble-line { stroke-dasharray: 6 4; animation: evol-dash 20s linear infinite; }
            @keyframes evol-dash { to { stroke-dashoffset: -200; } }
            .evol-bubble-node:hover .evol-bubble-circle { filter: brightness(1.25); }
          `}</style>
        </defs>

        {/* Lines from center to visible bubbles */}
        {bubblePositions.filter(b => b.visible).map(b => (
          <line
            key={b.id + '-line'}
            className="evol-bubble-line"
            x1={CX} y1={CY} x2={b.x} y2={b.y}
            stroke={b.color} strokeWidth={1.5} strokeOpacity={0.35}
          />
        ))}

        {/* Center node */}
        <g>
          <circle cx={CX} cy={CY} r={CENTER_R + 12} fill="url(#evol-center-grad)" />
          <circle cx={CX} cy={CY} r={CENTER_R} fill="#111" stroke="#a78bfa" strokeWidth={2} />
          <text x={CX} y={CY - 12} textAnchor="middle" fontSize={12} fontWeight={700} fill="#a78bfa">Evolution</text>
          <text x={CX} y={CY + 4} textAnchor="middle" fontSize={11} fill="#a78bfa" opacity={0.8}>Exam 2</text>
          <text x={CX} y={CY + 18} textAnchor="middle" fontSize={10} fill="#9ca3af">20 Bubbles</text>
        </g>

        {/* Bubble nodes */}
        {bubblePositions.map(b => {
          if (!b.visible) return null
          const isSelected = selectedBubble?.id === b.id
          // Wrap title into lines (split on space at word boundary, ~14 chars per line)
          const titleWords = b.title.split(' ')
          const lines: string[] = []
          let current = ''
          for (const word of titleWords) {
            if ((current + ' ' + word).trim().length > 13 && current) {
              lines.push(current.trim())
              current = word
            } else {
              current = (current + ' ' + word).trim()
            }
          }
          if (current) lines.push(current)
          const lineOffset = -(lines.length - 1) * 7

          return (
            <g
              key={b.id}
              className="evol-bubble-node"
              onClick={() => {
                setSelectedBubble(isSelected ? null : b)
                if (!isSelected) setFocusMode(false)
              }}
              style={{ cursor: 'pointer' }}
            >
              <circle cx={b.x} cy={b.y} r={BUBBLE_R + 12} fill={`url(#evol-grad-${b.id})`} />
              <circle
                className="evol-bubble-circle"
                cx={b.x} cy={b.y} r={BUBBLE_R}
                fill="#111"
                stroke={b.color}
                strokeWidth={isSelected ? 3 : 1.5}
                filter={isSelected ? 'url(#evol-glow)' : undefined}
                style={{ transition: 'stroke-width 0.2s' }}
              />
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={b.x} y={b.y + lineOffset + li * 14}
                  textAnchor="middle"
                  fontSize={10} fontWeight={700}
                  fill={b.color}
                >
                  {line}
                </text>
              ))}
              <text x={b.x} y={b.y + lineOffset + lines.length * 14 + 2} textAnchor="middle" fontSize={8} fill="#555">
                {b.chapterLabel.split(' — ')[0]}
              </text>
            </g>
          )
        })}
      </svg>

      {/* ── Detail panel ── */}
      {selectedBubble && (
        <div className="detail-panel" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, pointerEvents: 'all' }}>
          <DetailPanel
            bubble={selectedBubble}
            onClose={() => { setSelectedBubble(null); setFocusMode(false); setActiveHeading(null) }}
            onQuizBubble={topic => { onQuizBubble(topic) }}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode(f => !f)}
            activeHeading={activeHeading}
          />
        </div>
      )}
    </div>
  )
}
