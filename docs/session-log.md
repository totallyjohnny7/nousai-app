# NousAI Session Log

> **Purpose:** Shared memory between manual coding sessions and all scheduled tasks.
> Scheduled tasks read this file at startup to avoid conflicts, skip in-progress features,
> and stay aware of recent changes. Manual sessions append entries here when work begins.
>
> **Rules:**
> - Manual sessions: APPEND a new entry at the top (newest first)
> - Scheduled tasks: READ ONLY — never modify this file
> - Always include: date, branch, files touched, status, what to skip

---

## How Scheduled Tasks Should Use This File

At the start of every run:
1. Read the last 3 entries (top of file, below this header)
2. Check `status` of each — if `in_progress`, treat those files as locked
3. Check `skip_testing` list — do not run audits/tests on those features
4. Check `active_branch` — if not `dev` or `main`, be aware a feature branch is active
5. Check `files_changed` — avoid modifying those files unless your task specifically targets them

---


## Entry Template (copy when starting a new session)

```
### Session: YYYY-MM-DD — [Short description]
- **date**: YYYY-MM-DD
- **active_branch**: dev | main | feature/xxx
- **status**: in_progress | completed
- **files_changed**:
  - src/path/to/file.ts
- **skip_testing**: [feature names or file areas to skip auditing]
- **notes**: What was done / what's left
```

---

## Sessions (newest first)

### Session: 2026-03-17 — Critical bug fixes (#2 #4 #6 #7)
- **date**: 2026-03-17
- **active_branch**: dev
- **status**: completed
- **files_changed**:
  - src/utils/fsrs.ts (retrievability guard for S=0)
  - src/pages/SettingsPage.tsx (Firestore listener cleanup on unmount)
  - src/store.tsx (IDB timeout wrapper withTimeout)
  - src/pages/StudyPage.tsx (session state reset on unmount)
  - docs/improvement-log.md (created)
- **skip_testing**: None — all fixes are stable and complete
- **notes**: 4 critical bugs fixed on dev branch. Pre-existing TypeScript errors from
  feature/study-upgrade branch prevent build. DO NOT deploy until those TS errors are resolved.
  Next: item #1 (Dashboard null guards) queued for nightly auto-improve run.

---
