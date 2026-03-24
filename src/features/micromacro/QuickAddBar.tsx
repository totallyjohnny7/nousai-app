import { useState, useCallback } from 'react'
import { Plus, Target, Sparkles } from 'lucide-react'

interface Props {
  onAdd: (label: string, emoji: string) => void
  onSuggestPosition: (label: string) => Promise<number | null>
  aiConfigured: boolean
}

export default function QuickAddBar({ onAdd, onSuggestPosition, aiConfigured }: Props) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [emoji, setEmoji] = useState('📌')
  const [suggesting, setSuggesting] = useState(false)

  const handleAdd = useCallback(() => {
    if (!label.trim()) return
    onAdd(label.trim(), emoji)
    setLabel('')
    setEmoji('📌')
    setOpen(false)
  }, [label, emoji, onAdd])

  const handleSuggest = useCallback(async () => {
    if (!label.trim()) return
    setSuggesting(true)
    await onSuggestPosition(label.trim())
    setSuggesting(false)
  }, [label, onSuggestPosition])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
          width: 44, height: 44, borderRadius: '50%',
          background: 'linear-gradient(135deg, #06b6d4, #a855f7)',
          border: 'none', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(168,85,247,0.3)',
        }}
        aria-label="Add node"
      >
        <Plus size={20} />
      </button>
    )
  }

  return (
    <div style={{
      position: 'absolute', bottom: 16, right: 16, zIndex: 10,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: 12, width: 240,
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <input
          value={emoji}
          onChange={e => setEmoji(e.target.value)}
          maxLength={2}
          style={{
            width: 36, padding: '6px 4px', textAlign: 'center', fontSize: 16,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
          }}
        />
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Node label…"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setOpen(false) }}
          style={{
            flex: 1, padding: '6px 10px', fontSize: 13,
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            fontFamily: 'inherit', outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{ flex: 1 }}>
          <Plus size={14} /> Add
        </button>
        {aiConfigured && (
          <button className="btn btn-ghost btn-sm" onClick={handleSuggest} disabled={suggesting || !label.trim()}>
            {suggesting ? <Target size={14} className="spin" /> : <><Sparkles size={14} /> Pos</>}
          </button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>✕</button>
      </div>
    </div>
  )
}
