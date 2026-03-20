# Better Canvas Features → NousAI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Note:** Always use real profile (reallyjustjohnny6@gmail.com) for testing — never a test account.

**Goal:** Port all meaningful Better Canvas features into NousAI's web app — fixing the broken Canvas sync, surfacing live Canvas data on dashboard cards, adding GPA calculation, assignment tracking, reminders, and theme customization.

**Architecture:** Fix the Canvas proxy's broken endpoint validation first (root bug), then rebuild `canvasSync.ts` using Better Canvas's proven API patterns (`include[]=total_scores`, `include[]=submission`), then add UI layers — card overlays, assignment widgets, GPA calc, notifications, and theme presets — on top of the reliable data foundation.

**Tech Stack:** React 19 + TypeScript, Zustand (`useStore()`), Vercel serverless (`api/canvas-proxy.ts`), Canvas REST API v1, `updatePluginData()` for state, IndexedDB + Firestore for persistence, CSS custom properties for theming.

**Reference:** Better Canvas source — `github.com/UseBetterCanvas/bettercanvas`. Key functions: `insertGrades()`, `calculateGPA2()`, `setupBetterTodo()`, `reminderWatch()`, `autoDarkModeCheck()`.

---

## Feature Map: Better Canvas → NousAI

| Better Canvas Feature | NousAI Equivalent | Status |
|---|---|---|
| Dashboard grades on cards | Live Canvas grade % badge on CourseCards | **New** |
| Card assignments (upcoming) | Upcoming assignments list on CourseCards | **New** |
| Hover preview | Assignment hover tooltip | **New** |
| Dashboard notes | StickyNotes already exists — enhance | **Enhance** |
| Better to-do list | UpcomingAssignmentsWidget on Overview | **New** |
| Assignment state tracking | Submitted/completed toggle on assignments | **Enhance** |
| GPA Calculator | Weighted GPA in grade book | **New** |
| In-app reminders | Browser push notifications per assignment | **Enhance** |
| Auto dark mode scheduling | Time-based theme toggle in Settings | **New** |
| Community themes | Theme presets in Settings | **New** |
| Custom fonts | Google Font selector in Settings | **New** |
| Color-coded course cards | Already exists (course.color) | **Exists** |

---

## Files Modified / Created

| File | Action | Purpose |
|---|---|---|
| `api/canvas-proxy.ts` | Modify | Fix `[]` regex bug — root cause of broken sync |
| `src/utils/canvasSync.ts` | Rebuild | Better Canvas API patterns, grade %, announcements, GPA data |
| `src/types.ts` | Modify | Add `CanvasLiveData`, `CanvasAnnouncement`, `AutoDarkSchedule`, update `PluginData` |
| `src/components/dashboard/CourseCards.tsx` | Modify | Grade % badge, upcoming assignments, hover preview |
| `src/components/dashboard/UpcomingAssignmentsWidget.tsx` | **Create** | Assignments due this week — like Better Canvas's todo widget |
| `src/pages/Dashboard.tsx` | Modify | Add UpcomingAssignmentsWidget to Overview tab |
| `src/pages/SettingsPage.tsx` | Modify | Auto dark mode schedule, theme presets, font selector |
| `src/index.css` | Modify | Theme preset CSS vars, font-family override support |
| `src/utils/canvasGpa.ts` | **Create** | Weighted GPA calculator (Better Canvas `calculateGPA2` equivalent) |
| `src/utils/assignmentReminders.ts` | **Create** | Browser push notification scheduling per assignment |

---

## Chunk 1: Fix Canvas Sync Foundation

### Task 1: Fix Proxy Endpoint Regex

**Root cause:** `api/canvas-proxy.ts:46` rejects endpoints containing `[` or `]`, silently blocking every `include[]=` parameter. This kills grades, assignment submission data, and everything synced with Canvas includes.

**Files:**
- Modify: `api/canvas-proxy.ts:46`

- [ ] **Step 1: Understand the broken regex**

Open `api/canvas-proxy.ts`. Line 46 reads:
```ts
if (safeEndpoint !== endpoint.replace(/^\/+/, '') || /[^a-zA-Z0-9/_\-?&=%.+]/.test(safeEndpoint)) {
```
The character class `[^a-zA-Z0-9/_\-?&=%.+]` does NOT include `[` or `]`. So any endpoint like `courses?include[]=submission` returns 400.

- [ ] **Step 2: Fix the regex to allow `[]`**

Replace line 46 in `api/canvas-proxy.ts`:
```ts
// OLD — blocks Canvas include[] params:
if (safeEndpoint !== endpoint.replace(/^\/+/, '') || /[^a-zA-Z0-9/_\-?&=%.+]/.test(safeEndpoint)) {

// NEW — allow [] for Canvas include[] query params:
if (safeEndpoint !== endpoint.replace(/^\/+/, '') || /[^a-zA-Z0-9/_\-?&=%.+\[\]]/.test(safeEndpoint)) {
```

- [ ] **Step 3: Verify the fix**

The character class now reads `[^a-zA-Z0-9/_\-?&=%.+\[\]]` — the escaped `\[` and `\]` allow square brackets through. Double-check no other validation blocks `[]` in the file.

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```
Expected: zero TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add api/canvas-proxy.ts
git commit -m "fix: allow [] in canvas proxy endpoint regex — unblocks include[] params"
```

---

### Task 2: Add Types for Canvas Live Data

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new interfaces after `StickyNote` (line ~449)**

```ts
// ─── Canvas Live Data (synced from Canvas API) ────────────────────────────────

export interface CanvasLiveCourse {
  canvasId: number;
  name: string;
  courseCode: string;
  currentScore: number | null;   // computed_current_score from Canvas enrollment
  finalScore: number | null;     // computed_final_score
  currentGrade: string | null;   // letter grade, e.g. "A-"
  lastSynced: string;            // ISO timestamp
}

export interface CanvasLiveAssignment {
  id: number;
  courseId: number;              // Canvas course ID
  name: string;
  dueAt: string | null;          // ISO datetime
  pointsPossible: number;
  submissionState: 'submitted' | 'unsubmitted' | 'graded' | 'pending_review' | null;
  score: number | null;
  grade: string | null;
  htmlUrl: string;
}

export interface CanvasAnnouncement {
  id: number;
  courseId: number;
  title: string;
  message: string;               // HTML stripped to plain text
  postedAt: string;              // ISO datetime
  htmlUrl: string;
}

export interface AutoDarkSchedule {
  enabled: boolean;
  startTime: string;             // "HH:MM" 24hr
  endTime: string;               // "HH:MM" 24hr
}
```

- [ ] **Step 2: Add `canvasLive` and `autoDarkSchedule` to `PluginData`**

In `src/types.ts`, inside the `PluginData` interface, add after `dashboardNotes`:
```ts
  canvasLive?: {
    courses: CanvasLiveCourse[];
    assignments: CanvasLiveAssignment[];
    announcements: CanvasAnnouncement[];
    lastFullSync: string | null;
  };
```

And in `NousAIData.settings`, add after `notificationPrefs` in `PluginData`:
> Note: `autoDarkSchedule` belongs in `NousAIData.settings` (not `PluginData`). In `src/types.ts`, add to the `settings` field inside `NousAIData`:
```ts
    autoDarkSchedule?: AutoDarkSchedule;
    customFont?: string;         // Google Font name, e.g. "Roboto"
    themePreset?: string;        // e.g. "forest", "ocean", "default"
```

- [ ] **Step 3: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts
git commit -m "feat: add CanvasLiveData, CanvasAnnouncement, AutoDarkSchedule types"
```

---

### Task 3: Rebuild canvasSync.ts with Better Canvas API Patterns

**Better Canvas references:** `insertGrades()` uses `courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores`. `calculateGPA2()` uses `assignment_groups?include[]=assignments&include[]=submission`.

**Files:**
- Modify: `src/utils/canvasSync.ts`

- [ ] **Step 1: Add `syncCanvasLiveCourses()` — fetches grade % per course**

Add this export after the existing `syncCanvasCourses`:
```ts
export async function syncCanvasLiveCourses(
  canvasUrl: string,
  canvasToken: string
): Promise<CanvasLiveCourse[]> {
  // include[]=total_scores gives us computed_current_score per enrollment
  // include[]=current_grading_period_scores gives grading period data
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    'courses?enrollment_state=active&per_page=50&include[]=total_scores&include[]=current_grading_period_scores'
  ) as Array<{
    id: number;
    name: string;
    course_code: string;
    enrollments?: Array<{
      computed_current_score: number | null;
      computed_final_score: number | null;
      computed_current_grade: string | null;
    }>;
  }>;

  return data.map(c => {
    const enrollment = c.enrollments?.[0];
    return {
      canvasId: c.id,
      name: c.name,
      courseCode: c.course_code,
      currentScore: enrollment?.computed_current_score ?? null,
      finalScore: enrollment?.computed_final_score ?? null,
      currentGrade: enrollment?.computed_current_grade ?? null,
      lastSynced: new Date().toISOString(),
    };
  });
}
```

- [ ] **Step 2: Add `syncCanvasLiveAssignments()` — upcoming + submitted status**

```ts
export async function syncCanvasLiveAssignments(
  canvasUrl: string,
  canvasToken: string,
  canvasCourseId: number
): Promise<CanvasLiveAssignment[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/assignments?per_page=50&order_by=due_at&include[]=submission`
    // Note: intentionally no bucket=future — we want overdue assignments too (shown in red)
  ) as Array<{
    id: number;
    name: string;
    due_at: string | null;
    points_possible: number;
    html_url: string;
    submission?: {
      workflow_state: string;
      score: number | null;
      grade: string | null;
    };
  }>;

  return data.map(a => ({
    id: a.id,
    courseId: canvasCourseId,
    name: a.name,
    dueAt: a.due_at,
    pointsPossible: a.points_possible,
    submissionState: (a.submission?.workflow_state as CanvasLiveAssignment['submissionState']) ?? null,
    score: a.submission?.score ?? null,
    grade: a.submission?.grade ?? null,
    htmlUrl: a.html_url,
  }));
}
```

- [ ] **Step 3: Add `syncCanvasAnnouncements()` — recent announcements per course**

```ts
export async function syncCanvasAnnouncements(
  canvasUrl: string,
  canvasToken: string,
  canvasCourseId: number
): Promise<CanvasAnnouncement[]> {
  const data = await canvasProxyFetch(
    canvasUrl, canvasToken,
    `courses/${canvasCourseId}/discussion_topics?only_announcements=true&per_page=5&order_by=recent_activity`
  ) as Array<{
    id: number;
    title: string;
    message: string;
    posted_at: string;
    html_url: string;
  }>;

  return data.map(a => ({
    id: a.id,
    courseId: canvasCourseId,
    title: a.title,
    // Strip HTML tags for plain text preview
    message: a.message?.replace(/<[^>]*>/g, '').trim().slice(0, 300) ?? '',
    postedAt: a.posted_at,
    htmlUrl: a.html_url,
  }));
}
```

- [ ] **Step 4: Add `runFullCanvasSync()` — orchestrates all sync in one call**

```ts
/**
 * Full Canvas sync — courses (with grades), assignments, announcements.
 * Mirrors Better Canvas's approach: fetch all active courses first,
 * then fetch per-course data in parallel (capped at 5 concurrent).
 */
export async function runFullCanvasSync(
  canvasUrl: string,
  canvasToken: string
): Promise<{
  courses: CanvasLiveCourse[];
  assignments: CanvasLiveAssignment[];
  announcements: CanvasAnnouncement[];
  errors: string[];
}> {
  const errors: string[] = [];

  // Step 1: fetch all active courses with grade data
  let courses: CanvasLiveCourse[] = [];
  try {
    courses = await syncCanvasLiveCourses(canvasUrl, canvasToken);
  } catch (e) {
    errors.push(`Courses: ${e instanceof Error ? e.message : 'failed'}`);
    return { courses: [], assignments: [], announcements: [], errors };
  }

  // Step 2: per-course data (assignments + announcements), 5 at a time
  const allAssignments: CanvasLiveAssignment[] = [];
  const allAnnouncements: CanvasAnnouncement[] = [];

  const CONCURRENCY = 5;
  for (let i = 0; i < courses.length; i += CONCURRENCY) {
    const batch = courses.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.flatMap(c => [
        syncCanvasLiveAssignments(canvasUrl, canvasToken, c.canvasId),
        syncCanvasAnnouncements(canvasUrl, canvasToken, c.canvasId),
      ])
    );
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled') {
        if (idx % 2 === 0) allAssignments.push(...(r.value as CanvasLiveAssignment[]));
        else allAnnouncements.push(...(r.value as CanvasAnnouncement[]));
      } else {
        errors.push(`Course ${batch[Math.floor(idx / 2)].courseCode}: ${r.reason}`);
      }
    });
  }

  return { courses, assignments: allAssignments, announcements: allAnnouncements, errors };
}
```

- [ ] **Step 5: Add imports for new types at top of file**

```ts
import type {
  CanvasLiveCourse,
  CanvasLiveAssignment,
  CanvasAnnouncement,
} from '../types';
```

- [ ] **Step 6: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```
Expected: zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/utils/canvasSync.ts
git commit -m "feat: rebuild canvasSync with Better Canvas API patterns — grades, assignments, announcements"
```

---

### Task 4: Wire Canvas Sync to Settings Page

This connects the "Sync Canvas" button in Settings to `runFullCanvasSync()` and saves results to `pluginData.canvasLive`.

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Find and replace the existing Canvas sync button in SettingsPage.tsx**

Search for `testCanvasConnection` or `syncCanvas` in `src/pages/SettingsPage.tsx`. There is already a "Sync Now" button that calls `syncCanvasCourses`. **Replace** the `onClick` handler of that existing button with `handleCanvasSync` (defined in Step 3 below). Do NOT add a second sync button — replace the existing one in-place. Also remove any state that was powering the old sync (e.g. old `syncing` / `syncError` state) and replace with the new `canvasSyncing` / `canvasSyncStatus` state below.

- [ ] **Step 2: Add sync state UI**

Add state near the Canvas section:
```tsx
const [canvasSyncing, setCanvasSyncing] = useState(false)
const [canvasSyncStatus, setCanvasSyncStatus] = useState<{
  ok: boolean; message: string; lastSync?: string
} | null>(null)
```

- [ ] **Step 3: Replace or add the full sync call**

```tsx
async function handleCanvasSync() {
  const { canvasUrl, canvasToken } = data.settings;
  if (!canvasUrl || !canvasToken) {
    setCanvasSyncStatus({ ok: false, message: 'Canvas URL and token required' });
    return;
  }
  setCanvasSyncing(true);
  setCanvasSyncStatus(null);
  try {
    const result = await runFullCanvasSync(canvasUrl, canvasToken);
    updatePluginData({
      canvasLive: {
        courses: result.courses,
        assignments: result.assignments,
        announcements: result.announcements,
        lastFullSync: new Date().toISOString(),
      },
    });
    const msg = result.errors.length > 0
      ? `Synced with ${result.errors.length} error(s): ${result.errors[0]}`
      : `Synced ${result.courses.length} courses, ${result.assignments.length} assignments`;
    setCanvasSyncStatus({ ok: result.errors.length === 0, message: msg, lastSync: new Date().toLocaleString() });
  } catch (e) {
    setCanvasSyncStatus({ ok: false, message: e instanceof Error ? e.message : 'Sync failed' });
  } finally {
    setCanvasSyncing(false);
  }
}
```

- [ ] **Step 4: Add status display below the sync button**

```tsx
{canvasSyncStatus && (
  <div style={{
    marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: 12,
    background: canvasSyncStatus.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
    color: canvasSyncStatus.ok ? '#22c55e' : '#ef4444',
    border: `1px solid ${canvasSyncStatus.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
  }}>
    {canvasSyncStatus.message}
    {canvasSyncStatus.lastSync && <span style={{ opacity: 0.7 }}> · {canvasSyncStatus.lastSync}</span>}
  </div>
)}
```

- [ ] **Step 5: Add import**

```ts
import { runFullCanvasSync } from '../utils/canvasSync'
```

- [ ] **Step 6: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: wire full Canvas sync to Settings with status feedback"
```

---

## Chunk 2: Dashboard Card Enhancements

### Task 5: Grade % Badge on Course Cards

**Better Canvas ref:** `insertGrades()` — fetches `computed_current_score` and renders it as a badge on each course card.

**Files:**
- Modify: `src/components/dashboard/CourseCards.tsx`

- [ ] **Step 1: Read canvasLive data in CourseCards**

At the top of the `CourseCards` component, after `const courseSpaces = ...`:
```tsx
const canvasLiveCourses = data?.pluginData?.canvasLive?.courses ?? []
```

- [ ] **Step 2: Add a helper to find Canvas grade for a course**

```tsx
function getCanvasGrade(canvasLiveCourses: CanvasLiveCourse[], courseId: string, courseName: string) {
  // Match by name similarity (same logic as matchCanvasCourse)
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const localNorm = norm(courseName)
  return canvasLiveCourses.find(c =>
    norm(c.name).includes(localNorm) || localNorm.includes(norm(c.courseCode))
  ) ?? null
}
```

- [ ] **Step 3: Add grade badge to each card**

Inside the `courses.map(course => ...)` block, after getting `gradeResult`, add:
```tsx
const canvasGrade = getCanvasGrade(canvasLiveCourses, course.id, course.name)
const displayScore = canvasGrade?.currentScore ?? gradeResult?.percentage ?? null
const displayGrade = canvasGrade?.currentGrade ?? null
```

Then in the card JSX, add a grade badge:
```tsx
{displayScore !== null && (
  <div style={{
    position: 'absolute', top: 8, right: 8,
    background: displayScore >= 90 ? 'rgba(34,197,94,0.15)'
              : displayScore >= 80 ? 'rgba(234,179,8,0.15)'
              : displayScore >= 70 ? 'rgba(249,115,22,0.15)'
              : 'rgba(239,68,68,0.15)',
    color: displayScore >= 90 ? '#22c55e'
         : displayScore >= 80 ? '#eab308'
         : displayScore >= 70 ? '#f97316'
         : '#ef4444',
    border: `1px solid currentColor`,
    borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700,
    fontFamily: 'DM Mono, monospace',
  }}>
    {displayScore.toFixed(1)}%{displayGrade ? ` · ${displayGrade}` : ''}
  </div>
)}
```

- [ ] **Step 4: Add `position: relative` to the card container**

Ensure the card `div` has `position: 'relative'` so the absolute badge positions correctly.

- [ ] **Step 5: Add import for `CanvasLiveCourse`**

```ts
import type { CourseCalendarEvent, CanvasLiveCourse } from '../../types'
```

- [ ] **Step 6: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/CourseCards.tsx
git commit -m "feat: add Canvas live grade % badge to course cards"
```

---

### Task 6: Upcoming Canvas Assignments on Course Cards

**Better Canvas ref:** Card assignments section — shows next 2-3 assignments per card, color-coded by due status.

**Files:**
- Modify: `src/components/dashboard/CourseCards.tsx`

- [ ] **Step 1: Get Canvas assignments for each course**

In the `CourseCards` component, after `canvasLiveCourses`:
```tsx
const canvasLiveAssignments = data?.pluginData?.canvasLive?.assignments ?? []
```

- [ ] **Step 2: Add assignment due-date helper**

```tsx
function dueBadgeStyle(dueAt: string | null): { label: string; color: string; bg: string } {
  if (!dueAt) return { label: 'No due date', color: '#888', bg: 'rgba(128,128,128,0.1)' }
  const daysUntil = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000)
  if (daysUntil < 0)  return { label: 'Overdue', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
  if (daysUntil === 0) return { label: 'Due today', color: '#f97316', bg: 'rgba(249,115,22,0.1)' }
  if (daysUntil === 1) return { label: 'Due tomorrow', color: '#eab308', bg: 'rgba(234,179,8,0.1)' }
  if (daysUntil <= 7) return { label: `${daysUntil}d`, color: '#a3a3a3', bg: 'rgba(163,163,163,0.08)' }
  return { label: `${daysUntil}d`, color: '#666', bg: 'transparent' }
}
```

- [ ] **Step 3: Render upcoming assignments below the card grade**

Inside the card, after the grade badge, add:
```tsx
{(() => {
  const canvasCourse = getCanvasGrade(canvasLiveCourses, course.id, course.name)
  if (!canvasCourse) return null
  const upcoming = canvasLiveAssignments
    .filter(a => a.courseId === canvasCourse.canvasId && a.submissionState !== 'graded')
    .sort((a, b) => {
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()
    })
    .slice(0, 3)
  if (upcoming.length === 0) return null
  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {upcoming.map(a => {
        const badge = dueBadgeStyle(a.dueAt)
        return (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, color: 'var(--text-muted)',
          }}>
            <span style={{
              background: badge.bg, color: badge.color,
              borderRadius: 4, padding: '1px 5px', fontFamily: 'DM Mono, monospace',
              fontSize: 9, fontWeight: 700, flexShrink: 0,
            }}>
              {badge.label}
            </span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.name}
            </span>
          </div>
        )
      })}
    </div>
  )
})()}
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CourseCards.tsx
git commit -m "feat: show upcoming Canvas assignments on course cards with due-date color coding"
```

---

### Task 7: Assignment Hover Preview Tooltip

**Better Canvas ref:** Hover preview popup on assignment cards.

**Files:**
- Modify: `src/components/dashboard/CourseCards.tsx`

- [ ] **Step 1: Add hover state**

Add to component state:
```tsx
const [hoveredAssignment, setHoveredAssignment] = useState<{
  assignment: CanvasLiveAssignment;
  x: number;
  y: number;
} | null>(null)
```

- [ ] **Step 2: Add `onMouseEnter`/`onMouseLeave` to each assignment row**

Wrap each assignment row `div` with event handlers:
```tsx
onMouseEnter={(e) => setHoveredAssignment({
  assignment: a,
  x: e.clientX,
  y: e.clientY,
})}
onMouseLeave={() => setHoveredAssignment(null)}
```

- [ ] **Step 3: Render tooltip portal**

After the main `return` JSX of `CourseCards`, add a portal-style tooltip:
```tsx
{hoveredAssignment && (
  <div
    style={{
      position: 'fixed',
      left: hoveredAssignment.x + 12,
      top: hoveredAssignment.y + 12,
      zIndex: 9999,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 14px',
      maxWidth: 260,
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      fontSize: 12,
      pointerEvents: 'none',
    }}
  >
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{hoveredAssignment.assignment.name}</div>
    <div style={{ color: 'var(--text-muted)' }}>
      {hoveredAssignment.assignment.dueAt
        ? `Due: ${new Date(hoveredAssignment.assignment.dueAt).toLocaleDateString()}`
        : 'No due date'}
    </div>
    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
      {hoveredAssignment.assignment.pointsPossible > 0
        ? `${hoveredAssignment.assignment.pointsPossible} pts`
        : 'Ungraded'}
    </div>
    {hoveredAssignment.assignment.submissionState && (
      <div style={{ marginTop: 4, fontSize: 11, color: '#22c55e' }}>
        ✓ {hoveredAssignment.assignment.submissionState.replace('_', ' ')}
      </div>
    )}
  </div>
)}
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/CourseCards.tsx
git commit -m "feat: add hover preview tooltip to Canvas assignment items on course cards"
```

---

## Chunk 3: Upcoming Assignments Widget

### Task 8: Create UpcomingAssignmentsWidget

**Better Canvas ref:** `setupBetterTodo()` / `loadBetterTodo()` — organized by course, color-coded, overdue highlighting, hide completed.

**Files:**
- Create: `src/components/dashboard/UpcomingAssignmentsWidget.tsx`

- [ ] **Step 1: Create the component file**

```tsx
import { useState } from 'react'
import { CheckSquare, Square, ExternalLink } from 'lucide-react'
import { useStore } from '../../store'
import type { CanvasLiveAssignment } from '../../types'

interface AssignmentRow {
  assignment: CanvasLiveAssignment;
  courseColor: string;
  courseName: string;
}

export default function UpcomingAssignmentsWidget() {
  const { data, courses } = useStore()
  const [hideSubmitted, setHideSubmitted] = useState(true)

  const canvasLive = data?.pluginData?.canvasLive
  if (!canvasLive || canvasLive.assignments.length === 0) return null

  // Match Canvas course IDs to local courses for colors
  const canvasCourses = canvasLive.courses
  const rows: AssignmentRow[] = canvasLive.assignments
    .filter(a => !hideSubmitted || (a.submissionState !== 'submitted' && a.submissionState !== 'graded'))
    .map(a => {
      const canvasCourse = canvasCourses.find(c => c.canvasId === a.courseId)
      const localCourse = canvasCourse
        ? courses.find(c => {
            const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
            return norm(c.name).includes(norm(canvasCourse.courseCode)) ||
                   norm(canvasCourse.name).includes(norm(c.name))
          })
        : null
      return {
        assignment: a,
        courseColor: localCourse?.color ?? '#F5A623',
        courseName: canvasCourse?.courseCode ?? 'Canvas',
      }
    })
    .sort((a, b) => {
      if (!a.assignment.dueAt) return 1
      if (!b.assignment.dueAt) return -1
      return new Date(a.assignment.dueAt).getTime() - new Date(b.assignment.dueAt).getTime()
    })
    .slice(0, 15)

  if (rows.length === 0) return null

  function dueLabel(dueAt: string | null): { text: string; urgent: boolean } {
    if (!dueAt) return { text: 'No date', urgent: false }
    const daysUntil = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000)
    if (daysUntil < 0)  return { text: `${Math.abs(daysUntil)}d overdue`, urgent: true }
    if (daysUntil === 0) return { text: 'Due today', urgent: true }
    if (daysUntil === 1) return { text: 'Tomorrow', urgent: true }
    return { text: new Date(dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgent: false }
  }

  return (
    <div className="mb-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3 className="section-title" style={{ marginBottom: 0 }}>
          <CheckSquare size={18} /> Upcoming Assignments
        </h3>
        <button
          onClick={() => setHideSubmitted(h => !h)}
          style={{
            fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit', padding: '2px 6px',
          }}
        >
          {hideSubmitted ? 'Show all' : 'Hide submitted'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map(({ assignment, courseColor, courseName }) => {
          const due = dueLabel(assignment.dueAt)
          const isSubmitted = assignment.submissionState === 'submitted' || assignment.submissionState === 'graded'
          return (
            <div
              key={`${assignment.courseId}-${assignment.id}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                opacity: isSubmitted ? 0.5 : 1,
              }}
            >
              {/* Course color dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: courseColor, flexShrink: 0,
              }} />

              {/* Course code */}
              <span style={{
                fontSize: 10, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace',
                minWidth: 60, flexShrink: 0,
              }}>
                {courseName}
              </span>

              {/* Assignment name */}
              <span style={{
                flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textDecoration: isSubmitted ? 'line-through' : 'none',
              }}>
                {assignment.name}
              </span>

              {/* Due label */}
              <span style={{
                fontSize: 11, fontFamily: 'DM Mono, monospace', flexShrink: 0,
                color: due.urgent ? '#ef4444' : 'var(--text-muted)',
                fontWeight: due.urgent ? 700 : 400,
              }}>
                {due.text}
              </span>

              {/* External link to Canvas */}
              <a
                href={assignment.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink size={12} />
              </a>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add to Dashboard Overview tab**

In `src/pages/Dashboard.tsx`, add the import:
```tsx
import UpcomingAssignmentsWidget from '../components/dashboard/UpcomingAssignmentsWidget'
```

Find the Overview tab render section (look for `tab === 'overview'`) and add `<UpcomingAssignmentsWidget />` after `<CourseCards />`.

- [ ] **Step 3: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/UpcomingAssignmentsWidget.tsx src/pages/Dashboard.tsx
git commit -m "feat: add UpcomingAssignmentsWidget to dashboard — Better Canvas todo equivalent"
```

---

## Chunk 4: GPA Calculator

### Task 9: Create canvasGpa.ts — Weighted GPA Calculator

**Better Canvas ref:** `calculateGPA2()` — computes semester and cumulative GPA from Canvas grade data using letter grade cutoffs and credit weights.

**Files:**
- Create: `src/utils/canvasGpa.ts`
- Modify: `src/types.ts` (add `GpaCourse`, `GpaResult`, `ReminderTarget` interfaces here per project standard)

- [ ] **Step 1: Add GPA + Reminder interfaces to `src/types.ts`**

Per project standard (CLAUDE.md), all shared interfaces belong in `src/types.ts`. Add these after the `StickyNote` interface:

```ts
// ─── GPA Calculator ───────────────────────────────────────────────────────────

export interface GpaCourse {
  name: string;
  currentScore: number;          // 0-100
  creditHours: number;           // default 3 if unknown
}

export interface GpaResult {
  semesterGpa: number;
  unweightedGpa: number;
  courses: Array<{
    name: string;
    score: number;
    letterGrade: string;
    gradePoints: number;
    creditHours: number;
  }>;
}

// ─── Assignment Reminders ─────────────────────────────────────────────────────

export interface ReminderTarget {
  name: string;
  dueAt: string;          // ISO datetime
  courseCode: string;
  htmlUrl: string;
}
```

- [ ] **Step 2: Create the GPA calculator utility**

```ts
/**
 * Weighted GPA calculator — modeled on Better Canvas's calculateGPA2().
 * Converts current score % → letter grade → grade points, then weights by credits.
 */
import type { GpaCourse, GpaResult } from '../types';

// NOTE: GpaCourse and GpaResult are defined in src/types.ts per project standard
export type { GpaCourse, GpaResult };

// Standard 4.0 scale cutoffs (matches Better Canvas defaults)
const GRADE_SCALE: Array<{ min: number; letter: string; points: number }> = [
  { min: 97, letter: 'A+', points: 4.0 },
  { min: 93, letter: 'A',  points: 4.0 },
  { min: 90, letter: 'A-', points: 3.7 },
  { min: 87, letter: 'B+', points: 3.3 },
  { min: 83, letter: 'B',  points: 3.0 },
  { min: 80, letter: 'B-', points: 2.7 },
  { min: 77, letter: 'C+', points: 2.3 },
  { min: 73, letter: 'C',  points: 2.0 },
  { min: 70, letter: 'C-', points: 1.7 },
  { min: 67, letter: 'D+', points: 1.3 },
  { min: 63, letter: 'D',  points: 1.0 },
  { min: 60, letter: 'D-', points: 0.7 },
  { min: 0,  letter: 'F',  points: 0.0 },
];

export function scoreToGradePoints(score: number): { letter: string; points: number } {
  const entry = GRADE_SCALE.find(g => score >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { letter: entry.letter, points: entry.points };
}

export function calculateGpa(courses: GpaCourse[]): GpaResult {
  const valid = courses.filter(c => c.currentScore >= 0);

  const detailed = valid.map(c => {
    const { letter, points } = scoreToGradePoints(c.currentScore);
    return { name: c.name, score: c.currentScore, letterGrade: letter, gradePoints: points, creditHours: c.creditHours };
  });

  const totalCredits = detailed.reduce((s, c) => s + c.creditHours, 0);
  const weightedSum = detailed.reduce((s, c) => s + c.gradePoints * c.creditHours, 0);
  const unweightedSum = detailed.reduce((s, c) => s + c.gradePoints, 0);

  return {
    semesterGpa: totalCredits > 0 ? Math.round((weightedSum / totalCredits) * 100) / 100 : 0,
    unweightedGpa: detailed.length > 0 ? Math.round((unweightedSum / detailed.length) * 100) / 100 : 0,
    courses: detailed,
  };
}
```

- [ ] **Step 2: Add GPA widget to Dashboard — Analytics tab**

In `src/pages/Dashboard.tsx`, import `calculateGpa` and `CanvasLiveCourse` types. In the Analytics tab section, add a GPA card:

```tsx
// In Analytics tab, after existing charts:
{(() => {
  const canvasLive = data?.pluginData?.canvasLive
  if (!canvasLive || canvasLive.courses.length === 0) return null

  const gpaCourses = canvasLive.courses
    .filter(c => c.currentScore !== null)
    .map(c => ({ name: c.courseCode, currentScore: c.currentScore!, creditHours: 3 }))

  if (gpaCourses.length === 0) return null
  // calculateGpa is a static import at the top of Dashboard.tsx:
  // import { calculateGpa } from '../utils/canvasGpa'
  const gpaResult = calculateGpa(gpaCourses)

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700 }}>Estimated GPA</h4>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 28, fontFamily: 'DM Mono', fontWeight: 700, color: 'var(--accent)' }}>
            {gpaResult.semesterGpa.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weighted GPA</div>
        </div>
        <div>
          <div style={{ fontSize: 28, fontFamily: 'DM Mono', fontWeight: 700 }}>
            {gpaResult.unweightedGpa.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Unweighted GPA</div>
        </div>
      </div>
      {gpaResult.courses.map(c => (
        <div key={c.name} style={{ display: 'flex', gap: 8, fontSize: 12, marginBottom: 4, alignItems: 'center' }}>
          <span style={{ minWidth: 80, color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 11 }}>{c.name}</span>
          <span style={{ flex: 1 }}>{c.score.toFixed(1)}%</span>
          <span style={{ fontWeight: 700, minWidth: 30 }}>{c.letterGrade}</span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'DM Mono', fontSize: 11 }}>{c.gradePoints.toFixed(1)} pts</span>
        </div>
      ))}
    </div>
  )
})()}
```

> **Note:** Use a static import at the top of `Dashboard.tsx`: `import { calculateGpa } from '../utils/canvasGpa'`

- [ ] **Step 3: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/utils/canvasGpa.ts src/pages/Dashboard.tsx
git commit -m "feat: add weighted GPA calculator using Canvas live grade data"
```

---

## Chunk 5: Reminders & Notifications

### Task 10: Assignment Reminder System

**Better Canvas ref:** `reminderWatch()` — floating notification-style reminder elements, persistent across browsing.

NousAI is a PWA — browser push notifications are the equivalent. The existing `notificationPrefs` in `PluginData` already has a placeholder. This task makes it functional.

**Files:**
- Create: `src/utils/assignmentReminders.ts`
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Create assignmentReminders.ts**

```ts
/**
 * Assignment reminder system — PWA equivalent of Better Canvas's reminderWatch().
 * Uses the Web Notifications API (requires user permission).
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export interface ReminderTarget {
  name: string;
  dueAt: string;          // ISO datetime
  courseCode: string;
  htmlUrl: string;
}

/**
 * Schedule a browser notification for assignments due within the next 24h.
 * Call this once on app load (after Canvas sync). Uses setTimeout, so
 * notifications only fire while the app is open — service worker push
 * is the upgrade path for true background reminders.
 */
export function scheduleAssignmentReminders(
  assignments: ReminderTarget[],
  notifyHoursBefore: number = 24
): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  const now = Date.now()
  const notifyMs = notifyHoursBefore * 60 * 60 * 1000

  assignments.forEach(a => {
    if (!a.dueAt) return
    const dueMs = new Date(a.dueAt).getTime()
    const fireAt = dueMs - notifyMs

    // Only schedule if fire time is in the future and within next 48h
    if (fireAt <= now || fireAt > now + 48 * 60 * 60 * 1000) return

    const delay = fireAt - now
    setTimeout(() => {
      new Notification(`📚 ${a.courseCode} — Due in ${notifyHoursBefore}h`, {
        body: a.name,
        icon: '/icons/icon-192x192.png',
        tag: `assignment-${a.dueAt}-${a.name.slice(0, 20)}`,
        data: { url: a.htmlUrl },
      })
    }, delay)
  })
}

/**
 * Show an immediate test notification to verify permissions work.
 */
export function sendTestNotification(): void {
  if (Notification.permission !== 'granted') return
  new Notification('NousAI Reminders Active', {
    body: 'You will be notified before Canvas assignments are due.',
    icon: '/icons/icon-192x192.png',
  })
}
```

- [ ] **Step 2: Wire reminders to app startup**

In `src/App.tsx` (or wherever the app initializes after load), add a `useEffect` that calls `scheduleAssignmentReminders` after Canvas live data is available:

```tsx
useEffect(() => {
  const canvasLive = data?.pluginData?.canvasLive
  const notifPrefs = data?.pluginData?.notificationPrefs
  if (!canvasLive || !notifPrefs?.reviewReminders) return

  const targets = canvasLive.assignments
    .filter(a => a.dueAt && a.submissionState !== 'graded' && a.submissionState !== 'submitted')
    .map(a => {
      const course = canvasLive.courses.find(c => c.canvasId === a.courseId)
      return { name: a.name, dueAt: a.dueAt!, courseCode: course?.courseCode ?? 'Canvas', htmlUrl: a.htmlUrl }
    })

  scheduleAssignmentReminders(targets)
}, [data?.pluginData?.canvasLive, data?.pluginData?.notificationPrefs])
```

- [ ] **Step 3: Add notification toggle to Settings**

In `src/pages/SettingsPage.tsx`, find the notifications section (search for `notificationPrefs`). Add:
- A toggle for "Assignment due reminders"
- A "Request notification permission" button (only shows if `Notification.permission !== 'granted'`)
- A "Send test notification" button

```tsx
import { requestNotificationPermission, sendTestNotification } from '../utils/assignmentReminders'

// In JSX near notifications:
<button onClick={async () => {
  const ok = await requestNotificationPermission()
  if (ok) sendTestNotification()
}}>
  {Notification.permission === 'granted' ? 'Notifications Active ✓' : 'Enable Notifications'}
</button>
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/utils/assignmentReminders.ts src/App.tsx src/pages/SettingsPage.tsx
git commit -m "feat: add assignment reminder notifications — Better Canvas reminderWatch equivalent"
```

---

## Chunk 6: Theme & Customization

### Task 11: Auto Dark Mode Scheduling

**Better Canvas ref:** `autoDarkModeCheck()` — checks current time against configured start/end times and toggles dark mode.

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx` (or main theme hook)

- [ ] **Step 1: Add auto dark mode check function**

Create or add to a theme utility (`src/utils/theme.ts` if it exists, or inline in Settings):

```ts
export function checkAutoDarkMode(
  schedule: { enabled: boolean; startTime: string; endTime: string } | undefined
): boolean | null {
  if (!schedule?.enabled) return null
  const [startH, startM] = schedule.startTime.split(':').map(Number)
  const [endH, endM] = schedule.endTime.split(':').map(Number)
  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const startMins = startH * 60 + startM
  const endMins = endH * 60 + endM

  if (startMins < endMins) {
    // Same-day range e.g. 22:00 - 07:00 won't hit this; 08:00 - 20:00 would
    return currentMins >= startMins && currentMins < endMins
  } else {
    // Overnight range e.g. 22:00 - 07:00
    return currentMins >= startMins || currentMins < endMins
  }
}
```

- [ ] **Step 2: Apply auto dark in App.tsx on mount + interval**

In `src/App.tsx`:
```tsx
useEffect(() => {
  function applyAutoDark() {
    const schedule = data?.settings?.autoDarkSchedule
    const shouldBeDark = checkAutoDarkMode(schedule)
    if (shouldBeDark === null) return // schedule disabled, respect manual setting
    // Use the existing theme system (data.settings.theme) — do NOT toggle a .dark CSS class
    // as there are no html.dark rules in index.css. The theme system handles dark mode application.
    setData(prev => ({
      ...prev,
      settings: { ...prev.settings, theme: shouldBeDark ? 'dark' : 'light' }
    }))
  }
  applyAutoDark()
  const interval = setInterval(applyAutoDark, 60_000) // check every minute
  return () => clearInterval(interval)
}, [data?.settings?.autoDarkSchedule])
```

- [ ] **Step 3: Add schedule UI to Settings**

Find the theme/appearance section in `src/pages/SettingsPage.tsx`. Add after the dark/light/system toggle:

```tsx
<div style={{ marginTop: 12 }}>
  <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
    <input
      type="checkbox"
      checked={data.settings.autoDarkSchedule?.enabled ?? false}
      onChange={e => setData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          autoDarkSchedule: {
            enabled: e.target.checked,
            startTime: prev.settings.autoDarkSchedule?.startTime ?? '22:00',
            endTime: prev.settings.autoDarkSchedule?.endTime ?? '07:00',
          }
        }
      }))}
    />
    Auto dark mode schedule
  </label>

  {data.settings.autoDarkSchedule?.enabled && (
    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13 }}>
      <label>
        Dark from
        <input type="time" value={data.settings.autoDarkSchedule.startTime}
          onChange={e => setData(prev => ({
            ...prev,
            settings: { ...prev.settings, autoDarkSchedule: { ...prev.settings.autoDarkSchedule!, startTime: e.target.value } }
          }))}
          style={{ marginLeft: 6 }}
        />
      </label>
      <label>
        to
        <input type="time" value={data.settings.autoDarkSchedule.endTime}
          onChange={e => setData(prev => ({
            ...prev,
            settings: { ...prev.settings, autoDarkSchedule: { ...prev.settings.autoDarkSchedule!, endTime: e.target.value } }
          }))}
          style={{ marginLeft: 6 }}
        />
      </label>
    </div>
  )}
</div>
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/App.tsx
git commit -m "feat: add auto dark mode scheduling — Better Canvas autoDarkModeCheck equivalent"
```

---

### Task 12: Theme Presets

**Better Canvas ref:** Community themes — JSON blobs that apply preset color schemes in one click.

**Files:**
- Modify: `src/index.css`
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add theme preset CSS variable overrides to index.css**

After the existing `:root` block, add 3 presets:

```css
/* ── Theme Presets ─────────────────────────────────────────────────────────── */

html[data-theme="forest"] {
  --bg-primary: #0d1f0d;
  --bg-secondary: #162416;
  --bg-card: #1a2e1a;
  --accent: #4ade80;
  --accent-hover: #22c55e;
  --text-primary: #f0fdf4;
  --border: rgba(74,222,128,0.15);
}

html[data-theme="ocean"] {
  --bg-primary: #020f1a;
  --bg-secondary: #041828;
  --bg-card: #052033;
  --accent: #38bdf8;
  --accent-hover: #0ea5e9;
  --text-primary: #f0f9ff;
  --border: rgba(56,189,248,0.15);
}

html[data-theme="dusk"] {
  --bg-primary: #13001f;
  --bg-secondary: #1e0030;
  --bg-card: #270040;
  --accent: #c084fc;
  --accent-hover: #a855f7;
  --text-primary: #faf5ff;
  --border: rgba(192,132,252,0.15);
}
```

- [ ] **Step 2: Apply preset via `data-theme` attribute**

In `src/App.tsx` (or wherever theme is applied), add:
```tsx
useEffect(() => {
  const preset = data?.settings?.themePreset
  if (preset && preset !== 'default') {
    document.documentElement.setAttribute('data-theme', preset)
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}, [data?.settings?.themePreset])
```

- [ ] **Step 3: Add preset selector to Settings**

```tsx
// IMPORTANT: Name this CANVAS_THEME_PRESETS — the name THEME_PRESETS is already
// imported from '../utils/gamification' in SettingsPage.tsx and will cause a
// duplicate-identifier TypeScript error if reused.
const CANVAS_THEME_PRESETS = [
  { id: 'default', label: 'Focused Scholar', accent: '#F5A623' },
  { id: 'forest',  label: 'Forest',          accent: '#4ade80' },
  { id: 'ocean',   label: 'Ocean',           accent: '#38bdf8' },
  { id: 'dusk',    label: 'Dusk',            accent: '#c084fc' },
]

// In Settings JSX, Appearance section:
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
  {CANVAS_THEME_PRESETS.map(p => (
    <button
      key={p.id}
      onClick={() => setData(prev => ({
        ...prev,
        settings: { ...prev.settings, themePreset: p.id }
      }))}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
        border: `2px solid ${data.settings.themePreset === p.id ? p.accent : 'var(--border)'}`,
        background: 'var(--bg-secondary)', fontSize: 12, fontFamily: 'inherit',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.accent }} />
      {p.label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/pages/SettingsPage.tsx src/App.tsx
git commit -m "feat: add 3 theme presets (Forest, Ocean, Dusk) — Better Canvas community themes equivalent"
```

---

### Task 13: Custom Font Selector

**Better Canvas ref:** Custom fonts — injects a Google Font `<link>` tag and applies `font-family` globally.

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add font injection to App.tsx**

```tsx
useEffect(() => {
  const font = data?.settings?.customFont
  const linkId = 'nousai-custom-font'
  let link = document.getElementById(linkId) as HTMLLinkElement | null

  if (font && font !== 'default') {
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
    document.documentElement.style.setProperty('--font-family-body', `'${font}', Inter, sans-serif`)
  } else {
    link?.remove()
    document.documentElement.style.removeProperty('--font-family-body')
  }
}, [data?.settings?.customFont])
```

- [ ] **Step 2: Add font picker to Settings**

```tsx
const FONT_OPTIONS = [
  { value: 'default', label: 'Default (Inter)' },
  { value: 'Roboto',  label: 'Roboto' },
  { value: 'Nunito',  label: 'Nunito' },
  { value: 'Lato',    label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Source Sans Pro', label: 'Source Sans Pro' },
]

// In Settings JSX, Appearance section:
<div style={{ marginTop: 12 }}>
  <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Body Font</label>
  <select
    value={data.settings.customFont ?? 'default'}
    onChange={e => setData(prev => ({
      ...prev,
      settings: { ...prev.settings, customFont: e.target.value }
    }))}
    style={{ fontSize: 13, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
  >
    {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
  </select>
</div>
```

- [ ] **Step 3: Ensure `--font-family-body` is used in index.css**

In `src/index.css`, check if `font-family` in `:root` or `body` uses a variable. If not, update:
```css
body {
  font-family: var(--font-family-body, 'Inter', sans-serif);
}
```

- [ ] **Step 4: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 5: Deploy and test on production**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build && vercel --prod --yes
```

Then clear PWA cache:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/SettingsPage.tsx src/App.tsx src/index.css
git commit -m "feat: add custom Google Font selector — Better Canvas custom fonts equivalent"
```

---

## Chunk 7: NousAI Chrome Extension

This is a **separate project** from the NousAI PWA — a Manifest V3 Chrome extension that:
1. Does everything Better Canvas does on Canvas pages (grades, GPA, assignments, dark mode, themes, fonts)
2. **Plus** syncs two ways with NousAI — pushes Canvas data into NousAI, pulls NousAI study data onto Canvas pages

**Live on Canvas pages:** grade badges, upcoming assignments, GPA panel, NousAI weak topics, flashcard due count, study streak.
**No API token needed** — reads Canvas data using the user's active browser session (same as Better Canvas).
**Auth:** Firebase Auth — same project (`nousai-dc038`) as the PWA.

### Extension File Structure

```
nousai-extension/          ← new folder, sibling to NousAI-App
  manifest.json            ← MV3, permissions, content script config
  background.js            ← service worker: Firebase auth, NousAI sync
  content.js               ← injected into Canvas pages, all UI work
  popup.html               ← settings popup HTML
  popup.js                 ← settings popup logic
  styles.css               ← injected styles (dark mode, card overlays, panels)
  firebase-config.js       ← shared Firebase config (same as PWA's .env vars)
  icons/
    icon-16.png
    icon-48.png
    icon-128.png
```

### Two-Way Sync Architecture

```
Canvas page (content.js)
  ↓ fetch /api/v1/courses (session cookie — no token needed)
  ↓ fetch /api/v1/courses/:id/assignments?include[]=submission
  ↓ fetch /api/v1/courses/:id/enrollments?include[]=total_scores
  ↓
background.js (service worker)
  ↓ firebase.auth() → getIdToken()
  ↓ POST https://nousai-app.vercel.app/api/extension-sync
      body: { canvasData: { courses, assignments, grades } }
  ↓
Vercel: api/extension-sync.ts (NEW)
  ↓ verifies Firebase ID token
  ↓ saves canvasLive to Firestore under user doc
  ↓ returns NousAI study data: { weakTopics, flashcardsDue, gpa, streak }
  ↓
content.js receives NousAI data
  → injects NousAI panel onto Canvas pages
```

---

### Task 14: Create Extension Scaffold

**Files:**
- Create: `nousai-extension/manifest.json`
- Create: `nousai-extension/background.js`
- Create: `nousai-extension/firebase-config.js`

- [ ] **Step 1: Create `nousai-extension/` folder**

```bash
mkdir C:\Users\johnn\Desktop\nousai-extension
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "NousAI for Canvas",
  "version": "1.0.0",
  "description": "Enhances Canvas with grades, GPA, assignments, and NousAI study sync",
  "permissions": [
    "storage",
    "notifications",
    "identity"
  ],
  "host_permissions": [
    "https://*.instructure.com/*",
    "https://nousai-app.vercel.app/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["https://*.instructure.com/*"],
      "js": ["content.js"],
      "css": ["styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 3: Create `firebase-config.js`**

Copy the Firebase config from the NousAI PWA's `.env` file (same project `nousai-dc038`):

```js
// nousai-extension/firebase-config.js
// Same Firebase project as the NousAI PWA
export const FIREBASE_CONFIG = {
  apiKey: "AIza...",         // copy from NousAI-App/.env VITE_FIREBASE_API_KEY
  authDomain: "nousai-dc038.firebaseapp.com",
  projectId: "nousai-dc038",
  storageBucket: "nousai-dc038.appspot.com",
  messagingSenderId: "...",  // copy from NousAI-App/.env
  appId: "...",              // copy from NousAI-App/.env
};

export const NOUSAI_BASE_URL = 'https://nousai-app.vercel.app';
```

- [ ] **Step 4: Create `background.js` — service worker**

```js
// nousai-extension/background.js
import { NOUSAI_BASE_URL } from './firebase-config.js';

// On install: set defaults
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    darkMode: false,
    darkModeStartTime: '22:00',
    darkModeEndTime: '07:00',
    autoDarkMode: false,
    showGrades: true,
    showAssignments: true,
    showGpa: true,
    showNousAIPanel: true,
    themePreset: 'default',
    customFont: '',
    nousaiToken: '',          // Firebase ID token, refreshed periodically
    lastSync: null,
  });
});

// Message handler: content.js asks background to sync with NousAI
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SYNC_TO_NOUSAI') {
    syncToNousAI(message.payload).then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true; // keep channel open for async response
  }
  if (message.type === 'GET_NOUSAI_DATA') {
    getNousAIData().then(sendResponse).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
});

async function getStoredToken() {
  const { nousaiToken } = await chrome.storage.sync.get('nousaiToken');
  return nousaiToken || null;
}

async function syncToNousAI(canvasData) {
  const token = await getStoredToken();
  if (!token) return { ok: false, error: 'Not logged in to NousAI' };

  const res = await fetch(`${NOUSAI_BASE_URL}/api/extension-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(canvasData),
  });
  if (!res.ok) return { ok: false, error: `Sync failed: ${res.status}` };
  const data = await res.json();
  // Cache NousAI response data locally
  await chrome.storage.local.set({ nousaiData: data, lastSync: Date.now() });
  return { ok: true, data };
}

async function getNousAIData() {
  const { nousaiData } = await chrome.storage.local.get('nousaiData');
  return nousaiData || null;
}
```

- [ ] **Step 5: Create NousAI icons from PWA source**

The NousAI PWA already has icons at `NousAI-App/public/icons/`. Copy and resize for the extension:

```bash
# Copy source icon into extension icons folder
mkdir "C:\Users\johnn\Desktop\nousai-extension\icons"
cp "C:\Users\johnn\Desktop\NousAI-App\public\icons\icon-192x192.png" \
   "C:\Users\johnn\Desktop\nousai-extension\icons\icon-128.png"
```

Then resize to 48×48 and 16×16 using any image editor (or ImageMagick if installed):
```bash
# ImageMagick (if available):
magick "C:\Users\johnn\Desktop\NousAI-App\public\icons\icon-192x192.png" -resize 48x48  "nousai-extension\icons\icon-48.png"
magick "C:\Users\johnn\Desktop\NousAI-App\public\icons\icon-192x192.png" -resize 16x16  "nousai-extension\icons\icon-16.png"
```

Result: `icons/icon-16.png`, `icons/icon-48.png`, `icons/icon-128.png` — all NousAI logo, no Better Canvas branding anywhere in the extension.

- [ ] **Step 6: Commit scaffold**

```bash
cd C:\Users\johnn\Desktop\nousai-extension
git init
git add .
git commit -m "feat: scaffold NousAI Chrome Extension (MV3) with NousAI icons"
```

---

### Task 15: Create Vercel Sync Endpoint

This is a new Vercel serverless function in the NousAI-App repo that:
- Receives Canvas data FROM the extension
- Verifies the Firebase ID token
- Saves `canvasLive` to Firestore
- Returns NousAI study data back to the extension

**Files:**
- Create: `api/extension-sync.ts` (in NousAI-App)

- [ ] **Step 1: Create `api/extension-sync.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { gunzipSync } from 'zlib';

// Initialize Firebase Admin (uses FIREBASE_SERVICE_ACCOUNT env var)
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}')),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow extension origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify Firebase ID token
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.replace('Bearer ', '');
  if (!idToken) return res.status(401).json({ error: 'Missing auth token' });

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const db = getFirestore();
  const { courses, assignments, announcements } = req.body || {};

  // Save Canvas live data to Firestore (same path the PWA uses)
  const canvasLive = {
    courses: courses || [],
    assignments: assignments || [],
    announcements: announcements || [],
    lastFullSync: new Date().toISOString(),
  };

  try {
    // Read user's NousAI data to return study metrics to extension
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;

    // Extract compressed pluginData (same format as PWA sync)
    let pluginData: Record<string, unknown> = {};
    if (userData?.pluginData) {
      try {
        // PWA stores gzip-compressed base64; decompress here
        const buf = Buffer.from(userData.pluginData as string, 'base64');
        pluginData = JSON.parse(gunzipSync(buf).toString());
      } catch {
        pluginData = userData.pluginData as Record<string, unknown>;
      }
    }

    // Save canvasLive into the user's Firestore doc
    await db.collection('users').doc(uid).set(
      { canvasLive },
      { merge: true }
    );

    // Return NousAI study data for the extension to display on Canvas
    const gamification = (pluginData.gamificationData || {}) as Record<string, unknown>;
    const srCards = ((pluginData.srData as Record<string, unknown>)?.cards || []) as Array<{ nextReview: string }>;
    const flashcardsDue = srCards.filter(c => new Date(c.nextReview) <= new Date()).length;

    return res.status(200).json({
      ok: true,
      nousaiData: {
        streak: gamification.streak ?? 0,
        xp: gamification.xp ?? 0,
        level: gamification.level ?? 1,
        flashcardsDue,
        // Weak topics: top 3 subtopics with lowest proficiency
        weakTopics: [], // populated from proficiencyData if available
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
```

> **Note:** Requires `FIREBASE_SERVICE_ACCOUNT` environment variable in Vercel with the Firebase Admin SDK service account JSON. Set this in the Vercel dashboard under Settings → Environment Variables.

- [ ] **Step 2: Add `firebase-admin` dependency**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm install firebase-admin
```

- [ ] **Step 3: Build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add api/extension-sync.ts package.json package-lock.json
git commit -m "feat: add extension-sync Vercel endpoint for Chrome extension two-way sync"
```

---

### Task 16: content.js — Canvas Page Enhancement

This is the heart of the extension. Injected into every Canvas page, it:
- Detects the Canvas dashboard / course pages
- Fetches live data from Canvas API (using session — no token needed)
- Injects grade badges, assignment lists, GPA panel
- Injects NousAI study data panel
- Applies dark mode / themes / fonts based on stored settings

**Files:**
- Create: `nousai-extension/content.js`

- [ ] **Step 1: Create the Canvas page detector and entry point**

```js
// nousai-extension/content.js

const CANVAS_BASE = window.location.origin; // e.g. https://unomaha.instructure.com

// ── Detect page type ──────────────────────────────────────────────────────────

function isCanvasDashboard() {
  return window.location.pathname === '/' ||
         window.location.pathname === '/dashboard' ||
         document.querySelector('.ic-DashboardCard') !== null;
}

function isCanvasCoursePage() {
  return /^\/courses\/\d+/.test(window.location.pathname);
}

// ── Wait for Canvas dynamic content to load ───────────────────────────────────

function waitForElement(selector, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) { observer.disconnect(); resolve(found); }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { observer.disconnect(); reject(new Error(`Timeout: ${selector}`)); }, timeout);
  });
}

// ── Main entry ────────────────────────────────────────────────────────────────

async function main() {
  const settings = await chrome.storage.sync.get([
    'showGrades', 'showAssignments', 'showGpa', 'showNousAIPanel',
    'darkMode', 'autoDarkMode', 'darkModeStartTime', 'darkModeEndTime',
    'themePreset', 'customFont',
  ]);

  applyTheme(settings);
  applyFont(settings.customFont);
  checkAutoDarkMode(settings);

  if (isCanvasDashboard()) {
    await initDashboard(settings);
  } else if (isCanvasCoursePage()) {
    await initCoursePage(settings);
  }

  // Sync Canvas data to NousAI in background
  syncToNousAI();
}

main().catch(console.error);
```

- [ ] **Step 2: Canvas API helper (uses session — no token needed)**

```js
// Fetch from Canvas API using the existing browser session
async function canvasFetch(endpoint) {
  const url = `${CANVAS_BASE}/api/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    credentials: 'same-origin', // uses Canvas session cookie
  });
  if (!res.ok) throw new Error(`Canvas API ${res.status}: ${endpoint}`);
  return res.json();
}

async function canvasFetchAll(endpoint) {
  let allData = [];
  let url = `${CANVAS_BASE}/api/v1/${endpoint}`;
  while (url) {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
    });
    if (!res.ok) break;
    const data = await res.json();
    allData = allData.concat(Array.isArray(data) ? data : [data]);
    const link = res.headers.get('Link') || '';
    const next = link.match(/<([^>]+)>;\s*rel="next"/);
    url = next ? next[1] : null;
  }
  return allData;
}
```

- [ ] **Step 3: Dashboard enhancement — grades + assignments on cards**

```js
async function initDashboard(settings) {
  // Wait for Canvas dashboard cards to render
  await waitForElement('.ic-DashboardCard');

  // Fetch all courses with grade data (Better Canvas: insertGrades equivalent)
  const courses = await canvasFetchAll(
    'courses?enrollment_state=active&include[]=total_scores&include[]=current_grading_period_scores&per_page=50'
  );

  // Build a map: course name → grade data
  const gradeMap = {};
  for (const c of courses) {
    const enrollment = (c.enrollments || [])[0];
    gradeMap[c.id] = {
      name: c.name,
      courseCode: c.course_code,
      currentScore: enrollment?.computed_current_score ?? null,
      currentGrade: enrollment?.computed_current_grade ?? null,
    };
  }

  // Fetch upcoming assignments for all courses (5 at a time)
  const assignmentMap = {};
  const BATCH = 5;
  for (let i = 0; i < courses.length; i += BATCH) {
    const batch = courses.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(c =>
        canvasFetchAll(`courses/${c.id}/assignments?per_page=20&order_by=due_at&include[]=submission`)
          .then(items => ({ courseId: c.id, items }))
      )
    );
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        assignmentMap[r.value.courseId] = r.value.items;
      }
    });
  }

  // Inject into each dashboard card
  const cards = document.querySelectorAll('.ic-DashboardCard');
  for (const card of cards) {
    const courseLink = card.querySelector('.ic-DashboardCard__link');
    if (!courseLink) continue;
    const href = courseLink.getAttribute('href') || '';
    const courseIdMatch = href.match(/\/courses\/(\d+)/);
    if (!courseIdMatch) continue;
    const courseId = parseInt(courseIdMatch[1]);
    const gradeData = gradeMap[courseId];
    const assignments = assignmentMap[courseId] || [];

    if (settings.showGrades && gradeData?.currentScore !== null) {
      injectGradeBadge(card, gradeData);
    }
    if (settings.showAssignments) {
      injectUpcomingAssignments(card, assignments);
    }
  }

  if (settings.showGpa) {
    injectGpaPanel(courses);
  }

  if (settings.showNousAIPanel) {
    await injectNousAIPanel();
  }
}
```

- [ ] **Step 4: Grade badge injection (Better Canvas `insertGrades` equivalent)**

```js
function injectGradeBadge(card, gradeData) {
  if (card.querySelector('.nousai-grade-badge')) return; // already injected

  const score = gradeData.currentScore;
  const color = score >= 90 ? '#22c55e' : score >= 80 ? '#eab308' : score >= 70 ? '#f97316' : '#ef4444';
  const bg = score >= 90 ? 'rgba(34,197,94,0.15)' : score >= 80 ? 'rgba(234,179,8,0.15)'
           : score >= 70 ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)';

  const badge = document.createElement('div');
  badge.className = 'nousai-grade-badge';
  badge.style.cssText = `
    position: absolute; top: 8px; right: 8px; z-index: 10;
    background: ${bg}; color: ${color}; border: 1px solid ${color};
    border-radius: 20px; padding: 2px 8px; font-size: 11px; font-weight: 700;
    font-family: 'DM Mono', monospace; backdrop-filter: blur(4px);
  `;
  badge.textContent = `${score.toFixed(1)}%${gradeData.currentGrade ? ` · ${gradeData.currentGrade}` : ''}`;

  card.style.position = 'relative';
  card.appendChild(badge);
}
```

- [ ] **Step 5: Upcoming assignments injection per card**

```js
function dueDateLabel(dueAt) {
  if (!dueAt) return { text: 'No date', urgent: false };
  const daysUntil = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (daysUntil < 0)  return { text: `${Math.abs(daysUntil)}d overdue`, urgent: true };
  if (daysUntil === 0) return { text: 'Due today', urgent: true };
  if (daysUntil === 1) return { text: 'Tomorrow', urgent: true };
  return { text: new Date(dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), urgent: false };
}

function injectUpcomingAssignments(card, assignments) {
  if (card.querySelector('.nousai-assignments')) return;

  const upcoming = assignments
    .filter(a => a.submission?.workflow_state !== 'graded')
    .sort((a, b) => {
      if (!a.due_at) return 1;
      if (!b.due_at) return -1;
      return new Date(a.due_at) - new Date(b.due_at);
    })
    .slice(0, 3);

  if (upcoming.length === 0) return;

  const container = document.createElement('div');
  container.className = 'nousai-assignments';
  container.style.cssText = `
    padding: 6px 10px 8px; border-top: 1px solid rgba(255,255,255,0.1);
    display: flex; flex-direction: column; gap: 3px;
  `;

  for (const a of upcoming) {
    const due = dueDateLabel(a.due_at);
    const row = document.createElement('div');
    row.style.cssText = 'display: flex; align-items: center; gap: 6px; font-size: 10px;';
    row.innerHTML = `
      <span style="background: ${due.urgent ? 'rgba(239,68,68,0.15)' : 'rgba(163,163,163,0.1)'};
                   color: ${due.urgent ? '#ef4444' : '#999'};
                   border-radius: 4px; padding: 1px 5px; font-weight: 700; flex-shrink: 0; font-size: 9px;">
        ${due.text}
      </span>
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(255,255,255,0.8);">
        ${a.name}
      </span>
    `;
    container.appendChild(row);
  }

  // Insert into card footer area
  const footer = card.querySelector('.ic-DashboardCard__footer') || card;
  footer.appendChild(container);
}
```

- [ ] **Step 6: GPA panel injected at top of dashboard**

```js
const GRADE_SCALE = [
  { min: 97, letter: 'A+', points: 4.0 }, { min: 93, letter: 'A', points: 4.0 },
  { min: 90, letter: 'A-', points: 3.7 }, { min: 87, letter: 'B+', points: 3.3 },
  { min: 83, letter: 'B', points: 3.0 },  { min: 80, letter: 'B-', points: 2.7 },
  { min: 77, letter: 'C+', points: 2.3 }, { min: 73, letter: 'C', points: 2.0 },
  { min: 70, letter: 'C-', points: 1.7 }, { min: 67, letter: 'D+', points: 1.3 },
  { min: 63, letter: 'D', points: 1.0 },  { min: 60, letter: 'D-', points: 0.7 },
  { min: 0, letter: 'F', points: 0.0 },
];

function scoreToGrade(score) {
  return GRADE_SCALE.find(g => score >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
}

function injectGpaPanel(courses) {
  if (document.querySelector('.nousai-gpa-panel')) return;

  const gradedCourses = courses
    .map(c => ({ code: c.course_code, score: (c.enrollments?.[0])?.computed_current_score }))
    .filter(c => c.score !== null && c.score !== undefined);

  if (gradedCourses.length === 0) return;

  const detailed = gradedCourses.map(c => ({ ...c, ...scoreToGrade(c.score) }));
  const weightedGpa = detailed.reduce((s, c) => s + c.points, 0) / detailed.length;

  const panel = document.createElement('div');
  panel.className = 'nousai-gpa-panel';
  panel.style.cssText = `
    margin: 0 24px 20px; padding: 14px 20px; border-radius: 10px;
    background: rgba(15,15,15,0.85); border: 1px solid rgba(245,166,35,0.3);
    backdrop-filter: blur(10px); display: flex; align-items: center; gap: 20px;
    font-family: 'Inter', sans-serif;
  `;
  panel.innerHTML = `
    <div style="display: flex; align-items: baseline; gap: 6px;">
      <span style="font-size: 28px; font-weight: 700; color: #F5A623; font-family: 'DM Mono', monospace;">
        ${weightedGpa.toFixed(2)}
      </span>
      <span style="font-size: 11px; color: #888;">GPA · NousAI</span>
    </div>
    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
      ${detailed.map(c => `
        <div style="text-align: center; min-width: 40px;">
          <div style="font-size: 14px; font-weight: 700; color: ${
            c.score >= 90 ? '#22c55e' : c.score >= 80 ? '#eab308' : c.score >= 70 ? '#f97316' : '#ef4444'
          };">${c.letter}</div>
          <div style="font-size: 9px; color: #666; font-family: 'DM Mono';">${c.code.slice(0, 8)}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Insert before the dashboard cards grid
  const dashboardContent = document.querySelector('#dashboard-activity, .ic-DashboardCard__header-hero')
    ?.closest('section') || document.querySelector('.dashboard-planner, #dashboard_header_container');
  if (dashboardContent) {
    dashboardContent.insertAdjacentElement('afterend', panel);
  } else {
    document.querySelector('.ic-DashboardCard')?.parentElement?.insertAdjacentElement('beforebegin', panel);
  }
}
```

- [ ] **Step 7: NousAI study data panel on Canvas**

```js
async function injectNousAIPanel() {
  if (document.querySelector('.nousai-study-panel')) return;

  const nousaiData = await chrome.runtime.sendMessage({ type: 'GET_NOUSAI_DATA' });
  if (!nousaiData) return;

  const panel = document.createElement('div');
  panel.className = 'nousai-study-panel';
  panel.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    background: rgba(10,10,10,0.92); border: 1px solid rgba(245,166,35,0.4);
    border-radius: 12px; padding: 12px 16px; min-width: 180px;
    font-family: 'Inter', sans-serif; backdrop-filter: blur(12px);
    box-shadow: 0 4px 24px rgba(0,0,0,0.5); cursor: pointer;
    transition: opacity 0.2s;
  `;
  panel.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <span style="font-size: 13px; font-weight: 700; color: #F5A623;">NousAI</span>
      <span style="font-size: 10px; color: #555; margin-left: auto; cursor: pointer;" id="nousai-panel-close">✕</span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span style="color: #888;">🔥 Streak</span>
        <span style="color: #fff; font-family: 'DM Mono';">${nousaiData.streak} days</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span style="color: #888;">⚡ XP</span>
        <span style="color: #fff; font-family: 'DM Mono';">${nousaiData.xp.toLocaleString()}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px;">
        <span style="color: #888;">🃏 Cards due</span>
        <span style="color: ${nousaiData.flashcardsDue > 0 ? '#ef4444' : '#22c55e'}; font-family: 'DM Mono';">
          ${nousaiData.flashcardsDue}
        </span>
      </div>
    </div>
    <a href="https://nousai-app.vercel.app" target="_blank"
       style="display: block; margin-top: 8px; text-align: center; font-size: 10px;
              color: #F5A623; text-decoration: none; opacity: 0.7;">
      Open NousAI →
    </a>
  `;

  document.body.appendChild(panel);
  document.getElementById('nousai-panel-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.remove();
  });
}
```

- [ ] **Step 8: Theme, dark mode, font application**

```js
function applyTheme(settings) {
  const preset = settings.themePreset || 'default';
  document.documentElement.setAttribute('data-nousai-theme', preset);
}

function applyFont(fontName) {
  if (!fontName) return;
  const linkId = 'nousai-font';
  if (!document.getElementById(linkId)) {
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
  }
  document.body.style.fontFamily = `'${fontName}', sans-serif`;
}

function checkAutoDarkMode(settings) {
  if (!settings.autoDarkMode) {
    if (settings.darkMode) applyDarkMode();
    return;
  }
  const [sh, sm] = settings.darkModeStartTime.split(':').map(Number);
  const [eh, em] = settings.darkModeEndTime.split(':').map(Number);
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  const isDark = start > end ? (cur >= start || cur < end) : (cur >= start && cur < end);
  if (isDark) applyDarkMode();
}

function applyDarkMode() {
  // Inject a CSS override that applies dark mode to Canvas pages
  // Uses same approach as Better Canvas: inject CSS variables
  const style = document.createElement('style');
  style.id = 'nousai-dark-mode';
  style.textContent = `
    body { background-color: #0a0a0a !important; color: #f0f0f0 !important; }
    .ic-DashboardCard { background: #1a1a1a !important; border-color: #333 !important; }
    #application, #content, .ic-app-main { background: #0a0a0a !important; }
    .ic-Layout-contentMain { background: #0d0d0d !important; }
    .ic-app-nav-toggle-and-crumbs { background: #111 !important; }
    /* NousAI dark mode overlay — Better Canvas full dark mode is 400+ lines;
       expand this list based on actual Canvas DOM inspection */
  `;
  if (!document.getElementById('nousai-dark-mode')) {
    document.head.appendChild(style);
  }
}
```

- [ ] **Step 9: Sync Canvas data to NousAI background**

```js
async function syncToNousAI() {
  try {
    const courses = await canvasFetchAll(
      'courses?enrollment_state=active&include[]=total_scores&per_page=50'
    );
    const response = await chrome.runtime.sendMessage({
      type: 'SYNC_TO_NOUSAI',
      payload: { courses, assignments: [], announcements: [] },
    });
    if (response?.ok) {
      // Store NousAI data returned from sync for panel display
      await chrome.storage.local.set({ nousaiData: response.data?.nousaiData });
    }
  } catch (err) {
    console.error('[NousAI] Sync failed:', err);
  }
}
```

- [ ] **Step 10: Commit content.js**

```bash
cd C:\Users\johnn\Desktop\nousai-extension
git add content.js
git commit -m "feat: content.js — Canvas page enhancement with grades, GPA, assignments, NousAI panel"
```

---

### Task 17: styles.css — Extension Stylesheet

**Files:**
- Create: `nousai-extension/styles.css`

- [ ] **Step 1: Create styles.css**

```css
/* NousAI Extension — Canvas page styles */

/* ── Theme: Default (NousAI Focused Scholar) ─── */
[data-nousai-theme="default"] .nousai-gpa-panel { border-color: rgba(245,166,35,0.3); }

/* ── Theme: Forest ────────────────────────────── */
[data-nousai-theme="forest"] .nousai-gpa-panel { border-color: rgba(74,222,128,0.3); }
[data-nousai-theme="forest"] .nousai-grade-badge { font-family: inherit; }

/* ── Theme: Ocean ─────────────────────────────── */
[data-nousai-theme="ocean"] .nousai-gpa-panel { border-color: rgba(56,189,248,0.3); }

/* ── Theme: Dusk ──────────────────────────────── */
[data-nousai-theme="dusk"] .nousai-gpa-panel { border-color: rgba(192,132,252,0.3); }

/* ── Assignments container fix for Canvas card layout ── */
.ic-DashboardCard { overflow: visible !important; }

/* ── Animate panel in ─────────────────────────── */
.nousai-study-panel {
  animation: nousai-fade-in 0.2s ease;
}
@keyframes nousai-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\johnn\Desktop\nousai-extension
git add styles.css
git commit -m "feat: add extension stylesheet with theme support"
```

---

### Task 18: popup.html + popup.js — Extension Settings

**Files:**
- Create: `nousai-extension/popup.html`
- Create: `nousai-extension/popup.js`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 280px; background: #0a0a0a; color: #f0f0f0;
      font-family: 'Inter', sans-serif; font-size: 13px;
    }
    .header {
      padding: 14px 16px; border-bottom: 1px solid #222;
      display: flex; align-items: center; gap: 8px;
    }
    .logo { color: #F5A623; font-weight: 700; font-size: 15px; }
    .section { padding: 12px 16px; border-bottom: 1px solid #1a1a1a; }
    .section-title { font-size: 10px; color: #555; text-transform: uppercase;
                     letter-spacing: 0.08em; margin-bottom: 8px; }
    .toggle-row { display: flex; justify-content: space-between; align-items: center;
                  margin-bottom: 6px; }
    .toggle-label { color: #ccc; }
    .toggle input[type="checkbox"] { cursor: pointer; }
    select, input[type="time"] {
      background: #1a1a1a; border: 1px solid #333; color: #f0f0f0;
      border-radius: 4px; padding: 4px 8px; font-size: 12px; font-family: inherit;
    }
    .login-section { padding: 12px 16px; }
    .login-btn {
      width: 100%; padding: 8px; background: #F5A623; color: #000;
      border: none; border-radius: 6px; font-weight: 700; cursor: pointer;
      font-family: inherit; font-size: 13px;
    }
    .status { font-size: 11px; color: #555; margin-top: 6px; text-align: center; }
    .status.ok { color: #22c55e; }
    .status.err { color: #ef4444; }
  </style>
</head>
<body>
  <div class="header">
    <span class="logo">NousAI</span>
    <span style="color: #555; font-size: 11px;">for Canvas</span>
  </div>

  <div class="section">
    <div class="section-title">Canvas Features</div>
    <div class="toggle-row"><span class="toggle-label">Show grade %</span>
      <input type="checkbox" id="showGrades" /></div>
    <div class="toggle-row"><span class="toggle-label">Upcoming assignments</span>
      <input type="checkbox" id="showAssignments" /></div>
    <div class="toggle-row"><span class="toggle-label">GPA panel</span>
      <input type="checkbox" id="showGpa" /></div>
    <div class="toggle-row"><span class="toggle-label">NousAI study panel</span>
      <input type="checkbox" id="showNousAIPanel" /></div>
  </div>

  <div class="section">
    <div class="section-title">Dark Mode</div>
    <div class="toggle-row"><span class="toggle-label">Dark mode</span>
      <input type="checkbox" id="darkMode" /></div>
    <div class="toggle-row"><span class="toggle-label">Auto schedule</span>
      <input type="checkbox" id="autoDarkMode" /></div>
    <div id="darkSchedule" style="display: none; margin-top: 6px; display: flex; gap: 8px; align-items: center;">
      <input type="time" id="darkModeStartTime" />
      <span style="color: #555;">to</span>
      <input type="time" id="darkModeEndTime" />
    </div>
  </div>

  <div class="section">
    <div class="section-title">Appearance</div>
    <div class="toggle-row">
      <span class="toggle-label">Theme</span>
      <select id="themePreset">
        <option value="default">Focused Scholar</option>
        <option value="forest">Forest</option>
        <option value="ocean">Ocean</option>
        <option value="dusk">Dusk</option>
      </select>
    </div>
    <div class="toggle-row" style="margin-top: 6px;">
      <span class="toggle-label">Font</span>
      <select id="customFont">
        <option value="">Default</option>
        <option value="Roboto">Roboto</option>
        <option value="Nunito">Nunito</option>
        <option value="Poppins">Poppins</option>
        <option value="Lato">Lato</option>
      </select>
    </div>
  </div>

  <div class="login-section">
    <div class="section-title">NousAI Account</div>
    <div id="loginForm">
      <input type="email" id="email" placeholder="Email" style="width:100%; margin-bottom:6px;" />
      <input type="password" id="password" placeholder="Password" style="width:100%;" />
      <button class="login-btn" id="loginBtn" style="margin-top: 8px;">Connect NousAI</button>
    </div>
    <div id="loggedInInfo" style="display: none;">
      <div class="status ok" id="loggedInEmail"></div>
      <button id="logoutBtn" style="margin-top: 6px; background: none; border: none; color: #555;
              cursor: pointer; font-size: 11px; font-family: inherit;">Disconnect</button>
    </div>
    <div class="status" id="loginStatus"></div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.js**

```js
// nousai-extension/popup.js

const NOUSAI_BASE_URL = 'https://nousai-app.vercel.app';

// ── Load settings into UI ──────────────────────────────────────────────────────

async function loadSettings() {
  const settings = await chrome.storage.sync.get([
    'showGrades', 'showAssignments', 'showGpa', 'showNousAIPanel',
    'darkMode', 'autoDarkMode', 'darkModeStartTime', 'darkModeEndTime',
    'themePreset', 'customFont', 'nousaiEmail',
  ]);

  document.getElementById('showGrades').checked      = settings.showGrades ?? true;
  document.getElementById('showAssignments').checked = settings.showAssignments ?? true;
  document.getElementById('showGpa').checked          = settings.showGpa ?? true;
  document.getElementById('showNousAIPanel').checked  = settings.showNousAIPanel ?? true;
  document.getElementById('darkMode').checked          = settings.darkMode ?? false;
  document.getElementById('autoDarkMode').checked      = settings.autoDarkMode ?? false;
  document.getElementById('darkModeStartTime').value  = settings.darkModeStartTime ?? '22:00';
  document.getElementById('darkModeEndTime').value    = settings.darkModeEndTime ?? '07:00';
  document.getElementById('themePreset').value         = settings.themePreset ?? 'default';
  document.getElementById('customFont').value          = settings.customFont ?? '';
  toggleDarkSchedule(settings.autoDarkMode);

  if (settings.nousaiEmail) {
    showLoggedIn(settings.nousaiEmail);
  }
}

// ── Save settings on any change ───────────────────────────────────────────────

document.querySelectorAll('input, select').forEach(el => {
  el.addEventListener('change', saveSettings);
});

async function saveSettings() {
  await chrome.storage.sync.set({
    showGrades:          document.getElementById('showGrades').checked,
    showAssignments:     document.getElementById('showAssignments').checked,
    showGpa:             document.getElementById('showGpa').checked,
    showNousAIPanel:     document.getElementById('showNousAIPanel').checked,
    darkMode:            document.getElementById('darkMode').checked,
    autoDarkMode:        document.getElementById('autoDarkMode').checked,
    darkModeStartTime:   document.getElementById('darkModeStartTime').value,
    darkModeEndTime:     document.getElementById('darkModeEndTime').value,
    themePreset:         document.getElementById('themePreset').value,
    customFont:          document.getElementById('customFont').value,
  });
}

document.getElementById('autoDarkMode').addEventListener('change', e => {
  toggleDarkSchedule(e.target.checked);
});

function toggleDarkSchedule(show) {
  document.getElementById('darkSchedule').style.display = show ? 'flex' : 'none';
}

// ── NousAI login ──────────────────────────────────────────────────────────────

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const status = document.getElementById('loginStatus');
  status.textContent = 'Connecting...';
  status.className = 'status';

  try {
    // Firebase REST API sign-in (no SDK needed in popup)
    const apiKey = 'AIza...'; // same key as firebase-config.js
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    if (!res.ok) throw new Error('Invalid credentials');
    const { idToken } = await res.json();
    await chrome.storage.sync.set({ nousaiToken: idToken, nousaiEmail: email });
    showLoggedIn(email);
    status.textContent = 'Connected!';
    status.className = 'status ok';
  } catch (err) {
    status.textContent = err.message || 'Login failed';
    status.className = 'status err';
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await chrome.storage.sync.remove(['nousaiToken', 'nousaiEmail']);
  document.getElementById('loggedInInfo').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
});

function showLoggedIn(email) {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('loggedInInfo').style.display = 'block';
  document.getElementById('loggedInEmail').textContent = `✓ ${email}`;
}

loadSettings();
```

> **Note:** Replace `'AIza...'` in popup.js with the actual Firebase API key from `nousai-dc038` (same key used in `firebase-config.js`).

- [ ] **Step 3: Commit popup**

```bash
cd C:\Users\johnn\Desktop\nousai-extension
git add popup.html popup.js
git commit -m "feat: add extension popup with settings and NousAI login"
```

---

### Task 19: Load Extension in Chrome and Test

- [ ] **Step 1: Open Chrome Extensions page**

Navigate to `chrome://extensions/` in Chrome.

- [ ] **Step 2: Enable Developer Mode** (toggle top-right)

- [ ] **Step 3: Load unpacked extension**

Click "Load unpacked" → select `C:\Users\johnn\Desktop\nousai-extension`

- [ ] **Step 4: Log in to NousAI via popup**

Click the NousAI extension icon → enter email `reallyjustjohnny6@gmail.com` + password → "Connect NousAI"

- [ ] **Step 5: Navigate to Canvas**

Go to `https://unomaha.instructure.com/` — you should see:
- Grade % badges on each course card
- Upcoming assignment rows under each card
- NousAI GPA panel at top of dashboard
- NousAI study panel (bottom right) showing streak + flashcards due

- [ ] **Step 6: Verify sync**

After visiting Canvas, open NousAI at `https://nousai-app.vercel.app` and confirm that Canvas live data appeared in the Dashboard without manually clicking "Sync" in Settings.

- [ ] **Step 7: Deploy updated NousAI-App (extension-sync endpoint)**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build && vercel --prod --yes
```

Clear PWA cache:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```

---

## Verification Checklist

After all chunks complete:

- [ ] Canvas sync button in Settings shows status message (not silent fail)
- [ ] Grade % badge appears on course cards after sync (color-coded green/yellow/red)
- [ ] Upcoming assignments appear on course cards (2-3 per card, due-date color coded)
- [ ] Hover over assignment row shows preview tooltip
- [ ] UpcomingAssignmentsWidget visible on Dashboard Overview after sync
- [ ] Analytics tab shows Weighted GPA + Unweighted GPA
- [ ] Settings > Notifications: enable button works, test notification fires
- [ ] Settings > Appearance: auto dark mode start/end time inputs work
- [ ] Settings > Appearance: 4 theme preset buttons change colors
- [ ] Settings > Appearance: font selector changes body font
- [ ] `npm run build` — zero TypeScript errors
- [ ] Production deploy tested at https://nousai-app.vercel.app with real account (reallyjustjohnny6@gmail.com)

---

## What Was NOT Ported (and Why)

| Better Canvas Feature | Why Not Ported |
|---|---|
| DOM injection into Canvas pages | NousAI is a PWA, not an extension — can't inject into Canvas |
| Remove sidebar logo | NousAI has its own UI, no Canvas DOM to modify |
| Full-width mode | NousAI is already full-width |
| Color-coded favicons per course | Minimal value in PWA context; tab title is more useful |
| 10-language localization | NousAI is currently English-only — separate i18n effort |
| Custom CSS injection | NousAI's theme preset system covers this more safely |


