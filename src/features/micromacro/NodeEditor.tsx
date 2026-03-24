import { useState, useCallback, useEffect } from 'react'
import { Sparkles, Trash2, Target } from 'lucide-react'
import type { ScaleNode } from '../../types'
import ScaleSlider from './ScaleSlider'

interface Props {
  node: ScaleNode
  siblingNodes: ScaleNode[]
  microLabel: string
  macroLabel: string
  aiConfigured: boolean
  aiLoading: boolean
  onSave: (updates: Partial<ScaleNode>) => void
  onDelete: () => void
  onClose: () => void
  onAiFill: () => void
  onSuggestPosition: (label: string) => Promise<number | null>
}

export default function NodeEditor({
  node, siblingNodes, microLabel, macroLabel,
  aiConfigured, aiLoading, onSave, onDelete, onClose, onAiFill, onSuggestPosition,
}: Props) {
  const [label, setLabel] = useState(node.label)
  const [position, setPosition] = useState(node.position)
  const [emoji, setEmoji] = useState(node.emoji)
  const [color, setColor] = useState(node.color)
  const [summary, setSummary] = useState(node.summary)
  const [mechanism, setMechanism] = useState(node.mechanism)
  const [mnemonic, setMnemonic] = useState(node.mnemonic)
  const [analogy, setAnalogy] = useState(node.analogy)
  const [fastFacts, setFastFacts] = useState<string[]>(
    node.fast_facts.length > 0 ? [...node.fast_facts] : ['']
  )
  const [tagsInput, setTagsInput] = useState(node.tags.join(', '))
  const [linksTo, setLinksTo] = useState<string[]>(node.links_to)

  useEffect(() => {
    setLabel(node.label)
    setPosition(node.position)
    setEmoji(node.emoji)
    setColor(node.color)
    setSummary(node.summary)
    setMechanism(node.mechanism)
    setMnemonic(node.mnemonic)
    setAnalogy(node.analogy)
    setFastFacts(node.fast_facts.length > 0 ? [...node.fast_facts] : [''])
    setTagsInput(node.tags.join(', '))
    setLinksTo(node.links_to)
  }, [node])

  const handleSave = useCallback(() => {
    onSave({
      label, position, emoji, color, summary, mechanism, mnemonic, analogy,
      fast_facts: fastFacts.filter(f => f.trim()),
      tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      links_to: linksTo,
    })
    onClose()
  }, [label, position, emoji, color, summary, mechanism, mnemonic, analogy, fastFacts, tagsInput, linksTo, onSave, onClose])

  const handleSuggestPos = useCallback(async () => {
    if (!label.trim()) return
    const pos = await onSuggestPosition(label.trim())
    if (pos !== null) setPosition(pos)
  }, [label, onSuggestPosition])

  const updateFact = (i: number, v: string) => {
    const next = [...fastFacts]
    next[i] = v
    setFastFacts(next)
  }
  const addFact = () => { if (fastFacts.length < 4) setFastFacts([...fastFacts, '']) }
  const removeFact = (i: number) => setFastFacts(fastFacts.filter((_, idx) => idx !== i))

  const toggleLink = (id: string) => {
    setLinksTo(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const others = siblingNodes.filter(n => n.id !== node.id)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 520,
        maxHeight: '85vh', overflowY: 'auto', padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--text-primary)' }}>
          {node.label ? 'Edit Node' : 'New Node'}
        </h3>

        {/* Label + emoji */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={2}
            style={{ width: 44, padding: 8, textAlign: 'center', fontSize: 20, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }} />
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Concept label"
            style={{ flex: 1, padding: '8px 12px', fontSize: 14, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
          <input type="color" value={color} onChange={e => setColor(e.target.value)}
            style={{ width: 36, height: 36, padding: 0, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'transparent' }} />
        </div>

        {/* Position */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Position</label>
            {aiConfigured && (
              <button className="btn btn-ghost btn-sm" onClick={handleSuggestPos} disabled={aiLoading || !label.trim()} style={{ fontSize: 11 }}>
                <Target size={12} /> Suggest
              </button>
            )}
          </div>
          <ScaleSlider value={position} onChange={setPosition} microLabel={microLabel} macroLabel={macroLabel} />
        </div>

        {/* Text fields */}
        <Field label="Summary" value={summary} onChange={setSummary} rows={2} />
        <Field label="Mechanism" value={mechanism} onChange={setMechanism} rows={3} />
        <Field label="Mnemonic" value={mnemonic} onChange={setMnemonic} rows={2} />
        <Field label="Analogy" value={analogy} onChange={setAnalogy} rows={2} />

        {/* Fast Facts */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Fast Facts</label>
          {fastFacts.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              <input value={f} onChange={e => updateFact(i, e.target.value)} placeholder={`Fact ${i + 1}`}
                style={{ flex: 1, padding: '6px 10px', fontSize: 12, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
              {fastFacts.length > 1 && (
                <button onClick={() => removeFact(i)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>✕</button>
              )}
            </div>
          ))}
          {fastFacts.length < 4 && (
            <button className="btn btn-ghost btn-sm" onClick={addFact} style={{ fontSize: 11 }}>+ Add Fact</button>
          )}
        </div>

        {/* Tags */}
        <Field label="Tags (comma separated)" value={tagsInput} onChange={setTagsInput} />

        {/* Links */}
        {others.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Links To</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {others.map(o => (
                <button key={o.id} onClick={() => toggleLink(o.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 16, fontSize: 11, cursor: 'pointer',
                    fontFamily: 'inherit',
                    background: linksTo.includes(o.id) ? `${o.color}33` : 'transparent',
                    border: `1px solid ${linksTo.includes(o.id) ? o.color : 'var(--border)'}`,
                    color: linksTo.includes(o.id) ? o.color : 'var(--text-secondary)',
                  }}
                >
                  {o.emoji} {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ flex: 1 }}>Save</button>
          {aiConfigured && (
            <button className="btn btn-ghost btn-sm" onClick={onAiFill} disabled={aiLoading || !label.trim()}>
              {aiLoading ? <span className="spin" style={{ display: 'inline-block' }}>⏳</span> : <Sparkles size={14} />} AI Fill
            </button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => { onDelete(); onClose() }}>
            <Trash2 size={14} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, rows }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  const Tag = rows ? 'textarea' : 'input'
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
      <Tag value={value} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)} rows={rows}
        style={{ width: '100%', padding: '8px 12px', fontSize: 13, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: rows ? 'vertical' as const : undefined, boxSizing: 'border-box' }} />
    </div>
  )
}
