import { useState, useEffect, useRef } from 'react';
import { Calculator, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, textareaStyle } from './learnHelpers';
import { safeRenderMd } from '../../utils/renderMd';

interface SolveResult {
  steps: string[];
  answer: string;
  graphFn: string | null;
  xDomain: [number, number] | null;
}

function parseResult(raw: string): SolveResult {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      steps: Array.isArray(parsed.steps) ? parsed.steps : [raw],
      answer: parsed.answer || '',
      graphFn: parsed.graphFn || null,
      xDomain: Array.isArray(parsed.xDomain) && parsed.xDomain.length === 2 ? parsed.xDomain as [number, number] : null,
    };
  } catch {
    return { steps: [raw], answer: '', graphFn: null, xDomain: null };
  }
}

function GraphRenderer({ fn, xDomain }: { fn: string; xDomain: [number, number] | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = '';
    try {
      import('function-plot').then(({ default: functionPlot }) => {
        if (!ref.current) return;
        functionPlot({
          target: ref.current,
          width: Math.min(ref.current.clientWidth || 300, 380),
          height: 220,
          xAxis: { domain: xDomain || [-10, 10] },
          yAxis: { domain: [-10, 10] },
          grid: true,
          data: [{ fn, color: '#60a5fa' }],
        });
      }).catch(() => {
        if (ref.current) ref.current.innerHTML = '<p style="color:#a0a0a0;font-size:12px;padding:8px">Graph unavailable</p>';
      });
    } catch {
      if (ref.current) ref.current.innerHTML = '<p style="color:#a0a0a0;font-size:12px;padding:8px">Graph unavailable</p>';
    }
  }, [fn, xDomain]);

  return (
    <div ref={ref} style={{
      margin: '12px 0', borderRadius: 8, overflow: 'hidden',
      background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)',
    }} />
  );
}

export default function GraphSolverMode({ onBack }: { onBack: () => void }) {
  const { courses } = useStore();
  const [subject, setSubject] = useState('');
  const [discipline, setDiscipline] = useState<'Math' | 'Physics' | 'Chemistry'>('Math');
  const [problem, setProblem] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState('');
  const [streamText, setStreamText] = useState('');

  async function solve() {
    if (!problem.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setStreamText('');
    try {
      const prompt = `You are a ${discipline} tutor. Solve this problem step by step.\nProblem: ${problem}\n\nRespond with JSON only, no markdown: {"steps": ["step1", "step2", ...], "answer": "final answer", "graphFn": "y=x^2" or null if not graphable, "xDomain": [-10,10] or null}.\n\nFor graphFn: use function-plot syntax (e.g. "x^2", "sin(x)", "2*x+1"). Only include if there is a meaningful function to graph.`;
      let accumulated = '';
      await callAI(
        [{ role: 'user', content: prompt }],
        {
          json: true,
          onChunk: chunk => {
            accumulated += chunk;
            setStreamText(accumulated);
          },
        }
      );
      setResult(parseResult(accumulated || streamText));
    } catch {
      setError('Failed to solve. Please try again.');
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

  return (
    <div>
      <BackBtn onClick={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Calculator size={18} style={{ color: '#a78bfa' }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Graph Solver</span>
      </div>
      <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
        Solve math/science problems with step-by-step solutions and graph visualization.
      </p>

      <SubjectPicker courses={courses} value={subject} onChange={setSubject} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {(['Math', 'Physics', 'Chemistry'] as const).map(d => (
          <button
            key={d}
            className={`btn btn-sm ${discipline === d ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setDiscipline(d)}
            style={{ flex: 1 }}
          >
            {d}
          </button>
        ))}
      </div>

      <textarea
        value={problem}
        onChange={e => setProblem(e.target.value)}
        placeholder={discipline === 'Math' ? 'e.g. Solve x^2 - 5x + 6 = 0' : discipline === 'Physics' ? 'e.g. A ball is thrown at 20 m/s at 45°. Find range.' : 'e.g. Balance: H2 + O2 → H2O'}
        rows={4}
        style={{ ...textareaStyle, marginBottom: 12 }}
      />

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      {!result && (
        <button className="btn btn-primary w-full" onClick={solve} disabled={loading || !problem.trim()}>
          {loading ? 'Solving...' : <><Calculator size={14} /> Solve</>}
        </button>
      )}

      {loading && streamText && (
        <div style={{ ...cardStyle, marginTop: 12 }}>
          <div style={{ fontSize: 12, color: '#a0a0a0' }}>Thinking...</div>
          <pre style={{ fontSize: 12, color: '#a0a0a0', whiteSpace: 'pre-wrap', marginTop: 6 }}>
            {streamText.slice(0, 200)}...
          </pre>
        </div>
      )}

      {result && (
        <div>
          {result.graphFn && (
            <GraphRenderer fn={result.graphFn} xDomain={result.xDomain} />
          )}

          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Solution Steps</div>
            {result.steps.map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(96,165,250,0.15)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div
                  style={{ fontSize: 13, lineHeight: 1.6, flex: 1 }}
                  dangerouslySetInnerHTML={{ __html: safeRenderMd(step) }}
                />
              </div>
            ))}
          </div>

          {result.answer && (
            <div style={{ ...cardStyle, marginBottom: 12, borderColor: '#4ade80', background: 'rgba(74,222,128,0.05)' }}>
              <div style={{ fontSize: 12, color: '#a0a0a0', marginBottom: 4 }}>Answer</div>
              <div
                style={{ fontSize: 16, fontWeight: 700, color: '#4ade80' }}
                dangerouslySetInnerHTML={{ __html: safeRenderMd(result.answer) }}
              />
            </div>
          )}

          <button className="btn btn-secondary w-full" onClick={() => { setProblem(''); setResult(null); setStreamText(''); }}>
            <RotateCcw size={14} /> New Problem
          </button>
        </div>
      )}
    </div>
  );
}
