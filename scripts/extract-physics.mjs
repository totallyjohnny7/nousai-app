/**
 * extract-physics.mjs
 *
 * One-time batch extraction script for Physics Practicum.
 * Extracts end-of-chapter questions from chapter PDFs, matches answers from the
 * Stuvia solutions manual, and outputs JSON files ready for JSON Bulk Import.
 *
 * Usage:
 *   node scripts/extract-physics.mjs
 *
 * Requires env vars (or .env file in project root):
 *   MISTRAL_API_KEY   — for Mistral OCR
 *   ANTHROPIC_API_KEY — for question/solution extraction (or OPENAI_API_KEY)
 *
 * Output: scripts/output/chapter19.json, chapter20.json, chapter21.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const OUTPUT_DIR = path.join(__dirname, 'output')

// ─── Load .env if present ──────────────────────────────────────────────────

function loadDotEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?([^"#\n]*)"?\s*$/)
    if (m) process.env[m[1]] = m[2].trim()
  }
}

loadDotEnv()

// ─── Config ───────────────────────────────────────────────────────────────────

const MISTRAL_KEY = process.env.MISTRAL_API_KEY || process.env.VITE_MISTRAL_API_KEY
const AI_KEY =
  process.env.ANTHROPIC_API_KEY ||
  process.env.OPENROUTER_API_KEY ||
  process.env.OPENAI_API_KEY
const USE_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const USE_OPENROUTER = !USE_ANTHROPIC && !!process.env.OPENROUTER_API_KEY
// Default OpenRouter model — change via OPENROUTER_MODEL env var
// Using Gemini 3 Flash Preview — latest Gemini Flash on OpenRouter (verified Dec 17 2025).
// To change, set OPENROUTER_MODEL in .env. Always check https://openrouter.ai/models for newest IDs.
// RULE: Never use Claude/Anthropic models via OpenRouter.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-3-flash-preview'

if (!MISTRAL_KEY) {
  console.error('❌  MISTRAL_API_KEY not set. Add it to .env or export it before running.')
  process.exit(1)
}
if (!AI_KEY) {
  console.error('❌  ANTHROPIC_API_KEY, OPENROUTER_API_KEY, or OPENAI_API_KEY not set. Add one to .env.')
  process.exit(1)
}

const CHAPTERS = [
  {
    num: '19',
    pdf: path.join(
      'C:/Users/johnn/Desktop/School Stuff/OneDrive - University of Nebraska/Documents/Obsidian Vault/CortexAI-Library',
      'chapter19.pdf',
    ),
  },
  {
    num: '20',
    // Copied to a clean path (original was in a folder with special chars that confused fs.existsSync)
    pdf: path.join('C:/Users/johnn/Downloads', 'chapter20physics.pdf'),
  },
  {
    num: '21',
    pdf: path.join('C:/Users/johnn/Downloads', 'chapter21physics.pdf'),
  },
]

const SOLUTIONS_PDF = path.join(
  'C:/Users/johnn/Downloads',
  'Stuvia-3503215-solutions-for-college-physics-11th-edition-by-hugh-d-young.pdf',
)

// ─── Failsafe 1: Estimate PDF page count from binary ─────────────────────────
// Counts /Page objects in the PDF binary — not 100% exact but good enough for
// cost warnings. Avoids needing a PDF library.

function estimatePdfPages(pdfPath) {
  try {
    const buf = fs.readFileSync(pdfPath)
    const text = buf.toString('latin1')
    // PDF page count is stored in /Count N inside the Pages dictionary
    const m = text.match(/\/Count\s+(\d+)/)
    if (m) return parseInt(m[1], 10)
    // Fallback: count /Type /Page occurrences
    return (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length
  } catch {
    return null
  }
}

// ─── Failsafe 2: OCR cache — write to disk immediately after Mistral responds ─
// Cache file: scripts/output/ocr-cache-<basename>.json
// Keyed on the absolute path so different files never collide.
// Images stored as plain object (Map → Object for JSON).
//
// This is the PRIMARY protection against the $13 re-billing scenario:
// if the script crashes after OCR but before writing chapter JSON,
// the next run loads from cache instead of calling Mistral again.

function ocrCachePath(pdfPath) {
  const slug = path.basename(pdfPath, path.extname(pdfPath)).replace(/[^a-z0-9]/gi, '-')
  return path.join(OUTPUT_DIR, `ocr-cache-${slug}.json`)
}

function loadOcrCache(pdfPath) {
  const cp = ocrCachePath(pdfPath)
  if (!fs.existsSync(cp)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(cp, 'utf8'))
    // Restore Map from plain object
    const images = new Map(Object.entries(raw.images ?? {}))
    console.log(`  📦 Loaded OCR cache (${raw.markdown?.length ?? 0} chars, ${images.size} images) — no Mistral charge`)
    return { markdown: raw.markdown, images }
  } catch {
    console.warn(`  ⚠️  OCR cache corrupt, will re-OCR: ${path.basename(cp)}`)
    return null
  }
}

function saveOcrCache(pdfPath, markdown, images) {
  const cp = ocrCachePath(pdfPath)
  const obj = { markdown, images: Object.fromEntries(images) }
  fs.writeFileSync(cp, JSON.stringify(obj), 'utf8')
  console.log(`  💾 OCR cached → ${path.basename(cp)} (safe to re-run — won't charge Mistral again)`)
}

// ─── Mistral OCR — with cache + cost warning ─────────────────────────────────

async function ocrPdf(pdfPath, withImages = false) {
  // Failsafe 2: Return from cache if available
  const cached = loadOcrCache(pdfPath)
  if (cached) return cached

  // Failsafe 1: Warn about cost before hitting API
  const pages = estimatePdfPages(pdfPath)
  const costEst = pages ? `~${pages} pages ≈ $${(pages * 0.002).toFixed(2)}` : 'unknown pages'
  console.log(`  📄 OCR: ${path.basename(pdfPath)} (${costEst}) — calling Mistral…`)

  const bytes = fs.readFileSync(pdfPath)
  const b64 = bytes.toString('base64')
  const dataUrl = `data:application/pdf;base64,${b64}`

  const body = {
    model: 'mistral-ocr-latest',
    document: { type: 'document_url', document_url: dataUrl },
    include_image_base64: withImages,
  }

  // Failsafe 3: Retry up to 3 times on transient errors (rate limits, 5xx)
  let res
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch('https://api.mistral.ai/v1/ocr', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MISTRAL_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    if (res.ok) break
    if (attempt < 3 && (res.status === 429 || res.status >= 500)) {
      const wait = attempt * 15_000
      console.warn(`  ⚠️  Mistral OCR attempt ${attempt} failed (${res.status}) — retrying in ${wait / 1000}s…`)
      await new Promise(r => setTimeout(r, wait))
    } else {
      const err = await res.json().catch(() => null)
      throw new Error(`Mistral OCR failed (${res.status}): ${err?.message ?? 'unknown'}`)
    }
  }

  const data = await res.json()
  const pageList = data.pages ?? []
  const markdown = pageList.map(p => p.markdown).join('\n\n')

  const imageMap = new Map()
  if (withImages) {
    for (const page of pageList) {
      for (const img of page.images ?? []) {
        imageMap.set(img.id, img.image_base64)
      }
    }
  }

  // Failsafe 2: Write cache immediately — before any downstream processing can fail
  saveOcrCache(pdfPath, markdown, imageMap)

  return { markdown, images: imageMap }
}

// ─── Find where end-of-chapter exercises start ───────────────────────────────

function findExercisesStart(markdown) {
  const patterns = [
    /\n#{1,3}\s*(exercises|problems|questions|additional problems)/i,
    /\nexercises\s*\n/i,
    /\nproblems\s*\n/i,
    /\n\s*1\s*\.\s*[\s\|]/,
  ]
  for (const re of patterns) {
    const m = markdown.search(re)
    if (m !== -1) return m
  }
  // Fallback: last 25k chars (exercises are always at the end of a chapter)
  return Math.max(0, markdown.length - 25_000)
}

// ─── Chunk text with overlap ──────────────────────────────────────────────────

function chunkText(text, size = 10_000, overlap = 500) {
  const chunks = []
  let i = 0
  while (i < text.length) {
    chunks.push(text.slice(i, i + size))
    i += size - overlap
  }
  return chunks
}

// ─── AI call (Anthropic or OpenAI) ───────────────────────────────────────────

async function callAI(systemPrompt, userContent, maxTokens = 8192) {
  if (USE_ANTHROPIC) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': AI_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error(`Anthropic API error (${res.status}): ${err?.error?.message ?? 'unknown'}`)
    }
    const data = await res.json()
    return data.content[0].text
  } else {
    const baseUrl = USE_OPENROUTER
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'
    const model = USE_OPENROUTER ? OPENROUTER_MODEL : 'gpt-4o'
    const extraHeaders = USE_OPENROUTER
      ? { 'HTTP-Referer': 'https://nousai-app.vercel.app', 'X-Title': 'NousAI Physics Extractor' }
      : {}

    const res = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AI_KEY}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      const label = USE_OPENROUTER ? 'OpenRouter' : 'OpenAI'
      throw new Error(`${label} API error (${res.status}): ${err?.error?.message ?? 'unknown'}`)
    }
    const data = await res.json()
    return data.choices[0].message.content
  }
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

const TEXTBOOK_CHAPTER_PROMPT = `You are extracting END-OF-CHAPTER exercises from Young's College Physics 11th edition.
Copy question text VERBATIM — do not paraphrase or summarize any part of the question.

Return ONLY a JSON array with no markdown fences. Include ONLY numbered exercises from the
"Questions", "Exercises", "Problems", and "Additional Problems" sections at the END of the chapter.
Do NOT include mid-chapter Examples, Checkpoints, or "Test Your Understanding" boxes.

Each object must have exactly these fields:
{
  "qNum": <integer question number>,
  "questionText": "<verbatim text, all math as LaTeX: $inline$ or $$display$$>",
  "questionType": "mcq" | "free-response" | "multi-part",
  "topic": "mechanics" | "kinematics" | "thermodynamics" | "waves" | "optics" | "electromagnetism" | "circuits" | "modern" | "nuclear" | "other",
  "difficulty": <integer 1-5: no bar→2, one bar (|)→3, two bars (||)→4, three bars (|||)→5>,
  "expectedAnswer": "",
  "choices": [],
  "parts": [],
  "figureRef": "<image filename from markdown like 'img-3.jpeg', or null if no figure>"
}

Rules:
- Multi-part questions (a), (b), (c): set questionType to "multi-part" and populate "parts": [{"label":"a","question":"<verbatim>","expectedAnswer":""}]
- Math symbols: use LaTeX — Ω→$\\Omega$, μ→$\\mu$, ε→$\\varepsilon$, °→^{\\circ}, etc.
- If a question references "Figure X.XX", set "figureRef" to the nearest image id in the markdown (e.g. "img-3.jpeg")
- Difficulty bars appear before the question number as | or || or |||
- Return empty array [] if no end-of-chapter exercises are visible in this chunk`

const SOLUTIONS_PROMPT = `You are extracting solutions from a physics solutions manual for College Physics 11th edition by Young.
Return ONLY a JSON array with no markdown fences.

For each solution found, return:
{
  "chapter": <integer>,
  "qNum": <integer>,
  "answer": "<concise final answer including numerical value and units, e.g. '2.50 V, r = 0.600 Ω'>"
}

Extract solutions for chapters 19, 20, and 21 only.
If a solution has multiple parts (a), (b), etc., combine them: "a) 2.50 V  b) 1.94 V"
Return empty array [] if no relevant solutions found in this segment.`

// ─── Parse JSON safely ────────────────────────────────────────────────────────

function parseJsonArray(text) {
  // Strip code fences
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  }
  // Find first [...] array
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ─── Extract questions from chapter markdown ──────────────────────────────────

async function extractChapterQuestions(markdown, images, chapterNum) {
  const exercisesStart = findExercisesStart(markdown)
  const exercisesText = markdown.slice(exercisesStart)
  console.log(`    ✂️  Exercises section starts at char ${exercisesStart} / ${markdown.length} total`)

  const chunks = chunkText(exercisesText, 10_000, 500)
  console.log(`    🔀 Processing ${chunks.length} chunk(s)…`)

  const allRaw = []
  for (let i = 0; i < chunks.length; i++) {
    console.log(`       chunk ${i + 1}/${chunks.length}…`)
    const raw = await callAI(
      TEXTBOOK_CHAPTER_PROMPT,
      `Extract all end-of-chapter exercises from this segment of Chapter ${chapterNum}:\n\n${chunks[i]}`,
    )
    const parsed = parseJsonArray(raw)
    allRaw.push(...parsed)
  }

  // Deduplicate by qNum (first occurrence wins)
  const seen = new Set()
  const deduped = []
  for (const q of allRaw) {
    const key = typeof q.qNum === 'number' ? q.qNum : String(q.questionText ?? '').slice(0, 40)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(q)
    }
  }
  deduped.sort((a, b) => (a.qNum ?? 0) - (b.qNum ?? 0))
  console.log(`    ✅ ${deduped.length} unique questions extracted`)

  // Build PhysicsQuestion-compatible objects
  const today = new Date().toISOString().split('T')[0]
  return deduped.map(raw => {
    const q = {
      id: `phq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      questionText: String(raw.questionText ?? ''),
      questionType: ['mcq', 'free-response', 'multi-part'].includes(raw.questionType)
        ? raw.questionType
        : 'free-response',
      topic: [
        'mechanics', 'kinematics', 'thermodynamics', 'waves', 'optics',
        'electromagnetism', 'circuits', 'modern', 'nuclear', 'other',
      ].includes(raw.topic) ? raw.topic : 'other',
      difficulty: typeof raw.difficulty === 'number' && raw.difficulty >= 1 && raw.difficulty <= 5
        ? Math.round(raw.difficulty)
        : 3,
      source: 'json-import',
      tags: [],
      expectedAnswer: typeof raw.expectedAnswer === 'string' ? raw.expectedAnswer : '',
      choices: Array.isArray(raw.choices) ? raw.choices.filter(c => typeof c === 'string') : [],
      parts: Array.isArray(raw.parts) ? raw.parts : [],
      chapterTag: String(chapterNum),
      examTag: '',
      dateAdded: today,
      wrongCount: 0,
      _qNum: typeof raw.qNum === 'number' ? raw.qNum : null,
    }

    // Attach figure image if present
    const figRef = typeof raw.figureRef === 'string' ? raw.figureRef : null
    if (figRef && images.has(figRef)) {
      q.questionImageBase64 = images.get(figRef)
      q.questionImageMime = figRef.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    }

    return q
  })
}

// ─── Extract solutions ────────────────────────────────────────────────────────

async function extractSolutions(solutionsMarkdown) {
  console.log('  🔍 Extracting chapter 19/20/21 solutions…')
  const chunks = chunkText(solutionsMarkdown, 12_000, 1_000)
  console.log(`    🔀 Processing ${chunks.length} chunk(s)…`)

  const allSolutions = []
  for (let i = 0; i < chunks.length; i++) {
    console.log(`       chunk ${i + 1}/${chunks.length}…`)
    const raw = await callAI(
      SOLUTIONS_PROMPT,
      `Extract solutions for chapters 19, 20, 21 from this segment:\n\n${chunks[i]}`,
    )
    const parsed = parseJsonArray(raw)
    allSolutions.push(...parsed)
  }

  // Build lookup: "ch-qNum" → answer
  const lookup = new Map()
  for (const s of allSolutions) {
    if (s.chapter && s.qNum) {
      const key = `${s.chapter}-${s.qNum}`
      if (!lookup.has(key)) lookup.set(key, String(s.answer ?? ''))
    }
  }
  console.log(`  ✅ ${lookup.size} solutions found for ch. 19/20/21`)
  return lookup
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const SOLUTIONS_CACHE = path.join(OUTPUT_DIR, 'solutions-cache.json')

async function loadOrExtractSolutions() {
  // Reuse cached solutions to avoid re-OCR-ing the 500-page solutions manual every run.
  // Cache includes ALL chapters from the solutions manual — run once, reuse forever.
  if (fs.existsSync(SOLUTIONS_CACHE)) {
    console.log(`  📦 Loading cached solutions from ${path.basename(SOLUTIONS_CACHE)}…`)
    const raw = JSON.parse(fs.readFileSync(SOLUTIONS_CACHE, 'utf8'))
    const lookup = new Map()
    for (const [key, value] of Object.entries(raw)) lookup.set(key, String(value))
    console.log(`  ✅ ${lookup.size} cached solutions loaded`)
    return lookup
  }
  console.log('📚 Step 1: OCR solutions PDF (first run — will cache for future)…')
  const { markdown: solutionsMarkdown } = await ocrPdf(SOLUTIONS_PDF, false)
  console.log(`  OCR complete — ${solutionsMarkdown.length} chars`)
  const lookup = await extractSolutions(solutionsMarkdown)
  // Save full solutions cache (all chapters) — reuse for future chapter imports
  const obj = Object.fromEntries(lookup)
  fs.writeFileSync(SOLUTIONS_CACHE, JSON.stringify(obj, null, 2), 'utf8')
  console.log(`  💾 Solutions cached to ${SOLUTIONS_CACHE} (${lookup.size} entries)`)
  return lookup
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  const aiProvider = USE_ANTHROPIC ? 'Anthropic' : USE_OPENROUTER ? `OpenRouter (${OPENROUTER_MODEL})` : 'OpenAI'
  console.log('\n🚀 Physics Chapter Extractor')
  console.log(`   OCR: Mistral  |  AI: ${aiProvider}`)
  if (isDryRun) console.log('   ⚡ DRY-RUN MODE — no API calls will be made\n')
  else console.log('')

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  // ── Failsafe 4: Pre-flight cost audit ─────────────────────────────────────
  // Before making any API call, scan every PDF that would be OCR'd and print
  // an itemised cost estimate. Cached PDFs show $0.00. This prevents surprise
  // bills — you see the total before anything runs.
  {
    const allPdfs = [
      { label: 'Solutions manual', pdfPath: SOLUTIONS_PDF, cacheFile: SOLUTIONS_CACHE },
      ...CHAPTERS.map(ch => ({
        label: `Chapter ${ch.num}`,
        pdfPath: ch.pdf,
        cacheFile: ocrCachePath(ch.pdf),
      })),
    ]
    let totalEstimate = 0
    let anythingUncached = false
    console.log('💰 Cost audit (Mistral OCR @ $0.002/page):')
    for (const { label, pdfPath, cacheFile } of allPdfs) {
      const hasCacheOrOutput = fs.existsSync(cacheFile) ||
        (label.startsWith('Chapter') && fs.existsSync(path.join(OUTPUT_DIR, `chapter${label.split(' ')[1]}.json`)))
      if (hasCacheOrOutput) {
        console.log(`   ✅ ${label}: $0.00 (cached)`)
      } else if (!fs.existsSync(pdfPath)) {
        console.log(`   ⚠️  ${label}: PDF not found — will skip`)
      } else {
        const pages = estimatePdfPages(pdfPath)
        const cost = pages ? pages * 0.002 : null
        const costStr = cost != null ? `~$${cost.toFixed(2)} (~${pages} pages)` : 'unknown pages'
        console.log(`   🆕 ${label}: ${costStr} — WILL CALL MISTRAL`)
        if (cost) totalEstimate += cost
        anythingUncached = true
      }
    }
    if (anythingUncached) {
      console.log(`   ─────────────────────────────────────────────`)
      console.log(`   📊 Estimated new charges: ~$${totalEstimate.toFixed(2)}`)
    } else {
      console.log(`   📊 All cached — estimated new charges: $0.00`)
    }
    console.log('')

    // Failsafe 5: Dry-run exits here — shows full plan with zero API cost
    if (isDryRun) {
      console.log('✅ Dry-run complete. Run without --dry-run to execute.')
      return
    }
  }

  // Step 1 & 2: Load or extract solutions (cached after first run)
  const solutionLookup = await loadOrExtractSolutions()

  // Step 3: Process each chapter
  for (const ch of CHAPTERS) {
    console.log(`\n📖 Chapter ${ch.num}: ${path.basename(ch.pdf)}`)

    const outPath = path.join(OUTPUT_DIR, `chapter${ch.num}.json`)
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'))
      console.log(`  ✅ Already extracted (${existing.length} questions) — skipping. Delete ${path.basename(outPath)} to re-run.`)
      continue
    }

    if (!fs.existsSync(ch.pdf)) {
      console.warn(`  ⚠️  PDF not found, skipping: ${ch.pdf}`)
      continue
    }

    // OCR with images (cache hit = free, cache miss = Mistral charge)
    console.log('  🔬 OCR with image extraction…')
    const { markdown, images } = await ocrPdf(ch.pdf, true)
    console.log(`  OCR complete — ${markdown.length} chars, ${images.size} images`)

    // Extract questions
    console.log('  🤖 Extracting questions…')
    const questions = await extractChapterQuestions(markdown, images, ch.num)

    // Match solutions
    let matched = 0
    for (const q of questions) {
      if (q._qNum !== null) {
        const key = `${ch.num}-${q._qNum}`
        const answer = solutionLookup.get(key)
        if (answer) {
          q.expectedAnswer = answer
          matched++
        }
      }
      delete q._qNum // clean up internal field
    }
    console.log(`  🔗 ${matched}/${questions.length} questions matched with solutions`)

    // Write output
    fs.writeFileSync(outPath, JSON.stringify(questions, null, 2), 'utf8')
    console.log(`  💾 Saved: ${outPath} (${questions.length} questions)`)
  }

  console.log('\n✅ Done! Import the JSON files via Physics Practicum → Question Bank → Bulk Import')
  console.log(`   Output directory: ${OUTPUT_DIR}`)
}

main().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
