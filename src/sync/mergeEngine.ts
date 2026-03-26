/**
 * Merge Engine — intelligently merges local and cloud NousAIData.
 *
 * Rules:
 * 1. Arrays with id+updatedAt: union-merge, higher updatedAt wins per item
 * 2. Empty-guard: if cloud array is empty but local has items, keep local
 * 3. Items only in local → always preserved
 * 4. Items only in cloud → always preserved
 * 5. Courses: per-course updatedAt comparison + card-level metadata merge
 * 6. Scalars: cloud wins (represents latest confirmed server state)
 */

import type { NousAIData, Course, FlashcardItem } from '../types'

/** Merge two arrays of objects that have `id` and optionally `updatedAt`/`createdAt`. */
function mergeById<T extends { id: string; updatedAt?: string | number; createdAt?: string | number }>(
  local: T[] | undefined,
  cloud: T[] | undefined,
): T[] | undefined {
  if (!local?.length && !cloud?.length) return cloud
  if (!local?.length) return cloud
  // Empty guard: cloud is empty but local has items → keep local
  if (!cloud?.length) return local

  const map = new Map<string, T>()
  // Seed with local entries
  for (const item of local) map.set(item.id, item)
  // Cloud wins if newer or equal; otherwise local keeps its version
  for (const item of cloud) {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
    } else {
      const cloudTime = String(item.updatedAt || item.createdAt || '')
      const localTime = String(existing.updatedAt || existing.createdAt || '')
      if (cloudTime >= localTime) map.set(item.id, item)
    }
  }
  return [...map.values()]
}

/** Merge courses with per-course updatedAt comparison + card metadata preservation. */
function mergeCourses(local: Course[], cloud: Course[]): Course[] {
  if (!local.length && !cloud.length) return cloud
  if (!local.length) return cloud
  if (!cloud.length) return local // empty guard

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
      const localTime = localCourse.updatedAt || ''
      const cloudTime = cloudCourse.updatedAt || ''

      let winner: Course
      if (cloudTime > localTime) winner = cloudCourse
      else if (localTime > cloudTime) winner = localCourse
      else winner = cloudCourse // equal → trust cloud

      // Preserve locally-set card topic/media that cloud may lack
      const localCards = new Map(
        (localCourse.flashcards ?? []).map(c => [`${c.front}\0${c.back}`, c]),
      )
      const flashcards = (winner.flashcards ?? []).map(winnerCard => {
        const localCard = localCards.get(`${winnerCard.front}\0${winnerCard.back}`)
        if (!localCard) return winnerCard
        const m: FlashcardItem = { ...winnerCard }
        if (!(winnerCard.topic && winnerCard.topic !== '__none__') && localCard.topic && localCard.topic !== '__none__') {
          m.topic = localCard.topic
        }
        if (!winnerCard.media && localCard.media) m.media = localCard.media
        return m
      })

      merged.push({ ...winner, flashcards })
    }
  }
  return merged
}

/**
 * Full merge of local + cloud NousAIData.
 * Replaces the old mergeLocalCardMeta with comprehensive coverage.
 */
export function mergeAppData(local: NousAIData | null, cloud: NousAIData): NousAIData {
  if (!local) return cloud

  const localCourses = local.pluginData?.coachData?.courses ?? []
  const cloudCourses = cloud.pluginData?.coachData?.courses ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localPD = local.pluginData ?? {} as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cloudPD = cloud.pluginData ?? {} as any

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

  // Gamification: keep whichever has more XP (proxy for "more progress")
  const mergedGamification =
    (localPD.gamification?.totalXp ?? 0) > (cloudPD.gamification?.totalXp ?? 0)
      ? localPD.gamification
      : cloudPD.gamification

  // SR data: keep whichever has more reviews (proxy for "more study done")
  const localReviews = Object.keys(localPD.srData?.cards ?? {}).length
  const cloudReviews = Object.keys(cloudPD.srData?.cards ?? {}).length
  const mergedSrData = localReviews > cloudReviews ? localPD.srData : cloudPD.srData

  return {
    ...cloud,
    pluginData: {
      ...cloud.pluginData,
      coachData: {
        ...cloud.pluginData.coachData,
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
