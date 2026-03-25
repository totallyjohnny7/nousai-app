/**
 * recordingChunkStore.ts — IndexedDB storage for screen recording chunks
 *
 * Streams MediaRecorder chunks to disk instead of accumulating in memory.
 * After IDB put() resolves, the JS Blob reference is GC-eligible — keeps
 * RAM flat regardless of recording duration.
 *
 * Pattern: matches quizLog.ts / fileStore.ts IDB conventions.
 */

const DB_NAME = 'nousai-recording-chunks'
const STORE = 'chunks'
const DB_VERSION = 1

interface ChunkRecord {
  key: string        // `${sessionId}#${padded index}` — enables IDBKeyRange.bound()
  sessionId: string
  index: number
  blob: Blob
  mimeType: string
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'key' })
      store.createIndex('sessionId', 'sessionId', { unique: false })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Write one chunk to IDB. Safe to fire-and-forget — never throws. */
export async function saveChunk(sessionId: string, index: number, blob: Blob, mimeType: string): Promise<void> {
  try {
    const db = await openDB()
    const key = `${sessionId}#${String(index).padStart(6, '0')}`
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ key, sessionId, index, blob, mimeType, timestamp: Date.now() } satisfies ChunkRecord)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[recordingChunkStore] saveChunk failed:', e)
  }
}

/** Read all chunks for a session, sorted by index. Returns Blob array. */
export async function getAllChunks(sessionId: string): Promise<Blob[]> {
  try {
    const db = await openDB()
    const records = await new Promise<ChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('sessionId')
      const req = idx.getAll(IDBKeyRange.only(sessionId))
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    records.sort((a, b) => a.index - b.index)
    return records.map(r => r.blob)
  } catch (e) {
    console.warn('[recordingChunkStore] getAllChunks failed:', e)
    return []
  }
}

/** Get the mimeType from the first chunk of a session (for crash recovery). */
export async function getSessionMimeType(sessionId: string): Promise<string> {
  try {
    const db = await openDB()
    const record = await new Promise<ChunkRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('sessionId')
      const req = idx.openCursor(IDBKeyRange.only(sessionId))
      req.onsuccess = () => resolve(req.result?.value)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return record?.mimeType ?? 'video/webm'
  } catch (e) {
    console.warn('[recordingChunkStore] getSessionMimeType failed:', e)
    return 'video/webm'
  }
}

/** Delete all chunks for a session. */
export async function clearSession(sessionId: string): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const idx = tx.objectStore(STORE).index('sessionId')
      const req = idx.openCursor(IDBKeyRange.only(sessionId))
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) { cursor.delete(); cursor.continue() }
      }
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[recordingChunkStore] clearSession failed:', e)
  }
}

/** Detect unfinished recording sessions (for crash recovery on mount). */
export async function getUnfinishedSessions(): Promise<{ sessionId: string; chunkCount: number; firstTimestamp: number }[]> {
  try {
    const db = await openDB()
    const records = await new Promise<ChunkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).getAll()
      req.onsuccess = () => resolve(req.result ?? [])
      req.onerror = () => reject(req.error)
    })
    db.close()

    const map = new Map<string, { count: number; first: number }>()
    for (const r of records) {
      const entry = map.get(r.sessionId)
      if (entry) {
        entry.count++
        entry.first = Math.min(entry.first, r.timestamp)
      } else {
        map.set(r.sessionId, { count: 1, first: r.timestamp })
      }
    }

    return Array.from(map.entries()).map(([sessionId, { count, first }]) => ({
      sessionId, chunkCount: count, firstTimestamp: first,
    }))
  } catch (e) {
    console.warn('[recordingChunkStore] getUnfinishedSessions failed:', e)
    return []
  }
}

/** Wipe entire chunk store (for settings "clear data"). */
export async function clearAllSessions(): Promise<void> {
  try {
    const db = await openDB()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  } catch (e) {
    console.warn('[recordingChunkStore] clearAllSessions failed:', e)
  }
}
