import { useState } from 'react';
import { Shuffle, CheckCircle, XCircle, Trophy } from 'lucide-react';
import { useStore } from '../../store';
import { shuffleArray, cardStyle } from './learnHelpers';
import type { Course, FlashcardItem } from '../../types';

interface DrillCard {
  front: string;
  back: string;
  courseName: string;
  courseColor: string;
  revealed: boolean;
  result: 'correct' | 'missed' | null;
}

interface CourseScore {
  name: string;
  color: string;
  correct: number;
  total: number;
}

export default function InterleaveMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(10);
  const [cards, setCards] = useState<DrillCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [courseScores, setCourseScores] = useState<Map<string, CourseScore>>(new Map());

  function toggleCourse(id: string) {
    setSelectedCourses(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function startSession() {
    const selected = selectedCourses.size > 0
      ? courses.filter(c => selectedCourses.has(c.id))
      : courses;

    const allCards: DrillCard[] = [];
    selected.forEach((course: Course) => {
      (course.flashcards || []).forEach((f: FlashcardItem) => {
        allCards.push({
          front: f.front,
          back: f.back,
          courseName: course.shortName || course.name,
          courseColor: course.color || '#60a5fa',
          revealed: false,
          result: null,
        });
      });
    });

    if (allCards.length === 0) return;
    const shuffled = shuffleArray(allCards).slice(0, questionCount);
    setCards(shuffled);
    setCurrentIdx(0);
    setCourseScores(new Map());
    setPhase('active');
  }

  function reveal() {
    const updated = [...cards];
    updated[currentIdx].revealed = true;
    setCards(updated);
  }

  function markResult(r: 'correct' | 'missed') {
    const updated = [...cards];
    updated[currentIdx].result = r;
    setCards(updated);

    const card = updated[currentIdx];
    setCourseScores(prev => {
      const next = new Map(prev);
      const existing = next.get(card.courseName) || { name: card.courseName, color: card.courseColor, correct: 0, total: 0 };
      existing.total++;
      if (r === 'correct') existing.correct++;
      next.set(card.courseName, existing);
      return next;
    });

    if (currentIdx + 1 >= updated.length) {
      setPhase('results');
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  }

  if (phase === 'setup') {
    return (
      <div>
        <button onClick={onBack} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
          Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Shuffle size={18} style={{ color: '#60a5fa' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Interleave Mode</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Mix flashcards from multiple courses into one session.
        </p>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Select courses:</div>
          {courses.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6, cursor: 'pointer', background: selectedCourses.has(c.id) ? 'rgba(96,165,250,0.08)' : 'transparent' }}>
              <input
                type="checkbox"
                checked={selectedCourses.has(c.id)}
                onChange={() => toggleCourse(c.id)}
                style={{ accentColor: c.color || '#60a5fa' }}
              />
              <span style={{ flex: 1, fontSize: 13 }}>{c.shortName || c.name}</span>
              <span style={{ fontSize: 11, color: '#a0a0a0' }}>{(c.flashcards || []).length} cards</span>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color || '#60a5fa', flexShrink: 0 }} />
            </label>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Questions:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[10, 20, 30].map(n => (
              <button
                key={n}
                className={`btn btn-sm ${questionCount === n ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setQuestionCount(n)}
                style={{ flex: 1 }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary w-full" onClick={startSession} disabled={courses.length === 0}>
          <Shuffle size={14} /> Start Session
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    const card = cards[currentIdx];
    const progress = ((currentIdx + 1) / cards.length) * 100;

    return (
      <div>
        <button onClick={onBack} className="btn btn-sm btn-secondary mb-3">Back</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{currentIdx + 1}/{cards.length}</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 12,
            background: card.courseColor + '22', color: card.courseColor, fontWeight: 600,
          }}>
            {card.courseName}
          </span>
        </div>

        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>

        <div
          style={{ ...cardStyle, marginBottom: 12, minHeight: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: card.revealed ? 'default' : 'pointer' }}
          onClick={!card.revealed ? reveal : undefined}
        >
          <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5, textAlign: 'center' }}>
            {card.front}
          </p>
        </div>

        {card.revealed ? (
          <>
            <div style={{ ...cardStyle, marginBottom: 12, background: 'rgba(96,165,250,0.05)' }}>
              <p style={{ fontSize: 14, color: '#60a5fa', lineHeight: 1.6, textAlign: 'center' }}>{card.back}</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid #f87171' }} onClick={() => markResult('missed')}>
                <XCircle size={14} /> Missed it
              </button>
              <button className="btn" style={{ flex: 1, background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid #4ade80' }} onClick={() => markResult('correct')}>
                <CheckCircle size={14} /> Got it
              </button>
            </div>
          </>
        ) : (
          <button className="btn btn-secondary w-full" onClick={reveal}>Reveal Answer</button>
        )}
      </div>
    );
  }

  // Results
  const totalCorrect = Array.from(courseScores.values()).reduce((s, c) => s + c.correct, 0);
  const totalCards = cards.length;
  const pct = totalCards > 0 ? Math.round((totalCorrect / totalCards) * 100) : 0;
  const xp = Math.round(totalCorrect * 2);

  return (
    <div>
      <button onClick={() => setPhase('setup')} className="btn btn-sm btn-secondary mb-3">Back</button>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Trophy size={32} style={{ color: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 800 }}>{pct}%</div>
        <div style={{ color: '#a0a0a0', fontSize: 13 }}>{totalCorrect}/{totalCards} correct · +{xp} XP</div>
      </div>

      {Array.from(courseScores.values()).map(cs => (
        <div key={cs.name} style={{ ...cardStyle, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cs.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13 }}>{cs.name}</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: cs.correct / cs.total >= 0.8 ? '#4ade80' : cs.correct / cs.total >= 0.5 ? '#fbbf24' : '#f87171' }}>
            {cs.correct}/{cs.total}
          </span>
        </div>
      ))}

      <button className="btn btn-primary w-full mt-3" onClick={() => setPhase('setup')}>
        New Session
      </button>
    </div>
  );
}
