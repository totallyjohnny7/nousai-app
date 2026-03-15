import { useRef, useCallback, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import type { SimClass } from './types';

interface SimCanvasProps {
  sim: SimClass;
  params: Record<string, number>;
  running: boolean;
  onToggleRun: () => void;
  onReset: () => void;
}

export function SimCanvas({ sim, params, running, onToggleRun, onReset }: SimCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const stateRef = useRef<any>(null);
  const simRef = useRef(sim);
  const paramsRef = useRef(params);
  simRef.current = sim;
  paramsRef.current = params;

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    const s = stateRef.current;
    if (!s) return;

    // Background
    ctx.fillStyle = '#0f0f23';
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Sim draw
    simRef.current.draw(ctx, s, paramsRef.current, w, h);

    // Stat bar
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(simRef.current.statLine(s, paramsRef.current), 10, 20);
  }, []);

  const resetSim = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (!canvas) return;
    stateRef.current = simRef.current.init(canvas.width, canvas.height, paramsRef.current);
    drawFrame();
  }, [drawFrame]);

  // Init on mount / sim change
  useEffect(() => {
    resetSim();
    return () => cancelAnimationFrame(animRef.current);
  }, [sim, resetSim]);

  // Animation loop
  useEffect(() => {
    if (!running) {
      cancelAnimationFrame(animRef.current);
      return;
    }
    const loop = () => {
      const s = stateRef.current;
      if (!s) return;
      simRef.current.update(s, paramsRef.current, 0.03, canvasRef.current?.width ?? 700, canvasRef.current?.height ?? 360);
      drawFrame();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [running, drawFrame]);

  // Redraw on param change (static frame)
  useEffect(() => {
    if (!running) drawFrame();
  }, [params, running, drawFrame]);

  function handleReset() {
    resetSim();
    onReset();
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button className={`btn btn-sm ${running ? 'btn-secondary' : 'btn-primary'}`} onClick={onToggleRun} style={{ flex: 1 }}>
          {running ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={handleReset}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={360}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      </div>
    </div>
  );
}
