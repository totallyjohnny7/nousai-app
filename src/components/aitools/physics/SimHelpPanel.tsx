import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, X } from 'lucide-react';
import { callAI, isAIConfigured } from '../../../utils/ai';
import { safeRenderMd } from '../../../utils/renderMd';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SimHelpPanelProps {
  open: boolean;
  onToggle: () => void;
  simTitle: string;
  params: Record<string, number>;
  sliderLabels: { key: string; label: string; unit: string }[];
  notesOpen: boolean;
}

export function SimHelpPanel({ open, onToggle, simTitle, params, sliderLabels, notesOpen }: SimHelpPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const buildSystemPrompt = useCallback(() => {
    const paramStr = sliderLabels
      .map(s => `${s.label}: ${(params[s.key] ?? 0).toFixed(2)} ${s.unit}`)
      .join(', ');
    return `You are a Physics 2 lab simulation assistant inside Nous AI. The student is currently running the "${simTitle}" simulation${paramStr ? ` with parameters: ${paramStr}` : ''}. Answer questions about what they're observing, explain the underlying physics, derive the equations step by step, and guide them through the concepts. Be concise and direct. Use Markdown formatting.`;
  }, [simTitle, params, sliderLabels]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    if (!isAIConfigured()) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: text };
    const assistantMsg: Message = { id: `a-${Date.now()}`, role: 'assistant', content: '' };
    setMessages(m => [...m, userMsg, assistantMsg]);
    setInput('');
    setStreaming(true);

    try {
      const aiMessages = [
        { role: 'system' as const, content: buildSystemPrompt() },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: text },
      ];

      await callAI(aiMessages, {
        onChunk(chunk: string) {
          setMessages(m => {
            const last = m[m.length - 1];
            if (last.role === 'assistant') {
              return [...m.slice(0, -1), { ...last, content: last.content + chunk }];
            }
            return m;
          });
        },
      });
    } catch (e: any) {
      setMessages(m => {
        const last = m[m.length - 1];
        if (last.role === 'assistant' && !last.content) {
          return [...m.slice(0, -1), { ...last, content: `Error: ${e.message}` }];
        }
        return m;
      });
    }
    setStreaming(false);
  }

  function handleClear() {
    setMessages([]);
  }

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={onToggle}
          style={{
            position: 'fixed', right: 0, top: '50%', transform: 'translateY(-50%)',
            zIndex: 50, width: 40, height: 80, borderRadius: '8px 0 0 8px',
            background: '#1a1a1a', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '-2px 0 12px rgba(0,0,0,0.4)',
            writingMode: 'vertical-rl', color: '#888', fontWeight: 600, fontSize: 11,
            fontFamily: 'inherit',
          }}
          title="Open Sim Help"
        >
          🤖 Help
        </button>
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: open ? 320 : 0,
        background: '#0f0f0f', zIndex: 190,
        transition: 'width 0.3s ease',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: open ? '-4px 0 24px rgba(0,0,0,0.5)' : 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #222',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>🤖 Sim Help</span>
          <div className="flex gap-2">
            <button
              onClick={handleClear}
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 2 }}
              title="Clear Chat"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onToggle}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: 0, fontSize: 18 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Context badge */}
        <div style={{ padding: '6px 14px', borderBottom: '1px solid #222' }}>
          <span style={{ fontSize: 10, color: '#22d3ee', background: '#0f2f3f', padding: '2px 8px', borderRadius: 10 }}>
            {simTitle}
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
          {messages.length === 0 && (
            <div style={{ color: '#555', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
              Ask questions about the simulation
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} style={{
              marginBottom: 10,
              padding: '8px 12px', borderRadius: 8,
              background: m.role === 'user' ? '#1a2a3a' : '#1a1a1a',
              fontSize: 12, lineHeight: 1.5,
              color: m.role === 'user' ? '#e0e0e0' : '#ccc',
            }}>
              {m.role === 'assistant' ? (
                <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.content || '...') }} />
              ) : (
                m.content
              )}
            </div>
          ))}
        </div>

        {/* Input */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid #222', display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about the sim..."
            disabled={streaming || !isAIConfigured()}
            style={{
              flex: 1, padding: '8px 10px', background: '#1a1a1a', border: '1px solid #333',
              borderRadius: 6, color: '#fff', fontSize: 12, fontFamily: 'inherit',
            }}
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            style={{
              background: '#22d3ee', border: 'none', borderRadius: 6, padding: '0 12px',
              cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center',
              opacity: streaming || !input.trim() ? 0.4 : 1,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
