/**
 * Sync V3 — Single-file cloud sync engine
 * Replaces: firestoreSync.ts, mergeEngine.ts, lamportClock.ts, retrySync.ts
 */
import pako from 'pako';
import type { NousAIData, Course } from '../types';

const CHUNK_SIZE = 800_000; // ~800KB per Firestore doc
const DEVICE_ID_KEY = 'nousai-device-id';
const RETRY_DELAYS = [1000, 2000, 4000];

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ── Compression ────────────────────────────────────────────
function compress(data: NousAIData): Uint8Array {
  // Strip ephemeral/sensitive fields before sync
  const safe = {
    ...data,
    settings: {
      ...Object.fromEntries(
        Object.entries(data.settings).filter(([k]) =>
          !k.toLowerCase().includes('token') && !k.toLowerCase().includes('apikey') && !k.toLowerCase().includes('api_key')
        )
      ),
      canvasToken: '',
    },
    pluginData: {
      ...data.pluginData,
      cardQualityCache: undefined, // ephemeral
    },
  };
  const json = JSON.stringify(safe);
  return pako.gzip(json);
}

function decompress(bytes: Uint8Array): NousAIData {
  const json = pako.ungzip(bytes, { to: 'string' });
  return JSON.parse(json);
}

// ── Chunking ───────────────────────────────────────────────
function chunkData(compressed: Uint8Array): string[] {
  const binary = String.fromCharCode(...compressed);
  const base64 = btoa(binary);
  const chunks: string[] = [];
  for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
    chunks.push(base64.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

function unchunkData(chunks: string[]): Uint8Array {
  const base64 = chunks.join('');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Retry helper ───────────────────────────────────────────
async function withRetry<T>(fn: () => Promise<T>, retries = RETRY_DELAYS): Promise<T> {
  for (let i = 0; i <= retries.length; i++) {
    try {
      return await fn();
    } catch (e: unknown) {
      if (i === retries.length) throw e;
      console.warn(`[sync] Retry ${i + 1}/${retries.length} after ${retries[i]}ms:`, e instanceof Error ? e.message : e);
      await new Promise(r => setTimeout(r, retries[i]));
    }
  }
  throw new Error('Unreachable');
}

// ── Firebase helpers (lazy loaded) ─────────────────────────
async function getFirebaseFns() {
  const storeMod = await import('firebase/firestore');
  const { getFirestore, doc, setDoc, getDoc, getDocFromServer, collection, getDocs, writeBatch, deleteDoc } = storeMod;
  const appMod = await import('firebase/app');
  // Get the existing Firebase app (already initialized by auth.ts)
  const app = appMod.getApps()[0];
  if (!app) throw new Error('Firebase not initialized');
  const db = getFirestore(app);
  return { db, doc, setDoc, getDoc, getDocFromServer, collection, getDocs, writeBatch, deleteDoc };
}

// ── Tombstone cleanup ──────────────────────────────────────
const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function cleanTombstones(data: NousAIData): NousAIData {
  const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
  const cleanArray = <T extends { deleted?: boolean; deletedAt?: number }>(arr: T[] | undefined): T[] | undefined => {
    if (!arr) return arr;
    return arr.filter(item => !(item.deleted && item.deletedAt && item.deletedAt < cutoff));
  };

  return {
    ...data,
    pluginData: {
      ...data.pluginData,
      coachData: {
        ...data.pluginData.coachData,
        courses: (data.pluginData.coachData.courses as (Course & { deleted?: boolean; deletedAt?: number })[]).map(c => ({
          ...c,
          flashcards: cleanArray(c.flashcards) || [],
        })).filter(c => !(c.deleted && c.deletedAt && c.deletedAt < cutoff)),
      },
      notes: cleanArray(data.pluginData.notes as { deleted?: boolean; deletedAt?: number }[]),
      drawings: cleanArray(data.pluginData.drawings as { deleted?: boolean; deletedAt?: number }[]),
      savedVideos: cleanArray(data.pluginData.savedVideos as { deleted?: boolean; deletedAt?: number }[]),
      aiChatSessions: cleanArray(data.pluginData.aiChatSessions as { deleted?: boolean; deletedAt?: number }[]),
      studyGuides: cleanArray(data.pluginData.studyGuides as { deleted?: boolean; deletedAt?: number }[]),
      deletionLog: (data.pluginData.deletionLog || []).filter(e => e.deletedAt > cutoff),
    },
  };
}

// ── Simple checksum for dedup ──────────────────────────────
function quickHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// ── Push to cloud ──────────────────────────────────────────
export async function pushToCloud(uid: string, data: NousAIData): Promise<void> {
  // Dedup: skip if data hasn't changed since last push
  const dataStr = JSON.stringify(data);
  const hash = quickHash(dataStr);
  const lastHash = localStorage.getItem('nousai-push-hash');
  if (hash === lastHash) {
    console.log('[sync] Push: skipped (no changes)');
    return;
  }

  const cleaned = cleanTombstones(data);
  const compressed = compress(cleaned);
  const chunks = chunkData(compressed);
  const deviceId = getDeviceId();

  const fb = await getFirebaseFns();

  await withRetry(async () => {
    // Write metadata doc
    const metaRef = fb.doc(fb.db, 'users', uid, 'sync-v3', 'meta');
    await fb.setDoc(metaRef, {
      deviceId,
      chunkCount: chunks.length,
      updatedAt: new Date().toISOString(),
      pushedAt: Date.now(),
      compressedSize: compressed.length,
      version: 3,
    });

    // Write chunks
    const batch = fb.writeBatch(fb.db);
    for (let i = 0; i < chunks.length; i++) {
      const chunkRef = fb.doc(fb.db, 'users', uid, 'sync-v3', `chunk-${i}`);
      batch.set(chunkRef, { data: chunks[i], index: i });
    }
    await batch.commit();

    // Clean up old chunks if count decreased
    const oldChunksSnap = await fb.getDocs(fb.collection(fb.db, 'users', uid, 'sync-v3'));
    for (const d of oldChunksSnap.docs) {
      if (d.id.startsWith('chunk-')) {
        const idx = parseInt(d.id.replace('chunk-', ''));
        if (idx >= chunks.length) {
          await fb.deleteDoc(d.ref);
        }
      }
    }
  });

  const pushTs = Date.now();
  localStorage.setItem('nousai-last-sync', new Date().toISOString());
  localStorage.setItem('nousai-last-push', new Date().toISOString());
  localStorage.setItem('nousai-last-push-ts', String(pushTs));
  localStorage.setItem('nousai-push-hash', hash);
  console.log(`[sync] Push: success, ${chunks.length} chunks, ${(compressed.length / 1024).toFixed(1)}KB compressed`);
}

// ── Pull from cloud ────────────────────────────────────────
const PULL_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export async function pullFromCloud(uid: string, localData: NousAIData | null, force = false): Promise<NousAIData | null> {
  // Cooldown: skip if pulled recently (unless forced)
  if (!force) {
    const lastPull = parseInt(localStorage.getItem('nousai-last-pull-ts') || '0');
    if (Date.now() - lastPull < PULL_COOLDOWN_MS) {
      console.log('[sync] Pull: skipped (cooldown)');
      return null;
    }
  }

  const fb = await getFirebaseFns();

  const metaRef = fb.doc(fb.db, 'users', uid, 'sync-v3', 'meta');
  const metaSnap = await withRetry(() => fb.getDocFromServer(metaRef));
  if (!metaSnap.exists()) {
    console.log('[sync] Pull: no cloud data found');
    return null;
  }

  const meta = metaSnap.data() as { deviceId: string; chunkCount: number; updatedAt: string; pushedAt?: number; version: number };

  // Timestamp check: skip if cloud data is same or older than our last push
  const lastLocalPush = parseInt(localStorage.getItem('nousai-last-push-ts') || '0');
  if (meta.pushedAt && meta.pushedAt <= lastLocalPush) {
    console.log('[sync] Pull: cloud data is same or older than last push — skipping');
    return null;
  }

  // Read all chunks
  const chunks: string[] = [];
  for (let i = 0; i < meta.chunkCount; i++) {
    const chunkRef = fb.doc(fb.db, 'users', uid, 'sync-v3', `chunk-${i}`);
    const chunkSnap = await withRetry(() => fb.getDocFromServer(chunkRef));
    if (!chunkSnap.exists()) throw new Error(`Missing chunk ${i}`);
    chunks.push((chunkSnap.data() as { data: string }).data);
  }

  const compressed = unchunkData(chunks);
  const cloudData = decompress(compressed);
  localStorage.setItem('nousai-last-pull-ts', String(Date.now()));
  console.log(`[sync] Pull: received from device ${meta.deviceId}, ${meta.chunkCount} chunks`);

  if (!localData) return cloudData;

  // ── Merge with tombstone awareness ───────────────────
  return mergeWithTombstones(localData, cloudData);
}

// ── Tombstone-aware merge ──────────────────────────────────
function mergeWithTombstones(local: NousAIData, cloud: NousAIData): NousAIData {
  const localDeletionLog = new Set((local.pluginData.deletionLog || []).map(e => e.id));
  const cloudDeletionLog = new Set((cloud.pluginData.deletionLog || []).map(e => e.id));

  function mergeArrayById<T extends { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }>(
    localArr: T[] | undefined,
    cloudArr: T[] | undefined,
  ): T[] {
    // Ensure every item has an id (backfill for cards that predate id assignment)
    const ensureId = (arr: T[] | undefined): T[] =>
      (arr || []).map((item, i) => item.id ? item : { ...item, id: `_backfill_${i}_${Date.now()}` });
    const safeLocal = ensureId(localArr);
    const safeCloud = ensureId(cloudArr);
    const map = new Map<string, T>();

    // Add all local items
    for (const item of safeLocal) {
      // Skip if cloud deleted this item
      if (cloudDeletionLog.has(item.id) && !item.deleted) continue;
      map.set(item.id, item);
    }

    // Merge cloud items
    for (const item of safeCloud) {
      // Skip if local deleted this item
      if (localDeletionLog.has(item.id) && !item.deleted) continue;

      const existing = map.get(item.id);
      if (!existing) {
        map.set(item.id, item);
      } else {
        // Both sides have it — newer updatedAt wins, cloud wins ties
        const localTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const cloudTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
        if (cloudTime >= localTime) {
          map.set(item.id, item);
        }
        // If either side has deleted:true and deletedAt is newer, keep deletion
        if (existing.deleted || item.deleted) {
          const localDel = existing.deleted ? (existing.deletedAt || 0) : 0;
          const cloudDel = item.deleted ? (item.deletedAt || 0) : 0;
          if (localDel > 0 || cloudDel > 0) {
            const winner = map.get(item.id)!;
            if (localDel > cloudDel) {
              map.set(item.id, { ...winner, deleted: true, deletedAt: existing.deletedAt });
            } else if (cloudDel > 0) {
              map.set(item.id, { ...winner, deleted: true, deletedAt: item.deletedAt });
            }
          }
        }
      }
    }

    return Array.from(map.values());
  }

  // Merge courses with per-card flashcard merge
  type MergeableCourse = Course & { deleted?: boolean; deletedAt?: number; updatedAt?: string };
  const localCourseMap = new Map((local.pluginData.coachData.courses || []).map(c => [c.id, c as MergeableCourse]));
  const cloudCourseMap = new Map((cloud.pluginData.coachData.courses || []).map(c => [c.id, c as MergeableCourse]));
  const allCourseIds = new Set([...localCourseMap.keys(), ...cloudCourseMap.keys()]);

  const mergedCourses: Course[] = [];
  for (const cid of allCourseIds) {
    const localC = localCourseMap.get(cid);
    const cloudC = cloudCourseMap.get(cid);

    if (localC && cloudDeletionLog.has(cid) && !localC.deleted) continue;
    if (cloudC && localDeletionLog.has(cid) && !cloudC.deleted) continue;

    if (!localC) { mergedCourses.push(cloudC!); continue; }
    if (!cloudC) { mergedCourses.push(localC); continue; }

    // Both exist — merge course-level fields (newer wins)
    const localTime = localC.updatedAt ? new Date(localC.updatedAt).getTime() : 0;
    const cloudTime = cloudC.updatedAt ? new Date(cloudC.updatedAt).getTime() : 0;
    const baseCourse = cloudTime >= localTime ? cloudC : localC;

    // Handle course-level deletion
    if (localC.deleted || cloudC.deleted) {
      const lDel = localC.deleted ? (localC.deletedAt || 0) : 0;
      const cDel = cloudC.deleted ? (cloudC.deletedAt || 0) : 0;
      const delCourse = lDel >= cDel
        ? { ...baseCourse, deleted: true, deletedAt: localC.deletedAt }
        : { ...baseCourse, deleted: true, deletedAt: cloudC.deletedAt };
      mergedCourses.push(delCourse as Course);
      continue;
    }

    // Per-card merge within the course (cards have id field)
    type MergeableCard = { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string };
    const mergedCards = mergeArrayById(
      (localC.flashcards || []) as unknown as MergeableCard[],
      (cloudC.flashcards || []) as unknown as MergeableCard[],
    );

    mergedCourses.push({ ...baseCourse, flashcards: mergedCards as unknown as Course['flashcards'] });
  }

  // Merge deletion logs
  const mergedDeletionLog = [
    ...(local.pluginData.deletionLog || []),
    ...(cloud.pluginData.deletionLog || []).filter(
      ce => !(local.pluginData.deletionLog || []).some(le => le.id === ce.id)
    ),
  ];

  return {
    // Settings: cloud wins (simpler, less conflicting)
    settings: { ...local.settings, ...cloud.settings },
    pluginData: {
      ...local.pluginData,
      ...cloud.pluginData,
      coachData: {
        ...local.pluginData.coachData,
        ...cloud.pluginData.coachData,
        courses: mergedCourses,
      },
      notes: mergeArrayById(
        local.pluginData.notes as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
        cloud.pluginData.notes as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
      ),
      drawings: mergeArrayById(
        local.pluginData.drawings as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
        cloud.pluginData.drawings as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
      ),
      savedVideos: mergeArrayById(
        local.pluginData.savedVideos as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
        cloud.pluginData.savedVideos as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
      ),
      aiChatSessions: mergeArrayById(
        local.pluginData.aiChatSessions as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
        cloud.pluginData.aiChatSessions as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
      ),
      studyGuides: mergeArrayById(
        local.pluginData.studyGuides as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
        cloud.pluginData.studyGuides as { id: string; deleted?: boolean; deletedAt?: number; updatedAt?: string }[],
      ),
      deletionLog: mergedDeletionLog,
      // Gamification: keep higher values
      gamificationData: (
        (cloud.pluginData.gamificationData?.xp ?? 0) > (local.pluginData.gamificationData?.xp ?? 0)
          ? cloud.pluginData.gamificationData
          : local.pluginData.gamificationData
      ),
      // SR data: cloud wins (it has the most recent review data)
      srData: cloud.pluginData.srData || local.pluginData.srData,
    },
  };
}

// ── Sync Scheduler ─────────────────────────────────────────
export class SyncScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private pushDebounce: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private uid: string;
  onStatusChange?: (status: 'idle' | 'syncing' | 'synced' | 'error') => void;

  constructor(uid: string) {
    this.uid = uid;
  }

  schedulePush(data: NousAIData, debounceMs = 10_000) {
    this.dirty = true;
    if (this.pushDebounce) clearTimeout(this.pushDebounce);
    this.pushDebounce = setTimeout(() => this.doPush(data), debounceMs);
  }

  triggerNow(data: NousAIData) {
    this.dirty = true;
    if (this.pushDebounce) clearTimeout(this.pushDebounce);
    this.doPush(data);
  }

  async pullOnLogin(localData: NousAIData | null): Promise<NousAIData | null> {
    this.onStatusChange?.('syncing');
    try {
      const result = await pullFromCloud(this.uid, localData, true); // force on login
      this.onStatusChange?.(result ? 'synced' : 'idle');
      return result;
    } catch (e: unknown) {
      console.error('[sync] Pull on login failed:', e);
      this.onStatusChange?.('error');
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: `Sync pull failed: ${msg}` }));
      }
      return null;
    }
  }

  start(getDataFn: () => NousAIData | null) {
    // 60s interval push
    this.timer = setInterval(() => {
      if (this.dirty && navigator.onLine) {
        const data = getDataFn();
        if (data) this.doPush(data);
      }
    }, 60_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.pushDebounce) clearTimeout(this.pushDebounce);
    this.timer = null;
    this.pushDebounce = null;
  }

  private async doPush(data: NousAIData) {
    if (!navigator.onLine) return;
    this.onStatusChange?.('syncing');
    try {
      await pushToCloud(this.uid, data);
      this.dirty = false;
      this.onStatusChange?.('synced');
    } catch (e: unknown) {
      console.error('[sync] Push failed:', e);
      this.onStatusChange?.('error');
      const msg = e instanceof Error ? e.message : 'Unknown error';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: `Sync push failed: ${msg}` }));
      }
    }
  }
}

// ── Test-only exports ─────────────────────────────────────
export const __test__ = { mergeWithTombstones, cleanTombstones };
