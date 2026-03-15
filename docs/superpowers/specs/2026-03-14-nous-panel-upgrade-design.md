# Nous AI Panel Upgrade — Design Spec
**Date:** 2026-03-14
**Status:** Approved

## Overview

Upgrade the existing `NousPanel` AI assistant from a fixed right-side drawer into a fully capable, context-aware floating assistant with file import and per-page intelligence.

## Goals

1. Panel can detach into a draggable floating window
2. Users can attach any file type (images, PDFs, text, code) to messages
3. The AI automatically knows what the user is viewing and answers accordingly
4. Context depth is user-configurable via a settings drawer inside the panel

---

## Section 1 — Floating Panel

### Behavior
- A **detach button** (↗ icon) in the panel header switches it to floating mode
- In floating mode the panel is `position: fixed` with `transform: translate(x, y)` driven by pointer drag on the header drag handle
- A **dock button** (⬛ icon) snaps it back to the right edge
- Position persists in `localStorage` key `nous_panel_pos` as `{x, y}`
- The collapsed "✦ Nous" tab remains on the right edge always as the launch point
- `isFloating` state also persists in `localStorage` key `nous_panel_floating`

### Implementation scope
- All changes confined to `src/components/NousPanel.tsx`
- New CSS classes: `.nous-panel--floating`, `.nous-panel-drag-handle`
- New state: `isFloating: boolean`, `pos: {x: number, y: number}`
- Drag via `pointerdown` / `pointermove` / `pointerup` on the header

---

## Section 2 — File Import

### UI
- **Paperclip button** (📎) left of the textarea in the input bar
- **Ctrl+V paste** of images directly into the chat input
- **Drag & drop** a file onto the floating panel to attach
- Attached files show as **chips** above the textarea (icon + filename + ×)
- Multiple files per message supported

### File handling
| Type | How it's processed |
|------|--------------------|
| Images (jpg, png, gif, webp) | Compressed via existing `imageCompress` util → base64 → sent as vision content |
| PDFs | Text extracted client-side (pdfjs-dist) → injected as quoted block in message |
| Text / Markdown / Code | Read as UTF-8 text → injected as fenced code block with language tag |

### Limits
- Max **4 files** per message (configurable in settings)
- Max **10MB** per file (images auto-compressed)
- Reuses existing `src/utils/imageCompress.ts` for image compression

### AttachedFile type
Defined in `src/types.ts`:
```ts
interface AttachedFile {
  name: string
  type: 'image' | 'pdf' | 'text'
  content: string        // base64 for images, extracted text for pdf/text
  mimeType: string
  sizeBytes: number
}
```

### New files / changes
- `src/components/NousPanel.tsx` — attach state, chip UI, paste/drop handlers
- `src/utils/fileExtract.ts` — new utility: `extractFileContent(file: File): Promise<AttachedFile>`

---

## Section 3 — Page Context System

### Store field
Add to Zustand store (`src/store.tsx`):

```ts
interface PageContext {
  page: string          // Display name, e.g. "Flashcards"
  summary: string       // One-line summary, e.g. "Reviewing: Cell Biology — 12 cards due"
  activeItem?: string   // Content of the focused item (card, note, question)
  fullContent?: string  // Broader page content (all cards in deck, all note titles, etc.)
}

activePageContext: PageContext | null
setPageContext: (ctx: PageContext | null) => void
```

### Pages that publish context

Each page calls `setPageContext()` on mount and when their primary content changes. They call `setPageContext(null)` on unmount.

| Page | `summary` | `activeItem` (Smart) | `fullContent` (Deep) |
|------|-----------|----------------------|----------------------|
| Flashcards | "X cards due in [deck]" | Current card front + back | All due cards |
| Notes/Library | "Viewing: [note title]" | Full note text | All note titles |
| Study | "Studying: [topic]" | Current section text | Full study material |
| Quiz | "Quiz: [topic], Q[n]" | Current question + options | Recent quiz history |
| Course | "[Course] — [tab]" | Active lecture/vocab item | Lecture notes + vocab list |
| Dashboard | "X XP · Y-day streak · Z cards due" | — | Full analytics summary |

### Context depth setting
Stored in `localStorage` key `nous_context_depth`. Values: `minimal` | `smart` | `deep`.

`buildSystemPrompt()` in `NousPanel.tsx` maps depth to which `PageContext` fields are included:
- **Minimal** → only `page` name (current behavior)
- **Smart** → `page` + `summary` + `activeItem`
- **Deep** → all fields including `fullContent`

---

## Section 4 — Settings Drawer

### UI
- Gear icon ⚙ in the panel header (between trash and close)
- Clicking toggles a compact settings section at the top of the messages area
- No navigation away from the panel

### Settings

| Setting | Key | Options | Default |
|---------|-----|---------|---------|
| Context depth | `nous_context_depth` | Minimal / Smart / Deep | Smart |
| Max attachments | `nous_max_attachments` | 2 / 4 / 8 | 4 |
| Float on open | `nous_float_on_open` | on / off | off |
| Clear on navigate | `nous_clear_on_navigate` | on / off | off — when on, chat messages are cleared whenever `location.pathname` changes |

### Implementation scope
- `NousPanelSettings` sub-component inside `NousPanel.tsx`
- No new files needed

---

## Architecture Summary

```
NousPanel.tsx
├── isFloating + pos state → drag handle → CSS transform
├── NousPanelSettings (inline) → localStorage prefs
├── File attachments state → chip UI + fileExtract util
└── getContext() → reads activePageContext from store + applies depth setting

store.tsx
└── activePageContext + setPageContext()

src/utils/fileExtract.ts (new)
└── extractFileContent(file) → { type, content, name }

Pages (each updated):
└── useEffect → setPageContext({...}) on mount/change, null on unmount
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/NousPanel.tsx` | Floating drag, file attachments, settings drawer, context depth |
| `src/store.tsx` | Add `activePageContext` + `setPageContext` |
| `src/utils/fileExtract.ts` | **New** — file text extraction utility |
| `src/index.css` | New CSS classes for floating panel, chips, settings drawer |
| `src/pages/FlashcardsPage.tsx` | Publish page context |
| `src/pages/StudyPage.tsx` | Publish page context |
| `src/pages/Dashboard.tsx` | Publish page context |
| `src/pages/QuizPage.tsx` | Publish page context |
| `src/pages/LibraryPage.tsx` | Publish page context |
| `src/components/course/LecturesTab.tsx` | Publish page context (active lecture) |
| `src/components/course/VocabTab.tsx` | Publish page context (active vocab item) |
| `src/components/course/VisualLabTab.tsx` | Publish page context (active sim/lab) |

---

## Non-goals (out of scope)
- Voice input (separate feature)
- Chat history persistence across sessions
- Multi-window / popout to separate browser tab
- Server-side file processing
