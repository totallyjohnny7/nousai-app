import { useState } from 'react';
import { FileText, BookOpen } from 'lucide-react';
import { useStore } from '../../store';
import type { FlashcardItem, Course } from '../../types';
import { selectStyle, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface ParsedCard {
  front: string;
  back: string;
}

type DetectedFormat = 'tab' | 'csv' | null;
type Phase = 'input' | 'preview' | 'done';

function detectFormat(text: string): DetectedFormat {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return null;
  // Check first few non-empty lines for tab separator
  const sample = lines.slice(0, Math.min(5, lines.length));
  const tabCount = sample.filter((l) => l.includes('\t')).length;
  if (tabCount >= Math.ceil(sample.length / 2)) return 'tab';
  const commaCount = sample.filter((l) => l.includes(',')).length;
  if (commaCount >= Math.ceil(sample.length / 2)) return 'csv';
  return null;
}

function parseCards(text: string): ParsedCard[] {
  const lines = text.split('\n');
  const cards: ParsedCard[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    // Try tab split first
    let parts = line.split('\t');
    if (parts.length < 2) {
      // Fall back to comma split
      parts = line.split(',');
    }

    if (parts.length < 2) continue;

    const front = parts[0].trim();
    const back = parts.slice(1).join(',').trim(); // rejoin in case back has commas
    if (!front || !back) continue;

    cards.push({ front, back });
  }

  return cards;
}

function QuizletImportTool() {
  const { data, setData, courses } = useStore();

  const [phase, setPhase] = useState<Phase>('input');
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState('');
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat>(null);

  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState<string>('__new__');
  const [newCourseName, setNewCourseName] = useState('');
  const [topicTag, setTopicTag] = useState('Quizlet Import');

  // Success info
  const [importedCount, setImportedCount] = useState(0);
  const [importedCourseName, setImportedCourseName] = useState('');

  function handleParse() {
    setError('');

    if (!pasteText.trim()) {
      setError('Please paste some content first.');
      return;
    }

    const fmt = detectFormat(pasteText);
    setDetectedFormat(fmt);

    const cards = parseCards(pasteText);

    if (cards.length === 0) {
      setError(
        "Couldn't parse any cards. Make sure each line has a term and definition separated by a tab or comma.",
      );
      return;
    }

    setParsedCards(cards);
    setPhase('preview');
  }

  function doImport() {
    if (!data) return;

    const tag = topicTag.trim() || 'Quizlet Import';
    const flashcards: FlashcardItem[] = parsedCards.map((c) => ({
      front: c.front,
      back: c.back,
      topic: tag,
    }));

    let targetCourseName: string;

    if (selectedCourseId === '__new__') {
      const name = newCourseName.trim() || 'Quizlet Import';
      targetCourseName = name;
      const newCourse: Course = {
        id: crypto.randomUUID(),
        name,
        shortName: name.slice(0, 8),
        color: '#F5A623',
        topics: [],
        flashcards,
      };
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pluginData: {
            ...prev.pluginData,
            coachData: {
              ...prev.pluginData.coachData,
              courses: [...(prev.pluginData.coachData?.courses ?? []), newCourse],
            },
          },
        };
      });
    } else {
      const targetCourse = courses.find((c) => c.id === selectedCourseId);
      if (!targetCourse) return;
      targetCourseName = targetCourse.name;
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pluginData: {
            ...prev.pluginData,
            coachData: {
              ...prev.pluginData.coachData,
              courses: (prev.pluginData.coachData?.courses ?? []).map((c) =>
                c.id === selectedCourseId
                  ? { ...c, flashcards: [...(c.flashcards ?? []), ...flashcards] }
                  : c,
              ),
            },
          },
        };
      });
    }

    setImportedCount(flashcards.length);
    setImportedCourseName(targetCourseName);
    setPhase('done');
  }

  function reset() {
    setPhase('input');
    setError('');
    setPasteText('');
    setParsedCards([]);
    setDetectedFormat(null);
    setSelectedCourseId('__new__');
    setNewCourseName('');
    setTopicTag('Quizlet Import');
    setImportedCount(0);
    setImportedCourseName('');
  }

  // ── Input Phase ───────────────────────────────────────────────────────────
  if (phase === 'input') {
    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-3">
            <FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Import Quizlet Set
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Export your Quizlet set and paste the text below. In Quizlet: click{' '}
            <strong>···</strong> → <strong>Export</strong> → Copy to clipboard.
          </p>

          {detectedFormat && (
            <div style={{ marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  background:
                    detectedFormat === 'tab'
                      ? 'rgba(245, 166, 35, 0.15)'
                      : 'rgba(100, 200, 100, 0.15)',
                  color:
                    detectedFormat === 'tab' ? 'var(--accent-light)' : '#6fcf97',
                  border: `1px solid ${detectedFormat === 'tab' ? 'rgba(245,166,35,0.4)' : 'rgba(111,207,151,0.4)'}`,
                }}
              >
                {detectedFormat === 'tab' ? 'Tab-separated' : 'CSV detected'}
              </span>
            </div>
          )}

          <textarea
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value);
              setError('');
              if (e.target.value.trim()) {
                setDetectedFormat(detectFormat(e.target.value));
              } else {
                setDetectedFormat(null);
              }
            }}
            placeholder={
              'Paste your Quizlet export here.\n\nFormat: term\tdefinition (one per line)\nor: term,definition (CSV format)\n\nIn Quizlet: click \'...\' → Export → Copy to clipboard'
            }
            rows={12}
            style={{
              ...inputStyle,
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.6,
              marginBottom: 12,
            }}
          />

          {error && (
            <p style={{ marginBottom: 10, fontSize: 13, color: 'var(--red)' }}>{error}</p>
          )}

          <button className="btn btn-primary" onClick={handleParse}>
            <FileText size={14} /> Parse Cards
          </button>
        </div>
      </div>
    );
  }

  // ── Preview Phase ─────────────────────────────────────────────────────────
  if (phase === 'preview') {
    const preview = parsedCards.slice(0, 10);

    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-2">
            <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Preview Import
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Found{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {parsedCards.length} cards
            </strong>
          </p>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {(['Front', 'Back'] as const).map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '6px 8px',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((card, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                    }}
                  >
                    <td
                      style={{
                        padding: '6px 8px',
                        color: 'var(--text-primary)',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {card.front}
                    </td>
                    <td
                      style={{
                        padding: '6px 8px',
                        color: 'var(--text-secondary)',
                        maxWidth: 260,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {card.back}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedCards.length > 10 && (
              <p
                style={{
                  fontSize: 11,
                  color: 'var(--text-dim)',
                  marginTop: 4,
                  textAlign: 'center',
                }}
              >
                Showing 10 of {parsedCards.length} cards
              </p>
            )}
          </div>

          {/* Course selector */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Import into course:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{ ...selectStyle, width: '100%', marginBottom: 8 }}
            >
              <option value="__new__">+ Create new course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {selectedCourseId === '__new__' && (
              <input
                type="text"
                placeholder="New course name (e.g. Biology Vocab)"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                style={{ ...inputStyle, marginBottom: 8 }}
              />
            )}
          </div>

          {/* Topic tag */}
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontSize: 13,
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Topic tag (optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Quizlet Import"
              value={topicTag}
              onChange={(e) => setTopicTag(e.target.value)}
              style={{ ...inputStyle }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doImport}>
              <FileText size={14} /> Import {parsedCards.length} Cards
            </button>
            <button className="btn btn-sm" onClick={reset}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done Phase ────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
        <p
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 6,
          }}
        >
          Import complete!
        </p>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 20,
          }}
        >
          Imported <strong>{importedCount}</strong> cards to{' '}
          <strong>{importedCourseName}</strong>.
        </p>
        <button className="btn btn-primary" onClick={reset}>
          Import Another Set
        </button>
      </div>
    </div>
  );
}

export default function QuizletImportToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Quizlet Import">
      <QuizletImportTool />
    </ToolErrorBoundary>
  );
}
