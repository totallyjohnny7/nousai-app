/**
 * Drawing Studio — powered by Excalidraw
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import {
  Plus, ChevronLeft, ChevronRight, X, Edit3, Image,
  Search, FolderOpen, FileText, Grid,
  LayoutGrid, Download, Copy, Filter, Minus, BookOpen,
  Save, Trash2, Check,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import type { Drawing } from '../types';
import RichTextEditor from '../components/RichTextEditor';

/* ── Types ──────────────────────────────────────────── */
type TemplateName = 'blank' | 'cornell' | 'grid' | 'dotgrid' | 'lined';

/* ── Constants ──────────────────────────────────────── */
const TEMPLATES: { id: TemplateName; label: string; icon: typeof FileText }[] = [
  { id: 'blank', label: 'Blank', icon: FileText },
  { id: 'cornell', label: 'Cornell Notes', icon: LayoutGrid },
  { id: 'grid', label: 'Grid', icon: Grid },
  { id: 'dotgrid', label: 'Dot Grid', icon: Grid },
  { id: 'lined', label: 'Lined', icon: Minus },
];

/* ── Helpers ────────────────────────────────────────── */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Toast Component ────────────────────────────────── */
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#222', color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Check size={14} style={{ color: '#4caf50' }} />
      {message}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#aaa', marginLeft: 4 }}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */
export default function DrawPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { loaded, data, setData, updatePluginData } = useStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [view, setView] = useState<'browser' | 'canvas' | 'typed'>('browser');
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Browser filters
  const [searchQuery, setSearchQuery] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [showNewDrawingPopup, setShowNewDrawingPopup] = useState(false);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [newDrawingTemplate, setNewDrawingTemplate] = useState<TemplateName>('blank');
  const [newDrawingFolder, setNewDrawingFolder] = useState('General');

  // Load drawings from store
  useEffect(() => {
    if (data?.pluginData) {
      const stored = data.pluginData.drawings as Drawing[] | undefined;
      if (stored && Array.isArray(stored)) {
        setDrawings(stored);
      }
    }
  }, [data]);


  // Persist drawings to store (uses functional updater to prevent stale data overwrites)
  const persistDrawings = useCallback((updated: Drawing[]) => {
    setDrawings(updated);
    setData(prev => ({ ...prev, pluginData: { ...prev.pluginData, drawings: updated } }));
  }, [setData]);

  // Get unique folders from drawings
  const folders = useMemo(() => {
    const set = new Set<string>();
    set.add('General');
    drawings.forEach(d => { if (d.folder) set.add(d.folder); });
    return Array.from(set);
  }, [drawings]);

  // Filtered drawings
  const filteredDrawings = useMemo(() => {
    let list = [...drawings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    if (folderFilter !== 'all') {
      list = list.filter(d => (d.folder || 'General') === folderFilter);
    }
    if (templateFilter !== 'all') {
      list = list.filter(d => (d.template || 'blank') === templateFilter);
    }
    return list;
  }, [drawings, searchQuery, folderFilter, templateFilter]);

  function createDrawing(name?: string, template?: TemplateName, folder?: string) {
    const now = new Date().toISOString();
    const drawing: Drawing = {
      id: generateId(),
      name: name || 'Untitled Drawing',
      data: '',
      createdAt: now,
      updatedAt: now,
      width: 1200,
      height: 800,
      folder: folder || 'General',
      template: template || 'blank',
    };
    persistDrawings([drawing, ...drawings]);
    setActiveDrawingId(drawing.id);
    setView('canvas');
    setShowNewDrawingPopup(false);
    setNewDrawingName('');
  }

  function openDrawing(id: string) {
    setActiveDrawingId(id);
    setView('canvas');
  }

  function deleteDrawing(id: string) {
    if (!confirm('Delete this drawing?')) return;
    persistDrawings(drawings.filter(d => d.id !== id));
    if (activeDrawingId === id) {
      setActiveDrawingId(null);
      setView('browser');
    }
  }

  function duplicateDrawing(id: string) {
    const src = drawings.find(d => d.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    const copy: Drawing = {
      ...src,
      id: generateId(),
      name: src.name + ' (Copy)',
      createdAt: now,
      updatedAt: now,
    };
    persistDrawings([copy, ...drawings]);
    setToast('Drawing duplicated');
  }

  function saveDrawingData(id: string, data: string, thumbnail?: string) {
    const updated = drawings.map(d =>
      d.id === id ? { ...d, data, thumbnail, updatedAt: new Date().toISOString() } : d
    );
    persistDrawings(updated);
  }

  function renameDrawing(id: string, name: string) {
    const updated = drawings.map(d =>
      d.id === id ? { ...d, name, updatedAt: new Date().toISOString() } : d
    );
    persistDrawings(updated);
  }

  const activeDrawing = drawings.find(d => d.id === activeDrawingId) || null;

  if (!loaded && !embedded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading drawings...</div>
      </div>
    );
  }

  if (view === 'canvas' && activeDrawing) {
    return (
      <ExcalidrawEditor
        drawing={activeDrawing}
        onSave={(drawingData, thumbnail) => saveDrawingData(activeDrawing.id, drawingData, thumbnail)}
        onRename={(name) => renameDrawing(activeDrawing.id, name)}
        onBack={() => setView('browser')}
        showToast={(msg) => setToast(msg)}
      />
    );
  }

  // ─── Typed Note View ──────────────────────────────────
  if (view === 'typed') {
    return <TypedNoteEditor onBack={() => setView('browser')} data={data} setData={setData} showToast={(msg: string) => setToast(msg)} toast={toast} setToast={setToast} />;
  }

  // ─── Browser View ─────────────────────────────────────
  return (
    <div className={embedded ? '' : 'animate-in'}>
      {/* Header */}
      {!embedded && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Notes & Drawings</h1>
            <p className="page-subtitle" style={{ margin: '4px 0 0' }}>{drawings.length} drawing{drawings.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setView('typed')}>
              <FileText size={14} /> Typed Note
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowNewDrawingPopup(true)}>
              <Plus size={14} /> New Drawing
            </button>
          </div>
        </div>
      )}

      {/* Action bar when embedded */}
      {embedded && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setView('typed')}>
            <FileText size={14} /> Typed Note
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => setShowNewDrawingPopup(true)}>
            <Plus size={14} /> New Drawing
          </button>
        </div>
      )}

      {/* Cornell Notes Quick Access */}
      {!embedded && (() => {
        const raw = localStorage.getItem('nousai-cornell-notes');
        const count = raw ? (JSON.parse(raw) as unknown[]).length : 0;
        return (
          <button
            onClick={() => navigate('/library?tab=study')}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', marginBottom: 12, borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-primary)',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <BookOpen size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Cornell Notes</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {count > 0 ? `${count} note${count !== 1 ? 's' : ''} — tap to view & edit` : 'Create structured study notes'}
              </div>
            </div>
            <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-dim)' }} />
          </button>
        );
      })()}

      {/* Search & Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 200,
          background: 'var(--bg-input, #1a1a1a)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '6px 10px',
        }}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search drawings..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)',
              fontSize: 13, width: '100%', fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Template filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Filter size={13} style={{ color: 'var(--text-muted)' }} />
          <select
            value={templateFilter}
            onChange={e => setTemplateFilter(e.target.value)}
            style={{
              background: 'var(--bg-input, #1a1a1a)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)',
              fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="all">All Templates</option>
            {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Export All */}
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => {
            if (drawings.length === 0) { setToast('No drawings to export'); return; }
            let exported = 0;
            drawings.forEach(d => {
              const src = d.thumbnail || (d.data?.startsWith('data:') ? d.data : null);
              if (!src) return;
              const a = document.createElement('a');
              a.href = src;
              a.download = `${d.name.replace(/[^a-z0-9]/gi, '_')}.png`;
              a.click();
              exported++;
            });
            setToast(`Exported ${exported} drawing${exported !== 1 ? 's' : ''} as PNG`);
          }}
        >
          <Download size={13} /> Export All
        </button>
      </div>

      {/* Folder Chips */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFolderFilter('all')}
          style={{
            padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
            border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
            background: folderFilter === 'all' ? 'var(--accent, #444)' : 'var(--bg-secondary, #1a1a1a)',
            color: folderFilter === 'all' ? '#fff' : 'var(--text-secondary)',
          }}
        >
          All ({drawings.length})
        </button>
        {folders.map(f => {
          const count = drawings.filter(d => (d.folder || 'General') === f).length;
          return (
            <button
              key={f}
              onClick={() => setFolderFilter(f)}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit',
                background: folderFilter === f ? 'var(--accent, #444)' : 'var(--bg-secondary, #1a1a1a)',
                color: folderFilter === f ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <FolderOpen size={11} /> {f} ({count})
            </button>
          );
        })}
      </div>

      {/* New Drawing Popup */}
      {showNewDrawingPopup && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={() => setShowNewDrawingPopup(false)}>
          <div
            style={{
              background: 'var(--bg-primary, #111)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 440,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              New Drawing
            </h3>

            {/* Name */}
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Name</label>
            <input
              type="text"
              placeholder="Untitled Drawing"
              value={newDrawingName}
              onChange={e => setNewDrawingName(e.target.value)}
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--bg-input, #1a1a1a)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                marginBottom: 12, boxSizing: 'border-box',
              }}
              onKeyDown={e => { if (e.key === 'Enter') createDrawing(newDrawingName || undefined, newDrawingTemplate, newDrawingFolder); }}
            />

            {/* Folder */}
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Folder</label>
            <input
              type="text"
              placeholder="General"
              value={newDrawingFolder}
              onChange={e => setNewDrawingFolder(e.target.value)}
              style={{
                width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--bg-input, #1a1a1a)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                marginBottom: 12, boxSizing: 'border-box',
              }}
            />

            {/* Template selection */}
            <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, display: 'block' }}>Template</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setNewDrawingTemplate(t.id)}
                  style={{
                    padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                    border: newDrawingTemplate === t.id ? '2px solid var(--accent, #666)' : '1px solid var(--border)',
                    background: newDrawingTemplate === t.id ? 'var(--bg-tertiary, #222)' : 'var(--bg-secondary, #1a1a1a)',
                    color: 'var(--text-primary)', fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    fontSize: 11, fontWeight: 500,
                  }}
                >
                  <t.icon size={20} style={{ color: newDrawingTemplate === t.id ? 'var(--accent, #888)' : 'var(--text-muted)' }} />
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-secondary" onClick={() => setShowNewDrawingPopup(false)}>Cancel</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => createDrawing(newDrawingName || undefined, newDrawingTemplate, newDrawingFolder)}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drawing Grid */}
      {filteredDrawings.length === 0 ? (
        <div className="empty-state">
          <Image />
          <h3>{drawings.length === 0 ? 'No drawings yet' : 'No drawings match your filters'}</h3>
          <p>{drawings.length === 0 ? 'Create a whiteboard to sketch ideas, diagrams, or study notes' : 'Try adjusting your search or filters'}</p>
          {drawings.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowNewDrawingPopup(true)}>
              <Plus size={14} /> Create Drawing
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filteredDrawings.map(drawing => (
            <div
              key={drawing.id}
              className="card"
              style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onClick={() => openDrawing(drawing.id)}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
            >
              {/* Thumbnail */}
              <div style={{
                width: '100%', height: 130, background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderBottom: '1px solid var(--border)', position: 'relative',
              }}>
                {(drawing.thumbnail || (drawing.data?.startsWith('data:') ? drawing.data : null)) ? (
                  <img
                    src={drawing.thumbnail || drawing.data}
                    alt={drawing.name}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Image size={32} style={{ color: '#ccc' }} />
                )}
                {/* Template badge */}
                {drawing.template && drawing.template !== 'blank' && (
                  <span style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    fontSize: 9, padding: '2px 6px', borderRadius: 4,
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    {drawing.template}
                  </span>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {drawing.name}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                  {drawing.folder && drawing.folder !== 'General' && (
                    <span style={{
                      fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      <FolderOpen size={10} /> {drawing.folder}
                    </span>
                  )}
                  <span className="text-xs text-muted">{formatDateShort(drawing.updatedAt)}</span>
                </div>
              </div>
              {/* Actions */}
              <div style={{ padding: '0 12px 10px', display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ flex: 1, fontSize: 11, padding: '4px 8px' }}
                  onClick={(e) => { e.stopPropagation(); openDrawing(drawing.id); }}
                >
                  <Edit3 size={11} /> Open
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={(e) => { e.stopPropagation(); duplicateDrawing(drawing.id); }}
                  title="Duplicate"
                >
                  <Copy size={11} />
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: 11, padding: '4px 8px', color: 'var(--red)' }}
                  onClick={(e) => { e.stopPropagation(); deleteDrawing(drawing.id); }}
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Excalidraw Editor ───────────────────────────────── */
function ExcalidrawEditor({
  drawing,
  onSave,
  onRename,
  onBack,
  showToast,
}: {
  drawing: Drawing;
  onSave: (data: string, thumbnail?: string) => void;
  onRename: (name: string) => void;
  onBack: () => void;
  showToast: (msg: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excalidrawAPIRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const elementsRef = useRef<readonly any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appStateRef = useRef<any>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filesRef = useRef<any>({});

  const [drawingName, setDrawingName] = useState(drawing.name);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Parse initial data — handle both new Excalidraw JSON format and legacy base64 format
  const initialData = useMemo(() => {
    if (!drawing.data) {
      return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true };
    }
    if (drawing.data.startsWith('data:')) {
      // Legacy base64 canvas format — can't load into Excalidraw, start fresh
      return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true };
    }
    try {
      const parsed = JSON.parse(drawing.data);
      return { ...parsed, scrollToContent: true };
    } catch {
      return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true };
    }
  }, [drawing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save: debounced persist on every canvas change (fixes drawings lost on reload)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  const doAutoSave = useCallback(() => {
    if (!elementsRef.current?.length) return;
    const snapshot = JSON.stringify({
      elements: Array.from(elementsRef.current),
      appState: { viewBackgroundColor: appStateRef.current?.viewBackgroundColor ?? '#ffffff' },
      files: filesRef.current ?? {},
    });
    onSave(snapshot, undefined); // thumbnail skipped for auto-save (perf)
    dirtyRef.current = false;
  }, [onSave]);

  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (elements: readonly any[], appState: any, files: any) => {
      elementsRef.current = elements;
      appStateRef.current = appState;
      filesRef.current = files;
      dirtyRef.current = true;
      // Debounced auto-save: 2 seconds after last change
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(doAutoSave, 2000);
    },
    [doAutoSave]
  );

  // Save on unmount (back navigation, page close) if dirty
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (dirtyRef.current && elementsRef.current?.length) {
        // Sync save on unmount — must be synchronous-ish
        const snapshot = JSON.stringify({
          elements: Array.from(elementsRef.current),
          appState: { viewBackgroundColor: appStateRef.current?.viewBackgroundColor ?? '#ffffff' },
          files: filesRef.current ?? {},
        });
        onSave(snapshot, undefined);
      }
    };
  }, [onSave]);

  async function handleSave() {
    setIsSaving(true);
    try {
      const snapshot = JSON.stringify({
        elements: Array.from(elementsRef.current),
        appState: {
          viewBackgroundColor: appStateRef.current?.viewBackgroundColor ?? '#ffffff',
        },
        files: filesRef.current ?? {},
      });

      // Generate thumbnail for browser card preview
      // Filter out erased/deleted elements so thumbnail matches what the user sees
      const thumbElements = elementsRef.current.filter((el: { isDeleted?: boolean }) => !el.isDeleted);
      let thumbnail: string | undefined;
      try {
        const blob = await exportToBlob({
          elements: thumbElements,
          appState: { ...appStateRef.current, exportWithDarkMode: false },
          files: filesRef.current,
          mimeType: 'image/png',
          maxWidthOrHeight: 400,
        });
        thumbnail = await blobToDataURL(blob);
      } catch {
        // Thumbnail is optional — continue without it
      }

      onSave(snapshot, thumbnail);
      showToast('Drawing saved');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleExportPng() {
    try {
      // Filter out erased/deleted elements so export matches what the user sees
      const visibleElements = elementsRef.current.filter((el: { isDeleted?: boolean }) => !el.isDeleted);
      const blob = await exportToBlob({
        elements: visibleElements,
        appState: appStateRef.current,
        files: filesRef.current,
        mimeType: 'image/png',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${drawingName}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Export failed');
    }
  }

  function commitRename() {
    const trimmed = drawingName.trim();
    if (trimmed) onRename(trimmed);
    setIsRenaming(false);
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary, #111)' }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary, #111)', flexShrink: 0, zIndex: 10,
        minHeight: 44,
      }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={onBack}
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          <ChevronLeft size={13} /> Back
        </button>

        {/* Drawing name */}
        {isRenaming ? (
          <input
            autoFocus
            value={drawingName}
            onChange={e => setDrawingName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setDrawingName(drawing.name); setIsRenaming(false); } }}
            style={{
              fontSize: 14, fontWeight: 600, background: 'var(--bg-input, #1a1a1a)',
              border: '1px solid var(--accent)', borderRadius: 4, padding: '3px 8px',
              color: 'var(--text-primary)', fontFamily: 'inherit', minWidth: 180,
            }}
          />
        ) : (
          <button
            onClick={() => setIsRenaming(true)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
              fontFamily: 'inherit', padding: '3px 6px', borderRadius: 4,
            }}
            title="Click to rename"
          >
            {drawingName}
          </button>
        )}

        {drawing.template && drawing.template !== 'blank' && (
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            background: 'var(--bg-tertiary, #222)', color: 'var(--text-muted)',
            fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
          }}>
            {drawing.template}
          </span>
        )}

        <div style={{ flex: 1 }} />

        <button
          className="btn btn-sm btn-secondary"
          onClick={handleExportPng}
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          <Download size={13} /> Export PNG
        </button>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleSave}
          disabled={isSaving}
          style={{ padding: '4px 12px', fontSize: 12 }}
        >
          <Save size={13} /> {isSaving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Excalidraw canvas — takes remaining height */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', touchAction: 'none' }}>
        {drawing.data?.startsWith('data:') && (
          <div style={{
            position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.75)', color: '#fff', fontSize: 12,
            padding: '6px 14px', borderRadius: 6, zIndex: 100, pointerEvents: 'none',
          }}>
            Legacy drawing — canvas reset to blank (original preserved until re-saved)
          </div>
        )}
        <Excalidraw
          key={drawing.id}
          initialData={initialData}
          onChange={handleChange}
          excalidrawAPI={(api) => { excalidrawAPIRef.current = api; }}
        />
      </div>
    </div>,
    document.body,
  );
}

/* ── Typed Note Editor ───────────────────────────────── */
function TypedNoteEditor({
  onBack, data, setData, showToast, toast, setToast,
}: {
  onBack: () => void;
  data: import('../types').NousAIData | null;
  setData: (d: import('../types').NousAIData) => void;
  showToast: (msg: string) => void;
  toast: string | null;
  setToast: (msg: string | null) => void;
}) {
  const { updatePluginData } = useStore();
  const [title, setTitle] = useState('Untitled Note');
  const [saved, setSaved] = useState(false);
  const contentRef = useRef('');

  const saveNote = useCallback(() => {
    if (!data || !contentRef.current.trim()) return;
    const note: import('../types').Note = {
      id: generateId(),
      title: title.trim() || 'Untitled Note',
      content: contentRef.current,
      folder: 'Typed Notes',
      tags: ['typed-note', 'rich-text'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'note',
    };
    const notes = [...(data.pluginData?.notes || []), note];
    updatePluginData({ notes });
    setSaved(true);
    showToast('Note saved to Library');
  }, [data, updatePluginData, title, showToast]);

  const handleContentChange = useCallback((html: string) => {
    contentRef.current = html;
    setSaved(false);
  }, []);

  const handleSave = useCallback((html: string) => {
    contentRef.current = html;
    saveNote();
  }, [saveNote]);

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-sm" onClick={onBack}>
          <ChevronLeft size={13} /> Back
        </button>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setSaved(false); }}
          placeholder="Note title..."
          style={{ flex: 1, fontSize: 16, fontWeight: 700, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, paddingLeft: 0 }}
        />
        <button className="btn btn-sm btn-primary" onClick={saveNote} disabled={saved}>
          <Save size={13} /> {saved ? 'Saved' : 'Save'}
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <RichTextEditor
          onSave={handleSave}
          onContentChange={handleContentChange}
          placeholder="Start typing your note... Use the toolbar above for formatting."
        />
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
