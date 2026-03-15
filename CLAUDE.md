# NousAI — Claude Code Context

## Project
- **Stack**: React 19 + TypeScript 5.9 + Vite 7, HashRouter SPA, PWA (vite-plugin-pwa)
- **State**: Zustand via Ctx hook (`src/store.tsx`) — single global store, `useStore()` everywhere
- **Storage**: IndexedDB (local, instant) + Firebase Firestore (cloud, gzip compressed)
- **Auth**: Firebase Email/Password (`src/utils/auth.ts`)
- **Repo**: `C:\Users\johnn\Desktop\NousAI-App`
- **Production**: https://nousai-app.vercel.app
- **Firebase project**: `nousai-dc038`

## Deploy
```bash
cd NousAI-App && npm run build && vercel --prod --yes
```
After **every** production deploy — MUST clear PWA cache:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```

## Critical Files
| File | Purpose |
|------|---------|
| `src/store.tsx` | All global state (Zustand), IDB persistence, AutoSyncScheduler, cross-tab sync |
| `src/types.ts` | All TypeScript interfaces (PluginData, Course, SRCard, GamificationData, etc.) |
| `src/utils/auth.ts` | Firebase auth, `syncToCloud()` (gzip + Firestore), `backupToFirestore()` |
| `src/utils/ai.ts` | `callAI()` — provider routing (OpenAI, Claude, Groq, Gemini), streaming, cache |
| `src/utils/fsrs.ts` | FSRS spaced repetition algorithm |
| `src/utils/gamification.ts` | XP, levels, titles, badge definitions |
| `src/utils/conflictDetection.ts` | Checksum-based sync conflict detection |
| `src/utils/syncQueue.ts` | Delta queue for cloud sync |
| `src/components/ConflictModal.tsx` | UI for sync conflict resolution |
| `src/components/ToolErrorBoundary.tsx` | Isolates AI tool crashes |
| `src/components/aitools/` | All AI tool implementations |
| `src/index.css` | Global styles (CSS custom properties, Focused Scholar theme) |
| `src/pages/Dashboard.tsx` | Dashboard with 4 tabs (Overview, Courses, Analytics, Plan) |

## Engineering Standards

### TypeScript
- Strict mode enabled — no `any` casts unless absolutely necessary
- All new interfaces go in `src/types.ts` unless component-local
- Use `Partial<T>` for optional updates, not manual `?:` expansion

### State Management
- Use `updatePluginData()` for partial PluginData updates — never spread `data.pluginData` manually (race condition risk)
- Use functional updater form `setData(prev => ...)` when reading previous state
- Never mutate state directly — always return new objects

### CSS / Design
- CSS custom properties defined in `:root` in `src/index.css`
- Current theme: **Focused Scholar** — `#0a0a0a` background, `#F5A623` amber accent
- Fonts: Inter (body), Sora (headings/stat values), DM Mono (numbers/levels/XP)
- E-ink mode: `html.eink` overrides all colors + disables animations (for Boox devices)
- Never add inline styles for values that should be in CSS vars

### Components
- Lazy-load all page-level components: `const Page = lazy(() => import('./pages/Page'))`
- Use `ToolErrorBoundary` to wrap any AI-powered component
- Prefer `className` + CSS over inline styles for anything that might change

### Testing / Verification
- Always test on production (https://nousai-app.vercel.app) after deploy
- Clear PWA cache after every deploy (service worker caches aggressively)
- Build must pass `npm run build` with zero TypeScript errors before deploy

## Known Gotchas

| Issue | Solution |
|-------|---------|
| KaTeX import | Use `import katex from 'katex'` — NOT `window.katex` (no CDN) |
| Dashboard crash | Always use `c.topics?.length ?? 0` — `topics` can be undefined on older data |
| Firestore 1MB limit | Data compressed with Pako gzip: 1.85MB → ~0.4MB before upload |
| Empty-state sync guard | Never save to cloud/IDB if `courses.length === 0` but IDB has courses (stale state) |
| PWA cache | Must clear SW + caches after every production deploy |
| Streak freeze buy | `buyStreakFreeze()` in `gamification.ts` — check XP balance first |
| Cross-tab sync | BroadcastChannel `nousai-data-sync` — skip broadcast on received updates (use `fromSyncRef`) |

## Tool Preferences (Priority Order)

### Browser / UI Navigation
1. **Playwright** (`mcp__playwright__*`) — default for all page navigation, form fills, clicks, screenshots, assertions. Use for structured test flows and multi-step UI verification.
2. **Kapture** (`mcp__kapture__*`) — prefer over `Claude_in_Chrome` for bulk DOM reads, tab management, and screenshot loops. Faster for read-heavy tasks.
3. **Claude_in_Chrome** (`mcp__Claude_in_Chrome__*`) — last resort only, when Playwright and Kapture both fail.

### Data Verification (counts, records, sync state)
- Firebase MCP manages project config (apps, rules, auth) — it does NOT query Firestore documents directly.
- To read live data counts: log in via Playwright, then read the Zustand store via `mcp__playwright__browser_evaluate` — faster than clicking through every page.
- Use `mcp__plugin_firebase_firebase__firebase_get_security_rules` to audit Firestore rules.

### Batch System Checks (health, security, stress)
- Use `mcp__Desktop_Commander__start_process` to run PowerShell health checks in parallel.
- Chain independent checks in a single script rather than sequentially.

### Automated UI Test Skill
- For any UI-heavy task, invoke `/automated-ui-test` skill.
- Playwright MCP is installed and active — the skill will use it automatically.

## Community Skills (antigravity)
Available via `npx antigravity-awesome-skills --claude`. Most relevant for NousAI:
- `@brainstorming` — feature ideation
- `@debugging-strategies` — systematic debugging
- `@create-pr` — PR creation workflow
- `@api-design-principles` — AI tool API design

## Architecture Diagrams
See `docs/diagrams/` for Excalidraw diagrams:
- `data-sync-pipeline` — full sync flow from user action to Firestore
- `component-architecture` — React component tree
- `ai-tool-pipeline` — AI request/response flow
- `data-survival-loop` — resilience and conflict resolution
