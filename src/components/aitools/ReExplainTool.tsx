import { useState } from 'react';
import { RefreshCw, Copy } from 'lucide-react';
import { callAI, isAIConfigured } from '../../utils/ai';
import { inputStyle, copyText } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

type ExplainStyle = 'ELI5' | 'Analogy' | 'Story' | 'Technical' | 'Step-by-step';

const STYLES: { id: ExplainStyle; label: string; description: string }[] = [
  { id: 'ELI5', label: 'ELI5', description: "Explain like I'm 5" },
  { id: 'Analogy', label: 'Analogy', description: 'Use a real-world comparison' },
  { id: 'Story', label: 'Story', description: 'Turn it into a narrative' },
  { id: 'Technical', label: 'Technical', description: 'In-depth technical detail' },
  { id: 'Step-by-step', label: 'Step-by-step', description: 'Break it into ordered steps' },
];

function ReExplainTool() {
  const [concept, setConcept] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<ExplainStyle>('ELI5');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function explain() {
    if (!concept.trim()) return;
    setLoading(true);
    setError('');
    setOutput('');

    try {
      const styleInstructions: Record<ExplainStyle, string> = {
        'ELI5': "Explain this concept as if you're talking to a 5-year-old child. Use very simple words and relatable examples.",
        'Analogy': "Explain this concept using a clear, creative analogy that compares it to something familiar from everyday life.",
        'Story': "Explain this concept by turning it into a short, engaging story or narrative.",
        'Technical': "Explain this concept with full technical depth, including relevant terminology, mechanisms, and edge cases.",
        'Step-by-step': "Explain this concept as a numbered step-by-step breakdown, making each step clear and actionable.",
      };

      const prompt = `${styleInstructions[selectedStyle]}
Use multiple explanation strategies where helpful (analogy, visual description, step-by-step breakdown).
Include common misconceptions students have about this concept and correct them.
For any technical or specialized terms, include the original term alongside any simplified language.

Concept: ${concept.trim()}`;

      const response = await callAI([{ role: 'user', content: prompt }], {}, 'analysis');
      setOutput(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <RefreshCw size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <RefreshCw size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Explain-It-Differently
        </div>

        <textarea
          value={concept}
          onChange={e => setConcept(e.target.value.slice(0, 20000))}
          placeholder="Enter the concept you want explained differently..."
          rows={4}
          maxLength={20000}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 4 }}
        />
        <div style={{ fontSize: 11, color: concept.length > 18000 ? 'var(--red, #ef4444)' : 'var(--text-muted)', textAlign: 'right', marginBottom: 8 }}>
          {concept.length.toLocaleString()} / 20,000 chars{concept.length > 18000 ? ' — approaching limit' : ''}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
            EXPLANATION STYLE
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(s.id)}
                title={s.description}
                style={{
                  padding: '7px 14px',
                  borderRadius: 20,
                  border: selectedStyle === s.id ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: selectedStyle === s.id ? 'var(--accent-glow)' : 'var(--bg-input)',
                  color: selectedStyle === s.id ? 'var(--accent-light)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={explain}
          disabled={!concept.trim() || loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Explaining...' : `Explain (${selectedStyle})`}
        </button>

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {output && (
        <div className="card" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: 'var(--accent-glow)', color: 'var(--accent-light)',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {selectedStyle}
            </span>
            <button
              onClick={() => copyText(output)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
              title="Copy to clipboard"
            >
              <Copy size={14} />
            </button>
          </div>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
            {output}
          </p>
        </div>
      )}
    </div>
  );
}

export default function ReExplainToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Re-Explain">
      <ReExplainTool />
    </ToolErrorBoundary>
  );
}
