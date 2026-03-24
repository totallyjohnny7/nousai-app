import { useState, useCallback } from 'react'
import { Plus, Sparkles, GripVertical } from 'lucide-react'
import type { ScaleSet, ScaleNode, Course } from '../../types'
import { COLOR_SWATCHES } from './useMicroMacro'
import ScaleSlider from './ScaleSlider'

interface Props {
  set: ScaleSet
  courses: Course[]
  aiConfigured: boolean
  aiLoading: boolean
  onUpdateSet: (updates: Partial<ScaleSet>) => void
  onAddNode: () => void
  onEditNode: (nodeId: string) => void
  onAiFillAll: () => void
  onPreview: () => void
  onClose: () => void
}

export default function SetEditor({
  set, courses, aiConfigured, aiLoading,
  onUpdateSet, onAddNode, onEditNode, onAiFillAll, onPreview, onClose,
}: Props) {
  const [name, setName] = useState(set.name)
  const [subject, setSubject] = useState(set.subject)
  const [courseId, setCourseId] = useState(set.course_id || '')
  const [description, setDescription] = useState(set.description)
  const [microLabel, setMicroLabel] = useState(set.micro_label)
  const [macroLabel, setMacroLabel] = useState(set.macro_label)
  const [colorTheme, setColorTheme] = useState(set.color_theme)

  const handleSave = useCallback(() => {
    onUpdateSet({
      name: name.trim(), subject: subject.trim(),
      course_id: courseId || null, description: description.trim(),
      micro_label: microLabel.trim() || 'Micro',
      macro_label: macroLabel.trim() || 'Macro',
      color_theme: colorTheme,
    })
    onClose()
  }, [name, subject, courseId, description, microLabel, macroLabel, colorTheme, onUpdateSet, onClose])

  const sorted = [...set.nodes].sort((a, b) => a.position - b.position)

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-primary)', margin: '0 0 20px' }}>
        {set.name ? 'Edit Set' : 'New Scale Set'}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Cell Biology Scale" />
        <Field label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Biology" />

        <div>
          <label style={labelStyle}>Course</label>
          <select value={courseId} onChange={e => setCourseId(e.target.value)} style={inputStyle}>
            <option value="">General / No Course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <Field label="Description" value={description} onChange={setDescription} placeholder="Optional description" rows={2} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Field label="Micro Label (0)" value={microLabel} onChange={setMicroLabel} placeholder="Micro" />
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Macro Label (100)" value={macroLabel} onChange={setMacroLabel} placeholder="Macro" />
          </div>
        </div>

        {/* Color picker */}
        <div>
          <label style={labelStyle}>Color Theme</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLOR_SWATCHES.map(c => (
              <button key={c} onClick={() => setColorTheme(c)} style={{
                width: 28, height: 28, borderRadius: '50%', border: c === colorTheme ? '2px solid #fff' : '2px solid transparent',
                background: c, cursor: 'pointer', transition: 'border-color 0.15s',
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Node table */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            Nodes ({set.nodes.length})
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-ghost btn-sm" onClick={onAddNode}>
              <Plus size={14} /> Add Node
            </button>
            {aiConfigured && set.nodes.length > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={onAiFillAll} disabled={aiLoading}>
                <Sparkles size={14} /> AI Fill All
              </button>
            )}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
            No nodes yet — add one to get started
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sorted.map(n => (
              <NodeRow key={n.id} node={n} onEdit={() => onEditNode(n.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} style={{ flex: 1 }}>Save</button>
        {set.nodes.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={onPreview}>Preview →</button>
        )}
        <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function NodeRow({ node, onEdit }: { node: ScaleNode; onEdit: () => void }) {
  return (
    <button onClick={onEdit} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', cursor: 'pointer', width: '100%',
      fontFamily: 'inherit', textAlign: 'left',
    }}>
      <GripVertical size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
      <span style={{ fontSize: 18 }}>{node.emoji}</span>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
        minWidth: 28, textAlign: 'center',
      }}>{node.position}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', flex: 1 }}>
        {node.label || 'Untitled'}
      </span>
      {node.ai_generated && <Sparkles size={12} style={{ color: '#a855f7', flexShrink: 0 }} />}
    </button>
  )
}

function Field({ label, value, onChange, placeholder, rows }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  const Tag = rows ? 'textarea' : 'input'
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <Tag value={value} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{ ...inputStyle, resize: rows ? 'vertical' as const : undefined }} />
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
  display: 'block', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
