import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, ChevronDown, RotateCcw, Shuffle, Layers, Play, Pause, Keyboard, Maximize, Minimize, Plus, X, Check, Pencil, Trash2, Download, Upload, Search, Settings2, FolderPlus, ClipboardCopy, Clock, BarChart3, Trophy, Target, Copy } from 'lucide-react'
import CardEditPanel from '../components/flashcards/CardEditPanel'
import FlashcardAnalytics from '../components/FlashcardAnalytics'
import { TooltipPopup, useTip } from '../components/Tooltip'
import { useStore } from '../store'
import type { FlashcardItem, Course, NousAIData } from '../types'
import { matchesShortcut, getShortcutKey, formatKey } from '../utils/shortcuts'
import { sanitizeHtml } from '../utils/sanitize'
import { exportFlashcardsAsAnki } from '../utils/exportFormats'
import { reviewCard, type FSRSCard, type Grade } from '../utils/fsrs'
import { loadFcFSRS, saveFcFSRS, loadDailyProgress, saveDailyProgress, type DailyProgress, todayDateStr } from '../utils/fsrsStorage'
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { SwipeableCard } from '../components/flashcards/SwipeableCard'
import FlashcardMedia from '../components/FlashcardMedia'
import { validateMedia, getYouTubeId, getYouTubeEmbedUrl } from '../utils/mediaUtils'
import type { FlashcardMedia as FlashcardMediaType } from '../utils/mediaUtils'

// ── FSRS helpers ──────────────────────────────────────────────
function fcCardKey(courseId: string, card: FlashcardItem): string {
  return `${courseId}::${card.front.slice(0, 50)}`
}

function initFcFSRSCard(key: string, card: FlashcardItem): FSRSCard {
  return {
    key, topic: card.topic || '', front: card.front, back: card.back,
    state: 'new', stability: 0, difficulty: 0, interval: 0,
    lapses: 0, reps: 0,
    lastReview: new Date().toISOString(),
    nextReview: new Date().toISOString(),
  }
}

function isFcCardDue(courseId: string, card: FlashcardItem, allFSRS: Record<string, FSRSCard>): boolean {
  const fc = allFSRS[fcCardKey(courseId, card)]
  return !fc || fc.state === 'new' || new Date(fc.nextReview).getTime() <= Date.now()
}

// ── Daily card cap ─────────────────────────────────────────────
const DEFAULT_CAP = 50

/** Inline helper: shows YouTube thumbnail or error for a URL string */
function YouTubeLivePreview({ url }: { url: string }) {
  if (!url) return null
  const videoId = (() => {
    const patterns = [
      /youtu\.be\/([^?&\s]+)/,
      /[?&]v=([^?&\s]+)/,
      /embed\/([^?&\s]+)/,
      /shorts\/([^?&\s]+)/,
    ]
    for (const p of patterns) {
      const m = url.match(p)
      if (m) return m[1]
    }
    return null
  })()
  if (!videoId) return <div style={{ fontSize: 11, color: 'var(--red, #ef4444)', marginTop: 4 }}>Invalid YouTube URL</div>
  return <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="preview" style={{ marginTop: 6, width: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 6, opacity: 0.85 }} />
}

function CreateFlashcardForm({ courses, data, setData, onDone }: {
  courses: Course[];
  data: NousAIData | null;
  setData: (d: NousAIData) => void;
  onDone: () => void;
}) {
  const { updatePluginData } = useStore()
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [courseId, setCourseId] = useState('')
  const [topic, setTopic] = useState('')
  const [saved, setSaved] = useState(false)

  // Media attachment state
  const [mediaType, setMediaType] = useState<'youtube' | 'image' | 'video' | null>(null)
  const [mediaSrc, setMediaSrc] = useState('')
  const [mediaCaption, setMediaCaption] = useState('')
  const [mediaSide, setMediaSide] = useState<'front' | 'back' | 'both'>('back')
  const [youtubeInput, setYoutubeInput] = useState('')
  const imageFileRef = useRef<HTMLInputElement>(null)
  const videoFileRef = useRef<HTMLInputElement>(null)

  // Get existing topics for selected course
  const existingTopics = useMemo(() => {
    const c = courses.find(c => c.id === courseId)
    const topics = new Set<string>()
    ;(c?.flashcards || []).forEach(f => { if (f.topic) topics.add(f.topic) })
    return Array.from(topics).sort()
  }, [courseId, courses])

  function clearMedia() {
    setMediaType(null)
    setMediaSrc('')
    setMediaCaption('')
    setYoutubeInput('')
    setMediaSide('back')
  }

  function handleFileToBase64(file: File, type: 'image' | 'video') {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      setMediaSrc(result)
      setMediaType(type)
    }
    reader.readAsDataURL(file)
  }

  const builtMedia: FlashcardMediaType | null = mediaType && mediaSrc
    ? { type: mediaType, src: mediaSrc, side: mediaSide, caption: mediaCaption || undefined }
    : null

  function handleSave() {
    if (!front.trim() || !back.trim() || !data) return

    const newCard: FlashcardItem = {
      front: front.trim(),
      back: back.trim(),
      ...(topic.trim() ? { topic: topic.trim() } : {}),
      ...(builtMedia ? { media: builtMedia } : {}),
    }
    const currentCourses = data.pluginData?.coachData?.courses || []

    let updatedCourses: Course[]

    if (courseId && courseId !== '_new') {
      updatedCourses = currentCourses.map(c =>
        c.id === courseId
          ? { ...c, flashcards: [...(c.flashcards || []), newCard] }
          : c
      )
    } else {
      const uncatIdx = currentCourses.findIndex(c => c.id === '_my_flashcards')
      if (uncatIdx >= 0) {
        updatedCourses = currentCourses.map(c =>
          c.id === '_my_flashcards'
            ? { ...c, flashcards: [...(c.flashcards || []), newCard] }
            : c
        )
      } else {
        const uncatCourse: Course = {
          id: '_my_flashcards',
          name: 'My Flashcards',
          shortName: 'My Cards',
          color: '#6366f1',
          topics: [],
          flashcards: [newCard],
        }
        updatedCourses = [...currentCourses, uncatCourse]
      }
    }

    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })

    setSaved(true)
    setFront('')
    setBack('')
    clearMedia()
    setTimeout(() => setSaved(false), 1500)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'inherit',
    outline: 'none',
  }

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer',
    fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
  }

  return (
    <div className="card mb-4" style={{ border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div style={{ fontSize: 14, fontWeight: 700 }}>
          <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Create Flashcard
        </div>
        <button className="btn-icon" onClick={onDone} title="Close">
          <X size={16} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Front (term / question)</label>
          <input
            type="text"
            value={front}
            onChange={e => setFront(e.target.value)}
            placeholder="Enter term or question..."
            style={inputStyle}
            autoFocus
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Back (definition / answer)</label>
          <textarea
            value={back}
            onChange={e => setBack(e.target.value)}
            placeholder="Enter definition or answer..."
            rows={3}
            style={{ ...inputStyle, resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Course</label>
            <select
              value={courseId}
              onChange={e => { setCourseId(e.target.value); setTopic('') }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">My Flashcards</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Topic / Folder (optional)</label>
            <input
              type="text"
              list="flashcard-topics"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="e.g. Chapter 5, Vocab..."
              style={inputStyle}
            />
            <datalist id="flashcard-topics">
              {existingTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        </div>

        {/* ── Attach Media ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Attach Media (optional)</div>
          {!mediaType ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btnStyle} onClick={() => { setMediaType('image'); setMediaSrc('') }}>
                Image
              </button>
              <button style={btnStyle} onClick={() => { setMediaType('youtube'); setMediaSrc('') }}>
                YouTube
              </button>
              <button style={btnStyle} onClick={() => { setMediaType('video'); setMediaSrc('') }}>
                Video File
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                  {mediaType === 'youtube' ? 'YouTube' : mediaType === 'image' ? 'Image' : 'Video'}
                </span>
                <button
                  onClick={clearMedia}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 4px' }}
                  title="Remove media"
                >
                  &times;
                </button>
              </div>

              {mediaType === 'youtube' && (
                <div>
                  <input
                    type="text"
                    placeholder="Paste YouTube URL..."
                    value={youtubeInput}
                    onChange={e => { setYoutubeInput(e.target.value); setMediaSrc(e.target.value.trim()) }}
                    style={{ ...inputStyle, fontSize: 12 }}
                  />
                  <YouTubeLivePreview url={mediaSrc} />
                </div>
              )}

              {mediaType === 'image' && (
                <div>
                  <input
                    ref={imageFileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileToBase64(f, 'image') }}
                  />
                  <button style={btnStyle} onClick={() => imageFileRef.current?.click()}>
                    Choose Image File
                  </button>
                  {mediaSrc && (
                    <img src={mediaSrc} alt="preview" style={{ marginTop: 6, width: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 6 }} />
                  )}
                </div>
              )}

              {mediaType === 'video' && (
                <div>
                  <input
                    ref={videoFileRef}
                    type="file"
                    accept="video/*"
                    style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileToBase64(f, 'video') }}
                  />
                  <button style={btnStyle} onClick={() => videoFileRef.current?.click()}>
                    Choose Video File
                  </button>
                  {mediaSrc && (
                    <video src={mediaSrc} controls style={{ marginTop: 6, width: '100%', maxHeight: 120, borderRadius: 6 }} />
                  )}
                </div>
              )}

              {/* Caption + side */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  placeholder="Caption (optional)..."
                  value={mediaCaption}
                  onChange={e => setMediaCaption(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                />
                <select
                  value={mediaSide}
                  onChange={e => setMediaSide(e.target.value as 'front' | 'back' | 'both')}
                  style={{ ...inputStyle, width: 'auto', fontSize: 12, cursor: 'pointer' }}
                >
                  <option value="back">Show on back</option>
                  <option value="front">Show on front</option>
                  <option value="both">Show on both</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <button
          className="btn btn-primary btn-sm"
          onClick={handleSave}
          disabled={!front.trim() || !back.trim()}
          style={{ alignSelf: 'flex-start' }}
        >
          {saved ? <><Check size={14} /> Saved!</> : <><Plus size={14} /> Add Card</>}
        </button>
      </div>
    </div>
  )
}

/* ── Manage Mode: list all cards with search, sort, inline edit, delete ── */
function ManageFlashcards({ courses, data, setData }: {
  courses: Course[];
  data: NousAIData | null;
  setData: (d: NousAIData) => void;
}) {
  const { updatePluginData } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'course' | 'front-az' | 'back-az'>('course')
  const [filterCourse, setFilterCourse] = useState<string>('all')
  const [filterTopic, setFilterTopic] = useState<string>('all')
  const [editKey, setEditKey] = useState<string | null>(null) // "courseId:cardIndex"
  const [editFront, setEditFront] = useState('')
  const [editBack, setEditBack] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showMoveDropdown, setShowMoveDropdown] = useState(false)
  // Panel edit state — opens CardEditPanel bottom sheet
  const [panelCardKey, setPanelCardKey] = useState<string | null>(null) // "courseId:cardIndex"

  // Build a flat list of all cards with metadata
  const allCards = useMemo(() => {
    const cards: { front: string; back: string; topic: string; courseName: string; courseId: string; courseColor: string; cardIndex: number }[] = []
    courses.forEach(c => {
      (c.flashcards || []).forEach((fc, idx) => {
        cards.push({
          front: fc.front,
          back: fc.back,
          topic: fc.topic || '',
          courseName: c.shortName || c.name,
          courseId: c.id,
          courseColor: c.color,
          cardIndex: idx,
        })
      })
    })
    return cards
  }, [courses])

  // Filter
  const filtered = useMemo(() => {
    let result = allCards
    if (filterCourse !== 'all') {
      result = result.filter(c => c.courseId === filterCourse)
    }
    if (filterTopic !== 'all') {
      result = result.filter(c => c.topic === filterTopic)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(c =>
        c.front.toLowerCase().includes(q) ||
        c.back.toLowerCase().includes(q) ||
        c.courseName.toLowerCase().includes(q) ||
        c.topic.toLowerCase().includes(q)
      )
    }
    return result
  }, [allCards, searchQuery, filterCourse, filterTopic])

  // Unique courses for filter dropdown
  const courseOptions = useMemo(() => {
    const seen = new Map<string, string>()
    allCards.forEach(c => { if (!seen.has(c.courseId)) seen.set(c.courseId, c.courseName) })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [allCards])

  // Topics for the selected course (or all courses if 'all')
  const topicOptions = useMemo(() => {
    const base = filterCourse === 'all' ? allCards : allCards.filter(c => c.courseId === filterCourse)
    const topics = new Set<string>()
    base.forEach(c => { if (c.topic) topics.add(c.topic) })
    return Array.from(topics).sort()
  }, [allCards, filterCourse])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered]
    switch (sortBy) {
      case 'front-az': arr.sort((a, b) => a.front.localeCompare(b.front)); break
      case 'back-az': arr.sort((a, b) => a.back.localeCompare(b.back)); break
      case 'course': arr.sort((a, b) => a.courseName.localeCompare(b.courseName)); break
    }
    return arr
  }, [filtered, sortBy])

  function startEdit(card: typeof allCards[0]) {
    const key = `${card.courseId}:${card.cardIndex}`
    setEditKey(key)
    setEditFront(card.front)
    setEditBack(card.back)
  }

  function saveEdit() {
    if (!editKey || !data) return
    const [courseId, idxStr] = editKey.split(':')
    const cardIndex = parseInt(idxStr, 10)
    const currentCourses = data.pluginData?.coachData?.courses || []
    const updatedCourses = currentCourses.map(c => {
      if (c.id !== courseId) return c
      const newCards = [...(c.flashcards || [])]
      if (newCards[cardIndex]) {
        newCards[cardIndex] = { ...newCards[cardIndex], front: editFront.trim(), back: editBack.trim() }
      }
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    setEditKey(null)
  }

  function deleteCard(courseId: string, cardIndex: number) {
    if (!data) return
    const currentCourses = data.pluginData?.coachData?.courses || []
    const updatedCourses = currentCourses.map(c => {
      if (c.id !== courseId) return c
      const newCards = [...(c.flashcards || [])]
      newCards.splice(cardIndex, 1)
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    if (editKey === `${courseId}:${cardIndex}`) setEditKey(null)
    selected.delete(`${courseId}:${cardIndex}`)
    setSelected(new Set(selected))
  }

  function toggleSelect(key: string) {
    const next = new Set(selected)
    if (next.has(key)) next.delete(key); else next.add(key)
    setSelected(next)
  }

  function toggleSelectAll() {
    if (selected.size === sorted.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sorted.map(c => `${c.courseId}:${c.cardIndex}`)))
    }
  }

  function bulkDelete() {
    if (!data || selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected card${selected.size > 1 ? 's' : ''}? This cannot be undone.`)) return
    // Group deletions by course, sort indices descending to splice safely
    const deletions: Record<string, number[]> = {}
    selected.forEach(key => {
      const [courseId, idxStr] = key.split(':')
      if (!deletions[courseId]) deletions[courseId] = []
      deletions[courseId].push(parseInt(idxStr, 10))
    })
    const currentCourses = data.pluginData?.coachData?.courses || []
    const updatedCourses = currentCourses.map(c => {
      if (!deletions[c.id]) return c
      const indices = deletions[c.id].sort((a, b) => b - a) // descending
      const newCards = [...(c.flashcards || [])]
      indices.forEach(idx => newCards.splice(idx, 1))
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    setSelected(new Set())
    setEditKey(null)
  }

  function bulkMove(targetCourseId: string) {
    if (!data || selected.size === 0 || !targetCourseId) return
    // Collect cards to move grouped by source course
    const moves: Record<string, number[]> = {}
    selected.forEach(key => {
      const [courseId, idxStr] = key.split(':')
      if (courseId === targetCourseId) return // skip cards already in target
      if (!moves[courseId]) moves[courseId] = []
      moves[courseId].push(parseInt(idxStr, 10))
    })
    if (Object.keys(moves).length === 0) { setShowMoveDropdown(false); return }
    const currentCourses = data.pluginData?.coachData?.courses || []
    // Collect cards being moved (ascending index order per source course)
    const cardsToAdd: { front: string; back: string }[] = []
    Object.entries(moves).forEach(([courseId, indices]) => {
      const course = currentCourses.find(c => c.id === courseId)
      if (!course) return
      indices.sort((a, b) => a - b).forEach(idx => {
        const fc = (course.flashcards || [])[idx]
        if (fc) cardsToAdd.push({ front: fc.front, back: fc.back })
      })
    })
    // Remove from sources (splice descending), add to target
    const updatedCourses = currentCourses.map(c => {
      if (c.id === targetCourseId) {
        return { ...c, flashcards: [...(c.flashcards || []), ...cardsToAdd] }
      }
      if (!moves[c.id]) return c
      const indices = moves[c.id].sort((a, b) => b - a)
      const newCards = [...(c.flashcards || [])]
      indices.forEach(idx => newCards.splice(idx, 1))
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    setSelected(new Set())
    setEditKey(null)
    setShowMoveDropdown(false)
  }

  // Save card via CardEditPanel (full edit: front, back, topic, media)
  function handlePanelSave(updated: FlashcardItem) {
    if (!panelCardKey || !data) return
    const [courseId, idxStr] = panelCardKey.split(':')
    const cardIndex = parseInt(idxStr, 10)
    const currentCourses = data.pluginData?.coachData?.courses || []
    const updatedCourses = currentCourses.map(c => {
      if (c.id !== courseId) return c
      const newCards = [...(c.flashcards || [])]
      if (newCards[cardIndex]) newCards[cardIndex] = updated
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    setPanelCardKey(null)
  }

  // Duplicate a card — inserts a copy immediately after the original
  function duplicateCard(courseId: string, cardIndex: number) {
    if (!data) return
    const currentCourses = data.pluginData?.coachData?.courses || []
    const updatedCourses = currentCourses.map(c => {
      if (c.id !== courseId) return c
      const newCards = [...(c.flashcards || [])]
      const original = newCards[cardIndex]
      if (!original) return c
      newCards.splice(cardIndex + 1, 0, { ...original })
      return { ...c, flashcards: newCards }
    })
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div>
      {/* Search, filter, and sort bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search cards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 30 }}
          />
        </div>
        {courseOptions.length > 1 && (
          <select
            value={filterCourse}
            onChange={e => { setFilterCourse(e.target.value); setFilterTopic('all'); setSelected(new Set()); }}
            style={{ ...inputStyle, width: 'auto', minWidth: 120, cursor: 'pointer' }}
          >
            <option value="all">All Courses</option>
            {courseOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {topicOptions.length > 0 && (
          <select
            value={filterTopic}
            onChange={e => { setFilterTopic(e.target.value); setSelected(new Set()); }}
            style={{ ...inputStyle, width: 'auto', minWidth: 130, cursor: 'pointer' }}
          >
            <option value="all">All Topics</option>
            {topicOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          style={{ ...inputStyle, width: 'auto', minWidth: 120, cursor: 'pointer' }}
        >
          <option value="course">Sort: Course</option>
          <option value="front-az">Sort: Front A-Z</option>
          <option value="back-az">Sort: Back A-Z</option>
        </select>
      </div>

      {/* Bulk actions bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={sorted.length > 0 && selected.size === sorted.length}
            onChange={toggleSelectAll}
            style={{ accentColor: 'var(--accent, #6366f1)', width: 16, height: 16, cursor: 'pointer' }}
          />
          Select All
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {selected.size > 0 ? `${selected.size} selected` : `${sorted.length} of ${allCards.length} cards`}
        </span>
        {selected.size > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowMoveDropdown(v => !v)}
                className="btn btn-sm"
                style={{ fontWeight: 600 }}
              >
                Move {selected.size} to…
              </button>
              {showMoveDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', minWidth: 180, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                }}>
                  {courseOptions.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text-muted)' }}>No other decks</div>
                  ) : courseOptions.map(c => (
                    <button
                      key={c.id}
                      onClick={() => bulkMove(c.id)}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '8px 12px', background: 'none', border: 'none',
                        cursor: 'pointer', fontSize: 13, color: 'var(--text)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #f3f4f6)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={bulkDelete}
              className="btn btn-sm"
              style={{ color: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)', fontWeight: 700 }}
            >
              <Trash2 size={13} /> Delete {selected.size}
            </button>
          </div>
        )}
      </div>

      {/* Card list */}
      {sorted.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          {allCards.length === 0 ? 'No flashcards yet.' : 'No cards match your search.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((card, i) => {
            const key = `${card.courseId}:${card.cardIndex}`
            const isEditing = editKey === key

            return (
              <div
                key={`${key}-${i}`}
                className="card"
                style={{
                  borderLeft: `3px solid ${selected.has(key) ? 'var(--accent, #6366f1)' : card.courseColor}`,
                  padding: '12px 14px',
                  position: 'relative',
                  background: selected.has(key) ? 'var(--accent, #6366f1)08' : undefined,
                }}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={editFront}
                      onChange={e => setEditFront(e.target.value)}
                      style={inputStyle}
                      autoFocus
                      placeholder="Front..."
                    />
                    <textarea
                      value={editBack}
                      onChange={e => setEditBack(e.target.value)}
                      style={{ ...inputStyle, resize: 'vertical' }}
                      rows={2}
                      placeholder="Back..."
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={saveEdit} disabled={!editFront.trim() || !editBack.trim()}>
                        <Check size={13} /> Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditKey(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggleSelect(key)}
                      style={{ accentColor: 'var(--accent, #6366f1)', width: 16, height: 16, cursor: 'pointer', marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, wordBreak: 'break-word' }}>{card.front}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{card.back}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            className="btn-icon"
                            onClick={() => setPanelCardKey(key)}
                            title="Edit card (full editor)"
                            style={{ width: 28, height: 28 }}
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => duplicateCard(card.courseId, card.cardIndex)}
                            title="Duplicate card"
                            style={{ width: 28, height: 28 }}
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => deleteCard(card.courseId, card.cardIndex)}
                            title="Delete card"
                            style={{ width: 28, height: 28, color: 'var(--red, #ef4444)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span style={{
                          display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px',
                          borderRadius: 99, background: `${card.courseColor}18`, color: card.courseColor,
                          border: `1px solid ${card.courseColor}30`,
                        }}>
                          {card.courseName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Full card editor panel (media, topic, paste images) */}
      <CardEditPanel
        isOpen={panelCardKey !== null}
        card={(() => {
          if (!panelCardKey) return null
          const [courseId, idxStr] = panelCardKey.split(':')
          const course = courses.find(c => c.id === courseId)
          return course?.flashcards[parseInt(idxStr, 10)] ?? null
        })()}
        onSave={handlePanelSave}
        onClose={() => setPanelCardKey(null)}
        title="Edit Card"
      />
    </div>
  )
}

/* ── Bulk Import ── */
function BulkImport({ courses, data, setData }: {
  courses: Course[];
  data: NousAIData | null;
  setData: (d: NousAIData) => void;
}) {
  const { updatePluginData } = useStore()
  const [courseId, setCourseId] = useState('')
  const [importTopic, setImportTopic] = useState('')
  const [importText, setImportText] = useState('')
  const [result, setResult] = useState<{ count: number; withMedia: number; invalidMedia: number; error?: string } | null>(null)
  const [promptMenuOpen, setPromptMenuOpen] = useState(false)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [customPromptText, setCustomPromptText] = useState('')
  const [showCustomEditor, setShowCustomEditor] = useState(false)

  function getCourseName() {
    return courseId
      ? (courses.find(c => c.id === courseId)?.shortName || courses.find(c => c.id === courseId)?.name || 'this course')
      : 'general study'
  }

  const promptTemplates = [
    {
      id: 'basic',
      label: 'Basic Q&A',
      description: 'Simple question / answer pairs',
      buildPrompt: () => {
        const topicStr = importTopic.trim() ? ` on "${importTopic.trim()}"` : ''
        return `Generate flashcards for ${getCourseName()}${topicStr}. Output ONLY a JSON array, no markdown, no extra text.\nEach object: {"front": "question", "back": "structured answer"}\nMake 15-20 cards covering key concepts.\n\nFor the "back" field, use pipe-separated labeled sections where helpful. Supported labels: MNEMONIC, STEPS, WHY, KEY POINT, NORMAL, SIGNS, CAUSES, RULE.\nFormat: "LABEL: content | LABEL: content"\nFor STEPS use numbered items: "STEPS: 1) first 2) second 3) third"\nSimple answers can be plain text without labels.\n\nExample:\n[{"front": "What are the steps to take a manual blood pressure?", "back": "MNEMONIC: 'Place Inflate Listen Note' | STEPS: 1) Place cuff 1 inch above elbow 2) Inflate 30 mmHg above systolic 3) Listen for Korotkoff sounds 4) Note systolic and diastolic | WHY: Deflating too fast misses the reading"},{"front": "What is the normal resting heart rate for adults?", "back": "NORMAL: 60–100 bpm | KEY POINT: Below 60 = bradycardia, above 100 = tachycardia"}]`
      },
    },
    {
      id: 'vocab',
      label: 'Vocabulary / Terms',
      description: 'Term on front, definition on back',
      buildPrompt: () => {
        const topicStr = importTopic.trim() ? ` related to "${importTopic.trim()}"` : ''
        return `Generate vocabulary flashcards for ${getCourseName()}${topicStr}. Output ONLY a JSON array, no markdown.\nEach object: {"front": "term", "back": "structured definition"}\nMake 20-25 key terms.\n\nFor the "back" field, use pipe-separated labeled sections. Supported labels: DEFINITION, NORMAL, SIGNS, CAUSES, MNEMONIC, KEY POINT, NOTE.\nFormat: "LABEL: content | LABEL: content"\nSimple one-line definitions can be plain text.\n\nExample:\n[{"front": "Tachycardia", "back": "DEFINITION: Heart rate above 100 bpm | CAUSES: Pain, fever, dehydration, anxiety, medications | KEY POINT: Always assess patient — rate alone doesn't determine severity"},{"front": "Dyspnea", "back": "DEFINITION: Difficult or labored breathing | SIGNS: Accessory muscle use, nasal flaring, tripod position | NOTE: Always position patient upright"}]`
      },
    },
    {
      id: 'scenario',
      label: 'Clinical / Scenario',
      description: 'Situation-based cards with rationale',
      buildPrompt: () => {
        const topicStr = importTopic.trim() ? ` for "${importTopic.trim()}"` : ''
        return `Generate scenario-based flashcards for ${getCourseName()}${topicStr}. Output ONLY a JSON array, no markdown.\nEach object: {"front": "brief patient scenario or situation", "back": "structured response with steps and rationale"}\nMake 12-15 cards.\n\nFor the "back" field, use pipe-separated labeled sections. Supported labels: STEPS, WHY, KEY POINT, PRIORITY, REPORT, NOTE.\nFormat: "LABEL: content | LABEL: content"\nFor STEPS use numbered items: "STEPS: 1) first 2) second"\n\nExample:\n[{"front": "A patient's blood pressure is 180/110 mmHg and they are asymptomatic. What do you do?", "back": "STEPS: 1) Stay calm and reassess in 5 minutes 2) Do NOT leave patient alone 3) Report to nurse immediately | WHY: Hypertensive urgency — dangerous even without symptoms | KEY POINT: CNAs do not treat, only observe and report"}]`
      },
    },
    {
      id: 'youtube',
      label: 'With YouTube Media',
      description: 'Includes a YouTube video on the back',
      buildPrompt: () => {
        const topicStr = importTopic.trim() ? ` on "${importTopic.trim()}"` : ''
        return `Generate flashcards for ${getCourseName()}${topicStr} that each include a YouTube video. Output ONLY a JSON array, no markdown.\nEach object: {"front": "question or term", "back": "structured answer", "youtube": "REAL_YOUTUBE_URL"}\nReplace REAL_YOUTUBE_URL with a real, relevant YouTube video URL for each card. Make 10-15 cards.\n\nFor the "back" field, use pipe-separated labeled sections where helpful. Supported labels: STEPS, WHY, MNEMONIC, KEY POINT, NOTE, NORMAL.\nFormat: "LABEL: content | LABEL: content"\nFor STEPS use numbered items: "STEPS: 1) first 2) second"\n\nExample:\n[{"front": "How do you measure blood pressure manually?", "back": "STEPS: 1) Place cuff 1 inch above elbow 2) Inflate 30 mmHg above palpated systolic 3) Deflate at 2–3 mmHg/sec 4) Note first and last Korotkoff sound | WHY: Deflating too fast gives inaccurate readings", "youtube": "https://www.youtube.com/watch?v=AbcXyzExample"}]`
      },
    },
    {
      id: 'custom',
      label: 'Custom',
      description: 'Write your own prompt',
      buildPrompt: () => customPromptText,
    },
  ]

  function copyPrompt(id: string) {
    const template = promptTemplates.find(t => t.id === id)
    if (!template) return
    if (id === 'custom') {
      if (!showCustomEditor) {
        const topicStr = importTopic.trim() ? ` on "${importTopic.trim()}"` : ''
        if (!customPromptText) {
          setCustomPromptText(`Generate flashcards for ${getCourseName()}${topicStr}. Output ONLY a JSON array.\nEach object: {"front": "...", "back": "..."}\n`)
        }
        setShowCustomEditor(true)
        setPromptMenuOpen(false)
      } else {
        navigator.clipboard.writeText(customPromptText).then(() => {
          setCopiedType('custom')
          setTimeout(() => setCopiedType(null), 2000)
        })
      }
      return
    }
    const prompt = template.buildPrompt()
    navigator.clipboard.writeText(prompt).then(() => {
      setCopiedType(id)
      setPromptMenuOpen(false)
      setTimeout(() => setCopiedType(null), 2000)
    })
  }

  const existingTopics = useMemo(() => {
    const c = courses.find(c => c.id === courseId)
    const topics = new Set<string>()
    ;(c?.flashcards || []).forEach(f => { if (f.topic) topics.add(f.topic) })
    return Array.from(topics).sort()
  }, [courseId, courses])

  function handleImport() {
    if (!data || !importText.trim()) return
    setResult(null)

    let cards: FlashcardItem[] = []
    const text = importText.trim()
    const topicTag = importTopic.trim() || undefined
    let withMedia = 0
    let invalidMedia = 0

    // Try JSON format first
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed)) { setResult({ count: 0, withMedia: 0, invalidMedia: 0, error: 'JSON must be an array.' }); return }
        for (const item of parsed) {
          if (typeof item.front === 'string' && typeof item.back === 'string' && item.front.trim() && item.back.trim()) {
            const card: FlashcardItem = { front: item.front.trim(), back: item.back.trim(), ...(topicTag ? { topic: topicTag } : {}) }
            // Handle shorthand youtube field
            const rawMedia = item.media ?? (item.youtube ? { type: 'youtube', src: item.youtube, side: 'back' } : undefined)
            if (rawMedia !== undefined) {
              const validated = validateMedia(rawMedia)
              if (validated) {
                card.media = validated
                withMedia++
              } else {
                invalidMedia++
              }
            }
            cards.push(card)
          }
        }
        if (cards.length === 0 && parsed.length > 0) {
          setResult({ count: 0, withMedia: 0, invalidMedia: 0, error: 'No valid cards found. Each item needs "front" and "back" string fields.' })
          return
        }
      } catch {
        setResult({ count: 0, withMedia: 0, invalidMedia: 0, error: 'Invalid JSON. Check your syntax.' })
        return
      }
    } else {
      // Try :: delimited format (one card per line)
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      for (const line of lines) {
        const sep = line.indexOf('::')
        if (sep > 0) {
          const front = line.substring(0, sep).trim()
          const back = line.substring(sep + 2).trim()
          if (front && back) cards.push({ front, back, ...(topicTag ? { topic: topicTag } : {}) })
        }
      }
      if (cards.length === 0) {
        setResult({ count: 0, withMedia: 0, invalidMedia: 0, error: 'No valid cards found. Use "Term :: Definition" format (one per line) or JSON array.' })
        return
      }
    }

    // Add cards to the selected course
    const currentCourses = data.pluginData?.coachData?.courses || []
    let updatedCourses: Course[]
    const targetId = courseId || '_my_flashcards'

    if (targetId && currentCourses.some(c => c.id === targetId)) {
      updatedCourses = currentCourses.map(c =>
        c.id === targetId
          ? { ...c, flashcards: [...(c.flashcards || []), ...cards] }
          : c
      )
    } else {
      // Create "My Flashcards" course
      const newCourse: Course = {
        id: '_my_flashcards',
        name: 'My Flashcards',
        shortName: 'My Cards',
        color: '#6366f1',
        topics: [],
        flashcards: cards,
      }
      updatedCourses = [...currentCourses, newCourse]
    }

    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })

    setResult({ count: cards.length, withMedia, invalidMedia })
    setImportText('')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  }

  return (
    <div className="card mb-4" style={{ border: '1px solid var(--border)' }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
        <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        Bulk Import
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Import to course</label>
            <select
              value={courseId}
              onChange={e => { setCourseId(e.target.value); setImportTopic('') }}
              style={{ ...inputStyle, cursor: 'pointer' }}
            >
              <option value="">My Flashcards</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Topic / Folder (optional)</label>
            <input
              type="text"
              list="import-topics"
              value={importTopic}
              onChange={e => setImportTopic(e.target.value)}
              placeholder="e.g. Chapter 5..."
              style={inputStyle}
            />
            <datalist id="import-topics">
              {existingTopics.map(t => <option key={t} value={t} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
            Paste cards (JSON or Term :: Definition format)
          </label>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            rows={8}
            placeholder={`JSON format:\n[{"front": "Term", "back": "Definition"}, ...]\n\nOr simple format (one per line):\nTerm 1 :: Definition 1\nTerm 2 :: Definition 2`}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleImport}
            disabled={!importText.trim()}
          >
            <Upload size={14} /> Import Cards
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPromptMenuOpen(o => !o)}
              title="Copy an AI prompt to generate flashcards"
            >
              <ClipboardCopy size={14} /> {copiedType ? 'Copied!' : 'AI Prompt'} <ChevronDown size={12} style={{ marginLeft: 2 }} />
            </button>
            {promptMenuOpen && (
              <div style={{
                position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, zIndex: 50,
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px #0006',
                minWidth: 230, padding: '4px 0',
              }}>
                {promptTemplates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => copyPrompt(t.id)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '8px 14px', background: 'none', border: 'none',
                      color: copiedType === t.id ? 'var(--accent)' : 'var(--text-primary)',
                      cursor: 'pointer', fontSize: 13,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover, #ffffff10)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span style={{ fontWeight: 600 }}>{t.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{t.description}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {showCustomEditor && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Custom prompt — edit then click Copy:</div>
            <textarea
              value={customPromptText}
              onChange={e => setCustomPromptText(e.target.value)}
              rows={5}
              style={{ ...inputStyle, resize: 'vertical', fontSize: 12, fontFamily: 'monospace' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => copyPrompt('custom')}>
                <ClipboardCopy size={13} /> {copiedType === 'custom' ? 'Copied!' : 'Copy Custom Prompt'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCustomEditor(false)} style={{ color: 'var(--text-muted)' }}>
                Dismiss
              </button>
            </div>
          </div>
        )}

        {result && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13,
            background: result.error ? 'var(--red, #ef4444)15' : 'var(--green, #22c55e)15',
            border: `1px solid ${result.error ? 'var(--red, #ef4444)' : 'var(--green, #22c55e)'}30`,
            color: result.error ? 'var(--red, #ef4444)' : 'var(--green, #22c55e)',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            {result.error ? result.error : (
              <>
                <span>Successfully imported {result.count} card{result.count !== 1 ? 's' : ''}!</span>
                {result.withMedia > 0 && <span style={{ fontSize: 11 }}>{result.withMedia} card{result.withMedia !== 1 ? 's' : ''} with media attached</span>}
                {result.invalidMedia > 0 && <span style={{ fontSize: 11, color: 'var(--orange, #f97316)' }}>{result.invalidMedia} card{result.invalidMedia !== 1 ? 's' : ''} had invalid media (media skipped, text kept)</span>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Export All Flashcards ── */
function ExportButton({ courses }: { courses: Course[] }) {
  function handleExport() {
    const allCards: { front: string; back: string; course: string }[] = []
    courses.forEach(c => {
      (c.flashcards || []).forEach(fc => {
        allCards.push({ front: fc.front, back: fc.back, course: c.shortName || c.name })
      })
    })
    const json = JSON.stringify(allCards, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `flashcards-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalCards = courses.reduce((sum, c) => sum + (c.flashcards?.length || 0), 0)
  if (totalCards === 0) return null

  return (
    <button className="btn btn-secondary btn-sm" onClick={handleExport} title="Export all flashcards as JSON">
      <Download size={14} /> Export ({totalCards})
    </button>
  )
}

export default function Flashcards() {
  const { loaded, courses, data, setData, updatePluginData, matchSets, setPageContext } = useStore()
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null) // null=browse topics, string=study that topic
  const [showCreate, setShowCreate] = useState(false)
  const [mode, setMode] = useState<'study' | 'manage' | 'analytics'>('study')
  const [showImport, setShowImport] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#3b82f6')
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(loadDailyProgress)
  const { tip: analyticsTip, show: showTip, move: moveTip, hide: hideTip } = useTip()

  // Per-course daily cap helpers
  const caps = useMemo(() => (data?.settings?.courseCardCaps as Record<string, number>) ?? {}, [data])
  const getCap = useCallback((courseId: string) => caps[courseId] ?? DEFAULT_CAP, [caps])

  const handleCardReviewed = useCallback((reviewedCourseId: string) => {
    setDailyProgress(prev => {
      const updated: DailyProgress = {
        date: todayDateStr(),
        counts: { ...prev.counts, [reviewedCourseId]: (prev.counts[reviewedCourseId] || 0) + 1 },
      }
      saveDailyProgress(updated)
      return updated
    })
  }, [])

  const saveCap = useCallback((courseId: string, newCap: number) => {
    if (!data) return
    const current = (data.settings.courseCardCaps as Record<string, number>) ?? {}
    setData({ ...data, settings: { ...data.settings, courseCardCaps: { ...current, [courseId]: newCap } } })
  }, [data, setData])

  // Gather all flashcards (must be before any conditional returns — Rules of Hooks)
  const allCards = useMemo(() => {
    const cards: (FlashcardItem & { course: string; color: string; courseId: string })[] = []
    courses.forEach(c => {
      c.flashcards?.forEach(fc => {
        cards.push({ ...fc, course: c.shortName || c.name, color: c.color, courseId: c.id })
      })
    })
    return cards
  }, [courses])

  // Per-course due counts (uncapped)
  const courseDueMap = useMemo(() => {
    const allFSRS = loadFcFSRS()
    const map: Record<string, number> = {}
    courses.forEach(c => {
      map[c.id] = (c.flashcards || []).filter(fc => isFcCardDue(c.id, fc, allFSRS)).length
    })
    return map
  }, [courses])

  // Total due after applying per-course daily caps
  const dueCount = useMemo(() => {
    return Object.entries(courseDueMap).reduce((sum, [cId, count]) => {
      const remaining = Math.max(0, getCap(cId) - (dailyProgress.counts[cId] || 0))
      return sum + Math.min(count, remaining)
    }, 0)
  }, [courseDueMap, getCap, dailyProgress])

  // Publish page context for Flashcards page
  useEffect(() => {
    if (!selectedCourse) {
      setPageContext({ page: 'Flashcards', summary: 'No deck selected' })
      return () => setPageContext(null)
    }
    const allFSRS = loadFcFSRS()
    const allCards = selectedCourse.flashcards ?? []
    const dueCount = allCards.filter(c => isFcCardDue(selectedCourse.id, c, allFSRS)).length

    setPageContext({
      page: 'Flashcards',
      summary: `Reviewing: ${selectedCourse.name} — ${dueCount} cards due`,
      fullContent: allCards.slice(0, 20).map(c => `Q: ${c.front}\nA: ${c.back}`).join('\n\n'),
    })
    return () => setPageContext(null)
  }, [selectedCourse, setPageContext])

  function createFolder() {
    if (!newFolderName.trim() || !data) return
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    const newCourse: Course = {
      id,
      name: newFolderName.trim(),
      shortName: newFolderName.trim().substring(0, 12),
      color: newFolderColor,
      topics: [],
      flashcards: [],
    }
    const updatedCourses = [...(data.pluginData.coachData?.courses || []), newCourse]
    updatePluginData({ coachData: { ...data.pluginData.coachData, courses: updatedCourses } })
    setNewFolderName('')
    setNewFolderColor('#3b82f6')
    setShowNewFolder(false)
  }

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading flashcards...</div>
      </div>
    )
  }

  // Study mode: reviewing a specific topic within a course
  if (selectedCourse && selectedTopic !== null) {
    const topicCards = selectedTopic === '_all'
      ? (selectedCourse.flashcards || [])
      : (selectedCourse.flashcards || []).filter(f => (f.topic || 'Uncategorized') === selectedTopic)
    return <FlashcardReview cards={topicCards} courseId={selectedCourse.id} title={`${selectedCourse.shortName || selectedCourse.name} — ${selectedTopic === '_all' ? 'All' : selectedTopic}`} onBack={() => setSelectedTopic(null)} onCardReviewed={handleCardReviewed} />
  }

  // Study mode: browsing topics within a course
  if (selectedCourse) {
    const cards = selectedCourse.flashcards || []
    const topicMap = new Map<string, FlashcardItem[]>()
    cards.forEach(f => {
      const t = f.topic || 'Uncategorized'
      if (!topicMap.has(t)) topicMap.set(t, [])
      topicMap.get(t)!.push(f)
    })
    // Only show named topics — filter out the catch-all 'Uncategorized' bucket
    const topics = Array.from(topicMap.entries())
      .filter(([name]) => name !== 'Uncategorized')
      .sort((a, b) => a[0].localeCompare(b[0]))

    // No named topics (or empty course) → go straight to review
    if (topics.length === 0) {
      return <FlashcardReview cards={cards} courseId={selectedCourse.id} title={selectedCourse.shortName || selectedCourse.name} onBack={() => setSelectedCourse(null)} onCardReviewed={handleCardReviewed} />
    }

    return (
      <div className="animate-in">
        <div className="flex items-center gap-2 mb-4">
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCourse(null)}>
            <ChevronLeft size={14} /> Back
          </button>
          <h1 className="page-title" style={{ margin: 0 }}>{selectedCourse.shortName || selectedCourse.name}</h1>
        </div>
        <button className="btn btn-primary btn-full mb-4" onClick={() => setSelectedTopic('_all')}>
          <Layers size={16} /> Study All ({cards.length} cards)
        </button>
        <h3 className="section-title">Topics</h3>
        {topics.map(([topicName, topicCards]) => (
          <div key={topicName} className="card mb-2" style={{ cursor: 'pointer', borderLeftColor: selectedCourse.color, borderLeftWidth: 3 }} onClick={() => setSelectedTopic(topicName)}>
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{topicName}</div>
                <div className="text-xs text-muted">{topicCards.length} cards</div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Empty state
  if (allCards.length === 0) {
    return (
      <div className="animate-in">
        <h1 className="page-title">Flashcards</h1>

        {/* Show create form in empty state */}
        <CreateFlashcardForm courses={courses} data={data} setData={setData} onDone={() => {}} />

        {/* Bulk import in empty state too */}
        <BulkImport courses={courses} data={data} setData={setData} />

        <div className="empty-state">
          <BookOpen />
          <h3>No flashcards yet</h3>
          <p>Create flashcards above, bulk import, or add them from any course's Vocab tab.</p>
        </div>
      </div>
    )
  }

  // Main view with mode toggle (Study / Manage)
  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    borderRadius: 'var(--radius-sm)', border: 'none', fontFamily: 'inherit',
    background: active ? 'var(--accent)' : 'var(--bg-secondary)',
    color: active ? '#fff' : 'var(--text-secondary)',
    transition: 'all 0.15s ease',
  })

  return (
    <div className="animate-in">
      <h1 className="page-title">Flashcards</h1>
      <p className="page-subtitle">{allCards.length} cards across {courses.filter(c => c.flashcards?.length).length} courses</p>

      {/* Mode toggle tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
          <button style={tabStyle(mode === 'study')} onClick={() => setMode('study')}>
            <Layers size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Study
          </button>
          <button style={tabStyle(mode === 'manage')} onClick={() => setMode('manage')}>
            <Settings2 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Manage
          </button>
          <button style={tabStyle(mode === 'analytics')} onClick={() => setMode('analytics')}>
            <BarChart3 size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />Analytics
          </button>
        </div>
        <div style={{ flex: 1 }} />
        {(data?.pluginData?.srData?.cards?.length ?? 0) > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => exportFlashcardsAsAnki(data!.pluginData.srData!.cards)} title="Export SR cards as Anki format">
            <Download size={14} /> Anki
          </button>
        )}
        <ExportButton courses={courses} />
      </div>

      {/* ── STUDY MODE ── */}
      {mode === 'study' && (
        <>
          {/* Create flashcard toggle */}
          {showCreate ? (
            <CreateFlashcardForm courses={courses} data={data} setData={setData} onDone={() => setShowCreate(false)} />
          ) : (
            <button className="btn btn-secondary btn-sm mb-4" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Create Flashcard
            </button>
          )}

          {/* Study Due / Study All */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setSelectedCourse({ id: '_all', name: 'All Cards', shortName: 'All', color: '#6366f1', topics: [], flashcards: allCards })}>
              <Layers size={15} /> All ({allCards.length})
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, color: dueCount > 0 ? 'var(--accent)' : undefined }}
              onClick={() => {
                const allFSRS = loadFcFSRS()
                const courseRemainders: Record<string, number> = {}
                courses.forEach(c => {
                  courseRemainders[c.id] = Math.max(0, getCap(c.id) - (dailyProgress.counts[c.id] || 0))
                })
                const dueCards = allCards.filter(c => {
                  if (!isFcCardDue(c.courseId, c, allFSRS)) return false
                  if ((courseRemainders[c.courseId] ?? 0) <= 0) return false
                  courseRemainders[c.courseId]--
                  return true
                })
                if (dueCards.length === 0) return
                setSelectedCourse({ id: '_due', name: 'Due Cards', shortName: 'Due', color: '#f59e0b', topics: [], flashcards: dueCards })
              }}
              disabled={dueCount === 0}
            >
              <Clock size={15} /> Due ({dueCount})
            </button>
          </div>

          {/* Daily cap reached banner */}
          {(() => {
            const totalReviewed = Object.values(dailyProgress.counts).reduce((s, n) => s + n, 0)
            const capReached = dueCount === 0 && totalReviewed > 0
            const totalCapNumber = courses.filter(c => c.flashcards?.length).reduce((s, c) => s + getCap(c.id), 0)
            if (!capReached) return null
            return (
              <div style={{
                background: 'rgba(74, 222, 128, 0.1)',
                border: '1px solid rgba(74, 222, 128, 0.3)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🎉</span>
                <div>
                  <div style={{ fontWeight: 600, color: '#4ade80' }}>Great work! Daily goal complete.</div>
                  <div style={{ fontSize: '0.85rem', color: '#a0a0a0', marginTop: '2px' }}>
                    Come back tomorrow for {totalCapNumber} more cards. Your progress is saved.
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Today's review summary */}
          {(() => {
            const totalReviewed = Object.values(dailyProgress.counts).reduce((s, n) => s + n, 0)
            const totalDue = Object.entries(courseDueMap).reduce((s, [cId, n]) => s + Math.min(n, getCap(cId)), 0)
            if (totalReviewed === 0 && totalDue === 0) return null
            return (
              <div style={{ display: 'flex', gap: 10, marginBottom: 14, padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#22c55e' }}>{totalReviewed}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Reviewed Today</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: totalDue > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{totalDue}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Still Due</div>
                </div>
                <div style={{ width: 1, background: 'var(--border)' }} />
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{allCards.length}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Cards</div>
                </div>
              </div>
            )
          })()}

          {/* Per-course */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-title" style={{ margin: 0 }}><BookOpen size={18} /> By Course</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowNewFolder(!showNewFolder)}>
              {showNewFolder ? <><X size={13} /> Cancel</> : <><FolderPlus size={13} /> New Folder</>}
            </button>
          </div>

          {showNewFolder && (
            <div className="card mb-3" style={{ padding: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text" className="input" placeholder="Folder name..."
                  value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                  style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); createFolder() } }}
                />
                <div style={{ display: 'flex', gap: 3 }}>
                  {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b'].map(c => (
                    <div key={c} onClick={() => setNewFolderColor(c)} style={{
                      width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer',
                      border: newFolderColor === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: newFolderColor === c ? `0 0 0 1px ${c}` : 'none',
                    }} />
                  ))}
                </div>
                <button className="btn btn-primary btn-sm" onClick={createFolder} disabled={!newFolderName.trim()}>
                  <Check size={13} /> Create
                </button>
              </div>
            </div>
          )}

          {courses.filter(c => c.flashcards?.length).map(c => {
            const cap = getCap(c.id)
            const reviewed = dailyProgress.counts[c.id] || 0
            const cappedDue = Math.min(courseDueMap[c.id] || 0, Math.max(0, cap - reviewed))
            const doneFraction = Math.min(1, reviewed / cap)
            return (
              <div key={c.id} className="card mb-3" style={{ borderLeftColor: c.color, borderLeftWidth: 3, cursor: 'pointer' }} onClick={() => setSelectedCourse(c)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.shortName || c.name}</div>
                    <div className="text-xs text-muted">{(c.flashcards || []).length} cards</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(courseDueMap[c.id] || 0) > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>
                        {courseDueMap[c.id]} due{courseDueMap[c.id] > cap ? ` (cap ${cap})` : ''}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: reviewed >= cap ? '#22c55e' : 'var(--text-muted)' }}>
                      {reviewed}/{cap}
                    </span>
                    <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }} onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Daily cap:</span>
                    <button onClick={e => { e.stopPropagation(); saveCap(c.id, Math.max(5, cap - 5)) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'var(--text-muted)', width: 22, height: 22, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>−</button>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{cap}</span>
                    <button onClick={e => { e.stopPropagation(); saveCap(c.id, cap + 5) }} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, color: 'var(--text-muted)', width: 22, height: 22, cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>+</button>
                    <span>cards/day</span>
                  </div>
                  {reviewed > 0 && (
                    <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                      <div style={{ height: 3, background: reviewed >= cap ? '#22c55e' : 'var(--accent)', borderRadius: 2, width: `${doneFraction * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Show empty folders too */}
          {courses.filter(c => !c.flashcards?.length).length > 0 && (
            <>
              <div className="text-xs text-muted mt-3 mb-2">Empty folders</div>
              {courses.filter(c => !c.flashcards?.length).map(c => (
                <div key={c.id} className="card mb-2" style={{ cursor: 'pointer', borderLeftColor: c.color, borderLeftWidth: 3, opacity: 0.6 }} onClick={() => setSelectedCourse(c)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.shortName || c.name}</div>
                      <div className="text-xs text-muted">0 cards</div>
                    </div>
                    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* ── MANAGE MODE ── */}
      {mode === 'manage' && (
        <>
          {/* Action buttons row */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {showCreate ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>
                <X size={14} /> Close Create
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowCreate(true); setShowImport(false) }}>
                <Plus size={14} /> Create Card
              </button>
            )}
            {showImport ? (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(false)}>
                <X size={14} /> Close Import
              </button>
            ) : (
              <button className="btn btn-secondary btn-sm" onClick={() => { setShowImport(true); setShowCreate(false) }}>
                <Upload size={14} /> Bulk Import
              </button>
            )}
          </div>

          {/* Create form */}
          {showCreate && (
            <CreateFlashcardForm courses={courses} data={data} setData={setData} onDone={() => setShowCreate(false)} />
          )}

          {/* Bulk import */}
          {showImport && (
            <BulkImport courses={courses} data={data} setData={setData} />
          )}

          {/* Card list with search, sort, edit, delete */}
          <ManageFlashcards courses={courses} data={data} setData={setData} />
        </>
      )}

      {/* ── ANALYTICS MODE ── */}
      {mode === 'analytics' && (() => {
        const allFSRS = loadFcFSRS()
        const fsrsEntries = Object.values(allFSRS)
        const totalReviewedToday = Object.values(dailyProgress.counts).reduce((s, n) => s + n, 0)

        // Card state breakdown
        const stateCounts = { new: 0, learning: 0, review: 0, mature: 0 }
        let totalLapses = 0, totalReps = 0, totalInterval = 0, intervalsCount = 0
        fsrsEntries.forEach(c => {
          const state = c.state as keyof typeof stateCounts
          if (state in stateCounts) stateCounts[state]++
          totalLapses += c.lapses || 0
          totalReps += c.reps || 0
          if (c.interval > 0) { totalInterval += c.interval; intervalsCount++ }
        })
        const retention = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : null
        const avgInterval = intervalsCount > 0 ? Math.round(totalInterval / intervalsCount) : 0
        const totalDueNow = Object.values(courseDueMap).reduce((s, n) => s + n, 0)

        // Per-course FSRS breakdown
        const courseStats = courses.filter(c => c.flashcards?.length).map(c => {
          const cards = (c.flashcards || []).map(fc => allFSRS[fcCardKey(c.id, fc)])
          const reviewed = cards.filter(Boolean)
          const lapses = reviewed.reduce((s, fc) => s + (fc.lapses || 0), 0)
          const reps = reviewed.reduce((s, fc) => s + (fc.reps || 0), 0)
          const ret = reps > 0 ? Math.round(((reps - lapses) / reps) * 100) : null
          const mature = reviewed.filter(fc => fc?.state === 'mature').length
          return { course: c, reviewed: reviewed.length, total: c.flashcards!.length, retention: ret, mature }
        })

        // Match analytics
        const playedSets = matchSets.filter(m => m.bestScore !== undefined)
        const avgBest = playedSets.length > 0
          ? Math.round(playedSets.reduce((s, m) => s + (m.bestScore ?? 0), 0) / playedSets.length)
          : null
        const perfect = playedSets.filter(m => (m.bestScore ?? 0) >= 100).length

        const statBox = (val: string | number, label: string, color?: string, tip?: React.ReactNode): React.ReactNode => (
          <div
            style={{ flex: 1, textAlign: 'center', padding: '10px 6px', cursor: tip ? 'default' : undefined }}
            onMouseEnter={tip ? e => showTip(e, tip) : undefined}
            onMouseMove={tip ? moveTip : undefined}
            onMouseLeave={tip ? hideTip : undefined}
          >
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-mono)', color: color || 'var(--text-primary)' }}>{val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{label}</div>
            {tip && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, opacity: 0.5 }}>hover for details</div>}
          </div>
        )
        const divider = <div style={{ width: 1, background: 'var(--border)', alignSelf: 'stretch' }} />

        return (
          <>
            {analyticsTip && <TooltipPopup tip={analyticsTip} />}
            {/* ── Flashcard Health ── */}
            <div className="card mb-4">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title"><BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Flashcard Health</span>
              </div>

              {/* Top stats row */}
              <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 14, border: '1px solid var(--border)' }}>
                {statBox(totalReviewedToday, 'Reviewed Today', '#22c55e',
                  <div><div style={{ fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>Cards reviewed today</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total cards rated Again/Hard/Good/Easy across all courses today. Resets at midnight.</div>{Object.entries(dailyProgress.counts).map(([cId, n]) => { const c = courses.find(x => x.id === cId); return n > 0 ? <div key={cId} style={{ fontSize: 11, marginTop: 3 }}><span style={{ color: c?.color || 'var(--accent)' }}>{c?.shortName || cId}:</span> {n}</div> : null })}</div>
                )}
                {divider}
                {statBox(totalDueNow, 'Total Due', totalDueNow > 0 ? 'var(--accent)' : 'var(--text-muted)',
                  <div><div style={{ fontWeight: 700, color: 'var(--accent)', marginBottom: 4 }}>Cards due for review</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cards whose FSRS next-review date has passed. Includes overdue cards. Capped by your daily review limit per course.</div><div style={{ fontSize: 11, marginTop: 6 }}>Uncapped total: {Object.values(courseDueMap).reduce((s, n) => s + n, 0)}</div></div>
                )}
                {divider}
                {statBox(retention !== null ? `${retention}%` : '—', 'Retention',
                  retention !== null ? (retention >= 80 ? '#22c55e' : retention >= 60 ? 'var(--yellow)' : 'var(--red)') : undefined,
                  <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Historical retention rate</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>= (total reviews − lapses) / total reviews. A lapse is when you answer "Again" (forgot the card). Target: ≥80%.</div>{retention !== null && <div style={{ fontSize: 11, marginTop: 6 }}>{totalReps - totalLapses} correct out of {totalReps} reviews · {totalLapses} lapses</div>}</div>
                )}
                {divider}
                {statBox(avgInterval > 0 ? `${avgInterval}d` : '—', 'Avg Interval', undefined,
                  <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Average review interval</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Mean number of days between reviews across all scheduled cards. Higher = better long-term retention. New/learning cards have short intervals (1-3d); mature cards can reach 30-180d.</div>{avgInterval > 0 && <div style={{ fontSize: 11, marginTop: 6 }}>Based on {intervalsCount} scheduled cards</div>}</div>
                )}
              </div>

              {/* Card state distribution */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Card States</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {([
                    { key: 'new', label: 'New', color: '#6366f1', tip: 'Cards you\'ve never studied. FSRS will show them for the first time on their first review session.' },
                    { key: 'learning', label: 'Learning', color: 'var(--accent)', tip: 'Cards in the active learning phase — reviewed recently and being reinforced at short intervals (hours to days).' },
                    { key: 'review', label: 'Review', color: '#3b82f6', tip: 'Cards graduated from learning. FSRS schedules these based on your memory stability — intervals grow with each successful review.' },
                    { key: 'mature', label: 'Mature', color: '#22c55e', tip: 'Cards with a review interval ≥21 days. Strong long-term memory — FSRS estimates high recall probability.' },
                  ] as const).map(s => {
                    const count = stateCounts[s.key as keyof typeof stateCounts]
                    const pct = fsrsEntries.length > 0 ? Math.round((count / allCards.length) * 100) : 0
                    const tipContent = <div><div style={{ fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.label} cards: {count}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.tip}</div><div style={{ fontSize: 11, marginTop: 6 }}>{pct}% of all cards</div></div>
                    return (
                      <div key={s.key}
                        style={{ flex: 1, minWidth: 60, background: `${s.color}12`, border: `1px solid ${s.color}30`, borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center', cursor: 'default' }}
                        onMouseEnter={e => showTip(e, tipContent)} onMouseMove={moveTip} onMouseLeave={hideTip}
                      >
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: s.color }}>{count}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: s.color, marginTop: 2 }}>{pct}%</div>
                      </div>
                    )
                  })}
                  {allCards.length - fsrsEntries.length > 0 && (
                    <div
                      style={{ flex: 1, minWidth: 60, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '8px 10px', textAlign: 'center', cursor: 'default' }}
                      onMouseEnter={e => showTip(e, <div><div style={{ fontWeight: 700, marginBottom: 4 }}>Unreviewed cards</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cards that exist in your decks but have never been studied. They have no FSRS data yet.</div></div>)}
                      onMouseMove={moveTip} onMouseLeave={hideTip}
                    >
                      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{allCards.length - fsrsEntries.length}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>Unreviewed</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1, opacity: 0.5 }}>hover for details</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Per-course breakdown */}
              {courseStats.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>By Course</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {courseStats.map(({ course: c, reviewed, total, retention: ret, mature }) => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 3, alignSelf: 'stretch', background: c.color, borderRadius: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.shortName || c.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{total} cards · {mature} mature · {reviewed}/{total} reviewed</div>
                          {reviewed > 0 && (
                            <div style={{ marginTop: 4, height: 4, background: 'var(--bg-secondary)', borderRadius: 2 }}>
                              <div style={{ height: 4, borderRadius: 2, width: `${Math.round((mature / total) * 100)}%`, background: '#22c55e', transition: 'width 0.4s' }} />
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {ret !== null ? (
                            <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: ret >= 80 ? '#22c55e' : ret >= 60 ? 'var(--yellow)' : 'var(--red)' }}>{ret}%</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No data</span>
                          )}
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>retention</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── FSRS Charts ── */}
            <FlashcardAnalytics fsrsMap={allFSRS} courses={courses} />

            {/* ── Match Game Analytics ── */}
            <div className="card mb-4">
              <div className="card-header" style={{ marginBottom: 12 }}>
                <span className="card-title"><Trophy size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Match Game</span>
                {playedSets.length > 0 && <span className="badge">{playedSets.length} sets played</span>}
              </div>

              {matchSets.length === 0 ? (
                <div className="text-xs text-muted">No match games played yet. Try the Match mode in Learn!</div>
              ) : (
                <>
                  {/* Summary */}
                  {playedSets.length > 0 && (
                    <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', marginBottom: 14, border: '1px solid var(--border)' }}>
                      {statBox(playedSets.length, 'Sets Played', 'var(--accent)')}
                      {divider}
                      {statBox(avgBest !== null ? `${avgBest}%` : '—', 'Avg Best Score', avgBest !== null ? (avgBest >= 80 ? '#22c55e' : avgBest >= 60 ? 'var(--yellow)' : 'var(--red)') : undefined)}
                      {divider}
                      {statBox(perfect, 'Perfect Scores', perfect > 0 ? '#22c55e' : 'var(--text-muted)')}
                    </div>
                  )}

                  {/* Per-set scores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {matchSets.map(ms => {
                      const score = ms.bestScore
                      const hasScore = score !== undefined
                      return (
                        <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: hasScore ? (score! >= 100 ? 'rgba(34,197,94,0.15)' : 'rgba(245,166,35,0.12)') : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasScore ? <Target size={14} style={{ color: score! >= 100 ? '#22c55e' : 'var(--accent)' }} /> : <Trophy size={14} style={{ color: 'var(--text-muted)' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ms.name}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ms.pairs.length} pairs · {ms.subject === 'custom' ? 'Custom' : ms.subject === 'all' ? 'All Courses' : ms.subject}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            {hasScore ? (
                              <>
                                <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: score! >= 100 ? '#22c55e' : score! >= 70 ? 'var(--accent)' : 'var(--red)' }}>{score}%</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>best</div>
                              </>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Not played</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </>
        )
      })()}
    </div>
  )
}

/** Converts plain-text card content with common patterns into formatted HTML */
function formatCardText(text: string): string {
  // Split into sections by pipe separators (e.g. "MNEMONIC: ... | STEPS: ... | WHY: ...")
  const sections = text.split(/\s*\|\s*/);
  const html = sections.map(section => {
    const labelMatch = section.match(/^([A-Z][A-Z\s\/]{1,20}):\s*([\s\S]+)$/);
    if (!labelMatch) return `<p>${section}</p>`;
    const [, label, body] = labelMatch;

    // Numbered steps: "1) text 2) text" → <ol>
    if (/\d\)/.test(body)) {
      const items = body.split(/(?=\d+\))/).filter(Boolean);
      const liHtml = items.map(i => `<li>${i.replace(/^\d+\)\s*/, '')}</li>`).join('');
      return `<div class="fc-section"><span class="fc-label">${label}</span><ol>${liHtml}</ol></div>`;
    }

    // Mnemonic: styled callout
    if (label.includes('MNEMONIC')) {
      return `<div class="fc-section fc-mnemonic"><span class="fc-label">${label}</span><span class="fc-mnemonic-text">${body}</span></div>`;
    }

    // Default: bold label + paragraph
    return `<div class="fc-section"><span class="fc-label">${label}</span><p>${body}</p></div>`;
  }).join('');
  return html;
}

function FlashcardReview({ cards, courseId = '_fc', title, onBack, onCardReviewed }: { cards: FlashcardItem[]; courseId?: string; title: string; onBack: () => void; onCardReviewed?: (reviewedCourseId: string) => void }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [deck, setDeck] = useState(cards)
  const [starred, setStarred] = useState<Set<number>>(new Set())
  const [autoAdvance, setAutoAdvance] = useState(false)
  const [autoSpeed, setAutoSpeed] = useState(5) // seconds
  const [showVideoPanel, setShowVideoPanel] = useState(false)
  const [videoPanelMedia, setVideoPanelMedia] = useState<FlashcardMediaType | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [confidenceRatings, setConfidenceRatings] = useState<Record<number, number>>({})
  const [showConfidence, setShowConfidence] = useState(false)
  const autoRef = useRef<number | null>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)

  // Sync zenMode with actual browser fullscreen state (e.g. user presses Esc)
  useEffect(() => {
    const onFsChange = () => setZenMode(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const toggleZen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fallback: CSS overlay if fullscreen API is denied (e.g. embedded iframe)
        toggleZen()
      })
    } else {
      document.exitFullscreen()
    }
  }, [])

  const card = deck[index]

  const next = useCallback(() => {
    setFlipped(false)
    setTimeout(() => setIndex(i => Math.min(i + 1, deck.length - 1)), 100)
  }, [deck.length])

  const prev = useCallback(() => {
    setFlipped(false)
    setTimeout(() => setIndex(i => Math.max(i - 1, 0)), 100)
  }, [])

  const shuffle = useCallback(() => {
    const shuffled = [...deck].sort(() => Math.random() - 0.5)
    setDeck(shuffled)
    setIndex(0)
    setFlipped(false)
  }, [deck])

  const restart = useCallback(() => {
    setIndex(0)
    setFlipped(false)
  }, [])

  const toggleStar = useCallback(() => {
    setStarred(prev => {
      const s = new Set(prev)
      if (s.has(index)) s.delete(index); else s.add(index)
      return s
    })
  }, [index])

  const rateConfidence = useCallback((rating: number) => {
    setConfidenceRatings(prev => ({ ...prev, [index]: rating }))
    setShowConfidence(false)
    // Persist to FSRS
    const card = deck[index]
    if (card) {
      const key = fcCardKey(courseId, card)
      const allFSRS = loadFcFSRS()
      const existing = allFSRS[key] ?? initFcFSRSCard(key, card)
      saveFcFSRS({ ...allFSRS, [key]: reviewCard(existing, rating as Grade) })
      const cardCourseId = (card as FlashcardItem & { courseId?: string }).courseId ?? courseId
      onCardReviewed?.(cardCourseId)
    }
    next()
  }, [index, next, courseId, deck])

  // Swipe-to-rate adapters
  // Split into onCommit (save data) + onAnimationComplete (advance card)
  // to prevent card content changing mid fly-off animation.
  const onSwipeCommit = useCallback((direction: 'left' | 'right') => {
    const rating = direction === 'right' ? 3 : 1
    setConfidenceRatings(prev => ({ ...prev, [index]: rating }))
    setShowConfidence(false)
    const card = deck[index]
    if (card) {
      const key = fcCardKey(courseId, card)
      const allFSRS = loadFcFSRS()
      const existing = allFSRS[key] ?? initFcFSRSCard(key, card)
      saveFcFSRS({ ...allFSRS, [key]: reviewCard(existing, rating as Grade) })
      const cardCourseId = (card as FlashcardItem & { courseId?: string }).courseId ?? courseId
      onCardReviewed?.(cardCourseId)
    }
  }, [index, deck, courseId, onCardReviewed])

  const { dragState, handlers: swipeHandlers } = useSwipeGesture({
    onCommit: onSwipeCommit,
    onAnimationComplete: next,   // advance card only after fly-off completes
    isAnswerVisible: flipped,
    disabled: false,
  })

  // Keyboard shortcuts (customizable via Settings)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Skip when a text input or modal is focused
      if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // Customizable shortcuts
      if (matchesShortcut(e, 'fc_next') || e.key === 'd' || e.key === 'D') { next(); return }
      if (matchesShortcut(e, 'fc_prev') || e.key === 'a' || e.key === 'A') { prev(); return }
      if (matchesShortcut(e, 'fc_flip')) { e.preventDefault(); if (!flipped) setShowConfidence(true); setFlipped(f => !f); return }
      if (matchesShortcut(e, 'fc_star') && !e.ctrlKey && !e.metaKey) { toggleStar(); return }
      if (matchesShortcut(e, 'fc_restart') && !e.ctrlKey && !e.metaKey) { restart(); return }
      if (matchesShortcut(e, 'fc_auto')) { setAutoAdvance(a => !a); return }
      if (matchesShortcut(e, 'fc_zen') && !e.ctrlKey && !e.metaKey) { toggleZen(); return }
      // Media shortcuts
      if (matchesShortcut(e, 'fc_replay') && !e.ctrlKey && !e.metaKey) {
        // Dispatch custom event for FlashcardMedia to handle replay
        document.dispatchEvent(new CustomEvent('fc-media-replay'))
        return
      }
      if (matchesShortcut(e, 'fc_fullscreen') && !e.ctrlKey && !e.metaKey) {
        // Fullscreen is handled by zen mode toggle (fc_zen) — fc_fullscreen is an alias
        toggleZen()
        return
      }
      if (flipped) {
        if (matchesShortcut(e, 'fc_conf1')) { rateConfidence(1); return }
        if (matchesShortcut(e, 'fc_conf2')) { rateConfidence(2); return }
        if (matchesShortcut(e, 'fc_conf3')) { rateConfidence(3); return }
        if (matchesShortcut(e, 'fc_conf4')) { rateConfidence(4); return }
      }
      // Non-customizable
      if (e.key === '?') { setShowShortcuts(s => !s); return }
      if (e.key === 'Escape') { if (showShortcuts) { setShowShortcuts(false); return } }
      if (e.key === '+' || e.key === '=') { setAutoSpeed(s => Math.max(2, s - 1)); return }
      if (e.key === '-') { setAutoSpeed(s => Math.min(30, s + 1)); return }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [next, prev, restart, toggleStar, showShortcuts, flipped, rateConfidence, zenMode])

  // Open video panel when flipped to back with media
  useEffect(() => {
    if (flipped && card?.media && (card.media.side === 'back' || card.media.side === 'both')) {
      setVideoPanelMedia(card.media)
      setShowVideoPanel(true)
    }
  }, [flipped, index]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update or close video panel when navigating to a new card
  useEffect(() => {
    if (card?.media && (card.media.side === 'back' || card.media.side === 'both')) {
      if (showVideoPanel) setVideoPanelMedia(card.media) // update immediately if panel is open
    } else {
      setShowVideoPanel(false)
    }
  }, [index]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance timer
  useEffect(() => {
    if (autoRef.current) clearInterval(autoRef.current)
    if (!autoAdvance) return
    autoRef.current = window.setInterval(() => {
      setFlipped(f => {
        if (!f) return true // flip first
        // then advance
        setTimeout(() => {
          setFlipped(false)
          setTimeout(() => setIndex(i => i < deck.length - 1 ? i + 1 : 0), 100)
        }, 0)
        return f
      })
    }, autoSpeed * 1000)
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [autoAdvance, autoSpeed, deck.length])

  if (!card) {
    return (
      <div className="animate-in">
        <button className="btn btn-secondary btn-sm mb-4" onClick={onBack}><ChevronLeft size={16} /> Back</button>
        <div className="empty-state">
          <BookOpen />
          <h3>No cards in this deck</h3>
        </div>
      </div>
    )
  }

  const zenStyle: React.CSSProperties = zenMode ? {
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
    background: 'var(--bg-primary)', zIndex: 9999, padding: 24,
    display: 'flex', flexDirection: 'column', overflow: 'auto',
  } : {}

  return (
    <div className="animate-in" style={zenStyle}>
      {!zenMode && <button className="btn btn-secondary btn-sm mb-4" onClick={onBack}><ChevronLeft size={16} /> Back</button>}

      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontSize: zenMode ? 14 : 18, fontWeight: 700 }}>{title}</h2>
        <div className="flex gap-2">
          <button
            className={`btn-icon${autoAdvance ? ' active' : ''}`}
            onClick={() => setAutoAdvance(a => !a)}
            aria-label={autoAdvance ? `Auto-advance ON (${autoSpeed}s) — press P to toggle` : 'Auto-advance off — press P to toggle'}
            title={autoAdvance ? `Auto-advance ON (${autoSpeed}s) — P to toggle` : 'Auto-advance — P'}
            style={autoAdvance ? { color: 'var(--accent)', background: 'var(--accent-glow)' } : {}}
          >
            {autoAdvance ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button className="btn-icon" onClick={shuffle} aria-label="Shuffle cards" title="Shuffle"><Shuffle size={16} /></button>
          <button className="btn-icon" onClick={restart} aria-label="Restart deck — press R" title="Restart — R"><RotateCcw size={16} /></button>
          <button className="btn-icon" onClick={() => toggleZen()} aria-label={zenMode ? 'Exit zen mode — press F' : 'Enter zen mode — press F'} title="Zen mode — F">
            {zenMode ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          {!zenMode && <button className="btn-icon" onClick={() => setShowShortcuts(s => !s)} aria-label="Show keyboard shortcuts — press ?" title="Shortcuts — ?"><Keyboard size={16} /></button>}
        </div>
      </div>

      {/* Auto-advance speed indicator */}
      {autoAdvance && (
        <div className="flex items-center justify-center gap-2 mb-2" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          <button className="btn-icon" aria-label="Decrease speed" style={{ width: 20, height: 20, fontSize: 14 }} onClick={() => setAutoSpeed(s => Math.max(2, s - 1))}>-</button>
          <span aria-live="polite" aria-label={`Auto-advance speed: ${autoSpeed} seconds`}>{autoSpeed}s</span>
          <button className="btn-icon" aria-label="Increase speed" style={{ width: 20, height: 20, fontSize: 14 }} onClick={() => setAutoSpeed(s => Math.min(30, s + 1))}>+</button>
        </div>
      )}

      {/* Progress */}
      <div
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={deck.length}
        aria-label={`Card ${index + 1} of ${deck.length}`}
        className="progress-bar mb-3"
      >
        <div className="progress-fill" style={{ width: `${((index + 1) / deck.length) * 100}%`, background: 'var(--accent)' }} />
      </div>

      {/* Flashcard */}
      <SwipeableCard
        dragState={dragState}
        handlers={swipeHandlers}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      >
        <div
          ref={cardContainerRef}
          className="flashcard-container"
          style={zenMode ? { maxWidth: 'min(960px, calc(100vw - 48px))' } : undefined}
          role="button"
          tabIndex={0}
          aria-label={flipped ? `Card back: ${card.back.substring(0, 100)}. Press Space to flip back.` : `Card front: ${card.front}. Press Space to flip.`}
          onClick={() => { setFlipped(f => !f); if (!flipped) setShowConfidence(true); }}
          onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); setFlipped(f => !f); if (!flipped) setShowConfidence(true); } }}
        >
          <div className={`flashcard${flipped ? ' flipped' : ''}`} style={card.media ? { minHeight: 480 } : undefined}>
            <div className="flashcard-face flashcard-front">
              <div className="flashcard-label">Front</div>
              <div className="flashcard-text" style={{ whiteSpace: 'pre-wrap' }}>{card.front}</div>
              {card.media && (card.media.side === 'front' || card.media.side === 'both') && (
                <FlashcardMedia media={card.media} isActive={!flipped} />
              )}
              {starred.has(index) && <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 16, color: 'var(--accent)' }}>&#9733;</span>}
            </div>
            <div className="flashcard-face flashcard-back">
              <div className="flashcard-label">Back</div>
              {/<[a-z][\s\S]*>/i.test(card.back)
                ? <div className="flashcard-text" dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }} />
                : /\s*\|\s*[A-Z]/.test(card.back)
                  ? <div className="flashcard-text flashcard-text--structured" dangerouslySetInnerHTML={{ __html: sanitizeHtml(formatCardText(card.back)) }} />
                  : <div className="flashcard-text" style={{ whiteSpace: 'pre-wrap', ...(card.back.length > 200 ? { fontSize: 13, fontWeight: 500 } : {}) }}>{card.back}</div>}
              {card.media && (card.media.side === 'back' || card.media.side === 'both') && (
                <FlashcardMedia media={card.media} isActive={flipped} />
              )}
              {starred.has(index) && <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 16, color: 'var(--accent)' }}>&#9733;</span>}
            </div>
          </div>
        </div>
      </SwipeableCard>

      {/* Confidence rating (shown after flip) */}
      {flipped && showConfidence && (
        <div style={{
          display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12, marginBottom: 4,
        }}>
          {[
            { rating: 1, label: 'Again', color: 'var(--red)' },
            { rating: 2, label: 'Hard', color: 'var(--orange)' },
            { rating: 3, label: 'Good', color: 'var(--blue)' },
            { rating: 4, label: 'Easy', color: 'var(--green)' },
          ].map(btn => (
            <button
              key={btn.rating}
              onClick={e => { e.stopPropagation(); rateConfidence(btn.rating); }}
              style={{
                padding: '6px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: confidenceRatings[index] === btn.rating ? `${btn.color}20` : 'var(--bg-secondary)',
                border: `1px solid ${btn.color}50`, color: btn.color,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {btn.rating}. {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flashcard-nav">
        <button className="btn btn-secondary btn-sm" onClick={prev} disabled={index === 0}>
          <ChevronLeft size={16} /> Prev
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn-icon"
            onClick={e => { e.stopPropagation(); toggleStar() }}
            title="Star card — S"
            style={{ color: starred.has(index) ? 'var(--accent)' : 'var(--text-muted)', fontSize: 18 }}
          >
            {starred.has(index) ? '★' : '☆'}
          </button>
          <span className="flashcard-counter">{index + 1} / {deck.length}</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={next} disabled={index === deck.length - 1}>
          Next <ChevronRight size={16} />
        </button>
      </div>

      {/* Persistent video panel — stays open through flips and auto-advance */}
      {showVideoPanel && videoPanelMedia && videoPanelMedia.type === 'youtube' && (() => {
        const vid = getYouTubeId(videoPanelMedia.src)
        if (!vid) return null
        return (
          <div style={{
            marginTop: 16, borderRadius: 'var(--radius)', overflow: 'hidden',
            border: '1px solid var(--border)', background: 'var(--bg-card)',
          }}>
            <div style={{
              padding: '8px 12px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>VIDEO REFERENCE</span>
              <button
                onClick={() => setShowVideoPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
                title="Close video panel"
              >&times;</button>
            </div>
            <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden' }}>
              <iframe
                src={getYouTubeEmbedUrl(vid)}
                style={{ position: 'absolute', inset: 0, border: 'none' }}
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                title="Video Reference"
              />
            </div>
          </div>
        )
      })()}

      {/* Shortcut hints */}
      {showShortcuts ? (
        <div style={{
          marginTop: 16, padding: 16, borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Keyboard Shortcuts</span>
            <button onClick={() => setShowShortcuts(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', color: 'var(--text-secondary)' }}>
            <span><b>{formatKey(getShortcutKey('fc_flip'))}</b> — Flip card</span>
            <span><b>{formatKey(getShortcutKey('fc_next'))} / D</b> — Next card</span>
            <span><b>{formatKey(getShortcutKey('fc_prev'))} / A</b> — Previous card</span>
            <span><b>{formatKey(getShortcutKey('fc_star'))}</b> — Star/unstar card</span>
            <span><b>{formatKey(getShortcutKey('fc_restart'))}</b> — Restart deck</span>
            <span><b>{formatKey(getShortcutKey('fc_auto'))}</b> — Toggle auto-advance</span>
            <span><b>+ / -</b> — Adjust auto speed</span>
            <span><b>{formatKey(getShortcutKey('fc_zen'))}</b> — Zen/fullscreen mode</span>
            <span><b>{formatKey(getShortcutKey('fc_conf1'))}-{formatKey(getShortcutKey('fc_conf4'))}</b> — Confidence rating</span>
            <span><b>Swipe L/R</b> — Next/prev (touch)</span>
            <span><b>?</b> — Toggle this panel</span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted text-center mt-4">
          Tap card to flip &middot; Swipe to navigate &middot; Press <b>?</b> for shortcuts
        </p>
      )}

      {/* Confidence summary */}
      {Object.keys(confidenceRatings).length > 0 && !zenMode && (
        <div style={{
          marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', gap: 16,
        }}>
          {[
            { r: 1, label: 'Again', color: 'var(--red)' },
            { r: 2, label: 'Hard', color: 'var(--orange)' },
            { r: 3, label: 'Good', color: 'var(--blue)' },
            { r: 4, label: 'Easy', color: 'var(--green)' },
          ].map(b => {
            const count = Object.values(confidenceRatings).filter(v => v === b.r).length
            return count > 0 ? (
              <span key={b.r} style={{ color: b.color, fontWeight: 600 }}>
                {b.label}: {count}
              </span>
            ) : null
          })}
        </div>
      )}
    </div>
  )
}
