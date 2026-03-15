# NousAI PWA Permissions Implementation Plan

## Overview
Add all 6 PWA permission/feature APIs to NousAI: Screen Wake Lock, Persistent Storage, Microphone (explicit permission), Background Sync, Clipboard, and File System Access. Each feature gets a utility module + a Settings UI toggle + integration into the relevant pages.

---

## File Changes

### 1. New file: `src/utils/permissions.ts` — Central permissions manager
A single utility that manages all PWA permission states:
- `checkAllPermissions()` — returns current status of all permissions
- `requestNotification()` — wraps existing notification permission
- `requestMicrophone()` — explicit `getUserMedia({audio: true})` request
- `requestPersistentStorage()` — calls `navigator.storage.persist()`
- `requestWakeLock()` / `releaseWakeLock()` — Screen Wake Lock API
- `requestClipboardRead()` / `writeClipboard()` / `readClipboard()` — Clipboard API
- `registerBackgroundSync(tag)` — Background Sync via service worker
- `openFilePicker()` / `saveFilePicker()` — File System Access API
- Each function returns a `{ granted: boolean; error?: string }` result
- Feature detection helpers: `isWakeLockSupported()`, `isFileSystemAccessSupported()`, etc.

### 2. Modify: `src/pages/Timer.tsx` — Wake Lock integration
- Import `requestWakeLock` / `releaseWakeLock` from permissions util
- When timer starts (`start()` callback), acquire wake lock
- When timer pauses/stops/resets, release wake lock
- Handle visibility change (re-acquire on page focus, per Wake Lock API spec)
- Show small "Screen on" indicator when wake lock is active

### 3. Modify: `src/utils/speechTools.ts` — Explicit mic permission
- Import `requestMicrophone` from permissions util
- In `startDictation()`, call `requestMicrophone()` before starting SpeechRecognition
- Better error handling when mic permission is denied

### 4. Modify: `src/pages/SettingsPage.tsx` — New "Permissions" section
- Add `'permissions'` to the `SectionId` type
- Add to `expanded` state (default collapsed)
- Add new section between Display and Data Management sections with:
  - **Notifications** toggle — shows current status (granted/denied/default), button to request
  - **Microphone** toggle — shows status, button to request for STT
  - **Screen Wake Lock** toggle — enable/disable for timer sessions
  - **Persistent Storage** toggle — shows if storage is persisted, button to request
  - **Background Sync** toggle — enable/disable periodic sync
  - **Clipboard Access** toggle — enable for copy/paste features
  - **File System Access** info — shows browser support status
- Each row shows: icon, label, description, status badge, and action button
- Store user preferences in localStorage (`nousai-perm-wakelock`, `nousai-perm-bgsync`, etc.)

### 5. Modify: `src/main.tsx` — Persistent storage on app init
- After `createRoot`, call `requestPersistentStorage()` (silent, no prompt on most browsers)
- Register background sync tag if enabled

### 6. Modify: `vite.config.ts` — Add background sync to workbox config
- Add `backgroundSync` plugin to the workbox config for offline data sync
- Add sync event handler in the service worker

### 7. Modify: `src/store.tsx` — Clipboard and file export helpers
- Add `copyToClipboard(text)` helper using the Clipboard API
- Add `exportToFile()` using File System Access API (with fallback to download link)

---

## Section-by-section details

### Screen Wake Lock (Timer.tsx)
```
- Request wake lock when Pomodoro starts
- Release on pause/reset/phase end
- Re-acquire after visibility change (document.visibilitychange)
- localStorage pref: 'nousai-perm-wakelock' (default: true)
```

### Persistent Storage (main.tsx)
```
- Call navigator.storage.persist() on app load
- Show result in Settings permissions section
- Check with navigator.storage.persisted()
```

### Microphone (speechTools.ts)
```
- Before SpeechRecognition.start(), call getUserMedia({audio: true})
- Cache the permission state
- Release the stream immediately (we only need the permission grant)
```

### Background Sync (vite.config.ts + store.tsx)
```
- Register 'nousai-sync' tag when data changes
- Workbox BackgroundSyncPlugin queues failed sync requests
- Replays them when connection returns
```

### Clipboard (permissions.ts + used in Flashcards, Library, AI pages)
```
- navigator.clipboard.writeText() for copying flashcards/notes
- navigator.clipboard.readText() for pasting content
- Fallback to document.execCommand('copy') for older browsers
```

### File System Access (permissions.ts + store.tsx export)
```
- showSaveFilePicker() for data export (with fallback)
- showOpenFilePicker() for data import (with fallback to <input type="file">)
- Graceful degradation — this API isn't available in all browsers
```

---

## UI Design for Settings Permissions Section

Each permission row follows the existing `rowStyle` pattern:
```
[Icon] Permission Name          [Status Badge] [Action Button]
       Brief description
```

Status badges:
- Green "Granted" — permission active
- Yellow "Not Yet" — permission not requested
- Red "Denied" — user blocked permission
- Gray "N/A" — browser doesn't support this feature

---

## No breaking changes
- All features degrade gracefully if the browser doesn't support them
- Existing notification and speech code continues to work
- New permissions section is additive to Settings
- localStorage keys are namespaced with `nousai-perm-*`
