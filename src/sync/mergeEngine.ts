/**
 * Merge Engine — intelligently merges local and cloud NousAIData.
 *
 * SYNC FIX — 2026-03-27 (deletion resurrection fix)
 * Root cause: The merge engine was purely additive. Items present in cloud
 * but absent locally were always added back, making deletions impossible.
 * Fix: Added `lastPushedAt` parameter. For items only in cloud, if the local
 * device pushed AFTER the cloud item was last updated, the item was deliberately
 * deleted → skip it. If the cloud item is newer than our last push, it's
 * genuinely new from another device → add it.
 *
 * Rules:
 * 1. Items on BOTH sides: newer updatedAt wins per item, cloud wins ties
 * 2. Items only in local: always preserved (local additions)
 * 3. Items only in cloud:
 *    - If cloud item's updatedAt <= lastPushedAt → DELETED locally, skip
 *    - If cloud item's updatedAt > lastPushedAt → NEW from another device, add
 *    - If no lastPushedAt → add (first sync, can't distinguish)
 * 4. Empty-guard: if cloud array is empty but local has items, keep local
 * 5. Courses: per-course merge + flashcard-level merge
 * 6. Gamification: field-level (max XP, max streak, union badges)
 * 7. SR data: per-card merge (more reps wins)
 */

import type { NousAIData, Course, FlashcardItem, GamificationData, SRData, SRCard } from '../types'

// ─── Timestamp normalization ────────────────────────────────
/** Convert any timestamp format to milliseconds-since-epoch for reliable comparison. */
function toMs(ts: string | number | undefined): number {
  if (ts === undefined || ts === null || ts === '') return 0
  if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000
  const parsed = Date.parse(ts)
  return isNaN(parsed) ? 0 : parsed
}

// ─── Array merge by ID (deletion-aware) ─────────────────────
/**
 * Merge two arrays of objects with `id` and optional timestamps.
 * @param lastPushedMs - when we last pushed to cloud (0 = unknown, add all cloud items)
 */
function mergeById<T extends { id: string; updatedAt?: string | number; createdAt?: string | number }>(
  local: T[] | undefined,
  cloud: T[] | undefined,
  lastPushedMs: number,
): T[] | undefined {
  if (!local?.length && !cloud?.length) return cloud
  if (!local?.length) return cloud
  if (!cloud?.length) return local // empty guard

  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)

  for (const item of cloud) {
    const existing = map.get(item.id)
    if (!existing) {
      // Cloud-only item: was it deleted locally or is it new from another device?
      const cloudItemMs = toMs(item.updatedAt ?? item.createdAt)
      if (lastPushedMs > 0 && cloudItemMs <= lastPushedMs) {
        // We pushed AFTER this item was last updated → we had it and removed it → SKIP
        continue
      }
      // Cloud item is newer than our last push → genuinely new from another device → ADD
      map.set(item.id, item)
    } else {
      const cloudMs = toMs(item.updatedAt ?? item.createdAt)
      const localMs = toMs(existing.updatedAt ?? existing.createdAt)
      if (cloudMs >= localMs) map.set(item.id, item)
    }
  }
  return [...map.values()]
}

// ─── Flashcard merge (deletion-aware) ───────────────────────
function mergeFlashcards(
  localCards: FlashcardItem[],
  cloudCards: FlashcardItem[],
  lastPushedMs: number,
): FlashcardItem[] {
  const map = new Map<string, FlashcardItem>()

  const cardKey = (c: FlashcardItem): string =>
    (c as any).id ? `id:${(c as any).id}` : `fp:${c.front}\0${c.back}`

  for (const card of localCards) map.set(cardKey(card), card)

  for (const card of cloudCards) {
    const key = cardKey(card)
    const existing = map.get(key)
    if (!existing) {
      // Cloud-only card: deleted locally or new from another device?
      const cardMs = toMs((card as any).updatedAt ?? (card as any).createdAt)
      if (lastPushedMs > 0 && cardMs <= lastPushedMs) {
        continue // deleted locally → skip
      }
      map.set(key, card) // new from another device → add
    } else {
      // Both sides have it — cloud wins on conflict, preserve local metadata
      const merged: FlashcardItem = { ...card }
      if (!(card.topic && card.topic !== '__none__') && existing.topic && existing.topic !== '__none__') {
        merged.topic = existing.topic
      }
      if (!card.media && existing.media) merged.media = existing.media
      map.set(key, merged)
    }
  }
  return [...map.values()]
}

// ─── Course merge (deletion-aware) ──────────────────────────
function mergeCourses(local: Course[], cloud: Course[], lastPushedMs: number): Course[] {
  if (!local.length && !cloud.length) return cloud
  if (!local.length) return cloud
  if (!cloud.length) return local

  const localById = new Map(local.map(c => [c.id, c]))
  const cloudById = new Map(cloud.map(c => [c.id, c]))
  const allIds = new Set([...localById.keys(), ...cloudById.keys()])
  const merged: Course[] = []

  for (const id of allIds) {
    const localCourse = localById.get(id)
    const cloudCourse = cloudById.get(id)

    if (!localCourse && cloudCourse) {
      // Cloud-only course: deleted locally or new from another device?
      const courseMs = toMs(cloudCourse.updatedAt)
      if (lastPushedMs > 0 && courseMs <= lastPushedMs) {
        continue // deleted locally → skip (DO NOT RESURRECT)
      }
      merged.push(cloudCourse) // new from another device → add
    } else if (localCourse && !cloudCourse) {
      merged.push(localCourse)
    } else if (localCourse && cloudCourse) {
      const localMs = toMs(localCourse.updatedAt)
      const cloudMs = toMs(cloudCourse.updatedAt)

      let winner: Course
      if (cloudMs > localMs) winner = cloudCourse
      else if (localMs > cloudMs) winner = localCourse
      else winner = cloudCourse

      const flashcards = mergeFlashcards(
        localCourse.flashcards ?? [],
        cloudCourse.flashcards ?? [],
        lastPushedMs,
      )

      merged.push({ ...winner, flashcards })
    }
  }
  return merged
}

// ─── Gamification merge ─────────────────────────────────────
function mergeGamification(
  local: GamificationData | undefined,
  cloud: GamificationData | undefined,
): GamificationData | undefined {
  if (!local) return cloud
  if (!cloud) return local

  return {
    ...cloud,
    totalXp: Math.max(local.totalXp ?? 0, cloud.totalXp ?? 0),
    level: Math.max(local.level ?? 1, cloud.level ?? 1),
    currentStreak: Math.max(local.currentStreak ?? 0, cloud.currentStreak ?? 0),
    longestStreak: Math.max(local.longestStreak ?? 0, cloud.longestStreak ?? 0),
    lastActiveDate: (toMs(local.lastActiveDate) > toMs(cloud.lastActiveDate))
      ? local.lastActiveDate : cloud.lastActiveDate,
    streakFreezes: Math.max(local.streakFreezes ?? 0, cloud.streakFreezes ?? 0),
    badges: unionBadges(local.badges, cloud.badges),
    weeklyQuests: (local.weeklyQuests?.length ?? 0) >= (cloud.weeklyQuests?.length ?? 0)
      ? local.weeklyQuests : cloud.weeklyQuests,
    studyGoals: (local.studyGoals?.length ?? 0) >= (cloud.studyGoals?.length ?? 0)
      ? local.studyGoals : cloud.studyGoals,
  } as GamificationData
}

function unionBadges(a: any[] | undefined, b: any[] | undefined): any[] {
  if (!a?.length) return b ?? []
  if (!b?.length) return a ?? []
  const map = new Map<string, any>()
  for (const badge of a) map.set(badge.id ?? badge.name ?? JSON.stringify(badge), badge)
  for (const badge of b) map.set(badge.id ?? badge.name ?? JSON.stringify(badge), badge)
  return [...map.values()]
}

// ─── SR Data merge ──────────────────────────────────────────
function mergeSrData(
  local: SRData | undefined,
  cloud: SRData | undefined,
  lastPushedMs: number,
): SRData | undefined {
  if (!local) return cloud
  if (!cloud) return local

  const localCards = local.cards ?? {}
  const cloudCards = cloud.cards ?? {}
  const allKeys = new Set([...Object.keys(localCards), ...Object.keys(cloudCards)])
  const mergedCards: Record<string, SRCard> = {}

  for (const key of allKeys) {
    const lc = localCards[key]
    const cc = cloudCards[key]
    if (!lc && cc) {
      // Cloud-only SR card: deleted locally or new?
      const ccMs = toMs((cc as any).updatedAt ?? (cc as any).due)
      if (lastPushedMs > 0 && ccMs <= lastPushedMs) {
        continue // deleted locally
      }
      mergedCards[key] = cc
      continue
    }
    if (!cc) { mergedCards[key] = lc; continue }
    const localReps = lc.reps ?? 0
    const cloudReps = cc.reps ?? 0
    mergedCards[key] = cloudReps >= localReps ? cc : lc
  }

  return { ...cloud, cards: mergedCards }
}

// ─── Main merge function ────────────────────────────────────
/**
 * Full merge of local + cloud NousAIData.
 *
 * @param local - Current local data
 * @param cloud - Data pulled from cloud
 * @param lastPushedAt - ISO timestamp of our last successful push (from localStorage 'nousai-last-push').
 *                       Used to distinguish "deleted locally" from "new from another device."
 *                       Pass undefined if unknown (first sync — all cloud items will be added).
 */
export function mergeAppData(
  local: NousAIData | null,
  cloud: NousAIData,
  lastPushedAt?: string,
): NousAIData {
  if (!local) return cloud

  const lastPushedMs = toMs(lastPushedAt)

  const cloudPD = cloud.pluginData ?? {} as any
  const localPD = local.pluginData ?? {} as any

  const localCourses = localPD?.coachData?.courses ?? []
  const cloudCourses = cloudPD?.coachData?.courses ?? []

  const mergedCourses = mergeCourses(localCourses, cloudCourses, lastPushedMs)
  const mergedAnnotations = mergeById(localPD.annotations, cloudPD.annotations, lastPushedMs)
  const mergedNotes = mergeById(localPD.notes, cloudPD.notes, lastPushedMs)
  const mergedAiChatSessions = mergeById(localPD.aiChatSessions, cloudPD.aiChatSessions, lastPushedMs)
  const mergedToolSessions = mergeById(localPD.toolSessions, cloudPD.toolSessions, lastPushedMs)
  const mergedProcedures = mergeById(localPD.savedProcedures, cloudPD.savedProcedures, lastPushedMs)
  const mergedDrawings = mergeById(localPD.drawings, cloudPD.drawings, lastPushedMs)
  const mergedMatchSets = mergeById(localPD.matchSets, cloudPD.matchSets, lastPushedMs)
  const mergedQuizHistory = mergeById(localPD.quizHistory, cloudPD.quizHistory, lastPushedMs)
  const mergedSavedVideos = mergeById(localPD.savedVideos, cloudPD.savedVideos, lastPushedMs)
  const mergedStudyGuides = mergeById(localPD.studyGuides, cloudPD.studyGuides, lastPushedMs)

  const mergedGamification = mergeGamification(localPD.gamification, cloudPD.gamification)
  const mergedSrData = mergeSrData(localPD.srData, cloudPD.srData, lastPushedMs)

  return {
    ...cloud,
    pluginData: {
      ...(cloudPD),
      coachData: {
        ...(cloudPD.coachData ?? {}),
        courses: mergedCourses,
      },
      ...(mergedAnnotations !== undefined && { annotations: mergedAnnotations }),
      ...(mergedNotes !== undefined && { notes: mergedNotes }),
      ...(mergedAiChatSessions !== undefined && { aiChatSessions: mergedAiChatSessions }),
      ...(mergedToolSessions !== undefined && { toolSessions: mergedToolSessions }),
      ...(mergedProcedures !== undefined && { savedProcedures: mergedProcedures }),
      ...(mergedDrawings !== undefined && { drawings: mergedDrawings }),
      ...(mergedMatchSets !== undefined && { matchSets: mergedMatchSets }),
      ...(mergedQuizHistory !== undefined && { quizHistory: mergedQuizHistory }),
      ...(mergedSavedVideos !== undefined && { savedVideos: mergedSavedVideos }),
      ...(mergedStudyGuides !== undefined && { studyGuides: mergedStudyGuides }),
      ...(mergedGamification && { gamification: mergedGamification }),
      ...(mergedSrData && { srData: mergedSrData }),
    },
  }
}
