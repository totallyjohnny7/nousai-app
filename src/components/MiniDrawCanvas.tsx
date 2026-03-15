/**
 * MiniDrawCanvas — Lightweight drawing canvas for quiz annotations.
 * Tools: pen, highlighter, eraser. Undo stack (10 levels). Clear.
 * Fires onChange(dataUrl) on every pointer-up (stroke end).
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import { Undo2, Trash2 } from 'lucide-react';

export type DrawTool = 'pen' | 'highlighter' | 'eraser';

const PALETTE = ['#ffffff', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#c084fc', '#000000'];
const WIDTHS: Record<DrawTool, number[]> = {
  pen: [2, 4, 7],
  highlighter: [10, 18, 28],
  eraser: [14, 28, 48],
};

interface Props {
  initialData?: string | null;
  onChange: (dataUrl: string) => void;
}

export default function MiniDrawCanvas({ initialData, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const undoStack = useRef<string[]>([]);
  const [tool, setTool] = useState<DrawTool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [widthIdx, setWidthIdx] = useState(1);

  // Restore initial data on mount / when it changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (initialData) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = initialData;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [initialData]);

  const pushUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    undoStack.current = [...undoStack.current.slice(-9), canvas.toDataURL('image/jpeg', 0.7)];
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    pushUndo();

    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    const w = WIDTHS[tool][widthIdx];

    ctx.save();
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (tool === 'highlighter') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
    }
    ctx.lineWidth = w * (e.pressure > 0 && e.pressure < 1 ? 0.5 + e.pressure : 1);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    // Store ctx config on canvas element for move handler
    (canvasRef.current as any)._drawCtx = { tool, color, w };
  }, [tool, color, widthIdx, pushUndo]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const { x, y } = getPos(e);

    const pressure = e.pressure > 0 && e.pressure < 1 ? e.pressure : 0.5;
    const stored = (canvas as any)._drawCtx ?? {};
    const w = (stored.w ?? WIDTHS[tool][widthIdx]) * (0.5 + pressure);

    ctx.lineWidth = w;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [tool, widthIdx]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.restore();

    onChange(canvas.toDataURL('image/jpeg', 0.7));
  }, [onChange]);

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      onChange(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = prev;
  }, [onChange]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    pushUndo();
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    onChange(canvas.toDataURL('image/jpeg', 0.7));
  }, [pushUndo, onChange]);

  const btnBase: React.CSSProperties = {
    padding: '3px 7px', borderRadius: 5, border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-primary)',
    cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 600,
  };
  const btnActive: React.CSSProperties = {
    ...btnBase, background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        {(['pen', 'highlighter', 'eraser'] as DrawTool[]).map(t => (
          <button key={t} style={tool === t ? btnActive : btnBase} onClick={() => setTool(t)}>
            {t === 'pen' ? '✏️' : t === 'highlighter' ? '🖍️' : '⬜'} {t}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
        {/* Stroke width */}
        {[0, 1, 2].map(i => (
          <button
            key={i}
            style={widthIdx === i ? btnActive : btnBase}
            onClick={() => setWidthIdx(i)}
            title={`Size ${i + 1}`}
          >
            <span style={{
              display: 'inline-block',
              width: 6 + i * 4, height: 6 + i * 4,
              borderRadius: '50%',
              background: widthIdx === i ? '#fff' : 'var(--text-primary)',
            }} />
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
        {/* Undo / Clear */}
        <button style={btnBase} onClick={handleUndo} title="Undo (Ctrl+Z)"><Undo2 size={12} /></button>
        <button style={btnBase} onClick={handleClear} title="Clear canvas"><Trash2 size={12} /></button>
      </div>

      {/* Color palette (only for pen / highlighter) */}
      {tool !== 'eraser' && (
        <div style={{ display: 'flex', gap: 4 }}>
          {PALETTE.map(c => (
            <button
              key={c}
              title={c}
              onClick={() => setColor(c)}
              style={{
                width: 18, height: 18, borderRadius: 4, background: c,
                border: color === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={560}
        height={240}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{
          width: '100%',
          aspectRatio: '560 / 240',
          borderRadius: 8,
          background: '#1a1a2e',
          border: '1px solid var(--border)',
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
          touchAction: 'none',
          display: 'block',
        }}
      />
    </div>
  );
}
