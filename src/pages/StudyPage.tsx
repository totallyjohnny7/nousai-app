import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, CheckCircle, XCircle, ArrowRight, RotateCcw, Brain,
  Zap, Clock, Target, Trophy, ChevronLeft, BarChart3, Sparkles,
  Volume2, BookOpen
} from 'lucide-react';
import { useStore } from '../store';
import { speak } from '../utils/speechTools';
import { safeRenderMd } from '../utils/renderMd';
import StudyFloatingRail from '../components/StudyFloatingRail';
import StudyAnnotationSidecar from '../components/StudyAnnotationSidecar';
import { useSessionStore } from '../store/sessionStore';
import {
  checkAnswer, createQuizSession, processAdaptiveAnswer,
  skipMasteredConcepts, getConceptConfidence,
  type QuizQuestion, type QuizSession, type ConceptConfidence
} from '../utils/quizEngine';

type StudyView = 'menu' | 'quiz' | 'results';

/* ── Inner component so hooks can depend on questionId ── */
function StudyPageAnnotation({
  questionId, questionText, questionType, options, subject, quizId, showSidecar, setShowSidecar,
}: {
  questionId: string; questionText: string; questionType?: string; options?: string[];
  subject: string; quizId: string; showSidecar: boolean;
  setShowSidecar: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { questionMap, sessions } = useSessionStore(s => ({ questionMap: s.questionMap, sessions: s.sessions }));
  const _sid = questionMap[questionId];
  const hasAnnotation = _sid
    ? (sessions[_sid]?.hasCanvas || !!sessions[_sid]?.textContent || (sessions[_sid]?.chatLog.length ?? 0) > 0)
    : false;

  // Keyboard shortcut: N to toggle sidecar
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'n' || e.key === 'N') {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        setShowSidecar(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setShowSidecar]);

  return (
    <>
      <StudyFloatingRail onToggle={() => setShowSidecar(v => !v)} hasAnnotation={hasAnnotation} isOpen={showSidecar} />
      {showSidecar && (
        <StudyAnnotationSidecar
          questionId={questionId}
          questionText={questionText}
          questionType={questionType}
          options={options}
          subject={subject}
          quizId={quizId}
          onClose={() => setShowSidecar(false)}
        />
      )}
    </>
  );
}

export default function StudyPage() {
  const { loaded, courses, quizHistory } = useStore();
  const [view, setView] = useState<StudyView>('menu');
  const [session, setSession] = useState<QuizSession | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [quizMode, setQuizMode] = useState<'standard' | 'adaptive'>('standard');
  const [userAnswer, setUserAnswer] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [answers, setAnswers] = useState<Array<{ correct: boolean; timeMs: number; concept: string }>>([]);
  const [showSidecar, setShowSidecar] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get questions from courses' flashcards (converted to quiz questions)
  const getQuestionsFromCourse = useCallback((courseId: string): QuizQuestion[] => {
    const course = courses.find(c => c.id === courseId || c.name === courseId);
    if (!course?.flashcards) return [];

    return course.flashcards.map((fc, i) => ({
      id: `fc-${i}-${Date.now().toString(36)}`,
      question: fc.front,
      type: 'short_answer' as const,
      answer: fc.back,
      subtopic: course.name,
      difficulty: 3,
    }));
  }, [courses]);

  const getAllQuestions = useCallback((): QuizQuestion[] => {
    return courses.flatMap(c => getQuestionsFromCourse(c.id || c.name));
  }, [courses, getQuestionsFromCourse]);

  function startQuiz(courseId: string, mode: 'standard' | 'adaptive') {
    const questions = courseId === 'all' ? getAllQuestions() : getQuestionsFromCourse(courseId);
    if (questions.length === 0) return;

    // Shuffle
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    const limited = shuffled.slice(0, mode === 'adaptive' ? 30 : 20);

    const newSession = createQuizSession(limited, mode, courseId);
    setSession(newSession);
    setView('quiz');
    setUserAnswer('');
    setShowFeedback(false);
    setAnswers([]);
    setQuestionStartTime(Date.now());
  }

  function handleAnswer(answer?: string) {
    if (!session || showFeedback) return;

    const q = session.questions[session.currentIndex];
    const finalAnswer = answer || userAnswer;
    const correct = checkAnswer(q, finalAnswer);
    const timeMs = Date.now() - questionStartTime;

    setIsCorrect(correct);
    setShowFeedback(true);

    const newAnswers = [...answers, { correct, timeMs, concept: q.subtopic || q.question.slice(0, 30) }];
    setAnswers(newAnswers);

    // Update session for adaptive mode
    if (session.mode === 'adaptive') {
      const updated = processAdaptiveAnswer(session, session.currentIndex, correct, timeMs);
      setSession(updated);
    }

    // Speak feedback with TTS — uses speechTools for Bluetooth compatibility
    speak(correct ? 'Correct!' : 'Incorrect', { rate: 1.5, volume: 0.3 });
  }

  function nextQuestion() {
    if (!session) return;

    let nextIdx = session.currentIndex + 1;

    // Skip mastered concepts in adaptive mode
    if (session.mode === 'adaptive') {
      nextIdx = skipMasteredConcepts(session, nextIdx);
    }

    if (nextIdx >= session.questions.length) {
      setSession({ ...session, finished: true, currentIndex: nextIdx });
      setView('results');
      return;
    }

    setSession({ ...session, currentIndex: nextIdx });
    setUserAnswer('');
    setShowFeedback(false);
    setQuestionStartTime(Date.now());

    setTimeout(() => inputRef.current?.focus(), 100);
  }

  // ─── Loading State ───────────────────────────────────
  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading study tools...</div>
      </div>
    );
  }

  // ─── Menu View ────────────────────────────────────────

  if (view === 'menu') {
    return (
      <div className="animate-in">
        <h1 className="page-title">Study</h1>
        <p className="page-subtitle">Active learning & quizzes</p>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setSelectedCourse('all'); setQuizMode('standard'); startQuiz('all', 'standard'); }} style={{ flex: 1 }}>
            <Zap size={16} /> Quick Quiz
          </button>
          <button className="btn btn-secondary" onClick={() => { setSelectedCourse('all'); setQuizMode('adaptive'); startQuiz('all', 'adaptive'); }} style={{ flex: 1 }}>
            <Brain size={16} /> Adaptive
          </button>
        </div>

        {/* Mode selector */}
        <div className="card mb-3">
          <div className="card-title mb-2"><Target size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Quiz Mode</div>
          <div className="flex gap-2">
            <button className={`btn btn-sm ${quizMode === 'standard' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuizMode('standard')} style={{ flex: 1 }}>
              <Play size={14} /> Standard
            </button>
            <button className={`btn btn-sm ${quizMode === 'adaptive' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setQuizMode('adaptive')} style={{ flex: 1 }}>
              <Brain size={14} /> Adaptive
            </button>
          </div>
          <p className="text-xs text-muted mt-2">
            {quizMode === 'adaptive'
              ? 'Adapts difficulty in real-time. Re-drills weak concepts until mastery (90%+ accuracy).'
              : 'Standard quiz with all questions in order. Great for practice and review.'}
          </p>
        </div>

        {/* Course list */}
        <div className="card mb-3">
          <div className="card-title mb-2"><BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Choose Course</div>
          {courses.length === 0 ? (
            <p className="text-sm text-muted">No courses yet. Add courses from the Library page to get started.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {courses.map(c => {
                const cardCount = c.flashcards?.length || 0;
                return (
                  <button
                    key={c.id || c.name}
                    className="btn btn-secondary"
                    onClick={() => startQuiz(c.id || c.name, quizMode)}
                    style={{ justifyContent: 'space-between', textAlign: 'left' }}
                  >
                    <span>{c.name}</span>
                    <span className="badge" style={{ fontSize: 11 }}>{cardCount} cards</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent quizzes summary */}
        {quizHistory.length > 0 && (
          <div className="card">
            <div className="card-title mb-2"><BarChart3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recent Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="stat-item">
                <span className="stat-value">{quizHistory.length}</span>
                <span className="stat-label">Quizzes Taken</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {Math.round(quizHistory.reduce((s, q) => s + (q.score || 0), 0) / quizHistory.length)}%
                </span>
                <span className="stat-label">Avg Score</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Quiz View ────────────────────────────────────────

  if (view === 'quiz' && session) {
    const q = session.questions[session.currentIndex];
    const progress = ((session.currentIndex + 1) / session.questions.length) * 100;
    const correctCount = answers.filter(a => a.correct).length;

    if (!q) {
      setView('results');
      return null;
    }

    return (
      <div className="animate-in" style={{ position: 'relative' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <button className="btn-icon" onClick={() => { setView('menu'); setSession(null); setShowSidecar(false); }}>
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ fontWeight: 600 }}>
              {session.currentIndex + 1}/{session.questions.length}
            </span>
            {session.mode === 'adaptive' && (
              <span className="badge badge-accent" style={{ fontSize: 10 }}>
                <Brain size={10} /> ADAPTIVE
              </span>
            )}
          </div>
          <span className="text-sm text-muted">
            <CheckCircle size={12} style={{ color: 'var(--green)' }} /> {correctCount}
          </span>
        </div>

        {/* Progress bar */}
        <div className="progress-bar mb-4">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Question card */}
        <div className="card mb-3" style={{ minHeight: 120 }}>
          {q.subtopic && (
            <span className="badge mb-2" style={{ fontSize: 10 }}>{q.subtopic}</span>
          )}
          <p style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: safeRenderMd(q.question) }} />
          {q._retry && (
            <span className="badge" style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)', fontSize: 10, marginTop: 8 }}>
              <RotateCcw size={10} /> Retry
            </span>
          )}
        </div>

        {/* Answer input */}
        {q.type === 'multiple_choice' && q.options ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {q.options.map((opt, i) => {
              const letter = String.fromCharCode(65 + i);
              let style: React.CSSProperties = {};
              if (showFeedback) {
                if (opt.toLowerCase().trim() === q.answer.toLowerCase().trim()) {
                  style = { borderColor: 'var(--green)', background: 'var(--green-dim)' };
                } else if (userAnswer === opt && !isCorrect) {
                  style = { borderColor: 'var(--red)', background: 'var(--red-dim)' };
                }
              }
              return (
                <button
                  key={i}
                  className="btn btn-secondary"
                  style={{ textAlign: 'left', justifyContent: 'flex-start', ...style }}
                  disabled={showFeedback}
                  onClick={() => { setUserAnswer(opt); handleAnswer(opt); }}
                >
                  <span style={{ fontWeight: 700, marginRight: 8, opacity: 0.5 }}>{letter}</span>
                  {opt}
                </button>
              );
            })}
          </div>
        ) : q.type === 'true_false' ? (
          <div className="flex gap-2">
            {['True', 'False'].map(tf => {
              let style: React.CSSProperties = { flex: 1 };
              if (showFeedback) {
                if (tf.toLowerCase() === q.answer.toLowerCase()) {
                  style = { ...style, borderColor: 'var(--green)', background: 'var(--green-dim)' };
                } else if (userAnswer === tf && !isCorrect) {
                  style = { ...style, borderColor: 'var(--red)', background: 'var(--red-dim)' };
                }
              }
              return (
                <button
                  key={tf}
                  className="btn btn-secondary"
                  style={style}
                  disabled={showFeedback}
                  onClick={() => { setUserAnswer(tf); handleAnswer(tf); }}
                >
                  {tf}
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); handleAnswer(); }}>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={userAnswer}
                onChange={e => setUserAnswer(e.target.value)}
                placeholder="Type your answer..."
                lang="ja"
                disabled={showFeedback}
                autoFocus
                style={{
                  flex: 1, padding: '12px 16px',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: 15, outline: 'none',
                  imeMode: 'active',
                } as React.CSSProperties}
              />
              <button className="btn btn-primary" type="submit" disabled={showFeedback || !userAnswer.trim()}>
                <CheckCircle size={16} />
              </button>
            </div>
          </form>
        )}

        {/* Feedback */}
        {showFeedback && (
          <div className="card mt-3 animate-in" style={{
            borderColor: isCorrect ? 'var(--green)' : 'var(--red)',
            borderWidth: 2,
          }}>
            <div className="flex items-center gap-2 mb-2">
              {isCorrect ? (
                <><CheckCircle size={18} style={{ color: 'var(--green)' }} /><span style={{ fontWeight: 700, color: 'var(--green)' }}>Correct!</span></>
              ) : (
                <><XCircle size={18} style={{ color: 'var(--red)' }} /><span style={{ fontWeight: 700, color: 'var(--red)' }}>Incorrect</span></>
              )}
            </div>
            {!isCorrect && (
              <p className="text-sm mb-2">
                Answer: <strong style={{ color: 'var(--green)' }}>{q.answer}</strong>
              </p>
            )}
            {q.explanation && (
              <p className="text-sm text-muted" dangerouslySetInnerHTML={{ __html: safeRenderMd(q.explanation) }} />
            )}
            <button className="btn btn-primary btn-sm mt-2" onClick={nextQuestion} style={{ width: '100%' }}>
              <ArrowRight size={14} /> Next Question
            </button>
          </div>
        )}
      </div>

      {/* Floating Rail + Annotation Sidecar */}
      <StudyPageAnnotation
        questionId={q.id}
        questionText={q.question}
        questionType={q.type}
        options={q.options}
        subject={selectedCourse || (session as any).subject || 'Quiz'}
        quizId={session.id}
        showSidecar={showSidecar}
        setShowSidecar={setShowSidecar}
      />
      </div>
    );
  }

  // ─── Results View ─────────────────────────────────────

  if (view === 'results' && session) {
    const total = answers.length;
    const correct = answers.filter(a => a.correct).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgTime = total > 0 ? Math.round(answers.reduce((s, a) => s + a.timeMs, 0) / total / 1000) : 0;
    const isPerfect = correct === total && total > 0;

    // Get concept confidence breakdown
    const concepts = [...new Set(answers.map(a => a.concept))];
    const confidenceData: ConceptConfidence[] = concepts.map(c => getConceptConfidence(c, answers));

    return (
      <div className="animate-in">
        <div className="text-center mb-4">
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            border: `4px solid ${pct >= 70 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)'}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', marginBottom: 16,
          }}>
            <span style={{ fontSize: 32, fontWeight: 900 }}>{pct}%</span>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800 }}>
            {isPerfect ? '🎉 Perfect Score!' : pct >= 80 ? '🌟 Great Job!' : pct >= 60 ? '👍 Good Effort' : '💪 Keep Practicing'}
          </h2>
          {session.mode === 'adaptive' && (
            <span className="badge badge-accent mt-1"><Brain size={10} /> Adaptive Mode</span>
          )}
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          <div className="card text-center" style={{ padding: 12 }}>
            <CheckCircle size={16} style={{ color: 'var(--green)', margin: '0 auto 4px' }} />
            <div style={{ fontSize: 20, fontWeight: 800 }}>{correct}/{total}</div>
            <div className="text-xs text-muted">Correct</div>
          </div>
          <div className="card text-center" style={{ padding: 12 }}>
            <Clock size={16} style={{ color: 'var(--accent)', margin: '0 auto 4px' }} />
            <div style={{ fontSize: 20, fontWeight: 800 }}>{avgTime}s</div>
            <div className="text-xs text-muted">Avg Time</div>
          </div>
          <div className="card text-center" style={{ padding: 12 }}>
            <Sparkles size={16} style={{ color: 'var(--yellow)', margin: '0 auto 4px' }} />
            <div style={{ fontSize: 20, fontWeight: 800 }}>+{correct * 5 + (isPerfect ? 20 : 0)}</div>
            <div className="text-xs text-muted">XP Earned</div>
          </div>
        </div>

        {/* Concept confidence */}
        {confidenceData.length > 0 && (
          <div className="card mb-3">
            <div className="card-title mb-2"><Target size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Concept Analysis</div>
            {confidenceData.map(c => (
              <div key={c.concept} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="text-sm" style={{ flex: 1 }}>{c.concept}</span>
                <span className="badge" style={{
                  fontSize: 10,
                  background: c.status === 'solid' ? 'var(--green-dim)' : c.status === 'shaky' ? 'var(--yellow-dim)' : c.status === 'progressing' ? 'var(--accent-dim)' : 'var(--red-dim)',
                  color: c.status === 'solid' ? 'var(--green)' : c.status === 'shaky' ? 'var(--yellow)' : c.status === 'progressing' ? 'var(--accent)' : 'var(--red)',
                }}>
                  {c.status === 'solid' ? '✓ Solid' : c.status === 'shaky' ? '~ Shaky' : c.status === 'progressing' ? '↑ Growing' : '✗ Gap'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => { setView('menu'); setSession(null); }} style={{ flex: 1 }}>
            <Trophy size={16} /> Done
          </button>
          <button className="btn btn-secondary" onClick={() => startQuiz(selectedCourse || 'all', quizMode)} style={{ flex: 1 }}>
            <RotateCcw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Fallback — should not normally reach here
  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
      <div className="empty-state">
        <BookOpen />
        <h3>Nothing to display</h3>
        <p>Return to the study menu to get started.</p>
      </div>
      <button className="btn btn-primary mt-4" onClick={() => { setView('menu'); setSession(null); }}>
        Back to Menu
      </button>
    </div>
  );
}
