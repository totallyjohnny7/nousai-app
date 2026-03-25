/**
 * useK20Hotkeys — HUION K20 KeyDial Mini global hotkey handler
 *
 * Reads the user's key bindings (from Settings → K20 remapping UI).
 * When a K20 key combo is pressed, looks up the bound action and executes it.
 *
 * K20 keys send keyboard combos (Ctrl+Shift+1, etc.) to the OS.
 * The bindings map keyId → actionId. This handler:
 *   1. Matches the incoming keydown event to a K20 key by its combo
 *   2. Looks up what action is bound to that key
 *   3. Executes the action globally (navigate, dispatch event, etc.)
 */

import { useEffect, useRef } from 'react';
import { K20_KEYS, K20_ACTIONS, type K20ActionId } from '../utils/k20Types';

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

/** Check if the active element is a text input */
function isTyping(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** F13-F24 key names used by Stream Deck */
const STREAM_DECK_FKEYS = new Set([
  'F13', 'F14', 'F15', 'F16', 'F17', 'F18',
  'F19', 'F20', 'F21', 'F22', 'F23', 'F24',
]);

/** Load bindings from localStorage */
function loadBindings(): Record<string, K20ActionId> {
  try {
    const raw = localStorage.getItem('k20-key-bindings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const result: Record<string, K20ActionId> = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') result[k] = v as K20ActionId;
        }
        return result;
      }
    }
  } catch { /* corrupt */ }
  return {};
}

/** Parse a combo string like "Ctrl+Shift+1" into a matcher */
function matchesCombo(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const needCtrl = parts.includes('Ctrl');
  const needShift = parts.includes('Shift');
  const needAlt = parts.includes('Alt');

  const ctrl = e.ctrlKey || e.metaKey;
  if (needCtrl !== ctrl) return false;
  if (needShift !== e.shiftKey) return false;
  if (needAlt !== e.altKey) return false;

  // Match key (case-insensitive for letters, exact for symbols)
  if (key === '=') return e.key === '=' || e.key === '+';
  if (key === '-') return e.key === '-' || e.key === '_';
  return e.key === key || e.key.toLowerCase() === key.toLowerCase();
}

// Default bindings (imported inline to avoid circular dependency)
const DEFAULT_BINDINGS: Record<string, K20ActionId> = {
  dial_cw: 'zoomIn', dial_ccw: 'zoomOut',
  k1: 'cycleAiMode', k2: 'flipCard', k3: 'search',
  k4: 'fsrsAgain', k5: 'fsrsHard', k6: 'fsrsGood', k7: 'fsrsEasy',
  k8: 'visualLab', k9: 'explain', k10: 'quiz', k11: 'sendAi',
  k12: 'pomodoro', k13: 'transcribe', k14: 'navigateBack',
  k15: 'closeModal', k16: 'closePanel', k17: 'none', k18: 'none',
};

export interface UseK20HotkeysOptions {
  isReviewActive: boolean;
  modalOpen: boolean;
  annotationPanelOpen: boolean;
  navigateBack: () => void;
  closeModal?: () => void;
  closeAnnotationPanel?: () => void;
}

export function useK20Hotkeys(options: UseK20HotkeysOptions): void {
  const optRef = useRef(options);
  optRef.current = options;
  const lastRatingRef = useRef(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const settings = loadDeviceSettings();

      // Block Stream Deck F13-F24 when disabled
      if (!settings.streamDeck && STREAM_DECK_FKEYS.has(e.key)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return;
      }

      if (!settings.k20) return;

      // Load user's bindings (merged with defaults)
      const overrides = loadBindings();
      const bindings = { ...DEFAULT_BINDINGS, ...overrides };

      // Match incoming key event to a K20 physical key
      let matchedAction: K20ActionId | null = null;
      for (const keyDef of K20_KEYS) {
        if (matchesCombo(e, keyDef.combo)) {
          matchedAction = bindings[keyDef.id] ?? 'none';
          break;
        }
      }

      if (!matchedAction || matchedAction === 'none') return;

      // FSRS actions: only during review, not while typing, with debounce
      const fsrsActions: Record<string, string> = {
        fsrsAgain: 'fc_conf1', fsrsHard: 'fc_conf2',
        fsrsGood: 'fc_conf3', fsrsEasy: 'fc_conf4',
      };
      if (fsrsActions[matchedAction]) {
        if (!optRef.current.isReviewActive || isTyping()) return;
        const now = Date.now();
        if (now - lastRatingRef.current < 300) return;
        lastRatingRef.current = now;
        e.preventDefault();
        e.stopImmediatePropagation();
        window.dispatchEvent(new CustomEvent('nousai-action', { detail: fsrsActions[matchedAction] }));
        return;
      }

      // Navigation actions
      const opt = optRef.current;
      if (matchedAction === 'closeModal' && opt.modalOpen && opt.closeModal) {
        e.preventDefault(); opt.closeModal(); return;
      }
      if (matchedAction === 'closePanel' && opt.annotationPanelOpen && opt.closeAnnotationPanel) {
        e.preventDefault(); opt.closeAnnotationPanel(); return;
      }
      if (matchedAction === 'navigateBack') {
        e.preventDefault(); opt.navigateBack(); return;
      }

      // All other actions: prevent default and dispatch K20 event
      e.preventDefault();
      const eventMap: Record<string, string> = {
        zoomIn: 'k20:zoomIn', zoomOut: 'k20:zoomOut',
        cycleAiMode: 'k20:cycleAIMode', visualLab: 'k20:visual',
        explain: 'k20:explain', quiz: 'k20:quiz', sendAi: 'k20:sendAI',
        flipCard: 'k20:flipCard', pomodoro: 'k20:pomodoro',
        transcribe: 'k20:transcribe', search: 'k20:search',
      };
      const eventName = eventMap[matchedAction];
      if (eventName) {
        window.dispatchEvent(new CustomEvent(eventName));
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);
}
