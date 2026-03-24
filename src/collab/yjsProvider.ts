/**
 * Yjs Collaboration Provider — bridges Yjs CRDTs with Firestore for persistence.
 *
 * Yjs documents represent shared state (notes, drawings) that multiple users
 * can edit simultaneously. Changes are automatically merged via CRDTs (no conflicts).
 *
 * Architecture:
 * - Each collaborative entity (note, drawing) is a Yjs Y.Doc
 * - Local persistence via y-indexeddb (survives tab close/offline)
 * - Cloud persistence via Firestore (stores Yjs update blobs in subcollections)
 * - Real-time sync via Firestore onSnapshot (cross-device push)
 *
 * This is Phase 3 — only used for entities that need multi-user collaboration.
 * All other data continues using RxDB replication from Phase 2.
 */
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

// Active Yjs docs — keyed by entity type + id (e.g. 'note:abc123')
const activeDocs: Map<string, { doc: Y.Doc; idbProvider: IndexeddbPersistence; destroy: () => void }> = new Map();

/**
 * Get or create a Yjs document for a collaborative entity.
 * The document is persisted to IndexedDB and optionally synced to Firestore.
 */
export function getCollabDoc(entityType: 'note' | 'drawing', entityId: string): Y.Doc {
  const key = `${entityType}:${entityId}`;

  if (activeDocs.has(key)) {
    return activeDocs.get(key)!.doc;
  }

  const doc = new Y.Doc();

  // Local persistence — survives tab close, offline edits
  const idbProvider = new IndexeddbPersistence(`nousai-collab-${key}`, doc);

  idbProvider.on('synced', () => {
    console.log(`[YJS] ${key} — synced from IndexedDB`);
  });

  activeDocs.set(key, {
    doc,
    idbProvider,
    destroy: () => {
      idbProvider.destroy();
      doc.destroy();
    },
  });

  return doc;
}

/**
 * Get the shared text content from a collaborative note.
 * Returns a Y.Text that supports concurrent editing.
 */
export function getSharedText(entityId: string): Y.Text {
  const doc = getCollabDoc('note', entityId);
  return doc.getText('content');
}

/**
 * Get the shared drawing elements from a collaborative drawing.
 * Returns a Y.Array that supports concurrent element additions/removals.
 */
export function getSharedDrawingElements(entityId: string): Y.Array<unknown> {
  const doc = getCollabDoc('drawing', entityId);
  return doc.getArray('elements');
}

/**
 * Get the Yjs awareness instance for presence tracking.
 * Shows who is editing what in real-time.
 * Note: Awareness requires a network provider (WebSocket/WebRTC) — deferred to when
 * we add a signaling server. For now, presence is local-only.
 */
export function getAwareness(entityType: 'note' | 'drawing', entityId: string) {
  // Awareness will be added when we have a WebSocket signaling server
  // For now, return null — components should handle this gracefully
  return null;
}

/** Clean up a collaborative doc (call when navigating away from the entity) */
export function destroyCollabDoc(entityType: 'note' | 'drawing', entityId: string): void {
  const key = `${entityType}:${entityId}`;
  const entry = activeDocs.get(key);
  if (entry) {
    entry.destroy();
    activeDocs.delete(key);
    console.log(`[YJS] ${key} — destroyed`);
  }
}

/** Clean up all active docs (call on sign-out or app unmount) */
export function destroyAllCollabDocs(): void {
  for (const [key, entry] of activeDocs) {
    entry.destroy();
    console.log(`[YJS] ${key} — destroyed`);
  }
  activeDocs.clear();
}

/**
 * Sync a Yjs document to Firestore.
 * Stores the full state vector as a base64 blob in the user's Firestore subcollection.
 * Called periodically or on visibility change.
 */
export async function syncDocToFirestore(
  entityType: 'note' | 'drawing',
  entityId: string,
  uid: string,
  firestoreDb: any,
  fbFns: any,
): Promise<void> {
  const key = `${entityType}:${entityId}`;
  const entry = activeDocs.get(key);
  if (!entry) return;

  const stateVector = Y.encodeStateAsUpdate(entry.doc);
  const base64 = btoa(String.fromCharCode(...stateVector));

  const docRef = fbFns.doc(firestoreDb, 'users', uid, 'collab', key);
  await fbFns.setDoc(docRef, {
    type: entityType,
    entityId,
    state: base64,
    updatedAt: new Date().toISOString(),
  });

  console.log(`[YJS] ${key} — synced to Firestore (${stateVector.length} bytes)`);
}

/**
 * Load a Yjs document from Firestore and apply the remote state.
 * Called on app boot or when opening a collaborative entity.
 */
export async function loadDocFromFirestore(
  entityType: 'note' | 'drawing',
  entityId: string,
  uid: string,
  firestoreDb: any,
  fbFns: any,
): Promise<void> {
  const key = `${entityType}:${entityId}`;
  const doc = getCollabDoc(entityType, entityId);

  try {
    const docRef = fbFns.doc(firestoreDb, 'users', uid, 'collab', key);
    const snap = await fbFns.getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const binary = Uint8Array.from(atob(data.state), c => c.charCodeAt(0));
      Y.applyUpdate(doc, binary);
      console.log(`[YJS] ${key} — loaded from Firestore (${binary.length} bytes)`);
    }
  } catch (e) {
    console.warn(`[YJS] ${key} — Firestore load failed (will use local):`, e);
  }
}
