/**
 * ScreenLasso — Windows Screen Region Capture → OCR → Notes
 *
 * Uses getDisplayMedia to capture one frame, overlays a polygon lasso,
 * OCRs the selection via Mistral, and lets user save the result.
 *
 * Platform: Chrome/Edge on Windows/macOS only (requires getDisplayMedia).
 * iPad/Boox/Firefox: shows unsupported message, never crashes.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store';


interface Props {
  isOpen: boolean;
  onClose: () => void;
  uid?: string;
}

type LassoState = 'idle' | 'capturing' | 'selecting' | 'processing' | 'done' | 'error';

interface Point { x: number; y: number; }

const supportsGetDisplayMedia =
  typeof navigator !== 'undefined' &&
  !!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices);

export default function ScreenLasso({ isOpen, onClose, uid }: Props) {
  const { data, updatePluginData } = useStore();
  const [state, setState] = useState<LassoState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [ocrResult, setOcrResult] = useState('');
  const [progress, setProgress] = useState(0);
  const [points, setPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const capturedImageRef = useRef<HTMLImageElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportsGetDisplayMedia) {
      setState('error');
      setErrorMsg('Screen capture is not available in this browser. Use Chrome or Edge on Windows/macOS.');
      return;
    }
    startCapture();
  }, [isOpen]);

  useEffect(() => {
    const handler = (e: Event) => {
      if (isOpen) setState('selecting');
    };
    window.addEventListener('nousai-screenlasso-trigger', handler);
    return () => window.removeEventListener('nousai-screenlasso-trigger', handler);
  }, [isOpen]);

  const startCapture = async () => {
    setState('capturing');
    let stream: MediaStream | null = null;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { cursor: 'always', width: { ideal: 1920 } },
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Draw one frame to offscreen canvas
      const offscreen = document.createElement('canvas');
      offscreen.width = video.videoWidth;
      offscreen.height = video.videoHeight;
      offscreen.getContext('2d')!.drawImage(video, 0, 0);

      // Stop stream immediately (minimize privacy exposure)
      stream!.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      video.srcObject = null;

      // Convert to data URL and show overlay
      const dataUrl = offscreen.toDataURL('image/png');
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        capturedImageRef.current = img;
        setState('selecting');
        // Draw background on overlay canvas
        requestAnimationFrame(() => drawOverlay([]));
      };
    } catch (e) {
      stream?.getTracks?.().forEach?.((t: MediaStreamTrack) => t.stop());
      setState('error');
      setErrorMsg(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Screen permission denied. Allow screen sharing in your browser settings, then try again.'
          : 'Could not capture screen. Try again.'
      );
    }
  };

  const drawOverlay = (pts: Point[]) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !capturedImageRef.current) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Background: captured screen
    ctx.drawImage(capturedImageRef.current, 0, 0, canvas.width, canvas.height);

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (pts.length < 2) return;

    // Draw lasso polygon path
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();

    // Clear lasso area (show original)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Dashed stroke
    ctx.strokeStyle = 'var(--color-accent, #F5A623)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.restore();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (state !== 'selecting') return;
    setIsDrawing(true);
    setPoints([{ x: e.clientX, y: e.clientY }]);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || state !== 'selecting') return;
    const newPoints = [...points, { x: e.clientX, y: e.clientY }];
    setPoints(newPoints);
    requestAnimationFrame(() => drawOverlay(newPoints));
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const handleConfirm = async () => {
    if (points.length < 3 || !capturedImageRef.current) return;
    setState('processing');
    setProgress(10);

    abortRef.current = new AbortController();
    const timeoutId = setTimeout(() => abortRef.current?.abort(), 30_000);

    try {
      // Extract the lasso region to a blob
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(capturedImageRef.current, 0, 0, canvas.width, canvas.height);

      // Clip to polygon
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.clip();
      const clipped = canvas.toDataURL('image/png');
      ctx.restore();

      setProgress(30);

      // OCR via Mistral
      const apiKey = localStorage.getItem('nousai-openrouter-key') ?? '';
      if (!apiKey) throw new Error('OpenRouter API key not set in Settings → AI Config');

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'mistralai/mistral-ocr-latest',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: clipped } },
              { type: 'text', text: 'Extract all text from this image. Return it as clean markdown.' },
            ],
          }],
        }),
        signal: abortRef.current.signal,
      });

      clearTimeout(timeoutId);
      setProgress(80);

      const json = await response.json();
      const text = json.choices?.[0]?.message?.content ?? '';
      setOcrResult(text);
      setState('done');
      setProgress(100);
    } catch (e) {
      clearTimeout(timeoutId);
      setState('error');
      setErrorMsg(e instanceof Error ? e.message : 'OCR failed. Check your internet connection.');
    }
  };

  const handleSaveToNotes = () => {
    if (!ocrResult) return;
    const newNote = {
      id: crypto.randomUUID(),
      title: `Screen Lasso — ${new Date().toLocaleTimeString()}`,
      content: ocrResult,
      folder: 'Captures',
      tags: ['screen-lasso', 'ocr'],
      type: 'note' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updatePluginData({ notes: [...(data?.pluginData?.notes ?? []), newNote] });
    onClose();
  };


  if (!isOpen) return null;

  return (
    <div className="screen-lasso-wrapper" style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Capture overlay — full screen canvas for lasso drawing */}
      {state === 'selecting' && (
        <canvas
          ref={overlayCanvasRef}
          style={{ position: 'fixed', inset: 0, cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}

      {/* UI panel */}
      <div className="screen-lasso-panel">
        {state === 'capturing' && (
          <div className="screen-lasso-status">
            <span>Select your screen to share…</span>
          </div>
        )}

        {state === 'selecting' && (
          <div className="screen-lasso-controls">
            <span>Draw a region to capture, then click Confirm</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleConfirm} disabled={points.length < 3}>
                Confirm Selection
              </button>
              <button className="btn" onClick={() => { setPoints([]); drawOverlay([]); }}>
                Clear
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}

        {state === 'processing' && (
          <div className="screen-lasso-status">
            <div className="screen-lasso-progress">
              <div className="screen-lasso-progress__bar" style={{ width: `${progress}%` }} />
            </div>
            <span>OCR in progress… {progress}%</span>
            <button className="btn btn-ghost btn-sm" onClick={() => abortRef.current?.abort()}>Cancel</button>
          </div>
        )}

        {state === 'done' && (
          <div className="screen-lasso-result">
            <div className="screen-lasso-result__preview">{ocrResult.slice(0, 400)}{ocrResult.length > 400 && '…'}</div>
            <div className="screen-lasso-result__actions">
              <button className="btn btn-primary btn-sm" onClick={handleSaveToNotes}>Save to Notes</button>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(ocrResult)}>Copy</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="screen-lasso-error">
            <span>{errorMsg}</span>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
