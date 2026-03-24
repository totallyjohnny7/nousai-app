/**
 * RxDB Database — singleton instance for NousAI.
 *
 * Creates a Dexie-backed RxDB database with leader election.
 * Only one tab writes at a time; other tabs receive real-time updates
 * via RxDB's multi-tab coordination.
 *
 * Usage:
 *   import { getDb } from '@/db';
 *   const db = await getDb();
 *   const courses = await db.courses.find().exec();
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

let validatedStorage: any = null;

async function ensureDevMode(): Promise<void> {
  if (import.meta.env.DEV && !devModeLoaded) {
    try {
      const { RxDBDevModePlugin, disableWarnings } = await import('rxdb/plugins/dev-mode');
      addRxPlugin(RxDBDevModePlugin);
      disableWarnings();
      // Dev-mode requires a validated storage wrapper
      const { wrappedValidateAjvStorage } = await import('rxdb/plugins/validate-ajv');
      validatedStorage = wrappedValidateAjvStorage({ storage: getRxStorageDexie() });
      devModeLoaded = true;
    } catch { /* non-critical — fall back to unvalidated storage */ }
  }
}

export async function getDb(): Promise<RxDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      await ensureDevMode();
      let db: RxDatabase;
      try {
        db = await createRxDatabase({
          name: DB_NAME,
          storage: validatedStorage || getRxStorageDexie(),
          multiInstance: true,   // enable cross-tab sync
          eventReduce: true,     // optimize observable queries
          ignoreDuplicate: true, // allow reopening after HMR in dev
        });
      } catch (e: any) {
        // DB9 = database already exists (React Strict Mode double-invoke or HMR)
        if (e?.code === 'DB9' || e?.message?.includes('DB9')) {
          // Try again with a removeRxDatabase first
          const { removeRxDatabase } = await import('rxdb');
          await removeRxDatabase(DB_NAME, getRxStorageDexie());
          db = await createRxDatabase({
            name: DB_NAME,
            storage: validatedStorage || getRxStorageDexie(),
            multiInstance: true,
            eventReduce: true,
            ignoreDuplicate: true,
          });
        } else {
          throw e;
        }
      }

      // Add all collections
      await db.addCollections(collections);

      // Log leader election events
      db.waitForLeadership().then(() => {
        console.log('[RxDB] This tab is now the leader');
      });

      console.log('[RxDB] Database initialized with', Object.keys(collections).length, 'collections');
      return db;
    })();
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
  const db = await getDb();
  return (db as any).isLeader?.() ?? false;
}
