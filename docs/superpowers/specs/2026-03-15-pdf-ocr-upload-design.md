# PDF OCR Upload Feature — Design Spec
**Date:** 2026-03-15
**Status:** Approved for implementation

---

## Problem

Large PDFs (e.g. Nakama 1 Japanese textbook, 30+ page physics textbooks) crash the app or fail silently because:
- `pdfjs-dist` loads all pages into memory at once → memory spike → crash
- Text extraction is truncated to 8,000 chars before AI calls → 95%+ of content lost
- No handling for image-based or mixed content (equations, diagrams, furigana)
- Firebase Firestore 1MB document limit makes storing large extracted text infeasible

---

## Goal

1. User uploads a PDF (up to 50MB, 30+ pages, mixed text/image/equation content)
2. PDF is sent through OpenRouter's Mistral OCR engine → structured markdown output (text + LaTeX equations + image descriptions)
3. A second AI call parses the markdown into quiz flashcards (MCQ + vocab)
4. Cards are displayed and saved in the existing flashcard/quiz UI
5. The existing crash bug in `fileExtract.ts` is fixed (lazy page loading)

---

## Chosen Approach: OpenRouter Mistral OCR (client-side)

**Why:** Matches existing stack (VITE_OPENROUTER_API_KEY already client-side), handles mixed content (text + equations + Japanese), no backend changes needed.

**Cost:** ~$2/1000 pages via OpenRouter (30-page PDF ≈ $0.06/upload)

**Two-call pipeline:**
1. `mistral-ocr-latest` via OpenRouter → markdown with LaTeX
2. `mistral/mistral-small-3.2` → quiz card JSON

**Quiz card format:**
```ts
type PdfCard = {
  question: string;
  answer: string;
  type: "mcq" | "vocab";
  choices?: string[];
}
```

---

## Architecture

### New Files
| File | Purpose |
|---|---|
| `src/utils/pdfOcrService.ts` | OpenRouter OCR call + card generation call; base64 encoding; JSON parse with fallback |
| `src/components/aitools/PdfUploaderTool.tsx` | Drag-drop UI, multi-stage progress, card preview, save to store |

### Modified Files
| File | Change |
|---|---|
| `src/utils/fileExtract.ts` | Fix crash: switch from all-pages load to lazy `getPage()` per page |
| `src/pages/CoursePage.tsx` | Add entry point to PdfUploaderTool in existing AI tools panel |
| `src/utils/ai.ts` | Add OpenRouter file content type support (base64 PDF message format) |
| `src/types.ts` | Add `PdfCard` type |

---

## Key Issues & Mitigations

| Issue | Mitigation |
|---|---|
| Base64 memory blow-up for large PDFs | Warn at 30MB, hard block at 50MB; convert ArrayBuffer → base64 in chunks |
| OpenRouter CORS | OpenRouter explicitly supports browser CORS — no proxy needed |
| JSON parse failure from AI response | `try/catch` + regex fallback to extract JSON from markdown fences |
| LaTeX rendering | Pipe OCR markdown through existing KaTeX renderer already in app |
| Long wait UX | Multi-stage progress indicator: `Uploading → OCR Processing → Generating Cards → Done` |
| Crash on large PDFs (current bug) | Fix `fileExtract.ts`: lazy `getPage()` instead of loading all pages at once |
| API key exposure | Already the app's pattern (all AI keys are VITE_ client-side); out of scope to change |

---

## API Call Shapes

### Call 1 — OCR
```json
POST https://openrouter.ai/api/v1/chat/completions
{
  "model": "mistral-ocr-latest",
  "messages": [{
    "role": "user",
    "content": [
      { "type": "text", "text": "Extract all content from this PDF. Preserve equations in LaTeX. Describe diagrams." },
      { "type": "file", "file": { "filename": "upload.pdf", "data": "<base64>" } }
    ]
  }]
}
```

### Call 2 — Card Generation
```json
POST https://openrouter.ai/api/v1/chat/completions
{
  "model": "mistral/mistral-small-3.2",
  "messages": [{
    "role": "user",
    "content": "From this content, generate quiz flashcards as JSON array: [{question, answer, type, choices?}]...\n\n<OCR_MARKDOWN>"
  }]
}
```

---

## UI Flow

1. User opens AI Tools panel in CoursePage → clicks "PDF OCR Upload"
2. Modal opens with drag-drop zone (or file picker), file size warning at 30MB
3. User selects PDF → progress bar shows: `Reading file → OCR → Generating cards → Done`
4. Cards preview shown (question/answer pairs with type badges)
5. "Save to Flashcards" button → saves to existing `srData.cards` via store
6. Dark theme throughout, consistent with existing tools

---

## Out of Scope
- Server-side proxy / API key security hardening
- Storing the raw PDF binary for re-viewing later
- Streaming OCR results incrementally
- Per-page progress (single batch upload)
