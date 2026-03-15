import { useState } from 'react';
import { Dumbbell, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Course, CourseTopic } from '../../types';
import { selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

type Difficulty = 'Easy' | 'Medium' | 'Hard';

interface PracticeProblem {
  problem: string;
  answer: string;
  showAnswer: boolean;
}

function parseJsonArray(response: string): unknown[] | null {
  try {
    let s = response.trim();
    const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) s = codeBlock[1].trim();
    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) s = arrMatch[0];
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function PracticeGenTool() {
  const { data } = useStore();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [problems, setProblems] = useState<PracticeProblem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const courses: Course[] = data?.pluginData?.coachData?.courses || [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const topics: CourseTopic[] = selectedCourse?.topics || [];
  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  async function generate() {
    if (!selectedTopicId || !selectedTopic) return;
    setLoading(true);
    setError('');
    setProblems([]);

    try {
      const difficultyDesc: Record<Difficulty, string> = {
        Easy: 'basic, straightforward problems testing fundamental understanding',
        Medium: 'moderate problems requiring application of concepts',
        Hard: 'challenging problems that require deeper analysis and synthesis',
      };

      const prompt = `Generate 3 ${difficulty.toLowerCase()} practice problems for "${selectedTopic.name}" from "${selectedCourse?.name}".

Difficulty: ${difficulty} — ${difficultyDesc[difficulty]}

Return ONLY a valid JSON array with exactly 3 items. Each item must have:
- "problem": the full problem statement (can include formulas or scenarios)
- "answer": the complete solution with explanation

Format: [{"problem":"...","answer":"..."},...]`;

      const response = await callAI([{ role: 'user', content: prompt }]);
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse problems from AI response. Please try again.');
        return;
      }
      const generated: PracticeProblem[] = (parsed as Record<string, unknown>[]).map(item => ({
        problem: String(item.problem || ''),
        answer: String(item.answer || ''),
        showAnswer: false,
      })).filter(p => p.problem);
      setProblems(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function toggleAnswer(index: number) {
    setProblems(prev => prev.map((p, i) => i === index ? { ...p, showAnswer: !p.showAnswer } : p));
  }

  const diffColors: Record<Difficulty, string> = {
    Easy: 'var(--green)',
    Medium: 'var(--yellow)',
    Hard: 'var(--red)',
  };

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <Dumbbell size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Dumbbell size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          AI Practice Problems
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {courses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses found. Create a course first.</p>
          ) : (
            <>
              <select
                value={selectedCourseId}
                onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopicId(''); setProblems([]); }}
                style={selectStyle}
              >
                <option value="">Select a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {selectedCourseId && (
                <select
                  value={selectedTopicId}
                  onChange={e => { setSelectedTopicId(e.target.value); setProblems([]); }}
                  style={selectStyle}
                >
                  <option value="">Select a topic...</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>DIFFICULTY</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map(d => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      style={{
                        padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                        fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.2s',
                        border: difficulty === d ? `1px solid ${diffColors[d]}` : '1px solid var(--border)',
                        background: difficulty === d ? `${diffColors[d]}22` : 'var(--bg-input)',
                        color: difficulty === d ? diffColors[d] : 'var(--text-secondary)',
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={!selectedTopicId || loading}
              >
                {loading ? 'Generating...' : 'Generate 3 Problems'}
              </button>
            </>
          )}
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {problems.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {problems.map((p, i) => (
            <div key={i} className="card" style={{ borderLeftColor: diffColors[difficulty], borderLeftWidth: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
                  background: `${diffColors[difficulty]}22`, color: diffColors[difficulty],
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  Problem {i + 1} · {difficulty}
                </span>
              </div>

              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 10, whiteSpace: 'pre-wrap' }}>
                {p.problem}
              </p>

              <button
                onClick={() => toggleAnswer(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px', cursor: 'pointer', color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                }}
              >
                {p.showAnswer ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {p.showAnswer ? 'Hide Answer' : 'Show Answer'}
              </button>

              {p.showAnswer && (
                <div style={{
                  marginTop: 10, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-light)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Answer
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {p.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PracticeGenToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Practice Problems">
      <PracticeGenTool />
    </ToolErrorBoundary>
  );
}
