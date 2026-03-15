# NousAI Notifications — Design Spec
**Date:** 2026-03-15
**Status:** Approved (v2, post spec-review)

## Overview

Add reliable push (PWA/browser) and SMS notifications to NousAI using Vercel Cron + Twilio + Firebase Cloud Messaging (FCM). Notifications fire server-side on a schedule, so they work even when the app is closed.

---

## Goals

- Browser push notifications via FCM (works when app is closed, browser running)
- SMS notifications via Twilio (always reliable, phone-based)
- System notification types: review reminders, streak alerts, pomodoro alerts
- Custom reminders: time-based (once), recurring, threshold, assignment deadline
- Per-type channel control: user toggles push/SMS independently per notification type
- All user preferences stored in existing Firestore sync pipeline
- A separate flat Firestore collection for server-side cron scheduling

---

## Architecture

```
User's browser/device
  ├── FCM token → saved to Firestore (flat) + localStorage on login
  └── Notification permission → requested once in Settings

Firestore — two separate stores:

  1. Existing compressed blob (pluginData, unchanged)
     └── notificationPrefs (push/sms toggles, phone, channels, reminderTime, timezone)
     └── customReminders [ { ...CustomReminder } ]
     (client reads/writes this via existing sync pipeline)

  2. NEW: notification-targets/{uid} (flat, uncompressed, cron-readable)
     └── {
           uid, fcmToken, phone, phoneVerified, smsEnabled, pushEnabled,
           timezone, reminderTime,
           channels: { reviewReminders, streakAlerts, customReminders },
           customReminders: [ simplified schedule entries ],
           lastSentAt: { [reminderId]: ISO timestamp },
           srCardsDueCount: number,   ← written by client on each sync
           streakDays: number,        ← written by client on each sync
           lastStudiedAt: ISO string  ← written by client on each sync
         }
     (client writes this on settings change; cron reads + updates lastSentAt)

Vercel Cron (hourly, server-side, Vercel Pro required)
  └── api/cron/notifications.ts
        ├── Queries notification-targets collection (all docs where pushEnabled || smsEnabled)
        ├── For each user: evaluates which reminders are due (using lastSentAt for dedup)
        ├── Updates lastSentAt in notification-targets after sending
        ├── FCM push → Firebase Admin SDK → user device
        └── SMS → Twilio API → user phone number

Vercel Serverless (on-demand, auth-protected via Firebase ID token)
  ├── api/send-sms.ts     → sends 6-digit verification code via Twilio
  └── api/verify-phone.ts → validates code, sets phoneVerified: true
```

---

## Notification Types & Channels

| Trigger | Push | SMS |
|---|---|---|
| FSRS cards due (daily digest at reminderTime) | ✅ | ✅ |
| Streak about to break (2h before midnight, user's timezone) | ✅ | ✅ |
| Pomodoro complete | ✅ (client-side only) | ❌ (too frequent) |
| Custom time-based reminder | ✅ | ✅ |
| Custom recurring reminder | ✅ | ✅ |
| Threshold alert (X+ cards due) | ✅ | ✅ |
| Assignment deadline reminder | ✅ | ✅ |

**Note:** Pomodoro alerts are client-side only (existing `notifications.ts` flow). They do not go through the cron or SMS pipeline.

---

## Data Model

### 1. Extend `notificationPrefs` in `PluginData` (`types.ts`)

```typescript
notificationPrefs?: {
  // existing
  reviewReminders: boolean;
  streakAlerts: boolean;
  pomodoroAlerts: boolean;
  reminderTime: string;          // "HH:MM" in user's local timezone

  // new
  timezone: string;              // IANA timezone e.g. "America/New_York"
  phone?: string;                // e.g. "+15551234567" (PII, user's own doc only)
  phoneVerified?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  fcmToken?: string;             // also stored in localStorage (both maintained)
  channels?: {
    reviewReminders: ('push' | 'sms')[];
    streakAlerts: ('push' | 'sms')[];
    customReminders: ('push' | 'sms')[];
    // pomodoroAlerts is always push-only, handled client-side, not in channels
  };
}
```

### 2. New `CustomReminder` type (`types.ts`)

```typescript
interface CustomReminder {
  id: string;                    // uuid
  title: string;
  message?: string;
  enabled: boolean;
  channels: ('push' | 'sms')[];
  type: 'once' | 'recurring' | 'threshold' | 'assignment';
  firedAt?: string;              // ISO timestamp — set after 'once' reminder fires

  // once + recurring
  time?: string;                 // "HH:MM" in user's local timezone
  date?: string;                 // ISO date string (once only)
  days?: number[];               // 0–6 (Sun–Sat), recurring only

  // threshold
  thresholdType?: 'cards_due';
  thresholdValue?: number;       // e.g. 30

  // assignment
  assignmentId?: string;
  notifyBeforeHours?: number;    // e.g. 24
}
```

`customReminders?: CustomReminder[]` added to `PluginData` interface in `types.ts`.

### 3. New Firestore collection: `notification-targets/{uid}` (flat, uncompressed)

Written by the client whenever notification settings change or data syncs. Read by the cron.

```typescript
interface NotificationTarget {
  uid: string;
  fcmToken?: string;
  phone?: string;
  phoneVerified?: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  timezone: string;
  reminderTime: string;                    // "HH:MM"
  channels: {
    reviewReminders: ('push' | 'sms')[];
    streakAlerts: ('push' | 'sms')[];
    customReminders: ('push' | 'sms')[];
  };
  customReminders: CustomReminder[];       // full array (cron needs full schedule)
  srCardsDueCount: number;                 // written by client on each sync
  streakDays: number;
  lastStudiedAt: string;                   // ISO timestamp
  lastSentAt: Record<string, string>;      // { [reminderId | 'review' | 'streak']: ISO }
  updatedAt: string;                       // ISO timestamp
}
```

**Firestore rules** for `notification-targets`:
- Users can read/write only their own document (`request.auth.uid == resource.id`)
- Cron uses Firebase Admin SDK (bypasses rules)

**Account deletion:** `deleteAccount()` in `auth.ts` must delete `notification-targets/{uid}` in addition to existing cleanup.

---

## Service Worker Fix (`public/firebase-messaging-sw.js`)

The existing service worker never initializes Firebase — this is a pre-existing bug that blocks all push notifications. It must be fixed before FCM push works.

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIza...",           // same config as src/utils/auth.ts
  authDomain: "nousai-dc038.firebaseapp.com",
  projectId: "nousai-dc038",
  storageBucket: "nousai-dc038.appspot.com",
  messagingSenderId: "...",
  appId: "..."
});

const messaging = firebase.messaging();

self.addEventListener('push', event => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'NousAI', {
      body: data.body,
      icon: '/icon-192.png',
      data: { url: data.url ?? '/#/flashcards' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/#/flashcards';
  event.waitUntil(clients.openWindow(url));
});
```

**Note:** The app uses `HashRouter`, so all deep links must use `/#/` format (e.g. `/#/flashcards`, `/#/dashboard`).

---

## FCM Token Flow (`src/utils/fcm.ts`)

Update `requestFCMPermission()` to:
1. Get FCM token from Firebase Messaging
2. Save to `localStorage` (existing, keep)
3. Also call `updatePluginData({ notificationPrefs: { ...existing, fcmToken: token } })` to persist in Firestore
4. Write to `notification-targets/{uid}` with `{ fcmToken: token, updatedAt: now }`

**VAPID Key:** Must be a `VITE_FCM_VAPID_KEY` env var (client-side, Vite prefix). It is NOT a server secret and should NOT be in the server-side Vercel env vars list.

---

## Backend Files

### `api/cron/notifications.ts`
- Protected: validate `Authorization: Bearer ${CRON_SECRET}` header (Vercel sends this automatically when configured)
- Runs hourly (0 * * * *)
- Logic per user:
  1. Get current UTC time; convert to user's timezone using `Intl.DateTimeFormat`. If `timezone` is missing or invalid, skip the user (log warning) rather than crashing — fallback to UTC is not used because incorrect timezone would fire reminders at wrong times.
  2. Check review digest: if current hour:min matches `reminderTime` and `srCardsDueCount > 0` and `lastSentAt['review']` is not today (in user's timezone) → send
  3. Check streak: if 2 hours before midnight in user's timezone and `lastStudiedAt` is not today (in user's timezone) → send streak alert
  4. Check custom reminders — before sending any channel, verify the channel is included in `customReminders` channel list for this reminder:
     - `once`: if date+time matches (in user's timezone) and `!firedAt` → send, then write `firedAt` to `notification-targets.customReminders[i].firedAt` only (cron cannot update the compressed Firestore blob — that is client-side only)
     - `recurring`: if today (user's timezone) is in `days` and time matches and `lastSentAt[id]` is not today → send
     - `threshold`: if `srCardsDueCount >= thresholdValue` and `lastSentAt[id]` is not within last 24h → send
     - `assignment`: handled via assignment's due date + `notifyBeforeHours` offset, check `lastSentAt[id]` to avoid re-firing
  5. After sending, write `lastSentAt[reminderId] = now.toISOString()` to `notification-targets/{uid}`

### `api/send-sms.ts`
- Auth: validate Firebase ID token in `Authorization: Bearer <idToken>` header using Firebase Admin `verifyIdToken()`
- Rate limit: max 3 send attempts per phone number per hour (check Firestore)
- Generate 6-digit code; store `HMAC-SHA256(secret, code)` + expiry (10 min) in `notification-targets/{uid}.pendingVerification`
- Send code via Twilio
- On success: return `{ sent: true }`

### `api/verify-phone.ts`
- Auth: validate Firebase ID token (same as above)
- Read `pendingVerification` from `notification-targets/{uid}`
- Check expiry; check HMAC of submitted code; max 5 attempts before lockout
- On success: set `phoneVerified: true`, delete `pendingVerification` from `notification-targets/{uid}`
- Also write `phoneVerified: true` to the user's `notification-targets` doc

### `vercel.json` (updated)
```json
{
  "crons": [{
    "path": "/api/cron/notifications",
    "schedule": "0 * * * *"
  }]
}
```
**Requirement:** Vercel Pro plan. The project must be on Pro (not Hobby) for cron jobs.

---

## UI Changes (`SettingsPage.tsx`)

### Notifications Section (expanded)

**Channel controls (new, top of section):**
```
🔔 Notifications
────────────────────────────────────────
Browser Push    [Toggle]  → calls requestFCMPermission() on enable
SMS Alerts      [Toggle]  → reveals phone number input below
                Timezone: [America/New_York ▾]   (auto-detected, editable)
                Phone: +1 (___) ___-____  [Send Code]
                Verification code: [______]  [Verify]
```

**Per-type toggles (updated):**
```
Review Reminders    Daily at [09:00 ▾]    [Push ✓] [SMS ✓]
Streak Alerts                              [Push ✓] [SMS ✓]
Pomodoro Alerts                            [Push ✓]  (SMS not available)
```

**Custom Reminders (new section below):**
```
📅 Custom Reminders                        [+ Add Reminder]
────────────────────────────────────────
"Study for exam"    Friday 6pm · Once      [Push ✓] [SMS ✓]  [Edit] [Delete]
"Review chemistry"  Mon, Wed 8pm · Weekly  [Push ✓]          [Edit] [Delete]
"30+ cards due"     Threshold · 30 cards   [Push ✓] [SMS ✓]  [Edit] [Delete]
```

**Add/Edit Reminder modal** — fields adapt to reminder type:
- All: title, message (optional), channels toggles (push/sms), enabled toggle
- Once: date picker + time picker
- Recurring: day-of-week multi-select (Sun–Sat) + time picker
- Threshold: type dropdown (cards due) + number input
- Assignment: assignment selector + hours-before number input

**On any settings change:** write updated data to both:
1. Zustand store (→ syncs to compressed Firestore blob via existing pipeline)
2. `notification-targets/{uid}` (flat, uncompressed — direct Firestore write)

---

## Environment Variables

### Client-side (`.env`, Vite prefix)
```
VITE_FCM_VAPID_KEY=...        # from Firebase Console > Cloud Messaging > Web Push certificates
```

### Server-side (Vercel Dashboard)
```
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...     # your Twilio sender number
FIREBASE_ADMIN_PRIVATE_KEY=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_PROJECT_ID=nousai-dc038
CRON_SECRET=...               # random secret; set in Vercel as cron auth token
HMAC_SECRET=...               # for hashing verification codes
```

---

## Existing Code Changes Summary

| File | Change |
|---|---|
| `src/utils/fcm.ts` | Update `requestFCMPermission()` to write token to Firestore + notification-targets |
| `public/firebase-messaging-sw.js` | Fix pre-existing bug: add `firebase.initializeApp()` + proper push/click handlers with HashRouter-compatible URLs |
| `src/pages/SettingsPage.tsx` | Expand notification section: channels, timezone, phone verification, custom reminders UI |
| `src/types.ts` | Add `CustomReminder` interface, `NotificationTarget` interface, extend `notificationPrefs` |
| `src/utils/auth.ts` | Add `notification-targets/{uid}` deletion to `deleteAccount()` |
| `src/store.tsx` or sync utility | On settings change, write to `notification-targets/{uid}` (flat Firestore write) |
| `vercel.json` | Add `crons` array |

---

## Out of Scope

- Email notifications
- Notification history / inbox
- Rich push notifications (images, action buttons)
- Android/iOS native push (Capacitor)
- Multi-device FCM (one token per user, last device wins)
