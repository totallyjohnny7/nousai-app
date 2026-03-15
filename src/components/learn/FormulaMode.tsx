import { useState } from 'react';
import { Calculator, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import katex from 'katex';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, inputStyle } from './learnHelpers';

interface FormulaCard {
  full: string;
  blanked: string;
  answer: string;
  rendered: string;
  userAnswer: string;
  submitted: boolean;
  correct: boolean | null;
}

function safeKatex(formula: string): string {
  try {
    return katex.renderToString(formula, { throwOnError: false, displayMode: false });
  } catch {
    return `<span>${formula}</span>`;
  }
}

function extractFormulas(flashcards: { front: string; back: string }[]): FormulaCard[] {
  const formulaRegex = /[=+\-*/^∫∑√π²³]/;
  const results: FormulaCard[] = [];

  flashcards.forEach(f => {
    const text = f.front.includes('=') ? f.front : f.back.includes('=') ? f.back : null;
    if (!text || !formulaRegex.test(text)) return;

    const eqIdx = text.indexOf('=');
    if (eqIdx === -1) return;

    const left = text.slice(0, eqIdx).trim();
    const right = text.slice(eqIdx + 1).trim();
    if (!left || !right) return;

    // Randomly blank left or right side
    const blankLeft = Math.random() > 0.5;
    const answer = blankLeft ? left : right;
    const blanked = blankLeft ? `[BLANK] = ${right}` : `${left} = [BLANK]`;

    results.push({
      full: text,
      blanked,
      answer,
      rendered: safeKatex(blanked.replace('[BLANK]', '\\boxed{?}')),
      userAnswer: '',
      submitted: false,
      correct: null,
    });
  });

  return results;
}

export default function FormulaMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [cards, setCards] = useState<FormulaCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [inputVal, setInputVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [score, setScore] = useState(0);

  async function startDrill() {
    const course = courses.find(c => c.id === subject);
    const flashcards = course?.flashcards || courses.flatMap(c => c.flashcards || []);
    const extracted = extractFormulas(flashcards).slice(0, 10);

    if (extracted.length > 0) {
      setCards(extracted);
      setCurrentIdx(0);
      setInputVal('');
      setScore(0);
      setPhase('active');
      return;
    }

    if (!isAIConfigured()) {
      setError('No formula cards found. Configure an AI provider to generate formulas.');
      return;
    }

    if (!topic.trim()) {
      setError('No formula flashcards found. Enter a topic to generate formulas with AI.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const prompt = `Generate 5 important formulas for the topic "${topic}". Respond with JSON only, no markdown: [{"formula": "E = mc^2", "description": "Mass-energy equivalence"}, ...]`;
      const raw = await callAI([{ role: 'user', content: prompt }], { json: true });
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const items: { formula: string; description: string }[] = JSON.parse(cleaned);

      const generated: FormulaCard[] = items
        .filter(item => item.formula.includes('='))
        .map(item => {
          const eqIdx = item.formula.indexOf('=');
          const left = item.formula.slice(0, eqIdx).trim();
          const right = item.formula.slice(eqIdx + 1).trim();
          const blankLeft = Math.random() > 0.5;
          const answer = blankLeft ? left : right;
          const blanked = blankLeft ? `[BLANK] = ${right}` : `${left} = [BLANK]`;
          return {
            full: item.formula,
            blanked,
            answer,
            rendered: safeKatex(blanked.replace('[BLANK]', '\\boxed{?}')),
            userAnswer: '',
            submitted: false,
            correct: null,
          };
        });

      if (generated.length === 0) throw new Error('No formulas parsed');
      setCards(generated);
      setCurrentIdx(0);
      setInputVal('');
      setScore(0);
      setPhase('active');
    } catch {
      setError('Failed to generate formulas. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer() {
    const updated = [...cards];
    const card = updated[currentIdx];
    card.userAnswer = inputVal;
    card.submitted = true;
    const isCorrect = inputVal.toLowerCase().replace(/\s/g, '') ===
      card.answer.toLowerCase().replace(/\s/g, '');
    card.correct = isCorrect;
    if (isCorrect) setScore(s => s + 1);
    setCards(updated);
    setInputVal('');
  }

  function next() {
    if (currentIdx + 1 >= cards.length) setPhase('results');
    else setCurrentIdx(currentIdx + 1);
  }

  if (phase === 'setup') {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Calculator size={18} style={{ color: '#60a5fa' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Formula Drill</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Fill in the blank for formulas from your flashcards. If none found, AI will generate them.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
        <input
          type="text"
          placeholder="Topic for AI-generated formulas (optional)"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button className="btn btn-primary w-full" onClick={startDrill} disabled={loading}>
          {loading ? 'Generating...' : <><Calculator size={14} /> Start Drill</>}
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    const card = cards[currentIdx];
    const progress = ((currentIdx + 1) / cards.length) * 100;

    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{currentIdx + 1}/{cards.length}</span>
          <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>{score} correct</span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>

        <div style={{ ...cardStyle, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 8 }}>Fill in the blank:</div>
          <div
            style={{ fontSize: 18, fontWeight: 600 }}
            dangerouslySetInnerHTML={{ __html: card.rendered }}
          />
        </div>

        {!card.submitted ? (
          <form onSubmit={e => { e.preventDefault(); submitAnswer(); }}>
            <input
              type="text"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              placeholder="Answer..."
              style={{ ...inputStyle, marginBottom: 8 }}
              autoFocus
            />
            <button className="btn btn-primary w-full" type="submit" disabled={!inputVal.trim()}>
              Check
            </button>
          </form>
        ) : (
          <div>
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: card.correct ? '#4ade80' : '#f87171' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                {card.correct
                  ? <CheckCircle size={16} style={{ color: '#4ade80' }} />
                  : <XCircle size={16} style={{ color: '#f87171' }} />}
                <span style={{ fontWeight: 600, color: card.correct ? '#4ade80' : '#f87171' }}>
                  {card.correct ? 'Correct!' : 'Incorrect'}
                </span>
              </div>
              {!card.correct && (
                <p style={{ fontSize: 13, color: '#e8e8e8' }}>Answer: <strong>{card.answer}</strong></p>
              )}
              <p style={{ fontSize: 12, color: '#a0a0a0', marginTop: 4 }}>Full: {card.full}</p>
            </div>
            <button className="btn btn-primary w-full" onClick={next}>
              {currentIdx + 1 >= cards.length ? 'See Results' : 'Next'}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Results
  const pct = cards.length > 0 ? Math.round((score / cards.length) * 100) : 0;
  return (
    <div>
      <BackBtn onClick={() => setPhase('setup')} />
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Calculator size={32} style={{ color: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 28, fontWeight: 800 }}>{pct}%</div>
        <div style={{ color: '#a0a0a0', fontSize: 13 }}>{score}/{cards.length} formulas correct</div>
      </div>
      <div style={{ maxHeight: 200, overflowY: 'auto' }}>
        {cards.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
            {c.correct
              ? <CheckCircle size={12} style={{ color: '#4ade80', flexShrink: 0 }} />
              : <XCircle size={12} style={{ color: '#f87171', flexShrink: 0 }} />}
            <span>{c.full}</span>
          </div>
        ))}
      </div>
      <button className="btn btn-primary w-full mt-3" onClick={() => setPhase('setup')}>
        <RotateCcw size={14} /> Try Again
      </button>
    </div>
  );
}
