const ALLOWED_DOMAINS = [
  'instructure.com',
  'canvas.unomaha.edu',
  'canvas.unl.edu',
  'canvas.nebraska.edu',
]

const ALLOWED_ORIGINS = [
  'https://studynous.com',
  'https://www.studynous.com',
  'https://nousai-app.pages.dev',
  'https://nousai-app.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_DOMAINS.some(d => hostname.endsWith(d))
  } catch {
    return false
  }
}

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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, corsHeaders)

  const body = await request.json().catch(() => ({})) as Record<string, unknown>
  const { canvasUrl, canvasToken, endpoint } = body

  if (!canvasUrl || !canvasToken || !endpoint) {
    return json({ error: 'Missing canvasUrl, canvasToken, or endpoint' }, 400, corsHeaders)
  }
  if (!isAllowedDomain(canvasUrl as string)) {
    return json({ error: 'Canvas URL domain not allowed' }, 403, corsHeaders)
  }

  const safeEndpoint = (endpoint as string).replace(/^\/+/, '').replace(/\.\./g, '')
  if (
    safeEndpoint !== (endpoint as string).replace(/^\/+/, '') ||
    /[^a-zA-Z0-9/_\-?&=%.+[\]]/.test(safeEndpoint)
  ) {
    return json({ error: 'Invalid endpoint path' }, 400, corsHeaders)
  }

  const baseUrl = (canvasUrl as string).replace(/\/+$/, '')
  const apiUrl = `${baseUrl}/api/v1/${safeEndpoint}`

  try {
    let allData: unknown[] = []
    let nextUrl: string | null = apiUrl
    let pageCount = 0
    const MAX_PAGES = 10

    while (nextUrl && pageCount < MAX_PAGES) {
      if (nextUrl !== apiUrl && !isAllowedDomain(nextUrl)) break

      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${canvasToken as string}`,
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error')
        return json(
          { error: `Canvas API error: ${response.status}`, details: errorText.substring(0, 500) },
          response.status,
          corsHeaders,
        )
      }

      const data = await response.json()
      if (Array.isArray(data)) {
        allData = allData.concat(data)
      } else {
        return json(data, 200, corsHeaders)
      }

      const linkHeader = response.headers.get('Link') ?? ''
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
      nextUrl = nextMatch ? nextMatch[1] : null
      pageCount++
    }

    return json(allData, 200, corsHeaders)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: 'Proxy request failed', details: message }, 500, corsHeaders)
  }
}
