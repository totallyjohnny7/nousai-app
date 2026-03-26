/**
 * Conflict detection for NousAI cloud sync.
 * Determines whether local, cloud, or a merge should win.
 */

export type SyncResolution = 'local-wins' | 'cloud-wins' | 'merge'

/**
 * Detect sync conflict between local and cloud data snapshots.
 *
 * Uses the root-level `updatedAt` ISO timestamp on the Firestore metadata doc
 * and local data modification timestamps to determine resolution strategy.
 *
 * @param localUpdatedAt - ISO timestamp or epoch ms of last local mutation
 * @param cloudUpdatedAt - ISO timestamp or epoch ms from Firestore metadata doc
 * @returns resolution strategy
 */
export function detectConflict(
  localUpdatedAt: string | number | undefined,
  cloudUpdatedAt: string | number | undefined,
): SyncResolution {
  // No cloud timestamp → cloud has never been written, local wins
  if (!cloudUpdatedAt) return 'local-wins'
  // No local timestamp → fresh install, accept cloud
  if (!localUpdatedAt) return 'cloud-wins'

  const localMs = typeof localUpdatedAt === 'number' ? localUpdatedAt : new Date(localUpdatedAt).getTime()
  const cloudMs = typeof cloudUpdatedAt === 'number' ? cloudUpdatedAt : new Date(cloudUpdatedAt).getTime()

  // Guard against NaN
  if (isNaN(localMs)) return 'cloud-wins'
  if (isNaN(cloudMs)) return 'local-wins'

  const diff = localMs - cloudMs

  // Within 30 seconds → concurrent edits, merge
  if (Math.abs(diff) < 30_000) return 'merge'

  // Local is newer → merge to preserve both sides
  if (diff > 0) return 'merge'

  // Cloud is significantly ahead (>5 min) → cloud wins outright
  if (diff < -300_000) return 'cloud-wins'

  // Cloud is somewhat newer → merge to be safe
  return 'merge'
}
