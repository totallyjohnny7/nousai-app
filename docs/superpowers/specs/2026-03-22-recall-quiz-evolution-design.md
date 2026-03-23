# Recall Quiz Evolution — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Evolve Procedure Quiz into a general-purpose Recall Quiz supporting procedures, concepts, and hierarchical topics

## Context

The current Procedure Quiz tool (`ProcedureQuizTool.tsx`, ~840 lines) only handles ordered step-by-step procedures. Users need to quiz themselves on **concepts, topics, and subtopics** — unordered knowledge that doesn't fit the "steps in sequence" model. This evolution keeps the same UI flow (library → quiz → result) but generalizes the data model, import system, and AI grading to handle both ordered procedures and unordered concept recall.

## Approach

**Minimal Evolution (Approach A):** Extend the existing component with a `type` field on each saved item. The quiz view adapts its grading prompt based on type. Backward-compatible — existing procedures keep working with no migration friction.

---

## 1. Data Model

### New types (in `src/types.ts`)

```ts
export interface RecallPoint {
  order: number;
  text: string;
  subtopic?: string;  // optional grouping for hierarchical content
}

export interface SavedRecallItem {
  id: string;
  name: string;
  type: 'procedure' | 'concept';
  points: RecallPoint[];          // renamed from 'steps'
  subtopics?: string[];           // ordered unique subtopic names (derived from points)
  createdAt: number;
  lastQuizzedAt?: number;
  bestScore?: number;
  quizCount?: number;
}

export interface RecallQuizResult {
  score: number;
  correct: string[];
  missed: string[];
  errors: string[];
  mnemonic: string;
}
```

### Migration

- Keep `PluginData.savedProcedures` field name for storage compatibility
- On load: map existing items — rename `steps` → `points`, add `type: 'procedure'` if missing
- Old `ProcedureStep` and `SavedProcedure` types become aliases for backward compat
- Old `ProcedureQuizResult` → `RecallQuizResult` (alias kept)

### Storage

Same as current: Zustand → IndexedDB (local) → Firebase Firestore (cloud, gzip compressed).

---

## 2. Import System

### Existing parsers (kept)

1. **JSON array:** `[{ name, steps/points: string[] }]`
2. **Markdown table:** pipe-delimited rows
3. **Plain text numbered/bullet list:** `1. step` or `• point`

### New: Hierarchical detection

Detect indentation or heading patterns to extract subtopics:

```
Cell Division                    ← topic name
  Mitosis                        ← subtopic
    Chromatin condenses          ← point under "Mitosis"
    Nuclear envelope breaks down
  Meiosis                        ← subtopic
    Produces 4 haploid cells
    Crossing over occurs
```

Or markdown heading style:
```
# Cell Division
## Mitosis
- Chromatin condenses
- Nuclear envelope breaks down
## Meiosis
- Produces 4 haploid cells
```

**Parser logic:** Lines with `#` or `##` headers, or 2+ space indentation, trigger hierarchical parsing. Each heading/indented group becomes a subtopic. Points under each subtopic get `subtopic: "Mitosis"` etc.

### Auto-type detection

- **Procedure:** Numbered list (`1. 2. 3.`) with clear sequential ordering
- **Concept:** Has subtopics, or unordered bullet list, or heading structure
- User can override type after import via a toggle in the edit view

### New: AI Generation

"Create from AI" button in the library view:
1. User types a topic name (e.g., "Mitosis")
2. AI generates 8-15 key points organized by subtopic
3. System prompt asks for JSON: `{ name, type, subtopics, points: [{ text, subtopic }] }`
4. Result is parsed and added to the library for review/editing before first quiz

---

## 3. Quiz Flow

### Library view changes

- **Type badge** next to each item: "PROCEDURE" (green `#22c55e`) or "CONCEPT" (blue `#3b82f6`)
- **Subtopic scope picker:** For concept items with subtopics, clicking "Quiz" shows:
  - "Quiz All" button — tests on everything
  - Individual subtopic buttons — tests just that section
- **Type toggle** on create/edit modal (procedure vs concept)
- Existing status badges (needs review, overdue, not started) remain unchanged

### Quiz view

Same textarea for free recall. Header adapts:
- **Procedure:** "Write out the steps for: [name]"
- **Concept (full):** "Write everything you remember about: [name]"
- **Concept (subtopic):** "Write everything you remember about [subtopic] in [name]"

Point count shown: "12 key points to recall" (or "5 points in this subtopic")

### Grading — adaptive AI prompts

**Procedure (unchanged):**
```
Score: step accuracy 70%, sequencing 20%, completeness 10%
```

**Concept:**
```
Score: coverage 60% (key points recalled), accuracy 25% (no false claims), depth 15% (explained well, not just name-dropped)
```

Both return the same JSON shape: `{ score, correct, missed, errors, mnemonic }`

### Result view

Same score circle and feedback sections. Labels adapt:

| Section | Procedure label | Concept label |
|---------|----------------|---------------|
| Green | "Steps You Got Right" | "Key Points You Recalled" |
| Red | "Steps You Missed" | "Key Points You Missed" |
| Orange | "Not In This Procedure" | "Inaccurate Claims" |
| Gold | "Memory Tip" | "Memory Framework" |

---

## 4. Tool Identity

| Property | Before | After |
|----------|--------|-------|
| ID | `procedure-quiz` | `recall-quiz` |
| Name | "Procedure Quiz" | "Recall Quiz" |
| Description | "Quiz yourself on step-by-step procedures with AI scoring" | "Quiz yourself on procedures, concepts & topics with AI scoring" |
| Icon | `ClipboardList` | `ClipboardList` (keep) |
| Color | `#22c55e` | `#22c55e` (keep) |

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `RecallPoint`, `SavedRecallItem`, `RecallQuizResult`. Keep old types as aliases. |
| `src/components/aitools/ProcedureQuizTool.tsx` | Rename to `RecallQuizTool.tsx`. Add type field, subtopic scope picker, adaptive grading prompts, AI generation, hierarchical import parser. Migration shim for `steps` → `points`. |
| `src/pages/UnifiedLearnPage.tsx` | Update tool registration: new ID, name, description, import path. |
| `src/store.tsx` | No change (data stored in `pluginData.savedProcedures` — field name stays for compat). |

---

## 6. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Existing procedures with no `type` | Auto-assigned `type: 'procedure'` on load |
| Existing `steps` field (no `points`) | Mapped to `points` on load, transparent |
| Import with mixed ordered/unordered | Auto-detect, user can override |
| Concept with 0 subtopics | Works as flat list, no scope picker shown |
| AI generation fails | Show error, user can retry or import manually |
| Quiz on empty subtopic | Prevented — subtopic buttons only shown if ≥1 point |

---

## 7. Verification

1. `npm run build` — zero TS errors
2. Import a numbered procedure → verify type auto-detected as "procedure"
3. Import a hierarchical outline → verify type "concept" with subtopics
4. Quiz a procedure → verify 70/20/10 grading
5. Quiz a concept (full) → verify 60/25/15 grading
6. Quiz a concept (subtopic scoped) → verify only that subtopic's points are graded
7. Use "Create from AI" → verify generated points are editable
8. Load existing data → verify backward compat (old procedures appear with type badge)
9. Deploy and clear PWA cache
