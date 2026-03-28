/**
 * SYNC FIX #2 + #3 + #12 + #14 — 2026-03-27
 * Bug #2: mergeCourseConflict was dead code — flashcard merge never happened
 * Bug #3: Inline conflict handler disagreed with conflictHandler.ts on tie-breaking
 * Bug #12: Dual Firestore writes (blob sync + per-doc replication) caused divergence
 * Bug #14: Replication errors only logged to console, never surfaced to UI
 * Root cause: Inline handler ignored conflictHandler.ts; two parallel sync paths
 * Fix: Wire in conflictHandler.ts handlers. DISABLE Firestore push (pull-only replication).
 *      Blob sync is the canonical cloud path. RxDB replication now pull-only for local queries.
 *      Emit sync errors via CustomEvent for UI display.
 * Validates: Consistent tie-breaking (remote wins on tie). No dual writes. Errors visible.
 */
import { replicateFirestore } from 'rxdb/plugins/replication-firestore';
import type { RxDatabase } from 'rxdb';
import { getDb } from './index';
import { lastWriteWins, mergeCourseConflict } from './conflictHandler';

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
 * FIX #12: Pull-only — RxDB pulls from Firestore for local queries,
 * but does NOT push back. The blob sync path (auth.ts syncToCloud)
 * is the single canonical cloud write path.
 */
export async function startReplication(uid: string): Promise<void> {
  if (!firebaseDb || !firebaseFns) {
    console.warn('[REPLICATION] Firebase not initialized — skipping');
    emitSyncError('Firebase not initialized — cloud sync unavailable');
    return;
  }

  let db: RxDatabase;
  try {
    db = await getDb();
  } catch {
    console.warn('[REPLICATION] RxDB not available — skipping replication');
    return;
  }

  const fb = firebaseFns;

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
        // FIX #12: DISABLE PUSH — blob sync is the single cloud write path
        push: undefined,
        live: true,
        retryTime: 5000,
        waitForLeadership: true,
        autoStart: true,
        // FIX #2 + #3: Use proper conflict handlers from conflictHandler.ts
        // Remote wins on tie (consistent strategy across entire codebase)
        conflictHandler: async (input: any) => {
          const local = input.newDocumentState;
          const remote = input.realMasterState;

          let winner: any;
          if (rxdbName === 'courses') {
            // FIX #2: Actually use mergeCourseConflict for courses
            winner = mergeCourseConflict(local, remote);
          } else {
            // FIX #3: Remote wins on tie (consistent with merge engine)
            winner = lastWriteWins(local, remote);
          }
          return { isEqual: false, documentData: winner };
        },
      });

      // FIX #14: Surface replication errors to UI
      replicationState.error$.subscribe((err: any) => {
        console.error(`[REPLICATION] ${rxdbName} error:`, err);
        emitSyncError(`Replication error on ${rxdbName}: ${err?.message || err}`);
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

  console.log('[REPLICATION] Started (pull-only) for', replications.size, 'collections');
}

/** Emit sync error as CustomEvent for UI components to display */
function emitSyncError(message: string) {
  try {
    window.dispatchEvent(new CustomEvent('nousai-sync-error', { detail: { message } }));
  } catch { /* SSR safety */ }
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

/** Force a one-time resync of all collections (pull-only) */
export async function forcePull(): Promise<void> {
  for (const [name, rep] of replications) {
    try {
      await rep.reSync();
    } catch (e) {
      console.warn(`[REPLICATION] Force pull failed for ${name}:`, e);
    }
  }
}

// Backward compat alias
export const forcePush = forcePull;
