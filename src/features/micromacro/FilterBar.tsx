import { Search, X } from 'lucide-react'

interface Props {
  query: string
  onQueryChange: (q: string) => void
  tags: string[]
  activeTags: string[]
  onToggleTag: (tag: string) => void
}

export default function FilterBar({ query, onQueryChange, tags, activeTags, onToggleTag }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', background: 'var(--bg-input)',
        border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
        flex: '1 1 140px', minWidth: 120, maxWidth: 240,
      }}>
        <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Filter nodes…"
          style={{
            border: 'none', background: 'transparent', outline: 'none',
            color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit',
            width: '100%',
          }}
        />
        {query && (
          <button onClick={() => onQueryChange('')} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            color: 'var(--text-muted)', display: 'flex',
          }}>
            <X size={12} />
          </button>
        )}
      </div>
      {tags.map(t => (
        <button
          key={t}
          onClick={() => onToggleTag(t)}
          className="badge"
          style={{
            cursor: 'pointer', fontSize: 10,
            background: activeTags.includes(t) ? 'var(--accent-dim)' : 'transparent',
            borderColor: activeTags.includes(t) ? 'var(--accent)' : undefined,
          }}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
