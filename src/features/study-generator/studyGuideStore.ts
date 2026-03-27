/**
 * Dedicated IndexedDB store for study guide HTML.
 *
 * Study guide HTML can be 100KB+ per guide. Storing it inside pluginData
 * causes state bloat (Zustand re-renders), IDB write slowdowns, and
 * Firestore 1MB limit issues. This store keeps HTML separate.
 */

const DB_NAME = 'nousai-study-guides'
const STORE_NAME = 'html'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Save study guide HTML by guide ID. */
export async function saveGuideHtml(id: string, html: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(html, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load study guide HTML by guide ID. Returns null if not found. */
export async function loadGuideHtml(id: string): Promise<string | null> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = () => resolve((req.result as string) ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Delete study guide HTML by guide ID. */
export async function deleteGuideHtml(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load ALL guide HTMLs as a Record<id, html>. Used by export/backup. */
export async function loadAllGuideHtml(): Promise<Record<string, string>> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const result: Record<string, string> = {}
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (c) {
        result[c.key as string] = c.value as string
        c.continue()
      } else {
        resolve(result)
      }
    }
    cursor.onerror = () => reject(cursor.error)
  })
}

/** Save multiple guide HTMLs at once. Used by import/restore. */
export async function saveAllGuideHtml(guides: Record<string, string>): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const [id, html] of Object.entries(guides)) {
      store.put(html, id)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
