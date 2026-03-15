import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  MessageCircle, Shuffle, Layers, AlertTriangle, Eye, ArrowRight,
  RotateCcw, Sparkles, HelpCircle, Loader2, Plus, XCircle, CheckCircle,
  Image as ImageIcon, X, ZoomIn,
} from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { safeRenderMd } from '../../utils/renderMd';
import { useImageOCR } from '../../hooks/useImageOCR';
import ImageInputBar from '../ImageInputBar';

interface SolverStep {
  type: 'diagnostic' | 'step' | 'feedback' | 'summary';
  stepNumber: number | null;
  totalStepsEstimate: number | null;
  stepTitle: string | null;
  explanation: string;
  hint: string | null;
  graph: { fn: string; xDomain?: [number, number]; title?: string } | null;
  diagram: { svg: string; label?: string } | null;
  options: string[] | null;
}

interface SolverMessage {
  role: 'user' | 'ai';
  text: string;
  parsed?: SolverStep;
}

interface SolverChatMsg {
  role: 'user' | 'ai';
  text: string;
}

function parseSolverJSON(raw: string): SolverStep | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const obj = JSON.parse(cleaned);
    return {
      type: obj.type || 'step',
      stepNumber: obj.stepNumber ?? null,
      totalStepsEstimate: obj.totalStepsEstimate ?? null,
      stepTitle: obj.stepTitle ?? null,
      explanation: obj.explanation || raw,
      hint: obj.hint ?? null,
      graph: obj.graph ?? null,
      diagram: obj.diagram ?? null,
      options: obj.options ?? null,
    };
  } catch {
    return {
      type: 'step',
      stepNumber: null,
      totalStepsEstimate: null,
      stepTitle: null,
      explanation: raw,
      hint: null,
      graph: null,
      diagram: null,
      options: null,
    };
  }
}

function GraphRenderer({ graph }: { graph: { fn: string; xDomain?: [number, number]; title?: string } }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    try {
      import('function-plot').then(({ default: functionPlot }) => {
        if (!ref.current) return;
        ref.current.innerHTML = '';
        functionPlot({
          target: ref.current,
          width: Math.min(ref.current.clientWidth || 320, 400),
          height: 250,
          xAxis: { domain: graph.xDomain || [-10, 10] },
          grid: true,
          data: [{ fn: graph.fn, color: '#0ea5e9' }],
          title: graph.title,
        });
      }).catch(() => {
        if (ref.current) ref.current.innerHTML = '<p style="color:var(--text-muted);font-size:12px">Graph unavailable</p>';
      });
    } catch {
      if (ref.current) ref.current.innerHTML = '<p style="color:var(--text-muted);font-size:12px">Graph unavailable</p>';
    }
  }, [graph.fn, graph.xDomain?.[0], graph.xDomain?.[1], graph.title]);

  return (
    <div ref={ref} style={{
      margin: '12px 0', borderRadius: 8, overflow: 'hidden',
      background: 'rgba(255,255,255,.03)', border: '1px solid var(--border)',
    }} />
  );
}

function DiagramRenderer({ diagram }: { diagram: { svg: string; label?: string } }) {
  const [visible, setVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const safeImgSrc = useMemo(() => {
    try {
      // Strip potentially dangerous elements and attributes
      const clean = diagram.svg
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<foreignObject\b[^<]*(?:(?!<\/foreignObject>)<[^<]*)*<\/foreignObject>/gi, '')
        .replace(/\s+on\w+="[^"]*"/gi, '')
        .replace(/\s+on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '');
      // Encode as base64 data URL for safe rendering via img tag
      return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(clean)));
    } catch {
      return null;
    }
  }, [diagram.svg]);

  if (!safeImgSrc) return null;

  return (
    <div style={{ margin: '12px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {diagram.label && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', flex: 1 }}>
            {diagram.label}
          </span>
        )}
        <button
          onClick={() => setVisible(v => !v)}
          style={{ fontSize: 10, color: '#0ea5e9', background: 'none', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, border: '1px solid rgba(14,165,233,0.3)', whiteSpace: 'nowrap' }}
        >
          {visible ? 'Hide Diagram' : 'Show Diagram'}
        </button>
      </div>
      {visible && (
        <div
          onClick={() => setFullscreen(true)}
          title="Click to expand"
          style={{ cursor: 'zoom-in', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,.03)', position: 'relative', display: 'inline-block', maxWidth: '100%' }}
        >
          <img src={safeImgSrc} alt={diagram.label || 'Diagram'} style={{ width: '100%', maxWidth: 400, display: 'block' }} />
          <div style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.5)', borderRadius: 4, padding: '2px 4px' }}>
            <ZoomIn size={10} color="rgba(255,255,255,.6)" />
          </div>
        </div>
      )}
      {fullscreen && (
        <div
          onClick={() => setFullscreen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'zoom-out' }}
        >
          <div style={{ position: 'relative' }}>
            <img src={safeImgSrc} alt={diagram.label || 'Diagram'} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 12 }} />
            {diagram.label && (
              <div style={{ position: 'absolute', bottom: -24, left: 0, right: 0, textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,.6)', fontStyle: 'italic' }}>
                {diagram.label}
              </div>
            )}
          </div>
          <button onClick={e => { e.stopPropagation(); setFullscreen(false); }} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <X size={14} color="#fff" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SolverMode() {
  const { courses, data, saveMatchSet, updatePluginData } = useStore();
  const [view, setView] = useState<'input' | 'solving' | 'summary'>('input');
  const [question, setQuestion] = useState('');
  const [courseId, setCourseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SolverMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [tryMyself, setTryMyself] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<SolverChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showMatchCreator, setShowMatchCreator] = useState(false);
  const [matchPairs, setMatchPairs] = useState<{ term: string; definition: string }[]>([]);
  const [matchName, setMatchName] = useState('');
  const [matchFolder, setMatchFolder] = useState('');
  const [matchCourseId, setMatchCourseId] = useState<string | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const imageOCR = useImageOCR();
  const solveImageOCR = useImageOCR(); // For mid-solve image uploads
  const messagesRef = useRef<HTMLDivElement>(null);

  const selectedCourse = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);

  const buildMessages = useCallback((userMsg: string, imgBase64?: string | null, imgMime?: string | null) => {
    const course = courses.find(c => c.id === courseId);
    let courseContext = '';
    if (course) {
      const topicsList = (course.topics || []).map((t: any) => t.name).join(', ');
      const cardsSample = (course.flashcards || []).slice(0, 20)
        .map((f: any) => `Q: ${f.front} -> A: ${f.back}`).join('\n');
      courseContext = `\nCourse: "${course.name}"\nTopics: ${topicsList || 'N/A'}\nKey flashcards:\n${cardsSample || 'None'}\n`;
    }

    const systemPrompt = `You are a patient, adaptive tutor helping a student solve a specific problem.

APPROACH:
1. First, understand where the student is. Ask what they've tried or where they're stuck.
2. Meet them at their level - don't start from scratch if they're halfway through.
3. When walking through steps, do ONE at a time. Explain WHAT and WHY.
4. After each step, check in with the student.
5. If the student wants to attempt something, let them try first, then evaluate.
6. Use $...$ for inline math, $$...$$ for display math.
7. Include a "graph" field when a mathematical function/equation would benefit from a plot.
8. Include a "diagram" field with inline SVG when a visual diagram would significantly help understanding.
   Use for: electric field lines, force vectors, free body diagrams, circuit schematics,
   cell biology diagrams, mitosis/meiosis flowcharts, geometry figures, coordinate planes,
   molecular structures, wave diagrams, before/after comparisons, Venn diagrams.
   SVG rules: viewBox='0 0 320 200' width='320' height='200', no background fill (transparent),
   use SINGLE quotes for ALL SVG attribute values, stroke='#0ea5e9' for main elements,
   stroke='rgba(255,255,255,0.4)' for grid/secondary, fill='none' for shapes,
   text: fill='rgba(255,255,255,0.85)' font-family='sans-serif' font-size='12'.
   Keep SVG under 1500 characters. Include "label" like "Figure 1: Electric Field Lines".
   ONLY include diagram when it genuinely adds visual value.
9. If the student uploaded an image or diagram, analyze it carefully. Describe what you see
   in your explanation and reference it throughout steps: "As shown in your diagram...",
   "Looking at your image, I can see...". Never refuse to analyze an image.
10. Double-check your calculations before responding.
${courseContext}
Respond as JSON:
{
  "type": "diagnostic" | "step" | "feedback" | "summary",
  "stepNumber": null or number,
  "totalStepsEstimate": null or number,
  "stepTitle": null or "title string",
  "explanation": "Your message in markdown with $LaTeX$ if needed...",
  "hint": null or "What comes next...",
  "graph": null or { "fn": "x^2+5*x+6", "xDomain": [-8, 4], "title": "f(x)" },
  "diagram": null or { "svg": "<svg viewBox='0 0 320 200' ...>...</svg>", "label": "Figure 1: ..." },
  "options": ["Start from beginning", "I've tried...", "Check my answer"]
}`;

    const aiMessages: any[] = [
      { role: 'system', content: systemPrompt },
    ];
    for (const m of messages) {
      aiMessages.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      });
    }
    // If we have image data, make the user message multimodal
    if (imgBase64) {
      aiMessages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:${imgMime || 'image/png'};base64,${imgBase64}` } },
          { type: 'text', text: userMsg + '\n\nPlease analyze the image/diagram above carefully. Extract and read ALL text including any Japanese, Chinese, or other non-Latin characters accurately. Reference what you see in your explanation.' },
        ],
      });
    } else {
      aiMessages.push({ role: 'user', content: userMsg });
    }
    return aiMessages;
  }, [messages, courseId, courses]);

  const sendMessage = useCallback(async (userText: string, imgBase64?: string | null, imgMime?: string | null) => {
    if (isLoading || !userText.trim()) return;
    const userMsg: SolverMessage = { role: 'user', text: userText };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setTryMyself(false);
    setIsLoading(true);

    try {
      const aiMsgs = buildMessages(userText, imgBase64, imgMime);
      let streamed = '';
      setMessages(prev => [...prev, { role: 'ai', text: '...' }]);

      await callAI(aiMsgs, {
        json: true,
        onChunk: (chunk: string) => {
          streamed += chunk;
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      });

      if (!streamed) {
        streamed = await callAI(aiMsgs, { json: true });
      }

      const parsed = parseSolverJSON(streamed);
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: streamed, parsed: parsed || undefined };
        return copy;
      });
    } catch (err: any) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: 'ai',
          text: `AI error: ${err.message}. Check Settings -> AI Provider.`,
        };
        return copy;
      });
    }
    setIsLoading(false);
  }, [isLoading, buildMessages]);

  const startSolving = useCallback(() => {
    const q = question.trim();
    if (!q && !imageOCR.ocrText) return;
    if (!isAIConfigured()) return;
    const imgBase64 = imageOCR.imageBase64;
    const imgMime = imageOCR.imageMimeType || 'image/png';
    let fullQuestion = q;
    if (imageOCR.ocrText) {
      fullQuestion += (q ? '\n\n' : '') + '[Extracted from image]:\n' + imageOCR.ocrText;
    }
    setView('solving');
    setMessages([]);
    imageOCR.clearImage();
    sendMessage(`Here is my question:\n\n${fullQuestion}`, imgBase64, imgMime);
  }, [question, sendMessage, imageOCR]);

  const sendSolveMessage = useCallback(() => {
    if (!input.trim() && !solveImageOCR.imageBase64) return;
    const imgBase64 = solveImageOCR.imageBase64;
    const imgMime = solveImageOCR.imageMimeType || 'image/png';
    let msg = input.trim();
    if (solveImageOCR.ocrText) {
      msg += (msg ? '\n\n' : '') + '[Extracted from image]:\n' + solveImageOCR.ocrText;
    }
    if (!msg) msg = 'Please analyze the image I attached.';
    solveImageOCR.clearImage();
    sendMessage(msg, imgBase64, imgMime);
  }, [input, solveImageOCR, sendMessage]);

  const sendChatMessage = useCallback(async () => {
    if (chatLoading || !chatInput.trim()) return;
    const userText = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatLoading(true);

    try {
      const stepsContext = messages
        .filter(m => m.role === 'ai' && m.parsed)
        .map(m => `Step ${m.parsed!.stepNumber}: ${m.parsed!.explanation}`)
        .join('\n\n');

      const chatAiMsgs: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: `You are a helpful tutor assistant. The student is working through a problem. Context:\n\nOriginal question: ${question}\n\nSteps so far:\n${stepsContext}\n\nAnswer concisely. Use $...$ for math.` },
        ...chatMessages.map(m => ({ role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant', content: m.text })),
        { role: 'user' as const, content: userText },
      ];

      let streamed = '';
      setChatMessages(prev => [...prev, { role: 'ai', text: '...' }]);
      await callAI(chatAiMsgs, {
        onChunk: (chunk: string) => {
          streamed += chunk;
          setChatMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: 'ai', text: streamed };
            return copy;
          });
        },
      });
      if (!streamed) {
        streamed = await callAI(chatAiMsgs);
        setChatMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'ai', text: streamed };
          return copy;
        });
      }
    } catch (err: any) {
      setChatMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'ai', text: `Error: ${err.message}` };
        return copy;
      });
    }
    setChatLoading(false);
  }, [chatLoading, chatInput, chatMessages, messages, question]);

  const generateMatchSet = useCallback(async () => {
    setMatchLoading(true);
    try {
      const stepsText = messages
        .filter(m => m.role === 'ai' && m.parsed)
        .map(m => m.parsed!.explanation)
        .join('\n\n');

      const resp = await callAI([
        { role: 'system', content: 'Extract key term/definition pairs from this solution for study flashcards. Return ONLY a JSON array of objects with "term" and "definition" fields. Aim for 4-8 pairs.' },
        { role: 'user', content: `Question: ${question}\n\nSolution:\n${stepsText}` },
      ], { json: true });

      try {
        let cleaned = resp.trim();
        if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        const pairs = Array.isArray(parsed) ? parsed : (parsed.pairs || []);
        setMatchPairs(pairs.filter((p: any) => p.term && p.definition));
      } catch {
        setMatchPairs([{ term: 'Key concept', definition: 'From the solution above' }]);
      }
    } catch (err: any) {
      setMatchPairs([{ term: 'Error generating pairs', definition: err.message }]);
    }
    setMatchLoading(false);
    setShowMatchCreator(true);
    setMatchName(question.slice(0, 40).trim());
    setMatchCourseId(courseId);
  }, [messages, question, courseId]);

  const saveMatchSetFromSolver = useCallback(() => {
    const validPairs = matchPairs.filter(p => p.term.trim() && p.definition.trim());
    if (validPairs.length < 2) return;
    saveMatchSet({
      id: `match-custom-${Date.now()}`,
      name: matchName.trim() || 'Solver Set',
      subject: matchCourseId || 'custom',
      folder: matchFolder.trim() || undefined,
      pairs: validPairs,
      createdAt: new Date().toISOString(),
    });
    setShowMatchCreator(false);
  }, [matchPairs, matchName, matchCourseId, matchFolder, saveMatchSet]);

  useEffect(() => {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  const recentQuestions = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('nousai-solver-recent') || '[]').slice(0, 5) as string[]; }
    catch { return []; }
  }, []);

  const saveRecent = useCallback((q: string) => {
    try {
      const recent = JSON.parse(localStorage.getItem('nousai-solver-recent') || '[]') as string[];
      const updated = [q, ...recent.filter((r: string) => r !== q)].slice(0, 10);
      localStorage.setItem('nousai-solver-recent', JSON.stringify(updated));
    } catch { /* ignore */ }
  }, []);

  // ─── Input View ───
  if (view === 'input') {
    if (!isAIConfigured()) {
      return (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
          <HelpCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Configure an AI provider in Settings to use Solver</p>
        </div>
      );
    }

    return (
      <div style={{ padding: 16, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>Course (optional)</label>
          <select value={courseId || ''} onChange={e => setCourseId(e.target.value || null)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}>
            <option value="">No course</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div onDrop={imageOCR.handleDrop} onDragOver={imageOCR.handleDragOver}>
          <textarea value={question} onChange={e => setQuestion(e.target.value)}
            onPaste={imageOCR.handlePaste}
            placeholder={"Paste or type your question here...\nYou can also paste a screenshot or drag-drop an image!\n\ne.g., Solve x\u00b2 + 5x + 6 = 0\ne.g., What is the difference between mitosis and meiosis?"}
            rows={6}
            style={{ width: '100%', padding: 12, borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />
        </div>

        <ImageInputBar ocr={imageOCR} />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
          {['Math Problem', 'Science Question', 'Essay Prompt', 'Code Problem'].map(chip => (
            <button key={chip} className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12 }}
              onClick={() => setQuestion(prev => prev ? `[${chip}] ${prev}` : `[${chip}] `)}>
              {chip}
            </button>
          ))}
        </div>

        <button className="btn btn-primary w-full" disabled={(!question.trim() && !imageOCR.ocrText) || imageOCR.isProcessing}
          onClick={() => { saveRecent(question.trim()); startSolving(); }}
          style={{ marginTop: 8, padding: '10px 0', fontWeight: 600 }}>
          <Sparkles size={15} /> Solve Step-by-Step
        </button>

        {recentQuestions.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Recent questions</div>
            {recentQuestions.map((q, i) => (
              <button key={i} className="btn btn-secondary btn-sm w-full"
                style={{ fontSize: 11, textAlign: 'left', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                onClick={() => setQuestion(q)}>
                {q.slice(0, 80)}{q.length > 80 ? '...' : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── Solving View ───
  const lastAi = [...messages].reverse().find(m => m.role === 'ai');
  const isComplete = lastAi?.parsed?.type === 'summary';

  return (
    <div style={{ display: 'flex', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Question card */}
        <div style={{ padding: '10px 14px', margin: '8px 12px', borderRadius: 10, background: 'rgba(14,165,233,.08)', border: '1px solid rgba(14,165,233,.2)', fontSize: 13 }}>
          <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 600, marginBottom: 4 }}>QUESTION</div>
          <div dangerouslySetInnerHTML={{ __html: safeRenderMd(question) }} />
          {selectedCourse && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>Course: {selectedCourse.name}</div>}
        </div>

        {/* Messages */}
        <div ref={messagesRef} style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
          {messages.map((m, i) => {
            if (m.role === 'user') {
              return (
                <div key={i} style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 10, background: 'rgba(14,165,233,.1)', marginLeft: 40, fontSize: 13 }}>
                  <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.text) }} />
                </div>
              );
            }
            const parsed = m.parsed;
            return (
              <div key={i} style={{ margin: '10px 0', padding: '12px 14px', borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {parsed?.stepNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, color: '#0ea5e9', fontWeight: 600 }}>
                    <span style={{ background: '#0ea5e9', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {parsed.stepNumber}
                    </span>
                    {parsed.stepTitle && <span>{parsed.stepTitle}</span>}
                    {parsed.totalStepsEstimate && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>of ~{parsed.totalStepsEstimate}</span>}
                  </div>
                )}
                <div style={{ fontSize: 13, lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: safeRenderMd(parsed?.explanation || m.text) }} />
                {parsed?.graph && <GraphRenderer graph={parsed.graph} />}
                {parsed?.diagram && <DiagramRenderer diagram={parsed.diagram} />}
                {parsed?.hint && (
                  <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(234,179,8,.08)', border: '1px solid rgba(234,179,8,.15)', fontSize: 11, color: 'var(--text-muted)' }}>
                    Hint: {parsed.hint}
                  </div>
                )}
                {parsed?.options && i === messages.length - 1 && !isLoading && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {parsed.options.map((opt, oi) => (
                      <button key={oi} className="btn btn-secondary btn-sm" style={{ fontSize: 11, borderRadius: 12 }} onClick={() => sendMessage(opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              <Loader2 size={14} className="spin" /> Thinking...
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!isComplete && !isLoading && messages.length > 1 && (
          <div style={{ display: 'flex', gap: 6, padding: '8px 12px', flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => sendMessage('Next step please')}><ArrowRight size={12} /> Next Step</button>
            <button className="btn btn-secondary btn-sm" onClick={() => sendMessage('Can you explain that step in more detail?')}><Eye size={12} /> Explain More</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setTryMyself(true)}><Sparkles size={12} /> Try Myself</button>
            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--red)' }}
              onClick={() => sendMessage('I think that step might be wrong. Can you re-check and re-derive it carefully?')}>
              <AlertTriangle size={12} /> Flag Wrong
            </button>
          </div>
        )}

        {/* Try myself input */}
        {tryMyself && !isLoading && (
          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Type your attempt..."
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) sendMessage(`Here's my attempt: ${input}`); }}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" onClick={() => sendMessage(`Here's my attempt: ${input}`)}>Check</button>
          </div>
        )}

        {/* Completion actions */}
        {isComplete && (
          <div style={{ padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={generateMatchSet}><Layers size={12} /> Create Match Set</button>
            <button className="btn btn-secondary btn-sm" onClick={() => sendMessage('Generate a similar problem with different values for me to practice')}><Shuffle size={12} /> Try Similar</button>
            <button className="btn btn-secondary btn-sm" onClick={() => { setView('input'); setMessages([]); setQuestion(''); }}><RotateCcw size={12} /> New Question</button>
          </div>
        )}

        {/* General input with image upload */}
        {!tryMyself && !isComplete && (
          <div style={{ padding: '0 12px 8px' }}>
            {/* Inline image preview (avoids double-fileInput issue with ImageInputBar) */}
            {(solveImageOCR.imagePreview || solveImageOCR.isProcessing) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 4, fontSize: 11 }}>
                {solveImageOCR.imagePreview && (
                  <img src={solveImageOCR.imagePreview} alt="attached" style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                )}
                <span style={{ flex: 1, color: 'var(--text-muted)' }}>
                  {solveImageOCR.isProcessing
                    ? `Extracting text… ${solveImageOCR.ocrProgress}%`
                    : solveImageOCR.ocrText
                    ? `Image attached (${solveImageOCR.ocrText.length} chars extracted)`
                    : 'Image attached'}
                </span>
                {!solveImageOCR.isProcessing && (
                  <button onClick={solveImageOCR.clearImage} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
            {/* Hidden file input for mid-solve uploads */}
            <input
              ref={solveImageOCR.fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) solveImageOCR.handleFile(e.target.files[0]); e.target.value = ''; }}
            />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onDrop={solveImageOCR.handleDrop} onDragOver={solveImageOCR.handleDragOver}>
              {/* Upload diagram button */}
              <button
                onClick={solveImageOCR.triggerFileInput}
                disabled={isLoading}
                title="Upload diagram or image"
                style={{ padding: '8px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: solveImageOCR.imagePreview ? '#0ea5e9' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
              >
                <ImageIcon size={14} />
              </button>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={solveImageOCR.imagePreview ? 'Add a message about this image… (or just send)' : 'Type a message...'}
                disabled={isLoading}
                onPaste={solveImageOCR.handlePaste}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (input.trim() || solveImageOCR.imageBase64)) {
                    sendSolveMessage();
                  }
                }}
                style={{ flex: 1, padding: '8px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }}
              />
              <button
                className="btn btn-primary btn-sm"
                disabled={isLoading || (!input.trim() && !solveImageOCR.imageBase64) || solveImageOCR.isProcessing}
                onClick={sendSolveMessage}
              >
                <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat sidebar toggle */}
      <button onClick={() => setShowChat(!showChat)}
        style={{ position: 'absolute', right: showChat ? 260 : 0, top: 60, background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '8px 0 0 8px', padding: '8px 6px', cursor: 'pointer', zIndex: 10, transition: 'right 0.2s' }}>
        <MessageCircle size={14} />
      </button>

      {/* Side chat */}
      {showChat && (
        <div style={{ width: 260, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
          <div style={{ padding: '8px 10px', fontSize: 12, fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Ask about this step</div>
          <div ref={chatRef} style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {chatMessages.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>Ask follow-up questions about any step here.</div>}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ margin: '6px 0', padding: '6px 8px', borderRadius: 8, background: m.role === 'user' ? 'rgba(14,165,233,.1)' : 'var(--surface)', fontSize: 12, lineHeight: 1.5 }}>
                <div dangerouslySetInnerHTML={{ __html: safeRenderMd(m.text) }} />
              </div>
            ))}
            {chatLoading && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 4 }}><Loader2 size={12} className="spin" /> Thinking...</div>}
          </div>
          <div style={{ padding: 6, display: 'flex', gap: 4, borderTop: '1px solid var(--border)' }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask a question..." disabled={chatLoading}
              onKeyDown={e => { if (e.key === 'Enter') sendChatMessage(); }}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 11 }} />
            <button className="btn btn-primary btn-sm" disabled={chatLoading || !chatInput.trim()} onClick={sendChatMessage} style={{ padding: '4px 8px' }}>
              <ArrowRight size={10} />
            </button>
          </div>
        </div>
      )}

      {/* Match set creator overlay */}
      {showMatchCreator && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: 20, width: '90%', maxWidth: 480, maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Create Match Set</div>
            {matchLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}><Loader2 size={20} className="spin" /> Generating pairs...</div>
            ) : (
              <>
                <input value={matchName} onChange={e => setMatchName(e.target.value)} placeholder="Set name"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, marginBottom: 8, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select value={matchCourseId || ''} onChange={e => setMatchCourseId(e.target.value || null)}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }}>
                    <option value="">No course (custom)</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input value={matchFolder} onChange={e => setMatchFolder(e.target.value)} placeholder="Folder (optional)"
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                </div>
                {matchPairs.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input value={p.term} onChange={e => { const c = [...matchPairs]; c[i] = { ...c[i], term: e.target.value }; setMatchPairs(c); }}
                      placeholder="Term" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                    <input value={p.definition} onChange={e => { const c = [...matchPairs]; c[i] = { ...c[i], definition: e.target.value }; setMatchPairs(c); }}
                      placeholder="Definition" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
                    <button className="btn-icon" onClick={() => setMatchPairs(prev => prev.filter((_, j) => j !== i))} style={{ width: 24, height: 24, color: 'var(--red)' }}>
                      <XCircle size={14} />
                    </button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm w-full" style={{ marginBottom: 12 }} onClick={() => setMatchPairs(prev => [...prev, { term: '', definition: '' }])}>
                  <Plus size={12} /> Add Pair
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowMatchCreator(false)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} disabled={matchPairs.filter(p => p.term.trim() && p.definition.trim()).length < 2} onClick={saveMatchSetFromSolver}>
                    <CheckCircle size={14} /> Save ({matchPairs.filter(p => p.term.trim() && p.definition.trim()).length} pairs)
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
