/**
 * RxDB Database — singleton instance for NousAI.
 *
 * Creates a Dexie-backed RxDB database with leader election.
 * Only one tab writes at a time; other tabs receive real-time updates
 * via RxDB's multi-tab coordination.
 *
 * If DB9 (database already exists with incompatible storage) occurs,
 * RxDB is marked as "poisoned" for this session — all subsequent calls
 * to getDb() reject immediately without retrying, preventing console spam.
 * Legacy IDB continues to work as the primary storage.
 *
 * Usage:
 *   import { getDb, isRxDbAvailable } from '@/db';
 *   if (isRxDbAvailable()) {
 *     const db = await getDb();
 *     const courses = await db.courses.find().exec();
 *   }
 */
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { collections } from './schemas';

// Add plugins
addRxPlugin(RxDBLeaderElectionPlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

const DB_NAME = 'nousai-rxdb';

let dbPromise: Promise<RxDatabase> | null = null;
let devModeLoaded = false;

// DB9 poison flag — once set, all RxDB operations are skipped for this session.
// This prevents the console spam from repeated DB9 failures on every save cycle.
let _db9Poisoned = false;

// Cache a single Dexie storage instance to ensure referential equality.
let _dexieStorage: ReturnType<typeof getRxStorageDexie> | null = null;
function getDexieStorage() {
  if (!_dexieStorage) _dexieStorage = getRxStorageDexie();
  return _dexieStorage;
}

let validatedStorage: any = null;

async function ensureDevMode(): Promise<void> {
  if (import.meta.env.DEV && !devModeLoaded) {
    try {
      const { RxDBDevModePlugin, disableWarnings } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
      disableWarnings();
      const { wrappedValidateAjvStorage } = await import('rxdb/plugins/validate-ajv');
      validatedStorage = wrappedValidateAjvStorage({ storage: getDexieStorage() });
      devModeLoaded = true;
    } catch { /* non-critical — fall back to unvalidated storage */ }
  }
}

/** Check if RxDB is available (not poisoned by DB9) */
export function isRxDbAvailable(): boolean {
  return !_db9Poisoned;
}

export async function getDb(): Promise<RxDatabase> {
  // Fast-reject if DB9 already happened this session
  if (_db9Poisoned) {
    throw new Error('[RxDB] Unavailable this session (DB9 — using legacy IDB)');
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureDevMode();
      const storage = validatedStorage || getDexieStorage();
      let db: RxDatabase;
      try {
        db = await createRxDatabase({
          name: DB_NAME,
          storage,
          multiInstance: true,
          eventReduce: true,
          ignoreDuplicate: true,
        });
      } catch (e: any) {
        // DB9 = database already exists with incompatible storage metadata.
        // This happens when IndexedDB has RxDB internal data from a previous
        // session that used a different storage adapter instance.
        // CRITICAL: Do NOT call removeRxDatabase — that DELETES ALL USER DATA.
        if (e?.code === 'DB9' || e?.message?.includes('DB9')) {
          // Poison this session — stop all RxDB attempts.
          // Legacy IDB is the primary storage and works fine.
          _db9Poisoned = true;
          console.warn('[RxDB] DB9 — RxDB disabled for this session (legacy IDB is primary, no data loss)');
          throw new Error('[RxDB] DB9 — disabled for session');
        }
        throw e;
      }

      // Add all collections
      await db.addCollections(collections);

      db.waitForLeadership().then(() => {
        console.log('[RxDB] This tab is now the leader');
      });

      console.log('[RxDB] Database initialized with', Object.keys(collections).length, 'collections');
      return db;
    })();

    // If the promise rejects, clear it so future calls can check _db9Poisoned
    // instead of returning the same rejected promise.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

/** Destroy database (for testing / cleanup) */
export async function destroyDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await (db as any).destroy();
    dbPromise = null;
  }
}

/** Check if this tab is the RxDB leader */
export async function isDbLeader(): Promise<boolean> {
  if (_db9Poisoned) return false;
  const db = await getDb();
  return (db as any).isLeader?.() ?? false;
}
