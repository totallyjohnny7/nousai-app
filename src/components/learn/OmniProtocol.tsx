/**
 * OmniProtocol V6 — Variable-length, multi-cycle, AI-generated study session.
 *
 * Screen flow: duration → loading → wizard(1→2→3→4) → running → interstitial → final-report → complete
 *
 * Science basis:
 *  - Bloom's taxonomy escalation across cycles (Remember → Apply → Evaluate)
 *  - FSRS spaced repetition targeting due + gap cards
 *  - Feynman technique: WHY chains + self-assessed gaps
 *  - Motivation collapse handler: accuracy gate + dopamine rebuild loop
 *  - Elaborative interrogation (CONNECT), retrieval practice (TEST), memory palace (ANCHOR)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { useStore } from '../../store';
import { callAI } from '../../utils/ai';
import { safeRenderMd } from '../../utils/renderMd';
import { awardQuizXp, awardStudyTimeXp } from '../../utils/gamification';
import {
  parseDurationChoice, getOmniDueCards, getPendingFeynmanGaps,
  getKnowledgeGraphConnections, getArcPhaseForCourse,
  evaluateMotivationState, INITIAL_MOTIVATION, determineArcPhaseProgression,
  generateSessionId, buildIntakePrompt, buildSessionPlanPrompt,
  buildFinalReportPrompt, parseSessionPlanResponse,
  type OmniDurationConfig, type MotivationState,
} from '../../utils/omniV6';
import type {
  OmniArcPhase, OmniDifficulty, OmniSessionPlan, OmniPhaseResult,
  OmniFeynmanGap, OmniSessionRecord, OmniProtocolData,
} from '../../types';
import type { Course } from '../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface OmniProps {
  courseId?: string;
  onComplete: () => void;
  onClose?: () => void;
}

type OmniScreen =
  | { screen: 'duration' }
  | { screen: 'loading' }
  | { screen: 'wizard'; step: 1 | 2 | 3 | 4 }
  | { screen: 'running'; cycleIdx: number; phaseIdx: number }
  | { screen: 'interstitial'; afterCycle: number }
  | { screen: 'final-report'; loading: boolean }
  | { screen: 'complete' };

interface CardWithMeta { courseId: string; courseName: string; front: string; back: string; topic?: string; grade?: 1 | 2 | 3 | 4; }

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, string> = {
  Prime: '📋', Chunk: '🎼', Encode: '🧠', Connect: '🌉',
  Break: '☕', Test: '🔍', Anchor: '🏛️', Report: '📊',
};
const PHASE_COLORS: Record<string, string> = {
  Prime: '#ef4444', Chunk: '#f97316', Encode: '#eab308', Connect: '#22c55e',
  Break: '#06b6d4', Test: '#8b5cf6', Anchor: '#ec4899', Report: '#F5A623',
};
const ARC_PHASE_DESC: Record<OmniArcPhase, string> = {
  Foundation:   'First exposure — survive & orient',
  BuildUp:      'Building WHY chains — understand causality',
  Application:  'Apply to real problems — transfer skills',
  Synthesis:    'Cross-domain links — see the full picture',
  Mastery:      'Think like the professor — explain everything',
};
const DURATION_OPTIONS = [60, 90, 120, 150, 180];
const DIFFICULTY_OPTIONS: OmniDifficulty[] = ['Beginner', 'Review', 'DeepDive'];
const ARC_PHASES: OmniArcPhase[] = ['Foundation', 'BuildUp', 'Application', 'Synthesis', 'Mastery'];

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

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  container: { background: 'var(--bg-primary)', borderRadius: 12, overflow: 'hidden', minHeight: 480, display: 'flex', flexDirection: 'column' as const },
  header: { background: 'var(--bg-secondary, #111)', borderBottom: '1px solid var(--border)', padding: '12px 16px' },
  btn: (accent = false) => ({
    padding: '10px 20px', borderRadius: 8, border: accent ? 'none' : '1px solid var(--border)',
    background: accent ? 'var(--accent, #F5A623)' : 'transparent',
    color: accent ? '#000' : 'var(--text-muted)', fontWeight: 700, fontSize: 13,
    cursor: 'pointer', fontFamily: 'Sora, sans-serif',
  }),
  input: { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary, #111)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const },
  card: { background: 'var(--bg-secondary, #111)', borderRadius: 10, border: '1px solid var(--border)', padding: 20 },
};

// ── Main Component ────────────────────────────────────────────────────────────

function OmniProtocolInner({ onComplete, onClose }: OmniProps) {
  const { data, updatePluginData } = useStore();
  const courses: Course[] = data?.pluginData?.coachData?.courses ?? [];
  const srData = data?.pluginData?.srData ?? null;
  const gamification = data?.pluginData?.gamificationData;
  const omniData: OmniProtocolData = data?.pluginData?.omniProtocol ?? { sessions: [], feynmanGaps: [], currentArcPhase: {} };

  // ── Screen & wizard state ────────────────────────────────────────────────
  const [screen, setScreen] = useState<OmniScreen>({ screen: 'duration' });
  const [, setSessionDuration] = useState<number>(60);
  const [durationConfig, setDurationConfig] = useState<OmniDurationConfig>(parseDurationChoice(60));
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? '');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [difficulty, setDifficulty] = useState<OmniDifficulty>('Review');
  const [arcPhase, setArcPhase] = useState<OmniArcPhase>('Foundation');
  const [intakeQuestions, setIntakeQuestions] = useState<string[]>([]);
  const [intakeType, setIntakeType] = useState<'questions' | 'cold_start'>('questions');
  const [intakeAnswers, setIntakeAnswers] = useState<string[]>([]);
  const [professorEmphasis, setProfessorEmphasis] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [planError, setPlanError] = useState('');

  // ── Session plan & running state ────────────────────────────────────────
  const [sessionPlan, setSessionPlan] = useState<OmniSessionPlan | null>(null);
  const [phaseResults, setPhaseResults] = useState<OmniPhaseResult[]>([]);
  const [motivationState, setMotivationState] = useState<MotivationState>(INITIAL_MOTIVATION);
  const [totalXp, setTotalXp] = useState(0);
  const sessionStartRef = useRef(Date.now());

  // ── Timer state ──────────────────────────────────────────────────────────
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [interstitialTime, setInterstitialTime] = useState(120);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interstitialRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeRef = useRef(0);
  const isPausedRef = useRef(false);
  const screenRef = useRef<OmniScreen>({ screen: 'duration' });
  timeRef.current = timeRemaining;
  isPausedRef.current = isPaused;
  screenRef.current = screen;

  // ── Card state ───────────────────────────────────────────────────────────
  const [phaseCards, setPhaseCards] = useState<CardWithMeta[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [gradedCards, setGradedCards] = useState<CardWithMeta[]>([]);
  const [phaseCorrect, setPhaseCorrect] = useState(0);
  const [phaseTotal, setPhaseTotal] = useState(0);
  const [, setComboCount] = useState(0);
  const [xpPopup, setXpPopup] = useState<string | null>(null);
  const [collapseBanner, setCollapseBanner] = useState(false);

  // ── Feynman gaps & WHY chain state ────────────────────────────────────────
  const [whyChainAssessment, setWhyChainAssessment] = useState<Record<string, 'ok' | 'unclear'>>({});
  const [pendingGaps, setPendingGaps] = useState<OmniFeynmanGap[]>([]);

  // ── Final report state ────────────────────────────────────────────────────
  const [finalReportText, setFinalReportText] = useState('');

  // ── Data pull refs (populated during 'loading' screen) ───────────────────
  const dueCardsRef = useRef<ReturnType<typeof getOmniDueCards>>([]);
  const pendingFeynmanRef = useRef<OmniFeynmanGap[]>([]);
  const knowledgeConnectionsRef = useRef<string[]>([]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function showToast(msg: string, ms = 5000) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), ms);
  }

  function showXpBurst(xp: number) {
    setXpPopup(`+${xp} XP`);
    setTimeout(() => setXpPopup(null), 2000);
  }

  function getAllCards(): CardWithMeta[] {
    return courses.flatMap(c =>
      (c.flashcards ?? []).map(f => ({ ...f, courseId: c.id, courseName: c.shortName ?? c.name }))
    );
  }

  function prepPhaseCards() {
    const allCards = getAllCards();
    const plan = sessionPlan;
    if (!plan) return;
    const filter = plan.flashcardFilter;
    const filtered = allCards.filter(c => {
      const courseOk = filter.courseIds.length === 0 || filter.courseIds.includes(c.courseId);
      const topicOk = filter.topics.length === 0 || filter.topics.some(t => (c.topic ?? '').toLowerCase().includes(t.toLowerCase()));
      return courseOk && topicOk;
    });
    const pool = filtered.length >= 5 ? filtered : allCards;
    setPhaseCards(shuffle(pool).slice(0, 20));
    setCurrentCardIdx(0);
    setShowAnswer(false);
    setGradedCards([]);
    setPhaseCorrect(0);
    setPhaseTotal(0);
  }

  // ── Duration picker ──────────────────────────────────────────────────────

  function handleDurationSelect(minutes: number) {
    setSessionDuration(minutes);
    const config = parseDurationChoice(minutes);
    setDurationConfig(config);
    if (minutes === 180 && new Date().getHours() >= 22) {
      showToast('Cognitive consolidation drops after midnight. Consider 1hr now + schedule the rest tomorrow.');
    }
    setScreen({ screen: 'loading' });
  }

  // ── Data pull (loading screen) ────────────────────────────────────────────

  useEffect(() => {
    if (screen.screen !== 'loading') return;
    setLoadingMsg('Pulling your course data...');
    const courseId = selectedCourseId || courses[0]?.id || '';
    const topicId = selectedTopic;

    dueCardsRef.current = getOmniDueCards(srData, { courseIds: courseId ? [courseId] : [], topics: [] });
    pendingFeynmanRef.current = getPendingFeynmanGaps(omniData, courseId);
    knowledgeConnectionsRef.current = getKnowledgeGraphConnections(courses, courseId, topicId);

    // Pre-fill arc phase from stored data
    const storedArc = getArcPhaseForCourse(omniData, courseId);
    setArcPhase(storedArc);
    setSelectedCourseId(courseId);

    setScreen({ screen: 'wizard', step: 1 });
  }, [screen.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wizard step transitions ───────────────────────────────────────────────

  async function handleWizardStep1Next() {
    setScreen({ screen: 'wizard', step: 2 });
    setLoadingMsg('Generating intake assessment...');
    try {
      const msgs = buildIntakePrompt({
        topic: selectedTopic || 'General',
        courseName: courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId,
        difficulty,
        arcPhase,
        feynmanGaps: pendingFeynmanRef.current,
        fsrsDueCount: dueCardsRef.current.length,
      });
      const raw = await callAI(msgs, { temperature: 0.4, maxTokens: 400, json: true }, 'omni');
      try {
        const parsed = JSON.parse(raw);
        setIntakeType(parsed.type === 'cold_start' ? 'cold_start' : 'questions');
        const qs: string[] = parsed.questions ?? parsed.diagnostic ?? [];
        setIntakeQuestions(qs);
        setIntakeAnswers(new Array(qs.length).fill(''));
      } catch {
        // Fallback: ask a default question
        setIntakeType('questions');
        setIntakeQuestions([`What do you already know about "${selectedTopic || 'this topic'}" and where do you feel least confident?`]);
        setIntakeAnswers(['']);
      }
      setLoadingMsg('');
    } catch {
      setLoadingMsg('');
      setIntakeQuestions([`What do you already know about "${selectedTopic || 'this topic'}"?`]);
      setIntakeAnswers(['']);
    }
  }

  async function handleWizardStep3Submit() {
    setScreen({ screen: 'wizard', step: 4 });
    setLoadingMsg('Claude is building your personalized session plan...');
    setPlanError('');

    const intakeSummary = intakeQuestions
      .map((q, i) => `Q: ${q}\nA: ${intakeAnswers[i] ?? ''}`)
      .join('\n\n');

    const sessionId = generateSessionId();
    const courseName = courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId;

    const msgs = buildSessionPlanPrompt({
      topic: selectedTopic || 'General',
      courseName,
      difficulty,
      arcPhase,
      durationConfig,
      intakeAnswers: intakeSummary,
      professorEmphasis,
      fsrsDueCards: dueCardsRef.current,
      feynmanGaps: pendingFeynmanRef.current,
      knowledgeConnections: knowledgeConnectionsRef.current,
      sessionId,
    });

    try {
      const raw = await callAI(msgs, { temperature: 0.6, maxTokens: 2500, json: true }, 'omni');
      const plan = parseSessionPlanResponse(raw);
      if (!plan || !plan.cycles?.length) throw new Error('Invalid plan JSON');
      setSessionPlan(plan);
      setLoadingMsg('');
      prepPhaseCards();
      const firstPhaseDuration = plan.cycles[0].phases[0].duration * 60;
      setTimeRemaining(firstPhaseDuration);
      timeRef.current = firstPhaseDuration;
      sessionStartRef.current = Date.now();
      setScreen({ screen: 'running', cycleIdx: 0, phaseIdx: 0 });
    } catch (e) {
      setLoadingMsg('');
      setPlanError(`Failed to generate plan: ${e instanceof Error ? e.message : 'Unknown error'}. Check your AI settings and try again.`);
    }
  }

  // ── Cycle runner — advance phase ─────────────────────────────────────────

  const advancePhase = useCallback(() => {
    const s = screenRef.current;
    if (s.screen !== 'running') return;
    const { cycleIdx, phaseIdx } = s;
    if (!sessionPlan) return;

    const currentCycle = sessionPlan.cycles[cycleIdx];
    if (!currentCycle) return;

    // Record phase result
    const accuracy = phaseTotal > 0 ? Math.round((phaseCorrect / phaseTotal) * 100) : 100;
    const phaseContent = currentCycle.phases[phaseIdx];
    const phaseName = phaseContent?.name ?? 'Phase';

    setPhaseResults(prev => [...prev, {
      cycleIdx, phaseIdx, phaseName, accuracy,
      cardsReviewed: phaseTotal, xpAwarded: 0,
    }]);

    // Evaluate motivation after this phase
    setMotivationState(prev => {
      const updated = evaluateMotivationState(prev, accuracy, phaseCorrect);
      if (!prev.inCollapseMode && updated.inCollapseMode) {
        setCollapseBanner(true);
        setTimeout(() => setCollapseBanner(false), 4000);
      }
      return updated;
    });

    // Award XP for this phase
    if (gamification && phaseTotal > 0) {
      const updated = awardQuizXp(gamification, phaseCorrect, phaseTotal);
      const xpGained = updated.xp - gamification.xp;
      if (xpGained > 0) {
        setTotalXp(prev => prev + xpGained);
        showXpBurst(xpGained);
        updatePluginData({ gamificationData: updated });
      }
    }

    // Reset phase card state
    setPhaseCorrect(0);
    setPhaseTotal(0);
    setShowAnswer(false);
    setWhyChainAssessment({});

    // Chime
    try { new Audio('/chime.mp3').play().catch(() => {}); } catch { /* noop */ }

    const nextPhaseIdx = phaseIdx + 1;
    const phasesInCycle = currentCycle.phases.length;

    if (nextPhaseIdx >= phasesInCycle) {
      // Cycle complete
      const nextCycleIdx = cycleIdx + 1;
      if (nextCycleIdx >= sessionPlan.cycleCount) {
        // All cycles done — fire final report
        if (intervalRef.current) clearInterval(intervalRef.current);
        setScreen({ screen: 'final-report', loading: true });
      } else {
        // Go to interstitial
        if (intervalRef.current) clearInterval(intervalRef.current);
        setInterstitialTime(120);
        setScreen({ screen: 'interstitial', afterCycle: cycleIdx });
      }
    } else {
      // Next phase in same cycle
      const nextPhase = currentCycle.phases[nextPhaseIdx];
      const nextDuration = nextPhase.duration * 60;
      setTimeRemaining(nextDuration);
      timeRef.current = nextDuration;
      setScreen({ screen: 'running', cycleIdx, phaseIdx: nextPhaseIdx });
      prepPhaseCards();
    }
  }, [sessionPlan, phaseCorrect, phaseTotal, gamification]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer interval (running screen) ──────────────────────────────────────

  useEffect(() => {
    if (screen.screen !== 'running') return;
    intervalRef.current = setInterval(() => {
      if (isPausedRef.current) return;
      const next = timeRef.current - 1;
      if (next <= 0) {
        advancePhase();
      } else {
        setTimeRemaining(next);
        timeRef.current = next;
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [screen.screen, advancePhase]);

  // ── Interstitial timer ────────────────────────────────────────────────────

  useEffect(() => {
    if (screen.screen !== 'interstitial') return;
    interstitialRef.current = setInterval(() => {
      setInterstitialTime(prev => {
        if (prev <= 1) {
          clearInterval(interstitialRef.current!);
          startNextCycle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (interstitialRef.current) clearInterval(interstitialRef.current!); };
  }, [screen.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  function startNextCycle() {
    if (screen.screen !== 'interstitial' || !sessionPlan) return;
    const nextCycleIdx = (screen as { afterCycle: number }).afterCycle + 1;
    prepPhaseCards();
    const firstPhaseDuration = sessionPlan.cycles[nextCycleIdx].phases[0].duration * 60;
    setTimeRemaining(firstPhaseDuration);
    timeRef.current = firstPhaseDuration;
    setScreen({ screen: 'running', cycleIdx: nextCycleIdx, phaseIdx: 0 });
  }

  // ── Final report generation ───────────────────────────────────────────────

  useEffect(() => {
    if (screen.screen !== 'final-report' || !(screen as { loading: boolean }).loading) return;
    if (!sessionPlan) return;

    const phaseAccuracies = phaseResults.map(r => ({
      cycleIdx: r.cycleIdx, phaseName: r.phaseName, accuracy: r.accuracy,
    }));
    const feynmanConcepts = pendingGaps.map(g => g.concept);
    const totalTimeSec = Math.round((Date.now() - sessionStartRef.current) / 1000);

    const msgs = buildFinalReportPrompt({
      plan: sessionPlan,
      phaseAccuracies,
      totalXp,
      totalTimeSec,
      motivationResets: motivationState.motivationResets,
      feynmanGapsDetected: feynmanConcepts,
    });

    callAI(msgs, {
      temperature: 0.5, maxTokens: 600,
      onChunk: (chunk) => setFinalReportText(prev => prev + chunk),
    }, 'omni').then(() => {
      setScreen({ screen: 'final-report', loading: false });
      // Persist session record
      const overallAccuracy = phaseResults.length
        ? Math.round(phaseResults.reduce((s, r) => s + r.accuracy, 0) / phaseResults.length)
        : 0;
      const newArcPhase = determineArcPhaseProgression(arcPhase, overallAccuracy);
      const record: OmniSessionRecord = {
        id: sessionPlan.sessionId,
        plan: sessionPlan,
        startedAt: new Date(sessionStartRef.current).toISOString(),
        completedAt: new Date().toISOString(),
        totalXpAwarded: totalXp,
        totalCardsReviewed: phaseResults.reduce((s, r) => s + r.cardsReviewed, 0),
        overallAccuracy,
        motivationResets: motivationState.motivationResets,
        finalArcPhase: newArcPhase,
        feynmanGapsDetected: feynmanConcepts,
        finalReportText,
      };
      const mergedGaps = [
        ...omniData.feynmanGaps.filter(g => !pendingGaps.find(pg => pg.id === g.id)),
        ...pendingGaps,
      ];
      // Award study time XP
      if (gamification) {
        const mins = Math.round((Date.now() - sessionStartRef.current) / 60000);
        const updatedGam = awardStudyTimeXp(gamification, mins);
        updatePluginData({
          gamificationData: updatedGam,
          omniProtocol: {
            ...omniData,
            sessions: [...omniData.sessions.slice(-19), record],
            currentArcPhase: { ...omniData.currentArcPhase, [selectedCourseId]: newArcPhase },
            feynmanGaps: mergedGaps,
            lastSessionId: record.id,
          },
        });
      } else {
        updatePluginData({
          omniProtocol: {
            ...omniData,
            sessions: [...omniData.sessions.slice(-19), record],
            currentArcPhase: { ...omniData.currentArcPhase, [selectedCourseId]: newArcPhase },
            feynmanGaps: mergedGaps,
            lastSessionId: record.id,
          },
        });
      }
    }).catch(() => {
      setFinalReportText('Session complete! Your progress has been saved.');
      setScreen({ screen: 'final-report', loading: false });
    });
  }, [screen.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Card grading ──────────────────────────────────────────────────────────

  function handleGrade(grade: 1 | 2 | 3 | 4) {
    const card = phaseCards[currentCardIdx];
    if (!card) return;
    setGradedCards(prev => [...prev, { ...card, grade }]);
    const correct = grade >= 3;
    setPhaseCorrect(prev => prev + (correct ? 1 : 0));
    setPhaseTotal(prev => prev + 1);
    setComboCount(prev => correct ? prev + 1 : 0);
    setShowAnswer(false);

    // Instant XP popup during collapse mode (every 2 correct)
    if (motivationState.inCollapseMode && correct) {
      const newConsec = motivationState.consecutiveCorrectSinceCollapse + 1;
      if (newConsec % 2 === 0) showXpBurst(10);
    }

    if (currentCardIdx + 1 < phaseCards.length) {
      setCurrentCardIdx(i => i + 1);
    }
  }

  function handleWhyChain(chain: string, verdict: 'ok' | 'unclear') {
    setWhyChainAssessment(prev => ({ ...prev, [chain]: verdict }));
    if (verdict === 'unclear' && sessionPlan) {
      const gap: OmniFeynmanGap = {
        id: `gap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        concept: chain,
        courseId: selectedCourseId,
        sessionId: sessionPlan.sessionId,
        detectedAt: new Date().toISOString(),
        resolved: false,
      };
      setPendingGaps(prev => {
        if (prev.some(g => g.concept === chain)) return prev;
        return [...prev, gap];
      });
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderProgressBars(cycleIdx: number, phaseIdx: number) {
    if (!sessionPlan) return null;
    const phasesPerCycle = sessionPlan.cycles[cycleIdx]?.phases.length ?? 8;
    const totalPhases = sessionPlan.cycleCount * 8;
    const donePhases = cycleIdx * 8 + phaseIdx;
    const cycleProgress = ((phaseIdx + 1) / phasesPerCycle) * 100;
    const sessionProgress = (donePhases / totalPhases) * 100;

    return (
      <div style={{ padding: '6px 16px 10px' }}>
        {/* Session bar (thin) */}
        <div style={{ height: 2, background: 'var(--border)', borderRadius: 1, marginBottom: 4 }}>
          <div style={{ height: '100%', width: `${sessionProgress}%`, background: 'var(--accent, #F5A623)', borderRadius: 1, transition: 'width 1s linear' }} />
        </div>
        {/* Cycle bar */}
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2 }}>
          <div style={{
            height: '100%', width: `${cycleProgress}%`,
            background: PHASE_COLORS[sessionPlan.cycles[cycleIdx]?.phases[phaseIdx]?.name ?? 'Prime'] ?? 'var(--accent)',
            borderRadius: 2, transition: 'width 1s linear',
          }} />
        </div>
      </div>
    );
  }

  function renderPhaseContent(cycleIdx: number, phaseIdx: number) {
    if (!sessionPlan) return null;
    const cycle = sessionPlan.cycles[cycleIdx];
    const phase = cycle?.phases[phaseIdx];
    if (!phase) return null;

    const isEncodeOrTest = phase.name === 'Encode' || phase.name === 'Test';
    const testCards = phase.name === 'Test'
      ? gradedCards.filter(c => (c.grade ?? 3) <= 2)
      : phaseCards;
    const activeCards = phase.name === 'Test' ? (testCards.length > 0 ? testCards : phaseCards) : phaseCards;
    const currentCard = activeCards[currentCardIdx];

    return (
      <div style={{ padding: '16px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Collapse mode banner */}
        {collapseBanner && (
          <div style={{ background: '#92400e', color: '#fef3c7', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
            Switching to easier questions to rebuild momentum.
          </div>
        )}

        {/* Mnemonic + analogy (Encode/Chunk phases) */}
        {(phase.name === 'Encode' || phase.name === 'Chunk') && (phase.mnemonic || phase.analogy) && (
          <div style={{ ...S.card, borderLeft: `3px solid ${PHASE_COLORS[phase.name]}` }}>
            {phase.mnemonic && <div style={{ fontSize: 13, marginBottom: 6 }}>🧩 <strong>Mnemonic:</strong> {phase.mnemonic}</div>}
            {phase.analogy && <div style={{ fontSize: 13 }}>🌍 <strong>Analogy:</strong> {phase.analogy}</div>}
          </div>
        )}

        {/* AI-generated phase content */}
        <div style={S.card}>
          <div style={{ fontSize: 12, color: PHASE_COLORS[phase.name], fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            {phase.bloomsTag} · {phase.domainRule ?? ''}
          </div>
          <div
            style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: safeRenderMd(phase.content) }}
          />
          {phase.keyPoints?.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {phase.keyPoints.map((kp, i) => (
                <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent)' }}>▸</span> {kp}
                </div>
              ))}
            </div>
          )}
          {/* Multimodal hooks */}
          {(phase.visualAnchor || phase.auditoryHook || phase.kinesthetic) && (
            <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {phase.visualAnchor && <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 6 }}>👁 {phase.visualAnchor}</span>}
              {phase.auditoryHook && <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 6 }}>🔊 {phase.auditoryHook}</span>}
              {phase.kinesthetic && <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-primary)', padding: '4px 8px', borderRadius: 6 }}>✋ {phase.kinesthetic}</span>}
            </div>
          )}
        </div>

        {/* Break phase: big countdown */}
        {phase.name === 'Break' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>☕</div>
            <div style={{ fontSize: 36, fontFamily: 'DM Mono, monospace', fontWeight: 700, color: PHASE_COLORS.Break }}>{fmtTime(timeRemaining)}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Brain consolidation in progress. Step away, hydrate.</div>
          </div>
        )}

        {/* Encode / Test: flashcard grading */}
        {isEncodeOrTest && currentCard && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text-primary)' }}>{currentCard.front}</div>
            {!showAnswer ? (
              <button onClick={() => setShowAnswer(true)} style={{ ...S.btn(), width: '100%', textAlign: 'center' }}>
                Show Answer
              </button>
            ) : (
              <>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}
                  dangerouslySetInnerHTML={{ __html: safeRenderMd(currentCard.back) }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
                  {([1, 2, 3, 4] as const).map(g => (
                    <button key={g} onClick={() => handleGrade(g)} style={{
                      padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border)',
                      background: g === 1 ? '#ef444420' : g === 2 ? '#f9731620' : g === 3 ? '#22c55e20' : '#3b82f620',
                      color: g === 1 ? '#ef4444' : g === 2 ? '#f97316' : g === 3 ? '#22c55e' : '#3b82f6',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}>
                      {g === 1 ? 'Again' : g === 2 ? 'Hard' : g === 3 ? 'Good' : 'Easy'}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
                  Card {Math.min(currentCardIdx + 1, activeCards.length)} / {activeCards.length} · {phaseCorrect} correct
                </div>
              </>
            )}
          </div>
        )}

        {/* Report phase: WHY chain self-assessment */}
        {phase.name === 'Report' && cycle.whyChains?.length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--accent)' }}>WHY Chain Self-Assessment</div>
            {cycle.whyChains.map((chain, i) => (
              <div key={i} style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, background: 'var(--bg-primary)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>{chain}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleWhyChain(chain, 'ok')}
                    style={{ ...S.btn(whyChainAssessment[chain] === 'ok'), padding: '6px 14px', fontSize: 12 }}
                  >Got it ✓</button>
                  <button
                    onClick={() => handleWhyChain(chain, 'unclear')}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: '1px solid #ef444450',
                      background: whyChainAssessment[chain] === 'unclear' ? '#ef444420' : 'transparent',
                      color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    }}
                  >Still unclear ✗</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Anchor phase: memory palace prompt */}
        {phase.name === 'Anchor' && gradedCards.filter(c => (c.grade ?? 3) <= 2).length > 0 && (
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: PHASE_COLORS.Anchor }}>Memory Palace — Hardest Concepts</div>
            {gradedCards.filter(c => (c.grade ?? 3) <= 2).slice(0, 3).map((c, i) => (
              <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', gap: 8 }}>
                <span style={{ color: PHASE_COLORS.Anchor }}>🏛️</span>
                <span>Place "<strong>{c.front}</strong>" at a vivid location in your mental walk-through.</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Screen renders ────────────────────────────────────────────────────────

  // Duration picker
  if (screen.screen === 'duration') {
    return (
      <div style={{ ...S.container, padding: 24, textAlign: 'center' }}>
        {onClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, ...S.btn() }}>✕</button>
        )}
        <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 22, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>Omni Protocol V6</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.6 }}>
          AI-personalized multi-cycle study session. How long do you have?
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
          {DURATION_OPTIONS.map(m => {
            const cfg = parseDurationChoice(m);
            return (
              <button key={m} onClick={() => handleDurationSelect(m)} style={{
                padding: '14px 22px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--bg-secondary, #111)', color: 'var(--text-primary)',
                cursor: 'pointer', fontFamily: 'Sora, sans-serif',
              }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{m === 60 ? '1hr' : m === 90 ? '1.5hr' : m === 120 ? '2hr' : m === 150 ? '2.5hr' : '3hr'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{cfg.cycleCount} cycle{cfg.cycleCount > 1 ? 's' : ''}{cfg.extended ? ' +' : ''}</div>
              </button>
            );
          })}
        </div>
        {toastMsg && (
          <div style={{ background: '#92400e20', border: '1px solid #92400e', color: '#fef3c7', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginTop: 8 }}>
            ⚠️ {toastMsg}
          </div>
        )}
      </div>
    );
  }

  // Loading
  if (screen.screen === 'loading') {
    return (
      <div style={{ ...S.container, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>{loadingMsg || 'Loading...'}</div>
        <div style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  // Wizard
  if (screen.screen === 'wizard') {
    const step = screen.step;
    const selectedCourse = courses.find(c => c.id === selectedCourseId);

    return (
      <div style={{ ...S.container }}>
        <div style={{ ...S.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Setup — Step {step} of 4
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4].map(s => (
              <div key={s} style={{ width: 20, height: 4, borderRadius: 2, background: s <= step ? 'var(--accent)' : 'var(--border)' }} />
            ))}
          </div>
        </div>

        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
          {/* Step 1: Course/Topic/Difficulty/Arc */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Course</div>
                <select
                  value={selectedCourseId}
                  onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopic(''); }}
                  style={{ ...S.input }}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {courses.length === 0 && <option value=''>No courses found — add courses first</option>}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Topic (optional)</div>
                <select value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} style={{ ...S.input }}>
                  <option value=''>All topics</option>
                  {(selectedCourse?.topics ?? []).map(t => <option key={t.id ?? t.name} value={t.name}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Session Difficulty</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {DIFFICULTY_OPTIONS.map(d => (
                    <button key={d} onClick={() => setDifficulty(d)} style={{
                      ...S.btn(difficulty === d), flex: 1, textAlign: 'center',
                    }}>{d === 'DeepDive' ? 'Deep Dive' : d}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Your Learning Arc</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ARC_PHASES.map(p => (
                    <button key={p} onClick={() => setArcPhase(p)} style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 8,
                      border: arcPhase === p ? '1px solid var(--accent)' : '1px solid var(--border)',
                      background: arcPhase === p ? 'var(--accent)15' : 'transparent',
                      color: arcPhase === p ? 'var(--accent)' : 'var(--text-secondary)',
                      cursor: 'pointer', fontSize: 13,
                    }}>
                      <span style={{ fontWeight: 700 }}>{p}</span>
                      <span style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>{ARC_PHASE_DESC[p]}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleWizardStep1Next}
                disabled={!selectedCourseId}
                style={{ ...S.btn(true), marginTop: 8 }}
              >
                Next →
              </button>
            </div>
          )}

          {/* Step 2: Intake */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loadingMsg ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  <div>{loadingMsg}</div>
                  <div style={{ width: 30, height: 30, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '12px auto 0' }} />
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {intakeType === 'cold_start' ? '5-Question Diagnostic' : 'Quick Intake'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10 }}>
                    {intakeType === 'cold_start'
                      ? 'Answer briefly — Claude uses this to calibrate your session.'
                      : 'Help Claude tailor your session to what you actually need.'}
                  </div>
                  {intakeQuestions.map((q, i) => (
                    <div key={i}>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6, fontWeight: 600 }}>
                        {i + 1}. {q}
                      </div>
                      <textarea
                        value={intakeAnswers[i] ?? ''}
                        onChange={e => setIntakeAnswers(prev => prev.map((a, j) => j === i ? e.target.value : a))}
                        placeholder='Your answer...'
                        rows={2}
                        style={{ ...S.input, resize: 'vertical' }}
                      />
                    </div>
                  ))}
                  <button onClick={() => setScreen({ screen: 'wizard', step: 3 })} style={{ ...S.btn(true) }}>
                    Next →
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 3: Professor emphasis */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Professor Emphasis (optional)</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Paste keywords, exam headers, or topics your professor emphasized most. Claude will angle Cycle 3 toward these. Leave blank to use MCAT/AP high-frequency defaults.
              </div>
              <textarea
                value={professorEmphasis}
                onChange={e => setProfessorEmphasis(e.target.value)}
                placeholder='e.g. "Na/K pump mechanism, action potential threshold, Nernst equation..."'
                rows={4}
                style={{ ...S.input, resize: 'vertical' }}
              />
              {pendingFeynmanRef.current.length > 0 && (
                <div style={{ ...S.card, borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Prior Feynman Gaps Being Targeted</div>
                  {pendingFeynmanRef.current.slice(0, 5).map((g, i) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>• {g.concept}</div>
                  ))}
                </div>
              )}
              <button onClick={handleWizardStep3Submit} style={{ ...S.btn(true) }}>
                Generate My Session Plan ✨
              </button>
            </div>
          )}

          {/* Step 4: Plan loading */}
          {step === 4 && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              {planError ? (
                <>
                  <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{planError}</div>
                  <button onClick={handleWizardStep3Submit} style={{ ...S.btn(true) }}>Retry</button>
                  <button onClick={() => setScreen({ screen: 'wizard', step: 3 })} style={{ ...S.btn(), marginLeft: 8 }}>Back</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{loadingMsg}</div>
                  <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                    {durationConfig.cycleCount} cycle{durationConfig.cycleCount > 1 ? 's' : ''} · {durationConfig.durationMin} minutes
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Running
  if (screen.screen === 'running') {
    const { cycleIdx, phaseIdx } = screen;
    const cycle = sessionPlan?.cycles[cycleIdx];
    const phase = cycle?.phases[phaseIdx];
    if (!sessionPlan || !cycle || !phase) return null;
    const phaseName = phase.name;
    const phaseColor = PHASE_COLORS[phaseName] ?? '#F5A623';

    return (
      <div style={{ ...S.container }}>
        {/* XP popup */}
        {xpPopup && (
          <div style={{
            position: 'fixed', top: 80, right: 16, background: 'var(--accent)', color: '#000',
            padding: '8px 16px', borderRadius: 8, fontWeight: 800, fontSize: 14,
            fontFamily: 'DM Mono, monospace', zIndex: 999, animation: 'fadeUp 2s ease forwards',
          }}>{xpPopup}</div>
        )}

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
              Cycle {cycleIdx + 1} of {sessionPlan.cycleCount} — {cycle.bloomsTarget}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, fontWeight: 700, color: phaseColor }}>
                {fmtTime(timeRemaining)}
              </div>
              <button onClick={() => setIsPaused(p => !p)} style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }}>
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button onClick={advancePhase} style={{ ...S.btn(), padding: '4px 10px', fontSize: 11 }}>
                Skip →
              </button>
            </div>
          </div>
          {renderProgressBars(cycleIdx, phaseIdx)}
          {/* Phase pills */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
            {cycle.phases.map((p, i) => (
              <div key={i} style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 12,
                background: i < phaseIdx ? '#22c55e20' : i === phaseIdx ? `${phaseColor}25` : 'var(--bg-primary)',
                color: i < phaseIdx ? '#22c55e' : i === phaseIdx ? phaseColor : 'var(--text-muted)',
                border: `1px solid ${i === phaseIdx ? phaseColor : 'transparent'}`,
                fontWeight: i === phaseIdx ? 700 : 400,
              }}>
                {PHASE_ICONS[p.name]} {p.name}
              </div>
            ))}
          </div>
        </div>

        {/* Phase title */}
        <div style={{ padding: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 24 }}>{PHASE_ICONS[phaseName]}</div>
          <div>
            <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 16, fontWeight: 800, color: phaseColor }}>{phaseName}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cycle.cycleTheme}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)' }}>
            {phase.duration} min · {totalXp} XP
          </div>
        </div>

        {/* Phase content */}
        {renderPhaseContent(cycleIdx, phaseIdx)}
      </div>
    );
  }

  // Interstitial
  if (screen.screen === 'interstitial') {
    const { afterCycle } = screen;
    const cycle = sessionPlan?.cycles[afterCycle];
    const cycleResults = phaseResults.filter(r => r.cycleIdx === afterCycle);
    const cycleAccuracy = cycleResults.length
      ? Math.round(cycleResults.reduce((s, r) => s + r.accuracy, 0) / cycleResults.length)
      : 0;

    return (
      <div style={{ ...S.container, alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
        <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
          Cycle {afterCycle + 1} Complete
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{cycle?.cycleTheme}</div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, justifyContent: 'center' }}>
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{cycleAccuracy}%</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Accuracy</div>
          </div>
          <div>
            <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>{totalXp}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>XP Earned</div>
          </div>
        </div>
        {(cycle?.whyChains?.length ?? 0) > 0 && (
          <div style={{ ...S.card, textAlign: 'left', marginBottom: 20, width: '100%', maxWidth: 400 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>WHY Chains Covered</div>
            {(cycle?.whyChains ?? []).slice(0, 3).map((c, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>• {c}</div>
            ))}
          </div>
        )}
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, fontWeight: 700, color: '#06b6d4', marginBottom: 8 }}>
          {fmtTime(interstitialTime)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Next cycle starts automatically. Take a moment.</div>
        <button onClick={startNextCycle} style={{ ...S.btn(true) }}>
          Start Cycle {afterCycle + 2} Now →
        </button>
      </div>
    );
  }

  // Final report
  if (screen.screen === 'final-report') {
    const isLoading = screen.loading;
    const overallAccuracy = phaseResults.length
      ? Math.round(phaseResults.reduce((s, r) => s + r.accuracy, 0) / phaseResults.length)
      : 0;
    const minutes = Math.round((Date.now() - sessionStartRef.current) / 60000);
    const newArcPhase = determineArcPhaseProgression(arcPhase, overallAccuracy);

    return (
      <div style={{ ...S.container }}>
        <div style={{ ...S.header }}>
          <div style={{ fontFamily: 'Sora, sans-serif', fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Session Debrief</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sessionPlan?.sessionTitle}</div>
        </div>
        {/* Stats row */}
        <div style={{ display: 'flex', gap: 12, padding: '12px 16px', background: 'var(--bg-secondary, #111)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {[
            { label: 'XP', value: totalXp },
            { label: 'Accuracy', value: `${overallAccuracy}%` },
            { label: 'Cards', value: phaseResults.reduce((s, r) => s + r.cardsReviewed, 0) },
            { label: 'Time', value: `${minutes}m` },
            { label: 'Resets', value: motivationState.motivationResets },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', minWidth: 60 }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
          {newArcPhase !== arcPhase && (
            <div style={{ background: '#22c55e20', border: '1px solid #22c55e50', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#22c55e', alignSelf: 'center' }}>
              Arc ↑ {arcPhase} → {newArcPhase}
            </div>
          )}
        </div>
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Claude is writing your debrief...</div>
              <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
            </div>
          ) : null}
          {finalReportText && (
            <div
              style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.8 }}
              dangerouslySetInnerHTML={{ __html: safeRenderMd(finalReportText) }}
            />
          )}
        </div>
        {!isLoading && (
          <div style={{ padding: 16, borderTop: '1px solid var(--border)' }}>
            <button onClick={onComplete} style={{ ...S.btn(true), width: '100%', textAlign: 'center' }}>
              Done ✓
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Export ────────────────────────────────────────────────────────────────────

export function OmniProtocol(props: { courseId?: string; onComplete: () => void; onClose?: () => void }) {
  return (
    <ToolErrorBoundary toolName="Omni Protocol V6">
      <OmniProtocolInner {...props} />
    </ToolErrorBoundary>
  );
}

export default OmniProtocol;
