/**
 * NousAI Push Notification Cron
 *
 * Called by Vercel cron on two schedules:
 *   - Morning (8 AM CST): study reminder + cards due + Canvas assignments
 *   - Evening (8 PM CST): streak warning if user hasn't studied today
 *
 * Reads lightweight /notif/{uid} docs (not the compressed user blob).
 * Sends FCM push via Firebase Admin messaging.send().
 *
 * Query params:
 *   ?mode=morning  (default)
 *   ?mode=evening
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

function initFirebase() {
  if (getApps().length) return;
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    }),
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Auth check
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const mode = (req.query.mode as string) || 'morning';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  initFirebase();
  const db = getFirestore();
  const messaging = getMessaging();

  const snapshot = await db.collection('notif').get();
  const results = { sent: 0, failed: 0, skipped: 0, total: snapshot.size };

  const sends = snapshot.docs.map(async (docSnap) => {
    const d = docSnap.data();
    if (!d.fcmToken || d.notifEnabled === false) {
      results.skipped++;
      return;
    }

    try {
      if (mode === 'morning') {
        await sendMorning(messaging, d, today);
      } else if (mode === 'evening') {
        await sendEvening(messaging, d, today);
      }
      results.sent++;
    } catch {
      results.failed++;
    }
  });

  await Promise.allSettled(sends);

  // Log result to Firestore
  await db.collection('cron-logs').add({
    type: 'notify',
    mode,
    ...results,
    runAt: new Date().toISOString(),
  });

  return res.status(200).json({ ok: true, mode, ...results });
}

async function sendMorning(messaging: ReturnType<typeof getMessaging>, d: Record<string, unknown>, today: string) {
  const dueCount = (d.cardsDueCount as number) || 0;
  const streak = (d.streak as number) || 0;
  const assignments = (d.assignments as { name: string; dueAt: string; courseCode: string }[]) || [];

  // Study reminder
  let body = dueCount > 0
    ? `You have ${dueCount} card${dueCount === 1 ? '' : 's'} due for review.`
    : 'Open NousAI to keep your learning on track.';
  if (streak > 1) body += ` Keep your ${streak}-day streak! 🔥`;

  await messaging.send({
    token: d.fcmToken as string,
    notification: { title: '📚 Time to study!', body },
    webpush: {
      fcmOptions: { link: 'https://studynous.com' },
      notification: { tag: 'nousai-morning', icon: '/icons/icon-192.png' },
    },
  });

  // Canvas assignments due within 48 hours
  const now = Date.now();
  const H48 = 48 * 60 * 60 * 1000;
  const urgent = assignments.filter(a => {
    const diff = new Date(a.dueAt).getTime() - now;
    return diff > 0 && diff <= H48;
  });

  for (const a of urgent.slice(0, 3)) { // max 3 assignment alerts
    const hoursLeft = Math.round((new Date(a.dueAt).getTime() - now) / (60 * 60 * 1000));
    await messaging.send({
      token: d.fcmToken as string,
      notification: {
        title: `📅 Due in ${hoursLeft}h`,
        body: `${a.courseCode}: ${a.name}`,
      },
      webpush: {
        fcmOptions: { link: 'https://studynous.com' },
        notification: { tag: `nousai-asgn-${a.name.slice(0, 20)}`, icon: '/icons/icon-192.png' },
      },
    });
  }
}

async function sendEvening(messaging: ReturnType<typeof getMessaging>, d: Record<string, unknown>, today: string) {
  const streak = (d.streak as number) || 0;
  const lastStudyDate = d.lastStudyDate as string | null;

  // Skip if already studied today or no active streak
  if (lastStudyDate === today || streak < 1) return;

  await messaging.send({
    token: d.fcmToken as string,
    notification: {
      title: '🔥 Streak at risk!',
      body: `You haven't studied today. Your ${streak}-day streak ends at midnight!`,
    },
    webpush: {
      fcmOptions: { link: 'https://studynous.com' },
      notification: { tag: 'nousai-streak', icon: '/icons/icon-192.png' },
    },
  });
}
