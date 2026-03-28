/**
 * DataRepository — Typed Storage with IDB Primary + localStorage Fallback
 *
 * Provides a consistent typed interface for reading and writing app data.
 * Primary storage: IndexedDB (survives page reloads, larger quota)
 * Fallback: localStorage (for environments where IDB is unavailable)
 *
 * On write: persists to both (belt-and-suspenders)
 * On read failure from IDB: falls back to localStorage with warning
 */

const REPO_DB_NAME = 'nousai-repository';
const REPO_STORE = 'kv';

// ── IDB helpers ───────────────────────────────────────────────────────────────

function openRepoDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(REPO_DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(REPO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openRepoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPO_STORE, 'readonly');
    const req = tx.objectStore(REPO_STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openRepoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPO_STORE, 'readwrite');
    tx.objectStore(REPO_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openRepoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REPO_STORE, 'readwrite');
    tx.objectStore(REPO_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`__repo_${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`__repo_${key}`, JSON.stringify(value));
  } catch (e) {
    console.warn('[DataRepository] localStorage write failed:', e);
  }
}

function lsDelete(key: string): void {
  try {
    localStorage.removeItem(`__repo_${key}`);
  } catch { /* ignore */ }
}

// ── DataRepository class ──────────────────────────────────────────────────────

export class DataRepository {
  private static idbAvailable: boolean | null = null;

  private static async checkIDB(): Promise<boolean> {
    if (DataRepository.idbAvailable !== null) return DataRepository.idbAvailable;
    try {
      await openRepoDB();
      DataRepository.idbAvailable = true;
    } catch {
      DataRepository.idbAvailable = false;
      console.warn('[DataRepository] IDB unavailable, falling back to localStorage');
    }
    return DataRepository.idbAvailable;
  }

  /**
   * Get a value by key.
   * Tries IDB first; falls back to localStorage on failure.
   */
  static async get<T>(key: string): Promise<T | null> {
    const useIDB = await DataRepository.checkIDB();

    if (useIDB) {
      try {
        const value = await idbGet<T>(key);
        return value;
      } catch (e) {
        console.warn(`[DataRepository] IDB read failed for "${key}", trying localStorage:`, e);
        // Fall through to localStorage
      }
    }

    const lsValue = lsGet<T>(key);
    if (lsValue !== null) {
      console.warn(`[DataRepository] Read "${key}" from localStorage fallback`);
    }
    return lsValue;
  }

  /**
   * Set a value by key.
   * Writes to IDB (primary). Falls back to localStorage only if IDB is unavailable.
   */
  static async set<T>(key: string, value: T): Promise<void> {
    const useIDB = await DataRepository.checkIDB();

    // SYNC FIX #22: Actually write to both layers (belt-and-suspenders as documented)
    if (useIDB) {
      try {
        await idbSet<T>(key, value);
        // Also write to localStorage as backup
        try { lsSet<T>(key, value); } catch { /* localStorage full — IDB is primary, that's OK */ }
        return;
      } catch (e) {
        console.warn(`[DataRepository] IDB write failed for "${key}", falling back to localStorage:`, e);
      }
    }

    // Only reach here if IDB is unavailable or failed
    lsSet<T>(key, value);
  }

  /**
   * Migrate a list of localStorage keys into IDB, then delete them from localStorage.
   * Safe to call multiple times — skips keys that don't exist in localStorage.
   */
  static async migrateFromLocalStorage(keys: string[]): Promise<void> {
    const useIDB = await DataRepository.checkIDB();
    if (!useIDB) return;

    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const parsed = JSON.parse(raw);
        await idbSet(key, parsed);
        localStorage.removeItem(key);
        // Also clean up old __repo_ backup if present
        localStorage.removeItem(`__repo_${key}`);
      } catch (e) {
        console.warn(`[DataRepository] Migration failed for "${key}":`, e);
      }
    }
  }

  /**
   * Delete a value by key from both storages.
   */
  static async delete(key: string): Promise<void> {
    const useIDB = await DataRepository.checkIDB();
    if (useIDB) {
      try {
        await idbDelete(key);
      } catch (e) {
        console.warn(`[DataRepository] IDB delete failed for "${key}":`, e);
      }
    }
    lsDelete(key);
  }

  /**
   * Check if a key exists in either storage.
   */
  static async has(key: string): Promise<boolean> {
    const value = await DataRepository.get(key);
    return value !== null;
  }
}
