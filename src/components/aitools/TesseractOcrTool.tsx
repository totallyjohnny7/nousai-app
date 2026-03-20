import { useState, useRef, useCallback } from 'react';
import { ScanText, Download, Copy, Trash2, Languages, FileText } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import JSZip from 'jszip';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { copyText, inputStyle, selectStyle } from './shared';

// ── Types ────────────────────────────────────────────────────────────────────

interface PageResult {
  page: number;
  text: string;
  markdown: string;
}

interface FileResult {
  name: string;
  type: string;
  pages: PageResult[];
}

interface TsvRow {
  level: number;
  block_num: number;
  par_num: number;
  line_num: number;
  word_num: number;
  left: number;
  top: number;
  width: number;
  height: number;
  conf: number;
  text: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const LANGUAGES = [
  { code: 'eng', label: 'English' },
  { code: 'spa', label: 'Spanish' },
  { code: 'fra', label: 'French' },
  { code: 'deu', label: 'German' },
  { code: 'chi_sim', label: 'Chinese (Simplified)' },
  { code: 'jpn', label: 'Japanese' },
  { code: 'ara', label: 'Arabic' },
  { code: 'por', label: 'Portuguese' },
  { code: 'kor', label: 'Korean' },
];

const MAX_IMG_WIDTH = 2400;

// ── Image preprocessing ───────────────────────────────────────────────────────

function scaleAndPreprocess(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = img.width > MAX_IMG_WIDTH ? MAX_IMG_WIDTH / img.width : 1;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);

      // Grayscale + binarize (Otsu-style at threshold 128)
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = gray > 128 ? 255 : 0;
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

// ── TSV → Markdown layout reconstruction ─────────────────────────────────────

function parseTsv(tsv: string): TsvRow[] {
  const lines = tsv.trim().split('\n');
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    return {
      level: parseInt(cols[0]) || 0,
      block_num: parseInt(cols[2]) || 0,
      par_num: parseInt(cols[3]) || 0,
      line_num: parseInt(cols[4]) || 0,
      word_num: parseInt(cols[5]) || 0,
      left: parseInt(cols[6]) || 0,
      top: parseInt(cols[7]) || 0,
      width: parseInt(cols[8]) || 0,
      height: parseInt(cols[9]) || 0,
      conf: parseFloat(cols[10]) || 0,
      text: cols[11]?.trim() ?? '',
    };
  }).filter(r => r.level === 5 && r.conf > 30 && r.text.length > 0);
}

function tsvToMarkdown(tsv: string): string {
  const rows = parseTsv(tsv);
  if (!rows.length) return '';

  // Group: block → par → line → words
  type LineMap = Map<number, TsvRow[]>;
  type ParMap  = Map<number, LineMap>;
  type BlockMap = Map<number, ParMap>;

  const blocks: BlockMap = new Map();
  for (const row of rows) {
    if (!blocks.has(row.block_num)) blocks.set(row.block_num, new Map());
    const pars = blocks.get(row.block_num)!;
    if (!pars.has(row.par_num)) pars.set(row.par_num, new Map());
    const lines = pars.get(row.par_num)!;
    if (!lines.has(row.line_num)) lines.set(row.line_num, []);
    lines.get(row.line_num)!.push(row);
  }

  const parts: string[] = [];

  for (const [, pars] of Array.from(blocks.entries()).sort(([a], [b]) => a - b)) {
    for (const [, lines] of Array.from(pars.entries()).sort(([a], [b]) => a - b)) {
      const lineArr = Array.from(lines.entries())
        .sort(([a], [b]) => a - b)
        .map(([, words]) => words.sort((a, b) => a.left - b.left));

      if (!lineArr.length) continue;

      // Table detection: check if word left-x positions cluster into consistent columns
      const isTable = lineArr.length >= 2 && detectTableColumns(lineArr);

      if (isTable) {
        const cols = getColumnBuckets(lineArr);
        const mdRows = lineArr.map(words => {
          const cells = cols.map(colX => {
            const cell = words.filter(w => Math.abs(w.left - colX) < 60);
            return cell.map(w => w.text).join(' ');
          });
          return '| ' + cells.join(' | ') + ' |';
        });
        const sep = '| ' + cols.map(() => '---').join(' | ') + ' |';
        parts.push(mdRows[0] + '\n' + sep + '\n' + mdRows.slice(1).join('\n'));
      } else {
        // Regular paragraph — join words per line, add line breaks
        const text = lineArr.map(words => words.map(w => w.text).join(' ')).join('\n');
        // Short line at top might be a heading
        const firstLine = lineArr[0];
        const totalWords = firstLine.length;
        const isShort = totalWords <= 6;
        const isHeadline = isShort && firstLine[0]?.top < 200;
        parts.push(isHeadline ? `## ${text}` : text);
      }
    }
  }

  return parts.join('\n\n');
}

function detectTableColumns(lineArr: TsvRow[][]): boolean {
  if (lineArr.length < 2) return false;
  // Each line should have 2+ words, and x-positions should roughly align across lines
  const leftSets = lineArr.map(words => words.map(w => w.left));
  const allHaveMultiple = leftSets.every(s => s.length >= 2);
  if (!allHaveMultiple) return false;
  // Check if first-word left positions are consistent (within 80px) across lines
  const firstXs = leftSets.map(s => s[0]);
  const minX = Math.min(...firstXs);
  const maxX = Math.max(...firstXs);
  return (maxX - minX) < 80;
}

function getColumnBuckets(lineArr: TsvRow[][]): number[] {
  // Find representative x-positions for each column
  const allX = lineArr.flatMap(words => words.map(w => w.left)).sort((a, b) => a - b);
  const buckets: number[] = [];
  for (const x of allX) {
    if (!buckets.some(b => Math.abs(b - x) < 60)) buckets.push(x);
  }
  return buckets.sort((a, b) => a - b);
}

// ── PDF text extraction helpers ───────────────────────────────────────────────

async function getPdfjsLib() {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  return pdfjsLib;
}

interface PdfTextItem { str: string; transform: number[]; }

function layoutItemsToMarkdown(items: PdfTextItem[]): string {
  if (!items.length) return '';
  // Group by y-coordinate (within 4px tolerance = same line)
  const lines: PdfTextItem[][] = [];
  for (const item of items) {
    const y = item.transform[5];
    const existing = lines.find(l => l.length && Math.abs(l[0].transform[5] - y) < 4);
    if (existing) existing.push(item);
    else lines.push([item]);
  }
  // Sort lines top-to-bottom (higher y = higher on page in PDF coords)
  lines.sort((a, b) => b[0].transform[5] - a[0].transform[5]);
  return lines
    .map(line => line.sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str).join(' ').trim())
    .filter(l => l.length > 0)
    .join('\n');
}

// ── DOCX / PPTX extraction ────────────────────────────────────────────────────

async function extractDocx(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.file('word/document.xml')?.async('string') ?? '';
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function extractPptx(file: File): Promise<string[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideKeys = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const num = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? '0');
      return num(a) - num(b);
    });
  const pages: string[] = [];
  for (const key of slideKeys) {
    const xml = await zip.file(key)!.async('string');
    pages.push(xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return pages;
}

// ── Output builders ───────────────────────────────────────────────────────────

function buildMarkdown(results: FileResult[]): string {
  return results.map(f => {
    const header = `# ${f.name}\n`;
    const body = f.pages.map(p =>
      f.pages.length > 1 ? `## Page ${p.page}\n\n${p.markdown || p.text}` : (p.markdown || p.text)
    ).join('\n\n---\n\n');
    return header + body;
  }).join('\n\n===\n\n');
}

function buildPlainText(results: FileResult[]): string {
  return results.map(f => {
    const header = `=== ${f.name} ===\n`;
    const body = f.pages.map(p =>
      f.pages.length > 1 ? `--- Page ${p.page} ---\n${p.text}` : p.text
    ).join('\n\n');
    return header + body;
  }).join('\n\n');
}

// ── Main component ────────────────────────────────────────────────────────────

function TesseractOcrTool() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<FileResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [fileIdx, setFileIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [lang, setLang] = useState('eng');
  const [done, setDone] = useState(false);
  const workerRef = useRef<TesseractWorker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...arr.filter(f => !existing.has(f.name + f.size))];
    });
    setDone(false);
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function processAll() {
    if (!files.length || processing) return;
    abortRef.current = false;
    setProcessing(true);
    setResults([]);
    setDone(false);

    // Create Tesseract worker once
    let worker: TesseractWorker | null = null;
    try {
      worker = await createWorker(lang, 1, {
        logger: (m: { status: string; progress: number }) => {
          setStatusMsg(m.status);
          setProgress(Math.round((m.progress ?? 0) * 100));
        },
      });
      workerRef.current = worker;

      const allResults: FileResult[] = [];

      for (let fi = 0; fi < files.length; fi++) {
        if (abortRef.current) break;
        const file = files[fi];
        setFileIdx(fi);
        setStatusMsg(`Processing file ${fi + 1} of ${files.length}: ${file.name}`);

        const name = file.name;
        const ext = name.split('.').pop()?.toLowerCase() ?? '';
        const fileResult: FileResult = { name, type: ext, pages: [] };

        try {
          if (file.type.startsWith('image/') || ['png','jpg','jpeg','webp','bmp','tiff','tif','gif'].includes(ext)) {
            // Path A — Image
            setStatusMsg(`Preprocessing image: ${name}`);
            const canvas = await scaleAndPreprocess(file);
            setStatusMsg(`Recognizing: ${name}`);
            const { data } = await worker.recognize(canvas, {}, { tsv: true, text: true });
            const tsvData = ((data as unknown) as Record<string, unknown>).tsv as string ?? '';
            const textData = ((data as unknown) as Record<string, unknown>).text as string ?? '';
            canvas.width = 0;
            fileResult.pages.push({
              page: 1,
              text: textData.trim(),
              markdown: tsvToMarkdown(tsvData),
            });

          } else if (ext === 'pdf') {
            // Path B — PDF
            const pdfjsLib = await getPdfjsLib();
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

            for (let pi = 1; pi <= pdf.numPages; pi++) {
              if (abortRef.current) break;
              const page = await pdf.getPage(pi);
              setStatusMsg(`File ${fi + 1}/${files.length} — Page ${pi}/${pdf.numPages}`);

              // Detect digital vs scanned
              const textContent = await page.getTextContent();
              const digitalText = (textContent.items as PdfTextItem[])
                .map(it => it.str).join(' ').trim();

              let pageText = '';
              let pageMarkdown = '';

              if (digitalText.length > 30) {
                // B1 — Digital PDF
                pageText = digitalText;
                pageMarkdown = layoutItemsToMarkdown(textContent.items as PdfTextItem[]);
              } else {
                // B2 — Scanned PDF → render + preprocess + OCR
                const scale = 2.0;
                const viewport = page.getViewport({ scale });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                const ctx = canvas.getContext('2d')!;
                await page.render({ canvasContext: ctx, viewport, canvas }).promise;

                // Binarize
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imageData.data;
                for (let i = 0; i < d.length; i += 4) {
                  const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                  const v = gray > 128 ? 255 : 0;
                  d[i] = d[i + 1] = d[i + 2] = v;
                }
                ctx.putImageData(imageData, 0, 0);

                const { data } = await worker.recognize(canvas, {}, { tsv: true, text: true });
                const tsvData = ((data as unknown) as Record<string, unknown>).tsv as string ?? '';
                pageText = (((data as unknown) as Record<string, unknown>).text as string ?? '').trim();
                pageMarkdown = tsvToMarkdown(tsvData);
                canvas.width = 0; // release GPU memory
              }

              fileResult.pages.push({ page: pi, text: pageText, markdown: pageMarkdown });
              page.cleanup(); // critical for large docs
            }
            await pdf.destroy();

          } else if (ext === 'docx') {
            // Path C — DOCX
            setStatusMsg(`Extracting DOCX: ${name}`);
            const text = await extractDocx(file);
            fileResult.pages.push({ page: 1, text, markdown: text });

          } else if (ext === 'pptx') {
            // Path C — PPTX
            setStatusMsg(`Extracting PPTX: ${name}`);
            const slideTexts = await extractPptx(file);
            slideTexts.forEach((text, i) => {
              fileResult.pages.push({ page: i + 1, text, markdown: `## Slide ${i + 1}\n\n${text}` });
            });

          } else if (ext === 'txt') {
            // Path D — plain text
            const text = await file.text();
            fileResult.pages.push({ page: 1, text, markdown: text });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          fileResult.pages.push({ page: 1, text: `Error: ${msg}`, markdown: `> ⚠️ Error: ${msg}` });
        }

        allResults.push(fileResult);
        setResults([...allResults]);
      }

      setDone(true);
    } finally {
      if (worker) {
        await worker.terminate();
        workerRef.current = null;
      }
      setProcessing(false);
      setStatusMsg('');
      setProgress(0);
    }
  }

  async function downloadZip() {
    const zip = new JSZip();
    zip.file('ocr-output.md', buildMarkdown(results));
    zip.file('ocr-output.json', JSON.stringify({ files: results }, null, 2));
    const blob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function stopProcessing() {
    abortRef.current = true;
  }

  function clearAll() {
    abortRef.current = true;
    setFiles([]);
    setResults([]);
    setDone(false);
    setStatusMsg('');
    setProgress(0);
  }

  const totalPages = results.reduce((s, f) => s + f.pages.length, 0);
  const allText = results.flatMap(f => f.pages.map(p => p.text)).join('\n\n');

  return (
    <div>
      {/* Header card */}
      <div className="card mb-3">
        <div className="card-title mb-1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ScanText size={14} style={{ verticalAlign: 'middle' }} />
          Local OCR
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>
            — runs in browser · no upload · no API key
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Supports images, PDFs (digital + scanned), DOCX, PPTX, TXT — batch upload, downloads as ZIP
        </p>
      </div>

      {/* Language + action row */}
      <div className="card mb-3">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Languages size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <select
            value={lang}
            onChange={e => setLang(e.target.value)}
            disabled={processing}
            style={selectStyle}
          >
            {LANGUAGES.map(l => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            First use downloads ~5–12 MB language data (cached locally)
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div className="card mb-3">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius)',
            padding: 36,
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'var(--accent-glow)' : 'transparent',
            transition: 'all 0.2s',
            marginBottom: files.length ? 12 : 0,
          }}
        >
          <ScanText size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Drop files here or click to upload
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            PNG · JPG · WEBP · BMP · TIFF · GIF · PDF · DOCX · PPTX · TXT — multiple files OK
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.pptx,.txt"
          onChange={e => e.target.files && addFiles(e.target.files)}
          style={{ display: 'none' }}
        />

        {/* File queue */}
        {files.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {files.map((f, i) => (
              <div
                key={f.name + f.size}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  background: i === fileIdx && processing ? 'var(--accent-glow)' : 'var(--bg-input)',
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                <FileText size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <span style={{ flex: 1, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                  {f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`}
                </span>
                {!processing && (
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(i); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, lineHeight: 1 }}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Process button */}
        {files.length > 0 && !done && (
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button
              className="btn btn-sm"
              onClick={processAll}
              disabled={processing}
              style={{ flex: 1 }}
            >
              {processing ? 'Processing…' : `Run OCR on ${files.length} file${files.length !== 1 ? 's' : ''}`}
            </button>
            {processing && (
              <button className="btn btn-sm btn-secondary" onClick={stopProcessing}>
                Stop
              </button>
            )}
          </div>
        )}

        {/* Progress */}
        {processing && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6, minHeight: 18 }}>
              {statusMsg || 'Initializing…'}
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: 'var(--accent)',
                  borderRadius: 3,
                  transition: 'width 0.3s ease',
                  minWidth: progress > 0 ? 8 : 0,
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
              {progress}%
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="card mb-3">
          <div className="card-title mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              Extracted Text
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                {results.length} file{results.length !== 1 ? 's' : ''} · {totalPages} page{totalPages !== 1 ? 's' : ''}
              </span>
            </span>
          </div>

          <textarea
            value={allText}
            readOnly
            rows={12}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'DM Mono, monospace', fontSize: 13 }}
          />

          <div className="flex gap-2 mt-2" style={{ flexWrap: 'wrap' }}>
            {done && (
              <button className="btn btn-sm" onClick={downloadZip} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={13} />
                Download ZIP (.md + .json)
              </button>
            )}
            <button className="btn btn-sm btn-secondary" onClick={() => copyText(allText)} disabled={!allText} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Copy size={13} />
              Copy All
            </button>
            <button className="btn btn-sm btn-secondary" onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={13} />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TesseractOcrToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Local OCR">
      <TesseractOcrTool />
    </ToolErrorBoundary>
  );
}
