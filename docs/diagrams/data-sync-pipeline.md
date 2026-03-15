# Data Sync Pipeline

## Overview
Describes how user actions flow from in-memory state through IndexedDB (local) to Firestore (cloud).

## Flow
1. **User Action** → triggers `setData` / `updatePluginData` in Zustand store
2. **Zustand setState** → in-memory update, instantly reflected in UI
3. **IndexedDB write** → debounced ~100ms, atomic, always first (~5ms, local)
4. **SyncQueue.enqueue(delta)** → queues the change for cloud sync
5. **30s debounce** → `AutoSyncScheduler` waits for activity to settle
6. **Pako.gzip(payload)** → compresses ~1.85MB → ~0.4MB (78% reduction, fits Firestore 1MB limit)
7. **Firestore write** → cloud persistence via Firebase SDK
8. **Conflict Check** → `conflictDetection.ts` compares checksums
   - No conflict → `localStorage.setItem('nousai-last-sync', now)` + XP bar glow animation
   - Conflict → `ConflictModal` → user picks winner → backup old version to `Backups/` subcollection

## Safety Guards
- **onBeforeUnload**: flushes dirty queue if user closes tab mid-debounce
- **Empty-course guard**: never sync if courses=0 but IDB has courses (stale state protection)

## Key Files
- `src/store.tsx` — `AutoSyncScheduler` class, `markDirty()`, `flush()`
- `src/utils/syncQueue.ts` — delta queue
- `src/utils/auth.ts` — `syncToCloud()` function (gzip + Firestore write)
- `src/utils/conflictDetection.ts` — checksum comparison
- `src/components/ConflictModal.tsx` — user resolution UI
