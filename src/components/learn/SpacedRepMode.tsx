import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Play, Repeat, Sparkles } from 'lucide-react';
import { useStore } from '../../store';
import { sanitizeHtml } from '../../utils/sanitize';
import { getDueCards, reviewCard, convertFromLegacy, type FSRSCard, type Grade } from '../../utils/fsrs';
import { cardStyle } from './learnHelpers';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { SwipeableCard } from '../flashcards/SwipeableCard';

export default function SpacedRepMode() {
  const { data, setData, srData, courses, quizHistory, matchSets } = useStore();
  const [cards, setCards] = useState<FSRSCard[]>([]);
  const [dueCards, setDueCards] = useState<FSRSCard[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [phase, setPhase] = useState<'overview' | 'review' | 'done'>('overview');

  // Refs for persisting review progress
  const reviewedCardsRef = useRef<Map<string, FSRSCard>>(new Map());
  const dataRef = useRef(data);
  const savingRef = useRef(false);
  dataRef.current = data;

  // Persist reviewed cards back to store → IndexedDB
  const persistReviewed = useCallback(() => {
    const d = dataRef.current;
    if (reviewedCardsRef.current.size === 0) return;
    savingRef.current = true;
    const reviewed = reviewedCardsRef.current;
    const existingSrCards = d?.pluginData?.srData?.cards || [];
    const existingKeys = new Set(existingSrCards.map(c => c.key));

    // Update existing SR cards
    const updatedSrCards = existingSrCards.map(c => {
      const u = reviewed.get(c.key);
      if (!u) return c;
      return { ...c, S: u.stability, D: u.difficulty, reps: u.reps, lapses: u.lapses, state: u.state, lastReview: u.lastReview, nextReview: u.nextReview, scheduledDays: u.interval };
    });

    // Add new entries for course flashcards that were reviewed but don't exist in srData yet
    for (const [key, u] of reviewed) {
      if (!existingKeys.has(key)) {
        updatedSrCards.push({
          key, subject: u.topic, subtopic: u.topic,
          S: u.stability, D: u.difficulty, reps: u.reps, lapses: u.lapses,
          state: u.state, lastReview: u.lastReview, nextReview: u.nextReview,
          elapsedDays: 0, scheduledDays: u.interval, history: [],
          questionText: u.front,
        });
      }
    }

    const srData = { cards: updatedSrCards };
    setData(prev => ({ ...prev, pluginData: { ...prev.pluginData, srData } }));
    reviewedCardsRef.current = new Map();
  }, [setData]);

  // Save on unmount (user navigates away mid-review)
  useEffect(() => {
    return () => { persistReviewed(); };
  }, [persistReviewed]);

  // Build cards from course flashcards + enriched legacy SR cards
  useEffect(() => {
    // Skip re-init when we just saved review progress
    if (savingRef.current) {
      savingRef.current = false;
      return;
    }

    // Build answer lookup from quiz history + quizBank so quiz-derived SR cards can show real answers
    const answerLookup = new Map<string, string>();
    // Source 1: quizBank (stored quizzes with correct answers — largest source)
    const quizBank = data?.pluginData?.quizBank as Record<string, unknown> | undefined;
    const bankQuizzes = (quizBank?.quizzes || []) as { questions?: { question?: string; correctAnswer?: string }[] }[];
    for (const quiz of bankQuizzes) {
      for (const q of (quiz.questions || [])) {
        if (q.question && q.correctAnswer) {
          answerLookup.set(q.question.trim(), q.correctAnswer);
        }
      }
    }
    // Source 2: quizHistory (attempted quizzes — overrides quizBank if different)
    for (const attempt of quizHistory) {
      for (const a of (attempt.answers || [])) {
        if (a.question?.question && a.question?.correctAnswer) {
          answerLookup.set(a.question.question.trim(), a.question.correctAnswer);
        }
      }
    }

    // Build term → definition lookup from ALL available sources:
    // 1. Course flashcards (FlashcardItem: front → back)
    // 2. Match game sets (MatchSet: term → definition)
    const termLookup = new Map<string, { back: string; courseName: string }>();
    // Source 1: Match sets (loaded first so course flashcards can override with better content)
    for (const ms of (matchSets || [])) {
      for (const p of (ms.pairs || [])) {
        if (p.term && p.definition) {
          termLookup.set(p.term.trim().toLowerCase(), { back: p.definition, courseName: ms.subject || ms.name });
        }
      }
    }
    // Source 2: Course flashcards (higher priority — overwrite match set entries)
    for (const c of courses) {
      for (const f of (c.flashcards || [])) {
        if (f.front && f.back) {
          termLookup.set(f.front.trim().toLowerCase(), { back: f.back, courseName: c.shortName || c.name });
        }
      }
    }

    // 1. Convert legacy SR cards — only keep ones with real Q&A content
    const legacyCards: FSRSCard[] = [];
    if (srData?.cards && srData.cards.length > 0) {
      for (const c of srData.cards) {
        // Quiz-derived cards with actual question text
        if (c.key?.startsWith('q::') && c.questionText) {
          const answer = answerLookup.get(c.questionText.trim());
          if (answer) {
            const card = convertFromLegacy(c);
            card.back = answer;
            legacyCards.push(card);
          }
          // Skip quiz cards with no matching answer — they'd show wrong content
          continue;
        }
        // Skip deck-level entries (e.g. "BIOL 4230/8236::Chapter 10 Terminology")
        // These are topic scheduling metadata, not real flashcards
        if (!c.key?.startsWith('q::') && !c.key?.startsWith('match:') && !c.key?.startsWith('jp:')) {
          continue;
        }
        // Match/JP cards: try to enrich with real definitions from course flashcards + match sets
        const card = convertFromLegacy(c);
        const lookup = termLookup.get(card.front.trim().toLowerCase());
        if (lookup) {
          // Found matching definition — use it
          card.back = lookup.back;
          card.topic = lookup.courseName;
          legacyCards.push(card);
        }
        // Skip cards with no matching definition — they'd show wrong content (course name as answer)
      }
    }

    // 2. Always include course flashcards (these have proper front/back content)
    //    Restore scheduling data from srData if the card was previously reviewed
    const legacyKeys = new Set(legacyCards.map(c => c.key));
    const srLookup = new Map<string, import('../../types').SRCard>();
    if (srData?.cards) {
      for (const c of srData.cards) {
        if (c.key) srLookup.set(c.key, c);
      }
    }
    const courseCards = courses.flatMap(c =>
      (c.flashcards || []).map((f, i) => {
        const key = `${c.id}-${i}`;
        const saved = srLookup.get(key);
        if (saved && (saved.reps ?? 0) > 0) {
          // Restore scheduling data from previous reviews
          const card = convertFromLegacy(saved);
          card.front = f.front;
          card.back = f.back;
          card.topic = c.shortName || c.name;
          return card;
        }
        return {
          key,
          topic: c.shortName || c.name,
          front: f.front,
          back: f.back,
          state: 'new' as const,
          stability: 0,
          difficulty: 5,
          interval: 0,
          lapses: 0,
          reps: 0,
          lastReview: new Date().toISOString(),
          nextReview: new Date().toISOString(),
        };
      })
    ).filter(c => !legacyKeys.has(c.key));

    // 3. Merge: legacy cards (have scheduling data) + course flashcards
    const fsrsCards = [...legacyCards, ...courseCards];

    setCards(fsrsCards);
    setDueCards(getDueCards(fsrsCards));
  }, [srData, courses, quizHistory, matchSets]);

  function startReview() {
    setCurrentIdx(0);
    setReviewed(0);
    setShowAnswer(false);
    setPhase('review');
  }

  function handleGrade(grade: Grade) {
    const card = dueCards[currentIdx];
    const updated = reviewCard(card, grade);

    // Track for persistence
    reviewedCardsRef.current.set(updated.key, updated);

    // Update in the local cards list
    const newCards = cards.map(c => c.key === updated.key ? updated : c);
    setCards(newCards);

    setReviewed(prev => prev + 1);
    setShowAnswer(false);

    if (currentIdx + 1 >= dueCards.length) {
      setDueCards(getDueCards(newCards));
      setPhase('done');
      persistReviewed(); // Save when session completes
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  }

  // Swipe-to-rate adapters for spaced rep mode.
  // onCommit: update card data only — do NOT advance currentIdx (prevents mid-animation swap).
  // onAnimationComplete: advance after fly-off completes.
  const pendingAdvanceRef = useRef<(() => void) | null>(null)

  const onSwipeCommit = useCallback((direction: 'left' | 'right') => {
    const grade = (direction === 'right' ? 3 : 1) as Grade
    const card = dueCards[currentIdx]
    if (!card) return
    const updated = reviewCard(card, grade)
    reviewedCardsRef.current.set(updated.key, updated)
    const newCards = cards.map(c => c.key === updated.key ? updated : c)
    setCards(newCards)
    setReviewed(prev => prev + 1)
    setShowAnswer(false)
    // Store the advance function to call after animation
    if (currentIdx + 1 >= dueCards.length) {
      pendingAdvanceRef.current = () => {
        setDueCards(getDueCards(newCards))
        setPhase('done')
        persistReviewed()
      }
    } else {
      pendingAdvanceRef.current = () => setCurrentIdx(prev => prev + 1)
    }
  }, [cards, currentIdx, dueCards, persistReviewed])

  const onSwipeAnimationComplete = useCallback(() => {
    pendingAdvanceRef.current?.()
    pendingAdvanceRef.current = null
  }, [])

  const { dragState, handlers: swipeHandlers } = useSwipeGesture({
    onCommit: onSwipeCommit,
    onAnimationComplete: onSwipeAnimationComplete,
    isAnswerVisible: showAnswer,
    disabled: phase !== 'review',
  })

  if (phase === 'overview') {
    const newCount = cards.filter(c => c.state === 'new').length;
    const learningCount = cards.filter(c => c.state === 'learning').length;
    const reviewCount = cards.filter(c => c.state === 'review').length;
    const matureCount = cards.filter(c => c.state === 'mature').length;

    return (
      <div>
        <p className="text-sm text-muted mb-3">
          FSRS-4.5 spaced repetition. Cards are scheduled optimally for long-term retention.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {[
            { label: 'New', count: newCount, color: 'var(--blue)' },
            { label: 'Learning', count: learningCount, color: 'var(--orange)' },
            { label: 'Review', count: reviewCount, color: 'var(--green)' },
            { label: 'Mature', count: matureCount, color: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} className="text-center" style={{ padding: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.count}</div>
              <div className="text-xs text-muted">{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{
          ...cardStyle, background: dueCards.length > 0 ? 'var(--accent-glow)' : 'var(--bg-primary)',
          textAlign: 'center', padding: 16, marginBottom: 8,
        }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: dueCards.length > 0 ? 'var(--accent-light)' : 'var(--text-muted)' }}>
            {dueCards.length}
          </div>
          <div className="text-sm text-muted">cards due now</div>
        </div>
        <button className="btn btn-primary w-full" onClick={startReview} disabled={dueCards.length === 0}>
          <Play size={14} /> Start Review ({dueCards.length})
        </button>
      </div>
    );
  }

  if (phase === 'review') {
    const card = dueCards[currentIdx];
    if (!card) { setPhase('done'); return null; }

    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted">{currentIdx + 1}/{dueCards.length}</span>
          <span className="badge" style={{ fontSize: 10, background: 'var(--accent-glow)', color: 'var(--accent-light)' }}>
            {card.state}
          </span>
        </div>
        <div className="progress-bar mb-3">
          <div className="progress-fill" style={{ width: `${((currentIdx + 1) / dueCards.length) * 100}%`, background: 'var(--accent)' }} />
        </div>

        {/* Swipeable card area — question always shown, answer shown after flip */}
        <SwipeableCard
          dragState={dragState}
          handlers={swipeHandlers}
          style={{ borderRadius: 8, marginBottom: 12 }}
        >
          <div style={{ ...cardStyle, background: 'var(--bg-primary)', minHeight: 100, textAlign: 'center', padding: 20, marginBottom: showAnswer ? 8 : 0 }}>
            <div className="text-xs text-muted mb-2">{card.topic}</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{card.front}</div>
          </div>
          {showAnswer && (
            <div style={{ ...cardStyle, background: 'var(--accent-glow)', padding: 16, textAlign: 'center' }}>
              {/<[a-z][\s\S]*>/i.test(card.back)
                ? <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }} />
                : <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>}
            </div>
          )}
        </SwipeableCard>

        {/* Controls outside SwipeableCard — buttons remain tappable, not carried by swipe */}
        {!showAnswer ? (
          <button className="btn btn-secondary w-full" onClick={() => setShowAnswer(true)}>
            <Eye size={14} /> Show Answer
          </button>
        ) : (
          <>
            <div className="text-xs text-center text-muted mb-2">How well did you recall?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {[
                { grade: 1 as Grade, label: 'Again', color: 'var(--red)' },
                { grade: 2 as Grade, label: 'Hard', color: 'var(--orange)' },
                { grade: 3 as Grade, label: 'Good', color: 'var(--green)' },
                { grade: 4 as Grade, label: 'Easy', color: 'var(--blue)' },
              ].map(g => (
                <button key={g.grade} className="btn btn-secondary btn-sm"
                  onClick={() => handleGrade(g.grade)}
                  style={{ fontSize: 11, padding: '8px 4px', color: g.color, borderColor: g.color }}>
                  {g.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Done
  return (
    <div className="text-center">
      <Sparkles size={32} style={{ color: 'var(--green)', margin: '0 auto 12px' }} />
      <div style={{ fontSize: 20, fontWeight: 800 }}>Review Complete!</div>
      <div className="text-sm text-muted mb-3">{reviewed} cards reviewed</div>
      {dueCards.length > 0 ? (
        <button className="btn btn-primary w-full" onClick={startReview}>
          <Repeat size={14} /> Review {dueCards.length} More
        </button>
      ) : (
        <p className="text-sm text-muted">All caught up! Come back later for more reviews.</p>
      )}
      <button className="btn btn-secondary btn-sm mt-2 w-full" onClick={() => setPhase('overview')}>
        Back to Overview
      </button>
    </div>
  );
}
