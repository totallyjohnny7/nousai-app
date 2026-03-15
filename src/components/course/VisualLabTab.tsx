import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, Edit3, Trash2, RefreshCw, Maximize, Code,
  PanelRight, PanelBottom, EyeOff, RotateCcw, CheckCircle2, Sparkles,
  Microscope, X,
} from 'lucide-react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import type { Course, NousAIData } from '../../types';
import { callAI, isAIConfigured } from '../../utils/ai';
import { useStore } from '../../store';
import { sanitizeHtml } from '../../utils/sanitize';
import { generateId, renderSimpleMarkdown } from './courseHelpers';

const RichTextEditor = lazyWithRetry(() => import('../RichTextEditor'));

interface GeneratedLab {
  id: string;
  title: string;
  question: string;
  html: string;
  createdAt: string;
}

interface LectureNote {
  id: string;
  title: string;
  content: string;
  topicIds?: string[];
  createdAt: string;
  updatedAt: string;
  linkedLabId?: string;
}

export default function VisualLabTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const navigate = useNavigate();
  const { data, setData, updatePluginData, setPageContext } = useStore();
  const [question, setQuestion] = useState('');
  const [generating, setGenerating] = useState(false);
  const [labs, setLabs] = useState<GeneratedLab[]>(() => {
    // Merge pluginData (cloud) + localStorage (local) to avoid data loss
    const fromStore = (data?.pluginData as Record<string, unknown>)?.[`visualLabs_${course.id}`] as GeneratedLab[] | undefined;
    let fromLocal: GeneratedLab[] = [];
    try {
      const saved = localStorage.getItem(`nousai-labs-${course.id}`);
      fromLocal = saved ? JSON.parse(saved) : [];
    } catch { /* ignore */ }
    if (fromStore && fromStore.length > 0 && fromLocal.length > 0) {
      const ids = new Set(fromStore.map(l => l.id));
      return [...fromStore, ...fromLocal.filter(l => !ids.has(l.id))];
    }
    return (fromStore && fromStore.length > 0) ? fromStore : fromLocal;
  });
  const [activeLab, setActiveLab] = useState<GeneratedLab | null>(null);
  const [error, setError] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hasAI = isAIConfigured();
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showSource, setShowSource] = useState(false);

  // Reset loading state when switching labs
  useEffect(() => { setIframeLoaded(false); setShowSource(false); }, [activeLab?.id]);

  // ── Page context publisher ──
  useEffect(() => {
    setPageContext({
      page: 'Course — Lab',
      summary: activeLab
        ? `${course.name} — Lab: ${activeLab.title ?? 'Active simulation'}`
        : `${course.name} — Visual Lab`,
      activeItem: activeLab?.question ?? undefined,
    })
    return () => setPageContext(null)
  }, [course.name, activeLab])

  // Persist to localStorage + pluginData (skip initial mount to avoid render loop)
  const labsMountedRef = useRef(false);
  useEffect(() => {
    try { localStorage.setItem(`nousai-labs-${course.id}`, JSON.stringify(labs)); } catch (e) { console.warn('[Labs] localStorage save failed:', e); }
    if (!labsMountedRef.current) { labsMountedRef.current = true; return; }
    // Sync to pluginData for cross-device sync (only after user actions, not on mount)
    if (data) {
      updatePluginData({ [`visualLabs_${course.id}`]: labs });
    }
  }, [labs, course.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const presets = useMemo(() => {
    const courseKey = (course.shortName || course.name || '').toUpperCase();
    if (courseKey.includes('PHYS')) return [
      { q: 'Simulate a series and parallel resistor circuit with adjustable resistances showing current and voltage in each branch', label: '⚡ Series & Parallel' },
      { q: 'Visualize the electric field and equipotential lines between two point charges with adjustable charge values and positions', label: '🔋 Electric Field' },
      { q: 'Simulate a charged particle moving in a uniform magnetic field showing circular motion with adjustable velocity and field strength', label: '🧲 Lorentz Force' },
      { q: 'Demonstrate electromagnetic induction: a bar magnet moving through a coil showing induced EMF and current with Lenz\'s law', label: '⚡ Faraday\'s Law' },
      { q: 'Simulate an RC circuit charging and discharging with adjustable R and C, showing voltage and current vs time graphs', label: '📊 RC Circuit' },
      { q: 'Visualize magnetic field lines around a current-carrying wire and between two parallel wires with adjustable current', label: '🌀 Wire B-Field' },
      { q: 'Simulate a simple AC generator (rotating coil in magnetic field) showing sinusoidal EMF output with adjustable rotation speed', label: '🔄 AC Generator' },
      { q: 'Demonstrate Kirchhoff\'s voltage and current laws with a multi-loop circuit showing voltage drops and current at junctions', label: '🔌 Kirchhoff' },
    ];
    if (courseKey.includes('BIOL')) return [
      { q: 'Visualize the cell membrane with lipid bilayer and protein channels', label: '🧬 Cell Membrane' },
      { q: 'Show DNA replication with leading and lagging strands', label: '🧬 DNA Replication' },
      { q: 'Simulate mitosis stages with interactive cell division animation', label: '🔬 Mitosis' },
      { q: 'Demonstrate natural selection with a population of organisms over generations', label: '🌿 Natural Selection' },
    ];
    if (courseKey.includes('CHEM')) return [
      { q: 'Simulate an atom with electron orbitals and energy levels', label: '⚛️ Atomic Orbitals' },
      { q: 'Visualize a chemical equilibrium reaction with adjustable concentrations and Le Chatelier\'s principle', label: '⚗️ Equilibrium' },
      { q: 'Demonstrate ideal gas law PV=nRT with adjustable pressure, volume, and temperature', label: '💨 Ideal Gas' },
      { q: 'Show molecular bonding — ionic vs covalent bonds with electron sharing visualization', label: '🔗 Bonding' },
    ];
    // Generic fallback
    return [
      { q: 'Simulate projectile motion with adjustable angle and velocity', label: '🎯 Projectile Motion' },
      { q: 'Visualize a simple pendulum with adjustable length, gravity, and damping', label: '⏱️ Pendulum' },
      { q: 'Demonstrate wave interference with two wave sources', label: '🌊 Wave Interference' },
      { q: 'Simulate elastic and inelastic collisions between two objects', label: '💥 Collisions' },
    ];
  }, [course.shortName, course.name]);

  async function generateLab(overrideQuestion?: string) {
    const q = overrideQuestion || question;
    if (!q.trim()) return;
    if (!hasAI) { setError('Configure an AI provider in Settings to generate labs.'); return; }
    setError('');
    setGenerating(true);
    try {
      const prompt = `You are an interactive educational simulation generator. Create a SINGLE self-contained HTML page that demonstrates: "${q.trim()}"

Course context: ${course.shortName || course.name}

Requirements:
1. Use a <canvas> element (600x400) for visualization with animation loop
2. Include interactive controls (sliders, buttons) below the canvas
3. Use modern CSS with dark theme (background: #1a1a2e, text: #e0e0e0, accent: ${accentColor})
4. All JavaScript must be inline (no external dependencies)
5. Include a title and brief explanation at the top
6. Make the simulation physically accurate where applicable — use correct formulas and constants
7. Add play/pause and reset buttons
8. Display relevant values (speed, angle, energy, etc.) in real-time
9. The page must be fully self-contained in a single HTML string
10. Use requestAnimationFrame for smooth animation
11. Make controls responsive (use flexbox)
12. CRITICAL: Initialize ALL variables to match the problem's given values exactly. Sliders must default to the values stated in the problem. Display the correct answer at the initial state (angle=0, t=0) before the user interacts.
13. CRITICAL: When the problem asks for a specific calculation, the displayed answer must match the exact correct answer at the default slider positions. Double-check all formulas.
14. CRITICAL: Simulations MUST start PAUSED (isRunning = false). Include a Play/Pause button so the user can start the animation manually. The initial frame must render the correct answer at rest before any animation occurs.
15. Wrap your main JavaScript in try-catch to prevent blank screens from runtime errors
16. Add a window.onerror handler that displays errors visually on the page: window.onerror=function(m){document.body.innerHTML='<div style="padding:40px;color:#f87171;font-size:16px;font-family:monospace"><h2>⚠️ Simulation Error</h2><pre>'+m+'</pre></div>'}
17. Use CSS Flexbox for responsive layout that works at any iframe width
18. Keep total HTML under 12000 characters — write concise, efficient code
19. Draw the initial state on canvas immediately on page load (don't wait for user interaction)
20. Always include a visible <h2> title and <p> description at the top explaining the simulation

Return ONLY the complete HTML code, nothing else. No markdown code fences. Start with <!DOCTYPE html> and end with </html>.`;

      const html = await callAI([
        { role: 'system', content: 'You generate interactive HTML5/Canvas simulations. Return ONLY valid HTML code. No explanations, no markdown.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, maxTokens: 16384 }, 'analysis');

      // Clean up response — strip markdown fences if AI included them
      let cleaned = html.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
      }

      // Validate minimum viable HTML
      if (!cleaned.includes('<') || cleaned.length < 200) {
        throw new Error('AI returned invalid content. Try a simpler simulation description.');
      }

      // Auto-wrap bare fragments (no <!DOCTYPE or <html>) in a proper HTML shell
      if (!cleaned.includes('<!DOCTYPE') && !cleaned.includes('<html')) {
        cleaned = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;margin:16px;}
canvas{border:1px solid #333;border-radius:8px;display:block;margin:0 auto 16px;}
button{background:#6366f1;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;margin:4px;}
input[type=range]{width:200px;}</style>
</head><body>${cleaned}</body></html>`;
      }

      // Detect truncated HTML (missing closing tags = AI ran out of tokens)
      const openTags = (cleaned.match(/<(script|style|html|body|head)\b/gi) || []).length;
      const closeTags = (cleaned.match(/<\/(script|style|html|body|head)>/gi) || []).length;
      if (openTags > closeTags + 2) {
        throw new Error('Simulation was too complex and got cut off. Try a simpler description or break it into parts.');
      }

      const lab: GeneratedLab = {
        id: Date.now().toString(36),
        title: q.trim().slice(0, 60),
        question: q.trim(),
        html: cleaned,
        createdAt: new Date().toISOString(),
      };

      setLabs(prev => [lab, ...prev]);
      setActiveLab(lab);
      setQuestion('');
    } catch (e: any) {
      setError(e?.message || 'Failed to generate lab. Check your AI settings.');
    } finally {
      setGenerating(false);
    }
  }

  function deleteLab(id: string) {
    setLabs(prev => prev.filter(l => l.id !== id));
    if (activeLab?.id === id) setActiveLab(null);
  }

  function updateLab(id: string, patch: Partial<GeneratedLab>) {
    setLabs(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
    if (activeLab?.id === id) setActiveLab(prev => prev ? { ...prev, ...patch } : prev);
  }

  // ── Lab workspace state ──
  const [sidePanel, setSidePanel] = useState<'notes' | 'ai'>('notes');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  // Notes state
  const lectureStorageKey = `nousai-lectures-${course.id}`;
  const [labNotes, setLabNotes] = useState<LectureNote[]>(() => {
    try { const s = localStorage.getItem(lectureStorageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const labNoteContentRef = useRef('');
  const labNoteTitleRef = useRef('');
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // AI chat state
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const aiChatContainerRef = useRef<HTMLDivElement>(null);
  // Draggable resizer state
  const [sidePanelWidth, setSidePanelWidth] = useState(() => {
    const saved = localStorage.getItem(`nousai-lab-panel-width`);
    return saved ? parseInt(saved) : 380;
  });
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Layout mode: side panel right, below, or hidden
  const [labLayout, setLabLayout] = useState<'side' | 'bottom' | 'hidden'>(() => {
    return (localStorage.getItem('nousai-lab-layout') as 'side' | 'bottom' | 'hidden') || 'side';
  });
  useEffect(() => { localStorage.setItem('nousai-lab-layout', labLayout); }, [labLayout]);

  // Persist lecture notes — only save when lab notes actually change (not on mount)
  const labNotesDirtyRef = useRef(false);
  useEffect(() => {
    if (!labNotesDirtyRef.current) return;
    try { localStorage.setItem(lectureStorageKey, JSON.stringify(labNotes)); } catch (e) { console.warn('[LabNotes] localStorage save failed:', e); }
  }, [labNotes, lectureStorageKey]);

  // Get or create linked note for active lab
  const activeLabNote = useMemo(() => {
    if (!activeLab) return null;
    return labNotes.find(n => n.linkedLabId === activeLab.id) || null;
  }, [activeLab, labNotes]);

  function saveLabNote() {
    if (!activeLab) return;
    const now = new Date().toISOString();
    const content = labNoteContentRef.current;
    const title = labNoteTitleRef.current || `Notes: ${activeLab.title}`;
    labNotesDirtyRef.current = true;
    if (activeLabNote) {
      setLabNotes(prev => prev.map(n => n.id === activeLabNote.id ? { ...n, title, content, updatedAt: now } : n));
    } else if (content.trim()) {
      const newNote: LectureNote = { id: generateId(), title, content, linkedLabId: activeLab.id, createdAt: now, updatedAt: now };
      setLabNotes(prev => [...prev, newNote]);
    }
  }

  function triggerAutosave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => saveLabNote(), 1500);
  }

  async function sendAiMessage() {
    if (!aiInput.trim() || !activeLab || aiLoading) return;
    const userMsg = aiInput.trim();
    setAiInput('');
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiLoading(true);
    try {
      const context = `The user is working with an interactive Visual Lab simulation.\nLab title: ${activeLab.title}\nLab prompt: ${activeLab.question}\n\nAnswer the user's question about this lab. Be concise and educational.`;
      const response = await callAI([
        { role: 'system', content: context },
        ...aiMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.text })),
        { role: 'user', content: userMsg },
      ], { temperature: 0.4, maxTokens: 1024 }, 'analysis');
      setAiMessages(prev => [...prev, { role: 'assistant', text: response.trim() }]);
    } catch (e: any) {
      setAiMessages(prev => [...prev, { role: 'assistant', text: `Error: ${e?.message || 'Failed to get response'}` }]);
    }
    setAiLoading(false);
  }

  // Scroll AI chat to bottom (within container only, no page scroll)
  useEffect(() => {
    if (aiChatContainerRef.current) {
      aiChatContainerRef.current.scrollTop = aiChatContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // Drag resizer handlers
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidePanelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = startX - ev.clientX;
      const newWidth = Math.max(250, Math.min(700, startWidth + delta));
      setSidePanelWidth(newWidth);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidePanelWidth(w => { localStorage.setItem('nousai-lab-panel-width', String(w)); return w; });
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidePanelWidth]);

  // iframeRef kept for potential future use (fullscreen, etc.)

  // ═══════════════════════════════════════════════════════
  // Active lab workspace — lab + notes + AI side panel
  // ═══════════════════════════════════════════════════════
  if (activeLab) {
    const btnBase: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 11,
      color: 'var(--text-secondary)', fontFamily: 'inherit', fontWeight: 600,
    };
    return (
      <div>
        {/* ── Header: Back + Title (editable) + Actions ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <button onClick={() => { saveLabNote(); setActiveLab(null); setAiMessages([]); }} style={btnBase}>
            <ArrowLeft size={13} /> Back
          </button>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)}
              onBlur={() => { if (titleDraft.trim()) updateLab(activeLab.id, { title: titleDraft.trim() }); setEditingTitle(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { if (titleDraft.trim()) updateLab(activeLab.id, { title: titleDraft.trim() }); setEditingTitle(false); } if (e.key === 'Escape') setEditingTitle(false); }}
              style={{ flex: 1, fontSize: 14, fontWeight: 700, padding: '4px 8px', background: 'var(--bg-card)', border: `1px solid ${accentColor}`, borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'inherit' }}
            />
          ) : (
            <h3
              onClick={() => { setTitleDraft(activeLab.title); setEditingTitle(true); }}
              style={{ fontSize: 14, fontWeight: 700, flex: 1, margin: 0, cursor: 'pointer', padding: '4px 0' }}
              title="Click to rename"
            >
              {activeLab.title} <Edit3 size={11} style={{ opacity: 0.4, verticalAlign: 'middle' }} />
            </h3>
          )}
          <button onClick={() => { setQuestion(activeLab.question); setActiveLab(null); }} style={btnBase} title="Regenerate with same prompt">
            <RefreshCw size={11} /> Regenerate
          </button>
          <button onClick={() => deleteLab(activeLab.id)} style={{ ...btnBase, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}>
            <Trash2 size={11} /> Delete
          </button>
          {document.fullscreenEnabled && (
            <button onClick={() => { iframeRef.current?.requestFullscreen?.(); }} style={btnBase} title="Fullscreen">
              <Maximize size={11} /> Fullscreen
            </button>
          )}
          <button onClick={() => setShowSource(s => !s)} style={btnBase} title="Toggle HTML source view">
            <Code size={11} /> {showSource ? 'Hide Source' : 'View Source'}
          </button>
          {/* Layout toggle */}
          <div style={{ display: 'flex', gap: 1, marginLeft: 'auto', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
            {([
              { mode: 'side' as const, icon: PanelRight, title: 'Side panel' },
              { mode: 'bottom' as const, icon: PanelBottom, title: 'Panel below' },
              { mode: 'hidden' as const, icon: EyeOff, title: 'Hide panel' },
            ]).map(opt => (
              <button
                key={opt.mode}
                onClick={() => setLabLayout(opt.mode)}
                title={opt.title}
                style={{
                  display: 'flex', alignItems: 'center', padding: '4px 8px', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)', fontFamily: 'inherit',
                  background: labLayout === opt.mode ? accentColor : 'transparent',
                  color: labLayout === opt.mode ? '#fff' : 'var(--text-dim)',
                }}
              >
                <opt.icon size={13} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Shared elements ── */}
        {(() => {
          const labIframe = (
            <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', background: '#1a1a2e', position: 'relative' }}>
              {!iframeLoaded && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5, background: '#1a1a2e' }}>
                  <RotateCcw size={24} className="spin" style={{ color: accentColor, marginBottom: 8 }} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading simulation...</span>
                </div>
              )}
              <iframe
                ref={iframeRef}
                srcDoc={activeLab.html}
                sandbox="allow-scripts"
                onLoad={() => setIframeLoaded(true)}
                style={{ width: '100%', height: '100%', minHeight: 620, border: 'none', display: 'block' }}
                title={activeLab.title}
              />
              {showSource && (
                <pre style={{ maxHeight: 300, overflow: 'auto', fontSize: 10, padding: 12, background: '#0f172a', color: '#94a3b8', whiteSpace: 'pre-wrap', margin: 0, borderTop: '1px solid var(--border)' }}>
                  {activeLab.html}
                </pre>
              )}
            </div>
          );

          const panelContent = (
            <div style={{ display: 'flex', flexDirection: 'column', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-card)', ...(labLayout === 'bottom' ? { height: 340 } : {}) }}>
              {/* Tab bar */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                {(['notes', 'ai'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSidePanel(tab)}
                    style={{
                      flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
                      background: sidePanel === tab ? 'var(--bg-secondary)' : 'transparent',
                      color: sidePanel === tab ? accentColor : 'var(--text-dim)',
                      borderBottom: sidePanel === tab ? `2px solid ${accentColor}` : '2px solid transparent',
                    }}
                  >
                    {tab === 'notes' ? '📝 Notes' : '🤖 AI Chat'}
                  </button>
                ))}
              </div>

              {/* ── Notes panel ── */}
              {sidePanel === 'notes' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>Loading editor...</div>}>
                    <RichTextEditor
                      key={activeLab.id}
                      initialContent={activeLabNote?.content || ''}
                      onContentChange={(html) => { labNoteContentRef.current = html; triggerAutosave(); }}
                      onSave={() => saveLabNote()}
                      placeholder="Take notes while exploring the lab..."
                      minHeight={labLayout === 'bottom' ? 240 : 540}
                      autoFocus={false}
                    />
                  </Suspense>
                  <div style={{ padding: '4px 10px', fontSize: 10, color: 'var(--text-dim)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={10} /> Auto-saves as you type
                  </div>
                </div>
              )}

              {/* ── AI Chat panel ── */}
              {sidePanel === 'ai' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div ref={aiChatContainerRef} style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {aiMessages.length === 0 && (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 12 }}>
                        Ask anything about this lab — concepts, formulas, how it works, what to observe...
                      </div>
                    )}
                    {aiMessages.map((m, i) => (
                      <div key={i} style={{
                        padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5, maxWidth: '90%',
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? accentColor : 'var(--bg-secondary)',
                        color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                      }}>
                        {m.role === 'user' ? m.text : (
                          <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderSimpleMarkdown(m.text)) }} />
                        )}
                      </div>
                    ))}
                    {aiLoading && (
                      <div style={{ padding: '8px 12px', borderRadius: 10, fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-dim)', alignSelf: 'flex-start' }}>
                        Thinking...
                      </div>
                    )}
                    <div ref={aiChatEndRef} />
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: 8, borderTop: '1px solid var(--border)' }}>
                    <input
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
                      placeholder="Ask about this lab..."
                      style={{
                        flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontFamily: 'inherit',
                      }}
                    />
                    <button
                      onClick={sendAiMessage}
                      disabled={aiLoading || !aiInput.trim()}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        background: accentColor, color: '#fff', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
                        opacity: aiLoading || !aiInput.trim() ? 0.5 : 1,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
            </div>
          );

          if (labLayout === 'hidden') return labIframe;
          if (labLayout === 'bottom') return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {labIframe}
              {panelContent}
            </div>
          );
          // 'side' — default grid layout
          return (
            <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: `1fr 6px ${sidePanelWidth}px`, minHeight: 620 }}>
              {labIframe}
              {/* DRAG HANDLE */}
              <div
                onMouseDown={startDrag}
                style={{
                  cursor: 'col-resize', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s', borderRadius: 3,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.3)')}
                onMouseLeave={e => { if (!isDraggingRef.current) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ width: 3, height: 40, borderRadius: 2, background: 'var(--border)' }} />
              </div>
              {panelContent}
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
        <Microscope size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Visual Lab
      </h3>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
        Generate interactive simulations and visualizations from any question or problem.
      </p>

      {/* Question input */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
          <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 4, color: accentColor }} />
          Describe a simulation to generate
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !generating && generateLab()}
            placeholder="e.g. Simulate projectile motion with adjustable angle..."
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
              outline: 'none',
            }}
          />
          <button
            onClick={() => generateLab()}
            disabled={generating || !question.trim()}
            style={{
              padding: '10px 18px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: generating ? 'var(--bg-card)' : accentColor,
              color: generating ? 'var(--text-muted)' : '#fff',
              fontSize: 13, fontWeight: 700, cursor: generating ? 'wait' : 'pointer',
              fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
              opacity: !question.trim() ? 0.5 : 1,
            }}
          >
            {generating ? <><RotateCcw size={14} className="spin" /> Generating...</> : <><Sparkles size={14} /> Generate</>}
          </button>
        </div>
        {error && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444', padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{error}
          </div>
        )}
        {!hasAI && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            AI not configured. <button onClick={() => navigate('/settings')} style={{ color: accentColor, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', fontSize: 12 }}>Go to Settings</button> to add an API key, or use the presets below.
          </div>
        )}
      </div>

      {/* Quick presets */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Quick Start</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => { setQuestion(p.q); if (hasAI) generateLab(p.q); }}
              style={{
                padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                color: 'var(--text-secondary)', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = accentColor)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Built-in simulations (always available, no AI needed) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Built-in Simulations</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { label: 'Projectile Motion', desc: 'Launch projectiles with angle & velocity controls', tool: 'physics' },
            { label: 'Pendulum', desc: 'Simple pendulum with length & gravity', tool: 'physics' },
            { label: 'Wave', desc: 'Transverse wave with amplitude & frequency', tool: 'physics' },
            { label: 'Collision', desc: 'Elastic & inelastic collisions', tool: 'physics' },
            { label: 'Electric Field', desc: 'Field lines between charges', tool: 'physics' },
            { label: 'Optics', desc: 'Ray tracing through a convex lens', tool: 'physics' },
          ].map(sim => (
            <button
              key={sim.label}
              onClick={() => navigate(`/ai?tool=${sim.tool}`)}
              style={{
                padding: '14px 12px', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: accentColor }}>{sim.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3 }}>{sim.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Saved / generated labs */}
      {labs.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>Your Generated Labs ({labs.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {labs.map(lab => (
              <div
                key={lab.id}
                style={{
                  padding: 14, borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: 'pointer', position: 'relative',
                }}
                onClick={() => setActiveLab(lab)}
              >
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: accentColor, paddingRight: 24 }}>
                  {lab.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: 6 }}>
                  {lab.question.slice(0, 80)}{lab.question.length > 80 ? '...' : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {new Date(lab.createdAt).toLocaleDateString()}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteLab(lab.id); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, padding: 4,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-dim)', opacity: 0.5,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
