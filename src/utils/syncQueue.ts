/**
 * SyncQueue — Delta Journaling for NousAI
 *
 * Instead of overwriting the entire dataset on every save, this module tracks
 * granular changes (deltas) and flushes them to Firestore in batches.
 *
 * Key guarantee: If the user saves at the exact moment internet drops, the
 * delta is persisted to IDB first. On reconnect, the flush retries automatically.
 */

import { log } from './logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type EntityType =
  | 'course'
  | 'quizAttempt'
  | 'flashcard'
  | 'note'
  | 'srCard'
  | 'gamification'
  | 'timerState'
  | 'proficiency'
  | 'assignment'
  | 'studySchedule'
  | 'annotation'
  | 'matchSet'
  | 'fullBlob'; // fallback: entire dataset

export interface SyncDelta {
  id: string;                // unique delta ID (crypto.randomUUID)
  entityType: EntityType;
  entityId: string;          // e.g. course.id, 'singleton' for gamification
  op: 'upsert' | 'delete';
  payload: unknown;          // the entity value (undefined for delete)
  timestamp: number;         // Date.now()
  checksum: string;          // SHA-256 of JSON.stringify(payload) — for conflict detection
}

// ── IDB helpers ───────────────────────────────────────────────────────────────

const QUEUE_DB = 'nousai-sync-queue';
const QUEUE_STORE = 'deltas';

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function persistDeltaToIDB(delta: SyncDelta): Promise<void> {
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(delta);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[SYNC-QUEUE] Failed to persist delta to IDB:', e);
    throw e;
  }
}

async function loadDeltasFromIDB(): Promise<SyncDelta[]> {
  try {
    const db = await openQueueDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as SyncDelta[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // SYNC FIX #16: Log prominently when crash-persisted deltas may be lost
    console.error('[SYNC-QUEUE] CRITICAL: Failed to load persisted deltas from IDB — pending sync operations may be lost:', e);
    try {
      window.dispatchEvent(new CustomEvent('nousai-sync-error', {
        detail: { message: 'Failed to recover pending sync queue — some changes may need manual re-sync' }
      }));
    } catch { /* SSR safety */ }
    return [];
  }
}

async function clearDeltasFromIDB(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const db = await openQueueDB();
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    for (const id of ids) store.delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[SYNC-QUEUE] Failed to clear deltas from IDB:', e);
    throw e;
  }
}

// ── Checksum ──────────────────────────────────────────────────────────────────

export async function computeChecksum(payload: unknown): Promise<string> {
  const str = JSON.stringify(payload) ?? '';
  const bytes = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── SyncQueue class ───────────────────────────────────────────────────────────

type FlushFn = (deltas: SyncDelta[]) => Promise<void>;

export class SyncQueue {
  private queue: SyncDelta[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;
  private readonly flushFn: FlushFn;
  private readonly flushIntervalMs: number;

  constructor(flushFn: FlushFn, flushIntervalMs = 30_000) {
    this.flushFn = flushFn;
    this.flushIntervalMs = flushIntervalMs;
  }

  /** Load any deltas that survived a previous page crash from IDB */
  async hydrate(): Promise<void> {
    const persisted = await loadDeltasFromIDB();
    if (persisted.length > 0) {
      log(`[SYNC-QUEUE] Hydrated ${persisted.length} persisted deltas from IDB`);
      // Merge without duplicates (by id)
      const existingIds = new Set(this.queue.map(d => d.id));
      for (const d of persisted) {
        if (!existingIds.has(d.id)) this.queue.push(d);
      }
    }
  }

  /** Enqueue a delta — persists to IDB immediately before scheduling flush */
  async enqueue(
    entityType: EntityType,
    entityId: string,
    op: 'upsert' | 'delete',
    payload: unknown
  ): Promise<void> {
    const checksum = await computeChecksum(payload);
    const delta: SyncDelta = {
      id: crypto.randomUUID(),
      entityType,
      entityId,
      op,
      payload,
      timestamp: Date.now(),
      checksum,
    };

    // CRITICAL: persist to IDB FIRST — before scheduling the network flush
    // This ensures the delta survives even if the page closes before flush completes
    await persistDeltaToIDB(delta);

    this.queue.push(delta);

    // Coalesce: if multiple upserts for same entity, keep only the latest
    this._coalesce();

    this._scheduleFlush();
  }

  /** Force an immediate flush (e.g. on visibilitychange → hidden) */
  async flush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this._doFlush();
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get hasPending(): boolean {
    return this.queue.length > 0;
  }

  private _scheduleFlush() {
    if (this.flushTimer) return; // already scheduled
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this._doFlush();
    }, this.flushIntervalMs);
  }

  /** Remove superseded upserts — keep only latest delta per (entityType, entityId) */
  private _coalesce() {
    const latestByKey = new Map<string, SyncDelta>();
    for (const d of this.queue) {
      const key = `${d.entityType}:${d.entityId}`;
      const existing = latestByKey.get(key);
      // A delete always wins over an older upsert for the same entity
      if (!existing || d.timestamp >= existing.timestamp) {
        latestByKey.set(key, d);
      }
    }
    this.queue = Array.from(latestByKey.values());
  }

  private async _doFlush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const batch = [...this.queue];
    try {
      await this.flushFn(batch);
      // Remove flushed deltas from IDB
      await clearDeltasFromIDB(batch.map(d => d.id));
      // Remove flushed from in-memory queue
      const flushedIds = new Set(batch.map(d => d.id));
      this.queue = this.queue.filter(d => !flushedIds.has(d.id));
      log(`[SYNC-QUEUE] Flushed ${batch.length} deltas`);
    } catch (e) {
      console.error('[SYNC-QUEUE] Flush failed, will retry:', e);
      // Keep deltas in queue for retry — they remain in IDB
    } finally {
      this.flushing = false;
    }
  }
}
