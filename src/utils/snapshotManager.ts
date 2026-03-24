/**
 * ⚠️ AI CODER WARNING ⚠️
 * Pre-write snapshot system — saves "before images" to a SEPARATE IndexedDB
 * database so corruption of the main DB cannot affect recovery.
 *
 * Science: Write-Ahead Log (WAL) pattern from SQLite/PostgreSQL.
 * Cost: ~2ms per 2MB write (negligible). 10 snapshots × 2MB = 20MB in IDB.
 */
import type { NousAIData } from '../types';

const DB_NAME = 'nousai-snapshots';
const STORE_NAME = 'snapshots';
const DB_VERSION = 1;
const DEFAULT_MAX_SNAPSHOTS = 10;

export type SnapshotTrigger =
  | 'pre-sync'
  | 'pre-import'
  | 'boot'
  | 'manual'
  | 'midnight'
  | 'pre-bulk-delete';

export interface SnapshotMeta {
  id: string;
  trigger: SnapshotTrigger;
  cardCount: number;
  courseCount: number;
  timestamp: string;
  sizeBytes: number;
}

interface SnapshotRecord extends SnapshotMeta {
  data: NousAIData;
}

function openSnapshotDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function countCardsInData(data: NousAIData): number {
  const courses = data?.pluginData?.coachData?.courses;
  if (!Array.isArray(courses)) return 0;
  return courses.reduce(
    (sum, c) => sum + (Array.isArray(c.flashcards) ? c.flashcards.length : 0), 0
  );
}

/**
 * Save a snapshot of the current data state before a write.
 * Returns the snapshot ID (ISO timestamp).
 */
export async function saveSnapshot(
  data: NousAIData,
  trigger: SnapshotTrigger,
): Promise<string> {
  const id = new Date().toISOString();
  const serialized = JSON.stringify(data);
  const record: SnapshotRecord = {
    id,
    trigger,
    cardCount: countCardsInData(data),
    courseCount: data?.pluginData?.coachData?.courses?.length ?? 0,
    timestamp: id,
    sizeBytes: serialized.length,
    data,
  };

  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Auto-prune after saving
    await pruneSnapshots(DEFAULT_MAX_SNAPSHOTS);
    return id;
  } catch (e) {
    console.warn('[SNAPSHOT] Failed to save:', e);
    return id;
  }
}

/**
 * List all snapshots — metadata only (no data blob), newest first.
 */
export async function listSnapshots(): Promise<SnapshotMeta[]> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    const records: SnapshotRecord[] = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Return metadata only, sorted newest first
    return records
      .map(({ data: _data, ...meta }) => meta)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  } catch (e) {
    console.warn('[SNAPSHOT] Failed to list:', e);
    return [];
  }
}

/**
 * Load a full snapshot by ID for restore.
 */
export async function loadSnapshot(id: string): Promise<NousAIData | null> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(id);
    const record: SnapshotRecord | undefined = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return record?.data ?? null;
  } catch (e) {
    console.warn('[SNAPSHOT] Failed to load:', e);
    return null;
  }
}

/**
 * Keep only the newest `maxCount` snapshots, delete the rest.
 */
export async function pruneSnapshots(maxCount: number = DEFAULT_MAX_SNAPSHOTS): Promise<void> {
  try {
    const db = await openSnapshotDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    const keys: IDBValidKey[] = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // Keys are ISO timestamps — sort ascending, delete oldest
    const sorted = (keys as string[]).sort();
    const toDelete = sorted.slice(0, Math.max(0, sorted.length - maxCount));
    for (const key of toDelete) {
      store.delete(key);
    }
  } catch (e) {
    console.warn('[SNAPSHOT] Failed to prune:', e);
  }
}
