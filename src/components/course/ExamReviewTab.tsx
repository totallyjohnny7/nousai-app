/**
 * ExamReviewTab — Phase 8: Upload Mode + OCR (extends Phase 7 manual entry)
 *
 * Entry modes:
 *   manual  — type everything by hand (Phase 7 behaviour)
 *   upload  — 1+ photos → AI OCR → pre-filled questions, user can edit
 *   hybrid  — single photo as visual reference, manual form on the side
 */

import React, { useState, useMemo, useRef } from 'react'
import { Plus, Trash2, Lock, Unlock, ChevronDown, ChevronRight, Zap, AlertTriangle } from 'lucide-react'
import type { Course, ExamReview, ExamQuestion, GapReport, SRCard } from '../../types'
import { useStore } from '../../store'
import { getCourseSpace } from '../../utils/courseSpaceInit'
import {
  generateGapReport,
  generateGapSummary,
  boostGapCardsInFSRS,
} from '../../utils/gapReport'
import { parseExamMultiPage } from '../../utils/examParser'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function autoStatus(earned: number, possible: number): ExamQuestion['status'] {
  if (possible <= 0) return 'incorrect'
  const pct = earned / possible
  if (pct >= 1.0) return 'correct'
  if (pct > 0) return 'partial'
  return 'incorrect'
}

function makeBlankQuestion(): ExamQuestion {
  return {
    id: generateId(),
    questionText: '',
    userAnswer: '',
    correctAnswer: '',
    pointsEarned: 0,
    pointsPossible: 1,
    conceptTag: '',
    note: '',
    status: 'incorrect',
    ocrConfidence: 'manual',
  }
}

// Read a File as base64 string (no "data:…;base64," prefix)
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // strip the "data:image/...;base64," prefix
      const b64 = result.split(',')[1] ?? result
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Read a File as data URL (for displaying preview)
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryMode = 'manual' | 'upload' | 'hybrid'

type OcrError =
  | 'none'
  | 'offline'
  | 'timeout'
  | 'zero_questions'
  | 'low_read_rate'
  | 'unknown'

interface ExamReviewFormState {
  title: string
  date: string
  questions: ExamQuestion[]
  status: 'editing' | 'generating_gap' | 'done'
}

function defaultForm(): ExamReviewFormState {
  return {
    title: '',
    date: todayIso(),
    questions: [makeBlankQuestion()],
    status: 'editing',
  }
}

// ─── Priority badge colours ────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  high: 'var(--red)',
  medium: 'var(--orange)',
  low: 'var(--green)',
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExamReviewTabProps {
  course: Course
  accentColor: string
}

export default function ExamReviewTab({ course, accentColor }: ExamReviewTabProps) {
  const { data, setData } = useStore()

  const space = useMemo(
    () => getCourseSpace(data?.pluginData?.courseSpaces, course.id),
    [data, course.id]
  )

  const reviews: ExamReview[] = useMemo(
    () =>
      (space.examReviews ?? []).slice().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [space.examReviews]
  )

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)
  const [form, setForm] = useState<ExamReviewFormState>(defaultForm)
  const [boostStatus, setBoostStatus] = useState<'idle' | 'boosting' | 'done' | 'error'>('idle')
  const [unlockConfirm, setUnlockConfirm] = useState(false)
  const [openQuestions, setOpenQuestions] = useState<Set<string>>(new Set())

  // ── Entry mode state ─────────────────────────────────────────────────────────

  const [entryMode, setEntryMode] = useState<EntryMode>('manual')

  // Upload mode
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [ocrProgress, setOcrProgress] = useState<{ page: number; total: number } | null>(null)
  const [ocrError, setOcrError] = useState<OcrError>('none')
  const [ocrLowReadWarning, setOcrLowReadWarning] = useState<{ read: number; total: number } | null>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)

  // Hybrid mode
  const [hybridFile, setHybridFile] = useState<File | null>(null)
  const [hybridDataUrl, setHybridDataUrl] = useState<string | null>(null)
  const hybridInputRef = useRef<HTMLInputElement>(null)

  // ── Save helper ─────────────────────────────────────────────────────────────

  function saveReview(review: ExamReview) {
    setData(prev => {
      if (!prev) return prev
      const prevSpace = getCourseSpace(prev.pluginData?.courseSpaces, course.id)
      const existing = prevSpace.examReviews ?? []
      const idx = existing.findIndex(r => r.id === review.id)
      const updated = idx >= 0
        ? existing.map(r => (r.id === review.id ? review : r))
        : [...existing, review]
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          courseSpaces: {
            ...(prev.pluginData?.courseSpaces ?? {}),
            [course.id]: {
              ...prevSpace,
              examReviews: updated,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      }
    })
  }

  function deleteReview(id: string) {
    setData(prev => {
      if (!prev) return prev
      const prevSpace = getCourseSpace(prev.pluginData?.courseSpaces, course.id)
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          courseSpaces: {
            ...(prev.pluginData?.courseSpaces ?? {}),
            [course.id]: {
              ...prevSpace,
              examReviews: (prevSpace.examReviews ?? []).filter(r => r.id !== id),
              updatedAt: new Date().toISOString(),
            },
          },
        },
      }
    })
  }

  // ── FSRS boost callbacks ────────────────────────────────────────────────────

  const saveCard = async (card: SRCard) => {
    setData(prev => {
      if (!prev) return prev
      const existing = prev.pluginData?.srData?.cards ?? []
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          srData: { cards: [...existing, card] },
        },
      }
    })
  }

  const reviewCard = async (card: SRCard, _grade: number) => {
    setData(prev => {
      if (!prev) return prev
      const cards = (prev.pluginData?.srData?.cards ?? []).map(c =>
        c.key === card.key
          ? { ...c, D: 8, state: 'learning', nextReview: new Date().toISOString() }
          : c
      )
      return {
        ...prev,
        pluginData: { ...prev.pluginData, srData: { cards } },
      }
    })
  }

  // ── Form question helpers ────────────────────────────────────────────────────

  function updateQuestion(id: string, patch: Partial<ExamQuestion>) {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.map(q => {
        if (q.id !== id) return q
        const merged = { ...q, ...patch }
        if (
          (patch.pointsEarned !== undefined || patch.pointsPossible !== undefined) &&
          patch.status === undefined
        ) {
          merged.status = autoStatus(merged.pointsEarned, merged.pointsPossible)
        }
        return merged
      }),
    }))
  }

  function addQuestion() {
    setForm(prev => ({ ...prev, questions: [...prev.questions, makeBlankQuestion()] }))
  }

  function removeQuestion(id: string) {
    setForm(prev => ({
      ...prev,
      questions: prev.questions.filter(q => q.id !== id),
    }))
  }

  // ── OCR extraction ───────────────────────────────────────────────────────────

  async function handleExtractQuestions() {
    if (uploadFiles.length === 0) return
    setOcrError('none')
    setOcrLowReadWarning(null)
    setOcrProgress({ page: 0, total: uploadFiles.length })

    try {
      const base64Images = await Promise.all(uploadFiles.map(f => fileToBase64(f)))

      const questions = await parseExamMultiPage(base64Images, (page, total) => {
        setOcrProgress({ page, total })
      })

      setOcrProgress(null)

      if (questions.length === 0) {
        setOcrError('zero_questions')
        return
      }

      // Estimate expected questions (rough heuristic: 5 per page)
      const estimatedTotal = uploadFiles.length * 5
      const readRate = questions.length / estimatedTotal
      if (readRate < 0.5 && estimatedTotal > 2) {
        setOcrLowReadWarning({ read: questions.length, total: estimatedTotal })
      }

      setForm(prev => ({
        ...prev,
        questions,
      }))
    } catch (err: unknown) {
      setOcrProgress(null)
      const msg = err instanceof Error ? err.message : String(err)
      if (msg === 'OFFLINE') {
        setOcrError('offline')
      } else if (msg === 'TIMEOUT') {
        setOcrError('timeout')
      } else {
        setOcrError('unknown')
        console.error('[ExamReviewTab] OCR error:', err)
      }
    }
  }

  function handleUploadFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setUploadFiles(files)
    setOcrError('none')
    setOcrLowReadWarning(null)
    // Reset extracted questions when new files are chosen
    setForm(prev => ({ ...prev, questions: [makeBlankQuestion()] }))
  }

  async function handleHybridFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setHybridFile(file)
    if (file) {
      const url = await fileToDataUrl(file)
      setHybridDataUrl(url)
    } else {
      setHybridDataUrl(null)
    }
  }

  // ── Generate gap report ──────────────────────────────────────────────────────

  async function handleGenerateGap() {
    if (!form.title.trim()) {
      alert('Please enter a title for the exam.')
      return
    }
    const invalid = form.questions.find(
      q =>
        !q.questionText.trim() ||
        !q.correctAnswer.trim() ||
        !q.conceptTag.trim() ||
        q.pointsPossible <= 0
    )
    if (invalid) {
      alert(
        'Each question needs: question text, correct answer, concept tag, and points possible > 0.'
      )
      return
    }

    const questions: ExamQuestion[] = form.questions.map(q => ({
      ...q,
      // For manual/hybrid entry, override confidence; upload retains ai_read / ai_uncertain
      ocrConfidence: entryMode === 'manual' || entryMode === 'hybrid'
        ? ('manual' as const)
        : q.ocrConfidence,
    }))

    const totalScore = questions.reduce((s, q) => s + q.pointsEarned, 0)
    const totalPossible = questions.reduce((s, q) => s + q.pointsPossible, 0)

    const gapResult = generateGapReport(questions, form.title, course.name)

    setForm(prev => ({ ...prev, status: 'generating_gap' }))

    let aiSummary: string | null = null
    try {
      aiSummary = await generateGapSummary(
        gapResult.weakConcepts,
        form.title,
        course.name
      )
    } catch {
      // silently ignore
    }

    const reviewId =
      selectedReviewId === 'new' ? generateId() : (selectedReviewId ?? generateId())

    const existingReview =
      selectedReviewId !== 'new'
        ? reviews.find(r => r.id === selectedReviewId)
        : undefined

    const review: ExamReview = {
      id: reviewId,
      courseId: course.id,
      title: form.title.trim(),
      date: form.date,
      totalScore,
      totalPossible,
      questions,
      gapReport: { ...gapResult, summary: aiSummary },
      gapReportComplete: true,
      createdAt: existingReview?.createdAt ?? new Date().toISOString(),
      locked: true,
    }

    saveReview(review)
    setForm(prev => ({ ...prev, status: 'done' }))
    setSelectedReviewId(reviewId)
    setBoostStatus('idle')
  }

  // ── Boost FSRS ───────────────────────────────────────────────────────────────

  async function handleBoostFSRS(review: ExamReview) {
    setBoostStatus('boosting')
    try {
      const existingCards = data?.pluginData?.srData?.cards ?? []
      await boostGapCardsInFSRS(
        review.gapReport.weakConcepts,
        course.id,
        existingCards,
        saveCard,
        reviewCard
      )
      const updated: ExamReview = {
        ...review,
        gapReport: { ...review.gapReport, flashcardsGenerated: true },
      }
      saveReview(updated)
      setBoostStatus('done')
    } catch {
      setBoostStatus('error')
    }
  }

  // ── Select review / unlock ───────────────────────────────────────────────────

  function openReview(r: ExamReview) {
    if (r.locked) {
      setSelectedReviewId(r.id)
      setUnlockConfirm(false)
      setBoostStatus('idle')
    } else {
      setForm({
        title: r.title,
        date: r.date,
        questions: r.questions.map(q => ({ ...q })),
        status: 'editing',
      })
      setSelectedReviewId(r.id)
      setBoostStatus('idle')
    }
  }

  function startNew() {
    setForm(defaultForm())
    setSelectedReviewId('new')
    setBoostStatus('idle')
    setUnlockConfirm(false)
    setEntryMode('manual')
    setUploadFiles([])
    setOcrError('none')
    setOcrLowReadWarning(null)
    setOcrProgress(null)
    setHybridFile(null)
    setHybridDataUrl(null)
  }

  function goBack() {
    setSelectedReviewId(null)
    setUnlockConfirm(false)
    setBoostStatus('idle')
    setOpenQuestions(new Set())
  }

  function confirmUnlock(review: ExamReview) {
    const unlocked: ExamReview = { ...review, locked: false }
    saveReview(unlocked)
    setForm({
      title: review.title,
      date: review.date,
      questions: review.questions.map(q => ({ ...q })),
      status: 'editing',
    })
    setUnlockConfirm(false)
  }

  function toggleQuestion(id: string) {
    setOpenQuestions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── OCR error message ────────────────────────────────────────────────────────

  function renderOcrError() {
    if (ocrError === 'none') return null

    const messages: Record<OcrError, string> = {
      none: '',
      offline: "You're offline — exam analysis requires an internet connection.",
      timeout: 'Analysis timed out. Try again or switch to Manual Entry.',
      zero_questions: "No questions could be read. Fill them in using Manual Entry.",
      low_read_rate: '', // handled separately via ocrLowReadWarning
      unknown: "Couldn't read the image clearly. Use Manual Entry or take a clearer photo.",
    }

    const showRetry = ocrError === 'timeout' || ocrError === 'unknown'

    return (
      <div
        style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid var(--red)',
          borderRadius: 6,
          padding: '10px 14px',
          fontSize: 13,
          color: 'var(--red)',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{messages[ocrError]}</span>
        {showRetry && (
          <button
            className="btn btn-sm"
            style={{ color: 'var(--red)', borderColor: 'var(--red)', flexShrink: 0 }}
            onClick={() => { setOcrError('none'); handleExtractQuestions() }}
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: List View
  // ─────────────────────────────────────────────────────────────────────────────

  if (selectedReviewId === null) {
    return (
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h2 className="section-title" style={{ margin: 0 }}>
            Exam Reviews
          </h2>
          <button className="btn btn-primary btn-sm" onClick={startNew}>
            <Plus size={14} style={{ marginRight: 4 }} />
            New Review
          </button>
        </div>

        {reviews.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 16px',
              color: 'var(--text-dim)',
              fontSize: 14,
            }}
          >
            No exam reviews yet. Log an exam to see your gap report.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {reviews.map(r => {
              const pct =
                r.totalPossible > 0
                  ? Math.round((r.totalScore / r.totalPossible) * 100)
                  : 0
              return (
                <div
                  key={r.id}
                  className="card"
                  style={{ cursor: 'pointer', padding: '12px 16px' }}
                  onClick={() => openReview(r)}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {r.locked ? (
                        <Lock size={14} color="var(--text-dim)" />
                      ) : (
                        <Unlock size={14} color="var(--text-dim)" />
                      )}
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.title}
                      </span>
                    </div>
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}
                    >
                      {r.gapReportComplete && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            background: accentColor,
                            color: '#000',
                            borderRadius: 4,
                            padding: '2px 6px',
                          }}
                        >
                          Gap Report
                        </span>
                      )}
                      <button
                        className="btn btn-sm"
                        style={{ color: 'var(--red)', padding: '2px 6px' }}
                        onClick={e => {
                          e.stopPropagation()
                          if (confirm('Delete this exam review?')) deleteReview(r.id)
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: 'var(--text-dim)',
                      display: 'flex',
                      gap: 16,
                    }}
                  >
                    <span>{r.date}</span>
                    <span style={{ fontWeight: 700, color: pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)' }}>
                      {r.totalScore}/{r.totalPossible} ({pct}%)
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: Detail View (locked review)
  // ─────────────────────────────────────────────────────────────────────────────

  const lockedReview =
    selectedReviewId !== 'new'
      ? reviews.find(r => r.id === selectedReviewId)
      : undefined

  if (lockedReview?.locked) {
    const r = lockedReview
    const pct =
      r.totalPossible > 0 ? Math.round((r.totalScore / r.totalPossible) * 100) : 0

    return (
      <div>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            gap: 8,
          }}
        >
          <button className="btn btn-sm" onClick={goBack}>
            ← Back
          </button>
          <h2
            className="section-title"
            style={{ margin: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {r.title}
          </h2>
          {!unlockConfirm ? (
            <button className="btn btn-sm" onClick={() => setUnlockConfirm(true)}>
              <Unlock size={13} style={{ marginRight: 4 }} />
              Edit
            </button>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 10px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                Editing will recalculate your Gap Report after you save. Continue?
              </span>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => confirmUnlock(r)}
              >
                Yes, Edit
              </button>
              <button className="btn btn-sm" onClick={() => setUnlockConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Score */}
        <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div className="text-xs text-muted">Date</div>
              <div style={{ fontWeight: 600 }}>{r.date}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Score</div>
              <div
                style={{
                  fontWeight: 700,
                  color: pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--orange)' : 'var(--red)',
                }}
              >
                {r.totalScore}/{r.totalPossible} ({pct}%)
              </div>
            </div>
            <div>
              <div className="text-xs text-muted">Questions</div>
              <div style={{ fontWeight: 600 }}>{r.questions.length}</div>
            </div>
          </div>
        </div>

        {/* Gap Report */}
        {r.gapReportComplete && (
          <div className="card mb-4" style={{ padding: '12px 16px' }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                marginBottom: 10,
                color: accentColor,
              }}
            >
              Gap Report
            </div>

            {r.gapReport.summary && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  marginBottom: 12,
                  lineHeight: 1.5,
                }}
              >
                {r.gapReport.summary}
              </p>
            )}

            {r.gapReport.weakConcepts.length === 0 ? (
              <div style={{ color: 'var(--green)', fontSize: 13 }}>
                No gaps found — all answers marked correct.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {r.gapReport.weakConcepts.map(c => (
                  <div
                    key={c.concept}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#fff',
                        background: PRIORITY_COLOR[c.priority] ?? 'var(--text-dim)',
                        borderRadius: 4,
                        padding: '2px 5px',
                        flexShrink: 0,
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.priority}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {c.concept}
                    </span>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                      {c.wrongCount}× wrong · −{c.pointsLost.toFixed(1)} pts
                    </span>
                  </div>
                ))}
              </div>
            )}

            {r.gapReport.weakConcepts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={boostStatus === 'boosting'}
                  onClick={() => handleBoostFSRS(r)}
                >
                  <Zap size={13} style={{ marginRight: 4 }} />
                  {boostStatus === 'boosting'
                    ? 'Boosting…'
                    : boostStatus === 'done'
                    ? 'Re-Boost in FSRS'
                    : 'Boost in FSRS'}
                </button>
                {boostStatus === 'done' && (
                  <span style={{ fontSize: 12, color: 'var(--green)' }}>
                    Cards queued for review!
                  </span>
                )}
                {boostStatus === 'error' && (
                  <span style={{ fontSize: 12, color: 'var(--red)' }}>
                    Some cards failed — check console.
                  </span>
                )}
                {r.gapReport.flashcardsGenerated && boostStatus === 'idle' && (
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    Already boosted once.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Questions accordion */}
        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
          Questions ({r.questions.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {r.questions.map((q, idx) => {
            const isOpen = openQuestions.has(q.id)
            return (
              <div
                key={q.id}
                className="card"
                style={{ padding: '10px 14px', cursor: 'pointer' }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => toggleQuestion(q.id)}
                >
                  {isOpen ? (
                    <ChevronDown size={14} color="var(--text-dim)" />
                  ) : (
                    <ChevronRight size={14} color="var(--text-dim)" />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    Q{idx + 1}.{' '}
                    <span style={{ fontWeight: 400 }}>
                      {q.questionText.length > 80
                        ? q.questionText.slice(0, 80) + '…'
                        : q.questionText}
                    </span>
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        q.status === 'correct'
                          ? 'var(--green)'
                          : q.status === 'partial'
                          ? 'var(--orange)'
                          : 'var(--red)',
                    }}
                  >
                    {q.pointsEarned}/{q.pointsPossible}
                  </span>
                </div>
                {isOpen && (
                  <div style={{ marginTop: 10, paddingLeft: 22, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span className="text-muted text-xs">Your answer: </span>
                      <span>{q.userAnswer || '(blank)'}</span>
                    </div>
                    <div>
                      <span className="text-muted text-xs">Correct: </span>
                      <span>{q.correctAnswer}</span>
                    </div>
                    <div>
                      <span className="text-muted text-xs">Concept: </span>
                      <span style={{ color: accentColor, fontWeight: 600 }}>{q.conceptTag}</span>
                    </div>
                    {q.note && (
                      <div>
                        <span className="text-muted text-xs">Note: </span>
                        <span>{q.note}</span>
                      </div>
                    )}
                    <div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color:
                            q.status === 'correct'
                              ? 'var(--green)'
                              : q.status === 'partial'
                              ? 'var(--orange)'
                              : 'var(--red)',
                        }}
                      >
                        {q.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER: New/Edit Form
  // ─────────────────────────────────────────────────────────────────────────────

  const isGenerating = form.status === 'generating_gap'
  const isExtracting = ocrProgress !== null

  // ── Shared question form ─────────────────────────────────────────────────────

  function renderQuestionForm() {
    return (
      <>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--text-primary)' }}>
          Questions ({form.questions.length})
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {form.questions.map((q, idx) => {
            const isUncertain = q.ocrConfidence === 'ai_uncertain'
            return (
              <div
                key={q.id}
                className="card"
                style={{
                  padding: '14px 16px',
                  background: isUncertain ? 'rgba(234,179,8,0.12)' : undefined,
                  border: isUncertain ? '1px solid rgba(234,179,8,0.4)' : undefined,
                }}
              >
                {/* Question header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-secondary)' }}>
                      Question {idx + 1}
                    </span>
                    {isUncertain && (
                      <span
                        title="AI was unsure — please verify"
                        style={{ cursor: 'help', display: 'flex', alignItems: 'center' }}
                      >
                        <AlertTriangle size={13} color="rgba(234,179,8,0.9)" />
                      </span>
                    )}
                  </div>
                  {form.questions.length > 1 && (
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--red)', padding: '2px 6px' }}
                      onClick={() => removeQuestion(q.id)}
                      disabled={isGenerating || isExtracting}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Question text */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    Question text *
                  </label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 60, resize: 'vertical' }}
                    placeholder="What was the question?"
                    value={q.questionText}
                    onChange={e => updateQuestion(q.id, { questionText: e.target.value })}
                    disabled={isGenerating || isExtracting}
                  />
                </div>

                {/* User answer */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    What I wrote
                  </label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 48, resize: 'vertical' }}
                    placeholder="Your answer — leave blank if unanswered"
                    value={q.userAnswer}
                    onChange={e => updateQuestion(q.id, { userAnswer: e.target.value })}
                    disabled={isGenerating || isExtracting}
                  />
                </div>

                {/* Correct answer */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    Correct answer *
                  </label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 48, resize: 'vertical' }}
                    placeholder="Correct answer"
                    value={q.correctAnswer}
                    onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                    disabled={isGenerating || isExtracting}
                  />
                </div>

                {/* Points row */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                      Points earned *
                    </label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      min={0}
                      value={q.pointsEarned}
                      onChange={e =>
                        updateQuestion(q.id, { pointsEarned: parseFloat(e.target.value) || 0 })
                      }
                      disabled={isGenerating || isExtracting}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 80 }}>
                    <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                      Points possible *
                    </label>
                    <input
                      type="number"
                      className="input"
                      style={{ width: '100%' }}
                      min={0.1}
                      step={0.1}
                      value={q.pointsPossible}
                      onChange={e =>
                        updateQuestion(q.id, { pointsPossible: parseFloat(e.target.value) || 1 })
                      }
                      disabled={isGenerating || isExtracting}
                    />
                  </div>
                </div>

                {/* Concept tag */}
                <div style={{ marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    Concept tag *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="e.g., Cell Division"
                    value={q.conceptTag}
                    onChange={e => updateQuestion(q.id, { conceptTag: e.target.value })}
                    disabled={isGenerating || isExtracting}
                  />
                </div>

                {/* Note */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-dim)', display: 'block', marginBottom: 3 }}>
                    Note (optional)
                  </label>
                  <textarea
                    className="input"
                    style={{ width: '100%', minHeight: 40, resize: 'vertical' }}
                    placeholder="Any extra notes about this question"
                    value={q.note ?? ''}
                    onChange={e => updateQuestion(q.id, { note: e.target.value })}
                    disabled={isGenerating || isExtracting}
                  />
                </div>

                {/* Status toggle */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['correct', 'partial', 'incorrect'] as const).map(s => (
                    <button
                      key={s}
                      className="btn btn-sm"
                      style={{
                        fontWeight: q.status === s ? 700 : 400,
                        background:
                          q.status === s
                            ? s === 'correct'
                              ? 'var(--green)'
                              : s === 'partial'
                              ? 'var(--orange)'
                              : 'var(--red)'
                            : 'var(--bg-secondary)',
                        color: q.status === s ? '#fff' : 'var(--text-secondary)',
                        border: `1px solid ${
                          q.status === s
                            ? s === 'correct'
                              ? 'var(--green)'
                              : s === 'partial'
                              ? 'var(--orange)'
                              : 'var(--red)'
                            : 'var(--border)'
                        }`,
                      }}
                      onClick={() => updateQuestion(q.id, { status: s })}
                      disabled={isGenerating || isExtracting}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Add question button */}
        <button
          className="btn btn-sm"
          style={{ marginTop: 12, marginBottom: 20 }}
          onClick={addQuestion}
          disabled={isGenerating || isExtracting}
        >
          <Plus size={13} style={{ marginRight: 4 }} />
          Add Question
        </button>
      </>
    )
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 16,
        }}
      >
        <button className="btn btn-sm" onClick={goBack}>
          ← Back
        </button>
        <h2 className="section-title" style={{ margin: 0 }}>
          {selectedReviewId === 'new' ? 'New Exam Review' : 'Edit Exam Review'}
        </h2>
      </div>

      {/* ── Entry Mode Selector (new review only) ─────────────────────────── */}
      {selectedReviewId === 'new' && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Entry Mode
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {(
              [
                { mode: 'manual' as EntryMode, label: '✍️ Manual Entry' },
                { mode: 'upload' as EntryMode, label: '📷 Upload Photo(s)' },
                { mode: 'hybrid' as EntryMode, label: '🔀 Hybrid' },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                className="btn btn-sm"
                style={{
                  fontWeight: entryMode === mode ? 700 : 400,
                  background: entryMode === mode ? accentColor : 'var(--bg-secondary)',
                  color: entryMode === mode ? '#000' : 'var(--text-secondary)',
                  border: `1px solid ${entryMode === mode ? accentColor : 'var(--border)'}`,
                }}
                onClick={() => {
                  setEntryMode(mode)
                  setOcrError('none')
                  setOcrLowReadWarning(null)
                  setOcrProgress(null)
                  setUploadFiles([])
                  setHybridFile(null)
                  setHybridDataUrl(null)
                  setForm(prev => ({ ...prev, questions: [makeBlankQuestion()] }))
                }}
                disabled={isGenerating || isExtracting}
              >
                {label}
              </button>
            ))}
          </div>
          {entryMode === 'upload' && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              Upload one or more photos of your graded exam. AI will read the questions and pre-fill the form.
            </p>
          )}
          {entryMode === 'hybrid' && (
            <p style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 6 }}>
              Upload a photo as a visual reference while you type answers manually. No AI processing.
            </p>
          )}
        </div>
      )}

      {/* Title */}
      <div className="mb-4">
        <label
          style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}
        >
          Exam Title *
        </label>
        <input
          type="text"
          className="input"
          style={{ width: '100%' }}
          placeholder="e.g., Midterm 1"
          value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          disabled={isGenerating || isExtracting}
        />
      </div>

      {/* Date */}
      <div className="mb-4">
        <label
          style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}
        >
          Date
        </label>
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
          disabled={isGenerating || isExtracting}
        />
      </div>

      {/* ── Upload Mode UI ──────────────────────────────────────────────────── */}
      {entryMode === 'upload' && (
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              border: '2px dashed var(--border)',
              borderRadius: 8,
              padding: '20px 16px',
              textAlign: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
              {uploadFiles.length === 0
                ? 'Select exam photo(s) — supports multiple pages'
                : `${uploadFiles.length} photo${uploadFiles.length > 1 ? 's' : ''} selected`}
            </div>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleUploadFilesChange}
              disabled={isGenerating || isExtracting}
            />
            <button
              className="btn btn-sm"
              onClick={() => uploadInputRef.current?.click()}
              disabled={isGenerating || isExtracting}
            >
              {uploadFiles.length === 0 ? 'Choose Photos' : 'Change Photos'}
            </button>
          </div>

          {/* File list */}
          {uploadFiles.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {uploadFiles.map((f, i) => (
                <div
                  key={f.name + i}
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span style={{ color: 'var(--text-dim)', minWidth: 60 }}>
                    Page {i + 1}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* OCR errors */}
          {renderOcrError()}

          {/* Low read rate warning */}
          {ocrLowReadWarning && (
            <div
              style={{
                background: 'rgba(234,179,8,0.1)',
                border: '1px solid rgba(234,179,8,0.4)',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: 'rgba(234,179,8,0.9)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0 }} />
              Only read {ocrLowReadWarning.read} of estimated ~{ocrLowReadWarning.total} questions. Please review and fill in the rest.
            </div>
          )}

          {/* Progress indicator */}
          {isExtracting && ocrProgress && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  border: `2px solid ${accentColor}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
              Processing page {ocrProgress.page} of {ocrProgress.total}…
            </div>
          )}

          {/* Extract button */}
          {uploadFiles.length > 0 && !isExtracting && (
            <button
              className="btn btn-sm btn-primary"
              style={{ marginBottom: 16 }}
              onClick={handleExtractQuestions}
              disabled={isGenerating}
            >
              Extract Questions
            </button>
          )}
        </div>
      )}

      {/* ── Hybrid Mode UI ──────────────────────────────────────────────────── */}
      {entryMode === 'hybrid' && (
        <div style={{ marginBottom: 20 }}>
          {/* File picker */}
          {!hybridFile && (
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 8,
                padding: '20px 16px',
                textAlign: 'center',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                Upload exam photo (reference only — no AI processing)
              </div>
              <input
                ref={hybridInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleHybridFileChange}
                disabled={isGenerating}
              />
              <button
                className="btn btn-sm"
                onClick={() => hybridInputRef.current?.click()}
                disabled={isGenerating}
              >
                Choose Photo
              </button>
            </div>
          )}

          {/* Image + form side by side on larger screens */}
          {hybridDataUrl && (
            <div
              style={{
                display: 'flex',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 16,
              }}
            >
              {/* Image preview */}
              <div style={{ flex: '0 0 auto', maxWidth: '100%' }}>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Reference photo</span>
                  <button
                    className="btn btn-sm"
                    style={{ fontSize: 11, padding: '2px 8px' }}
                    onClick={() => {
                      setHybridFile(null)
                      setHybridDataUrl(null)
                    }}
                    disabled={isGenerating}
                  >
                    Remove
                  </button>
                </div>
                <img
                  src={hybridDataUrl}
                  alt="Exam reference"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 320,
                    borderRadius: 6,
                    border: '1px solid var(--border)',
                    display: 'block',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Question form (all modes) ────────────────────────────────────────── */}
      {/* For upload mode: only show if we have questions (extracted or fallback) */}
      {(entryMode !== 'upload' || form.questions.length > 0) && renderQuestionForm()}

      {/* Generate Gap Report */}
      <div>
        <button
          className="btn btn-primary"
          onClick={handleGenerateGap}
          disabled={isGenerating || isExtracting}
          style={{ minWidth: 180 }}
        >
          {isGenerating ? 'Generating…' : 'Generate Gap Report'}
        </button>
        {isGenerating && (
          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text-dim)' }}>
            Analyzing with AI…
          </span>
        )}
      </div>
    </div>
  )
}
