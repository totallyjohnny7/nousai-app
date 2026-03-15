import { useState, useMemo } from 'react';
import { Link, Shuffle, CheckCircle } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, textareaStyle, inputStyle, shuffleArray } from './learnHelpers';

interface ConnectResult {
  score: number;
  feedback: string;
  idealConnection: string;
  relatedConcepts: string[];
}

export default function ConnectMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [conceptA, setConceptA] = useState('');
  const [conceptB, setConceptB] = useState('');
  const [connection, setConnection] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ConnectResult | null>(null);
  const [error, setError] = useState('');

  const courseFronts = useMemo(() => {
    const course = courses.find(c => c.id === subject);
    const cards = course?.flashcards || [];
    return cards.map(f => f.front).filter(Boolean);
  }, [subject, courses]);

  function pickRandomConcepts() {
    if (courseFronts.length < 2) return;
    const shuffled = shuffleArray(courseFronts);
    setConceptA(shuffled[0]);
    setConceptB(shuffled[1]);
  }

  function scoreColor(score: number): string {
    if (score >= 8) return '#4ade80';
    if (score >= 5) return '#fbbf24';
    return '#f87171';
  }

  async function submitConnection() {
    if (!connection.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Evaluate this connection between "${conceptA}" and "${conceptB}". Respond with JSON only, no markdown: {"score": 1-10, "feedback": "string", "idealConnection": "string", "relatedConcepts": ["string"]}.\n\nUser's connection: ${connection}`;
      const raw = await callAI([{ role: 'user', content: prompt }], { json: true }, 'chat');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(cleaned));
      setPhase('results');
    } catch {
      setError('Failed to evaluate connection. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAIConfigured()) {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <p style={{ color: '#a0a0a0' }}>Please configure an AI provider in Settings.</p>
      </div>
    );
  }

  if (phase === 'setup') {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Link size={18} style={{ color: '#60a5fa' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Connect Mode</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Find connections between two concepts. AI evaluates the depth of your reasoning.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />

        {subject && courseFronts.length >= 2 && (
          <button className="btn btn-secondary w-full" onClick={pickRandomConcepts} style={{ marginBottom: 12 }}>
            <Shuffle size={14} /> Auto-pick from flashcards
          </button>
        )}

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 4 }}>Concept A</div>
          <input
            type="text"
            placeholder="First concept..."
            value={conceptA}
            onChange={e => setConceptA(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 4 }}>Concept B</div>
          <input
            type="text"
            placeholder="Second concept..."
            value={conceptB}
            onChange={e => setConceptB(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={() => { if (conceptA.trim() && conceptB.trim()) setPhase('active'); }}
          disabled={!conceptA.trim() || !conceptB.trim()}
        >
          <Link size={14} /> Find Connection
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Concept A</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{conceptA}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', color: '#60a5fa' }}>
            <Link size={20} />
          </div>
          <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Concept B</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{conceptB}</div>
          </div>
        </div>

        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 8 }}>
          Explain how <strong style={{ color: '#e8e8e8' }}>{conceptA}</strong> and <strong style={{ color: '#e8e8e8' }}>{conceptB}</strong> are related.
        </p>
        <textarea
          value={connection}
          onChange={e => setConnection(e.target.value)}
          placeholder="Describe the connection between these two concepts..."
          rows={6}
          style={{ ...textareaStyle, marginBottom: 8 }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={submitConnection}
          disabled={loading || !connection.trim()}
        >
          {loading ? 'Evaluating...' : 'Submit Connection'}
        </button>
      </div>
    );
  }

  // Results
  return (
    <div>
      <BackBtn onClick={() => setPhase('setup')} />
      {result && (
        <>
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(result.score) }}>
              {result.score}/10
            </div>
            <div style={{ fontSize: 13, color: '#a0a0a0' }}>Connection Score</div>
          </div>

          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Feedback</div>
            <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>{result.feedback}</p>
          </div>

          <div style={{ ...cardStyle, marginBottom: 10, borderColor: '#60a5fa' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <CheckCircle size={14} style={{ color: '#60a5fa' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>Ideal Connection</span>
            </div>
            <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>{result.idealConnection}</p>
          </div>

          {result.relatedConcepts && result.relatedConcepts.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Related Concepts</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.relatedConcepts.map((c, i) => (
                  <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: 'rgba(167,139,250,0.15)', color: '#a78bfa' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setConnection(''); setResult(null); setPhase('active'); }}>
              Try Again
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setConceptA(''); setConceptB(''); setConnection(''); setResult(null); setPhase('setup'); }}>
              New Concepts
            </button>
          </div>
        </>
      )}
    </div>
  );
}
