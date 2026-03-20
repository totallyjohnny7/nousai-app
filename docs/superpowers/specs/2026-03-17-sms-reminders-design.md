# SMS Study Reminders — Design Spec
**Date:** 2026-03-17
**Status:** Approved

---

## Overview

Add Twilio SMS notifications to NousAI so the user receives real-time and scheduled study reminder texts on their iPhone — even when the app is closed.

---

## Architecture

```
Vercel Cron Job (every hour)
        ↓
api/sms-reminder.ts  ←→  Firestore (reads user study data)
        ↓
    Twilio API
        ↓
  User's iPhone 📱

Client (app open) ──→ api/sms-send.ts ──→ Twilio  (Pomodoro only)
```

### New Files
- `api/sms-reminder.ts` — Vercel serverless cron function; reads Firestore, sends scheduled texts via Twilio
- `api/sms-settings.ts` — Saves phone number and toggle preferences to Firestore (requires Firebase ID token auth)
- `api/sms-send.ts` — Client-triggered endpoint for Pomodoro complete texts (rate-limited server-side)

### Modified Files
- `vercel.json` — Add cron schedule for `api/sms-reminder.ts` (every hour)
- `src/pages/SettingsPage.tsx` — Add SMS Notifications section
- `src/types.ts` — Add `SmsPrefs` type

---

## Data Model

Stored in Firestore at path: `users/{uid}/pluginData` (merged into existing user doc, consistent with current sync architecture).

```ts
interface SmsPrefs {
  phone: string;                  // E.164 format e.g. "+14025551234" (stored plaintext — readable by Firebase Admin)
  enabled: boolean;               // Master toggle
  flashcardsReminder: boolean;
  streakReminder: boolean;
  pomodoroReminder: boolean;
  dailyGoalReminder: boolean;
  dailyDigestEnabled: boolean;    // Toggle for combined daily summary text
  reminderTime: string;           // "HH:MM" 24hr e.g. "20:00" — controls digest, streak, goal
  timezone: string;               // IANA timezone e.g. "America/Chicago" (auto-detected from browser)
  lastFlashcardSms?: number;      // Unix ms — max once per 4hr
  lastDailyDigest?: number;       // Unix ms — max once per day
  lastStreakSms?: number;         // Unix ms — max once per day
  lastGoalSms?: number;           // Unix ms — max once per day
  lastPomodoroSms?: number;       // Unix ms — max once per 30 min (enforced server-side in sms-send.ts)
}
```

**No `phoneVerified` field.** Verification is enforced by Twilio itself — trial accounts block texts to unverified numbers at the API layer. The app does not need to track this separately. Users must verify their number in the Twilio Console during trial, or upgrade to a paid account.

**Firestore user enumeration:** For a single-user personal app, the cron reads the known user's document directly by UID (stored in `FIREBASE_USER_UID` env var) rather than doing a collection-group query. No composite index required.

**Privacy note:** Phone number is stored unencrypted in Firestore. This is acceptable for a personal app but means anyone with the Firebase service account key can read it.

---

## SMS Messages

| Trigger | Type | Condition | Message |
|---|---|---|---|
| Flashcards due | Cron | Cards due > 0, lastFlashcardSms > 4hr ago | "📚 NousAI: You have X flashcards due for review. nousai-app.vercel.app" |
| Streak reminder | Cron | Streak > 0, no study today, fires at reminderTime hour | "🔥 NousAI: Don't break your X-day streak! You haven't studied today." |
| Pomodoro complete | Client-triggered | Pomodoro session ends, lastPomodoroSms > 30min ago | "⏱ NousAI: Pomodoro complete! Take a break, you've earned it." |
| Daily goal | Cron | Goal not met, fires at reminderTime hour | "🎯 NousAI: Daily goal check — you're at X/Y XP today. Keep going!" |
| Daily digest | Cron | `dailyDigestEnabled`, fires at reminderTime hour | "📖 NousAI Daily: X cards due · Streak: Y days · Daily goal: X/Y XP" |

**Edge cases:**
- Streak = 0 → skip streak reminder
- No flashcards exist → skip flashcard reminder
- Daily goal already met → skip goal reminder
- Invalid phone format → skip send, log warning

---

## Cron Logic (`api/sms-reminder.ts`)

**Authentication:** Verify `Authorization: Bearer <CRON_SECRET>` header. Return 401 if missing or wrong.

**Firebase Admin init:** Check `getApps().length > 0` before calling `initializeApp()` to avoid double-init (pattern already used in `api/omi-proxy.ts` — reuse same init guard).

**Steps:**
1. Authenticate cron request
2. Load user's `pluginData.smsPrefs` from `users/{FIREBASE_USER_UID}`
3. Skip entirely if `enabled === false`
4. Determine current hour in user's `smsPrefs.timezone` using `Intl`
5. Apply quiet hours: skip all sends if `hour >= 22 || hour < 8`
6. **reminderTime matching:** fire time-based reminders if `currentHour === parseInt(reminderTime.split(':')[0])` — this means they fire once per day in the correct hour window; throttle timestamps (`lastStreakSms`, `lastGoalSms`, `lastDailyDigest`) prevent double-firing if cron runs multiple times in the same hour
7. Check each reminder condition → build send list
8. Send via Twilio; update throttle timestamps on success
9. On Twilio error: log to Vercel logs, continue gracefully
10. On Firestore error: log and abort

---

## Client-Triggered Logic (`api/sms-send.ts`)

Used only for Pomodoro:

1. Validate `Authorization: Bearer <Firebase ID token>` — verify with Firebase Admin SDK, return 401 if invalid
2. Load user's `smsPrefs` from Firestore
3. Check `enabled` and `pomodoroReminder` toggles
4. **Server-side rate limit:** if `lastPomodoroSms` is within the last 30 minutes, return `{ sent: false, reason: "rate_limited" }` — this prevents unbounded Twilio charges from client-side abuse
5. Check quiet hours (`hour >= 22 || hour < 8`)
6. Send text via Twilio
7. Update `lastPomodoroSms` in Firestore
8. Return `{ sent: true }` or `{ sent: false, reason: string }`

---

## Settings Endpoint (`api/sms-settings.ts`)

All requests must include `Authorization: Bearer <Firebase ID token>`.

- `POST` — validate ID token, save phone + preferences to `users/{uid}/pluginData.smsPrefs` in Firestore
- Phone is accepted as entered; format validated to E.164 before storing (reject with 400 if invalid)

**Firestore security rules:** The existing rules allow writes to `users/{uid}/pluginData` only for authenticated users matching `uid`. The Admin SDK used in server-side endpoints bypasses client rules — this is the intended pattern already used by the existing sync architecture.

---

## Settings UI

Added to `SettingsPage.tsx` under the existing Notifications section:

```
── SMS Notifications ──────────────────────────

Phone Number
[+1 (402) 555-1234        ] [Save]

Enable SMS Reminders       [toggle ON/OFF]

  ☑ Flashcards due
  ☑ Streak reminder
  ☑ Daily goal reminder
  ☐ Pomodoro complete
  ☑ Daily digest (summary)

Daily Reminder Time        [8:00 PM ▾]
────────────────────────────────────────────────
```

- Timezone auto-detected from `Intl.DateTimeFormat().resolvedOptions().timeZone` on save
- Saving phone POSTs to `api/sms-settings.ts` with Firebase ID token
- Master toggle disables all SMS instantly
- Individual toggles mute specific types
- Time picker controls digest + streak + goal reminder firing hour

---

## Environment Variables Required

| Variable | Where | Description |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Vercel env vars | From Twilio Console dashboard |
| `TWILIO_AUTH_TOKEN` | Vercel env vars | From Twilio Console dashboard |
| `TWILIO_PHONE_NUMBER` | Vercel env vars | Your Twilio number (E.164) |
| `CRON_SECRET` | Vercel env vars | Random secret — generate with `openssl rand -hex 32` |
| `FIREBASE_USER_UID` | Vercel env vars | Your Firebase Auth UID (single-user app) |
| `FIREBASE_SERVICE_ACCOUNT` | Vercel env vars | Firebase Admin SDK JSON (base64 encoded) — **check if already set from Omi integration; if so, reuse** |

---

## Twilio Setup Steps (for user)

1. Sign up at twilio.com (free trial includes ~$15 credit)
2. **Critical for trial accounts:** Go to Twilio Console → Phone Numbers → Verified Caller IDs → add and verify your personal phone number. Trial accounts can only send SMS to verified numbers.
3. Buy a phone number from Console → Phone Numbers → Buy a Number (~$1/mo)
4. Copy Account SID + Auth Token from the Twilio Console home screen
5. Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to Vercel env vars
6. Add `CRON_SECRET` (any random string)
7. Add `FIREBASE_USER_UID` (find in Firebase Console → Authentication → Users)
8. Check if `FIREBASE_SERVICE_ACCOUNT` is already set (from Omi integration) — if not, generate from Firebase Console → Project Settings → Service Accounts → Generate new private key, base64-encode it, add to Vercel

---

## Error Handling

| Error | Behavior |
|---|---|
| Twilio API failure | Log to Vercel logs, skip, continue |
| Firestore read error | Log and abort gracefully |
| Invalid phone number format | Reject at settings save (400), skip send with log warning |
| Firebase ID token invalid | Return 401 |
| Cron secret missing/wrong | Return 401 immediately |
| Streak = 0 | Skip streak reminder silently |
| No flashcards | Skip flashcard reminder silently |
| Daily goal already met | Skip goal reminder silently |
| Pomodoro rate limited | Return `{ sent: false, reason: "rate_limited" }` |

All errors visible in Vercel Dashboard → Functions → Logs.

---

## Cost Estimate

| Item | Cost |
|---|---|
| Twilio phone number | $1.00/mo |
| SMS per message (~5/day) | ~$1.19/mo |
| **Total added cost** | **~$2.19/mo** |

---

## Throttling & Anti-Spam Rules

| Reminder | Max frequency | Enforced by |
|---|---|---|
| Flashcards | Once per 4 hours | `lastFlashcardSms` in cron |
| Streak | Once per day | `lastStreakSms` in cron |
| Daily goal | Once per day | `lastGoalSms` in cron |
| Daily digest | Once per day | `lastDailyDigest` in cron |
| Pomodoro | Once per 30 min | `lastPomodoroSms` in `sms-send.ts` |
| Quiet hours | No texts 10pm–8am (`hour >= 22 \|\| hour < 8`) | Both cron and `sms-send.ts` |
