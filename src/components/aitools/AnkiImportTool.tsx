import { useState, useRef } from 'react';
import { Upload, BookOpen } from 'lucide-react';
import JSZip from 'jszip';
// sql.js ships without bundled TypeScript declarations
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error no types shipped with this package
import initSqlJsRaw from 'sql.js';
import { useStore } from '../../store';
import type { FlashcardItem, Course } from '../../types';
import { selectStyle, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

// Minimal local typing so we get autocomplete without an @types package
interface SqlDatabase {
  exec(sql: string): { values: (string | number | null)[][] }[];
  close(): void;
}
interface SqlJsStatic {
  Database: new (data: ArrayLike<number>) => SqlDatabase;
}
type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;
const initSqlJs = initSqlJsRaw as InitSqlJs;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_CARDS = 500;

interface ParsedCard {
  front: string;
  back: string;
  tags: string;
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

type Phase = 'upload' | 'preview' | 'done';

function AnkiImportTool() {
  const { data, setData, courses } = useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedCards, setParsedCards] = useState<ParsedCard[]>([]);
  const [totalInFile, setTotalInFile] = useState(0);

  // Course selection
  const [selectedCourseId, setSelectedCourseId] = useState<string>('__new__');
  const [newCourseName, setNewCourseName] = useState('');

  // Success info
  const [importedCount, setImportedCount] = useState(0);
  const [importedCourseName, setImportedCourseName] = useState('');

  async function processFile(file: File) {
    setError('');
    if (file.size > MAX_FILE_SIZE) {
      setError('File is too large. Maximum size is 50 MB.');
      return;
    }

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(arrayBuffer);

      const dbFile =
        zip.file('collection.anki21') ?? zip.file('collection.anki2');
      if (!dbFile) {
        setError('Not a valid .apkg file — could not find Anki database inside the archive.');
        setLoading(false);
        return;
      }

      const dbBytes = await dbFile.async('uint8array');

      let SQL: Awaited<ReturnType<typeof initSqlJs>>;
      try {
        SQL = await initSqlJs({
          locateFile: (f: string) =>
            `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`,
        });
      } catch {
        setError(
          'Failed to load sql.js. Check your internet connection — it needs to download a small WebAssembly file from a CDN.',
        );
        setLoading(false);
        return;
      }

      const db = new SQL.Database(dbBytes);

      // Get total count first
      const countResult = db.exec('SELECT COUNT(*) FROM notes');
      const total: number =
        countResult.length > 0 && countResult[0].values.length > 0
          ? Number(countResult[0].values[0][0])
          : 0;
      setTotalInFile(total);

      const result = db.exec(
        `SELECT flds, tags FROM notes LIMIT ${MAX_CARDS}`,
      );
      db.close();

      if (!result.length || !result[0].values.length) {
        setError('No notes found in this .apkg file.');
        setLoading(false);
        return;
      }

      const cards: ParsedCard[] = result[0].values
        .map((row: (string | number | null)[]) => {
          const flds = String(row[0] ?? '');
          const tags = String(row[1] ?? '').trim();
          const parts = flds.split('\x1f');
          const front = stripHtml(parts[0] ?? '');
          const back = stripHtml(parts[1] ?? '');
          return { front, back, tags };
        })
        .filter((c: ParsedCard) => c.front && c.back);

      if (cards.length === 0) {
        setError('No valid cards found after parsing. Cards must have both a front and back field.');
        setLoading(false);
        return;
      }

      setParsedCards(cards);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred while reading the file.');
    } finally {
      setLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so the same file can be re-selected if needed
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function doImport() {
    if (!data) return;

    const flashcards: FlashcardItem[] = parsedCards.map((c) => ({
      id: crypto.randomUUID(),
      front: c.front,
      back: c.back,
      topic: c.tags.split(' ').filter(Boolean)[0] || 'Imported',
    }));

    let targetCourseName: string;

    if (selectedCourseId === '__new__') {
      const name = newCourseName.trim() || 'Anki Import';
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
    setPhase('upload');
    setError('');
    setParsedCards([]);
    setTotalInFile(0);
    setSelectedCourseId('__new__');
    setNewCourseName('');
    setImportedCount(0);
    setImportedCourseName('');
  }

  // ── Upload Phase ──────────────────────────────────────────────────────────
  if (phase === 'upload') {
    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-3">
            <Upload size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Import Anki Deck (.apkg)
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Upload an Anki <code>.apkg</code> export file to convert its cards into NousAI flashcards.
            Up to {MAX_CARDS} cards per import.
          </p>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 'var(--radius)',
              padding: '40px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              transition: 'all 0.2s',
              marginBottom: 12,
            }}
          >
            <Upload
              size={32}
              style={{
                color: dragging ? 'var(--accent)' : 'var(--text-muted)',
                marginBottom: 10,
                transition: 'color 0.2s',
              }}
            />
            <p style={{ fontSize: 14, color: dragging ? 'var(--accent-light)' : 'var(--text-secondary)', margin: 0 }}>
              {dragging ? 'Drop to import' : 'Drag & drop an .apkg file here'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '4px 0 0' }}>
              or click to browse
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".apkg"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {loading && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
              Parsing deck... (loading sql.js may take a moment)
            </p>
          )}

          {error && (
            <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Preview Phase ─────────────────────────────────────────────────────────
  if (phase === 'preview') {
    const preview = parsedCards.slice(0, 10);
    const truncated = totalInFile > MAX_CARDS;

    return (
      <div>
        <div className="card mb-3">
          <div className="card-title mb-2">
            <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Preview Import
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Found <strong style={{ color: 'var(--text-primary)' }}>{parsedCards.length} valid cards</strong>
            {truncated && (
              <span style={{ color: 'var(--accent)', marginLeft: 4 }}>
                (deck has {totalInFile} total — import limited to {MAX_CARDS})
              </span>
            )}
          </p>

          {/* Preview table */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {(['Front', 'Back', 'Tags'] as const).map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left', padding: '6px 8px',
                        color: 'var(--text-muted)', fontWeight: 600,
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
                    <td style={{ padding: '6px 8px', color: 'var(--text-primary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.front}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.back}
                    </td>
                    <td style={{ padding: '6px 8px', color: 'var(--text-dim)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.tags || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedCards.length > 10 && (
              <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, textAlign: 'center' }}>
                Showing 10 of {parsedCards.length} cards
              </p>
            )}
          </div>

          {/* Course selector */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Import into course:
            </label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              style={{ ...selectStyle, width: '100%', marginBottom: 8 }}
            >
              <option value="__new__">+ Create new course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {selectedCourseId === '__new__' && (
              <input
                type="text"
                placeholder="New course name (e.g. Anatomy Deck)"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                style={{ ...inputStyle }}
              />
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={doImport}>
              <Upload size={14} /> Import {parsedCards.length} Cards
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
        <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Import complete!
        </p>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
          Imported <strong>{importedCount}</strong> cards to <strong>{importedCourseName}</strong>.
        </p>
        <button className="btn btn-primary" onClick={reset}>
          Import Another
        </button>
      </div>
    </div>
  );
}

export default function AnkiImportToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Anki Import">
      <AnkiImportTool />
    </ToolErrorBoundary>
  );
}
