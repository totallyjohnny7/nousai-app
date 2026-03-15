/**
 * AI Tools Page — tab shell that lazy-loads each tool component
 */
import { Suspense, useState } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ScanLine, Mic, Lightbulb, GitBranch, BookOpen,
  Edit3, CheckCircle, Atom, Headphones, Languages, MessageSquare,
  Layers, HelpCircle, GraduationCap, RefreshCw, Dumbbell, GitMerge, CalendarDays,
  AlertCircle, Download, FileText,
} from 'lucide-react';
import { useStore } from '../store';
import { isAIConfigured } from '../utils/ai';

type AITool =
  | 'ocr' | 'dictate' | 'analogy' | 'mindmap' | 'course'
  | 'rename' | 'factcheck' | 'physics' | 'aichat' | 'omi' | 'nihongo'
  | 'flashcardgen' | 'quizgen' | 'tutor' | 'reexplain' | 'practice' | 'prerequisites' | 'schedule'
  | 'ankiimport'
  | 'quizletimport';

interface ToolDef {
  id: AITool;
  icon: React.ElementType;
  label: string;
}

const TOOLS: ToolDef[] = [
  { id: 'ocr',          icon: ScanLine,      label: 'OCR' },
  { id: 'dictate',      icon: Mic,           label: 'Dictate' },
  { id: 'analogy',      icon: Lightbulb,     label: 'Analogy' },
  { id: 'mindmap',      icon: GitBranch,     label: 'Mind Map' },
  { id: 'course',       icon: BookOpen,      label: 'Course Gen' },
  { id: 'rename',       icon: Edit3,         label: 'Rename' },
  { id: 'factcheck',    icon: CheckCircle,   label: 'Fact Check' },
  { id: 'physics',      icon: Atom,          label: 'Physics Sim' },
  { id: 'aichat',       icon: MessageSquare, label: 'AI Chat' },
  { id: 'omi',          icon: Headphones,    label: 'Omi' },
  { id: 'nihongo',      icon: Languages,     label: 'JP Study' },
  { id: 'flashcardgen', icon: Layers,        label: 'Flashcards' },
  { id: 'quizgen',      icon: HelpCircle,    label: 'Quiz Gen' },
  { id: 'tutor',        icon: GraduationCap, label: 'Tutor' },
  { id: 'reexplain',    icon: RefreshCw,     label: 'Re-Explain' },
  { id: 'practice',     icon: Dumbbell,      label: 'Practice' },
  { id: 'prerequisites',icon: GitMerge,      label: 'Prerequisites' },
  { id: 'schedule',     icon: CalendarDays,  label: 'Schedule' },
  { id: 'ankiimport',    icon: Download,  label: 'Anki Import' },
  { id: 'quizletimport', icon: FileText,  label: 'Quizlet Import' },
];

const OcrTool            = lazyWithRetry(() => import('../components/aitools/OcrTool'));
const DictateTool        = lazyWithRetry(() => import('../components/aitools/DictateTool'));
const AnalogyTool        = lazyWithRetry(() => import('../components/aitools/AnalogyTool'));
const MindMapTool        = lazyWithRetry(() => import('../components/aitools/MindMapTool'));
const CourseGenTool      = lazyWithRetry(() => import('../components/aitools/CourseGenTool'));
const RenameTool         = lazyWithRetry(() => import('../components/aitools/RenameTool'));
const FactCheckTool      = lazyWithRetry(() => import('../components/aitools/FactCheckTool'));
const PhysicsSimTool     = lazyWithRetry(() => import('../components/aitools/PhysicsSimTool'));
const AIChatTool         = lazyWithRetry(() => import('../components/aitools/AIChatTool'));
const OmiTool            = lazyWithRetry(() => import('../components/aitools/OmiTool'));
const JpStudyTool        = lazyWithRetry(() => import('../components/aitools/JpStudyTool'));
const FlashcardGenTool   = lazyWithRetry(() => import('../components/aitools/FlashcardGenTool'));
const QuizGenTool        = lazyWithRetry(() => import('../components/aitools/QuizGenTool'));
const TutorTool          = lazyWithRetry(() => import('../components/aitools/TutorTool'));
const ReExplainTool      = lazyWithRetry(() => import('../components/aitools/ReExplainTool'));
const PracticeGenTool    = lazyWithRetry(() => import('../components/aitools/PracticeGenTool'));
const PrerequisiteTool   = lazyWithRetry(() => import('../components/aitools/PrerequisiteTool'));
const StudyScheduleTool  = lazyWithRetry(() => import('../components/aitools/StudyScheduleTool'));
const AnkiImportTool       = lazyWithRetry(() => import('../components/aitools/AnkiImportTool'));
const QuizletImportTool    = lazyWithRetry(() => import('../components/aitools/QuizletImportTool'));

function ToolFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: 'var(--text-muted)', fontSize: 14 }}>
      Loading...
    </div>
  );
}

export default function AIToolsPage() {
  const { loaded } = useStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toolParam = searchParams.get('tool');
  const [activeTool, setActiveTool] = useState<AITool>(
    toolParam && TOOLS.some(t => t.id === toolParam) ? toolParam as AITool : 'ocr'
  );

  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: '#888', fontWeight: 600 }}>Loading AI tools...</div>
      </div>
    );
  }

  const aiReady = isAIConfigured();

  return (
    <div className="animate-in">
      <h1 className="page-title">AI Tools</h1>
      <p className="page-subtitle">AI-powered study utilities</p>

      {!aiReady && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10, marginBottom: 16,
          background: 'rgba(245, 166, 35, 0.1)', border: '1px solid rgba(245, 166, 35, 0.35)',
          color: 'var(--text-secondary)', fontSize: 13,
        }}>
          <AlertCircle size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span>
            AI provider not configured — tools that require AI will not work.{' '}
            <button
              onClick={() => navigate('/settings', { state: { section: 'ai' } })}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--accent)', fontWeight: 600, cursor: 'pointer',
                textDecoration: 'underline', fontSize: 'inherit', fontFamily: 'inherit',
              }}
            >
              Configure AI →
            </button>
          </span>
        </div>
      )}

      {/* Sub-tab chips — horizontal scrollable */}
      <div style={{
        display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8,
        marginBottom: 16, scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border) transparent',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TOOLS.map(t => {
          const active = t.id === activeTool;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTool(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 20,
                border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: active ? 'var(--accent-glow)' : 'var(--bg-card)',
                color: active ? 'var(--accent-light)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tool content */}
      <Suspense fallback={<ToolFallback />}>
        <div key={activeTool}>
          {activeTool === 'ocr'           && <OcrTool />}
          {activeTool === 'dictate'       && <DictateTool />}
          {activeTool === 'analogy'       && <AnalogyTool />}
          {activeTool === 'mindmap'       && <MindMapTool />}
          {activeTool === 'course'        && <CourseGenTool />}
          {activeTool === 'rename'        && <RenameTool />}
          {activeTool === 'factcheck'     && <FactCheckTool />}
          {activeTool === 'physics'       && <PhysicsSimTool />}
          {activeTool === 'aichat'        && <AIChatTool />}
          {activeTool === 'omi'           && <OmiTool />}
          {activeTool === 'nihongo'       && <JpStudyTool />}
          {activeTool === 'flashcardgen'  && <FlashcardGenTool />}
          {activeTool === 'quizgen'       && <QuizGenTool />}
          {activeTool === 'tutor'         && <TutorTool />}
          {activeTool === 'reexplain'     && <ReExplainTool />}
          {activeTool === 'practice'      && <PracticeGenTool />}
          {activeTool === 'prerequisites' && <PrerequisiteTool />}
          {activeTool === 'schedule'      && <StudyScheduleTool />}
          {activeTool === 'ankiimport'      && <AnkiImportTool />}
          {activeTool === 'quizletimport'   && <QuizletImportTool />}
        </div>
      </Suspense>
    </div>
  );
}
