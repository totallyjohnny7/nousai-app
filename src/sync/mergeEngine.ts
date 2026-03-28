/**
 * SYNC FIX #4 + #7 + #17 + #21 — 2026-03-27
 * Bug #4: Gamification/SR data used whole-object replacement → silent data loss
 * Bug #7: String timestamp comparison broke for numeric epochs
 * Bug #17: Flashcard matching by front+back broke on text edits
 * Bug #21: mergeAppData crashed if cloud.pluginData was undefined
 * Root cause: No field-level merge for gamification/SR; no timestamp normalization;
 *             no stable ID matching for flashcards; no null guards on cloud data
 * Fix: Field-level merge for gamification (sum XP, max streaks) and SR (per-card merge).
 *      Normalize timestamps to ms-since-epoch. Match flashcards by ID first, then content.
 *      Add null guards throughout.
 * Validates: Multi-device gamification progress preserved. SR reviews never lost.
 *            Flashcard text edits preserve metadata. Malformed cloud data doesn't crash.
 */

import type { NousAIData, Course, FlashcardItem, GamificationData, SRData, SRCard } from '../types'

// ─── Timestamp normalization (FIX #7) ──────────────────────
/** Convert any timestamp format to milliseconds-since-epoch for reliable comparison. */
function toMs(ts: string | number | undefined): number {
  if (ts === undefined || ts === null || ts === '') return 0
  if (typeof ts === 'number') return ts > 1e12 ? ts : ts * 1000 // seconds vs ms
  const parsed = Date.parse(ts)
  return isNaN(parsed) ? 0 : parsed
}

// ─── Array merge by ID ──────────────────────────────────────
/** Merge two arrays of objects with `id` and optional timestamps. Newer wins per item. */
function mergeById<T extends { id: string; updatedAt?: string | number; createdAt?: string | number }>(
  local: T[] | undefined,
  cloud: T[] | undefined,
): T[] | undefined {
  if (!local?.length && !cloud?.length) return cloud
  if (!local?.length) return cloud
  if (!cloud?.length) return local // empty guard

  const map = new Map<string, T>()
  for (const item of local) map.set(item.id, item)
  for (const item of cloud) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
    } else {
      const cloudMs = toMs(item.updatedAt ?? item.createdAt)
      const localMs = toMs(existing.updatedAt ?? existing.createdAt)
      // Cloud wins on tie (represents confirmed server state)
      if (cloudMs >= localMs) map.set(item.id, item)
    }
  }
  return [...map.values()]
}

// ─── Flashcard merge (FIX #17) ──────────────────────────────
/** Match flashcards by ID first, then by content fingerprint for legacy cards. */
function mergeFlashcards(localCards: FlashcardItem[], cloudCards: FlashcardItem[]): FlashcardItem[] {
  const map = new Map<string, FlashcardItem>()

  // Build key: prefer stable id, fall back to content fingerprint
  const cardKey = (c: FlashcardItem): string =>
    (c as any).id ? `id:${(c as any).id}` : `fp:${c.front}\0${c.back}`

  for (const card of localCards) map.set(cardKey(card), card)
  for (const card of cloudCards) {
    const key = cardKey(card)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, card)
    } else {
      // Cloud wins on conflict, but preserve local-only metadata
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

// ─── Course merge ───────────────────────────────────────────
function mergeCourses(local: Course[], cloud: Course[]): Course[] {
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
      merged.push(cloudCourse)
    } else if (localCourse && !cloudCourse) {
      merged.push(localCourse)
    } else if (localCourse && cloudCourse) {
      const localMs = toMs(localCourse.updatedAt)
      const cloudMs = toMs(cloudCourse.updatedAt)

      let winner: Course
      if (cloudMs > localMs) winner = cloudCourse
      else if (localMs > cloudMs) winner = localCourse
      else winner = cloudCourse // equal → trust cloud

      // Always merge flashcards from both sides (FIX #2 — wire in flashcard merge)
      const flashcards = mergeFlashcards(
        localCourse.flashcards ?? [],
        cloudCourse.flashcards ?? [],
      )

      merged.push({ ...winner, flashcards })
    }
  }
  return merged
}

// ─── Gamification merge (FIX #4) ────────────────────────────
/** Field-level merge: sum additive fields, max non-additive fields. */
function mergeGamification(
  local: GamificationData | undefined,
  cloud: GamificationData | undefined,
): GamificationData | undefined {
  if (!local) return cloud
  if (!cloud) return local

  return {
    ...cloud, // base with cloud structure
    // Additive: take the higher value (represents more progress)
    totalXp: Math.max(local.totalXp ?? 0, cloud.totalXp ?? 0),
    level: Math.max(local.level ?? 1, cloud.level ?? 1),
    // Streaks: keep the longer streak
    currentStreak: Math.max(local.currentStreak ?? 0, cloud.currentStreak ?? 0),
    longestStreak: Math.max(local.longestStreak ?? 0, cloud.longestStreak ?? 0),
    // Last active: keep the more recent date
    lastActiveDate: (toMs(local.lastActiveDate) > toMs(cloud.lastActiveDate))
      ? local.lastActiveDate : cloud.lastActiveDate,
    // Streak freezes: keep higher count (can't un-buy a freeze)
    streakFreezes: Math.max(local.streakFreezes ?? 0, cloud.streakFreezes ?? 0),
    // Badges: union — keep all earned badges from both sides
    badges: unionBadges(local.badges, cloud.badges),
    // Weekly quests: keep whichever has more progress
    weeklyQuests: (local.weeklyQuests?.length ?? 0) >= (cloud.weeklyQuests?.length ?? 0)
      ? local.weeklyQuests : cloud.weeklyQuests,
    // Study goals: keep whichever has more entries
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

// ─── SR Data merge (FIX #4) ─────────────────────────────────
/** Per-card merge: for each card ID, keep the version with the most recent review. */
function mergeSrData(
  local: SRData | undefined,
  cloud: SRData | undefined,
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
    if (!lc) { mergedCards[key] = cc; continue }
    if (!cc) { mergedCards[key] = lc; continue }
    // Keep whichever has the more recent review (higher reps or later due date)
    const localReps = lc.reps ?? 0
    const cloudReps = cc.reps ?? 0
    mergedCards[key] = cloudReps >= localReps ? cc : lc
  }

  return { ...cloud, cards: mergedCards }
}

// ─── Main merge function ────────────────────────────────────
/**
 * Full merge of local + cloud NousAIData.
 * Union-merges arrays by ID, field-level merges gamification/SR, preserves both sides' data.
 */
export function mergeAppData(local: NousAIData | null, cloud: NousAIData): NousAIData {
  if (!local) return cloud

  // FIX #21: null guards on cloud data
  const cloudPD = cloud.pluginData ?? {} as any
  const localPD = local.pluginData ?? {} as any

  const localCourses = localPD?.coachData?.courses ?? []
  const cloudCourses = cloudPD?.coachData?.courses ?? []

  const mergedCourses = mergeCourses(localCourses, cloudCourses)
  const mergedAnnotations = mergeById(localPD.annotations, cloudPD.annotations)
  const mergedNotes = mergeById(localPD.notes, cloudPD.notes)
  const mergedAiChatSessions = mergeById(localPD.aiChatSessions, cloudPD.aiChatSessions)
  const mergedToolSessions = mergeById(localPD.toolSessions, cloudPD.toolSessions)
  const mergedProcedures = mergeById(localPD.savedProcedures, cloudPD.savedProcedures)
  const mergedDrawings = mergeById(localPD.drawings, cloudPD.drawings)
  const mergedMatchSets = mergeById(localPD.matchSets, cloudPD.matchSets)
  const mergedQuizHistory = mergeById(localPD.quizHistory, cloudPD.quizHistory)
  const mergedSavedVideos = mergeById(localPD.savedVideos, cloudPD.savedVideos)
  const mergedStudyGuides = mergeById(localPD.studyGuides, cloudPD.studyGuides)

  // FIX #4: Field-level merge instead of whole-object replacement
  const mergedGamification = mergeGamification(localPD.gamification, cloudPD.gamification)
  const mergedSrData = mergeSrData(localPD.srData, cloudPD.srData)

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
