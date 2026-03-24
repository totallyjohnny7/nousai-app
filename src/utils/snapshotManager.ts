/**
 * Snapshot Manager — saves point-in-time snapshots to IndexedDB for recovery.
 * Used before risky operations (sync, import, boot) so data can be restored.
 */

import type { NousAIData } from '../types';

const DB_NAME = 'nousai-snapshots';
const STORE_NAME = 'snapshots';
const MAX_SNAPSHOTS = 10;

interface Snapshot {
  label: string;
  timestamp: string;
  data: NousAIData;
}

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'timestamp' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save a named snapshot. Keeps at most MAX_SNAPSHOTS, removes oldest. */
export async function saveSnapshot(data: NousAIData, label: string): Promise<void> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const snapshot: Snapshot = {
      label,
      timestamp: new Date().toISOString(),
      data,
    };
    store.put(snapshot);

    // Prune old snapshots
    const countReq = store.count();
    countReq.onsuccess = () => {
      if (countReq.result > MAX_SNAPSHOTS) {
        const cursor = store.openCursor();
        let deleted = 0;
        const toDelete = countReq.result - MAX_SNAPSHOTS;
        cursor.onsuccess = () => {
          const c = cursor.result;
          if (c && deleted < toDelete) {
            c.delete();
            deleted++;
            c.continue();
          }
        };
      }
    };
  } catch (e) {
    console.warn('[Snapshot] Failed to save:', e);
  }
}

/** List all available snapshots (newest first) */
export async function listSnapshots(): Promise<Snapshot[]> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as Snapshot[]).reverse());
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

/** Restore a specific snapshot by timestamp */
export async function getSnapshot(timestamp: string): Promise<NousAIData | null> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const req = store.get(timestamp);
      req.onsuccess = () => resolve((req.result as Snapshot)?.data ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
