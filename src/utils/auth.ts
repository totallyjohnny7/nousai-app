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
  collection: any;
  getDocs: any;
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
    console.log('NousAI: No Firebase config found, running in local mode');
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
    const { getFirestore, doc, setDoc, getDoc, collection, getDocs, writeBatch, deleteDoc, deleteField, onSnapshot } = storeMod;
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
      collection,
      getDocs,
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
    console.warn('NousAI: Firebase failed to load, using local mode', e);
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

export async function logOut(): Promise<void> {
  // Stop RxDB replication before signing out
  await stopReplication().catch(() => {});

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
  return fb.onAuthStateChanged(firebaseAuth, (fbUser: any) => {
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
        console.warn('[AUTH] RxDB replication start failed (non-fatal):', e)
      );
    } else {
      callback(null);
      // Stop replication on sign-out
      stopReplication().catch(() => {});
    }
  });
}

// ─── Compression helpers (gzip via native CompressionStream) ──

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

// ─── Cloud Sync ─────────────────────────────────────────

/**
 * Trim data before cloud sync to stay under Firestore's 1MB document limit.
 * Strips bulky quiz question objects, caps history arrays, and limits tutor sessions.
 */
function trimForSync(data: any): any {
  const d = structuredClone(data);
  const pd = d.pluginData || {};

  // 1. Quiz history: keep last 100 attempts, preserve metadata + slim answers for question display
  if (Array.isArray(pd.quizHistory)) {
    pd.quizHistory = pd.quizHistory.slice(-100).map((a: any) => {
      const base: any = {
        id: a.id, name: a.name, subject: a.subject, subtopic: a.subtopic,
        score: a.score, correct: a.correct, questionCount: a.questionCount,
        total: a.total, date: a.date, type: a.type, mode: a.mode,
        folder: a.folder,
      };
      // Keep questions for ALL untaken quizzes (needed to play them later)
      // score === -1 means quiz hasn't been taken yet, regardless of mode
      if (a.score === -1 && Array.isArray(a.questions) && a.questions.length > 0) {
        base.questions = a.questions;
      }
      // Keep slim answers for all taken quizzes (strip timeMs/explanation to save space)
      if (Array.isArray(a.answers) && a.answers.length > 0) {
        base.answers = a.answers.map((ans: any) => ({
          question: ans.question ? {
            type: ans.question.type,
            question: ans.question.question,
            options: ans.question.options,
            correctAnswer: ans.question.correctAnswer,
            explanation: ans.question.explanation,
          } : ans.question,
          userAnswer: ans.userAnswer,
          correct: ans.correct,
        }));
      }
      return base;
    });
  }

  // 2. Proficiency data: keep last 20 attempts per topic (prevents unbounded growth)
  if (pd.proficiencyData && typeof pd.proficiencyData === 'object') {
    for (const subj of Object.keys(pd.proficiencyData)) {
      const topics = pd.proficiencyData[subj];
      if (topics && typeof topics === 'object') {
        for (const topic of Object.keys(topics)) {
          if (Array.isArray(topics[topic]) && topics[topic].length > 20)
            topics[topic] = topics[topic].slice(-20);
        }
      }
    }
  }

  // 3. Spaced-repetition card history: keep last 30 reviews per card
  if (pd.srData?.cards && Array.isArray(pd.srData.cards)) {
    pd.srData.cards = pd.srData.cards.map((c: any) => ({
      ...c,
      history: Array.isArray(c.history) ? c.history.slice(-30) : c.history,
    }));
  }

  // 4a. Strip canvas storage keys from annotations (canvas PNG lives in IDB only)
  if (Array.isArray(pd.annotations)) {
    pd.annotations = pd.annotations.map((a: any) => {
      const { canvasStorageKey: _strip, ...rest } = a;
      return rest;
    });
  }

  // 4. Tutor sessions: keep last 30 messages per session
  if (d.tutorSessions && typeof d.tutorSessions === 'object') {
    for (const key of Object.keys(d.tutorSessions)) {
      if (Array.isArray(d.tutorSessions[key]) && d.tutorSessions[key].length > 30)
        d.tutorSessions[key] = d.tutorSessions[key].slice(-30);
    }
  }

  // 5. Cap localData to prevent unbounded growth (mindmaps, flashcards, notes, etc.)
  // Priority keys are always included first; large content keys only get remaining budget.
  if (d.localData && typeof d.localData === 'object') {
    const MAX_KEY_BYTES = 500_000;  // 500 KB per key
    const MAX_TOTAL_BYTES = 2_000_000; // 2 MB total for all localData
    // Process critical keys first so they're never crowded out by large content
    const PRIORITY_KEYS = [
      'nousai-bank-deleted', 'nousai-bank-edits',
      'nousai-quiz-folders', 'nousai-quiz-folder-map',
      'nousai-study-plan', 'nousai-jp-vocab', 'nousai-formulas', 'nousai-solver-recent',
      'nousai-pref-daily-xp', 'nousai-pref-quiz-count', 'nousai-pref-flashcard-flip',
      'nousai-pref-pomo-work', 'nousai-pref-pomo-break', 'nousai-pref-language',
      'nousai-pref-difficulty', 'nousai-pref-sound', 'nousai-pref-fontsize',
      'nousai-pref-compact', 'nousai-tts-prefs', 'nousai-stt-prefs',
      'nousai-palm-rejection', 'nousai-auto-sync',
    ];
    const localData = d.localData as Record<string, string>;
    const remaining = Object.keys(localData).filter(k => !PRIORITY_KEYS.includes(k));
    const orderedKeys = [...PRIORITY_KEYS.filter(k => k in localData), ...remaining];
    let total = 0;
    const trimmedLocal: Record<string, string> = {};
    for (const k of orderedKeys) {
      const v = localData[k];
      if (typeof v !== 'string') continue;
      if (v.length <= MAX_KEY_BYTES && total + v.length <= MAX_TOTAL_BYTES) {
        trimmedLocal[k] = v;
        total += v.length;
      }
    }
    d.localData = trimmedLocal;
  }

  // 6a. Strip cardQualityCache — ephemeral, regenerated on demand, never sync to Firestore
  if (pd.cardQualityCache) {
    delete pd.cardQualityCache;
  }

  // 6. Video metadata: strip downloadUrl + thumbnailBase64 (regenerated on demand), cap at 50
  if (Array.isArray(pd.savedVideos)) {
    pd.savedVideos = pd.savedVideos
      .sort((a: any, b: any) => (a.createdAt > b.createdAt ? -1 : 1))
      .slice(0, 50)
      .map((v: any) => {
        const { downloadUrl: _du, thumbnailBase64: _tb, ...rest } = v;
        return rest;
      });
  }

  d.pluginData = pd;
  return d;
}

export async function syncToCloud(uid: string, data: NousAIData): Promise<void> {
  console.log('[AUTH] syncToCloud: loading firebase...');
  const loaded = await loadFirebase();
  console.log('[AUTH] syncToCloud: firebase loaded =', loaded);
  if (!loaded) throw new Error('Firebase not available. Check your internet connection or Firebase config.');

  const fb = fbFns!;
  const docRef = fb.doc(firebaseDb, 'users', uid);

  // Collect tutor sessions from localStorage
  const tutorSessions: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('nousai-tutor-')) {
      try { tutorSessions[key] = JSON.parse(localStorage.getItem(key) || '[]'); } catch { /* skip */ }
    }
  }

  // Collect additional localStorage data for cross-device sync
  // These keys contain user content that should persist across devices
  const SYNC_KEYS = [
    'nousai-jp-vocab', 'nousai-quicknotes', 'nousai-cornell-notes',
    'nousai-mindmaps', 'nousai-formulas', 'nousai-study-plan',
    'nousai-ai-flashcards', 'nousai-quiz-folders', 'nousai-quiz-folder-map',
    'nousai-bank-deleted', 'nousai-bank-edits', 'nousai-solver-recent',
    // Preferences (non-sensitive)
    'nousai-pref-daily-xp', 'nousai-pref-quiz-count', 'nousai-pref-flashcard-flip',
    'nousai-pref-pomo-work', 'nousai-pref-pomo-break', 'nousai-pref-language',
    'nousai-pref-difficulty', 'nousai-pref-sound', 'nousai-pref-fontsize',
    'nousai-pref-compact', 'nousai-tts-prefs', 'nousai-stt-prefs',
    'nousai-palm-rejection', 'nousai-auto-sync',
  ];
  const localData: Record<string, string> = {};
  for (const key of SYNC_KEYS) {
    const val = localStorage.getItem(key);
    if (val) localData[key] = val;
  }

  // Strip sensitive credentials before syncing to cloud
  const safeData = {
    ...data,
    settings: {
      ...data.settings,
      canvasToken: '',   // Never sync Canvas API token to cloud
      aiProvider: data.settings.aiProvider,
      // Strip any AI API keys from settings
      ...(Object.fromEntries(
        Object.entries(data.settings).filter(([k]) =>
          !k.toLowerCase().includes('token') && !k.toLowerCase().includes('apikey') && !k.toLowerCase().includes('api_key')
        )
      )),
      canvasUrl: data.settings.canvasUrl, // URL is safe to sync
    },
    tutorSessions,
    localData,
  };

  // Trim data to fit within Firestore 1MB document limit
  const trimmed = trimForSync(safeData);
  const json = JSON.stringify(trimmed);
  console.log('[AUTH] syncToCloud: raw JSON =', (json.length / 1024).toFixed(1), 'KB, compressing...');
  const compressed = await compressString(json);
  console.log('[AUTH] syncToCloud: compressed =', (compressed.length / 1024).toFixed(1), 'KB');

  // Store compressed data as chunks in Firestore subcollection (avoids Cloud Storage CORS issues)
  const CHUNK_SIZE = 800_000; // ~800KB per chunk (well under 1MB Firestore limit)
  const totalChunks = Math.ceil(compressed.length / CHUNK_SIZE);
  console.log('[AUTH] syncToCloud: splitting into', totalChunks, 'chunks');

  try {
    // ATOMIC SYNC: Write new chunks with a versioned prefix FIRST, then swap
    // the metadata pointer, then clean up old chunks. If we fail mid-write,
    // old data is still intact and the metadata still points to the old version.
    const syncVersion = Date.now();
    const chunkPrefix = `v${syncVersion}_chunk_`;
    const chunksCol = fb.collection(firebaseDb, 'users', uid, 'sync-chunks');

    // Step 1: Write ALL new chunks (versioned names — won't collide with old chunks)
    for (let i = 0; i < totalChunks; i++) {
      const chunk = compressed.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const chunkRef = fb.doc(firebaseDb, 'users', uid, 'sync-chunks', `${chunkPrefix}${String(i).padStart(4, '0')}`);
      await fb.setDoc(chunkRef, { data: chunk, index: i });
    }
    console.log('[AUTH] syncToCloud: wrote', totalChunks, 'new chunks (v' + syncVersion + ')');

    // Step 2: Atomically swap the metadata pointer to the new version
    // This is the "commit point" — after this, readers see the new data
    const now = new Date().toISOString();
    await fb.setDoc(docRef, {
      chunkedSync: true,
      totalChunks,
      compressedSize: compressed.length,
      chunkPrefix,           // tells reader which chunk set to load
      syncVersion,           // monotonic version counter
      updatedAt: now,
      version: '2.1.0',     // bumped to indicate atomic sync format
      // Clean up stale fields from old sync formats
      storageSync: fb.deleteField(),
      compressed: fb.deleteField(),
      data: fb.deleteField(),
    }, { merge: true });
    console.log('[AUTH] syncToCloud: metadata swapped to v' + syncVersion);

    // Step 3: Clean up old chunks (best-effort — if this fails, stale chunks just waste space)
    try {
      const allChunks = await fb.getDocs(chunksCol);
      const staleChunks = allChunks.docs.filter((d: any) => !d.id.startsWith(chunkPrefix));
      if (staleChunks.length > 0) {
        // Firestore batch limit is 500 ops — process in batches
        for (let i = 0; i < staleChunks.length; i += 450) {
          const batch = fb.writeBatch(firebaseDb);
          staleChunks.slice(i, i + 450).forEach((d: any) => batch.delete(d.ref));
          await batch.commit();
        }
        console.log('[AUTH] syncToCloud: cleaned up', staleChunks.length, 'old chunks');
      }
    } catch (cleanupErr) {
      // Cleanup failure is non-critical — old chunks are just wasted space
      console.warn('[AUTH] syncToCloud: old chunk cleanup failed (non-critical):', cleanupErr);
    }
  } catch (e: any) {
    console.error('[AUTH] syncToCloud: write failed', e?.code, e?.message);
    if (e?.code === 'permission-denied') {
      throw new Error('Sync failed: permission denied. Try signing out and back in. If the problem persists, contact the app admin.');
    }
    if (e?.message?.includes('network') || e?.code === 'unavailable') {
      throw new Error('Sync failed: check your internet connection and try again.');
    }
    throw new Error(`Sync failed: ${e?.message || 'Unknown error'}. Try again later.`);
  }
}

export async function syncFromCloud(uid: string): Promise<NousAIData | null> {
  console.log('[AUTH] syncFromCloud: loading firebase...');
  const loaded = await loadFirebase();
  console.log('[AUTH] syncFromCloud: firebase loaded =', loaded);
  if (!loaded) throw new Error('Firebase not available. Check your internet connection or Firebase config.');

  const fb = fbFns!;
  const docRef = fb.doc(firebaseDb, 'users', uid);

  try {
    console.log('[AUTH] syncFromCloud: reading from Firestore...');
    const snap = await fb.getDoc(docRef);
    console.log('[AUTH] syncFromCloud: doc exists =', snap.exists());

    if (snap.exists()) {
      const raw = snap.data();
      try {
        let jsonStr: string;
        if (raw.chunkedSync) {
          // V2/V2.1: Read compressed data from Firestore subcollection chunks
          // V2.1 (atomic sync) uses chunkPrefix to identify the correct chunk set
          const prefix = raw.chunkPrefix || 'chunk_'; // fallback for pre-atomic V2 format
          console.log('[AUTH] syncFromCloud: reading', raw.totalChunks, 'chunks (prefix:', prefix + ')');
          const chunksCol = fb.collection(firebaseDb, 'users', uid, 'sync-chunks');
          const chunksSnap = await fb.getDocs(chunksCol);
          // Only read chunks matching the current version prefix
          const sorted = chunksSnap.docs
            .filter((d: any) => d.id.startsWith(prefix))
            .map((d: any) => ({ index: d.data().index, data: d.data().data }))
            .sort((a: any, b: any) => a.index - b.index);
          if (sorted.length === 0 && raw.totalChunks > 0) {
            console.error('[AUTH] syncFromCloud: no chunks found with prefix', prefix, '— possible corruption');
            throw new Error('Sync data corrupted: chunks missing. Try syncing from another device.');
          }
          const compressed = sorted.map((c: any) => c.data).join('');
          console.log('[AUTH] syncFromCloud: reassembled', (compressed.length / 1024).toFixed(1), 'KB compressed');
          jsonStr = decompressString(compressed);
        } else if (raw.storageSync) {
          // LEGACY V1.1: Cloud Storage (may fail without CORS config)
          console.log('[AUTH] syncFromCloud: downloading from Cloud Storage...');
          const storagePath = fb.storageRef(firebaseStorage, `users/${uid}/sync-data.gz`);
          const url = await fb.getDownloadURL(storagePath);
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Download failed: HTTP ${response.status}`);
          const arrayBuf = await response.arrayBuffer();
          console.log('[AUTH] syncFromCloud: downloaded', (arrayBuf.byteLength / 1024).toFixed(1), 'KB raw');
          const blob = new Blob([arrayBuf]);
          const ds = new DecompressionStream('gzip');
          const decompStream = blob.stream().pipeThrough(ds);
          const reader = decompStream.getReader();
          const textChunks: string[] = [];
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            textChunks.push(decoder.decode(value as Uint8Array, { stream: true }));
          }
          textChunks.push(decoder.decode());
          jsonStr = textChunks.join('');
        } else if (raw.compressed) {
          // LEGACY: Decompress from Firestore doc
          console.log('[AUTH] syncFromCloud: decompressing from Firestore...');
          jsonStr = decompressString(raw.data);
        } else {
          // VERY OLD: Raw JSON in Firestore doc
          jsonStr = raw.data;
        }
        console.log('[AUTH] syncFromCloud: parsed', (jsonStr.length / 1024).toFixed(1), 'KB');
        const parsed = JSON.parse(jsonStr) as NousAIData & { tutorSessions?: Record<string, unknown> };

        // Restore tutor sessions to localStorage
        if (parsed.tutorSessions) {
          for (const [key, value] of Object.entries(parsed.tutorSessions)) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* skip if storage full */ }
          }
          delete parsed.tutorSessions;
        }

        // Restore additional localStorage data (vocab, notes, preferences, etc.)
        if ((parsed as any).localData) {
          for (const [key, value] of Object.entries((parsed as any).localData)) {
            try { localStorage.setItem(key, String(value)); } catch { /* skip */ }
          }
          delete (parsed as any).localData;
        }

        return parsed;
      } catch (innerErr: any) {
        console.error('[AUTH] syncFromCloud: decompress/parse failed:', innerErr?.message, innerErr);
        throw new Error('Cloud data error: ' + (innerErr?.message || 'corrupted data. Try syncing to cloud again.'));
      }
    }
    return null;
  } catch (e: any) {
    console.error('[AUTH] syncFromCloud: read failed', e?.code, e?.message);
    if (e?.code === 'permission-denied' || e?.code === 'storage/unauthorized') {
      throw new Error('Sync failed: permission denied. Try signing out and back in. If the problem persists, contact the app admin.');
    }
    if (e?.message?.includes('network') || e?.code === 'unavailable') {
      throw new Error('Sync failed: check your internet connection and try again.');
    }
    if (e?.message?.includes('corrupted') || e?.message?.includes('Cloud data error')) throw e; // Re-throw descriptive errors without double-wrapping
    throw new Error(`Sync failed: ${e?.message || 'Unknown error'}. Try again later.`);
  }
}

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
  } catch (e: any) {
    return { user: null, error: e?.message || 'Google sign-in failed' };
  }
}

// ─── Anonymous Guest Mode ────────────────────────────────

export async function signInAsGuest(): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const { getAuth, signInAnonymously } = await import('firebase/auth');
    const auth = getAuth();
    const cred = await signInAnonymously(auth);
    return { user: { uid: cred.user.uid, email: '', displayName: undefined, emailVerified: false, isAnonymous: true } };
  } catch (e: any) {
    return { user: null, error: e?.message || 'Guest sign-in failed' };
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
        console.warn('[deleteAccount] Firestore cleanup failed (proceeding with auth deletion):', firestoreErr);
      }
    }

    await deleteUser(auth.currentUser);
    return {};
  } catch (e: any) {
    return { error: e?.message || 'Failed to delete account' };
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
    return JSON.parse(raw);
  } catch {
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
      console.warn('[BACKUP] Firebase not available — skipping conflict backup');
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

    console.log(`[BACKUP] Saved conflict backup "${label}" (${(json.length / 1024).toFixed(1)} KB)`);
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
    console.log('[SHARE] Published content:', shareId);
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
