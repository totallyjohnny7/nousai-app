import { useState, useEffect, useRef } from 'react';
import { Link, Plus, Upload, Download, Trash2, X } from 'lucide-react';
import type { Course, LinkItem } from '../../types';
import { generateId } from '../../components/course/courseHelpers';
import { saveFile, loadFile, deleteFile, migrateFromLocalStorage } from '../../utils/fileStore';
import { FileViewerModal } from '../../components/FileViewerModal';

function getFileIcon(fileType?: string): string {
  if (!fileType) return '🔗';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return '📊';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
  if (fileType.startsWith('video/')) return '🎬';
  if (fileType.startsWith('audio/')) return '🎵';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar')) return '📦';
  if (fileType.includes('text/') || fileType.includes('json') || fileType.includes('xml')) return '📃';
  return '📎';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export default function LinksTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const storageKey = `nousai-course-${course.id}-links`;
  const [links, setLinks] = useState<LinkItem[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAddLink, setShowAddLink] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [previewItem, setPreviewItem] = useState<LinkItem | null>(null);
  const [viewerItem, setViewerItem] = useState<LinkItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'link' | 'file'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save links metadata to localStorage (small), file data to IndexedDB (large)
  const saveLinksRef = useRef(links);
  saveLinksRef.current = links;
  useEffect(() => {
    const linksForStorage = links.map(l => l.type === 'file' ? { ...l, dataUrl: undefined } : l);
    try { localStorage.setItem(storageKey, JSON.stringify(linksForStorage)); } catch (e) { console.warn('[LinksTab] localStorage save failed:', e); }
    // Store file data in IndexedDB (no quota issues)
    links.forEach(l => {
      if (l.type === 'file' && l.dataUrl) {
        saveFile(`${storageKey}-file-${l.id}`, l.dataUrl);
      }
    });
  }, [links, storageKey]);

  // Load file data from IndexedDB on mount (+ migrate old localStorage data)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // One-time migration from localStorage to IndexedDB
      await migrateFromLocalStorage(storageKey);
      // Load each file's data from IndexedDB
      const prev = saveLinksRef.current;
      const updated = await Promise.all(prev.map(async l => {
        if (l.type === 'file' && !l.dataUrl) {
          const data = await loadFile(`${storageKey}-file-${l.id}`);
          if (data) return { ...l, dataUrl: data };
        }
        return l;
      }));
      if (!cancelled) setLinks(updated);
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  const addLink = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const url = newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`;
    setLinks(prev => [...prev, { id: generateId(), name: newName.trim(), url, type: 'link' }]);
    setNewName(''); setNewUrl(''); setShowAddLink(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLinks(prev => [...prev, {
          id: generateId(),
          name: file.name,
          url: file.name,
          type: 'file',
          fileType: file.type,
          fileSize: file.size,
          dataUrl,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeItem = (id: string) => {
    deleteFile(`${storageKey}-file-${id}`);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const openFile = (item: LinkItem) => {
    if (item.type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else if (item.dataUrl) {
      setViewerItem(item)
    }
  };

  const filtered = filterType === 'all' ? links : links.filter(l => l.type === filterType);
  const fileCount = links.filter(l => l.type === 'file').length;
  const linkCount = links.filter(l => l.type === 'link').length;

  return (
    <div>
      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          courseId={course.id}
          accentColor={accentColor}
          onClose={() => setViewerItem(null)}
        />
      )}
      {/* Preview modal */}
      {previewItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPreviewItem(null)}>
          <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 8 }}>
            <a href={previewItem.dataUrl} download={previewItem.name}
              onClick={e => e.stopPropagation()}
              style={{ padding: '6px 14px', borderRadius: 6, background: accentColor, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Download
            </a>
            <button onClick={() => setPreviewItem(null)}
              style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>{previewItem.name}</div>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
            {previewItem.fileType?.startsWith('image/') && (
              <img src={previewItem.dataUrl} alt={previewItem.name} style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: 8 }} />
            )}
            {previewItem.fileType === 'application/pdf' && (
              <iframe src={previewItem.dataUrl} title={previewItem.name} style={{ width: '80vw', height: '80vh', border: 'none', borderRadius: 8 }} />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <Link size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Links & Files
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Upload size={12} /> Upload File
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddLink(!showAddLink)}>
            <Plus size={13} /> Add Link
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rar,.mp3,.mp4,.wav" />
      </div>

      {/* Add link form */}
      {showAddLink && (
        <div className="card mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Link name" style={{ fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." style={{ fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={addLink}>Save</button>
              <button className="btn btn-sm" onClick={() => setShowAddLink(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {links.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['all', 'link', 'file'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
              background: filterType === f ? accentColor : 'var(--bg-card)', color: filterType === f ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {f === 'all' ? `All (${links.length})` : f === 'link' ? `Links (${linkCount})` : `Files (${fileCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      {filtered.length === 0 && links.length === 0 ? (
        <div className="empty-state">
          <Link size={40} />
          <h3>No links or files</h3>
          <p>Add links to external resources, or upload files like PDFs, images, documents, and more.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 13 }}>
          No {filterType === 'link' ? 'links' : 'files'} yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }} onClick={() => openFile(l)}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {l.type === 'link' ? '🔗' : getFileIcon(l.fileType)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.type === 'link' ? l.url : `${l.fileType?.split('/')[1]?.toUpperCase() || 'FILE'} • ${formatFileSize(l.fileSize)}`}
                </div>
              </div>
              {l.type === 'link' && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: accentColor, fontWeight: 600 }}>LINK</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeItem(l.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
