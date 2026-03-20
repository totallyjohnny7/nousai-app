# File Viewer with On-Demand OCR + AI Chat

**Date:** 2026-03-15
**Status:** Approved
**Feature area:** Links & Files → File Viewer

---

## Context

Users upload large files (e.g., a 27.7 MB scanned Japanese textbook PDF) to the Links & Files section of a course. Currently:
- Clicking a file either opens a small preview modal or triggers a download
- The Nous AI chat can only process the first 8,000 characters of a PDF (hard truncation in `NousPanel.tsx:263-264`)
- Scanned/image-based PDFs return no text at all via pdf.js extraction
- The "OCR Scans" tab is a placeholder stub

**Goal:** Deliver a "100/100" Links & Files experience — view any file inline AND ask the AI questions about its full content.

---

## Architecture

### New Component: `FileViewerModal.tsx`

Located at: `src/components/FileViewerModal.tsx`

Full-screen overlay that activates when clicking any `type: 'file'` item in Links & Files. Replaces the current simple preview/download behavior.

**Data flow:**
```
User clicks file in Links & Files
  → FileViewerModal opens (full-screen)
  → Left panel (70%): renders file via native browser iframe/embed using blob URL
  → Right panel (30%): FileViewerChat (scoped chat component)

User sends first message
  → Check IndexedDB for cached OCR text: key = nousai-course-{courseId}-links-ocr-{linkId}
  → Cache miss: run mistralOcrService.ts OCR pipeline → show progress bar → cache result
  → Cache hit: use immediately
  → Build system prompt: "You are analyzing [filename]. Full document content:\n{ocrText}"
  → Stream AI response via existing callAI() with slot: 'ocr'
```

### Reused Infrastructure (no changes)

| Module | Usage |
|--------|-------|
| `src/utils/mistralOcrService.ts` | Full OCR pipeline (PDF + image support) |
| `src/utils/fileStore.ts` | IndexedDB read/write for OCR cache |
| `src/utils/ai.ts` `callAI()` | AI streaming with provider routing |
| `src/pages/CoursePage.tsx` | Only the file click handler changes |

---

## UI Layout

**Split ratio:** 70% PDF viewer / 30% AI chat panel

```
┌─────────────────────────────────────────────────────────────────────┐
│  [← Back]  NAKAMA~1.PDF  •  27.7 MB  •  PDF                [✕ Close]│
├────────────────────────────────────┬────────────────────────────────┤
│                                    │  Ask about this file            │
│                                    │                                 │
│     Native PDF Viewer              │  ┌──────────────────────────┐  │
│     (<iframe src="blob:...">)      │  │ AI response streams here  │  │
│                                    │  │                           │  │
│  Full resolution, scrollable       │  └──────────────────────────┘  │
│  Browser handles zoom/pan          │                                 │
│  Works for any file size           │  [Scanning... ████░░ 60%]      │
│                                    │  (shown during OCR only)        │
│  Image files: <img> tag            │                                 │
│  Text files: <pre> tag             │  ┌──────────────────────────┐  │
│                                    │  │ Ask anything...        ▶  │  │
│                                    │  └──────────────────────────┘  │
└────────────────────────────────────┴────────────────────────────────┘
```

**UI details:**
- Modal is full-screen, z-index over all course content
- Divider between panels is draggable (CSS resize or manual drag handler)
- OCR progress bar visible only during first scan; hides once complete
- Send button disabled and shows "Scanning…" while OCR is running
- Chat history is session-only (resets on modal close, not persisted to DB)
- "Back" button closes modal, returns to Links & Files list

---

## File Type Rendering

| File type | Left panel renderer |
|-----------|---------------------|
| PDF | `<iframe src={blobUrl} />` — native browser PDF viewer |
| Image (PNG, JPG, WEBP) | `<img src={dataUrl} />` |
| Text / code | `<pre>{fileContent}</pre>` with syntax hint |
| Other (zip, docx, etc.) | "Preview not available — [Download]" button |

---

## OCR Integration

### Cache key
```
nousai-course-{courseId}-links-ocr-{linkId}
```
Stored via `fileStore.saveFile()` in IndexedDB. Read via `fileStore.loadFile()`.

### OCR trigger
On first AI message send (not on modal open). This avoids unnecessary API calls if user only wants to view.

### System prompt construction
```
You are an AI assistant analyzing the file "{filename}".
The full extracted text follows. Answer the user's questions based only on this content.

---
{ocrText}  ← truncated to 80,000 chars if longer
---
```
If truncated: append `\n[Note: document was truncated to the first ~80,000 characters due to length.]`

### API slot
Uses `slot: 'ocr'` for provider routing (same as PDF Uploader tool), so users with an OCR-specific API key configured will use it.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No Mistral API key | Inline warning in chat panel: "Set up your OCR key in Settings → AI Slots → OCR to enable full-document AI" |
| OCR timeout (>3 min) | Error message with Retry button; fallback to pdf.js text extraction |
| Corrupted file in IndexedDB | "File unavailable — try re-uploading" with delete button |
| Network failure during OCR | "Could not reach OCR service. Check your connection and try again." with Retry |
| `type: 'link'` (not a file) | Opens in new tab as before — modal only activates for `type: 'file'` items |
| OCR text > 80K chars | Truncate with note to AI (see system prompt section) |

---

## Files to Modify / Create

| Action | File |
|--------|------|
| **Create** | `src/components/FileViewerModal.tsx` |
| **Modify** | `src/pages/CoursePage.tsx` — change file click handler to open FileViewerModal instead of preview/download |
| **No change** | `src/utils/mistralOcrService.ts` |
| **No change** | `src/utils/fileStore.ts` |
| **No change** | `src/utils/ai.ts` |

---

## Verification

1. Upload a large scanned PDF (e.g., NAKAMA~1.PDF) to Links & Files
2. Click it — FileViewerModal should open with PDF rendering on left, chat on right
3. Send a message — OCR progress bar should appear, then AI should answer from full document content
4. Close and re-open — second message should be instant (cached OCR text, no re-scan)
5. Click a URL-type link — should still open in new tab (not open modal)
6. Test with image file — should show `<img>` on left, OCR should use Mistral image endpoint
7. Test with no OCR API key configured — warning message should appear in chat panel
8. Deploy to Vercel, clear PWA cache, verify on production
