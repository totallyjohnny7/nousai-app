# NousAI Data Model

> Storage: Firebase Firestore (document store, gzip compressed). All types defined in `src/types.ts`.

## Entity Hierarchy

```
NousAIData
├── settings           (NousAIData['settings'])
│   ├── aiProvider     string — selected AI provider key
│   ├── canvasUrl      string — Canvas LMS base URL
│   ├── canvasToken    string — Canvas API token
│   ├── canvasIcalUrl  string — Canvas calendar iCal URL
│   └── canvasEvents   CanvasEvent[]
│
└── pluginData         (PluginData)
    ├── coachData.courses    Course[]
    ├── quizHistory          QuizAttempt[]
    ├── proficiencyData      ProficiencyData
    ├── srData               SRData (cards: SRCard[])
    ├── gamificationData     GamificationData
    ├── timerState           TimerState
    ├── notes                Note[]
    ├── drawings             Drawing[]
    ├── matchSets            MatchSet[]
    ├── studySessions        StudySession[]
    ├── studySchedules       StudySchedule[]
    ├── annotations          QuizAnnotation[]
    ├── weeklyPlan           WeeklyPlan
    ├── assignments          Assignment[]
    └── knowledgeWeb         { id, from, to, relation }[]
```

## Core Entities

### Course
```ts
Course {
  id: string           // UUID, primary key
  name: string         // e.g. "Cell Biology"
  shortName: string    // e.g. "CellBio" — used in quiz subject labels
  color: string        // hex — display color
  topics: CourseTopic[]
  flashcards: FlashcardItem[]
  modules?: CourseModule[]  // optional ordered grouping of topics
}
```

### CourseTopic
```ts
CourseTopic {
  id: string
  name: string
  status?: string      // 'not_started' | 'in_progress' | 'complete'
  subtopics?: { id, name, status?, content? }[]
  links?: string[]     // IDs of linked topics (knowledge graph edges)
}
```

### QuizAttempt
```ts
QuizAttempt {
  id: string
  name: string         // quiz title
  subject: string      // course shortName at time of attempt
  subtopic: string     // topic name
  date: string         // ISO 8601
  score: number        // 0-100 percentage
  correct: number
  questionCount: number
  mode: string         // 'multiple_choice' | 'written' | 'exam_sim'
  answers: QuizAnswer[]
  folder?: string      // optional folder grouping
}
```

### SRCard (Spaced Repetition)
```ts
SRCard {
  key: string          // composite key: "{courseId}-{flashcardIndex}" or "q::{quizId}"
  subject: string
  subtopic: string
  S: number            // Stability (FSRS)
  D: number            // Difficulty (FSRS)
  reps: number
  lapses: number
  state: string        // 'New' | 'Learning' | 'Review' | 'Relearning'
  lastReview: string   // ISO 8601
  nextReview: string   // ISO 8601
  history: { date, grade, S, D, R, interval }[]
}
```
**Key formats:**
- `{courseId}-{index}` — course flashcards
- `q::{quizAttemptId}` — quiz-derived SR cards
- `match:{setId}` — match game cards
- `jp:{kanaKey}` — Japanese kana cards

### GamificationData
```ts
GamificationData {
  xp: number
  level: number        // computed from xp by getLevel() in gamification.ts
  streak: number       // consecutive study days
  bestStreak: number
  streakFreezes: number
  badges: Badge[]
  dailyGoal: { todayXp, todayMinutes, todayQuestions, targetXp }
}
```

### ProficiencyData
```ts
ProficiencyData {
  settings: { proficiencyThreshold: 85, minAttempts: 3, recentWeight: 0.7 }
  subjects: Record<subject, Record<subtopic, ProficiencyEntry>>
}
ProficiencyEntry {
  proficiencyScore: number   // 0-100 weighted recent average
  isProficient: boolean      // score >= threshold && attempts >= minAttempts
  currentStreak: number
  bestStreak: number
  attempts: { date, percentage }[]
}
```

## Frequently Queried Fields
- `coachData.courses[].topics` — always iterated on Dashboard, SpacedRepMode
- `srData.cards[].nextReview` — scanned on Dashboard due-count + SpacedRepMode
- `quizHistory[].subject` + `quizHistory[].subtopic` — proficiency aggregation
- `gamificationData.xp` + `gamificationData.streak` — displayed prominently

## Scale Analysis (10x projection)
| Entity | Current est. | 10x | Risk |
|--------|-------------|-----|------|
| Courses | 5-10 | 50-100 | Low — O(n) topic scan stays fast |
| Topics per course | 20-50 | 200-500 | Medium — topic list renders fully |
| QuizAttempts | 100-500 | 1000-5000 | High — full array in memory, Firestore doc size |
| SRCards | 200-1000 | 2000-10000 | High — full scan on dashboard |
| Drawings (PNG) | 5-20 | 50-200 | **Critical** — currently stored inline as base64 in IDB, but `canvasStorageKey` field exists for externalizing |

**10x concern**: `SRCard` full-scan on every Dashboard load is O(n). At 5000+ cards this will be slow. Consider indexing `nextReview` or moving to a separate IDB object store with range queries.

## Schema Debt / Flags
| Field | Issue |
|-------|-------|
| `Course.color` | Never used in current UI — may have been intended for course-colored badges |
| `QuizAttempt.questions: unknown[]` | Typed as `unknown[]` — should be `QuizQuestion[]` |
| `CoachData.sessions` | Typed as `unknown[]` — appears unused, overlaps with `studySessions` |
| `CoachData.weeklyPlan` | Appears both here and as top-level `PluginData.weeklyPlan` — possible duplication |
| `SRCard.elapsedDays / scheduledDays` | Redundant with `lastReview/nextReview` diff — may be stale |
| `Note.type` | Includes `'ai-output'` and `'match'` suggesting notes table is overloaded as generic output store |
| `PluginData[key: string]: unknown` | Index signature allows arbitrary keys — escape hatch for migrations |

## Firestore Structure
```
users/{uid}/
  └── data          (single document, gzip-compressed blob)
      Backups/
        └── {timestamp}   (conflict backup snapshots)
```
Note: All data is stored as a **single Firestore document** (not subcollections per entity). This simplifies reads/writes but creates the 1MB size constraint that requires gzip compression.
