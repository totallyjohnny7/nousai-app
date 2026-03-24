import type { NousAIData } from '../types'

export function validateBeforeWrite(
  data: NousAIData,
  _lastSaved: NousAIData | null
): { valid: boolean; reason?: string } {
  if (!data) return { valid: false, reason: 'No data' }
  return { valid: true }
}

export function countCards(data: NousAIData): number {
  let count = 0
  const courses = data?.pluginData?.coachData?.courses ?? []
  for (const c of courses) {
    count += c.flashcards?.length ?? 0
  }
  return count
}

export function logWrite(_key: string, _size: number, _source: string, _cardCount: number): void {
  // no-op stub
}
