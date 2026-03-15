/**
 * LearnPage — 15 interactive learning modes
 * Each mode is a standalone tool with its own UI and state.
 */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Zap, Lightbulb, Clock, MessageCircle, Search, Brain,
  Shuffle, Calculator, AlertTriangle, FileText, Link, Layers,
  Repeat, Users, BookOpen, ChevronLeft, CheckCircle, XCircle,
  ArrowRight, RotateCcw, Play, Trophy,
  Sparkles, HelpCircle, GripVertical, Loader2,
  BarChart3, Plus, Eye, EyeOff, Library, Star, BookOpenCheck, Volume2, Camera
} from 'lucide-react';
import { useStore } from '../store';
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

// ─── Types ─────────────────────────────────────────────

type ModeId =
  | 'rapid' | 'feynman' | 'exam' | 'socratic' | 'gap'
  | 'mnemonics' | 'interleave' | 'formula' | 'errors'
  | 'tldr' | 'connect' | 'match' | 'spaced' | 'tutors' | 'solver';

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
            Lvl {gamification?.level || 1}
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
  const config = MODES.find(m => m.id === mode)!;
  const Icon = config.icon;

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
      {mode === 'feynman' && <FeynmanMode />}
      {mode === 'exam' && <ExamSimMode />}
      {mode === 'socratic' && <SocraticMode />}
      {mode === 'gap' && <GapFindMode />}
      {mode === 'mnemonics' && <MnemonicsMode />}
      {mode === 'interleave' && <InterleaveMode />}
      {mode === 'formula' && <FormulaMode />}
      {mode === 'errors' && <ErrorsMode />}
      {mode === 'tldr' && <TLDRMode />}
      {mode === 'connect' && <ConnectMode />}
      {mode === 'match' && <MatchMode />}
      {mode === 'spaced' && <SpacedRepMode />}
      {mode === 'tutors' && <TutorsMode />}
      {mode === 'solver' && <SolverMode />}
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
        });
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
// MODE 2: Feynman Technique
// ═══════════════════════════════════════════════════════

function FeynmanMode() {
  const { courses } = useStore();
  const [step, setStep] = useState<'pick' | 'explain' | 'feedback'>('pick');
  const [concept, setConcept] = useState('');
  const [explanation, setExplanation] = useState('');
  const [feedback, setFeedback] = useState<{ gaps: string[]; score: number; tips: string[] }>({ gaps: [], score: 0, tips: [] });
  const [loading, setLoading] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const callingRef = useRef(false);

  function pickRandom() {
    const cards = courses.flatMap(c => c.flashcards || []);
    if (cards.length === 0) return;
    const card = cards[Math.floor(Math.random() * cards.length)];
    setConcept(card.front);
    setStep('explain');
  }

  function templateEvaluate() {
    const words = explanation.trim().split(/\s+/).length;
    const hasExamples = /e\.g\.|for example|such as|like /i.test(explanation);
    const hasAnalogy = /like|similar to|imagine|think of/i.test(explanation);
    const isSimple = explanation.split(/[.!?]/).every(s => s.trim().split(/\s+/).length < 25);
    const gaps: string[] = [];
    const tips: string[] = [];
    let score = 50;
    if (words < 20) { gaps.push('Explanation is too brief'); tips.push('Try to elaborate more on the concept'); } else score += 10;
    if (!hasExamples) { gaps.push('No concrete examples given'); tips.push('Add a real-world example to illustrate'); } else score += 15;
    if (!hasAnalogy) { gaps.push('No analogies used'); tips.push('Try comparing to something familiar: "It\'s like..."'); } else score += 15;
    if (!isSimple) { gaps.push('Some sentences are complex'); tips.push('Break long sentences into shorter, simpler ones'); } else score += 10;
    if (words > 50) score += 5;
    if (words > 100) score += 5;
    score = Math.min(100, score);
    if (gaps.length === 0) tips.push('Excellent! Your explanation is clear and comprehensive.');
    return { gaps, score, tips };
  }

  async function evaluate() {
    if (callingRef.current) return;
    callingRef.current = true;
    setLoading(true);
    setUsedAI(false);

    if (isAIConfigured()) {
      try {
        const result = await callAI([{
          role: 'system',
          content: 'You evaluate student explanations using the Feynman Technique. Score the explanation 0-100 based on clarity, accuracy, use of examples, use of analogies, and simplicity. Return ONLY valid JSON: {"score": number, "gaps": ["string"], "tips": ["string"]}. Gaps are knowledge gaps found. Tips are specific improvement suggestions. If the explanation is excellent, gaps can be empty and tips should praise the student.',
        }, {
          role: 'user',
          content: `Concept: ${concept}\n\nStudent's explanation:\n${explanation}`,
        }], { temperature: 0.3, maxTokens: 512, json: true });

        const parsed = JSON.parse(result);
        if (typeof parsed.score === 'number' && Array.isArray(parsed.gaps) && Array.isArray(parsed.tips)) {
          setFeedback({ score: Math.min(100, Math.max(0, parsed.score)), gaps: parsed.gaps, tips: parsed.tips });
          setUsedAI(true);
          setStep('feedback');
          setLoading(false);
          callingRef.current = false;
          return;
        }
      } catch { /* fall through to template */ }
    }

    const fb = templateEvaluate();
    setFeedback(fb);
    setStep('feedback');
    setLoading(false);
    callingRef.current = false;
  }

  if (step === 'pick') {
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          The Feynman Technique: explain a concept in simple terms as if teaching a child. This reveals gaps in your understanding.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text" value={concept} onChange={e => setConcept(e.target.value)}
            placeholder="Enter a concept to explain..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => concept && setStep('explain')}>
            Start
          </button>
        </div>
        <button className="btn btn-secondary btn-sm w-full" onClick={pickRandom}>
          <Shuffle size={14} /> Random from flashcards
        </button>
      </div>
    );
  }

  if (step === 'explain') {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb size={16} style={{ color: '#eab308' }} />
          <span style={{ fontWeight: 700 }}>Explain: {concept}</span>
        </div>
        <p className="text-xs text-muted mb-2">
          Explain this concept in plain language. Use examples and analogies. Pretend you are teaching someone who knows nothing about the topic.
        </p>
        <textarea
          value={explanation} onChange={e => setExplanation(e.target.value)}
          placeholder="In simple terms, this concept means..."
          rows={8} style={textareaStyle}
        />
        <div className="flex gap-2 mt-2">
          <button className="btn btn-primary btn-sm" onClick={evaluate} disabled={explanation.trim().length < 10 || loading} style={{ flex: 1 }}>
            <CheckCircle size={14} /> {loading ? 'Evaluating...' : 'Evaluate My Explanation'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { setStep('pick'); setExplanation(''); }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-3">
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: `3px solid ${feedback.score >= 80 ? 'var(--green)' : feedback.score >= 60 ? 'var(--yellow)' : 'var(--red)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
        }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>{feedback.score}%</span>
        </div>
        <p style={{ fontWeight: 700, marginTop: 8 }}>
          {feedback.score >= 80 ? 'Strong understanding!' : feedback.score >= 60 ? 'Good, but some gaps' : 'Needs more work'}
        </p>
        {usedAI && <div style={{ fontSize: 10, color: 'var(--accent-light)', marginTop: 4 }}><Sparkles size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />AI-powered evaluation</div>}
      </div>
      {feedback.gaps.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--red-dim)', marginBottom: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--red)', marginBottom: 4 }}>Knowledge Gaps:</div>
          {feedback.gaps.map((g, i) => (
            <div key={i} className="text-sm" style={{ padding: '2px 0' }}>- {g}</div>
          ))}
        </div>
      )}
      <div style={{ ...cardStyle, background: 'var(--accent-glow)', padding: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent-light)', marginBottom: 4 }}>Tips:</div>
        {feedback.tips.map((t, i) => (
          <div key={i} className="text-sm" style={{ padding: '2px 0' }}>- {t}</div>
        ))}
      </div>
      <button className="btn btn-primary btn-sm mt-3 w-full" onClick={() => { setStep('pick'); setConcept(''); setExplanation(''); }}>
        <RotateCcw size={14} /> Try Another
      </button>
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
        }, ...context], { temperature: 0.7, maxTokens: 256 });

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

// ═══════════════════════════════════════════════════════
// MODE 5: Gap Find
// ═══════════════════════════════════════════════════════

function GapFindMode() {
  const { quizHistory, courses, proficiency } = useStore();
  const [aiInsights, setAiInsights] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const callingRef = useRef(false);

  const analysis = useMemo(() => {
    const subjectStats: Record<string, { correct: number; total: number; wrong: string[] }> = {};

    for (const attempt of quizHistory) {
      const key = attempt.subject || attempt.name || 'General';
      if (!subjectStats[key]) subjectStats[key] = { correct: 0, total: 0, wrong: [] };
      subjectStats[key].correct += attempt.correct || 0;
      subjectStats[key].total += attempt.questionCount || 0;

      for (const ans of (attempt.answers || [])) {
        if (!ans.correct && ans.question?.question) {
          subjectStats[key].wrong.push(ans.question.question);
        }
      }
    }

    return Object.entries(subjectStats)
      .map(([subject, stats]) => ({
        subject,
        pct: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
        total: stats.total,
        wrongSample: stats.wrong.slice(0, 3),
      }))
      .sort((a, b) => a.pct - b.pct);
  }, [quizHistory]);

  // Also check proficiency data
  const profGaps = useMemo(() => {
    if (!proficiency?.subjects) return [];
    const gaps: { subject: string; subtopic: string; score: number }[] = [];
    for (const [subj, topics] of Object.entries(proficiency.subjects)) {
      for (const [topic, entry] of Object.entries(topics)) {
        if (!entry.isProficient && entry.attempts?.length > 0) {
          gaps.push({ subject: subj, subtopic: topic, score: entry.proficiencyScore || 0 });
        }
      }
    }
    return gaps.sort((a, b) => a.score - b.score).slice(0, 10);
  }, [proficiency]);

  if (quizHistory.length === 0 && profGaps.length === 0) {
    return (
      <div className="text-center" style={{ padding: 24 }}>
        <Search size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
        <p className="text-sm text-muted">Take some quizzes first so we can identify your knowledge gaps.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Based on your quiz history, here are your weakest areas:
      </p>
      {analysis.length > 0 && (
        <div className="mb-3">
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>
            BY SUBJECT
          </div>
          {analysis.map(a => (
            <div key={a.subject} style={{
              padding: '8px 0', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div className="text-sm" style={{ fontWeight: 600 }}>{a.subject}</div>
                {a.wrongSample.length > 0 && (
                  <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                    Missed: {a.wrongSample[0].slice(0, 50)}...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div style={{
                  width: 60, height: 6, borderRadius: 3,
                  background: 'var(--bg-primary)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${a.pct}%`, height: '100%', borderRadius: 3,
                    background: a.pct >= 80 ? 'var(--green)' : a.pct >= 50 ? 'var(--yellow)' : 'var(--red)',
                  }} />
                </div>
                <span className="text-xs" style={{ fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
                  {a.pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {profGaps.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: 'var(--text-secondary)' }}>
            NOT YET PROFICIENT
          </div>
          {profGaps.map((g, i) => (
            <div key={i} className="flex items-center justify-between" style={{
              padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12,
            }}>
              <span>{g.subject} &gt; {g.subtopic}</span>
              <span className="badge badge-red" style={{ fontSize: 10 }}>{g.score}%</span>
            </div>
          ))}
        </div>
      )}
      {isAIConfigured() && (
        <div className="mt-3">
          {!aiInsights && !insightsLoading && (
            <button className="btn btn-primary btn-sm w-full" onClick={async () => {
              if (callingRef.current) return;
              callingRef.current = true;
              setInsightsLoading(true);
              try {
                const gapData = analysis.map(a => `${a.subject}: ${a.pct}% (${a.total} questions, missed: ${a.wrongSample.join('; ')})`).join('\n');
                const profData = profGaps.map(g => `${g.subject} > ${g.subtopic}: ${g.score}%`).join('\n');
                let result = '';
                await callAI([{
                  role: 'system',
                  content: 'Analyze these quiz results and proficiency gaps. Identify patterns, likely misconceptions, and give specific study recommendations. Be concise and actionable. Use bullet points.',
                }, {
                  role: 'user',
                  content: `Quiz performance by subject:\n${gapData || 'No quiz data'}\n\nProficiency gaps:\n${profData || 'No proficiency data'}`,
                }], {
                  temperature: 0.4, maxTokens: 1024,
                  onChunk: (chunk: string) => { result += chunk; setAiInsights(result); },
                });
              } catch { setAiInsights('AI analysis unavailable. Review the stats above to identify your weak areas.'); }
              setInsightsLoading(false);
              callingRef.current = false;
            }}>
              <Sparkles size={14} /> Get AI Analysis
            </button>
          )}
          {insightsLoading && !aiInsights && (
            <div className="flex items-center gap-2 justify-center" style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="spin" /> Analyzing your gaps...
            </div>
          )}
          {aiInsights && (
            <div style={{ ...cardStyle, background: 'var(--accent-glow)', padding: 12 }}>
              <div className="flex items-center gap-1 mb-2" style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>
                <Sparkles size={10} /> AI Analysis
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(aiInsights)) }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 6: Mnemonics
// ═══════════════════════════════════════════════════════

function MnemonicsMode() {
  const { courses } = useStore();
  const [topic, setTopic] = useState('');
  const [mnemonics, setMnemonics] = useState<{ type: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const callingRef = useRef(false);

  function templateGenerate(t: string): { type: string; content: string }[] {
    const words = t.trim().split(/\s+/);
    const results: { type: string; content: string }[] = [];
    if (words.length >= 3) {
      const acronym = words.map(w => w[0].toUpperCase()).join('');
      results.push({ type: 'Acronym', content: `${acronym} = ${words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(', ')}` });
    }
    const letters = t.replace(/\s+/g, '').slice(0, 8).split('');
    const acrosticWords: Record<string, string[]> = {
      a: ['Ants', 'Always', 'Apples'], b: ['Bears', 'Bring', 'Big'], c: ['Cats', 'Carry', 'Cool'],
      d: ['Dogs', 'Dance', 'Daring'], e: ['Eagles', 'Eat', 'Every'], f: ['Fish', 'Find', 'Fresh'],
      g: ['Goats', 'Get', 'Great'], h: ['Hawks', 'Have', 'Happy'], i: ['Insects', 'Invent', 'Icy'],
      j: ['Jaguars', 'Jump', 'Jolly'], k: ['Koalas', 'Keep', 'Kind'], l: ['Lions', 'Love', 'Large'],
      m: ['Monkeys', 'Make', 'Mighty'], n: ['Newts', 'Need', 'Noble'], o: ['Owls', 'Open', 'Old'],
      p: ['Parrots', 'Play', 'Pretty'], q: ['Quails', 'Quest', 'Quick'], r: ['Rabbits', 'Run', 'Red'],
      s: ['Snakes', 'Seek', 'Smart'], t: ['Tigers', 'Take', 'Tall'], u: ['Unicorns', 'Use', 'Ultra'],
      v: ['Vipers', 'Visit', 'Vast'], w: ['Wolves', 'Want', 'Wild'], x: ['Xerus', 'X-ray', 'Extra'],
      y: ['Yaks', 'Yield', 'Young'], z: ['Zebras', 'Zoom', 'Zesty'],
    };
    const sentence = letters.map(l => {
      const opts = acrosticWords[l.toLowerCase()] || [l.toUpperCase()];
      return opts[Math.floor(Math.random() * opts.length)];
    }).join(' ');
    results.push({ type: 'Acrostic', content: sentence });
    results.push({ type: 'Story Link', content: `Imagine you walk into a room where "${t}" is written on a giant whiteboard. The letters glow and transform into a scene: ${words.slice(0, 3).join(' meets ')} in a memorable way.` });
    results.push({ type: 'Rhyme', content: `"${words[0] || t}" sounds like fun, remember it well and you are done!` });
    results.push({ type: 'Memory Palace', content: `Place "${t}" at your front door. As you open it, the concept greets you. Each part sits in a different room of your house.` });
    return results;
  }

  async function generate() {
    if (!topic.trim() || callingRef.current) return;
    callingRef.current = true;
    setLoading(true);
    setUsedAI(false);

    if (isAIConfigured()) {
      try {
        const result = await callAI([{
          role: 'system',
          content: 'Create 5 creative and memorable memory aids (mnemonics) for the given topic/terms. Output exactly 5 lines, each in this format:\nTYPE: content\n\nUse these types: ACRONYM, ACROSTIC, STORY, RHYME, PALACE\n\nMake each one vivid, funny, or surprising so it sticks in memory. Be creative and specific to the topic.',
        }, {
          role: 'user',
          content: topic,
        }], { temperature: 0.9, maxTokens: 512 });

        const parsed: { type: string; content: string }[] = [];
        result.split('\n').forEach(line => {
          const m = line.match(/^(ACRONYM|ACROSTIC|STORY|RHYME|PALACE|Acronym|Acrostic|Story|Rhyme|Palace|Memory Palace|Story Link):\s*(.+)/i);
          if (m) {
            const typeMap: Record<string, string> = { acronym: 'Acronym', acrostic: 'Acrostic', story: 'Story Link', rhyme: 'Rhyme', palace: 'Memory Palace', 'memory palace': 'Memory Palace', 'story link': 'Story Link' };
            parsed.push({ type: typeMap[m[1].toLowerCase()] || m[1], content: m[2].trim() });
          }
        });

        if (parsed.length >= 3) {
          setMnemonics(parsed);
          setUsedAI(true);
          setLoading(false);
          callingRef.current = false;
          return;
        }
      } catch { /* fall through */ }
    }

    setMnemonics(templateGenerate(topic));
    setLoading(false);
    callingRef.current = false;
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Generate memory aids for any topic: acronyms, stories, rhymes, and memory palace techniques.
      </p>
      <div className="flex gap-2 mb-3">
        <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="Enter terms to memorize (space-separated)..."
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
          {loading ? <><Loader2 size={14} className="spin" /> Creating...</> : <><Brain size={14} /> Create</>}
        </button>
      </div>
      {mnemonics.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usedAI && (
            <div className="flex items-center gap-1" style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>
              <Sparkles size={10} /> AI-generated mnemonics
            </div>
          )}
          {mnemonics.map((m, i) => (
            <div key={i} style={{ ...cardStyle, background: 'var(--bg-primary)', padding: 12 }}>
              <div className="text-xs" style={{ fontWeight: 700, color: 'var(--accent-light)', marginBottom: 4 }}>
                {m.type}
              </div>
              <div className="text-sm" style={{ lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(m.content)) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 7: Interleave
// ═══════════════════════════════════════════════════════

function InterleaveMode() {
  const { courses } = useStore();
  const [active, setActive] = useState(false);
  const [questions, setQuestions] = useState<{ q: string; a: string; course: string; color: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  function start() {
    const all = courses.flatMap(c =>
      (c.flashcards || []).map(f => ({
        q: f.front, a: f.back,
        course: c.shortName || c.name,
        color: c.color || 'var(--accent)',
      }))
    );
    if (all.length === 0) return;
    setQuestions(shuffleArray(all).slice(0, 20));
    setIdx(0);
    setScore({ correct: 0, total: 0 });
    setShowAnswer(false);
    setActive(true);
  }

  function answer(correct: boolean) {
    setScore(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      total: prev.total + 1,
    }));
    setShowAnswer(false);
    if (idx + 1 >= questions.length) {
      setActive(false);
    } else {
      setIdx(idx + 1);
    }
  }

  if (!active) {
    const total = courses.reduce((s, c) => s + (c.flashcards?.length || 0), 0);
    return (
      <div>
        <p className="text-sm text-muted mb-3">
          Mixed practice: questions from different subjects interleaved together. This builds stronger, more flexible knowledge.
        </p>
        <div className="text-sm mb-3">
          {courses.filter(c => c.flashcards?.length).map(c => (
            <span key={c.id} className="badge mb-1" style={{
              marginRight: 4, background: c.color + '22', color: c.color, fontSize: 10,
            }}>
              {c.shortName || c.name} ({c.flashcards?.length})
            </span>
          ))}
        </div>
        {score.total > 0 && (
          <div className="text-sm mb-2" style={{ fontWeight: 600 }}>
            Last round: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
          </div>
        )}
        <button className="btn btn-primary w-full" onClick={start} disabled={total === 0}>
          <Shuffle size={14} /> Start Interleaved Practice ({Math.min(20, total)} Qs)
        </button>
      </div>
    );
  }

  const q = questions[idx];
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="badge" style={{ fontSize: 10, background: q.color + '22', color: q.color }}>
          {q.course}
        </span>
        <span className="text-xs" style={{ fontWeight: 600 }}>{idx + 1}/{questions.length}</span>
      </div>
      <div className="progress-bar mb-3">
        <div className="progress-fill" style={{ width: `${((idx + 1) / questions.length) * 100}%`, background: 'var(--accent)' }} />
      </div>
      <div style={{ ...cardStyle, background: 'var(--bg-primary)', marginBottom: 12, minHeight: 80 }}>
        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{q.q}</p>
      </div>
      {!showAnswer ? (
        <button className="btn btn-secondary w-full" onClick={() => setShowAnswer(true)}>
          <Eye size={14} /> Show Answer
        </button>
      ) : (
        <div>
          <div style={{ ...cardStyle, background: 'var(--accent-glow)', marginBottom: 8, padding: 12 }}>
            <p className="text-sm" style={{ fontWeight: 600 }}>{q.a}</p>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => answer(false)} style={{ flex: 1, color: 'var(--red)' }}>
              <XCircle size={14} /> Wrong
            </button>
            <button className="btn btn-primary" onClick={() => answer(true)} style={{ flex: 1 }}>
              <CheckCircle size={14} /> Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 8: Formula Flashcards
// ═══════════════════════════════════════════════════════

function FormulaMode() {
  const { courses } = useStore();
  const [formulas, setFormulas] = useState<{ name: string; formula: string; steps: string[] }[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSteps, setShowSteps] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customFormula, setCustomFormula] = useState('');
  const [customSteps, setCustomSteps] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nousai-formulas');
    if (saved) {
      try { setFormulas(JSON.parse(saved)); } catch {}
    }
  }, []);

  function addFormula() {
    if (!customName.trim() || !customFormula.trim()) return;
    const newFormulas = [...formulas, {
      name: customName.trim(),
      formula: customFormula.trim(),
      steps: customSteps.split('\n').filter(s => s.trim()),
    }];
    setFormulas(newFormulas);
    localStorage.setItem('nousai-formulas', JSON.stringify(newFormulas));
    setCustomName('');
    setCustomFormula('');
    setCustomSteps('');
  }

  function removeFormula(idx: number) {
    const updated = formulas.filter((_, i) => i !== idx);
    setFormulas(updated);
    localStorage.setItem('nousai-formulas', JSON.stringify(updated));
    if (currentIdx >= updated.length) setCurrentIdx(Math.max(0, updated.length - 1));
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Formula flashcards with step-by-step derivations. Add your formulas and review them.
      </p>
      {formulas.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ fontWeight: 600 }}>{currentIdx + 1}/{formulas.length}</span>
            <div className="flex gap-2">
              <button className="btn-icon" onClick={() => { setCurrentIdx(Math.max(0, currentIdx - 1)); setShowSteps(false); }}
                style={{ width: 28, height: 28 }} disabled={currentIdx === 0}>
                <ChevronLeft size={14} />
              </button>
              <button className="btn-icon" onClick={() => { setCurrentIdx(Math.min(formulas.length - 1, currentIdx + 1)); setShowSteps(false); }}
                style={{ width: 28, height: 28 }} disabled={currentIdx >= formulas.length - 1}>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
          <div style={{ ...cardStyle, background: 'var(--bg-primary)', textAlign: 'center', padding: 20 }}>
            <div className="text-xs text-muted mb-2">{formulas[currentIdx].name}</div>
            <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', marginBottom: 8 }}>
              {formulas[currentIdx].formula}
            </div>
            {formulas[currentIdx].steps.length > 0 && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowSteps(!showSteps)}>
                  {showSteps ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showSteps ? ' Hide Steps' : ' Show Steps'}
                </button>
                {showSteps && (
                  <div style={{ textAlign: 'left', marginTop: 12 }}>
                    {formulas[currentIdx].steps.map((s, i) => (
                      <div key={i} className="text-sm" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ color: 'var(--accent-light)', fontWeight: 700, marginRight: 8 }}>{i + 1}.</span>
                        {s}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <button className="btn btn-secondary btn-sm mt-1" onClick={() => removeFormula(currentIdx)}
            style={{ fontSize: 10, padding: '2px 8px', color: 'var(--red)' }}>
            Remove
          </button>
        </div>
      )}
      <div style={{ ...cardStyle, background: 'var(--bg-primary)', padding: 12 }}>
        <div className="text-xs" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)' }}>ADD FORMULA</div>
        <input type="text" value={customName} onChange={e => setCustomName(e.target.value)}
          placeholder="Formula name (e.g., Quadratic Formula)" style={{ ...inputStyle, marginBottom: 6, fontSize: 12, padding: '8px 12px' }} />
        <input type="text" value={customFormula} onChange={e => setCustomFormula(e.target.value)}
          placeholder="Formula (e.g., x = (-b +/- sqrt(b^2-4ac)) / 2a)" style={{ ...inputStyle, marginBottom: 6, fontSize: 12, padding: '8px 12px', fontFamily: 'monospace' }} />
        <textarea value={customSteps} onChange={e => setCustomSteps(e.target.value)}
          placeholder="Derivation steps (one per line)..." rows={3}
          style={{ ...textareaStyle, fontSize: 12, padding: '8px 12px' }} />
        <button className="btn btn-primary btn-sm mt-2 w-full" onClick={addFormula}>
          <Plus size={12} /> Add Formula
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 9: Error Analysis
// ═══════════════════════════════════════════════════════

function ErrorsMode() {
  const { quizHistory } = useStore();
  const [aiInsights, setAiInsights] = useState('');
  const [insightsLoading, setInsightsLoading] = useState(false);
  const callingRef = useRef(false);

  const errors = useMemo(() => {
    const wrongAnswers: {
      question: string; userAnswer: string; correctAnswer: string;
      explanation?: string; subject: string; date: string;
    }[] = [];

    for (const attempt of quizHistory) {
      for (const ans of (attempt.answers || [])) {
        if (!ans.correct && ans.question) {
          wrongAnswers.push({
            question: ans.question.question || '',
            userAnswer: ans.userAnswer || '(no answer)',
            correctAnswer: ans.question.correctAnswer || '',
            explanation: ans.question.explanation,
            subject: attempt.subject || attempt.name || 'General',
            date: attempt.date,
          });
        }
      }
    }

    return wrongAnswers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [quizHistory]);

  const [expanded, setExpanded] = useState<number | null>(null);

  if (errors.length === 0) {
    return (
      <div className="text-center" style={{ padding: 24 }}>
        <AlertTriangle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
        <p className="text-sm text-muted">No errors found. Take some quizzes to see your mistake patterns here.</p>
      </div>
    );
  }

  // Group by pattern
  const bySubject: Record<string, number> = {};
  errors.forEach(e => { bySubject[e.subject] = (bySubject[e.subject] || 0) + 1; });
  const topSubjects = Object.entries(bySubject).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Review your wrong answers to understand mistake patterns and avoid repeating them.
      </p>
      <div className="mb-3">
        <div className="text-xs" style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
          MOST ERRORS IN
        </div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {topSubjects.map(([subj, count]) => (
            <span key={subj} className="badge badge-red" style={{ fontSize: 10 }}>
              {subj}: {count}
            </span>
          ))}
        </div>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {errors.slice(0, 20).map((e, i) => (
          <div key={i} onClick={() => setExpanded(expanded === i ? null : i)}
            style={{
              ...cardStyle, background: 'var(--bg-primary)', marginBottom: 6,
              padding: 10, cursor: 'pointer',
              borderLeftColor: 'var(--red)', borderLeftWidth: 3,
            }}>
            <div className="flex items-center justify-between">
              <div className="text-sm" style={{ fontWeight: 600, flex: 1 }}>
                {e.question.slice(0, 80)}{e.question.length > 80 ? '...' : ''}
              </div>
              <span className="text-xs text-muted">{e.subject}</span>
            </div>
            {expanded === i && (
              <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7 }}>
                <div><span style={{ color: 'var(--red)', fontWeight: 700 }}>Your answer:</span> {e.userAnswer}</div>
                <div><span style={{ color: 'var(--green)', fontWeight: 700 }}>Correct:</span> {e.correctAnswer}</div>
                {e.explanation && <div className="text-muted" style={{ marginTop: 4 }}>{e.explanation}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="text-xs text-muted mt-2">
        Showing {Math.min(20, errors.length)} of {errors.length} total errors
      </div>
      {isAIConfigured() && (
        <div className="mt-3">
          {!aiInsights && !insightsLoading && (
            <button className="btn btn-primary btn-sm w-full" onClick={async () => {
              if (callingRef.current) return;
              callingRef.current = true;
              setInsightsLoading(true);
              try {
                const errorSample = errors.slice(0, 15).map(e =>
                  `[${e.subject}] Q: ${e.question.slice(0, 100)}\nYour answer: ${e.userAnswer}\nCorrect: ${e.correctAnswer}`
                ).join('\n\n');
                let result = '';
                await callAI([{
                  role: 'system',
                  content: 'Analyze these wrong answers from quizzes. Find common misconception patterns, identify areas of confusion, and suggest targeted review strategies. Be concise and actionable. Use bullet points.',
                }, {
                  role: 'user',
                  content: `Recent wrong answers:\n\n${errorSample}`,
                }], {
                  temperature: 0.4, maxTokens: 1024,
                  onChunk: (chunk: string) => { result += chunk; setAiInsights(result); },
                });
              } catch { setAiInsights('AI analysis unavailable. Review your errors above to spot patterns manually.'); }
              setInsightsLoading(false);
              callingRef.current = false;
            }}>
              <Sparkles size={14} /> Analyze Patterns
            </button>
          )}
          {insightsLoading && !aiInsights && (
            <div className="flex items-center gap-2 justify-center" style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>
              <Loader2 size={14} className="spin" /> Analyzing error patterns...
            </div>
          )}
          {aiInsights && (
            <div style={{ ...cardStyle, background: 'var(--accent-glow)', padding: 12 }}>
              <div className="flex items-center gap-1 mb-2" style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>
                <Sparkles size={10} /> AI Pattern Analysis
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(aiInsights)) }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 10: TL;DR Summaries
// ═══════════════════════════════════════════════════════

function TLDRMode() {
  const [input, setInput] = useState('');
  const [summary, setSummary] = useState('');
  const [mode, setMode] = useState<'ultra' | 'bullet' | 'eli5'>('ultra');
  const [loading, setLoading] = useState(false);
  const [usedAI, setUsedAI] = useState(false);
  const callingRef = useRef(false);

  function templateSummarize(text: string, m: 'ultra' | 'bullet' | 'eli5'): string {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (m === 'ultra') {
      const wordFreq: Record<string, number> = {};
      text.toLowerCase().split(/\s+/).forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      const scored = sentences.map((s, i) => {
        const words = s.toLowerCase().split(/\s+/);
        const sc = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / words.length;
        return { text: s.trim(), score: sc * (i === 0 ? 1.5 : 1) };
      });
      scored.sort((a, b) => b.score - a.score);
      return `TL;DR: ${scored[0]?.text || text.slice(0, 100)}`;
    } else if (m === 'bullet') {
      const topN = Math.max(3, Math.ceil(sentences.length * 0.25));
      const wordFreq: Record<string, number> = {};
      text.toLowerCase().split(/\s+/).forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
      const scored = sentences.map((s, i) => {
        const words = s.toLowerCase().split(/\s+/);
        const sc = words.reduce((sum, w) => sum + (wordFreq[w] || 0), 0) / words.length;
        return { text: s.trim(), score: sc * (i === 0 ? 1.5 : 1), idx: i };
      });
      const top = scored.sort((a, b) => b.score - a.score).slice(0, topN).sort((a, b) => a.idx - b.idx);
      return top.map(t => `- ${t.text}`).join('\n');
    } else {
      const simplified = sentences.slice(0, 4).map(s => {
        return s.trim()
          .replace(/\b(utilize|implement|facilitate)\b/gi, 'use')
          .replace(/\b(approximately)\b/gi, 'about')
          .replace(/\b(subsequently)\b/gi, 'then')
          .replace(/\b(consequently)\b/gi, 'so')
          .replace(/\b(fundamental|essential)\b/gi, 'key');
      });
      return `Simplified:\n${simplified.join(' ')}`;
    }
  }

  async function summarize() {
    if (!input.trim() || callingRef.current) return;
    callingRef.current = true;
    setLoading(true);
    setUsedAI(false);

    const text = input.slice(0, 4000);

    if (isAIConfigured()) {
      try {
        const prompts: Record<string, string> = {
          ultra: 'Summarize the following text in exactly one sentence. Capture the core idea concisely. Start with "TL;DR:"',
          bullet: 'Summarize the following text as 3-5 bullet points. Start each point with a dash (-). Capture the key ideas in order.',
          eli5: 'Explain the following text like I\'m 5 years old. Use simple words, fun analogies, and short sentences. Make it easy and engaging to understand.',
        };
        let result = '';
        await callAI([{
          role: 'system',
          content: prompts[mode],
        }, {
          role: 'user',
          content: text,
        }], {
          temperature: 0.3,
          maxTokens: 1024,
          onChunk: (chunk: string) => {
            result += chunk;
            setSummary(result);
          },
        });
        if (result.trim()) {
          setUsedAI(true);
          setLoading(false);
          callingRef.current = false;
          return;
        }
      } catch { /* fall through to template */ }
    }

    setSummary(templateSummarize(text, mode));
    setLoading(false);
    callingRef.current = false;
  }

  return (
    <div>
      <p className="text-sm text-muted mb-2">
        Ultra-condensed summaries. Paste any text and get the essentials.
      </p>
      <div className="flex gap-2 mb-2">
        {(['ultra', 'bullet', 'eli5'] as const).map(m => (
          <button key={m} className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode(m)} style={{ flex: 1, fontSize: 11 }}>
            {m === 'ultra' ? 'One-liner' : m === 'bullet' ? 'Bullets' : 'ELI5'}
          </button>
        ))}
      </div>
      <textarea value={input} onChange={e => setInput(e.target.value)}
        placeholder="Paste text to summarize..." rows={5} style={textareaStyle} />
      <button className="btn btn-primary btn-sm mt-2 w-full" onClick={summarize} disabled={!input.trim() || loading}>
        {loading ? <><Loader2 size={14} className="spin" /> Summarizing...</> : <><FileText size={14} /> Summarize</>}
      </button>
      {summary && (
        <div style={{ ...cardStyle, background: 'var(--bg-primary)', marginTop: 8, padding: 12 }}>
          {usedAI && (
            <div className="flex items-center gap-1 mb-2" style={{ fontSize: 10, color: 'var(--accent-light)', fontWeight: 600 }}>
              <Sparkles size={10} /> AI-powered summary
            </div>
          )}
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.7, margin: 0 }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderMd(summary)) }} />
          <button className="btn btn-secondary btn-sm mt-2" onClick={() => navigator.clipboard.writeText(summary)}>
            Copy
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MODE 11: Connect (Cross-topic)
// ═══════════════════════════════════════════════════════

function ConnectMode() {
  const { courses, data, updatePluginData } = useStore();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<{ from: string; to: string; link: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  // Load saved connections
  useEffect(() => {
    const saved = (data?.pluginData as any)?.knowledgeWeb;
    if (saved && Array.isArray(saved)) setConnections(saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save connections
  function persist(conns: { from: string; to: string; link: string }[]) {
    setConnections(conns);
    if (data) {
      const mapped = conns.map((c, i) => ({ id: String(i), from: c.from, to: c.to, relation: c.link }));
      updatePluginData({ knowledgeWeb: mapped });
    }
  }

  async function findConnections() {
    const allCards = courses.flatMap(c =>
      (c.flashcards || []).map(f => ({
        ...f, course: c.shortName || c.name, color: c.color,
      }))
    );
    if (allCards.length < 4) return;
    setLoading(true);

    // Try AI
    if (isAIConfigured()) {
      try {
        const shuffled = shuffleArray(allCards).slice(0, 20);
        const cardText = shuffled.map(c => `[${c.course}] ${c.front}: ${c.back}`).join('\n');
        let result = '';
        await callAI([{
          role: 'system',
          content: 'You find cross-topic connections between study concepts. Given flashcards from different courses, identify 4-6 meaningful connections. For each connection, output one line in this exact format:\nFROM: [concept] | TO: [concept] | LINK: [explanation]\nOnly output the connections, nothing else.',
        }, {
          role: 'user',
          content: cardText,
        }], {
          onChunk: (chunk: string) => { result += chunk; },
        });

        const parsed: { from: string; to: string; link: string }[] = [];
        result.split('\n').forEach(line => {
          const m = line.match(/FROM:\s*(.+?)\s*\|\s*TO:\s*(.+?)\s*\|\s*LINK:\s*(.+)/i);
          if (m) parsed.push({ from: m[1].trim(), to: m[2].trim(), link: m[3].trim() });
        });

        if (parsed.length > 0) {
          const merged = [...connections, ...parsed].slice(-15);
          persist(merged);
          setLoading(false);
          return;
        }
      } catch { /* fall through */ }
    }

    // Template fallback
    const found: { from: string; to: string; link: string }[] = [];
    const shuffled = shuffleArray(allCards);
    for (let i = 0; i < Math.min(shuffled.length - 1, 20); i++) {
      for (let j = i + 1; j < Math.min(shuffled.length, i + 5); j++) {
        const a = shuffled[i];
        const b = shuffled[j];
        if (a.course === b.course) continue;
        const aWords = new Set((a.front + ' ' + a.back).toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const bWords = new Set((b.front + ' ' + b.back).toLowerCase().split(/\s+/).filter(w => w.length > 4));
        const common = [...aWords].filter(w => bWords.has(w));
        if (common.length > 0) {
          found.push({
            from: `[${a.course}] ${a.front}`,
            to: `[${b.course}] ${b.front}`,
            link: `Shared concepts: ${common.slice(0, 3).join(', ')}`,
          });
        }
      }
      if (found.length >= 5) break;
    }
    if (found.length === 0) {
      for (let i = 0; i < Math.min(3, Math.floor(shuffled.length / 2)); i++) {
        const a = shuffled[i * 2];
        const b = shuffled[i * 2 + 1];
        if (a && b) found.push({
          from: `[${a.course}] ${a.front}`, to: `[${b.course}] ${b.front}`,
          link: 'Challenge: find a connection between these concepts!',
        });
      }
    }
    const merged = [...connections, ...found].slice(-15);
    persist(merged);
    setLoading(false);
  }

  // SVG knowledge graph
  function renderGraph() {
    if (connections.length === 0) return null;
    const nodes = new Map<string, { x: number; y: number }>();
    connections.forEach(c => {
      if (!nodes.has(c.from)) nodes.set(c.from, { x: 0, y: 0 });
      if (!nodes.has(c.to)) nodes.set(c.to, { x: 0, y: 0 });
    });
    // Layout in a circle
    const nodeArr = Array.from(nodes.keys());
    const cx = 250, cy = 180, radius = 140;
    nodeArr.forEach((n, i) => {
      const angle = (i / nodeArr.length) * Math.PI * 2 - Math.PI / 2;
      nodes.set(n, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
    });

    return (
      <svg width="100%" viewBox="0 0 500 360" style={{
        border: '1px solid var(--border)', borderRadius: 6,
        background: 'var(--bg-primary)', marginBottom: 12,
      }}>
        {/* Edges */}
        {connections.map((c, i) => {
          const from = nodes.get(c.from)!;
          const to = nodes.get(c.to)!;
          return (
            <line key={`e${i}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="var(--accent)" strokeWidth={1.5} strokeOpacity={0.4} />
          );
        })}
        {/* Nodes */}
        {nodeArr.map((n, i) => {
          const pos = nodes.get(n)!;
          const label = n.length > 20 ? n.slice(0, 18) + '...' : n;
          // Extract course shortname from "[CourseName] Term" format
          const courseMatch = n.match(/^\[([^\]]+)\]/);
          const courseShortName = courseMatch?.[1];
          const course = courseShortName ? courses.find(c => c.shortName === courseShortName || c.name === courseShortName) : null;
          return (
            <g key={`n${i}`} style={{ cursor: course ? 'pointer' : 'default' }}
              onClick={() => course && navigate(`/course?id=${course.id}`)}>
              <circle cx={pos.x} cy={pos.y} r={8} fill="var(--accent)" />
              <text x={pos.x} y={pos.y - 12} textAnchor="middle" fill="var(--text-secondary)"
                fontSize={8} fontWeight={600} fontFamily="Inter, sans-serif">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Discover connections across subjects. Building cross-topic links strengthens long-term memory.
      </p>
      <div className="flex gap-2 mb-3">
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={findConnections} disabled={loading}>
          <Link size={14} /> {loading ? 'Finding...' : 'Find Connections'}
        </button>
        {connections.length > 0 && (
          <button className="btn btn-secondary" onClick={() => setShowGraph(!showGraph)}>
            {showGraph ? <Layers size={14} /> : <Link size={14} />}
            {showGraph ? 'List' : 'Graph'}
          </button>
        )}
      </div>

      {showGraph && renderGraph()}

      {connections.length > 0 && !showGraph && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {connections.map((c, i) => (
            <div key={i} style={{ ...cardStyle, background: 'var(--bg-primary)', padding: 12 }}>
              <div className="text-sm" style={{ fontWeight: 600 }}>{c.from}</div>
              <div style={{ textAlign: 'center', padding: '4px 0', color: 'var(--accent-light)' }}>
                <Link size={12} style={{ verticalAlign: 'middle' }} />
              </div>
              <div className="text-sm" style={{ fontWeight: 600 }}>{c.to}</div>
              <div className="text-xs text-muted" style={{ marginTop: 4, fontStyle: 'italic' }}>{c.link}</div>
            </div>
          ))}
          <button className="btn btn-sm btn-secondary" onClick={() => persist([])} style={{ fontSize: 10 }}>
            Clear All Connections
          </button>
        </div>
      )}
    </div>
  );
}
