# Files That Touch User Data — Read Before Modifying

> AI coders: read AI_CONTEXT.md for bug history before modifying any of these files.

| File | Risk | What It Does |
|------|------|-------------|
| `src/store.tsx` | **CRITICAL** | All state mutations, IDB writes, AutoSyncScheduler, cross-tab sync |
| `src/utils/auth.ts` | **CRITICAL** | Cloud sync reads/writes, trimForSync, gzip compression |
| `src/utils/writeGuard.ts` | **HIGH** | Write validation layer — DO NOT WEAKEN or simplify checks |
| `src/utils/snapshotManager.ts` | **HIGH** | Pre-write snapshots in separate IDB — DO NOT REMOVE |
| `src/utils/dataHealthCheck.ts` | **HIGH** | Boot integrity checks — DO NOT SKIP |
| `src/utils/goldenCopy.ts` | **HIGH** | Immutable recovery copy in separate IDB — DO NOT MODIFY growth-only policy |
| `src/utils/dataRepository.ts` | MEDIUM | Storage abstraction (IDB + localStorage) |
| `src/utils/conflictDetection.ts` | MEDIUM | Sync conflict checksums |
| `src/utils/syncQueue.ts` | MEDIUM | Delta journaling for sync |

## Rules

1. Never call `localStorage.clear()` — use specific key removal
2. Never call `indexedDB.deleteDatabase('nousai-data')` or `nousai-snapshots` or `nousai-golden`
3. Never remove the `validateBeforeWrite()` call from `saveToIDB()`
4. Never remove the `saveSnapshot()` call from `AutoSyncScheduler.flush()`
5. Never change `CARD_DROP_THRESHOLD` below 0.3 without explicit user approval
6. Always run `dataHealthCheck()` after modifying any storage code
