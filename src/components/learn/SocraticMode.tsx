/**
 * SocraticMode — AI-guided Socratic dialogue for deep understanding.
 * Extracted from LearnPage.tsx for use in UnifiedLearnPage.
 */
import { useState, useRef, useMemo } from 'react';
import { MessageCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { sanitizeHtml } from '../../utils/sanitize';
import { renderMd } from '../../utils/renderMd';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};

export default function SocraticMode() {
  const { courses } = useStore();
  const [topic, setTopic] = useState('');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState(0);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const callingRef = useRef(false);

  const allCards = useMemo(() => courses.flatMap(c => c.flashcards || []), [courses]);

  function startDialogue() {
    if (!topic.trim()) return;
    const relevant = allCards.filter(c =>
      (c.front + c.back).toLowerCase().includes(topic.toLowerCase())
    );
    const firstQ = relevant.length > 0
      ? `Let us explore "${topic}". In your own words, what is ${relevant[0].front}?`
      : `Let us explore "${topic}". What do you already know about this topic? What comes to mind first?`;
    setMessages([{ role: 'ai', text: firstQ }]);
    setStarted(true);
    setDepth(0);
  }

  async function respond() {
    if (!input.trim() || callingRef.current) return;
    callingRef.current = true;
    const userMsg = { role: 'user' as const, text: input };
    const newDepth = depth + 1;
    setDepth(newDepth);
    setInput('');
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setLoading(true);

    if (isAIConfigured()) {
      try {
        const context = updatedMsgs.slice(-14).map(m => ({
          role: (m.role === 'ai' ? 'assistant' : 'user') as 'system' | 'user' | 'assistant',
          content: m.text,
        }));
        const aiReply = await callAI([{
          role: 'system',
          content: `You are a Socratic teacher exploring the topic "${topic}" with a student. Never give direct answers. Always respond with 1-2 probing follow-up questions that build on the student's response and push them to think deeper. Be encouraging but challenging. Keep responses to 2-3 sentences. If the student has explored deeply (${newDepth}+ exchanges), acknowledge their depth and suggest they summarize their insights.`,
        }, ...context], { temperature: 0.7, maxTokens: 256 }, 'analysis');
        if (aiReply.trim()) {
          setMessages(prev => [...prev, { role: 'ai', text: aiReply.trim() }]);
          setLoading(false);
          callingRef.current = false;
          setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
          return;
        }
      } catch { /* fall through */ }
    }

    const probes = [
      `Interesting. But why do you think that is the case? What underlying principle drives this?`,
      `Can you think of an example that illustrates this? How does this apply in practice?`,
      `What would happen if the opposite were true? How would that change things?`,
      `You mentioned an important point. How does this connect to other concepts you know about ${topic}?`,
      `If you had to explain this to someone with no background, what analogy would you use?`,
      `What are the limitations or exceptions to what you just described?`,
      `That is a good foundation. Now, what are the implications of this? Why does it matter?`,
      `Let us go deeper. What assumptions are you making? Are they always valid?`,
    ];
    const aiReply = newDepth >= 7
      ? `Excellent depth of analysis! You have explored ${topic} from multiple angles. Key insight: your understanding has progressed through ${newDepth} layers of questioning. Consider writing a summary of what you discovered.`
      : probes[newDepth % probes.length];
    setMessages(prev => [...prev, { role: 'ai', text: aiReply }]);
    setLoading(false);
    callingRef.current = false;
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
  }

  if (!started) {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          Socratic dialogue: the AI asks probing questions to deepen your understanding. You answer, and each response leads to a deeper question.
        </p>
        <div className="flex gap-2">
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Topic to explore..." style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && startDialogue()}
          />
          <button className="btn btn-primary btn-sm" onClick={startDialogue}>
            <MessageCircle size={14} /> Begin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="badge badge-accent" style={{ fontSize: 10 }}>Depth: {depth}/7</span>
        <button className="btn btn-secondary btn-sm"
          onClick={() => { setStarted(false); setMessages([]); setTopic(''); }}
          style={{ padding: '4px 8px', fontSize: 11 }}>
          New Topic
        </button>
      </div>
      <div ref={chatRef} style={{
        maxHeight: 280, overflowY: 'auto', marginBottom: 8,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.6,
            background: m.role === 'ai' ? 'var(--accent-glow)' : 'var(--bg-primary)',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            borderLeft: m.role === 'ai' ? '3px solid var(--accent)' : undefined,
          }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(m.text)) }} />
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); respond(); }} className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Your response..." style={{ ...inputStyle, flex: 1 }} autoFocus />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading || !input.trim()}>
          {loading ? <><Loader2 size={14} className="spin" /> Thinking...</> : <ArrowRight size={14} />}
        </button>
      </form>
    </div>
  );
}
