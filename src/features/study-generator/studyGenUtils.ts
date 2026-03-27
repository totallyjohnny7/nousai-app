/* ── CDN Script Loading ────────────────────────────────────── */
const CDN = {
  pdfjs:     'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  pdfjsW:    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  tesseract: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js',
  jszip:     'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
}

const loaded: Record<string, Promise<void>> = {}
function loadScript(src: string): Promise<void> {
  if (!loaded[src]) {
    loaded[src] = new Promise((res, rej) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = () => res()
      s.onerror = () => { delete loaded[src]; rej(new Error(`Failed to load: ${src}`)) }
      document.head.appendChild(s)
    })
  }
  return loaded[src]
}

/* ── Token Math ───────────────────────────────────────────── */
const DEPTH_OUT: Record<string, number> = { overview: 5000, deep: 16000, 'exam-only': 9000 }
const SYS_TOKENS = 3600

export function estimateTokens(text: string, depth: string) {
  const input = Math.ceil(text.length / 3.8) + SYS_TOKENS + 600
  const output = DEPTH_OUT[depth] || 10000
  return { input, output, total: input + output }
}

// Fallback pricing (Gemini Flash) when model-specific pricing unavailable
const FALLBACK_COST_PER_1M = { input: 0.10, output: 0.40 }
export function estimateCost(
  t: { input: number; output: number },
  pricing?: { promptPrice?: number; completionPrice?: number },
) {
  // pricing values are per-token from OpenRouter; convert to per-million for calculation
  const inputRate = pricing?.promptPrice != null && pricing.promptPrice > 0
    ? pricing.promptPrice * 1e6 : FALLBACK_COST_PER_1M.input
  const outputRate = pricing?.completionPrice != null && pricing.completionPrice > 0
    ? pricing.completionPrice * 1e6 : FALLBACK_COST_PER_1M.output
  const i = (t.input / 1e6) * inputRate
  const o = (t.output / 1e6) * outputRate
  return { input: i, output: o, total: i + o }
}

/* ── File Extractors ──────────────────────────────────────── */
declare const pdfjsDist: { GlobalWorkerOptions: { workerSrc: string }; getDocument: (o: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> } }
interface PdfDoc { numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str: string }[] }> }> }

export async function extractPDF(file: File, onProgress: (s: string) => void): Promise<string> {
  await loadScript(CDN.pdfjs)
  const lib = (window as unknown as Record<string, unknown>)['pdfjs-dist/build/pdf'] as typeof pdfjsDist
  lib.GlobalWorkerOptions.workerSrc = CDN.pdfjsW
  const ab = await file.arrayBuffer()
  const pdf = await lib.getDocument({ data: ab }).promise
  let text = `[SOURCE: ${file.name} — ${pdf.numPages} pages]\n\n`
  const maxPages = Math.min(pdf.numPages, 60)
  for (let i = 1; i <= maxPages; i++) {
    onProgress(`PDF: page ${i}/${pdf.numPages}...`)
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += `--- Page ${i} ---\n`
    text += content.items.map((it) => it.str).join(' ') + '\n\n'
  }
  return text
}

export async function extractImage(file: File, onProgress: (s: string) => void): Promise<string> {
  onProgress(`OCR: ${file.name}...`)
  await loadScript(CDN.tesseract)
  const Tesseract = (window as unknown as Record<string, unknown>).Tesseract as {
    recognize: (f: File, lang: string, opts: { logger: (m: { status: string; progress: number }) => void }) => Promise<{ data: { text: string } }>
  }
  const { data: { text } } = await Tesseract.recognize(file, 'eng', {
    logger: (m) => { if (m.status === 'recognizing text') onProgress(`OCR ${file.name}: ${Math.round(m.progress * 100)}%`) },
  })
  return `[SOURCE: ${file.name} (OCR)]\n${text}\n`
}

export async function extractPPTX(file: File, onProgress: (s: string) => void): Promise<string> {
  onProgress(`Parsing PPTX: ${file.name}...`)
  await loadScript(CDN.jszip)
  const JSZip = (window as unknown as Record<string, unknown>).JSZip as { loadAsync: (d: ArrayBuffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> }
  const ab = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(ab)
  const slideRe = /^ppt\/slides\/slide\d+\.xml$/
  const slideFiles = Object.keys(zip.files)
    .filter((n) => slideRe.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '0')
      const nb = parseInt(b.match(/\d+/)?.[0] || '0')
      return na - nb
    })
  let text = `[SOURCE: ${file.name} — ${slideFiles.length} slides]\n\n`
  for (const sf of slideFiles) {
    const xml = await zip.files[sf].async('string')
    const slideNum = sf.match(/slide(\d+)/)?.[1] || '?'
    text += `--- Slide ${slideNum} ---\n`
    const tags = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
    text += tags.map((t) => t.replace(/<[^>]+>/g, '')).join(' ') + '\n\n'
  }
  return text
}

export async function extractDOCX(file: File, onProgress: (s: string) => void): Promise<string> {
  onProgress(`Parsing DOCX: ${file.name}...`)
  await loadScript(CDN.jszip)
  const JSZip = (window as unknown as Record<string, unknown>).JSZip as { loadAsync: (d: ArrayBuffer) => Promise<{ files: Record<string, { async: (t: string) => Promise<string> }> }> }
  const ab = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(ab)
  const docXml = await zip.files['word/document.xml']?.async('string')
  if (!docXml) return `[SOURCE: ${file.name}] (parse failed)\n`
  const paragraphs = docXml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []
  const lines = paragraphs
    .map((p) => {
      const texts = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
      return texts.map((t) => t.replace(/<[^>]+>/g, '')).join('')
    })
    .filter((l) => l.trim())
  return `[SOURCE: ${file.name}]\n${lines.join('\n')}\n`
}

async function extractText(file: File): Promise<string> {
  return `[SOURCE: ${file.name}]\n${await file.text()}\n`
}

export async function processFile(file: File, onProgress: (s: string) => void): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (ext === 'pdf') return extractPDF(file, onProgress)
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'gif'].includes(ext)) return extractImage(file, onProgress)
  if (ext === 'pptx') return extractPPTX(file, onProgress)
  if (ext === 'docx') return extractDOCX(file, onProgress)
  if (['txt', 'md', 'csv', 'json', 'xml', 'html', 'rtf'].includes(ext)) return extractText(file)
  return `[${file.name}] (${Math.round(file.size / 1024)}kb — unsupported type)\n`
}

/* ── System Prompt Builder ────────────────────────────────── */
export interface GenSettings {
  profanity: 'full' | 'mild' | 'clean'
  depth: 'deep' | 'exam-only' | 'overview'
  diagrams: 'full' | 'key' | 'minimal'
  traps: 'full' | 'exam'
  color: string
  colorBg: string
  showSources: boolean
  tokenLimit: number
}

export function buildSystemPrompt(s: GenSettings): string {
  const toneMap = {
    full: 'UNRESTRICTED — use crude/vulgar terms freely. Format: crude_term (academic_term). Parenthetical is MANDATORY.',
    mild: 'MILD PG-13 — use mild crude terms. Format: mild_term (academic_term). Parenthetical MANDATORY.',
    clean: 'CLEAN — use vivid analogies. Format: [analogy] (academic_term). Analogy MANDATORY.',
  }
  const depthMap = {
    deep: 'DEEP — full mechanism detail, all sub-steps, complete enzyme names, numbered flows',
    'exam-only': 'EXAM-ONLY — high-yield facts, most-tested content, trap-heavy',
    overview: 'OVERVIEW — broad strokes, one key point per concept',
  }
  const diagramMap = {
    full: 'EVERY section card MUST have an SVG diagram',
    key: 'Mechanism and comparison sections must have SVG diagrams',
    minimal: 'One overview diagram per major topic',
  }
  const trapMap = {
    full: 'Flag ALL potential misconceptions with trap boxes',
    exam: 'Flag only confirmed high-frequency exam traps',
  }

  return `You are a world-class study visual engineer. Your task: generate a COMPLETE, self-contained HTML study guide.

CRITICAL OUTPUT RULES — FOLLOW EXACTLY:
1. Output ONLY raw HTML. Start with <!DOCTYPE html>. End with </html>.
2. ZERO markdown. ZERO code fences. ZERO explanations. Just HTML.
3. All CSS in <style> in <head>. All JS in <script> before </body>.
4. ALLOWED CDN LIBRARIES (include ONLY the ones you actually use):
   ALWAYS include KaTeX for math:
   <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
   <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
   <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
   Then at bottom of body: <script>renderMathInElement(document.body, {delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}]});</script>
   OPTIONAL (include only when diagram complexity requires it):
   - D3.js v7: <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script> (for data-driven diagrams, phylogenetic trees, force-directed graphs)
   - Chart.js 4: <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script> (for labeled line/bar/scatter charts)
   - anime.js: <script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script> (for step-through animations in mechanisms)
5. For math/formulas: use $...$ (inline) and $$...$$ (display) LaTeX notation. KaTeX will render them.
6. File works offline after download (except CDN libs, which cache).
7. ALL animations: use requestAnimationFrame, never setInterval. Include play/pause if animated. Smooth easing: cubic-bezier(0.4,0,0.2,1).

LANGUAGE & FORMAT SUPPORT:
- Add <meta charset="UTF-8"> in <head> for full Unicode support.
- For Japanese content: use <span lang="ja"> for Japanese text. Include furigana with <ruby>漢字<rt>かんじ</rt></ruby>.
- For code/programming content: use <pre><code> with syntax highlighting via inline CSS.
- For chemical formulas: use subscript/superscript HTML (H<sub>2</sub>O).
- For musical notation or special symbols: use Unicode directly.

APPLIED SETTINGS:
- TONE: ${toneMap[s.profanity]}
- DEPTH: ${depthMap[s.depth]}
- DIAGRAMS: ${diagramMap[s.diagrams]}
- TRAPS: ${trapMap[s.traps]}
- ACCENT COLOR: ${s.color}
- BACKGROUND: ${s.colorBg}
- SHOW_SOURCES: ${s.showSources}

HTML PAGE ARCHITECTURE — UNIVERSAL TAB/BUTTON LAYOUT:

<head>
  <style>
    :root { --accent: ${s.color}; --bg: ${s.colorBg}; --text: #1a1a2e; --bg-card: #ffffff; --border: #ddd; --bg-hover: #f0f0f8; --shadow: 0 4px 24px rgba(0,0,0,0.06); --text-muted: #64748b; }
    html[data-theme="dark"] { --bg: #0a0e17; --text: #e2e8f0; --bg-card: #1a1f2e; --border: rgba(255,255,255,0.1); --bg-hover: #232a3b; --shadow: 0 4px 24px rgba(0,0,0,0.3); --text-muted: #94a3b8; }
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; line-height: 1.6; -webkit-font-smoothing: antialiased; transition: background 0.3s ease, color 0.3s ease; }
    .header { background: var(--accent); color: white; padding: 14px 20px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: var(--shadow); }
    .header h1 { margin: 0; font-size: 20px; letter-spacing: -0.02em; font-weight: 700; }
    .theme-toggle { background: rgba(255,255,255,0.2); border: none; color: white; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .theme-toggle:hover { background: rgba(255,255,255,0.3); }

    /* Navigation System */
    .controls-bar { position: sticky; top: 0; z-index: 100; background: var(--bg); padding: 8px 0; border-bottom: 2px solid var(--accent); margin-bottom: 12px; display: flex; gap: 8px; align-items: center; }
    .controls-bar .filter-btn { font-size: 11px; font-weight: bold; }
    .controls-bar input[type="text"] { flex: 1; max-width: 200px; padding: 5px 10px; border: 2px solid var(--accent); border-radius: 4px; font-size: 11px; font-family: 'Courier New', monospace; }

    .nav-section { margin-bottom: 8px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
    .nav-label { background: linear-gradient(135deg, var(--accent), #3f3794); color: white; padding: 8px 14px; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; letter-spacing: 1px; cursor: pointer; list-style: none; user-select: none; }
    .nav-label::-webkit-details-marker { display: none; }
    .nav-label::before { content: '▸ '; }
    details[open] > .nav-label::before { content: '▾ '; }
    .nav-buttons { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px; background: #f0f0f8; }

    .row-label { font-family: 'Courier New', monospace; font-size: 10px; font-weight: bold; color: var(--accent); text-transform: uppercase; letter-spacing: 1px; margin: 12px 0 6px 0; }
    .separator { border: none; border-top: 1px solid #ddd; margin: 8px 0; }

    .filter-btn { background: white; color: var(--accent); border: 2px solid var(--accent); border-radius: 4px; padding: 5px 10px; font-size: 10px; cursor: pointer; font-family: 'Courier New', monospace; letter-spacing: 0.5px; font-weight: bold; flex-shrink: 0; }
    .filter-btn.active { background: var(--accent); color: white; }
    .filter-btn.trap-btn { border-color: #f0a500; color: #7a4f00; }
    .filter-btn.trap-btn.active { background: #f0a500; color: white; }
    .ref-row { background: rgba(83,74,183,0.05); padding: 8px; border-radius: 6px; margin-top: 8px; }

    /* Cards */
    .chapter-divider { background: linear-gradient(135deg, var(--accent), #3f3794); color: white; padding: 12px 20px; border-radius: 8px; margin: 20px 0 12px 0; font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; letter-spacing: 2px; }
    .card { border: 1px solid var(--border); border-radius: 10px; margin-bottom: 18px; overflow: hidden; background: var(--bg-card); box-shadow: var(--shadow); transition: all 0.2s ease; }
    .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
    html[data-theme="dark"] .card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.4); }
    .card-header { background: var(--accent); color: white; font-family: system-ui, sans-serif; font-weight: 600; font-size: 13px; padding: 8px 14px; letter-spacing: 0.02em; }
    .card-body { display: flex; }
    .pl { padding: 14px 16px; font-size: 13px; line-height: 1.75; border-right: 1px solid var(--border); width: 42%; box-sizing: border-box; word-wrap: break-word; overflow-wrap: break-word; }
    .pv { padding: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: var(--bg-hover); width: 58%; box-sizing: border-box; overflow: visible; }
    .trap { background: #fff3cd; border: 2px solid #f0a500; border-radius: 8px; padding: 10px 14px; font-size: 12px; font-family: system-ui, sans-serif; color: #7a4f00; margin-top: 10px; }
    html[data-theme="dark"] .trap { background: rgba(245,158,11,0.1); border-color: #f59e0b; color: #fbbf24; }
    .exam-relevance { font-size: 11px; color: var(--text-muted); margin-top: 6px; font-style: italic; }
    .download-bar { position: sticky; bottom: 20px; display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
    .dl-btn { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 10px 24px; font-size: 13px; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; table-layout: auto; }
    th, td { padding: 8px 12px; border: 1px solid var(--border); text-align: left; word-wrap: break-word; overflow-wrap: break-word; }
    th { background: var(--accent); color: white; font-size: 11px; font-weight: 600; }
    td { font-size: 12.5px; }
    tr:nth-child(even) { background: var(--bg-hover); }
    svg { overflow: visible; }
    svg text { font-family: system-ui, sans-serif; }
    .info-panel { background: var(--bg-hover); border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; margin: 8px 0; font-size: 12px; }
    .info-panel summary { cursor: pointer; font-weight: 600; font-size: 12px; color: var(--accent); }
    @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
    @media print { body { background: white; color: black; } .controls-bar, .download-bar, .theme-toggle { display: none !important; } .card { break-inside: avoid; box-shadow: none; border: 1px solid #ccc; } }
    @media (max-width: 600px) { .card-body { flex-direction: column; } .pl, .pv { width: 100%; } .nav-buttons { gap: 4px; } .filter-btn { font-size: 9px; padding: 4px 8px; } body { padding: 10px; } }
  </style>
</head>

NAVIGATION LAYOUT — AUTO-DETECT FROM COURSE:
The navigation must be organized into these rows (auto-detect content from course type):

HEADER — must include theme toggle:
  <div class="header">
    <h1>[COURSE/TOPIC TITLE]</h1>
    <button class="theme-toggle" onclick="document.documentElement.dataset.theme=document.documentElement.dataset.theme==='dark'?'light':'dark';this.textContent=document.documentElement.dataset.theme==='dark'?'☀️':'🌙'" aria-label="Toggle theme">☀️</button>
  </div>

ROW 0 — CONTROLS (sticky top bar, always visible):
  <div class="controls-bar">
    <button class="filter-btn active" data-filter="all">SHOW ALL</button>
    <button class="filter-btn" id="collapse-all-btn">COLLAPSE ALL</button>
  </div>

ROW 1 — FOUNDATIONS (always visible, one row):
  <div class="nav-section"><div class="nav-buttons" style="background:transparent;padding:4px 0">
    <span class="row-label">FOUNDATIONS:</span>
    [Auto-detect from course type:]
    Language → WRITING SYSTEM | SCRIPT CHART | PRONUNCIATION buttons
    Math/Physics → UNITS | NOTATION | CORE FORMULAS buttons
    Bio/Chem → CELL BASICS | MACROMOLECULES | LAB METHODS buttons
    CS/Logic → NUMBER SYSTEMS | GATES | BOOLEAN BASICS buttons
    History → TIMELINE | KEY FIGURES | MAP buttons
  </div></div>

ROW 2+ — CHAPTERS (collapsible, one per chapter):
  <details class="nav-section">
    <summary class="nav-label">CH[X]: [CHAPTER TITLE]</summary>
    <div class="nav-buttons">
      [EVERY chapter gets these 6 core buttons in this order:]
      VOCAB | CONCEPTS | RULES | EXAMPLES | ⚠️ TRAPS | APPLY
      [Plus any subject-specific extras:]
      Language: KANJI | CONVERSATION | CULTURE
      Physics: LAB | DERIVATIONS | DIAGRAM
      Bio: PATHWAY | COMPARE TABLE | LAB
    </div>
  </details>
  DEFAULT: All chapters collapsed except the first one.

CROSS-UNIT ROW:
  <div class="nav-section"><div class="nav-buttons" style="background:transparent;padding:4px 0">
    <span class="row-label">CROSS-UNIT:</span>
    PATTERNS | MASTER TRAPS | COMPARE TABLES | FORMULA MAP
  </div></div>

TERM INDEX ROW:
  <div class="nav-section"><div class="nav-buttons" style="background:transparent;padding:4px 0">
    <span class="row-label">INDEXES:</span>
    [Auto-split by chapter count: 6ch → CH1-3 INDEX | CH4-6 INDEX]
  </div></div>

REFERENCE ROW (distinct background):
  <div class="ref-row"><div class="nav-buttons">
    <span class="row-label">REFERENCE:</span>
    REF VOCAB | REF RULES | REF TRAPS | REF PATTERNS
  </div></div>

PRACTICE ROW:
  <div class="nav-section"><div class="nav-buttons" style="background:transparent;padding:4px 0">
    <span class="row-label">PRACTICE:</span>
    [Auto-label based on course type:]
    Language → CONV CH1 | CONV CH2 | ...
    Math/Physics → PROB CH1 | PROB CH2 | ...
    Bio/Chem/History → QUIZ CH1 | QUIZ CH2 | ...
  </div></div>

SECTION CARD PATTERN — MAPPING TO CORE BUTTONS:
Each chapter's content cards map to the 6 core buttons:
- VOCAB → data-section="ch[X]-vocab" (vocabulary table for this chapter)
- CONCEPTS → data-section="ch[X]-concepts" (key terms, definitions, explanations)
- RULES → data-section="ch[X]-rules" (grammar rules, formulas, laws, patterns)
- EXAMPLES → data-section="ch[X]-examples" (worked examples, sample sentences)
- ⚠️ TRAPS → data-section="ch[X]-traps" (common mistakes, exceptions, warnings)
- APPLY → data-section="ch[X]-apply" (practice problems, exercises, application)

Additional subtopic cards use: data-section="ch[X]-[subtopic]"

Card HTML structure (same as before):
<div class="card" data-section="ch[X]-[type]">
  <div class="card-header">TITLE IN CAPS</div>
  <div class="card-body">
    <div class="pl">
      <b>KEY TERM</b>: mnemonic_hook (academic term)<br><br>
      [facts, steps, comparisons]
      <div class="trap">⚠️ TRAP: [exact thing students get wrong]</div>
    </div>
    <div class="pv">
      <svg viewBox="0 0 450 [HEIGHT]" width="100%" style="max-width:450px;display:block">
        [STRUCTURAL DIAGRAM]
      </svg>
    </div>
  </div>
</div>

BUTTON BEHAVIOR RULES:
1. Max 8 buttons per row. If more, wrap to next line under same label.
2. Active button = filled/highlighted. Inactive = outline only.
3. SHOW ALL = expand all chapters, show all content.
4. COLLAPSE ALL = collapse all chapter details elements.
5. Clicking a chapter label toggles that chapter's expand/collapse.
6. Clicking a content button shows ONLY that section, deactivates others.
7. Multiple chapters can be expanded at once.
8. ⚠️ TRAPS buttons get distinct amber/orange styling (class="filter-btn trap-btn").
9. Consistent button width within each row.
10. Mobile: buttons stack into 2-column grid, labels stay full-width.

SVG DIAGRAM RULES:
A. viewBox="0 0 450 [H]" default. width="100%". max-width:450px. For complex diagrams: viewBox="0 0 700 [H]" max-width:700px. Use the FULL width.
B. font-size: 8px min, 11px max. For Japanese text use 10-12px (CJK needs larger).
C. Every text element: explicit x= y= text-anchor=. NEVER place text where it overlaps another element.
D. Labels at DIFFERENT y coordinates (min 14px apart). Min 20px gap between horizontally adjacent labels.
E. Arrowheads: use <defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7"/></marker></defs> pattern.
F. Diagram title: x=center y=16 text-anchor="middle" font-size=11 font-weight=bold.
G. No element bleeds past x=[WIDTH-5] or y=[HEIGHT-5]. TEST: if any text would be cut off, move it inward.
H. For spatial/directional diagrams: use viewBox="0 0 500 400" minimum. Place labels WELL outside the center object with 30px+ margins.
I. NEVER truncate text. If a Japanese word or conjugation is long, widen the viewBox or use multiple lines.

SVG VISUAL QUALITY STANDARDS:
J. COLOR PALETTE per domain — use SEMANTIC colors (never random hex):
   Physics: gravity=#f43f5e, normal=#3b82f6, friction=#f59e0b, tension=#10b981, applied=#8b5cf6
   Biology: DNA=#3b82f6, RNA=#f97316, protein=#10b981, lipid=#f59e0b, ATP=#f43f5e, enzyme=#06b6d4
   Chemistry: metal=#3b82f6, nonmetal=#10b981, metalloid=#8b5cf6, noble-gas=#f59e0b
   Evolution: ancestral=#94a3b8, derived=#10b981, selected=#3b82f6, neutral=#f59e0b, deleterious=#f43f5e, speciation=#8b5cf6
K. PROPORTIONALITY: visual size MUST match data values. A 10N force = 2x length of 5N force. State scale if needed.
L. CONTAINERS: use rounded rects (rx=6-8) with subtle fill (#1a1f2e or #f0f0f8 for light) and 1px borders.
M. FLOW DIAGRAMS: step boxes connected by arrows with marker-end. Number each step. Add "If fails:" consequence note.
N. COMPARISON DIAGRAMS: side-by-side layout with color-coded borders (red vs green, or category-specific colors).
O. CYCLE DIAGRAMS: circular arrow layout with labeled nodes at compass points. Center label for cycle name.
P. TIMELINE DIAGRAMS: horizontal line with event markers above/below. Use color zones for phases.
Q. Every diagram MUST have: (1) descriptive title, (2) all elements labeled, (3) a legend if using 3+ colors.
R. Below each SVG: add a line "Exam relevance: [what a professor could ask about this diagram]" in muted text.

SCIENTIFIC ACCURACY — ALL DOMAINS:
- Equations: use KaTeX ($..$ or $$..$$). NEVER plain text for math. Proper symbols: Delta, arrows, subscripts.
- Units: SI default. Proper notation: m/s^2 not ms2. Use metric prefixes correctly.
- Vectors: arrow notation or bold. Arrow LENGTH proportional to magnitude.
- Chemical equations: proper subscripts, arrow types (single arrow irreversible, double equilibrium).
- Phylogenetic trees: root at left, tips at right, branch length proportional to divergence if phylogram.
- Free body diagrams: force arrows originate FROM object surface, length proportional to magnitude.

DOMAIN-SPECIFIC DIAGRAM TYPES (use when matching content detected):
- Physics: free body diagrams, circuit diagrams (IEEE symbols), wave/oscillation curves, field line diagrams, energy diagrams
- Biology: pathway cascades (ligand→receptor→cascade), membrane transport cross-sections, phylogenetic trees, cell cycle circles, gene regulation (operon/enhancer models)
- Chemistry: Lewis structures, VSEPR geometry, reaction energy diagrams (Ea, delta-H labeled), titration curves, orbital diagrams
- Evolution: selection type curves (directional/stabilizing/disruptive), Hardy-Weinberg plots, coevolution spirals, arms race escalation graphs
- Math: coordinate grids, function plots, geometric constructions with labeled angles/sides

FILTER + DOWNLOAD JS:
<script>
(function() {
  // Filter click handler
  document.querySelectorAll('.filter-btn[data-filter]').forEach(function(b) {
    b.addEventListener('click', function() {
      var id = this.getAttribute('data-filter');
      document.querySelectorAll('.card[data-section]').forEach(function(c) {
        c.style.display = (id === 'all' || c.getAttribute('data-section') === id) ? '' : 'none';
      });
      // Hide empty chapter dividers
      document.querySelectorAll('.chapter-divider').forEach(function(div) {
        if (id === 'all') { div.style.display = ''; return; }
        var next = div.nextElementSibling;
        var hasVisible = false;
        while (next && !next.classList.contains('chapter-divider')) {
          if (next.classList.contains('card') && next.style.display !== 'none') hasVisible = true;
          next = next.nextElementSibling;
        }
        div.style.display = hasVisible ? '' : 'none';
      });
      // Update active state
      document.querySelectorAll('.filter-btn[data-filter]').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
    });
  });
  // Collapse All button
  var collapseBtn = document.getElementById('collapse-all-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function() {
      document.querySelectorAll('details.nav-section').forEach(function(d) { d.removeAttribute('open'); });
    });
  }
  // Download button
  var dlBtn = document.getElementById('dl-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', function() {
      var allCards = document.querySelectorAll('.card[data-section]');
      var saved = [];
      allCards.forEach(function(c) { saved.push(c.style.display); c.style.display = ''; });
      var blob = new Blob([document.documentElement.outerHTML], {type:'text/html'});
      allCards.forEach(function(c, i) { c.style.display = saved[i]; });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'study_guide.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
    });
  }
})();
</script>

COMPLETENESS REQUIREMENT (CRITICAL):
- Extract EVERY vocabulary term, concept, keyword, definition, formula, and proper noun from the source material.
- EVERY chapter MUST have ALL 6 core sections: VOCAB, CONCEPTS, RULES, EXAMPLES, TRAPS, APPLY.
- At the END, add CROSS-UNIT sections: PATTERNS (recurring structures), MASTER TRAPS (all ⚠️ in one view), COMPARE TABLES.
- Add a COMPLETE TERM INDEX section: filterable alphabetical table with columns: Term | Reading/Definition | Section.
- Add PRACTICE sections: one per chapter (CONV for language, PROB for math/physics, QUIZ for other subjects).
- Add REFERENCE sections: REF VOCAB, REF RULES, REF TRAPS, REF PATTERNS.
- NEVER duplicate rows in indexes. Each term appears EXACTLY ONCE.
- For language courses: include ALL vocab with readings/translations, ALL grammar points, ALL conjugation patterns.

TABLE & CONJUGATION RULES:
- For conjugation tables: use <table> not SVG. Each cell must show the FULL text — NEVER truncate.
- For comparison tables: make columns wide enough for the longest entry.
- For Japanese text in tables: use font-size 13-14px (CJK renders smaller than Latin at same size).
- NEVER use overflow:hidden or text-overflow:ellipsis on table cells.

QUALITY CHECKLIST:
[ ] Every chapter has 6 core sections (vocab, concepts, rules, examples, traps, apply)
[ ] Every .card has data-section matching a nav button data-filter
[ ] Controls bar sticky at top with SHOW ALL + COLLAPSE ALL
[ ] Chapters are collapsible details elements
[ ] ⚠️ TRAPS buttons have trap-btn class (amber styling)
[ ] REFERENCE row has ref-row background tint
[ ] Every concept has a mnemonic in the specified tone format
[ ] SVG diagrams with no overlapping text
[ ] COMPLETE TERM INDEX at bottom with EVERY term from source
[ ] Download button with id="dl-btn" present
[ ] Valid HTML — all tags closed`
}

/* ── Filter JS injected into iframe after generation ────── */
export const FILTER_INJECT_JS = `
(function() {
  // Filter click handler for all buttons with data-filter
  document.querySelectorAll('.filter-btn[data-filter]').forEach(function(b) {
    b.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var id = this.getAttribute('data-filter');
      document.querySelectorAll('.card[data-section]').forEach(function(c) {
        c.style.display = (id === 'all' || c.getAttribute('data-section') === id) ? '' : 'none';
      });
      // Hide empty chapter dividers
      document.querySelectorAll('.chapter-divider').forEach(function(div) {
        if (id === 'all') { div.style.display = ''; return; }
        var next = div.nextElementSibling;
        var hasVisible = false;
        while (next && !next.classList.contains('chapter-divider')) {
          if (next.classList.contains('card') && next.style.display !== 'none') hasVisible = true;
          next = next.nextElementSibling;
        }
        div.style.display = hasVisible ? '' : 'none';
      });
      document.querySelectorAll('.filter-btn[data-filter]').forEach(function(x) { x.classList.remove('active'); });
      this.classList.add('active');
    });
  });
  // Collapse All
  var collapseBtn = document.getElementById('collapse-all-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function() {
      document.querySelectorAll('details.nav-section').forEach(function(d) { d.removeAttribute('open'); });
    });
  }
  // Download button
  var dlBtn = document.getElementById('dl-btn');
  if (dlBtn) {
    dlBtn.addEventListener('click', function() {
      var allCards = document.querySelectorAll('.card[data-section]');
      var saved = [];
      allCards.forEach(function(c) { saved.push(c.style.display); c.style.display = ''; });
      var blob = new Blob([document.documentElement.outerHTML], {type:'text/html'});
      allCards.forEach(function(c, i) { c.style.display = saved[i]; });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'study_guide.html';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 500);
    });
  }
  // Auto-generate nav buttons from data-section if no nav exists
  if (!document.querySelector('.controls-bar') && !document.querySelector('.filter-btn')) {
    var cards = document.querySelectorAll('.card[data-section]');
    var filterRow = document.querySelector('.filter-row');
    if (filterRow && cards.length > 0) {
      var sections = [];
      var seen = {};
      cards.forEach(function(c) {
        var s = c.getAttribute('data-section');
        if (s && !seen[s]) { seen[s] = true; sections.push(s); }
      });
      var allBtn = document.createElement('button');
      allBtn.className = 'filter-btn active';
      allBtn.setAttribute('data-filter', 'all');
      allBtn.textContent = 'Show All';
      filterRow.appendChild(allBtn);
      sections.forEach(function(s) {
        var btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter', s);
        btn.textContent = s.replace(/-/g, ' ').replace(/\\b\\w/g, function(c) { return c.toUpperCase(); });
        filterRow.appendChild(btn);
      });
      // Rebind click handlers
      document.querySelectorAll('.filter-btn[data-filter]').forEach(function(b) {
        b.addEventListener('click', function(e) {
          e.preventDefault();
          var id = this.getAttribute('data-filter');
          document.querySelectorAll('.card[data-section]').forEach(function(c) {
            c.style.display = (id === 'all' || c.getAttribute('data-section') === id) ? '' : 'none';
          });
          document.querySelectorAll('.filter-btn[data-filter]').forEach(function(x) { x.classList.remove('active'); });
          this.classList.add('active');
        });
      });
    }
  }
})();
`

/* ── OpenRouter API Call (streaming with progress) ────────── */
export async function callOpenRouter(
  apiKey: string, model: string, systemPrompt: string, userMsg: string, maxTokens: number,
  onProgress?: (chars: number, elapsed: number) => void,
): Promise<string> {
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'NousAI Study Visual Generator',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.65,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
    }),
  })
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error((err as { error?: { message?: string } }).error?.message || `HTTP ${resp.status}: ${resp.statusText}`)
  }

  const reader = resp.body!.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''
  const startTime = Date.now()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const jsonStr = trimmed.slice(5).trim()
      if (jsonStr === '[DONE]') continue
      try {
        const parsed = JSON.parse(jsonStr)
        const delta = parsed.choices?.[0]?.delta?.content || ''
        full += delta
        if (delta) onProgress?.(full.length, (Date.now() - startTime) / 1000)
      } catch { /* skip malformed chunks */ }
    }
  }

  return full
    .replace(/^```html?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()
}

/* ── Palettes ─────────────────────────────────────────────── */
export const PALETTES = [
  { name: 'Purple', hex: '#534AB7', bg: '#f8f7ff' },
  { name: 'Teal',   hex: '#0F6E56', bg: '#f3faf7' },
  { name: 'Coral',  hex: '#993C1D', bg: '#fdf5f0' },
  { name: 'Blue',   hex: '#185FA5', bg: '#f0f5ff' },
  { name: 'Green',  hex: '#1A7A4A', bg: '#f2faf5' },
  { name: 'Slate',  hex: '#2C3E6B', bg: '#f0f2fa' },
  { name: 'Rose',   hex: '#8B2252', bg: '#fdf0f5' },
  { name: 'Indigo', hex: '#3D2B8C', bg: '#f3f0ff' },
]

/* ── Model Options (dynamic from OpenRouter API) ─────────── */

export interface ModelOption {
  id: string
  label: string
  free?: boolean
  promptPrice?: number    // cost per token (from OpenRouter API)
  completionPrice?: number // cost per token (from OpenRouter API)
}

// Fallback models if API fetch fails
const FALLBACK_MODELS: ModelOption[] = [
  { id: 'openrouter/auto', label: 'Auto Router (best match)' },
  { id: 'openai/gpt-5.4-mini', label: 'GPT-5.4 Mini' },
  { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
  { id: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
  { id: 'openrouter/free', label: 'Free Router (random free model)', free: true },
]

// Providers to prioritize (in display order)
const PRIORITY_PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'mistralai', 'x-ai', 'meta-llama', 'qwen', 'nvidia']

// Cache: fetched models + timestamp
let _cachedModels: ModelOption[] | null = null
let _cacheTime = 0
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

/** Fetch latest models from OpenRouter API. Results cached for 30min. */
export async function fetchOpenRouterModels(apiKey?: string): Promise<ModelOption[]> {
  if (_cachedModels && Date.now() - _cacheTime < CACHE_TTL) return _cachedModels

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    const resp = await fetch('https://openrouter.ai/api/v1/models', { headers })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)

    const json = await resp.json()
    const raw: Array<{ id: string; name: string; pricing?: { prompt?: string; completion?: string }; context_length?: number }> = json.data || []

    // Build model list: Auto/Free routers first, then sorted by provider priority
    const models: ModelOption[] = [
      { id: 'openrouter/auto', label: 'Auto Router (best match)', promptPrice: 0, completionPrice: 0 },
      { id: 'openrouter/free', label: 'Free Router (random free model)', free: true, promptPrice: 0, completionPrice: 0 },
    ]

    // Group by provider, pick top models per provider
    const byProvider = new Map<string, typeof raw>()
    for (const m of raw) {
      const provider = m.id.split('/')[0]
      if (!provider || m.id.startsWith('openrouter/')) continue
      if (!byProvider.has(provider)) byProvider.set(provider, [])
      byProvider.get(provider)!.push(m)
    }

    // Add priority providers first (up to 4 models each), then others (up to 2 each)
    const added = new Set<string>()
    for (const provider of PRIORITY_PROVIDERS) {
      const providerModels = byProvider.get(provider) || []
      // Sort by context length descending (proxy for "newer/better")
      providerModels.sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      for (const m of providerModels.slice(0, 4)) {
        const isFree = m.id.endsWith(':free') || m.pricing?.prompt === '0'
        models.push({
          id: m.id, label: `${m.name}${isFree ? ' (free)' : ''}`, free: isFree,
          promptPrice: parseFloat(m.pricing?.prompt || '0'),
          completionPrice: parseFloat(m.pricing?.completion || '0'),
        })
        added.add(m.id)
      }
    }

    // Add remaining providers (up to 2 each)
    for (const [provider, providerModels] of byProvider) {
      if (PRIORITY_PROVIDERS.includes(provider)) continue
      providerModels.sort((a, b) => (b.context_length || 0) - (a.context_length || 0))
      for (const m of providerModels.slice(0, 2)) {
        if (added.has(m.id)) continue
        const isFree = m.id.endsWith(':free') || m.pricing?.prompt === '0'
        models.push({
          id: m.id, label: `${m.name}${isFree ? ' (free)' : ''}`, free: isFree,
          promptPrice: parseFloat(m.pricing?.prompt || '0'),
          completionPrice: parseFloat(m.pricing?.completion || '0'),
        })
      }
    }

    _cachedModels = models
    _cacheTime = Date.now()
    return models
  } catch {
    // API failed — return cached or fallback
    return _cachedModels || FALLBACK_MODELS
  }
}

/** Synchronous access to cached models (for initial render). */
export function getCachedModels(): ModelOption[] {
  return _cachedModels || FALLBACK_MODELS
}

// Legacy export for backwards compatibility
export const MODELS = FALLBACK_MODELS
