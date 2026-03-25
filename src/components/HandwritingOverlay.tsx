/**
 * HandwritingOverlay — Global handwriting input for all text fields.
 *
 * Toggle: Alt+H (or click the ✏️ badge when GlobalIme is active)
 * Draw characters with mouse/pen → AI recognizes handwriting → inserts text.
 *
 * Flow:
 * 1. User presses Alt+H → canvas overlay appears
 * 2. Draw characters (pen pressure supported)
 * 3. Pause 1.5s or click "Recognize" → canvas exported as image
 * 4. Image sent to user's AI provider (multimodal OCR) for recognition
 * 5. Recognized text inserted into the last focused text input
 * 6. Canvas clears, ready for next characters
 *
 * Supports: English, Japanese (hiragana, katakana, kanji), and any language
 * the user's AI model can read.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { callAI, isAIConfigured } from '../utils/ai';

const CANVAS_W = 400;
const CANVAS_H = 160;

const RECOGNITION_PROMPT = `You are a handwriting OCR system. The image shows handwritten text on a dark canvas.
Transcribe EXACTLY what is written — output ONLY the recognized text, nothing else.
Rules:
- If Japanese: output the exact characters (hiragana, katakana, kanji as written)
- If English: output the exact words
- If mixed: output as-is, preserving the mix
- If you cannot read a character, use ？
- Do NOT add explanations, quotes, or formatting — just the raw text`;

export default function HandwritingOverlay() {
  const [open, setOpen] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [recognized, setRecognized] = useState('');
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const autoRecogTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const hasStrokesRef = useRef(false);

  // Track the last focused text input so we know where to insert
  useEffect(() => {
    function trackFocus(e: FocusEvent) {
      const el = e.target as HTMLElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        lastInputRef.current = el;
      }
    }
    document.addEventListener('focusin', trackFocus, true);
    return () => document.removeEventListener('focusin', trackFocus, true);
  }, []);

  // Hotkey: Alt+H to toggle
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  // Clear canvas on open
  useEffect(() => {
    if (open && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      hasStrokesRef.current = false;
      setRecognized('');
      setError('');
    }
  }, [open]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection
    if (e.pointerType === 'touch' && (canvasRef.current as any)?._lastPen &&
        Date.now() - (canvasRef.current as any)._lastPen < 2000) return;
    if (e.pointerType === 'pen') (canvasRef.current as any)._lastPen = Date.now();

    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    hasStrokesRef.current = true;

    // Cancel auto-recognize timer on new stroke
    if (autoRecogTimerRef.current) clearTimeout(autoRecogTimerRef.current);

    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * (0.5 + pressure);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    ctx.lineWidth = 3 * (0.5 + pressure);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    isDrawingRef.current = false;

    // Auto-recognize after 1.5s of no drawing
    if (autoRecogTimerRef.current) clearTimeout(autoRecogTimerRef.current);
    autoRecogTimerRef.current = setTimeout(() => {
      if (hasStrokesRef.current) recognize();
    }, 1500);
  }, []);

  const recognize = useCallback(async () => {
    if (!canvasRef.current || !hasStrokesRef.current || recognizing) return;
    if (!isAIConfigured()) {
      setError('AI not configured — go to Settings → AI Provider');
      return;
    }

    setRecognizing(true);
    setError('');
    try {
      const dataUrl = canvasRef.current.toDataURL('image/png');
      const result = await callAI([
        { role: 'user', content: [
          { type: 'text', text: RECOGNITION_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ]},
      ], { maxTokens: 200 }, 'ocr');

      const text = result.trim().replace(/^["']|["']$/g, '');
      setRecognized(text);

      // Auto-insert into last focused input
      if (text && lastInputRef.current) {
        const el = lastInputRef.current;
        const start = el.selectionStart ?? el.value.length;
        el.value = el.value.slice(0, start) + text + el.value.slice(start);
        el.setSelectionRange(start + text.length, start + text.length);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
      }

      // Clear canvas for next input
      const ctx = canvasRef.current.getContext('2d')!;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      hasStrokesRef.current = false;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Recognition failed');
    }
    setRecognizing(false);
  }, [recognizing]);

  const clearCanvas = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    hasStrokesRef.current = false;
    setRecognized('');
    setError('');
    if (autoRecogTimerRef.current) clearTimeout(autoRecogTimerRef.current);
  }, []);

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 60, right: 16, zIndex: 99998,
      background: 'var(--bg-card, #1a1a2e)', border: '2px solid var(--accent, #F5A623)',
      borderRadius: 16, padding: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      width: CANVAS_W + 24, fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
          ✏️ Handwrite
        </span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {recognized && (
            <span style={{ fontSize: 11, color: '#4ade80', fontWeight: 600 }}>→ {recognized}</span>
          )}
          <button onClick={clearCanvas} style={{
            background: 'none', border: '1px solid var(--border, #333)', borderRadius: 6,
            color: 'var(--text-muted, #888)', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
          }}>Clear</button>
          <button onClick={() => setOpen(false)} style={{
            background: 'none', border: 'none', color: 'var(--text-muted, #888)',
            fontSize: 16, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onContextMenu={e => e.preventDefault()}
        style={{
          width: '100%', height: CANVAS_H * (CANVAS_W / CANVAS_W),
          borderRadius: 8, border: '1px solid var(--border, #333)',
          cursor: 'crosshair', touchAction: 'none', display: 'block',
          background: '#1a1a2e',
        }}
      />

      {/* Status bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted, #666)' }}>
          {recognizing ? '🔍 Recognizing...' : error ? `❌ ${error}` : 'Draw → auto-recognizes after 1.5s pause'}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={recognize}
            disabled={recognizing || !hasStrokesRef.current}
            style={{
              background: 'var(--accent, #F5A623)', color: '#000', border: 'none',
              borderRadius: 6, fontSize: 11, fontWeight: 700, padding: '4px 12px',
              cursor: recognizing ? 'wait' : 'pointer', opacity: recognizing ? 0.5 : 1,
            }}
          >
            {recognizing ? '...' : 'Recognize'}
          </button>
          <span style={{ fontSize: 9, color: 'var(--text-muted, #555)', alignSelf: 'center' }}>Alt+H</span>
        </div>
      </div>
    </div>
  );
}
