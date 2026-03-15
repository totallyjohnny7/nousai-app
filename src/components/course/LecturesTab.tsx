import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import {
  ArrowLeft, BookOpen, GraduationCap, FileText, AlertTriangle, ClipboardList,
  ScrollText, Play, Plus, Edit3, Trash2, Volume2, X, Eye, Brain, Trophy,
  Sparkles, CheckCircle2, Download, Upload, Layers, ChevronDown, ChevronUp,
  Calendar, Check, Microscope,
} from 'lucide-react';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { useStore } from '../../store';
import type { Course } from '../../types';
import { getLecturesForCourse, type LectureItem } from '../../data/lectureContent';
import { callAI, isAIConfigured } from '../../utils/ai';
import { speak, stopSpeaking } from '../../utils/speechTools';
import { sanitizeHtml } from '../../utils/sanitize';
import { generateId, formatDate, formatDateShort, renderSimpleMarkdown } from './courseHelpers';

const RichTextEditor = lazyWithRetry(() => import('../RichTextEditor'));

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

/** JP Color legend bar — shows when content has <mark> tags */
function JpColorLegend({ content }: { content: string }) {
  if (!content || !content.includes('<mark ')) return null;
  const colors = [
    { label: 'Verb', color: '#fecaca' }, { label: 'Particle', color: '#bfdbfe' },
    { label: 'Place', color: '#bbf7d0' }, { label: 'Time', color: '#fef08a' },
    { label: 'Noun', color: '#ddd6fe' }, { label: 'Adj', color: '#fed7aa' },
    { label: 'Adverb', color: '#fbcfe8' }, { label: 'Greeting', color: '#99f6e4' },
    { label: 'Other', color: '#d1d5db' },
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

export default function LecturesTab({
  course, accentColor,
}: {
  course: Course;
  accentColor: string;
}) {
  const { setPageContext } = useStore();
  const storageKey = `nousai-lectures-${course.id}`;
  const [userNotes, setUserNotes] = useState<LectureNote[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [viewMode, setViewMode] = useState<'list' | 'view' | 'edit'>('list');
  const [activeNote, setActiveNote] = useState<LectureNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTopicIds, setEditTopicIds] = useState<string[]>([]);
  const [lectureFilter, setLectureFilter] = useState<'all' | 'lecture' | 'exam' | 'assignment'>('all');
  const [expandedLecture, setExpandedLecture] = useState<string | null>(null);
  const [showStudyTools, setShowStudyTools] = useState(false);
  const [recallMode, setRecallMode] = useState(false);
  const [recallText, setRecallText] = useState('');
  const [showRecallAnswer, setShowRecallAnswer] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // ── Autosave refs ── track edit state for save-on-unmount
  const editTitleRef = useRef(editTitle);
  const editContentRef = useRef(editContent);
  const editTopicIdsRef = useRef(editTopicIds);
  const viewModeRef = useRef(viewMode);
  const activeNoteRef = useRef(activeNote);
  const userNotesRef = useRef(userNotes);
  editTitleRef.current = editTitle;
  editContentRef.current = editContent;
  editTopicIdsRef.current = editTopicIds;
  viewModeRef.current = viewMode;
  activeNoteRef.current = activeNote;
  userNotesRef.current = userNotes;

  // ── Page context publisher ──
  useEffect(() => {
    setPageContext({
      page: 'Course — Lectures',
      summary: `${course.name} — Lectures${expandedLecture ? ` (viewing: ${expandedLecture})` : ''}`,
      activeItem: activeNote ? `${activeNote.title}\n\n${activeNote.content?.slice(0, 2000) ?? ''}` : undefined,
    })
    return () => setPageContext(null)
  }, [course.name, expandedLecture, activeNote])

  // Auto-save on unmount — ensures notes are never lost when navigating away
  useEffect(() => {
    return () => {
      if (viewModeRef.current === 'edit' && activeNoteRef.current) {
        const note = activeNoteRef.current;
        const title = editTitleRef.current?.trim() || 'Untitled';
        const content = editContentRef.current || '';
        if (!content.trim() && title === 'Untitled Lecture') return;
        const updated: LectureNote = {
          ...note, title, content,
          topicIds: editTopicIdsRef.current?.length ? editTopicIdsRef.current : undefined,
          updatedAt: new Date().toISOString(),
        };
        try {
          const current = userNotesRef.current;
          const idx = current.findIndex(n => n.id === updated.id);
          const newNotes = idx >= 0
            ? current.map((n, i) => i === idx ? updated : n)
            : [...current, updated];
          localStorage.setItem(storageKey, JSON.stringify(newNotes));
        } catch (e) {
          console.warn('[Notes] Auto-save on unmount failed:', e);
        }
      }
    };
  }, [storageKey]);

  // Debounced autosave — saves every 3s while editing
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (viewMode !== 'edit' || !activeNote) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      const title = editTitle.trim() || 'Untitled';
      const content = editContent;
      if (!content.trim() && title === 'Untitled Lecture') return;
      const updated: LectureNote = {
        ...activeNote, title, content,
        topicIds: editTopicIds.length ? editTopicIds : undefined,
        updatedAt: new Date().toISOString(),
      };
      setUserNotes(prev => {
        const idx = prev.findIndex(n => n.id === updated.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = updated;
          return copy;
        }
        return [...prev, updated];
      });
      setActiveNote(updated);
    }, 3000);
    return () => { if (autosaveRef.current) clearTimeout(autosaveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTitle, editContent, editTopicIds, viewMode]);

  // Get course lecture data
  const courseLectures = useMemo(() => getLecturesForCourse(course.name), [course.name]);
  const hasLectures = courseLectures.length > 0;

  // Labs from Visual Lab for linked lab display
  const labs = useMemo(() => {
    try {
      const saved = localStorage.getItem(`nousai-labs-${course.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, [course.id]);
  const [showLinkedLab, setShowLinkedLab] = useState(true);

  // Group lectures by unit
  const lecturesByUnit = useMemo((): Array<[string, LectureItem[]]> => {
    const filtered = lectureFilter === 'all'
      ? courseLectures
      : courseLectures.filter((l: LectureItem) => l.type === lectureFilter);
    const groups: Record<string, LectureItem[]> = {};
    filtered.forEach((l: LectureItem) => {
      const key = l.unit || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    });
    return Object.entries(groups);
  }, [courseLectures, lectureFilter]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(userNotes)); } catch (e) { console.warn('[Notes] localStorage save failed:', e); }
  }, [userNotes, storageKey]);

  const createNew = useCallback(() => {
    const note: LectureNote = {
      id: generateId(),
      title: 'Untitled Lecture',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setActiveNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditTopicIds(note.topicIds || []);
    setViewMode('edit');
  }, []);

  // Build topic list for course (topics + subtopics)
  const courseTopicItems = useMemo(() => {
    const items: { id: string; label: string }[] = [];
    (course.topics || []).forEach(t => {
      items.push({ id: t.id, label: t.name });
      ((t as any).subtopics || []).forEach((st: { id: string; name: string }) =>
        items.push({ id: st.id, label: `${t.name} > ${st.name}` })
      );
    });
    return items;
  }, [course.topics]);

  const saveNote = useCallback(() => {
    if (!activeNote) return;
    const updated: LectureNote = {
      ...activeNote,
      title: editTitle.trim() || 'Untitled',
      content: editContent,
      topicIds: editTopicIds.length > 0 ? editTopicIds : undefined,
      updatedAt: new Date().toISOString(),
    };
    setUserNotes(prev => {
      const idx = prev.findIndex(n => n.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [...prev, updated];
    });
    setActiveNote(updated);
    setViewMode('view');
  }, [activeNote, editTitle, editContent, editTopicIds]);

  const deleteNote = useCallback((id: string) => {
    setUserNotes(prev => prev.filter(n => n.id !== id));
    if (activeNote?.id === id) {
      setActiveNote(null);
      setViewMode('list');
    }
  }, [activeNote]);

  const typeIcon = (type: LectureItem['type']) => {
    switch (type) {
      case 'lecture': return <BookOpen size={14} />;
      case 'exam': return <AlertTriangle size={14} />;
      case 'assignment': return <ClipboardList size={14} />;
      case 'study-guide': return <ScrollText size={14} />;
      case 'video': return <Play size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const typeColor = (type: LectureItem['type']) => {
    switch (type) {
      case 'lecture': return accentColor;
      case 'exam': return '#ef4444';
      case 'assignment': return '#f59e0b';
      case 'study-guide': return '#8b5cf6';
      case 'video': return '#06b6d4';
      default: return 'var(--text-dim)';
    }
  };

  // View mode — reading a user note
  if (viewMode === 'view' && activeNote) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => setViewMode('list')}>
            <ArrowLeft size={13} /> Back
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => {
            if (activeNote.content) speak(activeNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), { voiceLang: 'ja-JP', rate: 0.9 });
          }}>
            <Volume2 size={13} /> Read
          </button>
          <button className="btn btn-sm" onClick={() => stopSpeaking()}>
            <X size={13} /> Stop
          </button>
          <button className="btn btn-sm" onClick={() => { setEditTitle(activeNote.title); setEditContent(activeNote.content); setEditTopicIds(activeNote.topicIds || []); setViewMode('edit'); }}>
            <Edit3 size={13} /> Edit
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => deleteNote(activeNote.id)}>
            <Trash2 size={13} />
          </button>
        </div>
        <div className="card">
          {activeNote.linkedLabId && (() => {
            const linkedLab = labs.find((l: any) => l.id === activeNote.linkedLabId);
            if (!linkedLab) return null;
            return (
              <div style={{ margin: '-16px -16px 16px -16px' }}>
                <button onClick={() => setShowLinkedLab(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 16px',
                  background: 'var(--bg-secondary)', border: 'none', borderBottom: '1px solid var(--border)',
                  borderRadius: showLinkedLab ? '0' : 'var(--radius-sm) var(--radius-sm) 0 0',
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
                      onLoad={(e) => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).previousElementSibling?.remove(); }}
                      style={{ width: '100%', height: 400, border: 'none', borderBottom: '1px solid var(--border)', display: 'block', opacity: 0, transition: 'opacity 0.3s' }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{activeNote.title}</h2>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: activeNote.topicIds?.length ? 8 : 16 }}>
            Updated {formatDate(activeNote.updatedAt)}
          </div>
          {activeNote.topicIds && activeNote.topicIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
              {activeNote.topicIds.map(tid => {
                let label = tid;
                for (const t of (course.topics || [])) {
                  if (t.id === tid) { label = t.name; break; }
                  for (const st of ((t as any).subtopics || [])) {
                    if (st.id === tid) { label = st.name; break; }
                  }
                }
                return (
                  <span key={tid} style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
                    background: 'var(--accent, #6366f1)15', color: 'var(--accent, #6366f1)',
                    border: '1px solid var(--accent, #6366f1)30',
                  }}>{label}</span>
                );
              })}
            </div>
          )}
          {activeNote.content ? (
            <>
              <div
                className="tiptap-editor"
                style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(activeNote.content.startsWith('<')
                    ? activeNote.content
                    : renderSimpleMarkdown(activeNote.content)),
                }}
              />
              <JpColorLegend content={activeNote.content} />
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-dim)', fontStyle: 'italic' }}>No content yet. Click Edit to add notes.</div>
          )}
          {/* Attachments */}
          {(activeNote.attachments || []).length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                <Upload size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Attachments ({activeNote.attachments!.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeNote.attachments!.map(att => (
                  <div key={att.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: att.type === 'pptx' ? '#d4380022' : att.type === 'pdf' ? '#cf1a2522' : att.type === 'image' ? '#1890ff22' : 'var(--bg-card)',
                      color: att.type === 'pptx' ? '#d43800' : att.type === 'pdf' ? '#cf1a25' : att.type === 'image' ? '#1890ff' : 'var(--text-muted)',
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    }}>
                      {att.type === 'pptx' ? 'PPT' : att.type === 'pdf' ? 'PDF' : att.type === 'image' ? 'IMG' : 'FILE'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{(att.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <a href={att.dataUrl} download={att.name} onClick={e => e.stopPropagation()}
                      style={{ padding: '4px 10px', borderRadius: 4, background: `${accentColor}15`, color: accentColor, fontSize: 11, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Download size={11} /> Download
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Active Recall Mode */}
        {recallMode && (
          <div className="card" style={{ padding: 20, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: accentColor }}>
                <Brain size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Active Recall
              </div>
              <button className="btn btn-sm" onClick={() => { setRecallMode(false); setShowRecallAnswer(false); setRecallText(''); }}>
                <X size={13} /> Exit
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Write everything you remember about <strong>{activeNote.title}</strong> from memory. Then reveal the original to compare.
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
                <div
                  className="tiptap-editor"
                  style={{
                    padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)',
                  }}
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(activeNote.content.startsWith('<')
                      ? activeNote.content
                      : renderSimpleMarkdown(activeNote.content)),
                  }}
                />
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
            <Brain size={14} style={{ color: accentColor }} />
            Study This Note
            <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>
              {showStudyTools ? '\u25B2' : '\u25BC'}
            </span>
          </button>
          {showStudyTools && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
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
                const plain = activeNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                localStorage.setItem('nousai-cornell-prefill', JSON.stringify({
                  topic: activeNote.title,
                  content: plain.slice(0, 2000),
                  courseId: course.id,
                  topicIds: activeNote.topicIds || [],
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
                const text = activeNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
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
              {/* Study Modes */}
              <button onClick={() => { window.location.hash = '#/learn?tab=study'; }} style={{
                padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                  <Trophy size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Study Modes
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pomodoro, Leitner, Streaks & more</div>
              </button>
              {/* AI: Cornell Note */}
              <button onClick={async () => {
                if (!isAIConfigured()) { alert('AI is not configured. Go to Settings to set up an AI provider and API key.'); return; }
                setAiLoading(true);
                try {
                  const plain = activeNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  const prompt = `Create a Cornell Note from the following content.\nTitle: ${activeNote.title}\nContent: ${plain.slice(0, 3000)}\n\nReturn ONLY a JSON object (no markdown fences):\n{"cues":"HTML key questions/keywords (use <ul><li>)","notes":"HTML detailed notes (use <h3>,<p>,<ul><li>,<strong>)","summary":"HTML summary in 2-3 sentences"}`;
                  const result = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
                  const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.cues) {
                    localStorage.setItem('nousai-cornell-prefill', JSON.stringify({
                      topic: activeNote.title, content: plain.slice(0, 2000), courseId: course.id,
                      topicIds: activeNote.topicIds || [],
                      aiCues: parsed.cues, aiNotes: parsed.notes || '', aiSummary: parsed.summary || '',
                    }));
                    window.location.hash = '#/learn?tab=study';
                  }
                } catch (err) {
                  console.error('AI Cornell generation failed:', err);
                  alert('AI generation failed. Check your AI settings and try again.');
                } finally { setAiLoading(false); }
              }} disabled={aiLoading} style={{
                padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', cursor: aiLoading ? 'wait' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
                opacity: aiLoading ? 0.6 : 1,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, marginBottom: 2 }}>
                  <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> AI: Cornell Note
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aiLoading ? 'Generating...' : 'Generate from this content'}</div>
              </button>
              {/* AI: Flashcards */}
              <button onClick={async () => {
                if (!isAIConfigured()) { alert('AI is not configured. Go to Settings to set up an AI provider and API key.'); return; }
                setAiLoading(true);
                try {
                  const plain = activeNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                  const prompt = `Create 5-10 flashcards from the following content.\nTitle: ${activeNote.title}\nContent: ${plain.slice(0, 3000)}\n\nReturn ONLY a JSON array (no markdown fences):\n[{"front":"question or term","back":"answer or definition"}]`;
                  const result = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
                  const jsonStr = result.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
                  const parsed = JSON.parse(jsonStr);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    const count = parsed.length;
                    const preview = parsed.slice(0, 3).map((c: any, i: number) => `${i + 1}. ${c.front}`).join('\n');
                    if (confirm(`Generated ${count} flashcards:\n\n${preview}\n${count > 3 ? `\n...and ${count - 3} more` : ''}\n\nSave to your flashcard deck?`)) {
                      const existing = JSON.parse(localStorage.getItem('nousai-ai-flashcards') || '[]');
                      const newCards = parsed.map((c: any) => ({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), front: c.front, back: c.back, source: activeNote.title }));
                      localStorage.setItem('nousai-ai-flashcards', JSON.stringify([...existing, ...newCards]));
                      alert(`${count} flashcards saved! View them in Flashcards.`);
                    }
                  }
                } catch (err) {
                  console.error('AI flashcard generation failed:', err);
                  alert('AI generation failed. Check your AI settings and try again.');
                } finally { setAiLoading(false); }
              }} disabled={aiLoading} style={{
                padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-card)', cursor: aiLoading ? 'wait' : 'pointer', textAlign: 'left', fontFamily: 'inherit',
                opacity: aiLoading ? 0.6 : 1,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: accentColor, marginBottom: 2 }}>
                  <Sparkles size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} /> AI: Flashcards
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{aiLoading ? 'Generating...' : 'Create flashcards from note'}</div>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit mode — rich text editor (TipTap)
  if (viewMode === 'edit') {
    // Backward compatibility: convert plain text/markdown to HTML for TipTap
    const initialHtml = editContent && !editContent.startsWith('<') ? markdownToHtml(editContent) : editContent;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button className="btn btn-sm" onClick={() => { saveNote(); activeNote && userNotes.find(l => l.id === activeNote.id) ? setViewMode('view') : setViewMode('list'); }}>
            <ArrowLeft size={13} /> Back
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>auto-saves as you type</span>
          <button className="btn btn-primary btn-sm" onClick={saveNote}>
            <CheckCircle2 size={13} /> Save
          </button>
        </div>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Lecture title..."
            style={{ width: '100%', fontSize: 16, fontWeight: 700, padding: '12px 16px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0 }}
          />
          {/* Topic tag pills */}
          {courseTopicItems.length > 0 && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Link to Topics</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {courseTopicItems.map(t => {
                  const selected = editTopicIds.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => setEditTopicIds(prev => selected ? prev.filter(id => id !== t.id) : [...prev, t.id])}
                      style={{
                        padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: selected ? 'var(--accent, #6366f1)20' : 'var(--bg-secondary)',
                        border: `1px solid ${selected ? 'var(--accent, #6366f1)' : 'var(--border)'}`,
                        color: selected ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
                        fontFamily: 'inherit',
                      }}
                    >
                      {selected && <Check size={10} style={{ verticalAlign: 'middle', marginRight: 2 }} />}
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {activeNote?.linkedLabId && (() => {
            const linkedLab = labs.find((l: any) => l.id === activeNote.linkedLabId);
            if (!linkedLab) return null;
            return (
              <div style={{ borderBottom: '1px solid var(--border)' }}>
                <button onClick={() => setShowLinkedLab(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '10px 16px',
                  background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 12, fontWeight: 700, color: accentColor,
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
                      style={{ width: '100%', height: 400, border: 'none', borderTop: '1px solid var(--border)', display: 'block', opacity: 0, transition: 'opacity 0.3s' }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
          <div style={{ minHeight: 400 }}>
            <Suspense fallback={<div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)' }}>Loading editor...</div>}>
              <RichTextEditor
                initialContent={initialHtml}
                onSave={(_html, _plain) => saveNote()}
                onContentChange={(html) => setEditContent(html)}
                placeholder="Write your lecture notes here..."
              />
            </Suspense>
          </div>
          {/* File attachments */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Attachments</div>
            {(activeNote?.attachments || []).map(att => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12 }}>
                <span style={{ fontWeight: 600 }}>{att.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>({(att.size / 1024).toFixed(0)} KB)</span>
                <button onClick={() => {
                  if (!activeNote) return;
                  const updated = { ...activeNote, attachments: (activeNote.attachments || []).filter(a => a.id !== att.id) };
                  setActiveNote(updated);
                  setUserNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
                }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 2 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginTop: 4 }}>
              <Upload size={11} /> Upload File
              <input type="file" accept=".pptx,.ppt,.pdf,.png,.jpg,.jpeg,.doc,.docx" style={{ display: 'none' }} onChange={e => {
                const file = e.target.files?.[0];
                if (!file || !activeNote) return;
                if (file.size > 5 * 1024 * 1024) { alert('File too large (max 5MB for local storage)'); return; }
                const reader = new FileReader();
                reader.onload = () => {
                  const ext = file.name.split('.').pop()?.toLowerCase() || '';
                  const type: LectureAttachment['type'] = ['pptx', 'ppt'].includes(ext) ? 'pptx' : ext === 'pdf' ? 'pdf' : ['png', 'jpg', 'jpeg'].includes(ext) ? 'image' : 'other';
                  const att: LectureAttachment = { id: generateId(), name: file.name, type, dataUrl: reader.result as string, size: file.size };
                  const updated = { ...activeNote, attachments: [...(activeNote.attachments || []), att] };
                  setActiveNote(updated);
                  setUserNotes(prev => {
                    const idx = prev.findIndex(n => n.id === updated.id);
                    if (idx >= 0) { const copy = [...prev]; copy[idx] = updated; return copy; }
                    return [...prev, updated];
                  });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // List mode — course lectures + user notes
  return (
    <div>
      {/* ── Course Lecture Schedule ── */}
      {hasLectures && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 className="section-title" style={{ margin: 0 }}>
              <BookOpen size={14} /> Course Lectures
            </h3>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'lecture', 'exam', 'assignment'] as const).map(f => (
                <button
                  key={f}
                  className={`btn btn-sm ${lectureFilter === f ? 'btn-primary' : ''}`}
                  onClick={() => setLectureFilter(f)}
                  style={{ fontSize: 11, padding: '3px 8px', textTransform: 'capitalize' }}
                >
                  {f === 'all' ? `All (${courseLectures.length})` : f}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {lecturesByUnit.map(([unitName, items]: [string, LectureItem[]]) => (
              <div key={unitName} style={{ borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {/* Unit header */}
                <div style={{
                  padding: '8px 12px', background: 'var(--bg-card)',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <Layers size={13} style={{ color: accentColor }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{unitName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>{items.length} items</span>
                </div>

                {/* Lectures in unit */}
                {items.map((lec: LectureItem, idx: number) => (
                  <div key={lec.id}>
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                        cursor: 'pointer', transition: 'background 0.15s',
                        background: expandedLecture === lec.id ? 'var(--bg-hover)' : 'transparent',
                        borderTop: idx > 0 ? '1px solid var(--border-light, rgba(255,255,255,0.06))' : 'none',
                      }}
                      onClick={() => setExpandedLecture(expandedLecture === lec.id ? null : lec.id)}
                    >
                      <div style={{ color: typeColor(lec.type), flexShrink: 0 }}>
                        {typeIcon(lec.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {lec.title}
                        </div>
                        {lec.chapterRef && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{lec.chapterRef}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {lec.date && (
                          <span style={{ fontSize: 10, color: lec.type === 'exam' ? '#ef4444' : 'var(--text-dim)', fontWeight: lec.type === 'exam' ? 700 : 400 }}>
                            {lec.date}
                          </span>
                        )}
                        <span style={{
                          fontSize: 9, padding: '2px 6px', borderRadius: 10,
                          background: typeColor(lec.type) + '22', color: typeColor(lec.type),
                          fontWeight: 600, textTransform: 'uppercase',
                        }}>
                          {lec.type}
                        </span>
                        {expandedLecture === lec.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expandedLecture === lec.id && (
                      <div style={{
                        padding: '8px 12px 12px 38px',
                        background: 'var(--bg-hover)', borderTop: '1px solid var(--border-light, rgba(255,255,255,0.06))',
                      }}>
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 6px 0' }}>
                          {lec.description}
                        </p>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {lec.weekNumber && (
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                              <Calendar size={10} /> Week {lec.weekNumber}
                            </span>
                          )}
                          {lec.lectureNumber && (
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                              <GraduationCap size={10} /> Lecture #{lec.lectureNumber}
                            </span>
                          )}
                          {lec.chapterRef && (
                            <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                              <BookOpen size={10} /> {lec.chapterRef}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── User Lecture Notes ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 className="section-title" style={{ margin: 0 }}>
          <GraduationCap size={14} /> My Lecture Notes
        </h3>
        <button className="btn btn-primary btn-sm" onClick={createNew}>
          <Plus size={13} /> New Note
        </button>
      </div>

      {userNotes.length === 0 ? (
        <div className="empty-state" style={{ padding: hasLectures ? '20px 16px' : undefined }}>
          <FileText size={32} />
          <h3 style={{ fontSize: 14 }}>No lecture notes yet</h3>
          <p style={{ fontSize: 12 }}>Create notes for your lectures, readings, and class sessions.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={createNew}>
            Create First Note
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {userNotes.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map(note => (
            <div
              key={note.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)',
                border: '1px solid var(--border)', cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onClick={() => { setActiveNote(note); setViewMode('view'); }}
            >
              <FileText size={16} style={{ color: accentColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatDateShort(note.updatedAt)} &middot; {note.content.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} words
                  {(note.attachments || []).length > 0 && <> &middot; {note.attachments!.length} file{note.attachments!.length > 1 ? 's' : ''}</>}
                </div>
                {note.topicIds && note.topicIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
                    {note.topicIds.slice(0, 3).map(tid => {
                      let label = tid;
                      for (const t of (course.topics || [])) {
                        if (t.id === tid) { label = t.name; break; }
                        for (const st of ((t as any).subtopics || [])) { if (st.id === tid) { label = st.name; break; } }
                      }
                      return <span key={tid} style={{ padding: '1px 5px', borderRadius: 8, fontSize: 9, fontWeight: 600, background: 'var(--accent, #6366f1)15', color: 'var(--accent, #6366f1)', border: '1px solid var(--accent, #6366f1)30' }}>{label}</span>;
                    })}
                    {note.topicIds.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>+{note.topicIds.length - 3}</span>}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={e => { e.stopPropagation(); setActiveNote(note); setEditTitle(note.title); setEditContent(note.content); setEditTopicIds(note.topicIds || []); setViewMode('edit'); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: 4 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
