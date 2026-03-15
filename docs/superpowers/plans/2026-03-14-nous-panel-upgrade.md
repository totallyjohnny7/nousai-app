# Nous AI Panel Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade NousPanel into a draggable floating assistant with file import, per-page context awareness, and a settings drawer.

**Architecture:** Store-based page context (`activePageContext` in Zustand) lets pages publish their content without prop drilling. NousPanel gains floating/drag state, file attachment state, and a settings sub-component — all self-contained in one file. File extraction lives in a dedicated utility.

**Tech Stack:** React 19, TypeScript 5.9, Zustand (via custom Context), pdfjs-dist (PDF text extraction), existing `imageCompress` util

---

## Chunk 1: Foundation — Types, Store, File Extraction Utility

### Task 1: Add `PageContext` and `AttachedFile` to `src/types.ts`

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Open `src/types.ts` and append these two interfaces at the end of the file**

```ts
// ── Nous AI Panel — Page Context ─────────────────────────
export interface PageContext {
  page: string          // Display name, e.g. "Flashcards"
  summary: string       // One-line summary, e.g. "Reviewing: Cell Biology — 12 cards due"
  activeItem?: string   // Content of the focused item (card front/back, open note, current question)
  fullContent?: string  // Broader page content (all cards, all note titles, quiz history)
}

// ── Nous AI Panel — Attached File ────────────────────────
export interface AttachedFile {
  name: string
  type: 'image' | 'pdf' | 'text'
  content: string       // base64 data URL for images; extracted UTF-8 text for pdf/text
  mimeType: string
  sizeBytes: number
}
```

- [ ] **Step 2: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: `✓ built in` with zero TypeScript errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/types.ts
git commit -m "feat: add PageContext and AttachedFile types"
```

---

### Task 2: Add `activePageContext` + `setPageContext` to `src/store.tsx`

**Files:**
- Modify: `src/store.tsx`

- [ ] **Step 1: Add import for `PageContext` at the top of `src/store.tsx`**

Find the existing import line:
```ts
import type { NousAIData, CanvasEvent, QuizAttempt, Course, GamificationData, ProficiencyData, SRData, TimerState } from './types';
```
Replace with:
```ts
import type { NousAIData, CanvasEvent, QuizAttempt, Course, GamificationData, ProficiencyData, SRData, TimerState, PageContext } from './types';
```

- [ ] **Step 2: Add the two new fields to the `StoreCtx` interface**

Find the closing line of `StoreCtx` interface (currently ends with `dismissRemoteBanner: () => void;`). Add before the closing `}`:
```ts
  // Page context for Nous AI Panel
  activePageContext: PageContext | null
  setPageContext: (ctx: PageContext | null) => void
```

- [ ] **Step 3: Add state and implementation inside `StoreProvider`**

Find the line:
```ts
  const [remoteUpdateAvailable, setRemoteUpdateAvailable] = useState(false);
```
Add directly after it:
```ts
  const [activePageContext, setPageContext] = useState<PageContext | null>(null);
```

- [ ] **Step 4: Expose in the context value**

Find where the `value` object is assembled in `StoreProvider` (it contains `data`, `setData`, `loaded`, etc.). Add to that object:
```ts
activePageContext,
setPageContext,
```

- [ ] **Step 5: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/store.tsx
git commit -m "feat: add activePageContext and setPageContext to store"
```

---

### Task 3: Create `src/utils/fileExtract.ts`

**Files:**
- Create: `src/utils/fileExtract.ts`

> **Context:** This utility converts any `File` object into an `AttachedFile`. Images are compressed then base64-encoded. PDFs have their text extracted via pdfjs-dist. All other files are read as plain text.

- [ ] **Step 1: Install pdfjs-dist**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm install pdfjs-dist
```
Expected: package added, no peer dep warnings.

- [ ] **Step 2: Create `src/utils/fileExtract.ts`**

```ts
import type { AttachedFile } from '../types'
import { compressImage } from './imageCompress'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

export class FileExtractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileExtractError'
  }
}

export async function extractFileContent(file: File): Promise<AttachedFile> {
  if (file.size > MAX_BYTES) {
    throw new FileExtractError(`File "${file.name}" exceeds 10 MB limit`)
  }

  if (IMAGE_TYPES.includes(file.type)) {
    return extractImage(file)
  }
  if (file.type === 'application/pdf') {
    return extractPdf(file)
  }
  return extractText(file)
}

async function extractImage(file: File): Promise<AttachedFile> {
  // compressImage returns { base64, mimeType, sizeKB } — not a data URL
  const compressed = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.85 })
  return {
    name: file.name,
    type: 'image',
    content: `data:${compressed.mimeType};base64,${compressed.base64}`,
    mimeType: compressed.mimeType,
    sizeBytes: file.size,
  }
}

async function extractPdf(file: File): Promise<AttachedFile> {
  const arrayBuffer = await file.arrayBuffer()
  // Dynamic import keeps pdfjs out of the main bundle
  const pdfjsLib = await import('pdfjs-dist')
  // Point worker to bundled worker (Vite will handle this)
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ')
    pages.push(`[Page ${i}]\n${pageText}`)
  }

  return {
    name: file.name,
    type: 'pdf',
    content: pages.join('\n\n'),
    mimeType: 'application/pdf',
    sizeBytes: file.size,
  }
}

async function extractText(file: File): Promise<AttachedFile> {
  const content = await file.text()
  return {
    name: file.name,
    type: 'text',
    content,
    mimeType: file.type || 'text/plain',
    sizeBytes: file.size,
  }
}
```

> **Note:** `compressImage` always outputs JPEG regardless of input format — animated GIFs will be flattened to a static JPEG. This is a known limitation of the existing `imageCompress.ts` utility. `compressImage(file, opts)` accepts `{ maxWidth, maxHeight, quality }` and returns `Promise<{ base64, mimeType, sizeKB }>` — the `extractImage` function above already uses the correct signature.

- [ ] **Step 3: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```
Expected: zero TypeScript errors. `pdfjs-dist` v4+ ships its own types — do not install `@types/pdfjs-dist` (it doesn't exist). If type errors appear, confirm `pdfjs-dist@^4` is installed (`npm list pdfjs-dist`) and that `tsconfig.json` uses `"moduleResolution": "bundler"` or `"node16"`.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/utils/fileExtract.ts package.json package-lock.json
git commit -m "feat: add fileExtract utility for image/pdf/text attachment processing"
```

---

## Chunk 2: NousPanel — Floating Drag + Settings Drawer + Context Depth

### Task 4: Add floating drag to `NousPanel.tsx`

**Files:**
- Modify: `src/components/NousPanel.tsx`

> **Context:** The panel currently renders as `position: fixed` on the right edge via CSS class `.nous-panel`. We add `isFloating` + `pos` state. When floating, we apply inline `transform: translate(x, y)` and a `--floating` CSS modifier class. Dragging works by capturing pointer events on the header.

- [ ] **Step 1: Add new state at the top of the `NousPanel` component (after existing `useState` declarations)**

```ts
// ── Floating / drag state ────────────────────────────────
const [isFloating, setIsFloating] = useState(() => {
  try { return localStorage.getItem('nous_panel_floating') === 'true' } catch { return false }
})
const [pos, setPos] = useState<{ x: number; y: number }>(() => {
  try {
    const saved = localStorage.getItem('nous_panel_pos')
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 400, y: 80 }
  } catch { return { x: window.innerWidth - 400, y: 80 } }
})
const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
```

- [ ] **Step 2: Persist floating state and position**

After the existing `useEffect` that persists `open` state, add:
```ts
useEffect(() => {
  try { localStorage.setItem('nous_panel_floating', String(isFloating)) } catch { /* ignore */ }
}, [isFloating])

useEffect(() => {
  try { localStorage.setItem('nous_panel_pos', JSON.stringify(pos)) } catch { /* ignore */ }
}, [pos])
```

- [ ] **Step 3: Add drag handlers**

Add these two callbacks after the existing `clearChat` callback:
```ts
const handleDragStart = useCallback((e: React.PointerEvent) => {
  if (!isFloating) return
  e.currentTarget.setPointerCapture(e.pointerId)
  dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
}, [isFloating, pos])

const handleDragMove = useCallback((e: React.PointerEvent) => {
  if (!dragRef.current) return
  const dx = e.clientX - dragRef.current.startX
  const dy = e.clientY - dragRef.current.startY
  setPos({ x: dragRef.current.originX + dx, y: dragRef.current.originY + dy })
}, [])

const handleDragEnd = useCallback(() => {
  dragRef.current = null
}, [])
```

- [ ] **Step 4: Add detach/dock button to the header**

In the JSX, find the header-actions div (contains Trash2 and X buttons). Add a detach/dock button before the Trash2 button:
```tsx
import { Brain, X, Trash2, Copy, Check, Send, Paperclip, Settings, Maximize2, Minimize2 } from 'lucide-react'
```
*(update the import line at the top of the file — `GripHorizontal` is NOT included; the header itself acts as the drag handle)*

Then add to header-actions:
```tsx
<button
  className="nous-panel-icon-btn"
  onClick={() => setIsFloating(f => !f)}
  title={isFloating ? 'Dock panel' : 'Float panel'}
>
  {isFloating ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
</button>
```

- [ ] **Step 5: Apply floating styles to the panel**

Find the panel `<div className={...}>` (currently `nous-panel${open ? ' nous-panel--open' : ''}`). Replace with:
```tsx
<div
  className={`nous-panel${open ? ' nous-panel--open' : ''}${isFloating ? ' nous-panel--floating' : ''}`}
  style={isFloating ? { transform: `translate(${pos.x}px, ${pos.y}px)` } : undefined}
  role="complementary"
  aria-label="Nous AI assistant panel"
>
```

- [ ] **Step 6: Make the header the drag handle**

Find the header div `<div className="nous-panel-header">`. Add pointer event handlers:
```tsx
<div
  className={`nous-panel-header${isFloating ? ' nous-panel-drag-handle' : ''}`}
  onPointerDown={handleDragStart}
  onPointerMove={handleDragMove}
  onPointerUp={handleDragEnd}
  onPointerCancel={handleDragEnd}
>
```

- [ ] **Step 7: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/components/NousPanel.tsx
git commit -m "feat: add floating drag mode to NousPanel"
```

---

### Task 5: Add settings drawer and context depth to `NousPanel.tsx`

**Files:**
- Modify: `src/components/NousPanel.tsx`

- [ ] **Step 1: Add settings state near the top of the component**

```ts
// ── Settings state ───────────────────────────────────────
const [showSettings, setShowSettings] = useState(false)
const [contextDepth, setContextDepthState] = useState<'minimal' | 'smart' | 'deep'>(() =>
  (localStorage.getItem('nous_context_depth') as 'minimal' | 'smart' | 'deep') || 'smart'
)
const [maxAttachments, setMaxAttachmentsState] = useState<number>(() =>
  parseInt(localStorage.getItem('nous_max_attachments') || '4', 10)
)
const [floatOnOpen, setFloatOnOpenState] = useState(() =>
  localStorage.getItem('nous_float_on_open') === 'true'
)
const [clearOnNavigate, setClearOnNavigateState] = useState(() =>
  localStorage.getItem('nous_clear_on_navigate') === 'true'
)
```

- [ ] **Step 2: Persist settings changes**

Add setters that persist to localStorage:
```ts
const setContextDepth = useCallback((v: 'minimal' | 'smart' | 'deep') => {
  setContextDepthState(v)
  try { localStorage.setItem('nous_context_depth', v) } catch { /* ignore */ }
}, [])

const setMaxAttachments = useCallback((v: number) => {
  setMaxAttachmentsState(v)
  try { localStorage.setItem('nous_max_attachments', String(v)) } catch { /* ignore */ }
}, [])

const setFloatOnOpen = useCallback((v: boolean) => {
  setFloatOnOpenState(v)
  try { localStorage.setItem('nous_float_on_open', String(v)) } catch { /* ignore */ }
}, [])

const setClearOnNavigate = useCallback((v: boolean) => {
  setClearOnNavigateState(v)
  try { localStorage.setItem('nous_clear_on_navigate', String(v)) } catch { /* ignore */ }
}, [])
```

- [ ] **Step 3: Auto-float on open (if setting is enabled)**

Find the existing `useEffect` that persists `open`. After it, add:
```ts
useEffect(() => {
  if (open && floatOnOpen) setIsFloating(true)
}, [open, floatOnOpen])
```

- [ ] **Step 4: Clear on navigate (if setting is enabled)**

`setMessages` is the existing setter from `const [messages, setMessages] = useState<Message[]>([])` at the top of `NousPanel`. Find or add a `useEffect` watching `location.pathname`:
```ts
useEffect(() => {
  if (clearOnNavigate) setMessages([])
}, [location.pathname, clearOnNavigate])
```

- [ ] **Step 5: Pull `activePageContext` from store**

Find the existing destructure of `useStore()`:
```ts
const { courses, srData } = useStore()
```
Replace with:
```ts
const { courses, srData, activePageContext } = useStore()
```

- [ ] **Step 6: Update `getContext` to use depth setting and `activePageContext`**

Replace the existing `getContext` callback with:
```ts
const getContext = useCallback(() => {
  const activeView = getViewName(location.pathname)
  const courseNames = (courses || []).map((c: any) => c.name).join(', ')
  const cards = srData?.cards || []
  const total = cards.length
  const mastered = cards.filter((c: any) => (c.stability || 0) > 10).length
  const learning = total - mastered
  const provider = localStorage.getItem('nousai-ai-provider') || 'none'
  const model = localStorage.getItem('nousai-ai-model') || 'default'

  let pageCtxBlock = ''
  if (activePageContext && contextDepth !== 'minimal') {
    const lines = [
      `- Current page summary: ${activePageContext.summary}`,
    ]
    if (contextDepth === 'smart' && activePageContext.activeItem) {
      lines.push(`- Active item:\n${activePageContext.activeItem}`)
    }
    if (contextDepth === 'deep') {
      if (activePageContext.activeItem) lines.push(`- Active item:\n${activePageContext.activeItem}`)
      if (activePageContext.fullContent) lines.push(`- Full page content:\n${activePageContext.fullContent}`)
    }
    pageCtxBlock = '\n\nPage context:\n' + lines.join('\n')
  }

  return buildSystemPrompt(activeView, courseNames, total, mastered, learning, provider, model) + pageCtxBlock
}, [location.pathname, courses, srData, activePageContext, contextDepth])
```

- [ ] **Step 7: Add the settings gear button to the header**

In the header-actions div, add after the detach button:
```tsx
<button
  className={`nous-panel-icon-btn${showSettings ? ' nous-panel-icon-btn--active' : ''}`}
  onClick={() => setShowSettings(s => !s)}
  title="Panel settings"
>
  <Settings size={14} />
</button>
```

- [ ] **Step 8: Add the `NousPanelSettings` inline component JSX**

Add this JSX block inside the panel `<div>`, directly after the header and before the messages area:
```tsx
{/* Settings drawer */}
{showSettings && (
  <div className="nous-panel-settings">
    <div className="nous-settings-row">
      <span className="nous-settings-label">Context depth</span>
      <div className="nous-settings-options">
        {(['minimal', 'smart', 'deep'] as const).map(d => (
          <button
            key={d}
            className={`nous-settings-opt${contextDepth === d ? ' nous-settings-opt--active' : ''}`}
            onClick={() => setContextDepth(d)}
          >
            {d.charAt(0).toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>
    </div>
    <div className="nous-settings-row">
      <span className="nous-settings-label">Max attachments</span>
      <div className="nous-settings-options">
        {[2, 4, 8].map(n => (
          <button
            key={n}
            className={`nous-settings-opt${maxAttachments === n ? ' nous-settings-opt--active' : ''}`}
            onClick={() => setMaxAttachments(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
    <div className="nous-settings-row">
      <span className="nous-settings-label">Float on open</span>
      <button
        className={`nous-settings-toggle${floatOnOpen ? ' nous-settings-toggle--on' : ''}`}
        onClick={() => setFloatOnOpen(!floatOnOpen)}
      >
        {floatOnOpen ? 'On' : 'Off'}
      </button>
    </div>
    <div className="nous-settings-row">
      <span className="nous-settings-label">Clear on navigate</span>
      <button
        className={`nous-settings-toggle${clearOnNavigate ? ' nous-settings-toggle--on' : ''}`}
        onClick={() => setClearOnNavigate(!clearOnNavigate)}
      >
        {clearOnNavigate ? 'On' : 'Off'}
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 9: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 10: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/components/NousPanel.tsx
git commit -m "feat: add settings drawer and context depth to NousPanel"
```

---

## Chunk 3: File Attachments UI in NousPanel

### Task 6: Add file attachment UI to `NousPanel.tsx`

**Files:**
- Modify: `src/components/NousPanel.tsx`

- [ ] **Step 1: Add attachment imports**

Add to the top imports:
```ts
import { extractFileContent, FileExtractError } from '../utils/fileExtract'
import type { AttachedFile } from '../types'
```

- [ ] **Step 2: Add attachment state**

Add near the top of the component (with the other state):
```ts
const [attachments, setAttachments] = useState<AttachedFile[]>([])
const [attachError, setAttachError] = useState<string | null>(null)
const fileInputRef = useRef<HTMLInputElement>(null)
```

- [ ] **Step 3: Add attachment handlers**

Add these callbacks after `clearChat`:
```ts
const addAttachment = useCallback(async (file: File) => {
  setAttachError(null)
  // Use functional form to avoid stale closure when multiple files are added concurrently
  let tooMany = false
  setAttachments(prev => {
    if (prev.length >= maxAttachments) { tooMany = true; return prev }
    return prev // actual add happens after extraction below
  })
  if (tooMany) {
    setAttachError(`Max ${maxAttachments} attachments per message`)
    return
  }
  try {
    const extracted = await extractFileContent(file)
    setAttachments(prev => {
      if (prev.length >= maxAttachments) return prev // double-check after async
      return [...prev, extracted]
    })
  } catch (err) {
    if (err instanceof FileExtractError) {
      setAttachError(err.message)
    } else {
      setAttachError('Failed to read file')
    }
  }
}, [maxAttachments])

const removeAttachment = useCallback((index: number) => {
  setAttachments(prev => prev.filter((_, i) => i !== index))
}, [])
```

- [ ] **Step 4: Handle paste (Ctrl+V images)**

Add a `useEffect` for paste events:
```ts
useEffect(() => {
  if (!open) return
  const handler = async (e: ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || [])
    const imageItem = items.find(i => i.type.startsWith('image/'))
    if (!imageItem) return
    e.preventDefault()
    const file = imageItem.getAsFile()
    if (file) await addAttachment(file)
  }
  window.addEventListener('paste', handler)
  return () => window.removeEventListener('paste', handler)
}, [open, addAttachment])
```

- [ ] **Step 5: Handle drag-and-drop onto the panel**

Add `onDragOver` and `onDrop` to the outer panel `<div>`:
```tsx
onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
onDrop={async (e) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files)
  for (const file of files.slice(0, maxAttachments)) {
    await addAttachment(file)
  }
}}
```

- [ ] **Step 6: Include attachment content when sending a message**

Find the `sendMessage` callback. Find where `history` is built:
```ts
const history = [...messages, userMsg]
  .filter(m => m.content)
  .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
```
Replace with:
```ts
// Build attachment block to append to user message
const attachBlock = attachments.length > 0
  ? '\n\n---\nAttached files:\n' + attachments.map(a => {
      if (a.type === 'image') return `[Image: ${a.name}]`
      if (a.type === 'pdf') return `[PDF: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
      return `[File: ${a.name}]\n\`\`\`\n${a.content.slice(0, 8000)}\n\`\`\``
    }).join('\n\n')
  : ''

const history = [...messages, { ...userMsg, content: userMsg.content + attachBlock }]
  .filter(m => m.content)
  .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

// Clear attachments after send
setAttachments([])
```

- [ ] **Vision support check — run this before sending:**

```bash
grep -n "image_url\|vision\|content.*array\|Array.isArray" C:/Users/johnn/Desktop/NousAI-App/src/utils/ai.ts | head -10
```

If `callAI` already handles array message content with `image_url` items, upgrade image attachments in the history to:
```ts
{ role: 'user', content: [
  { type: 'image_url', image_url: { url: a.content } },
  { type: 'text', text: userMsg.content + attachBlock }
]}
```
instead of the text label fallback. If `callAI` does not support content arrays, the text label fallback `[Image: ${a.name}]` is acceptable for now — add a `// TODO: upgrade to vision content array when callAI supports it` comment in the code.

- [ ] **Step 7: Add chip UI above the textarea**

Find the input row `<div className="nous-panel-input-row">` and add before it:
```tsx
{/* Attachment chips */}
{(attachments.length > 0 || attachError) && (
  <div className="nous-attachments">
    {attachError && (
      <span className="nous-attach-error">{attachError}</span>
    )}
    {attachments.map((a, i) => (
      <span key={i} className="nous-attach-chip">
        <span className="nous-attach-chip-name">
          {a.type === 'image' ? '[img] ' : a.type === 'pdf' ? '[pdf] ' : '[txt] '}
          {a.name}
        </span>
        <button
          className="nous-attach-chip-remove"
          onClick={() => removeAttachment(i)}
          aria-label={`Remove ${a.name}`}
        >
          ×
        </button>
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 8: Add paperclip button to the input row**

Find the textarea in the input row. Add before it:
```tsx
<input
  ref={fileInputRef}
  type="file"
  multiple
  accept="image/*,.pdf,.txt,.md,.js,.ts,.jsx,.tsx,.py,.java,.cs,.cpp,.c,.json,.csv,.html,.css"
  style={{ display: 'none' }}
  onChange={async (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) await addAttachment(file)
    e.target.value = '' // reset so same file can be re-added
  }}
/>
<button
  className="nous-panel-icon-btn nous-panel-attach-btn"
  onClick={() => fileInputRef.current?.click()}
  title="Attach file"
  disabled={attachments.length >= maxAttachments}
>
  <Paperclip size={14} />
</button>
```

- [ ] **Step 9: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 10: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/components/NousPanel.tsx
git commit -m "feat: add file attachment UI to NousPanel (chips, paste, drag-drop)"
```

---

## Chunk 4: CSS + Page Context Publishers

### Task 7: Add CSS for new panel features to `src/index.css`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Find the existing Nous Panel CSS block**

```bash
grep -n "nous-panel" C:/Users/johnn/Desktop/NousAI-App/src/index.css | head -20
```
Note the last line number of the existing `.nous-panel` block.

- [ ] **Step 2: Append these new classes after the existing Nous Panel block**

```css
/* ── NousPanel — Floating mode ───────────────────────── */
.nous-panel--floating {
  position: fixed !important;
  right: unset !important;
  top: 0 !important;
  width: 360px !important;
  max-height: 80vh;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 9999;
}

.nous-panel-drag-handle {
  cursor: grab;
  user-select: none;
}

.nous-panel-drag-handle:active {
  cursor: grabbing;
}

/* ── NousPanel — Settings drawer ─────────────────────── */
.nous-panel-settings {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary, #111);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nous-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.nous-settings-label {
  font-size: 12px;
  color: var(--text-muted);
  flex: 1;
}

.nous-settings-options {
  display: flex;
  gap: 4px;
}

.nous-settings-opt {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.nous-settings-opt--active {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}

.nous-settings-toggle {
  padding: 2px 10px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.nous-settings-toggle--on {
  background: var(--accent);
  color: #000;
  border-color: var(--accent);
  font-weight: 600;
}

.nous-panel-icon-btn--active {
  color: var(--accent);
}

/* ── NousPanel — Attachment chips ────────────────────── */
.nous-attachments {
  padding: 6px 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  border-top: 1px solid var(--border);
}

.nous-attach-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  background: var(--bg-secondary, #1a1a1a);
  border: 1px solid var(--border);
  border-radius: 20px;
  font-size: 11px;
  color: var(--text-dim);
  max-width: 180px;
}

.nous-attach-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nous-attach-chip-remove {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  flex-shrink: 0;
}

.nous-attach-chip-remove:hover {
  color: var(--text-dim);
}

.nous-attach-error {
  font-size: 11px;
  color: #e05252;
  width: 100%;
}

.nous-panel-attach-btn {
  flex-shrink: 0;
}
```

- [ ] **Step 3: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/index.css
git commit -m "feat: add CSS for floating panel, settings drawer, and attachment chips"
```

---

### Task 8: Add page context publishers to Flashcards and Dashboard

**Files:**
- Modify: `src/pages/Flashcards.tsx`
- Modify: `src/pages/Dashboard.tsx`

> **Pattern used in all pages:** import `useStore`, destructure `setPageContext`, call it in a `useEffect` that re-runs when the relevant data changes, and return `() => setPageContext(null)` from the cleanup.

- [ ] **Step 1: Add context publisher to `src/pages/Flashcards.tsx`**

The main component is `export default function Flashcards()` at the bottom of the file (line ~1142). It has:
- `selectedCourse: Course | null` — the active deck
- `dailyProgress` — tracks session review counts
- `srData` is in the store globally (not a local variable here)

Add `setPageContext` to the existing `useStore()` destructure at line 1143:
```ts
const { loaded, courses, data, setData, updatePluginData, matchSets, setPageContext } = useStore()
```

Then add a `useEffect` after the existing state declarations:
```ts
useEffect(() => {
  if (!selectedCourse) {
    setPageContext({ page: 'Flashcards', summary: 'No deck selected' })
    return () => setPageContext(null)
  }
  const allCards = selectedCourse.flashcards ?? []
  const dueCount = allCards.filter(c => {
    const key = `${selectedCourse.id}::${c.front.slice(0, 50)}`
    try {
      const stored = JSON.parse(localStorage.getItem('nousai-fc-fsrs') || '{}')
      const fsrsCard = stored[key]
      if (!fsrsCard) return true // new card = due
      return new Date(fsrsCard.nextReview) <= new Date()
    } catch { return true }
  }).length

  setPageContext({
    page: 'Flashcards',
    summary: `Reviewing: ${selectedCourse.name} — ${dueCount} cards due`,
    fullContent: allCards.slice(0, 20).map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'),
  })
  return () => setPageContext(null)
}, [selectedCourse])
```

- [ ] **Step 2: Add context publisher to `src/pages/Dashboard.tsx`**

Find the `useStore()` destructure in Dashboard.tsx. Add `setPageContext`.

Add a `useEffect`:
```ts
useEffect(() => {
  const xp = gamification?.xp ?? 0
  const streak = gamification?.streak ?? 0
  const dueCards = (srData?.cards ?? []).filter(c => new Date(c.nextReview) <= new Date()).length

  setPageContext({
    page: 'Dashboard',
    summary: `${xp} XP · ${streak}-day streak · ${dueCards} cards due`,
  })
  return () => setPageContext(null)
}, [gamification, srData])
```

- [ ] **Step 3: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/pages/Flashcards.tsx src/pages/Dashboard.tsx
git commit -m "feat: publish page context from Flashcards and Dashboard"
```

---

### Task 9: Add page context publishers to remaining pages

**Files:**
- Modify: `src/pages/LibraryPage.tsx`
- Modify: `src/pages/Quizzes.tsx`
- Modify: `src/components/course/LecturesTab.tsx`
- Modify: `src/components/course/VocabTab.tsx`
- Modify: `src/components/course/VisualLabTab.tsx`

---

- [ ] **Step 1: Add context publisher to `src/pages/LibraryPage.tsx`**

The main component uses `useStore()` at line 111. Key state: `notes: Note[]`, `selectedId: string | null`.

Add `setPageContext` to the `useStore()` destructure at line 111:
```ts
const { data, setData, updatePluginData, loaded, courses, quizHistory, setPageContext } = useStore()
```

Add a `useEffect` after the existing state declarations:
```ts
useEffect(() => {
  const selectedNote = notes.find(n => n.id === selectedId) ?? null
  setPageContext({
    page: 'Library',
    summary: selectedNote ? `Viewing: ${selectedNote.title}` : `Library — ${notes.length} notes`,
    activeItem: selectedNote?.content ? selectedNote.content.slice(0, 3000) : undefined,
    fullContent: notes.slice(0, 50).map(n => n.title).join('\n'),
  })
  return () => setPageContext(null)
}, [notes, selectedId])
```

---

- [ ] **Step 2: Add context publisher to `src/pages/Quizzes.tsx`**

The main component is `export default function Quizzes()` at line 134. Key state: `activeQuiz: PlayableQuiz | null`, `activeSession: ProgressiveQuizSession | null`, `data` from store.

Add `setPageContext` to the `useStore()` destructure:
```ts
const { loaded, data, setData, setPageContext } = useStore()
```

Add a `useEffect`:
```ts
useEffect(() => {
  if (activeQuiz) {
    setPageContext({
      page: 'Quiz',
      summary: `Quiz: ${activeQuiz.subject} — ${activeQuiz.questions.length} questions`,
      activeItem: activeQuiz.questions[0]
        ? `Q: ${activeQuiz.questions[0].question}\nOptions: ${(activeQuiz.questions[0].options ?? []).join(', ')}`
        : undefined,
    })
  } else {
    const recentCount = (data?.pluginData?.quizHistory ?? []).length
    setPageContext({
      page: 'Quizzes',
      summary: `Quiz history — ${recentCount} attempts`,
    })
  }
  return () => setPageContext(null)
}, [activeQuiz, data?.pluginData?.quizHistory])
```

---

- [ ] **Step 3: Add context publisher to `src/components/course/LecturesTab.tsx`**

`LecturesTab` receives props. Key state: `expandedLecture: string | null`, `activeNote: LectureNote | null`. The component does NOT use `useStore()` currently — add the import.

Add at the top of the file after existing imports:
```ts
import { useStore } from '../../store'
```

Inside the `LecturesTab` function body, add near the top:
```ts
const { setPageContext } = useStore()
```

Then add a `useEffect` (the component already has `course` in props):
```ts
useEffect(() => {
  setPageContext({
    page: 'Course — Lectures',
    summary: `${course.name} — Lectures${expandedLecture ? ` (viewing: ${expandedLecture})` : ''}`,
    activeItem: activeNote ? `${activeNote.title}\n\n${activeNote.content?.slice(0, 2000) ?? ''}` : undefined,
  })
  return () => setPageContext(null)
}, [course.name, expandedLecture, activeNote])
```

> **Note:** `LecturesTab` receives `course` as a prop — check the prop interface at the top of the file to confirm the prop name. The export signature is `function LecturesTab({ course, ... })`.

---

- [ ] **Step 4: Add context publisher to `src/components/course/VocabTab.tsx`**

`VocabTab` receives props including vocab items. Key state: `quizIndex: number`, `quizItems: VocabItem[]`. Does NOT use `useStore()`.

Add import:
```ts
import { useStore } from '../../store'
```

Add inside function body:
```ts
const { setPageContext } = useStore()
```

The vocab list is derived via `useMemo` inside the component and named `vocab` (a `VocabItem[]`). Add:
```ts
useEffect(() => {
  setPageContext({
    page: 'Course — Vocab',
    summary: `${course.name} — Vocab (${vocab.length} terms)`,
    fullContent: vocab.slice(0, 30).map((v) =>
      `${v.term}: ${v.definition}`
    ).join('\n'),
  })
  return () => setPageContext(null)
}, [course.name, vocab])
```

---

- [ ] **Step 5: Add context publisher to `src/components/course/VisualLabTab.tsx`**

Uses `useStore()` already at line 37. Key state: `activeLab: GeneratedLab | null`.

Add `setPageContext` to the existing destructure:
```ts
const { data, setData, updatePluginData, setPageContext } = useStore()
```

Add a `useEffect`:
```ts
useEffect(() => {
  setPageContext({
    page: 'Course — Lab',
    summary: activeLab
      ? `${course.name} — Lab: ${activeLab.title ?? 'Active simulation'}`
      : `${course.name} — Visual Lab`,
    activeItem: activeLab?.question ?? undefined, // `question` is the user's sim prompt in GeneratedLab
  })
  return () => setPageContext(null)
}, [course.name, activeLab])
```

---

---

- [ ] **Step 6: Add context publisher to `src/pages/StudyPage.tsx`**

The component is `export default function StudyPage()` at line 66. Key state: `selectedCourse: string`, `session: QuizSession | null`, `view: StudyView`.

Add `setPageContext` to the existing `useStore()` destructure:
```ts
const { loaded, courses, quizHistory, setPageContext } = useStore()
```

Add a `useEffect`:
```ts
useEffect(() => {
  const courseName = courses.find(c => c.id === selectedCourse)?.name ?? selectedCourse
  setPageContext({
    page: 'Study',
    summary: session
      ? `Studying: ${courseName} — Q${session.currentIndex + 1} of ${session.questions.length}`
      : `Study — ${courseName || 'No course selected'}`,
    activeItem: session?.questions[session.currentIndex]
      ? `Question: ${session.questions[session.currentIndex].question}`
      : undefined,
  })
  return () => setPageContext(null)
}, [selectedCourse, session, courses])
```

> **Note:** Check the `QuizSession` type (imported at top of `StudyPage.tsx`) to confirm the shape of `session.questions[n]` and `session.currentIndex`. Adjust field names if they differ.

---

- [ ] **Step 7: Verify build passes after all six files are updated**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -5
```
Expected: zero TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/pages/LibraryPage.tsx src/pages/Quizzes.tsx src/pages/StudyPage.tsx
git add src/components/course/LecturesTab.tsx src/components/course/VocabTab.tsx src/components/course/VisualLabTab.tsx
git commit -m "feat: publish page context from Library, Quiz, Study, and Course tabs"
```

---

### Task 10: Final integration check and deploy

- [ ] **Step 1: Full build and type check**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1
```
Expected: `✓ built in X.Xs` with zero TypeScript errors and no warnings about missing exports.

- [ ] **Step 2: Deploy to production**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build && vercel --prod --yes
```

- [ ] **Step 3: Clear PWA cache in browser after deploy**

Run in browser console on https://nousai-app.vercel.app:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```
Then hard-reload (Ctrl+Shift+R).

- [ ] **Step 4: Smoke test**

1. Open the app — Nous AI tab visible on right edge ✓
2. Open panel — gear ⚙, detach ↗, paperclip 📎 buttons visible in header ✓
3. Click ↗ — panel pops out, drag it to a new position ✓
4. Click ⚙ — settings drawer opens with Context / Attachments / Float / Clear options ✓
5. Click 📎 — file picker opens; attach an image and a text file ✓
6. Chips appear above textarea, × removes them ✓
7. Paste an image (Ctrl+V) — chip appears ✓
8. Navigate to Flashcards — ask "what am I studying?" — AI mentions the deck ✓
9. Navigate to Dashboard — ask "how am I doing?" — AI mentions XP/streak ✓
10. Change context depth to Deep — ask again — AI gives more detail ✓
