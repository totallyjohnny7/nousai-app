/**
 * QuizMenu — Start screen with preset cards, mini-games, vocab bank, and course quiz banks
 */
import React from 'react'
import type { JpQuizCourseData, JpQuizPreset, MiniGameType, VocabBankItem } from './types'
import { PRESET_INFO } from './types'

interface Props {
  data: JpQuizCourseData
  bank: VocabBankItem[]
  onStart: (preset: JpQuizPreset) => void
  onManage: () => void
  onStartMiniGame: (game: MiniGameType) => void
  onManageVocab: () => void
  onGoToCourseQuizzes: () => void
}

const MINI_GAMES: { key: MiniGameType; icon: string; label: string; desc: string }[] = [
  { key: 'memory-flip',      icon: '🃏', label: 'Memory Flip',      desc: 'Flip cards to match words' },
  { key: 'sentence-builder', icon: '📝', label: 'Sentence Builder', desc: 'Arrange tiles in order' },
  { key: 'listening-quiz',   icon: '🔊', label: 'Listening Quiz',   desc: 'Hear it, pick the meaning' },
]

// Word counts usable per mini game
function bankCounts(bank: VocabBankItem[]) {
  const pairs = bank.filter(v => v.word && v.meaning && !v.word.startsWith('〜') && v.category !== 'grammar').length
  const grammar = bank.filter(v => v.example && v.exampleEn).length
  return { pairs, grammar }
}

export default function QuizMenu({ data, bank, onStart, onManage, onStartMiniGame, onManageVocab, onGoToCourseQuizzes }: Props) {
  const counts = bankCounts(bank)
  const qCount = data.questions.length
  const lastSession = data.sessionHistory.length > 0
    ? data.sessionHistory[data.sessionHistory.length - 1]
    : null

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>🇯🇵 Japanese Quiz</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
          {qCount} question{qCount !== 1 ? 's' : ''} in bank
          {lastSession && ` · Last score: ${lastSession.averageScore}%`}
        </p>
      </div>

      {/* Preset cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
        {(Object.keys(PRESET_INFO) as JpQuizPreset[]).map(preset => {
          const info = PRESET_INFO[preset]
          const disabled = qCount === 0
          return (
            <button
              key={preset}
              disabled={disabled}
              onClick={() => onStart(preset)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '18px 14px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
                transition: 'transform 0.15s, box-shadow 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!disabled) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = ''
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>{info.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                {info.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {info.desc}
              </div>
            </button>
          )
        })}
      </div>

      {/* Manage button */}
      <button
        onClick={onManage}
        style={{
          width: '100%',
          padding: '12px 16px',
          background: 'var(--accent-color, #6C5CE7)',
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          marginBottom: 28,
        }}
      >
        📚 Manage Questions ({qCount})
      </button>

      {qCount === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: -20, marginBottom: 12 }}>
          Add questions first to start a quiz!
        </p>
      )}

      {/* ── Mini Games ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{
            fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: 0,
            textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            Mini Games
          </h4>
          <button
            onClick={onManageVocab}
            style={{
              padding: '5px 12px', borderRadius: 8,
              border: '1px solid var(--accent-color, #F5A623)',
              background: 'var(--accent-color, #F5A623)18',
              color: 'var(--accent-color, #F5A623)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            📖 Vocab Bank ({bank.length})
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {MINI_GAMES.map(g => {
            const wordCount = g.key === 'sentence-builder' ? counts.grammar : counts.pairs
            const usingBank = wordCount >= (g.key === 'sentence-builder' ? 1 : 4)
            return (
              <button
                key={g.key}
                onClick={() => onStartMiniGame(g.key)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 12,
                  padding: '16px 10px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'inherit',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = ''
                  e.currentTarget.style.boxShadow = ''
                }}
              >
                <div style={{ fontSize: 26, marginBottom: 6 }}>{g.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                  {g.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: 6 }}>
                  {g.desc}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600,
                  color: usingBank ? '#2ecc71' : 'var(--text-muted)',
                }}>
                  {usingBank ? `✓ ${wordCount} custom` : 'Default vocab'}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Course Quiz Banks ── */}
      <div style={{
        padding: '14px 18px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 28,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>📚 Course Quiz Banks</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI-generated quizzes from your notes</div>
        </div>
        <button
          onClick={onGoToCourseQuizzes}
          style={{
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-card)', color: 'var(--text-primary)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          View →
        </button>
      </div>

      {/* Session history */}
      {data.sessionHistory.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Recent Sessions
          </h4>
          {data.sessionHistory.slice(-5).reverse().map(s => (
            <div key={s.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 8,
              marginBottom: 6, fontSize: 13,
            }}>
              <span>
                {PRESET_INFO[s.preset]?.icon} {PRESET_INFO[s.preset]?.label} · {s.totalQuestions}Q
              </span>
              <span style={{ fontWeight: 600, color: s.averageScore >= 80 ? 'var(--success-color, #2ecc71)' : s.averageScore >= 50 ? 'var(--warning-color, #f39c12)' : 'var(--danger-color, #e74c3c)' }}>
                {s.averageScore}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
