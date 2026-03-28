# AI Context — Data Bug History & Invariants

> Read this before modifying any file listed in DANGER_FILES.md.

## Bug #1: trimForSync() Data Loss (2026-03-06)

**What happened**: `trimForSync()` in `auth.ts` stripped `questions` arrays from quiz data during cloud sync. When the user synced back from cloud, the empty arrays overwrote local data containing hundreds of flashcards. User lost all study progress.

**Root cause**: `trimForSync` had overly aggressive field stripping. It removed fields it considered "non-essential" without understanding they held user-created content.

**Fix**: Rewrote `trimForSync` to whitelist which fields to keep (inclusive) rather than blacklist which to strip (exclusive). Added guards to never sync if courses array is empty.

**Lesson**: Never filter/strip user data fields without explicitly understanding what they contain. When in doubt, keep the field.

## Bug #2: Deleted Cards Resurrect After Sync (2026-03-22, Issue #4)

**What happened**: User deleted all cards from QCP CNA-Hybrid course. On next sync or app reload, all 257 cards reappeared.

**Root cause**: Three compounding guards in `store.tsx`:
1. **IDB save guard** blocked saves when `courses.length === 0` — deletion was never persisted to IDB
2. **AutoSync guard** skipped cloud upload when `courses.length === 0` — cloud kept the stale 257-card snapshot
3. **Remote watch race** — `loadRemoteData()` ran unconditionally on remote metadata changes, overwriting the local deletion

**Fix**: (a) IDB guard changed to only block saves before initial load, not when courses legitimately empty. (b) AutoSync guard changed to only skip when courses is not an array (truly unloaded). (c) Remote watch defers load when local has unsynced changes (`nousai-data-modified-at > nousai-last-sync`).

**Lesson**: Guards that check `courses.length === 0` break intentional deletions. The invariant should be "data is loaded" not "data is non-empty."

## Data Safety Invariants

These must ALWAYS hold — violation = data loss risk:

1. `saveToIDB()` must always call `validateBeforeWrite()` first
2. `syncToCloud()` (via `AutoSyncScheduler.flush()`) must always call `saveSnapshot()` first
3. Card count must never drop >50% in a single write (`CARD_DROP_THRESHOLD = 0.5`)
4. `courses.length === 0` is valid state — do NOT block saves/syncs for empty courses
5. `nousai-snapshots` and `nousai-golden` IDB databases must never be deleted
6. Golden copy only updates on card count GROWTH — never shrinks

## Forbidden Patterns

```typescript
// NEVER DO:
localStorage.clear()                              // Wipes all app data
indexedDB.deleteDatabase('nousai-data')            // Destroys main storage
indexedDB.deleteDatabase('nousai-snapshots')       // Destroys recovery
indexedDB.deleteDatabase('nousai-golden')          // Destroys last-resort backup
courses.filter(c => c.flashcards.length > 0)       // Drops empty courses
data.pluginData = {}                               // Wipes all plugin data
```
