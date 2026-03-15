import { useState } from 'react';
import { BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, textareaStyle, inputStyle } from './learnHelpers';

interface TLDRResult {
  coverageScore: number;
  accuracyScore: number;
  missingConcepts: string[];
  praise: string;
}

export default function TLDRMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [bullets, setBullets] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TLDRResult | null>(null);
  const [error, setError] = useState('');

  function scoreColor(score: number): string {
    if (score >= 8) return '#4ade80';
    if (score >= 5) return '#fbbf24';
    return '#f87171';
  }

  const bulletLines = bullets.split('\n').filter(l => l.trim()).slice(0, 5);

  async function submit() {
    if (bulletLines.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const bulletText = bulletLines.map((b, i) => `${i + 1}. ${b.replace(/^[-•*]\s*/, '')}`).join('\n');
      const prompt = `Evaluate this TLDR summary of "${topic}". Respond with JSON only, no markdown: {"coverageScore": 1-10, "accuracyScore": 1-10, "missingConcepts": ["string"], "praise": "string"}.\n\nSummary bullets:\n${bulletText}`;
      const raw = await callAI([{ role: 'user', content: prompt }], { json: true }, 'analysis');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(cleaned));
      setPhase('results');
    } catch {
      setError('Failed to evaluate summary. Please try again.');
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
          <BookOpen size={18} style={{ color: '#4ade80' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>TLDR Summary</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Summarize a topic in 5 bullets. AI scores your coverage and accuracy.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
        <input
          type="text"
          placeholder="Topic to summarize..."
          value={topic}
          onChange={e => setTopic(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <button
          className="btn btn-primary w-full"
          onClick={() => { if (topic.trim()) setPhase('active'); }}
          disabled={!topic.trim()}
        >
          Start
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    const lineCount = bullets.split('\n').filter(l => l.trim()).length;
    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 4 }}>Topic</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{topic}</div>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 8 }}>
          Write up to 5 key bullets summarizing this topic. One per line.
        </p>
        <div style={{ position: 'relative' }}>
          <textarea
            value={bullets}
            onChange={e => setBullets(e.target.value)}
            placeholder="• Key point 1&#10;• Key point 2&#10;• Key point 3"
            rows={7}
            style={{ ...textareaStyle, marginBottom: 4 }}
          />
          <div style={{ fontSize: 11, color: lineCount > 5 ? '#f87171' : '#a0a0a0', marginBottom: 8 }}>
            {lineCount}/5 bullets
          </div>
        </div>
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={submit}
          disabled={loading || bulletLines.length === 0}
        >
          {loading ? 'Evaluating...' : 'Submit Summary'}
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
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Coverage</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(result.coverageScore) }}>
                {result.coverageScore}/10
              </div>
            </div>
            <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Accuracy</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(result.accuracyScore) }}>
                {result.accuracyScore}/10
              </div>
            </div>
          </div>

          {result.praise && (
            <div style={{ ...cardStyle, marginBottom: 10, borderColor: '#4ade80' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <CheckCircle size={14} style={{ color: '#4ade80' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Well done</span>
              </div>
              <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>{result.praise}</p>
            </div>
          )}

          {result.missingConcepts && result.missingConcepts.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertCircle size={14} style={{ color: '#fbbf24' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>Missing Concepts</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.missingConcepts.map((c, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#fbbf24', marginBottom: 4 }}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setBullets(''); setResult(null); setPhase('active'); }}>
              Try Again
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setTopic(''); setBullets(''); setResult(null); setPhase('setup'); }}>
              New Topic
            </button>
          </div>
        </>
      )}
    </div>
  );
}
