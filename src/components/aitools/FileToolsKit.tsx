/**
 * FileToolsKit.tsx
 * Client-side file utilities: Merge PDF, Split PDF, Compress Image, Compress PDF.
 * 100% browser-based — no server required.
 *   pdf-lib: merge / split / compress PDFs
 *   browser-image-compression: canvas-based image compression
 *   jszip: zip multi-file downloads
 */

import { useState, useRef } from 'react'
import { PDFDocument } from 'pdf-lib'
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'
import {
  Wrench, Combine, Scissors, Image, FileDown,
  Upload, ChevronUp, ChevronDown, Info, X,
} from 'lucide-react'
import { ToolErrorBoundary } from '../ToolErrorBoundary'

// ─── Constants ─────────────────────────────────────────────────────────────────

const MB = 1_000_000

const LIMITS = {
  mergePdfWarn:     200 * MB,
  mergePdfBlock:    500 * MB,
  splitPdfWarn:     300 * MB,
  splitPdfBlock:    500 * MB,
  compressImgWarn:   50 * MB,
  compressImgBlock: 100 * MB,
  compressPdfWarn:  200 * MB,
  compressPdfBlock: 400 * MB,
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  return `${Math.round(bytes / 1000)} KB`
}

function today(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

function downloadBlob(data: Uint8Array | Blob, mime: string, filename: string) {
  // Wrap in new Uint8Array to satisfy strict ArrayBuffer vs ArrayBufferLike typing
  const blob = data instanceof Blob ? data : new Blob([new Uint8Array(data)], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5_000)
}

function sizeCheck(
  bytes: number,
  warnBytes: number,
  blockBytes: number,
): { warn?: string; blocked?: string } {
  if (bytes > blockBytes) {
    return {
      blocked: `File too large (${fmtSize(bytes)}). Browser limit ~${fmtSize(blockBytes)}. For larger files use Stirling-PDF (free) or Adobe Acrobat.`,
    }
  }
  if (bytes > warnBytes) {
    return { warn: `Large file (${fmtSize(bytes)}) — processing may be slow.` }
  }
  return {}
}

function parsePageRanges(str: string, maxPage: number): number[] {
  const indices: number[] = []
  for (const part of str.split(',')) {
    const t = part.trim()
    if (!t) continue
    const dash = t.lastIndexOf('-')
    if (dash > 0) {
      const a = parseInt(t.slice(0, dash), 10) - 1
      const b = parseInt(t.slice(dash + 1), 10) - 1
      if (!isNaN(a) && !isNaN(b) && a >= 0) {
        for (let i = a; i <= Math.min(b, maxPage - 1); i++) indices.push(i)
      }
    } else {
      const n = parseInt(t, 10) - 1
      if (!isNaN(n) && n >= 0 && n < maxPage) indices.push(n)
    }
  }
  return [...new Set(indices)].sort((a, b) => a - b)
}

// ─── Shared drop zone ──────────────────────────────────────────────────────────

interface DropZoneProps {
  accept: string
  multiple: boolean
  label: string
  onFiles: (files: File[]) => void
  disabled?: boolean
}

function DropZone({ accept, multiple, label, onFiles, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  function handle(list: FileList | null) {
    if (!list || disabled) return
    onFiles(Array.from(list))
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={() => !disabled && ref.current?.click()}
      style={{
        border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '32px 20px',
        textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        background: dragging ? 'var(--accent-glow)' : 'var(--bg-secondary)',
        transition: 'all 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Upload
        size={28}
        style={{ color: dragging ? 'var(--accent)' : 'var(--text-muted)', marginBottom: 8 }}
      />
      <p style={{
        margin: 0, fontSize: 13,
        color: dragging ? 'var(--accent-light)' : 'var(--text-secondary)',
      }}>
        {label}
      </p>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => handle(e.target.files)}
      />
    </div>
  )
}

// ─── Info banner ───────────────────────────────────────────────────────────────

function InfoBanner() {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 14px', borderRadius: 10, marginBottom: 16,
      background: 'rgba(245, 166, 35, 0.07)',
      border: '1px solid rgba(245, 166, 35, 0.3)',
      fontSize: 12, color: 'var(--text-muted)',
    }}>
      <Info size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)' }}>
          <strong>DOCX / PPTX → PDF</strong> conversion requires a desktop app — use Microsoft
          Office "Export to PDF", Google Docs, or <strong>LibreOffice</strong> (free).
        </p>
        <p style={{ margin: 0 }}>
          <strong>Browser limits:</strong> PDFs up to ~300 MB, images up to ~50 MB per file.
          For larger files use <strong>Stirling-PDF</strong> (free &amp; open-source) or Adobe Acrobat.
        </p>
      </div>
      <button
        onClick={() => setOpen(false)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 0, lineHeight: 1, flexShrink: 0,
        }}
        title="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  )
}

// ─── Merge PDF panel ──────────────────────────────────────────────────────────

type MergeFile = { id: string; name: string; file: File; size: number }

function MergePdfPanel() {
  const [files, setFiles] = useState<MergeFile[]>([])
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [resultSize, setResultSize] = useState(0)

  function addFiles(incoming: File[]) {
    const pdfs = incoming.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) { setError('Please add PDF files.'); return }
    const total = files.reduce((s, f) => s + f.size, 0) + pdfs.reduce((s, f) => s + f.size, 0)
    const check = sizeCheck(total, LIMITS.mergePdfWarn, LIMITS.mergePdfBlock)
    if (check.blocked) { setError(check.blocked); return }
    setWarning(check.warn ?? '')
    setError('')
    setFiles((prev) => [
      ...prev,
      ...pdfs.map((f) => ({ id: crypto.randomUUID(), name: f.name, file: f, size: f.size })),
    ])
  }

  function move(id: string, dir: -1 | 1) {
    setFiles((prev) => {
      const idx = prev.findIndex((f) => f.id === id)
      if (idx < 0) return prev
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  async function merge() {
    if (files.length < 2) { setError('Add at least 2 PDFs to merge.'); return }
    setPhase('processing')
    setError('')
    try {
      const out = await PDFDocument.create()
      for (const f of files) {
        const buf = await f.file.arrayBuffer()
        const doc = await PDFDocument.load(buf)
        const pages = await out.copyPages(doc, doc.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      const bytes = await out.save()
      setResultSize(bytes.byteLength)
      downloadBlob(bytes, 'application/pdf', `merged-${today()}.pdf`)
      setPhase('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(
        msg.toLowerCase().includes('encrypt')
          ? 'One or more PDFs are password-protected and cannot be merged.'
          : 'Merge failed. Ensure all files are valid, unprotected PDFs.',
      )
      setPhase('idle')
    }
  }

  function reset() {
    setFiles([]); setPhase('idle'); setError(''); setWarning(''); setResultSize(0)
  }

  if (phase === 'done') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Merged PDF downloaded!
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          Combined {files.length} files · {fmtSize(resultSize)}
        </p>
        <button className="btn btn-primary" onClick={reset}>Merge Another</button>
      </div>
    )
  }

  return (
    <div>
      <DropZone
        accept=".pdf,application/pdf"
        multiple
        label="Drop PDF files here, or click to select"
        onFiles={addFiles}
      />

      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div
              key={f.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', marginBottom: 4,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)', borderRadius: 8,
              }}
            >
              <span style={{
                flex: 1, fontSize: 13, color: 'var(--text-primary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {i + 1}. {f.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {fmtSize(f.size)}
              </span>
              <button
                onClick={() => move(f.id, -1)}
                disabled={i === 0}
                title="Move up"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => move(f.id, 1)}
                disabled={i === files.length - 1}
                title="Move down"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
              >
                <ChevronDown size={14} />
              </button>
              <button
                onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                title="Remove"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 4px' }}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {warning && <p style={{ marginTop: 8, fontSize: 12, color: 'var(--yellow)' }}>⚠ {warning}</p>}
      {error   && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>}

      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={merge}
          disabled={files.length < 2 || phase === 'processing'}
        >
          {phase === 'processing' ? 'Merging…' : `Merge ${files.length || ''} PDF${files.length !== 1 ? 's' : ''}`}
        </button>
        {files.length > 0 && (
          <button className="btn btn-sm" onClick={reset}>Clear</button>
        )}
      </div>
    </div>
  )
}

// ─── Split PDF panel ──────────────────────────────────────────────────────────

type SplitPhase = 'idle' | 'loading' | 'ready' | 'processing' | 'done'

function SplitPdfPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState(0)
  const [phase, setPhase] = useState<SplitPhase>('idle')
  const [mode, setMode] = useState<'range' | 'every'>('range')
  const [rangeStr, setRangeStr] = useState('')
  const [everyN, setEveryN] = useState(1)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [resultInfo, setResultInfo] = useState('')

  async function loadFile(f: File) {
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Please select a PDF.'); return }
    const check = sizeCheck(f.size, LIMITS.splitPdfWarn, LIMITS.splitPdfBlock)
    if (check.blocked) { setError(check.blocked); return }
    setWarning(check.warn ?? '')
    setFile(f); setPhase('loading'); setError('')
    try {
      const doc = await PDFDocument.load(await f.arrayBuffer())
      setPageCount(doc.getPageCount())
      setPhase('ready')
    } catch {
      setError('Could not read PDF — it may be password-protected or corrupted.')
      setPhase('idle')
    }
  }

  async function split() {
    if (!file) return
    setPhase('processing'); setError('')
    try {
      const src = await PDFDocument.load(await file.arrayBuffer())
      const total = src.getPageCount()

      if (mode === 'range') {
        const indices = parsePageRanges(rangeStr, total)
        if (!indices.length) {
          setError('No valid pages in that range. Format: 1-3, 5, 7-9')
          setPhase('ready'); return
        }
        const out = await PDFDocument.create()
        const pages = await out.copyPages(src, indices)
        pages.forEach((p) => out.addPage(p))
        downloadBlob(await out.save(), 'application/pdf', `split-${today()}.pdf`)
        setResultInfo(`Downloaded ${indices.length} page${indices.length > 1 ? 's' : ''}`)
      } else {
        const n = Math.max(1, everyN)
        const zip = new JSZip()
        let part = 1
        for (let start = 0; start < total; start += n) {
          const indices = Array.from(
            { length: Math.min(n, total - start) },
            (_, k) => start + k,
          )
          const out = await PDFDocument.create()
          const pages = await out.copyPages(src, indices)
          pages.forEach((p) => out.addPage(p))
          zip.file(`part-${String(part).padStart(2, '0')}.pdf`, await out.save())
          part++
        }
        downloadBlob(
          await zip.generateAsync({ type: 'uint8array' }),
          'application/zip',
          `split-${today()}.zip`,
        )
        setResultInfo(`Downloaded ${part - 1} parts as ZIP`)
      }
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Split failed.')
      setPhase('ready')
    }
  }

  function reset() {
    setFile(null); setPhase('idle'); setPageCount(0)
    setRangeStr(''); setEveryN(1); setError(''); setWarning(''); setResultInfo('')
  }

  if (phase === 'done') {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {resultInfo}
        </p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={reset}>
          Split Another
        </button>
      </div>
    )
  }

  if (phase === 'idle') {
    return (
      <div>
        <DropZone
          accept=".pdf,application/pdf"
          multiple={false}
          label="Drop a PDF here, or click to select"
          onFiles={([f]) => { if (f) loadFile(f) }}
        />
        {error && <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>}
      </div>
    )
  }

  if (phase === 'loading') {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>Loading PDF…</p>
  }

  // ready / processing
  const partCount = Math.ceil(pageCount / Math.max(1, everyN))
  return (
    <div>
      <div style={{
        marginBottom: 12, padding: '8px 12px',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
        fontSize: 13,
      }}>
        <strong style={{ color: 'var(--text-primary)' }}>{file!.name}</strong>
        <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>
          — {pageCount} pages · {fmtSize(file!.size)}
        </span>
      </div>

      {warning && <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 10 }}>⚠ {warning}</p>}

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['range', 'every'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 14px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              border: mode === m ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: mode === m ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              color: mode === m ? 'var(--accent-light)' : 'var(--text-secondary)',
            }}
          >
            {m === 'range' ? 'Extract range' : 'Split every N pages'}
          </button>
        ))}
      </div>

      {mode === 'range' ? (
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Pages to extract (1–{pageCount}):
          </label>
          <input
            type="text"
            placeholder="e.g. 1-3, 5, 7-9"
            value={rangeStr}
            onChange={(e) => setRangeStr(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--bg-secondary)',
              color: 'var(--text-primary)', fontSize: 13,
              boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Separate ranges with commas · e.g. 1-3, 5, 7-9
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Pages per part:
            </label>
            <input
              type="number"
              min={1}
              max={pageCount}
              value={everyN}
              onChange={(e) => setEveryN(Math.max(1, parseInt(e.target.value) || 1))}
              style={{
                width: 80, padding: '8px 12px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
              }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
            → {partCount} part{partCount !== 1 ? 's' : ''}, downloaded as ZIP
          </p>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 10 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={split}
          disabled={phase === 'processing'}
        >
          {phase === 'processing' ? 'Splitting…' : 'Split PDF'}
        </button>
        <button className="btn btn-sm" onClick={reset}>Change File</button>
      </div>
    </div>
  )
}

// ─── Compress Image panel ─────────────────────────────────────────────────────

type ImgResult = { name: string; original: number; compressed: number; blob: Blob }

function CompressImagePanel() {
  const [files, setFiles] = useState<File[]>([])
  const [quality, setQuality] = useState(80)
  const [maxWidth, setMaxWidth] = useState(1920)
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle')
  const [results, setResults] = useState<ImgResult[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  function addFiles(incoming: File[]) {
    const imgs = incoming.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name))
    if (!imgs.length) { setError('Please select JPG, PNG, or WebP files.'); return }
    const tooBig = imgs.find((f) => f.size > LIMITS.compressImgBlock)
    if (tooBig) { setError(`${tooBig.name} exceeds 100 MB browser limit.`); return }
    setError('')
    setFiles((prev) => [...prev, ...imgs])
  }

  async function compress() {
    if (!files.length) return
    setPhase('processing'); setError(''); setProgress(0)
    const out: ImgResult[] = []
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      try {
        const compressed = await imageCompression(f, {
          maxSizeMB: Math.max(0.05, (quality / 100) * (f.size / MB)),
          maxWidthOrHeight: maxWidth,
          useWebWorker: true,
          initialQuality: quality / 100,
        })
        out.push({ name: f.name, original: f.size, compressed: compressed.size, blob: compressed })
      } catch {
        out.push({ name: f.name, original: f.size, compressed: f.size, blob: f })
      }
      setProgress(Math.round(((i + 1) / files.length) * 100))
    }
    setResults(out)
    setPhase('done')
  }

  async function downloadAll() {
    if (results.length === 1) {
      downloadBlob(results[0].blob, results[0].blob.type, `compressed-${results[0].name}`)
      return
    }
    const zip = new JSZip()
    for (const r of results) zip.file(`compressed-${r.name}`, r.blob)
    downloadBlob(
      await zip.generateAsync({ type: 'uint8array' }),
      'application/zip',
      `compressed-images-${today()}.zip`,
    )
  }

  function reset() {
    setFiles([]); setResults([]); setPhase('idle'); setError(''); setProgress(0)
  }

  if (phase === 'done') {
    const totalOrig = results.reduce((s, r) => s + r.original, 0)
    const saved = results.reduce((s, r) => s + (r.original - r.compressed), 0)
    return (
      <div>
        <div className="card mb-3" style={{ padding: '16px 20px' }}>
          <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            Compressed {results.length} image{results.length > 1 ? 's' : ''} — saved{' '}
            {fmtSize(saved)} ({Math.round((saved / totalOrig) * 100)}%)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            {results.map((r, i) => {
              const pct = Math.round(((r.original - r.compressed) / r.original) * 100)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{
                    flex: 1, color: 'var(--text-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                    {fmtSize(r.original)} → {fmtSize(r.compressed)}
                  </span>
                  <span style={{
                    padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, flexShrink: 0,
                    background: pct > 10 ? 'rgba(74, 222, 128, 0.15)' : 'rgba(245, 166, 35, 0.1)',
                    color: pct > 10 ? 'var(--green)' : 'var(--accent)',
                  }}>
                    −{pct}%
                  </span>
                  <button
                    className="btn btn-sm"
                    style={{ padding: '3px 8px', fontSize: 11, flexShrink: 0 }}
                    onClick={() => downloadBlob(r.blob, r.blob.type, `compressed-${r.name}`)}
                  >
                    ↓
                  </button>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={downloadAll}>
              {results.length > 1 ? 'Download All (ZIP)' : 'Download'}
            </button>
            <button className="btn btn-sm" onClick={reset}>Compress More</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <DropZone
        accept=".jpg,.jpeg,.png,.webp,image/*"
        multiple
        label="Drop images here (JPG, PNG, WebP)"
        onFiles={addFiles}
      />

      {files.length > 0 && (
        <div style={{ marginTop: 10, marginBottom: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', marginBottom: 3,
              background: 'var(--bg-secondary)', borderRadius: 6, fontSize: 12,
            }}>
              <span style={{
                flex: 1, color: 'var(--text-secondary)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {f.name}
              </span>
              <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtSize(f.size)}</span>
              {f.size > LIMITS.compressImgWarn && (
                <span style={{ color: 'var(--yellow)', fontSize: 11, flexShrink: 0 }}>⚠ large</span>
              )}
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 14, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Quality: {quality}%
          </label>
          <input
            type="range" min={30} max={95} value={quality}
            onChange={(e) => setQuality(+e.target.value)}
            style={{ width: 150, accentColor: 'var(--accent)' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Max width: {maxWidth}px
          </label>
          <input
            type="range" min={640} max={4096} step={64} value={maxWidth}
            onChange={(e) => setMaxWidth(+e.target.value)}
            style={{ width: 150, accentColor: 'var(--accent)' }}
          />
        </div>
      </div>

      {phase === 'processing' && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'var(--accent)', transition: 'width 0.3s',
            }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Compressing… {progress}%
          </p>
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="btn btn-primary"
          onClick={compress}
          disabled={!files.length || phase === 'processing'}
        >
          {phase === 'processing'
            ? 'Compressing…'
            : `Compress ${files.length || ''} Image${files.length !== 1 ? 's' : ''}`}
        </button>
        {files.length > 0 && (
          <button className="btn btn-sm" onClick={() => { setFiles([]); setError('') }}>Clear</button>
        )}
      </div>
    </div>
  )
}

// ─── Compress PDF panel ───────────────────────────────────────────────────────

function CompressPdfPanel() {
  const [file, setFile] = useState<File | null>(null)
  const [phase, setPhase] = useState<'idle' | 'processing' | 'done'>('idle')
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [result, setResult] = useState<{ original: number; compressed: number; bytes: Uint8Array } | null>(null)

  function addFile(files: File[]) {
    const f = files[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Please select a PDF.'); return }
    const check = sizeCheck(f.size, LIMITS.compressPdfWarn, LIMITS.compressPdfBlock)
    if (check.blocked) { setError(check.blocked); return }
    setWarning(check.warn ?? '')
    setFile(f); setError('')
  }

  async function compress() {
    if (!file) return
    setPhase('processing'); setError('')
    try {
      const doc = await PDFDocument.load(await file.arrayBuffer())
      const bytes = await doc.save({ useObjectStreams: true })
      setResult({ original: file.size, compressed: bytes.byteLength, bytes })
      setPhase('done')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      setError(
        msg.toLowerCase().includes('encrypt')
          ? 'PDF is password-protected and cannot be processed.'
          : 'Compression failed. The PDF may be corrupted.',
      )
      setPhase('idle')
    }
  }

  function reset() {
    setFile(null); setPhase('idle'); setError(''); setWarning(''); setResult(null)
  }

  if (phase === 'done' && result) {
    const saved = result.original - result.compressed
    const pct = Math.round((saved / result.original) * 100)
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{pct > 5 ? '✓' : 'ℹ'}</div>
        <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          {pct > 0 ? `Reduced by ${pct}%` : 'No reduction achieved'}
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          {fmtSize(result.original)} → {fmtSize(result.compressed)}
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {pct > 0 && (
            <button
              className="btn btn-primary"
              onClick={() => downloadBlob(result.bytes, 'application/pdf', `compressed-${file!.name}`)}
            >
              Download Compressed PDF
            </button>
          )}
          <button className="btn btn-sm" onClick={reset}>Try Another</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!file ? (
        <DropZone
          accept=".pdf,application/pdf"
          multiple={false}
          label="Drop a PDF here, or click to select"
          onFiles={addFile}
        />
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 12,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8,
          fontSize: 13,
        }}>
          <span style={{ flex: 1, color: 'var(--text-primary)' }}>{file.name}</span>
          <span style={{ color: 'var(--text-muted)' }}>{fmtSize(file.size)}</span>
          <button
            onClick={reset}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {warning && <p style={{ fontSize: 12, color: 'var(--yellow)', marginBottom: 8 }}>⚠ {warning}</p>}
      {error   && <p style={{ fontSize: 13, color: 'var(--red)', marginBottom: 8 }}>{error}</p>}

      <div style={{
        marginTop: 10, marginBottom: 14, padding: '8px 12px', borderRadius: 8,
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        fontSize: 12, color: 'var(--text-muted)',
      }}>
        ℹ Best for text-heavy PDFs (10–25% savings). Image-heavy PDFs see minimal reduction since
        images are already compressed inside the file. For large scanned PDFs, re-scanning at a
        lower DPI is more effective.
      </div>

      <button
        className="btn btn-primary"
        onClick={compress}
        disabled={!file || phase === 'processing'}
      >
        {phase === 'processing' ? 'Compressing…' : 'Compress PDF'}
      </button>
    </div>
  )
}

// ─── Root component ────────────────────────────────────────────────────────────

type SubTab = 'merge' | 'split' | 'compress-image' | 'compress-pdf'

const SUB_TABS: { id: SubTab; icon: React.ElementType; label: string }[] = [
  { id: 'merge',          icon: Combine,  label: 'Merge PDF' },
  { id: 'split',          icon: Scissors, label: 'Split PDF' },
  { id: 'compress-image', icon: Image,    label: 'Compress Image' },
  { id: 'compress-pdf',   icon: FileDown, label: 'Compress PDF' },
]

function FileToolsKit() {
  const [tab, setTab] = useState<SubTab>('merge')

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Wrench size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          File Tools
        </div>

        <InfoBanner />

        {/* Internal sub-tabs */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {SUB_TABS.map((t) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'var(--accent-glow)' : 'var(--bg-secondary)',
                  color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                }}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            )
          })}
        </div>

        {tab === 'merge'          && <MergePdfPanel />}
        {tab === 'split'          && <SplitPdfPanel />}
        {tab === 'compress-image' && <CompressImagePanel />}
        {tab === 'compress-pdf'   && <CompressPdfPanel />}
      </div>
    </div>
  )
}

export default function FileToolsKitWrapped() {
  return (
    <ToolErrorBoundary toolName="File Tools">
      <FileToolsKit />
    </ToolErrorBoundary>
  )
}
