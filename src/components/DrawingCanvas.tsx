/**
 * DrawingCanvas — Reusable canvas for handwriting input.
 *
 * Supports pen pressure, palm rejection, touch/mouse drawing.
 * Dark background with subtle grid lines for character practice.
 *
 * Usage:
 *   const canvasRef = useRef<HTMLCanvasElement>(null);
 *   <DrawingCanvas canvasRef={canvasRef} onStroke={() => setHasStrokes(true)} />
 *   // To clear: call DrawingCanvas.clear(canvasRef)
 */
import { useCallback, useRef, useEffect, type RefObject } from 'react';

interface DrawingCanvasProps {
  width?: number;
  height?: number;
  onStroke?: () => void;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  disabled?: boolean;
}

const DEFAULT_W = 360;
const DEFAULT_H = 360;
const BG_COLOR = '#1a1a2e';
const STROKE_COLOR = '#ffffff';
const GRID_COLOR = 'rgba(255,255,255,0.06)';

/** Clear the canvas to its default background + grid */
export function clearCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  w?: number,
  h?: number,
) {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const cw = w ?? canvas.width;
  const ch = h ?? canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, cw, ch);

  // Draw subtle 田 grid
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();
  // Vertical center
  ctx.moveTo(cw / 2, 0);
  ctx.lineTo(cw / 2, ch);
  // Horizontal center
  ctx.moveTo(0, ch / 2);
  ctx.lineTo(cw, ch / 2);
  // Border
  ctx.rect(1, 1, cw - 2, ch - 2);
  ctx.stroke();
}

export default function DrawingCanvas({
  width = DEFAULT_W,
  height = DEFAULT_H,
  onStroke,
  canvasRef,
  disabled = false,
}: DrawingCanvasProps) {
  const isDrawingRef = useRef(false);

  // Initialize canvas on mount / size change
  useEffect(() => {
    clearCanvas(canvasRef, width, height);
  }, [canvasRef, width, height]);

  const getPos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (width / rect.width),
        y: (e.clientY - rect.top) * (height / rect.height),
      };
    },
    [canvasRef, width, height],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Palm rejection: ignore touch if pen was used recently
      const canvasAny = canvas as HTMLCanvasElement & { _lastPen?: number };
      if (
        e.pointerType === 'touch' &&
        canvasAny._lastPen &&
        Date.now() - canvasAny._lastPen < 2000
      )
        return;
      if (e.pointerType === 'pen') canvasAny._lastPen = Date.now();

      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;
      onStroke?.();

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      const pressure =
        e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;

      ctx.strokeStyle = STROKE_COLOR;
      ctx.lineWidth = 3 * (0.5 + pressure);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [canvasRef, disabled, getPos, onStroke],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const { x, y } = getPos(e);
      const pressure =
        e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
      ctx.lineWidth = 3 * (0.5 + pressure);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    },
    [canvasRef, getPos],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return;
      e.preventDefault();
      isDrawingRef.current = false;
    },
    [],
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        width: '100%',
        maxWidth: width,
        aspectRatio: `${width} / ${height}`,
        borderRadius: 12,
        border: '1px solid var(--border, #333)',
        cursor: disabled ? 'not-allowed' : 'crosshair',
        touchAction: 'none',
        display: 'block',
        background: BG_COLOR,
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}
