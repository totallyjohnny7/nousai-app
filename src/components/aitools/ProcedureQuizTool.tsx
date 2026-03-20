import { useState, useRef } from 'react';
import {
  ClipboardList, Upload, Trash2, Play, ArrowLeft,
  Trophy, CheckCircle, XCircle, Zap, Lightbulb,
  FileText, Plus, ChevronDown, ChevronUp, Pencil, X, GripVertical,
} from 'lucide-react';
import { callAI, isAIConfigured } from '../../utils/ai';
import { useStore } from '../../store';
import { inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import type { SavedProcedure, ProcedureQuizResult } from '../../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function parseImportedText(content: string, filename?: string): SavedProcedure[] {
  const trimmed = content.trim();

  // JSON format: [{ name, steps: string[] }]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as { name: string; steps: string[] }[];
      return parsed.map(p => ({
        id: uid(),
        name: p.name || 'Imported Procedure',
        steps: (p.steps || []).map((s, i) => ({ order: i + 1, text: s.trim() })),
        createdAt: Date.now(),
      }));
    } catch {
      // fall through to other parsers
    }
  }

  // Markdown table format: lines starting with |
  const lines = trimmed.split('\n').map(l => l.trim());
  const tableLines = lines.filter(l => l.startsWith('|'));
  if (tableLines.length >= 3) {
    return parseMarkdownTable(tableLines);
  }

  // Plain text: numbered list or bullet list = one procedure
  const steps = parseStepList(lines);
  if (steps.length > 0) {
    const name = filename
      ? filename.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
      : 'Imported Procedure';
    return [{ id: uid(), name, steps, createdAt: Date.now() }];
  }

  return [];
}

function parseMarkdownTable(tableLines: string[]): SavedProcedure[] {
  // Skip separator lines (---|---)
  const dataLines = tableLines.filter(l => !l.replace(/[\s|:-]/g, ''));
  const rows = tableLines
    .filter(l => !l.match(/^\|[\s|:-]+\|$/))
    .map(l =>
      l
        .split('|')
        .slice(1, -1)
        .map(c => c.trim())
    )
    .filter(r => r.length >= 2);

  // First row is header — skip it if it looks like a header
  const dataRows = rows.filter(
    (_, i) => i > 0 || !rows[0]?.[0]?.toLowerCase().includes('procedure')
  );
  void dataLines;

  return dataRows
    .map(row => {
      const name = row[0];
      const stepsRaw = row[1] || '';
      // Split on bullet chars or newlines within the cell
      const stepTexts = stepsRaw
        .split(/•|\n|(?<=\.) (?=[A-Z•])/)
        .map(s => s.replace(/^\s*[•\-\*]\s*/, '').trim())
        .filter(s => s.length > 10);
      if (!name || stepTexts.length === 0) return null;
      return {
        id: uid(),
        name,
        steps: stepTexts.map((t, i) => ({ order: i + 1, text: t })),
        createdAt: Date.now(),
      };
    })
    .filter((p): p is SavedProcedure => p !== null);
}

function parseStepList(lines: string[]): { order: number; text: string }[] {
  return lines
    .map(l => l.replace(/^(\d+[\.\)]\s*|•\s*|-\s*)/, '').trim())
    .filter(l => l.length > 5)
    .map((text, i) => ({ order: i + 1, text }));
}

function scoreColor(score: number) {
  if (score >= 85) return '#22c55e';
  if (score >= 65) return '#F5A623';
  return '#ef4444';
}

function gradeLabel(score: number) {
  if (score >= 90) return '🏆 Excellent';
  if (score >= 80) return '✅ Solid';
  if (score >= 65) return '⚠️ Needs Work';
  return '❌ Review Required';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepsPreview({ steps }: { steps: { order: number; text: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          fontFamily: 'inherit', letterSpacing: 0.5, textTransform: 'uppercase',
        }}
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {steps.length} steps {open ? '(hide)' : '(preview)'}
      </button>
      {open && (
        <ol style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {steps.map(s => <li key={s.order}>{s.text}</li>)}
        </ol>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type View = 'library' | 'quiz' | 'result';

function ProcedureQuizTool() {
  const { data, updatePluginData } = useStore();
  const procedures: SavedProcedure[] = data?.pluginData?.savedProcedures ?? [];

  const [view, setView] = useState<View>('library');
  const [activeProcedure, setActiveProcedure] = useState<SavedProcedure | null>(null);
  const [recall, setRecall] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProcedureQuizResult | null>(null);
  const [error, setError] = useState('');

  // Import modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [importError, setImportError] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSteps, setEditSteps] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Import handlers ──────────────────────────────────────────────────────

  function saveProcedures(newOnes: SavedProcedure[]) {
    updatePluginData({ savedProcedures: [...procedures, ...newOnes] });
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const allParsed: SavedProcedure[] = [];
    const failedFiles: string[] = [];

    await Promise.all(
      Array.from(files).map(async file => {
        const text = await file.text();
        const parsed = parseImportedText(text, file.name);
        if (parsed.length === 0) failedFiles.push(file.name);
        else allParsed.push(...parsed);
      })
    );

    if (allParsed.length > 0) saveProcedures(allParsed);

    if (failedFiles.length > 0) {
      setImportError(
        `Imported ${allParsed.length} procedure(s). Could not parse: ${failedFiles.join(', ')}`
      );
    } else {
      setImportError('');
    }
    e.target.value = '';
  }

  // Paste modal tab: 'text' | 'json'
  const [pasteTab, setPasteTab] = useState<'text' | 'json'>('text');

  function handlePasteImport() {
    if (!pasteText.trim()) return;

    // If on JSON tab, try direct JSON parse first
    if (pasteTab === 'json') {
      try {
        const parsed = JSON.parse(pasteText.trim()) as { name: string; steps: string[] }[];
        if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
        const procs: SavedProcedure[] = parsed.map(p => ({
          id: uid(),
          name: p.name || 'Imported Procedure',
          steps: (p.steps || []).map((s, i) => ({ order: i + 1, text: s.trim() })),
          createdAt: Date.now(),
        }));
        if (procs.length === 0) throw new Error('No procedures found');
        saveProcedures(procs);
        setPasteText(''); setPasteName(''); setImportError(''); setShowPasteModal(false);
        return;
      } catch (e) {
        setImportError(`Invalid JSON: ${e instanceof Error ? e.message : 'check format'}`);
        return;
      }
    }

    const parsed = parseImportedText(pasteText, pasteName.trim() || undefined);
    if (parsed.length === 0) {
      setImportError('Could not parse steps. Use numbered list (1. step) or bullet points (• step).');
      return;
    }
    if (parsed.length === 1 && pasteName.trim()) {
      parsed[0].name = pasteName.trim();
    }
    saveProcedures(parsed);
    setPasteText('');
    setPasteName('');
    setImportError('');
    setShowPasteModal(false);
  }

  function deleteProcedure(id: string) {
    updatePluginData({ savedProcedures: procedures.filter(p => p.id !== id) });
  }

  // ── Edit handlers ─────────────────────────────────────────────────────────

  function startEdit(proc: SavedProcedure) {
    setEditingId(proc.id);
    setEditName(proc.name);
    setEditSteps(proc.steps.map(s => s.text));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setEditSteps([]);
  }

  function saveEdit(id: string) {
    const cleanSteps = editSteps.map(s => s.trim()).filter(s => s.length > 0);
    if (!editName.trim() || cleanSteps.length === 0) return;
    const updated = procedures.map(p =>
      p.id !== id ? p : {
        ...p,
        name: editName.trim(),
        steps: cleanSteps.map((text, i) => ({ order: i + 1, text })),
      }
    );
    updatePluginData({ savedProcedures: updated });
    cancelEdit();
  }

  function updateEditStep(i: number, val: string) {
    setEditSteps(prev => prev.map((s, idx) => idx === i ? val : s));
  }

  function removeEditStep(i: number) {
    setEditSteps(prev => prev.filter((_, idx) => idx !== i));
  }

  function addEditStep() {
    setEditSteps(prev => [...prev, '']);
  }

  // ── Quiz handlers ────────────────────────────────────────────────────────

  function startQuiz(proc: SavedProcedure) {
    setActiveProcedure(proc);
    setRecall('');
    setResult(null);
    setError('');
    setView('quiz');
  }

  async function submitQuiz() {
    if (!activeProcedure || !recall.trim()) return;
    setLoading(true);
    setError('');

    const stepsText = activeProcedure.steps
      .map(s => `${s.order}. ${s.text}`)
      .join('\n');

    const systemPrompt = `You are a clinical procedure evaluator. Given official steps and a student's recall, output ONLY valid JSON.
Return exactly: {"score":0-100,"correct":["..."],"missed":["..."],"errors":["..."],"mnemonic":"..."}
- "correct": brief descriptions of steps they got right
- "missed": steps they skipped or forgot (be specific)
- "errors": incorrect things they said that aren't in the procedure (empty array if none)
- "mnemonic": a short, memorable tip (like "Bed → Gloves → Bib → Brush → Rinse") to remember the flow
Score: step accuracy 70%, sequencing 20%, completeness 10%. Be honest and specific.`;

    const userMsg = `Official procedure: ${activeProcedure.name}
Steps:
${stepsText}

Student's recall:
${recall.trim()}`;

    try {
      const raw = await callAI(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
        {},
        'analysis'
      );

      // Extract JSON even if there's surrounding text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Could not parse AI response.');
      const parsed: ProcedureQuizResult = JSON.parse(jsonMatch[0]);

      setResult(parsed);

      // Update bestScore and quizCount on procedure
      const updated = procedures.map(p => {
        if (p.id !== activeProcedure.id) return p;
        return {
          ...p,
          lastQuizzedAt: Date.now(),
          quizCount: (p.quizCount ?? 0) + 1,
          bestScore: Math.max(p.bestScore ?? 0, parsed.score),
        };
      });
      updatePluginData({ savedProcedures: updated });
      setView('result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grading failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Views ────────────────────────────────────────────────────────────────

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <ClipboardList size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  // ── Library view ─────────────────────────────────────────────────────────
  if (view === 'library') {
    return (
      <div>
        {/* Header card */}
        <div className="card mb-3">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>
                <ClipboardList size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Procedure Quiz
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Memorize step-by-step procedures with AI-graded recall
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn"
                onClick={() => setShowPasteModal(true)}
                style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={13} /> Paste Steps
              </button>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 8,
                  background: 'var(--accent)', color: '#000',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  letterSpacing: 0.3,
                }}
              >
                <Upload size={13} /> Import Files
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.json"
                  multiple
                  onChange={handleFileImport}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>
          {importError && (
            <p style={{ marginTop: 10, fontSize: 12, color: 'var(--red, #ef4444)', background: 'rgba(239,68,68,0.08)', padding: '8px 10px', borderRadius: 6 }}>
              {importError}
            </p>
          )}
        </div>

        {/* Paste modal */}
        {showPasteModal && (
          <div className="card mb-3" style={{ borderLeft: '3px solid var(--accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                <FileText size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                Add Procedures
              </span>
              <button onClick={() => { setShowPasteModal(false); setImportError(''); setPasteText(''); setPasteName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
            </div>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {(['text', 'json'] as const).map(tab => (
                <button key={tab} onClick={() => { setPasteTab(tab); setImportError(''); setPasteText(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 12, fontWeight: 700, padding: '6px 14px',
                    color: pasteTab === tab ? 'var(--accent)' : 'var(--text-muted)',
                    borderBottom: pasteTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {tab === 'text' ? 'Plain Text' : 'JSON Array'}
                </button>
              ))}
            </div>

            {pasteTab === 'text' && (
              <input value={pasteName} onChange={e => setPasteName(e.target.value)}
                placeholder="Procedure name (e.g. Oral Care - Responsive Resident)"
                style={{ ...inputStyle, marginBottom: 8 }}
              />
            )}
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={pasteTab === 'text'
                ? `1. Lock bed wheels\n2. Put on gloves\n3. Place towel on chest\n...\n\nOr bullet points (• step)`
                : `[\n  { "name": "Oral Care - Responsive", "steps": ["Lock bed wheels", "Put on gloves", "..."] },\n  { "name": "Blood Pressure", "steps": ["Wipe stethoscope", "..."] }\n]`}
              rows={9}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 8, fontFamily: pasteTab === 'json' ? 'DM Mono, monospace' : 'inherit', fontSize: pasteTab === 'json' ? 11 : 13 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handlePasteImport} disabled={!pasteText.trim()} style={{ flex: 1 }}>
                Import {pasteTab === 'json' ? 'JSON' : 'Steps'}
              </button>
              <button className="btn" onClick={() => { setShowPasteModal(false); setImportError(''); setPasteText(''); setPasteName(''); }}>
                Cancel
              </button>
            </div>
            {importError && (
              <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red, #ef4444)', background: 'rgba(239,68,68,0.07)', padding: '6px 10px', borderRadius: 6 }}>{importError}</p>
            )}
          </div>
        )}

        {/* Procedure cards */}
        {procedures.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <ClipboardList size={40} style={{ marginBottom: 14, opacity: 0.2 }} />
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>No procedures yet</p>
            <p style={{ fontSize: 12 }}>Import a file (.txt, .md, .json) or paste your steps above.</p>
            <p style={{ fontSize: 11, marginTop: 8 }}>Supports numbered lists, markdown tables, or JSON arrays.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {procedures.map(proc => {
              const isEditing = editingId === proc.id;
              const needsWork = proc.bestScore !== undefined && proc.bestScore < 65;
              const neverQuizzed = proc.quizCount === undefined || proc.quizCount === 0;
              // "overdue" = quizzed before but not in last 2 days
              const overdue = !neverQuizzed && proc.lastQuizzedAt !== undefined
                && (Date.now() - proc.lastQuizzedAt) > 2 * 24 * 60 * 60 * 1000;

              const borderColor = needsWork ? '#ef4444' : overdue ? '#f97316' : 'var(--border)';

              return (
              <div
                key={proc.id}
                className="card"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                {/* Warning banner */}
                {(needsWork || overdue) && !isEditing && (
                  <div style={{
                    fontSize: 11, fontWeight: 600, marginBottom: 8, padding: '4px 8px',
                    borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: needsWork ? 'rgba(239,68,68,0.08)' : 'rgba(249,115,22,0.08)',
                    color: needsWork ? '#ef4444' : '#f97316',
                  }}>
                    {needsWork ? '⚠️ Needs review — score below 65%' : '🔔 Due for practice — last quizzed 2+ days ago'}
                  </div>
                )}

                {isEditing ? (
                  /* ── Inline edit panel ── */
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' }}>
                      Editing Procedure
                    </div>
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      placeholder="Procedure name"
                      style={{ ...inputStyle, marginBottom: 10, fontWeight: 600 }}
                    />
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
                      Steps
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                      {editSteps.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'DM Mono, monospace', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
                            {i + 1}.
                          </span>
                          <GripVertical size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.4 }} />
                          <input value={step} onChange={e => updateEditStep(i, e.target.value)}
                            style={{ ...inputStyle, flex: 1, padding: '5px 8px', fontSize: 12 }}
                          />
                          <button onClick={() => removeEditStep(i)} title="Remove step"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 2, display: 'flex', flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button onClick={addEditStep}
                      style={{
                        background: 'none', border: '1px dashed var(--border)', borderRadius: 6,
                        cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12,
                        width: '100%', padding: '6px 0', marginBottom: 10,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        fontFamily: 'inherit',
                      }}>
                      <Plus size={12} /> Add Step
                    </button>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" onClick={() => saveEdit(proc.id)}
                        disabled={!editName.trim() || editSteps.filter(s => s.trim()).length === 0}
                        style={{ flex: 1 }}>
                        Save
                      </button>
                      <button className="btn" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal card view ── */
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                        {proc.name}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                          background: 'var(--bg-input)', color: 'var(--text-muted)', letterSpacing: 0.4,
                        }}>
                          {proc.steps.length} STEPS
                        </span>
                        {proc.bestScore !== undefined && (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                            background: needsWork ? 'rgba(239,68,68,0.1)' : proc.bestScore >= 80 ? 'rgba(245,166,35,0.12)' : 'var(--bg-input)',
                            color: needsWork ? '#ef4444' : proc.bestScore >= 80 ? 'var(--accent)' : 'var(--text-muted)',
                            letterSpacing: 0.4,
                          }}>
                            BEST {proc.bestScore}%
                          </span>
                        )}
                        {proc.quizCount !== undefined && proc.quizCount > 0 && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                            background: 'var(--bg-input)', color: 'var(--text-muted)',
                          }}>
                            {proc.quizCount}× quizzed
                          </span>
                        )}
                        {neverQuizzed && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                            background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                          }}>
                            NOT STARTED
                          </span>
                        )}
                      </div>
                      <StepsPreview steps={proc.steps} />
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => startQuiz(proc)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 13px', borderRadius: 8,
                          background: 'var(--accent)', color: '#000',
                          border: 'none', cursor: 'pointer',
                          fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
                        }}>
                        <Play size={12} /> Quiz
                      </button>
                      <button onClick={() => startEdit(proc)} title="Edit procedure"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 8, cursor: 'pointer', padding: '7px 9px',
                          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        }}>
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteProcedure(proc.id)} title="Delete procedure"
                        style={{
                          background: 'none', border: '1px solid var(--border)',
                          borderRadius: 8, cursor: 'pointer', padding: '7px 9px',
                          color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                        }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Quiz view ─────────────────────────────────────────────────────────────
  if (view === 'quiz' && activeProcedure) {
    return (
      <div>
        <button
          onClick={() => setView('library')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, display: 'flex',
            alignItems: 'center', gap: 5, marginBottom: 14, padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={13} /> Back to Library
        </button>

        <div className="card mb-3" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>
            Quiz Mode
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            {activeProcedure.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {activeProcedure.steps.length} steps — {activeProcedure.bestScore !== undefined ? `Best score: ${activeProcedure.bestScore}%` : 'First attempt'}
          </div>
        </div>

        <div className="card mb-3">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
            Type out the steps from memory — don't look at your notes!
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Write naturally, like you're explaining it out loud. You don't need to be perfect — just get the steps down.
          </div>
          <textarea
            value={recall}
            onChange={e => setRecall(e.target.value)}
            placeholder="First 5 steps, then... gather supplies, gloves on, towel on chest..."
            rows={9}
            style={{ ...inputStyle, resize: 'vertical', marginBottom: 10, lineHeight: 1.7 }}
            autoFocus
          />
          <button
            className="btn btn-primary"
            onClick={submitQuiz}
            disabled={!recall.trim() || loading}
            style={{ width: '100%', fontSize: 14, padding: '10px 0' }}
          >
            {loading ? 'Grading...' : 'Submit for Grading'}
          </button>
          {error && (
            <p style={{ marginTop: 8, fontSize: 12, color: 'var(--red, #ef4444)' }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Result view ───────────────────────────────────────────────────────────
  if (view === 'result' && result && activeProcedure) {
    const color = scoreColor(result.score);
    return (
      <div>
        <button
          onClick={() => setView('library')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, display: 'flex',
            alignItems: 'center', gap: 5, marginBottom: 14, padding: 0,
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={13} /> Back to Library
        </button>

        {/* Score card */}
        <div className="card mb-3" style={{ borderLeft: `3px solid ${color}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 68, height: 68, borderRadius: '50%',
              border: `3px solid ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'DM Mono, monospace' }}>
                {result.score}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
                {gradeLabel(result.score)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {activeProcedure.name}
              </div>
              {activeProcedure.bestScore !== undefined && activeProcedure.bestScore === result.score && result.score > 0 && (
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginTop: 3 }}>
                  <Trophy size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                  New best score!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What you got right */}
        {result.correct.length > 0 && (
          <div className="card mb-3" style={{ borderLeft: '3px solid #22c55e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <CheckCircle size={15} color="#22c55e" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                What You Got Right
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {result.correct.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* What you missed */}
        {result.missed.length > 0 && (
          <div className="card mb-3" style={{ borderLeft: '3px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <XCircle size={15} color="#ef4444" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                What You Missed or Got Wrong
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {result.missed.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* Incorrect / not in procedure */}
        {result.errors.length > 0 && (
          <div className="card mb-3" style={{ borderLeft: '3px solid #f97316' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
              <Zap size={15} color="#f97316" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Not In This Procedure
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              {result.errors.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}

        {/* Mnemonic */}
        {result.mnemonic && (
          <div className="card mb-3" style={{ borderLeft: '3px solid var(--accent)', background: 'rgba(245,166,35,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
              <Lightbulb size={15} color="var(--accent)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Memory Tip
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, fontStyle: 'italic' }}>
              {result.mnemonic}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn btn-primary"
            onClick={() => startQuiz(activeProcedure)}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Play size={13} /> Try Again
          </button>
          <button
            className="btn"
            onClick={() => setView('library')}
            style={{ flex: 1 }}
          >
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function ProcedureQuizToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Procedure Quiz">
      <ProcedureQuizTool />
    </ToolErrorBoundary>
  );
}
