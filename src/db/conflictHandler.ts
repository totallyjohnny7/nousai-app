/**
 * SYNC FIX #3 — 2026-03-27
 * Bug: conflictHandler.ts (remote wins on tie) disagreed with replication.ts (local wins on tie)
 * Root cause: Two independent implementations with no shared strategy
 * Fix: Established single rule: REMOTE wins on tie (represents confirmed server state).
 *      Both this file and replication.ts now use these handlers consistently.
 *      Added ID-based flashcard matching alongside content fingerprint (FIX #17 compat).
 * Validates: replication.ts imports and uses these handlers. No more inline conflict logic.
 */

/**
 * Default LWW conflict handler — newer updatedAt wins.
 * Remote wins on tie (represents confirmed server state).
 */
export function lastWriteWins<T extends { updatedAt?: string }>(
  local: T,
  remote: T,
): T {
  const localTime = local.updatedAt || '';
  const remoteTime = remote.updatedAt || '';
  // Remote wins on tie — consistent across entire codebase
  return remoteTime >= localTime ? remote : local;
}

/**
 * Course-specific conflict handler — merges flashcard arrays.
 * Uses LWW for course metadata, but unions flashcards from both sides
 * to prevent offline-added cards from being dropped.
 * Matches by ID first, then by content fingerprint for legacy cards.
 */
export function mergeCourseConflict(
  local: any,
  remote: any,
): any {
  // Winner takes metadata
  const winner = lastWriteWins(local, remote);

  // Merge flashcards: union by ID, then content fingerprint
  const localCards: any[] = local.flashcards || [];
  const remoteCards: any[] = remote.flashcards || [];
  const cardMap = new Map<string, any>();

  const cardKey = (c: any): string =>
    c.id ? `id:${c.id}` : `fp:${c.front}\0${c.back}`;

  // Seed with local cards
  for (const card of localCards) {
    cardMap.set(cardKey(card), card);
  }

  // Remote cards win on duplicates, new remote cards are added
  for (const card of remoteCards) {
    const key = cardKey(card);
    const existing = cardMap.get(key);
    if (!existing) {
      cardMap.set(key, card);
    } else {
      // Merge: remote wins but preserve local-only metadata
      const merged = { ...card };
      if (!(card.topic && card.topic !== '__none__') && existing.topic && existing.topic !== '__none__') {
        merged.topic = existing.topic;
      }
      if (!card.media && existing.media) merged.media = existing.media;
      cardMap.set(key, merged);
    }
  }

  return {
    ...winner,
    flashcards: [...cardMap.values()],
    cardCount: cardMap.size,
  };
}
