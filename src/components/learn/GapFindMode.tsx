import { useState, useMemo } from 'react';
import { Target, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import { BackBtn, SubjectPicker, cardStyle } from './learnHelpers';
import type { QuizAnswer } from '../../types';

interface WeakTopic {
  topic: string;
  wrongCount: number;
  questions: { question: string; correctAnswer: string; userAnswer: string }[];
}

interface DrillQuestion {
  question: string;
  correctAnswer: string;
  topic: string;
  userAnswer: string;
  submitted: boolean;
}

export default function GapFindMode({ onBack }: { onBack: () => void }) {
  const { courses, quizHistory } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [drillQuestions, setDrillQuestions] = useState<DrillQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [score, setScore] = useState(0);

  const weakTopics = useMemo((): WeakTopic[] => {
    const filtered = subject
      ? quizHistory.filter(a => a.subject === subject || a.folder === subject)
      : quizHistory;

    const topicMap = new Map<string, { wrongCount: number; questions: { question: string; correctAnswer: string; userAnswer: string }[] }>();

    filtered.forEach(attempt => {
      (attempt.answers || []).forEach((ans: QuizAnswer) => {
        if (!ans.correct) {
          const topic = attempt.subtopic || attempt.name || 'General';
          const existing = topicMap.get(topic) || { wrongCount: 0, questions: [] };
          existing.wrongCount++;
          if (existing.questions.length < 3) {
            existing.questions.push({
              question: ans.question?.question || '',
              correctAnswer: ans.question?.correctAnswer || '',
              userAnswer: ans.userAnswer || '',
            });
          }
          topicMap.set(topic, existing);
        }
      });
    });

    return Array.from(topicMap.entries())
      .sort((a, b) => b[1].wrongCount - a[1].wrongCount)
      .slice(0, 5)
      .map(([topic, data]) => ({ topic, ...data }));
  }, [quizHistory, subject]);

  function startDrill() {
    const questions: DrillQuestion[] = [];
    weakTopics.forEach(wt => {
      wt.questions.slice(0, 1).forEach(q => {
        if (q.question) {
          questions.push({
            question: q.question,
            correctAnswer: q.correctAnswer,
            topic: wt.topic,
            userAnswer: '',
            submitted: false,
          });
        }
      });
    });
    if (questions.length === 0) return;
    setDrillQuestions(questions);
    setCurrentIdx(0);
    setInputVal('');
    setScore(0);
    setPhase('active');
  }

  function submitAnswer() {
    const updated = [...drillQuestions];
    updated[currentIdx].userAnswer = inputVal;
    updated[currentIdx].submitted = true;
    const isCorrect = inputVal.toLowerCase().trim().includes(
      updated[currentIdx].correctAnswer.toLowerCase().trim().slice(0, 15)
    );
    if (isCorrect) setScore(s => s + 1);
    setDrillQuestions(updated);
    setInputVal('');
  }

  function next() {
    if (currentIdx + 1 >= drillQuestions.length) {
      setPhase('results');
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  }

  if (phase === 'setup') {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Target size={18} style={{ color: '#f87171' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Gap Finder</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Analyzes your quiz history to find weak areas and drills them.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />

        {weakTopics.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: '#a0a0a0', padding: 24 }}>
            <AlertCircle size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
            No quiz history yet — take some quizzes first!
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Top Weak Areas:</div>
              {weakTopics.map((wt, i) => (
                <div key={i} style={{ ...cardStyle, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13 }}>{wt.topic}</span>
                  <span style={{ fontSize: 12, color: '#f87171', fontWeight: 600 }}>{wt.wrongCount} wrong</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary w-full" onClick={startDrill}>
              <Target size={14} /> Start Drill
            </button>
          </>
        )}
      </div>
    );
  }

  if (phase === 'active') {
    const q = drillQuestions[currentIdx];
    const isCorrect = q.submitted && q.userAnswer.toLowerCase().trim().includes(
      q.correctAnswer.toLowerCase().trim().slice(0, 15)
    );

    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Q{currentIdx + 1}/{drillQuestions.length}</span>
          <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', padding: '2px 8px', borderRadius: 12 }}>
            {q.topic}
          </span>
        </div>
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{q.question}</p>
        </div>
        {!q.submitted ? (
          <form onSubmit={e => { e.preventDefault(); submitAnswer(); }}>
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Your answer..."
              style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit', marginBottom: 8, boxSizing: 'border-box' }}
              autoFocus
            />
            <button className="btn btn-primary w-full" type="submit">Submit</button>
          </form>
        ) : (
          <div>
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: isCorrect ? '#4ade80' : '#f87171' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {isCorrect
                  ? <CheckCircle size={16} style={{ color: '#4ade80' }} />
                  : <XCircle size={16} style={{ color: '#f87171' }} />}
                <span style={{ fontWeight: 600, color: isCorrect ? '#4ade80' : '#f87171' }}>
                  {isCorrect ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
              {!isCorrect && (
                <p style={{ fontSize: 13, color: '#e8e8e8' }}>
                  Correct answer: <strong>{q.correctAnswer}</strong>
                </p>
              )}
            </div>
            <button className="btn btn-primary w-full" onClick={next}>
              {currentIdx + 1 >= drillQuestions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Results
  const pct = drillQuestions.length > 0 ? Math.round((score / drillQuestions.length) * 100) : 0;
  return (
    <div>
      <BackBtn onClick={() => setPhase('setup')} />
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Target size={32} style={{ color: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 800 }}>{pct}%</div>
        <div style={{ color: '#a0a0a0', fontSize: 13 }}>{score}/{drillQuestions.length} correct on your weak areas</div>
      </div>
      <button className="btn btn-primary w-full" onClick={() => setPhase('setup')}>Try Again</button>
    </div>
  );
}
