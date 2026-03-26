# StudyNous Complete Restore, Sync & Verification Playbook

## Context

- Branch `dev` (commit 26d0267) has all code fixes deployed to studynous.com
- **DO NOT** modify any code files, push to git, run npm install/build, or change branches
- Only interact with the live site at **https://studynous.com**
- **Screenshot every step**
- Auto-sync is **disabled** (`AutoSyncScheduler.flush()` is a no-op at `store.tsx:258`) — only manual sync buttons work
- IDB (legacy) = primary storage, RxDB = demoted fallback
- Tab roles: leader writes IDB, followers relay mutations to leader via BroadcastChannel
- Cloud: Firebase Firestore, gzip compressed, chunked at 750KB per chunk
- Empty state guard: app will NOT save to IDB/cloud if `courses.length === 0` but IDB already has courses

---

## SETUP

### Step 1: Clear PWA Cache

1. Navigate to https://studynous.com
2. Open DevTools (F12) → Console tab
3. Paste and run:

```js
navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));
caches.keys().then(k=>k.forEach(x=>caches.delete(x)));
```

4. Hard reload: **Ctrl+Shift+R**
5. Screenshot the console output

### Step 2: Verify New Build Loaded

1. Open Console — look for **`[STORE] Loaded from legacy-idb`**
2. This confirms the new code (IDB primary, not RxDB) is running
3. If you see `[STORE] RxDB load failed` as the **FIRST** log → old cached build is still serving → repeat Step 1
4. Screenshot the console logs

### Step 3: Import Backup Data

1. If onboarding shows, click **"Start Fresh"**
2. Navigate to **Settings** → scroll to **Data Management** section
3. Click **Import** → select `test-data/nousai-backup-2026-03-25T20-10.json` from your local machine
4. Wait for import toast with course count
5. Navigate to Dashboard — verify: **Lv.29 Legend, 6 courses, 591 cards**
6. Screenshot the dashboard

### Step 4: Sync to Cloud

1. In **Settings → Account** section, make sure you're logged in (Firebase Email/Password)
2. If not logged in → log in first, then continue
3. Click **"Sync to Cloud"** button
4. Wait for toast: **"Synced to cloud!"**
5. Check console for `[AUTH] syncToCloud:` lines confirming compression + chunk writes
6. Screenshot the toast + console logs

**If sync fails**, check console for:

| Console message | Meaning | Fix |
|---|---|---|
| `syncToCloud: raw JSON = X KB, compressing...` then error | Compression or Firestore write failed | Check if data exceeds 1MB compressed — look for `compressed = X KB` |
| `syncToCloud: write failed PERMISSION_DENIED` | Firestore rules reject the write | Verify you're logged in as the correct user |
| `syncToCloud: write failed` + quota error | Firestore free tier exceeded | Wait or check Firebase console |
| No `[AUTH]` logs at all | `syncToCloud` never called | Check `nousai-auth-uid` in localStorage — must exist |

### Step 5: Persistence Test (CRITICAL)

1. Reload the page (**Ctrl+R**)
2. Verify dashboard shows — **NOT** onboarding screen
3. Verify **Lv.29 Legend** still shows
4. Check console for `[STORE] Loaded from legacy-idb` (should appear each reload)
5. Reload 2 more times (3 total)
6. Screenshot after **each** reload
7. If onboarding appears on ANY reload, the bug is NOT fixed — report which reload number

**If onboarding appears on ANY reload:**

- Note which reload number it happened on (1st, 2nd, 3rd)
- Open console and look for:
  - `[STORE] legacy-idb returned null` → IDB write failed on previous step
  - `[STORE] courses.length === 0` → empty state guard prevented save
  - `getRole() === 'follower'` → tab thought it was follower and didn't write to IDB
- Run in console to check IDB directly:

```js
indexedDB.open('nousai-legacy').onsuccess = e => {
  const db = e.target.result;
  const tx = db.transaction('data', 'readonly');
  tx.objectStore('data').get('main').onsuccess = r => {
    const d = r.target.result;
    console.log('IDB data:', d ? `${d.pluginData?.coachData?.courses?.length} courses` : 'NULL');
  };
};
```

---

## SYNC TROUBLESHOOTING LOOP

If sync fails at any step, follow this loop **until it works**:

```
WHILE sync is broken:
  1. REPRODUCE — identify exact failure point (upload? download? persistence?)
  2. CONSOLE — copy ALL [AUTH] and [STORE] log lines
  3. NOTE — write down:
     - What you clicked
     - What toast appeared (or didn't)
     - Console errors (full text)
     - localStorage.getItem('nousai-auth-uid') value
     - Tab role (run in console: check for leader/follower logs)
  4. DIAGNOSE using table below
  5. If CODE BUG:
     - Note the file, line, and exact issue
     - Open GitHub issue on totallyjohnny7/nousai-app:
       Title: "Sync bug: [one-line description]"
       Body: reproduction steps + console logs + screenshot
     - Record in your notes: date, symptom, root cause, issue #
  6. RETRY from Step 4
```

**Diagnosis Table:**

| Symptom | Likely Cause | Console Check |
|---------|-------------|---------------|
| "Sync to Cloud" does nothing | No UID in localStorage | `localStorage.getItem('nousai-auth-uid')` |
| "Sync to Cloud" → "Sync failed" | Firestore write error | `[AUTH] syncToCloud: write failed` + error code |
| "Sync from Cloud" → "No cloud data" | Data never uploaded / wrong account | Check Firebase console for user doc |
| Data disappears on reload | IDB save failed (follower tab) | `[STORE]` logs — look for role value |
| Auto-sync never triggers | `AutoSyncScheduler.flush()` is disabled (`store.tsx:258`) | By design — only manual sync works |
| "Loaded from cloud!" but stale data | Old chunks in Firestore | Check `syncVersion` in console logs |
| Sync works once then stops | Tab became follower after another tab opened | Close all other studynous.com tabs |
| `PERMISSION_DENIED` | Firestore rules reject write | Verify correct user account |
| Compressed size > 1MB | Data too large for single doc | Check `compressed = X KB` log line |

**Sync Round-Trip Test (after basic sync works):**

1. Make a small change (rename a course, add a card)
2. Click "Sync to Cloud" → wait for "Synced to cloud!"
3. Wipe all local data:

```js
indexedDB.deleteDatabase('nousai-legacy');
indexedDB.deleteDatabase('nousai-rxdb');
localStorage.clear();
```

4. Hard reload → onboarding should appear (data is gone locally — expected)
5. Click "Start Fresh" → go to Settings → log in
6. Click **"Sync from Cloud"**
7. Verify toast: "Loaded from cloud!"
8. Navigate to Dashboard — your courses/level/cards should be back
9. Verify the small change from step 1 is present
10. Screenshot before and after

---

## FULL FEATURE VERIFICATION

### DATA PERSISTENCE

- [ ] Data survives reload (no onboarding screen)
- [ ] Data survives 3 consecutive reloads
- [ ] Lv.29 Legend status shows (not Lv.1 Novice)
- [ ] 6 courses visible on dashboard
- [ ] Console shows `[STORE] Loaded from legacy-idb` (not RxDB as primary)

### REACT #310 FIX

- [ ] Settings page loads without "Something went wrong" crash
- [ ] Dashboard loads without error
- [ ] All 13 routes load:
  - [ ] `/`
  - [ ] `/quiz`
  - [ ] `/flashcards`
  - [ ] `/learn`
  - [ ] `/library`
  - [ ] `/library?tab=notes`
  - [ ] `/library?tab=drawings`
  - [ ] `/timer`
  - [ ] `/calendar`
  - [ ] `/settings`
  - [ ] `/micromacro`
  - [ ] `/study-gen`
  - [ ] `/videos`

### SIDEBAR CLEANUP

- [ ] No "Synced 1d ago" green dot in sidebar
- [ ] No "SYNC DATA" link in sidebar
- [ ] Sync buttons ARE in Settings → Account section (Sync to Cloud / Sync from Cloud)

### JAPANESE IME (Alt+J)

- [ ] Press Alt+J → green badge "Hiragana" appears bottom-right
- [ ] Press Alt+J again → blue badge "Katakana"
- [ ] Press Alt+J again → badge disappears (off)
- [ ] Click on any text input, type "taberu" in hiragana mode → shows たべる
- [ ] Press Space to commit → text stays as hiragana
- [ ] Works on Settings search, quiz answers, notes, any text field

### HANDWRITING OVERLAY (Alt+H)

- [ ] Press Alt+H → floating canvas appears bottom-right
- [ ] Draw characters with mouse/pen
- [ ] After 1.5s pause → auto-recognizes (or click Recognize button)
- [ ] Recognized text shows in green
- [ ] Text auto-inserts into last focused input
- [ ] Canvas auto-clears after recognition
- [ ] Press Alt+H again → overlay closes
- [ ] "Clear" button works

### STUDY VISUAL GENERATOR

- [ ] Navigate to Study Gen page
- [ ] Model dropdown fetches LIVE from OpenRouter API (not hardcoded)
- [ ] Should show "Auto Router" at top, then 30+ models grouped by provider
- [ ] Shows "XX models · live from OpenRouter API" text below dropdown
- [ ] Default model is "Auto Router (best match)" or similar
- [ ] NOT showing old models (Gemini 2.0 Flash, Claude 3 Haiku, GPT-4o Mini)
- [ ] Depth options: Deep, Exam-only, Overview
- [ ] Diagrams options: Every section, Key sections, Overview only
- [ ] Tone options: Full, Mild, Clean
- [ ] Accent color palette visible (8 colors)
- [ ] "Edit Mode" button visible after generating
- [ ] "</> HTML" button visible after generating
- [ ] "Save" button visible after generating
- [ ] "Download" button visible after generating

### QUIZ GEN TRANSPARENCY

- [ ] Navigate to Learn → click "Quiz Gen"
- [ ] "Transparency" dropdown visible with 4 options:
  - [ ] Minimal — Just the content, no extras
  - [ ] Standard — Difficulty tags + brief explanations
  - [ ] Full — Difficulty, why tested, misconceptions, source reasoning
  - [ ] Research — Full + confidence, source notes, gap analysis

### FLASHCARD GEN TRANSPARENCY

- [ ] Navigate to Learn → click "Flashcards"
- [ ] "Transparency Level" dropdown visible with same 4 options

### K20 HOTKEYS (Global)

- [ ] Settings → scroll to "HUION K20 KeyDial Mini" section
- [ ] Visual key map renders (dark layout with key buttons)
- [ ] Each key shows its bound action
- [ ] Click a key → dropdown changes action
- [ ] "Reset to Defaults" button works
- [ ] No crash when interacting with K20 section

### WACOM / PEN TABLET

- [ ] Library → Drawings → open any drawing → Excalidraw loads
- [ ] Canvas has `touch-action:none` (inspect element to verify)
- [ ] If pen tablet connected: pressure sensitivity works (thin→thick strokes)
- [ ] Right-click on canvas does NOT show browser context menu

### AI SETTINGS

- [ ] Settings → AI Provider section
- [ ] OpenRouter selected → shows purple recommendation banner
- [ ] Banner says "400+ models" and "openrouter/auto"
- [ ] API key field visible
- [ ] Model field visible
- [ ] All providers available: None, OpenAI, Anthropic, OpenRouter, Google, Groq, Mistral, Custom

### AUTO-ADAPTIVE AI

- [ ] When OpenRouter is provider with model "openrouter/auto":
  - [ ] Quiz Gen uses auto-routing
  - [ ] Flashcard Gen uses auto-routing
  - [ ] Study Gen has its own model selector (separate from main AI settings)
  - [ ] All AI tools work without manually picking a model

### SYNC FIXES

- [ ] Cloud sync works: Settings → Account → "Sync to Cloud" → toast "Synced to cloud!"
- [ ] Cloud sync works: "Sync from Cloud" → loads data (or "No cloud data found" if empty)
- [ ] Empty chunks don't crash (graceful error handling)
- [ ] Deleted notes/drawings don't resurrect after reload (RxDB array deletion fix)

### TUTORIAL / GUIDE

- [ ] Settings → scroll to Guide Hub (or find guide entries)
- [ ] 5 entries exist:
  1. [ ] "Japanese IME — Type Hiragana & Katakana Anywhere"
  2. [ ] "HUION K20 KeyDial Mini — Global Hotkeys"
  3. [ ] "Wacom Intuos & Pen Tablet Support"
  4. [ ] "Study Visual Generator — AI Study Guides"
  5. [ ] "AI Transparency Levels — Control Quiz & Flashcard Depth"

### STABILIZATION (Code Quality)

These are code-level fixes, not visible in UI, but should NOT cause regressions:

- [ ] No dead files (simulate100days, adaptivePomodoro, etc. were deleted)
- [ ] formatDate/parseJsonArray/formatTime use shared utilities (no duplicates)
- [ ] Logger utility (console.log replaced with log() in production)
- [ ] FSRS NaN guard (no Infinity/NaN in spaced repetition)
- [ ] IDB timeout 15s (was 5s)
- [ ] Gamification getWeekKey uses local time (was UTC)
- [ ] VideoTool wrapped in ToolErrorBoundary
- [ ] CoursePage optional chaining (subtopics?.length, mod.topics?.length)
- [ ] Unhandled promises have .catch() (LibraryPage, StudyAnnotationSidecar)

---

## KEY ARCHITECTURE NOTES

### Storage Hierarchy
1. **Legacy IDB** (`nousai-legacy`) — primary, always written by leader tab
2. **RxDB** (`nousai-rxdb`) — secondary/fallback, best-effort writes
3. **Firestore** — cloud storage, gzip compressed, chunked at 750KB per chunk
4. **localStorage** — crash recovery for follower tabs, auth UID, IME mode

### Sync Pipeline
- `triggerSyncToCloud()` → `syncToCloud(uid, data)` → JSON serialize → pako gzip → split into chunks → Firestore batch write with version swap
- `triggerSyncFromCloud()` → `syncFromCloud(uid)` → read metadata doc → fetch chunks by prefix → reassemble → decompress → JSON parse → `setData()`
- Auto-sync (`AutoSyncScheduler.flush()`) is **disabled** at `store.tsx:258` — the method body just clears `this.dirty` without doing anything
- Only the manual "Sync to Cloud" / "Sync from Cloud" buttons in Settings → Account actually sync

### Tab Leader Election
- Leader tab writes to IDB directly
- Follower tabs send mutations to leader via BroadcastChannel `nousai-data-sync`
- `getRole() === 'follower'` means the tab will NOT write to IDB (relays to leader instead)
- `getRole() === 'undecided'` (election pending) saves directly to prevent data loss during onboarding/import
- **Close all other studynous.com tabs before testing** to ensure your tab is the leader

### Empty State Guard
- The app will NOT save to IDB/cloud if `courses.length === 0` but IDB already has courses
- This prevents a stale/empty Zustand state from overwriting real data during initialization race conditions

### Error #310
- React error when objects are rendered as JSX children
- App.tsx has specific diagnostic logging for this: `[NousAI] ERROR #310 DIAGNOSTIC`
- Fixed: non-null assertions (`data!.pluginData!.loginHistory!`) replaced with optional chaining in SettingsPage.tsx

---

## SCREENSHOT CHECKLIST

Take a screenshot after verifying each section:

1. [ ] Console after PWA cache clear
2. [ ] Console showing `[STORE] Loaded from legacy-idb`
3. [ ] Dashboard after import (Lv.29, 6 courses, 591 cards)
4. [ ] "Synced to cloud!" toast + console logs
5. [ ] Dashboard after reload #1
6. [ ] Dashboard after reload #2
7. [ ] Dashboard after reload #3
8. [ ] Settings page loaded (no crash)
9. [ ] Each of the 13 routes loaded
10. [ ] Alt+J green Hiragana badge
11. [ ] Alt+J blue Katakana badge
12. [ ] Alt+H handwriting overlay canvas
13. [ ] Study Gen model dropdown with live models
14. [ ] Quiz Gen Transparency dropdown
15. [ ] Flashcard Gen Transparency dropdown
16. [ ] K20 hotkey visual map
17. [ ] Excalidraw in Library → Drawings
18. [ ] AI Settings with OpenRouter purple banner
19. [ ] Sync round-trip: before wipe + after cloud restore
20. [ ] Guide Hub with 5 tutorial entries
