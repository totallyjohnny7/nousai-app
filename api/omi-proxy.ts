import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_ORIGINS = ['https://nousai-app.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
const ALLOWED_ENDPOINTS = ['user/conversations', 'user/memories', 'user/action-items'];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-omi-key');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-omi-key'] as string;
  if (!apiKey || !apiKey.startsWith('omi_dev_')) {
    return res.status(401).json({ error: 'Missing or invalid Omi API key (must start with omi_dev_)' });
  }

  const { endpoint, ...queryParams } = req.query;
  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }

  // Allowlist check — prevent path traversal to unintended Omi API resources
  const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/\.\./g, '');
  if (!ALLOWED_ENDPOINTS.some(a => cleanEndpoint.startsWith(a))) {
    return res.status(400).json({ error: `Endpoint not allowed. Allowed: ${ALLOWED_ENDPOINTS.join(', ')}` });
  }

  const qs = new URLSearchParams(
    Object.entries(queryParams).reduce((acc, [k, v]) => {
      acc[k] = Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
      return acc;
    }, {} as Record<string, string>)
  ).toString();

  const url = `https://api.omi.me/v1/dev/${cleanEndpoint}${qs ? `?${qs}` : ''}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: req.method === 'POST' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json().catch(() => ({ error: 'Empty response' }));
    return res.status(response.status).json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: 'Proxy request failed', details: message });
  }
}
