/**
 * useK20Hotkeys — HUION K20 KeyDial Mini global hotkey handler
 *
 * Listens for keyboard shortcuts mapped to the K20 layout:
 *   DIAL:   Ctrl+= (zoom in), Ctrl+- (zoom out), Ctrl+Tab (cycle AI mode)
 *   ROW 1:  Ctrl+Z/Y/C/V — browser native, not intercepted
 *   ROW 2:  1-4 = FSRS ratings (only during active review, 300ms debounce)
 *   ROW 3:  Ctrl+Shift+V/E/Q (AI modes), Ctrl+Enter (send AI)
 *   ROW 4:  Ctrl+Shift+Space (flip), Ctrl+Shift+P (pomodoro),
 *           Ctrl+Shift+T (transcribe), Ctrl+Shift+F (search)
 *   BOTTOM: Escape (priority: modal > panel > back), Ctrl+Shift+N (new card)
 *
 * Also blocks Stream Deck F13-F24 keys when streamDeck device is disabled.
 *
 * Dispatches CustomEvents on `window` for actions that don't have direct
 * store implementations. Components can listen via `window.addEventListener`.
 */

import { useEffect, useRef } from 'react';

export interface DeviceSettings {
  keyboard: true;
  k20: boolean;
  streamDeck: boolean;
  gamepad: boolean;
  midi: boolean;
  otherHID: boolean;
}

export const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
  keyboard: true,
  k20: true,
  streamDeck: false,
  gamepad: false,
  midi: false,
  otherHID: false,
};

const LS_KEY = 'nousai_device_settings';

export function loadDeviceSettings(): DeviceSettings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceSettings>;
      return { ...DEFAULT_DEVICE_SETTINGS, ...parsed, keyboard: true };
    }
  } catch { /* corrupt — use defaults */ }
  return { ...DEFAULT_DEVICE_SETTINGS };
}

export function saveDeviceSettings(settings: DeviceSettings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ...settings, keyboard: true }));
  } catch { /* storage full */ }
}

/** Check if the active element is a text input where single keys should not be intercepted */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Emit a custom event on window for K20 actions */
function emitK20(name: string, detail?: Record<string, unknown>): void {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/** F13-F24 key names used by Stream Deck in keyboard emulation mode */
const STREAM_DECK_FKEYS = new Set([
  'F13', 'F14', 'F15', 'F16', 'F17', 'F18',
  'F19', 'F20', 'F21', 'F22', 'F23', 'F24',
]);

export interface UseK20HotkeysOptions {
  /** Whether a flashcard review session is active (enables 1-4 FSRS rating keys) */
  isReviewActive: boolean;
  /** Whether a modal dialog is currently open */
  modalOpen: boolean;
  /** Whether the annotation side panel is open */
  annotationPanelOpen: boolean;
  /** Router navigate function for Escape-back behavior */
  navigateBack: () => void;
  /** Callback to close modal */
  closeModal?: () => void;
  /** Callback to close annotation panel */
  closeAnnotationPanel?: () => void;
}

export function useK20Hotkeys(options: UseK20HotkeysOptions): void {
  const optRef = useRef(options);
  optRef.current = options;

  // Debounce ref for FSRS rating keys (300ms)
  const lastRatingRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const settings = loadDeviceSettings();

      // ── Block Stream Deck F13-F24 when streamDeck device is disabled ──
      if (!settings.streamDeck && STREAM_DECK_FKEYS.has(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      // ── K20 shortcuts require k20 to be enabled ──
      if (!settings.k20) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      // ── DIAL: Ctrl+= (zoom in) ──
      if (ctrl && !shift && (key === '=' || key === '+')) {
        e.preventDefault();
        emitK20('k20:zoomIn');
        return;
      }

      // ── DIAL: Ctrl+- (zoom out) ──
      if (ctrl && !shift && key === '-') {
        e.preventDefault();
        emitK20('k20:zoomOut');
        return;
      }

      // ── DIAL: Ctrl+Tab (cycle AI mode) ──
      if (ctrl && !shift && key === 'Tab') {
        e.preventDefault();
        emitK20('k20:cycleAIMode');
        return;
      }

      // ── ROW 1: Ctrl+Z/Y/C/V — browser native, do NOT intercept ──

      // ── ROW 2: FSRS ratings 1-4 (only when reviewing, not typing, 300ms debounce) ──
      if (!ctrl && !shift && !e.altKey && ['1', '2', '3', '4'].includes(key)) {
        if (optRef.current.isReviewActive && !isTyping()) {
          const now = Date.now();
          if (now - lastRatingRef.current < 300) return; // debounce
          lastRatingRef.current = now;
          e.preventDefault();
          e.stopImmediatePropagation();
          // Dispatch as nousai-action to match Stream Deck / Gamepad pattern
          window.dispatchEvent(new CustomEvent('nousai-action', { detail: `fc_conf${key}` }));
          return;
        }
        // Not in review — let the key through for normal typing
        return;
      }

      // ── ROW 3: AI modes ──
      // Ctrl+Shift+V — Visual mode
      if (ctrl && shift && (key === 'V' || key === 'v')) {
        e.preventDefault();
        emitK20('k20:visual');
        return;
      }
      // Ctrl+Shift+E — Explain mode
      if (ctrl && shift && (key === 'E' || key === 'e')) {
        e.preventDefault();
        emitK20('k20:explain');
        return;
      }
      // Ctrl+Shift+Q — Quiz mode
      if (ctrl && shift && (key === 'Q' || key === 'q')) {
        e.preventDefault();
        emitK20('k20:quiz');
        return;
      }
      // Ctrl+Enter — Send AI
      if (ctrl && !shift && key === 'Enter') {
        e.preventDefault();
        emitK20('k20:sendAI');
        return;
      }

      // ── ROW 4 ──
      // Ctrl+Shift+Space — Flip card
      if (ctrl && shift && key === ' ') {
        e.preventDefault();
        emitK20('k20:flipCard');
        return;
      }
      // Ctrl+Shift+P — Pomodoro
      if (ctrl && shift && (key === 'P' || key === 'p')) {
        e.preventDefault();
        emitK20('k20:pomodoro');
        return;
      }
      // Ctrl+Shift+T — Transcribe
      if (ctrl && shift && (key === 'T' || key === 't')) {
        e.preventDefault();
        emitK20('k20:transcribe');
        return;
      }
      // Ctrl+Shift+F — Search
      if (ctrl && shift && (key === 'F' || key === 'f')) {
        e.preventDefault();
        emitK20('k20:search');
        return;
      }

      // ── BOTTOM ROW ──
      // Escape — priority queue: modal → panel → navigate back
      if (key === 'Escape' && !ctrl && !shift) {
        const opt = optRef.current;
        if (opt.modalOpen && opt.closeModal) {
          e.preventDefault();
          opt.closeModal();
          return;
        }
        if (opt.annotationPanelOpen && opt.closeAnnotationPanel) {
          e.preventDefault();
          opt.closeAnnotationPanel();
          return;
        }
        // Fall through — navigate back
        e.preventDefault();
        opt.navigateBack();
        return;
      }

      // Ctrl+Shift+N — New card
      if (ctrl && shift && (key === 'N' || key === 'n')) {
        e.preventDefault();
        emitK20('k20:newCard');
        return;
      }
    };

    // Use capture phase to intercept before other handlers
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
