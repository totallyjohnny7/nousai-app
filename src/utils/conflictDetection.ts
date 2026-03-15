/**
 * Conflict detection utilities for NousAI sync
 */
import { computeChecksum } from './syncQueue';

export interface ConflictInfo {
  entityName: string;
  localChecksum: string;
  cloudChecksum: string;
  localTimestamp: number;
  cloudTimestamp: number;
  localPayload: unknown;
  cloudPayload: unknown;
}

/**
 * Compare local and cloud payloads by checksum.
 * Returns null if no conflict, or a ConflictInfo if checksums differ.
 */
export async function detectConflict(
  entityName: string,
  localPayload: unknown,
  localTimestamp: number,
  cloudPayload: unknown,
  cloudTimestamp: number
): Promise<ConflictInfo | null> {
  const [localChecksum, cloudChecksum] = await Promise.all([
    computeChecksum(localPayload),
    computeChecksum(cloudPayload),
  ]);

  if (localChecksum === cloudChecksum) return null;

  return {
    entityName,
    localChecksum,
    cloudChecksum,
    localTimestamp,
    cloudTimestamp,
    localPayload,
    cloudPayload,
  };
}

const resolvedConflicts = new Set<string>();

export function markConflictResolved(localChecksum: string, cloudChecksum: string) {
  resolvedConflicts.add(`${localChecksum}:${cloudChecksum}`);
}

export function wasConflictResolved(localChecksum: string, cloudChecksum: string): boolean {
  return resolvedConflicts.has(`${localChecksum}:${cloudChecksum}`);
}
