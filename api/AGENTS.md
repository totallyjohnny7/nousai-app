# NousAI — API Directory

Vercel serverless functions (Node.js). Each file = one endpoint.

## Endpoints

| File | Route | Purpose |
|------|-------|---------|
| `omi-proxy.ts` | `/api/omi-proxy` | Proxies Omi wearable API, processes voice memos |
| `extension-sync.ts` | `/api/extension-sync` | Browser extension data sync |
| `canvas-proxy.ts` | `/api/canvas-proxy` | Canvas LMS integration proxy |

## Rules
- Use `@vercel/node` types for request/response
- All secrets via Vercel environment variables — never hardcode
- CORS headers required on all endpoints (PWA makes cross-origin requests)
- Timeout budget: Vercel hobby = 10s, pro = 60s max
