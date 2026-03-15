import { useState, useMemo } from 'react';
import { Layers, Plus, XCircle, CheckCircle, GripVertical, BarChart3, Trophy, RotateCcw } from 'lucide-react';
import { useStore } from '../../store';
import { shuffleArray, uid, cardStyle, SubjectPicker } from './learnHelpers';

interface MatchPair {
  id: string;
  term: string;
  definition: string;
}

interface MatchRoundStats {
  round: number;
  totalPairs: number;
  correctOnFirst: number;
  mistakes: number;
  timeMs: number;
}

export default function MatchMode() {
  const { courses, data, updatePluginData, matchSets: storedMatchSets, saveMatchSet } = useStore();
  const [phase, setPhase] = useState<'setup' | 'play' | 'results'>('setup');
  const [subject, setSubject] = useState('');
  const [savedMsg, setSavedMsg] = useState('');
  const [allPairs, setAllPairs] = useState<MatchPair[]>([]);
  const [roundPairs, setRoundPairs] = useState<MatchPair[]>([]);
  const [shuffledTerms, setShuffledTerms] = useState<MatchPair[]>([]);
  const [shuffledDefs, setShuffledDefs] = useState<MatchPair[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [dragItem, setDragItem] = useState<string | null>(null);
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [round, setRound] = useState(1);
  const [roundStart, setRoundStart] = useState(0);
  const [stats, setStats] = useState<MatchRoundStats[]>([]);
  const [correctFirstTry, setCorrectFirstTry] = useState(0);
  const [pairsPerRound, setPairsPerRound] = useState(6);

  function startGame() {
    const course = courses.find(c => c.id === subject);
    const cards = course?.flashcards || courses.flatMap(c => c.flashcards || []);
    if (cards.length === 0) return;

    const pairs: MatchPair[] = cards.map((c, i) => ({
      id: uid(),
      term: c.front,
      definition: c.back,
    }));
    setAllPairs(shuffleArray(pairs));
    setRound(1);
    setStats([]);
    startRound(shuffleArray(pairs), 1);
  }

  function startRound(pairs: MatchPair[], roundNum: number) {
    const roundSlice = pairs.slice(
      (roundNum - 1) * pairsPerRound,
      roundNum * pairsPerRound
    );
    if (roundSlice.length === 0) {
      // All rounds done, wrap around for adaptive
      const wrongPairs = allPairs.filter(p => !stats.every(s => s.correctOnFirst === s.totalPairs));
      if (wrongPairs.length > 0) {
        setRoundPairs(shuffleArray(wrongPairs).slice(0, pairsPerRound));
      } else {
        setPhase('results');
        return;
      }
    } else {
      setRoundPairs(roundSlice);
    }

    const activePairs = roundSlice.length > 0 ? roundSlice : shuffleArray(pairs).slice(0, pairsPerRound);
    setRoundPairs(activePairs);
    setShuffledTerms(shuffleArray([...activePairs]));
    setShuffledDefs(shuffleArray([...activePairs]));
    setMatched(new Set());
    setMistakes(0);
    setCorrectFirstTry(0);
    setRoundStart(Date.now());
    setPhase('play');
  }

  function handleDragStart(pairId: string) {
    setDragItem(pairId);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(defPairId: string) {
    if (!dragItem) return;

    if (dragItem === defPairId) {
      // Correct match
      const newMatched = new Set(matched);
      newMatched.add(dragItem);
      setMatched(newMatched);
      setCorrectFirstTry(prev => prev + 1);

      // Check if round is complete
      if (newMatched.size === roundPairs.length) {
        const roundStat: MatchRoundStats = {
          round,
          totalPairs: roundPairs.length,
          correctOnFirst: correctFirstTry + 1,
          mistakes,
          timeMs: Date.now() - roundStart,
        };
        const newStats = [...stats, roundStat];
        setStats(newStats);

        // Save match set to store (persisted via IndexedDB)
        const courseName = courses.find(c => c.id === subject)?.name || subject || 'All Courses';
        const accuracy = roundStat.totalPairs > 0
          ? Math.round(((roundStat.totalPairs - roundStat.mistakes) / roundStat.totalPairs) * 100) : 100;
        const matchId = `match-${subject || 'all'}`;
        const prev = storedMatchSets.find(m => m.id === matchId);
        saveMatchSet({
          id: matchId,
          name: `${courseName} Match`,
          subject: subject || 'all',
          pairs: roundPairs.map(p => ({ term: p.term, definition: p.definition })),
          createdAt: prev?.createdAt || new Date().toISOString(),
          bestScore: Math.max(accuracy, prev?.bestScore ?? 0),
        });

        // Check mastery or next round
        const totalRounds = Math.ceil(allPairs.length / pairsPerRound);
        if (round >= totalRounds || (roundStat.mistakes === 0 && round >= 2)) {
          setPhase('results');
        } else {
          const nextRound = round + 1;
          setRound(nextRound);
          startRound(allPairs, nextRound);
        }
      }
    } else {
      // Wrong match
      setMistakes(prev => prev + 1);
      setWrongFlash(defPairId);
      setTimeout(() => setWrongFlash(null), 500);
    }
    setDragItem(null);
  }

  // Touch support
  const [touchDragId, setTouchDragId] = useState<string | null>(null);

  function handleTouchSelect(pairId: string) {
    if (matched.has(pairId)) return;
    if (touchDragId === pairId) {
      setTouchDragId(null);
      return;
    }
    setTouchDragId(pairId);
  }

  function handleTouchDrop(defPairId: string) {
    if (!touchDragId || matched.has(defPairId)) return;

    if (touchDragId === defPairId) {
      const newMatched = new Set(matched);
      newMatched.add(touchDragId);
      setMatched(newMatched);
      setCorrectFirstTry(prev => prev + 1);

      if (newMatched.size === roundPairs.length) {
        const roundStat: MatchRoundStats = {
          round,
          totalPairs: roundPairs.length,
          correctOnFirst: correctFirstTry + 1,
          mistakes,
          timeMs: Date.now() - roundStart,
        };
        const newStats = [...stats, roundStat];
        setStats(newStats);

        const courseName = courses.find(c => c.id === subject)?.name || subject || 'All Courses';
        const accuracy = roundStat.totalPairs > 0
          ? Math.round(((roundStat.totalPairs - roundStat.mistakes) / roundStat.totalPairs) * 100) : 100;
        const matchId2 = `match-${subject || 'all'}`;
        const prev2 = storedMatchSets.find(m => m.id === matchId2);
        saveMatchSet({
          id: matchId2,
          name: `${courseName} Match`,
          subject: subject || 'all',
          pairs: roundPairs.map(p => ({ term: p.term, definition: p.definition })),
          createdAt: prev2?.createdAt || new Date().toISOString(),
          bestScore: Math.max(accuracy, prev2?.bestScore ?? 0),
        });

        const totalRounds = Math.ceil(allPairs.length / pairsPerRound);
        if (round >= totalRounds || (roundStat.mistakes === 0 && round >= 2)) {
          setPhase('results');
        } else {
          const nextRound = round + 1;
          setRound(nextRound);
          startRound(allPairs, nextRound);
        }
      }
    } else {
      setMistakes(prev => prev + 1);
      setWrongFlash(defPairId);
      setTimeout(() => setWrongFlash(null), 500);
    }
    setTouchDragId(null);
  }

  // Custom match set creation
  const [showCreate, setShowCreate] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFolder, setCustomFolder] = useState('');
  const [customPairs, setCustomPairs] = useState<{ term: string; def: string }[]>([
    { term: '', def: '' }, { term: '', def: '' }, { term: '', def: '' },
  ]);
  const [bulkImport, setBulkImport] = useState('');
  const [showBulk, setShowBulk] = useState(false);

  // Get existing match set folders
  const matchFolders = useMemo(() => {
    const folders = new Set<string>();
    storedMatchSets.forEach(ms => { if (ms.folder) folders.add(ms.folder) });
    return Array.from(folders).sort();
  }, [storedMatchSets]);

  function addCustomPair() {
    setCustomPairs(prev => [...prev, { term: '', def: '' }]);
  }
  function updateCustomPair(i: number, field: 'term' | 'def', value: string) {
    setCustomPairs(prev => prev.map((p, j) => j === i ? { ...p, [field]: value } : p));
  }
  function removeCustomPair(i: number) {
    if (customPairs.length <= 2) return;
    setCustomPairs(prev => prev.filter((_, j) => j !== i));
  }
  function saveCustomSet() {
    const valid = customPairs.filter(p => p.term.trim() && p.def.trim());
    if (valid.length < 2) return;
    saveMatchSet({
      id: `match-custom-${Date.now()}`,
      name: customName.trim() || 'Custom Set',
      subject: 'custom',
      folder: customFolder.trim() || undefined,
      pairs: valid.map(p => ({ term: p.term.trim(), definition: p.def.trim() })),
      createdAt: new Date().toISOString(),
    });
    setCustomPairs([{ term: '', def: '' }, { term: '', def: '' }, { term: '', def: '' }]);
    setCustomName('');
    setCustomFolder('');
    setShowCreate(false);
    setSavedMsg('Match set saved!');
    setTimeout(() => setSavedMsg(''), 2000);
  }
  function importBulk() {
    const lines = bulkImport.split('\n').filter(l => l.trim());
    const pairs: { term: string; def: string }[] = [];
    for (const line of lines) {
      let parts = line.split(/\t/);
      if (parts.length < 2) parts = line.split(/,\s*/);
      if (parts.length < 2) parts = line.split(/:\s+/);
      if (parts.length < 2) parts = line.split(/\s+-\s+/);
      if (parts.length >= 2) {
        pairs.push({ term: parts[0].trim(), def: parts.slice(1).join(', ').trim() });
      }
    }
    if (pairs.length > 0) {
      setCustomPairs(pairs);
      setShowBulk(false);
      setBulkImport('');
    }
  }
  function playCustomSet(ms: { pairs: { term: string; definition: string }[] }) {
    const pairs: MatchPair[] = ms.pairs.map((p, i) => ({
      id: `custom-${i}-${Date.now()}`,
      term: p.term,
      definition: p.definition,
    }));
    setAllPairs(shuffleArray(pairs));
    setRound(1);
    setStats([]);
    startRound(shuffleArray(pairs), 1);
  }
  function deleteCustomSet(id: string) {
    if (!data) return;
    const existing = (data.pluginData as Record<string, unknown>).matchSets as typeof storedMatchSets || [];
    const updated = existing.filter(m => m.id !== id);
    updatePluginData({ matchSets: updated });
  }

  if (phase === 'setup') {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          Drag terms onto their matching definitions. Complete rounds with zero mistakes for mastery.
        </p>
        {savedMsg && <div style={{ padding: 8, marginBottom: 8, borderRadius: 'var(--radius-sm)', background: 'var(--green-dim)', color: 'var(--green)', fontSize: 12, fontWeight: 600 }}>{savedMsg}</div>}

        {/* Play from course flashcards */}
        <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs" style={{ fontWeight: 600 }}>Pairs per round:</span>
          {[4, 6, 8].map(n => (
            <button key={n} className={`btn btn-sm ${pairsPerRound === n ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPairsPerRound(n)} style={{ padding: '4px 10px', fontSize: 12 }}>
              {n}
            </button>
          ))}
        </div>
        <button className="btn btn-primary w-full mb-3" onClick={startGame}>
          <Layers size={14} /> Start Matching (From Flashcards)
        </button>

        {/* Create custom set */}
        <button className="btn btn-secondary w-full mb-3" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={14} /> {showCreate ? 'Hide' : 'Create Custom Match Set'}
        </button>

        {showCreate && (
          <div className="card mb-3" style={{ padding: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                placeholder="Set name..." style={{ flex: 2, fontSize: 12, padding: '6px 10px' }} />
              <input type="text" list="match-folders" value={customFolder} onChange={e => setCustomFolder(e.target.value)}
                placeholder="Folder (optional)" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} />
              <datalist id="match-folders">
                {matchFolders.map(f => <option key={f} value={f} />)}
              </datalist>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              <button className="btn btn-sm" onClick={() => setShowBulk(!showBulk)}>
                {showBulk ? 'Manual' : 'Bulk Import'}
              </button>
              {!showBulk && <button className="btn btn-sm" onClick={addCustomPair}><Plus size={12} /> Add Pair</button>}
            </div>

            {showBulk ? (
              <div>
                <textarea value={bulkImport} onChange={e => setBulkImport(e.target.value)}
                  placeholder={'Paste term-definition pairs (one per line)\nFormats: term\\tdefinition, term: definition, term - definition, term, definition'}
                  rows={6} style={{ width: '100%', fontSize: 11, resize: 'vertical', marginBottom: 8 }} />
                <button className="btn btn-primary btn-sm" onClick={importBulk}>Import Pairs</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {customPairs.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <input value={p.term} onChange={e => updateCustomPair(i, 'term', e.target.value)}
                      placeholder="Term" style={{ flex: 1, fontSize: 11, padding: '5px 8px' }} />
                    <input value={p.def} onChange={e => updateCustomPair(i, 'def', e.target.value)}
                      placeholder="Definition" style={{ flex: 2, fontSize: 11, padding: '5px 8px' }} />
                    {customPairs.length > 2 && (
                      <button onClick={() => removeCustomPair(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                        <XCircle size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button className="btn btn-primary btn-sm w-full" onClick={saveCustomSet}
              disabled={customPairs.filter(p => p.term.trim() && p.def.trim()).length < 2}>
              Save Match Set
            </button>
          </div>
        )}

        {/* Saved custom sets — grouped by folder */}
        {storedMatchSets.length > 0 && (() => {
          const byFolder = new Map<string, typeof storedMatchSets>();
          storedMatchSets.forEach(ms => {
            const f = ms.folder || 'Unfiled';
            if (!byFolder.has(f)) byFolder.set(f, []);
            byFolder.get(f)!.push(ms);
          });
          const folders = Array.from(byFolder.entries()).sort((a, b) => {
            if (a[0] === 'Unfiled') return 1;
            if (b[0] === 'Unfiled') return -1;
            return a[0].localeCompare(b[0]);
          });
          return (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 6, textTransform: 'uppercase' }}>
                Saved Sets ({storedMatchSets.length})
              </div>
              {folders.map(([folderName, sets]) => (
                <div key={folderName} style={{ marginBottom: 8 }}>
                  {folders.length > 1 && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {folderName}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {sets.slice(-10).reverse().map(ms => (
                      <div key={ms.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ms.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                            {ms.pairs.length} pairs {ms.bestScore != null ? `· ${ms.bestScore}%` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm btn-primary" onClick={() => playCustomSet(ms)} style={{ padding: '4px 8px', fontSize: 10 }}>
                            Play
                          </button>
                          <button onClick={() => deleteCustomSet(ms.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                            <XCircle size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Previous stats */}
        {storedMatchSets.length > 0 && (() => {
          const recent = storedMatchSets.filter(ms => ms.bestScore != null).slice(-5);
          if (recent.length === 0) return null;
          const avgScore = Math.round(recent.reduce((s, ms) => s + (ms.bestScore || 0), 0) / recent.length);
          return (
            <div className="text-xs text-muted">
              <BarChart3 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Last {recent.length} sets avg: {avgScore}% accuracy
            </div>
          );
        })()}
      </div>
    );
  }

  if (phase === 'play') {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="badge badge-accent" style={{ fontSize: 10 }}>Round {round}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs"><CheckCircle size={10} style={{ color: 'var(--green)' }} /> {matched.size}/{roundPairs.length}</span>
            <span className="text-xs"><XCircle size={10} style={{ color: 'var(--red)' }} /> {mistakes}</span>
          </div>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{
            width: `${(matched.size / roundPairs.length) * 100}%`,
            background: 'var(--green)',
          }} />
        </div>

        {/* Terms (draggable) */}
        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>TERMS</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {shuffledTerms.map(p => {
            const isMatched = matched.has(p.id);
            const isDragging = dragItem === p.id || touchDragId === p.id;
            return (
              <div
                key={'t-' + p.id}
                draggable={!isMatched}
                onDragStart={() => handleDragStart(p.id)}
                onClick={() => !isMatched && handleTouchSelect(p.id)}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${isMatched ? 'var(--green)' : isDragging ? 'var(--accent)' : 'var(--border)'}`,
                  background: isMatched ? 'var(--green-dim)' : isDragging ? 'var(--accent-glow)' : 'var(--bg-primary)',
                  cursor: isMatched ? 'default' : 'grab',
                  opacity: isMatched ? 0.5 : 1,
                  fontSize: 12, fontWeight: 600,
                  transition: 'all 0.15s',
                  userSelect: 'none',
                  textDecoration: isMatched ? 'line-through' : 'none',
                }}
              >
                <GripVertical size={10} style={{ verticalAlign: 'middle', marginRight: 4, opacity: 0.4 }} />
                {p.term}
              </div>
            );
          })}
        </div>

        {/* Definitions (drop targets) */}
        <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>DEFINITIONS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {shuffledDefs.map(p => {
            const isMatched = matched.has(p.id);
            const isWrong = wrongFlash === p.id;
            return (
              <div
                key={'d-' + p.id}
                onDragOver={!isMatched ? handleDragOver : undefined}
                onDrop={() => !isMatched && handleDrop(p.id)}
                onClick={() => touchDragId && !isMatched && handleTouchDrop(p.id)}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                  border: `2px dashed ${isMatched ? 'var(--green)' : isWrong ? 'var(--red)' : 'var(--border)'}`,
                  background: isMatched ? 'var(--green-dim)' : isWrong ? 'var(--red-dim)' : 'var(--bg-card)',
                  cursor: isMatched ? 'default' : 'pointer',
                  opacity: isMatched ? 0.5 : 1,
                  fontSize: 12, lineHeight: 1.5,
                  transition: 'all 0.15s',
                  textDecoration: isMatched ? 'line-through' : 'none',
                }}
              >
                {isMatched && <CheckCircle size={12} style={{ color: 'var(--green)', marginRight: 6, verticalAlign: 'middle' }} />}
                {p.definition}
              </div>
            );
          })}
        </div>

        {touchDragId && (
          <div className="text-xs text-center mt-2" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>
            Now tap the matching definition
          </div>
        )}
      </div>
    );
  }

  // Results
  const totalMistakes = stats.reduce((s, r) => s + r.mistakes, 0);
  const totalTime = stats.reduce((s, r) => s + r.timeMs, 0);
  const totalPairs = stats.reduce((s, r) => s + r.totalPairs, 0);
  const accuracy = totalPairs > 0 ? Math.round(((totalPairs - totalMistakes) / totalPairs) * 100) : 100;
  const mastered = stats.some(s => s.mistakes === 0);

  return (
    <div>
      <div className="text-center mb-3">
        <Trophy size={32} style={{ color: mastered ? 'var(--green)' : 'var(--yellow)', margin: '0 auto 8px' }} />
        <div style={{ fontSize: 24, fontWeight: 800 }}>
          {mastered ? 'Mastered!' : `${accuracy}% Accuracy`}
        </div>
        <div className="text-sm text-muted">
          {stats.length} rounds | {totalPairs} pairs | {Math.round(totalTime / 1000)}s total
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="text-center" style={{ ...cardStyle, padding: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{stats.length}</div>
          <div className="text-xs text-muted">Rounds</div>
        </div>
        <div className="text-center" style={{ ...cardStyle, padding: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{totalMistakes}</div>
          <div className="text-xs text-muted">Mistakes</div>
        </div>
        <div className="text-center" style={{ ...cardStyle, padding: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{accuracy}%</div>
          <div className="text-xs text-muted">Accuracy</div>
        </div>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-xs" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
          <span>Round {s.round}</span>
          <span>{s.correctOnFirst}/{s.totalPairs} first-try | {s.mistakes} mistakes | {(s.timeMs / 1000).toFixed(1)}s</span>
        </div>
      ))}
      <button className="btn btn-primary btn-sm mt-3 w-full" onClick={() => { setPhase('setup'); setStats([]); }}>
        <RotateCcw size={14} /> Play Again
      </button>
    </div>
  );
}
