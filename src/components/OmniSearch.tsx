import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, BookOpen, Brain, Trophy, Repeat2, LayoutGrid, ClipboardList, Calendar, X, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStore } from '../store'
import type { NousAIData } from '../types'

type ResultType = 'note' | 'course' | 'flashcard' | 'quiz' | 'sr-card' | 'match-set' | 'assignment' | 'schedule'

interface SearchResult {
  id: string
  type: ResultType
  title: string
  preview: string
  route: string
  typeLabel: string
  score: number
}

const TYPE_ICONS: Record<ResultType, LucideIcon> = {
  'note': FileText,
  'course': BookOpen,
  'flashcard': Brain,
  'quiz': Trophy,
  'sr-card': Repeat2,
  'match-set': LayoutGrid,
  'assignment': ClipboardList,
  'schedule': Calendar,
}

const TYPE_ORDER: ResultType[] = [
  'note', 'course', 'flashcard', 'quiz', 'sr-card', 'match-set', 'assignment', 'schedule',
]

const TYPE_LABELS: Record<ResultType, string> = {
  'note': 'Notes',
  'course': 'Courses & Topics',
  'flashcard': 'Flashcards',
  'quiz': 'Quizzes',
  'sr-card': 'Spaced Repetition',
  'match-set': 'Match Sets',
  'assignment': 'Assignments',
  'schedule': 'Study Schedules',
}

interface QuickAction {
  id: string
  label: string
  route: string
  description: string
}

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'new-note',     label: 'New Note',        route: '/library?tab=notes&new=1', description: 'Create a new note' },
  { id: 'flashcards',  label: 'Go to Flashcards', route: '/flashcards',              description: 'Open flashcards' },
  { id: 'start-quiz',  label: 'Start Quiz',        route: '/quiz',                   description: 'Start a quiz session' },
  { id: 'settings',    label: 'Open Settings',     route: '/settings',               description: 'Open app settings' },
  { id: 'timer',       label: 'Go to Timer',       route: '/timer',                  description: 'Open Pomodoro timer' },
  { id: 'ai-tools',    label: 'Go to AI Tools',    route: '/learn',                  description: 'Open AI tools' },
]

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildIndex(data: NousAIData | null): SearchResult[] {
  if (!data) return []
  const pd = data.pluginData
  const results: SearchResult[] = []

  // Notes
  for (const note of pd.notes ?? []) {
    results.push({
      id: `note-${note.id}`,
      type: 'note',
      title: note.title ?? 'Untitled Note',
      preview: stripHtml(note.content ?? '').slice(0, 80),
      route: '/library',
      typeLabel: 'NOTE',
      score: 0,
    })
  }

  // Courses + topics + flashcards
  for (const course of pd.coachData?.courses ?? []) {
    results.push({
      id: `course-${course.id}`,
      type: 'course',
      title: course.name ?? '',
      preview: `${course.shortName ? course.shortName + ' · ' : ''}${(course.topics ?? []).length} topics`,
      route: `/course?id=${course.id}`,
      typeLabel: 'COURSE',
      score: 0,
    })
    for (const topic of course.topics ?? []) {
      results.push({
        id: `topic-${course.id}-${topic.id}`,
        type: 'course',
        title: topic.name ?? '',
        preview: course.name ?? '',
        route: `/course?id=${course.id}`,
        typeLabel: 'TOPIC',
        score: 0,
      })
      for (const sub of topic.subtopics ?? []) {
        results.push({
          id: `sub-${course.id}-${topic.id}-${sub.id}`,
          type: 'course',
          title: sub.name ?? '',
          preview: `${course.name ?? ''} · ${topic.name ?? ''}`,
          route: `/course?id=${course.id}`,
          typeLabel: 'SUBTOPIC',
          score: 0,
        })
      }
    }
    // Cap flashcards at 300 per course to keep index manageable
    const fcs = course.flashcards ?? []
    for (let i = 0; i < Math.min(fcs.length, 300); i++) {
      const fc = fcs[i]
      if (!fc) continue
      results.push({
        id: `fc-${course.id}-${i}`,
        type: 'flashcard',
        title: fc.front ?? '',
        preview: fc.back ?? '',
        route: '/flashcards',
        typeLabel: 'FLASHCARD',
        score: 0,
      })
    }
  }

  // Quiz history
  for (const quiz of pd.quizHistory ?? []) {
    results.push({
      id: `quiz-${quiz.id}`,
      type: 'quiz',
      title: quiz.name ?? '',
      preview: `${quiz.subject}${quiz.subtopic ? ' · ' + quiz.subtopic : ''} · ${quiz.score === -1 ? 'Not taken' : quiz.score + '%'}`,
      route: '/quiz',
      typeLabel: 'QUIZ',
      score: 0,
    })
  }

  // Quiz bank questions
  const quizBank = pd.quizBank as { quizzes?: { id?: string; name?: string; subject?: string; questions?: { question?: string; correctAnswer?: string }[] }[] } | undefined
  const bankQuizzes = quizBank?.quizzes ?? []
  for (const bq of bankQuizzes) {
    const subject = bq.name ?? bq.subject ?? ''
    for (let qi = 0; qi < (bq.questions ?? []).length; qi++) {
      const q = (bq.questions ?? [])[qi]
      if (!q?.question) continue
      results.push({
        id: `bankq-${bq.id ?? subject}-${qi}`,
        type: 'quiz',
        title: q.question,
        preview: subject,
        route: '/quiz',
        typeLabel: 'QUIZ Q',
        score: 0,
      })
    }
  }

  // SR Cards
  for (const card of pd.srData?.cards ?? []) {
    results.push({
      id: `sr-${card.key}`,
      type: 'sr-card',
      title: card.questionText ?? `${card.subject} · ${card.subtopic}`,
      preview: `${card.subject}${card.subtopic ? ' · ' + card.subtopic : ''}`,
      route: '/flashcards',
      typeLabel: 'SR CARD',
      score: 0,
    })
  }

  // Match sets
  for (const ms of pd.matchSets ?? []) {
    results.push({
      id: `ms-${ms.id}`,
      type: 'match-set',
      title: ms.name,
      preview: `${(ms.pairs ?? []).length} pairs`,
      route: '/library',
      typeLabel: 'MATCH SET',
      score: 0,
    })
  }

  // Assignments
  for (const a of pd.assignments ?? []) {
    results.push({
      id: `assign-${a.id}`,
      type: 'assignment',
      title: a.name,
      preview: a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString()}` : '',
      route: '/calendar',
      typeLabel: 'ASSIGNMENT',
      score: 0,
    })
  }

  // Study schedules
  for (const s of pd.studySchedules ?? []) {
    results.push({
      id: `sched-${s.id}`,
      type: 'schedule',
      title: s.courseName,
      preview: s.examDate ? `Exam ${new Date(s.examDate).toLocaleDateString()}` : '',
      route: '/calendar',
      typeLabel: 'SCHEDULE',
      score: 0,
    })
  }

  return results
}

function scoreResult(result: SearchResult, query: string): number {
  const q = query.toLowerCase()
  const title = (result.title ?? '').toLowerCase()
  const preview = (result.preview ?? '').toLowerCase()
  const combined = `${title} ${preview} ${result.typeLabel.toLowerCase()}`

  if (title.startsWith(q)) return 100
  if (title.includes(q)) return 80
  if (preview.includes(q)) return 50
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1 && words.every(w => combined.includes(w))) return 60
  if (combined.includes(q)) return 40
  return 0
}

interface Props {
  onClose: () => void
}

export default function OmniSearch({ onClose }: Props) {
  const { data } = useStore()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const index = useMemo(() => buildIndex(data), [data])

  // Detect command palette mode: query starts with '>'
  const isCommandMode = query.startsWith('>')
  const effectiveQuery = isCommandMode ? query.slice(1).trim() : query.trim()

  const results = useMemo(() => {
    if (isCommandMode) return []
    if (!effectiveQuery) return []
    return index
      .map(r => ({ ...r, score: scoreResult(r, effectiveQuery) }))
      .filter(r => r.score >= 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
  }, [effectiveQuery, isCommandMode, index])

  const grouped = useMemo(() => {
    const map = new Map<ResultType, SearchResult[]>()
    for (const r of results) {
      if (!map.has(r.type)) map.set(r.type, [])
      map.get(r.type)!.push(r)
    }
    return TYPE_ORDER
      .filter(t => map.has(t))
      .map(t => ({ type: t, items: map.get(t)! }))
  }, [results])

  // Filtered quick actions
  const filteredActions = useMemo(() => {
    if (!effectiveQuery) return QUICK_ACTIONS
    const q = effectiveQuery.toLowerCase()
    return QUICK_ACTIONS.filter(a =>
      a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    )
  }, [effectiveQuery])

  // Determine if we show actions (always show when command mode, also show when no query or when query < 2)
  const showActions = isCommandMode || !effectiveQuery || effectiveQuery.length < 2

  // Flat display order for keyboard nav — results first, then actions
  const displayOrder = useMemo(() => {
    const resultItems = grouped.flatMap(g => g.items)
    return { results: resultItems, actions: showActions ? filteredActions : [] }
  }, [grouped, filteredActions, showActions])

  const totalNavItems = displayOrder.results.length + displayOrder.actions.length

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setSelectedIndex(0) }, [query])

  const handleSelect = useCallback((result: SearchResult) => {
    navigate(result.route)
    onClose()
  }, [navigate, onClose])

  const handleActionSelect = useCallback((action: QuickAction) => {
    navigate(action.route)
    onClose()
  }, [navigate, onClose])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, totalNavItems - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const ri = displayOrder.results.length
        if (selectedIndex < ri) {
          if (displayOrder.results[selectedIndex]) handleSelect(displayOrder.results[selectedIndex])
        } else {
          const actionIdx = selectedIndex - ri
          if (displayOrder.actions[actionIdx]) handleActionSelect(displayOrder.actions[actionIdx])
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [displayOrder, selectedIndex, totalNavItems, handleSelect, handleActionSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    listRef.current?.querySelector('.omni-result-selected')?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const hasContent = grouped.length > 0 || (showActions && filteredActions.length > 0)

  return (
    <div className="omni-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Search">
      <div className="omni-modal" onClick={e => e.stopPropagation()}>
        <div className="omni-input-row">
          <Search size={16} className="omni-search-icon" />
          <input
            ref={inputRef}
            className="omni-input"
            placeholder="Search or type > for commands..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="omni-clear" onClick={() => setQuery('')} aria-label="Clear">
              <X size={14} />
            </button>
          )}
          <kbd className="omni-esc-hint">ESC</kbd>
        </div>
        {hasContent ? (
          <div className="omni-results" ref={listRef}>
            {/* Regular search results */}
            {grouped.map(({ type, items }) => (
              <div key={type} className="omni-group">
                <div className="omni-group-label">{TYPE_LABELS[type]}</div>
                {items.map(result => {
                  const idx = displayOrder.results.indexOf(result)
                  const isSelected = idx === selectedIndex
                  const Icon = TYPE_ICONS[result.type]
                  return (
                    <div
                      key={result.id}
                      className={`omni-result${isSelected ? ' omni-result-selected' : ''}`}
                      onClick={() => handleSelect(result)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Icon size={14} className="omni-result-icon" />
                      <div className="omni-result-text">
                        <span className="omni-result-title">{result.title}</span>
                        {result.preview && (
                          <span className="omni-result-preview">{result.preview}</span>
                        )}
                      </div>
                      <span className="omni-result-type">{result.typeLabel}</span>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Actions section */}
            {showActions && filteredActions.length > 0 && (
              <div className="omni-group">
                <div className="omni-group-label">Actions</div>
                {filteredActions.map((action, i) => {
                  const idx = displayOrder.results.length + i
                  const isSelected = idx === selectedIndex
                  return (
                    <div
                      key={action.id}
                      className={`omni-result${isSelected ? ' omni-result-selected' : ''}`}
                      onClick={() => handleActionSelect(action)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                    >
                      <Zap size={14} className="omni-result-icon" />
                      <div className="omni-result-text">
                        <span className="omni-result-title">{action.label}</span>
                        <span className="omni-result-preview">{action.description}</span>
                      </div>
                      <span className="omni-result-type">ACTION</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : effectiveQuery.length >= 2 && !showActions ? (
          <div className="omni-empty">No results for "{effectiveQuery}" — try different keywords, or type <kbd style={{ background: 'var(--surface-2, #222)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>&gt; new note</kbd> to create content</div>
        ) : (
          <div className="omni-hint">
            <span>Start typing to search · Type <kbd style={{ background: 'var(--surface-2, #222)', borderRadius: 4, padding: '1px 5px', fontSize: 11 }}>&gt;</kbd> for commands</span>
          </div>
        )}
      </div>
    </div>
  )
}
