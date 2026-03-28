/**
 * Sync Diagnostic Logger — Phase 5 monitoring infrastructure.
 *
 * Every sync event gets logged with timestamp, operation, entity, source/dest layers,
 * success/failure, data size, and error details. Persists to IDB for 72-hour retention.
 * Accessible via: window.__SYNC_LOGS__, window.__SYNC_HEALTH__(), or ?debug=sync URL param.
 */

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  operation: 'create' | 'read' | 'update' | 'delete' | 'push' | 'pull' | 'merge' | 'conflict';
  entityType: string;
  entityId?: string;
  sourceLayer: 'state' | 'localStorage' | 'indexedDB' | 'rxdb' | 'firestore' | 'memory';
  destLayer: 'state' | 'localStorage' | 'indexedDB' | 'rxdb' | 'firestore' | 'memory';
  success: boolean;
  sizeBefore?: number;
  sizeAfter?: number;
  uid?: string;
  error?: string;
  details?: string;
}

const DB_NAME = 'nousai-sync-logs';
const STORE_NAME = 'logs';
const RETENTION_MS = 72 * 60 * 60 * 1000; // 72 hours
const MAX_MEMORY_LOGS = 200;

// In-memory circular buffer for fast access
const memoryLogs: SyncLogEntry[] = [];

function openLogDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Log a sync event. Non-blocking — never throws. */
export function logSync(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): void {
  const full: SyncLogEntry = {
    ...entry,
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
  };

  // Memory buffer
  memoryLogs.push(full);
  if (memoryLogs.length > MAX_MEMORY_LOGS) memoryLogs.shift();

  // Console in debug mode
  if (typeof window !== 'undefined' && window.location?.search?.includes('debug=sync')) {
    const icon = full.success ? '✓' : '✗';
    console.log(`[SYNC-LOG] ${icon} ${full.operation} ${full.entityType} ${full.sourceLayer}→${full.destLayer}`, full);
  }

  // Persist to IDB (fire-and-forget)
  persistLog(full).catch(() => {});
}

async function persistLog(entry: SyncLogEntry): Promise<void> {
  try {
    const db = await openLogDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(entry);
    await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
  } catch { /* IDB unavailable — memory-only */ }
}

/** Get recent logs from memory (fast) or IDB (thorough). */
export async function getRecentLogs(limit = 100): Promise<SyncLogEntry[]> {
  try {
    const db = await openLogDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    const all: SyncLogEntry[] = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
  } catch {
    return [...memoryLogs].reverse().slice(0, limit);
  }
}

/** Prune logs older than 72 hours. Call periodically. */
export async function pruneOldLogs(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
    const db = await openLogDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    let pruned = 0;
    const all: SyncLogEntry[] = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    const tx2 = db.transaction(STORE_NAME, 'readwrite');
    const store2 = tx2.objectStore(STORE_NAME);
    for (const entry of all) {
      if (entry.timestamp < cutoff) {
        store2.delete(entry.id);
        pruned++;
      }
    }
    return pruned;
  } catch {
    return 0;
  }
}

/** Quick health check — returns summary of sync state. */
export async function syncHealthCheck(): Promise<{
  totalLogs: number;
  failedLast24h: number;
  pendingOps: number;
  lastSuccessfulSync: string | null;
  lastFailedSync: string | null;
  errorSummary: Record<string, number>;
}> {
  const logs = await getRecentLogs(500);
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const recent = logs.filter(l => l.timestamp > cutoff24h);
  const failed = recent.filter(l => !l.success);
  const successful = logs.filter(l => l.success && (l.operation === 'push' || l.operation === 'pull'));
  const failedLogs = logs.filter(l => !l.success);

  const errorSummary: Record<string, number> = {};
  for (const f of failed) {
    const key = f.error || 'unknown';
    errorSummary[key] = (errorSummary[key] || 0) + 1;
  }

  return {
    totalLogs: logs.length,
    failedLast24h: failed.length,
    pendingOps: 0, // would need syncQueue integration
    lastSuccessfulSync: successful[0]?.timestamp ?? null,
    lastFailedSync: failedLogs[0]?.timestamp ?? null,
    errorSummary,
  };
}

// Expose on window for debugging
if (typeof window !== 'undefined') {
  (window as any).__SYNC_LOGS__ = () => getRecentLogs(100);
  (window as any).__SYNC_HEALTH__ = syncHealthCheck;
}
