import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, FileText, Download, RefreshCw, X, Loader, AlertTriangle,
  Trash2, Zap, Check, ChevronDown, ChevronUp, Settings, Eye, Sparkles,
} from 'lucide-react'
import {
  processFile, estimateTokens, estimateCost, buildSystemPrompt,
  callOpenRouter, PALETTES, fetchOpenRouterModels, modelTag,
  type GenSettings, type ModelOption,
} from './studyGenUtils'

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
  const [models, setModels] = useState<ModelOption[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
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

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch models from OpenRouter API on mount
  useEffect(() => {
    let cancelled = false
    fetchOpenRouterModels()
      .then(m => { if (!cancelled) { setModels(m); setModelsLoading(false) } })
      .catch(() => { if (!cancelled) setModelsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const allText = [
    ...files.filter(f => f.status === 'done').map(f => f.text),
    paste,
  ].filter(Boolean).join('\n\n=====\n\n')

  const toks = allText.trim() ? estimateTokens(allText, settings.depth) : null
  const cost = toks ? estimateCost(toks) : null

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
    setProgress('Sending to model...')
    try {
      const sys = buildSystemPrompt(settings)
      const userMsg = `SOURCE MATERIAL:\n\n${allText}\n\n---\n\nGenerate the complete interactive study guide HTML now. Start immediately with <!DOCTYPE html>.`
      const maxOut = Math.max(toks?.output || 10000, settings.tokenLimit)
      setProgress(`Generating with ${model.split('/')[1]}...`)
      const html = await callOpenRouter(apiKey, model, sys, userMsg, maxOut)
      if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html')) {
        throw new Error('Model did not return valid HTML. Response: ' + html.slice(0, 200))
      }
      setGenHTML(html)
      const secMatches = [...html.matchAll(/data-section="([^"]+)"/g)]
      setSections([...new Set(secMatches.map(m => m[1]))])
      setPhase('done')
      setProgress('')
    } catch (e: unknown) {
      setError(`Generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
      setPhase('error')
      setProgress('')
    }
  }

  const download = () => {
    const blob = new Blob([genHTML], { type: 'text/html' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `nousai_study_guide_${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(a.href)
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
        setGenHTML(doc.documentElement.outerHTML)
      }
    } catch (e: unknown) {
      setError(`Regen failed: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
    setRegenSec(null)
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
                <button className="btn btn-primary btn-sm" onClick={download}><Download size={14} /> Download HTML</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setGenHTML(''); setPhase('idle'); setSections([]) }}>
                  <X size={14} /> Reset
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status line */}
        {isWorking && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)',
            borderRadius: 'var(--radius-sm)', fontSize: 12, color: '#a855f7',
          }}>
            <Loader size={14} className="spin" /> {progress || 'Working...'}
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
              <label style={labelSt}>Model</label>
              <select value={model} onChange={e => setModel(e.target.value)} style={inputSt}>
                <option value="openrouter/auto">Auto Router (best match)</option>
                {modelsLoading
                  ? <option disabled>Loading models...</option>
                  : models.map(m => <option key={m.id} value={m.id}>{m.label} — {modelTag(m)}</option>)
                }
              </select>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3 }}>
                {modelsLoading ? 'Fetching models...' : `${models.length} models · live from OpenRouter API`}
              </div>
              {/* Selected model info */}
              {(() => {
                const sel = models.find(m => m.id === model)
                if (!sel) return null
                return (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, lineHeight: 1.5 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ color: sel.isFree ? '#4ade80' : '#F5A623' }}>{sel.isFree ? 'Free' : `In: ${modelTag(sel).split(' · ')[1]} · Out: ${(() => { const p = sel.completionPrice * 1_000_000; return p < 0.01 ? '<$0.01/M' : p < 1 ? `$${p.toFixed(2)}/M` : `$${p.toFixed(1)}/M`; })()}`}</span>
                      <span>Context: {modelTag(sel).split(' · ')[0]}</span>
                      {sel.maxCompletionTokens > 0 && <span>Max output: {sel.maxCompletionTokens > 1000 ? `${Math.round(sel.maxCompletionTokens / 1000)}K` : sel.maxCompletionTokens}</span>}
                    </div>
                    {sel.supportedParams.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {sel.supportedParams.includes('tools') && <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Tools</span>}
                        {sel.supportedParams.includes('reasoning') && <span style={{ background: 'rgba(245,166,35,0.2)', color: '#F5A623', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Reasoning</span>}
                        {sel.inputModalities.includes('image') && <span style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Vision</span>}
                        {sel.supportedParams.includes('structured_outputs') && <span style={{ background: 'rgba(96,165,250,0.2)', color: '#60a5fa', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>Structured</span>}
                      </div>
                    )}
                    {sel.description && <div style={{ marginTop: 4, fontSize: 10, opacity: 0.7 }}>{sel.description.slice(0, 120)}{sel.description.length > 120 ? '…' : ''}</div>}
                  </div>
                )
              })()}
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
              <label style={labelSt}>Max Output Tokens</label>
              <input type="number" value={settings.tokenLimit} onChange={e => setSetting('tokenLimit', parseInt(e.target.value) || 8000)}
                min={2000} max={65000} step={1000} style={inputSt} />
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

          {/* Token Estimate */}
          {toks && cost && (
            <div className="card" style={{ padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7', marginBottom: 8, letterSpacing: '0.05em' }}>
                TOKEN ESTIMATE
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '4px 16px', fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)' }}>Input (source + system)</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.input.toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)' }}>Output (guide generation)</span>
                <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{toks.output.toLocaleString()}</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 4 }}>Total</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 600, borderTop: '1px solid var(--border)', paddingTop: 4, textAlign: 'right' }}>{toks.total.toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 6, fontFamily: 'var(--font-mono)' }}>
                Est. cost: ${cost.total.toFixed(5)}
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

          {/* Section regeneration */}
          {sections.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>Regenerate a section</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {sections.map(sec => (
                  <button
                    key={sec}
                    className={`btn btn-sm ${regenSec === sec ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => regenerateSection(sec)}
                    disabled={!!regenSec}
                    style={{ fontSize: 11 }}
                  >
                    {regenSec === sec
                      ? <><Loader size={10} className="spin" /> regen...</>
                      : <><RefreshCw size={10} /> {sec}</>
                    }
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview iframe */}
          <div style={{
            borderRadius: 'var(--radius)', overflow: 'hidden',
            border: '1px solid var(--border)', background: 'white',
          }}>
            <iframe
              srcDoc={genHTML}
              title="Study Guide Preview"
              sandbox="allow-scripts allow-same-origin"
              style={{ width: '100%', border: 'none', background: 'white', display: 'block', minHeight: 600 }}
            />
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
              Est. cost: ${cost.input.toFixed(5)} + ${cost.output.toFixed(5)} = ${cost.total.toFixed(5)}
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
