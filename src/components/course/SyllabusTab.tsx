/**
 * SyllabusTab — Phase 6: Upload, parse, review, and save syllabus data.
 *
 * Status machine: idle → extracting → parsing → review → saved
 *                                              ↘ error
 */

import React, { useState, useRef, useCallback } from 'react'
import type { DragEvent } from 'react'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import { parseSyllabus } from '../../utils/syllabusParser'
import type { Course, CourseSpace, CourseCalendarEvent, SyllabusParseResult } from '../../types'

// ─── Types ─────────────────────────────────────────────────────────────────

type Status = 'idle' | 'extracting' | 'parsing' | 'review' | 'saved' | 'error'

type DuplicateAction = 'new_only' | 'replace_all' | 'cancel'

interface DuplicateInfo {
  existingCount: number
  newOnlyCount: number
  allNewEvents: CourseCalendarEvent[]
}

interface GradingConflict {
  syllabusCategories: SyllabusParseResult['gradingBreakdown']
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function mapAssignmentType(type: string): CourseCalendarEvent['type'] {
  const map: Record<string, CourseCalendarEvent['type']> = {
    quiz: 'quiz',
    exam: 'exam',
    homework: 'assignment',
    lab: 'lab',
    project: 'assignment',
    other: 'other',
  }
  return map[type] ?? 'other'
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  course: Course
  accentColor: string
}

export default function SyllabusTab({ course, accentColor }: Props) {
  const { data, setData } = useStore()
  const space = getCourseSpace(data?.pluginData?.courseSpaces, course.id)
  const syllabus = space.syllabus

  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [parsedResult, setParsedResult] = useState<SyllabusParseResult | null>(null)
  const [showPasteArea, setShowPasteArea] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [showManualFallback, setShowManualFallback] = useState(false)
  const [manualText, setManualText] = useState('')
  const [largeDocWarning, setLargeDocWarning] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  // Editable review state
  const [reviewResult, setReviewResult] = useState<SyllabusParseResult | null>(null)

  // Duplicate/conflict modal state
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null)
  const [gradingConflict, setGradingConflict] = useState<GradingConflict | null>(null)

  // Pending save while waiting for duplicate/grading decisions
  const pendingSaveRef = useRef<{
    result: SyllabusParseResult
    uniqueNewEvents: CourseCalendarEvent[]
    allNewEvents: CourseCalendarEvent[]
    replaceAll: boolean
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Save helper ────────────────────────────────────────────────────────

  function saveSpace(patch: Partial<CourseSpace>) {
    setData(prev => {
      if (!prev) return prev
      const prevSpace = getCourseSpace(prev.pluginData?.courseSpaces, course.id)
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          courseSpaces: {
            ...(prev.pluginData?.courseSpaces ?? {}),
            [course.id]: { ...prevSpace, ...patch, updatedAt: new Date().toISOString() },
          },
        },
      }
    })
  }

  // ─── Text extraction ────────────────────────────────────────────────────

  async function extractTextFromPdf(file: File): Promise<string | null> {
    return new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) { resolve(null); return }

        try {
          // Try pdfjs-dist dynamic import
          const pdfjsLib = await import('pdfjs-dist')
          // Set worker source — use CDN worker matching the installed version
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
          }

          // Convert data URL to Uint8Array
          const base64 = dataUrl.split(',')[1]
          const binary = atob(base64)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

          const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
          const pages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            const pageText = content.items
              .map((item) => {
                if ('str' in item) return (item as { str: string }).str
                return ''
              })
              .join(' ')
            pages.push(pageText)
          }
          resolve(pages.join('\n'))
        } catch (err) {
          console.warn('[SyllabusTab] pdfjs failed:', err)
          resolve(null)
        }
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  async function handleFile(file: File) {
    setStatus('extracting')
    setShowManualFallback(false)
    setLargeDocWarning(false)

    let rawText = ''

    if (file.type === 'application/pdf') {
      const extracted = await extractTextFromPdf(file)
      if (!extracted || extracted.trim().length < 20) {
        // pdfjs failed or empty — show manual fallback
        setStatus('idle')
        setShowManualFallback(true)
        setErrorMsg('Couldn\'t read this file. Try a different PDF or paste the text manually.')
        return
      }
      rawText = extracted
    } else if (file.type.startsWith('image/')) {
      // For images: use base64 and send to AI directly via manual textarea prompt
      // We don't have vision routing here, so fall back to manual
      setStatus('idle')
      setShowManualFallback(true)
      setErrorMsg('Image syllabi can\'t be extracted automatically. Please paste the text manually.')
      return
    } else {
      // Plain text file
      rawText = await file.text()
    }

    if (rawText.length > 50_000) {
      setLargeDocWarning(true)
    }

    await runParse(rawText)
  }

  async function runParse(text: string) {
    setStatus('parsing')
    setErrorMsg('')
    try {
      const result = await parseSyllabus(text, course.id)
      setParsedResult(result)
      setReviewResult({ ...result, examDates: [...result.examDates], assignmentDates: [...result.assignmentDates] })
      setStatus('review')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'OFFLINE') {
        setErrorMsg('You\'re offline — syllabus parsing requires an internet connection.')
      } else if (msg === 'TIMEOUT') {
        setErrorMsg('Request timed out. Check your connection and try again.')
      } else {
        setErrorMsg('Parse failed. Check your AI API key in Settings.')
      }
      setStatus('error')
    }
  }

  // ─── Drag & Drop ────────────────────────────────────────────────────────

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  // ─── Save logic ─────────────────────────────────────────────────────────

  function buildNewEvents(result: SyllabusParseResult): CourseCalendarEvent[] {
    return [
      ...result.examDates.map(e => ({
        id: generateId(),
        courseId: course.id,
        title: e.title,
        date: e.date,
        type: 'exam' as const,
        topicIds: e.topics,
        source: 'syllabus' as const,
      })),
      ...result.assignmentDates.map(e => ({
        id: generateId(),
        courseId: course.id,
        title: e.title,
        date: e.date,
        type: mapAssignmentType(e.type),
        topicIds: [],
        source: 'syllabus' as const,
      })),
    ]
  }

  function commitSave(
    result: SyllabusParseResult,
    eventsToSave: CourseCalendarEvent[],
    replaceAll: boolean,
    applyNewGrading?: boolean  // overrides auto-detect when grading conflict was resolved
  ) {
    const currentSpace = getCourseSpace(data?.pluginData?.courseSpaces, course.id)

    const finalEvents = replaceAll
      ? eventsToSave
      : [
          ...currentSpace.calendarEvents.filter(e => e.source !== 'syllabus'),
          ...eventsToSave,
        ]

    const patch: Partial<CourseSpace> = {
      syllabus: result,
      calendarEvents: finalEvents,
    }

    // Grading: apply if explicitly requested, or auto-apply if no existing categories
    const shouldApply = applyNewGrading ?? (currentSpace.gradeCategories.length === 0)
    if (shouldApply && result.gradingBreakdown.length > 0) {
      patch.gradeCategories = result.gradingBreakdown
    }

    saveSpace(patch)
    setStatus('saved')
    setDuplicateInfo(null)
    setGradingConflict(null)
    pendingSaveRef.current = null
  }

  function handleSave() {
    if (!reviewResult) return
    const currentSpace = getCourseSpace(data?.pluginData?.courseSpaces, course.id)
    const newEvents = buildNewEvents(reviewResult)

    // Duplicate detection
    const existingKeys = new Set(
      currentSpace.calendarEvents
        .filter(e => e.source === 'syllabus')
        .map(e => `${e.title.toLowerCase()}|${e.date}`)
    )
    const uniqueNewEvents = newEvents.filter(
      e => !existingKeys.has(`${e.title.toLowerCase()}|${e.date}`)
    )
    const existingCount = newEvents.length - uniqueNewEvents.length

    pendingSaveRef.current = { result: reviewResult, uniqueNewEvents, allNewEvents: newEvents, replaceAll: false }

    if (existingCount > 0) {
      setDuplicateInfo({ existingCount, newOnlyCount: uniqueNewEvents.length, allNewEvents: newEvents })
      return
    }

    // Grading conflict check
    if (
      currentSpace.gradeCategories.length > 0 &&
      reviewResult.gradingBreakdown.length > 0
    ) {
      setGradingConflict({ syllabusCategories: reviewResult.gradingBreakdown })
      return
    }

    commitSave(reviewResult, uniqueNewEvents, false)
  }

  function handleDuplicateAction(action: DuplicateAction) {
    if (!pendingSaveRef.current) return
    const { result, uniqueNewEvents, allNewEvents } = pendingSaveRef.current
    setDuplicateInfo(null)

    if (action === 'cancel') return

    const eventsToSave = action === 'replace_all' ? allNewEvents : uniqueNewEvents
    const replaceAll = action === 'replace_all'

    // Now check grading conflict
    const currentSpace = getCourseSpace(data?.pluginData?.courseSpaces, course.id)
    if (
      currentSpace.gradeCategories.length > 0 &&
      result.gradingBreakdown.length > 0
    ) {
      // Store resolved event list and replaceAll flag for after grading decision
      pendingSaveRef.current = { result, uniqueNewEvents: eventsToSave, allNewEvents: eventsToSave, replaceAll }
      setGradingConflict({ syllabusCategories: result.gradingBreakdown })
      return
    }

    commitSave(result, eventsToSave, replaceAll)
  }

  function handleGradingDecision(applyNew: boolean) {
    if (!pendingSaveRef.current) return
    const { result, uniqueNewEvents, replaceAll } = pendingSaveRef.current
    setGradingConflict(null)
    // Delegate entirely to commitSave — passes applyNewGrading to override auto-detect
    commitSave(result, uniqueNewEvents, replaceAll, applyNew)
  }

  // ─── Review editing helpers ─────────────────────────────────────────────

  function updateExamDate(index: number, field: 'title' | 'date', value: string) {
    if (!reviewResult) return
    const updated = [...reviewResult.examDates]
    updated[index] = { ...updated[index], [field]: value }
    setReviewResult({ ...reviewResult, examDates: updated })
  }

  function removeExamDate(index: number) {
    if (!reviewResult) return
    const updated = reviewResult.examDates.filter((_, i) => i !== index)
    setReviewResult({ ...reviewResult, examDates: updated })
  }

  function addExamDate() {
    if (!reviewResult) return
    setReviewResult({
      ...reviewResult,
      examDates: [...reviewResult.examDates, { title: '', date: '', topics: [] }],
    })
  }

  function updateAssignmentDate(index: number, field: 'title' | 'date', value: string) {
    if (!reviewResult) return
    const updated = [...reviewResult.assignmentDates]
    updated[index] = { ...updated[index], [field]: value }
    setReviewResult({ ...reviewResult, assignmentDates: updated })
  }

  function removeAssignmentDate(index: number) {
    if (!reviewResult) return
    const updated = reviewResult.assignmentDates.filter((_, i) => i !== index)
    setReviewResult({ ...reviewResult, assignmentDates: updated })
  }

  function addAssignmentDate() {
    if (!reviewResult) return
    setReviewResult({
      ...reviewResult,
      assignmentDates: [...reviewResult.assignmentDates, { title: '', date: '', type: 'other' }],
    })
  }

  // ─── Render helpers ─────────────────────────────────────────────────────

  function renderConfidenceBanner(confidence: 'high' | 'medium' | 'low') {
    if (confidence === 'low') {
      return (
        <div style={{
          background: 'rgba(245,166,35,0.15)',
          border: '1px solid var(--yellow)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          marginBottom: 16,
          color: 'var(--yellow)',
          fontSize: 13,
        }}>
          ⚠ Some dates may be inaccurate — please review carefully before saving.
        </div>
      )
    }
    if (confidence === 'medium') {
      return (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          marginBottom: 16,
          color: 'var(--text-secondary)',
          fontSize: 13,
        }}>
          Moderate confidence — most dates are likely accurate but worth a quick review.
        </div>
      )
    }
    return (
      <div style={{
        background: 'rgba(80,200,120,0.12)',
        border: '1px solid var(--green)',
        borderRadius: 'var(--radius)',
        padding: '10px 14px',
        marginBottom: 16,
        color: 'var(--green)',
        fontSize: 13,
      }}>
        ✓ High confidence parse
      </div>
    )
  }

  function renderExistingSyllabus() {
    if (!syllabus) return null
    const examCount = syllabus.examDates.length
    const assignmentCount = syllabus.assignmentDates.length
    const weekCount = syllabus.weeklyTopics.length

    return (
      <div className="card mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Syllabus uploaded</div>
            <div className="text-muted text-xs">
              {examCount} exam{examCount !== 1 ? 's' : ''} &middot; {assignmentCount} assignment{assignmentCount !== 1 ? 's' : ''} &middot; {weekCount} weekly topics
            </div>
            <div className="text-muted text-xs" style={{ marginTop: 2 }}>
              Confidence: {syllabus.parseConfidence}
            </div>
          </div>
          <button
            className="btn btn-sm"
            onClick={() => setStatus('idle')}
            style={{ marginLeft: 12 }}
          >
            Re-upload
          </button>
        </div>

        {syllabus.examDates.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Exams &amp; Assessments</div>
            {syllabus.examDates.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{e.title}</span>
                <span className="text-muted">{e.date}</span>
              </div>
            ))}
          </div>
        )}

        {syllabus.assignmentDates.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Assignments</div>
            {syllabus.assignmentDates.map((e, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span>{e.title}</span>
                <span className="text-muted">{e.date}</span>
              </div>
            ))}
          </div>
        )}

        {syllabus.gradingBreakdown.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Grading Breakdown</div>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, paddingBottom: 4 }}>Category</th>
                  <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500, paddingBottom: 4 }}>Weight</th>
                </tr>
              </thead>
              <tbody>
                {syllabus.gradingBreakdown.map((g, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{g.name}</td>
                    <td style={{ textAlign: 'right', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{g.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  // Modals
  const duplicateModal = duplicateInfo && (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Duplicate Events Detected</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {duplicateInfo.existingCount} event{duplicateInfo.existingCount !== 1 ? 's' : ''} already exist from a previous syllabus upload.
          Import {duplicateInfo.newOnlyCount} new one{duplicateInfo.newOnlyCount !== 1 ? 's' : ''} only, replace all, or cancel?
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-primary" onClick={() => handleDuplicateAction('new_only')}>
            New only ({duplicateInfo.newOnlyCount})
          </button>
          <button className="btn btn-sm" onClick={() => handleDuplicateAction('replace_all')}>
            Replace all
          </button>
          <button className="btn btn-sm" onClick={() => handleDuplicateAction('cancel')}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )

  const gradingModal = gradingConflict && (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div className="card" style={{ maxWidth: 420, width: '90%', padding: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Grading Breakdown Conflict</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
          The syllabus suggests different grade weights than your current Grade Book categories.
          Apply the syllabus weights or keep your current settings?
        </p>
        <div style={{ marginBottom: 16, fontSize: 13 }}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>Syllabus suggests:</div>
          {gradingConflict.syllabusCategories.map((c, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>{c.name}</span>
              <span className="text-muted">{c.weight}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={() => handleGradingDecision(true)}>
            Apply Syllabus Weights
          </button>
          <button className="btn btn-sm" onClick={() => handleGradingDecision(false)}>
            Keep My Settings
          </button>
        </div>
      </div>
    </div>
  )

  // Status: extracting
  if (status === 'extracting') {
    return (
      <div className="card">
        {duplicateModal}
        {gradingModal}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
          <div style={{
            width: 200, height: 14, borderRadius: 7,
            background: 'var(--bg-secondary)',
            animation: 'pulse 1.4s ease-in-out infinite',
          }} />
          <div style={{
            width: 140, height: 10, borderRadius: 5,
            background: 'var(--bg-secondary)',
            animation: 'pulse 1.4s ease-in-out 0.2s infinite',
          }} />
          <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Reading document…</div>
        </div>
      </div>
    )
  }

  // Status: parsing
  if (status === 'parsing') {
    return (
      <div className="card">
        {duplicateModal}
        {gradingModal}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            border: `3px solid var(--border)`,
            borderTopColor: accentColor,
            animation: 'spin 0.8s linear infinite',
          }} />
          <div style={{ fontWeight: 600 }}>AI is finding dates and topics…</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>This takes about 10–15 seconds</div>
        </div>
      </div>
    )
  }

  // Status: review
  if (status === 'review' && reviewResult) {
    return (
      <div>
        {duplicateModal}
        {gradingModal}

        {largeDocWarning && (
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--text-secondary)',
          }}>
            Large document detected — only the first ~50,000 characters were analyzed.
          </div>
        )}

        <div className="card mb-4">
          <div className="section-title mb-4">Review Parsed Syllabus</div>

          {renderConfidenceBanner(reviewResult.parseConfidence)}

          {/* Exam Dates */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              Exams &amp; Assessments ({reviewResult.examDates.length})
            </div>
            {reviewResult.examDates.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={e.title}
                  onChange={ev => updateExamDate(i, 'title', ev.target.value)}
                  placeholder="Title"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <input
                  type="date"
                  value={e.date}
                  onChange={ev => updateExamDate(i, 'date', ev.target.value)}
                  style={{
                    width: 140, padding: '6px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={() => removeExamDate(i)}
                  style={{ color: 'var(--red)', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={addExamDate} style={{ marginTop: 4 }}>
              + Add
            </button>
          </div>

          {/* Assignment Dates */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
              Assignments ({reviewResult.assignmentDates.length})
            </div>
            {reviewResult.assignmentDates.map((e, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  value={e.title}
                  onChange={ev => updateAssignmentDate(i, 'title', ev.target.value)}
                  placeholder="Title"
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <input
                  type="date"
                  value={e.date}
                  onChange={ev => updateAssignmentDate(i, 'date', ev.target.value)}
                  style={{
                    width: 140, padding: '6px 10px', borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13,
                  }}
                />
                <button
                  className="btn btn-sm"
                  onClick={() => removeAssignmentDate(i)}
                  style={{ color: 'var(--red)', padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={addAssignmentDate} style={{ marginTop: 4 }}>
              + Add
            </button>
          </div>

          {/* Grading Breakdown (read-only) */}
          {reviewResult.gradingBreakdown.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>
                Grading Breakdown
              </div>
              <div className="text-xs text-muted" style={{ marginBottom: 8 }}>
                These will be compared with your Grade Book categories when saved.
              </div>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 500, paddingBottom: 4 }}>Category</th>
                    <th style={{ textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 500, paddingBottom: 4 }}>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewResult.gradingBreakdown.map((g, i) => (
                    <tr key={i}>
                      <td style={{ padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{g.name}</td>
                      <td style={{ textAlign: 'right', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{g.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleSave}>
              Save to Syllabus
            </button>
            <button className="btn" onClick={() => { setStatus('idle'); setParsedResult(null); setReviewResult(null) }}>
              Discard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Status: error
  if (status === 'error') {
    return (
      <div className="card">
        {duplicateModal}
        {gradingModal}
        <div style={{ color: 'var(--red)', marginBottom: 12 }}>{errorMsg}</div>
        <button className="btn btn-sm" onClick={() => setStatus('idle')}>
          Try Again
        </button>
      </div>
    )
  }

  // Status: idle (or saved — returns to idle view)
  const hasSyllabus = syllabus !== null

  return (
    <div>
      {duplicateModal}
      {gradingModal}

      {largeDocWarning && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--text-secondary)',
        }}>
          Large document detected — only the first ~50,000 characters were analyzed.
        </div>
      )}

      {/* Existing syllabus summary */}
      {hasSyllabus && renderExistingSyllabus()}

      {/* Manual fallback error banner */}
      {showManualFallback && (
        <div style={{
          background: 'rgba(220,60,60,0.1)',
          border: '1px solid var(--red)',
          borderRadius: 'var(--radius)',
          padding: '10px 14px',
          marginBottom: 16,
          fontSize: 13,
          color: 'var(--red)',
        }}>
          {errorMsg}
        </div>
      )}

      {/* Upload area — only show when no syllabus exists, or always if re-uploading */}
      {(!hasSyllabus || status === 'idle') && (
        <div className="card">
          <div className="section-title mb-4">
            {hasSyllabus ? 'Re-upload Syllabus' : 'Upload Syllabus'}
          </div>

          {/* Drag & drop upload zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragOver ? accentColor : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '32px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              marginBottom: 16,
              background: isDragOver ? 'rgba(245,166,35,0.05)' : undefined,
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Drop PDF here or click to browse</div>
            <div className="text-muted text-xs">Supports PDF files and plain text</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,image/*"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />

          {/* Paste text toggle */}
          <button
            className="btn btn-sm"
            onClick={() => setShowPasteArea(p => !p)}
            style={{ marginBottom: showPasteArea ? 12 : 0 }}
          >
            {showPasteArea ? 'Hide text input' : 'Paste text instead'}
          </button>

          {showPasteArea && (
            <div>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste your syllabus text here…"
                rows={10}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                  marginTop: 8,
                  boxSizing: 'border-box',
                }}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={pasteText.trim().length < 10}
                onClick={() => runParse(pasteText)}
              >
                Parse Syllabus
              </button>
            </div>
          )}

          {/* Manual fallback textarea */}
          {showManualFallback && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Paste syllabus text manually:</div>
              <textarea
                value={manualText}
                onChange={e => setManualText(e.target.value)}
                placeholder="Paste your syllabus text here…"
                rows={10}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: 13,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
              <button
                className="btn btn-primary"
                style={{ marginTop: 8 }}
                disabled={manualText.trim().length < 10}
                onClick={() => { setShowManualFallback(false); runParse(manualText) }}
              >
                Parse Syllabus
              </button>
            </div>
          )}
        </div>
      )}

      {/* CSS for shimmer/spinner animations (injected inline) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
