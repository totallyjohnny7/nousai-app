/**
 * HUION K20 KeyDial Mini — Type definitions
 *
 * The K20 sends keyboard shortcuts (Ctrl+key, etc.) to the OS.
 * Each physical key has a default combo. Users can remap which
 * NousAI action each combo triggers.
 */

/** All available NousAI actions that can be bound to a K20 key */
export type K20ActionId =
  | 'zoomIn'
  | 'zoomOut'
  | 'cycleAiMode'
  | 'fsrsAgain'
  | 'fsrsHard'
  | 'fsrsGood'
  | 'fsrsEasy'
  | 'visualLab'
  | 'explain'
  | 'quiz'
  | 'sendAi'
  | 'flipCard'
  | 'pomodoro'
  | 'transcribe'
  | 'search'
  | 'closeModal'
  | 'closePanel'
  | 'navigateBack'
  | 'none';

/** Human-readable action definitions */
export interface K20ActionDef {
  id: K20ActionId;
  label: string;
  category: 'zoom' | 'fsrs' | 'ai' | 'study' | 'navigation' | 'utility';
  isFsrs: boolean;
}

export const K20_ACTIONS: K20ActionDef[] = [
  { id: 'zoomIn',       label: 'Zoom In',           category: 'zoom',       isFsrs: false },
  { id: 'zoomOut',      label: 'Zoom Out',          category: 'zoom',       isFsrs: false },
  { id: 'cycleAiMode',  label: 'Cycle AI Mode',     category: 'ai',         isFsrs: false },
  { id: 'fsrsAgain',    label: 'FSRS: Again',       category: 'fsrs',       isFsrs: true },
  { id: 'fsrsHard',     label: 'FSRS: Hard',        category: 'fsrs',       isFsrs: true },
  { id: 'fsrsGood',     label: 'FSRS: Good',        category: 'fsrs',       isFsrs: true },
  { id: 'fsrsEasy',     label: 'FSRS: Easy',        category: 'fsrs',       isFsrs: true },
  { id: 'visualLab',    label: 'Visual Lab',        category: 'ai',         isFsrs: false },
  { id: 'explain',      label: 'Explain',           category: 'ai',         isFsrs: false },
  { id: 'quiz',         label: 'Quiz',              category: 'study',      isFsrs: false },
  { id: 'sendAi',       label: 'Send to AI',        category: 'ai',         isFsrs: false },
  { id: 'flipCard',     label: 'Flip Card',         category: 'study',      isFsrs: false },
  { id: 'pomodoro',     label: 'Pomodoro Timer',    category: 'utility',    isFsrs: false },
  { id: 'transcribe',   label: 'Transcribe',        category: 'ai',         isFsrs: false },
  { id: 'search',       label: 'Search',            category: 'navigation', isFsrs: false },
  { id: 'closeModal',   label: 'Close Modal',       category: 'navigation', isFsrs: false },
  { id: 'closePanel',   label: 'Close Panel',       category: 'navigation', isFsrs: false },
  { id: 'navigateBack', label: 'Navigate Back',     category: 'navigation', isFsrs: false },
  { id: 'none',         label: '(Unassigned)',       category: 'utility',    isFsrs: false },
];

/** A key combo string like "Ctrl+=" or "Ctrl+Shift+A" */
export type KeyCombo = string;

/** Describes a physical key on the K20 */
export interface K20KeyDef {
  id: string;           // unique key identifier, e.g. "k1", "k2", "dial_cw", "dial_ccw"
  label: string;        // physical label on the device
  combo: KeyCombo;      // default keyboard combo the K20 sends
  row: number;          // layout row (0-based, for visual grid)
  col: number;          // layout column (0-based)
  isDial?: boolean;     // true for dial rotation events
}

/**
 * Physical key layout of the HUION K20 KeyDial Mini.
 * 18 programmable keys + dial (CW/CCW).
 *
 * Layout (approximate):
 *   Row 0: [K1] [K2] [K3]
 *   Row 1: [K4] [K5] [K6]
 *   Row 2: [K7] [DIAL] [K8]
 *   Row 3: [K9] [K10] [K11]
 *   Row 4: [K12] [K13] [K14]
 *   Row 5: [K15] [K16] [K17] [K18]
 */
export const K20_KEYS: K20KeyDef[] = [
  // Row 0
  { id: 'k1',  label: 'K1',  combo: 'Ctrl+Shift+1', row: 0, col: 0 },
  { id: 'k2',  label: 'K2',  combo: 'Ctrl+Shift+2', row: 0, col: 1 },
  { id: 'k3',  label: 'K3',  combo: 'Ctrl+Shift+3', row: 0, col: 2 },
  // Row 1
  { id: 'k4',  label: 'K4',  combo: 'Ctrl+Shift+4', row: 1, col: 0 },
  { id: 'k5',  label: 'K5',  combo: 'Ctrl+Shift+5', row: 1, col: 1 },
  { id: 'k6',  label: 'K6',  combo: 'Ctrl+Shift+6', row: 1, col: 2 },
  // Row 2 — dial flanked by keys
  { id: 'k7',       label: 'K7',       combo: 'Ctrl+Shift+7', row: 2, col: 0 },
  { id: 'dial_cw',  label: 'Dial CW',  combo: 'Ctrl+=',       row: 2, col: 1, isDial: true },
  { id: 'dial_ccw', label: 'Dial CCW', combo: 'Ctrl+-',       row: 2, col: 1, isDial: true },
  { id: 'k8',       label: 'K8',       combo: 'Ctrl+Shift+8', row: 2, col: 2 },
  // Row 3
  { id: 'k9',  label: 'K9',  combo: 'Ctrl+Shift+9', row: 3, col: 0 },
  { id: 'k10', label: 'K10', combo: 'Ctrl+Shift+0', row: 3, col: 1 },
  { id: 'k11', label: 'K11', combo: 'Ctrl+Shift+A', row: 3, col: 2 },
  // Row 4
  { id: 'k12', label: 'K12', combo: 'Ctrl+Shift+B', row: 4, col: 0 },
  { id: 'k13', label: 'K13', combo: 'Ctrl+Shift+C', row: 4, col: 1 },
  { id: 'k14', label: 'K14', combo: 'Ctrl+Shift+D', row: 4, col: 2 },
  // Row 5 — bottom row, 4 keys
  { id: 'k15', label: 'K15', combo: 'Ctrl+Shift+E', row: 5, col: 0 },
  { id: 'k16', label: 'K16', combo: 'Ctrl+Shift+F', row: 5, col: 1 },
  { id: 'k17', label: 'K17', combo: 'Ctrl+Shift+G', row: 5, col: 2 },
  { id: 'k18', label: 'K18', combo: 'Ctrl+Shift+H', row: 5, col: 3 },
];

/** A single binding: which key triggers which action */
export interface K20Binding {
  keyId: string;      // references K20KeyDef.id
  actionId: K20ActionId;
}

/** Full bindings map: keyId → actionId */
export type K20BindingsMap = Record<string, K20ActionId>;

/** Default bindings matching the hardcoded original behavior */
export const K20_DEFAULT_BINDINGS: K20BindingsMap = {
  dial_cw:  'zoomIn',
  dial_ccw: 'zoomOut',
  k1:       'cycleAiMode',
  k2:       'flipCard',
  k3:       'search',
  k4:       'fsrsAgain',
  k5:       'fsrsHard',
  k6:       'fsrsGood',
  k7:       'fsrsEasy',
  k8:       'visualLab',
  k9:       'explain',
  k10:      'quiz',
  k11:      'sendAi',
  k12:      'pomodoro',
  k13:      'transcribe',
  k14:      'navigateBack',
  k15:      'closeModal',
  k16:      'closePanel',
  k17:      'none',
  k18:      'none',
};

/** Emoji icons for each action (used in visual map) */
export const K20_ACTION_ICONS: Record<K20ActionId, string> = {
  zoomIn:       '🔍+',
  zoomOut:      '🔍−',
  cycleAiMode:  '🤖',
  fsrsAgain:    '❌',
  fsrsHard:     '😰',
  fsrsGood:     '✅',
  fsrsEasy:     '🚀',
  visualLab:    '🔬',
  explain:      '💡',
  quiz:         '📝',
  sendAi:       '📤',
  flipCard:     '🔄',
  pomodoro:     '⏱️',
  transcribe:   '🎙️',
  search:       '🔎',
  closeModal:   '✖️',
  closePanel:   '📕',
  navigateBack: '⬅️',
  none:         '⬜',
};
