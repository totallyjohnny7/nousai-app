import { useState } from 'react'
import {
  RefreshCw, ChevronDown, ChevronRight, Key, Eye, EyeOff,
  ExternalLink, Zap, Check, AlertTriangle, Settings, Shield, Info
} from 'lucide-react'
import type { AIConfig, AIProvider, AIFeatureSlot, SlotConfig } from './settingsTypes'
import { PROVIDER_INFO, SLOT_INFO, OPENAI_MODELS, ANTHROPIC_MODELS, OPENROUTER_MODELS, GOOGLE_MODELS, GROQ_MODELS, MISTRAL_MODELS } from './settingsConstants'
import { cardBodyStyle, inputStyle, selectStyle, fieldGroupStyle, labelStyle, toggleStyle, toggleKnobStyle, warningBoxStyle } from './settingsStyles'

interface AISectionProps {
  aiConfig: AIConfig
  updateAiConfig: (patch: Partial<AIConfig>) => void
  slotConfigs: Record<AIFeatureSlot, SlotConfig>
  updateSlotConfig: (slot: AIFeatureSlot, patch: Partial<SlotConfig>) => void
  clearSlotConfig: (slot: AIFeatureSlot) => void
  expandedSlot: AIFeatureSlot | null
  setExpandedSlot: (slot: AIFeatureSlot | null) => void
  showToast: (msg: string) => void
}

const SLOTS: AIFeatureSlot[] = ['chat', 'generation', 'analysis', 'ocr', 'japanese', 'physics']

export default function AISection({
  aiConfig, updateAiConfig,
  slotConfigs, updateSlotConfig, clearSlotConfig,
  expandedSlot, setExpandedSlot,
}: AISectionProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function handleTestConnection() {
    if (aiConfig.provider === 'none') {
      setConnectionResult({ ok: false, msg: 'No AI provider selected.' })
      return
    }
    if (!aiConfig.apiKey) {
      setConnectionResult({ ok: false, msg: 'Please enter an API key.' })
      return
    }
    setTestingConnection(true)
    setConnectionResult(null)
    try {
      if (aiConfig.provider === 'openai') {
        const baseUrl = aiConfig.baseUrl || 'https://api.openai.com/v1'
        const res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to OpenAI successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'anthropic') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': aiConfig.apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: aiConfig.model || 'claude-sonnet-4-20250514',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Anthropic successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to OpenRouter successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'google') {
        const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
          headers: { 'x-goog-api-key': aiConfig.apiKey },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Google AI successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${aiConfig.apiKey}` },
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to Groq successfully!' })
        } else {
          const errData = await res.json().catch(() => null)
          setConnectionResult({ ok: false, msg: errData?.error?.message || `HTTP ${res.status}: Connection failed.` })
        }
      } else if (aiConfig.provider === 'custom') {
        const res = await fetch(aiConfig.baseUrl || '', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${aiConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiConfig.customModel || 'test',
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
          }),
        })
        if (res.ok) {
          setConnectionResult({ ok: true, msg: 'Connected to custom endpoint!' })
        } else {
          setConnectionResult({ ok: false, msg: `HTTP ${res.status}: Check URL and credentials.` })
        }
      }
    } catch (e: any) {
      setConnectionResult({ ok: false, msg: e?.message || 'Network error. Check your connection and URL.' })
    } finally {
      setTestingConnection(false)
    }
  }

  return (
    <>
      {/* ── AI Configuration Card Body ── */}
      <div style={cardBodyStyle}>
        {/* Provider selector */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>AI Provider</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {(['none', 'openai', 'anthropic', 'openrouter'] as AIProvider[]).map(p => (
              <button
                key={p}
                style={{
                  padding: '8px 4px',
                  fontSize: 12,
                  fontWeight: aiConfig.provider === p ? 700 : 500,
                  background: aiConfig.provider === p ? (PROVIDER_INFO[p]?.color || 'var(--accent, #fff)') : 'var(--bg-primary)',
                  color: aiConfig.provider === p ? '#fff' : 'var(--text-secondary)',
                  border: aiConfig.provider === p ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onClick={() => updateAiConfig({ provider: p })}
              >
                {p === 'none' ? 'None' : PROVIDER_INFO[p]?.label || p}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
            {(['google', 'groq', 'mistral', 'custom'] as AIProvider[]).map(p => (
              <button
                key={p}
                style={{
                  padding: '8px 4px',
                  fontSize: 12,
                  fontWeight: aiConfig.provider === p ? 700 : 500,
                  background: aiConfig.provider === p ? (PROVIDER_INFO[p]?.color || 'var(--accent, #fff)') : 'var(--bg-primary)',
                  color: aiConfig.provider === p ? '#fff' : 'var(--text-secondary)',
                  border: aiConfig.provider === p ? 'none' : '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onClick={() => updateAiConfig({ provider: p })}
              >
                {PROVIDER_INFO[p]?.label || p}
              </button>
            ))}
          </div>
        </div>

        {aiConfig.provider !== 'none' && (
          <>
            {/* Provider info badge */}
            {PROVIDER_INFO[aiConfig.provider]?.url && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', marginBottom: 14,
                background: `${PROVIDER_INFO[aiConfig.provider].color}12`, border: `1px solid ${PROVIDER_INFO[aiConfig.provider].color}30`,
                borderRadius: 'var(--radius-sm)', fontSize: 12,
              }}>
                <ExternalLink size={12} style={{ color: PROVIDER_INFO[aiConfig.provider].color }} />
                <a href={PROVIDER_INFO[aiConfig.provider].url} target="_blank" rel="noopener noreferrer"
                  style={{ color: PROVIDER_INFO[aiConfig.provider].color, textDecoration: 'none' }}>
                  Get your {PROVIDER_INFO[aiConfig.provider].label} API key →
                </a>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              {aiConfig.provider === 'openrouter'
                ? 'Routes to 400+ models (GPT-5, Claude, Gemini, DeepSeek, Llama) from one API key. Each feature auto-selects the best model.'
                : `Your queries are sent directly to ${PROVIDER_INFO[aiConfig.provider]?.label || 'your AI provider'}. NousAI does not store or log your conversations.`}
            </div>

            {/* API Key */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>
                <Key size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                API Key
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={PROVIDER_INFO[aiConfig.provider]?.keyPrefix ? `${PROVIDER_INFO[aiConfig.provider].keyPrefix}...` : 'Enter your API key'}
                  style={{ ...inputStyle, paddingRight: 40 }}
                  value={aiConfig.apiKey}
                  onChange={e => updateAiConfig({ apiKey: e.target.value })}
                />
                <button
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', padding: 4, display: 'flex',
                  }}
                  onClick={() => setShowApiKey(!showApiKey)}
                  title={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Model selector - OpenAI */}
            {aiConfig.provider === 'openai' && (
              <>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Model</label>
                  <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                    {OPENAI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Base URL <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <input type="text" placeholder="https://api.openai.com/v1" style={inputStyle} value={aiConfig.baseUrl} onChange={e => updateAiConfig({ baseUrl: e.target.value })} />
                </div>
              </>
            )}

            {/* Model selector - Anthropic */}
            {aiConfig.provider === 'anthropic' && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Model</label>
                <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                  {ANTHROPIC_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {/* Model selector - OpenRouter */}
            {aiConfig.provider === 'openrouter' && (
              <>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Model</label>
                  <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                    <optgroup label="Anthropic">
                      {OPENROUTER_MODELS.filter(m => m.value.startsWith('anthropic/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                    <optgroup label="OpenAI">
                      {OPENROUTER_MODELS.filter(m => m.value.startsWith('openai/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                    <optgroup label="Google">
                      {OPENROUTER_MODELS.filter(m => m.value.startsWith('google/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                    <optgroup label="Meta">
                      {OPENROUTER_MODELS.filter(m => m.value.startsWith('meta-llama/')).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                    <optgroup label="Other">
                      {OPENROUTER_MODELS.filter(m => !['anthropic/', 'openai/', 'google/', 'meta-llama/'].some(p => m.value.startsWith(p))).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Or enter a custom model ID</label>
                  <input type="text" placeholder="e.g. anthropic/claude-opus-4" style={inputStyle} value={aiConfig.customModel} onChange={e => updateAiConfig({ customModel: e.target.value })} />
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Browse all models at openrouter.ai/models</p>
                </div>
              </>
            )}

            {/* Model selector - Google */}
            {aiConfig.provider === 'google' && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Model</label>
                <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                  {GOOGLE_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {/* Model selector - Groq */}
            {aiConfig.provider === 'groq' && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Model</label>
                <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                  {GROQ_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {/* Model selector - Mistral */}
            {aiConfig.provider === 'mistral' && (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Model</label>
                <select style={selectStyle} value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })}>
                  {MISTRAL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            )}

            {/* Custom provider fields */}
            {aiConfig.provider === 'custom' && (
              <>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>API URL</label>
                  <input type="text" placeholder="https://your-api.com/v1/chat/completions" style={inputStyle} value={aiConfig.baseUrl} onChange={e => updateAiConfig({ baseUrl: e.target.value })} />
                </div>
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Model Name</label>
                  <input type="text" placeholder="model-name" style={inputStyle} value={aiConfig.customModel} onChange={e => updateAiConfig({ customModel: e.target.value })} />
                </div>
              </>
            )}

            {/* ─── Advanced Options ─── */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Settings size={12} /> Advanced Options
              </div>

              {/* Temperature */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Temperature: {aiConfig.temperature.toFixed(1)}</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42 }}>Precise</span>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={aiConfig.temperature}
                    onChange={e => updateAiConfig({ temperature: parseFloat(e.target.value) })}
                    style={{ flex: 1, accentColor: PROVIDER_INFO[aiConfig.provider]?.color || 'var(--accent)' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}>Creative</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Max Tokens</label>
                <select style={selectStyle} value={aiConfig.maxTokens} onChange={e => updateAiConfig({ maxTokens: parseInt(e.target.value) })}>
                  {[256, 512, 1024, 2048, 4096, 8192, 16384].map(n => (
                    <option key={n} value={n}>{n.toLocaleString()} tokens</option>
                  ))}
                </select>
              </div>

              {/* System Prompt */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>System Prompt <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                <textarea
                  placeholder="Custom instructions for the AI (e.g. &quot;You are a helpful study tutor. Be concise and use examples.&quot;)"
                  style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
                  value={aiConfig.systemPrompt}
                  onChange={e => updateAiConfig({ systemPrompt: e.target.value })}
                />
              </div>

              {/* Streaming toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Streaming Responses</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Show tokens as they generate</div>
                </div>
                <button style={toggleStyle(aiConfig.streaming)} onClick={() => updateAiConfig({ streaming: !aiConfig.streaming })}>
                  <div style={toggleKnobStyle(aiConfig.streaming)} />
                </button>
              </div>

              {/* Response Format */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Response Format</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{ v: 'text', l: 'Text' }, { v: 'json', l: 'JSON' }, { v: 'markdown', l: 'Markdown' }].map(f => (
                    <button
                      key={f.v}
                      style={{
                        flex: 1, padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
                        fontWeight: aiConfig.responseFormat === f.v ? 700 : 500,
                        background: aiConfig.responseFormat === f.v ? 'var(--accent, #fff)' : 'var(--bg-primary)',
                        color: aiConfig.responseFormat === f.v ? 'var(--bg-primary, #000)' : 'var(--text-secondary)',
                        border: aiConfig.responseFormat === f.v ? 'none' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onClick={() => updateAiConfig({ responseFormat: f.v })}
                    >{f.l}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* ─── OpenRouter Features ─── */}
            {aiConfig.provider === 'openrouter' && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6366f1', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={12} /> OpenRouter Features
                </div>

                {/* Model Variant */}
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Model Mode</label>
                  <select style={selectStyle} value={aiConfig.orVariant} onChange={e => updateAiConfig({ orVariant: e.target.value })}>
                    {[
                      { v: '', l: 'Standard (default)' },
                      { v: ':free', l: 'Free — No cost, lower rate limits' },
                      { v: ':nitro', l: 'Speed — Fastest available server' },
                      { v: ':online', l: 'Live Web — Includes real-time search results' },
                      { v: ':thinking', l: 'Deep Think — Extra reasoning for hard problems' },
                      { v: ':extended', l: 'Extended — Process longer documents' },
                      { v: ':exacto', l: 'Precision — Best accuracy for structured tasks' },
                      { v: ':floor', l: 'Budget — Always use cheapest server' },
                    ].map(v => <option key={v.v} value={v.v}>{v.l}</option>)}
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Changes how OpenRouter handles your request. Free mode costs nothing but may be slower.</div>
                </div>

                {/* Fallback Model */}
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Backup Model <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. anthropic/claude-sonnet-4.5"
                    style={inputStyle}
                    value={aiConfig.orFallback}
                    onChange={e => updateAiConfig({ orFallback: e.target.value })}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>If your main model is down or overloaded, this model is used automatically. Leave blank to let OpenRouter choose.</div>
                </div>

                {/* Optimization Priority */}
                <div style={fieldGroupStyle}>
                  <label style={labelStyle}>Optimization Priority</label>
                  <select style={selectStyle} value={aiConfig.orSort} onChange={e => updateAiConfig({ orSort: e.target.value })}>
                    <option value="auto">Balanced (smart mix of cost and speed)</option>
                    <option value="price">Lowest Cost (cheapest server first)</option>
                    <option value="throughput">Fastest Speed (highest words/sec)</option>
                    <option value="latency">Quickest Reply (lowest wait time)</option>
                  </select>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Controls which server handles your request when multiple are available for the same model.</div>
                </div>

                {/* Web Search toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Live Web Search</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI searches the web before answering, for up-to-date facts (+~$0.02/request)</div>
                  </div>
                  <button style={toggleStyle(aiConfig.orWebSearch)} onClick={() => updateAiConfig({ orWebSearch: !aiConfig.orWebSearch })}>
                    <div style={toggleKnobStyle(aiConfig.orWebSearch)} />
                  </button>
                </div>

                {/* Deep Thinking toggle + effort */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Deep Thinking</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>AI reasons step-by-step before answering (better for complex questions, uses more tokens)</div>
                  </div>
                  <button style={toggleStyle(aiConfig.orReasoning)} onClick={() => updateAiConfig({ orReasoning: !aiConfig.orReasoning })}>
                    <div style={toggleKnobStyle(aiConfig.orReasoning)} />
                  </button>
                </div>
                {aiConfig.orReasoning && (
                  <div style={{ ...fieldGroupStyle, marginTop: 0 }}>
                    <label style={labelStyle}>Thinking Depth</label>
                    <select style={selectStyle} value={aiConfig.orReasoningEffort} onChange={e => updateAiConfig({ orReasoningEffort: e.target.value })}>
                      <option value="minimal">Quick glance — fast, minimal extra thinking</option>
                      <option value="low">Light review — brief consideration</option>
                      <option value="medium">Standard — balanced thinking (recommended)</option>
                      <option value="high">Thorough — detailed step-by-step analysis</option>
                      <option value="xhigh">Maximum — exhaustive reasoning for hardest problems</option>
                    </select>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Higher = better answers for hard questions, but slower and costs more.</div>
                  </div>
                )}

                {/* Fix Broken Responses toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Auto-Fix Responses</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Automatically repairs broken or incomplete AI responses (for flashcard/quiz generation)</div>
                  </div>
                  <button style={toggleStyle(aiConfig.orHealing)} onClick={() => updateAiConfig({ orHealing: !aiConfig.orHealing })}>
                    <div style={toggleKnobStyle(aiConfig.orHealing)} />
                  </button>
                </div>
              </div>
            )}

            {/* Test Connection */}
            <div style={{ marginTop: 8, marginBottom: 8 }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={testingConnection}
                onClick={handleTestConnection}
                style={{ opacity: testingConnection ? 0.6 : 1 }}
              >
                {testingConnection
                  ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing...</>
                  : <><Zap size={13} /> Test Connection</>}
              </button>
              {connectionResult && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 10,
                  fontSize: 12, color: connectionResult.ok ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)',
                }}>
                  {connectionResult.ok ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {connectionResult.msg}
                </div>
              )}
            </div>
          </>
        )}

        {/* Warning */}
        <div style={warningBoxStyle}>
          <Shield size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <strong>API keys are stored locally in your browser.</strong> Never share your keys with anyone.
          </div>
        </div>

        {/* What uses AI */}
        <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={12} /> Features powered by AI
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Quiz Generation', 'AI Tutoring', 'Analogy Engine', 'Course Generation', 'OCR Enhancement', 'Flashcard Creation', 'Study Plans', 'Language Practice'].map(f => (
              <span key={f} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}>{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature AI Slot Overrides Card Body ── */}
      <div style={cardBodyStyle}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
          Each feature can use a different AI provider and model. Leave a feature on "Using Default" to inherit from the Default configuration above.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
          {SLOTS.map(slot => {
            const cfg = slotConfigs[slot]
            const info = SLOT_INFO[slot]
            const isConfigured = !!cfg.provider
            const isOpen = expandedSlot === slot
            return (
              <div key={slot} style={{
                border: `1px solid ${isConfigured ? 'var(--accent, #F5A623)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden',
                opacity: 1,
              }}>
                {/* Tile header */}
                <button
                  onClick={() => setExpandedSlot(isOpen ? null : slot)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 12px', background: 'var(--bg-primary)', border: 'none',
                    cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit',
                  }}
                >
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{info.label}</div>
                    {isConfigured
                      ? <div style={{ fontSize: 11, color: PROVIDER_INFO[cfg.provider]?.color || 'var(--accent)', marginTop: 1 }}>
                          {PROVIDER_INFO[cfg.provider]?.label || cfg.provider} {cfg.model ? `— ${cfg.model}` : ''}
                        </div>
                      : <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Using Default</div>
                    }
                  </div>
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                {/* Tile body */}
                {isOpen && (
                  <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '10px 0 10px' }}>{info.description}</p>

                    {/* Provider */}
                    <div style={{ ...fieldGroupStyle }}>
                      <label style={labelStyle}>Provider</label>
                      <select
                        style={selectStyle}
                        value={cfg.provider || ''}
                        onChange={e => updateSlotConfig(slot, { provider: e.target.value })}
                      >
                        <option value="">Using Default</option>
                        {(['openai', 'anthropic', 'openrouter', 'google', 'groq', 'mistral', 'custom'] as AIProvider[]).map(p => (
                          <option key={p} value={p}>{PROVIDER_INFO[p]?.label || p}</option>
                        ))}
                      </select>
                    </div>

                    {cfg.provider && (
                      <>
                        {/* API Key */}
                        <div style={fieldGroupStyle}>
                          <label style={labelStyle}>API Key</label>
                          <input
                            type="password"
                            placeholder={PROVIDER_INFO[cfg.provider]?.keyPrefix ? `${PROVIDER_INFO[cfg.provider].keyPrefix}...` : 'Enter API key'}
                            style={inputStyle}
                            value={cfg.apiKey}
                            onChange={e => updateSlotConfig(slot, { apiKey: e.target.value })}
                          />
                        </div>

                        {/* Model */}
                        {slot === 'ocr' && cfg.provider === 'mistral' ? (
                          <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Model <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(chat, not OCR engine)</span></label>
                            <select style={selectStyle} value={cfg.model} onChange={e => updateSlotConfig(slot, { model: e.target.value })}>
                              {MISTRAL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                              OCR always uses mistral-ocr-latest. This model is used for card generation.
                            </p>
                          </div>
                        ) : (
                          <div style={fieldGroupStyle}>
                            <label style={labelStyle}>Model</label>
                            <input
                              type="text"
                              placeholder="e.g. gpt-4.1, claude-sonnet-4..."
                              style={inputStyle}
                              value={cfg.model}
                              onChange={e => updateSlotConfig(slot, { model: e.target.value })}
                            />
                          </div>
                        )}

                        {/* Clear override */}
                        <button
                          onClick={() => clearSlotConfig(slot)}
                          style={{
                            fontSize: 12, color: 'var(--text-muted)', background: 'none',
                            border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline',
                            textUnderlineOffset: 2,
                          }}
                        >
                          Clear override (revert to Default)
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
