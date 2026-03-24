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
  // V6.1 adaptive engine
  buildStudyGuideSummaryPrompt, buildMCPreTestPrompt, scoreMCPreTest,
  computeAdaptiveAllocation, recommendOutputTokens, truncateToWords, countWords,
  // V6.3 crisis mode
  categorizeCrisisErrors, flagMnemonicTopics, buildCrisisSessionPlanPrompt,
  CRISIS_ERROR_TREATMENTS,
  type OmniDurationConfig, type MotivationState,
} from '../../utils/omniV6';
import type {
  OmniArcPhase, OmniDifficulty, OmniSessionPlan, OmniPhaseResult,
  OmniFeynmanGap, OmniSessionRecord, OmniProtocolData,
  OmniSuspendedSession, OmniAdaptiveAllocation, OmniMCQuestion,
  OmniCrisisErrorType, OmniCrisisMCAnswer, OmniCrisisAdaptiveAllocation,
} from '../../types';
import type { Course } from '../../types';
import { DataRepository } from '../../utils/dataRepository';

// ── Types ────────────────────────────────────────────────────────────────────

interface OmniProps {
  courseId?: string;
  onComplete: () => void;
  onClose?: () => void;
}

type OmniScreen =
  | { screen: 'resume' }
  | { screen: 'duration' }
  | { screen: 'loading' }
  | { screen: 'wizard'; step: 1 | 2 | 3 | 4 | 5 | 6 }
  | { screen: 'crisis-wizard'; step: 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' }
  | { screen: 'running'; cycleIdx: number; phaseIdx: number }
  | { screen: 'interstitial'; afterCycle: number }
  | { screen: 'final-report'; loading: boolean }
  | { screen: 'complete' };

interface CardWithMeta { courseId: string; courseName: string; front: string; back: string; topic?: string; grade?: 1 | 2 | 3 | 4; }

const OMNI_SUSPEND_KEY = 'omni-suspended-session';
const OMNI_SUSPEND_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Constants ─────────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, string> = {
  Prime: '📋', Chunk: '🎼', Decode: '🔓', Encode: '🧠', Connect: '🌉',
  Break: '☕', Test: '🔍', Anchor: '🏛️', Report: '📊',
};
const PHASE_COLORS: Record<string, string> = {
  Prime: '#ef4444', Chunk: '#f97316', Decode: '#fb923c', Encode: '#eab308', Connect: '#22c55e',
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
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<OmniDifficulty>('Review');
  const [arcPhase, setArcPhase] = useState<OmniArcPhase>('Foundation');
  const [intakeQuestions, setIntakeQuestions] = useState<string[]>([]);
  const [intakeType, setIntakeType] = useState<'questions' | 'cold_start'>('questions');
  const [intakeAnswers, setIntakeAnswers] = useState<string[]>([]);
  const [professorEmphasis, setProfessorEmphasis] = useState('');

  // V6.1 — Study guide + adaptive allocation
  const [rawStudyGuide, setRawStudyGuide] = useState('');
  const [guideSummary, setGuideSummary] = useState('');
  const [guideKeywords, setGuideKeywords] = useState<string[]>([]);
  const [guideMainTopics, setGuideMainTopics] = useState<string[]>([]);
  const [guideProcessing, setGuideProcessing] = useState(false);
  const [mcQuestions, setMcQuestions] = useState<OmniMCQuestion[]>([]);
  const [mcAnswers, setMcAnswers] = useState<Record<number, number>>({});
  const [adaptiveAllocation, setAdaptiveAllocation] = useState<OmniAdaptiveAllocation | null>(null);
  const [usedStudyGuide, setUsedStudyGuide] = useState(false);
  const [preTestScore, setPreTestScore] = useState<{ correct: number; total: number; pct: number; weakAreas: string[]; strongAreas: string[] } | null>(null);
  const [newKeywordInput, setNewKeywordInput] = useState('');

  // V6.3 — Crisis mode
  const [crisisMode, setCrisisMode] = useState(false);
  const [examDateTime, setExamDateTime] = useState('');
  const [availableSources, setAvailableSources] = useState<string[]>([]);
  const [tieredTopics, setTieredTopics] = useState<{ tier1: string[]; tier2: string[]; tier3: string[] }>({ tier1: [], tier2: [], tier3: [] });
  const [crisisAnswers, setCrisisAnswers] = useState<OmniCrisisMCAnswer[]>([]);
  const [userConfidence, setUserConfidence] = useState<Record<number, 'sure' | 'guess'>>({});
  const [mnemonicTopics, setMnemonicTopics] = useState<string[]>([]);
  const [anchorSentences, setAnchorSentences] = useState<string[]>([]);
  const [currentCrisisDay, setCurrentCrisisDay] = useState<1 | 2>(1);
  const [currentCrisisCycle, setCurrentCrisisCycle] = useState(1);
  const [crisisPromptCopied, setCrisisPromptCopied] = useState(false);

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

  // ── Suspended session state ──────────────────────────────────────────────
  const [suspendedSession, setSuspendedSession] = useState<OmniSuspendedSession | null>(null);
  const isSessionActive = useRef(false); // tracks if session has progressed past duration picker

  // ── Data pull refs (populated during 'loading' screen) ───────────────────
  const dueCardsRef = useRef<ReturnType<typeof getOmniDueCards>>([]);
  const pendingFeynmanRef = useRef<OmniFeynmanGap[]>([]);
  const knowledgeConnectionsRef = useRef<string[]>([]);

  // ── Session save/resume helpers ─────────────────────────────────────────

  /** Serialize current state into a suspendable snapshot */
  function buildSnapshot(): OmniSuspendedSession {
    return {
      savedAt: new Date().toISOString(),
      screen: screen as OmniSuspendedSession['screen'],
      selectedCourseId,
      selectedTopics,
      difficulty,
      arcPhase,
      intakeAnswers,
      professorEmphasis,
      durationConfig,
      sessionPlan,
      phaseResults,
      motivationState,
      totalXp,
      sessionStartedAt: sessionStartRef.current,
      timeRemaining,
      phaseCards,
      currentCardIdx,
      gradedCards,
      phaseCorrect,
      phaseTotal,
      whyChainAssessment,
      pendingGaps,
      // V6.1
      rawStudyGuide,
      guideSummary,
      guideKeywords,
      guideMainTopics,
      mcQuestions,
      mcAnswers,
      adaptiveAllocation,
      usedStudyGuide,
      // V6.3 Crisis
      crisisMode,
      crisisAnswers,
      tieredTopics,
      currentCrisisDay,
      currentCrisisCycle,
      anchorSentences,
      examDateTime,
      availableSources,
      userConfidence,
      mnemonicTopics,
    };
  }

  /** Hydrate all state from a suspended session snapshot */
  function hydrateFromSnapshot(snap: OmniSuspendedSession) {
    setSelectedCourseId(snap.selectedCourseId);
    setSelectedTopics(snap.selectedTopics);
    setDifficulty(snap.difficulty);
    setArcPhase(snap.arcPhase);
    setIntakeAnswers(snap.intakeAnswers);
    setProfessorEmphasis(snap.professorEmphasis);
    setDurationConfig(snap.durationConfig);
    setSessionPlan(snap.sessionPlan);
    setPhaseResults(snap.phaseResults);
    setMotivationState(snap.motivationState);
    setTotalXp(snap.totalXp);
    sessionStartRef.current = snap.sessionStartedAt;
    setTimeRemaining(snap.timeRemaining);
    setPhaseCards(snap.phaseCards);
    setCurrentCardIdx(snap.currentCardIdx);
    setGradedCards(snap.gradedCards);
    setPhaseCorrect(snap.phaseCorrect);
    setPhaseTotal(snap.phaseTotal);
    setWhyChainAssessment(snap.whyChainAssessment);
    setPendingGaps(snap.pendingGaps);
    // V6.1
    if (snap.rawStudyGuide) setRawStudyGuide(snap.rawStudyGuide);
    if (snap.guideSummary) setGuideSummary(snap.guideSummary);
    if (snap.guideKeywords) setGuideKeywords(snap.guideKeywords);
    if (snap.guideMainTopics) setGuideMainTopics(snap.guideMainTopics);
    if (snap.mcQuestions) setMcQuestions(snap.mcQuestions);
    if (snap.mcAnswers) setMcAnswers(snap.mcAnswers);
    if (snap.adaptiveAllocation !== undefined) setAdaptiveAllocation(snap.adaptiveAllocation);
    if (snap.usedStudyGuide !== undefined) setUsedStudyGuide(snap.usedStudyGuide);
    // V6.3 Crisis
    if (snap.crisisMode) setCrisisMode(snap.crisisMode);
    if (snap.crisisAnswers) setCrisisAnswers(snap.crisisAnswers);
    if (snap.tieredTopics) setTieredTopics(snap.tieredTopics);
    if (snap.currentCrisisDay) setCurrentCrisisDay(snap.currentCrisisDay);
    if (snap.currentCrisisCycle) setCurrentCrisisCycle(snap.currentCrisisCycle);
    if (snap.anchorSentences) setAnchorSentences(snap.anchorSentences);
    if (snap.examDateTime) setExamDateTime(snap.examDateTime);
    if (snap.availableSources) setAvailableSources(snap.availableSources);
    if (snap.userConfidence) setUserConfidence(snap.userConfidence);
    if (snap.mnemonicTopics) setMnemonicTopics(snap.mnemonicTopics);
    isSessionActive.current = true;
    setScreen(snap.screen as OmniScreen);
  }

  // Check for suspended session on mount
  useEffect(() => {
    DataRepository.get<OmniSuspendedSession>(OMNI_SUSPEND_KEY).then(snap => {
      if (!snap) return;
      const age = Date.now() - new Date(snap.savedAt).getTime();
      if (age > OMNI_SUSPEND_EXPIRY_MS) {
        DataRepository.delete(OMNI_SUSPEND_KEY).catch(() => {});
        return;
      }
      setSuspendedSession(snap);
      setScreen({ screen: 'resume' });
    }).catch(() => {});
  }, []);

  // Auto-save on every screen transition (except duration/resume/complete)
  useEffect(() => {
    const s = screen.screen;
    if (s === 'duration' || s === 'resume') return;
    if (s === 'complete') {
      DataRepository.delete(OMNI_SUSPEND_KEY).catch(() => {});
      isSessionActive.current = false;
      return;
    }
    // Only save once we have a session plan OR we're in a wizard flow (meaningful state to restore)
    if (!sessionPlan && s !== 'wizard' && s !== 'loading' && s !== 'crisis-wizard') return;
    isSessionActive.current = true;
    DataRepository.set(OMNI_SUSPEND_KEY, buildSnapshot()).catch(() => {});
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save on unmount if session is active (user navigates away)
  useEffect(() => {
    return () => {
      if (isSessionActive.current && sessionPlan) {
        // Sync save — DataRepository handles async internally, best-effort
        DataRepository.set(OMNI_SUSPEND_KEY, buildSnapshot()).catch(() => {});
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const topicId = selectedTopics[0] ?? '';

    dueCardsRef.current = getOmniDueCards(srData, { courseIds: courseId ? [courseId] : [], topics: [] });
    pendingFeynmanRef.current = getPendingFeynmanGaps(omniData, courseId);
    knowledgeConnectionsRef.current = getKnowledgeGraphConnections(courses, courseId, topicId);

    // Pre-fill arc phase from stored data
    const storedArc = getArcPhaseForCourse(omniData, courseId);
    setArcPhase(storedArc);
    setSelectedCourseId(courseId);

    // Route to crisis wizard or standard wizard based on crisisMode flag
    if (crisisMode) {
      setScreen({ screen: 'crisis-wizard', step: 'C1' });
    } else {
      setScreen({ screen: 'wizard', step: 1 });
    }
  }, [screen.screen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wizard step transitions ───────────────────────────────────────────────

  async function handleWizardStep1Next() {
    // V6.1: Go to study guide step first (step 2)
    setScreen({ screen: 'wizard', step: 2 });
    setUsedStudyGuide(false); // Will be set to true if user processes a study guide
    return;
  }

  /** V6.1: Process pasted study guide with AI summarization */
  async function handleStudyGuideProcess() {
    if (!rawStudyGuide.trim()) return;
    setGuideProcessing(true);

    // Edge case: very short input (<50 words) — use directly
    if (countWords(rawStudyGuide) < 50) {
      setGuideSummary(rawStudyGuide.trim());
      setGuideKeywords([]);
      setGuideMainTopics([]);
      setGuideProcessing(false);
      setUsedStudyGuide(true);
      return;
    }

    try {
      const msgs = buildStudyGuideSummaryPrompt({
        rawText: rawStudyGuide,
        topic: selectedTopics.join(', ') || 'General',
        courseName: courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId,
      });
      const raw = await callAI(msgs, { temperature: 0.3, maxTokens: 800, json: true }, 'omni');
      try {
        const parsed = JSON.parse(raw);
        setGuideSummary(parsed.summary ?? '');
        setGuideKeywords(parsed.keywords ?? []);
        setGuideMainTopics(parsed.mainTopics ?? []);
        setUsedStudyGuide(true);
      } catch {
        showToast('Could not parse AI response. Try again or skip.');
      }
    } catch {
      showToast('AI processing failed. You can try again or continue without.');
    }
    setGuideProcessing(false);
  }

  /** V6.1: Skip study guide → go to old free-text intake */
  async function handleSkipStudyGuide() {
    setUsedStudyGuide(false);
    setScreen({ screen: 'wizard', step: 3 });
    setLoadingMsg('Generating intake assessment...');
    try {
      const msgs = buildIntakePrompt({
        topic: selectedTopics.join(', ') || 'General',
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
        setIntakeQuestions([`What do you already know about "${selectedTopics.join(', ') || 'this topic'}" and where do you feel least confident?`]);
        setIntakeAnswers(['']);
      }
      setLoadingMsg('');
    } catch {
      setLoadingMsg('');
      setIntakeQuestions([`What do you already know about "${selectedTopics.join(', ') || 'this topic'}"?`]);
      setIntakeAnswers(['']);
    }
  }

  /** V6.1: Generate MC pre-test from study guide summary + keywords */
  async function handleStudyGuideToPreTest() {
    setScreen({ screen: 'wizard', step: 3 });
    setLoadingMsg('Generating pre-test from your study guide...');
    try {
      const msgs = buildMCPreTestPrompt({
        summary: guideSummary,
        keywords: guideKeywords,
        mainTopics: guideMainTopics,
        topic: selectedTopics.join(', ') || 'General',
        courseName: courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId,
        difficulty,
        arcPhase,
        feynmanGaps: pendingFeynmanRef.current,
      });
      const raw = await callAI(msgs, { temperature: 0.4, maxTokens: 1500, json: true }, 'omni');
      try {
        const parsed = JSON.parse(raw);
        setMcQuestions(parsed.questions ?? []);
        setMcAnswers({});
      } catch {
        // Fallback: 5 basic diagnostic questions
        setMcQuestions([]);
        showToast('Pre-test generation failed. Continuing with default intake.');
        handleSkipStudyGuide();
        return;
      }
      setLoadingMsg('');
    } catch {
      setLoadingMsg('');
      showToast('AI call failed. Falling back to standard intake.');
      handleSkipStudyGuide();
    }
  }

  /** V6.1: Score pre-test and compute adaptive allocation */
  function handlePreTestSubmit() {
    const score = scoreMCPreTest(mcQuestions, mcAnswers);
    setPreTestScore(score);

    const allocation = computeAdaptiveAllocation(
      durationConfig.durationMin,
      score.pct,
      score.weakAreas,
      score.strongAreas,
      durationConfig.cycleCount,
      crisisMode
    );
    setAdaptiveAllocation(allocation);

    // Flag mnemonic topics for crisis mode
    if (crisisMode) {
      const mTopics = flagMnemonicTopics(guideKeywords, guideMainTopics);
      setMnemonicTopics(mTopics);

      const cAnswers = categorizeCrisisErrors(mcQuestions, mcAnswers, userConfidence);
      setCrisisAnswers(cAnswers);
    }
  }

  /** V6.1: Generate session plan with all adaptive data */
  async function handleGenerateSession() {
    const genStep = usedStudyGuide ? 6 : 4;
    setScreen({ screen: 'wizard', step: genStep as 4 | 6 });
    setLoadingMsg('Claude is building your personalized session plan...');
    setPlanError('');

    const sessionId = generateSessionId();
    const courseName = courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId;
    const topic = selectedTopics.join(', ') || 'General';

    // Compute dynamic token budget
    const { maxTokens, reasoning } = recommendOutputTokens({
      studyGuideSummaryWords: usedStudyGuide ? countWords(guideSummary) : 0,
      keywordCount: guideKeywords.length,
      weakAreaCount: preTestScore?.weakAreas.length ?? 0,
      strongAreaCount: preTestScore?.strongAreas.length ?? 0,
      totalMinutes: durationConfig.durationMin,
      cycleCount: durationConfig.cycleCount,
    });
    console.debug('[OmniV6.1] Token recommendation:', reasoning);

    // Build prompt based on flow type
    let msgs;
    if (crisisMode && usedStudyGuide && adaptiveAllocation) {
      const errorMap: Record<string, OmniCrisisErrorType> = {};
      crisisAnswers.forEach(a => {
        if (a.errorType) errorMap[a.targetTopic] = a.errorType;
      });
      msgs = buildCrisisSessionPlanPrompt({
        topic, courseName, difficulty, arcPhase, durationConfig, professorEmphasis,
        fsrsDueCards: dueCardsRef.current,
        feynmanGaps: pendingFeynmanRef.current,
        knowledgeConnections: knowledgeConnectionsRef.current,
        sessionId,
        studyGuideSummary: guideSummary,
        studyGuideKeywords: guideKeywords,
        allocation: adaptiveAllocation,
        preTestPct: preTestScore?.pct ?? 0,
        weakAreas: preTestScore?.weakAreas ?? [],
        strongAreas: preTestScore?.strongAreas ?? [],
        tieredTopics,
        errorMap,
        mnemonicTopics,
      });
    } else {
      const intakeSummary = usedStudyGuide
        ? ''
        : intakeQuestions.map((q, i) => `Q: ${q}\nA: ${intakeAnswers[i] ?? ''}`).join('\n\n');

      msgs = buildSessionPlanPrompt({
        topic, courseName, difficulty, arcPhase, durationConfig,
        intakeAnswers: intakeSummary,
        professorEmphasis,
        fsrsDueCards: dueCardsRef.current,
        feynmanGaps: pendingFeynmanRef.current,
        knowledgeConnections: knowledgeConnectionsRef.current,
        sessionId,
        // V6.1 optional fields
        ...(usedStudyGuide && adaptiveAllocation ? {
          studyGuideSummary: guideSummary,
          studyGuideKeywords: guideKeywords,
          allocation: adaptiveAllocation,
          preTestResults: preTestScore ?? undefined,
        } : {}),
      });
    }

    try {
      const raw = await callAI(msgs, { temperature: 0.6, maxTokens, json: true }, 'omni');
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

  // Legacy handler — kept for skip flow backward compat
  async function handleWizardStep3Submit() {
    // In skip flow, step 3 is the old intake, step 4 is emphasis, then generate
    // Redirect to the new generation handler
    handleGenerateSession();
    return;
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

  // Resume prompt
  if (screen.screen === 'resume' && suspendedSession) {
    const snap = suspendedSession;
    const course = courses.find(c => c.id === snap.selectedCourseId);
    const elapsed = Math.round((new Date(snap.savedAt).getTime() - snap.sessionStartedAt) / 60000);
    const screenLabel = snap.screen.screen === 'running'
      ? `Phase ${(snap.screen.phaseIdx ?? 0) + 1}, Cycle ${(snap.screen.cycleIdx ?? 0) + 1}`
      : snap.screen.screen === 'wizard' ? `Setup step ${snap.screen.step ?? 1}`
      : snap.screen.screen === 'crisis-wizard' ? `Crisis Mode — ${snap.screen.step ?? 'C1'}`
      : snap.screen.screen === 'interstitial' ? 'Break between cycles'
      : snap.screen.screen;
    const savedAgo = Math.round((Date.now() - new Date(snap.savedAt).getTime()) / 60000);
    const savedAgoLabel = savedAgo < 60 ? `${savedAgo}m ago` : `${Math.floor(savedAgo / 60)}h ${savedAgo % 60}m ago`;

    return (
      <div style={{ ...S.container, padding: 24, textAlign: 'center' }}>
        {onClose && (
          <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, ...S.btn() }}>✕</button>
        )}
        <div style={{ fontSize: 36, marginBottom: 8 }}>💾</div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontSize: 20, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)' }}>
          Unfinished Session
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          You have a session in progress. Resume where you left off or start fresh.
        </p>

        <div style={{ ...S.card, textAlign: 'left', marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--accent)' }}>
            {snap.sessionPlan?.sessionTitle || 'Omni Session'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
            <span>📚 {course?.name || snap.selectedCourseId}</span>
            <span>⏱️ {snap.durationConfig.durationMin} min session</span>
            <span>📍 {screenLabel}</span>
            <span>⭐ {snap.totalXp} XP earned</span>
            <span>🕐 Saved {savedAgoLabel}</span>
            {elapsed > 0 && <span>⏳ {elapsed}m elapsed</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={() => {
              hydrateFromSnapshot(snap);
              setSuspendedSession(null);
            }}
            style={{ ...S.btn(true), padding: '12px 28px' }}
          >
            Resume Session
          </button>
          <button
            onClick={() => {
              DataRepository.delete(OMNI_SUSPEND_KEY).catch(() => {});
              setSuspendedSession(null);
              setScreen({ screen: 'duration' });
            }}
            style={{ ...S.btn(), padding: '12px 28px' }}
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

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
        {/* Crisis Mode entry */}
        <button
          onClick={() => {
            setCrisisMode(true);
            setDurationConfig(parseDurationChoice(90)); // Crisis uses 90min cycles
            setScreen({ screen: 'loading' });
          }}
          style={{
            width: '100%', padding: '14px 20px', borderRadius: 10,
            border: '1px solid #ef4444', background: '#ef444410',
            color: '#ef4444', cursor: 'pointer', fontFamily: 'Sora, sans-serif',
            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Crisis Mode — 48hrs to Exam</div>
            <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 2 }}>F to A protocol. Triage first. Sleep mandatory.</div>
          </div>
        </button>

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
    const totalSteps = usedStudyGuide ? 6 : 4;

    return (
      <div style={{ ...S.container }}>
        <div style={{ ...S.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Setup — Step {step} of {totalSteps}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
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
                  onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopics([]); }}
                  style={{ ...S.input }}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {courses.length === 0 && <option value=''>No courses found — add courses first</option>}
                </select>
              </div>
              {(selectedCourse?.topics ?? []).length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Topic (optional){selectedTopics.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>{selectedTopics.length} selected</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setSelectedTopics((selectedCourse?.topics ?? []).map(t => t.name))}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >Select All</button>
                      <button
                        onClick={() => setSelectedTopics([])}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
                      >Clear</button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 180, overflowY: 'auto', padding: '4px 0' }}>
                    {(selectedCourse?.topics ?? []).map(t => {
                      const active = selectedTopics.includes(t.name);
                      return (
                        <button
                          key={t.id ?? t.name}
                          onClick={() => setSelectedTopics(prev =>
                            active ? prev.filter(x => x !== t.name) : [...prev, t.name]
                          )}
                          style={{
                            fontSize: 12, padding: '5px 10px', borderRadius: 20,
                            border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                            background: active ? 'var(--accent)22' : 'transparent',
                            color: active ? 'var(--accent)' : 'var(--text-secondary)',
                            cursor: 'pointer', transition: 'all 0.15s',
                            fontWeight: active ? 600 : 400,
                          }}
                        >{t.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}
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

          {/* Step 2: Study Guide Paste (NEW in V6.1) */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Study Guide / Source Material (optional)</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Paste your study guide, lecture notes, or textbook chapter. Claude will extract key concepts and generate a pre-test.
              </div>
              <textarea
                value={rawStudyGuide}
                onChange={e => setRawStudyGuide(e.target.value)}
                placeholder='Paste your study guide here... No limit on length.'
                rows={10}
                style={{ ...S.input, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{countWords(rawStudyGuide)} words</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleStudyGuideProcess}
                  disabled={!rawStudyGuide.trim() || guideProcessing}
                  style={{ ...S.btn(true), opacity: !rawStudyGuide.trim() || guideProcessing ? 0.5 : 1 }}
                >
                  {guideProcessing ? 'Processing...' : 'Process with AI'}
                </button>
                <button onClick={handleSkipStudyGuide} style={{ ...S.btn(), fontSize: 12 }}>
                  Skip — I'll wing it
                </button>
              </div>

              {/* AI-processed summary + keywords (shown after processing) */}
              {usedStudyGuide && guideSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                      AI Summary <span style={{ color: countWords(guideSummary) > 300 ? '#ef4444' : countWords(guideSummary) > 250 ? '#f59e0b' : 'var(--text-muted)' }}>({countWords(guideSummary)} / 300 words)</span>
                    </div>
                    <textarea
                      value={guideSummary}
                      onChange={e => setGuideSummary(e.target.value)}
                      rows={6}
                      style={{ ...S.input, resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {guideKeywords.map((kw, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: 'var(--accent)15', border: '1px solid var(--accent)40', fontSize: 12, color: 'var(--text-primary)' }}>
                          {kw}
                          <button onClick={() => setGuideKeywords(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input
                        value={newKeywordInput}
                        onChange={e => setNewKeywordInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newKeywordInput.trim()) {
                            setGuideKeywords(prev => [...prev, newKeywordInput.trim()]);
                            setNewKeywordInput('');
                          }
                        }}
                        placeholder='Add keyword...'
                        style={{ ...S.input, width: 160 }}
                      />
                    </div>
                  </div>
                  <button onClick={handleStudyGuideToPreTest} style={{ ...S.btn(true) }}>
                    Looks good → Generate Pre-Test
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: MC Pre-Test (V6.1) OR old free-text intake (skip flow) */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loadingMsg ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  <div>{loadingMsg}</div>
                  <div style={{ width: 30, height: 30, border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '12px auto 0' }} />
                </div>
              ) : usedStudyGuide && mcQuestions.length > 0 ? (
                /* MC Pre-Test */
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Pre-Test — {mcQuestions.length} Questions</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -10 }}>
                    Answer honestly. Guesses that happen to be correct are still wrong. This calibrates your session.
                  </div>

                  {preTestScore ? (
                    /* Pre-test results */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ ...S.card, textAlign: 'center' }}>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'DM Mono, monospace', color: preTestScore.pct >= 70 ? '#22c55e' : preTestScore.pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                          {preTestScore.correct}/{preTestScore.total} ({preTestScore.pct}%)
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {preTestScore.weakAreas.map((a, i) => (
                          <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#ef444420', border: '1px solid #ef4444', fontSize: 11, color: '#fca5a5' }}>{a}</span>
                        ))}
                        {preTestScore.strongAreas.map((a, i) => (
                          <span key={i} style={{ padding: '4px 10px', borderRadius: 20, background: '#22c55e20', border: '1px solid #22c55e', fontSize: 11, color: '#86efac' }}>{a}</span>
                        ))}
                      </div>
                      {/* Adaptive allocation table */}
                      {adaptiveAllocation && (
                        <div style={{ ...S.card }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Your Session Has Been Adjusted</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8, fontFamily: 'DM Mono, monospace' }}>
                            Chunk: {adaptiveAllocation.phase2_chunk}min | Encode: {adaptiveAllocation.phase3_encode}min | Connect: {adaptiveAllocation.phase4_connect}min | Test: {adaptiveAllocation.phase6_test}min
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                            {adaptiveAllocation.adaptationNote}
                          </div>
                        </div>
                      )}
                      <button onClick={() => setScreen({ screen: 'wizard', step: 4 })} style={{ ...S.btn(true) }}>
                        Next →
                      </button>
                    </div>
                  ) : (
                    /* MC questions */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {mcQuestions.map((q, qi) => (
                        <div key={qi} style={{ ...S.card }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Q{qi + 1}</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: q.difficulty === 'easy' ? '#22c55e20' : q.difficulty === 'hard' ? '#ef444420' : '#f59e0b20', color: q.difficulty === 'easy' ? '#86efac' : q.difficulty === 'hard' ? '#fca5a5' : '#fde68a' }}>{q.difficulty}</span>
                              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>{q.bloomsLevel}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>{q.q}</div>
                          {q.options.map((opt: string, oi: number) => (
                            <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: mcAnswers[qi] === oi ? 'var(--accent)15' : 'transparent', border: mcAnswers[qi] === oi ? '1px solid var(--accent)' : '1px solid transparent', marginBottom: 4 }}>
                              <input
                                type='radio'
                                name={`mc-q-${qi}`}
                                checked={mcAnswers[qi] === oi}
                                onChange={() => setMcAnswers(prev => ({ ...prev, [qi]: oi }))}
                                style={{ accentColor: 'var(--accent)' }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{String.fromCharCode(65 + oi)}. {opt}</span>
                            </label>
                          ))}
                          {/* Crisis mode confidence selector */}
                          {crisisMode && mcAnswers[qi] !== undefined && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                              {(['sure', 'guess'] as const).map(conf => (
                                <button key={conf} onClick={() => setUserConfidence(prev => ({ ...prev, [qi]: conf }))} style={{
                                  fontSize: 11, padding: '3px 10px', borderRadius: 4,
                                  border: userConfidence[qi] === conf ? '1px solid var(--accent)' : '1px solid var(--border)',
                                  background: userConfidence[qi] === conf ? 'var(--accent)15' : 'transparent',
                                  color: userConfidence[qi] === conf ? 'var(--accent)' : 'var(--text-muted)',
                                  cursor: 'pointer',
                                }}>{conf === 'sure' ? 'I knew it' : 'I guessed'}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={handlePreTestSubmit}
                        disabled={Object.keys(mcAnswers).length < mcQuestions.length}
                        style={{ ...S.btn(true), opacity: Object.keys(mcAnswers).length < mcQuestions.length ? 0.5 : 1 }}
                      >
                        Submit Pre-Test
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Old free-text intake (skip flow) */
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
                  <button onClick={() => setScreen({ screen: 'wizard', step: 4 })} style={{ ...S.btn(true) }}>
                    Next →
                  </button>
                </>
              )}
            </div>
          )}

          {/* Step 4: Professor emphasis */}
          {step === 4 && (
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
              <button onClick={() => {
                if (usedStudyGuide) {
                  setScreen({ screen: 'wizard', step: 5 }); // go to preview
                } else {
                  handleGenerateSession(); // skip flow: go straight to generation
                }
              }} style={{ ...S.btn(true) }}>
                {usedStudyGuide ? 'Next → Preview' : 'Generate My Session Plan'}
              </button>
            </div>
          )}

          {/* Step 5: Session Preview (V6.1) */}
          {step === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Session Preview</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Everything below feeds into your session. Review and adjust before generating.</div>

              {/* Config summary */}
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Session Config</div>
                <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                  {courses.find(c => c.id === selectedCourseId)?.name} | {selectedTopics.join(', ') || 'General'} | {difficulty} | {arcPhase} | {durationConfig.durationMin}min ({durationConfig.cycleCount} cycle{durationConfig.cycleCount > 1 ? 's' : ''})
                </div>
              </div>

              {/* Adaptive time layout */}
              {adaptiveAllocation && (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Adaptive Time Layout</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
                    Prime: {adaptiveAllocation.phase1_prime}m | Chunk: {adaptiveAllocation.phase2_chunk}m | Decode: {adaptiveAllocation.phase2_5_decode}m | Encode: {adaptiveAllocation.phase3_encode}m | Connect: {adaptiveAllocation.phase4_connect}m | Break: {adaptiveAllocation.phase5_break}m | Test: {adaptiveAllocation.phase6_test}m | Anchor: {adaptiveAllocation.phase7_anchor}m
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4, fontStyle: 'italic' }}>{adaptiveAllocation.adaptationNote}</div>
                </div>
              )}

              {/* Study guide summary (editable) */}
              {guideSummary && (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Study Guide Summary ({countWords(guideSummary)} / 300 words)
                  </div>
                  <textarea value={guideSummary} onChange={e => setGuideSummary(e.target.value)} rows={4} style={{ ...S.input, resize: 'vertical', fontSize: 12 }} />
                </div>
              )}

              {/* Pre-test results */}
              {preTestScore && (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Pre-Test Results</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{preTestScore.correct}/{preTestScore.total} ({preTestScore.pct}%)</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {preTestScore.weakAreas.map((a, i) => <span key={`w${i}`} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: '#ef444420', color: '#fca5a5' }}>{a}</span>)}
                    {preTestScore.strongAreas.map((a, i) => <span key={`s${i}`} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: '#22c55e20', color: '#86efac' }}>{a}</span>)}
                  </div>
                </div>
              )}

              {/* FSRS due cards */}
              {dueCardsRef.current.length > 0 && (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>FSRS Due Cards ({Math.min(dueCardsRef.current.length, 20)})</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>These will be prioritized in Test/Encode phases.</div>
                </div>
              )}

              {/* Feynman gaps */}
              {pendingFeynmanRef.current.length > 0 && (
                <div style={{ ...S.card, padding: 12, borderLeft: '3px solid #ef4444' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: 4 }}>Feynman Gaps</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {pendingFeynmanRef.current.slice(0, 5).map((g, i) => <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, border: '1px solid #ef4444', color: '#fca5a5' }}>{g.concept}</span>)}
                  </div>
                </div>
              )}

              {/* Professor emphasis (editable) */}
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Professor Emphasis</div>
                <textarea value={professorEmphasis} onChange={e => setProfessorEmphasis(e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical', fontSize: 12 }} placeholder='Optional...' />
              </div>

              <button onClick={handleGenerateSession} style={{ ...S.btn(true), padding: '14px 24px', fontSize: 14 }}>
                Generate Session Plan
              </button>
            </div>
          )}

          {/* Step 6: Plan loading (or Step 4 in skip flow) */}
          {(step === 6 || (step === 4 && !usedStudyGuide)) && loadingMsg && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              {planError ? (
                <>
                  <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{planError}</div>
                  <button onClick={handleGenerateSession} style={{ ...S.btn(true) }}>Retry</button>
                  <button onClick={() => setScreen({ screen: 'wizard', step: usedStudyGuide ? 5 : 4 })} style={{ ...S.btn(), marginLeft: 8 }}>Back</button>
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

  // ── Crisis Mode Wizard ──────────────────────────────────────────────────────
  if (screen.screen === 'crisis-wizard') {
    const crisisStep = screen.step;
    const crisisStepLabels = ['Triage', 'Study Guide', 'Pre-Test', 'Tier Ranking', 'Schedule', 'Launch'];
    const crisisStepIdx = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'].indexOf(crisisStep);

    return (
      <div style={{ ...S.container }}>
        <div style={{ ...S.header, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
            Crisis Mode — {crisisStepLabels[crisisStepIdx] ?? crisisStep}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {crisisStepLabels.map((_, i) => (
              <div key={i} style={{ width: 20, height: 4, borderRadius: 2, background: i <= crisisStepIdx ? '#ef4444' : 'var(--border)' }} />
            ))}
          </div>
        </div>

        <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>

          {/* C1: Triage Setup */}
          {crisisStep === 'C1' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ ...S.card, borderLeft: '3px solid #ef4444', padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#ef4444', marginBottom: 8 }}>READ THIS FIRST</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                  You are not behind because you are lazy or stupid. You are behind because the default study system — passive reading, re-highlighting, watching videos — is neurologically ineffective. You have been working hard at the wrong thing. That changes now.
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Course</div>
                <select
                  value={selectedCourseId}
                  onChange={e => setSelectedCourseId(e.target.value)}
                  style={{ ...S.input }}
                >
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Exam Date & Time</div>
                <input
                  type='datetime-local'
                  value={examDateTime}
                  onChange={e => setExamDateTime(e.target.value)}
                  style={{ ...S.input }}
                />
                {examDateTime && (() => {
                  const hrs = Math.max(0, (new Date(examDateTime).getTime() - Date.now()) / 3600000);
                  return (
                    <div style={{ fontSize: 11, color: hrs < 24 ? '#ef4444' : 'var(--text-muted)', marginTop: 4 }}>
                      {hrs < 1 ? 'Less than 1 hour — compressed protocol' : `${Math.round(hrs)} hours remaining`}
                      {hrs < 24 && hrs >= 1 && ' — compressed 3-cycle protocol'}
                    </div>
                  );
                })()}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Available Sources</div>
                {['Past exams', 'Syllabus', 'Lecture slides', 'Notes', 'None'].map(src => (
                  <label key={src} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                    <input
                      type='checkbox'
                      checked={availableSources.includes(src)}
                      onChange={e => setAvailableSources(prev =>
                        e.target.checked ? [...prev, src] : prev.filter(s => s !== src)
                      )}
                      style={{ accentColor: '#ef4444' }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{src}</span>
                  </label>
                ))}
                {availableSources.includes('None') && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                    Go directly to AI study guide extraction. Pre-test will reveal gaps.
                  </div>
                )}
              </div>

              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>THE 4 LAWS</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  1. Triage before everything — identify your 20%{'\n'}
                  2. Active recall only — zero passive review{'\n'}
                  3. Sleep is the most important study session{'\n'}
                  4. Panic is a cognitive tax — breaks are mandatory
                </div>
              </div>

              <button
                onClick={() => {
                  setDurationConfig({ durationMin: 90, cycleCount: 1, extended: false });
                  setDifficulty('DeepDive');
                  setScreen({ screen: 'crisis-wizard', step: 'C2' });
                }}
                disabled={!selectedCourseId}
                style={{ ...S.btn(true), background: '#ef4444', color: '#fff', opacity: selectedCourseId ? 1 : 0.5 }}
              >
                Begin Triage →
              </button>
            </div>
          )}

          {/* C2: Study Guide Intake (reuse V6.1 step 2 logic) */}
          {crisisStep === 'C2' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Paste Source Material</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Paste your study guide, lecture notes, or textbook chapter. Do not read it — just paste. Claude extracts the key concepts.
              </div>
              <textarea
                value={rawStudyGuide}
                onChange={e => setRawStudyGuide(e.target.value)}
                placeholder='Paste study guide, notes, or syllabus topics...'
                rows={10}
                style={{ ...S.input, resize: 'vertical' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{countWords(rawStudyGuide)} words</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleStudyGuideProcess}
                  disabled={!rawStudyGuide.trim() || guideProcessing}
                  style={{ ...S.btn(true), background: '#ef4444', color: '#fff', opacity: !rawStudyGuide.trim() || guideProcessing ? 0.5 : 1 }}
                >
                  {guideProcessing ? 'Processing...' : 'Extract Key Concepts'}
                </button>
                <button
                  onClick={() => {
                    setUsedStudyGuide(false);
                    setScreen({ screen: 'crisis-wizard', step: 'C3' });
                    handleStudyGuideToPreTest();
                  }}
                  style={{ ...S.btn(), fontSize: 12 }}
                >
                  Skip
                </button>
              </div>

              {usedStudyGuide && guideSummary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
                      Summary <span style={{ color: countWords(guideSummary) > 300 ? '#ef4444' : 'var(--text-muted)' }}>({countWords(guideSummary)} / 300)</span>
                    </div>
                    <textarea value={guideSummary} onChange={e => setGuideSummary(e.target.value)} rows={5} style={{ ...S.input, resize: 'vertical' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Keywords</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {guideKeywords.map((kw, i) => (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, background: '#ef444415', border: '1px solid #ef444440', fontSize: 12, color: 'var(--text-primary)' }}>
                          {kw}
                          <button onClick={() => setGuideKeywords(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <input
                        value={newKeywordInput}
                        onChange={e => setNewKeywordInput(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && newKeywordInput.trim()) {
                            setGuideKeywords(prev => [...prev, newKeywordInput.trim()]);
                            setNewKeywordInput('');
                          }
                        }}
                        placeholder='Add keyword...'
                        style={{ ...S.input, width: 160 }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setScreen({ screen: 'crisis-wizard', step: 'C3' });
                      handleStudyGuideToPreTest();
                    }}
                    style={{ ...S.btn(true), background: '#ef4444', color: '#fff' }}
                  >
                    Generate Pre-Test →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* C3: Pre-Test + Error Categorization */}
          {crisisStep === 'C3' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {loadingMsg ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                  <div>{loadingMsg}</div>
                  <div style={{ width: 30, height: 30, border: '2px solid var(--border)', borderTop: '2px solid #ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '12px auto 0' }} />
                </div>
              ) : preTestScore ? (
                /* Results + Adaptive allocation */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ ...S.card, textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'DM Mono, monospace', color: preTestScore.pct >= 70 ? '#22c55e' : preTestScore.pct >= 40 ? '#f59e0b' : '#ef4444' }}>
                      {preTestScore.correct}/{preTestScore.total} ({preTestScore.pct}%)
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      {preTestScore.pct <= 30 ? 'True zero-knowledge baseline — full Crisis protocol' :
                       preTestScore.pct <= 60 ? 'Partial knowledge, Swiss-cheese gaps' :
                       preTestScore.pct <= 80 ? 'Solid base, specific gaps only' :
                       'You might not need Crisis Mode'}
                    </div>
                  </div>

                  {preTestScore.pct <= 20 && (
                    <div style={{ ...S.card, borderLeft: '3px solid #22c55e', padding: 12 }}>
                      <div style={{ fontSize: 12, color: '#86efac' }}>
                        This is actually good news. The pre-test just did its job — now every minute of study targets exactly what you need.
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {preTestScore.weakAreas.map((a, i) => (
                      <span key={`w${i}`} style={{ padding: '4px 10px', borderRadius: 20, background: '#ef444420', border: '1px solid #ef4444', fontSize: 11, color: '#fca5a5' }}>{a}</span>
                    ))}
                    {preTestScore.strongAreas.map((a, i) => (
                      <span key={`s${i}`} style={{ padding: '4px 10px', borderRadius: 20, background: '#22c55e20', border: '1px solid #22c55e', fontSize: 11, color: '#86efac' }}>{a}</span>
                    ))}
                  </div>

                  {/* Crisis error categorization */}
                  {crisisAnswers.length > 0 && (
                    <div style={{ ...S.card, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Error Map</div>
                      {crisisAnswers.filter(a => !a.wasCorrect).map((a, i) => (
                        <div key={i} style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span style={{ color: '#fca5a5' }}>{a.targetTopic}</span>
                          {' → '}
                          <span style={{ color: a.errorType === 'confusion' ? '#fde68a' : '#fca5a5' }}>
                            {a.errorType === 'confusion' ? 'Confusion (mixed up concepts)' : 'Conceptual gap (need to learn)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {adaptiveAllocation && (
                    <div style={{ ...S.card, padding: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 6 }}>Session Adjusted</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
                        Chunk: {adaptiveAllocation.phase2_chunk}m | Encode: {adaptiveAllocation.phase3_encode}m | Test: {adaptiveAllocation.phase6_test}m | Connect: {adaptiveAllocation.phase4_connect}m
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{adaptiveAllocation.adaptationNote}</div>
                    </div>
                  )}

                  {mnemonicTopics.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Mnemonic topics: {mnemonicTopics.map(t => `⚡${t}`).join(', ')}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      // Auto-assign tiers from mainTopics based on keyword frequency
                      const weak = new Set(preTestScore?.weakAreas ?? []);
                      const strong = new Set(preTestScore?.strongAreas ?? []);
                      const t1 = guideMainTopics.filter(t => weak.has(t));
                      const t2 = guideMainTopics.filter(t => !weak.has(t) && !strong.has(t));
                      const t3 = guideMainTopics.filter(t => strong.has(t));
                      setTieredTopics({ tier1: t1.length ? t1 : guideMainTopics.slice(0, 3), tier2: t2, tier3: t3 });
                      setScreen({ screen: 'crisis-wizard', step: 'C4' });
                    }}
                    style={{ ...S.btn(true), background: '#ef4444', color: '#fff' }}
                  >
                    Next → Tier Ranking
                  </button>
                </div>
              ) : mcQuestions.length > 0 ? (
                /* MC questions with confidence selector */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>Pre-Test — {mcQuestions.length} Questions</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    A guess that happened to be correct is still wrong. Mark honestly.
                  </div>
                  {mcQuestions.map((q, qi) => (
                    <div key={qi} style={{ ...S.card }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Q{qi + 1}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: q.difficulty === 'easy' ? '#22c55e20' : q.difficulty === 'hard' ? '#ef444420' : '#f59e0b20', color: q.difficulty === 'easy' ? '#86efac' : q.difficulty === 'hard' ? '#fca5a5' : '#fde68a' }}>{q.difficulty}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 10 }}>{q.q}</div>
                      {q.options.map((opt: string, oi: number) => (
                        <label key={oi} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: mcAnswers[qi] === oi ? '#ef444415' : 'transparent', border: mcAnswers[qi] === oi ? '1px solid #ef4444' : '1px solid transparent', marginBottom: 4 }}>
                          <input type='radio' name={`crisis-q-${qi}`} checked={mcAnswers[qi] === oi} onChange={() => setMcAnswers(prev => ({ ...prev, [qi]: oi }))} style={{ accentColor: '#ef4444' }} />
                          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{String.fromCharCode(65 + oi)}. {opt}</span>
                        </label>
                      ))}
                      {mcAnswers[qi] !== undefined && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          {(['sure', 'guess'] as const).map(conf => (
                            <button key={conf} onClick={() => setUserConfidence(prev => ({ ...prev, [qi]: conf }))} style={{
                              fontSize: 11, padding: '3px 10px', borderRadius: 4,
                              border: userConfidence[qi] === conf ? '1px solid #ef4444' : '1px solid var(--border)',
                              background: userConfidence[qi] === conf ? '#ef444415' : 'transparent',
                              color: userConfidence[qi] === conf ? '#ef4444' : 'var(--text-muted)',
                              cursor: 'pointer',
                            }}>{conf === 'sure' ? 'I knew it' : 'I guessed'}</button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={handlePreTestSubmit}
                    disabled={Object.keys(mcAnswers).length < mcQuestions.length}
                    style={{ ...S.btn(true), background: '#ef4444', color: '#fff', opacity: Object.keys(mcAnswers).length < mcQuestions.length ? 0.5 : 1 }}
                  >
                    Submit Pre-Test
                  </button>
                </div>
              ) : (
                /* Fallback — no questions generated */
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 13, marginBottom: 12 }}>Pre-test generation failed.</div>
                  <button onClick={() => setScreen({ screen: 'crisis-wizard', step: 'C4' })} style={{ ...S.btn(true), background: '#ef4444', color: '#fff' }}>
                    Skip → Tier Ranking
                  </button>
                </div>
              )}
            </div>
          )}

          {/* C4: Tier Ranking */}
          {crisisStep === 'C4' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Tier Ranking</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Assign topics to tiers. Tier 1 gets 65% of your time, Tier 2 gets 30%, Tier 3 gets 5%. Tap to cycle between tiers.
              </div>

              {[
                { label: 'Tier 1 — Definitely on exam', tier: 'tier1' as const, color: '#ef4444', pct: '65%' },
                { label: 'Tier 2 — Probably on exam', tier: 'tier2' as const, color: '#f59e0b', pct: '30%' },
                { label: 'Tier 3 — Possible', tier: 'tier3' as const, color: '#6b7280', pct: '5%' },
              ].map(({ label, tier, color, pct }) => (
                <div key={tier}>
                  <div style={{ fontSize: 12, fontWeight: 600, color, marginBottom: 6 }}>{label} ({pct})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 32, padding: 8, borderRadius: 8, border: `1px dashed ${color}40`, background: `${color}08` }}>
                    {tieredTopics[tier].map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          // Cycle to next tier
                          const tiers: ('tier1' | 'tier2' | 'tier3')[] = ['tier1', 'tier2', 'tier3'];
                          const nextTier = tiers[(tiers.indexOf(tier) + 1) % 3];
                          setTieredTopics(prev => ({
                            ...prev,
                            [tier]: prev[tier].filter(t => t !== topic),
                            [nextTier]: [...prev[nextTier], topic],
                          }));
                        }}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: `1px solid ${color}`, background: `${color}15`, color: 'var(--text-primary)', cursor: 'pointer' }}
                      >
                        {topic}
                      </button>
                    ))}
                    {tieredTopics[tier].length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Tap topics in other tiers to move them here</span>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={() => setScreen({ screen: 'crisis-wizard', step: 'C5' })}
                style={{ ...S.btn(true), background: '#ef4444', color: '#fff' }}
              >
                Next → 48hr Schedule
              </button>
            </div>
          )}

          {/* C5: 48hr Schedule Preview */}
          {crisisStep === 'C5' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444' }}>48-Hour Schedule</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Everything below feeds into your crisis session. Review before launching.</div>

              {/* Day 1 */}
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>DAY 1 — Build The Map (8hrs active)</div>
                {[
                  { time: '0:00', task: 'Triage', dur: '30min', done: true },
                  { time: '0:30', task: 'Crisis Intake + Pre-Test', dur: '45min', done: true },
                  { time: '1:15', task: `Cycle 1 — Tier 1: ${tieredTopics.tier1.slice(0, 3).join(', ') || 'TBD'}`, dur: '90min' },
                  { time: '2:45', task: 'Break', dur: '15min' },
                  { time: '3:00', task: `Cycle 2 — Tier 1: ${tieredTopics.tier1.slice(3, 6).join(', ') || 'continued'}`, dur: '90min' },
                  { time: '4:30', task: 'Break', dur: '15min' },
                  { time: '4:45', task: `Cycle 3 — Tier 1: ${tieredTopics.tier1.slice(6).join(', ') || 'remaining'}`, dur: '90min' },
                  { time: '6:15', task: 'Full card sweep', dur: '45min' },
                  { time: '7:00', task: 'STOP — eat, decompress, sleep by 11pm', dur: '' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 11, color: row.done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: row.done ? 'line-through' : 'none' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', width: 40, color: '#ef444480' }}>{row.time}</span>
                    <span style={{ flex: 1 }}>{row.task}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{row.dur}</span>
                  </div>
                ))}
              </div>

              {/* Day 2 */}
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>DAY 2 — Lock And Load (7.5hrs active)</div>
                {[
                  { time: '0:00', task: 'Consolidation window — card review only', dur: '60min' },
                  { time: '1:00', task: `Cycle 4 — Tier 2 + Weak area patch`, dur: '90min' },
                  { time: '2:30', task: 'Break', dur: '15min' },
                  { time: '2:45', task: `Cycle 5 — Tier 2 + Forced interleaving`, dur: '90min' },
                  { time: '4:15', task: 'Break', dur: '15min' },
                  { time: '4:30', task: 'Half Cycle — Tier 3 or extra gauntlet', dur: '45min' },
                  { time: '5:15', task: 'Break', dur: '15min' },
                  { time: '5:30', task: 'Mock Exam (full timed)', dur: '90min' },
                  { time: '7:00', task: 'Debrief wrong answers', dur: '30min' },
                  { time: '7:30', task: 'Final Anchor read', dur: '30min' },
                  { time: '8:00', task: 'STOP. No new material after this.', dur: '' },
                ].map((row, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 11, color: 'var(--text-primary)' }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', width: 40, color: '#ef444480' }}>{row.time}</span>
                    <span style={{ flex: 1 }}>{row.task}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{row.dur}</span>
                  </div>
                ))}
              </div>

              {/* Adaptive time layout */}
              {adaptiveAllocation && (
                <div style={{ ...S.card, padding: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#ef4444', marginBottom: 4 }}>Per-Cycle Phase Times (adaptive)</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'DM Mono, monospace', lineHeight: 1.8 }}>
                    Chunk: {adaptiveAllocation.phase2_chunk}m | Decode: {adaptiveAllocation.phase2_5_decode}m | Encode: {adaptiveAllocation.phase3_encode}m | Connect: {adaptiveAllocation.phase4_connect}m | Test: {adaptiveAllocation.phase6_test}m
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{adaptiveAllocation.adaptationNote}</div>
                </div>
              )}

              {/* Professor emphasis (editable) */}
              <div style={{ ...S.card, padding: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Professor Emphasis (optional)</div>
                <textarea value={professorEmphasis} onChange={e => setProfessorEmphasis(e.target.value)} rows={2} style={{ ...S.input, resize: 'vertical', fontSize: 12 }} placeholder='Paste keywords your professor emphasized...' />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => {
                    const errorMap: Record<string, OmniCrisisErrorType> = {};
                    crisisAnswers.forEach(a => {
                      if (a.errorType) errorMap[a.targetTopic] = a.errorType;
                    });
                    const msgs = buildCrisisSessionPlanPrompt({
                      topic: selectedTopics.join(', ') || 'General',
                      courseName: courses.find(c => c.id === selectedCourseId)?.name ?? selectedCourseId,
                      difficulty, arcPhase, durationConfig,
                      professorEmphasis,
                      fsrsDueCards: dueCardsRef.current,
                      feynmanGaps: pendingFeynmanRef.current,
                      knowledgeConnections: knowledgeConnectionsRef.current,
                      sessionId: `manual-${Date.now()}`,
                      studyGuideSummary: guideSummary,
                      studyGuideKeywords: guideKeywords,
                      allocation: adaptiveAllocation!,
                      preTestPct: preTestScore?.pct ?? 0,
                      weakAreas: preTestScore?.weakAreas ?? [],
                      strongAreas: preTestScore?.strongAreas ?? [],
                      tieredTopics,
                      errorMap,
                      mnemonicTopics,
                    });
                    const system = msgs.find(m => m.role === 'system')?.content ?? '';
                    const user   = msgs.find(m => m.role === 'user')?.content ?? '';
                    const full   = `[SYSTEM — Crisis Mode Planner]\n${system}\n\n---\n\n${user}`;
                    navigator.clipboard.writeText(full).then(() => {
                      setCrisisPromptCopied(true);
                      setTimeout(() => setCrisisPromptCopied(false), 2000);
                    });
                  }}
                  style={{ ...S.btn(), fontSize: 12, color: 'var(--text-muted)' }}
                >
                  {crisisPromptCopied ? '✓ Copied!' : '📋 Copy prompt — paste into your own Claude'}
                </button>
                <button
                  onClick={() => {
                    setScreen({ screen: 'crisis-wizard', step: 'C6' });
                    handleGenerateSession();
                  }}
                  style={{ ...S.btn(true), background: '#ef4444', color: '#fff', padding: '14px 24px', fontSize: 14 }}
                >
                  Generate Crisis Protocol
                </button>
              </div>
            </div>
          )}

          {/* C6: Generation loading */}
          {crisisStep === 'C6' && (
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              {planError ? (
                <>
                  <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16 }}>{planError}</div>
                  <button onClick={handleGenerateSession} style={{ ...S.btn(true), background: '#ef4444', color: '#fff' }}>Retry</button>
                  <button onClick={() => setScreen({ screen: 'crisis-wizard', step: 'C5' })} style={{ ...S.btn(), marginLeft: 8 }}>Back</button>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{loadingMsg || 'Generating Crisis Protocol...'}</div>
                  <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTop: '3px solid #ef4444', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                    Crisis Mode · 90min cycles · {tieredTopics.tier1.length} Tier 1 topics
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
            <button onClick={() => { DataRepository.delete(OMNI_SUSPEND_KEY).catch(() => {}); isSessionActive.current = false; onComplete(); }} style={{ ...S.btn(true), width: '100%', textAlign: 'center' }}>
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
