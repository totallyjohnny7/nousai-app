/**
 * Card shortcut helpers — convenience layer on top of the core shortcuts.ts system.
 * Exposes loadShortcuts / saveShortcuts for the Settings shortcut editor.
 */

import { SHORTCUT_DEFS, getCustomShortcuts, getShortcutKey } from './shortcuts';

export interface ShortcutAction {
  id: string;
  label: string;
  defaultKey: string;
}

/** All card-related shortcut actions (subset of SHORTCUT_DEFS) */
export const CARD_SHORTCUT_ACTIONS: ShortcutAction[] = SHORTCUT_DEFS
  .filter(d => d.category === 'flashcards')
  .map(d => ({ id: d.id, label: d.label, defaultKey: d.defaultKey }));

/** Get a flat map of all current key bindings for card shortcuts */
export function loadShortcuts(): Record<string, string> {
  const custom = getCustomShortcuts();
  const result: Record<string, string> = {};
  for (const a of CARD_SHORTCUT_ACTIONS) {
    result[a.id] = custom[a.id] ?? a.defaultKey;
  }
  return result;
}

/** Persist a full shortcut map (merges into the existing custom overrides) */
export function saveShortcuts(map: Record<string, string>): void {
  const existing = getCustomShortcuts();
  for (const a of CARD_SHORTCUT_ACTIONS) {
    if (map[a.id] && map[a.id] !== a.defaultKey) {
      existing[a.id] = map[a.id];
    } else {
      delete existing[a.id];
    }
  }
  localStorage.setItem('nousai-shortcuts', JSON.stringify(existing));
}

/** Convenience re-export */
export { getShortcutKey };
