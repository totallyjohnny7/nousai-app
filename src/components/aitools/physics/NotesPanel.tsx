import { useState, useRef, useCallback, lazy, Suspense } from 'react';
import '@excalidraw/excalidraw/index.css';
import { useStore } from '../../../store';

const Excalidraw = lazy(() =>
  import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw }))
);

interface NotesPanelProps {
  open: boolean;
  onToggle: () => void;
  simName: string;
  narrowed: boolean;
}

export function NotesPanel({ open, onToggle, simName, narrowed }: NotesPanelProps) {
  const { data, setData } = useStore();
  const elementsRef = useRef<any[]>([]);
  const appStateRef = useRef<any>(null);
  const filesRef = useRef<any>(null);
  const [hasContent, setHasContent] = useState(false);

  const handleChange = useCallback((elements: readonly any[], appState: any, files: any) => {
    elementsRef.current = [...elements];
    appStateRef.current = appState;
    filesRef.current = files;
    setHasContent(elements.length > 0);
  }, []);

  const saveDrawing = useCallback(() => {
    if (elementsRef.current.length === 0) return;
    const name = `${simName} Notes — ${new Date().toLocaleDateString()}`;
    const drawingData = JSON.stringify({
      elements: elementsRef.current,
      appState: { ...appStateRef.current, collaborators: [] },
      files: filesRef.current,
    });

    setData(prev => {
      const drawings = [...(prev.pluginData.drawings || [])];
      // Check if a drawing with same name exists today — update it
      const existingIdx = drawings.findIndex(d => d.name === name);
      const now = new Date().toISOString();
      if (existingIdx >= 0) {
        drawings[existingIdx] = { ...drawings[existingIdx], data: drawingData, updatedAt: now };
      } else {
        drawings.push({
          id: `draw-${Date.now()}`,
          name,
          data: drawingData,
          createdAt: now,
          updatedAt: now,
          width: 700,
          height: 400,
        });
      }
      return { ...prev, pluginData: { ...prev.pluginData, drawings } };
    });
  }, [simName, setData]);

  const handleClose = useCallback(() => {
    if (hasContent) saveDrawing();
    onToggle();
  }, [hasContent, saveDrawing, onToggle]);

  const handleClear = useCallback(() => {
    if (confirm('Clear all notes? This cannot be undone.')) {
      elementsRef.current = [];
      setHasContent(false);
      // Force re-mount by toggling
      onToggle();
      setTimeout(onToggle, 50);
    }
  }, [onToggle]);

  const width = narrowed ? '30%' : '40%';

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={onToggle}
          style={{
            position: 'absolute', bottom: 16, right: 16, zIndex: 50,
            width: 44, height: 44, borderRadius: '50%',
            background: '#1a1a1a', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            transition: 'transform 0.2s',
          }}
          title="Open Notes"
        >
          📝
        </button>
      )}

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: open ? width : 0, minWidth: open ? 320 : 0,
        background: '#1a1a1a', zIndex: 200,
        transition: 'width 0.3s ease, min-width 0.3s ease',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: open ? '-4px 0 24px rgba(0,0,0,0.5)' : 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #333',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>📝 Notes</span>
          <div className="flex gap-2">
            <button
              onClick={() => saveDrawing()}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: 10, padding: '3px 8px' }}
            >
              Save
            </button>
            <button
              onClick={handleClear}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: 10, padding: '3px 8px' }}
            >
              Clear
            </button>
            <button
              onClick={handleClose}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, padding: 0 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Excalidraw */}
        <div style={{ flex: 1, position: 'relative' }}>
          {open && (
            <Suspense fallback={<div style={{ padding: 20, color: '#888', fontSize: 13 }}>Loading drawing canvas...</div>}>
              <Excalidraw
                onChange={handleChange}
                theme="dark"
                initialData={{
                  appState: { viewBackgroundColor: '#1a1a1a' },
                }}
              />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
