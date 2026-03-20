/**
 * Xencelabs Quick Keys Service — NousAI
 *
 * Singleton service for WebHID Quick Keys integration.
 * Dynamic import — only downloaded when user clicks Connect.
 * Supports 5 modes with OLED labels + LED ring color per mode.
 *
 * Compatible: Chrome/Edge on Windows/macOS ONLY.
 * Not available: Firefox, Safari, iPad, Boox, Capacitor WebView.
 */

import { setQuickKeysConnected } from './deviceDetection';

export type QuickKeysMode = 'flashcard' | 'quiz' | 'drawing' | 'navigation' | 'notes';

export interface QuickKeysButtonConfig {
  actionId: string;
  label: string; // max 8 chars (truncated for OLED)
}

export interface QuickKeysModeConfig {
  mode: QuickKeysMode;
  buttons: QuickKeysButtonConfig[]; // exactly 8
  dialAction: 'scroll' | 'zoom' | 'brushSize' | 'confidence';
}

export interface QuickKeysConfig {
  modes: Record<QuickKeysMode, QuickKeysModeConfig>;
  currentMode: QuickKeysMode;
}

const LS_KEY = 'nousai-quick-keys-config';

// LED ring color per mode (Xencelabs supports per-key RGB)
const MODE_COLORS: Record<QuickKeysMode, [number, number, number]> = {
  flashcard: [245, 166, 35],  // amber
  navigation: [59, 130, 246], // blue
  drawing: [34, 197, 94],     // green
  notes: [168, 85, 247],      // purple
  quiz: [239, 68, 68],        // red
};

const DEFAULT_CONFIGS: Record<QuickKeysMode, QuickKeysModeConfig> = {
  flashcard: {
    mode: 'flashcard',
    buttons: [
      { actionId: 'fc_flip', label: 'FLIP' },
      { actionId: 'fc_type_recall', label: 'RECALL' },
      { actionId: 'fc_next', label: 'NEXT' },
      { actionId: 'fc_prev', label: 'PREV' },
      { actionId: 'fc_conf1', label: 'AGAIN' },
      { actionId: 'fc_conf2', label: 'HARD' },
      { actionId: 'fc_conf3', label: 'GOOD' },
      { actionId: 'fc_conf4', label: 'EASY' },
    ],
    dialAction: 'confidence',
  },
  quiz: {
    mode: 'quiz',
    buttons: [
      { actionId: 'qz_opt1', label: 'OPT 1' },
      { actionId: 'qz_opt2', label: 'OPT 2' },
      { actionId: 'qz_opt3', label: 'OPT 3' },
      { actionId: 'qz_opt4', label: 'OPT 4' },
      { actionId: 'qz_submit', label: 'SUBMIT' },
      { actionId: 'qz_continue', label: 'NEXT' },
      { actionId: 'qz_hint', label: 'HINT' },
      { actionId: 'fc_zen', label: 'ZEN' },
    ],
    dialAction: 'scroll',
  },
  drawing: {
    mode: 'drawing',
    buttons: [
      { actionId: 'draw_undo', label: 'UNDO' },
      { actionId: 'draw_redo', label: 'REDO' },
      { actionId: 'draw_pen', label: 'PEN' },
      { actionId: 'draw_highlight', label: 'HILITE' },
      { actionId: 'draw_erase', label: 'ERASE' },
      { actionId: 'draw_color', label: 'COLOR' },
      { actionId: 'draw_clear', label: 'CLEAR' },
      { actionId: 'draw_save', label: 'SAVE' },
    ],
    dialAction: 'brushSize',
  },
  navigation: {
    mode: 'navigation',
    buttons: [
      { actionId: 'nav_home', label: 'HOME' },
      { actionId: 'nav_quiz', label: 'QUIZ' },
      { actionId: 'nav_cards', label: 'CARDS' },
      { actionId: 'nav_notes', label: 'NOTES' },
      { actionId: 'nav_timer', label: 'TIMER' },
      { actionId: 'nav_calendar', label: 'CAL' },
      { actionId: 'nav_learn', label: 'LEARN' },
      { actionId: 'nav_settings', label: 'SETT' },
    ],
    dialAction: 'scroll',
  },
  notes: {
    mode: 'notes',
    buttons: [
      { actionId: 'notes_new', label: 'NEW' },
      { actionId: 'notes_search', label: 'SEARCH' },
      { actionId: 'relay_send', label: 'RELAY' },
      { actionId: 'screen_lasso', label: 'LASSO' },
      { actionId: 'notes_bold', label: 'BOLD' },
      { actionId: 'notes_italic', label: 'ITALIC' },
      { actionId: 'notes_save', label: 'SAVE' },
      { actionId: 'notes_speak', label: 'SPEAK' },
    ],
    dialAction: 'scroll',
  },
};

export const ALL_QUICK_KEY_ACTIONS = [
  // Flashcards
  { id: 'fc_flip', label: 'Flip Card', category: 'flashcard' },
  { id: 'fc_type_recall', label: 'Type-Recall Mode', category: 'flashcard' },
  { id: 'fc_next', label: 'Next Card', category: 'flashcard' },
  { id: 'fc_prev', label: 'Previous Card', category: 'flashcard' },
  { id: 'fc_conf1', label: 'Grade: Again', category: 'flashcard' },
  { id: 'fc_conf2', label: 'Grade: Hard', category: 'flashcard' },
  { id: 'fc_conf3', label: 'Grade: Good', category: 'flashcard' },
  { id: 'fc_conf4', label: 'Grade: Easy', category: 'flashcard' },
  { id: 'fc_zen', label: 'Zen Mode', category: 'flashcard' },
  { id: 'fc_cram', label: 'Cram Mode', category: 'flashcard' },
  { id: 'fc_rsvp', label: 'Speed Preview (RSVP)', category: 'flashcard' },
  // Quiz
  { id: 'qz_opt1', label: 'Quiz Option 1', category: 'quiz' },
  { id: 'qz_opt2', label: 'Quiz Option 2', category: 'quiz' },
  { id: 'qz_opt3', label: 'Quiz Option 3', category: 'quiz' },
  { id: 'qz_opt4', label: 'Quiz Option 4', category: 'quiz' },
  { id: 'qz_submit', label: 'Submit Answer', category: 'quiz' },
  { id: 'qz_continue', label: 'Next Question', category: 'quiz' },
  { id: 'qz_hint', label: 'Show Hint', category: 'quiz' },
  // Drawing
  { id: 'draw_undo', label: 'Undo', category: 'drawing' },
  { id: 'draw_redo', label: 'Redo', category: 'drawing' },
  { id: 'draw_pen', label: 'Pen Tool', category: 'drawing' },
  { id: 'draw_highlight', label: 'Highlight Tool', category: 'drawing' },
  { id: 'draw_erase', label: 'Erase', category: 'drawing' },
  { id: 'draw_color', label: 'Pick Color', category: 'drawing' },
  { id: 'draw_clear', label: 'Clear Canvas', category: 'drawing' },
  { id: 'draw_save', label: 'Save Drawing', category: 'drawing' },
  // Navigation
  { id: 'nav_home', label: 'Go to Home', category: 'navigation' },
  { id: 'nav_quiz', label: 'Go to Quiz', category: 'navigation' },
  { id: 'nav_cards', label: 'Go to Flashcards', category: 'navigation' },
  { id: 'nav_notes', label: 'Go to Library', category: 'navigation' },
  { id: 'nav_timer', label: 'Go to Timer', category: 'navigation' },
  { id: 'nav_calendar', label: 'Go to Calendar', category: 'navigation' },
  { id: 'nav_learn', label: 'Go to Learn', category: 'navigation' },
  { id: 'nav_settings', label: 'Go to Settings', category: 'navigation' },
  // Notes
  { id: 'notes_new', label: 'New Note', category: 'notes' },
  { id: 'notes_search', label: 'Search Notes', category: 'notes' },
  { id: 'relay_send', label: 'Send to Relay', category: 'notes' },
  { id: 'screen_lasso', label: 'Screen Lasso', category: 'notes' },
  { id: 'notes_bold', label: 'Bold Text', category: 'notes' },
  { id: 'notes_italic', label: 'Italic Text', category: 'notes' },
  { id: 'notes_save', label: 'Save Note', category: 'notes' },
  { id: 'notes_speak', label: 'Speak Note', category: 'notes' },
] as const;

export class QuickKeysService {
  private device: unknown = null;
  private config: QuickKeysConfig;
  private subscribers = new Set<() => void>();
  private buttonHandlers = new Map<number, Set<(actionId: string) => void>>();
  private dialHandlers = new Set<(delta: number, mode: QuickKeysMode) => void>();
  private _connected = false;

  constructor() {
    this.config = this.loadConfig();
  }

  static isSupported(): boolean {
    return 'hid' in navigator;
  }

  get connected(): boolean {
    return this._connected;
  }

  async connect(): Promise<void> {
    // Dynamic import — only loads the WebHID package when user explicitly connects
    const { requestXencelabsQuickKeys } = await import('@xencelabs-quick-keys/webhid');
    this.device = await requestXencelabsQuickKeys();
    const dev = this.device as any;

    // Button press handler
    dev.on('keyDown', (keyIndex: number) => {
      if (!document.hasFocus()) return; // Only active tab handles buttons
      const modeConfig = this.config.modes[this.config.currentMode];
      const btn = modeConfig.buttons[keyIndex];
      if (!btn) return;
      window.dispatchEvent(new CustomEvent('nousai-action', { detail: btn.actionId }));
      const handlers = this.buttonHandlers.get(keyIndex);
      handlers?.forEach((h) => h(btn.actionId));
    });

    // Dial rotation handler
    dev.on('wheel', (delta: number) => {
      if (!document.hasFocus()) return;
      window.dispatchEvent(new CustomEvent('nousai-dial', { detail: { delta, mode: this.config.currentMode } }));
      this.dialHandlers.forEach((h) => h(delta, this.config.currentMode));
    });

    // Disconnect handler
    dev.on('disconnect', () => {
      this._connected = false;
      setQuickKeysConnected(false);
      window.dispatchEvent(new CustomEvent('nousai-quickkeys-disconnected'));
      this.notify();
    });

    this._connected = true;
    setQuickKeysConnected(true);
    await this.updateOledLabels();
    this.notify();
  }

  async disconnect(): Promise<void> {
    try { (this.device as any)?.close?.(); } catch { /* non-fatal */ }
    this.device = null;
    this._connected = false;
    setQuickKeysConnected(false);
    this.notify();
  }

  setMode(mode: QuickKeysMode): void {
    this.config.currentMode = mode;
    this.saveConfig(this.config);
    if (this._connected) this.updateOledLabels().catch(() => {});
    this.notify();
  }

  getConfig(): QuickKeysConfig {
    return { ...this.config };
  }

  saveConfig(config: QuickKeysConfig): void {
    this.config = config;
    try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch { /* storage full */ }
  }

  onButton(buttonIndex: number, handler: (actionId: string) => void): () => void {
    if (!this.buttonHandlers.has(buttonIndex)) {
      this.buttonHandlers.set(buttonIndex, new Set());
    }
    this.buttonHandlers.get(buttonIndex)!.add(handler);
    return () => this.buttonHandlers.get(buttonIndex)?.delete(handler);
  }

  onDial(handler: (delta: number, mode: QuickKeysMode) => void): () => void {
    this.dialHandlers.add(handler);
    return () => this.dialHandlers.delete(handler);
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private notify(): void {
    this.subscribers.forEach((l) => l());
  }

  private async updateOledLabels(): Promise<void> {
    if (!this.device || !this._connected) return;
    const dev = this.device as any;
    const modeConfig = this.config.modes[this.config.currentMode];
    const [r, g, b] = MODE_COLORS[this.config.currentMode];

    for (let i = 0; i < 8; i++) {
      const label = modeConfig.buttons[i]?.label.slice(0, 8) ?? '';
      try {
        await dev.setKeyText?.(i, label);
        await dev.setKeyColor?.(i, r, g, b);
      } catch { /* device may not support per-key color */ }
    }
  }

  private loadConfig(): QuickKeysConfig {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Merge with defaults to pick up new mode configs
        return {
          ...parsed,
          modes: { ...DEFAULT_CONFIGS, ...parsed.modes },
        };
      }
    } catch { /* corrupt — use defaults */ }
    return { modes: DEFAULT_CONFIGS, currentMode: 'navigation' };
  }
}

// Singleton exported for use across the app
export const quickKeysService = new QuickKeysService();
