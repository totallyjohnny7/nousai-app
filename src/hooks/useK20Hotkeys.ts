/**
 * useK20Hotkeys — Keyboard event listener for HUION K20 KeyDial Mini.
 *
 * Intercepts keyboard combos sent by the K20 and dispatches NousAI actions.
 * Uses dynamic bindings from useK20Bindings (localStorage-backed).
 *
 * FSRS keys retain special behavior regardless of remapping:
 * - Only active during card review (checks for review panel in DOM)
 * - 300ms debounce to prevent double-presses
 * - Blocked while typing in input/textarea
 */

import { useEffect, useRef } from 'react';
import { K20_KEYS, K20_ACTIONS, type K20BindingsMap, type K20ActionId } from '../utils/k20Types';
import { getK20Bindings } from './useK20Bindings';

/** Parse a combo string like "Ctrl+Shift+1" into parts for matching */
interface ParsedCombo {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  meta: boolean;
  key: string; // lowercase
}

function parseCombo(combo: string): ParsedCombo {
  const parts = combo.split('+').map(p => p.trim());
  const result: ParsedCombo = { ctrl: false, shift: false, alt: false, meta: false, key: '' };
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') result.ctrl = true;
    else if (lower === 'shift') result.shift = true;
    else if (lower === 'alt') result.alt = true;
    else if (lower === 'meta' || lower === 'cmd') result.meta = true;
    else result.key = lower;
  }
  return result;
}

function matchesEvent(e: KeyboardEvent, parsed: ParsedCombo): boolean {
  return (
    e.ctrlKey === parsed.ctrl &&
    e.shiftKey === parsed.shift &&
    e.altKey === parsed.alt &&
    e.metaKey === parsed.meta &&
    e.key.toLowerCase() === parsed.key
  );
}

/** Check if an element is a text input */
function isTyping(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  if (target.isContentEditable) return true;
  return false;
}

/** Check if card review panel is active in the DOM */
function isReviewActive(): boolean {
  return !!(
    document.querySelector('[data-review-panel]') ||
    document.querySelector('.review-panel') ||
    document.querySelector('.flashcard-review')
  );
}

/** Dispatch a NousAI action */
function dispatchAction(actionId: K20ActionId): void {
  switch (actionId) {
    case 'zoomIn':
      document.documentElement.style.zoom = String(
        Math.min(2, parseFloat(document.documentElement.style.zoom || '1') + 0.1)
      );
      break;
    case 'zoomOut':
      document.documentElement.style.zoom = String(
        Math.max(0.5, parseFloat(document.documentElement.style.zoom || '1') - 0.1)
      );
      break;
    case 'flipCard':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'fc_flip' }));
      break;
    case 'fsrsAgain':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'fc_conf1' }));
      break;
    case 'fsrsHard':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'fc_conf2' }));
      break;
    case 'fsrsGood':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'fc_conf3' }));
      break;
    case 'fsrsEasy':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'fc_conf4' }));
      break;
    case 'quiz':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'nav_quiz' }));
      break;
    case 'search':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'notes_search' }));
      break;
    case 'sendAi':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'relay_send' }));
      break;
    case 'transcribe':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'notes_speak' }));
      break;
    case 'navigateBack':
      window.history.back();
      break;
    case 'closeModal':
      // Press Escape to close any open modal
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      break;
    case 'closePanel':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'close_panel' }));
      break;
    case 'cycleAiMode':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'cycle_ai_mode' }));
      break;
    case 'visualLab':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'visual_lab' }));
      break;
    case 'explain':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'explain' }));
      break;
    case 'pomodoro':
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: 'nav_timer' }));
      break;
    case 'none':
      break;
  }
}

/**
 * Hook: register K20 keyboard listeners.
 * Re-registers when bindings version changes.
 */
export function useK20Hotkeys(enabled = true, version = 0): void {
  const lastFsrsTime = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const bindings = getK20Bindings();

    // Pre-parse all combos for fast matching
    const comboMap: { keyId: string; parsed: ParsedCombo; actionId: K20ActionId }[] = [];
    for (const keyDef of K20_KEYS) {
      const actionId = bindings[keyDef.id] ?? 'none';
      if (actionId === 'none') continue;
      comboMap.push({
        keyId: keyDef.id,
        parsed: parseCombo(keyDef.combo),
        actionId,
      });
    }

    function handler(e: KeyboardEvent) {
      for (const entry of comboMap) {
        if (!matchesEvent(e, entry.parsed)) continue;

        const actionDef = K20_ACTIONS.find(a => a.id === entry.actionId);
        const isFsrs = actionDef?.isFsrs ?? false;

        // FSRS constraints: blocked while typing, review-only, 300ms debounce
        if (isFsrs) {
          if (isTyping(e.target)) return;
          if (!isReviewActive()) return;
          const now = Date.now();
          if (now - lastFsrsTime.current < 300) return;
          lastFsrsTime.current = now;
        }

        e.preventDefault();
        e.stopPropagation();
        dispatchAction(entry.actionId);
        return;
      }
    }

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled, version]);
}
