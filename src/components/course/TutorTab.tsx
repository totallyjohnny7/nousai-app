import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, Download, Trash2, Send, Volume2, Camera } from 'lucide-react';
import type { Course } from '../../types';
import { callAI, isAIConfigured, type AIMessage } from '../../utils/ai';
import { speak } from '../../utils/speechTools';
import { sanitizeHtml } from '../../utils/sanitize';
import { useImageOCR } from '../../hooks/useImageOCR';
import ImageInputBar from '../ImageInputBar';
import { generateId, formatDate, formatDateShort, renderSimpleMarkdown } from './courseHelpers';

interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: string;
}

export default function TutorTab({
  course, accentColor,
}: {
  course: Course;
  accentColor: string;
}) {
  const storageKey = `nousai-tutor-${course.id}`;
  const [messages, setMessages] = useState<TutorMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const imageOCR = useImageOCR();

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch (e) { console.warn('[Chat] localStorage save failed:', e); }
  }, [messages, storageKey]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Build system prompt with course context
  const buildSystemPrompt = useCallback(() => {
    const topicsList = (course.topics || []).map(t => t.name).join(', ');
    const cardsSample = (course.flashcards || []).slice(0, 30)
      .map(f => `Q: ${f.front} → A: ${f.back}`).join('\n');
    const topicContext = selectedTopic
      ? `The student is currently focused on: "${selectedTopic}".`
      : 'No specific topic selected yet.';

    return `You are a helpful, knowledgeable tutor for the course "${course.name}".
${topicContext}

Course topics: ${topicsList || 'none listed'}

Key flashcards for context:
${cardsSample || 'No flashcards available.'}

Guidelines:
- Be concise but thorough. Use markdown formatting (bold, lists, etc.).
- Reference actual course content when possible.
- If the student asks you to quiz them, generate real questions from the flashcards above.
- Encourage active recall and spaced repetition.
- Keep responses focused and under 300 words unless a longer explanation is needed.`;
  }, [course, selectedTopic]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() && !imageOCR.ocrText && !imageOCR.imageBase64) return;
    let userContent = input.trim();
    // Capture image data before clearing
    const hasImage = !!imageOCR.imageBase64;
    const imgBase64 = imageOCR.imageBase64;
    const imgMime = imageOCR.imageMimeType || 'image/png';
    if (imageOCR.ocrText) {
      userContent += (userContent ? '\n\n' : '') + '[Extracted from image]:\n' + imageOCR.ocrText;
    }
    if (hasImage && !imageOCR.ocrText) {
      userContent += (userContent ? '\n\n' : '') + '[Image attached — please analyze the image directly]';
    }
    imageOCR.clearImage();
    const userMsg: TutorMessage = {
      id: generateId(),
      role: 'user',
      content: userContent,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // If AI is configured, use real AI; otherwise fall back to templates
    if (isAIConfigured()) {
      try {
        // Build message history (last 20 messages for context)
        const recentMsgs = [...messages.slice(-20), userMsg];
        const aiMessages: AIMessage[] = [
          { role: 'system' as const, content: buildSystemPrompt() },
          ...recentMsgs.map((m, i) => {
            const role = (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant';
            // Attach image to the last user message for AI vision
            if (hasImage && imgBase64 && i === recentMsgs.length - 1 && role === 'user') {
              return {
                role,
                content: [
                  { type: 'image_url' as const, image_url: { url: `data:${imgMime};base64,${imgBase64}` } },
                  { type: 'text' as const, text: m.content + '\n\nPlease analyze the image above carefully. Extract and read ALL text including any Japanese, Chinese, or other non-Latin characters accurately.' },
                ],
              };
            }
            return { role, content: m.content };
          }),
        ];

        let streamedText = '';
        const responseId = generateId();

        // Add empty tutor message for streaming
        setMessages(prev => [...prev, {
          id: responseId,
          role: 'tutor' as const,
          content: '',
          timestamp: new Date().toISOString(),
        }]);
        setIsTyping(false);

        await callAI(aiMessages, {
          onChunk: (chunk: string) => {
            streamedText += chunk;
            setMessages(prev => prev.map(m =>
              m.id === responseId ? { ...m, content: streamedText } : m
            ));
          },
        });

        // Finalize if streaming didn't produce output
        if (!streamedText) {
          const fullText = await callAI(aiMessages);
          setMessages(prev => prev.map(m =>
            m.id === responseId ? { ...m, content: fullText } : m
          ));
        }
      } catch (err: any) {
        const errMsg: TutorMessage = {
          id: generateId(),
          role: 'tutor',
          content: `⚠ AI error: ${err.message || 'Unknown error'}. Check your API key in Settings → AI Provider.`,
          timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errMsg]);
        setIsTyping(false);
      }
    } else {
      // Fallback: template-based responses when no AI configured
      const topic = selectedTopic || 'this topic';
      const lowerMsg = userContent.toLowerCase();
      let reply: string;

      if (lowerMsg.includes('explain') || lowerMsg.includes('what is') || lowerMsg.includes('define')) {
        reply = `Here's a study approach for **${topic}**:\n- Start with the foundational definition\n- Identify core components and relationships\n- Find real-world examples\n\n*For AI-powered explanations, configure an AI provider in Settings.*`;
      } else if (lowerMsg.includes('quiz') || lowerMsg.includes('test me')) {
        reply = `**Quick Self-Check for ${topic}:**\n1. Can you define it in one sentence?\n2. What are the 3 most important aspects?\n3. How does it relate to other topics?\n\n*Configure AI in Settings for generated quiz questions from your flashcards.*`;
      } else {
        reply = `I can help with **${topic}** in ${course.name}. Try asking me to:\n- **Explain** a concept\n- **Quiz** you on material\n- **Summarize** a topic\n\n*For full AI tutoring, set up an API key in Settings → AI Provider.*`;
      }

      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: generateId(),
          role: 'tutor',
          content: reply,
          timestamp: new Date().toISOString(),
        }]);
        setIsTyping(false);
      }, 500);
    }
  }, [input, messages, buildSystemPrompt, selectedTopic, course.name, imageOCR]);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  const exportConversation = useCallback(() => {
    const text = messages.map(m =>
      `[${m.role === 'user' ? 'You' : 'Tutor'}] (${formatDate(m.timestamp)})\n${m.content}`
    ).join('\n\n---\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.shortName || course.name}-tutor-chat.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, course]);

  // Pre-built prompts
  const presets = [
    { label: 'Explain this topic', prompt: `Explain ${selectedTopic || 'this topic'} to me in simple terms` },
    { label: 'Quiz me', prompt: `Quiz me on ${selectedTopic || 'this course material'}` },
    { label: 'Mnemonics', prompt: `Give me mnemonics to remember ${selectedTopic || 'key concepts'}` },
    { label: 'I need help', prompt: `I am struggling with ${selectedTopic || 'this material'}. Help me understand it.` },
    { label: 'Summarize', prompt: `Give me a summary of ${selectedTopic || 'the main topics'}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 260px)', minHeight: 400 }}>
      {/* Topic selector & actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <select
          value={selectedTopic}
          onChange={e => setSelectedTopic(e.target.value)}
          style={{ flex: 1, minWidth: 120, fontSize: 12 }}
        >
          <option value="">Select a topic...</option>
          {(course.topics || []).map(t => (
            <option key={t.id} value={t.name}>{t.name}</option>
          ))}
        </select>
        <button className="btn btn-sm" onClick={exportConversation} disabled={messages.length === 0}>
          <Download size={13} />
        </button>
        <button className="btn btn-sm btn-danger" onClick={clearHistory} disabled={messages.length === 0}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Pre-built prompts */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        {presets.map(p => (
          <button
            key={p.label}
            className="cx-chip"
            onClick={() => { setInput(p.prompt); }}
            style={{ flexShrink: 0 }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Messages area */}
      <div ref={messagesContainerRef} style={{
        flex: 1, overflowY: 'auto', padding: 12, borderRadius: 'var(--radius)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
        marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-dim)' }}>
            <MessageCircle size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Course Tutor</div>
            <div style={{ fontSize: 12 }}>
              Ask me anything about {course.name}. Select a topic above for more targeted help.
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              padding: '10px 14px', borderRadius: 'var(--radius)',
              background: msg.role === 'user' ? `${accentColor}20` : 'var(--bg-card)',
              border: `1px solid ${msg.role === 'user' ? accentColor + '30' : 'var(--border)'}`,
            }}>
              <div
                style={{ fontSize: 13, lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderSimpleMarkdown(msg.content)) }}
              />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
              {msg.role === 'tutor' ? 'Tutor' : 'You'} &middot; {formatDateShort(msg.timestamp)}
              {msg.content && (
                <button
                  onClick={() => speak(msg.content, { voiceLang: 'ja-JP', rate: 0.9 })}
                  title="Read aloud (Japanese)"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)', display: 'inline-flex' }}
                >
                  <Volume2 size={11} />
                </button>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius)',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            alignSelf: 'flex-start', maxWidth: '60%',
          }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', animation: 'pulse 1.5s infinite' }}>
              Tutor is thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image input bar (when image attached) */}
      {(imageOCR.imagePreview || imageOCR.ocrText || imageOCR.ocrError || imageOCR.isProcessing) && (
        <div style={{ marginBottom: 8 }}>
          <ImageInputBar ocr={imageOCR} compact />
        </div>
      )}

      {/* Input area */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask the tutor..."
          style={{ flex: 1, fontSize: 13 }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          onPaste={imageOCR.handlePaste}
        />
        <button
          className="btn btn-sm"
          onClick={imageOCR.triggerFileInput}
          title="Upload image"
          style={{ padding: '6px 8px' }}
        >
          <Camera size={14} />
        </button>
        <button className="btn btn-primary" onClick={sendMessage} disabled={!input.trim() && !imageOCR.ocrText}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
