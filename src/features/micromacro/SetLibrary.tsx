import { useState, useRef, useMemo } from 'react'
import { Plus, Sparkles, Copy, Trash2, Download, Upload, Eye, Edit3 } from 'lucide-react'
import type { ScaleSet, Course } from '../../types'

interface Props {
  sets: ScaleSet[]
  courses: Course[]
  onCreateSet: () => void
  onExploreSet: (id: string) => void
  onEditSet: (id: string) => void
  onDuplicateSet: (id: string) => void
  onDeleteSet: (id: string) => void
  onExportSet: (id: string) => void
  onImportSet: (file: File) => void
  onGenerateWithAI: () => void
  aiConfigured: boolean
}

export default function SetLibrary({
  sets, courses, onCreateSet, onExploreSet, onEditSet,
  onDuplicateSet, onDeleteSet, onExportSet, onImportSet, onGenerateWithAI, aiConfigured,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const courseMap = useMemo(() => new Map(courses.map(c => [c.id, c])), [courses])

  const grouped = useMemo(() => {
    const groups: Record<string, { label: string; color: string; sets: ScaleSet[] }> = {}
    groups['__general'] = { label: 'General', color: 'var(--text-muted)', sets: [] }
    for (const c of courses) {
      groups[c.id] = { label: c.name, color: c.color || 'var(--text-muted)', sets: [] }
    }
    for (const s of sets) {
      const key = s.course_id && groups[s.course_id] ? s.course_id : '__general'
      groups[key].sets.push(s)
    }
    return Object.entries(groups).filter(([, g]) => g.sets.length > 0)
  }, [sets, courses])

  if (sets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>🔭</div>
        <h3 style={{ fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', margin: '0 0 8px' }}>
          MicroMacro
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 24px', maxWidth: 320, marginInline: 'auto' }}>
          Build visual concept scales from micro to macro. Zoom through knowledge like Google Earth for ideas.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={onCreateSet}>
            <Plus size={14} /> Create First Scale
          </button>
          {aiConfigured && (
            <button className="btn btn-secondary btn-sm" onClick={onGenerateWithAI}>
              <Sparkles size={14} /> Generate with AI
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>MicroMacro</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={onCreateSet}>
            <Plus size={14} /> New Set
          </button>
          {aiConfigured && (
            <button className="btn btn-secondary btn-sm" onClick={onGenerateWithAI}>
              <Sparkles size={14} /> Generate with AI
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import
          </button>
          <input ref={fileRef} type="file" accept=".json,.micromacro.json" hidden
            onChange={e => { const f = e.target.files?.[0]; if (f) { onImportSet(f); e.target.value = '' } }} />
        </div>
      </div>

      {/* Grouped sets */}
      {grouped.map(([groupId, group]) => (
        <div key={groupId} style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: group.color, marginBottom: 10, paddingLeft: 2,
          }}>
            {group.label}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {group.sets.map(s => (
              <SetCard
                key={s.id}
                set={s}
                courseName={s.course_id ? courseMap.get(s.course_id)?.name : undefined}
                onExplore={() => onExploreSet(s.id)}
                onEdit={() => onEditSet(s.id)}
                onDuplicate={() => onDuplicateSet(s.id)}
                onDelete={() => {
                  if (confirmDelete === s.id) { onDeleteSet(s.id); setConfirmDelete(null) }
                  else setConfirmDelete(s.id)
                }}
                onExport={() => onExportSet(s.id)}
                confirmingDelete={confirmDelete === s.id}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SetCard({ set, courseName, onExplore, onEdit, onDuplicate, onDelete, onExport, confirmingDelete }: {
  set: ScaleSet; courseName?: string
  onExplore: () => void; onEdit: () => void; onDuplicate: () => void
  onDelete: () => void; onExport: () => void; confirmingDelete: boolean
}) {
  const age = formatAge(set.updated_at)
  return (
    <div className="card" style={{
      borderLeft: `3px solid ${set.color_theme}`,
      padding: 16, cursor: 'pointer', transition: 'background 0.15s',
    }} onClick={onExplore}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
            {set.name || 'Untitled'}
          </h4>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {set.subject}{courseName ? ` · ${courseName}` : ''}
          </div>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
          {set.nodes.length} nodes
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
        {set.micro_label} → {set.macro_label}
      </div>

      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <button className="btn btn-ghost btn-sm" onClick={onExplore} title="Explore"><Eye size={13} /></button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Edit"><Edit3 size={13} /></button>
        <button className="btn btn-ghost btn-sm" onClick={onDuplicate} title="Duplicate"><Copy size={13} /></button>
        <button className="btn btn-ghost btn-sm" onClick={onExport} title="Export JSON"><Download size={13} /></button>
        <button className={`btn btn-sm ${confirmingDelete ? 'btn-danger' : 'btn-ghost'}`}
          onClick={onDelete} title={confirmingDelete ? 'Confirm delete' : 'Delete'}>
          <Trash2 size={13} />
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>{age}</span>
      </div>
    </div>
  )
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
