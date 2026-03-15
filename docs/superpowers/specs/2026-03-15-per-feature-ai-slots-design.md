# Per-Feature AI Slots Design

**Date:** 2026-03-15
**Status:** Approved

## Overview

Replace the single-global-AI-config model with 6 named feature slots (chat, generation, analysis, ocr, japanese, physics) plus a default. Each slot independently stores provider + API key + model. Unset slots fall back to default. Also switches PDF OCR from OpenRouter file-parser to Mistral Direct API.

---

## Data Model

### Slot keys (localStorage)

```
nousai-ai-slot-{slot}-provider   → AIProvider | ''
nousai-ai-slot-{slot}-apikey     → string
nousai-ai-slot-{slot}-model      → string
```

Slots: `chat` · `generation` · `analysis` · `ocr` · `japanese` · `physics`

Default slot uses existing keys unchanged:
- `nousai-ai-provider`
- `nousai-ai-apikey`
- `nousai-ai-model`

### New provider type

`'mistral'` is added to `AIProvider`. Routes to `https://api.mistral.ai/v1` (OpenAI-compatible chat endpoint). For the `ocr` slot specifically, `pdfOcrService` bypasses `callAI()` and calls `https://api.mistral.ai/v1/ocr` directly.

### Slot type

```typescript
export type AIFeatureSlot = 'chat' | 'generation' | 'analysis' | 'ocr' | 'japanese' | 'physics'
```

---

## `src/utils/ai.ts` Changes

### `callAI()` signature

```typescript
export async function callAI(
  messages: AIMessage[],
  options: AIOptions = {},
  slot?: AIFeatureSlot,
): Promise<string>
```

`slot` is optional. When provided, `getConfigForSlot(slot)` is used. If that slot has no provider configured (`''`), it falls back to `getConfig()` (default).

### New function

```typescript
function getConfigForSlot(slot: AIFeatureSlot): AIConfig {
  const provider = localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || ''
  // Treat '' or 'none' as "unset" — fall back to default
  if (!provider || provider === 'none') return getConfig()
  const def = getConfig()
  const model = localStorage.getItem(`nousai-ai-slot-${slot}-model`) || ''
  return {
    ...def, // inherit temperature, maxTokens, systemPrompt, streaming
    provider: provider as AIProvider,
    apiKey: localStorage.getItem(`nousai-ai-slot-${slot}-apikey`) || '',
    model,
    // 'custom' provider reads customModel first; mirror that behaviour here
    customModel: provider === 'custom' ? model : '',
    baseUrl: provider === 'mistral' ? 'https://api.mistral.ai/v1' : def.baseUrl,
  }
}
```

### `isSlotConfigured(slot)` helper

```typescript
export function isSlotConfigured(slot: AIFeatureSlot): boolean {
  const provider = localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || ''
  return provider !== '' && provider !== 'none'
}
```

### Mistral provider routing

Added to the switch in `callAI()`:

```typescript
case 'mistral':
  result = await callOpenAICompatible(
    'https://api.mistral.ai/v1',
    cfg.apiKey,          // second arg is _apiKey (unused internally — headers take precedence)
    cfg.model || 'mistral-small-latest',
    allMessages, temp, maxTokens, options,
    { Authorization: `Bearer ${cfg.apiKey}` },
  )
  break
```

Note: `callOpenAICompatible`'s second parameter is `_apiKey` (prefixed underscore — intentionally unused). Auth is passed via the `headers` object. All providers follow this same pattern.

---

## `src/utils/pdfOcrService.ts` → `src/utils/mistralOcrService.ts`

### Rename + expand scope

Old file: `pdfOcrService.ts` — OpenRouter file-parser, PDF only
New file: `mistralOcrService.ts` — Mistral Direct, handles **both PDFs and images**

All three OCR surfaces now use this service:
1. **PdfUploaderTool** — PDF → Mistral OCR → flashcards (was pdfOcrService)
2. **PhysicsAiImport** — PDF or image → Mistral OCR → physics question extraction (was pdfjs canvas → vision callAI)
3. **OcrTool** (Course OCR Scans tab) — image → Mistral OCR → extracted text (was Tesseract.js local)

### Switch from OpenRouter to Mistral Direct

Old: OpenRouter `/api/v1/chat/completions` with `file-parser` plugin + `mistral-ocr` engine
New: Mistral `https://api.mistral.ai/v1/ocr` endpoint directly, supports both PDF and image inputs

### Key resolution

Mistral OCR requires a **Mistral API key** — no other provider's key works here. The fallback chain only checks Mistral-keyed sources:

```typescript
function getMistralKey(): string {
  // 1. Slot-specific OCR config (must be Mistral provider)
  const slotProvider = localStorage.getItem('nousai-ai-slot-ocr-provider') || ''
  const slotKey = localStorage.getItem('nousai-ai-slot-ocr-apikey') || ''
  if (slotProvider === 'mistral' && slotKey) return slotKey

  // 2. Global default if set to Mistral
  const provider = localStorage.getItem('nousai-ai-provider')
  if (provider === 'mistral') {
    const key = localStorage.getItem('nousai-ai-apikey') || ''
    if (key) return key
  }

  // 3. Build-time env variable (VITE_MISTRAL_API_KEY in .env)
  const envKey = (import.meta.env.VITE_MISTRAL_API_KEY as string | undefined) || ''
  if (envKey) return envKey

  throw new Error(
    'Mistral API key not found. Set VITE_MISTRAL_API_KEY in your .env file, ' +
    'or go to Settings → AI Providers → PDF OCR and select Mistral.',
  )
}
```

### OCR call (Mistral Direct)

Mistral OCR supports both PDFs and images via the same endpoint:

```typescript
// PDF input
POST https://api.mistral.ai/v1/ocr
{ "model": "mistral-ocr-latest", "document": { "type": "document_url", "document_url": "data:application/pdf;base64,..." }, "include_image_base64": false }

// Image input
POST https://api.mistral.ai/v1/ocr
{ "model": "mistral-ocr-latest", "document": { "type": "image_url", "image_url": "data:image/png;base64,..." }, "include_image_base64": false }
```

### Exported API of `mistralOcrService.ts`

```typescript
// Run OCR on a PDF or image file — returns concatenated markdown
export async function runMistralOcr(file: File, onProgress?: (stage: OcrStage, msg: string) => void): Promise<string>

// Full pipeline: OCR + card generation (used by PdfUploaderTool)
export async function processPdfToCards(file: File, onProgress: (p: OcrProgress) => void): Promise<PdfOcrResult>
```

Response: `{ pages: [{ markdown: string, index: number }] }` — concatenate all `page.markdown` into a single markdown string.

- `PdfUploaderTool` calls `processPdfToCards()` (full pipeline, unchanged API)
- `PhysicsAiImport` calls `runMistralOcr()` — replaces pdfjs canvas approach entirely
- `OcrTool` calls `runMistralOcr()` — replaces Tesseract.js entirely

---

## Caller Updates (`callAI` slot argument)

Every `callAI(...)` call gets a third argument added:

| Slot | Files updated |
|---|---|
| `'chat'` | TutorTool, AIChatTool, NousPanel, TutorsMode, TutorTab, FeynmanMode, ConnectMode, QuizAIChat, StudyAnnotationSidecar, SolverMode, Quizzes (quiz chat), ToolsPage (math solver) |
| `'generation'` | FlashcardGenTool, QuizGenTool, PracticeGenTool, CourseGenTool, StudyScheduleTool, PrerequisiteTool, LecturesTab, AiImportPanel (JP) |
| `'analysis'` | FactCheckTool, ReExplainTool, TLDRMode, FormulaMode, GraphSolverMode, MnemonicsMode, PathTab, VisualLabTab, RichTextEditor, LibraryPage, LearnPage, StudyModesPage, CalendarPage |
| `'ocr'` | PdfUploaderTool (via pdfOcrService → Mistral Direct), **PhysicsAiImport** (PDF→canvas→image_url→callAI), **physicsGradingQueue** (image grading), **PhysicsSession** (image grading pipeline) |
| `'japanese'` | JpStudyTool, QuizChat (JP), QuizSession (JP), QuestionEditor (JP) |
| `'physics'` | PhysicsLabViewer (sim code gen), SimHelpPanel |

Notes:
- `GapFindMode` delegates to a parent component — no direct `callAI` call; no change needed.
- `Quizzes.tsx` and `ToolsPage.tsx` confirmed to call `callAI` — assigned to `'chat'` (interactive/conversational use).
- `LearnPage.tsx` (2 calls) assigned to `'analysis'` (study-mode orchestration context).
- **`ocr` slot covers all image/document extraction**: Mistral OCR for PDFs, vision-model calls that read document images or graded physics work. Conversational image use (user pasting a photo into chat/tutor) stays in `chat` — that is vision-augmented conversation, not OCR.
- `TutorsMode`, `TutorTab`, `SolverMode` send images as part of chat — stay in `chat` slot.
- `QuizChat` / `QuizSession` (JP) send images in Japanese quiz context — stay in `japanese` slot.

`pdfOcrService` bypasses `callAI()` — uses Mistral Direct OCR API directly. Card generation call inside pdfOcrService uses `getConfigForSlot('ocr')`.

---

## Settings UI (`src/pages/SettingsPage.tsx`)

### Structure

The existing "AI Configuration" section gains a new subsection "Feature Overrides" below the Default config block.

```
┌─ Default ───────────────────────────────────────────────────────┐
│  (unchanged — provider, key, model, temperature, etc.)          │
└─────────────────────────────────────────────────────────────────┘

┌─ Feature Overrides ─────────────────────────────────────────────┐
│  Six collapsible tiles arranged in a 2-column or 3-column grid: │
│  [Chat & Tutor]  [Generation]  [Analysis]                       │
│  [PDF OCR]       [Japanese]    [Physics]                        │
│                                                                 │
│  Each tile when expanded:                                       │
│    Provider [select]  API Key [input]  Model [input]            │
│    "Using Default" badge when provider is empty                 │
│    [Clear override] link                                        │
│    [Test] button (same test logic as Default)                   │
│                                                                 │
│  PDF OCR tile extra:                                            │
│    When Mistral selected: model locked to "mistral-ocr-latest"  │
│    Note: "Uses Mistral's dedicated OCR endpoint"                │
└─────────────────────────────────────────────────────────────────┘
```

### Provider options in slot tiles

`'mistral'` is added to the provider dropdown in both the Default section and Feature Override tiles. The Default section's `PROVIDER_INFO` map gains a `mistral` entry with label "Mistral", key prefix `''` (Mistral keys have no standard prefix), and sign-up URL `https://console.mistral.ai/api-keys`.

### localStorage writes on save

```typescript
localStorage.setItem(`nousai-ai-slot-${slot}-provider`, value)
localStorage.setItem(`nousai-ai-slot-${slot}-apikey`, value)
localStorage.setItem(`nousai-ai-slot-${slot}-model`, value)
// Clear override (revert to Default): localStorage.removeItem(...) for all 3 keys
```

---

## Cache Invalidation

The existing in-memory response cache in `callAI` keys on `JSON.stringify(allMessages)`. After this change, the same messages sent under different slots (different provider/model) could collide. The cache key must include the resolved model and provider:

```typescript
const cacheKey = !options.onChunk
  ? JSON.stringify({ messages: allMessages, provider: cfg.provider, model: cfg.model })
  : null
```

---

## Error Handling

- If a slot's key is wrong/missing, the error message references the slot by label: *"Chat & Tutor AI not configured — check Settings → AI Providers → Chat & Tutor."*
- PDF OCR: if Mistral key missing, error points to PDF OCR slot and `VITE_MISTRAL_API_KEY` env option.
- Fallback chain: slot config → default config → throw "AI not configured".

---

## Files Changed

| File | Change |
|---|---|
| `src/utils/ai.ts` | Add `AIFeatureSlot` type, `getConfigForSlot()`, `isSlotConfigured()`, `'mistral'` provider case, `callAI()` slot param |
| `src/utils/mistralOcrService.ts` | New file: replaces `pdfOcrService.ts`. Handles PDF + image OCR via Mistral Direct. Exports `runMistralOcr()` and `processPdfToCards()`. |
| `src/utils/pdfOcrService.ts` | Deleted — replaced by `mistralOcrService.ts` |
| `src/components/aitools/OcrTool.tsx` | Replace Tesseract.js with `runMistralOcr()` |
| `src/components/physquiz/PhysicsAiImport.tsx` | Replace pdfjs canvas pipeline with `runMistralOcr()`. Slot: `ocr`. |
| `src/pages/SettingsPage.tsx` | Add Feature Overrides section with 6 collapsible slot tiles |
| 42 `callAI()` caller files | Add `slot` argument to each `callAI()` call |

---

## Out of Scope

- Per-call model selection (not per-feature)
- Temperature/maxTokens per slot (inherits from Default)
- Streaming toggle per slot (inherits from Default)
- Mistral image extraction from PDFs (separate future feature)
