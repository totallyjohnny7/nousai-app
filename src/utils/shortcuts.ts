/**
 * Keyboard shortcut configuration system.
 * Stores custom key bindings in localStorage.
 */

export interface ShortcutDef {
  id: string;
  label: string;
  category: 'flashcards' | 'quiz';
  defaultKey: string;
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Flashcards
  { id: 'fc_flip', label: 'Flip card', category: 'flashcards', defaultKey: 'Space' },
  { id: 'fc_next', label: 'Next card', category: 'flashcards', defaultKey: 'ArrowRight' },
  { id: 'fc_prev', label: 'Previous card', category: 'flashcards', defaultKey: 'ArrowLeft' },
  { id: 'fc_star', label: 'Star/unstar', category: 'flashcards', defaultKey: 's' },
  { id: 'fc_restart', label: 'Restart deck', category: 'flashcards', defaultKey: 'r' },
  { id: 'fc_auto', label: 'Auto-advance', category: 'flashcards', defaultKey: 'p' },
  { id: 'fc_zen', label: 'Zen mode', category: 'flashcards', defaultKey: 'f' },
  { id: 'fc_conf1', label: 'Confidence: Again', category: 'flashcards', defaultKey: '1' },
  { id: 'fc_conf2', label: 'Confidence: Hard', category: 'flashcards', defaultKey: '2' },
  { id: 'fc_conf3', label: 'Confidence: Good', category: 'flashcards', defaultKey: '3' },
  { id: 'fc_conf4', label: 'Confidence: Easy', category: 'flashcards', defaultKey: '4' },
  { id: 'fc_replay', label: 'Replay media', category: 'flashcards', defaultKey: 'm' },
  { id: 'fc_fullscreen', label: 'Toggle fullscreen media', category: 'flashcards', defaultKey: 'v' },
  // Quiz
  { id: 'qz_opt1', label: 'Select option 1', category: 'quiz', defaultKey: '1' },
  { id: 'qz_opt2', label: 'Select option 2', category: 'quiz', defaultKey: '2' },
  { id: 'qz_opt3', label: 'Select option 3', category: 'quiz', defaultKey: '3' },
  { id: 'qz_opt4', label: 'Select option 4', category: 'quiz', defaultKey: '4' },
  { id: 'qz_submit', label: 'Submit answer', category: 'quiz', defaultKey: 'Enter' },
  { id: 'qz_continue', label: 'Continue / Next', category: 'quiz', defaultKey: 'Space' },
];

const STORAGE_KEY = 'nousai-shortcuts';

/** Get all custom overrides */
export function getCustomShortcuts(): Record<string, string> {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch {
    return {};
  }
}

/** Get the key for a shortcut (custom override or default) */
export function getShortcutKey(id: string): string {
  const custom = getCustomShortcuts();
  if (custom[id]) return custom[id];
  const def = SHORTCUT_DEFS.find(d => d.id === id);
  return def?.defaultKey || '';
}

/** Set a custom key for a shortcut */
export function setShortcutKey(id: string, key: string): void {
  const custom = getCustomShortcuts();
  const def = SHORTCUT_DEFS.find(d => d.id === id);
  if (def && key === def.defaultKey) {
    delete custom[id]; // Remove override if same as default
  } else {
    custom[id] = key;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

/** Reset a single shortcut to default */
export function resetShortcut(id: string): void {
  const custom = getCustomShortcuts();
  delete custom[id];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

/** Reset all shortcuts to defaults */
export function resetAllShortcuts(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Format key name for display */
export function formatKey(key: string): string {
  switch (key) {
    case ' ':
    case 'Space': return '␣ Space';
    case 'Enter': return '↵ Enter';
    case 'ArrowRight': return '→';
    case 'ArrowLeft': return '←';
    case 'ArrowUp': return '↑';
    case 'ArrowDown': return '↓';
    case 'Escape': return 'Esc';
    case 'Backspace': return '⌫';
    case 'Tab': return 'Tab';
    default: return key.length === 1 ? key.toUpperCase() : key;
  }
}

/** Check if a keyboard event matches a shortcut */
export function matchesShortcut(e: KeyboardEvent, shortcutId: string): boolean {
  const key = getShortcutKey(shortcutId);
  if (!key) return false;
  // Normalize the event key for comparison
  const eventKey = e.key === ' ' ? 'Space' : e.key;
  return eventKey.toLowerCase() === key.toLowerCase();
}
