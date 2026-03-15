# Component Architecture

## Overview
NousAI is a React 19 + TypeScript SPA using HashRouter. All state flows through a single Zustand context.

## Tree
```
App.tsx
└── StoreProvider (src/store.tsx — global Zustand state)
    └── HashRouter
        └── Routes (10 lazy pages, each wrapped in Suspense)
            ├── Dashboard.tsx — study command center
            ├── LearnPage.tsx — study modes (flashcard, spaced rep, match, feynman...)
            ├── QuizPage.tsx — quiz creation and history
            ├── LibraryPage.tsx — notes, drawings, courses
            ├── AIToolsPage.tsx / ToolsPage.tsx — AI feature suite
            ├── CoursePage.tsx — course detail view
            ├── StudyPage.tsx — active study session
            ├── Timer.tsx — stopwatch + pomodoro
            ├── CalendarPage.tsx — Canvas calendar integration
            └── SettingsPage.tsx — provider config, sync, eink mode
```

## State Architecture
- **store.tsx**: Single Zustand context (`useStore()`) providing `data`, `courses`, `gamification`, `quizHistory`, `srData`, `proficiency`, etc.
- All pages read from and write to this store — no local state for persistent data
- Store persists to IndexedDB and syncs to Firestore

## Component Directories
- `src/components/aitools/` — AI tool implementations (OCR, Dictate, Analogy, MindMap, FactCheck, CourseGen...)
- `src/components/learn/` — study mode implementations (SpacedRepMode, MatchMode, ExamSimMode...)
- `src/components/course/` — course page tabs (VocabTab, PathTab, LecturesTab, TutorTab...)
- `src/components/jpquiz/` — Japanese study components

## Key Singletons
- `ConflictModal` — shown when cloud sync detects stale local data
- `ToolErrorBoundary` — isolates AI tool crashes from rest of app
- `StudyAnnotationSidecar` — floating annotation panel during study sessions

## Key Files
- `src/App.tsx` — routing + StoreProvider wrapper
- `src/store.tsx` — all state management
- `src/types.ts` — all TypeScript interfaces
- `src/utils/auth.ts` — Firebase auth + Firestore sync
