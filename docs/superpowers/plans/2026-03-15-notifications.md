# NousAI Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PWA push notifications (FCM) and SMS (Twilio) with server-side Vercel Cron scheduling and a custom reminders UI.

**Architecture:** A new flat Firestore collection `notification-targets/{uid}` holds uncompressed scheduling state readable by the hourly Vercel Cron. The cron sends FCM push via Firebase Admin SDK and SMS via Twilio. All user preferences are mirrored to both the existing compressed pluginData sync and the new flat collection.

**Tech Stack:** Firebase Admin SDK, Twilio, Vercel Cron Jobs (Pro plan required), React/TypeScript, Zustand

> **Note:** This project has no test framework. Verification steps use `npm run build` (TypeScript + Vite build) as the primary correctness check, plus manual browser testing on production.

> **Important:** Use real profile `reallyjustjohnny6@gmail.com` for all production testing — never a test profile.

---

## Chunk 1: Foundation — Types + Service Worker + Firestore Rules

### Task 1: Add new types to `src/types.ts`

**Files:**
- Modify: `src/types.ts:313` (extend `notificationPrefs`)
- Modify: `src/types.ts:291-315` (add `customReminders` to `PluginData`)

- [ ] **Step 1: Extend `notificationPrefs` on line 313**

Replace the existing one-liner:
```typescript
// OLD (line 313):
notificationPrefs?: { reviewReminders: boolean; streakAlerts: boolean; pomodoroAlerts: boolean; reminderTime: string; };

// NEW:
notificationPrefs?: {
  reviewReminders: boolean;
  streakAlerts: boolean;
  pomodoroAlerts: boolean;
  reminderTime: string;              // "HH:MM" in user's local timezone
  timezone: string;                  // IANA e.g. "America/New_York"
  phone?: string;
  phoneVerified?: boolean;
  smsEnabled?: boolean;
  pushEnabled?: boolean;
  fcmToken?: string;
  channels?: {
    reviewReminders: ('push' | 'sms')[];
    streakAlerts: ('push' | 'sms')[];
    customReminders: ('push' | 'sms')[];
  };
};
```

- [ ] **Step 2: Add `CustomReminder` and `NotificationTarget` interfaces** — insert after the closing `}` of `PluginData` (after the `[key: string]: unknown;` line, before the `StudyGoal` interface). Do NOT insert inside `PluginData`.

```typescript
export interface CustomReminder {
  id: string;
  title: string;
  message?: string;
  enabled: boolean;
  channels: ('push' | 'sms')[];
  type: 'once' | 'recurring' | 'threshold' | 'assignment';
  firedAt?: string;             // ISO — set by cron after 'once' fires
  time?: string;                // "HH:MM", once + recurring
  date?: string;                // ISO date, once only
  days?: number[];              // 0–6 Sun–Sat, recurring only
  thresholdType?: 'cards_due';
  thresholdValue?: number;
  assignmentId?: string;
  notifyBeforeHours?: number;
}

export interface NotificationTarget {
  uid: string;
  fcmToken?: string;
  phone?: string;
  phoneVerified?: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  timezone: string;
  reminderTime: string;
  channels: {
    reviewReminders: ('push' | 'sms')[];
    streakAlerts: ('push' | 'sms')[];
    customReminders: ('push' | 'sms')[];
  };
  customReminders: CustomReminder[];
  srCardsDueCount: number;
  streakDays: number;
  lastStudiedAt: string;
  lastSentAt: Record<string, string>;
  updatedAt: string;
  pendingVerification?: {
    hash: string;
    expiry: string;
    attempts: number;
    phone: string;
  };
}
```

- [ ] **Step 3: Add `customReminders` to `PluginData` interface** — add after `notificationPrefs` line:

```typescript
customReminders?: CustomReminder[];
```

- [ ] **Step 4: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -20
```
Expected: Build succeeds with no TypeScript errors. Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/johnn/Desktop/NousAI-App
git add src/types.ts
git commit -m "feat(notifications): add CustomReminder, NotificationTarget types, extend notificationPrefs"
```

---

### Task 2: Fix Firebase Messaging Service Worker

**Files:**
- Modify: `public/firebase-messaging-sw.js` (full rewrite — currently broken, never initializes Firebase)

- [ ] **Step 1: Rewrite `public/firebase-messaging-sw.js`**

```javascript
// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCPEpz40ixry6rdAYAmwzkGxlpKrLnXA64',
  authDomain: 'nousai-dc038.firebaseapp.com',
  projectId: 'nousai-dc038',
  storageBucket: 'nousai-dc038.firebasestorage.app',
  messagingSenderId: '1002222438616',
  appId: '1:1002222438616:web:9a8c4cc83fa7c603516fad',
});

const messaging = firebase.messaging();

// Background push handler (FCM sends data in notification or data fields)
self.addEventListener('push', function (event) {
  const payload = event.data ? event.data.json() : {};
  const title = payload.notification?.title || payload.data?.title || 'NousAI';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || '/#/flashcards';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const url = event.notification.data?.url || '/#/flashcards';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Focus existing tab if open, else open new one
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
```

- [ ] **Step 2: Verify build passes**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add public/firebase-messaging-sw.js
git commit -m "fix(notifications): initialize Firebase in service worker — FCM was never active"
```

---

### Task 3: Update Firestore security rules

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Read the existing `firestore.rules`** to confirm what's already there before editing:

```bash
cat C:/Users/johnn/Desktop/NousAI-App/firestore.rules
```

- [ ] **Step 2: Add `notification-targets` rule** — add only the new match block inside the existing `match /databases/{database}/documents` block, preserving all existing rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // Flat notification scheduling data — user owns their own doc
    match /notification-targets/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 2: Deploy rules**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npx firebase deploy --only firestore:rules --project nousai-dc038
```
Expected: `Deploy complete!`

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(notifications): add Firestore rules for notification-targets collection"
```

---

## Chunk 2: Client — notification-targets Writer + FCM Update + Cleanup

### Task 4: Create `src/utils/notificationTarget.ts`

This module owns all reads/writes to `notification-targets/{uid}` from the client side.

**Files:**
- Create: `src/utils/notificationTarget.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/utils/notificationTarget.ts
// Manages the flat, uncompressed notification-targets/{uid} Firestore document.
// This is separate from the compressed pluginData blob so the server-side cron can query it.

import type { NotificationTarget, CustomReminder } from '../types';

let fbFns: typeof import('firebase/firestore') | null = null;
let firebaseDb: import('firebase/firestore').Firestore | null = null;

async function getFirestore() {
  if (fbFns && firebaseDb) return { fb: fbFns, db: firebaseDb };
  const { getFirestore: gfs } = await import('firebase/firestore');
  const { getApp } = await import('firebase/app');
  fbFns = await import('firebase/firestore');
  firebaseDb = gfs(getApp());
  return { fb: fbFns, db: firebaseDb };
}

export async function writeNotificationTarget(
  uid: string,
  patch: Partial<Omit<NotificationTarget, 'uid' | 'lastSentAt'>>
): Promise<void> {
  try {
    const { fb, db } = await getFirestore();
    const ref = fb.doc(db, 'notification-targets', uid);
    await fb.setDoc(ref, { uid, ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('[notificationTarget] write failed:', e);
  }
}

export async function deleteNotificationTarget(uid: string): Promise<void> {
  try {
    const { fb, db } = await getFirestore();
    const ref = fb.doc(db, 'notification-targets', uid);
    await fb.deleteDoc(ref);
  } catch (e) {
    console.warn('[notificationTarget] delete failed:', e);
  }
}

export function buildNotificationTarget(
  uid: string,
  prefs: NonNullable<import('../types').PluginData['notificationPrefs']>,
  customReminders: CustomReminder[],
  srCardsDueCount: number,
  streakDays: number,
  lastStudiedAt: string
): Omit<NotificationTarget, 'lastSentAt'> {
  return {
    uid,
    fcmToken: prefs.fcmToken,
    phone: prefs.phone,
    phoneVerified: prefs.phoneVerified ?? false,
    smsEnabled: prefs.smsEnabled ?? false,
    pushEnabled: prefs.pushEnabled ?? false,
    timezone: prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    reminderTime: prefs.reminderTime || '09:00',
    channels: prefs.channels ?? {
      reviewReminders: ['push'],
      streakAlerts: ['push'],
      customReminders: ['push'],
    },
    customReminders,
    srCardsDueCount,
    streakDays,
    lastStudiedAt,
    updatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/notificationTarget.ts
git commit -m "feat(notifications): add notificationTarget Firestore utility"
```

---

### Task 5: Update `src/utils/fcm.ts` — save token to Firestore

**Files:**
- Modify: `src/utils/fcm.ts`

- [ ] **Step 1: Find existing callers of `requestFCMPermission`** to update after the signature change:

```bash
grep -rn "requestFCMPermission" C:/Users/johnn/Desktop/NousAI-App/src/
```
Note each call site. After updating the function signature below, update each caller to pass `uid` as the second argument (the UI task in Chunk 4 already includes this — skip callers covered there).

- [ ] **Step 2: Update `requestFCMPermission` to also write to notification-targets**

Replace the existing `requestFCMPermission` function (lines 33–44):

```typescript
export async function requestFCMPermission(
  vapidKey: string,
  uid?: string,
  onTokenSaved?: (token: string) => void
): Promise<{ token: string | null; error?: string }> {
  if (!isFCMSupported()) return { token: null, error: 'Push notifications not supported in this browser' };
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { token: null, error: 'Notification permission denied' };
    const token = await initFCM(vapidKey);
    if (token) {
      localStorage.setItem('nousai-fcm-token', token);
      // Persist token to notification-targets so the server-side cron can send pushes
      if (uid) {
        const { writeNotificationTarget } = await import('./notificationTarget');
        await writeNotificationTarget(uid, { fcmToken: token, pushEnabled: true });
      }
      onTokenSaved?.(token);
    }
    return { token };
  } catch (e: unknown) {
    return { token: null, error: (e as Error)?.message || 'FCM error' };
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/fcm.ts
git commit -m "feat(notifications): persist FCM token to notification-targets on permission grant"
```

---

### Task 6: Update `deleteAccount` in `src/utils/auth.ts`

**Files:**
- Modify: `src/utils/auth.ts` (~line 673, inside the Firestore cleanup block)

- [ ] **Step 1: Add notification-targets deletion** inside the existing try block in `deleteAccount()`, immediately **before** `const userDoc = fb.doc(firebaseDb, 'users', uid)` (around line 691):

```typescript
// Delete notification-targets document
try {
  const ntRef = fb.doc(firebaseDb, 'notification-targets', uid);
  await fb.deleteDoc(ntRef);
} catch (_) { /* non-fatal */ }
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/auth.ts
git commit -m "feat(notifications): clean up notification-targets doc on account deletion"
```

---

## Chunk 3: Backend — Firebase Admin + Twilio + API Routes

### Task 7: Install backend dependencies

**Files:**
- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install firebase-admin and twilio**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm install firebase-admin twilio
```
Expected: Both packages added to `package.json` dependencies.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(notifications): add firebase-admin and twilio dependencies"
```

---

### Task 8: Create `api/lib/firebase-admin.ts`

Shared Firebase Admin SDK initializer used by all API routes.

**Files:**
- Create: `api/lib/firebase-admin.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/lib/firebase-admin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function ensureInitialized() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Vercel stores multi-line env vars with literal \n — replace them
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  }
}

export function adminDb() {
  ensureInitialized();
  return getFirestore();
}

export function adminMessaging() {
  ensureInitialized();
  return getMessaging();
}

export async function verifyIdToken(token: string) {
  const { getAuth } = await import('firebase-admin/auth');
  ensureInitialized();
  return getAuth().verifyIdToken(token);
}
```

- [ ] **Step 2: Create `api/lib/twilio.ts`**

```typescript
// api/lib/twilio.ts
import twilio from 'twilio';

let _client: ReturnType<typeof twilio> | null = null;

export function getTwilioClient() {
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    );
  }
  return _client;
}

export const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER!;

export async function sendSMS(to: string, body: string) {
  const client = getTwilioClient();
  await client.messages.create({ from: TWILIO_FROM, to, body });
}
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add api/lib/firebase-admin.ts api/lib/twilio.ts
git commit -m "feat(notifications): add Firebase Admin and Twilio shared API helpers"
```

---

### Task 9: Create `api/send-sms.ts` — phone verification sender

**Files:**
- Create: `api/send-sms.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/send-sms.ts
// Sends a 6-digit SMS verification code to the user's phone.
// Auth: Firebase ID token in Authorization: Bearer header
// Rate limit: 3 attempts per phone per hour

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, randomInt } from 'crypto';
import { adminDb, verifyIdToken } from './lib/firebase-admin';
import { sendSMS } from './lib/twilio';

const HMAC_SECRET = process.env.HMAC_SECRET!;
const MAX_ATTEMPTS_PER_HOUR = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { phone } = req.body as { phone?: string };
  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number. Use E.164 format e.g. +15551234567' });
  }

  const db = adminDb();
  const ref = db.collection('notification-targets').doc(uid);
  const snap = await ref.get();
  const existing = snap.data() || {};

  // Rate limit: check how many attempts in last hour
  const pendingVer = existing.pendingVerification;
  const now = Date.now();
  if (pendingVer && pendingVer.phone === phone) {
    const attempts = pendingVer.recentAttempts?.filter((t: number) => now - t < 3600_000) ?? [];
    if (attempts.length >= MAX_ATTEMPTS_PER_HOUR) {
      return res.status(429).json({ error: 'Too many attempts. Try again in an hour.' });
    }
  }

  // Generate code and HMAC
  const code = String(randomInt(100000, 999999));
  const hash = createHmac('sha256', HMAC_SECRET).update(code).digest('hex');
  const expiry = new Date(now + 10 * 60 * 1000).toISOString(); // 10 min

  // Store hash + expiry + rate limit data
  await ref.set({
    uid,
    pendingVerification: {
      hash,
      expiry,
      phone,
      attempts: 0,
      recentAttempts: [...(pendingVer?.recentAttempts?.filter((t: number) => now - t < 3600_000) ?? []), now],
    },
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  // Send SMS
  try {
    await sendSMS(phone, `Your NousAI verification code is: ${code}. Expires in 10 minutes.`);
  } catch (e) {
    console.error('[send-sms] Twilio error:', e);
    return res.status(502).json({ error: 'Failed to send SMS. Check Twilio config.' });
  }

  return res.status(200).json({ sent: true });
}
```

- [ ] **Step 2: Verify TypeScript compiles (build check)**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add api/send-sms.ts
git commit -m "feat(notifications): add send-sms API route with HMAC verification and rate limiting"
```

---

### Task 10: Create `api/verify-phone.ts`

**Files:**
- Create: `api/verify-phone.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/verify-phone.ts
// Validates a 6-digit verification code sent via api/send-sms.ts
// On success: sets phoneVerified: true in notification-targets/{uid}

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac } from 'crypto';
import { adminDb, verifyIdToken } from './lib/firebase-admin';

const HMAC_SECRET = process.env.HMAC_SECRET!;
const MAX_ATTEMPTS = 5;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  let uid: string;
  try {
    const decoded = await verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { code } = req.body as { code?: string };
  if (!code || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid code format' });

  const db = adminDb();
  const ref = db.collection('notification-targets').doc(uid);
  const snap = await ref.get();
  const data = snap.data();
  const pv = data?.pendingVerification;

  if (!pv) return res.status(400).json({ error: 'No pending verification. Request a new code.' });
  if (new Date(pv.expiry) < new Date()) return res.status(400).json({ error: 'Code expired. Request a new one.' });
  if (pv.attempts >= MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many failed attempts. Request a new code.' });

  const expectedHash = createHmac('sha256', HMAC_SECRET).update(code).digest('hex');
  if (pv.hash !== expectedHash) {
    await ref.update({ 'pendingVerification.attempts': pv.attempts + 1 });
    return res.status(400).json({ error: 'Incorrect code', attemptsLeft: MAX_ATTEMPTS - pv.attempts - 1 });
  }

  // Success — mark verified, clear pending
  await ref.update({
    phone: pv.phone,
    phoneVerified: true,
    pendingVerification: null,
    updatedAt: new Date().toISOString(),
  });

  return res.status(200).json({ verified: true });
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add api/verify-phone.ts
git commit -m "feat(notifications): add verify-phone API route with HMAC validation"
```

---

### Task 11: Create `api/cron/notifications.ts`

**Files:**
- Create: `api/cron/notifications.ts`

- [ ] **Step 1: Create the file**

```typescript
// api/cron/notifications.ts
// Vercel Cron Job — runs hourly (0 * * * *)
// Reads notification-targets collection and fires FCM push / SMS for due reminders.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { adminDb, adminMessaging } from '../lib/firebase-admin';
import { sendSMS } from '../lib/twilio';
import type { CustomReminder, NotificationTarget } from '../../src/types';

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel sends CRON_SECRET as Authorization header
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const db = adminDb();
  const messaging = adminMessaging();
  const now = new Date();

  // Query all users with notifications enabled
  const snap = await db.collection('notification-targets')
    .where('pushEnabled', '==', true)
    .get()
    .catch(() => null);

  const smsSnap = await db.collection('notification-targets')
    .where('smsEnabled', '==', true)
    .get()
    .catch(() => null);

  // Merge unique docs
  const docMap = new Map<string, FirebaseFirestore.DocumentData>();
  snap?.docs.forEach(d => docMap.set(d.id, d.data()));
  smsSnap?.docs.forEach(d => { if (!docMap.has(d.id)) docMap.set(d.id, d.data()); });

  const results = { sent: 0, skipped: 0, errors: 0 };

  for (const [uid, target] of docMap.entries()) {
    try {
      await processUser(uid, target as NotificationTarget, now, db, messaging);
      results.sent++;
    } catch (e) {
      console.error(`[cron/notifications] error for uid=${uid}:`, e);
      results.errors++;
    }
  }

  return res.status(200).json({ ok: true, ...results, ts: now.toISOString() });
}

function getUserLocalTime(now: Date, timezone: string): Date {
  // Returns a Date object representing the current moment in the user's timezone
  // (we parse the formatted string back to get local hour/min/day)
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
    const local = new Date(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour').padStart(2, '0')}:${get('minute')}:00`
    );
    return local;
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function todayStr(localTime: Date): string {
  return localTime.toISOString().slice(0, 10);
}

function alreadySentToday(lastSentAt: Record<string, string>, key: string, localTime: Date): boolean {
  const last = lastSentAt?.[key];
  if (!last) return false;
  return last.slice(0, 10) === todayStr(localTime);
}

function alreadySentWithinHours(lastSentAt: Record<string, string>, key: string, hours: number, now: Date): boolean {
  const last = lastSentAt?.[key];
  if (!last) return false;
  return now.getTime() - new Date(last).getTime() < hours * 3600_000;
}

async function sendPush(messaging: ReturnType<typeof adminMessaging>, fcmToken: string, title: string, body: string, url: string) {
  if (!fcmToken) return;
  await messaging.send({
    token: fcmToken,
    notification: { title, body },
    data: { url },
    webpush: { fcmOptions: { link: url } },
  });
}

async function processUser(
  uid: string,
  target: NotificationTarget,
  now: Date,
  db: FirebaseFirestore.Firestore,
  messaging: ReturnType<typeof adminMessaging>
) {
  if (!target.timezone) {
    console.warn(`[cron] uid=${uid} missing timezone — skipping`);
    return;
  }

  let localTime: Date;
  try {
    // getUserLocalTime returns a Date whose .getHours()/.getMinutes() reflect the user's
    // local time numerically. The Date object itself is not timezone-aware — only the
    // hour/minute numeric values are correct for the user's timezone. Do not use .toISOString()
    // on localTime — use todayStr(localTime) which reads .toISOString() before construction.
    localTime = getUserLocalTime(now, target.timezone);
  } catch {
    console.warn(`[cron] uid=${uid} invalid timezone "${target.timezone}" — skipping`);
    return;
  }

  const lastSentAt: Record<string, string> = target.lastSentAt || {};
  const updates: Record<string, string> = {};

  const pushOk = target.pushEnabled && !!target.fcmToken;
  const smsOk = target.smsEnabled && !!target.phone && target.phoneVerified;

  // ── 1. Daily review digest ─────────────────────────────
  if (target.srCardsDueCount > 0) {
    const [rh, rm] = (target.reminderTime || '09:00').split(':').map(Number);
    const localH = localTime.getHours();
    const localM = localTime.getMinutes();
    if (localH === rh && localM < 5 && !alreadySentToday(lastSentAt, 'review', localTime)) {
      const title = 'Cards due for review';
      const body = `You have ${target.srCardsDueCount} flashcard${target.srCardsDueCount > 1 ? 's' : ''} due today.`;
      const url = '/#/flashcards';
      const channels = target.channels?.reviewReminders ?? ['push'];
      if (pushOk && channels.includes('push')) await sendPush(messaging, target.fcmToken!, title, body, url);
      if (smsOk && channels.includes('sms')) await sendSMS(target.phone!, `NousAI: ${body}`);
      updates['review'] = now.toISOString();
    }
  }

  // ── 2. Streak alert — 2h before midnight ──────────────
  const localH = localTime.getHours();
  if (localH === 22 && !alreadySentToday(lastSentAt, 'streak', localTime)) {
    const lastStudied = target.lastStudiedAt ? new Date(target.lastStudiedAt) : null;
    const studiedToday = lastStudied && lastStudied.toISOString().slice(0, 10) === todayStr(localTime);
    if (!studiedToday && target.streakDays > 0) {
      const title = 'Streak at risk!';
      const body = `Study something today to keep your ${target.streakDays}-day streak alive.`;
      const url = '/#/flashcards';
      const channels = target.channels?.streakAlerts ?? ['push'];
      if (pushOk && channels.includes('push')) await sendPush(messaging, target.fcmToken!, title, body, url);
      if (smsOk && channels.includes('sms')) await sendSMS(target.phone!, `NousAI: ${body}`);
      updates['streak'] = now.toISOString();
    }
  }

  // ── 3. Custom reminders ────────────────────────────────
  for (const reminder of (target.customReminders ?? [])) {
    if (!reminder.enabled) continue;
    const channels = reminder.channels;
    const canPush = pushOk && channels.includes('push');
    const canSms = smsOk && channels.includes('sms');
    if (!canPush && !canSms) continue;

    let shouldSend = false;

    if (reminder.type === 'once') {
      if (reminder.firedAt) continue; // already fired
      if (reminder.date && reminder.time) {
        const targetDt = new Date(`${reminder.date}T${reminder.time}:00`);
        // Fire within a 5-minute window of the target time (cron runs hourly, time is approximate)
        const diffMin = Math.abs(localTime.getTime() - targetDt.getTime()) / 60_000;
        shouldSend = diffMin < 5;
      }
    } else if (reminder.type === 'recurring') {
      if (reminder.days && reminder.time) {
        const [rh, rm] = reminder.time.split(':').map(Number);
        const localDow = localTime.getDay();
        shouldSend = reminder.days.includes(localDow)
          && localTime.getHours() === rh
          && localTime.getMinutes() < 5
          && !alreadySentToday(lastSentAt, reminder.id, localTime);
      }
    } else if (reminder.type === 'threshold') {
      if (reminder.thresholdType === 'cards_due' && reminder.thresholdValue != null) {
        shouldSend = target.srCardsDueCount >= reminder.thresholdValue
          && !alreadySentWithinHours(lastSentAt, reminder.id, 24, now);
      }
    } else if (reminder.type === 'assignment') {
      // DEFERRED: Assignment reminders need the assignment's actual due date resolved from
      // the user's assignment list. The cron doesn't have access to the compressed pluginData
      // blob. Future iteration: add `assignmentDueAt` field to CustomReminder and have the
      // client populate it when saving the reminder. For now, assignment reminders are silently
      // skipped by the cron — the reminder saves and shows in UI but doesn't fire.
      shouldSend = false;
    }

    if (!shouldSend) continue;

    const title = reminder.title;
    const body = reminder.message || reminder.title;
    const url = '/#/dashboard';
    if (canPush) await sendPush(messaging, target.fcmToken!, title, body, url);
    if (canSms) await sendSMS(target.phone!, `NousAI reminder: ${body}`);
    updates[reminder.id] = now.toISOString();

    // Mark 'once' reminders as fired
    if (reminder.type === 'once') {
      const updatedReminders = (target.customReminders ?? []).map(r =>
        r.id === reminder.id ? { ...r, firedAt: now.toISOString() } : r
      );
      await db.collection('notification-targets').doc(uid).update({ customReminders: updatedReminders });
    }
  }

  // ── Write lastSentAt updates ───────────────────────────
  if (Object.keys(updates).length > 0) {
    const merged = { ...lastSentAt, ...updates };
    await db.collection('notification-targets').doc(uid).update({
      lastSentAt: merged,
      updatedAt: now.toISOString(),
    });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add api/cron/notifications.ts
git commit -m "feat(notifications): add hourly Vercel Cron notification dispatcher (FCM + SMS)"
```

---

## Chunk 4: UI — SettingsPage Notifications Section

### Task 12: Refactor notification state in `SettingsPage.tsx`

The existing notifications section stores prefs in localStorage only. We need to migrate to `pluginData` + write to `notification-targets`.

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add new imports** at the top of SettingsPage.tsx (near existing FCM imports):

```typescript
import { writeNotificationTarget, buildNotificationTarget } from '../utils/notificationTarget';
import type { CustomReminder } from '../types';
```

- [ ] **Step 2: Replace the `notifPerms` state** (line ~640) with a version backed by `pluginData`:

```typescript
// Replace old localStorage-based state with pluginData-backed state
const notifPrefs = data?.pluginData?.notificationPrefs;
const customReminders: CustomReminder[] = data?.pluginData?.customReminders ?? [];

// Local state for phone verification flow
const [phoneInput, setPhoneInput] = useState(notifPrefs?.phone ?? '');
const [verifyCode, setVerifyCode] = useState('');
const [verifyStep, setVerifyStep] = useState<'idle' | 'sent' | 'verifying'>('idle');
const [verifyError, setVerifyError] = useState('');
const [showAddReminder, setShowAddReminder] = useState(false);
const [editingReminder, setEditingReminder] = useState<CustomReminder | null>(null);

// Helper: save prefs to pluginData + notification-targets
const saveNotifPrefs = async (patch: Partial<NonNullable<typeof notifPrefs>>) => {
  const current = data?.pluginData?.notificationPrefs ?? {
    reviewReminders: true, streakAlerts: true, pomodoroAlerts: false,
    reminderTime: '09:00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const merged = { ...current, ...patch };
  // updatePluginData is synchronous (updates Zustand state); Firestore sync is debounced separately
  updatePluginData({ notificationPrefs: merged });

  // Mirror to notification-targets (flat, cron-readable) — write independently of pluginData sync
  try {
    const { getAuth } = await import('firebase/auth');
    const uid = getAuth().currentUser?.uid;
    if (uid) {
      const srCount = data?.pluginData?.srData?.cards?.filter((c: any) =>
        c.nextReview && new Date(c.nextReview) <= new Date()
      ).length ?? 0;
      const streak = data?.pluginData?.gamificationData?.currentStreak ?? 0;
      const lastStudied = data?.pluginData?.gamificationData?.lastStudyDate ?? '';
      const target = buildNotificationTarget(uid, merged, customReminders, srCount, streak, lastStudied);
      await writeNotificationTarget(uid, target);
    }
  } catch (e) {
    console.warn('[saveNotifPrefs] notification-targets write failed (non-fatal):', e);
  }
};
```

- [ ] **Step 3: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

---

### Task 13: Replace the notifications UI section in `SettingsPage.tsx`

**Files:**
- Modify: `src/pages/SettingsPage.tsx` (lines ~2529–2597)

- [ ] **Step 1: Replace the old `{/* ── #90 Notification Preferences ── */}` and `{/* ── FCM Push Notifications ── */}` blocks** with the expanded UI:

```tsx
{/* ── Notification Channels ── */}
<div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notification Channels</div>

  {/* Browser Push */}
  <div style={rowStyle}>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Browser Push</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Alerts even when app is closed</div>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {fcmToken && <span style={{ fontSize: 10, color: 'var(--green, #22c55e)' }}>✓ Active</span>}
      <button
        style={toggleStyle(!!(notifPrefs?.pushEnabled && fcmToken))}
        onClick={async () => {
          if (fcmToken) {
            clearFCMToken(); setFcmToken(null);
            await saveNotifPrefs({ pushEnabled: false, fcmToken: undefined });
          } else {
            const vapid = import.meta.env.VITE_FCM_VAPID_KEY;
            if (!vapid) { showToast('VITE_FCM_VAPID_KEY not configured'); return; }
            const { getAuth } = await import('firebase/auth');
            const uid = getAuth().currentUser?.uid;
            const result = await requestFCMPermission(vapid, uid ?? undefined, token => {
              setFcmToken(token);
              saveNotifPrefs({ pushEnabled: true, fcmToken: token });
            });
            if (result.error) showToast(result.error);
          }
        }}
      >
        <div style={toggleKnobStyle(!!(notifPrefs?.pushEnabled && fcmToken))} />
      </button>
    </div>
  </div>

  {/* SMS */}
  <div style={{ ...rowStyle, marginTop: 8 }}>
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>SMS Alerts</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Text messages to your phone</div>
    </div>
    <button
      style={toggleStyle(!!notifPrefs?.smsEnabled)}
      onClick={() => saveNotifPrefs({ smsEnabled: !notifPrefs?.smsEnabled })}
    >
      <div style={toggleKnobStyle(!!notifPrefs?.smsEnabled)} />
    </button>
  </div>

  {notifPrefs?.smsEnabled && (
    <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
      {/* Timezone */}
      <div style={{ ...rowStyle, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600 }}>Timezone</div>
        <input
          type="text"
          value={notifPrefs?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone}
          onChange={e => saveNotifPrefs({ timezone: e.target.value })}
          placeholder="America/New_York"
          style={{ fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', width: 180 }}
        />
      </div>

      {/* Phone number */}
      {notifPrefs?.phoneVerified ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: 'var(--green, #22c55e)', fontWeight: 600 }}>✓ {notifPrefs.phone} verified</span>
          <button className="btn btn-sm btn-secondary" onClick={() => saveNotifPrefs({ phone: undefined, phoneVerified: false })}>
            Change
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              type="tel"
              placeholder="+15551234567"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              style={{ flex: 1, fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
            <button
              className="btn btn-sm btn-primary"
              disabled={!phoneInput || verifyStep === 'sent'}
              onClick={async () => {
                setVerifyError('');
                try {
                  const { getAuth } = await import('firebase/auth');
                  const token = await getAuth().currentUser?.getIdToken();
                  if (!token) { setVerifyError('Not signed in'); return; }
                  const r = await fetch('/api/send-sms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ phone: phoneInput }),
                  });
                  const json = await r.json();
                  if (r.ok) { setVerifyStep('sent'); showToast('Code sent!'); }
                  else setVerifyError(json.error || 'Failed to send');
                } catch (e) {
                  setVerifyError('Network error — check connection');
                }
              }}
            >
              Send Code
            </button>
          </div>
          {verifyStep === 'sent' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="6-digit code"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ width: 110, fontSize: 11, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <button
                className="btn btn-sm btn-primary"
                disabled={verifyCode.length !== 6 || verifyStep === 'verifying'}
                onClick={async () => {
                  setVerifyStep('verifying');
                  const { getAuth } = await import('firebase/auth');
                  const token = await getAuth().currentUser?.getIdToken();
                  if (!token) { setVerifyError('Not signed in'); return; }
                  const r = await fetch('/api/verify-phone', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ code: verifyCode }),
                  });
                  const json = await r.json();
                  if (r.ok) {
                    await saveNotifPrefs({ phone: phoneInput, phoneVerified: true });
                    setVerifyStep('idle'); setVerifyCode('');
                    showToast('Phone verified!');
                  } else {
                    setVerifyError(json.error || 'Wrong code');
                    setVerifyStep('sent');
                  }
                }}
              >
                Verify
              </button>
            </div>
          )}
          {verifyError && <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 4 }}>{verifyError}</div>}
        </div>
      )}
    </div>
  )}
</div>

{/* ── Per-type toggles ── */}
<div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What to Notify</div>

  {([
    { key: 'reviewReminders' as const, label: 'Review reminders', desc: 'Daily flashcard digest at your chosen time', smsOk: true },
    { key: 'streakAlerts' as const, label: 'Streak alerts', desc: '2h before midnight when streak is at risk', smsOk: true },
    { key: 'pomodoroAlerts' as const, label: 'Pomodoro complete', desc: 'Push only — too frequent for SMS', smsOk: false },
  ] as const).map(({ key, label, desc, smsOk }) => (
    <div key={key} style={{ ...rowStyle, marginBottom: 10 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {notifPrefs?.pushEnabled && (
          <button
            style={{ ...toggleStyle(!!(notifPrefs?.[key])), transform: 'scale(0.85)' }}
            title="Push"
            onClick={() => saveNotifPrefs({ [key]: !notifPrefs?.[key] })}
          >
            <div style={toggleKnobStyle(!!(notifPrefs?.[key]))} />
          </button>
        )}
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>Push</span>
        {smsOk && notifPrefs?.smsEnabled && (
          <>
            <button
              style={{ ...toggleStyle(notifPrefs?.channels?.[key]?.includes('sms') ?? false), transform: 'scale(0.85)' }}
              title="SMS"
              onClick={() => {
                const cur = notifPrefs?.channels?.[key] ?? ['push'];
                const next = cur.includes('sms') ? cur.filter((c: string) => c !== 'sms') : [...cur, 'sms'];
                saveNotifPrefs({ channels: { ...(notifPrefs?.channels ?? {}), [key]: next } });
              }}
            >
              <div style={toggleKnobStyle(notifPrefs?.channels?.[key]?.includes('sms') ?? false)} />
            </button>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>SMS</span>
          </>
        )}
      </div>
    </div>
  ))}

  <div style={{ ...rowStyle, marginTop: 8 }}>
    <div style={{ fontSize: 11, fontWeight: 600 }}>Daily reminder time</div>
    <input
      type="time"
      value={notifPrefs?.reminderTime ?? '09:00'}
      onChange={e => saveNotifPrefs({ reminderTime: e.target.value })}
      style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12 }}
    />
  </div>
</div>
```

- [ ] **Step 2: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```

- [ ] **Step 3: Commit intermediate UI**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat(notifications): add channel controls + per-type toggles + SMS phone verification UI"
```

---

### Task 14: Add Custom Reminders section to `SettingsPage.tsx`

**Files:**
- Modify: `src/pages/SettingsPage.tsx` (add after the per-type toggles section)
- Create: `src/components/ReminderModal.tsx`

- [ ] **Step 1: Create `src/components/ReminderModal.tsx`**

```tsx
// src/components/ReminderModal.tsx
// Modal for adding/editing a CustomReminder

import { useState } from 'react';
import type { CustomReminder } from '../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  initial?: CustomReminder;
  smsEnabled?: boolean;
  onSave: (r: CustomReminder) => void;
  onClose: () => void;
}

function newReminder(): CustomReminder {
  return {
    id: crypto.randomUUID(),
    title: '',
    enabled: true,
    channels: ['push'],
    type: 'once',
    time: '09:00',
  };
}

export default function ReminderModal({ initial, smsEnabled, onSave, onClose }: Props) {
  const [r, setR] = useState<CustomReminder>(initial ?? newReminder());

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const modal: React.CSSProperties = {
    background: 'var(--bg-card)', borderRadius: 12, padding: 20,
    width: '90%', maxWidth: 400, maxHeight: '80vh', overflowY: 'auto',
    border: '1px solid var(--border)',
  };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' };
  const input: React.CSSProperties = {
    width: '100%', padding: '6px 8px', border: '1px solid var(--border)',
    borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
    boxSizing: 'border-box',
  };

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
          {initial ? 'Edit Reminder' : 'New Reminder'}
        </div>

        <label style={label}>Title *</label>
        <input style={input} value={r.title} onChange={e => setR({ ...r, title: e.target.value })} placeholder="e.g. Study for exam" />

        <label style={{ ...label, marginTop: 12 }}>Message (optional)</label>
        <input style={input} value={r.message ?? ''} onChange={e => setR({ ...r, message: e.target.value })} placeholder="Additional details..." />

        <label style={{ ...label, marginTop: 12 }}>Type</label>
        <select style={input} value={r.type} onChange={e => setR({ ...r, type: e.target.value as CustomReminder['type'] })}>
          <option value="once">One-time</option>
          <option value="recurring">Recurring</option>
          <option value="threshold">Threshold (cards due)</option>
          <option value="assignment">Assignment deadline</option>
        </select>

        {(r.type === 'once' || r.type === 'recurring') && (
          <>
            <label style={{ ...label, marginTop: 12 }}>Time</label>
            <input style={{ ...input, width: 'auto' }} type="time" value={r.time ?? '09:00'} onChange={e => setR({ ...r, time: e.target.value })} />
          </>
        )}

        {r.type === 'once' && (
          <>
            <label style={{ ...label, marginTop: 12 }}>Date</label>
            <input style={{ ...input, width: 'auto' }} type="date" value={r.date ?? ''} onChange={e => setR({ ...r, date: e.target.value })} />
          </>
        )}

        {r.type === 'recurring' && (
          <>
            <label style={{ ...label, marginTop: 12 }}>Days</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DAYS.map((day, i) => (
                <button
                  key={day}
                  style={{
                    padding: '4px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                    background: r.days?.includes(i) ? 'var(--accent)' : 'var(--bg-secondary)',
                    color: r.days?.includes(i) ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border)',
                  }}
                  onClick={() => {
                    const days = r.days ?? [];
                    setR({ ...r, days: days.includes(i) ? days.filter(d => d !== i) : [...days, i] });
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </>
        )}

        {r.type === 'threshold' && (
          <>
            <label style={{ ...label, marginTop: 12 }}>Alert when cards due ≥</label>
            <input
              style={{ ...input, width: 100 }}
              type="number" min={1} value={r.thresholdValue ?? 10}
              onChange={e => setR({ ...r, thresholdType: 'cards_due', thresholdValue: Number(e.target.value) })}
            />
          </>
        )}

        {r.type === 'assignment' && (
          <>
            <label style={{ ...label, marginTop: 12 }}>Notify N hours before deadline</label>
            <input
              style={{ ...input, width: 100 }}
              type="number" min={1} value={r.notifyBeforeHours ?? 24}
              onChange={e => setR({ ...r, notifyBeforeHours: Number(e.target.value) })}
            />
          </>
        )}

        {/* Channels */}
        <div style={{ marginTop: 14 }}>
          <label style={label}>Notify via</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['push', 'sms'] as const).map(ch => {
              if (ch === 'sms' && !smsEnabled) return null;
              const active = r.channels.includes(ch);
              return (
                <label key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox" checked={active}
                    onChange={() => setR({ ...r, channels: active ? r.channels.filter(c => c !== ch) : [...r.channels, ch] })}
                  />
                  {ch === 'push' ? '🔔 Push' : '📱 SMS'}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!r.title.trim()}
            onClick={() => onSave(r)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add custom reminders section in SettingsPage**, after the per-type toggles block:

```tsx
{/* ── Custom Reminders ── */}
<div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-primary)', borderRadius: 8, border: '1px solid var(--border)' }}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Reminders</div>
    <button className="btn btn-sm btn-primary" onClick={() => { setEditingReminder(null); setShowAddReminder(true); }}>+ Add</button>
  </div>

  {customReminders.length === 0 && (
    <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 0' }}>No custom reminders yet.</div>
  )}

  {customReminders.map(rem => (
    <div key={rem.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{rem.title}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {rem.type === 'once' && `${rem.date ?? ''} ${rem.time ?? ''} · Once`}
          {rem.type === 'recurring' && `${rem.days?.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(', ')} ${rem.time ?? ''} · Weekly`}
          {rem.type === 'threshold' && `≥${rem.thresholdValue} cards due`}
          {rem.type === 'assignment' && `${rem.notifyBeforeHours}h before deadline`}
          {' · '}{rem.channels.join(' + ')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          style={toggleStyle(rem.enabled)}
          onClick={() => {
            const updated = customReminders.map(r => r.id === rem.id ? { ...r, enabled: !r.enabled } : r);
            updatePluginData({ customReminders: updated });
          }}
        >
          <div style={toggleKnobStyle(rem.enabled)} />
        </button>
        <button className="btn btn-xs btn-secondary" onClick={() => { setEditingReminder(rem); setShowAddReminder(true); }}>Edit</button>
        <button className="btn btn-xs btn-secondary" style={{ color: 'var(--red, #ef4444)' }} onClick={() => {
          const updated = customReminders.filter(r => r.id !== rem.id);
          updatePluginData({ customReminders: updated });
        }}>×</button>
      </div>
    </div>
  ))}
</div>

{showAddReminder && (
  <ReminderModal
    initial={editingReminder ?? undefined}
    smsEnabled={notifPrefs?.smsEnabled}
    onClose={() => setShowAddReminder(false)}
    onSave={async (saved) => {
      const updated = editingReminder
        ? customReminders.map(r => r.id === saved.id ? saved : r)
        : [...customReminders, saved];
      updatePluginData({ customReminders: updated });
      setShowAddReminder(false);
      // Mirror to notification-targets
      const { getAuth } = await import('firebase/auth');
      const uid = getAuth().currentUser?.uid;
      if (uid && notifPrefs) {
        const target = buildNotificationTarget(uid, notifPrefs, updated, 0, 0, '');
        await writeNotificationTarget(uid, target);
      }
    }}
  />
)}
```

- [ ] **Step 3: Add the import for ReminderModal** at top of SettingsPage.tsx:

```typescript
import ReminderModal from '../components/ReminderModal';
```

- [ ] **Step 4: Verify build**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -10
```
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx src/components/ReminderModal.tsx
git commit -m "feat(notifications): add custom reminders UI with Add/Edit modal"
```

---

## Chunk 5: Config, Deploy, and Manual Verification

### Task 15: Update `vercel.json` and add `.env` template

**Files:**
- Modify: `vercel.json`
- Create: `.env.example`

- [ ] **Step 1: Update `vercel.json`** — add the `crons` array to the existing JSON, keeping the existing `headers` and `rewrites` arrays intact:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(self), geolocation=()" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" }
  ],
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 2: Create `.env.example`**

```bash
# Client-side (Vite — must have VITE_ prefix)
VITE_FCM_VAPID_KEY=your_vapid_key_from_firebase_console

# Server-side (Vercel Dashboard env vars)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@nousai-dc038.iam.gserviceaccount.com
FIREBASE_PROJECT_ID=nousai-dc038
CRON_SECRET=generate_a_random_64_char_secret_here
HMAC_SECRET=generate_another_random_64_char_secret_here
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "feat(notifications): add Vercel Cron config and env vars template"
```

---

### Task 16: Set up environment variables in Vercel and deploy

- [ ] **Step 1: Get Firebase service account key**

Go to: Firebase Console → Project Settings → Service Accounts → Generate new private key
Download the JSON. You'll need `private_key`, `client_email`, and `project_id`.

- [ ] **Step 2: Get VAPID key**

Go to: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
Copy the key value — this is your `VITE_FCM_VAPID_KEY`.

- [ ] **Step 3: Set up Twilio**

Sign up at twilio.com → Get Account SID, Auth Token, and a phone number.

- [ ] **Step 4: Add env vars in Vercel Dashboard**

Go to: vercel.com → NousAI project → Settings → Environment Variables

Add each variable from `.env.example`. For `FIREBASE_ADMIN_PRIVATE_KEY`, paste the full `-----BEGIN PRIVATE KEY-----...` string — Vercel handles multi-line values.

- [ ] **Step 5: Add `VITE_FCM_VAPID_KEY` to `.env.local`** (for local dev):

```bash
echo "VITE_FCM_VAPID_KEY=your_vapid_key_here" >> .env.local
```

- [ ] **Step 6: Deploy to production**

```bash
cd C:/Users/johnn/Desktop/NousAI-App && npm run build && vercel --prod --yes
```
Expected: Deployment succeeds.

- [ ] **Step 7: Clear PWA cache in browser**

Run in browser console on nousai-app.vercel.app:
```javascript
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
location.reload();
```

---

### Task 17: Manual end-to-end verification

> Use real profile `reallyjustjohnny6@gmail.com` for all testing.

- [ ] **Step 1: Test FCM push**
  - Log in → Settings → Notifications → Toggle "Browser Push" ON
  - Check browser shows permission prompt → Allow
  - Verify console shows no errors: `navigator.serviceWorker.getRegistration().then(r => console.log(r))`
  - In Firebase Console → Cloud Messaging → Send test message to the FCM token in notification-targets

- [ ] **Step 2: Test phone verification**
  - Settings → Toggle "SMS Alerts" ON
  - Enter your real phone number in E.164 format
  - Click "Send Code" → check Twilio logs at twilio.com/console
  - Enter the 6-digit code → verify "✓ verified" appears

- [ ] **Step 3: Test cron manually**

  Trigger the cron manually to verify it runs without errors:
  ```bash
  curl -X GET https://nousai-app.vercel.app/api/cron/notifications \
    -H "Authorization: Bearer YOUR_CRON_SECRET"
  ```
  Expected: `{ "ok": true, "sent": ..., "errors": 0 }`

- [ ] **Step 4: Test custom reminder**
  - Settings → Custom Reminders → Add → type "Once" → set date/time 2 min from now → Save
  - Wait for cron to fire (or trigger manually)
  - Verify push notification appears

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(notifications): complete PWA push + SMS notifications with Vercel Cron"
```
