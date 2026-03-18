import { useState, useRef } from 'react'
import { StickyNote, Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import type { StickyNote as StickyNoteType } from '../../types'

// ── Color palette ─────────────────────────────────────────────────────────────

const COLOR_STYLES: Record<StickyNoteType['color'], { bg: string; border: string; placeholder: string }> = {
  yellow: { bg: 'rgba(245,166,35,0.12)', border: 'rgba(245,166,35,0.35)', placeholder: '#a38028' },
  blue:   { bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)', placeholder: '#3460a0' },
  green:  { bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.30)',  placeholder: '#1a7a42' },
}

const NOTE_COLORS: StickyNoteType['color'][] = ['yellow', 'blue', 'green']
const MAX_NOTES = 12

// ── Component ─────────────────────────────────────────────────────────────────

export default function StickyNotes() {
  const { data, setData } = useStore()
  const notes: StickyNoteType[] = (data?.pluginData?.dashboardNotes ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)

  const [addColor, setAddColor] = useState<StickyNoteType['color']>('yellow')
  const editingRef = useRef<Record<string, string>>({})

  function save(updatedNotes: StickyNoteType[]) {
    setData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        pluginData: { ...prev.pluginData, dashboardNotes: updatedNotes },
      }
    })
  }

  function addNote() {
    if (notes.length >= MAX_NOTES) return
    const newNote: StickyNoteType = {
      id: `sn-${Date.now()}`,
      text: '',
      color: addColor,
      order: notes.length,
    }
    save([...notes, newNote])
  }

  function deleteNote(id: string) {
    const updated = notes
      .filter(n => n.id !== id)
      .map((n, i) => ({ ...n, order: i }))
    save(updated)
  }

  function commitEdit(id: string) {
    const newText = editingRef.current[id]
    if (newText === undefined) return
    const updated = notes.map(n => n.id === id ? { ...n, text: newText } : n)
    save(updated)
  }

  if (notes.length === 0 && !data) return null

  return (
    <div className="mb-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          <StickyNote size={18} /> Sticky Notes
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Color picker */}
          {NOTE_COLORS.map(color => (
            <button
              key={color}
              onClick={() => setAddColor(color)}
              aria-label={`Select ${color} note`}
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: COLOR_STYLES[color].bg,
                border: `2px solid ${COLOR_STYLES[color].border}`,
                outline: addColor === color ? '2px solid var(--color-accent)' : 'none',
                outlineOffset: 1, cursor: 'pointer', padding: 0,
              }}
            />
          ))}
          <button
            className="btn btn-sm btn-secondary"
            onClick={addNote}
            disabled={notes.length >= MAX_NOTES}
            aria-label="Add sticky note"
            style={{ marginLeft: 4 }}
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-muted" style={{ fontSize: 13, textAlign: 'center', padding: '8px 0' }}>
          No notes yet. Click + to add one.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {notes.map(note => {
            const cs = COLOR_STYLES[note.color] ?? COLOR_STYLES.yellow
            return (
              <div
                key={note.id}
                style={{
                  position: 'relative',
                  background: cs.bg,
                  border: `1px solid ${cs.border}`,
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 10px 10px 10px',
                  minHeight: 80,
                }}
              >
                {/* Delete button */}
                <button
                  onClick={() => deleteNote(note.id)}
                  aria-label="Delete note"
                  style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 2, lineHeight: 1,
                  }}
                >
                  <X size={11} />
                </button>

                {/* Editable text — contenteditable is safe here (JSX renders text nodes, not HTML) */}
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => {
                    editingRef.current[note.id] = (e.target as HTMLDivElement).innerText
                  }}
                  onBlur={() => commitEdit(note.id)}
                  aria-label="Sticky note text"
                  style={{
                    fontSize: 12, lineHeight: 1.6, color: 'var(--text-primary)',
                    minHeight: 52, outline: 'none', paddingRight: 12, wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                  data-placeholder="Type a note…"
                >
                  {note.text}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {notes.length >= MAX_NOTES && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
          Max {MAX_NOTES} notes reached
        </p>
      )}
    </div>
  )
}
