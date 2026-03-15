import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_DOMAINS = [
  'instructure.com',
  'canvas.unomaha.edu',
  'canvas.unl.edu',
  'canvas.nebraska.edu',
];

function isAllowedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_DOMAINS.some(d => hostname.endsWith(d));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers — restrict to known origins
  const origin = req.headers.origin || '';
  const allowedOrigins = ['https://nousai-app.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://nousai-app.vercel.app');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { canvasUrl, canvasToken, endpoint } = req.body || {};

  if (!canvasUrl || !canvasToken || !endpoint) {
    return res.status(400).json({ error: 'Missing canvasUrl, canvasToken, or endpoint' });
  }

  if (!isAllowedDomain(canvasUrl)) {
    return res.status(403).json({ error: 'Canvas URL domain not allowed' });
  }

  // Validate endpoint: only allow safe API path segments (no traversal)
  const safeEndpoint = endpoint.replace(/^\/+/, '').replace(/\.\./g, '');
  if (safeEndpoint !== endpoint.replace(/^\/+/, '') || /[^a-zA-Z0-9/_\-?&=%.+]/.test(safeEndpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint path' });
  }

  // Normalize URL
  const baseUrl = canvasUrl.replace(/\/+$/, '');
  const apiUrl = `${baseUrl}/api/v1/${safeEndpoint}`;

  try {
    // Fetch all pages (Canvas uses Link header pagination)
    let allData: unknown[] = [];
    let nextUrl: string | null = apiUrl;
    let pageCount = 0;
    const MAX_PAGES = 10;

    while (nextUrl && pageCount < MAX_PAGES) {
      // Validate pagination URLs against the same domain allowlist
      if (nextUrl !== apiUrl && !isAllowedDomain(nextUrl)) {
        break; // Stop following pagination to untrusted domains
      }

      const response = await fetch(nextUrl, {
        headers: {
          'Authorization': `Bearer ${canvasToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return res.status(response.status).json({
          error: `Canvas API error: ${response.status}`,
          details: errorText.substring(0, 500),
        });
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        allData = allData.concat(data);
      } else {
        // Single object response (not paginated)
        return res.status(200).json(data);
      }

      // Check for next page
      const linkHeader = response.headers.get('Link') || '';
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      nextUrl = nextMatch ? nextMatch[1] : null;
      pageCount++;
    }

    return res.status(200).json(allData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Proxy request failed', details: message });
  }
}
