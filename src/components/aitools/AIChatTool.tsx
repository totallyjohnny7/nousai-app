import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { safeRenderMd } from '../../utils/renderMd';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const SYSTEM_PROMPT = `You are a study assistant inside Nous AI. Help the student with coursework, explain concepts, answer questions, and assist with anything academic. Be concise and use Markdown formatting. IMPORTANT: Do not provide specific drug dosages, prescribing protocols, clinical treatment decisions, or patient-specific medical advice. For such questions, redirect the student to consult clinical resources, their course instructor, or a licensed healthcare professional.`;

function AIChatTool() {
  const { data, setData } = useStore();
  const sessions: ChatSession[] = (data?.pluginData as any)?.aiChatSessions || [];
  const [activeId, setActiveId] = useState<string | null>(sessions[0]?.id || null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeId) || null;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeSession?.messages]);

  function updateSessions(updater: (prev: ChatSession[]) => ChatSession[]) {
    setData(prev => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        aiChatSessions: updater((prev.pluginData as any).aiChatSessions || []),
      },
    }));
  }

  function createSession() {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateSessions(prev => [newSession, ...prev]);
    setActiveId(newSession.id);
    setSidebarOpen(false);
  }

  function deleteSession(id: string) {
    updateSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveId(remaining[0]?.id || null);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!isAIConfigured()) return;

    let session = activeSession;
    if (!session) {
      // Auto-create a session
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: text.slice(0, 40),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      updateSessions(prev => [newSession, ...prev]);
      setActiveId(newSession.id);
      session = newSession;
    }

    const sid = session.id;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };

    // Add user message + empty assistant message
    updateSessions(prev => prev.map(s => {
      if (s.id !== sid) return s;
      const isFirst = s.messages.length === 0;
      return {
        ...s,
        title: isFirst ? text.slice(0, 40) : s.title,
        messages: [...s.messages, userMsg, assistantMsg],
        updatedAt: new Date().toISOString(),
      };
    }));
    setInput('');
    setStreaming(true);

    try {
      const MAX_HISTORY_MESSAGES = 40; // keep last 40 messages (20 turns) to stay within context window
      const fullHistory = [...(session.messages || []), userMsg];
      const trimmedHistory = fullHistory.length > MAX_HISTORY_MESSAGES
        ? fullHistory.slice(-MAX_HISTORY_MESSAGES)
        : fullHistory;
      const aiMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT },
        ...trimmedHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      // Buffer chunks and flush to state periodically to avoid per-chunk re-renders
      let chunkBuffer = '';
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      const flushChunks = () => {
        if (!chunkBuffer) return;
        const buffered = chunkBuffer;
        chunkBuffer = '';
        updateSessions(prev => prev.map(s => {
          if (s.id !== sid) return s;
          const msgs = [...s.messages];
          const last = msgs[msgs.length - 1];
          if (last && last.role === 'assistant') {
            msgs[msgs.length - 1] = { ...last, content: last.content + buffered };
          }
          return { ...s, messages: msgs };
        }));
      };
      await callAI(aiMessages, {
        onChunk(chunk: string) {
          chunkBuffer += chunk;
          if (!flushTimer) {
            flushTimer = setTimeout(() => { flushTimer = null; flushChunks(); }, 80);
          }
        },
      }, 'chat');
      // Final flush for any remaining buffered content
      if (flushTimer) clearTimeout(flushTimer);
      flushChunks();
    } catch (e: any) {
      updateSessions(prev => prev.map(s => {
        if (s.id !== sid) return s;
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          msgs[msgs.length - 1] = { ...last, content: `Error: ${e.message}` };
        }
        return { ...s, messages: msgs };
      }));
    }
    setStreaming(false);
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 400, gap: 0, position: 'relative' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? 220 : 0, overflow: 'hidden',
        background: '#111', borderRadius: '8px 0 0 8px',
        transition: 'width 0.2s ease', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #222' }}>
          <button onClick={createSession} className="btn btn-sm btn-primary" style={{ width: '100%', fontSize: 11 }}>
            <Plus size={12} /> New Chat
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
          {sessions.map(s => (
            <div
              key={s.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                background: s.id === activeId ? '#1a2a3a' : 'transparent',
                color: s.id === activeId ? '#fff' : '#888',
                fontSize: 11, fontWeight: 500,
              }}
              onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {s.title}
              </span>
              <button
                onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 2, flexShrink: 0 }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: '#0f0f0f', borderRadius: sidebarOpen ? '0 8px 8px 0' : 8,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid #1a1a1a',
        }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 2 }}
          >
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <MessageSquare size={14} style={{ color: '#22d3ee' }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            {activeSession?.title || 'AI Chat'}
          </span>
          <div style={{ flex: 1 }} />
          <button onClick={createSession} className="btn btn-sm btn-secondary" style={{ fontSize: 10, padding: '3px 10px' }}>
            <Plus size={12} /> New
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '14px' }}>
          {activeSession && activeSession.messages.length >= 30 && (
            <div style={{
              textAlign: 'center', fontSize: 11, color: '#888',
              background: '#1a1a1a', borderRadius: 6, padding: '6px 12px', marginBottom: 10,
            }}>
              Long chat — oldest messages are trimmed to stay within AI context limits.
            </div>
          )}
          {!activeSession || activeSession.messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 60, color: '#555' }}>
              <MessageSquare size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Study Assistant</div>
              <div style={{ fontSize: 12 }}>Ask me anything about your coursework</div>
            </div>
          ) : (
            activeSession.messages.map((m, i) => (
              <div key={i} style={{
                marginBottom: 12, padding: '10px 14px', borderRadius: 10,
                background: m.role === 'user' ? '#1a2a3a' : '#1a1a1a',
                fontSize: 13, lineHeight: 1.6,
                maxWidth: m.role === 'user' ? '85%' : '100%',
                marginLeft: m.role === 'user' ? 'auto' : 0,
              }}>
                {m.role === 'assistant' ? (
                  <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.content || '...') }} />
                ) : (
                  <div style={{ color: '#e0e0e0' }}>{m.content}</div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input bar */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isAIConfigured() ? 'Ask anything...' : 'Configure AI in Settings first'}
            disabled={streaming || !isAIConfigured()}
            style={{
              flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 8, color: '#fff', fontSize: 13, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            style={{
              background: '#22d3ee', border: 'none', borderRadius: 8, padding: '0 16px',
              cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center',
              opacity: streaming || !input.trim() ? 0.4 : 1, fontWeight: 600,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AIChatToolWrapped() {
  return (
    <ToolErrorBoundary toolName="AI Chat">
      <AIChatTool />
    </ToolErrorBoundary>
  );
}
