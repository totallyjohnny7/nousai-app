/**
 * Shared Game Storage Utility
 *
 * Consolidates the save/load/clear pattern used across all 11+ game files.
 * Each game uses the key format: nousai-game-{gameId}-progress
 *
 * Storage: IndexedDB (primary) via DataRepository. localStorage is only used
 * as a sync read during the migration window (cleared on first save).
 *
 * Usage:
 *   import { loadGameProgress, saveGameProgress } from '../utils/gameStorage';
 *   const state = loadGameProgress('my-game', DEFAULT_STATE);
 *   saveGameProgress('my-game', updatedState);
 */

import { DataRepository } from './dataRepository';

const KEY_PREFIX = 'nousai-game-';
const KEY_SUFFIX = '-progress';

function lsKey(gameId: string): string {
  return `${KEY_PREFIX}${gameId}${KEY_SUFFIX}`;
}

// Module-level in-memory cache — keeps reads synchronous after first load
const _cache = new Map<string, unknown>();

/** Load saved game progress, returning defaultState if nothing is saved or on parse error */
export function loadGameProgress<T>(gameId: string, defaultState: T): T {
  // Return from memory cache if available
  if (_cache.has(gameId)) return _cache.get(gameId) as T;

  // Fallback: read from localStorage (only populated before migration runs)
  try {
    const raw = localStorage.getItem(lsKey(gameId));
    if (raw) {
      const parsed = JSON.parse(raw) as T;
      _cache.set(gameId, parsed);
      return parsed;
    }
  } catch { /* ignore */ }

  return defaultState;
}

/** Save game progress to IDB (async, fire-and-forget). Removes LS copy to free space. */
export function saveGameProgress<T>(gameId: string, state: T): void {
  _cache.set(gameId, state);
  DataRepository.set(lsKey(gameId), state).catch(e =>
    console.warn(`[gameStorage] IDB write failed for ${gameId}:`, e)
  );
  // Remove from localStorage to free quota (migration cleanup)
  localStorage.removeItem(lsKey(gameId));
}

/** Clear saved game progress */
export function clearGameProgress(gameId: string): void {
  _cache.delete(gameId);
  DataRepository.delete(lsKey(gameId)).catch(() => {});
  localStorage.removeItem(lsKey(gameId));
}

/** Check if a game has saved progress */
export function hasGameProgress(gameId: string): boolean {
  return _cache.has(gameId) || localStorage.getItem(lsKey(gameId)) !== null;
}

/**
 * Migrate all game progress keys from localStorage to IDB.
 * Called once on app startup. Safe to call multiple times.
 */
export async function migrateGameStorage(gameIds: string[]): Promise<void> {
  const keys = gameIds.map(lsKey);
  await DataRepository.migrateFromLocalStorage(keys);
  // Hydrate cache from IDB for any migrated games
  for (const gameId of gameIds) {
    if (!_cache.has(gameId)) {
      const data = await DataRepository.get(lsKey(gameId));
      if (data !== null) _cache.set(gameId, data);
    }
  }
}
