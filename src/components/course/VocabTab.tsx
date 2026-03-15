import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  BookOpen, Trophy, Play, Upload, Download, Plus, Search, X,
  CheckCircle2, Circle, Trash2, ChevronLeft, ChevronRight,
  LayoutList, LayoutGrid, SkipForward, RotateCcw, ArrowLeft,
} from 'lucide-react';
import type { Course, FlashcardItem, NousAIData } from '../../types';

// ── Japanese IME helpers ─────────────────────────────────────────
type ImeMode = 'off' | 'hiragana' | 'katakana';

const ROMAJI_MAP: [string, string][] = [
  // 3-char (must come first for greedy match)
  ['sha','しゃ'],['shi','し'],['shu','しゅ'],['sho','しょ'],
  ['chi','ち'],['cha','ちゃ'],['chu','ちゅ'],['cho','ちょ'],
  ['tsu','つ'],
  ['kya','きゃ'],['kyu','きゅ'],['kyo','きょ'],
  ['nya','にゃ'],['nyu','にゅ'],['nyo','にょ'],
  ['hya','ひゃ'],['hyu','ひゅ'],['hyo','ひょ'],
  ['mya','みゃ'],['myu','みゅ'],['myo','みょ'],
  ['rya','りゃ'],['ryu','りゅ'],['ryo','りょ'],
  ['gya','ぎゃ'],['gyu','ぎゅ'],['gyo','ぎょ'],
  ['bya','びゃ'],['byu','びゅ'],['byo','びょ'],
  ['pya','ぴゃ'],['pyu','ぴゅ'],['pyo','ぴょ'],
  // 2-char
  ['ka','か'],['ki','き'],['ku','く'],['ke','け'],['ko','こ'],
  ['sa','さ'],['si','し'],['su','す'],['se','せ'],['so','そ'],
  ['ta','た'],['ti','ち'],['tu','つ'],['te','て'],['to','と'],
  ['na','な'],['ni','に'],['nu','ぬ'],['ne','ね'],['no','の'],
  ['ha','は'],['hi','ひ'],['fu','ふ'],['hu','ふ'],['he','へ'],['ho','ほ'],
  ['ma','ま'],['mi','み'],['mu','む'],['me','め'],['mo','も'],
  ['ya','や'],['yu','ゆ'],['yo','よ'],
  ['ra','ら'],['ri','り'],['ru','る'],['re','れ'],['ro','ろ'],
  ['wa','わ'],['wo','を'],
  ['ga','が'],['gi','ぎ'],['gu','ぐ'],['ge','げ'],['go','ご'],
  ['za','ざ'],['zi','じ'],['zu','ず'],['ze','ぜ'],['zo','ぞ'],
  ['ja','じゃ'],['ji','じ'],['ju','じゅ'],['jo','じょ'],
  ['da','だ'],['di','ぢ'],['du','づ'],['de','で'],['do','ど'],
  ['ba','ば'],['bi','び'],['bu','ぶ'],['be','べ'],['bo','ぼ'],
  ['pa','ぱ'],['pi','ぴ'],['pu','ぷ'],['pe','ぺ'],['po','ぽ'],
  ['nn','ん'],
  // 1-char
  ['a','あ'],['i','い'],['u','う'],['e','え'],['o','お'],
  ['n','ん'],
];

function romajiToKana(text: string, toKatakana: boolean): string {
  const CONSONANTS = 'bcdfghjklmnpqrstvwxyz';
  let result = '';
  let i = 0;
  const s = text.toLowerCase();
  while (i < s.length) {
    // Double consonant → small tsu
    if (i + 1 < s.length && s[i] === s[i + 1] && CONSONANTS.includes(s[i]) && s[i] !== 'n') {
      result += toKatakana ? 'ッ' : 'っ';
      i++;
      continue;
    }
    let matched = false;
    for (const [rom, kana] of ROMAJI_MAP) {
      if (s.startsWith(rom, i)) {
        // Don't convert lone 'n' before a vowel or 'y' (handled by na/ni/etc.)
        if (rom === 'n' && i + 1 < s.length && 'aiyueo'.includes(s[i + 1])) break;
        const out = toKatakana
          ? kana.split('').map(c => {
              const code = c.charCodeAt(0);
              return code >= 0x3041 && code <= 0x3096 ? String.fromCharCode(code + 0x60) : c;
            }).join('')
          : kana;
        result += out;
        i += rom.length;
        matched = true;
        break;
      }
    }
    if (!matched) { result += s[i]; i++; }
  }
  return result;
}

interface VocabItem {
  term: string;
  definition: string;
  mastered?: boolean;
}

export default function VocabTab({
  course, data, setData, accentColor,
}: {
  course: Course;
  data: NousAIData | null;
  setData: { (d: NousAIData): void; (fn: (prev: NousAIData) => NousAIData): void };
  accentColor: string;
}) {
  const [vocabMode, setVocabMode] = useState<'list' | 'quiz' | 'drill' | 'import'>('list');
  const [viewMode, setViewMode] = useState<'cards' | 'rows'>('cards');
  const [searchTerm, setSearchTerm] = useState('');
  const [imeMode, setImeMode] = useState<ImeMode>('off');
  const romajiBufferRef = useRef('');
  const [newTerm, setNewTerm] = useState('');
  const [newDef, setNewDef] = useState('');
  const [page, setPage] = useState(0);
  const [flippedCards, setFlippedCards] = useState<Set<number>>(new Set());
  const perPage = 10;
  const [importText, setImportText] = useState('');

  // Vocab = course flashcards
  const vocab: VocabItem[] = useMemo(() =>
    (course.flashcards || []).map(f => ({ term: f.front, definition: f.back })),
    [course.flashcards]
  );

  const filtered = useMemo(() => {
    if (!searchTerm) return vocab;
    // When IME is active, searchTerm already contains kana; otherwise lowercase for case-insensitive match
    const q = imeMode !== 'off' ? searchTerm : searchTerm.toLowerCase();
    return vocab.filter(v => v.term.toLowerCase().includes(q) || v.definition.toLowerCase().includes(q));
  }, [vocab, searchTerm, imeMode]);

  // Mastered from localStorage
  const [masteredSet, setMasteredSet] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`nousai-vocab-mastered-${course.id}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(`nousai-vocab-mastered-${course.id}`, JSON.stringify([...masteredSet]));
  }, [masteredSet, course.id]);

  // IME: intercept keystrokes so romaji converts to kana live in the search field
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (imeMode === 'off') return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      romajiBufferRef.current = romajiBufferRef.current.slice(0, -1);
      setSearchTerm(romajiToKana(romajiBufferRef.current, imeMode === 'katakana'));
      setPage(0);
      setFlippedCards(new Set());
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      romajiBufferRef.current += e.key;
      setSearchTerm(romajiToKana(romajiBufferRef.current, imeMode === 'katakana'));
      setPage(0);
      setFlippedCards(new Set());
    }
  }, [imeMode]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (imeMode !== 'off') return; // IME mode: input is controlled via onKeyDown
    setSearchTerm(e.target.value);
    setPage(0);
    setFlippedCards(new Set());
  }, [imeMode]);

  const handleImeModeToggle = useCallback(() => {
    setImeMode(m => {
      const next = m === 'off' ? 'hiragana' : m === 'hiragana' ? 'katakana' : 'off';
      romajiBufferRef.current = '';
      setSearchTerm('');
      setPage(0);
      return next;
    });
  }, []);

  const clearSearch = useCallback(() => {
    romajiBufferRef.current = '';
    setSearchTerm('');
    setPage(0);
  }, []);

  const addVocab = useCallback(() => {
    if (!newTerm.trim() || !newDef.trim() || !data) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return { ...c, flashcards: [...c.flashcards, { front: newTerm.trim(), back: newDef.trim() }] };
          }),
        },
      },
    }));
    setNewTerm('');
    setNewDef('');
  }, [newTerm, newDef, data, setData, course.id]);

  const removeVocab = useCallback((index: number) => {
    if (!data) return;
    setData((prev: NousAIData) => {
      const updatedCourses = prev.pluginData.coachData.courses.map(c => {
        if (c.id !== course.id) return c;
        const updated = [...c.flashcards];
        updated.splice(index, 1);
        return { ...c, flashcards: updated };
      });
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          coachData: { ...prev.pluginData.coachData, courses: updatedCourses },
        },
      };
    });
  }, [data, setData, course.id]);

  const parseVocabInput = useCallback((raw: string): FlashcardItem[] | null => {
    const text = raw.trim();
    if (!text) return null;
    try {
      if (text.startsWith('[')) {
        const parsed = JSON.parse(text) as { term: string; definition: string }[];
        return parsed.map(i => ({ front: i.term, back: i.definition })).filter(c => c.front && c.back);
      }
      if (text.startsWith('{')) {
        const parsed = JSON.parse(text) as Record<string, string>;
        return Object.entries(parsed).map(([term, definition]) => ({ front: term, back: definition })).filter(c => c.front && c.back);
      }
    } catch {
      return null; // signal JSON parse error
    }
    // Line-by-line: term: def | term - def | term; def | term\tdef
    const cards: FlashcardItem[] = [];
    for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
      const sep = line.includes('\t') ? '\t'
        : line.includes(': ') ? ': '
        : line.includes(' - ') ? ' - '
        : line.includes('; ') ? '; '
        : null;
      if (!sep) continue;
      const [term, ...rest] = line.split(sep);
      if (term && rest.length) cards.push({ front: term.trim(), back: rest.join(sep).trim() });
    }
    return cards.length ? cards : [];
  }, []);

  const importParseResult = useMemo((): { cards: FlashcardItem[] | null; jsonError: boolean } => {
    const text = importText.trim();
    if (!text) return { cards: null, jsonError: false };
    if (text.startsWith('[') || text.startsWith('{')) {
      try { JSON.parse(text); } catch { return { cards: null, jsonError: true }; }
    }
    return { cards: parseVocabInput(importText), jsonError: false };
  }, [importText, parseVocabInput]);

  const parsedPreview = importParseResult.cards;
  const importJsonError = importParseResult.jsonError;

  const importVocab = useCallback(() => {
    if (!importText.trim() || !data) return;
    const newCards = parseVocabInput(importText);
    if (!newCards || newCards.length === 0) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return { ...c, flashcards: [...c.flashcards, ...newCards] };
          }),
        },
      },
    }));
    setImportText('');
    setVocabMode('list');
  }, [importText, data, setData, course.id, parseVocabInput]);

  const exportVocab = useCallback(() => {
    const text = vocab.map(v => `${v.term}: ${v.definition}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.shortName || course.name}-vocab.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [vocab, course]);

  // Quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState('');
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [quizItems, setQuizItems] = useState<VocabItem[]>([]);

  const startQuiz = useCallback(() => {
    const shuffled = [...vocab].sort(() => Math.random() - 0.5);
    setQuizItems(shuffled);
    setQuizIndex(0);
    setQuizAnswer('');
    setQuizResult(null);
    setQuizScore({ correct: 0, total: 0 });
    setVocabMode('quiz');
  }, [vocab]);

  const checkAnswer = useCallback(() => {
    if (!quizItems[quizIndex]) return;
    const correct = quizAnswer.toLowerCase().trim() === quizItems[quizIndex].definition.toLowerCase().trim();
    setQuizResult(correct ? 'correct' : 'wrong');
    setQuizScore(prev => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  }, [quizAnswer, quizIndex, quizItems]);

  const nextQuizItem = useCallback(() => {
    if (quizIndex + 1 >= quizItems.length) {
      setVocabMode('list');
      return;
    }
    setQuizIndex(i => i + 1);
    setQuizAnswer('');
    setQuizResult(null);
  }, [quizIndex, quizItems.length]);

  // Drill state
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillFlipped, setDrillFlipped] = useState(false);
  const [drillAutoAdvance, setDrillAutoAdvance] = useState(false);
  const drillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startDrill = useCallback(() => {
    setDrillIndex(0);
    setDrillFlipped(false);
    setVocabMode('drill');
  }, []);

  useEffect(() => {
    if (vocabMode === 'drill' && drillAutoAdvance && drillFlipped) {
      drillTimerRef.current = setTimeout(() => {
        setDrillFlipped(false);
        setDrillIndex(i => (i + 1) % vocab.length);
      }, 3000);
      return () => { if (drillTimerRef.current) clearTimeout(drillTimerRef.current); };
    }
  }, [vocabMode, drillAutoAdvance, drillFlipped, vocab.length]);

  const masteredCount = masteredSet.size;

  // List mode
  if (vocabMode === 'list') {
    return (
      <div>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: accentColor }}>{vocab.length}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--green)' }}>{masteredCount}</div>
            <div className="stat-label">Mastered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--yellow)' }}>{vocab.length - masteredCount}</div>
            <div className="stat-label">Learning</div>
          </div>
        </div>

        {/* Actions row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={startQuiz} disabled={vocab.length === 0}>
            <Trophy size={13} /> Quiz
          </button>
          <button className="btn btn-sm" onClick={startDrill} disabled={vocab.length === 0}>
            <Play size={13} /> Drill
          </button>
          <button className="btn btn-sm" onClick={() => setVocabMode('import')}>
            <Upload size={13} /> Import
          </button>
          <button className="btn btn-sm" onClick={exportVocab} disabled={vocab.length === 0}>
            <Download size={13} /> Export
          </button>
        </div>

        {/* Quick add */}
        <div className="card mb-4">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <Plus size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Quick Add
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newTerm}
              onChange={e => setNewTerm(e.target.value)}
              placeholder="Term"
              style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && document.getElementById('vocab-def-input')?.focus()}
            />
            <input
              id="vocab-def-input"
              value={newDef}
              onChange={e => setNewDef(e.target.value)}
              placeholder="Definition"
              style={{ flex: 2 }}
              onKeyDown={e => e.key === 'Enter' && addVocab()}
            />
            <button className="btn btn-primary btn-sm" onClick={addVocab}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Search + View Toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder={imeMode === 'hiragana' ? 'Type romaji → hiragana…' : imeMode === 'katakana' ? 'Type romaji → katakana…' : 'Search vocab...'}
              style={{ width: '100%', paddingLeft: 32, paddingRight: imeMode !== 'off' ? 64 : 28 }}
            />
            {/* IME mode badge */}
            {imeMode !== 'off' && (
              <span style={{
                position: 'absolute', right: searchTerm ? 28 : 8, top: '50%', transform: 'translateY(-50%)',
                fontSize: 13, fontWeight: 700, color: 'var(--accent)', pointerEvents: 'none',
                lineHeight: 1,
              }}>
                {imeMode === 'hiragana' ? 'あ' : 'ア'}
              </span>
            )}
            {searchTerm && (
              <button onClick={clearSearch} style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}>
                <X size={14} />
              </button>
            )}
          </div>
          {/* IME toggle: Off → あ → ア → Off */}
          <button
            className="btn-icon"
            onClick={handleImeModeToggle}
            title={`IME: ${imeMode === 'off' ? 'Off — click for Hiragana' : imeMode === 'hiragana' ? 'Hiragana — click for Katakana' : 'Katakana — click to disable'}`}
            style={{
              flexShrink: 0,
              fontFamily: 'serif',
              fontSize: 14,
              fontWeight: 700,
              color: imeMode !== 'off' ? 'var(--accent)' : 'var(--text-muted)',
              border: imeMode !== 'off' ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 6,
              width: 32,
              height: 32,
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {imeMode === 'off' ? 'A' : imeMode === 'hiragana' ? 'あ' : 'ア'}
          </button>
          <button
            className="btn-icon"
            onClick={() => { setViewMode(viewMode === 'cards' ? 'rows' : 'cards'); setFlippedCards(new Set()); }}
            title={viewMode === 'cards' ? 'Switch to list view' : 'Switch to card view'}
            style={{ flexShrink: 0 }}
          >
            {viewMode === 'cards' ? <LayoutList size={16} /> : <LayoutGrid size={16} />}
          </button>
        </div>

        {/* Vocab list */}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={40} />
            <h3>No vocabulary yet</h3>
            <p>Add terms above or import from a text file.</p>
          </div>
        ) : (() => {
          const totalPages = Math.ceil(filtered.length / perPage);
          const pageItems = filtered.slice(page * perPage, (page + 1) * perPage);

          return (
            <>
              {viewMode === 'cards' ? (
                <div className="vocab-grid">
                  {pageItems.map((v, i) => {
                    const globalIdx = page * perPage + i;
                    const isMastered = masteredSet.has(v.term);
                    const isFlipped = flippedCards.has(globalIdx);
                    const originalIndex = vocab.findIndex(orig => orig.term === v.term && orig.definition === v.definition);
                    return (
                      <div key={`${v.term}-${globalIdx}`} className="vocab-card-wrap">
                        <div className={`vocab-card${isFlipped ? ' flipped' : ''}`} onClick={() => {
                          setFlippedCards(prev => {
                            const s = new Set(prev);
                            if (s.has(globalIdx)) s.delete(globalIdx); else s.add(globalIdx);
                            return s;
                          });
                        }}>
                          <div className="vocab-card-face vocab-card-front">
                            <div className="vocab-card-badge" onClick={e => {
                              e.stopPropagation();
                              const next = new Set(masteredSet);
                              if (isMastered) next.delete(v.term); else next.add(v.term);
                              setMasteredSet(next);
                            }} style={{ color: isMastered ? 'var(--green)' : 'var(--text-dim)', cursor: 'pointer' }}>
                              {isMastered ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 4 }}>Term</div>
                            <div className="vocab-card-term">{v.term}</div>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 8 }}>Tap to flip</div>
                          </div>
                          <div className="vocab-card-face vocab-card-back">
                            <button onClick={e => {
                              e.stopPropagation();
                              removeVocab(originalIndex >= 0 ? originalIndex : i);
                            }} style={{ position: 'absolute', top: 5, right: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 0 }}>
                              <Trash2 size={11} />
                            </button>
                            <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 700, marginBottom: 4 }}>Definition</div>
                            <div className="vocab-card-def">{v.definition}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {pageItems.map((v, i) => {
                    const isMastered = masteredSet.has(v.term);
                    const originalIndex = vocab.findIndex(orig => orig.term === v.term && orig.definition === v.definition);
                    return (
                      <div key={`${v.term}-${i}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                        border: '1px solid var(--border)', transition: 'border-color 0.15s',
                      }}>
                        <button
                          onClick={() => {
                            const next = new Set(masteredSet);
                            if (isMastered) next.delete(v.term); else next.add(v.term);
                            setMasteredSet(next);
                          }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                            color: isMastered ? 'var(--green)' : 'var(--text-dim)',
                          }}
                        >
                          {isMastered ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.term}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.definition}
                          </div>
                        </div>
                        <button
                          onClick={() => removeVocab(originalIndex >= 0 ? originalIndex : i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="vocab-pagination">
                  <button className="btn btn-sm" disabled={page === 0} onClick={() => { setPage(p => p - 1); setFlippedCards(new Set()); }}>
                    <ChevronLeft size={13} />
                  </button>
                  {Array.from({ length: totalPages }, (_, p) => (
                    <button
                      key={p}
                      className={`btn btn-sm${p === page ? ' btn-primary' : ''}`}
                      onClick={() => { setPage(p); setFlippedCards(new Set()); }}
                    >
                      {p + 1}
                    </button>
                  ))}
                  <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => { setPage(p => p + 1); setFlippedCards(new Set()); }}>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
                {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}
              </div>
            </>
          );
        })()}
      </div>
    );
  }

  // Import mode
  if (vocabMode === 'import') {
    const JSON_TEMPLATE = `[\n  {"term": "telomere", "definition": "protective cap at chromosome ends"},\n  {"term": "importin", "definition": "protein that shuttles cargo into nucleus"}\n]`;
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setVocabMode('list')}>
            <ArrowLeft size={13} /> Back
          </button>
          <h3 style={{ fontSize: 14, fontWeight: 700 }}>Import Vocabulary</h3>
        </div>
        <div className="card">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
            Paste your vocab list. Supported formats:
          </p>
          <ul style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12, paddingLeft: 16, lineHeight: 1.8 }}>
            <li><code>term: definition</code> (one per line)</li>
            <li><code>term - definition</code> (one per line)</li>
            <li><code>term; definition</code> (Anki-style)</li>
            <li><code>term[Tab]definition</code> (TSV / Excel paste)</li>
            <li><code>{'[{"term":"...","definition":"..."}]'}</code> (JSON array)</li>
            <li><code>{'{"term":"definition"}'}</code> (JSON object map)</li>
          </ul>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
            <button
              className="btn btn-sm"
              onClick={() => setImportText(JSON_TEMPLATE)}
              title="Pre-fill JSON template"
            >
              Copy JSON Template
            </button>
          </div>
          <textarea
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder={'photosynthesis: The process by which plants convert light energy\nosmosis - Movement of water across a membrane'}
            rows={10}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          />
          {importJsonError && (
            <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 6 }}>
              ⚠ Invalid JSON — check brackets and quotes
            </div>
          )}
          {!importJsonError && parsedPreview !== null && (
            <div style={{ fontSize: 12, color: parsedPreview.length > 0 ? 'var(--accent)' : 'var(--text-dim)', marginTop: 6 }}>
              {parsedPreview.length > 0 ? `✓ ${parsedPreview.length} card${parsedPreview.length !== 1 ? 's' : ''} detected` : 'No cards detected — check format'}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={importVocab} disabled={!parsedPreview || parsedPreview.length === 0 || importJsonError}>
              <Upload size={14} /> Import
            </button>
            <button className="btn btn-secondary" onClick={() => setVocabMode('list')}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz mode
  if (vocabMode === 'quiz') {
    const current = quizItems[quizIndex];
    const isFinished = !current;

    if (isFinished) {
      return (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <Trophy size={40} style={{ color: accentColor, marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Quiz Complete!</h3>
          <div style={{ fontSize: 32, fontWeight: 900, color: accentColor, marginBottom: 4 }}>
            {quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0}%
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            {quizScore.correct} / {quizScore.total} correct
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={startQuiz}>Try Again</button>
            <button className="btn" onClick={() => setVocabMode('list')}>Back to List</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setVocabMode('list')}>
            <X size={13} /> Exit
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {quizIndex + 1} / {quizItems.length}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
            {quizScore.correct} correct
          </span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 20 }}>
          <div className="progress-fill" style={{ width: `${((quizIndex + 1) / quizItems.length) * 100}%`, background: accentColor }} />
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
            Define this term
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>{current.term}</div>
          <input
            value={quizAnswer}
            onChange={e => setQuizAnswer(e.target.value)}
            placeholder="Type the definition..."
            style={{ width: '100%', textAlign: 'center', fontSize: 14 }}
            onKeyDown={e => {
              if (e.key === 'Enter' && quizResult === null) checkAnswer();
              if (e.key === 'Enter' && quizResult !== null) nextQuizItem();
            }}
            disabled={quizResult !== null}
            autoFocus
          />
          {quizResult && (
            <div style={{
              marginTop: 12, padding: 12, borderRadius: 'var(--radius-sm)',
              background: quizResult === 'correct' ? 'var(--green-dim)' : 'var(--red-dim)',
              border: `1px solid ${quizResult === 'correct' ? 'var(--green)' : 'var(--red)'}`,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: quizResult === 'correct' ? 'var(--green)' : 'var(--red)' }}>
                {quizResult === 'correct' ? 'Correct!' : 'Incorrect'}
              </div>
              {quizResult === 'wrong' && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  Answer: {current.definition}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {quizResult === null ? (
            <button className="btn btn-primary" onClick={checkAnswer}>Check Answer</button>
          ) : (
            <button className="btn btn-primary" onClick={nextQuizItem}>
              {quizIndex + 1 >= quizItems.length ? 'Finish' : 'Next'} <SkipForward size={14} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Drill mode (flashcard flip)
  if (vocabMode === 'drill') {
    const current = vocab[drillIndex];
    if (!current) {
      return (
        <div className="empty-state">
          <BookOpen size={40} />
          <h3>No cards to drill</h3>
          <button className="btn" onClick={() => setVocabMode('list')} style={{ marginTop: 12 }}>Back</button>
        </div>
      );
    }

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setVocabMode('list')}>
            <X size={13} /> Exit
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {drillIndex + 1} / {vocab.length}
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setDrillAutoAdvance(!drillAutoAdvance)}
            style={{
              borderColor: drillAutoAdvance ? accentColor : undefined,
              color: drillAutoAdvance ? accentColor : undefined,
            }}
          >
            <Play size={13} /> Auto
          </button>
        </div>
        <div className="progress-bar" style={{ marginBottom: 20 }}>
          <div className="progress-fill" style={{ width: `${((drillIndex + 1) / vocab.length) * 100}%`, background: accentColor }} />
        </div>

        {/* Flashcard */}
        <div
          onClick={() => setDrillFlipped(!drillFlipped)}
          style={{
            minHeight: 220, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 32, borderRadius: 'var(--radius)',
            background: drillFlipped ? 'var(--bg-secondary)' : 'var(--bg-card)',
            border: `1px solid ${drillFlipped ? accentColor + '40' : 'var(--border)'}`,
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>
            {drillFlipped ? 'Definition' : 'Term'}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.5 }}>
            {drillFlipped ? current.definition : current.term}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 12 }}>Tap to flip</div>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn" onClick={() => { setDrillIndex(Math.max(0, drillIndex - 1)); setDrillFlipped(false); }}>
            <RotateCcw size={14} /> Prev
          </button>
          <button className="btn btn-primary" onClick={() => { setDrillIndex((drillIndex + 1) % vocab.length); setDrillFlipped(false); }}>
            Next <SkipForward size={14} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
