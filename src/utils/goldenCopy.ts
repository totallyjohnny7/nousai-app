/**
 * Golden Copy — saves a "known good" baseline to IndexedDB after successful remote merge.
 * Used for recovery if future data becomes corrupted.
 */
import type { NousAIData } from '../types';

const DB_NAME = 'nousai-db';
const STORE_NAME = 'data';
const GOLDEN_KEY = 'golden';

function openDB(): Promise<IDBDatabase> {
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

export async function saveGoldenCopy(data: NousAIData): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(data, GOLDEN_KEY);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
