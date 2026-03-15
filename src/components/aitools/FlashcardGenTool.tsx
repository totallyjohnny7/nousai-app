import { useState } from 'react';
import { Layers, Save } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Note } from '../../types';
import { selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface GeneratedCard {
  front: string;
  back: string;
  checked: boolean;
}

function parseJsonArray(response: string): unknown[] | null {
  try {
    let s = response.trim();
    const codeBlock = s.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) s = codeBlock[1].trim();
    const arrMatch = s.match(/\[[\s\S]*\]/);
    if (arrMatch) s = arrMatch[0];
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function FlashcardGenTool() {
  const { data, updatePluginData } = useStore();
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const notes = data?.pluginData?.notes || [];

  async function generate() {
    if (!selectedNoteId) return;
    const note = notes.find((n: Note) => n.id === selectedNoteId);
    if (!note) return;

    setLoading(true);
    setError('');
    setSaved(false);
    setCards([]);

    try {
      const prompt = `Generate 10 question-and-answer flashcard pairs based on the note content below. Return ONLY a valid JSON array with objects having "front" (the question) and "back" (the answer) fields.

<note_title>${note.title}</note_title>
<note_content>
${note.content.slice(0, 4000)}
</note_content>

Return format: [{"front":"Question?","back":"Answer."},...]`;

      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse flashcards from AI response. Please try again.');
        return;
      }
      const generated: GeneratedCard[] = (parsed as Record<string, unknown>[]).map(item => ({
        front: String(item.front || ''),
        back: String(item.back || ''),
        checked: true,
      })).filter(c => c.front && c.back);
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
      S: 1,
      D: 5,
      reps: 0,
      lapses: 0,
      state: 'new',
      lastReview: '',
      nextReview: new Date().toISOString(),
      elapsedDays: 0,
      scheduledDays: 1,
      history: [],
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
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No notes found. Create notes first to generate flashcards.</p>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedNoteId}
              onChange={e => { setSelectedNoteId(e.target.value); setCards([]); setSaved(false); }}
              style={{ ...selectStyle, flex: 1, minWidth: 200 }}
            >
              <option value="">Select a note...</option>
              {notes.map((n: Note) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={generate}
              disabled={!selectedNoteId || loading}
            >
              {loading ? 'Generating...' : 'Generate'}
            </button>
          </div>
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
              onClick={() => setCards(prev => prev.map(c => ({ ...c, checked: !prev.every(x => x.checked) })))}
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
                onClick={() => setCards(prev => prev.map((c, ci) => ci === i ? { ...c, checked: !c.checked } : c))}
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
            <Save size={14} /> {saved ? 'Saved to Flashcards!' : `Save ${cards.filter(c => c.checked).length} Cards to Flashcards`}
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
