# Omi AI Wearable → NousAI Integration

**Date:** 2026-03-15
**Status:** Implemented & Deployed
**Production:** https://nousai-app.vercel.app

---

## What Was Built

Real integration between the Omi AI wearable device and NousAI, replacing the previous mock `OmiTool.tsx` stub.

### Architecture

```
Omi device (worn) → Omi mobile app → Omi cloud API
                                            ↓
                              GET /api/omi-proxy (Vercel serverless)
                                            ↓
                              NousAI OmiTool (React UI)
                                            ↓
                              Notes library (IDB + Firestore)
```

**Integration mode:** Pull (API key polling)
- User generates a Developer API key in the Omi mobile app
- NousAI stores it in `localStorage` as `nousai-omi-api-key`
- "Sync Now" button fetches recent conversations via Vercel proxy
- Each conversation can be saved as a Note in the `Omi` folder

---

## Files Changed

| File | Change |
|------|--------|
| `api/omi-proxy.ts` | **NEW** — Vercel serverless proxy to Omi REST API |
| `src/components/aitools/OmiTool.tsx` | **REWRITTEN** — real API, setup flow, conversation list |
| `src/pages/SettingsPage.tsx` | **UPDATED** — Omi API key section in Extensions |

---

## How It Works

### 1. `api/omi-proxy.ts`
- Receives `GET /api/omi-proxy?endpoint=user%2Fconversations&limit=20&include_transcript=true`
- Reads `x-omi-key` header, validates it starts with `omi_dev_`
- Forwards to `https://api.omi.me/v1/dev/{endpoint}` with Bearer auth
- Allowlisted endpoints: `user/conversations`, `user/memories`, `user/action-items`

### 2. `OmiTool.tsx` (AI Tools page)
- If no API key: shows setup screen with step-by-step instructions
- If key present: shows "Connect" / "Sync Now" button
- Fetches 20 most recent conversations
- Each conversation shows: title, emoji, overview, transcript snippet, action items
- "Save" saves to Notes library in folder `Omi` with tags `['omi', 'recording']`
- "Save All" bulk-saves all conversations

### 3. Settings → Extensions & Integrations → Omi AI Wearable
- Input for API key with "Save & Test" button (live tests the connection)
- Shows confirmation once configured
- "Remove" deletes key from localStorage

---

## Omi API Key Details

| Field | Value |
|-------|-------|
| Key format | `omi_dev_...` |
| Where to generate | Omi app → Settings → Developer → Create Key |
| Required scopes | `conversations:read` |
| Storage | `localStorage['nousai-omi-api-key']` (never synced to cloud) |
| Omi REST API base | `https://api.omi.me/v1/dev` |

---

## What the User Still Needs to Do (morning checklist)

See the main `OMI-MORNING-CHECKLIST.md` in the project root.

---

## Future Enhancements (not built)

- **Webhook mode** (real-time push): Create an Omi "App" with `triggers_on: transcript_processed`, set webhook URL to `/api/omi-webhook`, store incoming data in Firestore so OmiTool shows live updates
- **Auto-sync**: Poll every N minutes using `setInterval` + `document.visibilityState`
- **AI processing**: After sync, auto-run "Study Notes" AI tool on conversation content to extract key concepts
- **Webhook endpoint**: `api/omi-webhook.ts` with Firebase Admin SDK to store to Firestore under `users/{uid}/omi_conversations`
