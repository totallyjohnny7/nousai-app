# SMS Study Reminders Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Twilio SMS study reminders to NousAI — flashcards due, streak alerts, daily goal, Pomodoro complete, and daily digest — delivered to the user's iPhone even when the app is closed.

**Architecture:** A Vercel Cron Job (`api/sms-reminder.ts`) runs every hour, reads the user's study data from Firestore via Firebase Admin SDK, and sends qualifying texts through Twilio. A second endpoint (`api/sms-send.ts`) handles Pomodoro texts client-side (event-driven). A settings endpoint (`api/sms-settings.ts`) saves phone/preferences to Firestore.

**Tech Stack:** TypeScript, Vercel Serverless Functions, Vercel Cron, Firebase Admin SDK (already installed), Twilio REST API (`twilio` npm package), React + Zustand (settings UI)

**Spec:** `docs/superpowers/specs/2026-03-17-sms-reminders-design.md`

> **Note:** Use real profile `johnnyluu7@icloud.com` for all testing.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `api/sms-settings.ts` | Save phone + prefs to Firestore (Firebase ID token auth) |
| Create | `api/sms-reminder.ts` | Hourly cron — check conditions, send scheduled texts |
| Create | `api/sms-send.ts` | Client-triggered Pomodoro SMS (rate-limited) |
| Create | `api/_smsUtils.ts` | Shared: Twilio send, Firebase Admin init, quiet hours check |
| Modify | `src/types.ts` | Add `SmsPrefs` interface + `smsPrefs` to `PluginData` |
| Modify | `vercel.json` | Add `crons` config for hourly sms-reminder |
| Modify | `src/pages/SettingsPage.tsx` | Add SMS Notifications UI section |
| Modify | `src/pages/Timer.tsx` | Call `api/sms-send` when work phase ends |

---

## Chunk 1: Types + Shared Utilities

### Task 1: Add `SmsPrefs` type and install Twilio

**Files:**
- Modify: `src/types.ts:291-320`
- Run: `npm install twilio`

- [ ] **Step 1: Install the Twilio npm package**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm install twilio
```

Expected: `added X packages` with no errors. `twilio` now appears in `package.json` dependencies.

- [ ] **Step 2: Add `SmsPrefs` interface to `src/types.ts`**

Open `src/types.ts`. Find the `notificationPrefs` line (~line 313) inside `PluginData`. Add `smsPrefs` on the line directly after it:

```typescript
  smsPrefs?: SmsPrefs;
```

Then find the end of the file (or after all other interfaces) and add the full interface:

```typescript
export interface SmsPrefs {
  phone: string;                // E.164 format e.g. "+14025551234"
  enabled: boolean;             // Master toggle
  flashcardsReminder: boolean;
  streakReminder: boolean;
  pomodoroReminder: boolean;
  dailyGoalReminder: boolean;
  dailyDigestEnabled: boolean;
  reminderTime: string;         // "HH:MM" 24hr e.g. "20:00"
  timezone: string;             // IANA e.g. "America/Chicago"
  lastFlashcardSms?: number;    // Unix ms
  lastDailyDigest?: number;     // Unix ms
  lastStreakSms?: number;       // Unix ms
  lastGoalSms?: number;         // Unix ms
  lastPomodoroSms?: number;     // Unix ms
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors. If errors appear, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts package.json package-lock.json
git commit -m "feat: add SmsPrefs type and install twilio"
```

---

### Task 2: Create shared SMS utilities (`api/_smsUtils.ts`)

**Files:**
- Create: `api/_smsUtils.ts`

- [ ] **Step 1: Create `api/_smsUtils.ts`**

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import twilio from 'twilio';
import type { SmsPrefs } from '../src/types';

// ── Firebase Admin init (guard against double-init) ──────────────────────────
export function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT!, 'base64').toString('utf-8')
    );
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// ── Twilio client ─────────────────────────────────────────────────────────────
export function getTwilioClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!);
}

// ── Send SMS ──────────────────────────────────────────────────────────────────
export async function sendSms(to: string, body: string): Promise<void> {
  const client = getTwilioClient();
  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });
}

// ── Quiet hours check (no texts 10pm–8am in user's timezone) ─────────────────
export function isQuietHours(timezone: string): boolean {
  const hour = new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone })
  ).getHours();
  return hour >= 22 || hour < 8;
}

// ── Get current hour in user's timezone ──────────────────────────────────────
export function getCurrentHour(timezone: string): number {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: timezone })
  ).getHours();
}

// ── Check if timestamp is older than N ms ────────────────────────────────────
export function olderThan(timestamp: number | undefined, ms: number): boolean {
  if (!timestamp) return true;
  return Date.now() - timestamp > ms;
}

// ── Validate E.164 phone format ───────────────────────────────────────────────
export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

// ── Re-export type for convenience ────────────────────────────────────────────
export type { SmsPrefs };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add api/_smsUtils.ts
git commit -m "feat: add shared SMS/Firebase Admin utilities"
```

---

## Chunk 2: API Endpoints

### Task 3: Create `api/sms-settings.ts`

**Files:**
- Create: `api/sms-settings.ts`

- [ ] **Step 1: Create `api/sms-settings.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, isValidE164 } from './_smsUtils';
import { getAuth } from 'firebase-admin/auth';
import { getApps } from 'firebase-admin/app';
import type { SmsPrefs } from '../src/types';

const ALLOWED_ORIGINS = ['https://nousai-app.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify Firebase ID token
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Missing Authorization header' });

  const db = getAdminDb(); // init Firebase Admin (guarded against double-init)

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid ID token' });
  }

  const body = req.body as Partial<SmsPrefs>;

  // Validate phone if provided
  if (body.phone !== undefined && !isValidE164(body.phone)) {
    return res.status(400).json({ error: 'Phone must be in E.164 format (e.g. +14025551234)' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    const existing = snap.exists ? (snap.data()?.pluginData?.smsPrefs ?? {}) : {};

    const updated: SmsPrefs = {
      phone: '',
      enabled: false,
      flashcardsReminder: true,
      streakReminder: true,
      pomodoroReminder: false,
      dailyGoalReminder: true,
      dailyDigestEnabled: true,
      reminderTime: '20:00',
      timezone: 'America/Chicago',
      ...existing,
      ...body,
    };

    await userRef.set({ pluginData: { smsPrefs: updated } }, { merge: true });
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sms-settings] Firestore error:', message);
    return res.status(500).json({ error: 'Failed to save settings' });
  }
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add api/sms-settings.ts
git commit -m "feat: add sms-settings API endpoint"
```

---

### Task 4: Create `api/sms-send.ts` (Pomodoro trigger)

**Files:**
- Create: `api/sms-send.ts`

- [ ] **Step 1: Create `api/sms-send.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, sendSms, isQuietHours, olderThan } from './_smsUtils';
import { getAuth } from 'firebase-admin/auth';

const ALLOWED_ORIGINS = ['https://nousai-app.vercel.app', 'http://localhost:5173', 'http://localhost:4173'];
const POMODORO_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin || '';
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify Firebase ID token
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) return res.status(401).json({ error: 'Missing Authorization header' });

  const db = getAdminDb(); // init Firebase Admin (guarded against double-init)

  let uid: string;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid ID token' });
  }

  try {
    const snap = await db.collection('users').doc(uid).get();
    const smsPrefs = snap.data()?.pluginData?.smsPrefs;

    if (!smsPrefs?.enabled || !smsPrefs?.pomodoroReminder) {
      return res.status(200).json({ sent: false, reason: 'disabled' });
    }

    // Rate limit checked BEFORE quiet hours (spec order)
    if (!olderThan(smsPrefs.lastPomodoroSms, POMODORO_COOLDOWN_MS)) {
      return res.status(200).json({ sent: false, reason: 'rate_limited' });
    }

    if (isQuietHours(smsPrefs.timezone)) {
      return res.status(200).json({ sent: false, reason: 'quiet_hours' });
    }

    await sendSms(smsPrefs.phone, '⏱ NousAI: Pomodoro complete! Take a break, you\'ve earned it.');

    await db.collection('users').doc(uid).set(
      { pluginData: { smsPrefs: { lastPomodoroSms: Date.now() } } },
      { merge: true }
    );

    return res.status(200).json({ sent: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sms-send] Error:', message);
    return res.status(500).json({ error: 'Failed to send SMS' });
  }
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add api/sms-send.ts
git commit -m "feat: add sms-send API endpoint for Pomodoro trigger"
```

---

### Task 5: Create `api/sms-reminder.ts` (hourly cron)

**Files:**
- Create: `api/sms-reminder.ts`

- [ ] **Step 1: Create `api/sms-reminder.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb, sendSms, isQuietHours, getCurrentHour, olderThan, isValidE164 } from './_smsUtils';
import type { SmsPrefs } from '../src/types';

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Authenticate cron request
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const uid = process.env.FIREBASE_USER_UID;
  if (!uid) {
    console.error('[sms-reminder] FIREBASE_USER_UID env var not set');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  let db;
  try {
    db = getAdminDb();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sms-reminder] Firebase init error:', message);
    return res.status(500).json({ error: 'Firebase init failed' });
  }

  let smsPrefs: SmsPrefs;
  let pluginData: Record<string, unknown>;

  try {
    const snap = await db.collection('users').doc(uid).get();
    pluginData = snap.data()?.pluginData ?? {};
    smsPrefs = pluginData.smsPrefs as SmsPrefs;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[sms-reminder] Firestore read error:', message);
    return res.status(500).json({ error: 'Firestore read failed' });
  }

  if (!smsPrefs?.enabled || !smsPrefs?.phone) {
    return res.status(200).json({ skipped: 'SMS disabled or no phone set' });
  }

  if (!isValidE164(smsPrefs.phone)) {
    console.warn('[sms-reminder] Invalid phone number format, skipping all sends:', smsPrefs.phone);
    return res.status(200).json({ skipped: 'invalid phone format' });
  }

  if (isQuietHours(smsPrefs.timezone)) {
    return res.status(200).json({ skipped: 'quiet hours' });
  }

  const currentHour = getCurrentHour(smsPrefs.timezone);
  const reminderHour = parseInt(smsPrefs.reminderTime.split(':')[0], 10);
  const isReminderHour = currentHour === reminderHour;

  const sentTexts: string[] = [];
  const updates: Partial<SmsPrefs> = {};

  // ── Flashcard reminder ────────────────────────────────────────────────────
  if (smsPrefs.flashcardsReminder) {
    try {
      const cards = (pluginData.srCards as Array<{ due?: number }>) ?? [];
      const dueCount = cards.filter(c => c.due && c.due <= Date.now()).length;
      if (dueCount > 0 && olderThan(smsPrefs.lastFlashcardSms, FOUR_HOURS_MS)) {
        await sendSms(smsPrefs.phone, `📚 NousAI: You have ${dueCount} flashcard${dueCount === 1 ? '' : 's'} due for review. nousai-app.vercel.app`);
        updates.lastFlashcardSms = Date.now();
        sentTexts.push('flashcards');
      }
    } catch (err) {
      console.error('[sms-reminder] Flashcard SMS error:', err instanceof Error ? err.message : err);
    }
  }

  // ── Streak reminder (fires at reminderTime hour) ──────────────────────────
  if (smsPrefs.streakReminder && isReminderHour) {
    try {
      const gamification = pluginData.gamification as { streak?: number; lastStudyDate?: string } | undefined;
      const streak = gamification?.streak ?? 0;
      const lastStudy = gamification?.lastStudyDate ?? '';
      const today = new Date().toISOString().slice(0, 10);
      const studiedToday = lastStudy === today;

      if (streak > 0 && !studiedToday && olderThan(smsPrefs.lastStreakSms, ONE_DAY_MS)) {
        await sendSms(smsPrefs.phone, `🔥 NousAI: Don't break your ${streak}-day streak! You haven't studied today.`);
        updates.lastStreakSms = Date.now();
        sentTexts.push('streak');
      }
    } catch (err) {
      console.error('[sms-reminder] Streak SMS error:', err instanceof Error ? err.message : err);
    }
  }

  // ── Daily goal reminder (fires at reminderTime hour) ─────────────────────
  if (smsPrefs.dailyGoalReminder && isReminderHour) {
    try {
      const gamification = pluginData.gamification as { dailyXP?: number; dailyXPGoal?: number } | undefined;
      const earnedXP = gamification?.dailyXP ?? 0;
      const goalXP = gamification?.dailyXPGoal ?? 50;
      const goalMet = earnedXP >= goalXP;

      if (!goalMet && olderThan(smsPrefs.lastGoalSms, ONE_DAY_MS)) {
        await sendSms(smsPrefs.phone, `🎯 NousAI: Daily goal check — you're at ${earnedXP}/${goalXP} XP today. Keep going!`);
        updates.lastGoalSms = Date.now();
        sentTexts.push('daily_goal');
      }
    } catch (err) {
      console.error('[sms-reminder] Goal SMS error:', err instanceof Error ? err.message : err);
    }
  }

  // ── Daily digest (fires at reminderTime hour) ─────────────────────────────
  if (smsPrefs.dailyDigestEnabled && isReminderHour && olderThan(smsPrefs.lastDailyDigest, ONE_DAY_MS)) {
    try {
      const gamification = pluginData.gamification as { streak?: number; dailyXP?: number; dailyXPGoal?: number } | undefined;
      const cards = (pluginData.srCards as Array<{ due?: number }>) ?? [];
      const dueCount = cards.filter(c => c.due && c.due <= Date.now()).length;
      const streak = gamification?.streak ?? 0;
      const earnedXP = gamification?.dailyXP ?? 0;
      const goalXP = gamification?.dailyXPGoal ?? 50;

      await sendSms(smsPrefs.phone, `📖 NousAI Daily: ${dueCount} card${dueCount === 1 ? '' : 's'} due · Streak: ${streak} days · Daily goal: ${earnedXP}/${goalXP} XP`);
      updates.lastDailyDigest = Date.now();
      sentTexts.push('digest');
    } catch (err) {
      console.error('[sms-reminder] Digest SMS error:', err instanceof Error ? err.message : err);
    }
  }

  // ── Persist throttle timestamps ───────────────────────────────────────────
  if (Object.keys(updates).length > 0) {
    try {
      await db.collection('users').doc(uid).set(
        { pluginData: { smsPrefs: updates } },
        { merge: true }
      );
    } catch (err) {
      console.error('[sms-reminder] Failed to update throttle timestamps:', err instanceof Error ? err.message : err);
    }
  }

  return res.status(200).json({ sent: sentTexts, skipped: sentTexts.length === 0 ? 'no conditions met' : undefined });
}
```

- [ ] **Step 2: TypeScript compile check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add api/sms-reminder.ts
git commit -m "feat: add hourly cron SMS reminder endpoint"
```

---

## Chunk 3: Config, UI, and Timer Integration

### Task 6: Add cron schedule to `vercel.json`

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Update `vercel.json` to add crons**

Current content:
```json
{
  "headers": [...],
  "rewrites": [...]
}
```

Add `"crons"` array:

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
      "path": "/api/sms-reminder",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "require('./vercel.json'); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add hourly cron schedule for SMS reminders"
```

---

### Task 7: Add SMS Notifications UI to `SettingsPage.tsx`

**Files:**
- Modify: `src/pages/SettingsPage.tsx`

- [ ] **Step 1: Add SMS state near the existing `notifPerms` state (~line 645)**

Find the `notifPerms` useState block and add the SMS state directly after it:

```typescript
  const [smsPrefs, setSmsPrefs] = useState<import('../types').SmsPrefs>(() => {
    const stored = data.pluginData?.smsPrefs;
    return {
      phone: '',
      enabled: false,
      flashcardsReminder: true,
      streakReminder: true,
      pomodoroReminder: false,
      dailyGoalReminder: true,
      dailyDigestEnabled: true,
      reminderTime: '20:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...stored,
    };
  });
  const [smsPhoneInput, setSmsPhoneInput] = useState(data.pluginData?.smsPrefs?.phone ?? '');
  const [smsSaving, setSmsSaving] = useState(false);
```

- [ ] **Step 2: Add `saveSmsPrefs` function after the state declarations**

Find a good location near other async save functions in SettingsPage and add:

```typescript
  async function saveSmsPrefs(overrides?: Partial<import('../types').SmsPrefs>) {
    setSmsSaving(true);
    try {
      const prefs = { ...smsPrefs, ...overrides, phone: smsPhoneInput, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
      const user = auth.currentUser;
      if (!user) throw new Error('Not logged in');
      const token = await user.getIdToken();
      const res = await fetch('/api/sms-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(await res.text());
      setSmsPrefs(prefs);
      updatePluginData({ smsPrefs: prefs });
      showToast('SMS settings saved');
    } catch (err) {
      showToast('Failed to save SMS settings');
      console.error(err);
    } finally {
      setSmsSaving(false);
    }
  }
```

- [ ] **Step 3: Add the SMS UI section in the JSX**

Find the `{/* FCM Push Notifications */}` comment (~line 2683) and add the SMS section directly after the FCM block closes. Look for the closing `</div>` of the FCM block and insert after it:

```tsx
            {/* ── SMS Notifications ── */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 12, color: 'var(--text-secondary)' }}>SMS Notifications (Twilio)</div>

              {/* Phone number input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  type="tel"
                  placeholder="+14025551234"
                  value={smsPhoneInput}
                  onChange={e => setSmsPhoneInput(e.target.value)}
                  style={{ flex: 1, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}
                />
                <button
                  onClick={() => saveSmsPrefs()}
                  disabled={smsSaving}
                  style={{ padding: '6px 14px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer' }}
                >{smsSaving ? 'Saving…' : 'Save'}</button>
              </div>

              {/* Master toggle */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 13 }}>Enable SMS Reminders</span>
                <button
                  onClick={() => { const next = !smsPrefs.enabled; setSmsPrefs(p => ({ ...p, enabled: next })); saveSmsPrefs({ enabled: next }); }}
                  style={{ padding: '4px 12px', fontSize: 12, fontWeight: 600, background: smsPrefs.enabled ? 'var(--accent)' : 'var(--surface)', color: smsPrefs.enabled ? '#000' : 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer' }}
                >{smsPrefs.enabled ? 'ON' : 'OFF'}</button>
              </div>

              {/* Individual toggles */}
              {smsPrefs.enabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12, paddingLeft: 8 }}>
                  {([
                    { key: 'flashcardsReminder' as const, label: 'Flashcards due' },
                    { key: 'streakReminder' as const, label: 'Streak reminder' },
                    { key: 'dailyGoalReminder' as const, label: 'Daily goal reminder' },
                    { key: 'pomodoroReminder' as const, label: 'Pomodoro complete' },
                    { key: 'dailyDigestEnabled' as const, label: 'Daily digest (summary)' },
                  ] as const).map(({ key, label }) => (
                    <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={smsPrefs[key]}
                        onChange={e => { const next = { ...smsPrefs, [key]: e.target.checked }; setSmsPrefs(next); saveSmsPrefs({ [key]: e.target.checked }); }}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              {/* Daily reminder time */}
              {smsPrefs.enabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Daily reminder time</span>
                  <input
                    type="time"
                    value={smsPrefs.reminderTime}
                    onChange={e => setSmsPrefs(p => ({ ...p, reminderTime: e.target.value }))}
                    onBlur={() => saveSmsPrefs({ reminderTime: smsPrefs.reminderTime })}
                    style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 8px', fontSize: 13 }}
                  />
                </div>
              )}
            </div>
```

- [ ] **Step 4: TypeScript compile check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors. Fix any issues before committing.

- [ ] **Step 5: Commit**

```bash
git add src/pages/SettingsPage.tsx
git commit -m "feat: add SMS Notifications section to Settings page"
```

---

### Task 8: Add Pomodoro SMS trigger to `src/pages/Timer.tsx`

**Files:**
- Modify: `src/pages/Timer.tsx`

- [ ] **Step 1: Add the `triggerPomodoroSms` helper inside the component**

Find the `handlePhaseEnd` function (~line 97). Add a new async helper directly before it:

```typescript
  async function triggerPomodoroSms() {
    try {
      const { auth } = await import('../utils/auth');
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      await fetch('/api/sms-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error('[Timer] Pomodoro SMS error:', err);
    }
  }
```

- [ ] **Step 2: Call `triggerPomodoroSms` inside `handlePhaseEnd` when a work phase ends**

Inside `handlePhaseEnd`, find the `if (phase === 'work') {` block (~line 103) and add the call at the start of that block:

```typescript
    if (phase === 'work') {
      triggerPomodoroSms(); // fire-and-forget SMS
      const newSession = session + 1
      // ... rest of existing code unchanged
```

- [ ] **Step 3: TypeScript compile check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Timer.tsx
git commit -m "feat: trigger Pomodoro SMS when work phase ends"
```

---

## Chunk 4: Deploy + Twilio Setup

### Task 9: Set up Twilio account and environment variables

**This task requires manual steps in the browser. Complete each step before continuing.**

- [ ] **Step 1: Create Twilio account**
  - Go to twilio.com → Sign Up
  - Verify your email

- [ ] **Step 2: Verify your personal phone number (CRITICAL for free trial)**
  - In Twilio Console → Phone Numbers → Verified Caller IDs
  - Click "Add a new Caller ID" → enter your personal number → verify with the code they text you
  - Without this, trial accounts CANNOT send SMS to your number

- [ ] **Step 3: Buy a Twilio phone number**
  - Console → Phone Numbers → Manage → Buy a number
  - Choose a US number (~$1/mo)
  - Note the number in E.164 format (e.g. `+14025559876`)

- [ ] **Step 4: Get Account SID and Auth Token**
  - Twilio Console home page shows both at the top
  - Click the eye icon to reveal Auth Token
  - Copy both values

- [ ] **Step 5: Add env vars to Vercel**
  - Go to vercel.com → nousai-app project → Settings → Environment Variables
  - Add each of these (select all environments: Production, Preview, Development):

  | Name | Value |
  |---|---|
  | `TWILIO_ACCOUNT_SID` | `ACxxxxxxxxxxxxx` (from Twilio) |
  | `TWILIO_AUTH_TOKEN` | `xxxxxxxxxxxxxxx` (from Twilio) |
  | `TWILIO_PHONE_NUMBER` | `+1xxxxxxxxxx` (your Twilio number) |
  | `CRON_SECRET` | any random string (generate one at random.org or use `openssl rand -hex 32` in terminal) |
  | `FIREBASE_USER_UID` | `Mxy9gLTgMuhb…` (your UID from CLAUDE.md) |
  | `FIREBASE_SERVICE_ACCOUNT` | Check if already set — if not, go to Firebase Console → Project Settings → Service Accounts → Generate new private key → download JSON → base64 encode: `base64 -i serviceAccount.json` → paste result |

- [ ] **Step 6: Confirm all 6 env vars are set in Vercel**

---

### Task 10: Build, deploy, and verify

**Files:** None (deploy step)

- [ ] **Step 1: Final build check**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && npm run build
```

Expected: build completes with zero TypeScript errors, zero Vite errors.

- [ ] **Step 2: Deploy to production**

```bash
cd C:\Users\johnn\Desktop\NousAI-App && vercel --prod --yes
```

Expected: deployment URL printed, status: Ready.

- [ ] **Step 3: Clear PWA cache after deploy**

In the browser on the production site, open DevTools console and run:
```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```
Then hard refresh (Ctrl+Shift+R).

- [ ] **Step 4: Test the Settings UI**
  - Go to nousai-app.vercel.app → Settings → scroll to SMS Notifications
  - Enter your phone number in E.164 format (e.g. `+14025551234`)
  - Click Save
  - Toggle "Enable SMS Reminders" ON
  - Verify toast "SMS settings saved" appears

- [ ] **Step 5: Test the cron endpoint manually**

In terminal (replace `YOUR_CRON_SECRET` with what you set):
```bash
curl -X POST https://nousai-app.vercel.app/api/sms-reminder \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Expected response: `{"sent":[],"skipped":"no conditions met"}` or `{"sent":["flashcards"]}` depending on your data.

- [ ] **Step 6: Test the Pomodoro SMS**
  - Go to nousai-app.vercel.app → Timer
  - Start a Pomodoro, wait for it to complete (or use the Skip button)
  - Check your phone for the text within 10 seconds

- [ ] **Step 7: Verify cron is registered in Vercel**
  - Go to vercel.com → nousai-app → Settings → Crons
  - You should see `sms-reminder` listed with hourly schedule
  - Check "Last run" after the next full hour to confirm it fired

- [ ] **Step 8: Commit any final fixes**

```bash
git add -p
git commit -m "fix: post-deploy SMS reminder adjustments (if any)"
```
