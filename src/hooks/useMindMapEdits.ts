/**
 * useMindMapEdits — shared hook for all practicum mind maps.
 * Loads bubble overrides from Zustand (cloud-synced) or falls back to hardcoded defaults.
 * Saves every change through updatePluginData so it automatically syncs to Firestore.
 */
import { useState, useCallback } from 'react'
import { useStore } from '../store'
import type { PluginData } from '../types'

type MapKey = 'phys' | 'biol' | 'evol' | 'jp'

export function useMindMapEdits<T extends { id: string }>(
  mapKey: MapKey,
  defaults: T[],
) {
  const { data, updatePluginData } = useStore()
  const [isEditMode, setIsEditMode] = useState(false)

  const storageKey = `mindmapOverrides_${mapKey}` as keyof PluginData
  const stored = data?.pluginData?.[storageKey] as T[] | undefined

  const [bubbles, setBubblesState] = useState<T[]>(() =>
    Array.isArray(stored) && stored.length > 0 ? (stored as T[]) : [...defaults]
  )

  const saveBubbles = useCallback((next: T[]) => {
    setBubblesState(next)
    updatePluginData({ [storageKey]: next } as Partial<PluginData>)
  }, [storageKey, updatePluginData])

  return { bubbles, saveBubbles, isEditMode, setIsEditMode }
}
