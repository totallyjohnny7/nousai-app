/**
 * Keyboard shortcut configuration system.
 * Stores custom key bindings in localStorage.
 */

export interface ShortcutDef {
  id: string;
  label: string;
  description: string;
  category: 'global' | 'flashcards' | 'quiz' | 'ime' | 'sync';
  defaultKey: string;
  modifier?: 'ctrl' | 'alt' | 'ctrl+shift';
}

export const SHORTCUT_DEFS: ShortcutDef[] = [
  // Global navigation
  { id: 'nav_notes', label: 'Go to Notes', description: 'Navigate to Library → Notes tab', category: 'global', defaultKey: 'n' },
  { id: 'nav_quiz', label: 'Go to Quiz', description: 'Navigate to Quiz page', category: 'global', defaultKey: 'q' },
  { id: 'nav_flashcards', label: 'Go to Flashcards', description: 'Navigate to Flashcards page', category: 'global', defaultKey: 'f' },
  { id: 'nav_search', label: 'Open Search', description: 'Open global search (Ctrl+F or Ctrl+K)', category: 'global', defaultKey: 'f', modifier: 'ctrl' },
  { id: 'nav_sync', label: 'Sync to Cloud', description: 'Force sync data to cloud (Ctrl+S)', category: 'sync', defaultKey: 's', modifier: 'ctrl' },
  { id: 'nav_help', label: 'Show Shortcuts', description: 'Toggle keyboard shortcut overlay', category: 'global', defaultKey: '?' },
  { id: 'nav_focus', label: 'Focus Mode', description: 'Toggle distraction-free mode', category: 'global', defaultKey: 'F11' },
  // IME & Input
  { id: 'ime_toggle', label: 'Cycle IME', description: 'Cycle input: Off → Hiragana → Katakana (Alt+J)', category: 'ime', defaultKey: 'j', modifier: 'alt' },
  { id: 'ime_handwriting', label: 'Handwriting Input', description: 'Toggle handwriting overlay (Alt+H)', category: 'ime', defaultKey: 'h', modifier: 'alt' },
  // Flashcards
  { id: 'fc_flip', label: 'Flip card', description: 'Flip the current flashcard', category: 'flashcards', defaultKey: 'Space' },
  { id: 'fc_next', label: 'Next card', description: 'Go to next flashcard', category: 'flashcards', defaultKey: 'ArrowRight' },
  { id: 'fc_prev', label: 'Previous card', description: 'Go to previous flashcard', category: 'flashcards', defaultKey: 'ArrowLeft' },
  { id: 'fc_star', label: 'Star/unstar', description: 'Toggle star on current card', category: 'flashcards', defaultKey: 's' },
  { id: 'fc_restart', label: 'Restart deck', description: 'Restart the flashcard deck', category: 'flashcards', defaultKey: 'r' },
  { id: 'fc_auto', label: 'Auto-advance', description: 'Toggle auto-advance mode', category: 'flashcards', defaultKey: 'p' },
  { id: 'fc_zen', label: 'Zen mode', description: 'Toggle zen (fullscreen) mode', category: 'flashcards', defaultKey: 'f' },
  { id: 'fc_conf1', label: 'Again (1)', description: 'Rate card: Again (forgot)', category: 'flashcards', defaultKey: '1' },
  { id: 'fc_conf2', label: 'Hard (2)', description: 'Rate card: Hard (struggled)', category: 'flashcards', defaultKey: '2' },
  { id: 'fc_conf3', label: 'Good (3)', description: 'Rate card: Good (correct)', category: 'flashcards', defaultKey: '3' },
  { id: 'fc_conf4', label: 'Easy (4)', description: 'Rate card: Easy (effortless)', category: 'flashcards', defaultKey: '4' },
  { id: 'fc_replay', label: 'Replay media', description: 'Replay audio/video on card', category: 'flashcards', defaultKey: 'm' },
  { id: 'fc_fullscreen', label: 'Fullscreen media', description: 'Toggle fullscreen for card media', category: 'flashcards', defaultKey: 'v' },
  // Quiz
  { id: 'qz_opt1', label: 'Option 1', description: 'Select first answer option', category: 'quiz', defaultKey: '1' },
  { id: 'qz_opt2', label: 'Option 2', description: 'Select second answer option', category: 'quiz', defaultKey: '2' },
  { id: 'qz_opt3', label: 'Option 3', description: 'Select third answer option', category: 'quiz', defaultKey: '3' },
  { id: 'qz_opt4', label: 'Option 4', description: 'Select fourth answer option', category: 'quiz', defaultKey: '4' },
  { id: 'qz_submit', label: 'Submit', description: 'Submit quiz answer', category: 'quiz', defaultKey: 'Enter' },
  { id: 'qz_continue', label: 'Continue', description: 'Continue to next question', category: 'quiz', defaultKey: 'Space' },
];

/** Non-configurable shortcuts (informational only, shown in Settings but not rebindable) */
export const FIXED_SHORTCUTS: { label: string; key: string; description: string; category: string }[] = [
  // Omni Search
  { label: 'Close Search', key: 'Esc', description: 'Close search palette', category: 'Search' },
  { label: 'Move Down', key: '↓', description: 'Select next search result', category: 'Search' },
  { label: 'Move Up', key: '↑', description: 'Select previous search result', category: 'Search' },
  { label: 'Open Result', key: 'Enter', description: 'Open selected search result', category: 'Search' },
  // Escape priority
  { label: 'Close Modal', key: 'Esc', description: 'Close topmost modal/panel/overlay (priority-based)', category: 'Navigation' },
  // Study
  { label: 'Annotation Sidecar', key: 'N', description: 'Toggle annotation panel during study sessions', category: 'Study' },
  // Speed Reader
  { label: 'Pause/Resume', key: 'Space', description: 'Pause or resume RSVP word playback', category: 'Speed Reader' },
  { label: 'Next Word', key: '→', description: 'Advance to next word in RSVP', category: 'Speed Reader' },
  // Flashcards extras
  { label: 'Speed +', key: '+', description: 'Increase auto-advance speed', category: 'Flashcards' },
  { label: 'Speed −', key: '-', description: 'Decrease auto-advance speed', category: 'Flashcards' },
  // Rich Text Editor
  { label: 'Save Note', key: 'Ctrl+S', description: 'Save current note in editor', category: 'Editor' },
  { label: 'Find Next', key: 'Enter', description: 'Find next match in find dialog', category: 'Editor' },
  { label: 'Find Prev', key: 'Shift+Enter', description: 'Find previous match', category: 'Editor' },
  // Cloud Sync
  { label: 'Sync from Cloud', key: 'Ctrl+Shift+S', description: 'Download data from cloud (overwrite local)', category: 'Sync' },
];

/** Category labels for display */
export const SHORTCUT_CATEGORIES: Record<ShortcutDef['category'], string> = {
  global: '🌐 Global Navigation',
  flashcards: '📇 Flashcards',
  quiz: '📝 Quiz',
  ime: '🔤 Input Method (IME)',
  sync: '☁️ Sync & Data',
};

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
