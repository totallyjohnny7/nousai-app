import { useState, useRef, useCallback } from 'react';
import { GitBranch, Plus, Trash2, RotateCcw, Download, Save, X } from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { uid, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: string[];
  color: string;
}

function MindMapTool() {
  const { data, updatePluginData } = useStore();
  const defaultNodes: MindMapNode[] = [
    { id: 'root', text: 'Main Topic', x: 350, y: 250, children: [], color: 'var(--accent)' },
  ];
  const [nodes, setNodes] = useState<MindMapNode[]>(defaultNodes);
  const [topicInput, setTopicInput] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [undoStack, setUndoStack] = useState<MindMapNode[][]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [savedMaps, setSavedMaps] = useState<{ id: string; name: string; nodes: MindMapNode[] }[]>(() => {
    try {
      const raw = localStorage.getItem('nousai-mindmaps');
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return [];
  });
  const [mapName, setMapName] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  const persistMaps = useCallback((maps: typeof savedMaps) => {
    setSavedMaps(maps);
    localStorage.setItem('nousai-mindmaps', JSON.stringify(maps));
  }, []);

  const nodeColors = [
    'var(--accent)', 'var(--green)', 'var(--blue)', 'var(--orange)',
    'var(--yellow)', 'var(--red)', '#8b5cf6', '#06b6d4',
  ];

  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-19), nodes.map(n => ({ ...n, children: [...n.children] }))]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setNodes(prev);
  }

  function addNode() {
    pushUndo();
    const parentId = selectedNode || 'root';
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    const angle = (parent.children.length * 60 + 30) * (Math.PI / 180);
    const distance = 120;
    const newId = uid();
    const newNode: MindMapNode = {
      id: newId,
      text: topicInput.trim() || 'New Topic',
      x: parent.x + Math.cos(angle) * distance,
      y: parent.y + Math.sin(angle) * distance,
      children: [],
      color: nodeColors[(nodes.length) % nodeColors.length],
    };

    setNodes(prev => prev.map(n =>
      n.id === parentId ? { ...n, children: [...n.children, newId] } : n
    ).concat(newNode));
    setTopicInput('');
    setSelectedNode(newId);
  }

  function removeNode(nodeId: string) {
    if (nodeId === 'root') return;
    pushUndo();
    const toRemove = new Set<string>();
    function collect(id: string) {
      toRemove.add(id);
      const node = nodes.find(n => n.id === id);
      node?.children.forEach(collect);
    }
    collect(nodeId);

    setNodes(prev =>
      prev
        .filter(n => !toRemove.has(n.id))
        .map(n => ({ ...n, children: n.children.filter(c => !toRemove.has(c)) }))
    );
    if (selectedNode && toRemove.has(selectedNode)) setSelectedNode(null);
  }

  function handleMouseDown(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !svgRef.current) return;

    pushUndo();
    const svgRect = svgRef.current.getBoundingClientRect();
    const vbW = 700 / zoom;
    const vbH = 500 / zoom;
    const scaleX = vbW / svgRect.width;
    const scaleY = vbH / svgRect.height;
    const svgX = (e.clientX - svgRect.left) * scaleX + pan.x;
    const svgY = (e.clientY - svgRect.top) * scaleY + pan.y;
    setDragging(nodeId);
    setDragOffset({ x: svgX - node.x, y: svgY - node.y });
    setSelectedNode(nodeId);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const vbW = 700 / zoom;
    const vbH = 500 / zoom;
    const scaleX = vbW / svgRect.width;
    const scaleY = vbH / svgRect.height;
    const svgX = (e.clientX - svgRect.left) * scaleX + pan.x;
    const svgY = (e.clientY - svgRect.top) * scaleY + pan.y;
    const newX = svgX - dragOffset.x;
    const newY = svgY - dragOffset.y;
    setNodes(prev => prev.map(n => n.id === dragging ? { ...n, x: newX, y: newY } : n));
  }

  function handleMouseUp() {
    setDragging(null);
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.3, Math.min(3, z + delta)));
  }

  function startEditing(nodeId: string) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setEditingNode(nodeId);
    setEditText(node.text);
  }

  function finishEditing() {
    if (editingNode && editText.trim()) {
      pushUndo();
      setNodes(prev => prev.map(n => n.id === editingNode ? { ...n, text: editText.trim() } : n));
    }
    setEditingNode(null);
    setEditText('');
  }

  function exportAsImage() {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = 700;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0f0f23';
      ctx.fillRect(0, 0, 700, 500);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `mindmap-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }

  function setRootTopic() {
    if (!topicInput.trim()) return;
    pushUndo();
    setNodes(prev => prev.map(n => n.id === 'root' ? { ...n, text: topicInput.trim() } : n));
    setTopicInput('');
  }

  function saveMap() {
    const name = mapName.trim() || nodes.find(n => n.id === 'root')?.text || 'Untitled';
    const existing = savedMaps.find(m => m.name === name);
    const updated = existing
      ? savedMaps.map(m => m.name === name ? { ...m, nodes: [...nodes] } : m)
      : [...savedMaps, { id: uid(), name, nodes: [...nodes] }];
    persistMaps(updated);
    setMapName('');

    // Also save to Library as ai-output note
    if (data) {
      const content = nodes.map(n => `- **${n.text}** (${n.children.length} children)`).join('\n');
      const note: Note = {
        id: `mindmap-${Date.now()}`,
        title: `Mind Map: ${name}`,
        content: `# Mind Map: ${name}\n\n${content}\n\n_${nodes.length} nodes_`,
        folder: 'AI Outputs',
        tags: ['mind-map'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'ai-output',
      };
      const existing = (data.pluginData as Record<string, unknown>).notes as Note[] | undefined || [];
      updatePluginData({ notes: [...existing, note] });
    }
  }

  function loadMap(map: { nodes: MindMapNode[] }) {
    pushUndo();
    setNodes(map.nodes);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function deleteMap(id: string) {
    persistMaps(savedMaps.filter(m => m.id !== id));
  }

  const vbX = pan.x;
  const vbY = pan.y;
  const vbW = 700 / zoom;
  const vbH = 500 / zoom;

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-2">
          <GitBranch size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Mind Map Builder
        </div>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (selectedNode ? addNode() : setRootTopic())}
            placeholder={selectedNode ? 'Add child topic...' : 'Set main topic or select a node...'}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={selectedNode ? addNode : setRootTopic}>
            <Plus size={14} /> Add
          </button>
        </div>
        <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
          {selectedNode && selectedNode !== 'root' && (
            <button className="btn btn-sm btn-secondary" onClick={() => removeNode(selectedNode)}>
              <Trash2 size={14} /> Remove
            </button>
          )}
          <button className="btn btn-sm btn-secondary" onClick={undo} disabled={undoStack.length === 0}>
            <RotateCcw size={14} /> Undo
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setSelectedNode(null)}>
            Deselect
          </button>
          <button className="btn btn-sm btn-secondary" onClick={exportAsImage}>
            <Download size={14} /> PNG
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>
            Reset View
          </button>
        </div>

        {/* Layouts */}
        <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>
            Layout:
          </span>
          <button className="btn btn-sm btn-secondary" onClick={() => {
            pushUndo();
            // Tree layout - root at top, levels going down
            const root = nodes.find(n => n.id === 'root');
            if (!root) return;
            const visited = new Set<string>();
            const levels: string[][] = [];
            function bfs(ids: string[], depth: number) {
              if (ids.length === 0) return;
              levels[depth] = ids;
              const next: string[] = [];
              ids.forEach(id => {
                visited.add(id);
                const node = nodes.find(n => n.id === id);
                node?.children.forEach(c => { if (!visited.has(c)) next.push(c); });
              });
              bfs(next, depth + 1);
            }
            bfs(['root'], 0);
            const updated = nodes.map(n => {
              for (let d = 0; d < levels.length; d++) {
                const idx = levels[d].indexOf(n.id);
                if (idx >= 0) {
                  const count = levels[d].length;
                  const spacing = 700 / (count + 1);
                  return { ...n, x: spacing * (idx + 1), y: 50 + d * 100 };
                }
              }
              return n;
            });
            setNodes(updated);
          }}>
            Tree
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => {
            pushUndo();
            // Radial layout - root at center, children in circles
            const root = nodes.find(n => n.id === 'root');
            if (!root) return;
            const visited = new Set<string>();
            const levels: string[][] = [];
            function bfs2(ids: string[], depth: number) {
              if (ids.length === 0) return;
              levels[depth] = ids;
              const next: string[] = [];
              ids.forEach(id => {
                visited.add(id);
                const node = nodes.find(n => n.id === id);
                node?.children.forEach(c => { if (!visited.has(c)) next.push(c); });
              });
              bfs2(next, depth + 1);
            }
            bfs2(['root'], 0);
            const cx = 350, cy = 250;
            const updated = nodes.map(n => {
              if (n.id === 'root') return { ...n, x: cx, y: cy };
              for (let d = 1; d < levels.length; d++) {
                const idx = levels[d].indexOf(n.id);
                if (idx >= 0) {
                  const count = levels[d].length;
                  const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
                  const radius = 80 + d * 90;
                  return { ...n, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
                }
              }
              return n;
            });
            setNodes(updated);
          }}>
            Radial
          </button>

          {/* Node color picker (when node selected) */}
          {selectedNode && (
            <>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center', marginLeft: 8 }}>
                Color:
              </span>
              {nodeColors.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    pushUndo();
                    setNodes(prev => prev.map(n => n.id === selectedNode ? { ...n, color: c } : n));
                  }}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', border: nodes.find(n => n.id === selectedNode)?.color === c ? '2px solid var(--text-primary)' : '1px solid var(--border)',
                    background: c, cursor: 'pointer', padding: 0,
                  }}
                />
              ))}
            </>
          )}
        </div>

        {/* Templates */}
        <div className="flex gap-2 mb-2" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', alignSelf: 'center' }}>
            Templates:
          </span>
          {[
            {
              name: 'Pros / Cons',
              build: (): MindMapNode[] => [
                { id: 'root', text: 'Decision', x: 350, y: 100, children: ['pro', 'con'], color: 'var(--accent)' },
                { id: 'pro', text: 'Pros', x: 200, y: 220, children: ['p1', 'p2', 'p3'], color: 'var(--green)' },
                { id: 'con', text: 'Cons', x: 500, y: 220, children: ['c1', 'c2', 'c3'], color: 'var(--red)' },
                { id: 'p1', text: 'Pro 1', x: 120, y: 340, children: [], color: 'var(--green)' },
                { id: 'p2', text: 'Pro 2', x: 200, y: 340, children: [], color: 'var(--green)' },
                { id: 'p3', text: 'Pro 3', x: 280, y: 340, children: [], color: 'var(--green)' },
                { id: 'c1', text: 'Con 1', x: 420, y: 340, children: [], color: 'var(--red)' },
                { id: 'c2', text: 'Con 2', x: 500, y: 340, children: [], color: 'var(--red)' },
                { id: 'c3', text: 'Con 3', x: 580, y: 340, children: [], color: 'var(--red)' },
              ],
            },
            {
              name: 'SWOT',
              build: (): MindMapNode[] => [
                { id: 'root', text: 'SWOT Analysis', x: 350, y: 250, children: ['s', 'w', 'o', 't'], color: 'var(--accent)' },
                { id: 's', text: 'Strengths', x: 175, y: 120, children: [], color: 'var(--green)' },
                { id: 'w', text: 'Weaknesses', x: 525, y: 120, children: [], color: 'var(--red)' },
                { id: 'o', text: 'Opportunities', x: 175, y: 380, children: [], color: 'var(--blue)' },
                { id: 't', text: 'Threats', x: 525, y: 380, children: [], color: 'var(--orange)' },
              ],
            },
            {
              name: 'Project Plan',
              build: (): MindMapNode[] => [
                { id: 'root', text: 'Project', x: 100, y: 250, children: ['plan', 'exec', 'review'], color: 'var(--accent)' },
                { id: 'plan', text: 'Planning', x: 260, y: 120, children: ['goals', 'timeline'], color: 'var(--blue)' },
                { id: 'exec', text: 'Execution', x: 420, y: 250, children: ['tasks', 'team'], color: 'var(--green)' },
                { id: 'review', text: 'Review', x: 260, y: 380, children: ['metrics', 'lessons'], color: 'var(--yellow)' },
                { id: 'goals', text: 'Goals', x: 200, y: 50, children: [], color: 'var(--blue)' },
                { id: 'timeline', text: 'Timeline', x: 340, y: 50, children: [], color: 'var(--blue)' },
                { id: 'tasks', text: 'Tasks', x: 520, y: 170, children: [], color: 'var(--green)' },
                { id: 'team', text: 'Team', x: 520, y: 330, children: [], color: 'var(--green)' },
                { id: 'metrics', text: 'Metrics', x: 200, y: 450, children: [], color: 'var(--yellow)' },
                { id: 'lessons', text: 'Lessons', x: 340, y: 450, children: [], color: 'var(--yellow)' },
              ],
            },
          ].map(tpl => (
            <button key={tpl.name} className="btn btn-sm btn-secondary" onClick={() => {
              pushUndo();
              setNodes(tpl.build());
              setSelectedNode(null);
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}>
              {tpl.name}
            </button>
          ))}
        </div>

        {/* Save/Load */}
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <input type="text" value={mapName} onChange={e => setMapName(e.target.value)}
            placeholder="Map name..." style={{ ...inputStyle, flex: 1, fontSize: 11, padding: '6px 10px' }}
            onKeyDown={e => e.key === 'Enter' && saveMap()} />
          <button className="btn btn-sm" onClick={saveMap}>
            <Save size={13} /> Save
          </button>
        </div>

        {savedMaps.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 4, textTransform: 'uppercase' }}>Saved Maps</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {savedMaps.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button className="cx-chip" onClick={() => loadMap(m)}>{m.name} ({m.nodes.length})</button>
                  <button onClick={() => deleteMap(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SVG Mind Map Canvas */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="500"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={() => setSelectedNode(null)}
          onWheel={handleWheel}
          style={{ background: 'var(--bg-primary)', cursor: dragging ? 'grabbing' : 'default' }}
        >
          {/* Connection lines */}
          {nodes.map(node =>
            node.children.map(childId => {
              const child = nodes.find(n => n.id === childId);
              if (!child) return null;
              return (
                <line
                  key={`${node.id}-${childId}`}
                  x1={node.x}
                  y1={node.y}
                  x2={child.x}
                  y2={child.y}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={2}
                  strokeDasharray={node.id === 'root' ? 'none' : '4 4'}
                />
              );
            })
          )}

          {/* Nodes */}
          {nodes.map(node => {
            const isSelected = node.id === selectedNode;
            const isRoot = node.id === 'root';
            const rx = isRoot ? 60 : 50;
            const ry = isRoot ? 30 : 22;

            return (
              <g
                key={node.id}
                onMouseDown={(e) => handleMouseDown(node.id, e)}
                onDoubleClick={(e) => { e.stopPropagation(); startEditing(node.id); }}
                onClick={(e) => { e.stopPropagation(); setSelectedNode(node.id); }}
                style={{ cursor: dragging === node.id ? 'grabbing' : 'grab' }}
              >
                <ellipse
                  cx={node.x}
                  cy={node.y}
                  rx={rx}
                  ry={ry}
                  fill={isSelected ? 'var(--accent-glow)' : 'var(--bg-card)'}
                  stroke={isSelected ? 'var(--accent)' : node.color}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                {editingNode === node.id ? (
                  <foreignObject x={node.x - 45} y={node.y - 12} width={90} height={24}>
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onBlur={finishEditing}
                      onKeyDown={(e) => e.key === 'Enter' && finishEditing()}
                      autoFocus
                      style={{
                        width: '100%', background: 'transparent', border: 'none',
                        color: 'var(--text-primary)', fontSize: 11, textAlign: 'center',
                        outline: 'none', fontWeight: 600,
                      }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={node.x}
                    y={node.y + 4}
                    textAnchor="middle"
                    fill="var(--text-primary)"
                    fontSize={isRoot ? 13 : 11}
                    fontWeight={isRoot ? 700 : 500}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.text.length > 14 ? node.text.slice(0, 12) + '...' : node.text}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Click to select | Double-click to edit | Drag to move | Scroll to zoom</span>
          <span>{nodes.length} nodes | {Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

export default function MindMapToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Mind Map">
      <MindMapTool />
    </ToolErrorBoundary>
  );
}
