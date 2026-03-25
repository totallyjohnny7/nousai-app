import { useState } from 'react';
import { HelpCircle, Save } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Course, CourseTopic } from '../../types';
import { selectStyle, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { parseJsonArray } from '../../utils/parseJson';

interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

function QuizGenTool() {
  const { data, updatePluginData } = useStore();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const courses: Course[] = data?.pluginData?.coachData?.courses || [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const topics: CourseTopic[] = selectedCourse?.topics || [];

  async function generate() {
    if (!selectedCourseId || !selectedTopicId) return;
    const topic = topics.find(t => t.id === selectedTopicId);
    if (!topic) return;

    setLoading(true);
    setError('');
    setSaved(false);
    setQuestions([]);

    try {
      const subtopics = topic.subtopics?.map(s => s.name).join(', ') || '';
      const prompt = `Generate ${questionCount} multiple choice quiz questions about the topic and course specified below.
${subtopics ? `Subtopics to cover: <subtopics>${subtopics}</subtopics>` : ''}
<topic>${topic.name}</topic>
<course>${selectedCourse?.name ?? ''}</course>

Return ONLY a valid JSON array. Each question must have:
- "question": the question text
- "options": array of exactly 4 answer choices (strings)
- "answer": the correct answer (must match one of the options exactly)
- "explanation": brief explanation of why the answer is correct

Format: [{"question":"...","options":["A","B","C","D"],"answer":"A","explanation":"..."},...]`;

      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse questions from AI response. Please try again.');
        return;
      }
      const generated: QuizQuestion[] = (parsed as Record<string, unknown>[]).map(item => ({
        question: String(item.question || ''),
        options: Array.isArray(item.options) ? (item.options as unknown[]).map(String) : ['A', 'B', 'C', 'D'],
        answer: String(item.answer || ''),
        explanation: String(item.explanation || ''),
      })).filter(q => q.question);
      setQuestions(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function saveToQuizBank() {
    if (!data || questions.length === 0 || !selectedTopicId) return;
    const existingBank = data.pluginData?.quizBank || {};
    const topicKey = selectedTopicId;
    const existing = Array.isArray(existingBank[topicKey]) ? existingBank[topicKey] as QuizQuestion[] : [];
    updatePluginData({
      quizBank: { ...existingBank, [topicKey]: [...existing, ...questions] },
    });
    setSaved(true);
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <HelpCircle size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <HelpCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Auto-Generate Quiz from Topic
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {courses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses found. Create a course first.</p>
          ) : (
            <>
              <select
                value={selectedCourseId}
                onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopicId(''); setQuestions([]); setSaved(false); }}
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
                  onChange={e => { setSelectedTopicId(e.target.value); setQuestions([]); setSaved(false); }}
                  style={selectStyle}
                >
                  <option value="">Select a topic...</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', flexShrink: 0 }}>Questions:</label>
                <input
                  type="number"
                  min={5}
                  max={20}
                  value={questionCount}
                  onChange={e => setQuestionCount(Math.min(20, Math.max(5, parseInt(e.target.value) || 10)))}
                  style={{ ...inputStyle, width: 80 }}
                />
              </div>

              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={!selectedCourseId || !selectedTopicId || loading}
              >
                {loading ? 'Generating...' : 'Generate Quiz'}
              </button>
            </>
          )}
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {questions.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            ⚠ AI-generated content may contain errors. Always verify against your course materials before studying.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
            {questions.map((q, i) => (
              <div key={i} className="card" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                  {i + 1}. {q.question}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 8 }}>
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      style={{
                        padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: 12,
                        background: opt === q.answer ? 'var(--accent-glow)' : 'var(--bg-input)',
                        color: opt === q.answer ? 'var(--accent-light)' : 'var(--text-secondary)',
                        border: `1px solid ${opt === q.answer ? 'var(--accent)' : 'var(--border)'}`,
                        fontWeight: opt === q.answer ? 600 : 400,
                      }}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
                {q.explanation && (
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {q.explanation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={saveToQuizBank}
            disabled={saved}
          >
            <Save size={14} /> {saved ? 'Saved to Quiz Bank!' : 'Save to Quiz Bank'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuizGenToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Quiz Generator">
      <QuizGenTool />
    </ToolErrorBoundary>
  );
}
