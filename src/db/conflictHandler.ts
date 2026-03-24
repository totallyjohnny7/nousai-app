/**
 * RxDB Conflict Handler — Last-Write-Wins with smart merging for arrays.
 *
 * Default strategy: LWW using updatedAt timestamp (same as Phase 1 merge logic).
 * For courses: merges flashcard arrays instead of overwriting (preserves offline additions).
 *
 * Used by replication-firestore when both local and remote have changed the same document.
 */

/**
 * Default LWW conflict handler — newer updatedAt wins.
 * If timestamps are equal, remote (Firestore) wins (consistent with Phase 1 behavior).
 */
export function lastWriteWins<T extends { updatedAt?: string }>(
  local: T,
  remote: T,
): T {
  const localTime = local.updatedAt || '';
  const remoteTime = remote.updatedAt || '';
  return remoteTime >= localTime ? remote : local;
}

/**
 * Course-specific conflict handler — merges flashcard arrays.
 * Uses LWW for the course metadata, but unions flashcards from both sides
 * to prevent offline-added cards from being dropped.
 */
export function mergeCourseConflict(
  local: any,
  remote: any,
): any {
  // Winner takes metadata
  const winner = lastWriteWins(local, remote);

  // Merge flashcards: union by front+back fingerprint
  const localCards = local.flashcards || [];
  const remoteCards = remote.flashcards || [];
  const cardMap = new Map<string, any>();

  // Seed with local cards
  for (const card of localCards) {
    const key = `${card.front}\0${card.back}`;
    cardMap.set(key, card);
  }

  // Remote cards win on duplicates, new remote cards are added
  for (const card of remoteCards) {
    const key = `${card.front}\0${card.back}`;
    cardMap.set(key, card);
  }

  return {
    ...winner,
    flashcards: [...cardMap.values()],
    cardCount: cardMap.size,
  };
}
