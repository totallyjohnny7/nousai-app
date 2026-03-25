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

const COST_PER_1M = { input: 0.10, output: 0.40 }
export function estimateCost(t: { input: number; output: number }) {
  const i = (t.input / 1e6) * COST_PER_1M.input
  const o = (t.output / 1e6) * COST_PER_1M.output
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
4. No external scripts, fonts, or resources. Everything inline.
5. File works 100% offline after download.

APPLIED SETTINGS:
- TONE: ${toneMap[s.profanity]}
- DEPTH: ${depthMap[s.depth]}
- DIAGRAMS: ${diagramMap[s.diagrams]}
- TRAPS: ${trapMap[s.traps]}
- ACCENT COLOR: ${s.color}
- BACKGROUND: ${s.colorBg}
- SHOW_SOURCES: ${s.showSources}

HTML PAGE ARCHITECTURE:
<head>
  <style>
    :root { --accent: ${s.color}; --bg: ${s.colorBg}; --text: #1a1a2e; }
    body { font-family: Georgia, serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
    .header { background: var(--accent); color: white; padding: 14px 20px; border-radius: 8px; margin-bottom: 20px; }
    .filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .filter-btn { background: white; color: var(--accent); border: 2px solid var(--accent); border-radius: 4px; padding: 5px 10px; font-size: 10px; cursor: pointer; font-family: 'Courier New', monospace; letter-spacing: 0.5px; }
    .filter-btn.active { background: var(--accent); color: white; }
    .card { border: 1.5px solid #ccc; border-radius: 6px; margin-bottom: 18px; overflow: hidden; background: white; }
    .card-header { background: var(--accent); color: white; font-family: 'Courier New', monospace; font-weight: bold; font-size: 13px; padding: 6px 12px; letter-spacing: 1px; }
    .card-body { display: flex; }
    .pl { padding: 12px 14px; font-size: 12.5px; line-height: 1.75; border-right: 1.5px solid #eee; width: 42%; box-sizing: border-box; }
    .pv { padding: 8px; display: flex; flex-direction: column; justify-content: center; align-items: center; background: #fafafa; width: 58%; box-sizing: border-box; }
    .trap { background: #fff3cd; border: 2px solid #f0a500; border-radius: 6px; padding: 8px 12px; font-size: 11.5px; font-family: monospace; color: #7a4f00; margin-top: 8px; }
    .download-bar { position: sticky; bottom: 20px; display: flex; gap: 10px; justify-content: center; margin-top: 20px; }
    .dl-btn { background: var(--accent); color: white; border: none; border-radius: 6px; padding: 10px 24px; font-size: 13px; cursor: pointer; }
    @media (max-width: 600px) { .card-body { flex-direction: column; } .pl, .pv { width: 100%; } }
  </style>
</head>

SECTION CARD PATTERN (use for EVERY concept):
<div class="card" data-section="SECTION_ID">
  <div class="card-header">TITLE IN CAPS</div>
  <div class="card-body">
    <div class="pl">
      <b>KEY TERM</b>: mnemonic_hook (academic term)<br><br>
      [facts, steps, comparisons]
      <div class="trap">⚠️ TRAP: [exact thing students get wrong]</div>
    </div>
    <div class="pv">
      <svg viewBox="0 0 300 [HEIGHT]" width="100%" style="max-width:300px;display:block">
        [STRUCTURAL DIAGRAM]
      </svg>
    </div>
  </div>
</div>

SVG DIAGRAM RULES:
A. viewBox="0 0 300 [H]" always set. width="100%". max-width:300px.
B. font-size: 6px min, 9px max.
C. Every text element: explicit x= y= textAnchor=.
D. Labels at DIFFERENT y coordinates (min 10px apart).
E. Arrowheads: use <defs><marker> pattern.
F. Diagram title: x=150 y=12 textAnchor="middle" font-size=8-9 font-weight=bold.
G. No element bleeds past x=295 or y=[HEIGHT-5].

FILTER + DOWNLOAD JS:
<script>
document.querySelectorAll('.filter-btn').forEach(b => {
  b.addEventListener('click', function() {
    const id = this.dataset.filter;
    document.querySelectorAll('.card').forEach(c => {
      c.style.display = (id === 'all' || c.dataset.section === id) ? '' : 'none';
    });
    document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
    this.classList.add('active');
  });
});
document.getElementById('dl-btn')?.addEventListener('click', () => {
  const blob = new Blob([document.documentElement.outerHTML], {type:'text/html'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'study_guide.html';
  a.click();
  URL.revokeObjectURL(a.href);
});
</script>

QUALITY CHECKLIST:
[ ] Every .card has an SVG in .pv with real structural content
[ ] No SVG text overlaps
[ ] filter-btn data-filter matches card data-section
[ ] Every concept has a mnemonic in the specified tone format
[ ] Trap boxes on every potential misconception
[ ] Trap summary box at bottom lists all traps numbered
[ ] Download button with id="dl-btn" present
[ ] Valid HTML — all tags closed`
}

/* ── OpenRouter API Call ──────────────────────────────────── */
export async function callOpenRouter(
  apiKey: string, model: string, systemPrompt: string, userMsg: string, maxTokens: number,
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
  const data = await resp.json()
  const content: string = (data as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content || ''
  return content
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

/* ── Model Options ────────────────────────────────────────── */
export const MODELS = [
  { id: 'google/gemini-2.5-flash-preview', label: 'Gemini 2.5 Flash (recommended)' },
  { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro (highest quality)' },
  { id: 'mistralai/mistral-small-latest', label: 'Mistral Small (fast/cheap)' },
  { id: 'mistralai/mistral-large-latest', label: 'Mistral Large' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { id: 'openai/gpt-4o', label: 'GPT-4o' },
  { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
  { id: 'anthropic/claude-haiku-3.5', label: 'Claude 3.5 Haiku (fast)' },
  { id: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash (legacy)' },
]
