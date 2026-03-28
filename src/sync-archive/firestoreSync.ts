/**
 * SYNC FIX #1 — 2026-03-27
 * Bug: atomicCloudWrite claimed to use Firestore transactions but never did (TOCTOU gap)
 * Root cause: runTransaction declared in interface but never called
 * Fix: Removed misleading "atomic" claims. Now honestly a pre-check + retry write.
 *      The merge engine handles conflicts — this layer just provides version awareness.
 * Validates: No more misleading JSDoc. Behavior unchanged (was already non-transactional).
 */

import { tickLamportClock, getLamportClock } from './lamportClock'
import { withExponentialBackoff } from './retrySync'

// Firebase types — loaded dynamically via auth.ts loadFirebase()
type FirestoreDb = unknown
type DocumentReference = unknown

interface FirebaseFns {
  doc: (db: unknown, ...path: string[]) => DocumentReference
  getDocFromServer: (ref: DocumentReference) => Promise<{ exists: () => boolean; data: () => Record<string, unknown> }>
}

/**
 * Wraps a cloud write with version-awareness and retry.
 * Reads server metadata to detect concurrent edits, logs warnings if detected,
 * then writes with exponential backoff. Conflict resolution is handled by the
 * merge engine (mergeAppData) — this layer does NOT prevent concurrent writes.
 *
 * @param writeFn - The actual write function (e.g., syncToCloud inner)
 * @param uid - User ID for reading the metadata doc
 * @param fb - Firebase functions (from loadFirebase)
 * @param db - Firestore database instance
 */
export async function cloudWriteWithRetry(
  writeFn: () => Promise<void>,
  uid: string,
  fb: FirebaseFns | null,
  db: FirestoreDb | null,
): Promise<boolean> {
  if (!fb || !db) {
    // Firebase not available — write directly
    await withExponentialBackoff(writeFn)
    return true
  }

  // Pre-check: read server metadata (using getDocFromServer to bypass cache — FIX #5)
  try {
    const docRef = fb.doc(db, 'users', uid)
    const snap = await fb.getDocFromServer(docRef)
    if (snap.exists()) {
      const serverData = snap.data()
      const serverVersion = serverData.syncVersion as number | undefined
      const localClock = getLamportClock()

      if (serverVersion && serverVersion > localClock) {
        console.warn(`[Sync] Server version ${serverVersion} > local clock ${localClock} — writing merged data`)
      }
    }
  } catch (err) {
    console.warn('[Sync] Pre-check failed (non-critical):', err)
  }

  // Stamp the Lamport clock before writing
  tickLamportClock()

  // Execute the write with retry
  await withExponentialBackoff(writeFn)
  return true
}

// Backward compat alias
export const atomicCloudWrite = cloudWriteWithRetry
