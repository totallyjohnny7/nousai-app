/**
 * QuizAIChat — Side AI chat panel for quizzes and exams.
 * Explains questions, guides understanding, renders markdown + math properly.
 * Modeled after SolverMode's side chat (LearnPage.tsx).
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, Send, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { callAI } from '../utils/ai';
import { safeRenderMd } from '../utils/renderMd';

interface ChatMsg {
  role: 'user' | 'ai';
  text: string;
}

interface QuizAIChatProps {
  questionText: string;
  questionType?: string;
  options?: string[];
  subject?: string;
  show: boolean;
  onToggle: () => void;
  quizId?: string;
}

const STORAGE_PREFIX = 'nousai-quiz-chat-';

function loadChat(quizId?: string): ChatMsg[] {
  if (!quizId) return [];
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + quizId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChat(quizId: string | undefined, msgs: ChatMsg[]) {
  if (!quizId) return;
  try { localStorage.setItem(STORAGE_PREFIX + quizId, JSON.stringify(msgs)); } catch {}
}

/** Clean up chat keys older than 7 days */
function cleanOldChats() {
  try {
    const now = Date.now();
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const msgs = JSON.parse(raw);
        // If first message is old, remove
        if (Array.isArray(msgs) && msgs.length > 0) {
          const created = localStorage.getItem(key + '-t');
          if (created && now - Number(created) > 7 * 24 * 60 * 60 * 1000) {
            localStorage.removeItem(key);
            localStorage.removeItem(key + '-t');
          }
        }
      } catch { localStorage.removeItem(key); }
    }
  } catch {}
}

export default function QuizAIChat({ questionText, questionType, options, subject, show, onToggle, quizId }: QuizAIChatProps) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadChat(quizId));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const prevQuizId = useRef(quizId);

  // Load chat on quizId change
  useEffect(() => {
    if (quizId !== prevQuizId.current) {
      setMessages(loadChat(quizId));
      prevQuizId.current = quizId;
    }
  }, [quizId]);

  // Clean old chats on mount
  useEffect(() => { cleanOldChats(); }, []);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Save on message change
  useEffect(() => {
    if (quizId && messages.length > 0) {
      saveChat(quizId, messages);
      if (!localStorage.getItem(STORAGE_PREFIX + quizId + '-t')) {
        localStorage.setItem(STORAGE_PREFIX + quizId + '-t', String(Date.now()));
      }
    }
  }, [messages, quizId]);

  const buildSystemPrompt = useCallback(() => {
    let prompt = `You are a helpful study tutor. The student is taking a quiz/exam and needs help understanding a question.\n\nCurrent question: "${questionText}"`;
    if (options?.length) {
      prompt += `\nOptions:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`;
    }
    if (questionType) prompt += `\nQuestion type: ${questionType}`;
    if (subject) prompt += `\nSubject: ${subject}`;
    prompt += `\n\nRULES:
- Help the student UNDERSTAND the question and the concepts behind it.
- Do NOT give the answer directly — guide them to figure it out.
- Use $...$ for inline math, $$...$$ for display math.
- Keep responses concise (2-4 sentences typical).
- If they ask for the answer directly, explain the concept instead.`;
    return prompt;
  }, [questionText, options, questionType, subject]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMsg = { role: 'user', text };
    const newMsgs = [...messages, userMsg, { role: 'ai' as const, text: '' }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const aiMsgs = [
        { role: 'system' as const, content: buildSystemPrompt() },
        ...newMsgs.slice(0, -1).map(m => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        })),
      ];

      let streamed = '';
      await callAI(aiMsgs, {
        onChunk: (chunk: string) => {
          streamed += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      });
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: `Error: ${err.message || 'Failed to get response'}` };
        return copy;
      });
    }
    setLoading(false);
  }, [input, loading, messages, buildSystemPrompt]);

  const regenerate = useCallback(async (idx: number) => {
    if (loading) return;
    // Remove this AI message and everything after it, then re-send
    const trimmed = messages.slice(0, idx);
    setMessages([...trimmed, { role: 'ai', text: '' }]);
    setLoading(true);

    try {
      const aiMsgs = [
        { role: 'system' as const, content: buildSystemPrompt() },
        ...trimmed.map(m => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.text,
        })),
      ];

      let streamed = '';
      await callAI(aiMsgs, {
        onChunk: (chunk: string) => {
          streamed += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      });
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: `Error: ${err.message || 'Failed to regenerate'}` };
        return copy;
      });
    }
    setLoading(false);
  }, [loading, messages, buildSystemPrompt]);

  const clearChat = useCallback(() => {
    setMessages([]);
    if (quizId) {
      localStorage.removeItem(STORAGE_PREFIX + quizId);
      localStorage.removeItem(STORAGE_PREFIX + quizId + '-t');
    }
  }, [quizId]);

  return (
    <>
      {/* Toggle button — positioned to avoid overlap with mobile bottom nav */}
      <button
        onClick={onToggle}
        title="AI Study Help"
        className="quiz-ai-toggle"
        style={{
          position: 'absolute', right: show ? 260 : 0, top: 8,
          width: 28, height: 28, borderRadius: '50%',
          background: show ? 'var(--accent)' : 'var(--surface)',
          border: '1px solid var(--border)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: show ? '#fff' : 'var(--text-muted)', zIndex: 2,
          transition: 'right 0.2s',
        }}
      >
        <MessageCircle size={14} />
      </button>

      {/* Side panel — full overlay on mobile, side panel on desktop */}
      {show && (
        <div className="quiz-ai-panel" style={{
          width: 260, borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)',
        }}>
          {/* Header */}
          <div style={{
            padding: '8px 10px', borderBottom: '1px solid var(--border)',
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span>Ask about this question</span>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear chat"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>
                Ask any question about the current problem. I'll help you understand without giving away the answer.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                margin: '6px 0', padding: '6px 8px', borderRadius: 8,
                background: m.role === 'user' ? 'rgba(14,165,233,.1)' : 'var(--surface)',
                fontSize: 12, lineHeight: 1.5,
              }}>
                <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.text || '...') }} />
                {/* Regenerate + Copy buttons for AI messages */}
                {m.role === 'ai' && m.text && !loading && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                    <button
                      onClick={() => regenerate(i)}
                      title="Regenerate response"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 0',
                        fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <RotateCcw size={10} /> Regenerate
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(m.text).then(() => {
                          setCopiedIdx(i)
                          setTimeout(() => setCopiedIdx(null), 1500)
                        })
                      }}
                      title="Copy response"
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: '2px 0',
                        fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      {copiedIdx === i ? '✓ Copied' : '⎘ Copy'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ textAlign: 'center', padding: 8 }}>
                <Loader2 size={14} className="spin" style={{ color: 'var(--accent)' }} />
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 4 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder="Ask a question..."
              disabled={loading}
              style={{
                flex: 1, padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 12, outline: 'none',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                padding: '4px 8px', borderRadius: 6,
                background: 'var(--accent)', border: 'none', cursor: 'pointer',
                color: '#fff', opacity: loading || !input.trim() ? 0.4 : 1,
              }}
            >
              <Send size={12} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
