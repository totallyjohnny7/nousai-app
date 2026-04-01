# functions/api — Cloudflare Pages Functions

Each file here is a Cloudflare Pages Function serving `/api/<name>`.

| File | Route | Purpose |
|------|-------|---------|
| `canvas-proxy.ts` | `/api/canvas-proxy` | Proxy Canvas LMS API (pagination, domain allowlist) |
| `extension-sync.ts` | `/api/extension-sync` | Chrome extension sync (Firebase ID token auth) |
| `omi-proxy.ts` | `/api/omi-proxy` | Proxy Omi wearable API (endpoint allowlist) |
| `omi-webhook.ts` | `/api/omi-webhook` | Omi voice memo processor (returns 200 instantly, runs pipeline via waitUntil) |

## Rules
- Use `PagesFunction<Env>` type for all handlers — export as `export const onRequest`
- Access environment variables via `context.env`, not `process.env`
- Use Web standard `Request`/`Response` — no Node.js http types
- Use `context.waitUntil()` for fire-and-forget background work
- The `Env` interface defines required secret bindings (set in Cloudflare Pages dashboard)
- `nodejs_compat` flag is enabled in `wrangler.toml` for firebase-admin compatibility
