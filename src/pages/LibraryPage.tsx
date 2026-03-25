/**
 * Library Page — Central hub with Course Spaces, Notes, Drawings & Study Modes
 * Four tabs: "Course Spaces" (default), "Notes", "Drawings", "Study"
 * Stores notes in data.pluginData.notes via IndexedDB
 */
import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { lazyWithRetry } from '../utils/lazyWithRetry';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Plus, FileText, Folder, Tag,
  ChevronLeft, Edit3, Trash2, Download, Upload,
  X, Check, Code, BookOpen, Brain, Trophy,
  Layers, SortAsc, SortDesc, Copy, FolderPlus,
  GraduationCap, Palette, FolderOpen,
  Bold, Italic, Heading, List, Link, Quote, Minus, Image, Volume2,
  Eye, EyeOff, Columns, Sparkles, Languages,
  NotebookPen, Target, Microscope, RefreshCw,
} from 'lucide-react';

const DrawPage = lazyWithRetry(() => import('./DrawPage'));
const StudyModesPage = lazyWithRetry(() => import('./StudyModesPage'));
import { useStore } from '../store';
import { useSessionStore } from '../store/sessionStore';
import type { Course } from '../types';
import { speak, stopSpeaking } from '../utils/speechTools';
import { callAI, isAIConfigured } from '../utils/ai';
import RichTextEditor, { markdownToHtml, htmlToMarkdown } from '../components/RichTextEditor';
import { sanitizeHtml } from '../utils/sanitize';
import { exportNoteAsMarkdown, exportAllNotesAsMarkdown, exportQuizzesAsCSV, exportFlashcardsAsAnki, exportNoteAsLatex } from '../utils/exportFormats';
import { formatDate } from '../components/course/courseHelpers';

/* ── Types ──────────────────────────────────────────── */
interface Note {
  id: string;
  title: string;
  content: string;
  folder: string;
  tags: string[];
  courseId?: string;
  topicIds?: string[];
  createdAt: string;
  updatedAt: string;
  type: 'note' | 'quiz' | 'flashcard' | 'ai-output' | 'match';
  labHtml?: string;
}

type SortKey = 'name' | 'date' | 'size';
type SortDir = 'asc' | 'desc';
type FilterType = 'all' | 'note' | 'quiz' | 'flashcard' | 'ai-output' | 'match';
type ViewMode = 'list' | 'viewer' | 'editor';
type LibraryTab = 'courses' | 'notes' | 'drawings' | 'study' | 'annotations';

/* ── Helpers ────────────────────────────────────────── */
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
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

function typeIcon(type: Note['type']) {
  switch (type) {
    case 'quiz': return Trophy;
    case 'flashcard': return BookOpen;
    case 'ai-output': return Brain;
    case 'match': return Layers;
    default: return FileText;
  }
}

function typeLabel(type: Note['type']): string {
  switch (type) {
    case 'quiz': return 'Quiz';
    case 'flashcard': return 'Flashcard';
    case 'ai-output': return 'AI Output';
    case 'match': return 'Match';
    default: return 'Note';
  }
}

const FILTER_CHIPS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'note', label: 'Notes' },
  { key: 'quiz', label: 'Quizzes' },
  { key: 'flashcard', label: 'Flashcards' },
  { key: 'ai-output', label: 'AI Outputs' },
  { key: 'match', label: 'Matches' },
];

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

/* ── Main Component ─────────────────────────────────── */
export default function LibraryPage() {
  const { data, setData, updatePluginData, loaded, courses, quizHistory, setPageContext } = useStore();
  const annotationCount = useSessionStore(s => Object.keys(s.sessions).length);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LibraryTab>(() => {
    const tab = searchParams.get('tab');
    if (tab === 'notes' || tab === 'drawings' || tab === 'study') return tab;
    return 'courses';
  });

  // ─── Notes state ───
  const [notes, setNotes] = useState<Note[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [filterFolder, setFilterFolder] = useState<string>('all');
  const searchRef = useRef<HTMLInputElement>(null);
  // #16 Auto-tag state
  const [pendingAutoTags, setPendingAutoTags] = useState<{ noteId: string; tags: string[] } | null>(null);
  // #41 Notes list pagination
  const [notesLimit, setNotesLimit] = useState(50);
  // Folder management state
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [renameFolderValue, setRenameFolderValue] = useState('');
  const [folderHover, setFolderHover] = useState<string | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // ─── Page context publisher ───
  useEffect(() => {
    const selectedNote = notes.find(n => n.id === selectedId) ?? null
    setPageContext({
      page: 'Library',
      summary: selectedNote ? `Viewing: ${selectedNote.title}` : `Library — ${notes.length} notes`,
      activeItem: selectedNote?.content ? selectedNote.content.slice(0, 3000) : undefined,
      fullContent: notes.slice(0, 50).map(n => n.title).join('\n'),
    })
    return () => setPageContext(null)
  }, [notes, selectedId])

  // ─── Topic name resolver (for displaying linked topic tags) ───
  const topicNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const allCourses = data?.pluginData?.coachData?.courses || [];
    for (const c of allCourses) {
      for (const t of (c.topics || [])) {
        map.set(t.id, t.name);
        for (const st of (t.subtopics || [])) {
          map.set(st.id, `${t.name} › ${st.name}`);
        }
      }
    }
    return map;
  }, [data]);

  // ─── Course Spaces state ───
  const [courseSearch, setCourseSearch] = useState('');
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseShort, setNewCourseShort] = useState('');
  const [newCourseColor, setNewCourseColor] = useState(PRESET_COLORS[4]);

  // Load notes from store
  useEffect(() => {
    if (data?.pluginData) {
      const stored = (data.pluginData as Record<string, unknown>).notes as Note[] | undefined;
      if (stored && Array.isArray(stored)) {
        setNotes(stored);
      }
    }
  }, [data]);

  // Persist notes to store (uses functional updater to prevent stale data overwrites)
  const persistNotes = useCallback((updated: Note[]) => {
    setNotes(updated);
    updatePluginData({ notes: updated });
  }, [updatePluginData]);

  // Keyboard shortcut: Ctrl+F — only intercept on notes tab, stop propagation so App.tsx doesn't also open OmniSearch
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (activeTab === 'notes') {
          e.preventDefault();
          e.stopPropagation();
          if (view !== 'list') setView('list');
          setTimeout(() => searchRef.current?.focus(), 50);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, activeTab]);

  // Derived: folders from notes
  const folders = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => { if (n.folder) set.add(n.folder); });
    return Array.from(set).sort();
  }, [notes]);

  // Derived: all folders = note-derived + explicitly created empty folders
  const allFolders = useMemo(() => {
    const extra = (data?.pluginData?.noteFolders as string[] | undefined) ?? [];
    const combined = new Set([...folders, ...extra]);
    return Array.from(combined).sort();
  }, [folders, data]);

  // Derived: filtered & sorted notes
  const filteredNotes = useMemo(() => {
    let list = [...notes];
    if (filterType !== 'all') list = list.filter(n => n.type === filterType);
    if (filterFolder !== 'all') list = list.filter(n => n.folder === filterFolder || n.folder.startsWith(filterFolder + '/'));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (Array.isArray(n.tags) ? n.tags : []).some(t => t.toLowerCase().includes(q)) ||
        n.folder.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      // Pinned notes always first (beta)
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      let cmp = 0;
      if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'date') cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else if (sortKey === 'size') cmp = a.content.length - b.content.length;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [notes, filterType, filterFolder, search, sortKey, sortDir]);

  // Derived: filtered courses
  const filteredCourses = useMemo(() => {
    if (!courseSearch.trim()) return courses;
    const q = courseSearch.toLowerCase();
    return courses.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.shortName.toLowerCase().includes(q)
    );
  }, [courses, courseSearch]);

  // Derived: stats
  const totalChapters = useMemo(() => {
    return courses.reduce((sum, c) => sum + (c.topics?.length || 0), 0);
  }, [courses]);

  const totalQuizzes = quizHistory.filter(q => q.score >= 0).length;

  const selectedNote = notes.find(n => n.id === selectedId) || null;

  // ─── Note CRUD Actions ───
  function createNote() {
    const now = new Date().toISOString();
    const newNote: Note = {
      id: generateId(),
      title: 'Untitled Note',
      content: '',
      folder: 'General',
      tags: [],
      createdAt: now,
      updatedAt: now,
      type: 'note',
    };
    const updated = [newNote, ...notes];
    persistNotes(updated);
    setSelectedId(newNote.id);
    setView('editor');
  }

  function saveNote(note: Note) {
    const exists = notes.some(n => n.id === note.id);
    const savedNote = { ...note, updatedAt: new Date().toISOString() };
    const updated = exists
      ? notes.map(n => n.id === note.id ? savedNote : n)
      : [savedNote, ...notes]; // If note was lost (e.g., cross-tab sync), re-add it
    persistNotes(updated);
    setView('viewer');
    // #16 Auto-tag: call AI for new notes with no tags (beta only)
    if (isAIConfigured() && !exists && (!note.tags || note.tags.length === 0) && note.content.length > 50) {
      callAI([{ role: 'user', content: `Generate 3-5 short topic tags for this note. Respond with only a JSON array of strings, no explanation.\n\nNote title: ${note.title}\n\nContent: ${note.content.slice(0, 800)}` }], {}, 'analysis')
        .then(res => {
          try {
            const tags = JSON.parse(res.replace(/```json|```/g, '').trim()) as string[];
            if (Array.isArray(tags) && tags.length > 0) {
              setPendingAutoTags({ noteId: note.id, tags: tags.slice(0, 5) });
            }
          } catch {}
        }).catch(() => {});
    }
  }

  function deleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    const updated = notes.filter(n => n.id !== id);
    persistNotes(updated);
    if (selectedId === id) {
      setSelectedId(null);
      setView('list');
    }
  }

  function duplicateNote(note: Note) {
    const now = new Date().toISOString();
    const dup: Note = {
      ...note,
      id: generateId(),
      title: note.title + ' (copy)',
      createdAt: now,
      updatedAt: now,
    };
    persistNotes([dup, ...notes]);
  }

  function renameNote(id: string, newTitle: string) {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const updated = notes.map(n => n.id === id ? { ...n, title: trimmed, updatedAt: new Date().toISOString() } : n);
    persistNotes(updated);
    setRenamingId(null);
  }

  // ─── Folder Actions ───
  function createEmptyFolder(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = (data?.pluginData?.noteFolders as string[] | undefined) ?? [];
    if (current.includes(trimmed) || folders.includes(trimmed)) return;
    updatePluginData({ noteFolders: [...current, trimmed] });
    setFilterFolder(trimmed);
    setCreatingFolder(false);
    setNewFolderInput('');
  }

  function renameFolderAction(oldPath: string, newPath: string) {
    const trimmed = newPath.trim();
    if (!trimmed || trimmed === oldPath) { setRenamingFolder(null); return; }
    const updatedNotes = notes.map(n => {
      if (n.folder === oldPath) return { ...n, folder: trimmed };
      if (n.folder.startsWith(oldPath + '/')) return { ...n, folder: trimmed + n.folder.slice(oldPath.length) };
      return n;
    });
    persistNotes(updatedNotes);
    const current = (data?.pluginData?.noteFolders as string[] | undefined) ?? [];
    updatePluginData({ noteFolders: current.map(f => f === oldPath ? trimmed : f.startsWith(oldPath + '/') ? trimmed + f.slice(oldPath.length) : f) });
    if (filterFolder === oldPath) setFilterFolder(trimmed);
    setRenamingFolder(null);
  }

  function deleteFolderAction(path: string) {
    const notesInFolder = notes.filter(n => n.folder === path || n.folder.startsWith(path + '/'));
    const msg = notesInFolder.length > 0
      ? `Move ${notesInFolder.length} note(s) in "${path}" to General and delete this folder?`
      : `Delete folder "${path}"?`;
    if (!confirm(msg)) return;
    if (notesInFolder.length > 0) {
      persistNotes(notes.map(n => (n.folder === path || n.folder.startsWith(path + '/')) ? { ...n, folder: 'General' } : n));
    }
    const current = (data?.pluginData?.noteFolders as string[] | undefined) ?? [];
    updatePluginData({ noteFolders: current.filter(f => f !== path && !f.startsWith(path + '/')) });
    if (filterFolder === path || filterFolder.startsWith(path + '/')) setFilterFolder('all');
  }

  function exportNote(note: Note) {
    exportNoteAsMarkdown(note as import('../types').Note);
  }

  function importFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.md,.html,.json';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files) return;
      const now = new Date().toISOString();
      const newNotes: Note[] = [];
      for (const file of Array.from(input.files)) {
        const content = await file.text();
        newNotes.push({
          id: generateId(),
          title: file.name.replace(/\.[^/.]+$/, ''),
          content,
          folder: 'Imported',
          tags: [],
          createdAt: now,
          updatedAt: now,
          type: 'note',
        });
      }
      persistNotes([...newNotes, ...notes]);
    };
    input.click();
  }

  function openNote(id: string) {
    setSelectedId(id);
    setView('viewer');
  }

  // ─── Course Actions ───
  function addCourse() {
    if (!newCourseName.trim() || !data) return;
    const newCourse = {
      id: generateId(),
      name: newCourseName.trim(),
      shortName: newCourseShort.trim() || newCourseName.trim().substring(0, 8).toUpperCase(),
      color: newCourseColor,
      topics: [],
      flashcards: [],
    };
    setData(prev => {
      const updatedCourses = [...(prev.pluginData.coachData?.courses || []), newCourse];
      return { ...prev, pluginData: { ...prev.pluginData, coachData: { ...prev.pluginData.coachData, courses: updatedCourses } } };
    });
    setNewCourseName('');
    setNewCourseShort('');
    setNewCourseColor(PRESET_COLORS[4]);
    setShowNewCourse(false);
  }

  // ─── Match quiz to a course (robust: checks id, name, shortName) ───
  function quizMatchesCourse(q: any, course: Course): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[\s\-_]+/g, '');
    const sub = (q.subject || '').toLowerCase();
    const subN = norm(q.subject || '');
    const qName = (q.name || '').toLowerCase();
    const cId = course.id.toLowerCase();
    const cName = course.name.toLowerCase();
    const cShort = (course.shortName || '').toLowerCase();
    const cShortN = norm(course.shortName || '');
    const cNameN = norm(course.name);
    return (
      sub === cId || sub === cName || sub === cShort ||
      subN === cShortN || subN === cNameN ||
      qName.includes(cName) || qName.includes(cShort) ||
      (cShort && sub.includes(cShort)) ||
      (cShortN && subN.includes(cShortN)) ||
      (subN && cNameN.includes(subN))
    );
  }

  // ─── Compute mastery for a course ───
  function getCourseMastery(course: Course): number {
    const courseQuizzes = quizHistory.filter(q => quizMatchesCourse(q, course) && q.score >= 0);
    if (courseQuizzes.length === 0) return 0;
    const totalScore = courseQuizzes.reduce((sum, q) => sum + (q.score || 0), 0);
    return Math.max(0, Math.round(totalScore / courseQuizzes.length));
  }

  function getCourseQuizCount(course: Course): number {
    return quizHistory.filter(q => quizMatchesCourse(q, course) && q.score >= 0).length;
  }

  // ─── Render: Note Viewer / Editor interceptors (only when on Notes tab) ───
  // Fallback: if view is 'viewer' but selectedNote is null (e.g., note was lost to cross-tab sync), go back to list
  if (activeTab === 'notes' && view === 'viewer' && !selectedNote) {
    // Use queueMicrotask to avoid setting state during render
    queueMicrotask(() => setView('list'));
  }
  if (activeTab === 'notes' && view === 'viewer' && selectedNote) {
    return <NoteViewer note={selectedNote} onBack={() => { setView('list'); }} onEdit={() => setView('editor')} onDelete={() => deleteNote(selectedNote.id)} onDuplicate={() => duplicateNote(selectedNote)} onExport={() => exportNote(selectedNote)} onExportLatex={() => exportNoteAsLatex(selectedNote)} onUpdate={(updated) => persistNotes(notes.map(n => n.id === updated.id ? updated : n))} />;
  }

  if (activeTab === 'notes' && view === 'editor') {
    const editNote = selectedNote || {
      id: generateId(), title: 'Untitled Note', content: '', folder: 'General',
      tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), type: 'note' as const,
    };
    return <NoteEditor note={editNote} folders={allFolders} courses={courses} onSave={saveNote} onCancel={() => { setView(selectedNote ? 'viewer' : 'list'); }} />;
  }

  /* ═══════════════════════════════════════════════════════
     MAIN RENDER — Tabs: Course Spaces | Notes
     ═══════════════════════════════════════════════════════ */

  // Show loading state while data is being loaded from IndexedDB
  if (!loaded) {
    return (
      <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Loading library...</div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-subtitle">Course Spaces, Notes, Drawings & Study</p>
        </div>
      </div>

      {/* Tab chips */}
      <div className="flex gap-2 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <button
          className={`cx-chip${activeTab === 'courses' ? ' active' : ''}`}
          onClick={() => setActiveTab('courses')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            minHeight: 36,
          }}
        >
          <GraduationCap size={14} /> Course Spaces
          <span style={{
            background: activeTab === 'courses' ? 'var(--text-primary)' : 'var(--border)',
            color: activeTab === 'courses' ? 'var(--bg-primary)' : 'var(--text-muted)',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            marginLeft: 2,
          }}>
            {courses.length}
          </span>
        </button>
        <button
          className={`cx-chip${activeTab === 'notes' ? ' active' : ''}`}
          onClick={() => { setActiveTab('notes'); setView('list'); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            minHeight: 36,
          }}
        >
          <FileText size={14} /> Notes
          <span style={{
            background: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--border)',
            color: activeTab === 'notes' ? 'var(--bg-primary)' : 'var(--text-muted)',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            marginLeft: 2,
          }}>
            {notes.length}
          </span>
        </button>
        <button
          className={`cx-chip${activeTab === 'drawings' ? ' active' : ''}`}
          onClick={() => setActiveTab('drawings')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            minHeight: 36,
          }}
        >
          <NotebookPen size={14} /> Drawings
          <span style={{
            background: activeTab === 'drawings' ? 'var(--text-primary)' : 'var(--border)',
            color: activeTab === 'drawings' ? 'var(--bg-primary)' : 'var(--text-muted)',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            marginLeft: 2,
          }}>
            {data?.pluginData?.drawings?.length || 0}
          </span>
        </button>
        <button
          className={`cx-chip${activeTab === 'study' ? ' active' : ''}`}
          onClick={() => setActiveTab('study')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            minHeight: 36,
          }}
        >
          <Target size={14} /> Study
        </button>
        <button
          className={`cx-chip${activeTab === 'annotations' ? ' active' : ''}`}
          onClick={() => setActiveTab('annotations')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', fontSize: 12, fontWeight: 700,
            minHeight: 36,
          }}
        >
          <NotebookPen size={14} /> Annotations
          <span style={{
            background: activeTab === 'annotations' ? 'var(--text-primary)' : 'var(--border)',
            color: activeTab === 'annotations' ? 'var(--bg-primary)' : 'var(--text-muted)',
            borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 800,
            marginLeft: 2,
          }}>
            {annotationCount}
          </span>
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════
          TAB 1: COURSE SPACES
          ═════════════════════════════════════════════════════ */}
      {activeTab === 'courses' && (
        <div>
          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: 14 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              type="text"
              value={courseSearch}
              onChange={e => setCourseSearch(e.target.value)}
              placeholder="Search courses..."
              style={{
                width: '100%', padding: '10px 12px 10px 38px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            {courseSearch && (
              <button
                onClick={() => setCourseSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Section heading */}
          <div className="section-title" style={{ marginBottom: 12 }}>
            <GraduationCap size={14} /> Course Spaces
          </div>

          {/* Stat cards row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 18,
          }}>
            {[
              { icon: GraduationCap, value: courses.length, label: 'Courses' },
              { icon: Trophy, value: totalQuizzes, label: 'Quizzes' },
              { icon: BookOpen, value: totalChapters, label: 'Chapters' },
              { icon: FileText, value: notes.length, label: 'Notes' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 6px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}>
                <stat.icon size={14} style={{ color: 'var(--text-muted)' }} />
                <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1.1, color: 'var(--text-primary)' }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '1px', fontWeight: 700,
                }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Course cards grid */}
          {filteredCourses.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--radius)',
                background: 'var(--accent-glow)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <GraduationCap size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                {courseSearch ? 'No matching courses' : 'No courses yet'}
              </h3>
              <p style={{ maxWidth: 320, lineHeight: 1.6 }}>
                {courseSearch
                  ? 'Try a different search term or clear your search.'
                  : 'Create your first course to organize your study materials, track quizzes, and monitor your progress.'}
              </p>
              {!courseSearch && (
                <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={() => setShowNewCourse(true)}>
                    <Plus size={14} /> Create Course
                  </button>
                </div>
              )}
              {courseSearch && (
                <button className="btn btn-secondary mt-4" onClick={() => setCourseSearch('')}>
                  <X size={14} /> Clear Search
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              marginBottom: 16,
            }}>
              {filteredCourses.map(course => {
                const mastery = getCourseMastery(course);
                const qCount = getCourseQuizCount(course);
                const chCount = course.topics?.length || 0;
                const fcCount = course.flashcards?.length || 0;

                return (
                  <div
                    key={course.id}
                    className="course-card"
                    onClick={() => navigate(`/course?id=${course.id}`)}
                    style={{ overflow: 'hidden' }}
                  >
                    {/* Color accent bar */}
                    <div
                      className="course-card-accent"
                      style={{ background: course.color || '#64748b' }}
                    />

                    {/* Course name */}
                    <div className="course-card-name" style={{ marginBottom: 2 }}>
                      {course.name}
                    </div>

                    {/* Short name / code */}
                    <div className="course-card-short">
                      {course.shortName}
                    </div>

                    {/* Stats badges */}
                    <div className="course-card-stats">
                      <span className="badge" style={{ fontSize: 9 }} title={`${chCount} chapters`}>
                        <BookOpen size={9} /> {chCount} chapters
                      </span>
                      <span className="badge" style={{ fontSize: 9 }} title={`${qCount} quizzes`}>
                        <Trophy size={9} /> {qCount} quizzes
                      </span>
                      <span className="badge" style={{ fontSize: 9 }} title={`${fcCount} flashcards`}>
                        <Brain size={9} /> {fcCount} flashcards
                      </span>
                    </div>

                    {/* Mastery progress bar */}
                    <div style={{ paddingLeft: 10, marginTop: 8 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 3 }}>
                        <span style={{
                          fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase',
                          letterSpacing: '0.5px', fontWeight: 700,
                        }}>
                          Mastery
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)' }}>
                          {mastery}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${mastery}%`,
                            background: course.color || 'var(--text-muted)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* New Course inline form */}
          {showNewCourse && (
            <div className="card mb-4" style={{ padding: 16 }}>
              <div className="section-title" style={{ marginBottom: 10 }}>
                <Plus size={14} /> New Course
              </div>

              {/* Course name */}
              <input
                type="text"
                value={newCourseName}
                onChange={e => setNewCourseName(e.target.value)}
                placeholder="Course name (e.g. Biology 101)"
                style={{
                  width: '100%', padding: '8px 12px', marginBottom: 8,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
                autoFocus
              />

              {/* Short name */}
              <input
                type="text"
                value={newCourseShort}
                onChange={e => setNewCourseShort(e.target.value)}
                placeholder="Short code (e.g. BIO101)"
                style={{
                  width: '100%', padding: '8px 12px', marginBottom: 10,
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              />

              {/* Color picker */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '1px', fontWeight: 700, marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Palette size={11} /> Accent Color
                </div>
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewCourseColor(color)}
                      style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                        background: color, border: newCourseColor === color
                          ? '2px solid var(--text-primary)'
                          : '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s',
                        outline: 'none',
                      }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button className="btn btn-sm btn-primary" onClick={addCourse} disabled={!newCourseName.trim()}>
                  <Check size={13} /> Create
                </button>
                <button className="btn btn-sm btn-secondary" onClick={() => setShowNewCourse(false)}>
                  <X size={13} /> Cancel
                </button>
              </div>
            </div>
          )}

          {/* Bottom action bar */}
          <div className="flex gap-2" style={{
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}>
            {!showNewCourse && (
              <button className="btn btn-sm btn-primary" onClick={() => setShowNewCourse(true)}>
                <Plus size={13} /> New Course
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════
          TAB 2: NOTES (legacy Library)
          ═════════════════════════════════════════════════════ */}
      {activeTab === 'notes' && view === 'list' && (
        <div>
          {/* #16 Auto-tag accept/reject banner (beta) */}
          {pendingAutoTags && (() => {
            const noteForTags = notes.find(n => n.id === pendingAutoTags.noteId);
            if (!noteForTags) return null;
            return (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--color-accent, #F5A623)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>✨ AI suggested tags for "{noteForTags.title}"</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {pendingAutoTags.tags.map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(245,166,35,0.15)', border: '1px solid var(--color-accent, #F5A623)', color: 'var(--color-accent, #F5A623)', cursor: 'default' }}>#{tag}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => {
                    const updated = notes.map(n => n.id === pendingAutoTags.noteId ? { ...n, tags: [...(n.tags || []), ...pendingAutoTags.tags.filter(t => !(n.tags || []).includes(t))] } : n);
                    persistNotes(updated);
                    setPendingAutoTags(null);
                  }}>Accept All</button>
                  <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setPendingAutoTags(null)}>Dismiss</button>
                </div>
              </div>
            );
          })()}

          {/* Header with actions */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-title" style={{ marginBottom: 0 }}>
                <FileText size={14} /> Notes
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{notes.length} items</p>
            </div>
            <div className="flex gap-2">
              {notes.length > 0 && (
                <button className="btn btn-sm btn-secondary" onClick={() => exportAllNotesAsMarkdown(notes as import('../types').Note[])} title="Export all notes as Markdown">
                  <Download size={14} /> Export All
                </button>
              )}
              <button className="btn btn-sm btn-secondary" onClick={importFile} title="Import file">
                <Upload size={14} /> Import
              </button>
              <button className="btn btn-sm btn-primary" onClick={createNote} title="New note">
                <Plus size={14} /> New
              </button>
            </div>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', pointerEvents: 'none',
            }} />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes, flashcards, quizzes, tags, headings, and more..."
              style={{
                width: '100%', padding: '10px 12px 10px 38px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-input)', color: 'var(--text-primary)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 4,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 mb-3" style={{ overflowX: 'auto', paddingBottom: 4 }}>
            {FILTER_CHIPS.map(chip => (
              <button
                key={chip.key}
                className={`btn btn-sm ${filterType === chip.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterType(chip.key)}
                style={{ whiteSpace: 'nowrap' }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Folder tree + management */}
          <div className="card mb-3" style={{ padding: '8px 10px' }}>
            <div style={{
              fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '1px', fontWeight: 700, marginBottom: 6,
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <FolderOpen size={11} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>Folders</span>
              <button
                onClick={() => { setCreatingFolder(v => !v); setNewFolderInput(''); }}
                title="New folder"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2, display: 'flex', lineHeight: 1 }}
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Inline new folder input */}
            {creatingFolder && (
              <div className="flex items-center gap-1 mb-1">
                <input
                  autoFocus
                  value={newFolderInput}
                  onChange={e => setNewFolderInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') createEmptyFolder(newFolderInput);
                    if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderInput(''); }
                  }}
                  placeholder="Folder name (use / for sub)..."
                  style={{
                    flex: 1, padding: '4px 8px', border: '1px solid var(--accent, #F5A623)',
                    borderRadius: 4, background: 'var(--bg-input)', color: 'var(--text-primary)',
                    fontSize: 12, fontFamily: 'inherit', outline: 'none',
                  }}
                />
                <button onClick={() => createEmptyFolder(newFolderInput)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent, #F5A623)', padding: 2 }}>
                  <Check size={13} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* All Notes */}
              <button
                onClick={() => setFilterFolder('all')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                  background: filterFolder === 'all' ? 'var(--accent-glow)' : 'transparent',
                  border: 'none', borderRadius: 4, cursor: 'pointer',
                  color: filterFolder === 'all' ? 'var(--accent-light)' : 'var(--text-secondary)',
                  fontFamily: 'inherit', fontSize: 12, fontWeight: filterFolder === 'all' ? 700 : 500,
                  width: '100%', textAlign: 'left',
                }}
              >
                <Layers size={13} />
                <span style={{ flex: 1 }}>All Notes</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{notes.length}</span>
              </button>


              {/* Folder rows */}
              {allFolders.map(f => {
                const parts = f.split('/');
                const depth = parts.length - 1;
                const displayName = parts[parts.length - 1];
                const count = notes.filter(n => n.folder === f || n.folder.startsWith(f + '/')).length;
                const isActive = filterFolder === f || filterFolder.startsWith(f + '/');
                const isHovered = folderHover === f;
                const isRenaming = renamingFolder === f;

                return (
                  <div
                    key={f}
                    onMouseEnter={() => setFolderHover(f)}
                    onMouseLeave={() => setFolderHover(null)}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverFolder(f); }}
                    onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolder(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOverFolder(null);
                      try {
                        const { id, type } = JSON.parse(e.dataTransfer.getData('text/plain'));
                        if (type === 'note') {
                          persistNotes(notes.map(n => n.id === id ? { ...n, folder: f } : n));
                        }
                      } catch {}
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', borderRadius: 4,
                      background: dragOverFolder === f ? 'var(--accent-glow)' : filterFolder === f ? 'var(--accent-glow)' : 'transparent',
                      outline: dragOverFolder === f ? '1px solid var(--accent, #F5A623)' : 'none',
                      transition: 'outline 0.1s',
                    }}
                  >
                    {isRenaming ? (
                      <div className="flex items-center gap-1" style={{ flex: 1, padding: '3px 8px', paddingLeft: 8 + depth * 14 }}>
                        <input
                          autoFocus
                          value={renameFolderValue}
                          onChange={e => setRenameFolderValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameFolderAction(f, renameFolderValue);
                            if (e.key === 'Escape') setRenamingFolder(null);
                          }}
                          onBlur={() => renameFolderAction(f, renameFolderValue)}
                          style={{
                            flex: 1, padding: '2px 6px', border: '1px solid var(--accent, #F5A623)',
                            borderRadius: 3, background: 'var(--bg-input)', color: 'var(--text-primary)',
                            fontSize: 12, fontFamily: 'inherit', outline: 'none',
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setFilterFolder(f === filterFolder ? 'all' : f)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                          padding: '5px 8px', paddingLeft: 8 + depth * 14,
                          background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer',
                          color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
                          fontFamily: 'inherit', fontSize: 12, fontWeight: filterFolder === f ? 700 : 500,
                          textAlign: 'left',
                        }}
                      >
                        {depth > 0 ? <FolderOpen size={12} /> : <Folder size={13} />}
                        <span style={{ flex: 1 }} className="truncate">{displayName}</span>
                        {!isHovered && <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>}
                      </button>
                    )}
                    {/* Rename / Delete icons — show on hover */}
                    {isHovered && !isRenaming && (
                      <div className="flex items-center" style={{ gap: 1, paddingRight: 4, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); setRenamingFolder(f); setRenameFolderValue(f); }}
                          title="Rename folder"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', borderRadius: 3, display: 'flex' }}
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deleteFolderAction(f); }}
                          title="Delete folder"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px 3px', borderRadius: 3, display: 'flex' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end mb-3" style={{ gap: 8 }}>
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <select
                value={sortKey}
                onChange={e => setSortKey(e.target.value as SortKey)}
                style={{
                  padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4,
                  background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
                }}
              >
                <option value="date">Date</option>
                <option value="name">Name</option>
                <option value="size">Size</option>
              </select>
              <button
                className="btn-icon"
                onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                style={{ padding: 4, minHeight: 28, minWidth: 28 }}
                title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              >
                {sortDir === 'asc' ? <SortAsc size={14} /> : <SortDesc size={14} />}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {filteredNotes.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 24px' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 'var(--radius)',
                background: 'var(--accent-glow)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 16,
              }}>
                <FileText size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
                {search ? 'No matching notes' : (filterType !== 'all' ? `No ${typeLabel(filterType as Note['type']).toLowerCase()}s found` : 'No notes yet')}
              </h3>
              <p style={{ maxWidth: 320, lineHeight: 1.6 }}>
                {search
                  ? 'Try a different search term or clear your filters.'
                  : filterType !== 'all'
                    ? 'No items match the current filter. Try selecting "All" or create a new note.'
                    : 'Start by creating a note or importing files. Your quizzes, flashcards, and AI outputs will also appear here.'}
              </p>
              {!search && filterType === 'all' && (
                <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={createNote}>
                    <Plus size={14} /> Create Note
                  </button>
                  <button className="btn btn-secondary" onClick={importFile}>
                    <Upload size={14} /> Import Files
                  </button>
                </div>
              )}
              {(search || filterType !== 'all') && (
                <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                  {search && (
                    <button className="btn btn-secondary" onClick={() => setSearch('')}>
                      <X size={14} /> Clear Search
                    </button>
                  )}
                  {filterType !== 'all' && (
                    <button className="btn btn-secondary" onClick={() => setFilterType('all')}>
                      Show All
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {filteredNotes.slice(0, notesLimit).map(note => {
                const Icon = typeIcon(note.type);
                return (
                  <div
                    key={note.id}
                    onClick={() => openNote(note.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openNote(note.id); }}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData('text/plain', JSON.stringify({ id: note.id, type: 'note' }));
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="card"
                    style={{
                      cursor: 'grab', textAlign: 'left', border: '1px solid var(--border)',
                      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                      width: '100%', fontFamily: 'inherit', background: 'var(--bg-card)',
                    }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                      background: 'var(--accent-glow)', color: 'var(--accent-light)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {renamingId === note.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => renameNote(note.id, renameValue)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameNote(note.id, renameValue);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontWeight: 600, fontSize: 14, width: '100%',
                            background: 'var(--bg-primary)', border: '1px solid var(--accent)',
                            borderRadius: 'var(--radius-sm)', padding: '2px 6px',
                            color: 'var(--text-primary)', fontFamily: 'inherit',
                          }}
                        />
                      ) : (
                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }} className="truncate">
                          {note.title}
                          {note.courseId && (() => {
                            const c = courses.find(c => c.id === note.courseId);
                            return c ? (
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: '1px 6px',
                                borderRadius: 9999, color: '#fff', flexShrink: 0,
                                background: c.color || 'var(--accent)',
                                lineHeight: '16px', whiteSpace: 'nowrap',
                              }}>
                                {c.shortName}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <div className="text-xs text-muted" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span>{typeLabel(note.type)}</span>
                        {note.folder && <><span style={{ opacity: 0.4 }}>|</span><span>{note.folder}</span></>}
                        <span style={{ opacity: 0.4 }}>|</span>
                        <span>{formatDateShort(note.updatedAt)}</span>
                        {note.content && note.content.trim().length > 0 && (
                          <>
                            <span style={{ opacity: 0.4 }}>|</span>
                            <span>{note.content.trim().split(/\s+/).length} words</span>
                          </>
                        )}
                      </div>
                      {/* Topic tags */}
                      {note.topicIds && note.topicIds.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                          {note.topicIds.slice(0, 3).map(tid => {
                            const tName = topicNameMap.get(tid);
                            if (!tName) return null;
                            return (
                              <span key={tid} style={{
                                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                                background: 'var(--accent-glow)', color: 'var(--accent-light)',
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
                    </div>
                    <button
                        title={note.pinned ? 'Unpin' : 'Pin to top'}
                        onClick={e => {
                          e.stopPropagation();
                          const updated = notes.map(n => n.id === note.id ? { ...n, pinned: !n.pinned } : n)
                          updatePluginData({ notes: updated })
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: note.pinned ? 'var(--color-accent, #F5A623)' : 'var(--text-muted)',
                          padding: 4, flexShrink: 0, fontSize: 13,
                        }}
                      >📌</button>
                    <button
                      title="Rename"
                      onClick={e => {
                        e.stopPropagation();
                        setRenamingId(note.id);
                        setRenameValue(note.title);
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', padding: 4, flexShrink: 0,
                      }}
                    >
                      <Edit3 size={13} />
                    </button>
                    <div className="text-xs text-muted" style={{ flexShrink: 0 }}>
                      {note.content.trim().split(/\s+/).filter(Boolean).length} words
                    </div>
                  </div>
                );
              })}
              {filteredNotes.length > notesLimit && (
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setNotesLimit(l => l + 50)}>
                  Load more ({filteredNotes.length - notesLimit} remaining)
                </button>
              )}
            </div>
          )}

          {/* Drawing search results */}
          {search.trim() && (() => {
            const drawings = (data?.pluginData?.drawings || []) as { id: string; name: string; folder?: string; updatedAt: string }[];
            const q = search.toLowerCase();
            const matchedDrawings = drawings.filter(d =>
              d.name.toLowerCase().includes(q) ||
              (d.folder || '').toLowerCase().includes(q)
            );
            if (matchedDrawings.length === 0) return null;
            return (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  <Palette size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  Drawings ({matchedDrawings.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {matchedDrawings.map(d => (
                    <div key={d.id}
                      onClick={() => { setActiveTab('drawings'); }}
                      className="card"
                      style={{
                        cursor: 'pointer', padding: '10px 14px', display: 'flex',
                        alignItems: 'center', gap: 10, border: '1px solid var(--border)',
                        background: 'var(--bg-card)',
                      }}
                    >
                      <Palette size={16} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{d.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {d.folder || 'General'} &middot; Drawing
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Cornell notes search results */}
          {search.trim() && (() => {
            try {
              const cornellNotes = JSON.parse(localStorage.getItem('cornell-notes') || '[]') as { id: string; topic: string; courseId: string; cues: string; notes: string; summary: string; updatedAt: string }[];
              const q = search.toLowerCase();
              const matchedCornell = cornellNotes.filter(n =>
                n.topic.toLowerCase().includes(q) ||
                n.cues.replace(/<[^>]+>/g, ' ').toLowerCase().includes(q) ||
                n.notes.replace(/<[^>]+>/g, ' ').toLowerCase().includes(q) ||
                n.summary.replace(/<[^>]+>/g, ' ').toLowerCase().includes(q)
              );
              // Exclude Cornell notes already shown as Library notes (cross-saved)
              const libIds = new Set(notes.map(n => n.id));
              const unique = matchedCornell.filter(n => !libIds.has(`cornell-${n.id}`));
              if (unique.length === 0) return null;
              return (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                    <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Cornell Notes ({unique.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {unique.map(n => (
                      <div key={n.id}
                        onClick={() => { window.location.hash = '#/learn?tab=study'; }}
                        className="card"
                        style={{
                          cursor: 'pointer', padding: '10px 14px', display: 'flex',
                          alignItems: 'center', gap: 10, border: '1px solid var(--border)',
                          background: 'var(--bg-card)',
                        }}
                      >
                        <FileText size={16} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{n.topic || 'Untitled'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Cornell Note
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            } catch { return null; }
          })()}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════
          TAB 3: DRAWINGS
          ═════════════════════════════════════════════════════ */}
      {activeTab === 'drawings' && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading drawings...</div>}>
          <DrawPage embedded />
        </Suspense>
      )}

      {/* ═════════════════════════════════════════════════════
          TAB 4: STUDY MODES
          ═════════════════════════════════════════════════════ */}
      {activeTab === 'study' && (
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading study modes...</div>}>
          <StudyModesPage embedded />
        </Suspense>
      )}

      {/* ═════════════════════════════════════════════════════
          TAB 5: ANNOTATIONS
          ═════════════════════════════════════════════════════ */}
      {activeTab === 'annotations' && (
        <AnnotationsTab />
      )}
    </div>
  );
}

/* ── Annotations Tab (Scribe OS sessions) ────────────── */
import type { ScribeSession } from '../store/sessionStore';
import { loadFile, deleteFile } from '../utils/fileStore';

function AnnotationsTab() {
  const sessionsRecord = useSessionStore(s => s.sessions);
  const deleteSession = useSessionStore(s => s.deleteSession);
  const sessions = useMemo(() =>
    Object.values(sessionsRecord).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [sessionsRecord]
  );
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [canvasCache, setCanvasCache] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<ScribeSession | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const subjects = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s: ScribeSession) => { if (s.subject) set.add(s.subject); });
    return Array.from(set).sort();
  }, [sessions]);

  const filtered = useMemo(() => {
    let result = subjectFilter === 'all' ? sessions : sessions.filter((s: ScribeSession) => s.subject === subjectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.questionText.toLowerCase().includes(q) ||
        s.subject.toLowerCase().includes(q) ||
        s.textContent.toLowerCase().includes(q)
      );
    }
    return result;
  }, [sessions, subjectFilter, search]);

  // Load canvas thumbnails from IDB
  useEffect(() => {
    for (const s of sessions) {
      if (s.canvasKey && !canvasCache[s.canvasKey]) {
        loadFile(s.canvasKey).then(data => {
          if (data) setCanvasCache(prev => ({ ...prev, [s.canvasKey!]: data }));
        }).catch(console.error);
      }
    }
  }, [sessions]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = useCallback(async (sessionId: string) => {
    const s = sessionsRecord[sessionId];
    if (s?.canvasKey) await deleteFile(s.canvasKey);
    deleteSession(sessionId);
    setSelectedIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
    setConfirmDeleteId(null);
    if (selected?.sessionId === sessionId) setSelected(null);
  }, [sessionsRecord, deleteSession, selected]);

  const handleDeleteSelected = useCallback(async () => {
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} annotation${count !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const id of selectedIds) {
      const s = sessionsRecord[id];
      if (s?.canvasKey) await deleteFile(s.canvasKey);
      deleteSession(id);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [selectedIds, sessionsRecord, deleteSession]);

  const handleDeleteAll = useCallback(async () => {
    if (!window.confirm(`Delete all ${sessions.length} annotation${sessions.length !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    for (const s of sessions) {
      if (s.canvasKey) await deleteFile(s.canvasKey);
      deleteSession(s.sessionId);
    }
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [sessions, deleteSession]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  if (sessions.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>✏️</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No quiz annotations yet</h3>
        <p style={{ fontSize: 13 }}>Take notes while answering quizzes — press <kbd style={{ padding: '2px 6px', border: '1px solid var(--border)', borderRadius: 4, fontFamily: 'monospace' }}>N</kbd> during any quiz session to open the annotation panel. Your notes will appear here.</p>
      </div>
    );
  }

  // ── Detail panel ──
  if (selected && !selectMode) {
    const canvasUrl = selected.canvasKey ? canvasCache[selected.canvasKey] : null;
    return (
      <div className="animate-in">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setSelected(null)}>
            ← Back
          </button>
          <span className="badge" style={{ fontSize: 10 }}>{selected.subject}</span>
          <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
            {new Date(selected.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          <button
            className="btn btn-sm"
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            onClick={() => {
              if (window.confirm('Delete this annotation? This cannot be undone.')) {
                handleDelete(selected.sessionId);
              }
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>

        {/* Full question */}
        <div className="card" style={{ padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Question</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-primary)' }}>{selected.questionText}</div>
        </div>

        {/* Drawing */}
        {canvasUrl && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>🖼️ Drawing</div>
            <img
              src={canvasUrl}
              alt="sketch"
              style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)', background: '#1a1a2e', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Notes */}
        {selected.textContent && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>📝 Notes</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {renderNoteContent(selected.textContent)}
            </div>
          </div>
        )}

        {/* AI chat log */}
        {selected.chatLog.length > 0 && (
          <div className="card" style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              💬 Scholar Chat ({Math.ceil(selected.chatLog.length / 2)} exchange{Math.ceil(selected.chatLog.length / 2) !== 1 ? 's' : ''})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {selected.chatLog.map((msg, i) => (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 8,
                  alignItems: 'flex-start',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: msg.role === 'user' ? 'var(--accent-light)' : 'var(--green)',
                    minWidth: 28, textAlign: 'center', paddingTop: 6,
                  }}>
                    {msg.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <div style={{
                    flex: 1, padding: '8px 12px', borderRadius: 10,
                    background: msg.role === 'user' ? 'var(--surface-2)' : 'color-mix(in srgb, var(--green) 8%, var(--surface-1))',
                    border: '1px solid var(--border)',
                    fontSize: 13, lineHeight: 1.6, color: 'var(--text-primary)',
                    maxWidth: '90%',
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state if nothing recorded */}
        {!canvasUrl && !selected.textContent && selected.chatLog.length === 0 && (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
            No content recorded for this session yet.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* ── Top toolbar ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search annotations…"
            style={{
              width: '100%', paddingLeft: 32, paddingRight: search ? 32 : 10,
              height: 34, fontSize: 13,
              background: 'var(--surface-1)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Select mode toggle */}
        <button
          className={`btn btn-sm${selectMode ? ' btn-primary' : ''}`}
          onClick={() => { setSelectMode(p => !p); setSelectedIds(new Set()); setConfirmDeleteId(null); }}
          style={{ whiteSpace: 'nowrap' }}
        >
          {selectMode ? <><X size={12} /> Cancel</> : <><Check size={12} /> Select</>}
        </button>

        {/* Delete All */}
        {!selectMode && (
          <button
            className="btn btn-sm"
            style={{ color: '#ef4444', borderColor: 'color-mix(in srgb, #ef4444 30%, var(--border))', whiteSpace: 'nowrap' }}
            onClick={handleDeleteAll}
          >
            <Trash2 size={12} /> Delete All
          </button>
        )}
      </div>

      {/* ── Subject filter chips ── */}
      <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
        {['all', ...subjects].map(s => (
          <button
            key={s}
            className={`cx-chip${subjectFilter === s ? ' active' : ''}`}
            onClick={() => setSubjectFilter(s)}
            style={{ padding: '5px 12px', fontSize: 11, fontWeight: 700 }}
          >
            {s === 'all' ? `All Subjects` : s}
          </button>
        ))}
      </div>

      {/* ── Selection action bar ── */}
      {selectMode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          padding: '10px 14px', marginBottom: 12,
          background: 'var(--surface-1)', border: '1px solid var(--border)',
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', flex: 1, minWidth: 80 }}>
            {selectedIds.size} selected
          </span>
          <button
            className="btn btn-sm"
            onClick={() => setSelectedIds(new Set(filtered.map(s => s.sessionId)))}
          >
            Select All ({filtered.length})
          </button>
          <button
            className="btn btn-sm"
            onClick={() => setSelectedIds(new Set())}
            disabled={selectedIds.size === 0}
          >
            Deselect All
          </button>
          <button
            className="btn btn-sm"
            style={{
              background: selectedIds.size > 0 ? '#ef4444' : undefined,
              color: selectedIds.size > 0 ? '#fff' : undefined,
              borderColor: selectedIds.size > 0 ? '#ef4444' : undefined,
              opacity: selectedIds.size === 0 ? 0.4 : 1,
            }}
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
          >
            <Trash2 size={12} /> Delete {selectedIds.size > 0 ? selectedIds.size : ''}
          </button>
        </div>
      )}

      {/* ── Empty search state ── */}
      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
          No annotations match your filters.
        </div>
      )}

      {/* ── Session cards ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((session: ScribeSession) => {
          const isChecked = selectedIds.has(session.sessionId);
          const isConfirming = confirmDeleteId === session.sessionId;
          return (
            <div
              key={session.sessionId}
              className="card"
              style={{
                padding: 14, cursor: selectMode ? 'default' : 'pointer',
                transition: 'border-color 0.15s',
                borderColor: isChecked ? 'var(--accent)' : undefined,
                position: 'relative',
              }}
              onClick={() => {
                if (isConfirming) return;
                if (selectMode) { toggleSelect(session.sessionId); return; }
                setSelected(session);
              }}
              onMouseEnter={e => { if (!selectMode && !isChecked) e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onMouseLeave={e => { if (!isChecked) e.currentTarget.style.borderColor = ''; }}
            >
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                {/* Checkbox */}
                {selectMode && (
                  <div
                    onClick={e => { e.stopPropagation(); toggleSelect(session.sessionId); }}
                    style={{
                      width: 18, height: 18, flexShrink: 0, borderRadius: 4,
                      border: `2px solid ${isChecked ? 'var(--accent)' : 'var(--border)'}`,
                      background: isChecked ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.1s',
                    }}
                  >
                    {isChecked && <Check size={11} color="#000" strokeWidth={3} />}
                  </div>
                )}
                <span className="badge" style={{ fontSize: 10 }}>{session.subject}</span>
                <span className="text-xs text-muted" style={{ marginLeft: 'auto' }}>
                  {new Date(session.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {/* Per-card delete (not in select mode) */}
                {!selectMode && (
                  isConfirming ? (
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, padding: '2px 8px', background: '#ef4444', color: '#fff', borderColor: '#ef4444' }}
                        onClick={() => handleDelete(session.sessionId)}
                      >
                        Confirm
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm"
                      style={{ padding: '3px 6px', color: 'var(--text-muted)', marginLeft: 2 }}
                      title="Delete annotation"
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(session.sessionId); }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )
                )}
              </div>

              {/* Question preview */}
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5, marginBottom: 6 }}>
                {session.questionText.slice(0, 140)}{session.questionText.length > 140 ? '…' : ''}
              </div>

              {/* Receipt icons */}
              <div style={{ display: 'flex', gap: 6 }}>
                {session.hasCanvas && <span style={{ fontSize: 12 }} title="Has drawing">🖼️</span>}
                {session.textContent && <span style={{ fontSize: 12 }} title="Has notes">📝</span>}
                {session.chatLog.length > 0 && (
                  <span style={{ fontSize: 12 }} title="Has Scholar chat">
                    💬 {Math.ceil(session.chatLog.length / 2)}
                  </span>
                )}
              </div>

              {/* Canvas thumbnail */}
              {session.canvasKey && canvasCache[session.canvasKey] && (
                <img
                  src={canvasCache[session.canvasKey]}
                  alt="sketch"
                  style={{
                    width: '100%', borderRadius: 8, marginTop: 8,
                    border: '1px solid var(--border)', maxHeight: 120, objectFit: 'contain',
                    background: '#1a1a2e',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Note Viewer ─────────────────────────────────────── */
/** Render markdown-flavored note content */
function renderNoteContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      result.push(
        <pre key={result.length} style={{
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: 6, padding: 12, fontSize: 13, fontFamily: 'monospace',
          overflowX: 'auto', margin: '8px 0', lineHeight: 1.5,
        }}>
          {codeLines.join('\n')}
        </pre>
      );
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3;
      const sizes = { 1: 22, 2: 18, 3: 15 };
      result.push(
        <div key={result.length} style={{
          fontSize: sizes[level], fontWeight: 800, margin: `${level === 1 ? 16 : 10}px 0 6px`,
          color: 'var(--text-primary)', borderBottom: level === 1 ? '1px solid var(--border)' : undefined,
          paddingBottom: level === 1 ? 6 : undefined,
        }}>
          {renderInline(headingMatch[2])}
        </div>
      );
      i++;
      continue;
    }

    // Unordered list item
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ''));
        i++;
      }
      result.push(
        <ul key={result.length} style={{ margin: '6px 0', paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 3, lineHeight: 1.7 }}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list item
    if (/^\s*\d+[.)]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s/, ''));
        i++;
      }
      result.push(
        <ol key={result.length} style={{ margin: '6px 0', paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 3, lineHeight: 1.7 }}>{renderInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Table (pipe-delimited rows)
    if (/^\|(.+)\|/.test(line.trim())) {
      const tableRows: string[][] = [];
      let hasHeader = false;
      while (i < lines.length && /^\|(.+)\|/.test(lines[i].trim())) {
        const row = lines[i].trim();
        // Skip separator row like |---|---|---|
        if (/^\|[\s\-:|]+$/.test(row) && row.includes('-')) {
          hasHeader = tableRows.length === 1;
          i++;
          continue;
        }
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        const headerRow = hasHeader ? tableRows[0] : null;
        const bodyRows = hasHeader ? tableRows.slice(1) : tableRows;
        result.push(
          <div key={result.length} style={{ overflowX: 'auto', margin: '10px 0' }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: 13,
              border: '1px solid var(--border)', borderRadius: 6,
            }}>
              {headerRow && (
                <thead>
                  <tr>
                    {headerRow.map((cell, ci) => (
                      <th key={ci} style={{
                        padding: '8px 12px', borderBottom: '2px solid var(--accent)',
                        textAlign: 'left', fontWeight: 700, fontSize: 12,
                        textTransform: 'uppercase', letterSpacing: 0.5,
                        background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                      }}>{renderInline(cell)}</th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 ? 'var(--bg-secondary)' : 'transparent' }}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{
                        padding: '7px 12px', borderBottom: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                      }}>{renderInline(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const bqLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        bqLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      result.push(
        <blockquote key={result.length} style={{
          borderLeft: '3px solid var(--accent)', paddingLeft: 12,
          margin: '8px 0', color: 'var(--text-secondary)', fontStyle: 'italic',
        }}>
          {bqLines.map((l, j) => <div key={j}>{renderInline(l)}</div>)}
        </blockquote>
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      result.push(<hr key={result.length} style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '12px 0' }} />);
      i++;
      continue;
    }

    // Empty line
    if (!line.trim()) {
      result.push(<div key={result.length} style={{ height: 8 }} />);
      i++;
      continue;
    }

    // Normal paragraph
    result.push(
      <div key={result.length} style={{ lineHeight: 1.7, marginBottom: 2 }}>
        {renderInline(line)}
      </div>
    );
    i++;
  }

  return result;
}

/** Render inline markdown (bold, italic, code, links, images) */
function renderInline(text: string): React.ReactNode {
  // Split into segments: images, links, bold, italic, code
  const parts: React.ReactNode[] = [];
  // Pattern order matters: images before links, bold before italic
  const regex = /(!\[.*?\]\([^)]+\))|(\[([^\]]+)\]\(([^)]+)\))|(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[1]) {
      // Image ![alt](src)
      const imgMatch = match[1].match(/^!\[(.*?)\]\(([^)]+)\)$/);
      if (imgMatch) {
        parts.push(
          <img key={key++} src={imgMatch[2]} alt={imgMatch[1]} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{
            maxWidth: '100%', borderRadius: 6, margin: '8px 0',
            display: 'block', border: '1px solid var(--border)',
          }} />
        );
      }
    } else if (match[2]) {
      // Link [text](url)
      parts.push(
        <a key={key++} href={match[4]} target="_blank" rel="noopener noreferrer" style={{
          color: 'var(--accent-light)', textDecoration: 'underline',
        }}>
          {match[3]}
        </a>
      );
    } else if (match[5]) {
      // Inline code `code`
      parts.push(
        <code key={key++} style={{
          background: 'var(--bg-primary)', padding: '1px 5px', borderRadius: 3,
          fontSize: '0.9em', fontFamily: 'monospace', border: '1px solid var(--border)',
        }}>
          {match[5].slice(1, -1)}
        </code>
      );
    } else if (match[6]) {
      // Bold **text**
      parts.push(<strong key={key++}>{match[6].slice(2, -2)}</strong>);
    } else if (match[7]) {
      // Italic *text*
      parts.push(<em key={key++}>{match[7].slice(1, -1)}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

function splitAtLabPlaceholder(html: string): [string, string] | null {
  const match = html.match(/<div[^>]*data-nousai-lab[^>]*>[\s\S]*?<\/div>/);
  if (!match || match.index === undefined) return null;
  return [html.slice(0, match.index), html.slice(match.index + match[0].length)];
}

function NoteViewer({ note, onBack, onEdit, onDelete, onDuplicate, onExport, onExportLatex, onUpdate }: {
  note: Note;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onExportLatex: () => void;
  onUpdate: (updated: Note) => void;
}) {
  const [showHtml, setShowHtml] = useState(false);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [recallMode, setRecallMode] = useState(false);
  const [recallText, setRecallText] = useState('');
  const [showRecallAnswer, setShowRecallAnswer] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [labHtml, setLabHtml] = useState<string | null>(note.labHtml ?? null);
  const [showLab, setShowLab] = useState(!!note.labHtml);
  const [labLoading, setLabLoading] = useState(false);
  const isHtml = (note.content.trim().startsWith('<') && note.content.includes('>')) ||
    /<(mark|div|table|span|p|h[1-6]|strong|ul|ol|li|br)\b/i.test(note.content);

  // Detect Cornell JSON format: {"cues":"...","notes":"...","summary":"..."}
  const cornellData = (() => {
    const t = note.content.trim();
    if (!t.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(t);
      if (parsed && (parsed.cues || parsed.notes || parsed.summary)) return parsed as { cues?: string; notes?: string; summary?: string };
    } catch { /* not JSON */ }
    return null;
  })();

  async function aiGenerateCornell() {
    if (!isAIConfigured()) { alert('AI is not configured. Go to Settings to set up an AI provider and API key.'); return; }
    setAiLoading(true);
    try {
      const plainContent = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const prompt = `Create a Cornell Note from the following content.\nTitle: ${note.title}\nContent: ${plainContent.slice(0, 3000)}\n\nReturn ONLY a JSON object (no markdown fences):\n{"cues":"HTML key questions/keywords (use <ul><li>)","notes":"HTML detailed notes (use <h3>,<p>,<ul><li>,<strong>)","summary":"HTML summary in 2-3 sentences"}`;
      const result = await callAI([{ role: 'user', content: prompt }], {}, 'analysis');
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (parsed.cues) {
        localStorage.setItem('nousai-cornell-prefill', JSON.stringify({
          topic: note.title,
          content: plainContent.slice(0, 2000),
          courseId: note.courseId || '',
          topicIds: note.topicIds || [],
          aiCues: parsed.cues,
          aiNotes: parsed.notes || '',
          aiSummary: parsed.summary || '',
        }));
        window.location.hash = '#/learn?tab=study';
      }
    } catch (err) {
      console.error('AI Cornell generation failed:', err);
      alert('AI generation failed. Check your AI settings and try again.');
    } finally { setAiLoading(false); }
  }

  function goToJpStudy() {
    // Pre-fill the JP Study tool with this note's full content in Full Note mode
    const plainContent = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    localStorage.setItem('nousai-jp-prefill', JSON.stringify({
      title: note.title,
      content: plainContent.slice(0, 5000),
      fullNote: true,
    }));
    window.location.hash = '#/ai?tool=nihongo';
  }

  async function aiGenerateFlashcards() {
    if (!isAIConfigured()) { alert('AI is not configured. Go to Settings to set up an AI provider and API key.'); return; }
    setAiLoading(true);
    try {
      const plainContent = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const prompt = `Create 5-10 flashcards from the following content.\nTitle: ${note.title}\nContent: ${plainContent.slice(0, 3000)}\n\nReturn ONLY a JSON array (no markdown fences):\n[{"front":"question or term","back":"answer or definition"}]`;
      const result = await callAI([{ role: 'user', content: prompt }], {}, 'analysis');
      const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const count = parsed.length;
        const preview = parsed.slice(0, 3).map((c: any, i: number) => `${i + 1}. ${c.front}`).join('\n');
        const confirmed = confirm(`Generated ${count} flashcards:\n\n${preview}\n${count > 3 ? `\n...and ${count - 3} more` : ''}\n\nSave to your flashcard deck?`);
        if (confirmed) {
          const existing = JSON.parse(localStorage.getItem('nousai-ai-flashcards') || '[]');
          const newCards = parsed.map((c: any) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), front: c.front, back: c.back, source: note.title }));
          localStorage.setItem('nousai-ai-flashcards', JSON.stringify([...existing, ...newCards]));
          alert(`${count} flashcards saved! View them in Flashcards.`);
        }
      }
    } catch (err) {
      console.error('AI flashcard generation failed:', err);
      alert('AI generation failed. Check your AI settings and try again.');
    } finally { setAiLoading(false); }
  }

  async function generateLab() {
    if (!isAIConfigured()) { alert('Configure an AI provider in Settings first.'); return; }
    setLabLoading(true);
    try {
      const plainContent = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const systemPrompt = `You are a visual lab generator embedded in a study notes app. When given a biology, physics, or science concept from the user's notes, generate a self-contained interactive HTML visual lab using only vanilla JS + SVG/Canvas — no external libraries.
Rules:
- Output ONLY raw HTML. No markdown, no explanation, no code fences.
- Must be fully interactive (sliders, buttons, animations, or click events).
- Dark background (#1a1a1a), white/neon labels, mobile-friendly.
- Include a short 1-line title and labeled controls.
- Visual must directly illustrate the concept (not generic).
- Max 150 lines. Prioritize clarity over complexity.`;
      const userPrompt = `Concept: ${note.title}\nContext: ${plainContent.slice(0, 200)}`;
      const html = await callAI(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { temperature: 0.3, maxTokens: 8192 },
        'analysis'
      );
      if (!html || html.length < 200) throw new Error('Invalid HTML response');
      const sanitized = sanitizeHtml(html);
      setLabHtml(sanitized);
      setShowLab(true);
      onUpdate({ ...note, labHtml: sanitized, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Lab generation failed:', err);
      alert('Lab generation failed. Check AI settings and try again.');
    } finally { setLabLoading(false); }
  }

  return (
    <div className="animate-in">
      {/* Header */}
      <button onClick={onBack} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
        <ChevronLeft size={14} /> Back to Library
      </button>

      <div className="flex items-center justify-between mb-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="page-title" style={{ fontSize: 20, marginBottom: 2 }}>{note.title}</h1>
          <div className="text-xs text-muted" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>{typeLabel(note.type)}</span>
            {note.folder && <><span style={{ opacity: 0.4 }}>|</span><Folder size={11} style={{ verticalAlign: 'middle' }} /> <span>{note.folder}</span></>}
            <span style={{ opacity: 0.4 }}>|</span>
            <span>Updated {formatDate(note.updatedAt)}</span>
            <span style={{ opacity: 0.4 }}>|</span>
            <span>Created {formatDate(note.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Tags */}
      {Array.isArray(note.tags) && note.tags.length > 0 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
          {note.tags.map(tag => (
            <span key={tag} className="badge badge-accent">
              <Tag size={10} /> {tag}
            </span>
          ))}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2 mb-4" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn-sm btn-primary" onClick={onEdit}><Edit3 size={13} /> Edit</button>
        <button className="btn btn-sm btn-secondary" onClick={() => {
          if (note.content) speak(note.content, { voiceLang: 'ja-JP', rate: 0.9 });
        }}><Volume2 size={13} /> Read Aloud</button>
        <button className="btn btn-sm btn-secondary" onClick={() => stopSpeaking()}><X size={13} /> Stop</button>
        <button className="btn btn-sm btn-secondary" onClick={onDuplicate}><Copy size={13} /> Duplicate</button>
        <button className="btn btn-sm btn-secondary" onClick={onExport}><Download size={13} /> Export</button>
        <button className="btn btn-sm btn-secondary" onClick={onExportLatex} title="Export as LaTeX">.tex</button>
        {isHtml && (
          <button className="btn btn-sm btn-secondary" onClick={() => setShowHtml(!showHtml)}>
            {showHtml ? <><FileText size={13} /> Text</> : <><Code size={13} /> HTML</>}
          </button>
        )}
        <button
          className="btn btn-sm btn-secondary"
          onClick={labHtml ? () => setShowLab(v => !v) : generateLab}
          disabled={labLoading}
        >
          <Microscope size={13} />
          {labLoading ? 'Generating...' : labHtml ? (showLab ? 'Hide Lab' : 'Show Lab') : 'Generate Lab'}
        </button>
        {labHtml && (
          <button className="btn btn-sm btn-secondary" onClick={generateLab} disabled={labLoading} title="Regenerate lab">
            <RefreshCw size={13} />
          </button>
        )}
        <button className="btn btn-sm btn-secondary" onClick={onDelete} style={{ color: 'var(--red)', marginLeft: 'auto' }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>

      {/* Content */}
      {!recallMode && (
        <div className="card" style={{ padding: 20 }}>
          {cornellData ? (
            <div>
              {cornellData.cues && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Cues / Key Questions</div>
                  <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(cornellData.cues) }} />
                </div>
              )}
              {cornellData.notes && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
                  <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(cornellData.notes) }} />
                </div>
              )}
              {cornellData.summary && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Summary</div>
                  <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(cornellData.summary) }} />
                </div>
              )}
            </div>
          ) : showHtml && isHtml ? (
            <iframe
              srcDoc={note.content}
              title="HTML Preview"
              sandbox="allow-same-origin"
              style={{
                width: '100%', minHeight: 400, border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', background: '#fff',
              }}
            />
          ) : isHtml ? (() => {
            // If note has an inline lab placeholder and a lab, render it inline
            if (labHtml) {
              const parts = splitAtLabPlaceholder(note.content);
              if (parts) {
                return (
                  <>
                    <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(parts[0]) }} />
                    <div style={{ borderRadius: 8, overflow: 'hidden', margin: '12px 0', border: '1px solid var(--border)' }}>
                      <iframe srcDoc={labHtml} title="Visual Lab" sandbox="allow-scripts"
                        style={{ width: '100%', height: 420, border: 'none', display: 'block' }} />
                    </div>
                    {parts[1] && (
                      <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', margin: 0 }}
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(parts[1]) }} />
                    )}
                  </>
                );
              }
            }
            return (
              <div className="prose" style={{ fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit', color: 'var(--text-primary)', margin: 0 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }} />
            );
          })() : (
            <div style={{
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontSize: 14, lineHeight: 1.7, fontFamily: 'inherit',
              color: 'var(--text-primary)', margin: 0,
            }}>
              {note.content ? renderNoteContent(note.content) : '(empty)'}
            </div>
          )}
        </div>
      )}

      {/* Visual Lab fallback (notes with lab but no inline placeholder) */}
      {showLab && labHtml && !splitAtLabPlaceholder(note.content) && (
        <div className="card" style={{ marginTop: 12, padding: 0, overflow: 'hidden' }}>
          <iframe
            srcDoc={labHtml}
            title="Visual Lab"
            sandbox="allow-scripts"
            style={{ width: '100%', height: 500, border: 'none', display: 'block' }}
          />
        </div>
      )}

      {/* Active Recall Mode */}
      {recallMode && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent, #6366f1)' }}>
              <Brain size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Active Recall
            </div>
            <button className="btn btn-sm" onClick={() => { setRecallMode(false); setShowRecallAnswer(false); setRecallText(''); }}>
              <X size={13} /> Exit
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Write everything you remember about <strong>{note.title}</strong> from memory. Then reveal the original to compare.
          </p>
          <textarea
            value={recallText}
            onChange={e => setRecallText(e.target.value)}
            placeholder="Write what you remember..."
            rows={8}
            style={{
              width: '100%', padding: 12, border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
              resize: 'vertical', outline: 'none', marginBottom: 12,
            }}
          />
          {!showRecallAnswer ? (
            <button className="btn btn-primary btn-sm" onClick={() => setShowRecallAnswer(true)} disabled={!recallText.trim()}>
              <Eye size={13} /> Reveal Original
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                Original Content
              </div>
              {isHtml ? (
                <div
                  className="prose"
                  style={{
                    padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.content) }}
                />
              ) : (
                <div style={{
                  padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                }}>
                  {note.content ? renderNoteContent(note.content) : '(empty)'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Study Tools Panel */}
      <div style={{ marginTop: 12 }}>
        <button
          onClick={() => setShowStudyTools(!showStudyTools)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            padding: '10px 14px', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
            cursor: 'pointer', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
            fontFamily: 'inherit',
          }}
        >
          <Brain size={14} style={{ color: 'var(--accent, #6366f1)' }} />
          Study This Note
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
            {showStudyTools ? '▲' : '▼'}
          </span>
        </button>
        {showStudyTools && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8,
          }}>
            {/* Active Recall */}
            <button onClick={() => { setRecallMode(true); setRecallText(''); setShowRecallAnswer(false); }} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                <Eye size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Active Recall
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Write from memory, then compare</div>
            </button>
            {/* Create Cornell Note */}
            <button onClick={() => {
              const plainContent = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              localStorage.setItem('nousai-cornell-prefill', JSON.stringify({
                topic: note.title,
                content: plainContent.slice(0, 2000),
                courseId: note.courseId || '',
                topicIds: note.topicIds || [],
              }));
              window.location.hash = '#/learn?tab=study';
            }} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                <FileText size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Cornell Note
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Create structured note from this</div>
            </button>
            {/* Quick Self-Test */}
            <button onClick={() => {
              const text = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
              const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20).slice(0, 5);
              if (sentences.length === 0) { alert('Not enough content for a self-test.'); return; }
              const questions = sentences.map(s => `Can you explain: "${s.trim().slice(0, 80)}..."?`);
              alert('Self-Test Questions:\n\n' + questions.map((q, i) => `${i + 1}. ${q}`).join('\n'));
            }} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                <Brain size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Quick Quiz
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Extract key points as questions</div>
            </button>
            {/* Focus Timer */}
            <button onClick={() => {
              window.location.hash = '#/learn?tab=study';
            }} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                <Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Study Modes
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pomodoro, Leitner, Streaks & more</div>
            </button>
            {/* AI: Cornell Note */}
            <button onClick={aiGenerateCornell} disabled={aiLoading} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: aiLoading ? 'wait' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
              opacity: aiLoading ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #6366f1)', marginBottom: 2 }}>
                <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> AI: Cornell Note
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aiLoading ? 'Generating...' : 'Generate from this content'}</div>
            </button>
            {/* AI: Flashcards */}
            <button onClick={aiGenerateFlashcards} disabled={aiLoading} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: aiLoading ? 'wait' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
              opacity: aiLoading ? 0.6 : 1,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #6366f1)', marginBottom: 2 }}>
                <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> AI: Flashcards
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aiLoading ? 'Generating...' : 'Create flashcards from note'}</div>
            </button>
            {/* JP Study Format */}
            <button onClick={goToJpStudy} style={{
              padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent, #6366f1)', marginBottom: 2 }}>
                <Languages size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> JP Study Format
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Color-coded Japanese grammar</div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Lab Picker Modal ────────────────────────────────── */
interface GeneratedLab { id: string; title: string; question: string; html: string; createdAt: string; }
function LabPickerModal({ courses, onSelect, onClose }: {
  courses: { id: string; name: string; shortName: string; color: string }[];
  onSelect: (html: string) => void;
  onClose: () => void;
}) {
  const allLabs = useMemo(() => {
    const result: { lab: GeneratedLab; courseName: string; courseColor: string }[] = [];
    courses.forEach(c => {
      try {
        const raw = localStorage.getItem(`nousai-labs-${c.id}`);
        if (!raw) return;
        const labs: GeneratedLab[] = JSON.parse(raw);
        labs.forEach(lab => result.push({ lab, courseName: c.name, courseColor: c.color }));
      } catch { /* ignore */ }
    });
    return result.sort((a, b) => b.lab.createdAt.localeCompare(a.lab.createdAt));
  }, [courses]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
        width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            <Microscope size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Pick a Visual Lab
          </div>
          <button onClick={onClose} className="btn-icon" style={{ padding: 4 }}><X size={14} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: 12, flex: 1 }}>
          {allLabs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)', fontSize: 13 }}>
              No labs yet. Generate labs from the Visual Lab tab in any course.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {allLabs.map(({ lab, courseName, courseColor }) => (
                <button
                  key={lab.id}
                  onClick={() => onSelect(lab.html)}
                  style={{
                    padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-secondary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = courseColor || 'var(--accent, #6366f1)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{
                      background: courseColor || '#6366f1', borderRadius: 3, padding: '1px 5px',
                      fontSize: 10, fontWeight: 700, color: '#fff',
                    }}>{courseName}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{lab.title || lab.question}</span>
                  </div>
                  {lab.title && lab.question && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lab.question}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const LAB_PLACEHOLDER = `<div data-nousai-lab="1" contenteditable="false" style="display:inline-flex;align-items:center;gap:6px;background:#1a1a2e;border:1px solid #334;border-radius:6px;padding:4px 10px;margin:4px 2px;color:#7c9cff;font-size:12px;font-family:inherit;user-select:none">🔬 Visual Lab</div>`;

/* ── Note Editor ─────────────────────────────────────── */
function NoteEditor({ note, folders, courses, onSave, onCancel }: {
  note: Note;
  folders: string[];
  courses: { id: string; name: string; shortName: string; color: string }[];
  onSave: (note: Note) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [folder, setFolder] = useState(note.folder);
  const [newFolder, setNewFolder] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [tags, setTags] = useState((Array.isArray(note.tags) ? note.tags : []).join(', '));
  const [type, setType] = useState<Note['type']>(note.type);
  const [courseId, setCourseId] = useState(note.courseId || '');
  const [topicIds, setTopicIds] = useState<string[]>(note.topicIds || []);
  const contentRef = useRef(note.content);
  const [editorLabHtml, setEditorLabHtml] = useState<string | null>(note.labHtml ?? null);
  const [showLabPicker, setShowLabPicker] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [floatLab, setFloatLab] = useState(false);
  const labFloatRef = useRef<HTMLDivElement>(null);
  const labDragOffset = useRef<{ x: number; y: number } | null>(null);
  const [labPos, setLabPos] = useState({ x: 20, y: 80 });
  const [labInsertTrigger, setLabInsertTrigger] = useState<{ html: string; id: number } | null>(null);
  const [liveHtml, setLiveHtml] = useState(note.content);
  const [splitPreview, setSplitPreview] = useState(false);

  // Get full course data for topic selector
  const { data: storeData } = useStore();
  const fullCourses = useMemo(() => storeData?.pluginData?.coachData?.courses || [], [storeData]);
  const selectedCourseTopics = useMemo(() => {
    if (!courseId) return [];
    const c = fullCourses.find((c: { id: string }) => c.id === courseId);
    if (!c) return [];
    const items: { id: string; label: string }[] = [];
    (c.topics || []).forEach((t: { id: string; name: string; subtopics?: { id: string; name: string }[] }) => {
      items.push({ id: t.id, label: t.name });
      (t.subtopics || []).forEach(st => items.push({ id: st.id, label: `${t.name} > ${st.name}` }));
    });
    return items;
  }, [courseId, fullCourses]);

  // Clear topic selection when course changes
  useEffect(() => {
    if (!courseId) setTopicIds([]);
  }, [courseId]);

  // Convert old markdown content to HTML for TipTap
  const initialHtml = useMemo(() => markdownToHtml(note.content), [note.content]);

  function handleSave() {
    const finalFolder = showNewFolder && newFolder.trim() ? newFolder.trim() : folder;
    const parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
    onSave({
      ...note,
      title: title.trim() || 'Untitled Note',
      content: contentRef.current,
      folder: finalFolder || 'General',
      tags: parsedTags,
      type,
      courseId: courseId || undefined,
      topicIds: courseId ? topicIds : [],
      labHtml: editorLabHtml || undefined,
    });
  }

  const handleEditorSave = useCallback((html: string) => {
    contentRef.current = html;
    handleSave();
  }, [title, folder, newFolder, showNewFolder, tags, type, courseId, topicIds, note]);

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onCancel} className="btn btn-sm btn-secondary" style={{ gap: 4 }}>
          <X size={14} /> Cancel
        </button>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-secondary" onClick={() => setSplitPreview(v => !v)} style={{ gap: 4, fontSize: 11 }}>
            {splitPreview ? '▣ Single' : '▣ Split'}
          </button>
          <button onClick={handleSave} className="btn btn-sm btn-primary" style={{ gap: 4 }}>
            <Check size={14} /> Save
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Note title..."
        maxLength={120}
        style={{
          width: '100%', padding: '10px 12px', marginBottom: 10,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          fontSize: 18, fontWeight: 700, fontFamily: 'inherit', outline: 'none',
        }}
      />

      {/* Metadata row */}
      <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Type */}
        <select
          value={type}
          onChange={e => setType(e.target.value as Note['type'])}
          style={{
            padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
            background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
          }}
        >
          <option value="note">Note</option>
          <option value="quiz">Quiz</option>
          <option value="flashcard">Flashcard</option>
          <option value="ai-output">AI Output</option>
          <option value="match">Match</option>
        </select>

        {/* Folder */}
        {!showNewFolder ? (
          <div className="flex items-center gap-2">
            <select
              value={folder}
              onChange={e => setFolder(e.target.value)}
              style={{
                padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
              }}
            >
              <option value="General">General</option>
              {[...folders].filter(f => f !== 'General').sort().map(f => {
                const parts = f.split('/');
                const indent = '\u00a0\u00a0\u00a0'.repeat(parts.length - 1);
                return <option key={f} value={f}>{indent}{parts[parts.length - 1]}</option>;
              })}
            </select>
            <button
              onClick={() => setShowNewFolder(true)}
              className="btn-icon"
              style={{ padding: 4, minHeight: 28, minWidth: 28 }}
              title="New folder"
            >
              <FolderPlus size={14} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newFolder}
              onChange={e => setNewFolder(e.target.value)}
              placeholder="New folder (use / for subfolders)..."
              style={{
                padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
                background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
                width: 120,
              }}
              autoFocus
            />
            <button onClick={() => setShowNewFolder(false)} className="btn-icon" style={{ padding: 4, minHeight: 28, minWidth: 28 }}>
              <X size={12} />
            </button>
          </div>
        )}

        {/* Link to Course */}
        <select
          value={courseId}
          onChange={e => setCourseId(e.target.value)}
          style={{
            padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 4,
            background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: 12,
          }}
        >
          <option value="">No Course</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.shortName} — {c.name}</option>
          ))}
        </select>
      </div>

      {/* Topic Tags — collapsible */}
      {courseId && selectedCourseTopics.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={() => setShowTopics(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, marginBottom: showTopics ? 6 : 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Link to Topics</span>
            {topicIds.length > 0 && (
              <span style={{
                background: 'var(--accent, #6366f1)', color: '#fff', borderRadius: 8,
                fontSize: 10, fontWeight: 700, padding: '1px 5px',
              }}>{topicIds.length} selected</span>
            )}
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{showTopics ? '▲' : '▼'}</span>
          </button>
          {showTopics && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {selectedCourseTopics.map(t => {
                const selected = topicIds.includes(t.id);
                return (
                  <button key={t.id} onClick={() => setTopicIds(prev => selected ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                    style={{
                      padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      background: selected ? `var(--accent, #6366f1)20` : 'var(--bg-secondary)',
                      border: `1px solid ${selected ? 'var(--accent, #6366f1)' : 'var(--border)'}`,
                      color: selected ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                    }}
                  >
                    {selected && <Check size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />}
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      <input
        type="text"
        value={tags}
        onChange={e => setTags(e.target.value)}
        placeholder="Tags (comma separated)..."
        style={{
          width: '100%', padding: '8px 12px', marginBottom: 10,
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          fontSize: 13, fontFamily: 'inherit', outline: 'none',
        }}
      />

      {/* Embed Lab button */}
      <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => setShowLabPicker(true)}
          style={{ gap: 4 }}
        >
          <Microscope size={13} /> Embed Lab
        </button>
        {editorLabHtml && (
          <>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setFloatLab(v => !v)}
              style={{ gap: 4, fontSize: 11 }}
            >
              {floatLab ? 'Hide Lab' : 'View Lab'}
            </button>
            <button
              onClick={() => { setEditorLabHtml(null); setFloatLab(false); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}
            >
              ✕ remove
            </button>
          </>
        )}
      </div>

      {/* Draggable floating lab */}
      {floatLab && editorLabHtml && (
        <div
          ref={labFloatRef}
          style={{
            position: 'fixed', left: labPos.x, top: labPos.y, zIndex: 8000,
            width: 380, borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)', border: '1px solid var(--border)',
          }}
        >
          {/* drag handle */}
          <div
            style={{
              background: '#1a1a1a', padding: '6px 10px', cursor: 'grab', userSelect: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11, color: '#888', borderBottom: '1px solid #333',
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              const rect = labFloatRef.current!.getBoundingClientRect();
              labDragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              const onMove = (ev: MouseEvent) => {
                if (!labDragOffset.current) return;
                setLabPos({ x: ev.clientX - labDragOffset.current.x, y: ev.clientY - labDragOffset.current.y });
              };
              const onUp = () => { labDragOffset.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <span>⠿ Visual Lab</span>
            <button onClick={() => setFloatLab(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, lineHeight: 1 }}>✕</button>
          </div>
          <iframe
            srcDoc={editorLabHtml}
            title="Visual Lab Preview"
            sandbox="allow-scripts"
            style={{ width: '100%', height: 340, border: 'none', display: 'block' }}
          />
        </div>
      )}

      {/* Lab Picker Modal */}
      {showLabPicker && (
        <LabPickerModal
          courses={courses}
          onSelect={(html) => { setEditorLabHtml(html); setLabInsertTrigger({ html: LAB_PLACEHOLDER, id: Date.now() }); setShowLabPicker(false); }}
          onClose={() => setShowLabPicker(false)}
        />
      )}

      {/* TipTap Rich Text Editor + optional live preview */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 50%', minWidth: 0, minHeight: 400 }}>
          <RichTextEditor
            initialContent={initialHtml}
            onSave={handleEditorSave}
            onContentChange={(html) => { contentRef.current = html; setLiveHtml(html); }}
            insertHtmlTrigger={labInsertTrigger}
            placeholder="Start writing your note..."
          />
        </div>
        {splitPreview && (
          <div className="card prose" style={{
            flex: '1 1 50%', minWidth: 0, padding: '16px 20px', fontSize: 14,
            lineHeight: 1.7, minHeight: 400, overflowY: 'auto', color: 'var(--text-primary)',
          }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(liveHtml) }}
          />
        )}
      </div>
    </div>
  );
}
