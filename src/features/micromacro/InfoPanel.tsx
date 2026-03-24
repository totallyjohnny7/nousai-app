import type { ScaleNode } from '../../types'

interface Props {
  node: ScaleNode | null
  nodes: ScaleNode[]
  onEditNode: () => void
  onSelectNode: (id: string) => void
}

function positionLabel(pos: number): string {
  if (pos <= 25) return 'Micro'
  if (pos >= 75) return 'Macro'
  return 'Mid'
}

function positionColor(pos: number): string {
  if (pos <= 25) return '#06b6d4'
  if (pos >= 75) return '#a855f7'
  return '#f59e0b'
}

export default function InfoPanel({ node, nodes, onEditNode, onSelectNode }: Props) {
  if (!node) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', color: 'var(--text-muted)', fontSize: 13,
        fontStyle: 'italic',
      }}>
        Click any node to explore
      </div>
    )
  }

  const linked = nodes.filter(n => node.links_to.includes(n.id))

  return (
    <div role="complementary" aria-live="polite" style={{
      padding: 20, overflowY: 'auto', height: '100%',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{node.emoji}</div>
        <h3 style={{
          margin: 0, fontSize: 18, fontFamily: 'var(--font-heading)',
          color: 'var(--text-primary)', fontWeight: 600,
        }}>{node.label}</h3>
        <span style={{
          display: 'inline-block', marginTop: 6, padding: '2px 10px',
          borderRadius: 12, fontSize: 11, fontFamily: 'var(--font-mono)',
          fontWeight: 500, color: positionColor(node.position),
          background: `${positionColor(node.position)}1a`,
          border: `1px solid ${positionColor(node.position)}33`,
        }}>
          {positionLabel(node.position)} · {node.position}
        </span>
      </div>

      {/* Tags */}
      {node.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
          {node.tags.map(t => (
            <span key={t} className="badge" style={{ fontSize: 11 }}>{t}</span>
          ))}
        </div>
      )}

      {/* Content sections */}
      {node.summary && (
        <Section icon="📖" title="What">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {node.summary}
          </p>
        </Section>
      )}

      {node.mechanism && (
        <Section icon="⚙️" title="How">
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            {node.mechanism}
          </p>
        </Section>
      )}

      {node.mnemonic && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#06b6d4', marginBottom: 4 }}>
            🧠 Mnemonic
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {node.mnemonic}
          </p>
        </div>
      )}

      {node.analogy && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7', marginBottom: 4 }}>
            💡 Analogy
          </div>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {node.analogy}
          </p>
        </div>
      )}

      {node.fast_facts.length > 0 && (
        <Section icon="⚡" title="Fast Facts">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
            {node.fast_facts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </Section>
      )}

      {linked.length > 0 && (
        <Section icon="🔗" title="Connected To">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {linked.map(l => (
              <button
                key={l.id}
                onClick={() => onSelectNode(l.id)}
                style={{
                  background: `${l.color}1a`, border: `1px solid ${l.color}33`,
                  borderRadius: 16, padding: '4px 10px', cursor: 'pointer',
                  fontSize: 12, color: l.color, fontFamily: 'inherit',
                }}
              >
                {l.emoji} {l.label}
              </button>
            ))}
          </div>
        </Section>
      )}

      <button className="btn btn-secondary btn-sm" onClick={onEditNode} style={{ marginTop: 'auto' }}>
        Edit Node
      </button>
    </div>
  )
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}
