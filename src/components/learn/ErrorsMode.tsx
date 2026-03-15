import { useState, useMemo } from 'react';
import { XCircle, CheckCircle, Star, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { BackBtn, SubjectPicker, cardStyle, inputStyle } from './learnHelpers';
import type { QuizAnswer } from '../../types';

interface ErrorQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  subject: string;
  explanation?: string;
  userAnswer: string;
  submitted: boolean;
  conquered: boolean | null;
}

export default function ErrorsMode({ onBack }: { onBack: () => void }) {
  const { courses, quizHistory } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [questions, setQuestions] = useState<ErrorQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState('');
  const [conqueredCount, setConqueredCount] = useState(0);
  const [stillWrongCount, setStillWrongCount] = useState(0);

  const wrongCount = useMemo(() => {
    const filtered = subject
      ? quizHistory.filter(a => a.subject === subject || a.folder === subject)
      : quizHistory;
    return filtered.reduce((sum, attempt) =>
      sum + (attempt.answers || []).filter((a: QuizAnswer) => !a.correct).length, 0
    );
  }, [quizHistory, subject]);

  function startReview() {
    const filtered = subject
      ? quizHistory.filter(a => a.subject === subject || a.folder === subject)
      : quizHistory;

    const wrongAnswers: ErrorQuestion[] = [];
    const seen = new Set<string>();

    filtered.forEach(attempt => {
      (attempt.answers || []).forEach((ans: QuizAnswer) => {
        if (!ans.correct && ans.question?.question) {
          const key = ans.question.question;
          if (!seen.has(key)) {
            seen.add(key);
            wrongAnswers.push({
              question: ans.question.question,
              options: ans.question.options || [],
              correctAnswer: ans.question.correctAnswer || '',
              subject: attempt.subtopic || attempt.name || 'General',
              explanation: ans.question.explanation,
              userAnswer: '',
              submitted: false,
              conquered: null,
            });
          }
        }
      });
    });

    if (wrongAnswers.length === 0) return;
    setQuestions(wrongAnswers.slice(0, 20));
    setCurrentIdx(0);
    setSelectedOption('');
    setTextAnswer('');
    setConqueredCount(0);
    setStillWrongCount(0);
    setPhase('active');
  }

  function submitAnswer() {
    const answer = questions[currentIdx].options.length > 0 ? selectedOption : textAnswer;
    if (!answer.trim()) return;
    const updated = [...questions];
    updated[currentIdx].userAnswer = answer;
    updated[currentIdx].submitted = true;
    const isCorrect = answer.toLowerCase().trim().includes(
      updated[currentIdx].correctAnswer.toLowerCase().trim().slice(0, 20)
    ) || answer.toLowerCase().trim() === updated[currentIdx].correctAnswer.toLowerCase().trim();
    updated[currentIdx].conquered = isCorrect;
    if (isCorrect) setConqueredCount(c => c + 1);
    else setStillWrongCount(c => c + 1);
    setQuestions(updated);
    setSelectedOption('');
    setTextAnswer('');
  }

  function next() {
    if (currentIdx + 1 >= questions.length) setPhase('results');
    else setCurrentIdx(currentIdx + 1);
  }

  if (phase === 'setup') {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <XCircle size={18} style={{ color: '#f87171' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Error Review</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Review only your previously wrong answers to conquer them.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />

        {wrongCount === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#a0a0a0', padding: 24 }}>
            No wrong answers found{subject ? ' for this subject' : ''}. Take some quizzes first!
          </div>
        ) : (
          <>
            <div style={{ ...cardStyle, marginBottom: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#f87171' }}>{wrongCount}</div>
              <div style={{ fontSize: 12, color: '#a0a0a0' }}>wrong answers to review</div>
            </div>
            <button className="btn btn-primary w-full" onClick={startReview}>
              <XCircle size={14} /> Start Error Review
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'active') {
    const q = questions[currentIdx];
    const progress = ((currentIdx + 1) / questions.length) * 100;
    const hasOptions = q.options.length > 0;

    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{currentIdx + 1}/{questions.length}</span>
          <span style={{ fontSize: 11, color: '#fbbf24' }}>{q.subject}</span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{ width: `${progress}%`, background: '#f87171' }} />
        </div>

        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{q.question}</p>
        </div>

        {!q.submitted ? (
          <div>
            {hasOptions ? (
              <div style={{ marginBottom: 8 }}>
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedOption(opt)}
                    style={{
                      display: 'block', width: '100%', padding: '10px 14px', marginBottom: 6,
                      border: `2px solid ${selectedOption === opt ? '#60a5fa' : 'var(--border)'}`,
                      borderRadius: 8, background: selectedOption === opt ? 'rgba(96,165,250,0.1)' : 'transparent',
                      color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={textAnswer}
                onChange={e => setTextAnswer(e.target.value)}
                placeholder="Your answer..."
                style={{ ...inputStyle, marginBottom: 8 }}
                onKeyDown={e => { if (e.key === 'Enter') submitAnswer(); }}
                autoFocus
              />
            )}
            <button
              className="btn btn-primary w-full"
              onClick={submitAnswer}
              disabled={hasOptions ? !selectedOption : !textAnswer.trim()}
            >
              Submit
            </button>
          </div>
        ) : (
          <div>
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: q.conquered ? '#4ade80' : '#f87171' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {q.conquered
                  ? <><Star size={16} style={{ color: '#fbbf24' }} /><span style={{ fontWeight: 700, color: '#4ade80' }}>Conquered!</span></>
                  : <><XCircle size={16} style={{ color: '#f87171' }} /><span style={{ fontWeight: 700, color: '#f87171' }}>Still wrong</span></>}
              </div>
              <p style={{ fontSize: 13 }}>Correct: <strong>{q.correctAnswer}</strong></p>
              {q.explanation && (
                <p style={{ fontSize: 12, color: '#a0a0a0', marginTop: 6 }}>{q.explanation}</p>
              )}
            </div>
            <button className="btn btn-primary w-full" onClick={next}>
              {currentIdx + 1 >= questions.length ? 'See Results' : 'Next'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Results
  const total = questions.length;
  const pct = total > 0 ? Math.round((conqueredCount / total) * 100) : 0;

  return (
    <div>
      <BackBtn onClick={() => setPhase('setup')} />
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Star size={32} style={{ color: '#fbbf24', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 800, color: '#4ade80' }}>{conqueredCount}</div>
        <div style={{ color: '#a0a0a0', fontSize: 13 }}>conquered · {stillWrongCount} still need work</div>
        <div style={{ fontSize: 14, color: '#a0a0a0', marginTop: 4 }}>{pct}% mastery</div>
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#4ade80' }}>{conqueredCount}</div>
          <div style={{ fontSize: 11, color: '#a0a0a0' }}>Conquered</div>
        </div>
        <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: '#f87171' }}>{stillWrongCount}</div>
          <div style={{ fontSize: 11, color: '#a0a0a0' }}>Still Wrong</div>
        </div>
      </div>
      <button className="btn btn-primary w-full" onClick={() => setPhase('setup')}>
        <RotateCcw size={14} /> Review Again
      </button>
    </div>
  );
}
