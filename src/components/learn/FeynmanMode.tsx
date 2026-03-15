import { useState } from 'react';
import { Brain, CheckCircle, XCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, textareaStyle, inputStyle } from './learnHelpers';

interface FeynmanResult {
  clarityScore: number;
  accuracyScore: number;
  feedback: string;
  gaps: string[];
  suggestion: string;
}

export default function FeynmanMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [phase, setPhase] = useState<'setup' | 'active' | 'graded'>('setup');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FeynmanResult | null>(null);
  const [error, setError] = useState('');

  function scoreColor(score: number): string {
    if (score >= 8) return '#4ade80';
    if (score >= 5) return '#fbbf24';
    return '#f87171';
  }

  async function submitExplanation() {
    if (!explanation.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Grade this Feynman explanation of '${topic}'. Respond with JSON only, no markdown: {"clarityScore": 1-10, "accuracyScore": 1-10, "feedback": "string", "gaps": ["string"], "suggestion": "string"}. Explanation: ${explanation}`;
      const raw = await callAI([{ role: 'user', content: prompt }], { json: true }, 'chat');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const parsed: FeynmanResult = JSON.parse(cleaned);
      setResult(parsed);
      setPhase('graded');
    } catch (e) {
      setError('Failed to grade explanation. Please try again.');
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
          <Brain size={18} style={{ color: '#a78bfa' }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>Feynman Technique</span>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
          Explain a concept as if teaching a 10-year-old. AI will grade your clarity and accuracy.
        </p>
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
        <input
          type="text"
          placeholder="Topic to explain (e.g. Photosynthesis, Newton's 2nd Law...)"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <button
          className="btn btn-primary w-full"
          onClick={() => { if (topic.trim()) setPhase('active'); }}
          disabled={!topic.trim()}
        >
          <ArrowRight size={14} /> Start Explaining
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div>
        <BackBtn onClick={() => setPhase('setup')} />
        <div style={{ ...cardStyle, marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 4 }}>Topic</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{topic}</div>
        </div>
        <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 8 }}>
          Explain "{topic}" as if teaching a 10-year-old. Use simple words and examples.
        </p>
        <textarea
          value={explanation}
          onChange={e => setExplanation(e.target.value)}
          placeholder="Start explaining here..."
          rows={8}
          style={{ ...textareaStyle, marginBottom: 12 }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={submitExplanation}
          disabled={loading || !explanation.trim()}
        >
          {loading ? 'Grading...' : 'Submit for Grading'}
        </button>
      </div>
    );
  }

  // Graded phase
  return (
    <div>
      <BackBtn onClick={() => setPhase('setup')} />
      {result && (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Clarity</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(result.clarityScore) }}>
                {result.clarityScore}/10
              </div>
            </div>
            <div style={{ ...cardStyle, flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#a0a0a0', marginBottom: 4 }}>Accuracy</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: scoreColor(result.accuracyScore) }}>
                {result.accuracyScore}/10
              </div>
            </div>
          </div>
          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Feedback</div>
            <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>{result.feedback}</p>
          </div>
          {result.gaps && result.gaps.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <XCircle size={14} style={{ color: '#f87171' }} /> Knowledge Gaps
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {result.gaps.map((g, i) => (
                  <li key={i} style={{ fontSize: 13, color: '#fbbf24', marginBottom: 4 }}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          {result.suggestion && (
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: '#60a5fa' }}>
              <div style={{ fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle size={14} style={{ color: '#60a5fa' }} /> Suggestion
              </div>
              <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.6 }}>{result.suggestion}</p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setExplanation(''); setResult(null); setPhase('active'); }}>
              <RotateCcw size={14} /> Try Again
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setTopic(''); setExplanation(''); setResult(null); setPhase('setup'); }}>
              Next Topic
            </button>
          </div>
        </>
      )}
    </div>
  );
}
