/**
 * NousAI Cron Cleanup Endpoint
 *
 * Runs weekly (Sunday 2:00 AM UTC) to perform safe server-side data hygiene:
 * - Checks compressedSize and warns if approaching Firestore 1MB limit
 * - Deletes stale extensionSync field (Canvas data older than 90 days)
 * - Deletes conflict backup docs older than 30 days
 *
 * NOTE: Does NOT touch gzip-compressed user data blobs — client-side trimForSync() handles that.
 *
 * Auth: Vercel CRON_SECRET in Authorization header (Bearer <secret>)
 * Dry-run: Pass ?dryRun=true to preview changes without writing
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const SIZE_WARNING_BYTES = 800 * 1024 // 800KB
const EXTENSION_SYNC_STALE_DAYS = 90
const BACKUP_RETENTION_DAYS = 30
const FUNCTION_TIMEOUT_MS = 8500 // stop 1.5s before Vercel Hobby 10s limit

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET (Vercel cron) and HEAD
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Validate cron secret
  const authHeader = req.headers.authorization || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token || token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Lazy Firebase init — after auth check, wrapped so missing env vars return 500 JSON (not crash)
  let db: ReturnType<typeof getFirestore>
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    }
    db = getFirestore()
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: 'Firebase init failed — check FIREBASE_* env vars', details: msg })
  }

  const dryRun = req.query.dryRun === 'true'
  const startTime = Date.now()
  const runId = new Date().toISOString().replace(/[:.]/g, '-')

  const summary = {
    runAt: new Date().toISOString(),
    dryRun,
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
      // Stop if approaching timeout
      if (Date.now() - startTime > FUNCTION_TIMEOUT_MS) {
        summary.warnings.push('Function nearing timeout — stopped early. Remaining users not processed.')
        break
      }

      try {
        const userDoc = await userRef.get()
        const data = userDoc.data() || {}
        const uid = userRef.id

        // Check compressed data size
        const compressedSize = data.compressedSize as number | undefined
        if (compressedSize && compressedSize > SIZE_WARNING_BYTES) {
          summary.usersWithSizeWarning++
          summary.warnings.push(`${uid}: compressedSize ${Math.round(compressedSize / 1024)}KB exceeds ${SIZE_WARNING_BYTES / 1024}KB threshold`)
        }

        // Only process extensionSync for V2 chunked-sync users
        const isV2 = data.chunkedSync === true && typeof data.version === 'string' && data.version.startsWith('2')
        if (!isV2) {
          summary.usersSkipped++
          // Still clean up backups for legacy users — safe regardless of sync version
        } else {
          // Check extensionSync staleness
          const extSync = data.extensionSync as Record<string, Record<string, string>> | undefined
          if (extSync) {
            const gradesSyncedAt = extSync.grades?.syncedAt
            const assignmentsSyncedAt = extSync.assignments?.syncedAt
            const cutoff = new Date(Date.now() - EXTENSION_SYNC_STALE_DAYS * 24 * 60 * 60 * 1000)

            const gradesStale = !gradesSyncedAt || new Date(gradesSyncedAt) < cutoff
            const assignmentsStale = !assignmentsSyncedAt || new Date(assignmentsSyncedAt) < cutoff

            if (gradesStale && assignmentsStale) {
              if (!dryRun) {
                await userRef.update({ extensionSync: FieldValue.delete() })
              }
              summary.extensionSyncFieldsDeleted++
            }
          }
        }

        // Delete old conflict backups (users/{uid}/backups/{timestamp_label})
        const backupsSnap = await userRef.collection('backups').get()
        const cutoffDate = new Date(Date.now() - BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000)
        const oldBackups = backupsSnap.docs.filter(doc => {
          const createdAt = doc.data().createdAt as string | undefined
          return createdAt && new Date(createdAt) < cutoffDate
        })

        if (oldBackups.length > 0 && !dryRun) {
          const batch = db.batch()
          oldBackups.forEach(doc => batch.delete(doc.ref))
          await batch.commit()
        }
        summary.backupsDeleted += oldBackups.length
        summary.usersProcessed++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        summary.errors.push(`${userRef.id}: ${message}`)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    summary.errors.push(`Fatal: ${message}`)
  }

  // Write run summary to Firestore (always, even in dry-run)
  try {
    await db.collection('cron-logs').doc(runId).set(summary)
  } catch {
    // Don't fail the response if logging fails
  }

  return res.status(200).json(summary)
}
