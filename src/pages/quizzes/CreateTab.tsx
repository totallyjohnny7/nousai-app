import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  Plus, Upload, Download, Loader, Play
} from 'lucide-react'
import { useStore } from '../../store'
import { callAI, isAIConfigured } from '../../utils/ai'
import { buildQuizPrompt, parseAIQuizResponse, type QuestionType } from '../../utils/quizEngine'
import type { PlayableQuiz } from './quizTypes'

export default function CreateTab({ onPlay }: { onPlay: (quiz: PlayableQuiz) => void }) {
  const { courses, data, setData, updatePluginData } = useStore()

  const [quizName, setQuizName] = useState('')
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')
  const [questionCount, setQuestionCount] = useState(() => parseInt(localStorage.getItem('nousai-pref-quiz-count') || '20'))
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium')
  const [questionTypes, setQuestionTypes] = useState({
    multipleChoice: true,
    trueFalse: true,
    shortAnswer: true,
    fillBlank: false,
  })
  const [sourceText, setSourceText] = useState('')
  const [useAI, setUseAI] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [generatedQuestions, setGeneratedQuestions] = useState<QuizQuestion[]>([])
  // Manual entry
  const [manualMode, setManualMode] = useState(false)
  const [manualQuestions, setManualQuestions] = useState<{ question: string; answer: string; options: string; type: 'multiple_choice' | 'true_false' | 'short_answer' }[]>([
    { question: '', answer: '', options: '', type: 'multiple_choice' },
  ])
  const [showNotePicker, setShowNotePicker] = useState(false)

  // Load lecture notes for the selected course
  const courseNotes = useMemo(() => {
    if (!selectedCourse) return []
    const courseObj = courses.find(c => c.id === selectedCourse || c.shortName === selectedCourse)
    if (!courseObj) return []
    try {
      const raw = localStorage.getItem(`nousai-lectures-${courseObj.id}`)
      return raw ? JSON.parse(raw) as { id: string; title: string; content: string; createdAt: string; updatedAt: string }[] : []
    } catch { return [] }
  }, [selectedCourse, courses])
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  // Import section state
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFormat, setImportFormat] = useState<'json' | 'text' | 'csv'>('json')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [importMessage, setImportMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)

  const selectedCourseObj = courses.find(c => c.id === selectedCourse || c.shortName === selectedCourse)
  const topics = selectedCourseObj?.topics || []

  function toggleType(key: keyof typeof questionTypes) {
    setQuestionTypes(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', width: '100%'
  }

  const getTypes = useCallback((): QuestionType[] => {
    const t: QuestionType[] = []
    if (questionTypes.multipleChoice) t.push('multiple_choice')
    if (questionTypes.trueFalse) t.push('true_false')
    if (questionTypes.shortAnswer) t.push('short_answer')
    if (questionTypes.fillBlank) t.push('fill_blank')
    return t.length ? t : ['multiple_choice']
  }, [questionTypes])

  const generateWithAI = useCallback(async () => {
    if (!isAIConfigured()) {
      setGenError('AI not configured. Go to Settings → AI Provider to set up your API key.')
      return
    }
    setGenerating(true)
    setGenError('')
    try {
      const diffMap = { easy: 1, medium: 3, hard: 5, mixed: undefined }
      const source = sourceText.trim() ||
        (selectedCourseObj?.flashcards || []).map(f => `${f.front}: ${f.back}`).join('\n') ||
        'General knowledge quiz'
      const prompt = buildQuizPrompt(
        { count: Math.min(50, Math.max(1, questionCount)), types: getTypes(), difficulty: diffMap[difficulty], focusArea: selectedTopic || undefined },
        source,
      )
      const response = await callAI([{ role: 'user', content: prompt }], { json: true }, 'chat')
      const questions = parseAIQuizResponse(response)
      if (questions.length === 0) {
        setGenError('AI returned no valid questions. Try adding more source material or adjusting settings.')
      } else {
        setGeneratedQuestions(questions)
      }
    } catch (err: any) {
      setGenError(err.message || 'Failed to generate quiz')
    }
    setGenerating(false)
  }, [sourceText, selectedCourseObj, questionCount, getTypes, difficulty, selectedTopic])

  const addManualQuestion = () => {
    setManualQuestions(prev => [...prev, { question: '', answer: '', options: '', type: 'multiple_choice' }])
  }

  const updateManualQ = (idx: number, field: string, value: string) => {
    setManualQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }

  const removeManualQ = (idx: number) => {
    setManualQuestions(prev => prev.filter((_, i) => i !== idx))
  }

  const buildFromManual = () => {
    const questions: QuizQuestion[] = manualQuestions
      .filter(q => q.question.trim() && q.answer.trim())
      .map((q, i) => ({
        id: `manual-${Date.now()}-${i}`,
        question: q.question.trim(),
        type: q.type,
        answer: q.answer.trim(),
        options: q.type === 'multiple_choice' ? q.options.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      }))
    if (questions.length === 0) {
      setGenError('Add at least one question with a question and answer.')
      return
    }
    setGeneratedQuestions(questions)
  }

  const parseBulkText = () => {
    if (!bulkText.trim()) return
    const blocks = bulkText.split('---').map(b => b.trim()).filter(Boolean)
    const parsed: typeof manualQuestions = []
    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
      let question = '', answer = '', options = '', type: 'multiple_choice' | 'true_false' | 'short_answer' = 'short_answer'
      for (const line of lines) {
        if (/^Q:\s*/i.test(line)) question = line.replace(/^Q:\s*/i, '').trim()
        else if (/^A:\s*/i.test(line)) answer = line.replace(/^A:\s*/i, '').trim()
        else if (/^Options:\s*/i.test(line)) options = line.replace(/^Options:\s*/i, '').trim()
        else if (/^Type:\s*/i.test(line)) {
          const t = line.replace(/^Type:\s*/i, '').trim().toLowerCase()
          if (t === 'multiple_choice' || t === 'true_false' || t === 'short_answer') type = t
        }
      }
      if (!question || !answer) continue
      if (options && type === 'short_answer') type = 'multiple_choice'
      parsed.push({ question, answer, options, type })
    }
    if (parsed.length === 0) {
      setGenError('No valid questions found. Use the format: Q: ... / A: ... separated by ---')
      return
    }
    // Append to existing manual questions (replace the initial empty one if it's blank)
    setManualQuestions(prev => {
      const existing = prev.filter(q => q.question.trim() || q.answer.trim())
      return [...existing, ...parsed]
    })
    setBulkText('')
    setBulkMode(false)
    setGenError('')
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setImportText(text)
      try { JSON.parse(text); setImportFormat('json') } catch {
        setImportFormat(text.includes(',') && text.includes('\n') ? 'csv' : 'text')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    if (!importText.trim() || !data) { setImportStatus('error'); setImportMessage('No data to import.'); return }
    try {
      let parsedQs: { question: string; correctAnswer: string; options?: string[]; type: string; explanation?: string }[] = []
      if (importFormat === 'json') {
        const parsed = JSON.parse(importText)
        const items = Array.isArray(parsed) ? parsed : [parsed]
        parsedQs = items.map((item: Record<string, unknown>) => ({
          question: String(item.question || item.q || ''),
          correctAnswer: String(item.correctAnswer || item.answer || item.a || ''),
          options: Array.isArray(item.options) ? item.options.map(String) : undefined,
          type: String(item.type || 'multiple-choice'),
          explanation: item.explanation ? String(item.explanation) : undefined,
        })).filter(q => q.question && q.correctAnswer)
      } else if (importFormat === 'csv') {
        const lines = importText.trim().split('\n')
        if (lines.length < 2) throw new Error('CSV must have header + data rows')
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
        parsedQs = lines.slice(1).map(line => {
          const vals: string[] = []; let cur = '', inQ = false
          for (const ch of line) { if (ch === '"') { inQ = !inQ; continue } if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; continue } cur += ch }
          vals.push(cur.trim())
          const row: Record<string, string> = {}; headers.forEach((h, i) => { row[h] = vals[i] || '' })
          const opts = [row.option1, row.option2, row.option3, row.option4].filter(Boolean)
          return { question: row.question || '', correctAnswer: row.correctanswer || row.answer || '', options: opts.length ? opts : undefined, type: row.type || 'multiple-choice', explanation: row.explanation || undefined }
        }).filter(q => q.question && q.correctAnswer)
      } else {
        parsedQs = importText.trim().split(/\n\n+/).map(pair => {
          const lines = pair.split('\n').map(l => l.trim()).filter(Boolean)
          if (lines.length < 2) return null
          return { question: lines[0].replace(/^Q:\s*/i, ''), correctAnswer: lines[1].replace(/^A:\s*/i, ''), type: 'short-answer', explanation: lines.length > 2 ? lines.slice(2).join(' ') : undefined }
        }).filter((q): q is NonNullable<typeof q> => q !== null && !!q.question && !!q.correctAnswer)
      }
      if (parsedQs.length === 0) { setImportStatus('error'); setImportMessage('No valid questions found.'); return }
      const answers: QuizAnswer[] = parsedQs.map(q => ({ question: { type: q.type, question: q.question, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation }, userAnswer: '', correct: false, timeMs: 0 }))
      const attempt: QuizAttempt = {
        id: 'import-' + Date.now(), name: quizName.trim() || `Imported Quiz ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        subject: selectedCourseObj?.shortName || 'Imported', subtopic: selectedTopic || '',
        date: new Date().toISOString(), questionCount: parsedQs.length, score: -1, correct: 0, mode: 'imported', questions: parsedQs, answers,
      }
      updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
      setImportStatus('success'); setImportMessage(`Imported ${parsedQs.length} questions as "${attempt.name}".`); setImportText('')
    } catch (err) { setImportStatus('error'); setImportMessage(`Import failed: ${err instanceof Error ? err.message : 'Invalid format.'}`) }
  }

  const saveQuiz = useCallback(() => {
    if (!data || generatedQuestions.length === 0) return
    const name = quizName.trim() || `Quiz ${new Date().toLocaleDateString()}`
    const attempt: QuizAttempt = {
      id: `quiz-${Date.now()}`,
      name,
      subject: selectedCourseObj?.shortName || selectedCourseObj?.name || selectedCourse || 'General',
      subtopic: selectedTopic || '',
      date: new Date().toISOString(),
      questionCount: generatedQuestions.length,
      score: -1,
      correct: 0,
      mode: manualMode ? 'manual' : 'ai-generated',
      questions: generatedQuestions,
      answers: [],
    }
    updatePluginData({ quizHistory: [...data.pluginData.quizHistory, attempt] })
    setGeneratedQuestions([])
    setQuizName('')
    setSourceText('')
    setGenError('')
  }, [data, setData, generatedQuestions, quizName, selectedCourse, selectedTopic, manualMode, selectedCourseObj])

  // Show generated questions review
  if (generatedQuestions.length > 0) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700 }}>
            Generated {generatedQuestions.length} Questions
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm" onClick={() => setGeneratedQuestions([])}>
              <ChevronLeft size={13} /> Back
            </button>
            <button className="btn btn-sm" onClick={saveQuiz}>
              <Save size={13} /> Save to Bank
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => {
              const playable = {
                questions: generatedQuestions.map(q => ({
                  question: q.question,
                  correctAnswer: q.answer,
                  options: q.options,
                  type: q.type,
                  explanation: q.explanation,
                })),
                name: quizName || `Quiz ${new Date().toLocaleDateString()}`,
                subject: selectedCourseObj?.shortName || selectedCourseObj?.name || selectedCourse || 'General',
                subtopic: selectedTopic,
              }
              // Auto-save to bank so questions are never lost
              saveQuiz()
              onPlay(playable)
            }}>
              <Play size={13} /> Play Quiz
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {generatedQuestions.map((q, i) => (
            <div key={q.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Q{i + 1}</span>
                <span className="badge" style={{ fontSize: 10 }}>{q.type.replace('_', ' ')}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{q.question}</div>
              {q.options && q.options.length > 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  {q.options.map((o, j) => (
                    <div key={j} style={{ padding: '2px 0', color: o === q.answer ? 'var(--green)' : undefined, fontWeight: o === q.answer ? 700 : 400 }}>
                      {String.fromCharCode(65 + j)}. {o}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>Answer: {q.answer}</div>
              {q.explanation && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{q.explanation}</div>}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Mode toggle: AI vs Manual */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`btn btn-sm ${!manualMode ? 'btn-primary' : ''}`} onClick={() => setManualMode(false)}>
          <Layers size={13} /> AI Generate
        </button>
        <button className={`btn btn-sm ${manualMode ? 'btn-primary' : ''}`} onClick={() => setManualMode(true)}>
          <Edit3 size={13} /> Manual Entry
        </button>
      </div>

      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Plus size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Quiz Settings</span>
        </div>

        {/* Quiz name */}
        <div style={{ marginBottom: 14 }}>
          <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Quiz Name</div>
          <input type="text" value={quizName} onChange={e => setQuizName(e.target.value)}
            placeholder="e.g., Biology Ch.5 Review" style={inputStyle}
            aria-label="Quiz Name" aria-required="true" required />
        </div>

        {/* Course + Topic */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Course / Subject</div>
            <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedTopic('') }} style={inputStyle} aria-label="Course / Subject">
              <option value="">Select course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.shortName || c.name}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Topic</div>
            <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} style={inputStyle} aria-label="Topic">
              <option value="">All topics</option>
              {topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
        </div>

        {!manualMode && (
          <>
            {/* Question count + Difficulty */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Number of Questions</div>
                <input type="number" value={questionCount} onChange={e => setQuestionCount(+e.target.value)} min={1} max={50} style={inputStyle} aria-label="Number of Questions" />
              </div>
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 4 }}>Difficulty</div>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value as typeof difficulty)} style={inputStyle} aria-label="Difficulty">
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            {/* Question types */}
            <div style={{ marginBottom: 14 }}>
              <div className="text-xs text-muted" style={{ marginBottom: 8 }}>Question Types</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {([
                  ['multipleChoice', 'Multiple Choice'],
                  ['trueFalse', 'True/False'],
                  ['shortAnswer', 'Short Answer'],
                  ['fillBlank', 'Fill in the Blank'],
                ] as const).map(([key, label]) => (
                  <button key={key}
                    onClick={() => toggleType(key)}
                    style={{
                      padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                      border: questionTypes[key] ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: questionTypes[key] ? 'var(--accent-glow)' : 'var(--bg-card)',
                      color: questionTypes[key] ? 'var(--accent-light)' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit'
                    }}
                  >
                    {questionTypes[key] && <CheckCircle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />}
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {!manualMode ? (
        <>
          {/* Source material for AI */}
          <div className="card mb-4">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title"><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Source Material</span>
              {courseNotes.length > 0 && (
                <button className="btn btn-sm" onClick={() => setShowNotePicker(!showNotePicker)}
                  style={{ fontSize: 11 }}>
                  <FileText size={12} /> Load from Notes ({courseNotes.length})
                </button>
              )}
            </div>
            {showNotePicker && courseNotes.length > 0 && (
              <div style={{ marginBottom: 10, maxHeight: 200, overflowY: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <button
                  onClick={() => {
                    const allText = courseNotes.map(n => {
                      const plain = n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                      return `--- ${n.title} ---\n${plain}`
                    }).join('\n\n')
                    setSourceText(allText)
                    setShowNotePicker(false)
                  }}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--accent-glow)', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--accent-light)', textAlign: 'left', fontFamily: 'inherit' }}>
                  📚 Load ALL Notes ({courseNotes.length} notes)
                </button>
                {courseNotes.map(note => (
                  <button key={note.id}
                    onClick={() => {
                      const plain = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                      setSourceText(prev => prev ? `${prev}\n\n--- ${note.title} ---\n${plain}` : `--- ${note.title} ---\n${plain}`)
                      setShowNotePicker(false)
                    }}
                    style={{ width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', textAlign: 'left', fontFamily: 'inherit' }}>
                    <div style={{ fontWeight: 600, marginBottom: 2 }}>{note.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                      {note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 80)}...
                    </div>
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={sourceText} onChange={e => setSourceText(e.target.value)}
              placeholder="Paste notes, textbook content, or lecture transcript here for AI to generate questions from..."
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.5 }}
            />
            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
              {selectedCourse && courseNotes.length > 0
                ? 'Click "Load from Notes" to use your lecture notes, or paste material manually.'
                : 'Paste study material above, or leave empty to generate from course flashcards.'}
            </div>
          </div>

          {genError && (
            <div style={{ padding: 10, marginBottom: 12, borderRadius: 'var(--radius-sm)', background: genError.includes('not configured') ? 'var(--bg-card)' : 'var(--red-dim)', border: `1px solid ${genError.includes('not configured') ? 'var(--border)' : 'var(--red)'}`, fontSize: 12, color: genError.includes('not configured') ? 'var(--text-muted)' : 'var(--red)' }}>
              <AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{genError}
            </div>
          )}

          <button className="btn btn-primary btn-full" style={{ marginBottom: 8 }} onClick={generateWithAI} disabled={generating}>
            {generating ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Plus size={16} /> Generate Quiz with AI</>}
          </button>
          {!isAIConfigured() && (
            <div className="text-xs text-muted text-center" style={{ marginBottom: 8 }}>
              Configure AI in Settings → AI Provider to enable generation.
            </div>
          )}

          {/* Copy Prompt + Paste AI Response (manual fallback) */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => {
              const courseName = selectedCourseObj?.name || selectedCourseObj?.shortName || 'General'
              const topicName = selectedTopic || 'all topics'
              const types = getTypes().map(t => t.replace('_', ' ')).join(', ')
              const prompt = `Generate a quiz with the following specifications:

- **Course**: ${courseName}
- **Topic**: ${topicName}
- **Number of Questions**: ${questionCount}
- **Difficulty**: ${difficulty}
- **Question Types**: ${types}
${sourceText.trim() ? `\n**Source Material**:\n${sourceText.trim()}\n` : ''}
Return a JSON array of question objects. Each object must have:
- "question": string (the question text)
- "type": "multiple_choice" | "true_false" | "short_answer"
- "correctAnswer": string (the correct answer)
- "options": string[] (array of 4 choices, required for multiple_choice)
- "explanation": string (brief explanation of the answer)

Example format:
[
  {
    "question": "What is...?",
    "type": "multiple_choice",
    "correctAnswer": "Answer A",
    "options": ["Answer A", "Answer B", "Answer C", "Answer D"],
    "explanation": "Because..."
  }
]

Return ONLY the JSON array, no other text.`
              navigator.clipboard.writeText(prompt).then(() => {
                setPromptCopied(true)
                setTimeout(() => setPromptCopied(false), 2000)
              })
            }}>
              <Copy size={13} /> {promptCopied ? 'Copied!' : 'Copy Prompt'}
            </button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setPasteText(prev => prev ? '' : ' ')}>
              <FileText size={13} /> Paste AI Response
            </button>
          </div>

          {pasteText !== '' && (
            <div style={{ marginBottom: 20 }}>
              <textarea
                value={pasteText === ' ' ? '' : pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder="Paste the AI-generated JSON response here, then click Parse..."
                style={{ ...inputStyle, minHeight: 120, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical', marginBottom: 8 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={() => {
                  const questions = parseAIQuizResponse(pasteText)
                  if (questions.length === 0) {
                    setGenError('Could not parse any questions from the pasted text. Make sure it\'s a valid JSON array.')
                  } else {
                    setGeneratedQuestions(questions)
                    setPasteText('')
                    setGenError('')
                  }
                }}>
                  <Play size={13} /> Parse ({pasteText.trim().length > 0 ? 'ready' : 'paste first'})
                </button>
                <button className="btn btn-sm" onClick={() => setPasteText('')}>
                  <X size={13} /> Close
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Manual question entry */}
          <div className="card mb-4">
            <div className="card-header">
              <span className="card-title"><Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Add Questions</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              <button className={`btn btn-sm ${!bulkMode ? 'btn-primary' : ''}`} onClick={() => setBulkMode(false)}>
                Single Entry
              </button>
              <button className={`btn btn-sm ${bulkMode ? 'btn-primary' : ''}`} onClick={() => setBulkMode(true)}>
                <Upload size={13} /> Bulk Entry
              </button>
            </div>
            {bulkMode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  placeholder={`Paste multiple questions using this format:\n\nQ: What is mitosis?\nA: Cell division process\n---\nQ: What is DNA?\nA: Deoxyribonucleic acid\nOptions: Deoxyribonucleic acid, Ribonucleic acid, Amino acid, Lipid acid\nType: multiple_choice\n---\nQ: The sun is a star.\nA: True\nType: true_false\n\nSeparate questions with ---\nOptions and Type lines are optional.\nType defaults to short_answer (or multiple_choice if Options given).`}
                  style={{ ...inputStyle, minHeight: 200, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
                />
                <button className="btn btn-sm btn-primary" onClick={parseBulkText}>
                  <Plus size={13} /> Parse & Add
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {manualQuestions.map((mq, i) => (
                    <div key={i} style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>Question {i + 1}</span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <select value={mq.type} onChange={e => updateManualQ(i, 'type', e.target.value)}
                            style={{ ...inputStyle, width: 'auto', fontSize: 11, padding: '4px 8px' }}>
                            <option value="multiple_choice">Multiple Choice</option>
                            <option value="true_false">True/False</option>
                            <option value="short_answer">Short Answer</option>
                          </select>
                          {manualQuestions.length > 1 && (
                            <button onClick={() => removeManualQ(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <input value={mq.question} onChange={e => updateManualQ(i, 'question', e.target.value)}
                        placeholder="Question text..." style={{ ...inputStyle, marginBottom: 6 }} />
                      {mq.type === 'multiple_choice' && (
                        <input value={mq.options} onChange={e => updateManualQ(i, 'options', e.target.value)}
                          placeholder="Options (comma-separated, e.g.: Option A, Option B, Option C, Option D)"
                          style={{ ...inputStyle, marginBottom: 6, fontSize: 11 }} />
                      )}
                      <input value={mq.answer} onChange={e => updateManualQ(i, 'answer', e.target.value)}
                        placeholder="Correct answer..." style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                  ))}
                </div>
                <button className="btn btn-sm mt-3" onClick={addManualQuestion}>
                  <Plus size={13} /> Add Question
                </button>
              </>
            )}
          </div>

          {genError && (
            <div style={{ padding: 10, marginBottom: 12, borderRadius: 'var(--radius-sm)', background: genError.includes('not configured') ? 'var(--bg-card)' : 'var(--red-dim)', border: `1px solid ${genError.includes('not configured') ? 'var(--border)' : 'var(--red)'}`, fontSize: 12, color: genError.includes('not configured') ? 'var(--text-muted)' : 'var(--red)' }}>
              <AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />{genError}
            </div>
          )}

          <button className="btn btn-primary btn-full" style={{ marginBottom: 20 }} onClick={buildFromManual}>
            <Plus size={16} /> Create Quiz
          </button>
        </>
      )}

      {/* ── Import Section (collapsed by default) ── */}
      <div className="card" style={{ marginTop: 8 }}>
        <button
          onClick={() => setShowImport(!showImport)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Upload size={14} /> Import Quiz from File
          </span>
          {showImport ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showImport && (
          <div style={{ paddingTop: 10, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['json', 'text', 'csv'] as const).map(f => (
                <button key={f} onClick={() => setImportFormat(f)} style={{
                  padding: '5px 14px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
                  border: importFormat === f ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: importFormat === f ? 'var(--accent-glow)' : 'var(--bg-card)',
                  color: importFormat === f ? 'var(--accent-light)' : 'var(--text-muted)',
                  cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase',
                }}>{f}</button>
              ))}
            </div>
            <input ref={importFileRef} type="file" accept=".json,.txt,.csv" onChange={handleImportFile} style={{ display: 'none' }} />
            <button className="btn btn-sm btn-full" style={{ marginBottom: 10 }} onClick={() => importFileRef.current?.click()}>
              <Upload size={13} /> Upload File
            </button>
            <textarea
              value={importText} onChange={e => { setImportText(e.target.value); setImportStatus('idle') }}
              placeholder={importFormat === 'json' ? '[\n  { "question": "...", "correctAnswer": "...", "options": [...] }\n]'
                : importFormat === 'csv' ? 'question,correctAnswer,option1,option2\n"What is...","Answer","A","B"'
                : 'Question text\nAnswer text\n\nNext question\nNext answer'}
              style={{ ...inputStyle, minHeight: 120, resize: 'vertical', lineHeight: 1.5, marginBottom: 10 }}
            />
            <button className="btn btn-primary btn-full btn-sm" onClick={handleImport}>
              <Download size={13} /> Import Questions
            </button>
            {importStatus !== 'idle' && (
              <div style={{
                marginTop: 10, padding: 8, borderRadius: 'var(--radius-sm)',
                background: importStatus === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                border: `1px solid ${importStatus === 'success' ? 'var(--green)' : 'var(--red)'}`,
                fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {importStatus === 'success' ? <CheckCircle size={14} style={{ color: 'var(--green)' }} /> : <AlertCircle size={14} style={{ color: 'var(--red)' }} />}
                {importMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   BANK TAB
   ================================================================ */
interface BankQuestion {
  id: string
  question: string
  correctAnswer: string
  options?: string[]
  type: string
  subject: string
  topic: string
  explanation?: string
}

interface SharedFolderProps {
  folders: QuizFolder[]
  folderMap: Record<string, string>
  folderActions: {
    createFolder: (name: string) => void
    renameFolder: (id: string, name: string) => void
    deleteFolder: (id: string) => void
    assignToFolder: (itemId: string, folderId: string | null) => void
  }
}
