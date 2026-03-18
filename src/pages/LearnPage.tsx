/**
 * LearnPage — 15 interactive learning modes
 * Each mode is a standalone tool with its own UI and state.
 */
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Zap, Lightbulb, Clock, MessageCircle, Search, Brain,
  Shuffle, Calculator, AlertTriangle, FileText, Link, Layers,
  Repeat, Users, BookOpen, ChevronLeft, CheckCircle, XCircle,
  ArrowRight, RotateCcw, Play, Trophy,
  Sparkles, HelpCircle, GripVertical, Loader2,
  BarChart3, Plus, Eye, EyeOff, Library, Star, BookOpenCheck, Volume2, Camera,
  Atom, Languages, Dna, GitBranch
} from 'lucide-react';
import { useStore } from '../store';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { ToolErrorBoundary } from '../components/ToolErrorBoundary';
import { sanitizeHtml } from '../utils/sanitize';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { speak } from '../utils/speechTools';
import { callAI, isAIConfigured } from '../utils/ai';
import { renderMd, safeRenderMd } from '../utils/renderMd';
import { useImageOCR } from '../hooks/useImageOCR';
import ImageInputBar from '../components/ImageInputBar';
import QuizAIChat from '../components/QuizAIChat';
import {
  getDueCards, reviewCard, convertFromLegacy,
  type FSRSCard, type Grade
} from '../utils/fsrs';
import ExamSimMode from '../components/learn/ExamSimMode';
import MatchMode from '../components/learn/MatchMode';
import SpacedRepMode from '../components/learn/SpacedRepMode';
import TutorsMode from '../components/learn/TutorsMode';
import SolverMode from '../components/learn/SolverMode';
import FeynmanMode from '../components/learn/FeynmanMode';
import GapFindMode from '../components/learn/GapFindMode';
import MnemonicsMode from '../components/learn/MnemonicsMode';
import InterleaveMode from '../components/learn/InterleaveMode';
import FormulaMode from '../components/learn/FormulaMode';
import ErrorsMode from '../components/learn/ErrorsMode';
import TLDRMode from '../components/learn/TLDRMode';
import ConnectMode from '../components/learn/ConnectMode';
import { getLevel } from '../utils/gamification';

const JpQuizTab = lazyWithRetry(() => import('../components/jpquiz/JpQuizTab'));
const PhysicsQuizTab = lazyWithRetry(() => import('../components/physquiz/PhysicsQuizTab'));
const BiolExam2Tab = lazyWithRetry(() => import('../components/biolquiz/BiolExam2Tab'));
const EvolutionExam2Tab = lazyWithRetry(() => import('../components/evolutionquiz/EvolutionExam2Tab'));

// ─── Types ─────────────────────────────────────────────

type ModeId =
  | 'rapid' | 'feynman' | 'exam' | 'socratic' | 'gap'
  | 'mnemonics' | 'interleave' | 'formula' | 'errors'
  | 'tldr' | 'connect' | 'match' | 'spaced' | 'tutors' | 'solver'
  | 'japanese-practicum' | 'physics-practicum'
  | 'biol-practicum' | 'evolution-practicum';

interface ModeConfig {
  id: ModeId;
  name: string;
  icon: React.ElementType;
  desc: string;
  color: string;
}

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

// ─── Mode configs ──────────────────────────────────────

const MODES: ModeConfig[] = [
  { id: 'rapid', name: 'Rapid Learn', icon: Zap, desc: 'Quick topic overview', color: '#f59e0b' },
  { id: 'feynman', name: 'Feynman', icon: Lightbulb, desc: 'Explain to learn', color: '#eab308' },
  { id: 'exam', name: 'Exam Sim', icon: Clock, desc: 'Timed practice', color: '#ef4444' },
  { id: 'socratic', name: 'Socratic', icon: MessageCircle, desc: 'Guided questions', color: '#8b5cf6' },
  { id: 'gap', name: 'Gap Find', icon: Search, desc: 'Find weak spots', color: '#06b6d4' },
  { id: 'mnemonics', name: 'Mnemonics', icon: Brain, desc: 'Memory aids', color: '#ec4899' },
  { id: 'interleave', name: 'Interleave', icon: Shuffle, desc: 'Mixed practice', color: '#10b981' },
  { id: 'formula', name: 'Formula', icon: Calculator, desc: 'Step-by-step math', color: '#6366f1' },
  { id: 'errors', name: 'Errors', icon: AlertTriangle, desc: 'Mistake analysis', color: '#f97316' },
  { id: 'tldr', name: 'TL;DR', icon: FileText, desc: 'Ultra summaries', color: '#14b8a6' },
  { id: 'connect', name: 'Connect', icon: Link, desc: 'Cross-topic links', color: '#a855f7' },
  { id: 'match', name: 'Match', icon: Layers, desc: 'Drag-drop match', color: '#3b82f6' },
  { id: 'spaced', name: 'Spaced Rep', icon: Repeat, desc: 'FSRS review', color: '#22c55e' },
  { id: 'tutors', name: 'Tutors', icon: Users, desc: 'AI teaching styles', color: '#e11d48' },
  { id: 'solver', name: 'Solver', icon: HelpCircle, desc: 'Step-by-step help', color: '#0ea5e9' },
];

const PRACTICUM_MODES: ModeConfig[] = [
  { id: 'japanese-practicum', name: 'Japanese Practicum', icon: Languages, desc: 'Typing & speaking quiz for Japanese courses', color: '#F5A623' },
  { id: 'physics-practicum', name: 'Physics Practicum', icon: Atom, desc: 'Problem sets, AI grading & analytics for Physics', color: '#F5A623' },
  { id: 'biol-practicum',      name: 'BIOL 3020 Exam 2',  icon: Dna,       desc: 'Molecular Biology Exam 2 — Ch. 4, 5, 10', color: '#22c55e' },
  { id: 'evolution-practicum', name: 'Evolution Exam 2',   icon: GitBranch, desc: 'Evolution Exam 2 — 7-heading framework',  color: '#a78bfa' },
];

// ─── Helpers ───────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Shared styles
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};
const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical' as const, lineHeight: 1.7,
};

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
      <ChevronLeft size={14} /> Back
    </button>
  );
}

function SubjectPicker({ courses, value, onChange, showTopics, onTopicsChange }: {
  courses: { id: string; name: string; shortName: string; topics?: any[]; flashcards?: any[] }[];
  value: string;
  onChange: (v: string) => void;
  showTopics?: boolean;
  onTopicsChange?: (topics: Set<string>) => void;
}) {
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const course = courses.find(c => c.id === value);
  const availableTopics = useMemo(() => {
    if (!course || !showTopics) return [];
    const counts = new Map<string, number>();
    (course.flashcards || []).forEach((f: any) => {
      if (f.topic) counts.set(f.topic, (counts.get(f.topic) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }, [course, showTopics]);

  function handleCourseChange(v: string) {
    onChange(v);
    setSelectedTopics(new Set());
    onTopicsChange?.(new Set());
  }

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      onTopicsChange?.(next);
      return next;
    });
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <select
        value={value}
        onChange={e => handleCourseChange(e.target.value)}
        style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer', width: '100%' }}
      >
        <option value="">All subjects</option>
        {courses.map(c => {
          const topicCount = (c.topics || []).length;
          const cardCount = (c.flashcards || []).length;
          const label = `${c.shortName || c.name}${topicCount ? ` (${topicCount} topics · ${cardCount} cards)` : ''}`;
          return <option key={c.id} value={c.id}>{label}</option>;
        })}
      </select>
      {showTopics && value && availableTopics.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            className={`btn btn-sm ${selectedTopics.size === 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSelectedTopics(new Set()); onTopicsChange?.(new Set()); }}
            style={{ padding: '3px 8px', fontSize: 10 }}
          >All ({course?.flashcards?.length || 0})</button>
          {availableTopics.map(t => (
            <button key={t.name}
              className={`btn btn-sm ${selectedTopics.has(t.name) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleTopic(t.name)}
              style={{ padding: '3px 8px', fontSize: 10 }}
            >{t.name} ({t.count})</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

export default function LearnPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeMode, setActiveMode] = useState<ModeId | null>(null);
  const { courses, gamification, quizHistory } = useStore();
  const [selectedCourse, setSelectedCourse] = useState('');

  // Auto-open mode from URL query param (e.g. /learn?mode=match)
  useEffect(() => {
    const modeParam = searchParams.get('mode') as ModeId | null;
    if (modeParam) {
      setActiveMode(modeParam);
      // Clear the query param so it doesn't persist on subsequent visits
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute course average score
  const courseAvg = useMemo(() => {
    if (!selectedCourse) {
      const total = quizHistory.reduce((s, q) => s + (q.score || 0), 0);
      return quizHistory.length > 0 ? Math.round(total / quizHistory.length) : 0;
    }
    const courseQuizzes = quizHistory.filter(q => q.subject === selectedCourse || q.name === selectedCourse);
    const total = courseQuizzes.reduce((s, q) => s + (q.score || 0), 0);
    return courseQuizzes.length > 0 ? Math.round(total / courseQuizzes.length) : 0;
  }, [quizHistory, selectedCourse]);

  // Count due cards for Smart Review
  const dueCount = useMemo(() => {
    const allCards = courses.flatMap(c =>
      (c.flashcards || []).map((f, i) => ({
        key: `${c.id}-${i}`,
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
      }))
    );
    return Math.min(allCards.length, 20);
  }, [courses]);

  return (
    <div className="animate-in">
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <h1 className="page-title" style={{ margin: 0 }}>NOUSAI</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-card)', border: '1px solid #444',
          borderRadius: 20, padding: '4px 12px',
        }}>
          <Star size={12} style={{ color: '#ccc' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
            Lv. {getLevel(gamification?.xp || 0)}
          </span>
        </div>
      </div>

      {/* ── Monochrome Mode Icon Grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
        gap: 6, marginBottom: 16,
      }}>
        {MODES.map(m => {
          const Icon = m.icon;
          const isActive = activeMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setActiveMode(isActive ? null : m.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'center',
                padding: '6px 2px',
                transition: 'all 0.15s',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                border: isActive ? '2px solid #fff' : '1px solid #555',
                background: isActive ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: isActive ? '#fff' : '#aaa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 4px',
                transition: 'all 0.15s',
              }}>
                <Icon size={16} />
              </div>
              <div style={{
                fontSize: 9, fontWeight: 600, lineHeight: 1.2,
                color: isActive ? '#fff' : '#999',
              }}>
                {m.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Practicum Section ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
          color: '#666', marginBottom: 8, paddingLeft: 4,
          textTransform: 'uppercase',
        }}>
          PRACTICUM
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))',
          gap: 6,
        }}>
          {PRACTICUM_MODES.map(m => {
            const Icon = m.icon;
            const isActive = activeMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActiveMode(isActive ? null : m.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  textAlign: 'center', padding: '6px 2px', transition: 'all 0.15s',
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  border: isActive ? '2px solid #F5A623' : '1px solid #555',
                  background: isActive ? 'rgba(245,166,35,0.15)' : 'transparent',
                  color: isActive ? '#F5A623' : '#aaa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 4px', transition: 'all 0.15s',
                }}>
                  <Icon size={16} />
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 600, lineHeight: 1.2,
                  color: isActive ? '#F5A623' : '#999',
                }}>
                  {m.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Course Selector Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', marginBottom: 16,
        background: 'var(--bg-card)', border: '1px solid #333',
        borderRadius: 'var(--radius-sm)',
        flexWrap: 'wrap',
      }}>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          style={{
            padding: '6px 10px', fontSize: 12, fontWeight: 600,
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid #444', borderRadius: 6,
            cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
            minWidth: 140,
          }}
        >
          <option value="">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
          ))}
        </select>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          background: courseAvg >= 80 ? 'rgba(34,197,94,0.15)' : courseAvg >= 50 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${courseAvg >= 80 ? 'rgba(34,197,94,0.3)' : courseAvg >= 50 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 12, padding: '3px 10px',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
            {courseAvg}%
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>avg</span>
        </div>

        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setActiveMode('spaced')}
            style={{
              fontSize: 10, padding: '4px 8px', gap: 3,
              border: '1px solid #444', background: 'transparent', color: '#ccc',
            }}
          >
            <Repeat size={10} /> Review {dueCount > 0 ? `(${dueCount})` : ''}
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setActiveMode('exam')}
            style={{
              fontSize: 10, padding: '4px 8px', gap: 3,
              border: '1px solid #444', background: 'transparent', color: '#ccc',
            }}
          >
            <Clock size={10} /> Quiz
          </button>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => window.location.hash = '#/library'}
            style={{
              fontSize: 10, padding: '4px 8px', gap: 3,
              border: '1px solid #444', background: 'transparent', color: '#ccc',
            }}
          >
            <Library size={10} /> Lib
          </button>
          {selectedCourse && (() => {
            const course = courses.find(c => c.id === selectedCourse);
            if (!course) return null;
            return (
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => window.location.hash = `#/course?id=${course.id}`}
                style={{
                  fontSize: 10, padding: '4px 8px', gap: 3,
                  border: '1px solid #444', background: 'transparent', color: '#ccc',
                }}
              >
                <BookOpen size={10} /> {course.shortName || course.name}
              </button>
            );
          })()}
        </div>
      </div>

      {/* ── Active Mode Panel ── */}
      {activeMode && (
        <div className="animate-in" style={{ marginBottom: 24 }}>
          <ModePanel mode={activeMode} onClose={() => setActiveMode(null)} />
        </div>
      )}
    </div>
  );
}

// ─── Mode Router ───────────────────────────────────────

function ModePanel({ mode, onClose }: { mode: ModeId; onClose: () => void }) {
  const config = [...MODES, ...PRACTICUM_MODES].find(m => m.id === mode)!;
  const Icon = config.icon;
  const { courses } = useStore();

  return (
    <div style={{ ...cardStyle, borderColor: '#555', borderWidth: 1 }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '1px solid #555', color: '#ccc',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={14} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{config.name}</span>
        </div>
        <button className="btn-icon" onClick={onClose} style={{ width: 28, height: 28 }}>
          <XCircle size={16} />
        </button>
      </div>
      {mode === 'rapid' && <RapidLearnMode />}
      {mode === 'feynman' && <FeynmanMode onBack={onClose} />}
      {mode === 'exam' && <ExamSimMode />}
      {mode === 'socratic' && <SocraticMode />}
      {mode === 'gap' && <GapFindMode onBack={onClose} />}
      {mode === 'mnemonics' && <MnemonicsMode onBack={onClose} />}
      {mode === 'interleave' && <InterleaveMode onBack={onClose} />}
      {mode === 'formula' && <FormulaMode onBack={onClose} />}
      {mode === 'errors' && <ErrorsMode onBack={onClose} />}
      {mode === 'tldr' && <TLDRMode onBack={onClose} />}
      {mode === 'connect' && <ConnectMode onBack={onClose} />}
      {mode === 'match' && <MatchMode />}
      {mode === 'spaced' && <SpacedRepMode />}
      {mode === 'tutors' && <TutorsMode />}
      {mode === 'solver' && <SolverMode />}
      {mode === 'japanese-practicum' && (() => {
        const course = courses.find(c =>
          c.shortName?.toUpperCase().startsWith('JAPN') ||
          c.name.toLowerCase().includes('japanese')
        ) ?? courses[0];
        if (!course) return (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
            No courses found. Create a course first.
          </div>
        );
        return (
          <ToolErrorBoundary toolName="Japanese Practicum">
            <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>}>
              <JpQuizTab course={course} />
            </Suspense>
          </ToolErrorBoundary>
        );
      })()}
      {mode === 'physics-practicum' && (() => {
        const course = courses.find(c =>
          (c.shortName?.match(/PHYS|PHY|SCI/i) != null) ||
          c.name.toLowerCase().match(/physics|physical science/) != null
        ) ?? courses[0] ?? { id: 'global-physics', name: 'Physics', shortName: 'PHY', color: '#F5A623', topics: [], flashcards: [] };
        return (
          <ToolErrorBoundary toolName="Physics Practicum">
            <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>}>
              <PhysicsQuizTab course={course} />
            </Suspense>
          </ToolErrorBoundary>
        );
      })()}
      {mode === 'biol-practicum' && (() => {
        const course = courses.find(c =>
          c.shortName?.toUpperCase().includes('BIOL') ||
          c.name.toLowerCase().includes('molecular') ||
          c.name.toLowerCase().includes('cell')
        ) ?? courses[0] ?? { id: 'biol-global', name: 'BIOL 3020', shortName: 'BIOL3020', color: '#22c55e', topics: [], flashcards: [] };
        if (!course) return (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
            No courses found. Create a BIOL course first.
          </div>
        );
        return (
          <ToolErrorBoundary toolName="BIOL Exam 2">
            <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>}>
              <BiolExam2Tab course={course} />
            </Suspense>
          </ToolErrorBoundary>
        );
      })()}
      {mode === 'evolution-practicum' && (() => {
        const course = courses.find(c =>
          c.shortName?.toUpperCase().includes('EVOL') ||
          c.shortName?.includes('4230') ||
          c.name.toLowerCase().includes('evolution')
        ) ?? courses[0] ?? { id: 'evol-global', name: 'Evolution', shortName: 'EVOL4230', color: '#a78bfa', topics: [], flashcards: [] };
        if (!course) return (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
            No courses found. Create an Evolution course first.
          </div>
        );
        return (
          <ToolErrorBoundary toolName="Evolution Exam 2">
            <Suspense fallback={<div style={{ padding: 24, color: 'var(--text-muted)' }}>Loading...</div>}>
              <EvolutionExam2Tab course={course} />
            </Suspense>
          </ToolErrorBoundary>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 1: Rapid Learn
// ═══════════════════════════════════════════════════════

function RapidLearnMode() {
  const { courses, data } = useStore();
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [weakSpots, setWeakSpots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Detect weak spots from quiz history and proficiency
  useEffect(() => {
    const quizHistory = data?.pluginData?.quizHistory || [];
    const weak: string[] = [];
    // Find topics with low quiz scores
    quizHistory.forEach((q: any) => {
      if (q.score !== undefined && q.score < 60 && q.name) {
        if (!weak.includes(q.name)) weak.push(q.name);
      }
    });
    // If no quiz data, look at courses with few flashcards reviewed
    if (weak.length === 0) {
      courses.forEach(c => {
        if ((c.flashcards?.length || 0) > 0) {
          const topicNames = (c.topics || []).slice(0, 2).map((t: any) => t.name);
          topicNames.forEach((n: string) => { if (!weak.includes(n)) weak.push(n); });
        }
      });
    }
    setWeakSpots(weak.slice(0, 5));
  }, [courses, data]);

  async function generate() {
    setLoading(true);
    const course = courses.find(c => c.id === subject);
    const topicLower = topic.toLowerCase();

    // Gather study content from ALL available sources
    const items: { front: string; back: string }[] = [];

    // Source 1: Flashcards
    const cards = course?.flashcards || courses.flatMap(c => c.flashcards || []);
    cards.forEach(c => {
      if (c.front && c.back) items.push({ front: c.front, back: c.back });
    });

    // Source 2: Quiz questions from quizBank (largest source)
    const quizBank = data?.pluginData?.quizBank as Record<string, unknown> | undefined;
    const bankQuizzes = (quizBank?.quizzes || []) as { name?: string; subject?: string; questions?: { question?: string; correctAnswer?: string; explanation?: string }[] }[];
    for (const quiz of bankQuizzes) {
      if (course && quiz.subject !== course.name && quiz.subject !== course.shortName && quiz.name !== course.name) continue;
      for (const q of (quiz.questions || [])) {
        if (q.question && q.correctAnswer) {
          items.push({ front: q.question, back: q.correctAnswer + (q.explanation ? ` — ${q.explanation}` : '') });
        }
      }
    }

    // Source 3: Quiz history answers
    const quizHistory = data?.pluginData?.quizHistory || [];
    for (const attempt of quizHistory as any[]) {
      if (course && attempt.subject !== course.name && attempt.subject !== course.shortName) continue;
      for (const a of (attempt.answers || [])) {
        if (a.question?.question && a.question?.correctAnswer) {
          items.push({ front: a.question.question, back: a.question.correctAnswer + (a.question.explanation ? ` — ${a.question.explanation}` : '') });
        }
      }
    }

    // Source 4: Match sets (term/definition pairs)
    const matchSets = (data?.pluginData?.matchSets || []) as { name?: string; subject?: string; pairs?: { term: string; definition: string }[] }[];
    for (const ms of matchSets) {
      if (course && ms.subject !== course.name && ms.subject !== course.shortName) continue;
      for (const p of (ms.pairs || [])) {
        if (p.term && p.definition) items.push({ front: p.term, back: p.definition });
      }
    }

    // Source 5: Notes content (extract key sentences)
    const notes = (data?.pluginData?.notes || []) as { title?: string; content?: string; courseId?: string; folder?: string }[];
    for (const note of notes) {
      if (course && note.courseId !== course.id) continue;
      if (note.content && note.title) {
        // Use note title as "front" and first ~200 chars of content as "back"
        const plainText = note.content.replace(/<[^>]+>/g, '').trim();
        if (plainText.length > 20) {
          items.push({ front: note.title, back: plainText.slice(0, 200) });
        }
      }
    }

    // Deduplicate by front text
    const seen = new Set<string>();
    const unique = items.filter(item => {
      const key = item.front.trim().toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by topic if specified
    const relevant = unique.filter(c =>
      topicLower ? (c.front + c.back).toLowerCase().includes(topicLower) : true
    );
    const selected = shuffleArray(relevant.length > 0 ? relevant : unique).slice(0, 15);

    if (selected.length === 0) {
      setOutput(['No matching content found. Try a different topic or add courses with content.']);
      setLoading(false);
      return;
    }

    const sourceText = selected.map(c => `${c.front}: ${c.back}`).join('\n');

    // Try AI summary
    if (isAIConfigured()) {
      try {
        let result = '';
        await callAI([{
          role: 'system',
          content: 'You are a study cram assistant. Given study material (quiz questions, notes, flashcards), produce a concise, high-impact study summary. Include: 1) Key concepts overview (2-3 sentences), 2) Important relationships between concepts, 3) Common pitfalls/mistakes to avoid, 4) A memory aid or mnemonic. Be direct and concise. Use markdown formatting.',
        }, {
          role: 'user',
          content: `Topic: ${topic || 'General Review'}\nCourse: ${course?.name || 'All courses'}\nContent sources: ${selected.length} items from quizzes, notes, and flashcards\n\nStudy material:\n${sourceText}`,
        }], {
          onChunk: (chunk: string) => { result += chunk; setOutput(result.split('\n')); },
        }, 'analysis');
        if (!result) {
          setOutput(result.split('\n'));
        }
        setLoading(false);
        return;
      } catch {
        // Fall through to template
      }
    }

    // Template fallback
    const points: string[] = [
      `Topic: ${topic || 'General Review'}`,
      `---`,
      ...selected.map((c, i) => `${i + 1}. ${c.front}: ${c.back}`),
      `---`,
      `Key takeaway: Focus on understanding the relationships between these ${selected.length} concepts.`,
    ];
    setOutput(points);
    setLoading(false);
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Quick cram session — get AI-powered summaries and identify weak spots.
        Uses quizzes, notes, flashcards, and match sets as source material.
      </p>
      <SubjectPicker courses={courses} value={subject} onChange={setSubject} />

      {/* Weak spots */}
      {weakSpots.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--red-dim)', marginBottom: 10, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Weak Spots — review these topics:
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {weakSpots.map(w => (
              <button
                key={w}
                className="btn btn-sm btn-secondary"
                onClick={() => { setTopic(w); }}
                style={{ fontSize: 10, padding: '2px 8px' }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <input
          type="text" value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="Enter topic (e.g., mitosis, recursion, WW2)..."
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
          <Zap size={14} /> {loading ? '...' : 'Cram'}
        </button>
      </div>
      {output.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--bg-primary)', marginTop: 8 }}>
          {output.map((line, i) => (
            <div key={i} style={{
              fontSize: 13, lineHeight: 1.7, padding: '4px 0',
              borderBottom: line === '---' ? '1px solid var(--border)' : undefined,
              color: line === '---' ? 'transparent' : 'var(--text-primary)',
            }}
              dangerouslySetInnerHTML={{ __html: line === '---' ? '' : sanitizeHtml(renderMd(line)) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 4: Socratic Dialogue
// ═══════════════════════════════════════════════════════

function SocraticMode() {
  const { courses } = useStore();
  const [topic, setTopic] = useState('');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [depth, setDepth] = useState(0);
  const [loading, setLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const callingRef = useRef(false);

  const allCards = useMemo(() => courses.flatMap(c => c.flashcards || []), [courses]);

  function startDialogue() {
    if (!topic.trim()) return;
    const relevant = allCards.filter(c =>
      (c.front + c.back).toLowerCase().includes(topic.toLowerCase())
    );
    const firstQ = relevant.length > 0
      ? `Let us explore "${topic}". In your own words, what is ${relevant[0].front}?`
      : `Let us explore "${topic}". What do you already know about this topic? What comes to mind first?`;
    setMessages([{ role: 'ai', text: firstQ }]);
    setStarted(true);
    setDepth(0);
  }

  async function respond() {
    if (!input.trim() || callingRef.current) return;
    callingRef.current = true;
    const userMsg = { role: 'user' as const, text: input };
    const newDepth = depth + 1;
    setDepth(newDepth);
    setInput('');
    const updatedMsgs = [...messages, userMsg];
    setMessages(updatedMsgs);
    setLoading(true);

    // Try AI
    if (isAIConfigured()) {
      try {
        const context = updatedMsgs.slice(-14).map(m => ({
          role: (m.role === 'ai' ? 'assistant' : 'user') as 'system' | 'user' | 'assistant',
          content: m.text,
        }));
        const aiReply = await callAI([{
          role: 'system',
          content: `You are a Socratic teacher exploring the topic "${topic}" with a student. Never give direct answers. Always respond with 1-2 probing follow-up questions that build on the student's response and push them to think deeper. Be encouraging but challenging. Keep responses to 2-3 sentences. If the student has explored deeply (${newDepth}+ exchanges), acknowledge their depth and suggest they summarize their insights.`,
        }, ...context], { temperature: 0.7, maxTokens: 256 }, 'analysis');

        if (aiReply.trim()) {
          setMessages(prev => [...prev, { role: 'ai', text: aiReply.trim() }]);
          setLoading(false);
          callingRef.current = false;
          setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
          return;
        }
      } catch { /* fall through */ }
    }

    // Template fallback
    const probes = [
      `Interesting. But why do you think that is the case? What underlying principle drives this?`,
      `Can you think of an example that illustrates this? How does this apply in practice?`,
      `What would happen if the opposite were true? How would that change things?`,
      `You mentioned an important point. How does this connect to other concepts you know about ${topic}?`,
      `If you had to explain this to someone with no background, what analogy would you use?`,
      `What are the limitations or exceptions to what you just described?`,
      `That is a good foundation. Now, what are the implications of this? Why does it matter?`,
      `Let us go deeper. What assumptions are you making? Are they always valid?`,
    ];
    const aiReply = newDepth >= 7
      ? `Excellent depth of analysis! You have explored ${topic} from multiple angles. Key insight: your understanding has progressed through ${newDepth} layers of questioning. Consider writing a summary of what you discovered.`
      : probes[newDepth % probes.length];
    setMessages(prev => [...prev, { role: 'ai', text: aiReply }]);
    setLoading(false);
    callingRef.current = false;
    setTimeout(() => chatRef.current?.scrollTo(0, chatRef.current.scrollHeight), 50);
  }

  if (!started) {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          Socratic dialogue: the AI asks probing questions to deepen your understanding. You answer, and each response leads to a deeper question.
        </p>
        <div className="flex gap-2">
          <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
            placeholder="Topic to explore..." style={{ ...inputStyle, flex: 1 }}
            onKeyDown={e => e.key === 'Enter' && startDialogue()}
          />
          <button className="btn btn-primary btn-sm" onClick={startDialogue}>
            <MessageCircle size={14} /> Begin
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="badge badge-accent" style={{ fontSize: 10 }}>Depth: {depth}/7</span>
        <button className="btn btn-secondary btn-sm" onClick={() => { setStarted(false); setMessages([]); setTopic(''); }}
          style={{ padding: '4px 8px', fontSize: 11 }}>New Topic</button>
      </div>
      <div ref={chatRef} style={{
        maxHeight: 280, overflowY: 'auto', marginBottom: 8,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, lineHeight: 1.6,
            background: m.role === 'ai' ? 'var(--accent-glow)' : 'var(--bg-primary)',
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            borderLeft: m.role === 'ai' ? '3px solid var(--accent)' : undefined,
          }}>
            <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(m.text)) }} />
          </div>
        ))}
      </div>
      <form onSubmit={e => { e.preventDefault(); respond(); }} className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Your response..." style={{ ...inputStyle, flex: 1 }} autoFocus />
        <button className="btn btn-primary btn-sm" type="submit" disabled={loading || !input.trim()}>
          {loading ? <><Loader2 size={14} className="spin" /> Thinking...</> : <ArrowRight size={14} />}
        </button>
      </form>
    </div>
  );
}

