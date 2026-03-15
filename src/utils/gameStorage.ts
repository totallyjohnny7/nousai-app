/**
 * Shared Game Storage Utility
 *
 * Consolidates the save/load/clear pattern used across all 11+ game files.
 * Each game uses the key format: nousai-game-{gameId}-progress
 *
 * Usage:
 *   import { loadGameProgress, saveGameProgress } from '../utils/gameStorage';
 *   const state = loadGameProgress('my-game', DEFAULT_STATE);
 *   saveGameProgress('my-game', updatedState);
 */

const KEY_PREFIX = 'nousai-game-';
const KEY_SUFFIX = '-progress';

/** Load saved game progress, returning defaultState if nothing is saved or on parse error */
export function loadGameProgress<T>(gameId: string, defaultState: T): T {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${gameId}${KEY_SUFFIX}`);
    return raw ? JSON.parse(raw) : defaultState;
  } catch {
    return defaultState;
  }
}

/** Save game progress to localStorage */
export function saveGameProgress<T>(gameId: string, state: T): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${gameId}${KEY_SUFFIX}`, JSON.stringify(state));
  } catch (e) {
    console.warn(`Failed to save game progress for ${gameId}:`, e);
  }
}

/** Clear saved game progress */
export function clearGameProgress(gameId: string): void {
  localStorage.removeItem(`${KEY_PREFIX}${gameId}${KEY_SUFFIX}`);
}

/** Check if a game has saved progress */
export function hasGameProgress(gameId: string): boolean {
  return localStorage.getItem(`${KEY_PREFIX}${gameId}${KEY_SUFFIX}`) !== null;
}
