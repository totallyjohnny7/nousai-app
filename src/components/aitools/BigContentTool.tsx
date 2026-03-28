/**
 * BigContentTool — Large Text → Atomic Flashcard Pipeline
 *
 * Paste large text, OCR output, or import from Library notes.
 * AI chunks and generates atomic cards. User reviews before import.
 */

import React, { useState, useRef } from 'react';
import { useStore } from '../../store';
import { runBigContentPipeline } from '../../utils/bigContentPipeline';
import type { PipelineConfig, FlashcardItem } from '../../types';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

function BigContentToolInner() {
  const { data, updatePluginData } = useStore();
  const [inputMode, setInputMode] = useState<'paste' | 'notes'>('paste');
  const [text, setText] = useState('');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [config, setConfig] = useState<Partial<PipelineConfig>>({
    chunkWords: 500,
    cardType: 'standard',
    focusMode: 'all',
    maxCardsPerChunk: 5,
  });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ chunk: 0, total: 0, cards: 0 });
  const [generatedCards, setGeneratedCards] = useState<Partial<FlashcardItem>[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [editedCards, setEditedCards] = useState<Record<number, Partial<FlashcardItem>>>({});
  const [phase, setPhase] = useState<'input' | 'running' | 'review' | 'done'>('input');
  const abortRef = useRef<AbortController | null>(null);

  const courses = data?.pluginData?.coachData?.courses ?? [];
  const notes = data?.pluginData?.notes ?? [];

  const handleGenerate = async () => {
    let content = text;
    if (inputMode === 'notes') {
      const selectedNotes = notes.filter((n) => selectedNoteIds.includes(n.id));
      content = selectedNotes.map((n) => `# ${n.title}\n${n.content}`).join('\n\n');
    }
    if (!content.trim()) return;

    abortRef.current = new AbortController();
    setRunning(true);
    setPhase('running');
    setProgress({ chunk: 0, total: 0, cards: 0 });

    try {
      const result = await runBigContentPipeline(
        content,
        config,
        (chunk, total, cards) => setProgress({ chunk, total, cards }),
        abortRef.current.signal,
      );
      setGeneratedCards(result.cards);
      setKept(new Set(result.cards.map((_, i) => i)));
      setEditedCards({});
      setPhase('review');
    } catch (e) {
      setPhase('input');
      console.error('[BigContent] Pipeline error:', e);
    } finally {
      setRunning(false);
    }
  };

  const handleImport = () => {
    const targetCourseId = config.targetCourse;
    const keptCards = [...kept].map((i) => ({ id: crypto.randomUUID(), ...generatedCards[i], ...editedCards[i] }));

    if (targetCourseId) {
      const courses2 = (data?.pluginData?.coachData?.courses ?? []).map((c) =>
        c.id === targetCourseId
          ? { ...c, flashcards: [...(c.flashcards ?? []), ...(keptCards as FlashcardItem[])] }
          : c
      );
      updatePluginData({
        coachData: { ...(data?.pluginData?.coachData ?? { courses: [], sessions: [], streak: 0, totalStudyMinutes: 0, weeklyPlan: null }), courses: courses2 },
      });
    }
    setPhase('done');
  };

  if (phase === 'done') {
    return (
      <div className="big-content-done">
        <h3>Import complete!</h3>
        <p>{[...kept].length} cards added.</p>
        <button className="btn btn-primary" onClick={() => { setPhase('input'); setGeneratedCards([]); setText(''); }}>
          Import More
        </button>
      </div>
    );
  }

  if (phase === 'review') {
    return (
      <div className="big-content-review">
        <div className="big-content-review__header">
          <h3>{generatedCards.length} cards generated — review before importing</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setKept(new Set(generatedCards.map((_, i) => i)))}>Select All</button>
            <button className="btn" onClick={() => setKept(new Set())}>Deselect All</button>
          </div>
        </div>

        <div className="big-content-review__course">
          <label>Import into course:</label>
          <select value={config.targetCourse ?? ''} onChange={(e) => setConfig((c) => ({ ...c, targetCourse: e.target.value }))}>
            <option value="">— Select course —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="big-content-cards">
          {generatedCards.map((card, i) => {
            const current = { ...card, ...(editedCards[i] ?? {}) };
            const isKept = kept.has(i);
            return (
              <div key={i} className={`big-content-card${isKept ? '' : ' big-content-card--excluded'}`}>
                <input type="checkbox" checked={isKept} onChange={() =>
                  setKept((prev) => { const next = new Set(prev); isKept ? next.delete(i) : next.add(i); return next; })
                } />
                <div className="big-content-card__fields">
                  <input
                    className="big-content-card__input"
                    value={current.front ?? ''}
                    onChange={(e) => setEditedCards((prev) => ({ ...prev, [i]: { ...prev[i], front: e.target.value } }))}
                    placeholder="Front"
                  />
                  <input
                    className="big-content-card__input"
                    value={current.back ?? ''}
                    onChange={(e) => setEditedCards((prev) => ({ ...prev, [i]: { ...prev[i], back: e.target.value } }))}
                    placeholder="Back"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={kept.size === 0 || !config.targetCourse}
        >
          Import Selected ({kept.size}) {!config.targetCourse && '— select course first'}
        </button>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className="big-content-running">
        <div className="big-content-progress">
          <div className="big-content-progress__bar"
            style={{ width: progress.total ? `${(progress.chunk / progress.total) * 100}%` : '0%' }} />
        </div>
        <p>Chunk {progress.chunk} / {progress.total} — {progress.cards} cards generated…</p>
        <button className="btn btn-ghost btn-sm" onClick={() => abortRef.current?.abort()}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="big-content-tool">
      <h3>Big Content → Flashcards</h3>

      {/* Source selector */}
      <div className="big-content-source">
        <button className={`btn btn-sm${inputMode === 'paste' ? ' btn-primary' : ''}`} onClick={() => setInputMode('paste')}>Paste Text</button>
        <button className={`btn btn-sm${inputMode === 'notes' ? ' btn-primary' : ''}`} onClick={() => setInputMode('notes')}>From Notes</button>
      </div>

      {inputMode === 'paste' ? (
        <textarea
          className="big-content-textarea"
          placeholder="Paste large text, lecture notes, OCR output…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
        />
      ) : (
        <div className="big-content-note-picker">
          {notes.length === 0 ? (
            <p>No notes in your library yet.</p>
          ) : notes.map((n) => (
            <label key={n.id} className="big-content-note-item">
              <input
                type="checkbox"
                checked={selectedNoteIds.includes(n.id)}
                onChange={() => setSelectedNoteIds((prev) =>
                  prev.includes(n.id) ? prev.filter((id) => id !== n.id) : [...prev, n.id]
                )}
              />
              <span>{n.title}</span>
            </label>
          ))}
        </div>
      )}

      {/* Config */}
      <div className="big-content-config">
        <label>Card type:
          <select value={config.cardType} onChange={(e) => setConfig((c) => ({ ...c, cardType: e.target.value as PipelineConfig['cardType'] }))}>
            <option value="standard">Standard Q&A</option>
            <option value="cloze">Cloze (fill-in-blank)</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label>Focus:
          <select value={config.focusMode} onChange={(e) => setConfig((c) => ({ ...c, focusMode: e.target.value as PipelineConfig['focusMode'] }))}>
            <option value="all">All important content</option>
            <option value="facts">Specific facts</option>
            <option value="concepts">Underlying concepts</option>
            <option value="vocabulary">Vocabulary</option>
          </select>
        </label>
        <label>Max cards/chunk:
          <input type="range" min={2} max={10} value={config.maxCardsPerChunk ?? 5}
            onChange={(e) => setConfig((c) => ({ ...c, maxCardsPerChunk: Number(e.target.value) }))} />
          {config.maxCardsPerChunk ?? 5}
        </label>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGenerate}
        disabled={running || (inputMode === 'paste' ? !text.trim() : selectedNoteIds.length === 0)}
      >
        Generate Cards
      </button>
    </div>
  );
}

export default function BigContentTool() {
  return (
    <ToolErrorBoundary toolName="Big Content Pipeline">
      <BigContentToolInner />
    </ToolErrorBoundary>
  );
}
