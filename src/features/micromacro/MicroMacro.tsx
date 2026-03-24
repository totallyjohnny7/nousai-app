import { useState, useCallback } from 'react'
import { useMicroMacro } from './useMicroMacro'
import SetLibrary from './SetLibrary'
import SetEditor from './SetEditor'
import ScaleExplorer from './ScaleExplorer'
import NodeEditor from './NodeEditor'
import AIGenerateModal from './AIGenerateModal'
import type { ScaleNode } from '../../types'

type View = 'library' | 'editor' | 'explorer'

export default function MicroMacro() {
  const mm = useMicroMacro()
  const [view, setView] = useState<View>('library')
  const [showAIGenerate, setShowAIGenerate] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  // Navigate to explorer for a set
  const handleExplore = useCallback((id: string) => {
    mm.setActiveSetId(id)
    mm.setSelectedNodeId(null)
    setView('explorer')
  }, [mm])

  // Navigate to editor for a set
  const handleEdit = useCallback((id: string) => {
    mm.setActiveSetId(id)
    setView('editor')
  }, [mm])

  // Create new set and go to editor
  const handleCreate = useCallback(() => {
    const newSet = mm.createSet()
    mm.setActiveSetId(newSet.id)
    setView('editor')
  }, [mm])

  // Back to library
  const handleBack = useCallback(() => {
    setView('library')
    mm.setActiveSetId(null)
    mm.setSelectedNodeId(null)
    setEditingNodeId(null)
  }, [mm])

  // Add node from explorer quick-add
  const handleQuickAdd = useCallback((label: string, emoji: string) => {
    if (!mm.activeSetId) return
    const node = mm.addNode(mm.activeSetId, { label, emoji })
    mm.setSelectedNodeId(node.id)
  }, [mm])

  // Editor: add node and open node editor
  const handleEditorAddNode = useCallback(() => {
    if (!mm.activeSetId) return
    const node = mm.addNode(mm.activeSetId)
    setEditingNodeId(node.id)
  }, [mm])

  const editingNode = mm.activeSet?.nodes.find(n => n.id === editingNodeId) ?? null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @media (max-width: 767px) {
          .mm-info-desktop { display: none !important; }
        }
        @media (min-width: 768px) {
          .mm-info-mobile { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mm-info-desktop, .mm-info-mobile, circle animate {
            animation: none !important;
            transition: none !important;
          }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #a855f7);
          cursor: pointer; border: none;
          box-shadow: 0 0 8px rgba(168,85,247,0.4);
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px; height: 14px; border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #a855f7);
          cursor: pointer; border: none;
          box-shadow: 0 0 8px rgba(168,85,247,0.4);
        }
      `}</style>

      {view === 'library' && (
        <SetLibrary
          sets={mm.sets}
          courses={mm.courses}
          onCreateSet={handleCreate}
          onExploreSet={handleExplore}
          onEditSet={handleEdit}
          onDuplicateSet={mm.duplicateSet}
          onDeleteSet={mm.deleteSet}
          onExportSet={mm.exportSet}
          onImportSet={mm.importSet}
          onGenerateWithAI={() => setShowAIGenerate(true)}
          aiConfigured={mm.aiConfigured}
        />
      )}

      {view === 'editor' && mm.activeSet && (
        <SetEditor
          set={mm.activeSet}
          courses={mm.courses}
          aiConfigured={mm.aiConfigured}
          aiLoading={mm.aiLoading}
          onUpdateSet={updates => mm.updateSet(mm.activeSet!.id, updates)}
          onAddNode={handleEditorAddNode}
          onEditNode={id => setEditingNodeId(id)}
          onAiFillAll={() => mm.aiFillAllNodes(mm.activeSet!.id)}
          onPreview={() => setView('explorer')}
          onClose={handleBack}
        />
      )}

      {view === 'explorer' && mm.activeSet && (
        <ScaleExplorer
          set={mm.activeSet}
          selectedNodeId={mm.selectedNodeId}
          onSelectNode={id => mm.setSelectedNodeId(id)}
          onBack={handleBack}
          onEditSet={() => setView('editor')}
          onAddNode={handleQuickAdd}
          onUpdateNode={(nodeId, updates) => mm.updateNode(mm.activeSet!.id, nodeId, updates)}
          onDeleteNode={nodeId => mm.deleteNode(mm.activeSet!.id, nodeId)}
          onAiFillNode={nodeId => mm.aiFillNode(mm.activeSet!.id, nodeId)}
          onSuggestPosition={label => mm.aiSuggestPosition(mm.activeSet!.id, label)}
          onTrackPosition={mm.trackPosition}
          onTrackNodeClick={mm.trackNodeClick}
          searchQuery={mm.searchQuery}
          onSearchChange={mm.setSearchQuery}
          filterTags={mm.filterTags}
          onToggleTag={tag => mm.setFilterTags(
            mm.filterTags.includes(tag)
              ? mm.filterTags.filter(t => t !== tag)
              : [...mm.filterTags, tag]
          )}
          allTags={mm.allTags}
          filteredNodes={mm.filteredNodes}
          aiConfigured={mm.aiConfigured}
          aiLoading={mm.aiLoading}
        />
      )}

      {/* AI Generate modal */}
      {showAIGenerate && (
        <AIGenerateModal
          courses={mm.courses}
          aiLoading={mm.aiLoading}
          onGenerate={async (subject, topic, micro, macro, courseId) => {
            const result = await mm.aiGenerateSet(subject, topic, micro, macro, courseId)
            if (result) setView('explorer')
          }}
          onClose={() => setShowAIGenerate(false)}
        />
      )}

      {/* Node editor from set editor view */}
      {view === 'editor' && editingNode && mm.activeSet && (
        <NodeEditor
          node={editingNode}
          siblingNodes={mm.activeSet.nodes}
          microLabel={mm.activeSet.micro_label}
          macroLabel={mm.activeSet.macro_label}
          aiConfigured={mm.aiConfigured}
          aiLoading={mm.aiLoading}
          onSave={updates => mm.updateNode(mm.activeSet!.id, editingNode.id, updates)}
          onDelete={() => mm.deleteNode(mm.activeSet!.id, editingNode.id)}
          onClose={() => setEditingNodeId(null)}
          onAiFill={() => mm.aiFillNode(mm.activeSet!.id, editingNode.id)}
          onSuggestPosition={label => mm.aiSuggestPosition(mm.activeSet!.id, label)}
        />
      )}
    </div>
  )
}
