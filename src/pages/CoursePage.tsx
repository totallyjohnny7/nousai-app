/**
 * CoursePage — Per-course detail view with sidebar navigation
 * 17 sub-tabs for comprehensive course management
 */
import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, LayoutDashboard, BookOpen, Map, BarChart3, FileText,
  GraduationCap, Zap, MessageCircle, Trophy, Brain, ChevronRight, ChevronLeft,
  ChevronDown, ChevronUp, Lock, Unlock, CheckCircle2, Circle, Check,
  Plus, Search, Download, Upload, X, Edit3, Trash2, Play,
  SkipForward, RotateCcw, Clock, Target, TrendingUp, AlertTriangle,
  Star, Send, Copy, Filter, Calendar, Flame, Award, Layers,
  Eye, EyeOff, Shuffle, Volume2, Maximize, Code,
  Home, GitBranch, ScanLine, Sparkles, FolderOpen, Folder, FolderPlus, Tag, LayoutGrid,
  ClipboardList, BarChart2, ScrollText, Link, Microscope, Languages, LayoutList, RefreshCw,
  PanelRight, PanelBottom, XCircle, Camera
} from 'lucide-react';
import { useStore } from '../store';
import { calculateProficiency, isProficient } from '../utils/proficiency';
import { callAI, isAIConfigured } from '../utils/ai';
import { speak, stopSpeaking } from '../utils/speechTools';
import type { Course, CourseTopic, FlashcardItem, QuizAttempt, ProficiencyEntry, Note, NousAIData, LinkItem } from '../types';
import { getTextbookChapters } from '../data/textbookChapters';
import { getStudyContent, hasStudyContent } from '../data/studyContentIndex';
import { getLecturesForCourse, getLecturesForChapter, hasLectureContent, type LectureItem } from '../data/lectureContent';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { saveFile, loadFile, deleteFile, migrateFromLocalStorage } from '../utils/fileStore';
const RichTextEditor = lazyWithRetry(() => import('../components/RichTextEditor'));
const markdownToHtml = (md: string): string => {
  if (!md || md.startsWith('<')) return md;
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');
};
import { escapeHtml, sanitizeHtml } from '../utils/sanitize';
import { useImageOCR } from '../hooks/useImageOCR';

/** Safe array helper — returns [] if value is null/undefined/non-array object (e.g. Firestore deserialization edge case) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeArr = <T,>(val: any): T[] => Array.isArray(val) ? (val as T[]) : [];
import ImageInputBar from '../components/ImageInputBar';
import JapaneseMode from '../components/JapaneseMode';
import VocabTab from '../components/course/VocabTab';
import PathTab from '../components/course/PathTab';
import LecturesTab from '../components/course/LecturesTab';
import TutorTab from '../components/course/TutorTab';
import VisualLabTab from '../components/course/VisualLabTab';
import { FileViewerModal } from '../components/FileViewerModal'

/* ================================================================
   TYPES
   ================================================================ */
type SubTab = 'home' | 'chapters' | 'notes' | 'quizzes' | 'matches' | 'mindmaps' | 'ocr' | 'ai-outputs' | 'files' | 'modules' | 'assignments' | 'grades' | 'syllabus' | 'links' | 'lab' | 'tutor' | 'vocab' | 'stats' | 'lectures' | 'cram' | 'japanese';

interface VocabItem {
  term: string;
  definition: string;
  mastered?: boolean;
}

interface LectureAttachment {
  id: string;
  name: string;
  type: 'pptx' | 'pdf' | 'image' | 'other';
  dataUrl: string;
  size: number;
}

interface LectureNote {
  id: string;
  title: string;
  content: string;
  topicIds?: string[];
  createdAt: string;
  updatedAt: string;
  attachments?: LectureAttachment[];
  linkedLabId?: string;
}

interface TutorMessage {
  id: string;
  role: 'user' | 'tutor';
  content: string;
  timestamp: string;
}

/* ================================================================
   HELPERS
   ================================================================ */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** JP Color legend bar — shows when content has <mark> tags */
function JpColorLegend({ content }: { content: string }) {
  if (!content || !content.includes('<mark ')) return null;
  const colors = [
    { label: 'Verb', color: '#be123c' }, { label: 'Particle', color: '#1e3a8a' },
    { label: 'Place', color: '#14532d' }, { label: 'Time', color: '#78350f' },
    { label: 'Noun', color: '#581c87' }, { label: 'Adj', color: '#7c2d12' },
    { label: 'Adverb', color: '#831843' }, { label: 'Greeting', color: '#134e4a' },
    { label: 'Other', color: '#374151' },
  ];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', padding: '6px 10px', marginTop: 8,
      borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', alignItems: 'center' }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginRight: 2 }}>🎨 Color Key:</span>
      {colors.map(c => (
        <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.15)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
        </span>
      ))}
    </div>
  );
}

/** Simple markdown-ish rendering: headers, bold, italic, lists, code */
function renderSimpleMarkdown(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Headers
      if (line.startsWith('### ')) return `<h4 style="font-size:14px;font-weight:700;margin:8px 0 4px">${inlineFormat(line.slice(4))}</h4>`;
      if (line.startsWith('## ')) return `<h3 style="font-size:16px;font-weight:700;margin:10px 0 4px">${inlineFormat(line.slice(3))}</h3>`;
      if (line.startsWith('# ')) return `<h2 style="font-size:18px;font-weight:800;margin:12px 0 6px">${inlineFormat(line.slice(2))}</h2>`;
      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.slice(2);
        return `<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--text-muted)">&#8226;</span><span>${inlineFormat(content)}</span></div>`;
      }
      // Ordered list
      const olMatch = line.match(/^(\d+)\.\s(.+)/);
      if (olMatch) {
        return `<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--text-muted)">${olMatch[1]}.</span><span>${inlineFormat(olMatch[2])}</span></div>`;
      }
      // Empty line
      if (line.trim() === '') return '<div style="height:8px"></div>';
      // Regular paragraph
      return `<p style="margin:2px 0;line-height:1.6">${inlineFormat(line)}</p>`;
    })
    .join('');
}

function inlineFormat(text: string): string {
  // 1. Extract LaTeX math before escaping (to preserve $ delimiters)
  const mathParts: string[] = [];
  let processed = text.replace(/\$([^\$\n]+?)\$/g, (_: string, tex: string) => {
    const placeholder = `\x00MATH${mathParts.length}\x00`;
    try { mathParts.push(katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })); }
    catch { mathParts.push(escapeHtml(tex)); }
    return placeholder;
  });
  // 2. Escape HTML, apply markdown formatting
  processed = escapeHtml(processed)
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);padding:1px 4px;border-radius:3px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 3. Restore LaTeX placeholders
  mathParts.forEach((rendered, i) => {
    processed = processed.replace(escapeHtml(`\x00MATH${i}\x00`), rendered);
  });
  return processed;
}

/* ================================================================
   SUB-TAB DEFINITIONS
   ================================================================ */
const SUB_TABS: { key: SubTab; label: string; icon: React.ComponentType<{ size?: number }>; countKey?: string }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'chapters', label: 'Chapters', icon: GitBranch, countKey: 'chapters' },
  { key: 'notes', label: 'Notes', icon: FileText, countKey: 'notes' },
  { key: 'quizzes', label: 'Quizzes', icon: Trophy, countKey: 'quizzes' },
  { key: 'matches', label: 'Matches', icon: Layers, countKey: 'matches' },
  { key: 'mindmaps', label: 'Mind Maps', icon: GitBranch },
  { key: 'ocr', label: 'OCR Scans', icon: ScanLine },
  { key: 'ai-outputs', label: 'AI Outputs', icon: Sparkles, countKey: 'aiOutputs' },
  { key: 'files', label: 'All Files', icon: FolderOpen, countKey: 'files' },
  { key: 'modules', label: 'Modules', icon: LayoutGrid },
  { key: 'assignments', label: 'Assignments', icon: ClipboardList },
  { key: 'grades', label: 'Grades', icon: BarChart2 },
  { key: 'syllabus', label: 'Syllabus', icon: ScrollText },
  { key: 'links', label: 'Links & Files', icon: Link },
  { key: 'lab', label: 'Visual Lab', icon: Microscope },
  { key: 'tutor', label: 'Tutor', icon: MessageCircle },
  { key: 'vocab', label: 'Vocab', icon: Languages },
  { key: 'stats', label: 'Stats', icon: BarChart3 },
  { key: 'lectures', label: 'Lectures', icon: GraduationCap },
  { key: 'cram', label: 'Cram', icon: Zap },
];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function CoursePage() {
  const [params] = useSearchParams();
  const courseId = params.get('id');
  const navigate = useNavigate();
  const { data, setData, updatePluginData, courses, quizHistory, proficiency, gamification } = useStore();

  const [activeTab, setActiveTab] = useState<SubTab>('home');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const course = useMemo(() => courses.find(c => c.id === courseId), [courses, courseId]);

  // Course-specific quiz history
  const courseQuizzes = useMemo(() => {
    if (!course) return [];
    return quizHistory
      .filter(q => q.subject === course.name || q.subject === course.shortName || q.subject === course.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [quizHistory, course]);

  // Course-specific proficiency data
  const courseProficiency = useMemo(() => {
    if (!course || !proficiency?.subjects) return null;
    return proficiency.subjects[course.name] || proficiency.subjects[course.shortName] || proficiency.subjects[course.id] || null;
  }, [proficiency, course]);

  // Topic proficiency lookup
  const getTopicProficiency = useCallback((topicName: string): number => {
    if (!courseProficiency) return 0;
    const entry = courseProficiency[topicName];
    if (!entry) return 0;
    const attempts = entry.attempts?.map((a: { percentage: number }) => a.percentage) || (entry as unknown as { attempts: number[] }).attempts || [];
    if (Array.isArray(attempts) && attempts.length > 0 && typeof attempts[0] === 'number') {
      return calculateProficiency(attempts as unknown as number[]);
    }
    if (Array.isArray(attempts) && attempts.length > 0 && typeof attempts[0] === 'object') {
      return calculateProficiency((attempts as unknown as { percentage: number }[]).map(a => a.percentage));
    }
    return Math.max(0, (entry as unknown as ProficiencyEntry).proficiencyScore || 0);
  }, [courseProficiency]);

  // Overall course mastery
  const courseMastery = useMemo(() => {
    if (!course || safeArr<CourseTopic>(course.topics).length === 0) return 0;
    const scores = safeArr<CourseTopic>(course.topics).map(t => getTopicProficiency(t.name));
    const hasAnyData = scores.some(s => s > 0);
    if (!hasAnyData) {
      // No proficiency data at all — fall back to quiz average (exclude untaken quizzes)
      const taken = courseQuizzes.filter(q => q.score >= 0);
      if (taken.length === 0) return 0;
      return Math.max(0, Math.round(taken.reduce((s, q) => s + q.score, 0) / taken.length));
    }
    // Include ALL topics (including 0% ones) to prevent inflated mastery
    return Math.max(0, Math.round(scores.reduce((s, v) => s + v, 0) / scores.length));
  }, [course, getTopicProficiency, courseQuizzes]);

  const accentColor = course?.color || '#888888';

  // Count badges for sidebar — must be before early return to keep hook order stable
  const sidebarCounts: Record<string, number> = useMemo(() => {
    if (!course) return { chapters: 0, notes: 0, quizzes: 0, matches: 0, aiOutputs: 0, files: 0 };
    const notesCount = (() => { try { const s = localStorage.getItem(`nousai-lectures-${course.id}`); return s ? JSON.parse(s).length : 0; } catch { return 0; } })();
    const matchesCount = (() => { try { const s = localStorage.getItem(`nousai-course-${course.id}-matches`); return s ? JSON.parse(s).length : 0; } catch { return 0; } })();
    const aiOutputsCount = (() => { try { const s = localStorage.getItem(`nousai-course-${course.id}-ai-outputs`); return s ? JSON.parse(s).length : 0; } catch { return 0; } })();
    return {
      chapters: safeArr<CourseTopic>(course.topics).length,
      notes: notesCount,
      quizzes: courseQuizzes.length,
      matches: matchesCount,
      aiOutputs: aiOutputsCount,
      files: safeArr<CourseTopic>(course.topics).length + safeArr<FlashcardItem>(course.flashcards).length + courseQuizzes.length + notesCount,
    };
  }, [course, courseQuizzes]);

  // Dynamic tabs: add Japanese tab only for JAPN courses
  const visibleTabs = useMemo(() => {
    const isJapanese = course?.shortName?.toUpperCase().startsWith('JAPN') ||
      course?.name?.toLowerCase().includes('japanese');
    if (isJapanese) {
      const base = SUB_TABS.filter(t => t.key !== 'quizzes');
      const tutorIdx = base.findIndex(t => t.key === 'tutor');
      const copy = [...base];
      copy.splice(tutorIdx + 1, 0,
        { key: 'japanese' as SubTab, label: 'Japanese', icon: Languages },
      );
      return copy;
    }
    return SUB_TABS;
  }, [course]);

  if (!course) {
    return (
      <div className="animate-in" style={{ padding: 24 }}>
        <button
          onClick={() => navigate('/library')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
            fontWeight: 600, padding: 0, marginBottom: 24,
          }}
        >
          <ArrowLeft size={16} /> Back to Library
        </button>
        <div className="empty-state">
          <AlertTriangle size={40} />
          <h3>Course not found</h3>
          <p>The course you are looking for does not exist or has been removed.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/library')}>
            Go to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Breadcrumb (beta) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: 'var(--text-muted)' }}>
          <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
            <Home size={11} /> Dashboard
          </button>
          <ChevronRight size={10} />
          <button onClick={() => navigate('/library')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11, padding: 0 }}>
            Library
          </button>
          <ChevronRight size={10} />
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{course.name}</span>
        </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            cursor: 'pointer', color: 'var(--text-muted)',
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%', background: accentColor,
              boxShadow: `0 0 8px ${accentColor}40`,
            }} />
            <h1 className="page-title" style={{ marginBottom: 0 }}>{course.name}</h1>
          </div>
          <p className="page-subtitle" style={{ marginBottom: 0, marginTop: 2 }}>{course.shortName}</p>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900, color: accentColor,
        }}>
          {courseMastery}%
        </div>
      </div>

      {/* Mobile: horizontal scrolling chips */}
      {isMobile && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto',
          paddingBottom: 4, WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent',
        }}>
          {visibleTabs.map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            const count = t.countKey ? sidebarCounts[t.countKey] : undefined;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '7px 12px', borderRadius: 'var(--radius-sm)',
                  border: isActive ? `1px solid ${accentColor}60` : '1px solid var(--border)',
                  background: isActive ? `${accentColor}12` : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
                  transition: 'all 0.15s', flexShrink: 0,
                }}
              >
                <Icon size={13} /> {t.label}
                {count !== undefined && count > 0 && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)', borderRadius: 8,
                    padding: '1px 5px', marginLeft: 2, color: 'var(--text-muted)',
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Desktop: sidebar + content layout */}
      <div style={{ display: 'flex', gap: isMobile ? 0 : 16 }}>
        {/* Vertical sidebar (desktop only) */}
        {!isMobile && (
          <div style={{
            width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1,
            background: 'var(--bg-card)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', padding: '6px 0',
            alignSelf: 'flex-start', position: 'sticky', top: 16,
            maxHeight: 'calc(100vh - 120px)', overflowY: 'auto',
            msOverflowStyle: 'none', scrollbarWidth: 'thin',
          }}>
            {visibleTabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.key;
              const count = t.countKey ? sidebarCounts[t.countKey] : undefined;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', margin: '0 4px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                    background: isActive ? 'var(--bg-secondary)' : 'transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontSize: 12, fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', fontFamily: 'inherit',
                    whiteSpace: 'nowrap' as const, transition: 'all 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <Icon size={14} />
                  <span style={{ flex: 1 }}>{t.label}</span>
                  {count !== undefined && count > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: isActive ? `${accentColor}20` : 'var(--bg-secondary)',
                      color: isActive ? accentColor : 'var(--text-dim)',
                      borderRadius: 8, padding: '1px 6px', minWidth: 18,
                      textAlign: 'center',
                    }}>{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'home' && (
            <DashboardTab
              course={course}
              courseQuizzes={courseQuizzes}
              courseMastery={courseMastery}
              getTopicProficiency={getTopicProficiency}
              accentColor={accentColor}
              navigate={navigate}
              setActiveTab={setActiveTab}
            />
          )}
          {activeTab === 'vocab' && (
            <VocabTab course={course} data={data} setData={setData} accentColor={accentColor} />
          )}
          {activeTab === 'chapters' && (
            <PathTab course={course} data={data} setData={setData} updatePluginData={updatePluginData} getTopicProficiency={getTopicProficiency} accentColor={accentColor} />
          )}
          {activeTab === 'stats' && (
            <StatsTab
              course={course}
              courseQuizzes={courseQuizzes}
              courseMastery={courseMastery}
              getTopicProficiency={getTopicProficiency}
              gamification={gamification}
              accentColor={accentColor}
            />
          )}
          {activeTab === 'quizzes' && (
            <ExamsTab courseQuizzes={courseQuizzes} navigate={navigate} accentColor={accentColor} courseId={course.id} />
          )}
          {activeTab === 'lectures' && (
            <LecturesTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'cram' && (
            <CramTab
              course={course}
              getTopicProficiency={getTopicProficiency}
              courseQuizzes={courseQuizzes}
              accentColor={accentColor}
              navigate={navigate}
            />
          )}
          {activeTab === 'tutor' && (
            <TutorTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'notes' && (
            <CourseNotesTab course={course} accentColor={accentColor} setActiveTab={setActiveTab} />
          )}
          {activeTab === 'matches' && (
            <MatchesTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'mindmaps' && (
            <MindMapsTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'ocr' && (
            <OcrTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'ai-outputs' && (
            <AiOutputsTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'files' && (
            <AllFilesTab course={course} courseQuizzes={courseQuizzes} accentColor={accentColor} />
          )}
          {activeTab === 'modules' && (
            <ModulesTab course={course} data={data} setData={setData} getTopicProficiency={getTopicProficiency} accentColor={accentColor} />
          )}
          {activeTab === 'assignments' && (
            <AssignmentsTab course={course} accentColor={accentColor} canvasUrl={data?.settings?.canvasUrl as string | undefined} canvasToken={data?.settings?.canvasToken as string | undefined} />
          )}
          {activeTab === 'grades' && (
            <GradesTab course={course} accentColor={accentColor} canvasUrl={data?.settings?.canvasUrl as string | undefined} canvasToken={data?.settings?.canvasToken as string | undefined} />
          )}
          {activeTab === 'syllabus' && (
            <SyllabusTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'links' && (
            <LinksTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'lab' && (
            <VisualLabTab course={course} accentColor={accentColor} />
          )}
          {activeTab === 'japanese' && (
            <JapaneseMode />
          )}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   1. DASHBOARD TAB
   ================================================================ */
const DashboardTab = React.memo(function DashboardTab({
  course, courseQuizzes, courseMastery, getTopicProficiency, accentColor, navigate, setActiveTab,
}: {
  course: Course;
  courseQuizzes: QuizAttempt[];
  courseMastery: number;
  getTopicProficiency: (name: string) => number;
  accentColor: string;
  navigate: (path: string) => void;
  setActiveTab: (tab: SubTab) => void;
}) {
  return (
    <div>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: accentColor }}>{safeArr<CourseTopic>(course.topics).length}</div>
          <div className="stat-label">Topics</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--blue)' }}>{safeArr<FlashcardItem>(course.flashcards).length}</div>
          <div className="stat-label">Cards</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{courseQuizzes.length}</div>
          <div className="stat-label">Quizzes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: courseMastery >= 80 ? 'var(--green)' : courseMastery >= 50 ? 'var(--yellow)' : 'var(--red)' }}>
            {courseMastery}%
          </div>
          <div className="stat-label">Mastery</div>
        </div>
      </div>

      {/* Topic progress tree */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Map size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Topic Progress</span>
          <span className="badge" style={{ borderColor: `${accentColor}50`, color: accentColor }}>
            {safeArr<CourseTopic>(course.topics).filter(t => getTopicProficiency(t.name) >= 80).length}/{safeArr<CourseTopic>(course.topics).length} mastered
          </span>
        </div>
        {safeArr<CourseTopic>(course.topics).length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No topics defined for this course yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {safeArr<CourseTopic>(course.topics).map(topic => {
              const prof = getTopicProficiency(topic.name);
              const status = topic.status || (prof >= 80 ? 'mastered' : prof > 0 ? 'learning' : 'not_started');
              const statusColor = status === 'mastered' ? 'var(--green)' : status === 'learning' ? 'var(--yellow)' : 'var(--text-dim)';
              const StatusIcon = status === 'mastered' ? CheckCircle2 : status === 'learning' ? Clock : Circle;
              return (
                <div key={topic.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}>
                  <StatusIcon size={16} style={{ color: statusColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {topic.name}
                    </div>
                    <div className="progress-bar" style={{ marginTop: 4 }}>
                      <div className="progress-fill" style={{ width: `${prof}%`, background: statusColor }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, flexShrink: 0 }}>
                    {prof}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent quiz activity */}
      {courseQuizzes.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title"><Trophy size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Recent Quizzes</span>
          </div>
          {courseQuizzes.slice(0, 5).map(q => {
            const isUntaken = q.score < 0;
            const scoreColor = isUntaken ? 'var(--text-muted)' : q.score >= 90 ? 'var(--green)' : q.score >= 70 ? 'var(--yellow)' : 'var(--red)';
            return (
              <div key={q.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: '1px solid var(--border)',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{q.name || q.subtopic || 'Quiz'}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatDateShort(q.date)} &middot; {q.questionCount} questions
                  </div>
                </div>
                <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor }}>{isUntaken ? 'Bank' : `${q.score}%`}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Quiz', icon: Trophy, color: accentColor, action: () => navigate('/quiz') },
          { label: 'Cards', icon: Brain, color: 'var(--blue)', action: () => setActiveTab('vocab') },
          { label: 'Vocab', icon: BookOpen, color: 'var(--green)', action: () => setActiveTab('vocab') },
          { label: 'Tutor', icon: MessageCircle, color: 'var(--yellow)', action: () => setActiveTab('tutor') },
        ].map(item => (
          <button key={item.label} className="card" onClick={item.action} style={{
            textAlign: 'center', padding: 14, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: '1px solid var(--border)',
          }}>
            <item.icon size={20} style={{ color: item.color }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {item.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

/* ================================================================
   4. STATISTICS TAB
   ================================================================ */
const StatsTab = React.memo(function StatsTab({
  course, courseQuizzes, courseMastery, getTopicProficiency, gamification, accentColor,
}: {
  course: Course;
  courseQuizzes: QuizAttempt[];
  courseMastery: number;
  getTopicProficiency: (name: string) => number;
  gamification: import('../types').GamificationData;
  accentColor: string;
}) {
  // Mastery over time from quiz scores (exclude untaken)
  const masteryOverTime = useMemo(() => {
    const sorted = [...courseQuizzes].filter(q => q.score >= 0).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let running = 0;
    return sorted.map((q, i) => {
      running = Math.round((running * i + q.score) / (i + 1));
      return { date: q.date, score: q.score, cumulative: running };
    });
  }, [courseQuizzes]);

  // Topic proficiencies sorted (with subtopics)
  const topicStats = useMemo(() => {
    return safeArr<CourseTopic>(course.topics).map(t => ({
      name: t.name,
      id: t.id,
      proficiency: getTopicProficiency(t.name),
      subtopics: (t.subtopics || []).map(st => ({
        name: st.name,
        id: st.id,
        proficiency: getTopicProficiency(st.name),
      })),
    })).sort((a, b) => b.proficiency - a.proficiency);
  }, [safeArr<CourseTopic>(course.topics), getTopicProficiency]);

  const [expandedStatsTopic, setExpandedStatsTopic] = useState<string | null>(null);

  // Flatten for strongest/weakest including subtopics
  const allTopicAndSubtopicStats = useMemo(() => {
    const flat: { name: string; proficiency: number; parent?: string }[] = [];
    topicStats.forEach(t => {
      flat.push({ name: t.name, proficiency: t.proficiency });
      t.subtopics.forEach(st => flat.push({ name: st.name, proficiency: st.proficiency, parent: t.name }));
    });
    return flat.filter(t => t.proficiency > 0).sort((a, b) => b.proficiency - a.proficiency);
  }, [topicStats]);

  const strongest = allTopicAndSubtopicStats.slice(0, 3);
  const weakest = [...allTopicAndSubtopicStats].reverse().slice(0, 3);

  // Quiz count by week
  const quizCountByWeek = useMemo(() => {
    const weeks: Record<string, number> = {};
    courseQuizzes.forEach(q => {
      const d = new Date(q.date);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().split('T')[0];
      weeks[key] = (weeks[key] || 0) + 1;
    });
    return Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
  }, [courseQuizzes]);

  // Chart bar rendering
  const maxQuizWeek = Math.max(...quizCountByWeek.map(w => w[1]), 1);

  return (
    <div>
      {/* Mastery overview */}
      <div className="card mb-4" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 8 }}>
          Overall Mastery
        </div>
        <div style={{
          fontSize: 48, fontWeight: 900, color: accentColor, lineHeight: 1,
        }}>
          {courseMastery}%
        </div>
        <div className="progress-bar" style={{ marginTop: 12, height: 6 }}>
          <div className="progress-fill" style={{ width: `${courseMastery}%`, background: accentColor }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 16, fontSize: 12 }}>
          <div>
            <div style={{ fontWeight: 700 }}>{courseQuizzes.length}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Quizzes</div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>
              {(() => { const taken = courseQuizzes.filter(q => q.score >= 0); return taken.length > 0 ? Math.round(taken.reduce((s, q) => s + q.score, 0) / taken.length) : 0 })()}%
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Avg Score</div>
          </div>
          <div>
            <div style={{ fontWeight: 700 }}>
              {courseQuizzes.reduce((s, q) => s + q.correct, 0)}/{courseQuizzes.reduce((s, q) => s + q.questionCount, 0)}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Correct</div>
          </div>
        </div>
      </div>

      {/* Quiz score history mini chart */}
      {masteryOverTime.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title"><TrendingUp size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Score History</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 3, height: 100, padding: '8px 0',
          }}>
            {masteryOverTime.slice(-20).map((item, i) => {
              const barColor = item.score >= 90 ? 'var(--green)' : item.score >= 70 ? 'var(--yellow)' : 'var(--red)';
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    width: '100%', maxWidth: 24, height: `${item.score}%`,
                    background: barColor, borderRadius: '2px 2px 0 0', minHeight: 2,
                    transition: 'height 0.3s',
                  }} title={`${item.score}% - ${formatDate(item.date)}`} />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
            <span>Oldest</span>
            <span>Most Recent</span>
          </div>
        </div>
      )}

      {/* Weekly activity chart */}
      {quizCountByWeek.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title"><Calendar size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Weekly Activity</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, padding: '8px 0' }}>
            {quizCountByWeek.map(([week, count]) => (
              <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{count}</span>
                <div style={{
                  width: '100%', maxWidth: 28, height: `${(count / maxQuizWeek) * 60}px`,
                  background: accentColor, borderRadius: '2px 2px 0 0', minHeight: 4,
                }} />
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                  {new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topic proficiency */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Target size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Topic Proficiency</span>
        </div>
        {topicStats.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No topics with proficiency data yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topicStats.map(t => {
              const color = t.proficiency >= 80 ? 'var(--green)' : t.proficiency >= 50 ? 'var(--yellow)' : t.proficiency > 0 ? 'var(--red)' : 'var(--text-dim)';
              const isExpanded = expandedStatsTopic === t.id;
              const hasSubs = (t.subtopics?.length ?? 0) > 0;
              return (
                <div key={t.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3, cursor: hasSubs ? 'pointer' : 'default' }}
                    onClick={() => hasSubs && setExpandedStatsTopic(isExpanded ? null : t.id)}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {hasSubs && (isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />)}
                      {t.name}
                      {hasSubs && <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({t.subtopics?.length ?? 0})</span>}
                    </span>
                    <span style={{ fontWeight: 700, color, flexShrink: 0 }}>{t.proficiency}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${t.proficiency}%`, background: color }} />
                  </div>
                  {/* Subtopic breakdown */}
                  {isExpanded && t.subtopics.map(st => {
                    const stColor = st.proficiency >= 80 ? 'var(--green)' : st.proficiency >= 50 ? 'var(--yellow)' : st.proficiency > 0 ? 'var(--red)' : 'var(--text-dim)';
                    return (
                      <div key={st.name} style={{ paddingLeft: 16, marginTop: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                          <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                          <span style={{ fontWeight: 700, color: stColor, flexShrink: 0 }}>{st.proficiency}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 3 }}>
                          <div className="progress-fill" style={{ width: `${st.proficiency}%`, background: stColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Strongest & Weakest */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <Star size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--green)' }} />Strongest
          </div>
          {strongest.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No data yet</div>
          ) : (
            strongest.map(t => (
              <div key={t.name} style={{ fontSize: 12, padding: '3px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)', flexShrink: 0, marginLeft: 8 }}>{t.proficiency}%</span>
                </div>
                {t.parent && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.parent}</div>}
              </div>
            ))
          )}
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--red)' }} />Weakest
          </div>
          {weakest.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No data yet</div>
          ) : (
            weakest.map(t => (
              <div key={t.name} style={{ fontSize: 12, padding: '3px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{t.name}</span>
                  <span style={{ fontWeight: 700, color: 'var(--red)', flexShrink: 0, marginLeft: 8 }}>{t.proficiency}%</span>
                </div>
                {t.parent && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{t.parent}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Study streak */}
      <div className="card">
        <div className="card-header">
          <span className="card-title"><Flame size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Study Streak</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--orange)' }}>{gamification.streak}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Day Streak</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {gamification.lastStudyDate ? `Last studied: ${formatDate(gamification.lastStudyDate)}` : 'No study sessions yet'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

/* ================================================================
   5. PAST EXAMS TAB
   ================================================================ */
// Shared folder helpers for CoursePage ExamsTab
const EXAM_FOLDER_COLORS = ['#7c5cfc', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'];
interface ExamFolder { id: string; name: string; color: string }
function loadExamFolders(): ExamFolder[] { try { const r = localStorage.getItem('nousai-quiz-folders'); return r ? JSON.parse(r) : [] } catch { return [] } }
function saveExamFolders(f: ExamFolder[]) { localStorage.setItem('nousai-quiz-folders', JSON.stringify(f)) }
function loadExamFolderMap(): Record<string, string> { try { const r = localStorage.getItem('nousai-quiz-folder-map'); return r ? JSON.parse(r) : {} } catch { return {} } }
function saveExamFolderMap(m: Record<string, string>) { localStorage.setItem('nousai-quiz-folder-map', JSON.stringify(m)) }

const ExamsTab = React.memo(function ExamsTab({
  courseQuizzes, navigate, accentColor, courseId,
}: {
  courseQuizzes: QuizAttempt[];
  navigate: (path: string) => void;
  accentColor: string;
  courseId: string;
}) {
  const { data, setData, updatePluginData } = useStore()
  const nav = useNavigate()
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'mid' | 'low' | 'untaken'>('all');
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  // Folder state
  const [folders, setFolders] = useState<ExamFolder[]>(loadExamFolders);
  const [folderMap, setFolderMap] = useState<Record<string, string>>(loadExamFolderMap);
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // Management state
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  function createFolder(name: string) {
    if (!name.trim()) return
    const f: ExamFolder = { id: `folder-${Date.now()}`, name: name.trim(), color: EXAM_FOLDER_COLORS[folders.length % EXAM_FOLDER_COLORS.length] }
    const next = [...folders, f]; setFolders(next); saveExamFolders(next); setNewFolderName('')
  }
  function deleteFolder(id: string) {
    const next = folders.filter(f => f.id !== id); setFolders(next); saveExamFolders(next)
    const nm = { ...folderMap }; for (const [k, v] of Object.entries(nm)) { if (v === id) delete nm[k] }
    setFolderMap(nm); saveExamFolderMap(nm); if (filterFolder === id) setFilterFolder('all')
  }
  function assignToFolder(quizId: string, folderId: string | null) {
    const nm = { ...folderMap }; if (folderId) nm[quizId] = folderId; else delete nm[quizId]
    setFolderMap(nm); saveExamFolderMap(nm); setAssigningId(null)
  }
  function deleteQuiz(quizId: string) {
    if (!data) return
    updatePluginData({ quizHistory: safeArr<QuizAttempt>(data.pluginData.quizHistory).filter(q => q.id !== quizId) })
    // Also clean up folder map
    const nm = { ...folderMap }; delete nm[quizId]; setFolderMap(nm); saveExamFolderMap(nm)
    setMenuOpenId(null)
  }
  function renameQuiz(quizId: string, newName: string) {
    if (!data || !newName.trim()) return
    updatePluginData({ quizHistory: safeArr<QuizAttempt>(data.pluginData.quizHistory).map(q => q.id === quizId ? { ...q, name: newName.trim() } : q) })
    setRenamingId(null)
  }

  function addToJpQuiz(quiz: QuizAttempt) {
    const storageKey = `nousai-jpquiz-${courseId}`
    let jpData: { questions: { id: string; questionText: string; expectedAnswer: string; acceptableAnswers: string[]; answerType: string; difficulty: number; tags: string[]; hint: string; explanation: string; createdAt: string }[]; sessionHistory: unknown[]; version: number }
    try {
      const raw = localStorage.getItem(storageKey)
      jpData = raw ? JSON.parse(raw) : { questions: [], sessionHistory: [], version: 1 }
    } catch {
      jpData = { questions: [], sessionHistory: [], version: 1 }
    }
    const MAX_JP = 50
    let added = 0
    const qs = (quiz.questions as { question?: string; q?: string; answer?: string; correctAnswer?: string; options?: string[]; type?: string; explanation?: string }[])
    for (const q of qs) {
      if (jpData.questions.length >= MAX_JP) break
      const qText = q?.question || q?.q || ''
      const ans = q?.correctAnswer || q?.answer || ''
      if (!qText || !ans) continue
      jpData.questions.push({
        id: `jpq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        questionText: qText,
        expectedAnswer: ans,
        acceptableAnswers: [],
        answerType: 'typed',
        difficulty: 3,
        tags: [],
        hint: q?.explanation ? `Hint: ${q.explanation}` : '',
        explanation: q?.explanation || '',
        createdAt: new Date().toISOString(),
      })
      added++
    }
    localStorage.setItem(storageKey, JSON.stringify(jpData))
    alert(`Added ${added} question${added !== 1 ? 's' : ''} to JP Quiz`)
  }

  const filtered = useMemo(() => {
    let list = courseQuizzes;
    if (filterScore === 'high') list = list.filter(q => q.score >= 90);
    if (filterScore === 'mid') list = list.filter(q => q.score >= 70 && q.score < 90);
    if (filterScore === 'low') list = list.filter(q => q.score >= 0 && q.score < 70);
    if (filterScore === 'untaken') list = list.filter(q => q.score < 0);
    if (filterFolder === 'none') list = list.filter(q => !folderMap[q.id]);
    else if (filterFolder !== 'all') list = list.filter(q => folderMap[q.id] === filterFolder);
    return list;
  }, [courseQuizzes, filterScore, filterFolder, folderMap]);

  return (
    <div>
      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/quiz')}>
            <Plus size={13} /> New Exam
          </button>
          <button className="btn btn-sm" onClick={() => setShowFolderManager(!showFolderManager)}>
            <FolderPlus size={13} /> Folders
          </button>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'high', 'mid', 'low', 'untaken'] as const).map(f => (
            <button
              key={f}
              className={`cx-chip${filterScore === f ? ' active' : ''}`}
              onClick={() => setFilterScore(f)}
            >
              {f === 'all' ? 'ALL' : f === 'high' ? '90+' : f === 'mid' ? '70-89' : f === 'low' ? '<70' : 'Bank'}
            </button>
          ))}
        </div>
      </div>

      {/* Folder Manager */}
      {showFolderManager && (
        <div className="card" style={{ marginBottom: 12, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Folder size={13} /> Manage Folders
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              placeholder="New folder name..."
              onKeyDown={e => e.key === 'Enter' && createFolder(newFolderName)}
              style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' }}
            />
            <button className="btn btn-sm btn-primary" onClick={() => createFolder(newFolderName)}>
              <Plus size={11} /> Add
            </button>
          </div>
          {folders.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No folders yet. Create one above.</div>}
          {folders.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color, display: 'inline-block' }} />
                {f.name}
              </span>
              <button className="btn btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={() => deleteFolder(f.id)}>
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Folder filter bar */}
      {folders.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className={`cx-chip${filterFolder === 'all' ? ' active' : ''}`} onClick={() => setFilterFolder('all')}>All</button>
          <button className={`cx-chip${filterFolder === 'none' ? ' active' : ''}`} onClick={() => setFilterFolder('none')} style={{ fontSize: 11 }}>Unfiled</button>
          {folders.map(f => (
            <button key={f.id} className={`cx-chip${filterFolder === f.id ? ' active' : ''}`} onClick={() => setFilterFolder(f.id)}
              style={{ borderLeft: `3px solid ${f.color}` }}>{f.name}</button>
          ))}
        </div>
      )}

      {/* Quiz list */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} />
          <h3>No exams yet</h3>
          <p>Complete quizzes for this course to see them here.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => navigate('/quiz')}>
            Start a Quiz
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(q => {
            const isUntaken = q.score < 0;
            const scoreColor = isUntaken ? 'var(--text-muted)' : q.score >= 90 ? 'var(--green)' : q.score >= 70 ? 'var(--yellow)' : 'var(--red)';
            const isExpanded = expandedQuiz === q.id;
            const isMenuOpen = menuOpenId === q.id;
            return (
              <div key={q.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedQuiz(isExpanded ? null : q.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {renamingId === q.id ? (
                        <input
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') renameQuiz(q.id, renameDraft); if (e.key === 'Escape') setRenamingId(null) }}
                          onBlur={() => renameQuiz(q.id, renameDraft)}
                          onClick={e => e.stopPropagation()}
                          autoFocus
                          style={{ fontSize: 13, fontWeight: 700, padding: '2px 6px', border: '1px solid var(--accent)', borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit', width: '100%', maxWidth: 220 }}
                        />
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{q.name || q.subtopic || 'Quiz'}</span>
                      )}
                      {folderMap[q.id] && (() => { const ff = folders.find(x => x.id === folderMap[q.id]); return ff ? (
                        <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: `${ff.color}22`, color: ff.color, fontWeight: 600 }}>{ff.name}</span>
                      ) : null })()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatDate(q.date)} &middot; {q.questionCount} questions &middot; {q.mode || 'Standard'}
                    </div>
                    {q.subtopic && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: `${accentColor}18`, color: accentColor,
                          fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 140,
                          overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>{q.subtopic}</span>
                      </div>
                    )}
                    {/* Folder assignment dropdown */}
                    {assigningId === q.id && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        <button className="cx-chip" style={{ fontSize: 10 }} onClick={() => assignToFolder(q.id, null)}>None</button>
                        {folders.map(f => (
                          <button key={f.id} className={`cx-chip${folderMap[q.id] === f.id ? ' active' : ''}`}
                            style={{ fontSize: 10, borderLeft: `3px solid ${f.color}` }}
                            onClick={() => assignToFolder(q.id, f.id)}>{f.name}</button>
                        ))}
                      </div>
                    )}
                    {/* Management menu */}
                    {isMenuOpen && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button className="cx-chip" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
                          onClick={() => { setRenamingId(q.id); setRenameDraft(q.name || q.subtopic || 'Quiz'); setMenuOpenId(null) }}>
                          <Edit3 size={10} /> Rename
                        </button>
                        <button className="cx-chip" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}
                          onClick={() => { setAssigningId(q.id); setMenuOpenId(null) }}>
                          <FolderOpen size={10} /> Move to Folder
                        </button>
                        <button className="cx-chip" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 3, color: 'var(--red)' }}
                          onClick={() => { if (confirm('Delete this quiz?')) deleteQuiz(q.id) }}>
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {/* Play quiz button */}
                    {q.questions && (q.questions as unknown[]).length > 0 && (
                      <button onClick={e => {
                        e.stopPropagation();
                        const qs = (q.questions as { question: string; answer?: string; correctAnswer?: string; options?: string[]; type?: string; explanation?: string }[]);
                        nav('/quiz', { state: { autoPlay: {
                          questions: qs.map(qn => ({
                            question: qn.question,
                            correctAnswer: qn.correctAnswer || qn.answer || '',
                            options: qn.options,
                            type: qn.type || 'multiple_choice',
                            explanation: qn.explanation,
                          })),
                          name: q.name || q.subtopic || 'Quiz',
                          subject: q.subject || '',
                          subtopic: q.subtopic || '',
                        } } });
                      }}
                        className="btn btn-primary btn-sm" style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Play size={11} /> Play
                      </button>
                    )}
                    {/* → JP Quiz button (bank entries with questions) */}
                    {isUntaken && q.questions && (q.questions as unknown[]).length > 0 && (
                      <button
                        onClick={e => { e.stopPropagation(); addToJpQuiz(q) }}
                        className="btn btn-sm"
                        style={{ padding: '4px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
                        title="Add these questions to this course's JP Quiz bank"
                      >
                        🇯🇵 → JP Quiz
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setMenuOpenId(isMenuOpen ? null : q.id); setAssigningId(null) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex' }}>
                      <Edit3 size={13} />
                    </button>
                    <span style={{ fontSize: 20, fontWeight: 900, color: scoreColor }}>{isUntaken ? 'Bank' : `${q.score}%`}</span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {/* Expanded: review answers or question bank */}
                {isExpanded && q.answers && q.answers.length > 0 && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 0 6px' }}>
                      Review Answers
                    </div>
                    {q.answers.map((a, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                        background: a.correct ? 'var(--green-dim)' : 'var(--red-dim)',
                        border: `1px solid ${a.correct ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          {i + 1}. {a.question.question}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Your answer: <span style={{ color: a.correct ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{a.userAnswer}</span>
                        </div>
                        {!a.correct && (
                          <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 2 }}>
                            Correct: {a.question.correctAnswer}
                          </div>
                        )}
                        {a.question.explanation && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>
                            {a.question.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {/* Expanded: question bank preview for untaken quizzes */}
                {isExpanded && (!q.answers || q.answers.length === 0) && q.questions && (q.questions as { question: string; answer: string; options?: string[]; type?: string }[]).length > 0 && (
                  <div style={{ padding: '0 14px 14px', borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', padding: '10px 0 6px' }}>
                      Questions ({(q.questions as unknown[]).length})
                    </div>
                    {(q.questions as { question: string; answer: string; options?: string[]; type?: string }[]).map((qn, i) => (
                      <div key={i} style={{
                        padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                          {i + 1}. {qn.question}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--green)' }}>
                          Answer: {qn.answer}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

/* ================================================================
   7. CRAM TAB
   ================================================================ */
function CramTab({
  course, getTopicProficiency, courseQuizzes, accentColor, navigate,
}: {
  course: Course;
  getTopicProficiency: (name: string) => number;
  courseQuizzes: QuizAttempt[];
  accentColor: string;
  navigate: (path: string) => void;
}) {
  const [cramMode, setCramMode] = useState<'overview' | 'quiz' | 'rapid'>('overview');
  const [cramQuizIndex, setCramQuizIndex] = useState(0);
  const [cramFlipped, setCramFlipped] = useState(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Weak topics (< 80% proficiency)
  const weakTopics = useMemo(() => {
    return safeArr<CourseTopic>(course.topics)
      .map(t => ({ ...t, proficiency: getTopicProficiency(t.name) }))
      .filter(t => t.proficiency < 80)
      .sort((a, b) => a.proficiency - b.proficiency);
  }, [safeArr<CourseTopic>(course.topics), getTopicProficiency]);

  // Flashcards for weak areas (all flashcards for now, shuffled)
  const cramCards = useMemo(() => {
    return [...safeArr<FlashcardItem>(course.flashcards)].sort(() => Math.random() - 0.5);
  }, [safeArr<FlashcardItem>(course.flashcards)]);

  // Auto-advance rapid fire
  useEffect(() => {
    if (cramMode === 'rapid' && cramFlipped) {
      autoTimerRef.current = setTimeout(() => {
        setCramFlipped(false);
        setCramQuizIndex(i => (i + 1) % cramCards.length);
      }, 3000);
      return () => { if (autoTimerRef.current) clearTimeout(autoTimerRef.current); };
    }
  }, [cramMode, cramFlipped, cramCards.length]);

  // Overview
  if (cramMode === 'overview') {
    return (
      <div>
        {/* Summary */}
        <div className="card mb-4" style={{ textAlign: 'center', padding: 24 }}>
          <Zap size={32} style={{ color: accentColor, marginBottom: 8 }} />
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>Cram Mode</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Focus on your weakest areas for rapid improvement
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/quiz')}
            >
              <Trophy size={14} /> Quick Quiz
            </button>
            <button
              className="btn"
              onClick={() => { setCramQuizIndex(0); setCramFlipped(false); setCramMode('rapid'); }}
              disabled={cramCards.length === 0}
            >
              <Play size={14} /> Rapid Fire
            </button>
          </div>
        </div>

        {/* Areas needing work */}
        <div className="card mb-4">
          <div className="card-header">
            <span className="card-title">
              <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--red)' }} />
              Areas Needing Work
            </span>
            <span className="badge badge-red">{weakTopics.length} weak</span>
          </div>
          {weakTopics.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--green)', marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green)' }}>All topics at 80%+ mastery!</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Great job - keep reviewing to maintain.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {weakTopics.map((t, i) => {
                const urgency = t.proficiency < 30 ? 'var(--red)' : t.proficiency < 60 ? 'var(--orange)' : 'var(--yellow)';
                return (
                  <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: `${urgency}20`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: urgency, flexShrink: 0,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </div>
                      <div className="progress-bar" style={{ marginTop: 4 }}>
                        <div className="progress-fill" style={{ width: `${t.proficiency}%`, background: urgency }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: urgency, flexShrink: 0 }}>
                      {t.proficiency}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--red)' }}>{weakTopics.length}</div>
            <div className="stat-label">Weak Topics</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--green)' }}>{safeArr<CourseTopic>(course.topics).length - weakTopics.length}</div>
            <div className="stat-label">Strong Topics</div>
          </div>
        </div>
      </div>
    );
  }

  // Rapid fire flashcards
  if (cramMode === 'rapid') {
    if (cramCards.length === 0) {
      return (
        <div className="empty-state">
          <Brain size={40} />
          <h3>No flashcards</h3>
          <p>Add flashcards to this course to use rapid fire mode.</p>
          <button className="btn" onClick={() => setCramMode('overview')} style={{ marginTop: 12 }}>Back</button>
        </div>
      );
    }

    const current = cramCards[cramQuizIndex % cramCards.length];

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setCramMode('overview')}>
            <X size={13} /> Exit
          </button>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            {(cramQuizIndex % cramCards.length) + 1} / {cramCards.length}
          </span>
          <span className="badge" style={{ borderColor: `${accentColor}50`, color: accentColor }}>
            Rapid Fire
          </span>
        </div>
        <div className="progress-bar" style={{ marginBottom: 20 }}>
          <div className="progress-fill" style={{
            width: `${(((cramQuizIndex % cramCards.length) + 1) / cramCards.length) * 100}%`,
            background: accentColor,
          }} />
        </div>

        <div
          onClick={() => setCramFlipped(!cramFlipped)}
          style={{
            minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: 32, borderRadius: 'var(--radius)',
            background: cramFlipped ? 'var(--bg-secondary)' : 'var(--bg-card)',
            border: `1px solid ${cramFlipped ? accentColor + '40' : 'var(--border)'}`,
            cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s',
            marginBottom: 20,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12 }}>
            {cramFlipped ? 'Answer' : 'Question'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.5 }}>
            {cramFlipped ? current.back : current.front}
          </div>
          <button
            onClick={e => { e.stopPropagation(); speak(cramFlipped ? current.back : current.front, { voiceLang: 'ja-JP', rate: 0.9 }); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-dim)', marginTop: 8 }}
            title="Read aloud"
          >
            <Volume2 size={16} />
          </button>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 8 }}>
            {cramFlipped ? 'Auto-advancing in 3s...' : 'Tap to reveal'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button className="btn" onClick={() => { setCramFlipped(false); setCramQuizIndex(Math.max(0, cramQuizIndex - 1)); }}>
            <RotateCcw size={14} /> Prev
          </button>
          <button className="btn btn-primary" onClick={() => { setCramFlipped(false); setCramQuizIndex(cramQuizIndex + 1); }}>
            Next <SkipForward size={14} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* ================================================================
   9. COURSE NOTES TAB
   ================================================================ */
const CourseNotesTab = React.memo(function CourseNotesTab({ course, accentColor, setActiveTab }: { course: Course; accentColor: string; setActiveTab: (tab: SubTab) => void }) {
  const storageKey = `nousai-lectures-${course.id}`;
  const [notes, setNotes] = useState<LectureNote[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [viewingNote, setViewingNote] = useState<LectureNote | Note | null>(null);
  const [viewingIsLibrary, setViewingIsLibrary] = useState(false);
  const navigate = useNavigate();
  const { data } = useStore();

  // Topic name resolver for topic tag badges
  const topicNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of safeArr<CourseTopic>(course.topics)) {
      map[t.id] = t.name;
      for (const st of (t.subtopics || [])) {
        map[st.id] = `${t.name} › ${st.name}`;
      }
    }
    return map;
  }, [safeArr<CourseTopic>(course.topics)]);

  // Labs from Visual Lab for linked lab display
  const labs = useMemo(() => {
    try {
      const saved = localStorage.getItem(`nousai-labs-${course.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, [course.id]);
  const [showLinkedLab, setShowLinkedLab] = useState(true);

  // Library notes linked to this course
  const linkedNotes = useMemo(() => {
    const allNotes: Note[] = (data?.pluginData?.notes as Note[] | undefined) || [];
    return allNotes.filter(n => n.courseId === course.id);
  }, [data, course.id]);

  const filteredLinked = useMemo(() => {
    if (!search) return linkedNotes;
    const q = search.toLowerCase();
    return linkedNotes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [linkedNotes, search]);

  const filtered = useMemo(() => {
    if (!search) return notes;
    const q = search.toLowerCase();
    return notes.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
  }, [notes, search]);

  const stripHtml = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = (html: string) => {
    const text = stripHtml(html);
    return text ? text.split(/\s+/).length : 0;
  };

  // Full note view
  if (viewingNote) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => { setViewingNote(null); setViewingIsLibrary(false); }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => {
            if (viewingNote.content) speak(stripHtml(viewingNote.content), { voiceLang: 'ja-JP', rate: 0.9 });
          }}>
            <Volume2 size={13} /> Read
          </button>
          <button className="btn btn-sm" onClick={() => stopSpeaking()}>
            <X size={13} /> Stop
          </button>
          {viewingIsLibrary ? (
            <button className="btn btn-sm" onClick={() => navigate('/library?tab=notes')}>
              <Edit3 size={13} /> Edit in Library
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => setActiveTab('lectures')}>
              <Edit3 size={13} /> Edit
            </button>
          )}
        </div>
        <div className="card">
          {!viewingIsLibrary && (viewingNote as LectureNote).linkedLabId && (() => {
            const linkedLab = labs.find((l: any) => l.id === (viewingNote as LectureNote).linkedLabId);
            if (!linkedLab) return null;
            return (
              <div style={{ margin: '-16px -16px 16px -16px' }}>
                <button onClick={() => setShowLinkedLab(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 16px',
                  background: 'var(--bg-secondary)', border: 'none', borderBottom: '1px solid var(--border)',
                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: accentColor,
                }}>
                  <Microscope size={14} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Linked Lab: {linkedLab.title}</span>
                  {showLinkedLab ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showLinkedLab && (
                  <div style={{ position: 'relative', background: '#1a1a2e' }}>
                    <iframe
                      srcDoc={linkedLab.html}
                      sandbox="allow-scripts"
                      onLoad={(e) => { (e.target as HTMLElement).style.opacity = '1'; }}
                      style={{ width: '100%', height: 400, border: 'none', borderBottom: '1px solid var(--border)', display: 'block', opacity: 0, transition: 'opacity 0.3s' }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{viewingNote.title}</h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            {viewingIsLibrary && <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, background: `${accentColor}18`, color: accentColor, fontSize: 10, fontWeight: 700, marginRight: 6 }}>Library</span>}
            Updated {formatDate(viewingNote.updatedAt)} &middot; {wordCount(viewingNote.content)} words
          </div>
          {viewingNote.content ? (
            <>
              <div
                className="tiptap-editor"
                style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(viewingNote.content.startsWith('<')
                    ? viewingNote.content
                    : renderSimpleMarkdown(viewingNote.content)),
                }}
              />
              <JpColorLegend content={viewingNote.content} />
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {viewingIsLibrary ? 'No content yet. Go to the Library to edit this note.' : 'No content yet. Go to the Lectures tab to edit this note.'}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <FileText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Course Notes
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notes.length + linkedNotes.length} notes</span>
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notes..." style={{ width: '100%', paddingLeft: 32 }} />
      </div>
      {filtered.length === 0 && filteredLinked.length === 0 ? (
        <div className="empty-state">
          <FileText size={40} />
          <h3>No notes yet</h3>
          <p>Go to the Lectures tab to create lecture notes, or link notes from the Library.</p>
        </div>
      ) : (
        <>
          {filtered.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filtered.map(note => (
                <div key={note.id} onClick={() => { setViewingNote(note); setViewingIsLibrary(false); }} style={{
                  padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = accentColor)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{note.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Updated {formatDateShort(note.updatedAt)} &middot; {wordCount(note.content)} words
                  </div>
                  {note.content && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {stripHtml(note.content).substring(0, 120)}...
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Linked Library Notes */}
          {filteredLinked.length > 0 && (
            <div style={{ marginTop: filtered.length > 0 ? 20 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <FolderOpen size={14} style={{ color: accentColor }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>Linked Notes</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({filteredLinked.length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredLinked.map(note => (
                  <div key={note.id} onClick={() => { setViewingNote(note); setViewingIsLibrary(true); }} style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)', border: `1px solid ${accentColor}30`,
                    cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = accentColor)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${accentColor}30`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{note.title}</div>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${accentColor}18`, color: accentColor, fontWeight: 700 }}>Library</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Updated {formatDateShort(note.updatedAt)} &middot; {wordCount(note.content)} words
                      {note.folder && <> &middot; {note.folder}</>}
                    </div>
                    {/* Topic tags */}
                    {note.topicIds && note.topicIds.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
                        {note.topicIds.slice(0, 3).map(tid => {
                          const tName = topicNameMap[tid];
                          if (!tName) return null;
                          return (
                            <span key={tid} style={{
                              fontSize: 9, padding: '1px 5px', borderRadius: 4,
                              background: `${accentColor}18`, color: accentColor,
                              fontWeight: 600, whiteSpace: 'nowrap', maxWidth: 120,
                              overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>{tName}</span>
                          );
                        })}
                        {note.topicIds.length > 3 && (
                          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{note.topicIds.length - 3}</span>
                        )}
                      </div>
                    )}
                    {note.content && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {stripHtml(note.content).substring(0, 120)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

/* ================================================================
   10. MATCHES TAB
   ================================================================ */
function MatchesTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const { matchSets: allMatchSets, saveMatchSet, updatePluginData } = useStore();
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFolder, setEditFolder] = useState('');
  const [editPairs, setEditPairs] = useState<{ term: string; definition: string }[]>([]);
  const [bulkInput, setBulkInput] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  const matchSets = allMatchSets.filter(ms =>
    ms.subject === course.id || ms.subject === course.name
  );

  // Group by folder
  const folders = useMemo(() => {
    const map: Record<string, typeof matchSets> = {};
    for (const ms of matchSets) {
      const folder = ms.folder || 'Unfiled';
      if (!map[folder]) map[folder] = [];
      map[folder].push(ms);
    }
    return map;
  }, [matchSets]);

  const allFolderNames = useMemo(() =>
    [...new Set(allMatchSets.map(ms => ms.folder).filter(Boolean) as string[])],
  [allMatchSets]);

  const findTopicTag = (name: string) => {
    const lower = name.toLowerCase();
    for (const t of safeArr<CourseTopic>(course.topics)) {
      if (lower.includes(t.name.toLowerCase())) return t.name;
      for (const st of (t.subtopics || [])) {
        if (lower.includes(st.name.toLowerCase())) return `${t.name} › ${st.name}`;
      }
    }
    return null;
  };

  const startEdit = (ms: (typeof allMatchSets)[number]) => {
    setEditing(ms.id);
    setEditName(ms.name);
    setEditFolder(ms.folder || '');
    setEditPairs([...ms.pairs]);
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setEditName('');
    setEditFolder('');
    setEditPairs([{ term: '', definition: '' }, { term: '', definition: '' }]);
    setShowBulk(false);
    setBulkInput('');
  };

  const saveEdit = () => {
    const validPairs = editPairs.filter(p => p.term.trim() && p.definition.trim());
    if (validPairs.length < 1) return;

    if (creating) {
      saveMatchSet({
        id: `match-custom-${Date.now()}`,
        name: editName.trim() || 'New Set',
        subject: course.id,
        folder: editFolder.trim() || undefined,
        pairs: validPairs,
        createdAt: new Date().toISOString(),
      });
    } else if (editing) {
      const existing = allMatchSets.find(ms => ms.id === editing);
      if (existing) {
        saveMatchSet({
          ...existing,
          name: editName.trim() || existing.name,
          folder: editFolder.trim() || undefined,
          pairs: validPairs,
        });
      }
    }
    setEditing(null);
    setCreating(false);
  };

  const deleteSet = (id: string) => {
    const updated = allMatchSets.filter(m => m.id !== id);
    updatePluginData({ matchSets: updated });
    setConfirmDelete(null);
  };

  const parseBulkInput = () => {
    const lines = bulkInput.trim().split('\n').filter(l => l.trim());
    const pairs = lines.map(line => {
      const sep = line.includes('\t') ? '\t' : line.includes(' - ') ? ' - ' : line.includes(':') ? ':' : ',';
      const parts = line.split(sep).map(s => s.trim());
      return parts.length >= 2 ? { term: parts[0], definition: parts.slice(1).join(sep === '\t' ? ' ' : sep) } : null;
    }).filter(Boolean) as { term: string; definition: string }[];
    if (pairs.length > 0) setEditPairs(prev => [...prev, ...pairs]);
    setBulkInput('');
    setShowBulk(false);
  };

  const toggleFolder = (f: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f); else next.add(f);
      return next;
    });
  };

  // ─── Edit / Create modal ───
  if (editing || creating) {
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>{creating ? 'New Match Set' : 'Edit Match Set'}</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(null); setCreating(false); }}>Cancel</button>
        </div>

        <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Set name"
          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, marginBottom: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input value={editFolder} onChange={e => setEditFolder(e.target.value)} placeholder="Folder (optional)"
            list="match-folders"
            style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
          <datalist id="match-folders">
            {allFolderNames.map(f => <option key={f} value={f} />)}
          </datalist>
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Pairs ({editPairs.filter(p => p.term.trim() && p.definition.trim()).length} valid)</div>
        {editPairs.map((p, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <input value={p.term} onChange={e => { const c = [...editPairs]; c[i] = { ...c[i], term: e.target.value }; setEditPairs(c); }}
              placeholder="Term" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
            <input value={p.definition} onChange={e => { const c = [...editPairs]; c[i] = { ...c[i], definition: e.target.value }; setEditPairs(c); }}
              placeholder="Definition" style={{ flex: 1, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12 }} />
            <button onClick={() => setEditPairs(prev => prev.filter((_, j) => j !== i))} title="Remove"
              style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', padding: 2 }}>
              <XCircle size={14} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setEditPairs(prev => [...prev, { term: '', definition: '' }])}>
            + Add Pair
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowBulk(!showBulk)}>
            Bulk Import
          </button>
        </div>

        {showBulk && (
          <div style={{ marginBottom: 12 }}>
            <textarea value={bulkInput} onChange={e => setBulkInput(e.target.value)}
              placeholder="Paste pairs (one per line, tab/comma/colon separated)&#10;e.g., term1	definition1&#10;term2, definition2"
              rows={4}
              style={{ width: '100%', padding: 8, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
            <button className="btn btn-primary btn-sm" onClick={parseBulkInput} style={{ marginTop: 4 }}>Import Lines</button>
          </div>
        )}

        <button className="btn btn-primary w-full" onClick={saveEdit}
          disabled={editPairs.filter(p => p.term.trim() && p.definition.trim()).length < 1}>
          {creating ? 'Create Set' : 'Save Changes'}
        </button>
      </div>
    );
  }

  // ─── List View ───
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <Layers size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Matching Exercises
        </h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="badge" style={{ borderColor: `${accentColor}50`, color: accentColor }}>{matchSets.length} sets</span>
          <button className="btn btn-primary btn-sm" onClick={startCreate} style={{ fontSize: 11 }}>+ New Set</button>
        </div>
      </div>
      {matchSets.length === 0 ? (
        <div className="empty-state">
          <Layers size={40} />
          <h3>No match sets yet</h3>
          <p>Create a set above, or play matching games in Learn → Match Mode.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(folders).map(([folder, sets]) => (
            <div key={folder}>
              {Object.keys(folders).length > 1 && (
                <button onClick={() => toggleFolder(folder)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 4, padding: '4px 0' }}>
                  <span style={{ transform: collapsedFolders.has(folder) ? 'rotate(-90deg)' : 'rotate(0)', transition: '0.15s', display: 'inline-block' }}>▾</span>
                  {folder} ({sets.length})
                </button>
              )}
              {!collapsedFolders.has(folder) && sets.map(ms => {
                const topicTag = findTopicTag(ms.name);
                return (
                  <div key={ms.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    marginBottom: 4,
                  }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => startEdit(ms)}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{ms.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {ms.pairs.length} pairs &middot; {formatDateShort(ms.createdAt)}
                      </div>
                      {topicTag && (
                        <div style={{ marginTop: 4 }}>
                          <span style={{
                            fontSize: 9, padding: '1px 5px', borderRadius: 4,
                            background: `${accentColor}18`, color: accentColor,
                            fontWeight: 600,
                          }}>{topicTag}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: (ms.bestScore || 0) >= 80 ? 'var(--green)' : 'var(--text-muted)' }}>
                        {(ms.bestScore || 0) > 0 ? `${ms.bestScore}%` : '--'}
                      </span>
                      {confirmDelete === ms.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-sm" style={{ fontSize: 10, color: 'var(--red)', padding: '2px 6px' }} onClick={() => deleteSet(ms.id)}>Delete</button>
                          <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(ms.id)} title="Delete"
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, opacity: 0.6 }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   11. MIND MAPS TAB
   ================================================================ */
function MindMapsTab({ course, accentColor }: { course: Course; accentColor: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
        <GitBranch size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Mind Maps
      </h3>
      <div className="empty-state">
        <GitBranch size={40} />
        <h3>No mind maps yet</h3>
        <p>Mind maps for {course.name} will appear here.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => alert('Mind Map tool coming soon')}>
          <Plus size={14} /> Open Mind Map Tool
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   12. OCR SCANS TAB
   ================================================================ */
function OcrTab({ course, accentColor }: { course: Course; accentColor: string }) {
  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>
        <ScanLine size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />OCR Scans
      </h3>
      <div className="empty-state">
        <ScanLine size={40} />
        <h3>No scanned documents</h3>
        <p>Scanned documents for {course.name} will appear here after using the OCR scanner.</p>
        <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => alert('OCR Scanner coming soon')}>
          <ScanLine size={14} /> Open OCR Scanner
        </button>
      </div>
    </div>
  );
}

/* ================================================================
   13. AI OUTPUTS TAB
   ================================================================ */
function AiOutputsTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const storageKey = `nousai-course-${course.id}-ai-outputs`;
  const [outputs, setOutputs] = useState<{ id: string; type: string; content: string; createdAt: string }[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />AI Outputs
        </h3>
        <span className="badge" style={{ borderColor: `${accentColor}50`, color: accentColor }}>{outputs.length} items</span>
      </div>
      {outputs.length === 0 ? (
        <div className="empty-state">
          <Sparkles size={40} />
          <h3>No AI-generated content</h3>
          <p>AI-generated quizzes, summaries, and other content for {course.name} will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {outputs.map(o => (
            <div key={o.id} style={{
              padding: '12px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="badge" style={{ borderColor: `${accentColor}40`, color: accentColor, fontSize: 9 }}>{o.type}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDateShort(o.createdAt)}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.content.substring(0, 150)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   14. ALL FILES TAB
   ================================================================ */
function AllFilesTab({ course, courseQuizzes, accentColor }: { course: Course; courseQuizzes: QuizAttempt[]; accentColor: string }) {
  const [filter, setFilter] = useState<'all' | 'topics' | 'flashcards' | 'quizzes' | 'notes'>('all');

  const lectureNotes: LectureNote[] = useMemo(() => {
    try { const s = localStorage.getItem(`nousai-lectures-${course.id}`); return s ? JSON.parse(s) : []; } catch { return []; }
  }, [course.id]);

  type FileItem = { type: string; name: string; detail: string; date?: string };

  const allFiles: FileItem[] = useMemo(() => {
    const items: FileItem[] = [];
    if (filter === 'all' || filter === 'topics') {
      safeArr<CourseTopic>(course.topics).forEach(t => items.push({ type: 'Topic', name: t.name, detail: `${t.subtopics?.length || 0} subtopics` }));
    }
    if (filter === 'all' || filter === 'flashcards') {
      safeArr<FlashcardItem>(course.flashcards).forEach(f => items.push({ type: 'Flashcard', name: f.front, detail: f.back.substring(0, 60) }));
    }
    if (filter === 'all' || filter === 'quizzes') {
      courseQuizzes.forEach(q => items.push({ type: 'Quiz', name: q.name || q.subtopic || 'Quiz', detail: `${q.score < 0 ? 'Bank' : q.score + '%'} - ${q.questionCount} questions`, date: q.date }));
    }
    if (filter === 'all' || filter === 'notes') {
      lectureNotes.forEach(n => items.push({ type: 'Note', name: n.title, detail: `${n.content.split('\n').length} lines`, date: n.updatedAt }));
    }
    return items;
  }, [course, courseQuizzes, lectureNotes, filter]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <FolderOpen size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />All Files
        </h3>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{allFiles.length} items</span>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'topics', 'flashcards', 'quizzes', 'notes'] as const).map(f => (
          <button key={f} className={`cx-chip${filter === f ? ' active' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      {allFiles.length === 0 ? (
        <div className="empty-state">
          <FolderOpen size={40} />
          <h3>No files</h3>
          <p>Course content will appear here as you add topics, flashcards, quizzes, and notes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {allFiles.map((f, i) => (
            <div key={`${f.type}-${i}`} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)',
            }}>
              <span className="badge" style={{
                borderColor: 'var(--border)', color: 'var(--text-muted)', fontSize: 9,
                minWidth: 54, textAlign: 'center',
              }}>{f.type}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.detail}</div>
              </div>
              {f.date && <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{formatDateShort(f.date)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   15. MODULES TAB
   ================================================================ */
function ModulesTab({
  course, data, setData, getTopicProficiency, accentColor,
}: {
  course: Course;
  data: NousAIData | null;
  setData: { (d: NousAIData): void; (fn: (prev: NousAIData) => NousAIData): void };
  getTopicProficiency: (name: string) => number;
  accentColor: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [newModName, setNewModName] = useState('');
  const [expandedMod, setExpandedMod] = useState<string | null>(null);
  const [addTopicTo, setAddTopicTo] = useState<string | null>(null);

  const userModules = course.modules || [];

  // Topics not in any module
  const assignedTopicIds = new Set(userModules.flatMap(m => m.topicIds));
  const unassignedTopics = safeArr<CourseTopic>(course.topics).filter(t => !assignedTopicIds.has(t.id));

  // If no user-defined modules, auto-generate from every 3 topics
  const displayModules = useMemo(() => {
    if (userModules.length > 0) {
      return userModules.map(mod => {
        const topics = mod.topicIds.map(id => safeArr<CourseTopic>(course.topics).find(t => t.id === id)).filter(Boolean) as CourseTopic[];
        const profs = topics.map(t => getTopicProficiency(t.name));
        const avgProf = profs.length > 0 ? Math.round(profs.reduce((a, b) => a + b, 0) / profs.length) : 0;
        return { id: mod.id, name: mod.name, topics, progress: avgProf, isUser: true };
      });
    }
    // auto-group fallback
    const mods: { id: string; name: string; topics: CourseTopic[]; progress: number; isUser: boolean }[] = [];
    const chunkSize = 3;
    for (let i = 0; i < safeArr<CourseTopic>(course.topics).length; i += chunkSize) {
      const chunk = safeArr<CourseTopic>(course.topics).slice(i, i + chunkSize);
      const profs = chunk.map(t => getTopicProficiency(t.name));
      const avgProf = profs.length > 0 ? Math.round(profs.reduce((a, b) => a + b, 0) / profs.length) : 0;
      mods.push({ id: `auto-${i}`, name: `Module ${Math.floor(i / chunkSize) + 1}`, topics: chunk, progress: avgProf, isUser: false });
    }
    return mods;
  }, [userModules, course.topics, getTopicProficiency]);

  const updateModules = useCallback((newMods: import('../types').CourseModule[]) => {
    if (!data) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return { ...c, modules: newMods };
          }),
        },
      },
    }));
  }, [data, setData, course.id]);

  const addModule = useCallback(() => {
    if (!newModName.trim()) return;
    const mod: import('../types').CourseModule = {
      id: generateId(),
      name: newModName.trim(),
      topicIds: [],
    };
    updateModules([...userModules, mod]);
    setNewModName('');
    setShowAdd(false);
  }, [newModName, userModules, updateModules]);

  const deleteModule = useCallback((modId: string) => {
    updateModules(userModules.filter(m => m.id !== modId));
  }, [userModules, updateModules]);

  const addTopicToModule = useCallback((modId: string, topicId: string) => {
    updateModules(userModules.map(m => {
      if (m.id !== modId) return m;
      return { ...m, topicIds: [...m.topicIds, topicId] };
    }));
    setAddTopicTo(null);
  }, [userModules, updateModules]);

  const removeTopicFromModule = useCallback((modId: string, topicId: string) => {
    updateModules(userModules.map(m => {
      if (m.id !== modId) return m;
      return { ...m, topicIds: m.topicIds.filter(id => id !== topicId) };
    }));
  }, [userModules, updateModules]);

  const renameModule = useCallback((modId: string, name: string) => {
    updateModules(userModules.map(m => m.id === modId ? { ...m, name } : m));
  }, [userModules, updateModules]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <LayoutGrid size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Modules
        </h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={13} /> New Module
        </button>
      </div>

      {/* Breadcrumb hint */}
      {userModules.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>
          {course.name} &gt; Modules ({userModules.length}) &middot; {unassignedTopics.length} unassigned topics
        </div>
      )}

      {/* Add module form */}
      {showAdd && (
        <div className="card mb-3" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={newModName}
            onChange={e => setNewModName(e.target.value)}
            placeholder="Module name..."
            style={{ flex: 1, fontSize: 13 }}
            onKeyDown={e => e.key === 'Enter' && addModule()}
            autoFocus
          />
          <button className="btn btn-primary btn-sm" onClick={addModule} disabled={!newModName.trim()}>Add</button>
          <button className="btn btn-sm" onClick={() => setShowAdd(false)}><X size={13} /></button>
        </div>
      )}

      {displayModules.length === 0 ? (
        <div className="empty-state">
          <LayoutGrid size={40} />
          <h3>No modules</h3>
          <p>Create modules to organize your course topics into groups.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {displayModules.map(mod => {
            const isExpanded = expandedMod === mod.id;
            return (
              <div key={mod.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div
                  onClick={() => setExpandedMod(isExpanded ? null : mod.id)}
                  style={{
                    padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: isExpanded ? '1px solid var(--border)' : undefined,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{mod.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {mod.topics?.length ?? 0} topic{(mod.topics?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: mod.progress >= 80 ? 'var(--green)' : mod.progress > 0 ? accentColor : 'var(--text-dim)' }}>
                      {mod.progress}%
                    </span>
                    {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '8px 14px 12px' }}>
                    {/* Module progress bar */}
                    <div className="progress-bar" style={{ marginBottom: 10 }}>
                      <div className="progress-fill" style={{ width: `${mod.progress}%`, background: mod.progress >= 80 ? 'var(--green)' : accentColor }} />
                    </div>

                    {/* Topics list */}
                    {mod.topics.map(t => {
                      const prof = getTopicProficiency(t.name);
                      return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
                          {prof >= 80 ? <CheckCircle2 size={13} style={{ color: 'var(--green)' }} /> : <Circle size={13} style={{ color: 'var(--text-dim)' }} />}
                          <span style={{ fontSize: 12, flex: 1 }}>{t.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: prof >= 80 ? 'var(--green)' : prof > 0 ? accentColor : 'var(--text-dim)' }}>{prof}%</span>
                          {mod.isUser && (
                            <button
                              onClick={e => { e.stopPropagation(); removeTopicFromModule(mod.id, t.id); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}
                              title="Remove from module"
                            >
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {/* Add topic + actions for user modules */}
                    {mod.isUser && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {addTopicTo === mod.id ? (
                          <div style={{
                            width: '100%', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border)', padding: 8, maxHeight: 140, overflowY: 'auto',
                          }}>
                            {unassignedTopics.length === 0 ? (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', padding: 8 }}>
                                All topics assigned to modules
                              </div>
                            ) : (
                              unassignedTopics.map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => addTopicToModule(mod.id, t.id)}
                                  style={{
                                    display: 'block', width: '100%', textAlign: 'left',
                                    padding: '5px 8px', background: 'none', border: 'none',
                                    borderRadius: 4, cursor: 'pointer', fontSize: 12,
                                    color: 'var(--text-secondary)', fontFamily: 'inherit',
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                >
                                  <Plus size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                  {t.name}
                                </button>
                              ))
                            )}
                            <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={() => setAddTopicTo(null)}>
                              Done
                            </button>
                          </div>
                        ) : (
                          <>
                            <button className="btn btn-sm" onClick={() => setAddTopicTo(mod.id)}>
                              <Plus size={11} /> Add Topic
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => {
                                const name = prompt('Rename module:', mod.name);
                                if (name?.trim()) renameModule(mod.id, name.trim());
                              }}
                            >
                              <Edit3 size={11} /> Rename
                            </button>
                            <button
                              className="btn btn-sm"
                              onClick={() => deleteModule(mod.id)}
                              style={{ color: 'var(--red)' }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   16. ASSIGNMENTS TAB
   ================================================================ */
interface AssignmentItem {
  id: string;
  name: string;
  dueDate: string;
  weight: number;
  completed: boolean;
}

function AssignmentsTab({ course, accentColor, canvasUrl, canvasToken }: { course: Course; accentColor: string; canvasUrl?: string; canvasToken?: string }) {
  const storageKey = `nousai-course-${course.id}-assignments`;
  const [assignments, setAssignments] = useState<AssignmentItem[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newWeight, setNewWeight] = useState('10');
  const [syncing, setSyncing] = useState(false);

  const syncFromCanvas = useCallback(async () => {
    if (!canvasUrl || !canvasToken) return;
    setSyncing(true);
    try {
      const { syncCanvasCourses, matchCanvasCourse, syncCanvasAssignments } = await import('../utils/canvasSync');
      const courses = await syncCanvasCourses(canvasUrl, canvasToken);
      const match = matchCanvasCourse(courses, course.name) || matchCanvasCourse(courses, course.shortName);
      if (!match) { alert(`Could not find matching Canvas course for "${course.shortName}". Found: ${courses.map(c => c.course_code).join(', ')}`); setSyncing(false); return; }
      const synced = await syncCanvasAssignments(canvasUrl, canvasToken, match.id);
      // Merge: keep manual, add new canvas ones
      setAssignments(prev => {
        const existing = new Set(prev.map(a => a.name.toLowerCase()));
        const newOnes = synced.filter(s => !existing.has(s.name.toLowerCase()));
        return [...prev, ...newOnes];
      });
      alert(`Synced ${synced.length} assignments from Canvas (${match.course_code})`);
    } catch (e: unknown) {
      alert(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setSyncing(false);
  }, [canvasUrl, canvasToken, course.name, course.shortName]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(assignments)); } catch (e) { console.warn('[Assignments] localStorage save failed:', e); }
  }, [assignments, storageKey]);

  const addAssignment = () => {
    if (!newName.trim()) return;
    setAssignments(prev => [...prev, {
      id: generateId(),
      name: newName.trim(),
      dueDate: newDue || new Date().toISOString().split('T')[0],
      weight: parseFloat(newWeight) || 10,
      completed: false,
    }]);
    setNewName(''); setNewDue(''); setNewWeight('10'); setShowAdd(false);
  };

  const toggleComplete = (id: string) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, completed: !a.completed } : a));
  };

  const removeAssignment = (id: string) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <ClipboardList size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Assignments
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {canvasUrl && canvasToken && (
            <button className="btn btn-sm" onClick={syncFromCanvas} disabled={syncing} style={{ fontSize: 11, gap: 4 }}>
              <Download size={11} /> {syncing ? 'Syncing...' : 'Sync Canvas'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13} /> Add Assignment
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="card mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Assignment name" style={{ fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
              <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Weight %" style={{ width: 80, fontSize: 12 }} min="0" max="100" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={addAssignment}>Save</button>
              <button className="btn btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {assignments.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={40} />
          <h3>No assignments</h3>
          <p>Add homework, projects, and other assignments to track your progress.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {assignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).map(a => {
            const isOverdue = !a.completed && new Date(a.dueDate) < new Date();
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                border: `1px solid ${isOverdue ? 'var(--red)20' : 'var(--border)'}`,
                opacity: a.completed ? 0.6 : 1,
              }}>
                <button
                  onClick={() => toggleComplete(a.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: a.completed ? 'var(--green)' : 'var(--text-dim)' }}
                >
                  {a.completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: a.completed ? 'line-through' : 'none' }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-muted)' }}>
                    Due: {formatDate(a.dueDate)} &middot; Weight: {a.weight}%
                    {isOverdue && ' (Overdue)'}
                  </div>
                </div>
                <button onClick={() => removeAssignment(a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   17. GRADES TAB
   ================================================================ */
interface GradeItem {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  category: string;
}

function GradesTab({ course, accentColor, canvasUrl, canvasToken }: { course: Course; accentColor: string; canvasUrl?: string; canvasToken?: string }) {
  const storageKey = `nousai-course-${course.id}-grades`;
  const [grades, setGrades] = useState<GradeItem[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScore, setNewScore] = useState('');
  const [newMax, setNewMax] = useState('100');
  const [newWeight, setNewWeight] = useState('10');
  const [newCat, setNewCat] = useState('Exam');
  const [syncing, setSyncing] = useState(false);

  const syncGradesFromCanvas = useCallback(async () => {
    if (!canvasUrl || !canvasToken) return;
    setSyncing(true);
    try {
      const { syncCanvasCourses, matchCanvasCourse, syncCanvasGrades } = await import('../utils/canvasSync');
      const courses = await syncCanvasCourses(canvasUrl, canvasToken);
      const match = matchCanvasCourse(courses, course.name) || matchCanvasCourse(courses, course.shortName);
      if (!match) { alert(`Could not find matching Canvas course for "${course.shortName}"`); setSyncing(false); return; }
      const synced = await syncCanvasGrades(canvasUrl, canvasToken, match.id);
      setGrades(prev => {
        const existing = new Set(prev.map(g => g.name.toLowerCase()));
        const newOnes = synced.filter(s => !existing.has(s.name.toLowerCase()));
        return [...prev, ...newOnes];
      });
      alert(`Synced ${synced.length} graded items from Canvas (${match.course_code})`);
    } catch (e: unknown) {
      alert(`Sync failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
    setSyncing(false);
  }, [canvasUrl, canvasToken, course.name, course.shortName]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(grades)); } catch (e) { console.warn('[Grades] localStorage save failed:', e); }
  }, [grades, storageKey]);

  const addGrade = () => {
    if (!newName.trim() || !newScore.trim()) return;
    setGrades(prev => [...prev, {
      id: generateId(),
      name: newName.trim(),
      score: parseFloat(newScore),
      maxScore: parseFloat(newMax) || 100,
      weight: parseFloat(newWeight) || 10,
      category: newCat,
    }]);
    setNewName(''); setNewScore(''); setNewMax('100'); setNewWeight('10'); setShowAdd(false);
  };

  const removeGrade = (id: string) => {
    setGrades(prev => prev.filter(g => g.id !== id));
  };

  const getLetterGrade = (pct: number): string => {
    if (pct >= 93) return 'A';
    if (pct >= 90) return 'A-';
    if (pct >= 87) return 'B+';
    if (pct >= 83) return 'B';
    if (pct >= 80) return 'B-';
    if (pct >= 77) return 'C+';
    if (pct >= 73) return 'C';
    if (pct >= 70) return 'C-';
    if (pct >= 67) return 'D+';
    if (pct >= 60) return 'D';
    return 'F';
  };

  const weightedAvg = useMemo(() => {
    if (grades.length === 0) return 0;
    const totalWeight = grades.reduce((s, g) => s + g.weight, 0);
    if (totalWeight === 0) return 0;
    return Math.round(grades.reduce((s, g) => s + ((g.score / g.maxScore) * 100 * g.weight), 0) / totalWeight * 10) / 10;
  }, [grades]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <BarChart2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Grades
        </h3>
        <div style={{ display: 'flex', gap: 4 }}>
          {canvasUrl && canvasToken && (
            <button className="btn btn-sm" onClick={syncGradesFromCanvas} disabled={syncing} style={{ fontSize: 11, gap: 4 }}>
              <Download size={11} /> {syncing ? 'Syncing...' : 'Sync Canvas'}
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={13} /> Add Grade
          </button>
        </div>
      </div>

      {grades.length > 0 && (
        <div className="card mb-4" style={{ textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 4 }}>
            Weighted Average
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: weightedAvg >= 80 ? 'var(--green)' : weightedAvg >= 60 ? 'var(--yellow)' : 'var(--red)' }}>
            {weightedAvg}%
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            {getLetterGrade(weightedAvg)}
          </div>
        </div>
      )}

      {showAdd && (
        <div className="card mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Assignment name" style={{ fontSize: 13 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="number" value={newScore} onChange={e => setNewScore(e.target.value)} placeholder="Score" style={{ flex: 1, fontSize: 12 }} />
              <span style={{ alignSelf: 'center', color: 'var(--text-muted)', fontSize: 13 }}>/</span>
              <input type="number" value={newMax} onChange={e => setNewMax(e.target.value)} placeholder="Max" style={{ width: 60, fontSize: 12 }} />
              <input type="number" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Wt %" style={{ width: 60, fontSize: 12 }} />
            </div>
            <select value={newCat} onChange={e => setNewCat(e.target.value)} style={{ fontSize: 12 }}>
              <option value="Exam">Exam</option>
              <option value="Homework">Homework</option>
              <option value="Project">Project</option>
              <option value="Lab">Lab</option>
              <option value="Participation">Participation</option>
              <option value="Other">Other</option>
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={addGrade}>Save</button>
              <button className="btn btn-sm" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {grades.length === 0 ? (
        <div className="empty-state">
          <BarChart2 size={40} />
          <h3>No grades recorded</h3>
          <p>Add assignment scores to track your grade in {course.name}.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignment</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Category</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Score</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Weight</th>
                <th style={{ textAlign: 'center', padding: '8px 6px', fontWeight: 700, color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase' }}>Grade</th>
                <th style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {grades.map(g => {
                const pct = Math.round((g.score / g.maxScore) * 100);
                const gradeColor = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
                return (
                  <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{g.name}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>{g.category}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{g.score}/{g.maxScore}</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--text-muted)' }}>{g.weight}%</td>
                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 800, color: gradeColor }}>{getLetterGrade(pct)}</td>
                    <td style={{ padding: '8px 2px' }}>
                      <button onClick={() => removeGrade(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   18. SYLLABUS TAB
   ================================================================ */
function SyllabusTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const storageKey = `nousai-course-${course.id}-syllabus`;
  const [syllabusText, setSyllabusText] = useState(() => {
    try { return localStorage.getItem(storageKey) || ''; } catch { return ''; }
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(syllabusText);

  const save = () => {
    setSyllabusText(editText);
    try { localStorage.setItem(storageKey, editText); } catch (e) { console.warn('[Syllabus] localStorage save failed:', e); }
    setIsEditing(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <ScrollText size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Syllabus
        </h3>
        {!isEditing ? (
          <button className="btn btn-sm" onClick={() => { setEditText(syllabusText); setIsEditing(true); }}>
            <Edit3 size={13} /> Edit
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-primary btn-sm" onClick={save}>
              <CheckCircle2 size={13} /> Save
            </button>
            <button className="btn btn-sm" onClick={() => setIsEditing(false)}>Cancel</button>
          </div>
        )}
      </div>

      {isEditing ? (
        <textarea
          value={editText}
          onChange={e => setEditText(e.target.value)}
          placeholder="Paste or type your course syllabus here..."
          style={{
            width: '100%', minHeight: 400, resize: 'vertical', fontFamily: 'monospace',
            fontSize: 13, lineHeight: 1.7, padding: 16,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', color: 'var(--text-primary)',
          }}
        />
      ) : syllabusText ? (
        <div className="card" style={{ padding: 20 }}>
          <div
            style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderSimpleMarkdown(syllabusText)) }}
          />
        </div>
      ) : (
        <div className="empty-state">
          <ScrollText size={40} />
          <h3>No syllabus</h3>
          <p>Paste or type your course syllabus to keep it easily accessible.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => { setEditText(''); setIsEditing(true); }}>
            <Plus size={14} /> Import Syllabus
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   19. LINKS & FILES TAB
   ================================================================ */

function getFileIcon(fileType?: string): string {
  if (!fileType) return '🔗';
  if (fileType.startsWith('image/')) return '🖼️';
  if (fileType === 'application/pdf') return '📄';
  if (fileType.includes('word') || fileType.includes('document')) return '📝';
  if (fileType.includes('sheet') || fileType.includes('excel') || fileType.includes('csv')) return '📊';
  if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
  if (fileType.startsWith('video/')) return '🎬';
  if (fileType.startsWith('audio/')) return '🎵';
  if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('tar')) return '📦';
  if (fileType.includes('text/') || fileType.includes('json') || fileType.includes('xml')) return '📃';
  return '📎';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function LinksTab({ course, accentColor }: { course: Course; accentColor: string }) {
  const storageKey = `nousai-course-${course.id}-links`;
  const [links, setLinks] = useState<LinkItem[]>(() => {
    try { const s = localStorage.getItem(storageKey); return s ? JSON.parse(s) : []; } catch { return []; }
  });
  const [showAddLink, setShowAddLink] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [previewItem, setPreviewItem] = useState<LinkItem | null>(null);
  const [viewerItem, setViewerItem] = useState<LinkItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'link' | 'file'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save links metadata to localStorage (small), file data to IndexedDB (large)
  const saveLinksRef = useRef(links);
  saveLinksRef.current = links;
  useEffect(() => {
    const linksForStorage = links.map(l => l.type === 'file' ? { ...l, dataUrl: undefined } : l);
    try { localStorage.setItem(storageKey, JSON.stringify(linksForStorage)); } catch (e) { console.warn('[LinksTab] localStorage save failed:', e); }
    // Store file data in IndexedDB (no quota issues)
    links.forEach(l => {
      if (l.type === 'file' && l.dataUrl) {
        saveFile(`${storageKey}-file-${l.id}`, l.dataUrl);
      }
    });
  }, [links, storageKey]);

  // Load file data from IndexedDB on mount (+ migrate old localStorage data)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // One-time migration from localStorage to IndexedDB
      await migrateFromLocalStorage(storageKey);
      // Load each file's data from IndexedDB
      const prev = saveLinksRef.current;
      const updated = await Promise.all(prev.map(async l => {
        if (l.type === 'file' && !l.dataUrl) {
          const data = await loadFile(`${storageKey}-file-${l.id}`);
          if (data) return { ...l, dataUrl: data };
        }
        return l;
      }));
      if (!cancelled) setLinks(updated);
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  const addLink = () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const url = newUrl.trim().startsWith('http') ? newUrl.trim() : `https://${newUrl.trim()}`;
    setLinks(prev => [...prev, { id: generateId(), name: newName.trim(), url, type: 'link' }]);
    setNewName(''); setNewUrl(''); setShowAddLink(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setLinks(prev => [...prev, {
          id: generateId(),
          name: file.name,
          url: file.name,
          type: 'file',
          fileType: file.type,
          fileSize: file.size,
          dataUrl,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeItem = (id: string) => {
    deleteFile(`${storageKey}-file-${id}`);
    setLinks(prev => prev.filter(l => l.id !== id));
  };

  const openFile = (item: LinkItem) => {
    if (item.type === 'link') {
      window.open(item.url, '_blank', 'noopener,noreferrer')
    } else if (item.dataUrl) {
      setViewerItem(item)
    }
  };

  const filtered = filterType === 'all' ? links : links.filter(l => l.type === filterType);
  const fileCount = links.filter(l => l.type === 'file').length;
  const linkCount = links.filter(l => l.type === 'link').length;

  return (
    <div>
      {viewerItem && (
        <FileViewerModal
          item={viewerItem}
          courseId={course.id}
          accentColor={accentColor}
          onClose={() => setViewerItem(null)}
        />
      )}
      {/* Preview modal */}
      {previewItem && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setPreviewItem(null)}>
          <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', gap: 8 }}>
            <a href={previewItem.dataUrl} download={previewItem.name}
              onClick={e => e.stopPropagation()}
              style={{ padding: '6px 14px', borderRadius: 6, background: accentColor, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              <Download size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Download
            </a>
            <button onClick={() => setPreviewItem(null)}
              style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer' }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>{previewItem.name}</div>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh', overflow: 'auto' }}>
            {previewItem.fileType?.startsWith('image/') && (
              <img src={previewItem.dataUrl} alt={previewItem.name} style={{ maxWidth: '90vw', maxHeight: '75vh', borderRadius: 8 }} />
            )}
            {previewItem.fileType === 'application/pdf' && (
              <iframe src={previewItem.dataUrl} title={previewItem.name} style={{ width: '80vw', height: '80vh', border: 'none', borderRadius: 8 }} />
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
          <Link size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Links & Files
        </h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '5px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Upload size={12} /> Upload File
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddLink(!showAddLink)}>
            <Plus size={13} /> Add Link
          </button>
        </div>
        <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rar,.mp3,.mp4,.wav" />
      </div>

      {/* Add link form */}
      {showAddLink && (
        <div className="card mb-4">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Link name" style={{ fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
            <input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="https://..." style={{ fontSize: 13 }}
              onKeyDown={e => { if (e.key === 'Enter') addLink(); }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={addLink}>Save</button>
              <button className="btn btn-sm" onClick={() => setShowAddLink(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {links.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['all', 'link', 'file'] as const).map(f => (
            <button key={f} onClick={() => setFilterType(f)} style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid var(--border)',
              background: filterType === f ? accentColor : 'var(--bg-card)', color: filterType === f ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {f === 'all' ? `All (${links.length})` : f === 'link' ? `Links (${linkCount})` : `Files (${fileCount})`}
            </button>
          ))}
        </div>
      )}

      {/* Items list */}
      {filtered.length === 0 && links.length === 0 ? (
        <div className="empty-state">
          <Link size={40} />
          <h3>No links or files</h3>
          <p>Add links to external resources, or upload files like PDFs, images, documents, and more.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-dim)', fontSize: 13 }}>
          No {filterType === 'link' ? 'links' : 'files'} yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(l => (
            <div key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'border-color 0.15s',
            }} onClick={() => openFile(l)}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>
                {l.type === 'link' ? '🔗' : getFileIcon(l.fileType)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.type === 'link' ? l.url : `${l.fileType?.split('/')[1]?.toUpperCase() || 'FILE'} • ${formatFileSize(l.fileSize)}`}
                </div>
              </div>
              {l.type === 'link' && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: accentColor, fontWeight: 600 }}>LINK</span>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeItem(l.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

