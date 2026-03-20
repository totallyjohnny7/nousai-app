# Batch Figure Generation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate SVG physics diagrams for all 179 image-less questions via a one-time batch script, then patch them into the live question bank without losing session history.

**Architecture:** A Node.js script (`generate-figures.mjs`) reads the 3 chapter JSONs, calls OpenRouter Gemini Flash per question (text only, never answer), encodes the returned SVG as base64, and writes a `figures-patch.json`. A new "Patch Figures" tab in the app's Manage Bank → Bulk Import accepts this file, matches by question ID, and updates only the image fields — leaving all history intact.

**Tech Stack:** Node.js ESM script, OpenRouter API (Gemini Flash), React 19 + TypeScript, Zustand `onChange` prop pattern in `PhysicsQuestionEditor.tsx`.

**Spec:** `docs/superpowers/specs/2026-03-17-batch-figure-generation-design.md`

---

## Chunk 1: `scripts/generate-figures.mjs`

**Files:**
- Create: `scripts/generate-figures.mjs`
- Reference (read-only): `scripts/extract-physics.mjs` — follow its patterns for env loading, caching, dry-run
- Reference (read-only): `scripts/output/chapter19.json`, `chapter20.json`, `chapter21.json` — input data
- Output: `scripts/output/figures-cache.json`, `scripts/output/figures-patch.json`

---

### Task 1: Script skeleton — env, config, constants

- [ ] **Create `scripts/generate-figures.mjs`** with this exact skeleton:

```js
/**
 * generate-figures.mjs
 *
 * Batch-generates SVG physics diagrams for all questions that lack a figure.
 * Uses OpenRouter Gemini Flash — question text only, never the answer.
 *
 * Usage:
 *   node scripts/generate-figures.mjs           # generate all missing figures
 *   node scripts/generate-figures.mjs --dry-run # preview count + cost, no API calls
 *
 * Outputs:
 *   scripts/output/figures-cache.json   — per-question cache (re-run = $0)
 *   scripts/output/figures-patch.json   — import this in the app's Patch Figures tab
 *   scripts/output/chapter19/20/21.json — updated with questionImageBase64 filled in
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(__dirname, 'output')

// ── Load .env ──────────────────────────────────────────────────────────────
function loadDotEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#\n]*)"?\s*$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}
loadDotEnv()

// ── Config ─────────────────────────────────────────────────────────────────
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY
// Always use the latest Gemini Flash — check https://openrouter.ai/models for newest ID.
// Per project rules: NEVER use Claude/Anthropic models via OpenRouter.
const MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash-preview'

const CHAPTER_FILES = ['chapter19', 'chapter20', 'chapter21'].map(
  name => path.join(OUTPUT_DIR, `${name}.json`)
)
const FIGURES_CACHE = path.join(OUTPUT_DIR, 'figures-cache.json')
const FIGURES_PATCH = path.join(OUTPUT_DIR, 'figures-patch.json')

// OpenRouter pricing estimate for Gemini Flash (input+output combined rough estimate)
// ~$0.0001 per question is conservative — actual is likely cheaper
const COST_PER_QUESTION = 0.0001

if (!OPENROUTER_KEY) {
  console.error('❌  OPENROUTER_API_KEY not set. Add it to .env or export it.')
  process.exit(1)
}
```

- [ ] **Verify syntax:** `node --check scripts/generate-figures.mjs` → no errors

---

### Task 2: Cache helpers

- [ ] **Append to `generate-figures.mjs`** — cache read/write:

```js
// ── Figures cache ──────────────────────────────────────────────────────────
// Keyed by question.id → base64-encoded SVG string.
// Written immediately after each successful generation.
// Re-running the script skips any question already in the cache.

function loadCache() {
  if (!fs.existsSync(FIGURES_CACHE)) return new Map()
  try {
    return new Map(Object.entries(JSON.parse(fs.readFileSync(FIGURES_CACHE, 'utf8'))))
  } catch {
    console.warn('⚠️  figures-cache.json corrupt — starting fresh')
    return new Map()
  }
}

function saveCache(cache) {
  fs.writeFileSync(FIGURES_CACHE, JSON.stringify(Object.fromEntries(cache), null, 2), 'utf8')
}
```

- [ ] **Verify syntax:** `node --check scripts/generate-figures.mjs`

---

### Task 3: SVG generation via OpenRouter

- [ ] **Append to `generate-figures.mjs`** — the SVG prompt and API call:

```js
// ── SVG prompt ─────────────────────────────────────────────────────────────
// IMPORTANT: Uses question text ONLY — never expectedAnswer.
// This ensures the diagram shows the setup without revealing the solution.

const SVG_SYSTEM = `You are a physics diagram generator. Draw a clean SVG showing ONLY the physical setup described — never the answer or solution.

Rules:
- Use exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
- First child: <rect width="400" height="300" fill="#0f0f0f"/>
- Strokes: white (#ffffff) for structure/components, amber (#f59e0b) for key labels/highlights
- Text: font-family="monospace" font-size="13" fill="white"
- Show geometry, component symbols (resistors, capacitors, batteries, coils), arrows for velocity/field/force direction
- NO numerical answer values, NO solution steps, NO "answer" or "result" labels
- Keep total SVG under 3500 characters
- Return ONLY the SVG element starting with <svg — no markdown fences, no explanation, no other text`

async function generateSvg(questionText) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://nousai-app.vercel.app',
      'X-Title': 'NousAI Figure Generator',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [
        { role: 'system', content: SVG_SYSTEM },
        { role: 'user', content: `Question: ${questionText}` },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    const status = res.status
    const msg = err?.error?.message ?? 'unknown'
    throw Object.assign(new Error(`OpenRouter ${status}: ${msg}`), { status })
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
```

- [ ] **Verify syntax:** `node --check scripts/generate-figures.mjs`

---

### Task 4: SVG validation helper + retry wrapper

- [ ] **Append to `generate-figures.mjs`**:

```js
// ── SVG validation ─────────────────────────────────────────────────────────
// Extracts the SVG element from the response and validates basic structure.
// Returns the clean SVG string, or null if invalid.

function extractAndValidateSvg(raw) {
  // Strip any markdown fences the model may have added despite instructions
  let svg = raw.replace(/^```(?:svg|xml)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  // Must start with <svg and contain closing tag
  if (!svg.startsWith('<svg') || !svg.includes('</svg>')) return null
  if (svg.length < 100 || svg.length > 6000) return null
  return svg
}

// ── Retry with backoff ─────────────────────────────────────────────────────
async function generateSvgWithRetry(questionText, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const raw = await generateSvg(questionText)
      const svg = extractAndValidateSvg(raw)
      if (svg) return svg
      console.warn(`    ⚠️  Attempt ${attempt}: invalid SVG returned (len=${raw.length}) — retrying`)
    } catch (err) {
      const isRetryable = err.status === 429 || (err.status >= 500 && err.status < 600)
      if (!isRetryable || attempt === maxAttempts) throw err
      const wait = attempt * 15_000
      console.warn(`    ⚠️  Attempt ${attempt} failed (${err.status}) — retrying in ${wait / 1000}s`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  return null // all attempts exhausted without valid SVG
}
```

- [ ] **Verify syntax:** `node --check scripts/generate-figures.mjs`

---

### Task 5: Main function — dry-run + processing loop

- [ ] **Append to `generate-figures.mjs`**:

```js
// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  console.log('\n🎨 Physics Figure Generator')
  console.log(`   Model: ${MODEL}`)
  if (isDryRun) console.log('   ⚡ DRY-RUN — no API calls\n')
  else console.log('')

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // Load all chapter questions
  const allChapters = []
  for (const file of CHAPTER_FILES) {
    if (!fs.existsSync(file)) { console.warn(`⚠️  Not found: ${file}`); continue }
    const questions = JSON.parse(fs.readFileSync(file, 'utf8'))
    allChapters.push({ file, questions })
  }

  // Load existing cache
  const cache = loadCache()

  // Identify questions needing figures
  const toProcess = []
  for (const { file, questions } of allChapters) {
    for (const q of questions) {
      if (q.questionImageBase64) continue          // already has OCR image
      if (cache.has(q.id)) continue                // already generated
      toProcess.push({ file, q })
    }
  }

  const alreadyCached = allChapters.reduce((n, { questions }) =>
    n + questions.filter(q => !q.questionImageBase64 && cache.has(q.id)).length, 0)

  console.log(`📊 Pre-flight audit:`)
  console.log(`   Total questions:    ${allChapters.reduce((n, c) => n + c.questions.length, 0)}`)
  console.log(`   Already have image: ${allChapters.reduce((n, c) => n + c.questions.filter(q => q.questionImageBase64).length, 0)}`)
  console.log(`   Cached (free):      ${alreadyCached}`)
  console.log(`   To generate:        ${toProcess.length}`)
  console.log(`   Est. cost:          ~$${(toProcess.length * COST_PER_QUESTION).toFixed(4)}`)
  console.log('')

  if (isDryRun) {
    console.log('✅ Dry-run complete. Run without --dry-run to execute.')
    return
  }

  if (toProcess.length === 0) {
    console.log('✅ All questions already have figures. Nothing to do.')
  } else {
    let generated = 0, failed = 0

    for (let i = 0; i < toProcess.length; i++) {
      const { q } = toProcess[i]
      process.stdout.write(`  [${i + 1}/${toProcess.length}] ${q.id.slice(-8)} "${q.questionText.slice(0, 50).replace(/\n/g, ' ')}…" `)

      try {
        const svg = await generateSvgWithRetry(q.questionText)
        if (!svg) {
          console.log('⚠️  SKIP (invalid SVG after retries)')
          failed++
          continue
        }
        const b64 = Buffer.from(svg).toString('base64')
        cache.set(q.id, b64)
        saveCache(cache)   // write immediately — crash-safe
        generated++
        console.log(`✅ (${svg.length} chars)`)
      } catch (err) {
        console.log(`❌ ERROR: ${err.message}`)
        failed++
      }

      // Small delay to be polite to the API
      if (i < toProcess.length - 1) await new Promise(r => setTimeout(r, 200))
    }

    console.log(`\n📈 Results: ${generated} generated | ${failed} failed | ${alreadyCached} from cache`)
  }

  // Apply cache to all chapter JSONs + build patch file
  const patch = []
  for (const { file, questions } of allChapters) {
    let updated = false
    for (const q of questions) {
      if (!q.questionImageBase64 && cache.has(q.id)) {
        q.questionImageBase64 = cache.get(q.id)
        q.questionImageMime = 'image/svg+xml'
        patch.push({ id: q.id, questionImageBase64: q.questionImageBase64, questionImageMime: 'image/svg+xml' })
        updated = true
      }
    }
    if (updated) {
      fs.writeFileSync(file, JSON.stringify(questions, null, 2), 'utf8')
      console.log(`💾 Updated: ${path.basename(file)}`)
    }
  }

  fs.writeFileSync(FIGURES_PATCH, JSON.stringify(patch, null, 2), 'utf8')
  console.log(`💾 Patch file: ${FIGURES_PATCH} (${patch.length} figures)`)
  console.log('\n✅ Done! Import figures-patch.json via Manage Bank → Bulk Import → Patch Figures tab.')
}

main().catch(err => {
  console.error('\n❌ Fatal:', err.message)
  process.exit(1)
})
```

- [ ] **Verify syntax:** `node --check scripts/generate-figures.mjs` → no errors

---

### Task 6: Verify script dry-run works end-to-end

- [ ] **Run dry-run:**
  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App
  node scripts/generate-figures.mjs --dry-run
  ```
  **Expected output (approximate):**
  ```
  🎨 Physics Figure Generator
     Model: google/gemini-2.5-flash-preview
     ⚡ DRY-RUN — no API calls

  📊 Pre-flight audit:
     Total questions:    248
     Already have image: 69
     Cached (free):      0
     To generate:        179
     Est. cost:          ~$0.0179

  ✅ Dry-run complete. Run without --dry-run to execute.
  ```

- [ ] **Commit:**
  ```bash
  git add scripts/generate-figures.mjs
  git commit -m "feat: add generate-figures.mjs batch SVG generator

  Generates SVG physics setup diagrams for 179 image-less questions
  using OpenRouter Gemini Flash. Failsafes: per-question cache,
  --dry-run, 3x retry with backoff, SVG validation, skip-if-exists.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

## Chunk 2: Patch Figures tab in `PhysicsQuestionEditor.tsx`

**Files:**
- Modify: `src/components/physquiz/PhysicsQuestionEditor.tsx` (lines 188, 1341, after line 1498)

---

### Task 7: Extend `bulkTab` union type + add tab button

- [ ] **In `PhysicsQuestionEditor.tsx` line 188**, change:
  ```ts
  // BEFORE:
  const [bulkTab, setBulkTab] = useState<'json' | 'manual' | 'single'>('json')

  // AFTER:
  const [bulkTab, setBulkTab] = useState<'json' | 'manual' | 'single' | 'patch'>('json')
  ```

- [ ] **In `PhysicsQuestionEditor.tsx` line 1341**, change the tab array:
  ```ts
  // BEFORE:
  {(['json', 'manual', 'single'] as const).map(tab => (

  // AFTER:
  {(['json', 'manual', 'single', 'patch'] as const).map(tab => (
  ```

- [ ] **In the same tab button render** (line ~1356), update the label logic:
  ```ts
  // BEFORE:
  {tab === 'single' ? 'Single Paste' : tab.toUpperCase()}

  // AFTER:
  {tab === 'single' ? 'Single Paste' : tab === 'patch' ? 'Patch Figures' : tab.toUpperCase()}
  ```

- [ ] **Build check:** `npm run build` — expect zero TypeScript errors

---

### Task 8: Add patch tab state variables

- [ ] **Near the other bulk state variables** (after line ~195 where `bulkJson`, `bulkPreview`, etc. are declared), add:
  ```ts
  const patchFileRef = useRef<HTMLInputElement>(null)
  const [patchEntries, setPatchEntries] = useState<Array<{ id: string; questionImageBase64: string; questionImageMime: string }>>([])
  const [patchPreview, setPatchPreview] = useState<{ matched: number; unmatched: number; samples: string[] } | null>(null)
  const [patchApplied, setPatchApplied] = useState(false)
  const [patchError, setPatchError] = useState('')
  ```

---

### Task 9: Add `handlePatchFile` and `applyPatch` functions

- [ ] **Near the other handler functions** (around line ~360), add:

  ```ts
  // ── Patch Figures handler ─────────────────────────────────────────────────
  function handlePatchFile(file: File) {
    setPatchError('')
    setPatchPreview(null)
    setPatchApplied(false)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string)
        if (!Array.isArray(raw)) throw new Error('Expected a JSON array')
        const entries = raw.filter(
          (x): x is { id: string; questionImageBase64: string; questionImageMime: string } =>
            typeof x?.id === 'string' &&
            typeof x?.questionImageBase64 === 'string' &&
            typeof x?.questionImageMime === 'string'
        )
        if (entries.length === 0) throw new Error('No valid patch entries found')
        setPatchEntries(entries)

        // Preview: count matched vs unmatched
        const bankIds = new Set(questions.map(q => q.id))
        const matched = entries.filter(e => bankIds.has(e.id))
        const unmatched = entries.filter(e => !bankIds.has(e.id))
        if (unmatched.length > 0) {
          console.log(`[Patch] ${unmatched.length} unmatched IDs:`, unmatched.map(e => e.id))
        }
        const samples = matched.slice(0, 3).map(e => {
          const q = questions.find(q => q.id === e.id)
          return q ? q.questionText.slice(0, 60) + '…' : e.id
        })
        setPatchPreview({ matched: matched.length, unmatched: unmatched.length, samples })
      } catch (err: unknown) {
        setPatchError(err instanceof Error ? err.message : 'Failed to parse file')
      }
    }
    reader.readAsText(file)
  }

  function applyPatch() {
    if (!patchPreview || patchPreview.matched === 0) return
    const figureMap = new Map(patchEntries.map(e => [e.id, e]))
    const updated = questions.map(q => {
      const fig = figureMap.get(q.id)
      if (!fig) return q
      return { ...q, questionImageBase64: fig.questionImageBase64, questionImageMime: fig.questionImageMime }
    })
    onChange(updated)
    setPatchApplied(true)
  }
  ```

---

### Task 10: Add Patch Figures tab UI

- [ ] **After the `{bulkTab === 'single' && (...)}` block** (after line ~1498), add:

  ```tsx
  {/* ── Patch Figures tab ── */}
  {bulkTab === 'patch' && (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 0, marginBottom: 10, lineHeight: 1.5 }}>
        Upload <code>figures-patch.json</code> generated by{' '}
        <code>node scripts/generate-figures.mjs</code>. Matches by question ID and
        updates only the figure — session history and scores are untouched.
      </p>

      <input
        ref={patchFileRef}
        type="file"
        accept=".json"
        hidden
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) handlePatchFile(f)
          e.target.value = ''
        }}
      />

      {!patchApplied && (
        <button
          onClick={() => patchFileRef.current?.click()}
          style={{
            width: '100%', padding: '10px 16px', marginBottom: 12,
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 10, color: 'var(--text-primary)',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          📂 Choose figures-patch.json
        </button>
      )}

      {patchError && (
        <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{patchError}</div>
      )}

      {patchPreview && !patchApplied && (
        <div style={{
          padding: '12px 14px', background: 'var(--bg-primary)',
          border: '1px solid var(--border-color)', borderRadius: 10, marginBottom: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Preview
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
            ✅ <strong>{patchPreview.matched}</strong> questions matched
            {patchPreview.unmatched > 0 && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
                ({patchPreview.unmatched} unmatched — see console)
              </span>
            )}
          </div>
          {patchPreview.samples.map((s, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              · {s}
            </div>
          ))}
          <button
            onClick={applyPatch}
            style={{
              marginTop: 12, width: '100%', padding: '10px 16px',
              background: 'var(--accent-color, #F5A623)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Apply Patch ({patchPreview.matched} figures)
          </button>
        </div>
      )}

      {patchApplied && (
        <div style={{
          padding: '14px 16px', background: '#22c55e11',
          border: '1px solid #22c55e44', borderRadius: 10,
          fontSize: 14, color: '#22c55e', fontWeight: 600, textAlign: 'center',
        }}>
          ✅ {patchPreview?.matched} figures applied — close this panel and start practicing!
        </div>
      )}
    </div>
  )}
  ```

- [ ] **Build check:** `npm run build` — zero TypeScript errors

- [ ] **Commit:**
  ```bash
  git add src/components/physquiz/PhysicsQuestionEditor.tsx
  git commit -m "feat: add Patch Figures tab to Bulk Import

  Accepts figures-patch.json (generated by generate-figures.mjs),
  matches by question ID, updates only image fields.
  Leaves session history, SR intervals, and scores untouched.
  Preview step shows matched/unmatched counts before applying.

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
  ```

---

### Task 11: Deploy + verify in browser

- [ ] **Build and deploy:**
  ```bash
  cd C:\Users\johnn\Desktop\NousAI-App
  npm run build && vercel --prod --yes
  ```

- [ ] **Clear PWA cache** (run in browser console at nousai-app.vercel.app):
  ```js
  navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
  caches.keys().then(k => k.forEach(x => caches.delete(x)));
  ```

- [ ] **Verify Patch Figures tab:**
  1. Go to `#/learn` → Physics Practicum → Manage Bank → Bulk Import
  2. Confirm "PATCH FIGURES" tab appears next to JSON / MANUAL / SINGLE PASTE
  3. Click it — confirm description text and file upload button appear

- [ ] **Run the script for real:**
  ```bash
  node scripts/generate-figures.mjs
  ```
  Watch for progress output. If any questions fail SVG validation, they are skipped (warning logged) — this is expected for ~2–5% of edge cases.

- [ ] **Apply the patch:**
  1. Go to Manage Bank → Bulk Import → Patch Figures
  2. Upload `scripts/output/figures-patch.json`
  3. Confirm preview shows ~179 matched
  4. Click "Apply Patch"
  5. Start a practice session — verify figures appear on questions

- [ ] **Verify no history loss:**
  Check that `wrongCount`, `srInterval`, `srNextReview` are unchanged on questions that received figures.

---

## Post-Completion Checklist

- [ ] `node scripts/generate-figures.mjs --dry-run` prints correct counts
- [ ] Generated SVGs have dark background, amber/white strokes, show setup not answer
- [ ] Patch tab: unmatched IDs logged to browser console, not shown as errors to user
- [ ] `npm run build` passes with zero TypeScript errors
- [ ] Production deploy live at https://nousai-app.vercel.app
