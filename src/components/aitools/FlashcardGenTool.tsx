import { useState } from 'react';
import { Layers, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Note } from '../../types';
import { selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { parseJsonArray } from '../../utils/parseJson';

// ── Card format definitions ────────────────────────────────────────────────────
interface CardFormat {
  id: string;
  label: string;
  emoji: string;
  description: string;
  exampleFront: string;
  exampleBack: string;
  buildPrompt: (title: string, content: string) => string;
}

const CARD_FORMATS: CardFormat[] = [
  {
    id: 'qa',
    label: 'Q&A',
    emoji: '❓',
    description: 'Classic question on front, full answer on back',
    exampleFront: 'What is the primary function of the mitochondria?',
    exampleBack: 'To produce ATP (energy) through cellular respiration — often called the powerhouse of the cell.',
    buildPrompt: (title, content) =>
      `Generate 10 question-and-answer flashcard pairs based on the note below. Return ONLY a valid JSON array with "front" (the question) and "back" (the answer) fields.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Return format: [{"front":"Question?","back":"Answer."},...]`,
  },
  {
    id: 'cloze',
    label: 'Cloze',
    emoji: '🔳',
    description: 'Key term blanked out Anki-style: {{c1::term}}',
    exampleFront: 'The {{c1::mitochondria}} is the powerhouse of the cell.',
    exampleBack: 'mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 cloze deletion flashcards from the note below. Each card hides ONE key term using {{c1::term}} syntax. "front" is the full sentence with {{c1::term}} notation. "back" is ONLY the hidden term/phrase. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"The {{c1::term}} does X.","back":"term"},...]`,
  },
  {
    id: 'fillin',
    label: 'Fill-in-Blank',
    emoji: '✏️',
    description: 'Complete the sentence — fill the blank',
    exampleFront: 'The _____ is responsible for producing ATP in eukaryotic cells.',
    exampleBack: 'mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 fill-in-the-blank flashcards from the note below. Replace one KEY word or phrase with "_____". "front" is the sentence with the blank. "back" is the missing word/phrase only. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"The _____ does X.","back":"missing term"},...]`,
  },
  {
    id: 'term',
    label: 'Term → Def',
    emoji: '📖',
    description: 'Term on front, full definition with context on back',
    exampleFront: 'Mitochondria',
    exampleBack: 'A membrane-bound organelle in eukaryotic cells responsible for producing ATP via aerobic respiration. Contains its own DNA, suggesting endosymbiotic origin.',
    buildPrompt: (title, content) =>
      `Generate 10 vocabulary flashcards from the note below. "front" is the TERM only. "back" is the full definition or explanation (2–4 sentences with context). Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Term","back":"Full definition with context."},...]`,
  },
  {
    id: 'reversed',
    label: 'Reversed',
    emoji: '🔄',
    description: 'Definition on front, term on back — tests active recall',
    exampleFront: 'Organelle that produces ATP through cellular respiration; has its own DNA and double membrane.',
    exampleBack: 'Mitochondria',
    buildPrompt: (title, content) =>
      `Generate 10 reverse-recall flashcards from the note below. "front" is the DESCRIPTION or definition. "back" is the TERM or concept name. This format tests active production recall. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Full description...","back":"Term"},...]`,
  },
  {
    id: 'truefalse',
    label: 'True / False',
    emoji: '⚖️',
    description: 'Statement on front, TRUE/FALSE + reason on back',
    exampleFront: 'Mitochondria are only found in animal cells.',
    exampleBack: 'FALSE — Mitochondria are found in nearly all eukaryotic cells, including plant and fungal cells.',
    buildPrompt: (title, content) =>
      `Generate 10 true/false flashcards from the note below. "front" is a statement that is true or false. "back" starts with "TRUE" or "FALSE" followed by " — " and a brief explanation. Mix true and false roughly 50/50. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Statement.","back":"TRUE — explanation."},...]`,
  },
  {
    id: 'elaboration',
    label: 'Elaborate',
    emoji: '🧠',
    description: 'Concept on front — deep explanation + analogy on back',
    exampleFront: 'Explain oxidative phosphorylation and why it matters.',
    exampleBack: "Oxidative phosphorylation uses the electron transport chain to pump protons, creating a gradient that drives ATP synthase to produce ~28 ATP per glucose. It accounts for ~90% of cellular ATP output. Analogy: it's like a turbine powered by a proton current — electrons flow down, ions flow through, energy is harvested.",
    buildPrompt: (title, content) =>
      `Generate 10 elaboration flashcards from the note below. "front" asks to explain a concept (e.g. "Explain X and why it matters"). "back" gives a thorough 3–5 sentence explanation: what it is, how it works, why it matters, and a real-world analogy or example. Return ONLY a valid JSON array.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"Explain X and why it matters.","back":"Deep explanation with analogy."},...]`,
  },
  {
    id: 'procedural',
    label: 'Procedural Chain',
    emoji: '🔗',
    description: 'Clinical/skill procedures — 4-phase structure with critical steps on front',
    exampleFront: `COUNTING & RECORDING RADIAL PULSE
─────────────────────────────────
SUPPLIES: Watch with second hand
─────────────────────────────────
⭐ CRITICAL: Index + middle finger on THUMB SIDE of wrist
⭐ CRITICAL: Count full 1 minute (±4 BPM)
⭐ CRITICAL: Report if <60 or >100 BPM
─────────────────────────────────
Q: Walk me through the full procedure.`,
    exampleBack: `PHASE 1 — ENTRY
1. Knock, wait
2. ID self + resident
3. Wash hands
4. Explain, face-to-face
5. Privacy

PHASE 2 — SETUP
6. Position arm palm-up, relaxed

PHASE 3 — THE SKILL
7. ⭐ Index + middle finger on THUMB SIDE of wrist
   → Feel for rhythmic tap beneath fingers
   → NEVER use your thumb (has its own pulse)
8. ⭐ Count every beat for 1 FULL MINUTE
   → Note: rhythm (regular or skipping?)
   → Note: strength (strong or weak/thready?)

PHASE 4 — WRAP-UP
9. Call light within reach
10. Wash hands
11. Record: rate, date, time, method (radial)
12. ⭐ Report to nurse if <60 or >100 BPM`,
    buildPrompt: (title, content) =>
      `Generate one "Procedural Chain Card" per clinical skill found in the note below. Each card MUST follow this exact structure with no variation.

FRONT format (exact):
[SKILL NAME IN CAPS]
─────────────────────────────────
SUPPLIES: [comma-separated list]
─────────────────────────────────
⭐ CRITICAL: [first critical/starred step]
⭐ CRITICAL: [second critical step — include numbers, measurements, or examiner-watched items]
⭐ CRITICAL: [third if applicable]
─────────────────────────────────
Q: Walk me through the full procedure.

BACK format (exact 4-phase structure):
PHASE 1 — ENTRY
1. Knock, wait
2. ID self + resident
3. Wash hands
4. Explain procedure (clearly, slowly, face-to-face)
5. Privacy (curtain/screen/door)

PHASE 2 — SETUP
[skill-specific: lock wheels, adjust bed, gloves, gather supplies, etc.]

PHASE 3 — THE SKILL
[Most detailed phase — number every step, mark ⭐ on critical steps, add → sub-notes for technique details]

PHASE 4 — WRAP-UP
[Last steps: call light within reach, wash hands, report changes to nurse, document]

RULES:
- Phase 1 and Phase 4 are nearly identical across all skills — keep them consistent
- Phase 3 is the most detailed and skill-specific
- ⭐ marks on Phase 3 must match the ⭐ CRITICAL items listed on the front
- Include specific numbers, measurements, or timing wherever they exist (e.g. "count 1 full minute", "≥105°F = do not serve")
- One card per skill. Return ONLY a valid JSON array with "front" and "back" string fields.

<note_title>${title}</note_title>
<note_content>${content}</note_content>

Format: [{"front":"SKILL NAME\\n─────...","back":"PHASE 1 — ENTRY\\n1. Knock..."},...]`,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
interface GeneratedCard {
  front: string;
  back: string;
  checked: boolean;
}

// ── FormatPicker ──────────────────────────────────────────────────────────────
function FormatPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  function handleClick(id: string) {
    onSelect(id);
    // Toggle preview: click same chip again hides it
    setPreviewId(prev => (prev === id ? null : id));
  }

  const previewFormat = CARD_FORMATS.find(f => f.id === previewId);

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          fontSize: 11, color: 'var(--text-muted)', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8,
        }}
      >
        Card Format — click to preview
      </div>

      {/* Format chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {CARD_FORMATS.map(fmt => {
          const isSelected = selected === fmt.id;
          const isPreviewing = previewId === fmt.id;
          return (
            <button
              key={fmt.id}
              onClick={() => handleClick(fmt.id)}
              title={fmt.description}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: isSelected ? 'var(--accent)' : 'var(--bg-secondary)',
                color: isSelected ? '#000' : 'var(--text-primary)',
                border: isSelected
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
              }}
            >
              {fmt.emoji} {fmt.label}
              {isPreviewing ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          );
        })}
      </div>

      {/* Live example preview card */}
      {previewFormat && (
        <div
          style={{
            marginTop: 10, borderRadius: 10, overflow: 'hidden',
            border: '1px solid var(--accent)',
            boxShadow: '0 0 14px color-mix(in srgb, var(--accent) 25%, transparent)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-primary)', padding: '10px 14px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div
              style={{
                fontSize: 10, color: 'var(--accent)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
              }}
            >
              {previewFormat.emoji} {previewFormat.label} — Front
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
              {previewFormat.exampleFront}
            </div>
          </div>
          <div style={{ background: 'var(--accent-glow)', padding: '10px 14px' }}>
            <div
              style={{
                fontSize: 10, color: 'var(--accent)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
              }}
            >
              Back
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>
              {previewFormat.exampleBack}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function FlashcardGenTool() {
  const { data, updatePluginData } = useStore();
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [selectedFormat, setSelectedFormat] = useState('qa');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const notes = data?.pluginData?.notes || [];
  const activeFmt = CARD_FORMATS.find(f => f.id === selectedFormat) ?? CARD_FORMATS[0];

  async function generate() {
    if (!selectedNoteId) return;
    const note = notes.find((n: Note) => n.id === selectedNoteId);
    if (!note) return;

    setLoading(true);
    setError('');
    setSaved(false);
    setCards([]);

    try {
      const prompt = activeFmt.buildPrompt(note.title, note.content.slice(0, 4000));
      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse flashcards from AI response. Please try again.');
        return;
      }
      const generated: GeneratedCard[] = (parsed as Record<string, unknown>[])
        .map(item => ({
          front: String(item.front || ''),
          back: String(item.back || ''),
          checked: true,
        }))
        .filter(c => c.front && c.back);
      setCards(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function saveFlashcards() {
    if (!data) return;
    const checked = cards.filter(c => c.checked);
    if (checked.length === 0) return;

    const existing = data.pluginData?.srData?.cards || [];
    const newCards = checked.map(c => ({
      key: crypto.randomUUID(),
      subject: 'AI Generated',
      subtopic: notes.find((n: Note) => n.id === selectedNoteId)?.title || 'Flashcards',
      S: 1, D: 5, reps: 0, lapses: 0, state: 'new',
      lastReview: '', nextReview: new Date().toISOString(),
      elapsedDays: 0, scheduledDays: 1, history: [],
      questionText: `${c.front}\n---\n${c.back}`,
    }));

    updatePluginData({
      srData: { ...data.pluginData.srData, cards: [...existing, ...newCards] },
    });
    setSaved(true);
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <Layers size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Layers size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Generate Flashcards from Notes
        </div>

        {notes.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            No notes found. Create notes first to generate flashcards.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <select
                value={selectedNoteId}
                onChange={e => {
                  setSelectedNoteId(e.target.value);
                  setCards([]);
                  setSaved(false);
                }}
                style={{ ...selectStyle, flex: 1, minWidth: 200 }}
              >
                <option value="">Select a note…</option>
                {notes.map((n: Note) => (
                  <option key={n.id} value={n.id}>{n.title}</option>
                ))}
              </select>
            </div>

            <FormatPicker selected={selectedFormat} onSelect={setSelectedFormat} />

            <button
              className="btn btn-primary w-full"
              onClick={generate}
              disabled={!selectedNoteId || loading}
            >
              {loading
                ? 'Generating…'
                : `Generate ${activeFmt.emoji} ${activeFmt.label} Cards`}
            </button>
          </>
        )}

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {cards.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontStyle: 'italic' }}>
            ⚠ AI-generated content may contain errors. Always verify against your course materials before studying.
          </p>
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {cards.filter(c => c.checked).length} of {cards.length} selected
            </span>
            <button
              className="btn btn-sm"
              onClick={() =>
                setCards(prev => prev.map(c => ({ ...c, checked: !prev.every(x => x.checked) })))
              }
            >
              Toggle All
            </button>
          </div>

          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {cards.map((card, i) => (
              <div
                key={i}
                className="card"
                style={{
                  borderLeftColor: card.checked ? 'var(--accent)' : 'var(--border)',
                  borderLeftWidth: 3,
                  opacity: card.checked ? 1 : 0.5,
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setCards(prev => prev.map((c, ci) => ci === i ? { ...c, checked: !c.checked } : c))
                }
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={card.checked}
                    onChange={() => {}}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                      Q: {card.front}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                      A: {card.back}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            onClick={saveFlashcards}
            disabled={saved || cards.filter(c => c.checked).length === 0}
          >
            <Save size={14} />{' '}
            {saved
              ? 'Saved to Flashcards!'
              : `Save ${cards.filter(c => c.checked).length} Cards`}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FlashcardGenToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Flashcard Generator">
      <FlashcardGenTool />
    </ToolErrorBoundary>
  );
}
