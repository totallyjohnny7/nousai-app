import { useState, useCallback } from 'react'
import { ArrowLeft, Edit3, Plus } from 'lucide-react'
import type { ScaleSet, ScaleNode } from '../../types'
import ScaleCanvas from './ScaleCanvas'
import ScaleSlider from './ScaleSlider'
import InfoPanel from './InfoPanel'
import FilterBar from './FilterBar'
import QuickAddBar from './QuickAddBar'
import NodeEditor from './NodeEditor'

interface Props {
  set: ScaleSet
  selectedNodeId: string | null
  onSelectNode: (id: string | null) => void
  onBack: () => void
  onEditSet: () => void
  onAddNode: (label: string, emoji: string) => void
  onUpdateNode: (nodeId: string, updates: Partial<ScaleNode>) => void
  onDeleteNode: (nodeId: string) => void
  onAiFillNode: (nodeId: string) => void
  onSuggestPosition: (label: string) => Promise<number | null>
  onTrackPosition: (pos: number) => void
  onTrackNodeClick: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  filterTags: string[]
  onToggleTag: (tag: string) => void
  allTags: string[]
  filteredNodes: ScaleNode[]
  aiConfigured: boolean
  aiLoading: boolean
}

export default function ScaleExplorer({
  set, selectedNodeId, onSelectNode, onBack, onEditSet,
  onAddNode, onUpdateNode, onDeleteNode, onAiFillNode, onSuggestPosition,
  onTrackPosition, onTrackNodeClick,
  searchQuery, onSearchChange, filterTags, onToggleTag, allTags, filteredNodes,
  aiConfigured, aiLoading,
}: Props) {
  const [position, setPosition] = useState(50)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false)

  const selectedNode = set.nodes.find(n => n.id === selectedNodeId) ?? null
  const editingNode = set.nodes.find(n => n.id === editingNodeId) ?? null

  const handlePositionChange = useCallback((p: number) => {
    setPosition(p)
    onTrackPosition(p)
  }, [onTrackPosition])

  const handleSelectNode = useCallback((id: string) => {
    onSelectNode(id)
    onTrackNodeClick()
    setIsMobileInfoOpen(true)
  }, [onSelectNode, onTrackNodeClick])

  const handleAddFromQuick = useCallback((label: string, emoji: string) => {
    onAddNode(label, emoji)
  }, [onAddNode])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)',
        flexWrap: 'wrap',
      }}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontSize: 14, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)', flex: '0 0 auto' }}>
          {set.name}
        </h3>
        {set.course_id && (
          <span className="badge" style={{ fontSize: 10 }}>{set.subject}</span>
        )}
        <div style={{ flex: 1 }} />
        <FilterBar
          query={searchQuery}
          onQueryChange={onSearchChange}
          tags={allTags}
          activeTags={filterTags}
          onToggleTag={onToggleTag}
        />
        <button className="btn btn-ghost btn-sm" onClick={onEditSet}>
          <Edit3 size={14} /> Edit
        </button>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Canvas */}
        <ScaleCanvas
          nodes={filteredNodes}
          currentPosition={position}
          selectedNodeId={selectedNodeId}
          onSelectNode={handleSelectNode}
          onPositionChange={handlePositionChange}
        />

        {/* Desktop InfoPanel */}
        <div className="mm-info-desktop" style={{
          width: selectedNode ? 320 : 0,
          borderLeft: selectedNode ? '1px solid var(--border)' : 'none',
          background: 'var(--bg-secondary)',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          flexShrink: 0,
        }}>
          {selectedNode && (
            <InfoPanel
              node={selectedNode}
              nodes={set.nodes}
              onEditNode={() => setEditingNodeId(selectedNode.id)}
              onSelectNode={id => { onSelectNode(id); onTrackNodeClick() }}
            />
          )}
        </div>

        {/* Mobile InfoPanel (bottom sheet) */}
        {selectedNode && isMobileInfoOpen && (
          <div className="mm-info-mobile" style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            maxHeight: '60vh', background: 'var(--bg-card)',
            borderTop: '1px solid var(--border)',
            borderRadius: '16px 16px 0 0',
            overflow: 'auto', zIndex: 20,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'center', padding: '8px 0 4px',
              cursor: 'pointer',
            }} onClick={() => { setIsMobileInfoOpen(false); onSelectNode(null) }}>
              <div style={{ width: 32, height: 4, borderRadius: 2, background: 'var(--border)' }} />
            </div>
            <InfoPanel
              node={selectedNode}
              nodes={set.nodes}
              onEditNode={() => setEditingNodeId(selectedNode.id)}
              onSelectNode={id => { onSelectNode(id); onTrackNodeClick() }}
            />
          </div>
        )}

        {/* Quick add FAB */}
        <QuickAddBar
          onAdd={handleAddFromQuick}
          onSuggestPosition={onSuggestPosition}
          aiConfigured={aiConfigured}
        />
      </div>

      {/* Bottom slider */}
      <ScaleSlider
        value={position}
        onChange={handlePositionChange}
        microLabel={set.micro_label}
        macroLabel={set.macro_label}
      />

      {/* Node editor modal */}
      {editingNode && (
        <NodeEditor
          node={editingNode}
          siblingNodes={set.nodes}
          microLabel={set.micro_label}
          macroLabel={set.macro_label}
          aiConfigured={aiConfigured}
          aiLoading={aiLoading}
          onSave={updates => onUpdateNode(editingNode.id, updates)}
          onDelete={() => onDeleteNode(editingNode.id)}
          onClose={() => setEditingNodeId(null)}
          onAiFill={() => onAiFillNode(editingNode.id)}
          onSuggestPosition={onSuggestPosition}
        />
      )}
    </div>
  )
}
