/**
 * useStreamDeckShortcuts — Zero-lag global keyboard shortcut hook.
 *
 * ## How it works
 * - One persistent window listener (registered once, never re-subscribes).
 * - Handler map is kept in a ref → always fresh, zero stale closures.
 * - Key lookup is O(1) via plain object map.
 *
 * ## Key format (critical)
 * Uses e.code (physical key position), NOT e.key (character value).
 *
 * Why e.code? When Shift is held, e.key changes the character:
 *   Ctrl+Shift+1 → e.key = "!" (wrong), e.code = "Digit1" → "1" (correct)
 *   Ctrl+Shift+/ → e.key = "?" (wrong), e.code = "Slash"  → "/" (correct)
 *   Ctrl+Shift+` → e.key = "~" (wrong), e.code = "Backquote" → "`" (correct)
 *
 * This means key combos ALWAYS match their physical keys regardless of keyboard layout.
 *
 * ## Combo format
 * "ctrl+shift+1", "ctrl+shift+r", " " (space), "arrowright", "1", "f13", etc.
 * Modifiers always in order: ctrl → shift → alt → key
 */
import { useEffect, useRef } from 'react';

/** Maps e.code → normalized unshifted key name */
const CODE_MAP: Record<string, string> = {
  Space:        ' ',
  ArrowLeft:    'arrowleft',
  ArrowRight:   'arrowright',
  ArrowUp:      'arrowup',
  ArrowDown:    'arrowdown',
  BracketLeft:  '[',
  BracketRight: ']',
  Comma:        ',',
  Period:       '.',
  Slash:        '/',
  Backquote:    '`',
  Backslash:    '\\',
  Semicolon:    ';',
  Quote:        "'",
  Minus:        '-',
  Equal:        '=',
  Delete:       'delete',
  Backspace:    'backspace',
  Enter:        'enter',
  Escape:       'escape',
  Tab:          'tab',
  Insert:       'insert',
  Home:         'home',
  End:          'end',
  PageUp:       'pageup',
  PageDown:     'pagedown',
};

function normalizeCode(e: KeyboardEvent): string {
  const code = e.code;
  // "KeyA" → "a", "KeyR" → "r"
  if (code.startsWith('Key')) return code.slice(3).toLowerCase();
  // "Digit1" → "1", "Digit0" → "0"
  if (code.startsWith('Digit')) return code.slice(5);
  // "F1"–"F24" → "f1"–"f24"
  if (/^F\d+$/.test(code)) return code.toLowerCase();
  // Everything else: look up in map, fall back to e.key lowercase
  return CODE_MAP[code] ?? e.key.toLowerCase();
}

export function useStreamDeckShortcuts(handlers: Record<string, () => void>): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      // Skip if user is typing in an input/textarea (unless it's a Stream Deck combo)
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;
      // Allow combos with Ctrl (SD shortcuts) even in inputs; block bare keys in inputs
      if (isInput && !e.ctrlKey && !e.altKey) return;

      const parts: string[] = [];
      if (e.ctrlKey)  parts.push('ctrl');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey)   parts.push('alt');
      parts.push(normalizeCode(e));

      const combo = parts.join('+');
      const fn = ref.current[combo];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };

    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, []); // intentionally empty — ref keeps handlers fresh
}
