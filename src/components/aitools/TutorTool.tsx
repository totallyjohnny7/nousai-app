import { useState, useRef, useEffect } from 'react';
import { GraduationCap, Send } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { AIMessage } from '../../utils/ai';
import type { Course, CourseTopic } from '../../types';
import { selectStyle, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function TutorTool() {
  const { data } = useStore();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const courses: Course[] = data?.pluginData?.coachData?.courses || [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const topics: CourseTopic[] = selectedCourse?.topics || [];
  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  // Get proficiency score
  const profData = data?.pluginData?.proficiencyData;
  const profScore: number | null = (() => {
    if (!profData || !selectedCourse || !selectedTopic) return null;
    const subjectKey = selectedCourse.name;
    const topicKey = selectedTopic.name;
    const entry = profData.subjects?.[subjectKey]?.[topicKey];
    return entry ? Math.round(entry.proficiencyScore) : null;
  })();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function resetChat() {
    setMessages([]);
    setError('');
  }

  async function sendMessage() {
    if (!input.trim() || !selectedTopicId || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const subtopicNames = selectedTopic?.subtopics?.map(s => s.name).join(', ') || 'general concepts';
      const scoreText = profScore !== null ? `${profScore}%` : 'unknown';

      const systemPrompt = `You are a tutor. The student's topic, course, and proficiency are provided below. Focus on areas the student finds difficult and ask questions to test understanding. Keep responses concise and educational. Before moving to a new concept, check the student's understanding of the current one by asking a brief follow-up question. For language-related topics, always include key vocabulary in the original language alongside translations. IMPORTANT: Do not provide specific drug dosages, prescribing protocols, clinical treatment decisions, or patient-specific medical advice. For such questions, redirect the student to consult clinical resources, their instructor, or a licensed healthcare professional.
<topic>${selectedTopic?.name || 'this topic'}</topic>
<course>${selectedCourse?.name || 'my course'}</course>
<proficiency>${scoreText}</proficiency>
<subtopics>${subtopicNames}</subtopics>`;

      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...newMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      const response = await callAI(aiMessages, {}, 'chat');
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <GraduationCap size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <GraduationCap size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Topic-Aware AI Tutor
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {courses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses found. Create a course first.</p>
          ) : (
            <>
              <select
                value={selectedCourseId}
                onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopicId(''); resetChat(); }}
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
                  onChange={e => { setSelectedTopicId(e.target.value); resetChat(); }}
                  style={selectStyle}
                >
                  <option value="">Select a topic...</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>

        {selectedTopic && (
          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-glow)', border: '1px solid var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13, color: 'var(--accent-light)', fontWeight: 600 }}>
              {selectedTopic.name}
            </span>
            {profScore !== null && (
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Proficiency: {profScore}%
              </span>
            )}
          </div>
        )}
      </div>

      {selectedTopicId && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Chat messages */}
          <div style={{ height: 360, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginTop: 40 }}>
                <GraduationCap size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
                <p>Ask me anything about {selectedTopic?.name}!</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div style={{
                  maxWidth: '80%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-input)',
                  color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  fontSize: 13, color: 'var(--text-muted)',
                }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '8px 16px', background: 'var(--red)15', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          {/* Input */}
          <div style={{
            display: 'flex', gap: 8, padding: 12,
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask a question about this topic..."
              style={{ ...inputStyle, flex: 1 }}
              disabled={loading}
            />
            <button
              className="btn btn-primary"
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{ flexShrink: 0 }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TutorToolWrapped() {
  return (
    <ToolErrorBoundary toolName="AI Tutor">
      <TutorTool />
    </ToolErrorBoundary>
  );
}
