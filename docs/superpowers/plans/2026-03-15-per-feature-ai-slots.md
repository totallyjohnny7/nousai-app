# Per-Feature AI Slots Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-global-AI-config with 6 per-feature slots (chat, generation, analysis, ocr, japanese, physics) + default fallback, and switch all document/image OCR surfaces to Mistral Direct API.

**Architecture:** Add `AIFeatureSlot` type and `getConfigForSlot()` to `ai.ts` so `callAI()` accepts an optional slot. Create `mistralOcrService.ts` to replace `pdfOcrService.ts` with a unified PDF+image OCR service using Mistral Direct. Update `SettingsPage.tsx` with a Feature Overrides section. Update all 42+ `callAI()` callers to pass their slot.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, localStorage for config, Mistral API (`https://api.mistral.ai/v1/ocr`), existing `callAI()` infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-15-per-feature-ai-slots-design.md`

---

## Chunk 1: Core AI Layer (`src/utils/ai.ts`)

**Files:**
- Modify: `src/utils/ai.ts`

### Task 1: Add `AIFeatureSlot` type and `getConfigForSlot()`

- [ ] **Step 1: Add `AIFeatureSlot` type and `'mistral'` to `AIProvider`**

  In `src/utils/ai.ts`, find the line:
  ```typescript
  export type AIProvider = 'none' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'custom'
  ```
  Replace with:
  ```typescript
  export type AIProvider = 'none' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'mistral' | 'custom'
  export type AIFeatureSlot = 'chat' | 'generation' | 'analysis' | 'ocr' | 'japanese' | 'physics'
  ```

- [ ] **Step 2: Add `getConfigForSlot()` and `isSlotConfigured()` after the existing `getConfig()` function**

  ```typescript
  export function getConfigForSlot(slot: AIFeatureSlot): AIConfig {
    const provider = localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || ''
    if (!provider || provider === 'none') return getConfig()
    const def = getConfig()
    const model = localStorage.getItem(`nousai-ai-slot-${slot}-model`) || ''
    return {
      ...def,
      provider: provider as AIProvider,
      apiKey: localStorage.getItem(`nousai-ai-slot-${slot}-apikey`) || '',
      model,
      customModel: provider === 'custom' ? model : '',
      baseUrl: provider === 'mistral' ? 'https://api.mistral.ai/v1' : def.baseUrl,
    }
  }

  export function isSlotConfigured(slot: AIFeatureSlot): boolean {
    const provider = localStorage.getItem(`nousai-ai-slot-${slot}-provider`) || ''
    return provider !== '' && provider !== 'none'
  }
  ```

- [ ] **Step 3: Update `callAI()` signature to accept optional slot**

  Change:
  ```typescript
  export async function callAI(
    messages: AIMessage[],
    options: AIOptions = {},
  ): Promise<string> {
    const cfg = getConfig()
  ```
  To:
  ```typescript
  export async function callAI(
    messages: AIMessage[],
    options: AIOptions = {},
    slot?: AIFeatureSlot,
  ): Promise<string> {
    const cfg = slot ? getConfigForSlot(slot) : getConfig()
  ```

- [ ] **Step 4: Fix cache key to include provider + model (prevents cross-slot collisions)**

  Find:
  ```typescript
  const cacheKey = !options.onChunk ? JSON.stringify(allMessages) : null
  ```
  Replace with:
  ```typescript
  const cacheKey = !options.onChunk
    ? JSON.stringify({ messages: allMessages, provider: cfg.provider, model: cfg.model })
    : null
  ```

- [ ] **Step 5: Add `'mistral'` case to the provider switch in `callAI()`**

  After the `case 'groq':` block, add:
  ```typescript
  case 'mistral':
    result = await callOpenAICompatible(
      'https://api.mistral.ai/v1',
      cfg.apiKey,
      cfg.model || 'mistral-small-latest',
      allMessages, temp, maxTokens, options,
      { Authorization: `Bearer ${cfg.apiKey}` },
    )
    break
  ```

- [ ] **Step 6: Verify TypeScript build passes**

  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App && npm run build
  ```
  Expected: zero TypeScript errors. (All existing callers still work — `slot` is optional.)

- [ ] **Step 7: Commit**

  ```bash
  git add src/utils/ai.ts
  git commit -m "feat: add AIFeatureSlot, getConfigForSlot, mistral provider to ai.ts"
  ```

---

## Chunk 2: Mistral OCR Service

**Files:**
- Create: `src/utils/mistralOcrService.ts`
- Modify: `src/components/aitools/PdfUploaderTool.tsx` (update import)
- Delete: `src/utils/pdfOcrService.ts` (after migration)

### Task 2: Create `mistralOcrService.ts`

This replaces `pdfOcrService.ts`. It handles both PDFs and images via Mistral Direct OCR. Copy the structure from `pdfOcrService.ts` but:
- Replace `getOpenRouterKey()` with `getMistralKey()`
- Replace the OpenRouter fetch with a Mistral OCR fetch
- Add `runMistralOcr(file)` for standalone OCR (used by OcrTool + PhysicsAiImport)
- Keep `processPdfToCards()` for PdfUploaderTool

- [ ] **Step 1: Create `src/utils/mistralOcrService.ts`**

  ```typescript
  /**
   * mistralOcrService.ts
   * Unified OCR service using Mistral Direct API.
   * Handles both PDFs and images. Used by:
   *   - PdfUploaderTool (processPdfToCards — full OCR + card gen pipeline)
   *   - OcrTool (runMistralOcr — extract text from image)
   *   - PhysicsAiImport (runMistralOcr — extract text/equations from PDF or image)
   */
  import { getConfigForSlot } from './ai'
  import { callAI } from './ai'
  import type { PdfCard } from '../types'

  const WARN_BYTES     = 30 * 1024 * 1024
  const MAX_BYTES      = 50 * 1024 * 1024
  const OCR_TIMEOUT_MS = 180_000
  const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'

  export type OcrStage = 'reading' | 'ocr' | 'generating' | 'done'
  export interface OcrProgress { stage: OcrStage; message: string }
  export interface PdfOcrResult {
    markdown: string
    cards: PdfCard[]
    sizeWarning?: string
  }

  // ─── Key resolution ───────────────────────────────────────────────────────────

  function getMistralKey(): string {
    const slotProvider = localStorage.getItem('nousai-ai-slot-ocr-provider') || ''
    const slotKey = localStorage.getItem('nousai-ai-slot-ocr-apikey') || ''
    if (slotProvider === 'mistral' && slotKey) return slotKey

    const provider = localStorage.getItem('nousai-ai-provider')
    if (provider === 'mistral') {
      const key = localStorage.getItem('nousai-ai-apikey') || ''
      if (key) return key
    }

    const envKey = (import.meta.env.VITE_MISTRAL_API_KEY as string | undefined) || ''
    if (envKey) return envKey

    throw new Error(
      'Mistral API key not found. Set VITE_MISTRAL_API_KEY in your .env file, ' +
      'or go to Settings → AI Providers → PDF OCR and select Mistral.',
    )
  }

  // ─── File → base64 data URL ──────────────────────────────────────────────────

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        if (!result) reject(new Error('Failed to encode file'))
        else resolve(result)
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  // ─── Mistral OCR fetch ────────────────────────────────────────────────────────

  async function fetchMistralOcr(apiKey: string, dataUrl: string, mimeType: string): Promise<string> {
    const isPdf = mimeType === 'application/pdf'
    const document = isPdf
      ? { type: 'document_url', document_url: dataUrl }
      : { type: 'image_url', image_url: dataUrl }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS)

    let res: Response
    try {
      res = await fetch(MISTRAL_OCR_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'mistral-ocr-latest', document, include_image_base64: false }),
        signal: controller.signal,
      })
    } catch (e: unknown) {
      clearTimeout(timer)
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new Error('OCR request timed out. Try a smaller file or check your connection.')
      }
      throw e
    }

    if (!res.ok) {
      clearTimeout(timer)
      const err = await res.json().catch(() => null) as { message?: string } | null
      if (res.status === 401) throw new Error('Invalid Mistral API key — check Settings → AI Providers → PDF OCR.')
      if (res.status === 429) throw new Error('Mistral rate limit reached. Please wait a moment.')
      throw new Error(err?.message || `Mistral OCR failed (HTTP ${res.status})`)
    }

    let data: { pages?: Array<{ markdown: string }> }
    try {
      data = await res.json()
    } catch (e: unknown) {
      clearTimeout(timer)
      if ((e as { name?: string })?.name === 'AbortError') {
        throw new Error('OCR timed out reading response. Try a smaller file.')
      }
      throw e
    }
    clearTimeout(timer)

    return (data.pages ?? []).map(p => p.markdown).join('\n\n')
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /**
   * Run OCR on a PDF or image file.
   * Returns extracted markdown text.
   * Used by OcrTool and PhysicsAiImport.
   */
  export async function runMistralOcr(
    file: File,
    onProgress?: (stage: OcrStage, message: string) => void,
  ): Promise<string> {
    const apiKey = getMistralKey()
    onProgress?.('reading', 'Reading file…')
    const dataUrl = await fileToDataUrl(file)
    onProgress?.('ocr', 'Running Mistral OCR…')
    return fetchMistralOcr(apiKey, dataUrl, file.type)
  }

  /**
   * Full pipeline: OCR + card generation.
   * Used by PdfUploaderTool (replaces pdfOcrService.processPdf).
   */
  export async function processPdfToCards(
    file: File,
    onProgress: (p: OcrProgress) => void,
  ): Promise<PdfOcrResult> {
    if (file.size > MAX_BYTES) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 50 MB.`)
    }
    const sizeWarning = file.size > WARN_BYTES
      ? `Large file (${(file.size / 1024 / 1024).toFixed(1)} MB) — OCR may take 2–3 minutes.`
      : undefined

    const apiKey = getMistralKey()

    onProgress({ stage: 'reading', message: 'Reading PDF…' })
    const dataUrl = await fileToDataUrl(file)

    onProgress({ stage: 'ocr', message: 'Running Mistral OCR… (this can take 1–3 min for large PDFs)' })
    const markdown = await fetchMistralOcr(apiKey, dataUrl, 'application/pdf')

    onProgress({ stage: 'generating', message: 'Generating flashcards…' })
    const ocrSlotCfg = getConfigForSlot('ocr')

    const systemPrompt = `You are a flashcard generator. Given markdown text extracted from a PDF, output a JSON array of flashcard objects. Each object must have exactly these fields:
- "type": one of "vocab", "concept", "mcq", "formula"
- "question": the front of the card
- "answer": the back of the card (for mcq, this is the correct answer letter, e.g. "B")
- "options": array of 4 strings for mcq type only, omit for others
- "hint": optional short hint string

Output ONLY the JSON array, no markdown, no explanation.`

    const userPrompt = `Here is the extracted text from the PDF. Generate 15–25 high-quality flashcards:\n\n${markdown.slice(0, 60000)}`

    const raw = await callAI(
      [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      { json: true, maxTokens: 4096 },
      'ocr',
    )

    let cards: PdfCard[] = []
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''))
      cards = Array.isArray(parsed) ? parsed : []
    } catch {
      cards = []
    }

    onProgress({ stage: 'done', message: `Done — ${cards.length} cards generated.` })
    return { markdown, cards, sizeWarning }
  }
  ```

- [ ] **Step 2: Update `PdfUploaderTool.tsx` import**

  Find:
  ```typescript
  import { processPdfToCards, type OcrProgress, type OcrStage, type PdfOcrResult } from '../../utils/pdfOcrService'
  ```
  Replace with:
  ```typescript
  import { processPdfToCards, type OcrProgress, type OcrStage, type PdfOcrResult } from '../../utils/mistralOcrService'
  ```

- [ ] **Step 3: Verify build**

  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App && npm run build
  ```
  Expected: zero TypeScript errors.

- [ ] **Step 4: Delete old `pdfOcrService.ts`**

  ```bash
  rm C:\Users\johnn\Desktop\NousAI-App\src\utils\pdfOcrService.ts
  ```

- [ ] **Step 5: Verify build again (confirms no remaining imports of old file)**

  ```bash
  npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/utils/mistralOcrService.ts src/components/aitools/PdfUploaderTool.tsx
  git rm src/utils/pdfOcrService.ts
  git commit -m "feat: replace pdfOcrService with mistralOcrService (Mistral Direct, PDF+image)"
  ```

---

## Chunk 3: OCR Tool Rewrites

**Files:**
- Modify: `src/components/aitools/OcrTool.tsx`
- Modify: `src/components/physquiz/PhysicsAiImport.tsx`

### Task 3: Update `OcrTool.tsx` — replace Tesseract with Mistral

`OcrTool` currently imports `tesseract.js` dynamically and does local OCR. Replace with `runMistralOcr`.

- [ ] **Step 1: Add import at top of `OcrTool.tsx`**

  Add after existing imports:
  ```typescript
  import { runMistralOcr } from '../../utils/mistralOcrService'
  ```

- [ ] **Step 2: Replace `handleFile` function**

  Find the entire `handleFile` callback (the one that imports `tesseract.js`). Replace it with:
  ```typescript
  const handleFile = useCallback(async (file: File) => {
    const accepted = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf']
    if (!accepted.includes(file.type)) {
      setExtractedText(`Invalid file type: "${file.type || file.name}". Please upload a PNG, JPG, WEBP, or PDF.`)
      return
    }
    setProcessing(true)
    setExtractedText('')
    setProgress(0)
    setSaved(false)

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => setImageSrc(e.target?.result as string)
      reader.readAsDataURL(file)
    }

    try {
      setProgress(30)
      const text = await runMistralOcr(file, (_stage, msg) => {
        if (msg.includes('OCR')) setProgress(60)
      })
      setExtractedText(text)
      setProgress(100)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'OCR failed'
      setExtractedText(`OCR Error: ${msg}. You can paste text manually below.`)
    }
    setProcessing(false)
  }, [])
  ```

- [ ] **Step 3: Remove canvas ref (no longer needed)**

  Find and remove:
  ```typescript
  const canvasRef = useRef<HTMLCanvasElement>(null);
  ```
  Also remove any `<canvas ref={canvasRef} />` in the JSX if present.

- [ ] **Step 4: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/aitools/OcrTool.tsx
  git commit -m "feat: replace Tesseract.js OCR with Mistral Direct in OcrTool"
  ```

### Task 4: Update `PhysicsAiImport.tsx` — replace pdfjs canvas with Mistral

`PhysicsAiImport` currently renders each PDF page to a canvas, converts to base64 JPEG, then sends to `callAI` with `image_url` content. Replace with `runMistralOcr` which handles the PDF directly.

- [ ] **Step 1: Add import at top of `PhysicsAiImport.tsx`**

  ```typescript
  import { runMistralOcr } from '../../utils/mistralOcrService'
  ```

- [ ] **Step 2: Find the PDF processing block**

  Look for the section that imports `pdfjs-dist` dynamically (`await import('pdfjs-dist')`), iterates pages, renders to canvas, collects base64 images, and calls `callAI` with `image_url` content.

- [ ] **Step 3: Replace the entire PDF branch with `runMistralOcr`**

  Replace the PDF rendering + callAI vision block with:
  ```typescript
  if (file.type === 'application/pdf') {
    try {
      const markdown = await runMistralOcr(file, (_stage, msg) => {
        setStatusMsg(msg)
      })
      // Pass extracted markdown as plain text to the physics question extractor
      raw = await callAI(
        [{ role: 'system', content: SYSTEM_PROMPT },
         { role: 'user', content: `Extract physics questions from this text:\n\n${markdown.slice(0, 40000)}` }],
        { json: true, maxTokens: 4096 },
        'ocr',
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OCR failed')
      setProcessing(false)
      return
    }
  }
  ```
  Note: `SYSTEM_PROMPT` is the existing system prompt already defined in the file. `raw` is the existing variable used for JSON parsing below. Keep all post-processing (JSON parse, question list population) exactly as-is.

- [ ] **Step 4: For image input path, also switch to `runMistralOcr`**

  Find the image branch (where `file.type.startsWith('image/')` renders a canvas and sends `image_url`). Replace with:
  ```typescript
  if (file.type.startsWith('image/')) {
    try {
      const markdown = await runMistralOcr(file)
      raw = await callAI(
        [{ role: 'system', content: SYSTEM_PROMPT },
         { role: 'user', content: `Extract physics questions from this image text:\n\n${markdown.slice(0, 40000)}` }],
        { json: true, maxTokens: 4096 },
        'ocr',
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'OCR failed')
      setProcessing(false)
      return
    }
  }
  ```

- [ ] **Step 5: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add src/components/physquiz/PhysicsAiImport.tsx
  git commit -m "feat: replace pdfjs canvas pipeline with Mistral OCR in PhysicsAiImport"
  ```

---

## Chunk 4: Settings UI — Feature Overrides Section

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

### Task 5: Add Mistral to `PROVIDER_INFO` and Feature Overrides UI

`SettingsPage.tsx` is a large file (~1800+ lines). The AI Configuration section renders a provider dropdown from a `PROVIDER_INFO` map and local state. We add Mistral to that map and add a new "Feature Overrides" subsection below the existing Default config block.

- [ ] **Step 1: Add `'mistral'` to the `PROVIDER_INFO` map**

  Find the existing `PROVIDER_INFO` object (it has entries for `openai`, `anthropic`, `openrouter`, `google`, `groq`, `custom`). Add:
  ```typescript
  mistral: { label: 'Mistral', color: '#fa8334', url: 'https://console.mistral.ai/api-keys', keyPrefix: '' },
  ```

- [ ] **Step 2: Add `'mistral'` to the provider select options**

  Find where the provider `<select>` options are rendered (likely maps over `['none','openai','anthropic','openrouter','google','groq','custom']`). Add `'mistral'` to that array.

- [ ] **Step 3: Add slot state to the Settings component**

  At the top of the Settings component state section, add:
  ```typescript
  type SlotKey = 'chat' | 'generation' | 'analysis' | 'ocr' | 'japanese' | 'physics'
  const SLOT_LABELS: Record<SlotKey, string> = {
    chat: 'Chat & Tutor',
    generation: 'Generation',
    analysis: 'Analysis',
    ocr: 'PDF & Image OCR',
    japanese: 'Japanese',
    physics: 'Physics',
  }

  const [expandedSlot, setExpandedSlot] = useState<SlotKey | null>(null)
  const [slotConfigs, setSlotConfigs] = useState<Record<SlotKey, { provider: string; apiKey: string; model: string }>>(() => {
    const slots: SlotKey[] = ['chat', 'generation', 'analysis', 'ocr', 'japanese', 'physics']
    return Object.fromEntries(slots.map(s => [s, {
      provider: localStorage.getItem(`nousai-ai-slot-${s}-provider`) || '',
      apiKey: localStorage.getItem(`nousai-ai-slot-${s}-apikey`) || '',
      model: localStorage.getItem(`nousai-ai-slot-${s}-model`) || '',
    }])) as Record<SlotKey, { provider: string; apiKey: string; model: string }>
  })
  ```

- [ ] **Step 4: Add `saveSlotConfig` and `clearSlotConfig` helpers**

  ```typescript
  function saveSlotConfig(slot: SlotKey, field: 'provider' | 'apiKey' | 'model', value: string) {
    const key = field === 'apiKey' ? 'apikey' : field
    if (value) {
      localStorage.setItem(`nousai-ai-slot-${slot}-${key}`, value)
    } else {
      localStorage.removeItem(`nousai-ai-slot-${slot}-${key}`)
    }
    setSlotConfigs(prev => ({ ...prev, [slot]: { ...prev[slot], [field]: value } }))
  }

  function clearSlotConfig(slot: SlotKey) {
    localStorage.removeItem(`nousai-ai-slot-${slot}-provider`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-apikey`)
    localStorage.removeItem(`nousai-ai-slot-${slot}-model`)
    setSlotConfigs(prev => ({ ...prev, [slot]: { provider: '', apiKey: '', model: '' } }))
  }
  ```

- [ ] **Step 5: Add Feature Overrides UI below the Default AI config block**

  Find the closing of the Default AI config section (after the test button / streaming toggle). After it, insert:

  ```tsx
  {/* ── Feature Overrides ── */}
  <div style={{ marginTop: 24 }}>
    <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      Feature Overrides
    </h4>
    <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
      Each feature uses Default unless you set an override here.
    </p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
      {(Object.keys(SLOT_LABELS) as SlotKey[]).map(slot => {
        const cfg = slotConfigs[slot]
        const isConfigured = cfg.provider && cfg.provider !== 'none'
        const isExpanded = expandedSlot === slot
        return (
          <div key={slot} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <button
              onClick={() => setExpandedSlot(isExpanded ? null : slot)}
              style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-primary)', fontSize: 13 }}
            >
              <span style={{ fontWeight: 500 }}>{SLOT_LABELS[slot]}</span>
              <span style={{ fontSize: 11, color: isConfigured ? 'var(--accent)' : 'var(--text-muted)' }}>
                {isConfigured ? cfg.provider : 'Using Default'}
              </span>
            </button>
            {isExpanded && (
              <div style={{ padding: 12, background: 'var(--bg-input)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <select
                  value={cfg.provider}
                  onChange={e => saveSlotConfig(slot, 'provider', e.target.value)}
                  style={selectStyle}
                >
                  <option value="">Use Default</option>
                  {(['openai', 'anthropic', 'openrouter', 'google', 'groq', 'mistral', 'custom'] as const).map(p => (
                    <option key={p} value={p}>{PROVIDER_INFO[p]?.label ?? p}</option>
                  ))}
                </select>
                {cfg.provider && cfg.provider !== 'none' && (
                  <>
                    <input
                      type="password"
                      placeholder="API Key"
                      value={cfg.apiKey}
                      onChange={e => saveSlotConfig(slot, 'apiKey', e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      placeholder={slot === 'ocr' && cfg.provider === 'mistral' ? 'mistral-ocr-latest (locked)' : 'Model name (e.g. gpt-4o)'}
                      value={slot === 'ocr' && cfg.provider === 'mistral' ? 'mistral-ocr-latest' : cfg.model}
                      onChange={e => {
                        if (slot === 'ocr' && cfg.provider === 'mistral') return
                        saveSlotConfig(slot, 'model', e.target.value)
                      }}
                      readOnly={slot === 'ocr' && cfg.provider === 'mistral'}
                      style={{ ...inputStyle, opacity: slot === 'ocr' && cfg.provider === 'mistral' ? 0.5 : 1 }}
                    />
                    {slot === 'ocr' && cfg.provider === 'mistral' && (
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                        Uses Mistral's dedicated OCR endpoint — model is fixed.
                      </p>
                    )}
                    <button
                      onClick={() => clearSlotConfig(slot)}
                      style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      Clear override → use Default
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  </div>
  ```

  Note: `inputStyle` and `selectStyle` are defined as local `const` constants in `SettingsPage.tsx` — do NOT add any import. Use those existing local constants.

- [ ] **Step 6: Verify build**

  ```bash
  npm run build
  ```

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/SettingsPage.tsx
  git commit -m "feat: add Feature Overrides section to Settings AI config"
  ```

---

## Chunk 5: Caller Updates — `chat` + `generation` Slots

**Files (chat slot):**
- `src/components/aitools/TutorTool.tsx`
- `src/components/aitools/AIChatTool.tsx`
- `src/components/NousPanel.tsx`
- `src/components/learn/TutorsMode.tsx`
- `src/components/course/TutorTab.tsx`
- `src/components/learn/FeynmanMode.tsx`
- `src/components/learn/ConnectMode.tsx`
- `src/components/QuizAIChat.tsx`
- `src/components/StudyAnnotationSidecar.tsx`
- `src/components/learn/SolverMode.tsx`
- `src/pages/Quizzes.tsx`
- `src/pages/ToolsPage.tsx`

**Files (generation slot):**
- `src/components/aitools/FlashcardGenTool.tsx`
- `src/components/aitools/QuizGenTool.tsx`
- `src/components/aitools/PracticeGenTool.tsx`
- `src/components/aitools/CourseGenTool.tsx`
- `src/components/aitools/StudyScheduleTool.tsx`
- `src/components/aitools/PrerequisiteTool.tsx`
- `src/components/course/LecturesTab.tsx`
- `src/components/jpquiz/AiImportPanel.tsx`

### Task 6: Add `'chat'` slot to all chat callers

The pattern for each file is the same:
1. Find every `callAI(messages, options)` call
2. Add `'chat'` as the third argument: `callAI(messages, options, 'chat')`
3. If `callAI` is called with only messages: `callAI(messages, {}, 'chat')`

- [ ] **Step 1: Update all 12 chat-slot files**

  For each of these files, find all `callAI(` calls and add `'chat'` as the third arg:
  - `src/components/aitools/TutorTool.tsx`
  - `src/components/aitools/AIChatTool.tsx`
  - `src/components/NousPanel.tsx`
  - `src/components/learn/TutorsMode.tsx`
  - `src/components/course/TutorTab.tsx`
  - `src/components/learn/FeynmanMode.tsx`
  - `src/components/learn/ConnectMode.tsx`
  - `src/components/QuizAIChat.tsx`
  - `src/components/StudyAnnotationSidecar.tsx`
  - `src/components/learn/SolverMode.tsx`
  - `src/pages/Quizzes.tsx`
  - `src/pages/ToolsPage.tsx`

  Common patterns to find and replace:
  ```typescript
  // Pattern 1 — with options object
  await callAI(messages, { onChunk, ... })
  // becomes
  await callAI(messages, { onChunk, ... }, 'chat')

  // Pattern 2 — options only
  await callAI(messages, options)
  // becomes
  await callAI(messages, options, 'chat')

  // Pattern 3 — no options
  await callAI(messages)
  // becomes
  await callAI(messages, {}, 'chat')
  ```

- [ ] **Step 2: Update all 8 generation-slot files**

  Same pattern, `'generation'` as third arg:
  - `src/components/aitools/FlashcardGenTool.tsx`
  - `src/components/aitools/QuizGenTool.tsx`
  - `src/components/aitools/PracticeGenTool.tsx`
  - `src/components/aitools/CourseGenTool.tsx`
  - `src/components/aitools/StudyScheduleTool.tsx`
  - `src/components/aitools/PrerequisiteTool.tsx`
  - `src/components/course/LecturesTab.tsx`
  - `src/components/jpquiz/AiImportPanel.tsx`

- [ ] **Step 3: Verify build**

  ```bash
  npm run build
  ```
  Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/components/aitools/TutorTool.tsx src/components/aitools/AIChatTool.tsx \
    src/components/NousPanel.tsx src/components/learn/TutorsMode.tsx \
    src/components/course/TutorTab.tsx src/components/learn/FeynmanMode.tsx \
    src/components/learn/ConnectMode.tsx src/components/QuizAIChat.tsx \
    src/components/StudyAnnotationSidecar.tsx src/components/learn/SolverMode.tsx \
    src/pages/Quizzes.tsx src/pages/ToolsPage.tsx \
    src/components/aitools/FlashcardGenTool.tsx src/components/aitools/QuizGenTool.tsx \
    src/components/aitools/PracticeGenTool.tsx src/components/aitools/CourseGenTool.tsx \
    src/components/aitools/StudyScheduleTool.tsx src/components/aitools/PrerequisiteTool.tsx \
    src/components/course/LecturesTab.tsx src/components/jpquiz/AiImportPanel.tsx
  git commit -m "feat: add chat + generation slot args to callAI callers"
  ```

---

## Chunk 6: Caller Updates — `analysis` + `japanese` + `physics` Slots

**Files (analysis slot):**
- `src/components/aitools/FactCheckTool.tsx`
- `src/components/aitools/ReExplainTool.tsx`
- `src/components/learn/TLDRMode.tsx`
- `src/components/learn/FormulaMode.tsx`
- `src/components/learn/GraphSolverMode.tsx`
- `src/components/learn/MnemonicsMode.tsx`
- `src/components/course/PathTab.tsx`
- `src/components/course/VisualLabTab.tsx`
- `src/components/RichTextEditor.tsx`
- `src/pages/LibraryPage.tsx`
- `src/pages/LearnPage.tsx`
- `src/pages/StudyModesPage.tsx`
- `src/pages/CalendarPage.tsx`

**Files (japanese slot):**
- `src/components/aitools/JpStudyTool.tsx`
- `src/components/jpquiz/QuizChat.tsx`
- `src/components/jpquiz/QuizSession.tsx`
- `src/components/jpquiz/QuestionEditor.tsx`

**Files (physics slot):**
- `src/components/physquiz/PhysicsLabViewer.tsx`
- `src/components/aitools/physics/SimHelpPanel.tsx`

**Files (ocr slot — grading pipeline):**
- `src/utils/physicsGradingQueue.ts` — all `callAI()` calls use `'ocr'` (sends student diagram images)
- `src/components/physquiz/PhysicsSession.tsx` — image grading calls use `'ocr'`; hint/conversational calls use `'physics'`

### Task 7: Add `'analysis'`, `'japanese'`, `'physics'`, `'ocr'` slot args

- [ ] **Step 1: Update all 13 analysis-slot files** — add `'analysis'` as third arg to each `callAI()` call

- [ ] **Step 2: Update all 4 japanese-slot files** — add `'japanese'` as third arg

- [ ] **Step 3: Update 2 physics-slot files** — add `'physics'` as third arg
  - `src/components/physquiz/PhysicsLabViewer.tsx` — sim code generation
  - `src/components/aitools/physics/SimHelpPanel.tsx` — sim help text

- [ ] **Step 4: Update `physicsGradingQueue.ts` and `PhysicsSession.tsx`**

  `src/utils/physicsGradingQueue.ts`: all `callAI()` calls receive `'ocr'` (they send image_url content — student work grading).

  `src/components/physquiz/PhysicsSession.tsx`: read through all `callAI()` calls:
  - Calls that pass `image_url` content parts (student diagram/photo grading) → add `'ocr'`
  - Calls that are conversational hints, explanations, or chat → add `'physics'`

- [ ] **Step 4: Verify build**

  ```bash
  npm run build
  ```
  Expected: zero TypeScript errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/aitools/FactCheckTool.tsx src/components/aitools/ReExplainTool.tsx \
    src/components/learn/TLDRMode.tsx src/components/learn/FormulaMode.tsx \
    src/components/learn/GraphSolverMode.tsx src/components/learn/MnemonicsMode.tsx \
    src/components/course/PathTab.tsx src/components/course/VisualLabTab.tsx \
    src/components/RichTextEditor.tsx src/pages/LibraryPage.tsx \
    src/pages/LearnPage.tsx src/pages/StudyModesPage.tsx src/pages/CalendarPage.tsx \
    src/components/aitools/JpStudyTool.tsx src/components/jpquiz/QuizChat.tsx \
    src/components/jpquiz/QuizSession.tsx src/components/jpquiz/QuestionEditor.tsx \
    src/components/physquiz/PhysicsLabViewer.tsx src/components/aitools/physics/SimHelpPanel.tsx \
    src/utils/physicsGradingQueue.ts src/components/physquiz/PhysicsSession.tsx
  git commit -m "feat: add analysis + japanese + physics + ocr slot args to callAI callers"
  ```

---

## Chunk 7: Deploy & Verify

### Task 8: Build, deploy, and smoke-test

- [ ] **Step 1: Final build check**

  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App && npm run build
  ```
  Expected: zero errors, bundle completes.

- [ ] **Step 2: Deploy to production**

  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App && npm run build && vercel --prod --yes
  ```

- [ ] **Step 3: Clear PWA cache in browser**

  Open browser console on https://nousai-app.vercel.app and run:
  ```js
  navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
  caches.keys().then(k => k.forEach(x => caches.delete(x)));
  ```
  Then hard reload.

- [ ] **Step 4: Smoke-test Settings → AI Providers**

  - Open Settings → AI Configuration
  - Confirm `Mistral` appears in the Default provider dropdown
  - Scroll down to Feature Overrides — confirm 6 tiles appear (Chat & Tutor, Generation, Analysis, PDF & Image OCR, Japanese, Physics)
  - Expand **PDF & Image OCR**, select Mistral, enter your Mistral key
  - Confirm model field shows "mistral-ocr-latest" (locked/readonly)

- [ ] **Step 5: Smoke-test PDF Uploader**

  - Navigate to AI Tools → PDF Uploader
  - Upload a small PDF
  - Confirm it processes through Mistral OCR (no OpenRouter calls in browser Network tab)
  - Confirm flashcards are generated

- [ ] **Step 6: Smoke-test Course OCR Scans**

  - Open a course → OCR Scans tab
  - Upload an image
  - Confirm Mistral OCR runs (network call to `api.mistral.ai/v1/ocr`)
  - Confirm text is extracted

- [ ] **Step 7: Smoke-test a feature override**

  - In Settings, expand **Chat & Tutor** slot
  - Set a different provider/key (e.g., Groq)
  - Open Tutor tool, send a message
  - Confirm it uses Groq (check Network tab — should call `api.groq.com`)

- [ ] **Step 8: Commit final**

  ```bash
  git add .
  git commit -m "chore: deploy per-feature AI slots with Mistral OCR"
  ```

---

## Summary of Files Changed

| File | Action |
|---|---|
| `src/utils/ai.ts` | Add `AIFeatureSlot`, `getConfigForSlot()`, `isSlotConfigured()`, `'mistral'` provider, `slot` param |
| `src/utils/mistralOcrService.ts` | **Create** — unified PDF+image Mistral OCR service |
| `src/utils/pdfOcrService.ts` | **Delete** |
| `src/components/aitools/OcrTool.tsx` | Replace Tesseract.js with `runMistralOcr()` |
| `src/components/aitools/PdfUploaderTool.tsx` | Update import to `mistralOcrService` |
| `src/components/physquiz/PhysicsAiImport.tsx` | Replace pdfjs canvas with `runMistralOcr()` + `'ocr'` slot |
| `src/pages/SettingsPage.tsx` | Add Mistral to provider map + Feature Overrides section |
| 44 `callAI()` caller files | Add slot arg per feature: `'chat'` / `'generation'` / `'analysis'` / `'ocr'` / `'japanese'` / `'physics'` |
| `src/utils/physicsGradingQueue.ts` | Add `'ocr'` slot (image grading calls) |
| `src/components/physquiz/PhysicsSession.tsx` | Add `'ocr'` slot (image grading) or `'physics'` (conversational) per call |
