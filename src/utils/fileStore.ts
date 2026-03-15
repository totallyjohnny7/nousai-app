/**
 * IndexedDB-based file storage for large data (base64 dataUrls, etc.)
 * Replaces localStorage for file data to avoid the ~5MB quota limit.
 * IndexedDB can store hundreds of MB.
 */

const DB_NAME = 'nousai-files';
const STORE_NAME = 'blobs';

function openFileDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveFile(key: string, data: string): Promise<void> {
  try {
    const db = await openFileDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(data, key);
  } catch (e) {
    console.warn('[fileStore] Failed to save:', key, e);
  }
}

export async function loadFile(key: string): Promise<string | null> {
  try {
    const db = await openFileDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteFile(key: string): Promise<void> {
  try {
    const db = await openFileDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
  } catch (e) {
    console.warn('[fileStore] Failed to delete:', key, e);
  }
}

/**
 * Migrate file data from localStorage to IndexedDB (one-time).
 * Finds all keys matching the pattern and moves them.
 */
export async function migrateFromLocalStorage(keyPrefix: string): Promise<void> {
  try {
    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(keyPrefix) && key.includes('-file-')) {
        keysToMigrate.push(key);
      }
    }
    if (keysToMigrate.length === 0) return;

    const db = await openFileDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    for (const key of keysToMigrate) {
      const data = localStorage.getItem(key);
      if (data) {
        store.put(data, key);
        localStorage.removeItem(key);
      }
    }
    console.log(`[fileStore] Migrated ${keysToMigrate.length} files from localStorage to IndexedDB`);
  } catch (e) {
    console.warn('[fileStore] Migration failed:', e);
  }
}
