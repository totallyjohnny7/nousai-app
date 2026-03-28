import { useState, useMemo } from 'react'
import { Layers, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '../../store'
import type { RawQuizQuestion, MergedQuizQuestion } from './quizTypes'

export default function MergeTab() {
  const { quizHistory, data, updatePluginData } = useStore()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mergeName, setMergeName] = useState('')
  const [mergeStatus, setMergeStatus] = useState<'idle' | 'success'>('idle')

  // Get unique subjects with question counts
  const subjectGroups = useMemo(() => {
    const map = new Map<string, { subject: string; quizIds: string[]; questionCount: number }>()
    quizHistory.forEach(q => {
      const subj = q.subject || 'Uncategorized'
      if (!map.has(subj)) map.set(subj, { subject: subj, quizIds: [], questionCount: 0 })
      const entry = map.get(subj)!
      entry.quizIds.push(q.id)
      entry.questionCount += (q.answers?.length || 0)
    })
    return Array.from(map.values()).sort((a, b) => b.questionCount - a.questionCount)
  }, [quizHistory])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllFromSubject(quizIds: string[]) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      const allSelected = quizIds.every(id => next.has(id))
      if (allSelected) {
        quizIds.forEach(id => next.delete(id))
      } else {
        quizIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  // Count total questions in selection
  const selectedQuestionCount = useMemo(() => {
    return quizHistory
      .filter(q => selectedIds.has(q.id))
      .reduce((acc, q) => acc + Math.max((q.answers?.length || 0), Array.isArray(q.questions) ? (q.questions as RawQuizQuestion[]).length : 0), 0)
  }, [quizHistory, selectedIds])

  function handleMerge() {
    if (selectedIds.size < 2 || !data) return

    const isJapanese = (text: string, subject: string) => {
      if (subject.toLowerCase() === 'japanese' || /japn/i.test(subject)) return true
      return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)
    }

    // Collect questions grouped by subject
    const bySubject = new Map<string, MergedQuizQuestion[]>()
    const seen = new Set<string>()

    quizHistory.filter(q => selectedIds.has(q.id)).forEach(q => {
      const subj = q.subject || 'Uncategorized'
      if (!bySubject.has(subj)) bySubject.set(subj, [])
      const bucket = bySubject.get(subj)!

      // Collect from answers (taken quizzes)
      ;(q.answers || []).forEach(a => {
        const key = (a.question?.question || '').substring(0, 80)
        if (!key || seen.has(key)) return
        seen.add(key)
        const jp = isJapanese(a.question.question, subj)
        bucket.push({
          question: a.question.question, correctAnswer: a.question.correctAnswer,
          options: jp ? undefined : a.question.options,
          type: jp ? 'written' : (a.question.type || 'multiple-choice'),
          explanation: a.question.explanation,
          subject: subj,
        })
      })

      // Collect from questions array (saved/imported quizzes)
      ;((q.questions as RawQuizQuestion[]) || []).forEach(qq => {
        const key = (qq?.question || '').substring(0, 80)
        if (!key || seen.has(key)) return
        seen.add(key)
        const jp = isJapanese(qq.question || '', subj)
        bucket.push({
          question: qq.question, correctAnswer: qq.correctAnswer || qq.answer,
          options: jp ? undefined : qq.options,
          type: jp ? 'written' : (qq.type || 'multiple-choice'),
          explanation: qq.explanation,
          subject: subj,
        })
      })
    })

    // Shuffle within each subject group, then concatenate groups
    const shuffle = <T,>(arr: T[]) => arr.sort(() => Math.random() - 0.5)
    const allQuestions: any[] = []
    bySubject.forEach(bucket => allQuestions.push(...shuffle(bucket)))

    if (allQuestions.length === 0) return
    const subjects = Array.from(bySubject.keys()).join(', ')
    const name = mergeName.trim() || `Merged Quiz ${new Date().toLocaleDateString()}`
    const attempt: QuizAttempt = {
      id: `merge-${Date.now()}`, name,
      subject: subjects, subtopic: '',
      date: new Date().toISOString(), questionCount: allQuestions.length,
      score: -1, correct: 0, mode: 'merged',
      questions: allQuestions, answers: [],
    }
    updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
    setMergeStatus('success')
    setSelectedIds(new Set())
    setTimeout(() => setMergeStatus('idle'), 3000)
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  return (
    <div>
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Layers size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Merge Quiz Banks</span>
          <span className="badge badge-accent">{selectedIds.size} selected</span>
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
          Select quiz attempts to combine their questions into a single merged bank. Duplicates will be removed automatically.
        </p>

        {/* Merge name */}
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Merged Bank Name</div>
          <input type="text" value={mergeName} onChange={e => setMergeName(e.target.value)}
            placeholder="e.g., Final Exam Review" style={inputStyle} />
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
          <span className="badge badge-blue">{selectedIds.size} quizzes</span>
          <span className="badge badge-green">{selectedQuestionCount} questions</span>
        </div>
      </div>

      {/* Subject groups with quiz selectors */}
      {subjectGroups.length === 0 ? (
        <div className="empty-state">
          <Layers />
          <h3>No quizzes to merge</h3>
          <p>Take quizzes first, then come back to merge question banks.</p>
        </div>
      ) : (
        subjectGroups.map(group => {
          const groupQuizzes = quizHistory.filter(q => (q.subject || 'Uncategorized') === group.subject)
          const allSelected = group.quizIds.every(id => selectedIds.has(id))
          return (
            <div key={group.subject} className="card mb-4" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Group header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                borderBottom: '1px solid var(--border)', cursor: 'pointer'
              }} onClick={() => selectAllFromSubject(group.quizIds)}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, border: '2px solid var(--border)',
                  background: allSelected ? 'var(--accent)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {allSelected && <CheckCircle size={12} style={{ color: 'white' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{group.subject}</div>
                  <div className="text-xs text-muted">{group.quizIds.length} quizzes, {group.questionCount} questions</div>
                </div>
              </div>

              {/* Individual quizzes */}
              <div style={{ padding: '0 16px' }}>
                {groupQuizzes.map(q => {
                  const isSelected = selectedIds.has(q.id)
                  return (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                      borderBottom: '1px solid var(--border)', cursor: 'pointer'
                    }} onClick={() => toggleSelect(q.id)}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, border: '2px solid var(--border)',
                        background: isSelected ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {isSelected && <CheckCircle size={10} style={{ color: 'white' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{q.name}</div>
                        <div className="text-xs text-muted">
                          {new Date(q.date).toLocaleDateString()} - {q.answers?.length || 0} questions - {q.score < 0 ? 'Bank' : `${q.score}%`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}

      {/* Merge button */}
      {selectedIds.size >= 2 && (
        <button className="btn btn-primary btn-full" onClick={handleMerge} style={{ marginBottom: 16 }}>
          <Layers size={16} /> Merge {selectedIds.size} Quizzes ({selectedQuestionCount} questions)
        </button>
      )}

      {mergeStatus === 'success' && (
        <div style={{
          padding: 12, borderRadius: 'var(--radius-sm)',
          background: 'var(--green-dim)', border: '1px solid var(--green)',
          fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
        }}>
          <CheckCircle size={16} style={{ color: 'var(--green)' }} />
          Merged bank created successfully with {selectedQuestionCount} unique questions!
        </div>
      )}
    </div>
  )
}

/* ================================================================
   QUIZ PLAYER — Actually take/play a quiz
   ================================================================ */
