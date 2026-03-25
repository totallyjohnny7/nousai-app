/**
 * GlobalIme — Global Japanese IME overlay for all text inputs.
 *
 * Hotkey: Alt+J (or Ctrl+Shift+J) cycles: off → hiragana → katakana → off
 * When active, intercepts keystrokes on focused text inputs/textareas and
 * converts romaji to kana using wanakana. Shows a small badge in the
 * bottom-right corner indicating current mode.
 *
 * Safe: does NOT use wanakana.bind() (which crashes ProseMirror/TipTap).
 * Instead, manually handles keydown → buffer → conversion.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { getImeMode, setImeMode, convertBuffer, flushBuffer, type ImeMode } from '../utils/japaneseIme';

const CYCLE: ImeMode[] = ['off', 'hiragana', 'katakana'];
const LABELS: Record<ImeMode, string> = { off: '', hiragana: 'あ', katakana: 'ア' };
const MODE_NAMES: Record<ImeMode, string> = { off: 'IME Off', hiragana: 'Hiragana', katakana: 'Katakana' };

// Keys that should NOT be captured by IME
const IGNORE_KEYS = new Set([
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight',
  'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown',
  'Control', 'Alt', 'Shift', 'Meta', 'CapsLock', 'F1', 'F2', 'F3', 'F4',
  'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
]);

export default function GlobalIme() {
  const [mode, setModeState] = useState<ImeMode>(() => getImeMode());
  const [flash, setFlash] = useState(false);
  const bufferRef = useRef('');
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const cycleMode = useCallback(() => {
    const idx = CYCLE.indexOf(mode);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    setModeState(next);
    setImeMode(next);
    bufferRef.current = '';
    // Flash indicator
    setFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 1500);
  }, [mode]);

  // Global hotkey: Alt+J or Ctrl+Shift+J
  useEffect(() => {
    function handleHotkey(e: KeyboardEvent) {
      if ((e.altKey && e.key === 'j') || (e.ctrlKey && e.shiftKey && e.key === 'J')) {
        e.preventDefault();
        e.stopPropagation();
        cycleMode();
      }
    }
    window.addEventListener('keydown', handleHotkey, true);
    return () => window.removeEventListener('keydown', handleHotkey, true);
  }, [cycleMode]);

  // IME keystroke interception on text inputs
  useEffect(() => {
    if (mode === 'off') return;

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      // Only intercept on text inputs and textareas (not contentEditable — RichTextEditor has its own IME)
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
      if (target.type && !['text', 'search', 'url', 'tel', 'password', ''].includes(target.type)) return;
      // Skip if modifier keys held (except shift for capitals)
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (e.key === 'Backspace') {
        if (bufferRef.current.length > 0) {
          e.preventDefault();
          bufferRef.current = bufferRef.current.slice(0, -1);
          applyBuffer(target as HTMLInputElement | HTMLTextAreaElement);
        }
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        // Flush buffer on submit
        if (bufferRef.current.length > 0) {
          commitBuffer(target as HTMLInputElement | HTMLTextAreaElement);
        }
        return; // Let the event propagate normally
      }

      if (e.key === ' ') {
        e.preventDefault();
        commitBuffer(target as HTMLInputElement | HTMLTextAreaElement);
        // Insert actual space
        insertAtCursor(target as HTMLInputElement | HTMLTextAreaElement, ' ');
        return;
      }

      // Only capture single printable characters
      if (e.key.length !== 1 || IGNORE_KEYS.has(e.key)) return;

      e.preventDefault();
      bufferRef.current += e.key;
      applyBuffer(target as HTMLInputElement | HTMLTextAreaElement);
    }

    function applyBuffer(el: HTMLInputElement | HTMLTextAreaElement) {
      const converted = convertBuffer(bufferRef.current, mode as 'hiragana' | 'katakana');
      // Replace the buffer region in the input
      const start = el.selectionStart ?? el.value.length;
      const bufLen = bufferRef.current.length;
      // The buffer always corresponds to the last N characters before cursor
      // We need to track where the buffer started
      const preBuffer = el.value.slice(0, start - (converted.length || bufLen));
      const postBuffer = el.value.slice(start);
      el.value = preBuffer + converted + postBuffer;
      const newPos = preBuffer.length + converted.length;
      el.setSelectionRange(newPos, newPos);
      // Trigger React's onChange
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function commitBuffer(el: HTMLInputElement | HTMLTextAreaElement) {
      if (!bufferRef.current) return;
      const flushed = flushBuffer(bufferRef.current, mode as 'hiragana' | 'katakana');
      const start = el.selectionStart ?? el.value.length;
      const partial = convertBuffer(bufferRef.current, mode as 'hiragana' | 'katakana');
      const preBuffer = el.value.slice(0, start - partial.length);
      const postBuffer = el.value.slice(start);
      el.value = preBuffer + flushed + postBuffer;
      const newPos = preBuffer.length + flushed.length;
      el.setSelectionRange(newPos, newPos);
      bufferRef.current = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
      const start = el.selectionStart ?? el.value.length;
      el.value = el.value.slice(0, start) + text + el.value.slice(start);
      el.setSelectionRange(start + text.length, start + text.length);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [mode]);

  // Reset buffer when mode changes
  useEffect(() => { bufferRef.current = ''; }, [mode]);

  if (mode === 'off' && !flash) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 20,
        background: mode === 'off' ? 'rgba(100,100,100,0.9)' : mode === 'hiragana' ? 'rgba(34,197,94,0.9)' : 'rgba(59,130,246,0.9)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        opacity: flash ? 1 : 0.85,
        transform: flash ? 'scale(1.1)' : 'scale(1)',
        userSelect: 'none',
      }}
      onClick={cycleMode}
      title="Click or press Alt+J to cycle: Off → Hiragana → Katakana"
    >
      <span style={{ fontSize: 18 }}>{LABELS[mode] || '🔤'}</span>
      <span>{MODE_NAMES[mode]}</span>
      <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>Alt+J</span>
    </div>
  );
}
