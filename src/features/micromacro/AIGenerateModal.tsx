import { useState, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import type { Course } from '../../types'

interface Props {
  courses: Course[]
  aiLoading: boolean
  onGenerate: (subject: string, topic: string, microLabel: string, macroLabel: string, courseId: string | null) => Promise<unknown>
  onClose: () => void
}

export default function AIGenerateModal({ courses, aiLoading, onGenerate, onClose }: Props) {
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [microLabel, setMicroLabel] = useState('')
  const [macroLabel, setMacroLabel] = useState('')
  const [courseId, setCourseId] = useState<string | null>(null)

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !topic.trim() || !microLabel.trim() || !macroLabel.trim()) return
    await onGenerate(subject.trim(), topic.trim(), microLabel.trim(), macroLabel.trim(), courseId)
    onClose()
  }, [subject, topic, microLabel, macroLabel, courseId, onGenerate, onClose])

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
        borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: 440, padding: 24,
      }}>
        <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--text-primary)' }}>
          <Sparkles size={16} style={{ display: 'inline', marginRight: 8, color: '#a855f7' }} />
          Generate Scale Set with AI
        </h3>

        <label style={labelStyle}>Course (optional)</label>
        <select
          value={courseId || ''}
          onChange={e => setCourseId(e.target.value || null)}
          style={inputStyle}
        >
          <option value="">General / No Course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <label style={labelStyle}>Subject</label>
        <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Biology"
          style={inputStyle} />

        <label style={labelStyle}>Topic</label>
        <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Cell Structure"
          style={inputStyle} />

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Micro End (0)</label>
            <input value={microLabel} onChange={e => setMicroLabel(e.target.value)} placeholder="e.g. Atoms"
              style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Macro End (100)</label>
            <input value={macroLabel} onChange={e => setMacroLabel(e.target.value)} placeholder="e.g. Ecosystems"
              style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSubmit}
            disabled={aiLoading || !subject.trim() || !topic.trim() || !microLabel.trim() || !macroLabel.trim()}
            style={{ flex: 1 }}
          >
            {aiLoading ? 'Generating…' : 'Generate'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
  display: 'block', marginBottom: 4, marginTop: 12,
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}
