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
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY
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

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const isDryRun = process.argv.includes('--dry-run')

  // Key check — only required for actual API calls, not dry-run
  if (!isDryRun && !OPENROUTER_KEY) {
    console.error('❌  OPENROUTER_API_KEY not set. Add it to .env or export it.')
    process.exit(1)
  }

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
