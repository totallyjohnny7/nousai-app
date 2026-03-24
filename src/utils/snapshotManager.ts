/**
 * Snapshot Manager — saves labeled snapshots to IndexedDB for crash recovery.
 * Keeps max 5 snapshots per label to prevent storage bloat.
 */
import type { NousAIData } from '../types';

const DB_NAME = 'nousai-snapshots';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const MAX_PER_LABEL = 5;

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('label', 'label', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSnapshot(data: NousAIData, label: string): Promise<void> {
  const db = await openSnapshotDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  // Add new snapshot
  store.add({ label, timestamp: Date.now(), data });

  // Prune old snapshots for this label (keep MAX_PER_LABEL most recent)
  const index = store.index('label');
  const req = index.getAllKeys(IDBKeyRange.only(label));
  req.onsuccess = () => {
    const keys = req.result;
    if (keys.length > MAX_PER_LABEL) {
      const toDelete = keys.slice(0, keys.length - MAX_PER_LABEL);
      toDelete.forEach(k => store.delete(k));
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
