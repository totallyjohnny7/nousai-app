# NousAI — Agent Context

> A README for AI coding agents. Read this before touching any code.

## Project Overview

NousAI is a personal AI-powered study companion — a PWA built with React 19 + TypeScript + Vite. Features include flashcards (FSRS spaced repetition), courses, quizzes, Japanese mode, drawing canvas, gamification (XP/levels/badges), cloud sync, Omi wearable integration, Canvas LMS sync, and PDF upload + OCR → flashcard generation.

- **Production**: https://studynous.com (also https://nousai-app.vercel.app — redirects to studynous.com)
- **Repo**: `C:\Users\johnn\Desktop\NousAI-App` / https://github.com/totallyjohnny7/nousai-app
- **Version**: 2.0.0

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 5.9 |
| Bundler | Vite 7 |
| Router | **HashRouter** (not BrowserRouter — PWA requirement) |
| State | Zustand 5 — single global store via `useStore()` |
| Storage | IndexedDB (local) + Firebase Firestore (cloud, gzip compressed) |
| Auth | Firebase Email/Password |
| PWA | vite-plugin-pwa (service worker caches aggressively) |
| AI | OpenRouter API — Gemini, Mistral, DeepSeek (NOT Anthropic via OpenRouter) |
| Styling | CSS custom properties (`src/index.css`) — Focused Scholar theme |
| Testing | Playwright |

---

## Dev Setup

```bash
npm install
npm run dev          # local dev server
npm run build        # TypeScript check + Vite build
npm run lint         # ESLint
```

---

## Deploy

```bash
cd NousAI-App && npm run build && vercel --prod --yes --archive=tgz
```

> **`--archive=tgz` is required.** It bundles all files into a single tarball upload. Without it, large builds hit Vercel's per-file upload rate limit and fail mid-deploy.

**After EVERY production deploy** — clear PWA cache in browser console:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```
Without this, users see the old cached version.

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/store.tsx` | All global state (Zustand), IDB persistence, AutoSyncScheduler, cross-tab sync |
| `src/types.ts` | All TypeScript interfaces — `PluginData`, `Course`, `SRCard`, `GamificationData`, etc. |
| `src/utils/auth.ts` | Firebase auth, `syncToCloud()` (gzip + Firestore), `backupToFirestore()` |
| `src/utils/ai.ts` | `callAI()` — provider routing, streaming, cache |
| `src/utils/fsrs.ts` | FSRS spaced repetition algorithm |
| `src/utils/gamification.ts` | XP, levels, titles, badge definitions |
| `src/utils/conflictDetection.ts` | Checksum-based sync conflict detection |
| `src/utils/syncQueue.ts` | Delta queue for cloud sync |
| `src/index.css` | Global styles — CSS vars, Focused Scholar theme |
| `src/pages/Dashboard.tsx` | Main dashboard (4 tabs: Overview, Courses, Analytics, Plan) |
| `src/components/aitools/` | All AI tool implementations |
| `src/pages/UnifiedLearnPage.tsx` | Unified tool hub — `/learn` route (57 tools: Learn, Generate, Capture, Analyze, Utilities, Specialty) |
| `api/omi-proxy.ts` | Omi wearable device proxy (Vercel serverless) |

---

## Engineering Standards

### TypeScript
- Strict mode — avoid `any` casts
- All new interfaces → `src/types.ts` (unless component-local)
- Use `Partial<T>` for optional updates

### State Management
- Use `updatePluginData()` for partial PluginData updates — **never** spread `data.pluginData` manually (race condition)
- Use functional updater `setData(prev => ...)` when reading previous state
- Never mutate state directly — always return new objects

### CSS / Design
- CSS custom properties in `:root` (`src/index.css`) — never add inline styles for themeable values
- Theme: **Focused Scholar** — `#0a0a0a` background, `#F5A623` amber accent
- Fonts: Inter (body), Sora (headings), DM Mono (numbers/XP/levels)
- E-ink mode: `html.eink` class overrides colors + disables animations (Boox device support)

### Components
- Lazy-load all page-level components: `const Page = lazy(() => import('./pages/Page'))`
- Wrap AI-powered components in `<ToolErrorBoundary>`
- Prefer `className` + CSS vars over inline styles

### AI / OpenRouter
- **NEVER** use Anthropic/Claude models via OpenRouter (policy restriction)
- Use Gemini (check https://openrouter.ai/models for latest ID), Mistral, DeepSeek
- Mistral OCR: always `mistral-ocr-latest` for PDF OCR tasks
- Always use the latest available model version — check OpenRouter before hardcoding IDs

---

## Known Gotchas

| Issue | Fix |
|-------|-----|
| KaTeX | Use `import katex from 'katex'` — NOT `window.katex` (no CDN) |
| Dashboard crash | Always use `c.topics?.length ?? 0` — `topics` can be undefined on old data |
| Firestore 1MB limit | Data compressed with Pako gzip before upload: 1.85MB → ~0.4MB |
| Empty-state sync guard | Never save to cloud/IDB if `courses.length === 0` but IDB has data (stale state bug) |
| PWA cache | Must clear SW + caches after every production deploy |
| Cross-tab sync | BroadcastChannel `nousai-data-sync` — skip broadcast on received updates (use `fromSyncRef`) |
| HashRouter | Never switch to BrowserRouter — breaks PWA offline routing |
| Navigation — Learn/AI/Tools merged | `/learn` → `UnifiedLearnPage` (57 tools). `/ai` and `/tools` redirect to `/learn`. `LearnPage`, `AIToolsPage`, `ToolsPage` still exist but are no longer directly routed. |

---

## localStorage & IndexedDB Key Patterns

| Key | Storage | Purpose |
|-----|---------|---------|
| `nousai-fc-fsrs` | IDB (migrated from LS) | FSRS card state (stability, difficulty, intervals) |
| `nousai-daily-card-progress` | IDB (migrated from LS) | Daily review session counts |
| `nousai-biolquiz-{courseId}` | localStorage | BIOL3020 quiz sessions — do NOT rename |
| `nousai-evolquiz-{courseId}` | localStorage | Evolution quiz sessions — do NOT rename |
| `nousai-game-{gameId}-progress` | localStorage | Per-game XP/level progress |

Cloud sync data lives in Firestore `users/{uid}` as a gzip-compressed JSON blob (`compressed: true` flag). Subcollections (omi-inbox, omi-flashcards, notes, etc.) have no size limit.

---

## GitHub Action Behavior

When responding to issues via the Claude Code GitHub Action:
- **Default model**: `claude-sonnet-4-6` — features, bug fixes, UI, content
- **Auto-upgraded to Opus**: when issue contains architecture/refactor/security/performance/migration keywords
- Always run `npm run build` before committing — zero TypeScript errors required
- Always deploy to `studynous.com` branch (`dev`) — Vercel auto-deploys on push
- After any UI change, note in the PR what to visually verify on studynous.com
- Never commit `.env` files or API keys

## Testing Login

Use the real user account for all production testing (sync bugs only appear with real data volume):
- **Email**: johnnyluu7@icloud.com
- **Production**: https://studynous.com

---

## PR / Commit Guidelines

- Build must pass `npm run build` with zero TypeScript errors before deploy
- Test on production (https://nousai-app.vercel.app) after every deploy
- Clear PWA cache and verify new version loads before closing a task
- Test with real user account (not a throwaway) — sync bugs only appear with real data volume

---

## Architecture

```
User Action
    ↓
Zustand Store (src/store.tsx)
    ↓
IndexedDB (instant local persist)
    ↓ (debounced, gzip)
Firebase Firestore (cloud backup)
    ↓
BroadcastChannel → other tabs
```

**Sync conflict resolution**: checksum-based, UI via `ConflictModal.tsx`

---

## Integrations

| Integration | Location | Purpose |
|-------------|----------|---------|
| **Omi wearable** | `api/omi-proxy.ts`, `api/omi-webhook.ts`, `src/components/aitools/OmiTool.tsx` | Always-on wearable — fully automated pipeline: webhook → AI correction → auto-save notes → flashcard generation → vocab extraction → knowledge gaps → FSRS integration |
| **Canvas LMS** | `src/utils/canvasSync.ts` | Syncs assignments, grades, syllabus from Canvas (via Chrome extension) |
| **Google Calendar** | `src/utils/googleCalendar.ts` | Calendar event integration for study planning |
| **Mistral OCR** | `src/utils/mistralOcrService.ts` | PDF → text via OpenRouter `mistral-ocr-latest`, feeds flashcard generation |
| **Capacitor** | `capacitor.config.ts` | Android + iOS native builds (`npm run cap:android`, `npm run cap:ios`) |
| **Remotion** | `remotion/` | Marketing video rendering (`npm run remotion:dev`) |

---

## Omi Integration

Omi is an always-on wearable pendant that records conversations continuously while worn.
NousAI connects via a **fully automated pipeline** — no user action required after one-time setup.

### Architecture

```
Omi records → webhook fires → 200 OK returned immediately (<50ms) →
background pipeline: transcript correction + note auto-save +
flashcard generation + vocab extraction + gap detection +
study time tracking → Firestore subcollections → client onSnapshot syncs silently
```

### Modes

| Mode | File | Trigger |
|------|------|---------|
| Push (real-time, primary) | `api/omi-webhook.ts` | Omi fires after each conversation (~90s silence) |
| Pull (manual backup) | `api/omi-proxy.ts` | User clicks Sync in OmiTool |

### API Endpoints

#### `GET /api/omi-proxy?endpoint={path}`
CORS-safe proxy to Omi REST API. Requires `x-omi-key` header.
Allowed endpoints: `user/conversations`, `user/memories`, `user/action-items`.

#### `POST /api/omi-webhook?uid={firebaseUID}`
Fully automated processing hub. Returns 200 immediately, all work is async.
Handles event types: `memory_created`, `day_summary`.
Omi automatically appends `?uid=FIREBASE_UID` when user registers the URL in Omi app.

### Webhook Payload

```ts
// memory_created
{
  type: "memory_created",
  memory: {
    id: string,
    structured: {
      title: string, overview: string, emoji: string,
      category: string | null, // "education", "work", "personal", etc.
      action_items: Array<{ description: string, completed: boolean }>
    }
  }
}
// day_summary
{ type: "day_summary", summary: { text: string, date: string } }
```

### Firestore Collections (subcollections — no 1MB limit)

| Collection | Schema | Purpose |
|---|---|---|
| `users/{uid}/omi-inbox/{id}` | `{ id, kind, title, overview, rawOverview, emoji, category, flashcardCount, vocabCount, gapCount, receivedAt, processed }` | Live feed, soft cap at 200 (oldest purged) |
| `users/{uid}/notes/{id}` | existing Note schema + `source: "omi"` | Auto-saved to Study Library |
| `users/{uid}/omi-flashcards/{id}` | `{ q, a, topic, omiMemoryId, addedToFSRS, createdAt }` | Queued for FSRS on next app open |
| `users/{uid}/omi-vocab/{id}` | `{ term, definition, memoryId, createdAt }` | Vocabulary terms |
| `users/{uid}/omi-gaps/{id}` | `{ gap, context, memoryId, surfaced, createdAt }` | Knowledge gaps for AI Tutor |
| `users/{uid}/omi-time/{date}` | `{ education, work, general, total }` minutes | Daily study time |

### Auto-Processing Pipeline

All processors run via `Promise.allSettled` (parallel, failures isolated).
Webhook reads `omiAutoSettings`, `omiAiKey`, `omiSpeechProfile` from `users/{uid}` doc.

1. `correctTranscript()` — apply custom corrections first, then AI lisp/speech correction
2. `saveToLibrary()` — creates Note with `source: "omi"`, tags: `['omi', category, 'auto']`
3. `generateFlashcards()` — education category only, OpenRouter → omi-flashcards
4. `extractVocab()` — all categories, OpenRouter → omi-vocab
5. `extractKnowledgeGaps()` — education category, OpenRouter → omi-gaps
6. `updateStudyTime()` — increments `omi-time/{today}` document
7. `saveToInbox()` — writes to live feed, purges oldest beyond 200

### Auto-Settings (stored in Firestore `users/{uid}`)

All default ON. Written by Settings page via `saveOmiConfig()` in `src/utils/auth.ts`.

| Field | Default | Controls |
|---|---|---|
| `omiAutoSettings.autoSaveNotes` | true | saveToLibrary() |
| `omiAutoSettings.autoFlashcards` | true | generateFlashcards() |
| `omiAutoSettings.autoVocab` | true | extractVocab() |
| `omiAutoSettings.autoGaps` | true | extractKnowledgeGaps() |
| `omiAutoSettings.autoVoiceCorrect` | true | correctTranscript() |
| `omiAiKey` | user's generation slot key | OpenRouter API key for all AI processors |
| `omiSpeechProfile` | `{}` | Speech difference type, languages, subjects, custom corrections |

### Voice Accuracy — All Speech Types

| Type | STT errors | Prompt fragment |
|---|---|---|
| Interdental lisp | s/z → "th" | "Speaker has an interdental lisp — /s/ and /z/ may appear as 'th'" |
| Lateral lisp | slushy s → "sh"/"sl" | "Speaker has a lateral lisp — /s/ may be transcribed as 'sh' or 'sl'" |
| Dentalized lisp | muffled s → "f"/"v"/dropped | "Speaker has a dentalized lisp — /s/ may be muffled or dropped" |
| Palatal lisp | compressed → "ch"/"tch" | "Speaker has a palatal lisp — /s/ may appear as 'ch' or 'tch'" |
| Stutter | repeated syllables | "Remove repeated syllable repetitions (wa-wa-water → water)" |
| Multilingual | mixed language | "Preserve all [language] words exactly, only correct [language2] STT errors" |

### Client Integration (OmiTool.tsx)

On app load: `subscribeOmiFlashcards(uid, cards => { addToFSRS(cards); markSynced(cards) })`
Live feed: `subscribeOmiInbox(uid, setInboxDocs)` — onSnapshot, always reactive.
Today's time: `subscribeOmiTime(uid, today, setTimeData)`.

New Firestore helpers in `src/utils/auth.ts`:
- `subscribeOmiInbox(uid, cb)` — live inbox feed
- `subscribeOmiTime(uid, date, cb)` — today's time bar
- `subscribeOmiFlashcards(uid, cb)` — unsynced flashcard pickup
- `markOmiFlashcardSynced(uid, docId)` — prevent duplicate FSRS adds
- `saveOmiConfig(uid, { omiAutoSettings, omiAiKey, omiSpeechProfile })` — sync settings to Firestore

### Environment Variables (Vercel)

`api/omi-webhook.ts` uses Firebase Admin SDK (same as `api/extension-sync.ts`):
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with `\n` newlines)

**Never create a second Admin instance** — lazy init with `getApps().length` check.

### Omniadaptive Integration Map

Omi outputs connect to every existing NousAI system:

| Omi Output | NousAI System |
|---|---|
| Flashcards → omi-flashcards | FSRS spaced repetition queue |
| Note → notes/{id} | Study Library (existing Note schema) |
| Gaps → omi-gaps | AI Tutor context |
| Vocab → omi-vocab | Vocabulary store |
| Lecture + Canvas course | Canvas LMS assignment linking |
| Memory event | Gamification XP |
| Time data | Study time tracker |
| Day summary | Daily journal |
| Whoop via Omi app | FSRS scheduling (recovery-aware) |

### Reliability Patterns

**Webhook must return 200 in <50ms:** All processing is async after the response.
**Error isolation:** `Promise.allSettled()` — one processor failure never kills others.
**Idempotent writes:** All Firestore writes use `setDoc(ref, data, { merge: true })`.
**AI call timeouts:** All OpenRouter calls get a 12s `AbortController` timeout.
**Client subscriptions:** Always return unsubscribe from `useEffect`. Use `limit()` on queries.

### Known Gotchas

- **Firestore inbox cap:** soft cap at 200 docs — oldest purged in same write
- **Category null:** Omi `category` may be null for short captures — default to `"general"`, skip education processors
- **AI key location:** webhook reads `omiAiKey` from `users/{uid}` Firestore doc (synced from Settings → Omi → "Sync AI key to webhook")
- **FSRS card key:** `omi-{memoryId}-{firestoreDocId}` — check for existence before adding to prevent duplicates
- **HashRouter:** OmiTool at `/#/tools/omi`, all deep links need hash prefix

### MCP Server (Claude Code)

Add to `~/.claude/settings.json` under `mcpServers`:
```json
"omi": {
  "type": "sse",
  "url": "https://api.omi.me/v1/mcp/sse",
  "headers": { "Authorization": "Bearer YOUR_OMI_DEV_KEY" }
}
```

### Testing

1. Deploy to Vercel
2. Settings → Extensions → Omi → paste API key → Save & Test
3. Copy webhook URL → paste in Omi app → Developer → Webhooks → subscribe to Conversation Events + Day Summary
4. Click "Sync AI key to webhook" to enable AI processors
5. Wear Omi, have a 2-min conversation → stop talking 90s
6. **Verify (no clicks):** OmiTool live feed updates ✓ · Library has new note ✓ · Flashcards tab has new cards ✓
7. Voice correction: check OmiTool inbox — `overview` = corrected, `rawOverview` = original

---

## Video Studio

Feature: upload videos, record browser screen, watch with speed control, timestamped notes, auto-captions, and AI caption editing.

### Route
`/#/videos` — `src/pages/VideosPage.tsx` (lazy-loaded)

Also accessible as a tool in UnifiedLearnPage Capture category (id: `video`).

### New Files

| File | Purpose |
|------|---------|
| `src/utils/videoStorage.ts` | Firebase Storage helpers: `uploadVideoToStorage()`, `getVideoDownloadUrl()`, `deleteVideoFromStorage()`, `generateVideoThumbnail()` |
| `src/components/VideoPlayer.tsx` | Full-featured player — speed (0.25x–3x), caption overlay, timestamped notes, linked timestamps, AI caption chat, custom note templates |
| `src/components/aitools/VideoTool.tsx` | Multi-file upload + screen recorder with Web Speech API live captions |
| `src/pages/VideosPage.tsx` | Video library grid with CRUD (delete, rename), filters, player modal |

### Storage Architecture

```
Video binary       → Firebase Storage: videos/{uid}/{videoId}.{ext}
Metadata + captions + notes → Firestore via existing gzip sync pipeline
downloadUrl        → NOT synced (regenerated on demand via getVideoDownloadUrl)
thumbnailBase64    → NOT synced (regenerated via generateVideoThumbnail)
```

### TypeScript Types (src/types.ts)

```typescript
VideoNoteCategory  = 'why' | 'how' | 'when' | 'fail' | 'general' | string  // extensible
VideoNoteTemplate  = { id, label, color, template }  // custom per-video categories
VideoNote          = { id, timestamp, text, category, linkedTimestamps?, createdAt }
VideoCaption       = { id, start, end, text }
VideoUploadProgress = { videoId, filename, progress, status, error? }
SavedVideo         = { id, title, storagePath, downloadUrl?, duration, captions, defaultSpeed,
                       courseId?, createdAt, thumbnailBase64?, size, type, mimeType,
                       notes?, noteTemplates? }
```

`savedVideos?: SavedVideo[]` in `PluginData`.

### Firebase Storage Security Rules (add to Firebase console)

```
match /videos/{userId}/{videoId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

### Sync Trimming (auth.ts trimForSync)

- Strips `downloadUrl` + `thumbnailBase64` from every SavedVideo before sync (never reaches Firestore)
- Caps at 50 videos (newest first)

### Store Mutators (src/store.tsx)

- `addVideo(video: SavedVideo)` — adds to `savedVideos`, triggers Firestore sync
- `deleteVideo(videoId)` — removes from `savedVideos` (call `deleteVideoFromStorage` first)
- `updateVideoMeta(videoId, updates)` — patch title/captions/speed/notes/noteTemplates/downloadUrl

### Notes System

Notes are timestamped annotations tied to a specific second in the video:
- **Categories**: Why / How / When / Fail / General (default) + custom user-defined
- **Custom templates**: stored in `SavedVideo.noteTemplates` — overrides defaults per video
- **Linked timestamps**: each note can reference other moments in the video (cross-reference)
- **AI generation**: `callAI()` with caption context → generates note in chosen category
- All notes synced via Firestore (text only, small)

### Failsafes

| Scenario | Handling |
|----------|----------|
| `getDisplayMedia` denied | Toast: "Browser permission required", no crash |
| `SpeechRecognition` unavailable (Firefox) | Captions silently disabled, banner shown |
| MediaRecorder codec unsupported | Falls back to `video/webm` without specific codec |
| Firebase Storage quota exceeded | Toast error, upload marked failed |
| Upload interrupted | `uploadBytesResumable` resumes automatically; unrecoverable → retry button |
| Signed URL expired | `<video>` error event triggers `getVideoDownloadUrl()` refresh (retry once) |
| AI caption chat bad JSON | Parse error toast, original captions preserved |
| `deleteObject` (file already gone) | Logs warning, still removes from Firestore metadata |
| File >2GB | Warning toast, upload still proceeds |
| Non-video file type | Rejected per-file, batch continues |
| >50 videos in sync | Trimmed to 50 newest, user warned |

---

## Specialty Quiz Systems

### BIOL3020 Practium (`src/components/biolquiz/`)

| File | Purpose |
|------|---------|
| `BiolPractiumTab.tsx` | Orchestrator — view state, localStorage save/load, grading events, chapter bank auto-load |
| `BiolMenu.tsx` | Start screen — mode cards, topic/exam filter (default: all exams), streak |
| `BiolQuestionEditor.tsx` | CRUD editor + AI question import |
| `BiolSession.tsx` | Active quiz session view |
| `BiolResults.tsx` | Post-session results + feedback |
| `BiolStats.tsx` | Analytics dashboard (topic heatmap, score trend, activity heatmap) |
| `BiolMindMap.tsx` | Interactive SVG mind map for BIOL3020 topics |
| `types.ts` | `BiolQuestion`, `BiolCourseData`, `BiolSession`, `BiolTopic`, `BiolHeading` |

**Data**: localStorage key `nousai-biolquiz-{courseId}` (unchanged — do NOT rename).
**Chapter bank**: `public/biolquiz/questions.json` — 19 chapters from *The Cell: A Molecular Approach, 8th Ed.* (Geoffrey M. Cooper). Chapters auto-load on mount; `questions` arrays populated via in-app editor.
**examTag**: questions carry `'exam1' | 'exam2' | 'exam3'` tags; default filter is `'all'` (not exam-specific).
**pluginData key**: `biolQuizSummary` (session summary flushed to cloud on tab close).

### Evolution Practium (`src/components/evolutionquiz/`)

| File | Purpose |
|------|---------|
| `EvolutionPractiumTab.tsx` | Orchestrator — same pattern as BiolPractiumTab + cloud sync fallback |
| `EvolutionMenu.tsx` | Start screen — includes heading-drill mode + chapter picker |
| `EvolutionQuestionEditor.tsx` | CRUD editor + AI question import |
| `EvolutionSession.tsx` | Active quiz session view |
| `EvolutionResults.tsx` | Post-session results |
| `EvolutionStats.tsx` | Analytics (topic + heading breakdown) |
| `EvolutionMindMap.tsx` | Interactive SVG mind map — 20 bubbles, chapter color groups |
| `types.ts` | `EvolQuestion`, `EvolCourseData`, `EvolSession`, `EvolTopic`, `EvolHeading` |

**Data**: localStorage key `nousai-evolquiz-{courseId}` (unchanged). Cloud sync: `pluginData[evolQuizData_{courseId}]`.
**Chapter bank**: `public/evolquiz/questions.json` — 18 chapters from *Evolution: Making Sense of Life* (Zimmer & Emlen, 2nd Ed.). All chapters auto-load on mount.
**examTag**: same `'exam1' | 'exam2' | 'exam3'` system; default filter `'all'`.
**pluginData key**: `evolutionQuizSummary`.

---

## Cursor Cloud specific instructions

### Service overview

NousAI is a single-service frontend SPA. The only service to run locally is the **Vite dev server** (`npm run dev`, port 5173). Firebase (Auth/Firestore/Storage) is remote-only — the client SDK connects directly to the production project `nousai-dc038` with hardcoded config in `src/utils/auth.ts`. No local databases, Docker containers, or backend servers are needed.

### Commands

Per `AGENTS.md` Dev Setup and `package.json` scripts:

| Task | Command |
|------|---------|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite, port 5173) |
| Build | `npm run build` (TypeScript check + Vite production build) |
| Lint | `npm run lint` (ESLint — pre-existing warnings/errors exist in the codebase) |

### Non-obvious caveats

- **Lint has pre-existing errors**: `npm run lint` exits non-zero due to ~800+ `@typescript-eslint/no-explicit-any` errors already in the codebase. This is expected and does not indicate a broken environment.
- **Build is the real gate**: `npm run build` must pass with zero errors before any commit (per project guidelines). Use build, not lint, as the pass/fail check.
- **No `.env` required for basic dev**: Firebase client config is hardcoded. Optional env vars `VITE_VALYU_API_KEY` and `VITE_GOOGLE_CLIENT_ID` enable specific integrations but are not required.
- **HashRouter**: All routes use `/#/` prefix (e.g., `localhost:5173/#/learn`). Never switch to BrowserRouter.
- **Vercel serverless functions** (`api/` directory) are not served by `npm run dev` — they only run when deployed to Vercel.
