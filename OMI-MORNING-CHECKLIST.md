# Omi Setup — Morning Checklist

> Everything Claude built overnight is already deployed to production.
> This is what YOU need to do when you wake up.

---

## Step 1 — Get your Omi Developer API Key (5 min)

1. Open the **Omi mobile app** on your phone
2. Go to **Settings → Developer**
3. Tap **"Create Key"**
4. Name it: `NousAI`
5. Select scopes: ✅ `conversations:read` (minimum required)
   - Optionally also: `memories:read`, `action_items:read`
6. Tap **Create** — **COPY THE KEY IMMEDIATELY** (it's only shown once)
   - Key format: `omi_dev_xxxxxxxxxxxx...`

---

## Step 2 — Connect Omi to NousAI (2 min)

**Option A — Through Settings (recommended first time):**
1. Go to https://nousai-app.vercel.app
2. Clear PWA cache first (run in browser console):
   ```js
   navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
   caches.keys().then(k => k.forEach(x => caches.delete(x)));
   ```
3. Reload the page
4. Go to **Settings → Extensions & Integrations → Omi AI Wearable**
5. Paste your API key → click **"Save & Test"**
6. You should see: ✓ "Omi connected!"

**Option B — Through AI Tools (direct):**
1. Go to **AI Tools → Omi**
2. Follow the on-screen setup (paste key → Connect)

---

## Step 3 — Sync your first conversation (1 min)

1. Go to **AI Tools → Omi**
2. Click **"Connect"** / **"Sync Now"**
3. Your Omi conversations appear with titles, summaries, and action items
4. Click **"Save"** on any conversation to add it to your Notes library
5. Click **"Save All"** to import everything at once

---

## Step 4 — Optional: Set up real-time webhook (advanced, 15 min)

This gives you live push notifications when Omi finishes processing a conversation
instead of having to click Sync Now. Skip this for now if you want quick setup.

1. Open Omi app → **Explore → Create an App**
2. Fill in:
   - Name: `NousAI Live Sync`
   - Capability: External Integration
   - Trigger: **Memory Created**
   - Webhook URL: `https://nousai-app.vercel.app/api/omi-webhook`
3. Save → copy the **App Secret**
4. *(This requires building `api/omi-webhook.ts` — not yet implemented. Ask Claude.)*

---

## What's Already Done (Claude built this overnight)

| ✅ Done | Details |
|---------|---------|
| `api/omi-proxy.ts` | Vercel serverless proxy — forwards requests to Omi API (CORS-safe) |
| `OmiTool.tsx` | Complete rewrite — real API, setup wizard, conversation list, save to library |
| Settings page | "Omi AI Wearable" section in Extensions with key input + test button |
| Build & Deploy | Zero TypeScript errors, deployed to https://nousai-app.vercel.app |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Missing or invalid Omi API key" | Key must start with `omi_dev_` — regenerate in Omi app |
| "HTTP 401" | Key was revoked or wrong scopes — create a new key with `conversations:read` |
| "HTTP 403" | Check scopes — need `conversations:read` at minimum |
| "No conversations" | You haven't had any Omi sessions yet — wear the device, talk, wait ~30s for processing |
| Old version of app | Clear PWA cache (console commands above) and hard-reload |

---

## Where to Find Things

- **Omi conversations in NousAI:** AI Tools → Omi (after syncing) + Library → Omi folder
- **API key setting:** Settings → Extensions & Integrations → Omi AI Wearable
- **Omi docs:** https://docs.omi.me/doc/developer/api/overview
- **Technical spec:** `docs/superpowers/specs/2026-03-15-omi-integration-design.md`
