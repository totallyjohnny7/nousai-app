# NousAI App -- Final Master QA Document
## Comprehensive 7-Phase Audit Report

**Date:** 2026-03-08
**App:** NousAI Study Companion (https://nousai-app.vercel.app)
**Stack:** React + TypeScript + Vite, HashRouter SPA, Firebase Firestore, Vercel Serverless
**Auditor:** Claude Opus 4.6 (Automated QA with Live UI Verification)

---

## Executive Summary

A comprehensive 7-phase QA audit was performed on the NousAI educational study app, covering adaptive learning, UI robustness, cross-module syncing, settings/cloud sync, stress testing, AI tools, voice/dictation, offline resilience, and PWA behavior.

**Total Issues Found: 82**

| Severity | Count | % of Total |
|----------|-------|------------|
| Critical | 6     | 7%         |
| High     | 19    | 23%        |
| Medium   | 30    | 37%        |
| Low      | 27    | 33%        |
| Positive | 10    | --         |

### Top 7 Most Impactful Issues
1. **Proficiency data NEVER updated after quizzes** (Critical) -- `recordAttempt()` exists but is never called; all proficiency displays show stale/zero data
2. **StudyPage quiz results never persisted** (Critical) -- Results are local state only, lost on navigation
3. **XSS via `dangerouslySetInnerHTML`** (Critical) -- Unsanitized HTML rendering in Tutor chat and notes
4. **Canvas API token synced to Firestore** (Critical) -- Bearer token uploaded to cloud in plaintext
5. **No cloud sync conflict resolution** (Critical) -- Last-write-wins with no merge or warning
6. **SSRF risk in Canvas proxy** (High) -- Unvalidated endpoint paths and pagination URLs
7. **No list virtualization** (High) -- DOM explosion with large datasets

### Strengths Identified
- Game data isolation is well-designed (games cannot corrupt main data store)
- Core study features (flashcards, quizzes, timer, drawing) work fully offline
- Adaptive weighting system is algorithmically sound
- Gamification system (XP, streaks, badges) is engaging and functional

---

## 1. Content Quality Audit

### 1.1 Quiz Answer Checking
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| CQ-1 | Fuzzy matching allows false positives via substring | Medium | `quizEngine.ts:163-165` |
| CQ-2 | True/False normalization treats non-standard answers as False | Low | `quizEngine.ts:101-103` |
| CQ-3 | No hallucination safeguards in AI quiz generation prompt | Medium | `quizEngine.ts:322-343` |
| CQ-4 | Vocab quiz requires exact definition match (too strict) | Low | `CoursePage.tsx:737` |

**Details:**
- **CQ-1:** `nCorrect.includes(nUser) || nUser.includes(nCorrect)` means "cell phone" matches "cell" and "radiation" matches "electromagnetic radiation"
- **CQ-3:** AI prompt says "Generate questions from text" but doesn't instruct "Only use facts from source material"

### 1.2 Proficiency Tracking
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| CQ-5 | Single-attempt data shows inflated proficiency scores | Low | `proficiency.ts:25-41` |
| CQ-6 | `COURSE_ID_ALIASES` hardcoded for specific courses only | Medium | `adaptiveWeights.ts:38-55` |
| CQ-7 | `Math.max(...Object.values(weights))` fragile with empty objects | Medium | `adaptiveWeights.ts:170,255` |

### 1.3 Spaced Repetition (FSRS)
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| CQ-8 | Division by zero when stability is 0 (legacy cards) | High | `fsrs.ts:55` |
| CQ-9 | Stale card reference in notification scheduler | Medium | `notifications.ts:102-118` |

---

## 2. Dictation Resolution Report

### 2.1 Speech Recognition
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| DR-1 | No timeout handler for speech recognition (infinite "listening") | High | `speechTools.ts:199-233` |
| DR-2 | Chrome auto-stops continuous recognition after ~60s silently | Medium | `speechTools.ts:200-201` |
| DR-3 | `oralQuiz` calls async `startDictation` without awaiting | Medium | `speechTools.ts:265` |
| DR-4 | `readFlashcard` Promise never resolves if TTS unavailable | Medium | `speechTools.ts:110-119` |
| DR-5 | Chrome `getVoices()` returns empty on first call | Low | `speechTools.ts:33-40` |

### 2.2 AI Tools Dictation
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| DR-6 | DictateTool bypasses mic permission request (doesn't use `getUserMedia`) | High | `AIToolsPage.tsx:361-402` |
| DR-7 | DictateTool `onerror` swallows error details (no user feedback) | Medium | `AIToolsPage.tsx:389-392` |

### 2.3 AI Tools Accuracy
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| DR-8 | Analogy Engine and Course Generator are template-based, not AI | Low | `AIToolsPage.tsx:544,1240` |
| DR-9 | Fact Check heuristic splits on periods, breaking decimals | Low | `AIToolsPage.tsx:1655` |
| DR-10 | Omi Tool is entirely simulated (mock data only) | Low | `AIToolsPage.tsx:2496` |
| DR-11 | Rename Tool doesn't actually persist renames | Low | `AIToolsPage.tsx:1523` |

---

## 3. UI/UX Ledger

### 3.1 Rendering & Display
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| UX-1 | Cards page shows blank screen when no flashcard decks exist (no empty state) | Medium | Live UI test |
| UX-2 | Course page shows blank when navigated via URL hash with ID | Medium | Live UI test |
| UX-3 | No online/offline detection or UI indicator | High | Global |
| UX-4 | No disabled state on Tutor "Send" button during AI processing | Medium | `CoursePage.tsx:3199` |
| UX-5 | DurationPicker can only reach multiples of 5 and value 1 | Low | `Timer.tsx:241` |
| UX-6 | No game-specific error boundary in BetaLab | Medium | `BetaLabPage.tsx:478-522` |
| UX-7 | `confirm()` may fail in standalone PWA mode on iOS | Low | `DrawPage.tsx:595` |

### 3.2 Topic Management (New Feature)
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| UX-8 | "Reset to Textbook" replaces all topics without confirmation dialog | Medium | `CoursePage.tsx:1314-1329` |
| UX-9 | `copyAllTopics` has no error handling for clipboard API failure | Low | `CoursePage.tsx:1311` |
| UX-10 | Rapid topic addition may lose items due to stale closure | Medium | `CoursePage.tsx:1242-1282` |

### 3.3 Timer
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| UX-11 | Timer does not restore running state across page reloads | High | `Timer.tsx:24-33` |
| UX-12 | Timer doesn't handle sleep/hibernation (fires immediately on wake) | Medium | `Timer.tsx:78-80` |
| UX-13 | `handlePhaseEnd` stale closure when settings change mid-timer | Medium | `Timer.tsx:94-115` |

### 3.4 Drawing Tools
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| UX-14 | Canvas stores full data URLs in memory (100-500KB each, 20 undo states) | High | `DrawPage.tsx:618-623` |
| UX-15 | No pinch-to-zoom on mobile canvas | Low | `DrawPage.tsx:2320-2324` |
| UX-16 | Undo history lost on navigation (per-session only) | Low | `DrawPage.tsx:1032-1035` |

---

## 4. Security & Input Ledger

### 4.1 XSS Vulnerabilities
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| SEC-1 | `dangerouslySetInnerHTML` with unsanitized user/AI content | **Critical** | `CoursePage.tsx:3157,2406,3282,4247` |
| SEC-2 | `renderSimpleMarkdown` does not escape HTML entities | High | `CoursePage.tsx:94-125` |

**Details:** Multiple locations render user input and AI responses via `dangerouslySetInnerHTML` without sanitization. The `renderSimpleMarkdown` function processes markdown but passes through raw HTML (including `<script>`, `onerror`, etc.). This is exploitable if AI returns malicious HTML or if notes contain injected content.

### 4.2 Canvas Proxy Security
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| SEC-3 | SSRF risk via endpoint path traversal | High | `canvas-proxy.ts:40` |
| SEC-4 | Pagination follows unvalidated URLs (token exfiltration) | High | `canvas-proxy.ts:74-78` |
| SEC-5 | Wildcard CORS allows any origin | Medium | `canvas-proxy.ts:21` |
| SEC-6 | Canvas domain allowlist is hardcoded (4 domains only) | Low | `canvas-proxy.ts:3-8` |
| SEC-7 | No pagination truncation warning | Low | `canvas-proxy.ts:47-49` |

### 4.3 Credential Storage
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| SEC-8 | Canvas API token synced to Firestore in plaintext | **Critical** | `SettingsPage.tsx:1937`, `auth.ts:228` |
| SEC-9 | AI API keys stored in plaintext localStorage | Medium | `SettingsPage.tsx:114-125` |
| SEC-10 | Google AI API key exposed in URL query parameter | Medium | `ai.ts:273`, `SettingsPage.tsx:708` |
| SEC-11 | Local PIN uses base64 encoding, not hashing | Medium | `auth.ts:293-301` |
| SEC-12 | Canvas URL input has no URL validation | Medium | `SettingsPage.tsx:1932-1934` |

### 4.4 AI Security
| ID | Issue | Severity | File:Line |
|----|-------|----------|-----------|
| SEC-13 | AI service has no timeout or abort mechanism | Medium | `ai.ts:60-128` |
| SEC-14 | Fact Check prompt allows injection | Medium | `AIToolsPage.tsx:1619-1630` |
| SEC-15 | Google AI streaming error handling silently swallows parse errors | Medium | `ai.ts:289-304` |

---

## 5. Bug Ledger -- Severity/Priority Matrix

### Critical (Fix Immediately)

| ID | Bug | Impact | File:Line |
|----|-----|--------|-----------|
| BUG-0a | **Proficiency data NEVER updated after quiz completion** | All proficiency displays show 0%/stale data; Stats, Cram, adaptive weights all broken | `Quizzes.tsx:47-58` (missing `recordAttempt()` call) |
| BUG-0b | **StudyPage quiz results never persisted to store** | Quiz results lost on navigation; no XP awarded, no history saved | `StudyPage.tsx` (no `setData` call) |
| BUG-1 | XSS via `dangerouslySetInnerHTML` in Tutor/Notes | Arbitrary JS execution, data theft | `CoursePage.tsx:3157,2406` |
| BUG-2 | Canvas token synced to Firestore cloud | Token exposure, unauthorized Canvas access | `auth.ts:228` |
| BUG-3 | No cloud sync conflict resolution (last-write-wins) | Silent data loss on multi-device use | `auth.ts:220-288` |
| BUG-4 | SSRF: proxy pagination follows unvalidated URLs with bearer token | Token sent to attacker-controlled server | `canvas-proxy.ts:74-78` |

### High (Fix This Sprint)

| ID | Bug | Impact | File:Line |
|----|-----|--------|-----------|
| BUG-5 | `renderSimpleMarkdown` doesn't escape HTML | XSS vector | `CoursePage.tsx:94-125` |
| BUG-6 | FSRS `retrievability()` division by zero when S=0 | Cards scheduled far into future | `fsrs.ts:55` |
| BUG-7 | `removeVocab` uses wrong index when filtering | Wrong flashcard deleted | `CoursePage.tsx:662-677,912-914` |
| BUG-8 | `persistNotes` directly mutates React state | Stale data, skipped re-renders | `LibraryPage.tsx:143` |
| BUG-9 | `handleEditorSave` missing `topicIds` in useCallback deps | Stale topic links on save | `LibraryPage.tsx:1411-1414` |
| BUG-10 | Deleting a topic doesn't clean up note `topicIds` | Orphaned references | `CoursePage.tsx:1254-1257` |
| BUG-11 | Deleting a topic doesn't clean up module `topicIds` | Orphaned references | `CoursePage.tsx:1254-1257` |
| BUG-12 | Topic rename doesn't update proficiency data keys | Proficiency resets to 0% | `CoursePage.tsx:1249-1252` |
| BUG-13 | Timer doesn't restore running state on reload | Lost timer sessions | `Timer.tsx:24-33` |
| BUG-14 | No online/offline detection or UI indicator | Confusing errors when offline | Global |
| BUG-15 | "Clear All Data" only deletes IndexedDB, not localStorage | API keys, game data persist | `SettingsPage.tsx:619-624` |
| BUG-16 | Auto-sync toggle is non-functional (no implementation) | Users think data is auto-syncing | `SettingsPage.tsx:575-579` |
| BUG-17 | No list virtualization for large datasets | DOM explosion, tab crash | Global |
| BUG-18 | Entire data object re-written to IDB on every state change | Performance lag, IDB contention | `store.tsx:68-70` |
| BUG-19 | No data import schema validation | Crash on malformed import | `SettingsPage.tsx:595-604` |
| BUG-20 | Speech recognition has no timeout (infinite "listening") | Stuck UI state | `speechTools.ts:199-233` |
| BUG-21 | DictateTool bypasses mic permission request | Silent failure on iOS/Safari | `AIToolsPage.tsx:361-402` |
| BUG-21b | No course deletion functionality exists | Data grows indefinitely, no cleanup | App-wide |
| BUG-21c | courseMastery ignores zero-proficiency topics (inflated %) | 3/50 topics at 90% shows 90% mastery | `CoursePage.tsx:203-213` |

### Medium (Fix Next Sprint)

| ID | Bug | Impact | File:Line |
|----|-----|--------|-----------|
| BUG-22 | Quiz fuzzy matching false positives | Inflated quiz scores | `quizEngine.ts:163-165` |
| BUG-23 | AI service has no timeout/abort | Infinite "thinking" state | `ai.ts:60-128` |
| BUG-24 | Canvas sync duplicates on rename | Duplicate assignments | `CoursePage.tsx:3889-3894` |
| BUG-25 | Assignments/grades in localStorage, not synced | Data fragmentation | `CoursePage.tsx:3870-3904` |
| BUG-26 | CORS wildcard on Canvas proxy | Cross-origin token use | `canvas-proxy.ts:21` |
| BUG-27 | PIN uses base64 not hashing | Trivially reversible | `auth.ts:293-301` |
| BUG-28 | No localStorage quota error handling | Unhandled QuotaExceededError | Multiple files |
| BUG-29 | No pre-flight size check before cloud sync | Firestore 1MB limit crash | `auth.ts:220-248` |
| BUG-30 | Rapid topic addition loses items (stale closure) | Topics disappear | `CoursePage.tsx:1242-1282` |
| BUG-31 | "Reset to Textbook" no confirmation dialog | Silent data loss | `CoursePage.tsx:1314-1329` |
| BUG-32 | Timer stale closure when settings change mid-run | Wrong phase duration | `Timer.tsx:94-115` |
| BUG-33 | Timer doesn't handle sleep/hibernation | Missed notifications | `Timer.tsx:78-80` |
| BUG-34 | Canvas URL input no validation | Unhelpful connection errors | `SettingsPage.tsx:1932-1934` |
| BUG-35 | Google AI API key in URL query string | Key in browser history | `ai.ts:273` |
| BUG-36 | Chrome auto-stops continuous recognition | Silent dictation stop | `speechTools.ts:200` |
| BUG-37 | `oralQuiz` doesn't await async `startDictation` | Race condition | `speechTools.ts:265` |
| BUG-38 | `readFlashcard` Promise never resolves if TTS unavailable | Blocked await chain | `speechTools.ts:110` |
| BUG-39 | DictateTool error handler swallows details | No user feedback | `AIToolsPage.tsx:389` |
| BUG-40 | Drawing data URLs consume MB of storage | Cloud sync regression risk | `DrawPage.tsx:618-623` |
| BUG-41 | SW `autoUpdate` disrupts active sessions | Mid-quiz interruption | `vite.config.ts:9` |
| BUG-42 | SW precaches all assets (10-30MB) | Mobile storage pressure | `vite.config.ts:27` |
| BUG-43 | No sync retry logic on connection drop | Lost sync with no retry | `auth.ts:233-247` |
| BUG-44 | Stale notification interval with initial card snapshot | New cards never checked | `notifications.ts:102-118` |
| BUG-45 | Lazy-loaded games have no error boundary | Page-level crash on chunk fail | `BetaLabPage.tsx:478-522` |
| BUG-46 | AI prompt injection via Fact Check | Manipulated AI behavior | `AIToolsPage.tsx:1619` |
| BUG-47 | Google AI streaming parse error unhandled | Raw SyntaxError shown | `ai.ts:289-304` |
| BUG-48 | Canvas sync: no pagination from client | Truncated course/assignment data | `canvasSync.ts:77,86` |
| BUG-49 | Manifest start_url `/` with HashRouter (fragile) | PWA install issues | `manifest.webmanifest` |
| BUG-50 | No SW update prompt for user | Silent update, cache issues | `vite.config.ts:9` |
| BUG-51 | Game data not cleared by "Clear All Data" | Orphaned game saves | `SettingsPage.tsx:619-624` |

### Low (Backlog)

| ID | Bug | Impact | File:Line |
|----|-----|--------|-----------|
| BUG-52 | True/False normalization treats "correct"/"1" as False | Edge case wrong answers | `quizEngine.ts:101-103` |
| BUG-53 | Single-attempt proficiency shows 100% (misleading) | User overconfidence | `proficiency.ts:25-41` |
| BUG-54 | Clipboard copy no error handling | Silent failure in iframes | `CoursePage.tsx:1311` |
| BUG-55 | Chrome `getVoices()` empty on first call | Wrong TTS voice | `speechTools.ts:33-40` |
| BUG-56 | Analogy/Course tools are templates, labeled as "AI" | User confusion | `AIToolsPage.tsx:544,1240` |
| BUG-57 | Fact Check splits on periods (breaks decimals) | Wrong claim splitting | `AIToolsPage.tsx:1655` |
| BUG-58 | Omi Tool is entirely mock/simulated | Misleading connection UI | `AIToolsPage.tsx:2496` |
| BUG-59 | Rename Tool doesn't persist renames | Non-functional "Apply" | `AIToolsPage.tsx:1523` |
| BUG-60 | No pinch-to-zoom on mobile drawing canvas | Limited mobile UX | `DrawPage.tsx:2320` |
| BUG-61 | Undo history lost on navigation | User frustration | `DrawPage.tsx:1032` |
| BUG-62 | `confirm()` may fail in PWA mode (iOS) | Auto-confirmed deletes | `DrawPage.tsx:595` |
| BUG-63 | DurationPicker step mismatch (5 min step, 1 min minimum) | Can't set 2-4 min | `Timer.tsx:241` |
| BUG-64 | Buying streak freeze can cause level-down | Demoralizing UX | `gamification.ts:206` |
| BUG-65 | Badge checks use inline formula not `getLevel()` | Maintenance risk | `gamification.ts:27-28` |
| BUG-66 | Streak freeze only covers 1 missed day regardless of count | Misleading freeze count | `gamification.ts:96-117` |
| BUG-67 | Daily goal reset not proactively called | Cross-midnight inflation | `gamification.ts:168-184` |
| BUG-68 | Import success toast before validation completes | False success report | `SettingsPage.tsx:595-605` |
| BUG-69 | Debug console.log statements in production | Info leakage | `SettingsPage.tsx`, `auth.ts` |
| BUG-70 | Firebase config hardcoded in source | Low risk (by design) | `auth.ts:18-25` |
| BUG-71 | Anthropic `dangerous-direct-browser-access` header | Known trade-off | `ai.ts:213` |
| BUG-72 | Cards page shows blank screen (no empty state message) | Confusing UX | Live UI test |
| BUG-73 | SW API cache only for GET, AI uses POST | No offline AI queue | `vite.config.ts:40-47` |
| BUG-74 | AI features fail with no offline fallback | Generic errors | `ai.ts` |
| BUG-75 | PWA manifest may reference missing icon files | Install prompt failure | `manifest.webmanifest` |
| BUG-76 | Canvas domain allowlist too restrictive (4 domains) | Non-Nebraska users blocked | `canvas-proxy.ts:3-8` |
| BUG-77 | Spaced repetition weights can exceed 1.0 (works by luck) | Fragile normalization | `adaptiveWeights.ts:156` |
| BUG-78 | No hallucination safeguards in AI quiz prompt | Incorrect questions/answers | `quizEngine.ts:322-343` |

---

## 6. Positive Findings

| ID | Finding | File |
|----|---------|------|
| POS-1 | Game data isolation: games use localStorage, cannot corrupt main IndexedDB store | `BetaLabPage.tsx`, `gameEngine.ts` |
| POS-2 | Core study features (flashcards, quizzes, timer, drawing, notes) work fully offline | Global |
| POS-3 | Adaptive weighting system is algorithmically sound with multiple signal fusion | `adaptiveWeights.ts` |
| POS-4 | XP/streak/badge gamification system is functional and engaging | `gamification.ts` |
| POS-5 | Cloud sync uses gzip compression (78% size reduction) | `auth.ts` |
| POS-6 | Course page UI is feature-rich with 20+ tabs | `CoursePage.tsx` |
| POS-7 | Topic management CRUD (new feature) renders correctly with edit/delete icons | Live UI test |
| POS-8 | Stats tab with expandable subtopic proficiency works correctly | Live UI test |
| POS-9 | Library shows organized course spaces with mastery percentages | Live UI test |
| POS-10 | Dashboard knowledge graph, daily goals, study recommendations render correctly | Live UI test |

---

## 7. Recommended Fix Priority

### Immediate (Before Next Deploy)
1. **BUG-0a/0b:** Wire up proficiency updates: import and call `recordAttempt()` in `Quizzes.tsx` `onComplete` and persist `StudyPage.tsx` results to store. This is the #1 most impactful bug -- the entire adaptive learning system is non-functional without it.
2. **SEC-1/SEC-2:** Add DOMPurify or similar HTML sanitizer for all `dangerouslySetInnerHTML` usage
3. **SEC-8:** Strip `canvasToken` from data object before `syncToCloud()`
4. **SEC-4:** Validate pagination URLs against `ALLOWED_DOMAINS` in canvas-proxy
5. **SEC-3:** Whitelist-validate the `endpoint` parameter in canvas-proxy

### This Week
6. **BUG-3:** Add timestamp comparison and confirmation dialog for cloud sync
7. **BUG-8:** Fix `persistNotes` to use `setData()` immutably
8. **BUG-10/11/12:** Cascade topic deletion/rename to notes, modules, and proficiency keys
9. **BUG-7:** Fix `removeVocab` to use flashcard ID instead of array index
10. **BUG-15:** Clear all `nousai-*` localStorage keys in "Clear All Data"
11. **BUG-21b:** Implement course deletion with cascading cleanup

### This Sprint
12. **BUG-16:** Either implement auto-sync or remove the toggle
13. **BUG-13:** Restore timer state from saved `pomoRemainingMs` on reload
14. **BUG-14:** Add `navigator.onLine` detection with offline banner
15. **BUG-19:** Validate imported data shape before accepting
16. **BUG-18:** Debounce IndexedDB writes (2-5 second delay)
17. **BUG-21c:** Fix courseMastery to include zero-proficiency topics in average

---

*Generated by Claude Opus 4.6 automated QA system*
*4 parallel analysis agents + live UI verification on dev server (port 5173)*
