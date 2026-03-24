import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScaleSet, ScaleNode, GamificationData } from '../../types'
import { callAI, isAIConfigured } from '../../utils/ai'
import { useStore } from '../../store'
import { checkBadges } from '../../utils/gamification'

// ─── Constants ──────────────────────────────────────────
const STORAGE_KEY = 'nous_micromacro_sets'
const SAVE_DEBOUNCE = 500

const MICROMACRO_XP: Record<string, number> = {
  create_first_set: 30,
  create_set: 15,
  add_node: 5,
  ai_fill_node: 8,
  complete_node: 20,
  explore_full_axis: 40,
  reach_micro_end: 15,
  reach_macro_end: 15,
  click_10_nodes: 25,
  link_nodes: 10,
  generate_ai_set: 35,
  import_set: 20,
}

const COLOR_SWATCHES = [
  '#06b6d4', '#a855f7', '#f59e0b', '#10b981',
  '#ef4444', '#3b82f6', '#ec4899', '#8b5cf6',
]

// ─── Helpers ────────────────────────────────────────────
function loadSets(): ScaleSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function createEmptyNode(overrides?: Partial<ScaleNode>): ScaleNode {
  return {
    id: generateId(),
    label: '',
    position: 50,
    emoji: '📌',
    color: '#06b6d4',
    summary: '',
    mechanism: '',
    mnemonic: '',
    analogy: '',
    fast_facts: [],
    tags: [],
    links_to: [],
    ai_generated: false,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

function createEmptySet(overrides?: Partial<ScaleSet>): ScaleSet {
  return {
    id: generateId(),
    name: '',
    course_id: null,
    subject: '',
    description: '',
    micro_label: 'Micro',
    macro_label: 'Macro',
    color_theme: COLOR_SWATCHES[Math.floor(Math.random() * COLOR_SWATCHES.length)],
    nodes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function isNodeComplete(n: ScaleNode): boolean {
  return !!(n.label && n.summary && n.mechanism && n.mnemonic && n.analogy && n.fast_facts.length > 0)
}

// ─── Toast helper ───────────────────────────────────────
function toast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) {
  window.dispatchEvent(new CustomEvent('nousai-toast', { detail: { message, type, duration } }))
}

// ─── Hook ───────────────────────────────────────────────
export function useMicroMacro() {
  const { data, updatePluginData, courses } = useStore()
  const [sets, setSets] = useState<ScaleSet[]>(loadSets)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTags, setFilterTags] = useState<string[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickCountRef = useRef(0)
  const exploredRangeRef = useRef({ min: 100, max: 0 })

  const activeSet = sets.find(s => s.id === activeSetId) ?? null
  const selectedNode = activeSet?.nodes.find(n => n.id === selectedNodeId) ?? null

  // Debounced save to localStorage
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sets))
    }, SAVE_DEBOUNCE)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [sets])

  // ─── XP Dispatch ──────────────────────────────────────
  const awardXP = useCallback((event: string) => {
    const amount = MICROMACRO_XP[event]
    if (!amount || !data) return
    const gam = data.pluginData.gamificationData
    const newXp = gam.xp + amount
    const updated: GamificationData = {
      ...gam,
      xp: newXp,
      level: Math.floor(newXp / 100) + 1,
      dailyGoal: { ...gam.dailyGoal, todayXp: gam.dailyGoal.todayXp + amount },
    }
    updated.badges = checkBadges(updated)
    updatePluginData({ gamificationData: updated })
    toast(`+${amount} XP`, 'success', 2000)
  }, [data, updatePluginData])

  // ─── Set CRUD ─────────────────────────────────────────
  const createSet = useCallback((overrides?: Partial<ScaleSet>) => {
    const isFirst = sets.length === 0
    const newSet = createEmptySet(overrides)
    setSets(prev => [...prev, newSet])
    setActiveSetId(newSet.id)
    awardXP('create_set')
    if (isFirst) awardXP('create_first_set')
    return newSet
  }, [sets.length, awardXP])

  const updateSet = useCallback((id: string, updates: Partial<ScaleSet>) => {
    setSets(prev => prev.map(s => s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s))
  }, [])

  const deleteSet = useCallback((id: string) => {
    setSets(prev => prev.filter(s => s.id !== id))
    if (activeSetId === id) { setActiveSetId(null); setSelectedNodeId(null) }
  }, [activeSetId])

  const duplicateSet = useCallback((id: string) => {
    const src = sets.find(s => s.id === id)
    if (!src) return
    const dup: ScaleSet = {
      ...src,
      id: generateId(),
      name: `${src.name} (copy)`,
      nodes: src.nodes.map(n => ({ ...n, id: generateId() })),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setSets(prev => [...prev, dup])
    toast('Set duplicated', 'success')
  }, [sets])

  // ─── Node CRUD ────────────────────────────────────────
  const addNode = useCallback((setId: string, overrides?: Partial<ScaleNode>) => {
    const node = createEmptyNode(overrides)
    setSets(prev => prev.map(s => s.id === setId
      ? { ...s, nodes: [...s.nodes, node], updated_at: new Date().toISOString() }
      : s
    ))
    awardXP('add_node')
    return node
  }, [awardXP])

  const updateNode = useCallback((setId: string, nodeId: string, updates: Partial<ScaleNode>) => {
    setSets(prev => prev.map(s => {
      if (s.id !== setId) return s
      const nodes = s.nodes.map(n => {
        if (n.id !== nodeId) return n
        const updated = { ...n, ...updates }
        if (!isNodeComplete(n) && isNodeComplete(updated)) {
          setTimeout(() => awardXP('complete_node'), 0)
        }
        return updated
      })
      return { ...s, nodes, updated_at: new Date().toISOString() }
    }))
  }, [awardXP])

  const deleteNode = useCallback((setId: string, nodeId: string) => {
    setSets(prev => prev.map(s => s.id === setId
      ? { ...s, nodes: s.nodes.filter(n => n.id !== nodeId), updated_at: new Date().toISOString() }
      : s
    ))
    if (selectedNodeId === nodeId) setSelectedNodeId(null)
  }, [selectedNodeId])

  const linkNodes = useCallback((setId: string, fromId: string, toId: string) => {
    setSets(prev => prev.map(s => {
      if (s.id !== setId) return s
      const nodes = s.nodes.map(n => {
        if (n.id === fromId && !n.links_to.includes(toId)) {
          return { ...n, links_to: [...n.links_to, toId] }
        }
        if (n.id === toId && !n.links_to.includes(fromId)) {
          return { ...n, links_to: [...n.links_to, fromId] }
        }
        return n
      })
      return { ...s, nodes, updated_at: new Date().toISOString() }
    }))
    awardXP('link_nodes')
  }, [awardXP])

  // ─── Exploration tracking ─────────────────────────────
  const trackPosition = useCallback((pos: number) => {
    exploredRangeRef.current.min = Math.min(exploredRangeRef.current.min, pos)
    exploredRangeRef.current.max = Math.max(exploredRangeRef.current.max, pos)
    if (pos <= 2) awardXP('reach_micro_end')
    if (pos >= 98) awardXP('reach_macro_end')
    if (exploredRangeRef.current.min <= 5 && exploredRangeRef.current.max >= 95) {
      awardXP('explore_full_axis')
    }
  }, [awardXP])

  const trackNodeClick = useCallback(() => {
    clickCountRef.current++
    if (clickCountRef.current === 10) awardXP('click_10_nodes')
  }, [awardXP])

  // ─── AI Functions ─────────────────────────────────────
  const aiFillNode = useCallback(async (setId: string, nodeId: string) => {
    if (!isAIConfigured()) { toast('AI not configured — go to Settings', 'warning'); return }
    const set = sets.find(s => s.id === setId)
    const node = set?.nodes.find(n => n.id === nodeId)
    if (!set || !node || !node.label) { toast('Node needs a label first', 'warning'); return }

    setAiLoading(true)
    try {
      const prompt = `Given the concept "${node.label}" in the context of "${set.subject || set.name}",
generate a JSON object with these fields:
{
  "summary": "1-2 sentence plain explanation",
  "mechanism": "how it works or why it matters, 2-3 sentences",
  "mnemonic": "a memorable hook or acronym",
  "analogy": "a real-world analogy in one sentence",
  "fast_facts": ["fact 1", "fact 2", "fact 3"]
}
Return only valid JSON. No markdown. No preamble.`
      const result = await callAI([{ role: 'user', content: prompt }], { json: true, temperature: 0.7 })
      const parsed = JSON.parse(result)
      updateNode(setId, nodeId, {
        summary: parsed.summary || '',
        mechanism: parsed.mechanism || '',
        mnemonic: parsed.mnemonic || '',
        analogy: parsed.analogy || '',
        fast_facts: Array.isArray(parsed.fast_facts) ? parsed.fast_facts : [],
        ai_generated: true,
      })
      awardXP('ai_fill_node')
      toast('AI filled node content', 'success')
    } catch (e: unknown) {
      toast(`AI error: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
    } finally {
      setAiLoading(false)
    }
  }, [sets, updateNode, awardXP])

  const aiSuggestPosition = useCallback(async (setId: string, label: string): Promise<number | null> => {
    if (!isAIConfigured()) { toast('AI not configured', 'warning'); return null }
    const set = sets.find(s => s.id === setId)
    if (!set) return null

    setAiLoading(true)
    try {
      const nodeList = set.nodes.map(n => `"${n.label}" at position ${n.position}`).join(', ')
      const prompt = `Given these existing nodes on a concept scale from 0 (most granular/micro) to 100 (most abstract/macro) for the subject "${set.subject || set.name}":
${nodeList || '(no existing nodes)'}
Where should "${label}" be positioned (0-100)?
Return only a single integer. No explanation.`
      const result = await callAI([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 10 })
      const pos = parseInt(result.trim(), 10)
      return isNaN(pos) ? 50 : Math.max(0, Math.min(100, pos))
    } catch {
      return null
    } finally {
      setAiLoading(false)
    }
  }, [sets])

  const aiGenerateSet = useCallback(async (subject: string, topic: string, microLabel: string, macroLabel: string, courseId: string | null): Promise<ScaleSet | null> => {
    if (!isAIConfigured()) { toast('AI not configured — go to Settings', 'warning'); return null }
    setAiLoading(true)
    try {
      const prompt = `Create a concept hierarchy for "${topic}" in "${subject}".
Generate 6-10 nodes placed on a scale from 0 (most granular) to 100 (most abstract/contextual).
The micro end (0) is "${microLabel}". The macro end (100) is "${macroLabel}".
Return ONLY valid JSON array matching this schema exactly:
[
  {
    "id": "unique_snake_case_id",
    "label": "Concept Name",
    "position": 0,
    "emoji": "single emoji",
    "summary": "1-2 sentences",
    "mechanism": "2-3 sentences on how/why",
    "mnemonic": "memory hook",
    "analogy": "one sentence real-world comparison",
    "fast_facts": ["up to 3 facts"],
    "tags": [],
    "links_to": ["id_of_related_node"]
  }
]
No markdown. No preamble. Valid JSON only.`
      const result = await callAI([{ role: 'user', content: prompt }], { json: true, temperature: 0.7 })
      const nodes: ScaleNode[] = JSON.parse(result).map((n: Record<string, unknown>) => ({
        id: generateId(),
        label: String(n.label || ''),
        position: Math.max(0, Math.min(100, Number(n.position) || 50)),
        emoji: String(n.emoji || '📌'),
        color: '#06b6d4',
        summary: String(n.summary || ''),
        mechanism: String(n.mechanism || ''),
        mnemonic: String(n.mnemonic || ''),
        analogy: String(n.analogy || ''),
        fast_facts: Array.isArray(n.fast_facts) ? n.fast_facts.map(String) : [],
        tags: Array.isArray(n.tags) ? n.tags.map(String) : [],
        links_to: [],
        ai_generated: true,
        created_at: new Date().toISOString(),
      }))

      // Resolve links_to by matching original IDs
      const origNodes = JSON.parse(result) as Record<string, unknown>[]
      const idMap = new Map<string, string>()
      origNodes.forEach((orig, i) => { idMap.set(String(orig.id || ''), nodes[i].id) })
      nodes.forEach((node, i) => {
        const origLinks = origNodes[i].links_to
        if (Array.isArray(origLinks)) {
          node.links_to = origLinks.map(l => idMap.get(String(l)) || '').filter(Boolean)
        }
      })

      const newSet = createEmptySet({
        name: topic,
        subject,
        course_id: courseId,
        micro_label: microLabel,
        macro_label: macroLabel,
        nodes,
      })
      setSets(prev => [...prev, newSet])
      setActiveSetId(newSet.id)
      awardXP('generate_ai_set')
      toast('AI generated scale set', 'success')
      return newSet
    } catch (e: unknown) {
      toast(`AI generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`, 'error')
      return null
    } finally {
      setAiLoading(false)
    }
  }, [awardXP])

  const aiFillAllNodes = useCallback(async (setId: string) => {
    const set = sets.find(s => s.id === setId)
    if (!set) return
    const incomplete = set.nodes.filter(n => n.label && !isNodeComplete(n))
    for (const node of incomplete) {
      await aiFillNode(setId, node.id)
    }
  }, [sets, aiFillNode])

  // ─── Import / Export ──────────────────────────────────
  const exportSet = useCallback((id: string) => {
    const set = sets.find(s => s.id === id)
    if (!set) return
    const blob = new Blob([JSON.stringify(set, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${set.name.replace(/[^a-zA-Z0-9]/g, '_')}.micromacro.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [sets])

  const importSet = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result as string) as ScaleSet
        if (!imported.name || !Array.isArray(imported.nodes)) {
          toast('Invalid MicroMacro file', 'error'); return
        }
        const newSet: ScaleSet = {
          ...imported,
          id: generateId(),
          nodes: imported.nodes.map(n => ({ ...n, id: generateId() })),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setSets(prev => [...prev, newSet])
        awardXP('import_set')
        toast('Set imported', 'success')
      } catch {
        toast('Failed to parse file', 'error')
      }
    }
    reader.readAsText(file)
  }, [awardXP])

  // ─── Filtering ────────────────────────────────────────
  const filteredNodes = activeSet ? activeSet.nodes.filter(n => {
    if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (filterTags.length > 0 && !filterTags.some(t => n.tags.includes(t))) return false
    return true
  }) : []

  const allTags = activeSet ? [...new Set(activeSet.nodes.flatMap(n => n.tags))] : []

  return {
    // Data
    sets,
    activeSet,
    activeSetId,
    selectedNode,
    selectedNodeId,
    courses,
    aiLoading,
    searchQuery,
    filterTags,
    filteredNodes,
    allTags,
    colorSwatches: COLOR_SWATCHES,
    aiConfigured: isAIConfigured(),

    // Set operations
    createSet,
    updateSet,
    deleteSet,
    duplicateSet,
    setActiveSetId,
    setSelectedNodeId,

    // Node operations
    addNode,
    updateNode,
    deleteNode,
    linkNodes,

    // AI
    aiFillNode,
    aiSuggestPosition,
    aiGenerateSet,
    aiFillAllNodes,

    // Tracking
    trackPosition,
    trackNodeClick,

    // Filter
    setSearchQuery,
    setFilterTags,

    // Import/Export
    exportSet,
    importSet,
  }
}

export { COLOR_SWATCHES, generateId, createEmptyNode, createEmptySet, isNodeComplete }
