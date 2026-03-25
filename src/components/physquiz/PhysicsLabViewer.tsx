import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from 'react';
import { X, Plus, Beaker } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { formatDate } from '../course/courseHelpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneratedLab {
  id: string;
  title: string;
  question: string;
  html: string;
  createdAt: string;
}

interface CourseLabGroup {
  courseId: string;
  courseName: string;
  labs: GeneratedLab[];
}

interface Props {
  courseId: string;
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  'You generate interactive HTML5/Canvas simulations. Return ONLY valid HTML code. No explanations, no markdown.';

function buildLabPrompt(question: string, accentColor = '#F5A623'): string {
  return `You are an interactive educational simulation generator. Create a SINGLE self-contained HTML page that demonstrates: "${question.trim()}"

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
12. CRITICAL: Initialize ALL variables to match the problem's given values exactly. Sliders must default to the values stated in the problem.
13. CRITICAL: When the problem asks for a specific calculation, the displayed answer must match the exact correct answer at the default slider positions. Double-check all formulas.
14. CRITICAL: Simulations MUST start PAUSED (isRunning = false). Include a Play/Pause button so the user can start the animation manually. The initial frame must render the correct answer at rest before any animation occurs.
15. Wrap your main JavaScript in try-catch to prevent blank screens from runtime errors
16. Add a window.onerror handler that displays errors visually on the page: window.onerror=function(m){document.body.innerHTML='<div style="padding:40px;color:#f87171;font-size:16px;font-family:monospace"><h2>⚠️ Simulation Error</h2><pre>'+m+'</pre></div>'}
17. Use CSS Flexbox for responsive layout that works at any iframe width
18. Keep total HTML under 12000 characters — write concise, efficient code
19. Draw the initial state on canvas immediately on page load (don't wait for user interaction)
20. Always include a visible <h2> title and <p> description at the top explaining the simulation

Return ONLY the complete HTML code, nothing else. No markdown code fences. Start with <!DOCTYPE html> and end with </html>.`;
}

function cleanHtml(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '');
  }
  if (!cleaned.includes('<!DOCTYPE') && !cleaned.includes('<html')) {
    cleaned = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>body{background:#1a1a2e;color:#e0e0e0;font-family:system-ui,sans-serif;margin:16px;}
canvas{border:1px solid #333;border-radius:8px;display:block;margin:0 auto 16px;}
button{background:#6366f1;color:#fff;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;margin:4px;}
input[type=range]{width:200px;}</style>
</head><body>${cleaned}</body></html>`;
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LabCard({
  lab,
  courseName,
  onRun,
}: {
  lab: GeneratedLab;
  courseName: string;
  onRun: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '12px 14px',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: 'var(--text-primary)',
          marginBottom: 4,
          lineHeight: 1.3,
        }}
      >
        {lab.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: 10,
          display: 'flex',
          gap: 10,
        }}
      >
        <span>{courseName}</span>
        <span>·</span>
        <span>{formatDate(lab.createdAt)}</span>
      </div>
      <button
        onClick={onRun}
        style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '5px 14px',
          fontSize: 13,
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Run
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PhysicsLabViewer({ courseId, open, onClose }: Props) {
  const { data, updatePluginData } = useStore();

  // Active tab: 'library' | 'create', plus optional 'view' sub-state
  const [tab, setTab] = useState<'library' | 'create'>('library');
  const [viewLab, setViewLab] = useState<GeneratedLab | null>(null);

  // Library state
  const [search, setSearch] = useState('');

  // Create state
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [newLab, setNewLab] = useState<GeneratedLab | null>(null);
  const [saveCourseId, setSaveCourseId] = useState(courseId);

  const hasAI = isAIConfigured();

  // ── Courses list from store ──
  const courses = useMemo(() => {
    const list = data?.pluginData?.coachData?.courses ?? [];
    return list;
  }, [data?.pluginData?.coachData?.courses]);

  // ── Gather all labs from pluginData + localStorage ──
  const labGroups = useMemo<CourseLabGroup[]>(() => {
    const pluginData = (data?.pluginData ?? {}) as Record<string, unknown>;

    // Collect course info for name lookup
    const courseMap = new Map<string, string>();
    for (const c of courses) {
      courseMap.set(c.id, c.shortName || c.name || c.id);
    }

    // Also collect ids from pluginData keys that may not be in courses list
    const courseIds = new Set<string>();
    for (const key of Object.keys(pluginData)) {
      if (key.startsWith('visualLabs_')) {
        courseIds.add(key.slice('visualLabs_'.length));
      }
    }
    for (const c of courses) courseIds.add(c.id);

    const groups: CourseLabGroup[] = [];

    // Priority: current courseId first
    const ordered = [courseId, ...[...courseIds].filter(id => id !== courseId)];

    for (const cid of ordered) {
      const fromStore = (pluginData[`visualLabs_${cid}`] as GeneratedLab[] | undefined) ?? [];
      let fromLocal: GeneratedLab[] = [];
      try {
        const saved = localStorage.getItem(`nousai-labs-${cid}`);
        fromLocal = saved ? (JSON.parse(saved) as GeneratedLab[]) : [];
      } catch {
        /* ignore */
      }

      let merged: GeneratedLab[];
      if (fromStore.length > 0 && fromLocal.length > 0) {
        const ids = new Set(fromStore.map(l => l.id));
        merged = [...fromStore, ...fromLocal.filter(l => !ids.has(l.id))];
      } else {
        merged = fromStore.length > 0 ? fromStore : fromLocal;
      }

      if (merged.length === 0) continue;

      groups.push({
        courseId: cid,
        courseName: courseMap.get(cid) ?? cid,
        labs: merged,
      });
    }

    return groups;
  }, [data?.pluginData, courses, courseId]);

  // ── Filtered labs ──
  const filteredGroups = useMemo<CourseLabGroup[]>(() => {
    if (!search.trim()) return labGroups;
    const q = search.toLowerCase();
    return labGroups
      .map(g => ({
        ...g,
        labs: g.labs.filter(
          l =>
            l.title.toLowerCase().includes(q) ||
            l.question.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.labs.length > 0);
  }, [labGroups, search]);

  const totalLabCount = labGroups.reduce((n, g) => n + g.labs.length, 0);

  // ── Reset when closed ──
  useEffect(() => {
    if (!open) {
      setViewLab(null);
      setGenError('');
    }
  }, [open]);

  // ── Generate lab ──
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    if (!hasAI) {
      setGenError('Configure an AI provider in Settings to generate labs.');
      return;
    }
    setGenError('');
    setPreviewHtml(null);
    setNewLab(null);
    setGenerating(true);
    try {
      const raw = await callAI(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildLabPrompt(prompt) },
        ],
        { temperature: 0.3, maxTokens: 16384 },
        'physics'
      );

      const cleaned = cleanHtml(raw);

      if (!cleaned.includes('<') || cleaned.length < 200) {
        throw new Error('AI returned invalid content. Try a simpler description.');
      }

      const openTags = (cleaned.match(/<(script|style|html|body|head)\b/gi) ?? []).length;
      const closeTags = (cleaned.match(/<\/(script|style|html|body|head)>/gi) ?? []).length;
      if (openTags > closeTags + 2) {
        throw new Error('Simulation was too complex and got cut off. Try a simpler description.');
      }

      const lab: GeneratedLab = {
        id: Date.now().toString(36),
        title: prompt.trim().slice(0, 60),
        question: prompt.trim(),
        html: cleaned,
        createdAt: new Date().toISOString(),
      };
      setPreviewHtml(cleaned);
      setNewLab(lab);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to generate lab. Check your AI settings.';
      setGenError(msg);
    } finally {
      setGenerating(false);
    }
  }, [prompt, generating, hasAI]);

  // ── Save to course ──
  const handleSave = useCallback(() => {
    if (!newLab) return;
    const targetId = saveCourseId || courseId;
    const key = `visualLabs_${targetId}`;
    const existing =
      ((data?.pluginData ?? {}) as Record<string, unknown>)[key] as GeneratedLab[] | undefined;
    const updated = [newLab, ...(existing ?? [])];

    // localStorage
    try {
      localStorage.setItem(`nousai-labs-${targetId}`, JSON.stringify(updated));
    } catch {
      /* ignore */
    }

    updatePluginData({ [key]: updated } as Parameters<typeof updatePluginData>[0]);
    setNewLab(null);
    setPreviewHtml(null);
    setPrompt('');
    setTab('library');
  }, [newLab, saveCourseId, courseId, data?.pluginData, updatePluginData]);

  // ── Panel style ──
  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 0,
    width: 420,
    height: '100vh',
    background: 'var(--bg-secondary)',
    borderLeft: '1px solid var(--border-color)',
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 200ms ease-in-out',
    zIndex: 190,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  // ── View mode (run a lab) ──
  if (viewLab && open) {
    return (
      <div style={panelStyle}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setViewLab(null)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >
            ← Back to Library
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Close panel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Lab title */}
        <div
          style={{
            padding: '10px 16px 8px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
          }}
        >
          {viewLab.title}
        </div>

        {/* iframe */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <iframe
            srcDoc={viewLab.html}
            sandbox="allow-scripts"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
            }}
            title={viewLab.title}
          />
        </div>
      </div>
    );
  }

  // ── Normal panel ──
  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Beaker size={18} color="var(--accent)" />
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: 'var(--text-primary)',
              fontFamily: 'Sora, sans-serif',
            }}
          >
            Visual Labs
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}
      >
        {(['library', 'create'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              padding: '10px 0',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--accent)' : 'var(--text-secondary)',
              fontWeight: tab === t ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
              textTransform: 'capitalize',
              transition: 'color 150ms, border-color 150ms',
            }}
          >
            {t === 'library' ? `Library${totalLabCount > 0 ? ` (${totalLabCount})` : ''}` : 'Create'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* ── LIBRARY TAB ── */}
        {tab === 'library' && (
          <>
            {/* Search */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search labs by title..."
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                marginBottom: 14,
                outline: 'none',
              }}
            />

            {filteredGroups.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  padding: '32px 16px',
                  lineHeight: 1.7,
                }}
              >
                {search.trim()
                  ? 'No labs match your search.'
                  : 'No labs yet — create one in the Create tab or from your course pages.'}
              </div>
            ) : (
              filteredGroups.map(group => (
                <div key={group.courseId} style={{ marginBottom: 18 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      color: 'var(--text-secondary)',
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    {group.courseName}
                  </div>
                  {group.labs.map(lab => (
                    <LabCard
                      key={lab.id}
                      lab={lab}
                      courseName={group.courseName}
                      onRun={() => {
                        setViewLab(lab);
                      }}
                    />
                  ))}
                </div>
              ))
            )}
          </>
        )}

        {/* ── CREATE TAB ── */}
        {tab === 'create' && (
          <>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Describe a physics simulation
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                'e.g. "Show electric field lines around a point charge"\n' +
                '"Simulate a pendulum with adjustable length"'
              }
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border-color)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: 13,
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                marginBottom: 10,
              }}
            />

            <button
              onClick={handleGenerate}
              disabled={generating || !prompt.trim() || !hasAI}
              style={{
                width: '100%',
                padding: '10px 0',
                background: generating
                  ? 'var(--border-color)'
                  : 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: generating || !prompt.trim() || !hasAI ? 'not-allowed' : 'pointer',
                marginBottom: 12,
                transition: 'background 150ms',
              }}
            >
              {generating ? 'Generating…' : 'Generate Lab'}
            </button>

            {!hasAI && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  marginBottom: 10,
                }}
              >
                Configure an AI provider in Settings to generate labs.
              </div>
            )}

            {genError && (
              <div
                style={{
                  background: 'rgba(248,113,113,0.1)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 8,
                  padding: '10px 12px',
                  color: '#f87171',
                  fontSize: 13,
                  marginBottom: 12,
                }}
              >
                {genError}
              </div>
            )}

            {previewHtml && (
              <>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    marginBottom: 6,
                  }}
                >
                  Preview
                </div>
                <iframe
                  srcDoc={previewHtml}
                  sandbox="allow-scripts"
                  style={{
                    width: '100%',
                    height: 300,
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    display: 'block',
                    marginBottom: 14,
                  }}
                  title="Lab preview"
                />

                {newLab && (
                  <div
                    style={{
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 8,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        marginBottom: 6,
                      }}
                    >
                      Save to course
                    </div>
                    <select
                      value={saveCourseId}
                      onChange={e => setSaveCourseId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        marginBottom: 10,
                        outline: 'none',
                      }}
                    >
                      {courses.length === 0 ? (
                        <option value={courseId}>{courseId}</option>
                      ) : (
                        courses.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.shortName || c.name}
                          </option>
                        ))
                      )}
                    </select>
                    <button
                      onClick={handleSave}
                      style={{
                        width: '100%',
                        padding: '9px 0',
                        background: 'var(--accent)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 7,
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      Save to Course
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Mobile responsive override — injected as a real style tag */}
      <style>{`
        @media (max-width: 600px) {
          .phys-lab-panel {
            width: 100% !important;
            height: 80vh !important;
            top: auto !important;
            bottom: 0 !important;
            transform: ${open ? 'translateY(0)' : 'translateY(100%)'} !important;
          }
        }
      `}</style>
    </div>
  );
}
