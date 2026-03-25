/**
 * Elgato Stream Deck MK.2 Service — NousAI
 *
 * Singleton service for WebHID Stream Deck integration.
 * Uses @elgato-stream-deck/webhid (by Julusian).
 * Supports 5 modes with 15 programmable LCD keys per mode.
 *
 * Compatible: Chrome/Edge on Windows/macOS ONLY.
 * Not available: Firefox, Safari, iPad, Boox, Capacitor WebView.
 *
 * ## Library API (simpler than Xencelabs)
 * - requestStreamDecks() shows the HID picker and returns StreamDeckWeb[] directly.
 * - getStreamDecks() silently reconnects previously authorized devices (no popup).
 * - device.on('down', keyIndex) / device.on('up', keyIndex) for key events.
 * - device.fillKeyColor(keyIndex, r, g, b) fills an LCD key with a solid color.
 * - device.fillKeyCanvas(keyIndex, canvas) renders a 72×72 canvas on a key (icons + text).
 * - device.setBrightness(percent) controls overall brightness.
 * - No startData() call needed — device is ready immediately after open.
 */

import { setStreamDeckConnected } from './deviceDetection';
import { saveQKConfig, loadQKConfig } from './auth';
import { renderKeyIcon, renderEmptyKey } from './streamDeckIcons';
import { log, warn } from './logger';

export type StreamDeckMode = 'flashcard' | 'quiz' | 'drawing' | 'navigation' | 'notes';

export interface StreamDeckButtonConfig {
  actionId: string;
  label: string; // display label (used in UI and virtual panel)
}

export interface StreamDeckModeConfig {
  mode: StreamDeckMode;
  buttons: StreamDeckButtonConfig[]; // exactly 15 for Stream Deck MK.2
}

export interface StreamDeckConfig {
  modes: Record<StreamDeckMode, StreamDeckModeConfig>;
  currentMode: StreamDeckMode;
}

const LS_KEY = 'nousai-stream-deck-config';

// LCD key color per mode (used for fillKeyColor feedback)
const MODE_COLORS: Record<StreamDeckMode, [number, number, number]> = {
  flashcard: [245, 166, 35],  // amber
  navigation: [59, 130, 246], // blue
  drawing: [34, 197, 94],     // green
  notes: [168, 85, 247],      // purple
  quiz: [239, 68, 68],        // red
};

// DEFAULT_CONFIGS — Science-backed Stream Deck layouts (5 modes × 15 buttons, 3 rows × 5 cols)
//
// Design principles applied:
//   Row 3 (buttons 10-14) is ALWAYS the grading row (Again/Hard/Good/Easy + utility) across all
//   modes — Fitts's Law muscle memory, no visual search needed for the most frequent action.
//   Lasso (screen_lasso) appears in every mode — always reachable without mode-switching.
//   Drawing tools (Pen/Highlight/Erase) appear in both drawing AND notes modes — students
//   annotate everywhere, not just in the dedicated drawing canvas.
//   TTS Read (notes_speak) appears in flashcard, navigation, and notes — auditory encoding
//   (dual coding theory, Paivio 1986) reinforces retrieval across all primary study modes.
//   Retrieval practice row (Row 1) is the primary action row — spacing and active recall
//   (Roediger & Karpicke 2006) are the highest-leverage study strategies.
const DEFAULT_CONFIGS: Record<StreamDeckMode, StreamDeckModeConfig> = {
  // Mode 1: Flashcard — Active Recall Engine (amber)
  // Row 1: core card controls (flip, navigate, speed tools)
  // Row 2: advanced modes + cross-device utilities
  // Row 3: FSRS grading row (muscle memory anchor) + Learn Modes nav
  flashcard: {
    mode: 'flashcard',
    buttons: [
      // Row 1 — Primary card controls
      { actionId: 'fc_flip',        label: 'Flip Card' },
      { actionId: 'fc_next',        label: 'Next Card' },
      { actionId: 'fc_prev',        label: 'Prev Card' },
      { actionId: 'fc_rsvp',        label: 'Speed Preview' },
      { actionId: 'fc_cram',        label: 'Cram Mode' },
      // Row 2 — Advanced study modes + utilities
      { actionId: 'fc_type_recall', label: 'Type-Recall' },
      { actionId: 'fc_zen',         label: 'Zen Mode' },
      { actionId: 'screen_lasso',   label: 'Lasso' },
      { actionId: 'notes_speak',    label: 'TTS Read' },
      // Row 3 — FSRS grading (muscle memory row, constant across all modes)
      { actionId: 'fc_conf1',       label: 'Again' },
      { actionId: 'fc_conf2',       label: 'Hard' },
      { actionId: 'fc_conf3',       label: 'Good' },
      { actionId: 'fc_conf4',       label: 'Easy' },
      { actionId: 'nav_learn',      label: 'Learn Modes' },
    ],
  },

  // Mode 2: Quiz — Answer Selection Engine (red)
  // Row 1: answer options A-D + hint
  // Row 2: submit/continue flow + utilities
  // Row 3: grading row (consistent muscle memory) + Learn Modes nav
  quiz: {
    mode: 'quiz',
    buttons: [
      // Row 1 — Answer options
      { actionId: 'qz_opt1',      label: 'Option A' },
      { actionId: 'qz_opt2',      label: 'Option B' },
      { actionId: 'qz_opt3',      label: 'Option C' },
      { actionId: 'qz_opt4',      label: 'Option D' },
      { actionId: 'qz_hint',      label: 'Hint' },
      // Row 2 — Submit/continue flow + utilities
      { actionId: 'qz_submit',    label: 'Submit' },
      { actionId: 'qz_continue',  label: 'Next Q' },
      { actionId: 'screen_lasso', label: 'Lasso' },
      { actionId: 'notes_speak',  label: 'TTS Read' },
      // Row 3 — Grading row (muscle memory)
      { actionId: 'fc_conf1',     label: 'Again' },
      { actionId: 'fc_conf2',     label: 'Hard' },
      { actionId: 'fc_conf3',     label: 'Good' },
      { actionId: 'fc_conf4',     label: 'Easy' },
      { actionId: 'nav_learn',    label: 'Learn Modes' },
    ],
  },

  // Mode 3: Drawing — Annotation Engine (green)
  // Row 1: tool selection (pen, highlight, erase, color, clear)
  // Row 2: history + save + utilities
  // Row 3: grading row + Learn Modes nav
  drawing: {
    mode: 'drawing',
    buttons: [
      // Row 1 — Drawing tools
      { actionId: 'draw_pen',       label: 'Pen' },
      { actionId: 'draw_highlight', label: 'Highlight' },
      { actionId: 'draw_erase',     label: 'Erase' },
      { actionId: 'draw_color',     label: 'Color' },
      { actionId: 'draw_clear',     label: 'Clear' },
      // Row 2 — History, save, and utilities
      { actionId: 'draw_undo',      label: 'Undo' },
      { actionId: 'draw_redo',      label: 'Redo' },
      { actionId: 'draw_save',      label: 'Save' },
      { actionId: 'screen_lasso',   label: 'Lasso' },
      // Row 3 — Grading row (muscle memory)
      { actionId: 'fc_conf1',       label: 'Again' },
      { actionId: 'fc_conf2',       label: 'Hard' },
      { actionId: 'fc_conf3',       label: 'Good' },
      { actionId: 'fc_conf4',       label: 'Easy' },
      { actionId: 'nav_learn',      label: 'Learn Modes' },
    ],
  },

  // Mode 4: Navigation — App Launchpad (blue)
  // Row 1: primary destinations (home, cards, quiz, learn, library)
  // Row 2: tools + utilities
  // Row 3: grading row + TTS Read
  navigation: {
    mode: 'navigation',
    buttons: [
      // Row 1 — Primary app destinations
      { actionId: 'nav_home',       label: 'Home' },
      { actionId: 'nav_cards',      label: 'Flashcards' },
      { actionId: 'nav_quiz',       label: 'Quiz' },
      { actionId: 'nav_learn',      label: 'Learn' },
      { actionId: 'nav_notes',      label: 'Library' },
      // Row 2 — Productivity tools + utilities
      { actionId: 'nav_timer',      label: 'Timer' },
      { actionId: 'nav_calendar',   label: 'Calendar' },
      { actionId: 'nav_settings',   label: 'Settings' },
      { actionId: 'screen_lasso',   label: 'Lasso' },
      // Row 3 — Grading row (muscle memory)
      { actionId: 'fc_conf1',       label: 'Again' },
      { actionId: 'fc_conf2',       label: 'Hard' },
      { actionId: 'fc_conf3',       label: 'Good' },
      { actionId: 'fc_conf4',       label: 'Easy' },
      { actionId: 'notes_speak',    label: 'TTS Read' },
    ],
  },

  // Mode 5: Notes — Knowledge Capture Engine (purple)
  // Row 1: note management + text formatting
  // Row 2: annotation tools + utilities (drawing tools here too — students annotate everywhere)
  // Row 3: grading row + TTS Read
  notes: {
    mode: 'notes',
    buttons: [
      // Row 1 — Note management + formatting
      { actionId: 'notes_new',      label: 'New Note' },
      { actionId: 'notes_search',   label: 'Search' },
      { actionId: 'notes_bold',     label: 'Bold' },
      { actionId: 'notes_italic',   label: 'Italic' },
      { actionId: 'notes_save',     label: 'Save' },
      // Row 2 — Annotation tools + utilities
      { actionId: 'draw_pen',       label: 'Pen' },
      { actionId: 'draw_highlight', label: 'Highlight' },
      { actionId: 'draw_erase',     label: 'Erase' },
      { actionId: 'screen_lasso',   label: 'Lasso' },
      // Row 3 — Grading row (muscle memory)
      { actionId: 'fc_conf1',       label: 'Again' },
      { actionId: 'fc_conf2',       label: 'Hard' },
      { actionId: 'fc_conf3',       label: 'Good' },
      { actionId: 'fc_conf4',       label: 'Easy' },
      { actionId: 'notes_speak',    label: 'TTS Read' },
    ],
  },
};

export const ALL_STREAM_DECK_ACTIONS = [
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
  { id: 'screen_lasso', label: 'Screen Lasso', category: 'notes' },
  { id: 'notes_bold', label: 'Bold Text', category: 'notes' },
  { id: 'notes_italic', label: 'Italic Text', category: 'notes' },
  { id: 'notes_save', label: 'Save Note', category: 'notes' },
  { id: 'notes_speak', label: 'Speak Note', category: 'notes' },
] as const;

export { DEFAULT_CONFIGS as STREAM_DECK_DEFAULT_CONFIGS };

// Also export under old names for backwards compatibility during migration
export type QuickKeysMode = StreamDeckMode;
export type { StreamDeckButtonConfig as QuickKeysButtonConfig };
export type { StreamDeckModeConfig as QuickKeysModeConfig };
export type { StreamDeckConfig as QuickKeysConfig };
export { ALL_STREAM_DECK_ACTIONS as ALL_QUICK_KEY_ACTIONS };

export class StreamDeckService {
  private device: any = null;
  private config: StreamDeckConfig;
  private subscribers = new Set<() => void>();
  private buttonHandlers = new Map<number, Set<(actionId: string) => void>>();
  private _connected = false;
  // Preloaded module functions
  private _requestFn: ((opts?: any) => Promise<any[]>) | null = null;
  private _getFn: ((opts?: any) => Promise<any[]>) | null = null;
  private preloadPromise: Promise<void> | null = null;
  private uid: string | null = null;

  constructor() {
    this.config = this.loadConfig();
    if (StreamDeckService.isSupported()) {
      this.preload();
    }
  }

  static isSupported(): boolean {
    return 'hid' in navigator;
  }

  get connected(): boolean {
    return this._connected;
  }

  /** Set user ID. Call after sign-in. */
  setUid(uid: string | null): void {
    this.uid = uid;
    if (uid) {
      loadQKConfig(uid).then((cloudConfig) => {
        if (!cloudConfig) return;
        const merged: StreamDeckConfig = {
          ...(cloudConfig as StreamDeckConfig),
          modes: { ...DEFAULT_CONFIGS, ...(cloudConfig as StreamDeckConfig).modes },
        };
        this.config = merged;
        try { localStorage.setItem(LS_KEY, JSON.stringify(merged)); } catch { /* storage full */ }
        this.notify();
      }).catch(() => {});
    }
  }

  /** Pre-load the WebHID module before user clicks Connect. */
  preload(): Promise<void> {
    if (!this.preloadPromise) {
      this.preloadPromise = import('@elgato-stream-deck/webhid')
        .then((mod) => {
          this._requestFn = mod.requestStreamDecks;
          this._getFn = mod.getStreamDecks;
        })
        .catch(() => {});
    }
    return this.preloadPromise;
  }

  /**
   * Auto-reconnect to a previously authorized Stream Deck (no popup).
   * Uses getStreamDecks() which returns devices the user already granted.
   */
  async autoConnect(): Promise<boolean> {
    if (!StreamDeckService.isSupported()) return false;
    if (this._connected) return true;
    try {
      await this.preload();
      if (!this._getFn) return false;

      const devices = await this._getFn();
      if (!devices || devices.length === 0) return false;

      const device = devices[0];
      log('[StreamDeck] Auto-reconnected:', device.MODEL ?? 'Stream Deck');
      this._wireDevice(device);
      this._connected = true;
      setStreamDeckConnected(true);
      await this.updateKeyColors().catch(() => {});
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Connect to a Stream Deck via the browser HID picker.
   * requestStreamDecks() shows the browser popup and returns StreamDeckWeb[] directly.
   * No manager pattern, no event listening — much simpler than Xencelabs.
   */
  async connect(): Promise<void> {
    if (!StreamDeckService.isSupported()) {
      throw new Error('WebHID requires Chrome 89+ or Edge on Windows/macOS.');
    }

    // Ensure module is loaded
    if (!this._requestFn) {
      try {
        const mod = await import('@elgato-stream-deck/webhid');
        this._requestFn = mod.requestStreamDecks;
        this._getFn = mod.getStreamDecks;
      } catch {
        throw new Error('Could not load Stream Deck driver. Check your internet connection.');
      }
    }

    log('[StreamDeck] Requesting device...');

    let devices: any[];
    try {
      // requestStreamDecks() shows the HID picker and returns devices directly
      devices = await this._requestFn!();
    } catch (err) {
      throw this._friendlyError(err);
    }

    if (!devices || devices.length === 0) {
      throw new Error('No device selected. Try again and select your Stream Deck from the list.');
    }

    const device = devices[0];
    log('[StreamDeck] Device granted:', device.MODEL ?? 'Stream Deck');

    this._wireDevice(device);
    this._connected = true;
    setStreamDeckConnected(true);
    await this.updateKeyColors().catch(() => {});
    this.notify();
  }

  async disconnect(): Promise<void> {
    const dev = this.device;
    try { await dev?.close?.(); } catch { /* non-fatal */ }
    this.device = null;
    this._connected = false;
    setStreamDeckConnected(false);
    this.notify();
  }


  /** Dispatch action from virtual Stream Deck panel. */
  dispatchActionFromVirtual(actionId: string): void {
    this._dispatchAction(actionId);
  }

  /**
   * Wire device key events.
   * Stream Deck events: 'down', 'up', 'error'
   * No startData() needed — device is ready immediately.
   */
  private _wireDevice(device: any): void {
    this.device = device;

    device.on('down', (keyIndex: number) => {
      if (!document.hasFocus()) return;
      const btn = this.config.modes[this.config.currentMode].buttons[keyIndex];
      log(`[StreamDeck] Key down: ${keyIndex} → ${btn?.actionId ?? 'none'}`);
      if (btn) this._dispatchAction(btn.actionId);
    });

    device.on('error', (err: unknown) => {
      console.error('[StreamDeck] device error:', err);
    });

    // Handle disconnect
    device.on('error', (err: any) => {
      if (err?.message?.includes('disconnect') || err?.message?.includes('removed')) {
        log('[StreamDeck] Disconnected');
        this.device = null;
        this._connected = false;
        setStreamDeckConnected(false);
        window.dispatchEvent(new CustomEvent('nousai-streamdeck-disconnected'));
        this.notify();
      }
    });
  }

  /** Dispatch action locally. */
  private _dispatchAction(actionId: string): void {
    window.dispatchEvent(new CustomEvent('nousai-action', { detail: actionId }));
    const modeConfig = this.config.modes[this.config.currentMode];
    const keyIndex = modeConfig.buttons.findIndex((b) => b.actionId === actionId);
    if (keyIndex >= 0) {
      this.buttonHandlers.get(keyIndex)?.forEach((h) => h(actionId));
    }
  }

  /** Convert raw HID errors to user-readable messages. */
  private _friendlyError(err: unknown): Error {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Failed to open') || msg.includes('Unable to open') || msg.includes('Access denied')) {
      return new Error(
        'Could not claim the device. If the Elgato Stream Deck software is open, close it and try again — ' +
        'the driver and browser cannot share the device at the same time.'
      );
    }
    if (msg.includes('SecurityError') || msg.includes('gesture')) {
      return new Error('Click "Connect Stream Deck" directly to trigger the connection.');
    }
    if (msg.includes('NotFoundError') || msg.includes('No device selected')) {
      return new Error('No device selected.');
    }
    console.error('[StreamDeck] connect error:', err);
    return new Error(`Could not connect: ${msg}`);
  }

  setMode(mode: StreamDeckMode): void {
    this.config.currentMode = mode;
    this.saveConfig(this.config);
    this.notify();
  }

  getConfig(): StreamDeckConfig {
    return { ...this.config };
  }

  resetToDefaults(): void {
    const reset: StreamDeckConfig = { modes: DEFAULT_CONFIGS, currentMode: this.config.currentMode };
    this.saveConfig(reset);
    this.notify();
  }

  saveConfig(config: StreamDeckConfig): void {
    this.config = config;
    try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch { /* storage full */ }
    if (this._connected) this.updateKeyColors().catch(() => {});
    if (this.uid) {
      saveQKConfig(this.uid, config).catch(() => {});
    }
    this.notify();
  }

  onButton(buttonIndex: number, handler: (actionId: string) => void): () => void {
    if (!this.buttonHandlers.has(buttonIndex)) {
      this.buttonHandlers.set(buttonIndex, new Set());
    }
    this.buttonHandlers.get(buttonIndex)!.add(handler);
    return () => this.buttonHandlers.get(buttonIndex)?.delete(handler);
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  private notify(): void {
    this.subscribers.forEach((l) => l());
  }

  /**
   * Render rich icons on the physical Stream Deck LCD keys.
   * Each key shows: emoji icon + label + mode-colored gradient background.
   * Uses fillKeyCanvas() for 72×72 pixel canvas rendering.
   * Falls back to fillKeyColor() if canvas rendering is unavailable.
   *
   * Science: Dual coding (Paivio 1986) — icon + text = two retrieval pathways.
   * Fitts's Law — distinct icons reduce visual search time vs solid colors.
   */
  private async updateKeyColors(): Promise<void> {
    if (!this.device || !this._connected) return;
    const dev = this.device;
    const modeConfig = this.config.modes[this.config.currentMode];
    const modeColor = MODE_COLORS[this.config.currentMode];

    const hasFillKeyCanvas = typeof dev.fillKeyCanvas === 'function';

    for (let i = 0; i < 15; i++) {
      try {
        const btn = i < modeConfig.buttons.length ? modeConfig.buttons[i] : null;
        const hasAction = btn && btn.actionId;

        if (hasFillKeyCanvas) {
          // Rich icon rendering (72×72 canvas with emoji + label + gradient)
          const canvas = hasAction
            ? renderKeyIcon(btn.actionId, modeColor)
            : renderEmptyKey();
          await dev.fillKeyCanvas(i, canvas);
        } else {
          // Fallback: solid color only (older library versions)
          const [r, g, b] = modeColor;
          if (hasAction) {
            await dev.fillKeyColor?.(i, r, g, b);
          } else {
            await dev.fillKeyColor?.(i, 20, 20, 20);
          }
        }
      } catch (e) {
        warn(`[StreamDeck] key render(${i}) failed:`, e);
      }
    }
    log(`[StreamDeck] Icons rendered for mode: ${this.config.currentMode}`);
  }

  private loadConfig(): StreamDeckConfig {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          modes: { ...DEFAULT_CONFIGS, ...parsed.modes },
        };
      }
    } catch { /* corrupt — use defaults */ }
    return { modes: DEFAULT_CONFIGS, currentMode: 'navigation' };
  }
}

// Singleton
export const streamDeckService = new StreamDeckService();

// Backwards-compatible aliases
export { StreamDeckService as QuickKeysService };
export { streamDeckService as quickKeysService };
