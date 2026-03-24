/**
 * HUION K20 KeyDial Mini — Conflict Scanner
 *
 * Detects if any K20 key combos collide with reserved browser shortcuts.
 * Used in Settings to warn the user about un-overridable browser hotkeys.
 */

export const RESERVED_BROWSER_KEYS = [
  'ctrl+t', 'ctrl+n', 'ctrl+w', 'ctrl+p', 'ctrl+f', 'ctrl+r', 'ctrl+l', 'ctrl+u',
  'ctrl+s', 'ctrl+j', 'ctrl+h', 'ctrl+b', 'ctrl+shift+i', 'ctrl+shift+j',
  'f5', 'f11', 'f12', 'alt+f4',
] as const;

export const K20_COMBOS = [
  'ctrl+=', 'ctrl+-', 'ctrl+tab',
  'ctrl+z', 'ctrl+y', 'ctrl+c', 'ctrl+v',
  'ctrl+shift+v', 'ctrl+shift+e', 'ctrl+shift+q', 'ctrl+enter',
  'ctrl+shift+ ', 'ctrl+shift+p', 'ctrl+shift+t', 'ctrl+shift+f', 'ctrl+shift+n',
] as const;

/**
 * Returns an array of K20 combos that collide with reserved browser shortcuts.
 * If the array is empty, no conflicts exist.
 */
export function scanK20Conflicts(): string[] {
  const reserved = new Set<string>(RESERVED_BROWSER_KEYS);
  return K20_COMBOS.filter(k => reserved.has(k));
}
