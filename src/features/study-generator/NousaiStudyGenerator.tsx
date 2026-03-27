import { useState, useRef, useCallback, useEffect, useMemo, forwardRef, memo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Upload, FileText, Download, RefreshCw, X, Loader, AlertTriangle,
  Trash2, Zap, Check, ChevronDown, ChevronUp, Settings, Eye, Sparkles,
  Plus, MessageSquare, Wand2,
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Highlighter, Table, Undo2, Redo2, AlignLeft, AlignCenter, AlignRight,
  Link, Minus, Code, Type,
} from 'lucide-react'
import {
  processFile, estimateTokens, estimateCost, buildSystemPrompt,
  callOpenRouter, PALETTES, fetchOpenRouterModels, getCachedModels,
  FILTER_INJECT_JS,
  type GenSettings, type ModelOption,
} from './studyGenUtils'
import { useStore } from '../../store'
import type { StudyGuide } from '../../types'
import { saveGuideHtml, loadGuideHtml, deleteGuideHtml } from './studyGuideStore'

/* ── Types ──────────────────────────────────────────────── */
interface FileEntry {
  id: string
  name: string
  size: number
  status: 'processing' | 'done' | 'error'
  text: string
  ext: string
}

type Phase = 'idle' | 'extracting' | 'confirming' | 'generating' | 'done' | 'error'

/* ── Get existing API key from NousAI settings ──────────── */
function getStoredApiKey(): string {
  return localStorage.getItem('nousai-ai-apikey') || ''
}

/* ── Component ──────────────────────────────────────────── */
export default function NousaiStudyGenerator() {
  const [apiKey, setApiKey] = useState(getStoredApiKey)
  const [model, setModel] = useState('openrouter/auto')
  const [models, setModels] = useState<ModelOption[]>(getCachedModels)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [paste, setPaste] = useState('')
  const [settings, setSettings] = useState<GenSettings>({
    profanity: 'full', depth: 'deep', diagrams: 'full',
    traps: 'full', color: '#534AB7', colorBg: '#f8f7ff',
    showSources: true, tokenLimit: 8000,
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState('')
  const [genHTML, setGenHTML] = useState('')
  const [error, setError] = useState('')
  const [sections, setSections] = useState<string[]>([])
  const [regenSec, setRegenSec] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showHtmlEditor, setShowHtmlEditor] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Progress tracking
  const [genChars, setGenChars] = useState(0)
  const [genElapsed, setGenElapsed] = useState(0)
  const [genPhase, setGenPhase] = useState(0)

  // Track auto-saved guide ID to prevent duplicates
  const [currentGuideId, setCurrentGuideId] = useState<string | null>(null)
  // Editable guide title — initialized from <h1> but can be overridden
  const [guideTitle, setGuideTitle] = useState('')

  // Store for auto-save + previous sessions
  const { data, updatePluginData } = useStore()
  const savedGuides: StudyGuide[] = (data?.pluginData?.studyGuides as StudyGuide[] | undefined) || []

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const loadParamHandled = useRef(false)

  // Fetch latest models from OpenRouter API when apiKey is available
  useEffect(() => {
    let cancelled = false
    setModelsLoading(true)
    fetchOpenRouterModels(apiKey || undefined).then(m => {
      if (!cancelled) {
        setModels(m)
        setModelsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [apiKey])

  // Inject filter JS into iframe after HTML loads
  useEffect(() => {
    if (!genHTML || phase !== 'done') return
    const iframe = iframeRef.current
    if (!iframe) return
    const onLoad = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const script = doc.createElement('script')
      script.textContent = FILTER_INJECT_JS
      doc.body.appendChild(script)
    }
    iframe.addEventListener('load', onLoad)
    // Also fire immediately in case iframe already loaded
    if (iframe.contentDocument?.readyState === 'complete') onLoad()
    return () => iframe.removeEventListener('load', onLoad)
  }, [genHTML, phase])

  // Inject diagram container CSS into iframe to prevent wide SVGs from breaking layout
  useEffect(() => {
    if (!genHTML || phase !== 'done') return
    const iframe = iframeRef.current
    if (!iframe) return
    const injectDiagramCSS = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const style = doc.createElement('style')
      style.textContent = `
        svg, .mermaid, .diagram, .flowchart, [class*="diagram"], [class*="chart"], pre:has(svg) {
          max-width: 100% !important;
          height: auto !important;
        }
        .diagram-wrapper, .svg-wrapper, div:has(> svg:only-child), div:has(> .mermaid:only-child) {
          overflow-x: auto !important;
          overflow-y: visible !important;
          max-width: 100% !important;
          -webkit-overflow-scrolling: touch;
        }
      `
      doc.head.appendChild(style)
    }
    const onLoad = () => injectDiagramCSS()
    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') injectDiagramCSS()
    return () => iframe.removeEventListener('load', onLoad)
  }, [genHTML, phase])

  // Auto-resize iframe to content height
  useEffect(() => {
    if (!genHTML || phase !== 'done') return
    const iframe = iframeRef.current
    if (!iframe) return
    let observer: MutationObserver | null = null

    const resize = () => {
      try {
        const doc = iframe.contentDocument
        if (!doc?.body) return
        iframe.style.height = doc.documentElement.scrollHeight + 'px'
      } catch { /* cross-origin safety */ }
    }

    const onLoad = () => {
      resize()
      try {
        const doc = iframe.contentDocument
        if (doc) {
          observer = new MutationObserver(resize)
          observer.observe(doc.body, { childList: true, subtree: true, attributes: true })
        }
      } catch { /* ignore */ }
      // Delayed resizes for KaTeX rendering
      setTimeout(resize, 1000)
      setTimeout(resize, 3000)
    }

    iframe.addEventListener('load', onLoad)
    if (iframe.contentDocument?.readyState === 'complete') onLoad()
    return () => {
      iframe.removeEventListener('load', onLoad)
      observer?.disconnect()
    }
  }, [genHTML, phase])

  const allText = [
    ...files.filter(f => f.status === 'done').map(f => f.text),
    paste,
  ].filter(Boolean).join('\n\n=====\n\n')

  const toks = allText.trim() ? estimateTokens(allText, settings.depth) : null
  const selectedModel = models.find(m => m.id === model)
  const cost = toks ? estimateCost(toks, selectedModel) : null
  const hasPricing = selectedModel?.promptPrice != null && selectedModel.promptPrice > 0

  const setSetting = <K extends keyof GenSettings>(k: K, v: GenSettings[K]) => {
    setSettings(prev => {
      const n = { ...prev, [k]: v }
      if (k === 'color') {
        const p = PALETTES.find(x => x.hex === v)
        if (p) (n as GenSettings).colorBg = p.bg
      }
      return n
    })
  }

  /* ── File handling ──────────────────────────────────── */
  const handleFiles = useCallback(async (rawFiles: File[]) => {
    if (!rawFiles.length) return
    setPhase('extracting')
    for (const f of rawFiles) {
      const id = `${f.name}-${Date.now()}-${Math.random()}`
      setFiles(prev => [...prev, { id, name: f.name, size: f.size, status: 'processing', text: '', ext: f.name.split('.').pop()?.toLowerCase() || '' }])
      try {
        const text = await processFile(f, setProgress)
        setFiles(prev => prev.map(x => x.id === id ? { ...x, text, status: 'done' as const } : x))
      } catch (e: unknown) {
        setFiles(prev => prev.map(x => x.id === id ? { ...x, status: 'error' as const, text: `Error: ${e instanceof Error ? e.message : 'Unknown'}` } : x))
      }
    }
    setPhase('idle')
    setProgress('')
  }, [])

  const onDrop = useCallback((e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    setDragOver(false)
    const rawFiles = 'dataTransfer' in e
      ? Array.from(e.dataTransfer?.files || [])
      : Array.from((e.target as HTMLInputElement).files || [])
    handleFiles(rawFiles)
  }, [handleFiles])

  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items || [])
      const imgItem = items.find(i => i.type.startsWith('image/'))
      if (imgItem) {
        e.preventDefault()
        const f = imgItem.getAsFile()
        if (f) handleFiles([f])
      }
    }
    window.addEventListener('paste', handler)
    return () => window.removeEventListener('paste', handler)
  }, [handleFiles])

  /* ── Generation ──────────────────────────────────────── */
  const startGenerate = () => {
    if (!apiKey.trim()) return setError('Enter your OpenRouter API key — or configure one in NousAI Settings.')
    if (!allText.trim()) return setError('Add source material first — upload files or paste text.')
    setError('')
    setPhase('confirming')
  }

  const confirmGenerate = async () => {
    setPhase('generating')
    setGenChars(0)
    setGenElapsed(0)
    setGenPhase(0)
    setProgress('Sending to model...')
    try {
      const sys = buildSystemPrompt(settings)
      const userMsg = `SOURCE MATERIAL:\n\n${allText}\n\n---\n\nGenerate the complete interactive study guide HTML now. Start immediately with <!DOCTYPE html>.`
      const maxOut = Math.max(toks?.output || 10000, settings.tokenLimit)
      const expectedChars = maxOut * 3.5

      setGenPhase(1)
      const html = await callOpenRouter(apiKey, model, sys, userMsg, maxOut, (chars, elapsed) => {
        setGenChars(chars)
        setGenElapsed(elapsed)
        if (chars < 500) setGenPhase(1)
        else if (chars < 2000) setGenPhase(2)
        else if (chars < expectedChars * 0.8) setGenPhase(3)
        else setGenPhase(4)
      })

      setGenPhase(5)
      if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
        throw new Error('Model did not return valid HTML. Response: ' + html.slice(0, 200))
      }
      setGenHTML(html)
      const secMatches = [...html.matchAll(/data-section="([^"]+)"/g)]
      setSections([...new Set(secMatches.map(m => m[1]))])
      setPhase('done')
      setProgress('')

      // Auto-save: HTML goes to dedicated IDB, metadata to pluginData
      const extractedTitle = html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, '') || 'Study Guide'
      setGuideTitle(extractedTitle)
      const guideId = crypto.randomUUID()
      setCurrentGuideId(guideId)
      const title = extractedTitle
      await saveGuideHtml(guideId, html).catch(() => {})
      const guide: StudyGuide = {
        id: guideId,
        title,
        model,
        sourcePreview: allText.slice(0, 200),
        sizeKb: Math.round(html.length / 1024),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      updatePluginData({ studyGuides: [guide, ...savedGuides].slice(0, 30) })
    } catch (e: unknown) {
      setError(`Generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setPhase('error')
      setProgress('')
    }
  }

  const download = () => {
    const blob = new Blob([genHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    // Use link click for desktop, window.open fallback for mobile/iOS
    const a = document.createElement('a')
    a.href = url
    a.download = `nousai_study_guide_${Date.now()}.html`
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Fallback: if click didn't trigger download (iOS Safari), open in new tab
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 1000)
  }

  const saveToLibrary = async () => {
    try {
      // CRITICAL: Always sync iframe edits to state first (user may still be in edit mode)
      const freshHtml = syncIframeToState() || genHTML
      if (!freshHtml.trim()) {
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: 'No HTML content to save', type: 'error', duration: 2000 } }))
        return
      }
      const title = guideTitle || freshHtml.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, '') || 'Study Guide'
      if (currentGuideId) {
        await saveGuideHtml(currentGuideId, freshHtml)
        const updated = savedGuides.map(g =>
          g.id === currentGuideId
            ? { ...g, title, sizeKb: Math.round(freshHtml.length / 1024), updatedAt: new Date().toISOString() }
            : g
        )
        updatePluginData({ studyGuides: updated })
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: `Updated "${title}" in Library`, type: 'success', duration: 2000 } }))
      } else {
        const id = crypto.randomUUID()
        setCurrentGuideId(id)
        await saveGuideHtml(id, freshHtml)
        const guide: StudyGuide = { id, title, model, sourcePreview: allText.slice(0, 200), sizeKb: Math.round(freshHtml.length / 1024), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        updatePluginData({ studyGuides: [guide, ...savedGuides].slice(0, 30) })
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: `Saved "${title}" to Library`, type: 'success', duration: 2000 } }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: 'Failed to save study guide', type: 'error', duration: 3000 } }))
    }
  }

  // Load a previously saved study guide
  const loadGuide = async (guide: StudyGuide) => {
    const html = await loadGuideHtml(guide.id) || guide.html || ''
    if (!html) {
      setError('Study guide HTML not found — it may have been cleared from this browser.')
      return
    }
    setGenHTML(html)
    setCurrentGuideId(guide.id)
    setGuideTitle(guide.title || html.match(/<h1[^>]*>(.*?)<\/h1>/i)?.[1]?.replace(/<[^>]*>/g, '') || 'Study Guide')
    const secMatches = [...html.matchAll(/data-section="([^"]+)"/g)]
    setSections([...new Set(secMatches.map(m => m[1]))])
    setPhase('done')
    setProgress('')
    setError('')
  }

  // Auto-load guide from ?load=<guideId> URL param (used by Library "Edit in Study Gen")
  useEffect(() => {
    if (loadParamHandled.current) return
    const loadId = searchParams.get('load')
    if (!loadId || !savedGuides.length) return
    const guide = savedGuides.find(g => g.id === loadId)
    if (guide) {
      loadParamHandled.current = true
      loadGuide(guide)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, savedGuides])

  // Delete a saved study guide
  const deleteGuide = (id: string) => {
    deleteGuideHtml(id).catch(() => {})
    updatePluginData({ studyGuides: savedGuides.filter(g => g.id !== id) })
  }

  // Sync iframe edits back to genHTML state (call before any save)
  const syncIframeToState = (): string | null => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return null
    const html = doc.documentElement.outerHTML
    setGenHTML(html)
    return html
  }

  // Toggle contentEditable on the iframe document for inline editing
  const toggleEditMode = () => {
    const doc = iframeRef.current?.contentDocument
    if (!doc) return
    const next = !editMode
    setEditMode(next)
    doc.body.contentEditable = next ? 'true' : 'false'
    doc.body.style.outline = next ? '2px dashed rgba(83,74,183,0.3)' : 'none'
    doc.body.style.cursor = next ? 'text' : 'default'
    if (!next) {
      // Sync edits back to state AND auto-save to IDB
      const html = syncIframeToState()
      if (html && currentGuideId) {
        saveGuideHtml(currentGuideId, html).catch(() => {})
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: 'Edits auto-saved', type: 'success', duration: 1500 } }))
      }
    }
  }

  // Save edits from HTML editor textarea — auto-persist to IDB
  const saveHtmlEdits = (html: string) => {
    setGenHTML(html)
    setShowHtmlEditor(false)
    if (currentGuideId) {
      saveGuideHtml(currentGuideId, html).catch(() => {})
    }
  }

  const regenerateSection = async (secId: string) => {
    if (!apiKey.trim() || regenSec) return
    setRegenSec(secId)
    try {
      const sys = buildSystemPrompt(settings)
      const userMsg = `ORIGINAL SOURCE MATERIAL:\n\n${allText.slice(0, 8000)}\n\n---\n\nREGENERATE ONLY the card for section: "${secId}"\nOutput ONLY a single <div class="card" data-section="${secId}">...</div> element. Nothing else.`
      const newCard = await callOpenRouter(apiKey, model, sys, userMsg, 3000)
      const cleaned = newCard.replace(/^```html?\s*/i, '').replace(/\s*```$/, '').trim()
      const parser = new DOMParser()
      const doc = parser.parseFromString(genHTML, 'text/html')
      const existing = doc.querySelector(`[data-section="${secId}"]`)
      if (existing && cleaned) {
        const tmp = document.createElement('div')
        tmp.innerHTML = cleaned
        const newEl = tmp.querySelector('[data-section]') || tmp.firstElementChild
        if (newEl) existing.replaceWith(newEl)
        const updatedHtml = doc.documentElement.outerHTML
        setGenHTML(updatedHtml)
        // Auto-save regenerated content to IDB
        if (currentGuideId) {
          saveGuideHtml(currentGuideId, updatedHtml).catch(() => {})
        }
      }
    } catch (e: unknown) {
      setError(`Regen failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setRegenSec(null)
  }

  // ── AI Expand Section: add more content to a specific section ──
  const [expandSec, setExpandSec] = useState<string | null>(null)
  const expandSection = async (secId: string) => {
    if (!apiKey.trim() || expandSec) return
    setExpandSec(secId)
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(genHTML, 'text/html')
      const existing = doc.querySelector(`[data-section="${secId}"]`)
      const currentContent = existing?.innerHTML?.slice(0, 2000) || ''
      const sys = buildSystemPrompt(settings)
      const userMsg = `EXISTING SECTION CONTENT:\n\n${currentContent}\n\nORIGINAL SOURCE:\n${allText.slice(0, 4000)}\n\n---\n\nADD MORE content to section "${secId}". Generate 3-5 additional items (vocab words, examples, table rows, practice problems, etc.) that fit naturally into the existing section. Output ONLY the new HTML elements to INSERT (not the whole card). Use the same styling/classes as the existing content.`
      const newContent = await callOpenRouter(apiKey, model, sys, userMsg, 2000)
      const cleaned = newContent.replace(/^```html?\s*/i, '').replace(/\s*```$/, '').trim()
      if (existing && cleaned) {
        const container = existing.querySelector('.card-body, .card-content') || existing
        container.insertAdjacentHTML('beforeend', cleaned)
        setGenHTML(doc.documentElement.outerHTML)
      }
    } catch (e: unknown) {
      setError(`Expand failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setExpandSec(null)
  }

  // ── AI Rewrite Selection: rewrite selected text with AI ──
  const [rewritePrompt, setRewritePrompt] = useState('')
  const [rewriteMode, setRewriteMode] = useState(false)
  const [rewriting, setRewriting] = useState(false)
  const [rewriteAiMode, setRewriteAiMode] = useState<'rewrite' | 'simplify' | 'expand' | 'grammar' | 'mnemonic'>('rewrite')
  const [rewritePreview, setRewritePreview] = useState<{ original: string; rewritten: string; range: Range } | null>(null)

  const rewriteSelection = async () => {
    if (!apiKey.trim() || rewriting) return
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc) return
    const sel = doc.getSelection()
    const selectedText = sel?.toString()?.trim()
    if (!selectedText) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: 'Select some text in the preview first, then click Rewrite.', type: 'warning', duration: 3000 } }))
      return
    }
    if (selectedText.length > 5000) {
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: `Selection is ${selectedText.length} chars — this may cost more tokens. Consider selecting less text.`, type: 'warning', duration: 4000 } }))
    }
    // Grab context: 500 chars before and after selection
    const range = sel?.getRangeAt(0)
    if (!range) return
    let contextBefore = ''
    let contextAfter = ''
    try {
      const body = doc.body
      const fullText = body.innerText || ''
      const selStart = fullText.indexOf(selectedText)
      if (selStart >= 0) {
        contextBefore = fullText.slice(Math.max(0, selStart - 500), selStart)
        contextAfter = fullText.slice(selStart + selectedText.length, selStart + selectedText.length + 500)
      }
    } catch { /* ignore context extraction errors */ }

    // Get the selected HTML (not just plain text)
    const frag = range.cloneContents()
    const tempDiv = doc.createElement('div')
    tempDiv.appendChild(frag)
    const selectedHtml = tempDiv.innerHTML

    setRewriting(true)
    try {
      const customInstruction = rewritePrompt.trim()
      const modeInstructions: Record<string, string> = {
        rewrite: 'Rephrase the selected text for clarity and readability while keeping the same meaning.',
        simplify: 'Simplify the selected text — make it shorter, use simpler vocabulary, remove unnecessary complexity.',
        expand: 'Expand the selected text with more detail, examples, or explanation. Add 2-3 sentences of useful elaboration.',
        grammar: 'Fix grammar, spelling, and punctuation ONLY. Make minimal corrections. Do NOT rephrase or restructure.',
        mnemonic: 'Convert the selected text into a memorable mnemonic device, acronym, rhyme, or memory aid that helps remember the key information.',
      }
      const sys = `You are a precision text editor working on a study guide titled "${guideTitle || 'Study Guide'}".

MODE: ${rewriteAiMode.toUpperCase()}
${modeInstructions[rewriteAiMode]}

CORE RULES:
1. The input is HTML. Return valid HTML in the same format. Preserve all HTML tags, classes, styles, and structure.
2. ${customInstruction ? `Follow this custom instruction: "${customInstruction}"` : 'Apply the mode instruction above.'}
3. Do NOT add content the user didn't ask for. Do NOT remove content unless the mode calls for it.
4. Return ONLY the rewritten HTML. No explanations, no preamble, no markdown code fences. Just the HTML output.`
      const userMsg = `CONTEXT BEFORE:\n"""\n${contextBefore}\n"""\n\nSELECTED HTML:\n"""\n${selectedHtml}\n"""\n\nCONTEXT AFTER:\n"""\n${contextAfter}\n"""\n\nSELECTED PLAIN TEXT:\n"""\n${selectedText}\n"""`
      const rewritten = await callOpenRouter(apiKey, model, sys, userMsg, 2000)
      const cleaned = rewritten.replace(/^```html?\s*/i, '').replace(/\s*```$/, '').trim()
      // Show preview instead of auto-replacing
      setRewritePreview({ original: selectedHtml || selectedText, rewritten: cleaned, range: range.cloneRange() })
    } catch (e: unknown) {
      setError(`Rewrite failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setRewriting(false)
  }

  const acceptRewrite = () => {
    if (!rewritePreview) return
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc) return
    try {
      const sel = doc.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(rewritePreview.range)
      }
      const range = rewritePreview.range
      range.deleteContents()
      // Insert as HTML, not plain text
      const tempNode = doc.createElement('span')
      tempNode.innerHTML = rewritePreview.rewritten
      const frag = doc.createDocumentFragment()
      while (tempNode.firstChild) frag.appendChild(tempNode.firstChild)
      range.insertNode(frag)
      setGenHTML(doc.documentElement.outerHTML)
      window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message: 'Rewrite applied', type: 'success', duration: 1500 } }))
    } catch (e: unknown) {
      setError(`Failed to apply rewrite: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setRewritePreview(null)
    setRewriteMode(false)
    setRewritePrompt('')
  }

  const rejectRewrite = () => {
    setRewritePreview(null)
  }

  const regenerateRewrite = () => {
    setRewritePreview(null)
    rewriteSelection()
  }

  // ── Add Table Row: inject a blank row into a table in the iframe ──
  const addTableRow = () => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    if (!doc) return
    const tables = doc.querySelectorAll('table')
    if (tables.length === 0) {
      setError('No tables found in this guide.')
      return
    }
    // Add a row to each table's last tbody/table
    tables.forEach(table => {
      const lastRow = table.querySelector('tbody tr:last-child') || table.querySelector('tr:last-child')
      if (lastRow) {
        const newRow = lastRow.cloneNode(true) as HTMLTableRowElement
        newRow.querySelectorAll('td, th').forEach(cell => { cell.textContent = '…' })
        lastRow.parentElement?.appendChild(newRow)
      }
    })
    setGenHTML(doc.documentElement.outerHTML)
  }

  // ── Custom Section Prompt: type a specific instruction for section regen ──
  const [customPromptSec, setCustomPromptSec] = useState<string | null>(null)
  const [customPromptText, setCustomPromptText] = useState('')
  const customRegenSection = async () => {
    if (!apiKey.trim() || !customPromptSec || regenSec) return
    const secId = customPromptSec
    setRegenSec(secId)
    setCustomPromptSec(null)
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(genHTML, 'text/html')
      const existing = doc.querySelector(`[data-section="${secId}"]`)
      const currentContent = existing?.innerHTML?.slice(0, 2000) || ''
      const sys = buildSystemPrompt(settings)
      const userMsg = `CURRENT SECTION "${secId}":\n\n${currentContent}\n\nORIGINAL SOURCE:\n${allText.slice(0, 4000)}\n\n---\n\nUSER INSTRUCTION: ${customPromptText}\n\nRegenerate ONLY this section following the user's instruction. Output ONLY a single <div class="card" data-section="${secId}">...</div> element.`
      const newCard = await callOpenRouter(apiKey, model, sys, userMsg, 3000)
      const cleaned = newCard.replace(/^```html?\s*/i, '').replace(/\s*```$/, '').trim()
      if (existing && cleaned) {
        const tmp = document.createElement('div')
        tmp.innerHTML = cleaned
        const newEl = tmp.querySelector('[data-section]') || tmp.firstElementChild
        if (newEl) existing.replaceWith(newEl)
        setGenHTML(doc.documentElement.outerHTML)
      }
    } catch (e: unknown) {
      setError(`Custom regen failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setRegenSec(null)
    setCustomPromptText('')
  }

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id))

  const isReady = allText.trim() && apiKey.trim()
  const isWorking = phase === 'generating' || phase === 'extracting'

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius)',
            background: 'linear-gradient(135deg, #534AB7, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>
            <Sparkles size={20} color="#fff" />
          </div>
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>Study Visual Generator</h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Upload source material → AI generates a complete, downloadable HTML study guide
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(s => !s)}>
              <Settings size={14} /> {showSettings ? 'Hide' : 'Settings'}
            </button>
            {phase === 'done' && (
              <>
                <button
                  className="btn btn-sm"
                  style={{ background: editMode ? '#22c55e' : 'var(--bg-secondary)', color: editMode ? '#fff' : 'var(--text-primary)', border: editMode ? 'none' : '1px solid var(--border)' }}
                  onClick={toggleEditMode}
                >
                  <Eye size={14} /> {editMode ? 'Save Edits' : 'Edit Mode'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowHtmlEditor(h => !h)}>
                  {'</>'} HTML
                </button>
                <button className="btn btn-primary btn-sm" onClick={download}><Download size={14} /> Download</button>
                <button className="btn btn-sm" style={{ background: 'var(--accent-color, #F5A623)', color: '#000', border: 'none' }} onClick={saveToLibrary}>
                  <FileText size={14} /> {currentGuideId ? 'Update in Library' : 'Save to Library'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setGenHTML(''); setPhase('idle'); setSections([]); setEditMode(false); setShowHtmlEditor(false); setCurrentGuideId(null); setGuideTitle('') }}>
                  <X size={14} /> Reset
                </button>
              </>
            )}
          </div>
        </div>

        {/* Editable guide title */}
        {phase === 'done' && guideTitle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Title:</span>
            <input
              type="text"
              value={guideTitle}
              onChange={e => setGuideTitle(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 13,
                color: 'var(--text-primary)', fontWeight: 600,
              }}
              placeholder="Study guide title..."
            />
          </div>
        )}

        {/* Step-based progress */}
        {phase === 'generating' && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: 'var(--radius-sm)', fontSize: 12,
          }}>
            {[
              'Sending to model',
              'Generating header & styles',
              'Generating sections',
              'Generating term index',
              'Finalizing',
            ].map((label, i) => {
              const step = i + 1
              const done = genPhase > step
              const active = genPhase === step
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', color: done ? '#22c55e' : active ? '#a855f7' : 'var(--text-muted)', opacity: done ? 0.7 : active ? 1 : 0.4 }}>
                  {done ? <Check size={13} /> : active ? <Loader size={13} className="spin" /> : <span style={{ width: 13, height: 13, display: 'inline-block', borderRadius: '50%', border: '1.5px solid currentColor' }} />}
                  <span style={{ fontWeight: active ? 600 : 400 }}>{label}</span>
                </div>
              )
            })}
            {genChars > 0 && (
              <>
                <div style={{ marginTop: 8, height: 4, background: 'rgba(168,85,247,0.12)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(98, (genChars / ((toks?.output || settings.tokenLimit) * 3.5)) * 100)}%`,
                    background: 'linear-gradient(90deg, #06b6d4, #a855f7)',
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  {(genChars / 1000).toFixed(1)}k chars · {genElapsed.toFixed(0)}s elapsed
                </div>
              </>
            )}
          </div>
        )}
        {phase === 'extracting' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#a855f7',
          }}>
            <Loader size={14} className="spin" /> {progress || 'Extracting text...'}
          </div>
        )}
      </div>

      {/* ── Error ── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 16,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#ef4444',
        }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Previous Sessions ── */}
      {(phase === 'idle' || phase === 'done') && savedGuides.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Previous Sessions ({savedGuides.length})</div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {savedGuides.slice(0, 10).map(g => (
              <div key={g.id} style={{
                minWidth: 180, maxWidth: 220, padding: '10px 12px',
                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 11, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => loadGuide(g)}>
                  {g.title}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                  {g.model?.split('/')[1] || 'unknown'} · {new Date(g.createdAt).toLocaleDateString()}{g.sizeKb ? ` · ${g.sizeKb}kb` : ''}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => loadGuide(g)}>Open</button>
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 10, color: 'var(--red, #ef4444)' }} onClick={() => deleteGuide(g.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>

            {/* API Key */}
            <div>
              <label style={labelSt}>OpenRouter API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..." spellCheck={false} style={inputSt} />
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                Auto-filled from NousAI settings if configured
              </div>
            </div>

            {/* Model */}
            <div>
              <label style={labelSt}>Model {modelsLoading && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(loading...)</span>}</label>
              <select value={model} onChange={e => setModel(e.target.value)} style={inputSt}>
                {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                {models.length} models · live from OpenRouter API
              </div>
            </div>

            {/* Tone */}
            <div>
              <label style={labelSt}>Tone / Mnemonics</label>
              <RadioGroup name="prf" value={settings.profanity} onChange={v => setSetting('profanity', v as GenSettings['profanity'])}
                options={[
                  { value: 'full', label: 'Full (unrestricted)' },
                  { value: 'mild', label: 'Mild (PG-13)' },
                  { value: 'clean', label: 'Clean (analogies)' },
                ]} />
            </div>

            {/* Depth */}
            <div>
              <label style={labelSt}>Depth</label>
              <RadioGroup name="dep" value={settings.depth} onChange={v => setSetting('depth', v as GenSettings['depth'])}
                options={[
                  { value: 'deep', label: 'Deep (full detail)' },
                  { value: 'exam-only', label: 'Exam-only (high-yield)' },
                  { value: 'overview', label: 'Overview (broad)' },
                ]} />
            </div>

            {/* Diagrams */}
            <div>
              <label style={labelSt}>Diagrams</label>
              <RadioGroup name="dia" value={settings.diagrams} onChange={v => setSetting('diagrams', v as GenSettings['diagrams'])}
                options={[
                  { value: 'full', label: 'Every section' },
                  { value: 'key', label: 'Key sections' },
                  { value: 'minimal', label: 'Overview only' },
                ]} />
            </div>

            {/* Traps */}
            <div>
              <label style={labelSt}>Trap Boxes</label>
              <RadioGroup name="trp" value={settings.traps} onChange={v => setSetting('traps', v as GenSettings['traps'])}
                options={[
                  { value: 'full', label: 'All potential traps' },
                  { value: 'exam', label: 'Exam-confirmed only' },
                ]} />
            </div>

            {/* Color */}
            <div>
              <label style={labelSt}>Accent Color</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {PALETTES.map(p => (
                  <button key={p.hex} title={p.name} onClick={() => setSetting('color', p.hex)} style={{
                    width: 24, height: 24, borderRadius: '50%', background: p.hex, cursor: 'pointer',
                    border: settings.color === p.hex ? '2px solid #fff' : '2px solid transparent',
                  }} />
                ))}
                <input type="color" value={settings.color} onChange={e => setSetting('color', e.target.value)}
                  style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }} />
              </div>
            </div>

            {/* Token Limit */}
            <div>
              <label style={labelSt}>Response Length</label>
              <input type="number" value={settings.tokenLimit} onChange={e => setSetting('tokenLimit', parseInt(e.target.value) || 8000)}
                min={2000} max={65000} step={1000} style={inputSt} />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Max words the AI can write (~{Math.round(settings.tokenLimit * 0.75).toLocaleString()} words). Higher = longer guide, more cost.</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Input Section (hidden when done) ── */}
      {phase !== 'done' && (
        <>
          {/* Drop Zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#a855f7' : 'var(--border)'}`,
              borderRadius: 'var(--radius-lg)', padding: 32, textAlign: 'center',
              cursor: 'pointer', marginBottom: 16, transition: 'all 0.2s',
              background: dragOver ? 'rgba(168,85,247,0.04)' : 'transparent',
            }}
          >
            <Upload size={28} style={{ color: 'var(--text-dim)', marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Drop files here or click to upload
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              PDF, DOCX, PPTX, TXT, MD, PNG, JPG — OCR runs automatically
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>
              Paste images with Ctrl+V / Cmd+V
            </div>
            <input ref={fileInputRef} type="file" multiple
              accept=".pdf,.docx,.pptx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.bmp,.tiff"
              style={{ display: 'none' }} onChange={onDrop} />
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {files.map(f => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', marginBottom: 4, fontSize: 12,
                }}>
                  <FileText size={14} style={{
                    color: f.status === 'done' ? '#10b981' : f.status === 'error' ? '#ef4444' : '#f59e0b',
                    flexShrink: 0,
                  }} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                    {f.name}
                  </span>
                  {f.status === 'done' && (
                    <span style={{ color: '#10b981', fontSize: 10, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {Math.round(f.text.length / 1000)}k chars
                    </span>
                  )}
                  {f.status === 'processing' && <Loader size={12} className="spin" style={{ color: '#f59e0b', flexShrink: 0 }} />}
                  {f.status === 'error' && <span style={{ color: '#ef4444', fontSize: 10, flexShrink: 0 }}>error</span>}
                  <button onClick={() => removeFile(f.id)} className="btn btn-ghost btn-sm" style={{ padding: 2 }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Paste Area */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelSt}>Or paste text / topics / transcript</label>
            <textarea
              value={paste} onChange={e => setPaste(e.target.value)}
              placeholder="Paste lecture notes, topic list, study guide, exam questions, syllabus, YouTube transcript..."
              rows={4}
              style={{
                ...inputSt, resize: 'vertical', minHeight: 80, lineHeight: 1.6,
              }}
            />
          </div>

          {/* Size & Cost Estimate */}
          {toks && cost && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7', marginBottom: 8, letterSpacing: '0.05em' }}>
                SIZE & COST ESTIMATE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Your source material</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.input.toLocaleString()} tokens</span>
                <span style={{ color: 'var(--text-muted)' }}>Generated guide (est.)</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.output.toLocaleString()} tokens</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 4 }}>Total</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 4, textAlign: 'right' }}>{toks.total.toLocaleString()} tokens</span>
              </div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                Est. cost: ${cost.total.toFixed(4)} <span style={{ color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                  {hasPricing
                    ? `(pricing for ${model.split('/')[1] || model})`
                    : selectedModel?.free ? '(free model)' : '(est. — pricing unavailable for this model)'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                1 token ~ 0.75 words. Free models cost $0.
              </div>
            </div>
          )}

          {/* Generate Button */}
          <button
            className="btn btn-primary"
            onClick={startGenerate}
            disabled={!isReady || isWorking}
            style={{
              width: '100%', padding: '14px 20px', fontSize: 14,
              background: isReady ? `linear-gradient(135deg, ${settings.color}, #a855f7)` : undefined,
              opacity: (!isReady || isWorking) ? 0.4 : 1,
              letterSpacing: '0.05em', justifyContent: 'center',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <Zap size={16} /> GENERATE STUDY GUIDE
          </button>
          {!isReady && (
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', marginTop: 6 }}>
              {!apiKey.trim() && 'Add API key in Settings above'}
              {apiKey.trim() && !allText.trim() && 'Upload files or paste text above'}
            </div>
          )}
        </>
      )}

      {/* ── Preview (done state) ── */}
      {phase === 'done' && genHTML && (
        <div>
          {/* Stats bar */}
          <div style={{
            display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <span className="badge badge-green" style={{ fontSize: 11 }}>{sections.length} sections</span>
            <span className="badge badge-accent" style={{ fontSize: 11 }}>{Math.round(genHTML.length / 1024)}kb</span>
            <span className="badge badge-yellow" style={{ fontSize: 11 }}>offline-ready</span>
            <span className="badge badge-blue" style={{ fontSize: 11 }}>{model.split('/')[1]}</span>
          </div>

          {currentGuideId && (
            <div style={{
              padding: '6px 12px', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 'var(--radius-sm)', fontSize: 11, color: '#10b981',
              marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Check size={12} /> Auto-saved to Library. Use "Update in Library" to save edits.
            </div>
          )}

          {/* ── STICKY TOOLBAR CONTAINER ── */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'var(--bg-primary, #0a0a0a)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            paddingBottom: 8,
            marginLeft: -20,
            marginRight: -20,
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 4,
          }}>
            {/* Section tools: Regenerate, Add More, Custom Prompt — collapsible for many sections */}
            {sections.length > 0 && (
              <details style={{ marginBottom: 8 }} open={sections.length <= 8}>
                <summary style={{ ...labelSt, cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                  Section Tools ({sections.length})
                  <ChevronDown size={12} />
                </summary>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, marginTop: 8 }}>
                  {sections.map(sec => (
                    <div key={sec} style={{ display: 'inline-flex', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <button
                        className={`btn btn-sm ${regenSec === sec ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() => regenerateSection(sec)}
                        disabled={!!regenSec || !!expandSec}
                        style={{ fontSize: 10, borderRadius: 0, borderRight: '1px solid var(--border)' }}
                        title={`Regenerate "${sec}" section`}
                      >
                        {regenSec === sec
                          ? <><Loader size={10} className="spin" /> regen...</>
                          : <><RefreshCw size={10} /> {sec}</>
                        }
                      </button>
                      <button
                        className={`btn btn-sm ${expandSec === sec ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => expandSection(sec)}
                        disabled={!!regenSec || !!expandSec}
                        style={{ fontSize: 10, borderRadius: 0, borderRight: '1px solid var(--border)', padding: '2px 6px' }}
                        title={`Add more content to "${sec}"`}
                      >
                        {expandSec === sec ? <Loader size={10} className="spin" /> : <Plus size={10} />}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => { setCustomPromptSec(sec); setCustomPromptText(''); }}
                        disabled={!!regenSec || !!expandSec}
                        style={{ fontSize: 10, borderRadius: 0, padding: '2px 6px' }}
                        title={`Custom AI instruction for "${sec}"`}
                      >
                        <MessageSquare size={10} />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Custom prompt modal */}
                {customPromptSec && (
                  <div style={{
                    padding: 12, background: 'var(--bg-primary)', border: '1px solid var(--accent-color, #a855f7)',
                    borderRadius: 'var(--radius-sm)', marginBottom: 8,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>
                      Custom instruction for &ldquo;{customPromptSec}&rdquo;
                    </div>
                    <textarea
                      value={customPromptText}
                      onChange={e => setCustomPromptText(e.target.value)}
                      placeholder="e.g. Add 5 more vocab words about transportation, include romaji..."
                      style={{ ...inputSt, minHeight: 60, resize: 'vertical', marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={customRegenSection} disabled={!customPromptText.trim()}>
                        <Wand2 size={12} /> Apply
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setCustomPromptSec(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </details>
            )}

            {/* AI Rewrite Selection + Add Table Row tools */}
            {phase === 'done' && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className={`btn btn-sm ${rewriteMode ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => { setRewriteMode(!rewriteMode); setRewritePreview(null) }}
                  style={{ fontSize: 11 }}
                >
                  <Wand2 size={12} /> {rewriteMode ? 'Cancel Rewrite' : 'AI Rewrite Selection'}
                </button>
                {rewriteMode && (
                  <select
                    value={rewriteAiMode}
                    onChange={e => setRewriteAiMode(e.target.value as typeof rewriteAiMode)}
                    style={{
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '4px 8px', fontSize: 11,
                      color: 'var(--text-primary)', cursor: 'pointer',
                    }}
                  >
                    <option value="rewrite">Rewrite</option>
                    <option value="simplify">Simplify</option>
                    <option value="expand">Expand</option>
                    <option value="grammar">Fix Grammar</option>
                    <option value="mnemonic">Make Mnemonic</option>
                  </select>
                )}
                <button className="btn btn-sm btn-ghost" onClick={addTableRow} style={{ fontSize: 11 }}>
                  <Plus size={12} /> Add Table Row
                </button>
              </div>
            )}

            {/* Rewrite Selection panel */}
            {rewriteMode && !rewritePreview && (
              <div style={{
                padding: 12, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)',
                borderRadius: 'var(--radius-sm)', marginBottom: 8,
              }}>
                <div style={{ fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                  1. Select text in the preview below &nbsp;&rarr;&nbsp; 2. Choose mode &amp; instruction (optional) &nbsp;&rarr;&nbsp; 3. Click Rewrite
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={rewritePrompt}
                    onChange={e => setRewritePrompt(e.target.value)}
                    placeholder="e.g. Make simpler, Add romaji, Translate to English..."
                    style={{ ...inputSt, flex: 1 }}
                    onKeyDown={e => { if (e.key === 'Enter') rewriteSelection() }}
                  />
                  <button className="btn btn-primary btn-sm" onClick={rewriteSelection} disabled={rewriting}>
                    {rewriting ? <><Loader size={12} className="spin" /> Rewriting...</> : <><Wand2 size={12} /> Rewrite</>}
                  </button>
                </div>
              </div>
            )}

            {/* Rewrite preview panel — Accept / Reject / Regenerate */}
            {rewritePreview && (
              <div style={{
                padding: 12, background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)',
                borderRadius: 'var(--radius-sm)', marginBottom: 8,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7', marginBottom: 8, letterSpacing: '0.04em' }}>
                  REWRITE PREVIEW
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>ORIGINAL</div>
                    <div style={{
                      padding: 8, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-secondary)',
                      maxHeight: 150, overflowY: 'auto', textDecoration: 'line-through', opacity: 0.7,
                      lineHeight: 1.5,
                    }} dangerouslySetInnerHTML={{ __html: rewritePreview.original }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>REWRITTEN</div>
                    <div style={{
                      padding: 8, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
                      borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--text-primary)',
                      maxHeight: 150, overflowY: 'auto', lineHeight: 1.5,
                    }} dangerouslySetInnerHTML={{ __html: rewritePreview.rewritten }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-sm" style={{ background: '#22c55e', color: '#fff', border: 'none' }} onClick={acceptRewrite}>
                    <Check size={12} /> Accept
                  </button>
                  <button className="btn btn-sm btn-ghost" style={{ color: '#ef4444' }} onClick={rejectRewrite}>
                    <X size={12} /> Reject
                  </button>
                  <button className="btn btn-sm btn-ghost" onClick={regenerateRewrite} disabled={rewriting}>
                    <RefreshCw size={12} /> Regenerate
                  </button>
                </div>
              </div>
            )}

            {/* Editor Toolbar (edit mode) */}
            {editMode && (
              <EditorToolbar iframeRef={iframeRef} onHtmlChange={(html) => setGenHTML(html)} />
            )}
          </div>
          {/* ── END STICKY TOOLBAR CONTAINER ── */}

          {/* HTML Source Editor */}
          {showHtmlEditor && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace' }}>
                  HTML Source — edit directly, then click Save
                </span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const ta = document.getElementById('sg-html-editor') as HTMLTextAreaElement | null
                    if (ta) saveHtmlEdits(ta.value)
                  }}
                >
                  <Check size={14} /> Save HTML
                </button>
              </div>
              <textarea
                id="sg-html-editor"
                defaultValue={genHTML}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: 300, maxHeight: '50vh', padding: 12,
                  fontFamily: 'DM Mono, Consolas, monospace', fontSize: 12, lineHeight: 1.5,
                  background: '#0d0d0d', color: '#e0e0e0', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Preview iframe — uses Blob URL for large content to avoid Chrome srcdoc limits */}
          <div style={{
            borderRadius: 'var(--radius)', overflow: 'hidden',
            border: editMode ? '2px solid #22c55e' : '1px solid var(--border)', background: 'white',
          }}>
            <StudyGuideIframe ref={iframeRef} html={genHTML} editMode={editMode} />
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {phase === 'confirming' && toks && cost && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }} onClick={e => { if (e.target === e.currentTarget) setPhase('idle') }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)', padding: 24, width: '90%', maxWidth: 440,
          }}>
            <h3 style={{ margin: '0 0 16px', fontFamily: 'var(--font-heading)', fontSize: 16, color: 'var(--text-primary)' }}>
              <Zap size={16} style={{ display: 'inline', marginRight: 8, color: '#a855f7' }} />
              Confirm Token Usage
            </h3>

            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Model: <span style={{ color: '#a855f7' }}>{model.split('/')[1]}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', fontSize: 12, marginBottom: 12 }}>
              <span style={{ color: 'var(--text-muted)' }}>Source chars</span>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{allText.length.toLocaleString()}</span>
              <span style={{ color: 'var(--text-muted)' }}>Input tokens</span>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.input.toLocaleString()}</span>
              <span style={{ color: 'var(--text-muted)' }}>Output tokens</span>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.output.toLocaleString()}</span>
              <span style={{ fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 6 }}>Total</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 6, textAlign: 'right' }}>{toks.total.toLocaleString()}</span>
            </div>

            <div style={{
              fontSize: 11, color: '#10b981', fontFamily: 'var(--font-mono)', marginBottom: 16,
              padding: '8px 12px', background: 'rgba(16,185,129,0.06)', borderRadius: 'var(--radius-sm)',
            }}>
              Est. cost: ~${cost.total.toFixed(4)} {hasPricing ? `(pricing for ${model.split('/')[1] || model})` : selectedModel?.free ? '(free model)' : '(est. — actual cost varies by model)'}
            </div>

            <div style={{
              padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
              fontSize: 11, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6,
            }}>
              Depth: <b style={{ color: '#a855f7' }}>{settings.depth}</b> &middot;
              Diagrams: <b style={{ color: '#a855f7' }}>{settings.diagrams}</b> &middot;
              Tone: <b style={{ color: '#a855f7' }}>{settings.profanity}</b> &middot;
              Color: <span style={{ color: settings.color }}>&#9632;</span> {settings.color}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPhase('idle')}><X size={14} /> Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={confirmGenerate}
                style={{ background: `linear-gradient(135deg, ${settings.color}, #a855f7)` }}>
                <Check size={14} /> Generate ({toks.total.toLocaleString()} tokens)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Shared sub-components ──────────────────────────────── */

function RadioGroup({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {options.map(o => (
        <label key={o.value} style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <input type="radio" name={name} value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)} style={{ accentColor: '#a855f7' }} />
          {o.label}
        </label>
      ))}
    </div>
  )
}

/* ── Shared styles ──────────────────────────────────────── */

const labelSt: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
  display: 'block', marginBottom: 4, letterSpacing: '0.04em',
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
}

/**
 * Memoized iframe that uses Blob URLs for large content (>32KB) to avoid
 * Chrome's srcdoc size limits that cause blank/crashed iframes.
 * Small content still uses srcdoc for simplicity.
 */
const BLOB_THRESHOLD = 32000 // bytes — switch to Blob URL above this

const StudyGuideIframe = memo(forwardRef<HTMLIFrameElement, { html: string; editMode: boolean }>(
  ({ html, editMode: _ }, ref) => {
    const blobUrlRef = useRef<string | null>(null)
    const [iframeSrc, setIframeSrc] = useState<{ mode: 'srcdoc'; html: string } | { mode: 'blob'; url: string }>({ mode: 'srcdoc', html: '' })

    useEffect(() => {
      // Cleanup previous blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
      if (!html) return
      if (html.length < BLOB_THRESHOLD) {
        setIframeSrc({ mode: 'srcdoc', html })
      } else {
        const blob = new Blob([html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setIframeSrc({ mode: 'blob', url })
      }
      return () => {
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current)
          blobUrlRef.current = null
        }
      }
    }, [html])

    return iframeSrc.mode === 'srcdoc' ? (
      <iframe
        ref={ref}
        srcDoc={iframeSrc.html}
        title="Study Guide Preview"
        sandbox="allow-scripts allow-same-origin"
        style={{ width: '100%', border: 'none', background: 'white', display: 'block', minHeight: 600 }}
      />
    ) : (
      <iframe
        ref={ref}
        src={iframeSrc.url}
        title="Study Guide Preview"
        style={{ width: '100%', border: 'none', background: 'white', display: 'block', minHeight: 600 }}
      />
    )
  }
), (prev, next) => prev.html === next.html)

/* ── Editor Toolbar — rich formatting for study guide edit mode ── */
function EditorToolbar({ iframeRef, onHtmlChange }: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>
  onHtmlChange: (html: string) => void
}) {
  // CRITICAL: Save/restore selection so toolbar clicks don't lose iframe focus
  const savedRangeRef = useRef<Range | null>(null)

  // Track selection changes inside iframe to save the range
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const trackSelection = () => {
      const doc = iframe.contentDocument
      if (!doc) return
      const handler = () => {
        const sel = doc.getSelection()
        if (sel && sel.rangeCount > 0) {
          savedRangeRef.current = sel.getRangeAt(0).cloneRange()
        }
      }
      doc.addEventListener('selectionchange', handler)
      return () => doc.removeEventListener('selectionchange', handler)
    }
    // iframe may not be loaded yet — listen for load
    const cleanup = trackSelection()
    const onLoad = () => { trackSelection() }
    iframe.addEventListener('load', onLoad)
    return () => { cleanup?.(); iframe.removeEventListener('load', onLoad) }
  }, [iframeRef])

  // Restore selection + refocus iframe, then exec command
  const exec = (cmd: string, value?: string) => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!doc || !win) return
    // Restore saved selection
    const sel = doc.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
    win.focus()
    doc.execCommand(cmd, false, value ?? undefined)
    // Update saved range after command
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
    onHtmlChange(doc.documentElement.outerHTML)
  }

  // Prevent focus theft on all toolbar buttons
  const noFocus = (e: React.MouseEvent) => e.preventDefault()

  const insertTable = () => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!doc || !win) return
    const sel = doc.getSelection()
    if (sel && savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current) }
    win.focus()
    const table = `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr><th style="border:1px solid #555;padding:8px;background:#2a2a3e;color:#e0e0e0">Column 1</th><th style="border:1px solid #555;padding:8px;background:#2a2a3e;color:#e0e0e0">Column 2</th><th style="border:1px solid #555;padding:8px;background:#2a2a3e;color:#e0e0e0">Column 3</th></tr></thead><tbody><tr><td style="border:1px solid #555;padding:8px">…</td><td style="border:1px solid #555;padding:8px">…</td><td style="border:1px solid #555;padding:8px">…</td></tr></tbody></table>`
    doc.execCommand('insertHTML', false, table)
    onHtmlChange(doc.documentElement.outerHTML)
  }

  const insertHr = () => exec('insertHTML', '<hr style="border:none;border-top:1px solid #555;margin:16px 0">')

  const insertLink = () => {
    // Save range before prompt() steals focus
    const url = prompt('Enter URL:')
    if (url) exec('createLink', url)
  }

  const changeFontSize = (size: string) => {
    const iframe = iframeRef.current
    const doc = iframe?.contentDocument
    const win = iframe?.contentWindow
    if (!doc || !win) return
    // Restore selection first
    const sel = doc.getSelection()
    if (sel && savedRangeRef.current) { sel.removeAllRanges(); sel.addRange(savedRangeRef.current) }
    win.focus()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0)
      const span = doc.createElement('span')
      span.style.fontSize = size
      range.surroundContents(span)
      onHtmlChange(doc.documentElement.outerHTML)
    }
  }

  const changeColor = (color: string) => exec('foreColor', color)
  const changeBgColor = (color: string) => exec('hiliteColor', color)

  const btnStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '4px 6px', cursor: 'pointer', color: 'var(--text-primary)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 28, height: 28, fontSize: 11, flexShrink: 0,
  }
  const sepStyle: React.CSSProperties = {
    width: 1, height: 20, background: 'var(--border)', margin: '0 4px', flexShrink: 0,
  }

  return (
    <div style={{
      background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
      borderRadius: 'var(--radius-sm)', padding: '6px 8px', marginBottom: 8,
    }}>
      {/* Scrollable toolbar row for mobile */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', marginBottom: 4, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {/* Undo / Redo */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('undo')} title="Undo"><Undo2 size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('redo')} title="Redo"><Redo2 size={13} /></button>
        <div style={sepStyle} />

        {/* Text formatting */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('bold')} title="Bold"><Bold size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('italic')} title="Italic"><Italic size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('underline')} title="Underline"><Underline size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('strikeThrough')} title="Strikethrough"><Strikethrough size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('superscript')} title="Superscript">x²</button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('subscript')} title="Subscript">x₂</button>
        <div style={sepStyle} />

        {/* Headings */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('formatBlock', 'h1')} title="Heading 1"><Heading1 size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('formatBlock', 'h2')} title="Heading 2"><Heading2 size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('formatBlock', 'h3')} title="Heading 3"><Heading3 size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('formatBlock', 'p')} title="Normal text"><Type size={13} /></button>
        <div style={sepStyle} />

        {/* Lists */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('insertUnorderedList')} title="Bullet list"><List size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('insertOrderedList')} title="Numbered list"><ListOrdered size={13} /></button>
        <div style={sepStyle} />

        {/* Alignment */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('justifyLeft')} title="Align left"><AlignLeft size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('justifyCenter')} title="Align center"><AlignCenter size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('justifyRight')} title="Align right"><AlignRight size={13} /></button>
        <div style={sepStyle} />

        {/* Colors */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => changeBgColor('#ffeb3b')} title="Highlight yellow"><Highlighter size={13} style={{ color: '#ffeb3b' }} /></button>
        <label style={{ ...btnStyle, position: 'relative' }} title="Text color">
          <Type size={13} style={{ color: '#ef4444' }} />
          <input type="color" onChange={e => changeColor(e.target.value)} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 }} />
        </label>
        <div style={sepStyle} />

        {/* Insert */}
        <button style={btnStyle} onMouseDown={noFocus} onClick={insertLink} title="Insert link"><Link size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={insertHr} title="Horizontal line"><Minus size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={() => exec('insertHTML', '<code style="background:#2a2a3e;padding:2px 6px;border-radius:4px;font-family:monospace">code</code>')} title="Inline code"><Code size={13} /></button>
        <button style={btnStyle} onMouseDown={noFocus} onClick={insertTable} title="Insert table"><Table size={13} /></button>
        <div style={sepStyle} />

        {/* Font size */}
        <select onMouseDown={noFocus} onChange={e => { changeFontSize(e.target.value); e.target.value = '' }} defaultValue="" style={{ ...btnStyle, minWidth: 50, fontSize: 10, padding: '2px 4px' }} title="Font size">
          <option value="" disabled>Size</option>
          <option value="10px">10</option>
          <option value="12px">12</option>
          <option value="14px">14</option>
          <option value="16px">16</option>
          <option value="18px">18</option>
          <option value="20px">20</option>
          <option value="24px">24</option>
          <option value="32px">32</option>
        </select>
      </div>

      <div style={{ fontSize: 10, color: '#22c55e', opacity: 0.7 }}>
        Edit Mode — select text, then click toolbar buttons to format. Ctrl+Z/Y for undo/redo. Auto-saves on exit.
      </div>
    </div>
  )
}
