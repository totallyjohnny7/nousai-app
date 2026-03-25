/**
 * StudyAnnotationSidecar — "Scribe OS" floating annotation panel.
 *
 * Five session-isolated tabs:
 *   ✏️  Draw    (Amber)   — MiniDrawCanvas, strokes persisted per question
 *   📝  Scribe  (Emerald) — Markdown textarea, debounced save
 *   🎓  Scholar (Purple)  — AI chat with strict math-formatting hygiene
 *   🔬  Lab     (Rose)    — AI-generated interactive HTML5/Canvas simulations
 *   📚  Library (Cyan)    — All past sessions for this subject, with Rehydrate
 *
 * State lives in the Zustand sessionStore (localStorage) + IDB for canvas.
 * Framer Motion drives the sliding tab-pill and session-swap animation.
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Minus, GripHorizontal, Pencil, NotebookPen,
  GraduationCap, BookOpen, Send, Loader2, RotateCcw,
  Trash2, Zap, Microscope, Maximize, RefreshCw,
} from 'lucide-react';
import MiniDrawCanvas from './MiniDrawCanvas';
import { useSessionStore, type ScribeSession, type ChatMsg } from '../store/sessionStore';
import { saveFile, loadFile } from '../utils/fileStore';
import { callAI, isAIConfigured } from '../utils/ai';
import { safeRenderMd } from '../utils/renderMd';

// ── Tab configuration ────────────────────────────────────────────────

const TABS = [
  { id: 'draw',    label: 'Draw',    Icon: Pencil,         color: '#f59e0b' },
  { id: 'scribe',  label: 'Scribe',  Icon: NotebookPen,    color: '#10b981' },
  { id: 'scholar', label: 'Scholar', Icon: GraduationCap,  color: '#8b5cf6' },
  { id: 'lab',     label: 'Lab',     Icon: Microscope,     color: '#f43f5e' },
  { id: 'library', label: 'Library', Icon: BookOpen,       color: '#06b6d4' },
] as const;
type Tab = typeof TABS[number]['id'];

// ── Scholar system prompt ────────────────────────────────────────────

function buildScholarPrompt(
  questionText: string,
  subject: string,
  options?: string[],
) {
  let prompt =
    `You are an expert study tutor helping a student understand a problem.\n\n` +
    `Question: "${questionText}"`;
  if (options?.length) {
    prompt += `\nOptions:\n${options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('\n')}`;
  }
  if (subject) prompt += `\nSubject: ${subject}`;
  prompt += `

STRICT FORMATTING RULES (follow exactly):
- Math inline: \\(...\\)  — NEVER use $...$
- Math display: \\[...\\] on its own line — NEVER use $$...$$
- Vectors: \\mathbf{v}  — NEVER write **v** or *v* for math symbols
- NEVER wrap mathematical expressions in Markdown bold (**) or italic (*)
- If you write a formula, put it on its own line with \\[...\\]
- Keep responses concise: 2-4 sentences unless a step-by-step is needed
- Guide understanding — don't reveal the final answer directly`;
  return prompt;
}

// ── Inline Scholar chat component ────────────────────────────────────

interface ScholarChatProps {
  sessionId: string;
  session: ScribeSession;
  questionText: string;
  subject: string;
  options?: string[];
}

function ScholarChat({ sessionId, session, questionText, subject, options }: ScholarChatProps) {
  const { updateChat } = useSessionStore();
  const [messages, setMessages] = useState<ChatMsg[]>(session.chatLog);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const chatRef                  = useRef<HTMLDivElement>(null);

  // Sync messages to store whenever they change
  useEffect(() => {
    updateChat(sessionId, messages);
  }, [messages, sessionId, updateChat]);

  // Auto-scroll
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const buildHistory = useCallback((msgs: ChatMsg[]) => [
    { role: 'system' as const, content: buildScholarPrompt(questionText, subject, options) },
    ...msgs.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.text,
    })),
  ], [questionText, subject, options]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const userMsg: ChatMsg = { role: 'user', text };
    const withUser = [...messages, userMsg, { role: 'ai' as const, text: '' }];
    setMessages(withUser);
    setLoading(true);

    try {
      let streamed = '';
      await callAI(buildHistory(withUser.slice(0, -1)), {
        onChunk: (chunk: string) => {
          streamed += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      }, 'chat');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: `Error: ${msg}` };
        return copy;
      });
    }
    setLoading(false);
  }, [input, loading, messages, buildHistory]);

  const regenerate = useCallback(async (idx: number) => {
    if (loading) return;
    const trimmed = messages.slice(0, idx);
    setMessages([...trimmed, { role: 'ai', text: '' }]);
    setLoading(true);
    try {
      let streamed = '';
      await callAI(buildHistory(trimmed), {
        onChunk: (chunk: string) => {
          streamed += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      }, 'chat');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to regenerate';
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: `Error: ${msg}` };
        return copy;
      });
    }
    setLoading(false);
  }, [loading, messages, buildHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages */}
      <div
        ref={chatRef}
        style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '8px 10px' }}
      >
        {messages.length === 0 && (
          <div style={{
            fontSize: 11, color: 'var(--text-muted)', textAlign: 'center',
            marginTop: 24, lineHeight: 1.6,
          }}>
            🎓 Ask Scholar anything about this question.<br />
            It'll guide you to the answer — not just give it away.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              margin: '5px 0', padding: '6px 9px', borderRadius: 8,
              background: m.role === 'user'
                ? 'rgba(139,92,246,0.12)'
                : 'var(--bg-secondary)',
              border: m.role === 'user'
                ? '1px solid rgba(139,92,246,0.25)'
                : '1px solid var(--border)',
              fontSize: 12, lineHeight: 1.6,
            }}
          >
            <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.text || (loading && i === messages.length - 1 ? '…' : '')) }} />
            {m.role === 'ai' && m.text && !loading && (
              <button
                onClick={() => regenerate(i)}
                title="Regenerate"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: '2px 0', marginTop: 2,
                  fontSize: 10, display: 'flex', alignItems: 'center', gap: 3,
                }}
              >
                <RotateCcw size={10} /> Regenerate
              </button>
            )}
          </div>
        ))}
        {loading && messages[messages.length - 1]?.text === '' && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <Loader2 size={14} className="spin" style={{ color: '#8b5cf6' }} />
          </div>
        )}
      </div>

      {/* Controls row */}
      {messages.length > 0 && (
        <div style={{
          padding: '2px 10px', display: 'flex', justifyContent: 'flex-end',
        }}>
          <button
            onClick={() => setMessages([])}
            title="Clear chat"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: 2, display: 'flex',
              alignItems: 'center', gap: 3, fontSize: 10,
            }}
          >
            <Trash2 size={10} /> Clear
          </button>
        </div>
      )}

      {/* Input */}
      <div style={{
        padding: '6px 8px', borderTop: '1px solid var(--border)',
        display: 'flex', gap: 4,
      }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
          }}
          placeholder="Ask Scholar…"
          disabled={loading}
          style={{
            flex: 1, padding: '6px 8px',
            border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--bg-input)',
            color: 'var(--text-primary)', fontSize: 12, outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '4px 8px', borderRadius: 6,
            background: '#8b5cf6', border: 'none', cursor: 'pointer',
            color: '#fff', opacity: loading || !input.trim() ? 0.4 : 1,
          }}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

// ── Library session card ──────────────────────────────────────────────

interface LibraryCardProps {
  session: ScribeSession;
  isCurrent: boolean;
  onRehydrate: () => void;
}

function LibraryCard({ session, isCurrent, onRehydrate }: LibraryCardProps) {
  const date = new Date(session.updatedAt);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        background: isCurrent ? 'rgba(6,182,212,0.08)' : 'var(--bg-secondary)',
        border: `1px solid ${isCurrent ? 'rgba(6,182,212,0.4)' : 'var(--border)'}`,
        borderRadius: 10, padding: '9px 11px', marginBottom: 6,
      }}
    >
      {/* Question preview */}
      <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 5 }}>
        {session.questionText.slice(0, 90)}{session.questionText.length > 90 ? '…' : ''}
      </div>

      {/* Receipt icons + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        {session.hasCanvas && (
          <span title="Has drawing" style={{ fontSize: 12 }}>🖼️</span>
        )}
        {session.textContent && (
          <span title="Has notes" style={{ fontSize: 12 }}>📝</span>
        )}
        {session.chatLog.length > 0 && (
          <span title={`${session.chatLog.length} messages`} style={{ fontSize: 12 }}>
            💬 {Math.ceil(session.chatLog.length / 2)}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-dim)' }}>
          {dateStr} {timeStr}
        </span>
      </div>

      {/* Actions */}
      {isCurrent ? (
        <div style={{
          fontSize: 10, color: '#06b6d4', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Zap size={10} /> Active session
        </div>
      ) : (
        <button
          onClick={onRehydrate}
          style={{
            fontSize: 10, fontWeight: 700, padding: '3px 9px',
            borderRadius: 6, border: '1px solid #06b6d4',
            background: 'rgba(6,182,212,0.1)', color: '#06b6d4',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            gap: 4, fontFamily: 'inherit',
          }}
        >
          <Zap size={10} /> Rehydrate
        </button>
      )}
    </div>
  );
}

// ── Visual Lab mini-panel ─────────────────────────────────────────────

interface LabPanelProps {
  questionText: string;
  subject: string;
  sessionId: string;
}

function LabPanel({ questionText, subject, sessionId }: LabPanelProps) {
  const storageKey = `scribe-lab-${sessionId}`;
  const [labHtml, setLabHtml] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Persist generated lab
  useEffect(() => {
    if (labHtml) {
      try { localStorage.setItem(storageKey, labHtml); } catch { /* ignore */ }
    }
  }, [labHtml, storageKey]);

  const generateLab = useCallback(async (overridePrompt?: string) => {
    const q = (overridePrompt || prompt).trim();
    if (!q || loading) return;
    setError('');
    setLoading(true);
    try {
      const sysPrompt = `You generate interactive HTML5/Canvas simulations. Return ONLY valid HTML code. No explanations, no markdown.`;
      const userPrompt = `Create a self-contained HTML page that demonstrates: "${q}"

Context: ${subject} — related to question: "${questionText.slice(0, 200)}"

Requirements:
1. Use a <canvas> element (320x240) for visualization with animation loop
2. Include interactive controls (sliders, buttons) below the canvas
3. Dark theme (background: #1a1a2e, text: #e0e0e0, accent: #f43f5e)
4. All JavaScript inline (no external dependencies)
5. Brief title at top, play/pause + reset buttons
6. Display relevant values in real-time
7. Start PAUSED, draw initial state immediately
8. Wrap JS in try-catch + add window.onerror handler
9. Keep total HTML under 8000 characters — compact, efficient code
10. Use requestAnimationFrame for smooth animation
11. Responsive layout with flexbox, fits small container

Return ONLY the HTML. Start with <!DOCTYPE html>.`;

      const html = await callAI([
        { role: 'system', content: sysPrompt },
        { role: 'user', content: userPrompt },
      ], { temperature: 0.3, maxTokens: 12000 }, 'analysis');

      let cleaned = html.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
      }
      if (!cleaned.includes('<') || cleaned.length < 100) {
        throw new Error('AI returned invalid content.');
      }
      if (!cleaned.includes('<!DOCTYPE') && !cleaned.includes('<html')) {
        cleaned = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;margin:8px;}
canvas{border:1px solid #333;border-radius:6px;display:block;margin:0 auto 8px;max-width:100%;}
button{background:#f43f5e;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:11px;margin:2px;}
input[type=range]{width:140px;}</style>
</head><body>${cleaned}</body></html>`;
      }

      setLabHtml(cleaned);
      setPrompt('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate simulation.');
    }
    setLoading(false);
  }, [prompt, loading, questionText, subject]);

  const autoPrompt = `Visualize the concept from this question: "${questionText.slice(0, 120)}"`;

  if (!isAIConfigured()) {
    return (
      <div style={{ padding: 16, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
        Configure an AI provider in Settings to use Visual Lab.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 8, gap: 6 }}>
      {labHtml ? (
        <>
          {/* Rendered simulation */}
          <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <iframe
              ref={iframeRef}
              srcDoc={labHtml}
              sandbox="allow-scripts"
              style={{ width: '100%', height: '100%', border: 'none', minHeight: 260, background: '#1a1a2e' }}
              title="Visual Lab Simulation"
            />
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button
              onClick={() => iframeRef.current?.requestFullscreen?.()}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 5,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              <Maximize size={9} /> Fullscreen
            </button>
            <button
              onClick={() => generateLab(autoPrompt)}
              disabled={loading}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 5,
                border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 3,
                opacity: loading ? 0.5 : 1,
              }}
            >
              <RefreshCw size={9} /> Regenerate
            </button>
            <button
              onClick={() => { setLabHtml(null); try { localStorage.removeItem(storageKey); } catch { /* */ } }}
              style={{
                fontSize: 10, padding: '3px 8px', borderRadius: 5,
                border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)',
                color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto',
              }}
            >
              <Trash2 size={9} /> Clear
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Prompt input */}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 2 }}>
            🔬 Generate an interactive simulation for this question.
          </div>
          <button
            onClick={() => generateLab(autoPrompt)}
            disabled={loading}
            style={{
              padding: '8px 12px', borderRadius: 8,
              background: loading ? 'var(--bg-secondary)' : 'rgba(244,63,94,0.12)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: loading ? 'var(--text-muted)' : '#f43f5e',
              cursor: loading ? 'default' : 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {loading ? <><Loader2 size={13} className="spin" /> Generating…</> : <><Microscope size={13} /> Auto-Generate from Question</>}
          </button>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>or</div>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') generateLab(); }}
              placeholder="Custom simulation prompt…"
              disabled={loading}
              style={{
                flex: 1, padding: '6px 8px', border: '1px solid var(--border)',
                borderRadius: 6, background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 11, outline: 'none', fontFamily: 'inherit',
              }}
            />
            <button
              onClick={() => generateLab()}
              disabled={loading || !prompt.trim()}
              style={{
                padding: '4px 10px', borderRadius: 6, background: '#f43f5e',
                border: 'none', cursor: 'pointer', color: '#fff',
                opacity: loading || !prompt.trim() ? 0.4 : 1, fontFamily: 'inherit',
              }}
            >
              <Send size={11} />
            </button>
          </div>
          {error && (
            <div style={{ fontSize: 10, color: '#ef4444', padding: '4px 6px', background: 'rgba(239,68,68,0.08)', borderRadius: 6 }}>
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main sidecar component ───────────────────────────────────────────

interface Props {
  questionId: string;
  questionText: string;
  questionType?: string;
  options?: string[];
  subject: string;
  quizId: string;
  onClose: () => void;
}

const PANEL_W = 348;
const PANEL_H = 520;

export default function StudyAnnotationSidecar({
  questionId, questionText, questionType, options, subject, quizId, onClose,
}: Props) {
  const { getOrCreate, getSessionsBySubject, updateText, setCanvasKey } = useSessionStore();

  // ── Active session for this question ──
  const [activeSession, setActiveSession] = useState<ScribeSession>(() =>
    getOrCreate(questionId, questionText, subject)
  );

  // ── Canvas data from IDB ──
  const [canvasData, setCanvasData] = useState<string | null>(null);

  // Load / reload session on questionId or rehydrate change
  useEffect(() => {
    const s = getOrCreate(questionId, questionText, subject);
    setActiveSession(s);
    setCanvasData(null);
    if (s.canvasKey) {
      loadFile(s.canvasKey).then(d => { if (d) setCanvasData(d); });
    }
  }, [questionId, questionText, subject, getOrCreate]);

  // ── Tab + UI state ──
  const [tab, setTab] = useState<Tab>('draw');
  const [collapsed, setCollapsed] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Sync text draft from session
  useEffect(() => {
    setTextDraft(activeSession.textContent ?? '');
  }, [activeSession.sessionId, activeSession.textContent]);

  // ── Dragging (persisted position) ──
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem('scribe-os-pos');
      if (saved) { const p = JSON.parse(saved); return { x: Math.min(p.x, window.innerWidth - 60), y: Math.min(p.y, window.innerHeight - 60) }; }
    } catch { /* ignore */ }
    return { x: Math.max(0, window.innerWidth - PANEL_W - 56), y: 80 };
  });
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Persist position on change (debounced via drag end)
  const savePosRef = useRef(pos);
  savePosRef.current = pos;

  const onHeaderDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [pos]);

  const onHeaderMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.mx;
    const dy = e.clientY - dragOrigin.current.my;
    setPos({
      x: Math.max(-PANEL_W + 60, Math.min(window.innerWidth - 60, dragOrigin.current.px + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 40, dragOrigin.current.py + dy)),
    });
  }, []);

  const onHeaderUp = useCallback(() => {
    dragging.current = false;
    try { localStorage.setItem('scribe-os-pos', JSON.stringify(savePosRef.current)); } catch { /* ignore */ }
  }, []);

  // ── Debounced text save ──
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTextChange = useCallback((val: string) => {
    setTextDraft(val);
    setSyncStatus('saving');
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => {
      updateText(activeSession.sessionId, val);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 750);
  }, [activeSession.sessionId, updateText]);

  // ── Canvas save ──
  const canvasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleCanvasSave = useCallback((dataUrl: string) => {
    setCanvasData(dataUrl);
    setSyncStatus('saving');
    if (canvasTimer.current) clearTimeout(canvasTimer.current);
    canvasTimer.current = setTimeout(async () => {
      const key = `scribe-canvas-${activeSession.sessionId}`;
      await saveFile(key, dataUrl);
      setCanvasKey(activeSession.sessionId, key);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus('idle'), 2000);
    }, 750);
  }, [activeSession.sessionId, setCanvasKey]);

  useEffect(() => () => {
    if (textTimer.current) clearTimeout(textTimer.current);
    if (canvasTimer.current) clearTimeout(canvasTimer.current);
  }, [activeSession.sessionId]);

  // ── Rehydrate a past session ──
  const handleRehydrate = useCallback((session: ScribeSession) => {
    setActiveSession(session);
    setTextDraft(session.textContent ?? '');
    setCanvasData(null);
    if (session.canvasKey) {
      loadFile(session.canvasKey).then(d => { if (d) setCanvasData(d); });
    }
    setTab('draw');
  }, []);

  // ── Sync footer label ──
  const syncLabel =
    syncStatus === 'saving' ? '🔄 Saving…' :
    syncStatus === 'saved'  ? '✅ Saved'    : '';

  // ── Collapsed pill ──
  if (collapsed) {
    const hasAny = activeSession.hasCanvas || !!activeSession.textContent || activeSession.chatLog.length > 0;
    return (
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        onClick={() => setCollapsed(false)}
        style={{
          position: 'fixed', left: pos.x, top: pos.y, zIndex: 300,
          width: 76, height: 32, borderRadius: 16,
          background: hasAny ? 'var(--accent)' : 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: hasAny ? '#fff' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700,
          boxShadow: '0 2px 12px rgba(0,0,0,0.3)', userSelect: 'none',
        }}
      >
        <Pencil size={12} /> Scribe
      </motion.div>
    );
  }

  const librarySessions = getSessionsBySubject(subject);

  return (
    <div
      style={{
        position: 'fixed', left: pos.x, top: pos.y,
        width: PANEL_W, zIndex: 300,
        background: 'var(--bg-primary)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', userSelect: 'none',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* ── Header / Drag Handle ── */}
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        style={{
          padding: '8px 10px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'grab',
        }}
      >
        <GripHorizontal size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, flex: 1, color: 'var(--text-primary)' }}>
          ✏️ Scribe OS
        </span>
        <button
          onClick={() => setCollapsed(true)}
          title="Minimise"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
        >
          <Minus size={13} />
        </button>
        <button
          onClick={onClose}
          title="Close"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Glassmorphic Tab Bar ── */}
      <div style={{
        display: 'flex', gap: 2, padding: '5px 6px',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {TABS.filter(t => (t.id !== 'scholar' && t.id !== 'lab') || isAIConfigured()).map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, position: 'relative',
                padding: '5px 3px', borderRadius: 7,
                background: 'transparent', border: 'none',
                cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 3,
              }}
            >
              {/* Animated pill behind active tab */}
              {active && (
                <motion.div
                  layoutId="scribe-tab-pill"
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 7,
                    background: t.color + '22',
                    border: `1px solid ${t.color}44`,
                  }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <t.Icon
                size={11}
                style={{
                  position: 'relative', zIndex: 1,
                  color: active ? t.color : 'var(--text-muted)',
                  transition: 'color 0.15s',
                }}
              />
              <span style={{
                position: 'relative', zIndex: 1,
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? t.color : 'var(--text-muted)',
                transition: 'color 0.15s',
              }}>
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Tab Content (session-swap slide animation) ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${activeSession.sessionId}-${tab}`}
            initial={{ x: 14, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -14, opacity: 0 }}
            transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >

            {/* ── Draw Tab ── */}
            {tab === 'draw' && (
              <div style={{ padding: 10, userSelect: 'none' }}>
                <MiniDrawCanvas
                  initialData={canvasData}
                  onChange={handleCanvasSave}
                />
              </div>
            )}

            {/* ── Scribe Tab ── */}
            {tab === 'scribe' && (
              <div style={{
                padding: 10, display: 'flex', flexDirection: 'column',
                gap: 7, userSelect: 'text',
              }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setShowPreview(p => !p)}
                    style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 5,
                      border: '1px solid var(--border)',
                      background: showPreview ? '#10b981' : 'var(--bg-secondary)',
                      color: showPreview ? '#fff' : 'var(--text-muted)',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {showPreview ? '✏️ Edit' : '👁 Preview'}
                  </button>
                </div>
                {showPreview ? (
                  <div
                    style={{
                      minHeight: 180, padding: '8px 10px', borderRadius: 8,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)',
                      fontSize: 13, lineHeight: 1.6,
                      color: 'var(--text-primary)',
                    }}
                    dangerouslySetInnerHTML={{
                      __html: safeRenderMd(textDraft || '*Nothing written yet…*'),
                    }}
                  />
                ) : (
                  <textarea
                    value={textDraft}
                    onChange={e => handleTextChange(e.target.value)}
                    placeholder="Write notes, formulas, translations… Markdown supported."
                    rows={9}
                    style={{
                      width: '100%', resize: 'vertical',
                      padding: '8px 10px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      background: 'var(--bg-input)', color: 'var(--text-primary)',
                      fontSize: 13, lineHeight: 1.6,
                      fontFamily: 'inherit', outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            )}

            {/* ── Scholar Tab ── */}
            {tab === 'scholar' && isAIConfigured() && (
              <ScholarChat
                key={activeSession.sessionId}
                sessionId={activeSession.sessionId}
                session={activeSession}
                questionText={questionText}
                subject={subject}
                options={options}
              />
            )}

            {/* ── Lab Tab ── */}
            {tab === 'lab' && isAIConfigured() && (
              <LabPanel
                key={activeSession.sessionId}
                questionText={questionText}
                subject={subject}
                sessionId={activeSession.sessionId}
              />
            )}

            {/* ── Library Tab ── */}
            {tab === 'library' && (
              <div style={{
                padding: 10, overflowY: 'auto', userSelect: 'text',
              }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-dim)',
                  marginBottom: 8, fontWeight: 600, letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}>
                  {subject} — {librarySessions.length} session{librarySessions.length !== 1 ? 's' : ''}
                </div>
                {librarySessions.length === 0 && (
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)', textAlign: 'center',
                    marginTop: 24, lineHeight: 1.7,
                  }}>
                    📚 No sessions yet.<br />
                    Draw, write, or ask Scholar to create your first session.
                  </div>
                )}
                {librarySessions.map(s => (
                  <LibraryCard
                    key={s.sessionId}
                    session={s}
                    isCurrent={s.sessionId === activeSession.sessionId}
                    onRehydrate={() => {
                      handleRehydrate(s);
                    }}
                  />
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer: session ID + sync status ── */}
      <div style={{
        padding: '3px 10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 9, color: 'var(--text-dim)',
      }}>
        <span style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}>
          {activeSession.sessionId}
        </span>
        {syncLabel && (
          <span style={{ fontSize: 10 }}>{syncLabel}</span>
        )}
      </div>
    </div>
  );
}
