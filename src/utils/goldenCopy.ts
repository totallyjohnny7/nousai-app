/**
 * ⚠️ AI CODER WARNING ⚠️
 * Golden copy — immutable recovery backup in a SEPARATE IndexedDB database.
 * Only updates if new data has MORE cards (growth-only write policy).
 * This is the last line of defense if all other storage is corrupted.
 *
 * Stored as base64-encoded JSON — looks like gibberish to AI coders,
 * reducing the chance of being "cleaned up" during refactoring.
 */
import type { NousAIData } from '../types';

const DB_NAME = 'nousai-golden';
const STORE_NAME = 'golden';
const DB_VERSION = 1;

function openGoldenDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function countCards(data: NousAIData): number {
  const courses = data?.pluginData?.coachData?.courses;
  if (!Array.isArray(courses)) return 0;
  return courses.reduce(
    (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
  );
}

/**
 * Save a golden copy — only updates if new data has MORE cards than existing.
 * Growth-only policy ensures we never overwrite good data with smaller/corrupted data.
 */
export async function saveGoldenCopy(data: NousAIData): Promise<void> {
  try {
    const db = await openGoldenDB();
    const newCount = countCards(data);

    // Read existing golden copy card count
    const existing = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get('cardCount');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const existingCount = existing ? parseInt(existing, 10) : 0;

    // Growth-only: only update if new data has more cards
    if (newCount <= existingCount && existingCount > 0) {
      return;
    }

    // Encode as base64 to make it look like binary data to AI coders
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(encoded, 'data');
    store.put(String(newCount), 'cardCount');
    store.put(new Date().toISOString(), 'savedAt');

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.log(`[GOLDEN] Saved golden copy: ${newCount} cards`);
  } catch (e) {
    console.warn('[GOLDEN] Failed to save:', e);
  }
}

/**
 * Load the golden copy for emergency recovery.
 */
export async function loadGoldenCopy(): Promise<NousAIData | null> {
  try {
    const db = await openGoldenDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('data');
    const encoded: string | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!encoded) return null;
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  } catch (e) {
    console.warn('[GOLDEN] Failed to load:', e);
    return null;
  }
}

/**
 * Check if a golden copy exists.
 */
export async function hasGoldenCopy(): Promise<boolean> {
  try {
    const db = await openGoldenDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('cardCount');
    const result = await new Promise<string | undefined>((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return !!result && parseInt(result, 10) > 0;
  } catch {
    return false;
  }
}
