const ALLOWED_ORIGINS = [
  'https://studynous.com',
  'https://www.studynous.com',
  'https://nousai-app.pages.dev',
  'https://nousai-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]
const ALLOWED_ENDPOINTS = ['user/conversations', 'user/memories', 'user/action-items']

function json(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...(extra ?? {}) },
  })
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context
  const origin = request.headers.get('origin') ?? ''
  const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-omi-key',
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, corsHeaders)
  }

  const apiKey = request.headers.get('x-omi-key') ?? ''
  if (!apiKey || !apiKey.startsWith('omi_dev_')) {
    return json({ error: 'Missing or invalid Omi API key (must start with omi_dev_)' }, 401, corsHeaders)
  }

  const url = new URL(request.url)
  const endpoint = url.searchParams.get('endpoint') ?? ''
  if (!endpoint) return json({ error: 'Missing endpoint parameter' }, 400, corsHeaders)

  const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/\.\./g, '')
  if (!ALLOWED_ENDPOINTS.some(a => cleanEndpoint.startsWith(a))) {
    return json({ error: `Endpoint not allowed. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}` }, 400, corsHeaders)
  }

  // Forward all query params except 'endpoint'
  const forwardParams = new URLSearchParams()
  url.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') forwardParams.set(key, value)
  })
  const qs = forwardParams.toString()
  const targetUrl = `https://api.omi.me/v1/dev/${cleanEndpoint}${qs ? `?${qs}` : ''}`

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: request.method === 'POST' ? await request.text() : undefined,
    })

    const data = await response.json().catch(() => ({ error: 'Empty response' }))
    return json(data, response.status, corsHeaders)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: 'Proxy request failed', details: message }, 500, corsHeaders)
  }
}
