# Data Survival Loop (Resilience)

## Overview
How NousAI ensures user data is never lost, even under adverse conditions (offline, tab closure, sync conflicts).

## Loop
1. **CAPTURE** — User creates data (quiz, flashcard, note, drawing, etc.)
2. **PERSIST** — IndexedDB write is atomic and instant (<5ms). Data is safe locally before any cloud sync attempt.
3. **QUEUE** — Delta is enqueued in SyncQueue with a 30-second debounce
4. **VERIFY** — After Firestore write, checksums are compared (`hash_local == hash_cloud?`)
   - **Match** → "Confirm Synced" state, XP bar glow animation fires
   - **Mismatch** → ConflictModal shown to user

## Conflict Resolution
When a conflict is detected:
1. User sees `ConflictModal` with both versions (local vs. cloud)
2. User chooses which version to keep
3. Losing version is **automatically backed up** to `Firestore/users/{uid}/Backups/` subcollection
4. No data is ever permanently deleted — the loser is preserved

## Offline Resilience
- IDB write happens immediately and always
- Cloud sync is best-effort — if offline, data stays safe in IDB
- On next app open, sync queue resumes automatically

## Key Files
- `src/utils/conflictDetection.ts` — checksum comparison logic
- `src/components/ConflictModal.tsx` — resolution UI
- `src/utils/auth.ts` — `backupToFirestore()` + `syncToCloud()`
- `src/utils/syncQueue.ts` — delta queue management
- `src/store.tsx` — IDB write guard (never overwrite if courses=0 but IDB has courses)
