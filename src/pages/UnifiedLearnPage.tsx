/**
 * UnifiedLearnPage — merges Learn, AI Tools, and Tools into one searchable, filterable page.
 * 57 items across 6 categories with hide/show customization.
 */
import React, { useState, useMemo, useEffect, Suspense, lazy } from 'react';
import {
  Zap, Lightbulb, Clock, MessageCircle, Search, Brain,
  Shuffle, Calculator, AlertTriangle, FileText, Link, Layers,
  Repeat, Users, HelpCircle, Atom, Languages,
  ScanLine, Mic, GitBranch, BookOpen,
  Edit3, CheckCircle, Headphones, MessageSquare,
  GraduationCap, RefreshCw, Dumbbell, GitMerge, CalendarDays,
  Download, ScanSearch, Volume2, Sparkles, PenTool,
  Globe, Code2, FlaskConical, Box, MapPin, Trophy,
  Eye, EyeOff, Settings2, Library, ClipboardList, ScanText, Wrench, Film,
} from 'lucide-react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useStore } from '../store';
import { ToolErrorBoundary } from '../components/ToolErrorBoundary';

// ── Lazy imports — Learn modes ───────────────────────────────────────────────
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
import RapidLearnMode from '../components/learn/RapidLearnMode';
import SocraticMode from '../components/learn/SocraticMode';

const JpQuizTab          = lazy(() => import('../components/jpquiz/JpQuizTab'));
const PhysicsQuizTab     = lazy(() => import('../components/physquiz/PhysicsQuizTab'));
const BiolPractiumTab      = lazyWithRetry(() => import('../components/biolquiz/BiolPractiumTab'));
const EvolutionPractiumTab = lazyWithRetry(() => import('../components/evolutionquiz/EvolutionPractiumTab'));

// ── Lazy imports — AI tools ──────────────────────────────────────────────────
const OcrTool           = lazyWithRetry(() => import('../components/aitools/OcrTool'));
const DictateTool       = lazyWithRetry(() => import('../components/aitools/DictateTool'));
const AnalogyTool       = lazyWithRetry(() => import('../components/aitools/AnalogyTool'));
const MindMapTool       = lazyWithRetry(() => import('../components/aitools/MindMapTool'));
const CourseGenTool     = lazyWithRetry(() => import('../components/aitools/CourseGenTool'));
const RenameTool        = lazyWithRetry(() => import('../components/aitools/RenameTool'));
const FactCheckTool     = lazyWithRetry(() => import('../components/aitools/FactCheckTool'));
const PhysicsSimTool    = lazyWithRetry(() => import('../components/aitools/PhysicsSimTool'));
const AIChatTool        = lazyWithRetry(() => import('../components/aitools/AIChatTool'));
const OmiTool           = lazyWithRetry(() => import('../components/aitools/OmiTool'));
const FlashcardGenTool  = lazyWithRetry(() => import('../components/aitools/FlashcardGenTool'));
const QuizGenTool       = lazyWithRetry(() => import('../components/aitools/QuizGenTool'));
const TutorTool         = lazyWithRetry(() => import('../components/aitools/TutorTool'));
const ReExplainTool     = lazyWithRetry(() => import('../components/aitools/ReExplainTool'));
const PracticeGenTool   = lazyWithRetry(() => import('../components/aitools/PracticeGenTool'));
const PrerequisiteTool  = lazyWithRetry(() => import('../components/aitools/PrerequisiteTool'));
const StudyScheduleTool = lazyWithRetry(() => import('../components/aitools/StudyScheduleTool'));
const AnkiImportTool    = lazyWithRetry(() => import('../components/aitools/AnkiImportTool'));
const QuizletImportTool = lazyWithRetry(() => import('../components/aitools/QuizletImportTool'));
const PdfUploaderTool      = lazyWithRetry(() => import('../components/aitools/PdfUploaderTool'));
const FileToolsKit         = lazyWithRetry(() => import('../components/aitools/FileToolsKit'));
const ProcedureQuizTool    = lazyWithRetry(() => import('../components/aitools/ProcedureQuizTool'));
const TesseractOcrTool     = lazyWithRetry(() => import('../components/aitools/TesseractOcrTool'));
const VideoTool            = lazyWithRetry(() => import('../components/aitools/VideoTool'));
const RSVPMode             = lazyWithRetry(() => import('../components/learn/RSVPMode'));
const BigContentTool       = lazyWithRetry(() => import('../components/aitools/BigContentTool'));
const ScreenLassoTool      = lazyWithRetry(() => import('../components/aitools/ScreenLassoTool'));
const LeechManagerTool     = lazyWithRetry(() => import('../components/aitools/LeechManagerTool'));
const PreTestMode          = lazyWithRetry(() => import('../components/learn/PreTestMode'));
const OmniProtocol         = lazyWithRetry(() => import('../components/learn/OmniProtocol'));

// ── Lazy imports — ToolsPage (for embedded tools) ───────────────────────────
const ToolsPage = lazyWithRetry(() => import('./ToolsPage')) as React.LazyExoticComponent<(props: { initialView?: string }) => React.ReactElement | null>;

// ── Types ────────────────────────────────────────────────────────────────────
type Category = 'all' | 'learn' | 'generate' | 'capture' | 'analyze' | 'utilities' | 'specialty';

interface ToolEntry {
  id: string;
  name: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  category: Exclude<Category, 'all'>;
  render: () => React.ReactNode;
}

// ── Course-picker wrappers for practicum tabs that require a course prop ─────
function JpPracticumWrapper() {
  const { courses } = useStore();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const course = courses.find(c => c.id === courseId);
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create a course first.</div>;
  return (
    <div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ marginBottom: 16, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {course && <Suspense fallback={<Loader />}><JpQuizTab course={course} /></Suspense>}
    </div>
  );
}

function PhysicsPracticumWrapper() {
  const { courses } = useStore();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const course = courses.find(c => c.id === courseId);
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create a course first.</div>;
  return (
    <div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ marginBottom: 16, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {course && <Suspense fallback={<Loader />}><PhysicsQuizTab course={course} /></Suspense>}
    </div>
  );
}

function BiolPracticumWrapper() {
  const { courses } = useStore();
  const course = courses.find(c =>
    c.shortName?.toUpperCase().includes('BIOL') ||
    c.name.toLowerCase().includes('molecular') ||
    c.name.toLowerCase().includes('cell')
  ) ?? courses[0] ?? { id: 'biol-global', name: 'BIOL 3020', shortName: 'BIOL3020', color: '#22c55e', topics: [], flashcards: [] };
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create a BIOL course first.</div>;
  return (
    <Suspense fallback={<Loader />}><BiolPractiumTab course={course} /></Suspense>
  );
}

function EvolutionPracticumWrapper() {
  const { courses } = useStore();
  const course = courses.find(c =>
    c.shortName?.toUpperCase().includes('EVOL') ||
    c.shortName?.includes('4230') ||
    c.name.toLowerCase().includes('evolution')
  ) ?? courses[0] ?? { id: 'evol-global', name: 'Evolution', shortName: 'EVOL4230', color: '#a78bfa', topics: [], flashcards: [] };
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create an Evolution course first.</div>;
  return (
    <Suspense fallback={<Loader />}><EvolutionPractiumTab course={course} /></Suspense>
  );
}

// ── Wrappers for tools that need course/card data ─────────────────────────────
function RSVPWrapper() {
  const { courses } = useStore();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const course = courses.find(c => c.id === courseId);
  const cards = course?.flashcards ?? [];
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create a course first.</div>;
  return (
    <div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ marginBottom: 16, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Suspense fallback={<Loader />}>
        <RSVPMode key={courseId} cards={cards} onComplete={() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'spaced' }))} />
      </Suspense>
    </div>
  );
}

function PreTestWrapper() {
  const { courses } = useStore();
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const course = courses.find(c => c.id === courseId);
  const cards = course?.flashcards ?? [];
  if (!courses.length) return <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No courses found. Create a course first.</div>;
  return (
    <div>
      <select value={courseId} onChange={e => setCourseId(e.target.value)} style={{ marginBottom: 16, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 13 }}>
        {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <Suspense fallback={<Loader />}>
        <PreTestMode key={courseId} cards={cards} onComplete={() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'spaced' }))} />
      </Suspense>
    </div>
  );
}

function LeechManagerWrapper() {
  return (
    <Suspense fallback={<Loader />}>
      <LeechManagerTool />
    </Suspense>
  );
}

// ── Tool registry ─────────────────────────────────────────────────────────────
const TOOLS: ToolEntry[] = [
  // ── Learn ────────────────────────────────────────────────────────────────
  { id: 'rapid',      name: 'Rapid Learn',  desc: 'Quick topic overview',        icon: Zap,            color: '#f59e0b', category: 'learn',     render: () => <RapidLearnMode /> },
  { id: 'feynman',    name: 'Feynman',      desc: 'Explain to learn',            icon: Lightbulb,      color: '#eab308', category: 'learn',     render: () => <FeynmanMode onBack={() => {}} /> },
  { id: 'socratic',   name: 'Socratic',     desc: 'Guided questions',            icon: MessageSquare,  color: '#8b5cf6', category: 'learn',     render: () => <SocraticMode /> },
  { id: 'exam',       name: 'Exam Sim',     desc: 'Timed practice',              icon: Clock,          color: '#ef4444', category: 'learn',     render: () => <ExamSimMode /> },
  { id: 'gap',        name: 'Gap Find',     desc: 'Find weak spots',             icon: Search,         color: '#06b6d4', category: 'learn',     render: () => <GapFindMode onBack={() => {}} /> },
  { id: 'mnemonics',  name: 'Mnemonics',    desc: 'Memory aids',                 icon: Brain,          color: '#ec4899', category: 'learn',     render: () => <MnemonicsMode onBack={() => {}} /> },
  { id: 'interleave', name: 'Interleave',   desc: 'Mixed practice',              icon: Shuffle,        color: '#10b981', category: 'learn',     render: () => <InterleaveMode onBack={() => {}} /> },
  { id: 'formula',    name: 'Formula',      desc: 'Step-by-step math',           icon: Calculator,     color: '#6366f1', category: 'learn',     render: () => <FormulaMode onBack={() => {}} /> },
  { id: 'errors',     name: 'Errors',       desc: 'Mistake analysis',            icon: AlertTriangle,  color: '#f97316', category: 'learn',     render: () => <ErrorsMode onBack={() => {}} /> },
  { id: 'tldr',       name: 'TL;DR',        desc: 'Ultra summaries',             icon: FileText,       color: '#14b8a6', category: 'learn',     render: () => <TLDRMode onBack={() => {}} /> },
  { id: 'connect',    name: 'Connect',      desc: 'Cross-topic links',           icon: Link,           color: '#a855f7', category: 'learn',     render: () => <ConnectMode onBack={() => {}} /> },
  { id: 'match',      name: 'Match',        desc: 'Drag-drop matching',          icon: Layers,         color: '#3b82f6', category: 'learn',     render: () => <MatchMode /> },
  { id: 'spaced',     name: 'Spaced Rep',   desc: 'FSRS review',                 icon: Repeat,         color: '#22c55e', category: 'learn',     render: () => <SpacedRepMode /> },
  { id: 'tutors',     name: 'Tutors',       desc: 'AI teaching styles',          icon: Users,          color: '#e11d48', category: 'learn',     render: () => <TutorsMode /> },
  { id: 'solver',     name: 'Solver',       desc: 'Step-by-step help + graphs',  icon: HelpCircle,     color: '#0ea5e9', category: 'learn',     render: () => <SolverMode /> },
  { id: 'reexplain',  name: 'Re-Explain',   desc: 'Simpler breakdown on demand', icon: RefreshCw,      color: '#6366f1', category: 'learn',     render: () => <Suspense fallback={<Loader />}><ReExplainTool /></Suspense> },
  { id: 'analogy',    name: 'Analogy',      desc: 'Concept analogies & bridges', icon: Lightbulb,      color: '#f59e0b', category: 'learn',     render: () => <Suspense fallback={<Loader />}><AnalogyTool /></Suspense> },
  { id: 'aichat',     name: 'AI Chat',      desc: 'Open-ended AI conversation',  icon: MessageSquare,  color: '#8b5cf6', category: 'learn',     render: () => <Suspense fallback={<Loader />}><AIChatTool /></Suspense> },
  { id: 'mindmap',    name: 'Mind Map',     desc: 'Visual topic mind map',       icon: GitBranch,      color: '#10b981', category: 'learn',     render: () => <Suspense fallback={<Loader />}><MindMapTool /></Suspense> },
  { id: 'speedread',  name: 'Speed Reader', desc: 'Rapid serial visual reading', icon: Zap,            color: '#f59e0b', category: 'learn',     render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="speedread" /></Suspense> },
  { id: 'oralquiz',   name: 'Oral Quiz',    desc: 'Speak answers — hands-free',  icon: MessageSquare,  color: '#ec4899', category: 'learn',     render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="oralquiz" /></Suspense> },
  { id: 'tutor',      name: 'Tutor',        desc: 'Guided topic explanations',   icon: GraduationCap,  color: '#f97316', category: 'learn',     render: () => <Suspense fallback={<Loader />}><TutorTool /></Suspense> },
  { id: 'procedure-quiz', name: 'Procedure Quiz', desc: 'Quiz yourself on step-by-step procedures with AI scoring', icon: ClipboardList, color: '#22c55e', category: 'learn', render: () => <Suspense fallback={<Loader />}><ProcedureQuizTool /></Suspense> },
  { id: 'rsvp',        name: '⚡ Speed Preview', desc: 'Flash through cards rapidly to build familiarity before deep study', icon: Zap, color: '#f59e0b', category: 'learn', render: () => <RSVPWrapper /> },
  { id: 'pretest',     name: '🎯 Pre-Test Mode', desc: 'Test before learning — hypercorrection effect improves retention 15-20%', icon: CheckCircle, color: '#ef4444', category: 'learn', render: () => <PreTestWrapper /> },
  { id: 'omni-protocol', name: '⚡ Omni Protocol V6', desc: '60min–3hr AI-personalized session: multi-cycle Bloom\'s escalation, arc phase tracking, Feynman gap targeting', icon: Zap, color: '#F5A623', category: 'learn', render: () => <Suspense fallback={<Loader />}><OmniProtocol onComplete={() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'spaced' }))} /></Suspense> },
  // ── Generate ──────────────────────────────────────────────────────────────
  { id: 'course',     name: 'Course Gen',   desc: 'Build a full course outline',  icon: BookOpen,       color: '#6366f1', category: 'generate',  render: () => <Suspense fallback={<Loader />}><CourseGenTool /></Suspense> },
  { id: 'flashcardgen',name:'Flashcards',   desc: 'AI-generated flashcards',      icon: Layers,         color: '#3b82f6', category: 'generate',  render: () => <Suspense fallback={<Loader />}><FlashcardGenTool /></Suspense> },
  { id: 'quizgen',    name: 'Quiz Gen',     desc: 'Generate practice quizzes',    icon: HelpCircle,     color: '#ef4444', category: 'generate',  render: () => <Suspense fallback={<Loader />}><QuizGenTool /></Suspense> },
  { id: 'practice',   name: 'Practice Probs',desc:'Worked problem sets',          icon: Dumbbell,       color: '#10b981', category: 'generate',  render: () => <Suspense fallback={<Loader />}><PracticeGenTool /></Suspense> },
  { id: 'schedule',   name: 'Study Plan',   desc: 'AI exam study schedule',       icon: CalendarDays,   color: '#f97316', category: 'generate',  render: () => <Suspense fallback={<Loader />}><StudyScheduleTool /></Suspense> },

  // ── Capture ───────────────────────────────────────────────────────────────
  { id: 'dictate',    name: 'Dictate',      desc: 'Speech-to-text, 13 languages', icon: Mic,            color: '#10b981', category: 'capture',   render: () => <Suspense fallback={<Loader />}><DictateTool /></Suspense> },
  { id: 'ocr',        name: 'OCR',          desc: 'Extract text from images',     icon: ScanLine,       color: '#06b6d4', category: 'capture',   render: () => <Suspense fallback={<Loader />}><OcrTool /></Suspense> },
  { id: 'pdfocr',     name: 'PDF → Cards',  desc: 'Scan PDF into flashcards',     icon: ScanSearch,     color: '#8b5cf6', category: 'capture',   render: () => <Suspense fallback={<Loader />}><PdfUploaderTool /></Suspense> },
  { id: 'ankiimport', name: 'Anki Import',  desc: 'Import .apkg decks',           icon: Download,       color: '#f97316', category: 'capture',   render: () => <Suspense fallback={<Loader />}><AnkiImportTool /></Suspense> },
  { id: 'quizletimport',name:'Quizlet Import',desc:'Import Quizlet sets',         icon: FileText,       color: '#ec4899', category: 'capture',   render: () => <Suspense fallback={<Loader />}><QuizletImportTool /></Suspense> },
  { id: 'filetools',    name: 'File Tools',  desc: 'Merge, split, compress PDFs & images', icon: Wrench, color: '#64748b', category: 'utilities', render: () => <Suspense fallback={<Loader />}><FileToolsKit /></Suspense> },
  { id: 'notepad',    name: 'Quick Notes',  desc: 'Scratch pad with voice input', icon: PenTool,        color: '#8b5cf6', category: 'capture',   render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="notepad" /></Suspense> },
  { id: 'transcribe', name: 'Transcribe',   desc: 'Record audio → live transcript',icon: Mic,           color: '#0891b2', category: 'capture',   render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="transcribe" /></Suspense> },
  { id: 'video',      name: 'Video Studio', desc: 'Upload, record & annotate videos',icon: Film,         color: '#7c3aed', category: 'capture',   render: () => <Suspense fallback={<Loader />}><VideoTool /></Suspense> },
  { id: 'summarizer', name: 'AI Summarizer',desc: 'Paste text → key points',      icon: Sparkles,       color: '#06b6d4', category: 'capture',   render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="summarizer" /></Suspense> },
  { id: 'big-content',name: '📚 Big Content', desc: 'Convert large text or documents into a reviewed atomic card deck', icon: BookOpen, color: '#8b5cf6', category: 'capture', render: () => <Suspense fallback={<Loader />}><BigContentTool /></Suspense> },
  { id: 'screen-lasso',name: 'Screen Lasso', desc: 'Capture any screen region → OCR → Notes or relay to another device', icon: ScanSearch, color: '#06b6d4', category: 'capture', render: () => <Suspense fallback={<Loader />}><ScreenLassoTool /></Suspense> },

  // ── Analyze ───────────────────────────────────────────────────────────────
  { id: 'factcheck',  name: 'Fact Check',   desc: 'Verify claims & sources',      icon: CheckCircle,    color: '#22c55e', category: 'analyze',   render: () => <Suspense fallback={<Loader />}><FactCheckTool /></Suspense> },
  { id: 'leech-manager', name: 'Leech Manager', desc: 'Detect & fix cards you keep failing — suspend or AI rewrite', icon: AlertTriangle, color: '#ef4444', category: 'analyze', render: () => <LeechManagerWrapper /> },
  { id: 'rename',     name: 'Rename',       desc: 'Improve course/topic names',   icon: Edit3,          color: '#f59e0b', category: 'analyze',   render: () => <Suspense fallback={<Loader />}><RenameTool /></Suspense> },
  { id: 'prerequisites',name:'Prerequisites',desc:'Map concept dependencies',     icon: GitMerge,       color: '#8b5cf6', category: 'analyze',   render: () => <Suspense fallback={<Loader />}><PrerequisiteTool /></Suspense> },
  { id: 'physicssim', name: 'Physics Sim',  desc: 'Physics problem simulator',    icon: Atom,           color: '#06b6d4', category: 'analyze',   render: () => <Suspense fallback={<Loader />}><PhysicsSimTool /></Suspense> },

  // ── Utilities ─────────────────────────────────────────────────────────────
  { id: 'tts',        name: 'Text-to-Speech',desc:'Read notes & cards aloud',     icon: Volume2,        color: '#6366f1', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="tts" /></Suspense> },
  { id: 'converter',  name: 'Unit Converter',desc:'Length, mass, temp & more',    icon: Globe,          color: '#14b8a6', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="converter" /></Suspense> },
  { id: 'matrix',     name: 'Matrix Calc',  desc: 'Determinant, inverse, multiply',icon: BookOpen,      color: '#f97316', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="matrix" /></Suspense> },
  { id: 'graph',      name: 'Graph Calc',   desc: 'Plot functions — y = x² + 2x', icon: Calculator,     color: '#7c3aed', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="graph" /></Suspense> },
  { id: 'chem',       name: 'Chemistry',    desc: 'Render chemical formulas',     icon: FlaskConical,   color: '#059669', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="chem" /></Suspense> },
  { id: 'stepsolver', name: 'Step Solver',  desc: 'Progressive step reveal',      icon: Layers,         color: '#dc2626', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="solver" /></Suspense> },
  { id: 'codesandbox',name: 'Code Sandbox', desc: 'Run JavaScript in the browser',icon: Code2,          color: '#0ea5e9', category: 'utilities', render: () => <Suspense fallback={<Loader />}><ToolsPage initialView="codesandbox" /></Suspense> },
  { id: 'local-ocr',  name: 'Local OCR',   desc: 'Extract text — images, PDFs, DOCX · no upload', icon: ScanText, color: '#7c3aed', category: 'utilities', render: () => <Suspense fallback={<Loader />}><TesseractOcrTool /></Suspense> },

  // ── Specialty ─────────────────────────────────────────────────────────────
  { id: 'japanese-practicum', name: 'Japanese Practicum', desc: 'Quiz · JP Study · Mind Map', icon: Languages, color: '#F5A623', category: 'specialty', render: () => <JpPracticumWrapper /> },
  { id: 'physics-practicum',  name: 'Physics Practicum',  desc: 'Problem sets & AI grading · Mind Map', icon: Atom,  color: '#F5A623', category: 'specialty', render: () => <PhysicsPracticumWrapper /> },
  { id: 'omi',        name: 'Omi',          desc: 'Omi wearable integration',     icon: Headphones,     color: '#3b82f6', category: 'specialty', render: () => <Suspense fallback={<Loader />}><OmiTool /></Suspense> },
  { id: 'biol-practicum',      name: 'BIOL3020 Practium', desc: 'Molecular Biology — Cooper textbook, all exams', icon: Atom,      color: '#22c55e', category: 'specialty', render: () => <BiolPracticumWrapper /> },
  { id: 'evolution-practicum', name: 'Evolution Practium', desc: 'Evolution — 7-heading framework, all exams',   icon: GitBranch, color: '#a78bfa', category: 'specialty', render: () => <EvolutionPracticumWrapper /> },
];

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'learn',     label: 'Learn' },
  { id: 'generate',  label: 'Generate' },
  { id: 'capture',   label: 'Capture' },
  { id: 'analyze',   label: 'Analyze' },
  { id: 'utilities', label: 'Utilities' },
  { id: 'specialty', label: 'Specialty' },
];

function Loader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)', fontSize: 14 }}>
      Loading...
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UnifiedLearnPage() {
  const { loaded, hiddenToolIds, setHiddenToolIds, courses, data } = useStore();
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');

  const quizHistory = useMemo(() =>
    (data?.pluginData?.quizHistory || []) as { subject?: string; name?: string; score?: number }[],
    [data]
  );
  const courseAvg = useMemo(() => {
    if (!selectedCourse) return 0;
    const qs = quizHistory.filter(q => q.subject === selectedCourse || q.name === selectedCourse);
    const total = qs.reduce((s, q) => s + (q.score || 0), 0);
    return qs.length > 0 ? Math.round(total / qs.length) : 0;
  }, [quizHistory, selectedCourse]);
  const dueCount = useMemo(() => {
    const allCards = courses.flatMap(c => c.flashcards || []);
    return Math.min(allCards.length, 20);
  }, [courses]);

  // Listen for tool-switch events from wrappers (RSVPWrapper, PreTestWrapper)
  // that can't access setActiveTool directly (TOOLS array is module-level)
  useEffect(() => {
    const handler = (e: Event) => {
      const toolId = (e as CustomEvent).detail;
      if (typeof toolId === 'string') setActiveTool(toolId);
    };
    window.addEventListener('nousai-switch-tool', handler);
    return () => window.removeEventListener('nousai-switch-tool', handler);
  }, []);

  const visibleTools = useMemo(() => {
    let list = TOOLS;
    if (category !== 'all') list = list.filter(t => t.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));
    }
    if (!editMode) list = list.filter(t => !hiddenToolIds.includes(t.id));
    return list;
  }, [category, search, hiddenToolIds, editMode]);

  function toggleHidden(id: string) {
    if (hiddenToolIds.includes(id)) {
      setHiddenToolIds(hiddenToolIds.filter(x => x !== id));
    } else {
      setHiddenToolIds([...hiddenToolIds, id]);
    }
  }

  // If a tool is active, render it full-screen
  if (activeTool) {
    const tool = TOOLS.find(t => t.id === activeTool);
    if (tool) {
      return (
        <div className="animate-in">
          <button
            onClick={() => setActiveTool(null)}
            className="btn btn-sm btn-secondary mb-3"
            style={{ gap: 4 }}
          >
            ← Back
          </button>
          <ToolErrorBoundary toolName={tool.name}>
            {tool.render()}
          </ToolErrorBoundary>
        </div>
      );
    }
  }

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', color: 'var(--text-muted)' }}>
        Loading...
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 2 }}>Tools</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>Learn, generate, capture & more</p>
        </div>
        <button
          onClick={() => setEditMode(e => !e)}
          className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
          title={editMode ? 'Done customizing' : 'Customize visible tools'}
          style={{ gap: 4 }}
        >
          <Settings2 size={14} />
          {editMode ? 'Done' : 'Customize'}
        </button>
      </div>

      {/* ── Edit mode banner ── */}
      {editMode && (
        <div style={{
          background: 'var(--accent-glow)', border: '1px solid var(--accent)',
          borderRadius: 8, padding: '8px 12px', marginBottom: 12,
          fontSize: 12, color: 'var(--accent)', fontWeight: 600,
        }}>
          Tap any card to hide or show it. Hidden cards won't appear normally.
        </div>
      )}

      {/* ── Search bar ── */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={14} style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: 'var(--text-muted)', pointerEvents: 'none',
        }} />
        <input
          type="search"
          placeholder="Search tools..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', paddingLeft: 32, paddingRight: 12, paddingTop: 8, paddingBottom: 8,
            border: '1px solid var(--border)', borderRadius: 8,
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* ── Course context bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '8px 12px', marginBottom: 12,
        background: 'var(--bg-card)', border: '1px solid #333',
        borderRadius: 'var(--radius-sm)',
      }}>
        <select
          value={selectedCourse}
          onChange={e => setSelectedCourse(e.target.value)}
          style={{
            padding: '6px 10px', fontSize: 12, fontWeight: 600,
            background: 'var(--bg-input)', color: 'var(--text-primary)',
            border: '1px solid #444', borderRadius: 6,
            cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
          }}
        >
          <option value="">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.shortName || c.name}</option>
          ))}
        </select>
        {selectedCourse && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: courseAvg >= 80 ? 'rgba(34,197,94,0.15)' : courseAvg >= 50 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${courseAvg >= 80 ? 'rgba(34,197,94,0.3)' : courseAvg >= 50 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.3)'}`,
            borderRadius: 12, padding: '3px 10px',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{courseAvg}%</span>
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>avg</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <button className="btn btn-sm btn-secondary"
            onClick={() => setActiveTool('spaced')}
            style={{ fontSize: 10, padding: '4px 8px', gap: 3, border: '1px solid #444', background: 'transparent', color: '#ccc' }}>
            <Repeat size={10} /> Review {dueCount > 0 ? `(${dueCount})` : ''}
          </button>
          <button className="btn btn-sm btn-secondary"
            onClick={() => setActiveTool('exam')}
            style={{ fontSize: 10, padding: '4px 8px', gap: 3, border: '1px solid #444', background: 'transparent', color: '#ccc' }}>
            <Clock size={10} /> Quiz
          </button>
          <button className="btn btn-sm btn-secondary"
            onClick={() => { window.location.hash = '#/library'; }}
            style={{ fontSize: 10, padding: '4px 8px', gap: 3, border: '1px solid #444', background: 'transparent', color: '#ccc' }}>
            <Library size={10} /> Lib
          </button>
        </div>
      </div>

      {/* ── Category pills ── */}
      <div style={{
        display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8,
        marginBottom: 16, WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
      }}>
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: 'none',
              background: category === c.id ? 'var(--text-primary)' : 'var(--bg-card)',
              color: category === c.id ? 'var(--bg-primary)' : 'var(--text-secondary)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
              transition: 'all 0.15s',
              borderBottom: category === c.id ? 'none' : '1px solid var(--border)',
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ── Tool grid ── */}
      {visibleTools.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0', fontSize: 14 }}>
          {search ? 'No tools match your search.' : 'All tools hidden. Tap Customize to show tools.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {visibleTools.map(tool => {
            const isHidden = hiddenToolIds.includes(tool.id);
            return (
              <button
                key={tool.id}
                onClick={() => {
                  if (editMode) {
                    toggleHidden(tool.id);
                  } else {
                    setActiveTool(tool.id);
                  }
                }}
                className="card"
                style={{
                  cursor: 'pointer', textAlign: 'left', border: 'none',
                  background: 'var(--bg-secondary)', padding: 14,
                  transition: 'transform 0.15s',
                  opacity: editMode && isHidden ? 0.4 : 1,
                  position: 'relative',
                }}
              >
                {/* Edit mode overlay icon */}
                {editMode && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    color: isHidden ? 'var(--text-muted)' : 'var(--accent)',
                  }}>
                    {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </div>
                )}

                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: tool.color + '22', color: tool.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 8, flexShrink: 0,
                }}>
                  <tool.icon size={17} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3, lineHeight: 1.2 }}>
                  {tool.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {tool.desc}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
