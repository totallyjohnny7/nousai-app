/**
 * NousAI Cron Worker
 *
 * Scheduled triggers (configured in wrangler.toml):
 *   "0 2 * * 0"   → Weekly cleanup (Sunday 2:00 AM UTC)
 *   "0 14 * * *"  → Morning push notifications (8:00 AM CST)
 *   "0 2 * * *"   → Evening push notifications (8:00 PM CST prev. day)
 *
 * Deploy: cd workers/crons && wrangler deploy
 * Required secrets (set via wrangler secret put <NAME>):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

interface Env {
  FIREBASE_PROJECT_ID: string
  FIREBASE_CLIENT_EMAIL: string
  FIREBASE_PRIVATE_KEY: string
}

const FUNCTION_TIMEOUT_MS = 25000 // stop 5s before Cloudflare's 30s limit
const SIZE_WARNING_BYTES = 800 * 1024
const EXTENSION_SYNC_STALE_DAYS = 90
const BACKUP_RETENTION_DAYS = 30

function initFirebase(env: Env) {
  if (getApps().length) return
  initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  })
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

async function runCleanup(env: Env): Promise<void> {
  initFirebase(env)
  const db = getFirestore()
  const startTime = Date.now()
  const runId = new Date().toISOString().replace(/[:.]/g, '-')

  const summary = {
    runAt: new Date().toISOString(),
    usersProcessed: 0,
    usersSkipped: 0,
    usersWithSizeWarning: 0,
    extensionSyncFieldsDeleted: 0,
    backupsDeleted: 0,
    errors: [] as string[],
    warnings: [] as string[],
  }

  try {
    const usersSnap = await db.collection('users').listDocuments()

    for (const userRef of usersSnap) {
      if (Date.now() - startTime > FUNCTION_TIMEOUT_MS) {
        summary.warnings.push('Worker nearing timeout — stopped early. Remaining users not processed.')
        break
      }

      try {
        const userDoc = await userRef.get()
        const data = userDoc.data() || {}
        const uid = userRef.id

        const compressedSize = data.compressedSize as number | undefined
        if (compressedSize && compressedSize > SIZE_WARNING_BYTES) {
          summary.usersWithSizeWarning++
          summary.warnings.push(`${uid}: compressedSize ${Math.round(compressedSize / 1024)}KB exceeds threshold`)
        }

        const isV2 = data.chunkedSync === true && typeof data.version === 'string' && data.version.startsWith('2')
        if (!isV2) {
          summary.usersSkipped++
        } else {
          const extSync = data.extensionSync as Record<string, Record<string, string>> | undefined
          if (extSync) {
            const cutoff = new Date(Date.now() - EXTENSION_SYNC_STALE_DAYS * 24 * 60 * 60 * 1000)
            const gradesStale = !extSync.grades?.syncedAt || new Date(extSync.grades.syncedAt) < cutoff
            const assignmentsStale = !extSync.assignments?.syncedAt || new Date(extSync.assignments.syncedAt) < cutoff

            if (gradesStale && assignmentsStale) {
              await userRef.update({ extensionSync: FieldValue.delete() })
              summary.extensionSyncFieldsDeleted++
            }
          }
        }

        const backupsSnap = await userRef.collection('backups').get()
        const cutoffDate = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        const oldBackups = backupsSnap.docs.filter(doc => {
          const createdAt = doc.data().createdAt as string | undefined
          return createdAt && new Date(createdAt) < cutoffDate
        })

        if (oldBackups.length > 0) {
          const batch = db.batch()
          oldBackups.forEach(doc => batch.delete(doc.ref))
          await batch.commit()
        }
        summary.backupsDeleted += oldBackups.length
        summary.usersProcessed++
      } catch (err: unknown) {
        summary.errors.push(`${userRef.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err: unknown) {
    summary.errors.push(`Fatal: ${err instanceof Error ? err.message : String(err)}`)
  }

  try {
    await db.collection('cron-logs').doc(runId).set(summary)
  } catch {
    // Don't fail if logging fails
  }

  console.log('[cron-cleanup] done', JSON.stringify(summary))
}

// ─── Notifications ────────────────────────────────────────────────────────────

async function runNotify(env: Env, mode: 'morning' | 'evening'): Promise<void> {
  initFirebase(env)
  const db = getFirestore()
  const messaging = getMessaging()
  const today = new Date().toISOString().slice(0, 10)

  const snapshot = await db.collection('notif').get()
  const results = { sent: 0, failed: 0, skipped: 0, total: snapshot.size }

  const sends = snapshot.docs.map(async (docSnap) => {
    const d = docSnap.data()
    if (!d.fcmToken || d.notifEnabled === false) {
      results.skipped++
      return
    }
    try {
      if (mode === 'morning') {
        await sendMorning(messaging, d, today)
      } else {
        await sendEvening(messaging, d, today)
      }
      results.sent++
    } catch {
      results.failed++
    }
  })

  await Promise.allSettled(sends)

  await db.collection('cron-logs').add({
    type: 'notify',
    mode,
    ...results,
    runAt: new Date().toISOString(),
  })

  console.log(`[cron-notify:${mode}] done`, JSON.stringify(results))
}

async function sendMorning(
  messaging: ReturnType<typeof getMessaging>,
  d: Record<string, unknown>,
  today: string,
): Promise<void> {
  const dueCount = (d.cardsDueCount as number) || 0
  const streak = (d.streak as number) || 0
  const assignments = (d.assignments as { name: string; dueAt: string; courseCode: string }[]) || []

  let body = dueCount > 0
    ? `You have ${dueCount} card${dueCount === 1 ? '' : 's'} due for review.`
    : 'Open NousAI to keep your learning on track.'
  if (streak > 1) body += ` Keep your ${streak}-day streak! 🔥`

  await messaging.send({
    token: d.fcmToken as string,
    notification: { title: '📚 Time to study!', body },
    webpush: {
      fcmOptions: { link: 'https://studynous.com' },
      notification: { tag: 'nousai-morning', icon: '/icons/icon-192.png' },
    },
  })

  const now = Date.now()
  const H48 = 48 * 60 * 60 * 1000
  const urgent = assignments.filter(a => {
    const diff = new Date(a.dueAt).getTime() - now
    return diff > 0 && diff <= H48
  })

  for (const a of urgent.slice(0, 3)) {
    const hoursLeft = Math.round((new Date(a.dueAt).getTime() - now) / (60 * 60 * 1000))
    await messaging.send({
      token: d.fcmToken as string,
      notification: { title: `📅 Due in ${hoursLeft}h`, body: `${a.courseCode}: ${a.name}` },
      webpush: {
        fcmOptions: { link: 'https://studynous.com' },
        notification: { tag: `nousai-asgn-${a.name.slice(0, 20)}`, icon: '/icons/icon-192.png' },
      },
    })
  }

  // suppress unused variable warning
  void today
}

async function sendEvening(
  messaging: ReturnType<typeof getMessaging>,
  d: Record<string, unknown>,
  today: string,
): Promise<void> {
  const streak = (d.streak as number) || 0
  const lastStudyDate = d.lastStudyDate as string | null
  if (lastStudyDate === today || streak < 1) return

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
  })
}

// ─── Scheduled handler ────────────────────────────────────────────────────────

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron
    if (cron === '0 2 * * 0') {
      ctx.waitUntil(runCleanup(env))
    } else if (cron === '0 14 * * *') {
      ctx.waitUntil(runNotify(env, 'morning'))
    } else if (cron === '0 2 * * *') {
      ctx.waitUntil(runNotify(env, 'evening'))
    } else {
      console.warn('[cron] Unknown cron expression:', cron)
    }
  },
}
