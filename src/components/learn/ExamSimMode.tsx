import { useState, useEffect, useMemo, useRef } from 'react';
import { Clock, BookOpen, Trophy, CheckCircle, XCircle, ArrowRight, RotateCcw, HelpCircle } from 'lucide-react';
import { useStore } from '../../store';
import { isAIConfigured } from '../../utils/ai';
import { safeRenderMd } from '../../utils/renderMd';
import QuizAIChat from '../QuizAIChat';
import { shuffleArray, cardStyle, inputStyle, SubjectPicker } from './learnHelpers';

export default function ExamSimMode() {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'exam' | 'results'>('setup');
  const [timeMin, setTimeMin] = useState(15);
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<{ q: string; a: string; userA: string }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [results, setResults] = useState<{ correct: number; total: number }[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const timerRef = useRef<number>(0);
  const [showAIChat, setShowAIChat] = useState(false);

  // Derive available topics from flashcards in selected course
  const availableTopics = useMemo(() => {
    const course = courses.find(c => c.id === subject);
    if (!course) return [];
    const topicCounts = new Map<string, number>();
    (course.flashcards || []).forEach(f => {
      if (f.topic) topicCounts.set(f.topic, (topicCounts.get(f.topic) || 0) + 1);
    });
    return Array.from(topicCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [subject, courses]);

  // Reset topic selection when course changes
  useEffect(() => { setSelectedTopics(new Set()); }, [subject]);

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      return next;
    });
  }

  function startExam() {
    const course = courses.find(c => c.id === subject);
    let cards = course?.flashcards || courses.flatMap(c => c.flashcards || []);
    if (selectedTopics.size > 0) {
      cards = cards.filter(f => f.topic && selectedTopics.has(f.topic));
    }
    if (cards.length === 0) return;
    const selected = shuffleArray(cards).slice(0, Math.min(20, cards.length));
    setQuestions(selected.map(c => ({ q: c.front, a: c.back, userA: '' })));
    setCurrentIdx(0);
    setUserAnswer('');
    setTimeLeft(timeMin * 60);
    setPhase('exam');
  }

  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setPhase('results');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  function submitAnswer() {
    const updated = [...questions];
    updated[currentIdx].userA = userAnswer;
    setQuestions(updated);
    if (currentIdx + 1 >= questions.length) {
      clearInterval(timerRef.current);
      setPhase('results');
    } else {
      setCurrentIdx(currentIdx + 1);
      setUserAnswer('');
    }
  }

  function finishExam() {
    clearInterval(timerRef.current);
    const updated = [...questions];
    updated[currentIdx].userA = userAnswer;
    setQuestions(updated);
    setPhase('results');
  }

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (phase === 'setup') {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          Timed exam simulation. Answer as many questions as you can before time runs out.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
        {subject && availableTopics.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ fontWeight: 600 }}>Chapters:</span>
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              <button
                className={`btn btn-sm ${selectedTopics.size === 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTopics(new Set())}
                style={{ padding: '4px 10px', fontSize: 11 }}
              >
                All ({courses.find(c => c.id === subject)?.flashcards?.length || 0})
              </button>
              {availableTopics.map(t => (
                <button
                  key={t.name}
                  className={`btn btn-sm ${selectedTopics.has(t.name) ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleTopic(t.name)}
                  style={{ padding: '4px 10px', fontSize: 11 }}
                >
                  {t.name} ({t.count})
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <span className="text-sm" style={{ fontWeight: 600 }}>Time limit:</span>
          {[5, 10, 15, 25, 45].map(m => (
            <button key={m} className={`btn btn-sm ${timeMin === m ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTimeMin(m)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {m}m
            </button>
          ))}
        </div>
        <button className="btn btn-primary w-full" onClick={startExam}>
          <Clock size={14} /> Start Exam
        </button>
      </div>
    );
  }

  if (phase === 'exam') {
    const progress = ((currentIdx + 1) / questions.length) * 100;
    const q = questions[currentIdx];
    const isLow = timeLeft < 60;
    // Announce timer milestones to screen readers
    const timerAnnouncement = timeLeft === 300 ? '5 minutes remaining'
      : timeLeft === 120 ? '2 minutes remaining'
      : timeLeft === 60 ? '1 minute remaining'
      : timeLeft === 30 ? '30 seconds remaining'
      : '';
    return (
      <div style={{ display: 'flex', position: 'relative' }}>
        {/* Screen reader timer announcements */}
        <div aria-live="assertive" aria-atomic="true" style={{ position: 'absolute', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden' }}>
          {timerAnnouncement}
        </div>
        <div style={{ flex: 1 }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ fontWeight: 600 }}>Q{currentIdx + 1}/{questions.length}</span>
            <span
              role="timer"
              aria-label={`Time remaining: ${formatTime(timeLeft)}`}
              className="text-sm"
              style={{
                fontWeight: 700, fontFamily: 'monospace',
                color: isLow ? 'var(--red)' : 'var(--text-primary)',
              }}
            >
              <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {formatTime(timeLeft)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Question ${currentIdx + 1} of ${questions.length}`}
            className="progress-bar mb-3"
          >
            <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
          </div>
          <div style={{ ...cardStyle, background: 'var(--bg-primary)', marginBottom: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}
              dangerouslySetInnerHTML={{ __html: safeRenderMd(q.q) }} />
          </div>
          <form onSubmit={e => { e.preventDefault(); submitAnswer(); }}>
            <div className="flex gap-2">
              <input
                type="text" value={userAnswer} onChange={e => setUserAnswer(e.target.value)}
                placeholder="Your answer..."
                lang="ja"
                style={{ ...inputStyle, flex: 1, imeMode: 'active' } as React.CSSProperties} autoFocus
              />
              <button className="btn btn-primary btn-sm" type="submit">
                <ArrowRight size={14} />
              </button>
            </div>
          </form>
          <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={finishExam}>
            Finish Early
          </button>
        </div>
        {isAIConfigured() && (
          <QuizAIChat
            questionText={q.q}
            subject={subject}
            show={showAIChat}
            onToggle={() => setShowAIChat(p => !p)}
          />
        )}
      </div>
    );
  }

  // Results
  const answered = questions.filter(q => q.userA.trim());
  const correct = answered.filter(q =>
    q.userA.toLowerCase().trim().includes(q.a.toLowerCase().trim().slice(0, 15))
  );
  const pct = answered.length > 0 ? Math.round((correct.length / answered.length) * 100) : 0;

  return (
    <div>
      <div className="text-center mb-3">
        <Trophy size={32} style={{ color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 800 }}>{pct}%</div>
        <div className="text-sm text-muted">{correct.length}/{answered.length} correct, {questions.length - answered.length} unanswered</div>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {questions.map((q, i) => {
          const isCorrect = q.userA.toLowerCase().trim().includes(q.a.toLowerCase().trim().slice(0, 15));
          return (
            <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
              <div className="flex items-center gap-2">
                {q.userA.trim() ? (
                  isCorrect ? <CheckCircle size={12} style={{ color: 'var(--green)' }} /> : <XCircle size={12} style={{ color: 'var(--red)' }} />
                ) : (
                  <HelpCircle size={12} style={{ color: 'var(--text-muted)' }} />
                )}
                <span style={{ fontWeight: 600 }}>{q.q}</span>
              </div>
              {!isCorrect && q.userA.trim() && (
                <div className="text-xs text-muted" style={{ marginLeft: 20 }}>Correct: {q.a}</div>
              )}
            </div>
          );
        })}
      </div>
      <button className="btn btn-primary btn-sm mt-3 w-full" onClick={() => setPhase('setup')}>
        <RotateCcw size={14} /> Try Again
      </button>
    </div>
  );
}
