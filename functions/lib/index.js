"use strict";
/**
 * NousAI Cloud Function — Server-side sync conflict arbiter.
 * Deployed via GitHub Actions → Firebase Functions (Node 20).
 *
 * Trigger: onDocumentWritten for user sync metadata docs.
 * Prevents stale writes from overwriting newer data and logs conflicts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflictResolver = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
const db = (0, firestore_2.getFirestore)();
exports.conflictResolver = (0, firestore_1.onDocumentWritten)('users/{uid}', async (event) => {
    const uid = event.params.uid;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // Skip deletes
    if (!after)
        return;
    // Skip if no previous version (first write)
    if (!before)
        return;
    const beforeVersion = before.syncVersion ?? 0;
    const afterVersion = after.syncVersion ?? 0;
    // If incoming write has an older syncVersion, it's stale — restore previous
    if (afterVersion < beforeVersion - 1000) {
        console.warn(`[ConflictResolver] Rejecting stale write for ${uid}: incoming=${afterVersion}, existing=${beforeVersion}`);
        // Restore previous metadata
        await event.data.after.ref.set(before, { merge: true });
        // Log the conflict
        await db.collection('users').doc(uid).collection('syncLog').add({
            type: 'stale-write-rejected',
            incomingVersion: afterVersion,
            existingVersion: beforeVersion,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
        return;
    }
    // Empty array guard: if incoming has empty arrays but previous had items
    const beforeChunks = before.totalChunks ?? 0;
    const afterChunks = after.totalChunks ?? 0;
    if (beforeChunks > 0 && afterChunks === 0) {
        console.warn(`[ConflictResolver] Rejecting empty-data write for ${uid}: had ${beforeChunks} chunks, incoming has 0`);
        await event.data.after.ref.set(before, { merge: true });
        await db.collection('users').doc(uid).collection('syncLog').add({
            type: 'empty-write-rejected',
            beforeChunks,
            afterChunks,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
        return;
    }
    // Log successful sync events (useful for debugging)
    if (afterVersion !== beforeVersion) {
        await db.collection('users').doc(uid).collection('syncLog').add({
            type: 'sync-success',
            fromVersion: beforeVersion,
            toVersion: afterVersion,
            timestamp: firestore_2.FieldValue.serverTimestamp(),
        });
    }
});
//# sourceMappingURL=index.js.map