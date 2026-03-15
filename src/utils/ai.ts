/**
 * Shared AI Service for NousAI
 *
 * Reads provider config from localStorage and provides a unified
 * `callAI()` function for all 6 supported providers.
 */

export type AIProvider = 'none' | 'openai' | 'anthropic' | 'openrouter' | 'google' | 'groq' | 'custom'

export type AIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | AIContentPart[]
}

export interface AIOptions {
  temperature?: number
  maxTokens?: number
  json?: boolean
  onChunk?: (chunk: string) => void
}

interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  baseUrl: string
  customModel: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  streaming: boolean
}

function getConfig(): AIConfig {
  return {
    provider: (localStorage.getItem('nousai-ai-provider') || 'none') as AIProvider,
    apiKey: localStorage.getItem('nousai-ai-apikey') || '',
    model: localStorage.getItem('nousai-ai-model') || '',
    baseUrl: localStorage.getItem('nousai-ai-baseurl') || '',
    customModel: localStorage.getItem('nousai-ai-custom-model') || '',
    temperature: parseFloat(localStorage.getItem('nousai-ai-temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('nousai-ai-max-tokens') || '2048'),
    systemPrompt: localStorage.getItem('nousai-ai-system-prompt') || '',
    streaming: localStorage.getItem('nousai-ai-streaming') !== 'false',
  }
}

export function isAIConfigured(): boolean {
  const c = getConfig()
  return c.provider !== 'none' && !!c.apiKey
}

// ─── In-memory response cache (non-streaming only) ──────
const AI_CACHE = new Map<string, { response: string; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX = 20

/**
 * Call the configured AI provider with a list of messages.
 * Returns the assistant's text response.
 *
 * If `options.onChunk` is provided and the provider supports streaming,
 * chunks are streamed to the callback and the full text is also returned.
 */
export async function callAI(
  messages: AIMessage[],
  options: AIOptions = {},
): Promise<string> {
  const cfg = getConfig()

  if (cfg.provider === 'none' || !cfg.apiKey) {
    throw new Error('AI not configured. Go to Settings → AI Provider to set up your API key.')
  }

  const temp = options.temperature ?? cfg.temperature
  const maxTokens = options.maxTokens ?? cfg.maxTokens

  // Prepend system prompt if configured
  const allMessages = cfg.systemPrompt
    ? [{ role: 'system' as const, content: cfg.systemPrompt }, ...messages]
    : messages

  // Check cache for non-streaming requests
  const cacheKey = !options.onChunk ? JSON.stringify(allMessages) : null
  if (cacheKey) {
    const cached = AI_CACHE.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.response
    }
  }

  let result: string
  try {
  switch (cfg.provider) {
    case 'openai':
      result = await callOpenAICompatible(
        cfg.baseUrl || 'https://api.openai.com/v1',
        cfg.apiKey,
        cfg.model || 'gpt-4o',
        allMessages, temp, maxTokens, options,
        { Authorization: `Bearer ${cfg.apiKey}` },
      )
      break

    case 'anthropic':
      result = await callAnthropic(cfg, allMessages, temp, maxTokens, options)
      break

    case 'openrouter':
      result = await callOpenAICompatible(
        'https://openrouter.ai/api/v1',
        cfg.apiKey,
        cfg.model || 'anthropic/claude-sonnet-4.6',
        allMessages, temp, maxTokens, options,
        {
          Authorization: `Bearer ${cfg.apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'NousAI Study Companion',
        },
      )
      break

    case 'google':
      result = await callGoogle(cfg, allMessages, temp, maxTokens, options)
      break

    case 'groq':
      result = await callOpenAICompatible(
        'https://api.groq.com/openai/v1',
        cfg.apiKey,
        cfg.model || 'llama-3.3-70b-versatile',
        allMessages, temp, maxTokens, options,
        { Authorization: `Bearer ${cfg.apiKey}` },
      )
      break

    case 'custom':
      result = await callOpenAICompatible(
        cfg.baseUrl,
        cfg.apiKey,
        cfg.customModel || cfg.model || 'default',
        allMessages, temp, maxTokens, options,
        { Authorization: `Bearer ${cfg.apiKey}` },
      )
      break

    default:
      throw new Error(`Unknown provider: ${cfg.provider}`)
  }
  } catch (e: any) {
    // Re-wrap network failures as a user-friendly "provider unavailable" message
    // Pass through rate limit, timeout, and already-formatted messages as-is
    if (
      e?.message?.includes('Rate limit') ||
      e?.message?.includes('timed out') ||
      e?.message?.includes('AI not configured') ||
      e?.message?.includes('Unknown provider')
    ) {
      throw e
    }
    if (e?.name === 'TypeError' && e?.message?.includes('fetch')) {
      throw new Error(`AI provider unavailable — check your internet connection and try again.`)
    }
    throw e
  }

  // Cache non-streaming responses
  if (cacheKey) {
    AI_CACHE.set(cacheKey, { response: result, timestamp: Date.now() })
    if (AI_CACHE.size > CACHE_MAX) {
      const oldest = AI_CACHE.keys().next().value
      if (oldest) AI_CACHE.delete(oldest)
    }
  }

  return result
}

// ─── OpenAI-compatible (OpenAI, OpenRouter, Groq, Custom) ──

// ─── Request timeout helper ─────────────────────────────────
const AI_TIMEOUT_MS = 60_000 // 60 seconds

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)
  // If caller also passes a signal, abort ours when theirs fires
  signal?.addEventListener('abort', () => controller.abort())
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  }
}

async function callOpenAICompatible(
  baseUrl: string,
  _apiKey: string,
  model: string,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  options: AIOptions,
  headers: Record<string, string>,
): Promise<string> {
  const stream = !!options.onChunk

  const body: any = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream,
  }
  if (options.json) {
    body.response_format = { type: 'json_object' }
  }

  const { signal, cleanup } = withTimeout()
  let res: Response
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e: any) {
    cleanup()
    if (e?.name === 'AbortError') throw new Error('Request timed out — please try again.')
    throw e
  }
  cleanup()

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const wait = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please wait a moment.'
      throw new Error(`Rate limit reached.${wait}`)
    }
    throw new Error(err?.error?.message || `AI request failed (HTTP ${res.status})`)
  }

  if (stream && res.body) {
    return readSSEStream(res.body, (data) => {
      const choice = data.choices?.[0]
      const delta = choice?.delta?.content
      if (delta) options.onChunk!(delta)
      return delta || ''
    })
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ─── Convert OpenAI multimodal content to Anthropic format ──
function toAnthropicContent(content: string | AIContentPart[]): any {
  if (typeof content === 'string') return content
  return content.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text }
    if (part.type === 'image_url') {
      const url = part.image_url.url
      // Parse data URL: "data:image/png;base64,iVBOR..."
      const match = url.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        return { type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } }
      }
      // External URL — Anthropic also supports this
      return { type: 'image', source: { type: 'url', url } }
    }
    return part
  })
}

// ─── Anthropic ─────────────────────────────────────────────

async function callAnthropic(
  cfg: AIConfig,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  options: AIOptions,
): Promise<string> {
  // Anthropic uses a separate system parameter, not a system message
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: toAnthropicContent(m.content) }))

  const stream = !!options.onChunk

  const body: any = {
    model: cfg.model || 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    temperature,
    messages: chatMessages,
    stream,
  }
  if (systemMsg) {
    body.system = typeof systemMsg.content === 'string' ? systemMsg.content : systemMsg.content.map(p => p.type === 'text' ? p.text : '').join('')
  }

  const { signal, cleanup } = withTimeout()
  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e: any) {
    cleanup()
    if (e?.name === 'AbortError') throw new Error('Request timed out — please try again.')
    throw e
  }
  cleanup()

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const wait = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please wait a moment.'
      throw new Error(`Rate limit reached.${wait}`)
    }
    throw new Error(err?.error?.message || `Anthropic request failed (HTTP ${res.status})`)
  }

  if (stream && res.body) {
    return readSSEStream(res.body, (data) => {
      if (data.type === 'content_block_delta') {
        const text = data.delta?.text || ''
        if (text) options.onChunk!(text)
        return text
      }
      return ''
    })
  }

  const data = await res.json()
  return data.content?.[0]?.text || ''
}

// ─── Google AI (Gemini) ────────────────────────────────────

async function callGoogle(
  cfg: AIConfig,
  messages: AIMessage[],
  temperature: number,
  maxTokens: number,
  options: AIOptions,
): Promise<string> {
  const model = cfg.model || 'gemini-2.5-flash'

  // Convert messages to Google format
  const systemInstruction = messages.find(m => m.role === 'system')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: typeof m.content === 'string'
        ? [{ text: m.content }]
        : m.content.map(p => {
            if (p.type === 'text') return { text: p.text }
            if (p.type === 'image_url') {
              const match = p.image_url.url.match(/^data:([^;]+);base64,(.+)$/)
              if (match) return { inlineData: { mimeType: match[1], data: match[2] } }
            }
            return { text: '' }
          }),
    }))

  const body: any = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: typeof systemInstruction.content === 'string' ? systemInstruction.content : systemInstruction.content.map(p => p.type === 'text' ? p.text : '').join('') }] }
  }
  if (options.json) {
    body.generationConfig.responseMimeType = 'application/json'
  }

  const endpoint = options.onChunk ? 'streamGenerateContent' : 'generateContent'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}`

  const { signal, cleanup } = withTimeout()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e: any) {
    cleanup()
    if (e?.name === 'AbortError') throw new Error('Request timed out — please try again.')
    throw e
  }
  cleanup()

  if (!res.ok) {
    const err = await res.json().catch(() => null)
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const wait = retryAfter ? ` Please wait ${retryAfter} seconds.` : ' Please wait a moment.'
      throw new Error(`Rate limit reached.${wait}`)
    }
    throw new Error(err?.error?.message || `Google AI request failed (HTTP ${res.status})`)
  }

  if (options.onChunk && res.body) {
    // Google streams JSON array chunks
    const text = await res.text()
    try {
      const chunks = JSON.parse(text)
      let full = ''
      for (const chunk of chunks) {
        const t = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
        if (t) {
          options.onChunk(t)
          full += t
        }
      }
      return full
    } catch {
      // Fallback: parse as single response
      const data = JSON.parse(text)
      return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    }
  }

  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ─── SSE Stream Reader ─────────────────────────────────────

async function readSSEStream(
  body: ReadableStream<Uint8Array>,
  extractChunk: (parsed: any) => string,
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) continue
      const jsonStr = trimmed.slice(5).trim()
      if (jsonStr === '[DONE]') continue
      try {
        const parsed = JSON.parse(jsonStr)
        full += extractChunk(parsed)
      } catch {
        // skip malformed chunks
      }
    }
  }

  return full
}
