# Phase 1 Bug Report

Generated: 2026-03-12

---

## Code Audit Findings

### AIToolsPage.tsx (3,345 lines)

| Severity | Issue | Line | Notes |
|----------|-------|------|-------|
| LOW | 3× `any` type annotations | L252, L1868, L407 | `err: any`, canvas stateRef, SpeechRecognition cast |
| LOW | `dangerouslySetInnerHTML` with pasted HTML | L3320 | **Mitigated** — wrapped in `sanitizeHtml()` |
| INFO | Zero `console.log` calls in production paths | — | Clean |

### CoursePage.tsx (6,480 lines)

| Severity | Issue | Line | Notes |
|----------|-------|------|-------|
| LOW | Multiple `dangerouslySetInnerHTML` uses | L3091, L3181, L4136, L4326, L5524, L6257 | All wrapped in `sanitizeHtml()` + `renderSimpleMarkdown()` |
| INFO | CSS `position` allowed in style sanitizer | sanitize.ts | Intentional — needed for KaTeX layout |

### LearnPage.tsx (4,020 lines)

| Severity | Issue | Line | Notes |
|----------|-------|------|-------|
| LOW | `dangerouslySetInnerHTML` in AI chat renders | L1172, L1341, L1459, L1818, L1945 | All wrapped in `sanitizeHtml(renderMd(...))` |
| LOW | `safeRenderMd` used without explicit sanitize wrapper | L979, L3846, L3856, L3872, L3957 | Depends on `renderMd` internals — verify `renderMd` sanitizes |

### Quizzes.tsx (2,940 lines)

| Severity | Issue | Line | Notes |
|----------|-------|------|-------|
| INFO | No `dangerouslySetInnerHTML` found | — | Uses text interpolation |

### store.tsx (474 lines)

| Severity | Issue | Line | Notes |
|----------|-------|------|-------|
| MEDIUM | Full blob overwrites on every save | L214, L91 | No delta tracking — entire dataset written on each change |
| MEDIUM | No conflict detection between local and cloud | syncFromCloud | Cloud data silently wins on `syncFromCloud` |
| MEDIUM | No schema versioning or migration runner | — | Adding new fields requires manual `normalizeData` updates |
| LOW | `beforeunload` calls `flush()` but doesn't warn user | L278 | User loses unsaved changes silently if sync queue has items |
| INFO | Auto-sync skips if courses.length === 0 | L84 | Safety guard — intentional but could hide first-time user bugs |

---

## Security Checklist (for manual `/shannon` pen test run)

Run against: `http://localhost:5173`

### XSS

- [ ] **AI chat responses rendered via `dangerouslySetInnerHTML`** — inject `<script>alert(1)</script>` in AI response text; confirm `sanitizeHtml` strips it
- [ ] **Quiz question/answer text** — create quiz with `<img src=x onerror=alert(1)>` as question; confirm sanitizer blocks
- [ ] **Course note editor** — paste `<iframe src=javascript:alert(1)>` in TipTap editor content; confirm sanitized on render
- [ ] **Flashcard front/back** — set flashcard back to `<script>alert(1)</script>`; confirm escaping on render
- [ ] **`safeRenderMd` chain in LearnPage** — test whether `renderMd` output is always sanitized before injection into DOM

### Injection / Data Integrity

- [ ] **JSON import** — import a crafted `.json` that sets `settings.canvasToken` to a malicious URL; confirm credentials are stripped on export/sync
- [ ] **Quiz text input** — enter `'; DROP TABLE users; --` in quiz answer; confirm no server-side effect (app is client-only but verify no AI prompt injection)
- [ ] **Canvas iCal URL** — enter `javascript:alert(1)` as iCal URL; confirm no navigation

### Auth Flows

- [ ] **Unauthenticated state** — access `/#/settings` with no user; confirm no Firebase UID leaks to console
- [ ] **Token persistence** — verify `canvasToken` is never written to Firestore (check `syncToCloud` strip logic)
- [ ] **Firebase API key exposure** — key in `auth.ts` is public (correct for Firebase) but verify Firestore rules enforce `allow read, write: if request.auth != null`
- [ ] **PIN brute force** — set a local PIN; confirm no rate-limiting exists (low risk — local only)

### Data Import/Export

- [ ] **Export contains no `canvasToken`** — verify `exportData()` strips token field
- [ ] **Import from untrusted file** — import file with XSS payload in `quizHistory[].name`; navigate to Quizzes; confirm no XSS

---

## Architecture Notes

- **No error boundaries** around individual AI tools — a crash in one tool unmounts the whole page
- **No offline queue persistence** — pending sync items lost on page reload if browser crashes mid-sync
- **No schema versioning** — migrating legacy IDB data depends on `normalizeData()` filling missing fields, but doesn't run explicit migrations
- **Full Firestore blob sync** — entire dataset replaced on every write; race condition possible if two devices sync within the 30-second debounce window

---

*All `dangerouslySetInnerHTML` uses are consistently wrapped in `sanitizeHtml()` — XSS surface is well-mitigated at the rendering layer. Main risks are data integrity (no deltas, no conflicts) and missing error isolation per tool.*
