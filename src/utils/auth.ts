/**
 * Authentication & Cloud Sync for NousAI Companion
 *
 * Uses Firebase Auth for login/signup and Firestore for cloud data sync.
 * Falls back to local-only mode if Firebase is not configured.
 *
 * Setup:
 * 1. Create a Firebase project at https://console.firebase.google.com
 * 2. Enable Email/Password auth in Firebase Console → Authentication
 * 3. Create a Firestore database
 * 4. Copy your Firebase config to the FIREBASE_CONFIG below
 */

import type { NousAIData } from '../types';
import pako from 'pako';
import { log, warn } from './logger';
import { setFirebaseRefs, startReplication, stopReplication } from '../db/replication';

// ─── Firebase Config ────────────────────────────────────
// Defaults to the NousAI Firebase project; can be overridden via localStorage
const FIREBASE_CONFIG = {
  apiKey: localStorage.getItem('nousai-fb-apiKey') || 'AIzaSyCPEpz40ixry6rdAYAmwzkGxlpKrLnXA64',
  authDomain: localStorage.getItem('nousai-fb-authDomain') || 'nousai-dc038.firebaseapp.com',
  projectId: localStorage.getItem('nousai-fb-projectId') || 'nousai-dc038',
  storageBucket: localStorage.getItem('nousai-fb-storageBucket') || 'nousai-dc038.firebasestorage.app',
  messagingSenderId: localStorage.getItem('nousai-fb-messagingSenderId') || '1002222438616',
  appId: localStorage.getItem('nousai-fb-appId') || '1:1002222438616:web:9a8c4cc83fa7c603516fad',
};

// ─── Types ──────────────────────────────────────────────

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
  isAnonymous?: boolean;
}

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  mode: 'cloud' | 'local';
}

// ─── Firebase Dynamic Loader ────────────────────────────

let firebaseApp: any = null;
let firebaseAuth: any = null;
let firebaseDb: any = null;
let firebaseStorage: any = null;
// Promise-based guard: all concurrent callers share the same in-flight Promise,
// eliminating the race window where firebaseLoaded=true but firebaseApp is still null.
let firebaseLoadPromise: Promise<boolean> | null = null;

// Module-scoped Firebase functions — NOT exposed on window (prevents XSS exploitation)
let fbFns: {
  signInWithEmailAndPassword: any;
  createUserWithEmailAndPassword: any;
  signOut: any;
  onAuthStateChanged: any;
  updateProfile: any;
  doc: any;
  setDoc: any;
  getDoc: any;
  getDocFromServer: any;
  collection: any;
  getDocs: any;
  getDocsFromServer: any;
  writeBatch: any;
  deleteDoc: any;
  deleteField: any;
  onSnapshot: any;
  // Cloud Storage functions
  storageRef: any;
  uploadString: any;
  getDownloadURL: any;
  getBytes: any;
  getBlob: any;
  uploadBytesResumable: any;
  deleteObject: any;
} | null = null;

async function _doLoadFirebase(): Promise<boolean> {
  if (!FIREBASE_CONFIG.apiKey) {
    log('NousAI: No Firebase config found, running in local mode');
    return false;
  }

  try {
    // Dynamic imports for code splitting
    const [appMod, authMod, storeMod, storageMod] = await Promise.all([
      import('firebase/app'),
      import('firebase/auth'),
      import('firebase/firestore'),
      import('firebase/storage'),
    ]);
    const { initializeApp } = appMod;
    const { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } = authMod;
    const { getFirestore, doc, setDoc, getDoc, getDocFromServer, collection, getDocs, getDocsFromServer, writeBatch, deleteDoc, deleteField, onSnapshot } = storeMod;
    const { getStorage, ref: storageRefFn, uploadString, getDownloadURL, getBytes, getBlob, uploadBytesResumable, deleteObject } = storageMod;

    firebaseApp = initializeApp(FIREBASE_CONFIG);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);
    firebaseStorage = getStorage(firebaseApp);

    // Expose Firebase refs to RxDB replication layer
    setFirebaseRefs(firebaseDb, null); // fns set below after fbFns is populated

    // Store firebase functions in module scope (secure — not on window)
    fbFns = {
      signInWithEmailAndPassword,
      createUserWithEmailAndPassword,
      signOut,
      onAuthStateChanged,
      updateProfile,
      doc,
      setDoc,
      getDoc,
      getDocFromServer,
      collection,
      getDocs,
      getDocsFromServer,
      writeBatch,
      deleteDoc,
      deleteField,
      onSnapshot,
      // Cloud Storage
      storageRef: storageRefFn,
      uploadString,
      getDownloadURL,
      getBytes,
      getBlob,
      uploadBytesResumable,
      deleteObject,
    };

    // Now that fbFns is populated, update replication layer with full refs
    setFirebaseRefs(firebaseDb, fbFns);

    return true;
  } catch (e) {
    warn('NousAI: Firebase failed to load, using local mode', e);
    // Reset promise so callers can retry (e.g. network was down temporarily)
    firebaseLoadPromise = null;
    return false;
  }
}

/** Lazily load Firebase SDK. All concurrent callers share the same in-flight Promise. */
async function loadFirebase(): Promise<boolean> {
  if (!firebaseLoadPromise) {
    firebaseLoadPromise = _doLoadFirebase();
  }
  return firebaseLoadPromise;
}

// ─── Storage helpers (for videoStorage.ts) ───────────────

/** Ensures Firebase is loaded and returns storage ref helpers. Throws if Firebase unavailable. */
export async function getFirebaseStorageFns(): Promise<{
  storage: typeof firebaseStorage;
  storageRef: (path: string) => unknown;
  uploadBytesResumable: typeof fbFns extends null ? never : any;
  getDownloadURL: typeof fbFns extends null ? never : any;
  deleteObject: typeof fbFns extends null ? never : any;
}> {
  const loaded = await loadFirebase();
  if (!loaded || !fbFns || !firebaseStorage) throw new Error('Firebase Storage not available');
  const storage = firebaseStorage;
  return {
    storage,
    storageRef: (path: string) => fbFns!.storageRef(storage, path),
    uploadBytesResumable: fbFns.uploadBytesResumable,
    getDownloadURL: fbFns.getDownloadURL,
    deleteObject: fbFns.deleteObject,
  };
}

// ─── Auth Functions ─────────────────────────────────────

export function isFirebaseConfigured(): boolean {
  return !!FIREBASE_CONFIG.apiKey;
}

export function saveFirebaseConfig(config: Record<string, string>): void {
  for (const [key, value] of Object.entries(config)) {
    localStorage.setItem(`nousai-fb-${key}`, value);
  }
  // Reload to apply
  window.location.reload();
}

export function getFirebaseConfig(): Record<string, string> {
  return { ...FIREBASE_CONFIG };
}

export async function signUp(email: string, password: string, displayName?: string): Promise<AuthUser> {
  const loaded = await loadFirebase();
  if (!loaded) throw new Error('Firebase not configured. Go to Settings → Cloud Sync to set up.');

  const fb = fbFns!;
  const cred = await fb.createUserWithEmailAndPassword(firebaseAuth, email, password);

  if (displayName) {
    await fb.updateProfile(cred.user, { displayName });
  }

  return {
    uid: cred.user.uid,
    email: cred.user.email || email,
    displayName: displayName || cred.user.displayName || undefined,
  };
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const loaded = await loadFirebase();
  if (!loaded) throw new Error('Firebase not configured. Go to Settings → Cloud Sync to set up.');

  const fb = fbFns!;
  const cred = await fb.signInWithEmailAndPassword(firebaseAuth, email, password);

  return {
    uid: cred.user.uid,
    email: cred.user.email || email,
    displayName: cred.user.displayName || undefined,
  };
}

/**
 * SYNC FIX #10 — 2026-03-27
 * Bug: Logout didn't clear local data — next user inherited previous user's data
 * Fix: Clear sync-related localStorage keys and Lamport clock on logout.
 *      IDB data is kept (offline-first design) but tagged with previous UID
 *      so it won't be used for the new user.
 */
export async function logOut(): Promise<void> {
  // Stop RxDB replication before signing out
  await stopReplication().catch((e: unknown) => console.error('[AUTH] Replication stop failed:', e));

  // Clear sync-related localStorage keys to prevent cross-user data leakage
  const SYNC_CLEAR_KEYS = [
    'nousai-auth-uid', 'nousai-last-sync', 'nousai-last-pull', 'nousai-last-push',
    'nousai-data-modified-at', 'nousai-crash-recovery', 'nousai_lamport',
    'nousai-pre-pull-backup', 'nous_card_count_checkpoint',
  ];
  for (const key of SYNC_CLEAR_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  const loaded = await loadFirebase();
  if (!loaded) return;

  const fb = fbFns!;
  await fb.signOut(firebaseAuth);
}

export async function onAuthChange(callback: (user: AuthUser | null) => void): Promise<() => void> {
  const loaded = await loadFirebase();
  if (!loaded) {
    callback(null);
    return () => {};
  }

  const fb = fbFns!;
  return fb.onAuthStateChanged(firebaseAuth, (fbUser: { uid: string; email: string | null; displayName: string | null; emailVerified: boolean; isAnonymous: boolean } | null) => {
    if (fbUser) {
      callback({
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || undefined,
        emailVerified: fbUser.emailVerified,
        isAnonymous: fbUser.isAnonymous,
      });
      // Start RxDB ↔ Firestore per-document replication
      startReplication(fbUser.uid).catch(e =>
        warn('[AUTH] RxDB replication start failed (non-fatal):', e)
      );
    } else {
      callback(null);
      // Stop replication on sign-out
      stopReplication().catch((e: unknown) => console.error('[AUTH] Replication stop failed:', e));
    }
  });
}

// ─── Compression helpers (kept for saveConflictBackup) ──

/** Convert Uint8Array → base64 using chunked fromCharCode (avoids O(n²) string concat — mobile-safe) */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32KB — safe stack depth for Function.prototype.apply
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

async function compressString(str: string): Promise<string> {
  // Fallback for browsers without CompressionStream (iOS < 16.4)
  if (typeof CompressionStream === 'undefined') {
    const bytes = new TextEncoder().encode(str);
    return 'RAW:' + uint8ArrayToBase64(bytes);
  }
  const blob = new Blob([new TextEncoder().encode(str)]);
  const cs = new CompressionStream('gzip');
  const stream = blob.stream().pipeThrough(cs);
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLen = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Use value.slice() to correctly handle non-zero byteOffset (iOS Safari bug)
    chunks.push((value as Uint8Array).slice());
    totalLen += (value as Uint8Array).byteLength;
  }
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return uint8ArrayToBase64(result);
}

function decompressString(base64: string): string {
  // Handle fallback uncompressed format (from browsers without CompressionStream)
  if (base64.startsWith('RAW:')) {
    const binary = atob(base64.slice(4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  // Use pako for gzip decompression — works on all browsers (including iOS), handles
  // edge cases like trailing extra bytes that would crash DecompressionStream.
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return pako.ungzip(bytes, { to: 'string' });
}

// ─── Cloud Sync (V2 removed — see src/sync/cloudSync.ts for V3) ────────────


// ─── Real-Time Metadata Listener ────────────────────────
//
// Subscribes to the Firestore metadata document for a user to detect when
// another device has synced newer data. Calls onChange with the remote
// updatedAt timestamp whenever the document changes.

export async function subscribeToMetadataChanges(
  uid: string,
  onChange: (remoteUpdatedAt: string) => void,
): Promise<() => void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return () => {}
  const fb = fbFns
  const docRef = fb.doc(firebaseDb, 'users', uid)
  // onSnapshot returns an unsubscribe function
  return fb.onSnapshot(docRef, (snap: any) => {
    if (snap.exists()) {
      const updatedAt = snap.data()?.updatedAt
      if (typeof updatedAt === 'string') onChange(updatedAt)
    }
  }) as () => void
}

// ─── Omi Integration Helpers ─────────────────────────────

/** Subscribe to the live Omi inbox feed for a user. Returns unsubscribe fn. */
export async function subscribeOmiInbox(
  uid: string,
  onChange: (docs: Record<string, unknown>[]) => void,
  limitN = 30,
): Promise<() => void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return () => {}
  const fb = fbFns
  const col = fb.collection(firebaseDb, 'users', uid, 'omi-inbox')
  return fb.onSnapshot(col, (snap: any) => {
    const docs: Record<string, unknown>[] = snap.docs
      ? snap.docs
          .map((d: any) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.receivedAt || '').localeCompare(String(a.receivedAt || '')),
          )
          .slice(0, limitN)
      : []
    onChange(docs)
  }) as () => void
}

/** Subscribe to today's Omi study time document. Returns unsubscribe fn. */
export async function subscribeOmiTime(
  uid: string,
  date: string,
  onChange: (data: Record<string, unknown> | null) => void,
): Promise<() => void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return () => {}
  const fb = fbFns
  const ref = fb.doc(firebaseDb, 'users', uid, 'omi-time', date)
  return fb.onSnapshot(ref, (snap: any) => {
    onChange(snap.exists() ? snap.data() : null)
  }) as () => void
}

/** Subscribe to unsynced Omi flashcards. Returns unsubscribe fn. */
export async function subscribeOmiFlashcards(
  uid: string,
  onNew: (cards: { id: string; q: string; a: string; topic: string; omiMemoryId: string }[]) => void,
): Promise<() => void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return () => {}
  const fb = fbFns
  const col = fb.collection(firebaseDb, 'users', uid, 'omi-flashcards')
  return fb.onSnapshot(col, (snap: any) => {
    if (!snap.docs) return
    const unsynced = snap.docs
      .filter((d: any) => d.data().addedToFSRS === false)
      .map((d: any) => ({ id: d.id, ...d.data() }))
    if (unsynced.length > 0) onNew(unsynced)
  }) as () => void
}

/** Mark an Omi flashcard as added to FSRS (prevents duplicate syncing). */
export async function markOmiFlashcardSynced(uid: string, docId: string): Promise<void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return
  const fb = fbFns
  const ref = fb.doc(firebaseDb, 'users', uid, 'omi-flashcards', docId)
  await fb.setDoc(ref, { addedToFSRS: true }, { merge: true })
}

/** Save Omi auto-settings + AI key + speech profile to Firestore so webhook can read them. */
export async function saveOmiConfig(
  uid: string,
  config: {
    omiAutoSettings?: Record<string, boolean>
    omiAiKey?: string
    omiSpeechProfile?: Record<string, unknown>
  },
): Promise<void> {
  const loaded = await loadFirebase()
  if (!loaded || !fbFns) return
  const fb = fbFns
  const ref = fb.doc(firebaseDb, 'users', uid)
  await fb.setDoc(ref, config, { merge: true })
}

// ─── Email Verification ─────────────────────────────────

export async function sendVerificationEmail(): Promise<void> {
  const { getAuth, sendEmailVerification } = await import('firebase/auth');
  const auth = getAuth();
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

// ─── Google OAuth ────────────────────────────────────────

export async function signInWithGoogle(): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const { getAuth, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    return { user: { uid: cred.user.uid, email: cred.user.email || '', displayName: cred.user.displayName || undefined, emailVerified: cred.user.emailVerified, isAnonymous: false } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Google sign-in failed';
    console.error('[AUTH] Google sign-in failed:', e);
    return { user: null, error: msg };
  }
}

// ─── Anonymous Guest Mode ────────────────────────────────

export async function signInAsGuest(): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const auth = getAuth();
    const cred = await signInAnonymously(auth);
    return { user: { uid: cred.user.uid, email: '', displayName: undefined, emailVerified: false, isAnonymous: true } };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Guest sign-in failed';
    console.error('[AUTH] Guest sign-in failed:', e);
    return { user: null, error: msg };
  }
}

// ─── Account Deletion ────────────────────────────────────

export async function deleteAccount(): Promise<{ error?: string }> {
  try {
    const { getAuth, deleteUser } = await import('firebase/auth');
    const auth = getAuth();
    if (!auth.currentUser) return { error: 'Not signed in' };

    const uid = auth.currentUser.uid;

    // Delete all Firestore data for this user before deleting the auth account
    const loaded = await loadFirebase();
    if (loaded && fbFns && firebaseDb) {
      const fb = fbFns;
      try {
        // Delete sync-chunks subcollection
        const chunksCol = fb.collection(firebaseDb, 'users', uid, 'sync-chunks');
        const chunksSnap = await fb.getDocs(chunksCol);
        if (!chunksSnap.empty) {
          const batch = fb.writeBatch(firebaseDb);
          chunksSnap.forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }

        // Delete backups subcollection
        const backupsCol = fb.collection(firebaseDb, 'users', uid, 'backups');
        const backupsSnap = await fb.getDocs(backupsCol);
        if (!backupsSnap.empty) {
          const batch2 = fb.writeBatch(firebaseDb);
          backupsSnap.forEach((d: any) => batch2.delete(d.ref));
          await batch2.commit();
        }

        // Delete the user's root document
        const userDoc = fb.doc(firebaseDb, 'users', uid);
        await fb.deleteDoc(userDoc);
      } catch (firestoreErr) {
        // Non-fatal: log but proceed with auth deletion
        warn('[deleteAccount] Firestore cleanup failed (proceeding with auth deletion):', firestoreErr);
      }
    }

    await deleteUser(auth.currentUser);
    return {};
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete account';
    console.error('[AUTH] Account deletion failed:', e);
    return { error: msg };
  }
}

// ─── Local PIN Lock ─────────────────────────────────────
// For users who don't want cloud sync but still want a simple lock
// Uses SHA-256 hashing (not reversible like the old btoa approach)

async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + 'nousai-salt-v1');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function setLocalPin(pin: string): Promise<void> {
  const hashed = await hashPin(pin);
  localStorage.setItem('nousai-pin', hashed);
}

export async function checkLocalPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem('nousai-pin');
  if (!stored) return true; // No pin set
  // Support legacy btoa pins: if stored value is short (base64), migrate on successful check
  if (stored.length < 64) {
    // Legacy btoa format — check and migrate
    if (btoa(pin) === stored) {
      const hashed = await hashPin(pin);
      localStorage.setItem('nousai-pin', hashed);
      return true;
    }
    return false;
  }
  const hashed = await hashPin(pin);
  return hashed === stored;
}

export function hasLocalPin(): boolean {
  return !!localStorage.getItem('nousai-pin');
}

export function removeLocalPin(): void {
  localStorage.removeItem('nousai-pin');
}

// ─── Quick Keys Config Sync ───────────────────────────────────────────────────
//
// Persists the QK button-mapping config to users/{uid}/relay/qkConfig.
// Kept in the relay subcollection (separate from the 1MB main data doc).
// Written when the user remaps buttons; loaded on sign-in to restore mappings.

export async function saveQKConfig(uid: string, config: object): Promise<void> {
  const loaded = await loadFirebase();
  if (!loaded || !fbFns) return;
  const ref = fbFns.doc(firebaseDb, 'users', uid, 'relay', 'qkConfig');
  await fbFns.setDoc(ref, { config: JSON.stringify(config), updatedAt: Date.now() });
}

export async function loadQKConfig(uid: string): Promise<object | null> {
  const loaded = await loadFirebase();
  if (!loaded || !fbFns) return null;
  const ref = fbFns.doc(firebaseDb, 'users', uid, 'relay', 'qkConfig');
  const snap = await fbFns.getDoc(ref);
  if (!snap.exists()) return null;
  try {
    const raw = (snap.data() as { config: string }).config;
    return JSON.parse(raw) as object;
  } catch (e: unknown) {
    console.error('[AUTH] Failed to parse QK config:', e);
    return null;
  }
}

// ─── Safety Net Backup ───────────────────────────────────────────────────────
//
// On conflict detection, auto-exports a JSON snapshot to Firestore
// Backups/ subcollection so neither version is permanently lost.

/**
 * Save a snapshot of the current data to Firestore Backups/{uid}/snapshots/{timestamp}
 * Called automatically when a sync conflict is detected.
 *
 * Backups are not deleted automatically — they act as a safety net only.
 * The user can view/restore them from Settings → Cloud Sync (future feature).
 */
export async function saveConflictBackup(uid: string, data: NousAIData, label: string): Promise<void> {
  try {
    const loaded = await loadFirebase();
    if (!loaded || !fbFns) {
      warn('[BACKUP] Firebase not available — skipping conflict backup');
      return;
    }

    const fb = fbFns;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupRef = fb.doc(firebaseDb, 'users', uid, 'backups', `${timestamp}_${label}`);

    // Compress the snapshot to keep Firestore costs low
    const json = JSON.stringify(data);
    const compressed = await compressString(json);

    await fb.setDoc(backupRef, {
      data: compressed,
      label,
      createdAt: new Date().toISOString(),
      originalSize: json.length,
      compressedSize: compressed.length,
    });

    log(`[BACKUP] Saved conflict backup "${label}" (${(json.length / 1024).toFixed(1)} KB)`);
  } catch (e) {
    // Backup failures are non-fatal — log but don't throw
    console.error('[BACKUP] Failed to save conflict backup:', e);
  }
}

// ─── Content Sharing ────────────────────────────────────────

export interface ShareableContent {
  type: 'deck' | 'note' | 'drawing' | 'quiz';
  data: unknown;
  title: string;
  ownerId: string;
  ownerName: string;
  courseId: string | null;
  courseName: string | null;
  createdAt: string;
}

/** Publish content to the shared-content collection. Returns the shareId. */
export async function publishSharedContent(content: ShareableContent): Promise<string | null> {
  const loaded = await loadFirebase();
  if (!loaded || !fbFns) return null;
  const fb = fbFns;
  const shareId = crypto.randomUUID();
  try {
    const docRef = fb.doc(firebaseDb, 'shared-content', shareId);
    await fb.setDoc(docRef, {
      ...content,
      createdAt: new Date().toISOString(),
    });
    log('[SHARE] Published content:', shareId);
    return shareId;
  } catch (e) {
    console.error('[SHARE] Failed to publish:', e);
    return null;
  }
}

/** Fetch shared content by ID (public read). */
export async function fetchSharedContent(shareId: string): Promise<ShareableContent | null> {
  const loaded = await loadFirebase();
  if (!loaded || !fbFns) return null;
  const fb = fbFns;
  try {
    const docRef = fb.doc(firebaseDb, 'shared-content', shareId);
    const snap = await fb.getDoc(docRef);
    if (snap.exists()) return snap.data() as ShareableContent;
    return null;
  } catch (e) {
    console.error('[SHARE] Failed to fetch:', e);
    return null;
  }
}
