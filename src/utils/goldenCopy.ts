/**
 * Golden Copy — saves a "known good" copy of data after successful cloud sync.
 * Only updates if the new data has >= the card count of the existing golden copy.
 * Used as a last-resort recovery mechanism.
 */

import type { NousAIData } from '../types';

const DB_NAME = 'nousai-golden';
const STORE_NAME = 'golden';
const KEY = 'golden-copy';

function openGoldenDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
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
  const courses = data.pluginData?.coachData?.courses ?? [];
  return courses.reduce((sum, c) => sum + (c.flashcards?.length ?? 0), 0);
}

/** Save a golden copy — only if it's a growth-only update (no data loss). */
export async function saveGoldenCopy(data: NousAIData): Promise<void> {
  try {
    const db = await openGoldenDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Check existing golden copy's card count
    const existing = await new Promise<NousAIData | null>((resolve, reject) => {
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });

    const existingCards = existing ? countCards(existing) : 0;
    const newCards = countCards(data);

    // Only save if growth-only (new >= existing)
    if (newCards >= existingCards) {
      store.put(data, KEY);
      console.log(`[GoldenCopy] Updated: ${newCards} cards (was ${existingCards})`);
    } else {
      console.warn(`[GoldenCopy] Skipped: ${newCards} cards < ${existingCards} existing`);
    }
  } catch (e) {
    console.warn('[GoldenCopy] Failed to save:', e);
  }
}

/** Retrieve the golden copy for recovery */
export async function loadGoldenCopy(): Promise<NousAIData | null> {
  try {
    const db = await openGoldenDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.get(KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
