/**
 * K20 Conflict Scanner — NousAI
 *
 * Detects two types of conflicts in K20 key bindings:
 * 1. Browser-reserved combos — keys that browsers intercept (Ctrl+W, Ctrl+T, etc.)
 * 2. Duplicate bindings — two keys mapped to the same action
 */

import { K20_KEYS, K20_ACTIONS, type K20BindingsMap, type K20ActionId, type KeyCombo } from './k20Types';

export interface K20Conflict {
  type: 'browser-reserved' | 'duplicate-binding';
  keyId: string;
  message: string;
  severity: 'warning' | 'error';
}

/** Browser combos that cannot be reliably intercepted */
const BROWSER_RESERVED_COMBOS: Set<string> = new Set([
  'Ctrl+W',       // close tab
  'Ctrl+T',       // new tab
  'Ctrl+N',       // new window
  'Ctrl+Shift+T', // reopen tab
  'Ctrl+Shift+N', // incognito
  'Ctrl+Tab',     // next tab
  'Ctrl+Shift+Tab', // prev tab
  'Ctrl+L',       // focus address bar
  'Ctrl+D',       // bookmark
  'Ctrl+H',       // history
  'Ctrl+J',       // downloads
  'Ctrl+F',       // find
  'Ctrl+G',       // find next
  'Ctrl+P',       // print
  'Ctrl+S',       // save
  'Ctrl+R',       // reload
  'Ctrl+Shift+I', // dev tools
  'Ctrl+Shift+J', // console
  'Ctrl+U',       // view source
  'F11',          // fullscreen
  'F12',          // dev tools
  'Alt+F4',       // close window
]);

/**
 * Scan current bindings for conflicts.
 * Returns an array of conflict objects.
 */
export function scanK20Conflicts(bindings: K20BindingsMap): K20Conflict[] {
  const conflicts: K20Conflict[] = [];

  // 1. Check browser-reserved combos
  for (const keyDef of K20_KEYS) {
    const actionId = bindings[keyDef.id];
    if (!actionId || actionId === 'none') continue;

    const normalizedCombo = normalizeCombo(keyDef.combo);
    if (BROWSER_RESERVED_COMBOS.has(normalizedCombo)) {
      conflicts.push({
        type: 'browser-reserved',
        keyId: keyDef.id,
        message: `${keyDef.label} (${keyDef.combo}) is reserved by the browser and may not work`,
        severity: 'warning',
      });
    }
  }

  // 2. Check duplicate bindings (same action on multiple keys)
  const actionToKeys = new Map<K20ActionId, string[]>();
  for (const [keyId, actionId] of Object.entries(bindings)) {
    if (actionId === 'none') continue;
    const existing = actionToKeys.get(actionId) ?? [];
    existing.push(keyId);
    actionToKeys.set(actionId, existing);
  }

  for (const [actionId, keyIds] of actionToKeys) {
    if (keyIds.length > 1) {
      const actionDef = K20_ACTIONS.find(a => a.id === actionId);
      const keyLabels = keyIds.map(kid => {
        const k = K20_KEYS.find(kd => kd.id === kid);
        return k?.label ?? kid;
      }).join(', ');
      for (const keyId of keyIds) {
        conflicts.push({
          type: 'duplicate-binding',
          keyId,
          message: `"${actionDef?.label ?? actionId}" is assigned to multiple keys: ${keyLabels}`,
          severity: 'warning',
        });
      }
    }
  }

  return conflicts;
}

/** Normalize combo for comparison (consistent casing and ordering) */
function normalizeCombo(combo: KeyCombo): string {
  const parts = combo.split('+').map(p => p.trim());
  const mods: string[] = [];
  let key = '';
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') mods.push('Ctrl');
    else if (lower === 'shift') mods.push('Shift');
    else if (lower === 'alt') mods.push('Alt');
    else if (lower === 'meta' || lower === 'cmd') mods.push('Meta');
    else key = part;
  }
  mods.sort();
  return [...mods, key].join('+');
}

/** Check if a specific combo string is browser-reserved */
export function isBrowserReserved(combo: KeyCombo): boolean {
  return BROWSER_RESERVED_COMBOS.has(normalizeCombo(combo));
}
