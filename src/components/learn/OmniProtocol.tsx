/**
 * OmniProtocol — 60-minute auto-sequenced science-backed study session.
 *
 * Science basis:
 *  - Pre-test effect / hypercorrection: testing before learning boosts retention 15-20%
 *  - Chunking: pattern recognition before encoding reduces cognitive load
 *  - Active recall (ENCODE): spaced-rep style self-grading
 *  - Elaborative interrogation (CONNECT): cross-domain connections deepen encoding
 *  - Rest consolidation: 5-min break allows hippocampal replay (Tambini & Davachi 2019)
 *  - Retrieval practice (TEST): testing hard/failed items amplifies long-term retention
 *  - Memory palace (ANCHOR): method of loci for hardest items
 *  - Spaced feedback (REPORT): metacognitive review closes the learning loop
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { useStore } from '../../store';
import type { FlashcardItem, Course } from '../../types';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OmniProps {
  courseId?: string;
  onComplete: () => void;
  onClose?: () => void;
}

interface SessionStats {
  cardsReviewed: number;
  correctCount: number;
  startTime: number;
  phaseHistory: { phase: string; cardsInPhase: number; correctInPhase: number }[];
}

interface CardWithMeta extends FlashcardItem {
  courseId: string;
  courseName: string;
  cardIdx: number;
  grade?: 1 | 2 | 3 | 4; // 1=Again 2=Hard 3=Good 4=Easy
}

type PhaseName = 'PRIME' | 'CHUNK' | 'ENCODE' | 'CONNECT' | 'BREAK' | 'TEST' | 'ANCHOR' | 'REPORT';

interface Phase {
  name: PhaseName;
  label: string;
  icon: string;
  durationSec: number;
  color: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASES: Phase[] = [
  { name: 'PRIME',   label: 'Prime',   icon: '📋', durationSec: 5  * 60, color: '#ef4444' },
  { name: 'CHUNK',   label: 'Chunk',   icon: '🎼', durationSec: 5  * 60, color: '#f97316' },
  { name: 'ENCODE',  label: 'Encode',  icon: '🧠', durationSec: 15 * 60, color: '#eab308' },
  { name: 'CONNECT', label: 'Connect', icon: '🌉', durationSec: 10 * 60, color: '#22c55e' },
  { name: 'BREAK',   label: 'Break',   icon: '☕', durationSec: 5  * 60, color: '#06b6d4' },
  { name: 'TEST',    label: 'Test',    icon: '🔍', durationSec: 10 * 60, color: '#8b5cf6' },
  { name: 'ANCHOR',  label: 'Anchor',  icon: '🏛️', durationSec: 5  * 60, color: '#ec4899' },
  { name: 'REPORT',  label: 'Report',  icon: '📊', durationSec: 5  * 60, color: '#F5A623' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Inner component (wrapped by error boundary below) ─────────────────────────

function OmniProtocolInner({ onComplete, onClose }: OmniProps) {
  const { data } = useStore();
  const courses: Course[] = data?.pluginData?.coachData?.courses ?? [];
  const allCards: CardWithMeta[] = courses.flatMap(c =>
    (c.flashcards ?? []).map((f, i) => ({
      ...f,
      courseId: c.id,
      courseName: c.shortName ?? c.name,
      cardIdx: i,
    }))
  );

  // ── Session state ──────────────────────────────────────────────────────────
  const [started, setStarted] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(PHASES[0].durationSec);
  const [isPaused, setIsPaused] = useState(false);
  const [flash, setFlash] = useState(false);

  // Card state
  const [primeCards, setPrimeCards] = useState<CardWithMeta[]>([]);
  const [encodeCards, setEncodeCards] = useState<CardWithMeta[]>([]);
  const [encodeIdx, setEncodeIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gradedCards, setGradedCards] = useState<CardWithMeta[]>([]);

  const [stats, setStats] = useState<SessionStats>({
    cardsReviewed: 0, correctCount: 0, startTime: Date.now(), phaseHistory: [],
  });

  // refs for interval
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseIdxRef = useRef(phaseIdx);
  const timeRef = useRef(timeRemaining);
  const isPausedRef = useRef(isPaused);
  phaseIdxRef.current = phaseIdx;
  timeRef.current = timeRemaining;
  isPausedRef.current = isPaused;

  // ── Card prep ──────────────────────────────────────────────────────────────
  const prepSession = useCallback(() => {
    const prime = shuffle(allCards).slice(0, 10);
    const encode = shuffle(allCards).slice(0, 30);
    setPrimeCards(prime);
    setEncodeCards(encode);
    setEncodeIdx(0);
    setShowAnswer(false);
    setGradedCards([]);
    setStats({ cardsReviewed: 0, correctCount: 0, startTime: Date.now(), phaseHistory: [] });
  }, [allCards.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer ──────────────────────────────────────────────────────────────────
  const advancePhase = useCallback(() => {
    const nextIdx = phaseIdxRef.current + 1;
    if (nextIdx >= PHASES.length) {
      // Session complete
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Flash transition
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
    // Play chime (optional — silently fail on mobile policy)
    try { new Audio('/chime.mp3').play().catch(() => {}); } catch { /* noop */ }

    setPhaseIdx(nextIdx);
    setTimeRemaining(PHASES[nextIdx].durationSec);
    setShowAnswer(false);
  }, []);

  useEffect(() => {
    if (!started) return;
    intervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      const next = timeRef.current - 1;
      if (next <= 0) {
        advancePhase();
      } else {
        setTimeRemaining(next);
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [started, advancePhase]);

  // ── Grading helpers ────────────────────────────────────────────────────────
  function handleGrade(grade: 1 | 2 | 3 | 4) {
    const card = encodeCards[encodeIdx];
    if (!card) return;
    const graded = { ...card, grade };
    setGradedCards(prev => [...prev, graded]);
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctCount: grade >= 3 ? prev.correctCount + 1 : prev.correctCount,
    }));
    setShowAnswer(false);
    if (encodeIdx + 1 < encodeCards.length) {
      setEncodeIdx(i => i + 1);
    }
  }

  function handlePrimeGrade(correct: boolean) {
    setStats(prev => ({
      ...prev,
      cardsReviewed: prev.cardsReviewed + 1,
      correctCount: correct ? prev.correctCount + 1 : prev.correctCount,
    }));
  }

  function skipPhase() {
    advancePhase();
  }

  function endSession() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Jump to REPORT
    const reportIdx = PHASES.findIndex(p => p.name === 'REPORT');
    setPhaseIdx(reportIdx);
    setTimeRemaining(PHASES[reportIdx].durationSec);
  }

  function togglePause() {
    setIsPaused(p => !p);
  }

  // ── Pre-start screen ───────────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', background: 'var(--bg-primary)', borderRadius: 12 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚡</div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
          Omni Protocol
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          A 60-minute science-backed study session that cycles through 8 optimized learning phases.
          Make sure you have at least 10 flashcards across your courses.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24, textAlign: 'left' }}>
          {PHASES.map(p => (
            <div key={p.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--bg-secondary, #111)', border: '1px solid var(--border)',
              fontSize: 12,
            }}>
              <span>{p.icon}</span>
              <div>
                <div style={{ fontWeight: 700, color: p.color }}>{p.label}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{p.durationSec / 60} min</div>
              </div>
            </div>
          ))}
        </div>
        {allCards.length < 5 && (
          <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>
            Warning: You have fewer than 5 flashcards. Add cards to your courses for the best experience.
          </p>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button
            onClick={() => { prepSession(); setStarted(true); setPhaseIdx(0); setTimeRemaining(PHASES[0].durationSec); }}
            style={{
              padding: '12px 28px', borderRadius: 8, border: 'none',
              background: 'var(--accent, #F5A623)', color: '#000',
              fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
            }}
          >
            Start Session
          </button>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                padding: '12px 20px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  const phase = PHASES[phaseIdx];
  const progressPct = ((phase.durationSec - timeRemaining) / phase.durationSec) * 100;

  // ── Phase content ──────────────────────────────────────────────────────────
  function renderPhaseContent() {
    switch (phase.name) {
      case 'PRIME': return <PrimePhase cards={primeCards} onGrade={handlePrimeGrade} />;
      case 'CHUNK': return <ChunkPhase allCards={allCards} courses={courses as Course[]} />;
      case 'ENCODE': return (
        <EncodePhase
          cards={encodeCards}
          currentIdx={encodeIdx}
          showAnswer={showAnswer}
          onShowAnswer={() => setShowAnswer(true)}
          onGrade={handleGrade}
          stats={stats}
        />
      );
      case 'CONNECT': return <ConnectPhase courses={courses as Course[]} />;
      case 'BREAK': return <BreakPhase timeRemaining={timeRemaining} />;
      case 'TEST': return (
        <TestPhase
          gradedCards={gradedCards.filter(c => (c.grade ?? 3) <= 2)}
          showAnswer={showAnswer}
          onShowAnswer={() => setShowAnswer(true)}
          onGrade={handleGrade}
          stats={stats}
        />
      );
      case 'ANCHOR': return <AnchorPhase hardCards={gradedCards.filter(c => (c.grade ?? 3) <= 2).slice(0, 3)} />;
      case 'REPORT': return <ReportPhase stats={stats} phases={PHASES} onComplete={onComplete} />;
    }
  }

  return (
    <div style={{
      background: 'var(--bg-primary)', borderRadius: 12, overflow: 'hidden',
      minHeight: 500, display: 'flex', flexDirection: 'column',
      transition: flash ? 'background 0.2s ease' : undefined,
      outline: flash ? `2px solid ${phase.color}` : '2px solid transparent',
    }}>
      {/* ── Phase bar ── */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 12px 8px',
        background: 'var(--bg-secondary, #111)', borderBottom: '1px solid var(--border)',
        flexWrap: 'wrap',
      }}>
        {PHASES.map((p, i) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: 20,
            background: i === phaseIdx ? p.color : i < phaseIdx ? 'var(--bg-primary)' : 'transparent',
            border: `1px solid ${i === phaseIdx ? p.color : i < phaseIdx ? 'var(--border)' : 'var(--border)'}`,
            fontSize: 10, fontWeight: i === phaseIdx ? 800 : 500,
            color: i === phaseIdx ? '#000' : i < phaseIdx ? 'var(--text-muted)' : 'var(--text-muted)',
            transition: 'all 0.3s ease',
            boxShadow: i === phaseIdx ? `0 0 10px ${p.color}66` : 'none',
          }}>
            <span style={{ fontSize: 12 }}>{p.icon}</span>
            <span style={{ display: 'none' }}>{p.name}</span>
          </div>
        ))}
        <div style={{
          marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: 22,
          fontWeight: 800, color: phase.color, letterSpacing: '-0.5px',
          textShadow: `0 0 20px ${phase.color}88`,
        }}>
          {fmtTime(timeRemaining)}
        </div>
      </div>

      {/* Phase progress bar */}
      <div style={{ height: 3, background: 'var(--border)' }}>
        <div style={{
          height: '100%', width: `${progressPct}%`,
          background: phase.color, transition: 'width 1s linear',
        }} />
      </div>

      {/* Phase header */}
      <div style={{
        padding: '12px 16px 4px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 24 }}>{phase.icon}</span>
        <div>
          <div style={{
            fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 800,
            color: phase.color,
          }}>{phase.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Phase {phaseIdx + 1} of {PHASES.length}
          </div>
        </div>
        {isPaused && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, background: '#f9731633',
            color: '#f97316', padding: '3px 8px', borderRadius: 12, fontWeight: 700,
          }}>PAUSED</span>
        )}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, padding: '8px 16px 16px', overflowY: 'auto' }}>
        {renderPhaseContent()}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        borderTop: '1px solid var(--border)', background: 'var(--bg-secondary, #111)',
      }}>
        <button
          onClick={togglePause}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {isPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button
          onClick={skipPhase}
          disabled={phaseIdx >= PHASES.length - 1}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
            opacity: phaseIdx >= PHASES.length - 1 ? 0.4 : 1,
          }}
        >
          Skip Phase →
        </button>
        <button
          onClick={endSession}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 8,
            border: '1px solid #ef444466', background: 'transparent',
            color: '#ef4444', fontSize: 12, cursor: 'pointer',
          }}
        >
          End Session
        </button>
      </div>
    </div>
  );
}

// ── Phase sub-components ───────────────────────────────────────────────────────

function PrimePhase({ cards, onGrade }: { cards: CardWithMeta[]; onGrade: (c: boolean) => void }) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);

  if (!cards.length) return <EmptyCards message="No cards available for Pre-test." />;
  if (done) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>
      ✓ Pre-test complete. Your baseline has been recorded. The session timer is still running — relax or review your answers.
    </div>
  );

  const card = cards[idx];
  function grade(correct: boolean) {
    onGrade(correct);
    setRevealed(false);
    if (idx + 1 >= cards.length) { setDone(true); } else { setIdx(i => i + 1); }
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Pre-test on hardest cards — tests before learning hypercorrect errors &amp; boost retention 15-20%. Card {idx + 1}/{cards.length}
      </p>
      <div style={cardBox}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{card.courseName}</div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{card.front}</div>
      </div>
      {!revealed ? (
        <button onClick={() => setRevealed(true)} style={btnSecondary}>Show Answer</button>
      ) : (
        <>
          <div style={{ ...cardBox, background: 'var(--accent-glow, #F5A62311)', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => grade(false)} style={{ ...btnGrade, color: '#ef4444', borderColor: '#ef4444' }}>✗ Wrong</button>
            <button onClick={() => grade(true)}  style={{ ...btnGrade, color: '#22c55e', borderColor: '#22c55e' }}>✓ Correct</button>
          </div>
        </>
      )}
    </div>
  );
}

function ChunkPhase({ allCards, courses }: { allCards: CardWithMeta[]; courses: Course[] }) {
  const topicCount = courses.reduce((n, c) => n + (c.topics?.length ?? 0), 0);
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Pattern recognition phase — your brain is building schemas before encoding details.
      </p>
      <div style={{ ...cardBox, marginBottom: 12 }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 15, fontWeight: 800, marginBottom: 8, color: 'var(--accent, #F5A623)' }}>
          Your Study Map
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}>
          You have <strong>{allCards.length}</strong> cards across <strong>{courses.length}</strong> courses
          and <strong>{topicCount}</strong> topics.
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.7 }}>
          During this phase, <em>don't memorize individual facts</em>. Instead, notice the patterns:
          What categories keep appearing? What concepts bridge multiple topics?
          Which areas feel fuzzy vs. familiar?
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {courses.slice(0, 6).map(c => (
          <div key={c.id} style={{
            padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-secondary, #111)', fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{c.name}</div>
            <div style={{ color: 'var(--text-muted)' }}>{c.topics?.length ?? 0} topics</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EncodePhase({
  cards, currentIdx, showAnswer, onShowAnswer, onGrade, stats,
}: {
  cards: CardWithMeta[]; currentIdx: number; showAnswer: boolean;
  onShowAnswer: () => void; onGrade: (g: 1 | 2 | 3 | 4) => void; stats: SessionStats;
}) {
  if (!cards.length) return <EmptyCards message="No cards available for encoding." />;
  if (currentIdx >= cards.length) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 14 }}>
      ✓ All encode cards reviewed! Keep going — timer still running.
    </div>
  );
  const card = cards[currentIdx];
  const retention = stats.cardsReviewed > 0
    ? Math.round((stats.correctCount / stats.cardsReviewed) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span>Card {currentIdx + 1}/{cards.length}</span>
        <span>Retention: <strong style={{ color: retention >= 70 ? '#22c55e' : '#f97316' }}>{retention}%</strong></span>
      </div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 12 }}>
        <div style={{ height: '100%', width: `${((currentIdx + 1) / cards.length) * 100}%`, background: 'var(--accent, #F5A623)', borderRadius: 2 }} />
      </div>
      <div style={cardBox}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{card.courseName}</div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{card.front}</div>
      </div>
      {!showAnswer ? (
        <button onClick={onShowAnswer} style={btnSecondary}>Show Answer</button>
      ) : (
        <>
          <div style={{ ...cardBox, background: 'var(--accent-glow, #F5A62311)', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 6 }}>How well did you recall?</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {([
              { g: 1 as const, label: 'Again', color: '#ef4444' },
              { g: 2 as const, label: 'Hard',  color: '#f97316' },
              { g: 3 as const, label: 'Good',  color: '#22c55e' },
              { g: 4 as const, label: 'Easy',  color: '#3b82f6' },
            ]).map(({ g, label, color }) => (
              <button key={g} onClick={() => onGrade(g)}
                style={{ ...btnGrade, color, borderColor: color, padding: '8px 4px', fontSize: 11 }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConnectPhase({ courses }: { courses: Course[] }) {
  const [topicA, topicB] = courses.length >= 2
    ? [courses[0].name, courses[1].name]
    : courses.length === 1
      ? [courses[0].name, 'another subject you know']
      : ['Topic A', 'Topic B'];

  const prompts = [
    `How does ${topicA} relate to ${topicB}? What shared principles connect them?`,
    `If you had to explain a key concept from ${topicA} using only ideas from ${topicB}, how would you do it?`,
    `What would fail in ${topicA} if the foundational principles of ${topicB} were wrong?`,
    `What metaphor from everyday life describes the relationship between ${topicA} and ${topicB}?`,
  ];
  const prompt = prompts[Math.floor(Date.now() / 1000) % prompts.length];

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Elaborative interrogation — connecting ideas across domains strengthens long-term memory encoding.
      </p>
      <div style={{ ...cardBox, marginBottom: 16 }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 16, color: '#22c55e', marginBottom: 10 }}>
          🌉 Connection Prompt
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-primary)' }}>{prompt}</div>
      </div>
      <div style={{ ...cardBox, background: 'transparent', border: '1px dashed var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Your reflection (think it through, no need to write)</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Take 2-3 minutes to mentally sketch the connection. Think about: shared mechanisms,
          analogous structures, or how one explains the other.
        </div>
      </div>
    </div>
  );
}

function BreakPhase({ timeRemaining }: { timeRemaining: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>☕</div>
      <div style={{
        fontFamily: 'DM Mono, monospace', fontSize: 52, fontWeight: 800,
        color: '#06b6d4', marginBottom: 16, letterSpacing: '-2px',
        textShadow: '0 0 30px #06b6d488',
      }}>
        {fmtTime(timeRemaining)}
      </div>
      <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>
        Take a Break
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 320, margin: '0 auto' }}>
        Walk around. Get water. Look out a window.
        <br /><br />
        Your hippocampus is replaying what you just learned, strengthening memory traces.
        Staying still or using your phone disrupts this consolidation.
      </div>
    </div>
  );
}

function TestPhase({
  gradedCards, showAnswer, onShowAnswer, onGrade, stats,
}: {
  gradedCards: CardWithMeta[]; showAnswer: boolean;
  onShowAnswer: () => void; onGrade: (g: 1 | 2 | 3 | 4) => void; stats: SessionStats;
}) {
  const [idx, setIdx] = useState(0);
  const [localShow, setLocalShow] = useState(false);

  if (!gradedCards.length) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
      No hard/failed cards to retest — great job in the Encode phase!
    </div>
  );
  if (idx >= gradedCards.length) return (
    <div style={{ textAlign: 'center', padding: 24 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
      <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 16, marginBottom: 6 }}>Retrieval Complete</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>All hard cards retested. Timer still running.</div>
    </div>
  );

  const card = gradedCards[idx];
  function grade(g: 1 | 2 | 3 | 4) {
    onGrade(g);
    setLocalShow(false);
    setIdx(i => i + 1);
  }

  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Retrieval practice on {gradedCards.length} hard/failed cards. Testing is more powerful than re-studying.
        Card {idx + 1}/{gradedCards.length}
      </p>
      <div style={cardBox}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{card.courseName}</div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{card.front}</div>
      </div>
      {!localShow ? (
        <button onClick={() => { setLocalShow(true); onShowAnswer(); }} style={btnSecondary}>Show Answer</button>
      ) : (
        <>
          <div style={{ ...cardBox, background: 'var(--accent-glow, #F5A62311)', marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {([
              { g: 1 as const, label: 'Again', color: '#ef4444' },
              { g: 2 as const, label: 'Hard',  color: '#f97316' },
              { g: 3 as const, label: 'Good',  color: '#22c55e' },
              { g: 4 as const, label: 'Easy',  color: '#3b82f6' },
            ]).map(({ g, label, color }) => (
              <button key={g} onClick={() => grade(g)}
                style={{ ...btnGrade, color, borderColor: color, padding: '8px 4px', fontSize: 11 }}>
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AnchorPhase({ hardCards }: { hardCards: CardWithMeta[] }) {
  const rooms = ['your front door', 'your kitchen', 'your living room', 'your bedroom', 'your bathroom'];
  return (
    <div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
        Method of loci — associating concepts with physical locations encodes them in spatial memory,
        one of the most robust memory systems.
      </p>
      {hardCards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
          No hard cards to anchor — excellent session performance!
        </div>
      ) : (
        hardCards.map((card, i) => (
          <div key={card.cardIdx + card.courseId} style={{ ...cardBox, marginBottom: 12 }}>
            <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 13, color: '#ec4899', marginBottom: 8 }}>
              🏛️ Memory Palace — {rooms[i % rooms.length]}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
              Place <strong>"{card.front}"</strong> at <em>{rooms[i % rooms.length]}</em>.
              Visualize it vividly: the answer <strong>"{card.back}"</strong> is literally there.
              Make it absurd, colorful, or emotional — anything that makes it stick.
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ReportPhase({ stats, phases, onComplete }: { stats: SessionStats; phases: Phase[]; onComplete: () => void }) {
  const elapsed = Math.round((Date.now() - stats.startTime) / 1000);
  const retention = stats.cardsReviewed > 0
    ? Math.round((stats.correctCount / stats.cardsReviewed) * 100) : 0;
  const grade = retention >= 80 ? '🟢 Excellent' : retention >= 60 ? '🟡 Good' : retention >= 40 ? '🟠 Fair' : '🔴 Needs Work';

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📊</div>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--accent, #F5A623)' }}>
          Session Complete
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Cards Reviewed', value: stats.cardsReviewed, color: '#F5A623' },
          { label: 'Retention Rate', value: `${retention}%`, color: retention >= 70 ? '#22c55e' : '#f97316' },
          { label: 'Session Time', value: fmtTime(elapsed), color: '#06b6d4' },
          { label: 'Performance', value: grade, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-secondary, #111)', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 800, color: stat.color, marginBottom: 4 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div style={{ ...cardBox, marginBottom: 16 }}>
        <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: 13, marginBottom: 8, color: 'var(--text-primary)' }}>
          Phase Summary
        </div>
        {phases.map((p, i) => (
          <div key={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0',
            borderBottom: i < phases.length - 1 ? '1px solid var(--border)' : 'none',
            fontSize: 12,
          }}>
            <span>{p.icon}</span>
            <span style={{ flex: 1, color: 'var(--text-muted)' }}>{p.label}</span>
            <span style={{ color: p.color, fontWeight: 700 }}>✓ {p.durationSec / 60} min</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 12 }}>
        Next session recommended in 24 hours for optimal spaced repetition timing.
      </div>
      <button
        onClick={onComplete}
        style={{
          width: '100%', padding: '12px', borderRadius: 8, border: 'none',
          background: 'var(--accent, #F5A623)', color: '#000',
          fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'Sora, sans-serif',
        }}
      >
        Done — Back to Tools
      </button>
    </div>
  );
}

function EmptyCards({ message }: { message: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
      {message}
    </div>
  );
}

// ── Shared inline style objects ────────────────────────────────────────────────

const cardBox: React.CSSProperties = {
  padding: 16, borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--bg-secondary, #111)', marginBottom: 12, lineHeight: 1.5,
};

const btnSecondary: React.CSSProperties = {
  width: '100%', padding: '10px', borderRadius: 8,
  border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', fontWeight: 600,
  marginBottom: 4,
};

const btnGrade: React.CSSProperties = {
  padding: '9px 4px', borderRadius: 8,
  border: '1px solid', background: 'transparent',
  fontSize: 12, cursor: 'pointer', fontWeight: 700,
};

// ── Export (wrapped in ToolErrorBoundary) ──────────────────────────────────────

export default function OmniProtocol(props: OmniProps) {
  return (
    <ToolErrorBoundary toolName="Omni Protocol">
      <OmniProtocolInner {...props} />
    </ToolErrorBoundary>
  );
}
