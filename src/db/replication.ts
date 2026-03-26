/**
 * RxDB ↔ Firestore Replication
 *
 * Sets up per-collection replication between RxDB and Firestore.
 * Each RxDB collection maps to a Firestore subcollection under users/{uid}/.
 *
 * Uses RxDB's built-in replication-firestore plugin which handles:
 * - Real-time pull via Firestore onSnapshot
 * - Push via setDoc/deleteDoc
 * - Checkpoint management (tracks last-synced state)
 * - Automatic retry on network failure
 *
 * Firestore structure:
 *   users/{uid}/courses/{courseId}
 *   users/{uid}/quiz_attempts/{attemptId}
 *   users/{uid}/notes/{noteId}
 *   users/{uid}/settings/main
 *   ... etc
 */
import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import type { RxDatabase } from 'rxdb';
import { getDb } from './index';

// Firebase is lazy-loaded in auth.ts — we need its instances
let firebaseDb: any = null;
let firebaseFns: any = null;

/** Initialize Firestore references (called from auth.ts after Firebase loads) */
export function setFirebaseRefs(db: any, fns: any) {
  firebaseDb = db;
  firebaseFns = fns;
}

// Active replication states — one per collection
const replications: Map<string, any> = new Map();

/**
 * Start replication for all collections for a given user.
 * Call this after the user signs in and Firebase is loaded.
 */
export async function startReplication(uid: string): Promise<void> {
  if (!firebaseDb || !firebaseFns) {
    console.warn('[REPLICATION] Firebase not initialized — skipping');
    return;
  }

  const db = await getDb();
  const fb = firebaseFns;

  // Collections to replicate and their Firestore subcollection names
  const collectionsToSync: Array<{ rxdbName: string; firestoreName: string }> = [
    { rxdbName: 'courses', firestoreName: 'courses' },
    { rxdbName: 'quiz_attempts', firestoreName: 'quiz_attempts' },
    { rxdbName: 'notes', firestoreName: 'notes' },
    { rxdbName: 'drawings', firestoreName: 'drawings' },
    { rxdbName: 'annotations', firestoreName: 'annotations' },
    { rxdbName: 'match_sets', firestoreName: 'match_sets' },
    { rxdbName: 'ai_chat_sessions', firestoreName: 'ai_chat_sessions' },
    { rxdbName: 'tool_sessions', firestoreName: 'tool_sessions' },
    { rxdbName: 'saved_procedures', firestoreName: 'saved_procedures' },
    { rxdbName: 'saved_videos', firestoreName: 'saved_videos' },
    { rxdbName: 'sr_cards', firestoreName: 'sr_cards' },
    { rxdbName: 'settings', firestoreName: 'settings' },
    { rxdbName: 'gamification', firestoreName: 'gamification' },
    { rxdbName: 'timer', firestoreName: 'timer' },
    { rxdbName: 'proficiency', firestoreName: 'proficiency' },
    { rxdbName: 'plugin_blobs', firestoreName: 'plugin_blobs' },
  ];

  for (const { rxdbName, firestoreName } of collectionsToSync) {
    const collection = db.collections[rxdbName];
    if (!collection) {
      console.warn(`[REPLICATION] Collection ${rxdbName} not found — skipping`);
      continue;
    }

    // Skip if already replicating
    if (replications.has(rxdbName)) continue;

    try {
      const firestoreCollection = fb.collection(firebaseDb, 'users', uid, firestoreName);

      const replicationState = replicateFirestore({
        replicationIdentifier: `nousai-${rxdbName}-${uid}`,
        collection,
        firestore: {
          projectId: 'nousai-dc038',
          database: firebaseDb,
          collection: firestoreCollection,
        },
        pull: {
          filter: undefined,
        },
        push: {
          filter: undefined,
        },
        live: true,
        retryTime: 5000,
        waitForLeadership: true,
        autoStart: true,
        // Conflict handler: higher updatedAt wins, fallback to local
        conflictHandler: async (input: any) => {
          const local = input.newDocumentState;
          const remote = input.realMasterState;
          const localTs = local?.updatedAt ?? local?.createdAt ?? '';
          const remoteTs = remote?.updatedAt ?? remote?.createdAt ?? '';
          // Compare as strings (ISO) or numbers — String comparison works for both
          if (String(localTs) >= String(remoteTs)) return { isEqual: false, documentData: local };
          return { isEqual: false, documentData: remote };
        },
      });

      // Log replication events
      replicationState.error$.subscribe((err: any) => {
        console.error(`[REPLICATION] ${rxdbName} error:`, err);
      });

      replicationState.active$.subscribe((active: boolean) => {
        if (active) {
          console.log(`[REPLICATION] ${rxdbName} — syncing`);
        }
      });

      replications.set(rxdbName, replicationState);
    } catch (err) {
      console.error(`[REPLICATION] Failed to start ${rxdbName}:`, err);
    }
  }

  console.log('[REPLICATION] Started for', replications.size, 'collections');
}

/** Stop all active replications (call on sign-out) */
export async function stopReplication(): Promise<void> {
  for (const [name, rep] of replications) {
    try {
      await rep.cancel();
      console.log(`[REPLICATION] Stopped ${name}`);
    } catch (e) {
      console.warn(`[REPLICATION] Error stopping ${name}:`, e);
    }
  }
  replications.clear();
}

/** Check if replication is active */
export function isReplicating(): boolean {
  return replications.size > 0;
}

/** Force a one-time push of all pending changes */
export async function forcePush(): Promise<void> {
  for (const [name, rep] of replications) {
    try {
      await rep.reSync();
    } catch (e) {
      console.warn(`[REPLICATION] Force push failed for ${name}:`, e);
    }
  }
}
