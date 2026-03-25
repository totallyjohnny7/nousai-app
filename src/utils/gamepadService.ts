/**
 * GamepadService — NousAI
 *
 * Alternative input device backend using the standard Gamepad API.
 * Works with ANY USB/Bluetooth gamepad: Xbox controllers, PS5 DualSense,
 * 8BitDo Zero 2, 8BitDo Macro 3 Pad, Logitech F310/F710, and more.
 *
 * ## Why Gamepad API over WebHID?
 * - Zero permission dialogs — browser automatically detects on connect
 * - Works in Chrome, Firefox, Safari, Edge — no browser restrictions
 * - Works under Playwright/automation (not blocked by CDP)
 * - Compatible with iPad, Android, all platforms
 * - 8BitDo Zero 2 / Macro 3 Pad = same shape/size as Xencelabs Quick Keys
 *
 * ## Recommended devices (same "Quick Keys" form factor):
 * - 8BitDo Zero 2 — $20, 12 buttons, palm-sized, USB-C / Bluetooth
 * - 8BitDo Macro 3 Pad — dedicated macro pad, 12 buttons, USB-C / BT
 * - Any standard USB HID gamepad (Xbox, PS, generic)
 *
 * ## Architecture:
 * - Polling-based: RAF loop reads Gamepad.buttons[] each frame
 * - Compares vs prevState to detect press (false→true transitions)
 * - Shares the same StreamDeckMode/Config types as streamDeckService
 * - Fires identical 'nousai-action' + 'nousai-dial' CustomEvents
 */

import type { StreamDeckMode, StreamDeckModeConfig, StreamDeckConfig } from './streamDeckService';
import { STREAM_DECK_DEFAULT_CONFIGS } from './streamDeckService';

// Backwards-compatible type aliases used throughout this file
type QuickKeysMode = StreamDeckMode;
type QuickKeysModeConfig = StreamDeckModeConfig;
type QuickKeysConfig = StreamDeckConfig;
const QUICK_KEYS_DEFAULT_CONFIGS = STREAM_DECK_DEFAULT_CONFIGS;

const LS_KEY = 'nousai-gamepad-config';

/**
 * Standard gamepad button indices (Web Gamepad API spec layout).
 * Used as labels in the Settings UI.
 */
export const GAMEPAD_BUTTON_LABELS: Record<number, string> = {
  0: 'A / Cross',
  1: 'B / Circle',
  2: 'X / Square',
  3: 'Y / Triangle',
  4: 'LB / L1',
  5: 'RB / R1',
  6: 'LT / L2',
  7: 'RT / R2',
  8: 'Back / Select',
  9: 'Start / Options',
  10: 'L3 (Left Stick Click)',
  11: 'R3 (Right Stick Click)',
  12: 'D-Pad Up',
  13: 'D-Pad Down',
  14: 'D-Pad Left',
  15: 'D-Pad Right',
};

export interface GamepadButtonMapping {
  gamepadIndex: number;   // physical button index on the gamepad (0-15)
  actionId: string;        // NousAI action ID (same as Quick Keys)
}

export interface GamepadModeConfig {
  mode: QuickKeysMode;
  /** 8 button slots — each maps a physical gamepad button to a NousAI action */
  buttons: GamepadButtonMapping[];
  /** Which axis index (0=leftX, 1=leftY, 2=rightX, 3=rightY) acts as the "dial" */
  dialAxis: number;
  /** Axis threshold to trigger a dial event (prevents drift) */
  dialThreshold: number;
}

export interface GamepadConfig {
  modes: Record<QuickKeysMode, GamepadModeConfig>;
  currentMode: QuickKeysMode;
}

/** Default gamepad button → action mappings (mirrors Quick Keys defaults) */
const DEFAULT_GAMEPAD_CONFIGS: Record<QuickKeysMode, GamepadModeConfig> = {
  flashcard: {
    mode: 'flashcard',
    buttons: [
      { gamepadIndex: 0,  actionId: 'fc_flip' },    // A / Cross     = Flip
      { gamepadIndex: 1,  actionId: 'fc_conf1' },   // B / Circle    = Again
      { gamepadIndex: 2,  actionId: 'fc_conf3' },   // X / Square    = Good
      { gamepadIndex: 3,  actionId: 'fc_conf4' },   // Y / Triangle  = Easy
      { gamepadIndex: 4,  actionId: 'fc_prev' },    // LB / L1       = Prev
      { gamepadIndex: 5,  actionId: 'fc_next' },    // RB / R1       = Next
      { gamepadIndex: 12, actionId: 'fc_conf2' },   // D-Up          = Hard
      { gamepadIndex: 13, actionId: 'fc_type_recall' }, // D-Down    = Type Recall
    ],
    dialAxis: 0,        // Left stick horizontal
    dialThreshold: 0.5,
  },
  quiz: {
    mode: 'quiz',
    buttons: [
      { gamepadIndex: 2,  actionId: 'qz_opt1' },    // X = Opt 1
      { gamepadIndex: 3,  actionId: 'qz_opt2' },    // Y = Opt 2
      { gamepadIndex: 1,  actionId: 'qz_opt3' },    // B = Opt 3
      { gamepadIndex: 0,  actionId: 'qz_opt4' },    // A = Opt 4
      { gamepadIndex: 4,  actionId: 'qz_hint' },    // LB = Hint
      { gamepadIndex: 5,  actionId: 'qz_submit' },  // RB = Submit
      { gamepadIndex: 9,  actionId: 'qz_continue' },// Start = Next
      { gamepadIndex: 8,  actionId: 'fc_zen' },     // Back = Zen
    ],
    dialAxis: 0,
    dialThreshold: 0.5,
  },
  drawing: {
    mode: 'drawing',
    buttons: [
      { gamepadIndex: 3,  actionId: 'draw_undo' },
      { gamepadIndex: 1,  actionId: 'draw_redo' },
      { gamepadIndex: 2,  actionId: 'draw_pen' },
      { gamepadIndex: 0,  actionId: 'draw_erase' },
      { gamepadIndex: 4,  actionId: 'draw_highlight' },
      { gamepadIndex: 5,  actionId: 'draw_color' },
      { gamepadIndex: 12, actionId: 'draw_clear' },
      { gamepadIndex: 13, actionId: 'draw_save' },
    ],
    dialAxis: 0,
    dialThreshold: 0.3,
  },
  navigation: {
    mode: 'navigation',
    buttons: [
      { gamepadIndex: 12, actionId: 'nav_home' },
      { gamepadIndex: 15, actionId: 'nav_quiz' },
      { gamepadIndex: 14, actionId: 'nav_cards' },
      { gamepadIndex: 13, actionId: 'nav_notes' },
      { gamepadIndex: 0,  actionId: 'nav_learn' },
      { gamepadIndex: 9,  actionId: 'nav_settings' },
      { gamepadIndex: 4,  actionId: 'nav_timer' },
      { gamepadIndex: 5,  actionId: 'nav_calendar' },
    ],
    dialAxis: 0,
    dialThreshold: 0.5,
  },
  notes: {
    mode: 'notes',
    buttons: [
      { gamepadIndex: 3,  actionId: 'notes_new' },
      { gamepadIndex: 0,  actionId: 'notes_search' },
      { gamepadIndex: 2,  actionId: 'notes_search' },
      { gamepadIndex: 1,  actionId: 'screen_lasso' },
      { gamepadIndex: 4,  actionId: 'notes_bold' },
      { gamepadIndex: 5,  actionId: 'notes_italic' },
      { gamepadIndex: 9,  actionId: 'notes_save' },
      { gamepadIndex: 8,  actionId: 'notes_speak' },
    ],
    dialAxis: 0,
    dialThreshold: 0.5,
  },
};

export class GamepadService {
  private config: GamepadConfig;
  private subscribers = new Set<() => void>();
  private rafHandle: number | null = null;
  /** gamepad.index → previous button pressed states */
  private prevButtonState = new Map<number, boolean[]>();
  /** gamepad.index → previous axis positions for dial */
  private prevAxisState = new Map<number, number[]>();
  /** Currently active gamepad index (-1 = none) */
  private activeGamepadIndex = -1;
  private _connectedName: string | null = null;

  constructor() {
    this.config = this._loadConfig();
    this._startListeners();
  }

  static isSupported(): boolean {
    return 'getGamepads' in navigator;
  }

  get connected(): boolean {
    return this.activeGamepadIndex >= 0;
  }

  get connectedDeviceName(): string | null {
    return this._connectedName;
  }

  getConfig(): GamepadConfig {
    return { ...this.config };
  }

  getDefaultConfig(): GamepadConfig {
    return { modes: DEFAULT_GAMEPAD_CONFIGS, currentMode: 'navigation' };
  }

  saveConfig(config: GamepadConfig): void {
    this.config = config;
    try { localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch { /* storage full */ }
    this._notify();
  }

  resetToDefaults(): void {
    this.saveConfig({ modes: DEFAULT_GAMEPAD_CONFIGS, currentMode: this.config.currentMode });
  }

  setMode(mode: QuickKeysMode): void {
    this.config.currentMode = mode;
    this.saveConfig(this.config);
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener);
    return () => this.subscribers.delete(listener);
  }

  /** Disconnect and stop polling (cleanup) */
  destroy(): void {
    this._stopPolling();
    window.removeEventListener('gamepadconnected', this._handleConnect);
    window.removeEventListener('gamepaddisconnected', this._handleDisconnect);
  }

  /** Arrow function fields are pre-bound — no .bind(this) needed, safe for addEventListener */
  private readonly _handleConnect = (e: Event): void => {
    const gp = (e as GamepadEvent).gamepad;
    if (this.activeGamepadIndex < 0) {
      this.activeGamepadIndex = gp.index;
      this._connectedName = gp.id;
      this._startPolling();
      this._notify();
      console.log(`[Gamepad] Connected: ${gp.id}`);
    }
  };

  private readonly _handleDisconnect = (e: Event): void => {
    const gp = (e as GamepadEvent).gamepad;
    if (gp.index === this.activeGamepadIndex) {
      this._stopPolling();
      this.activeGamepadIndex = -1;
      this._connectedName = null;
      this.prevButtonState.delete(gp.index);
      this.prevAxisState.delete(gp.index);
      console.log(`[Gamepad] Disconnected: ${gp.id}`);
      this._checkExistingGamepads();
      this._notify();
    }
  };

  private _startListeners(): void {
    window.addEventListener('gamepadconnected', this._handleConnect);
    window.addEventListener('gamepaddisconnected', this._handleDisconnect);
    this._checkExistingGamepads();
  }

  private _checkExistingGamepads(): void {
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (pad) {
        this.activeGamepadIndex = pad.index;
        this._connectedName = pad.id;
        this._startPolling();
        this._notify();
        break;
      }
    }
  }

  private _startPolling(): void {
    if (this.rafHandle !== null) return;
    const poll = () => {
      this._pollGamepad();
      this.rafHandle = requestAnimationFrame(poll);
    };
    this.rafHandle = requestAnimationFrame(poll);
  }

  private _stopPolling(): void {
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
  }

  private _pollGamepad(): void {
    if (!document.hasFocus()) return;
    const pads = navigator.getGamepads();
    const pad = pads[this.activeGamepadIndex];
    if (!pad) return;

    const modeConfig = this.config.modes[this.config.currentMode];
    const prevButtons = this.prevButtonState.get(pad.index) ?? new Array(pad.buttons.length).fill(false);
    const prevAxes = this.prevAxisState.get(pad.index) ?? new Array(pad.axes.length).fill(0);

    // ── Button press detection (false → true transition) ──────────────────
    for (const mapping of modeConfig.buttons) {
      const btn = pad.buttons[mapping.gamepadIndex];
      if (!btn) continue;
      const wasPressed = prevButtons[mapping.gamepadIndex] ?? false;
      const isPressed = btn.pressed;
      if (isPressed && !wasPressed) {
        // Rising edge — fire action
        window.dispatchEvent(new CustomEvent('nousai-action', { detail: mapping.actionId }));
        console.log(`[Gamepad] Btn ${mapping.gamepadIndex} → ${mapping.actionId}`);
      }
    }

    // ── Axis-as-dial detection ─────────────────────────────────────────────
    const axisVal = pad.axes[modeConfig.dialAxis] ?? 0;
    const prevAxisVal = prevAxes[modeConfig.dialAxis] ?? 0;
    const threshold = modeConfig.dialThreshold;
    // Fire when axis crosses threshold in either direction (once per crossing)
    if (axisVal > threshold && prevAxisVal <= threshold) {
      window.dispatchEvent(new CustomEvent('nousai-dial', { detail: { delta: 1, mode: this.config.currentMode } }));
    } else if (axisVal < -threshold && prevAxisVal >= -threshold) {
      window.dispatchEvent(new CustomEvent('nousai-dial', { detail: { delta: -1, mode: this.config.currentMode } }));
    }

    // ── Store state for next frame ─────────────────────────────────────────
    this.prevButtonState.set(pad.index, pad.buttons.map(b => b.pressed));
    this.prevAxisState.set(pad.index, [...pad.axes]);
  }

  private _notify(): void {
    this.subscribers.forEach(l => l());
  }

  private _loadConfig(): GamepadConfig {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GamepadConfig>;
        return {
          ...parsed,
          modes: { ...DEFAULT_GAMEPAD_CONFIGS, ...(parsed.modes ?? {}) },
          currentMode: parsed.currentMode ?? 'navigation',
        };
      }
    } catch { /* corrupt — use defaults */ }
    return { modes: DEFAULT_GAMEPAD_CONFIGS, currentMode: 'navigation' };
  }
}

/** Singleton exported for use across the app */
export const gamepadService = new GamepadService();

/** Re-export types so Settings can use them without importing QuickKeysService */
export type { QuickKeysMode };
export { QUICK_KEYS_DEFAULT_CONFIGS };
