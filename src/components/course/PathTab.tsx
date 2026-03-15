import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map, Plus, Eye, Download, RotateCcw, Copy, Upload, Search, X,
  Edit3, Trash2, ChevronUp, ChevronDown, CheckCircle2, Circle,
  Clock, Lock, Unlock, Link, GitBranch, FileText, Volume2,
  Sparkles, BookOpen, Microscope, GraduationCap, RefreshCw, GripVertical,
} from 'lucide-react';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Course, CourseTopic, NousAIData, Note } from '../../types';
import { callAI, isAIConfigured } from '../../utils/ai';
import { getTextbookChapters } from '../../data/textbookChapters';
import { getStudyContent } from '../../data/studyContentIndex';
import { getLecturesForChapter, type LectureItem } from '../../data/lectureContent';
import { speak } from '../../utils/speechTools';
import ReadAloudButton from '../ReadAloudButton';
import { generateId, formatDateShort } from './courseHelpers';

interface LectureNote {
  id: string;
  title: string;
  content: string;
  topicIds?: string[];
  createdAt: string;
  updatedAt: string;
  type?: string;
}

// #40 Sortable wrapper — provides drag-and-drop behaviour per chapter row
function SortableChapterRow({ id, children }: { id: string; children: (dragHandleProps: React.HTMLAttributes<HTMLButtonElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ position: 'relative', marginBottom: 8, transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

export default function PathTab({
  course, data, setData, updatePluginData, getTopicProficiency, accentColor,
}: {
  course: Course;
  data: NousAIData | null;
  setData: { (d: NousAIData): void; (fn: (prev: NousAIData) => NousAIData): void };
  updatePluginData: (partial: Partial<NousAIData['pluginData']>) => void;
  getTopicProficiency: (name: string) => number;
  accentColor: string;
}) {
  const navigate = useNavigate();
  const [generatingSummary, setGeneratingSummary] = useState<string | null>(null);
  const [expandedSummary, setExpandedSummary] = useState<Set<string>>(new Set());
  const allNotes: Note[] = useMemo(() => (data?.pluginData?.notes as Note[] | undefined) || [], [data]);
  // Also include lecture notes that have topicIds
  const lectureNotes: LectureNote[] = useMemo(() => {
    try {
      const saved = localStorage.getItem(`nousai-lectures-${course.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  }, [course.id]);
  const getLinkedNotes = useCallback((topicId: string) => {
    const libNotes = allNotes.filter(n => n.topicIds?.includes(topicId));
    // Add lecture notes that link to this topic (as Note-like objects)
    const lecNotes = lectureNotes
      .filter(ln => ln.topicIds?.includes(topicId))
      .filter(ln => !libNotes.some(n => n.id === ln.id)) // deduplicate
      .map(ln => ({ id: ln.id, title: ln.title, type: 'lecture' as const, content: ln.content, topicIds: ln.topicIds, updatedAt: ln.updatedAt, createdAt: ln.createdAt, folder: '', tags: '' }));
    return [...libNotes, ...lecNotes] as Note[];
  }, [allNotes, lectureNotes]);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [linkPickerFor, setLinkPickerFor] = useState<string | null>(null);
  const [notePickerFor, setNotePickerFor] = useState<string | null>(null);
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState('');
  const [showAddSubtopic, setShowAddSubtopic] = useState<string | null>(null);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [editingSubtopicId, setEditingSubtopicId] = useState<string | null>(null);
  const [editSubtopicName, setEditSubtopicName] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [bulkImportText, setBulkImportText] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [expandedSubtopic, setExpandedSubtopic] = useState<string | null>(null);
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  const [editContentText, setEditContentText] = useState('');

  const chapters = course.topics;

  // --- CRUD helpers ---
  const updateCourseTopics = useCallback((newTopics: import('../../types').CourseTopic[]) => {
    if (!data) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return { ...c, topics: newTopics };
          }),
        },
      },
    }));
  }, [data, setData, course.id]);

  const generateTopicSummary = useCallback(async (topic: CourseTopic) => {
    if (!isAIConfigured()) {
      alert('Configure an AI provider in Settings to use this feature.');
      return;
    }
    setGeneratingSummary(topic.id);
    try {
      const subtopicNames = (topic.subtopics || []).map(st => st.name).join(', ');
      const prompt = `Write a concise study summary (3-5 sentences) for the topic "${topic.name}" in the course "${course.name}".${subtopicNames ? ` It covers: ${subtopicNames}.` : ''} Focus on key concepts, main ideas, and what a student should understand.`;
      const result = await callAI([{ role: 'user', content: prompt }]);
      const summary = result?.trim() || '';
      if (summary) {
        updateCourseTopics(chapters.map(t => t.id === topic.id ? { ...t, summary } : t));
        setExpandedSummary(prev => new Set([...prev, topic.id]));
      }
    } catch (e) {
      console.error('[PathTab] generateTopicSummary failed:', e);
      alert('Failed to generate summary. Please try again.');
    } finally {
      setGeneratingSummary(null);
    }
  }, [course.name, chapters, updateCourseTopics]);

  const addTopic = useCallback((name: string) => {
    if (!name.trim()) return;
    const newTopic: import('../../types').CourseTopic = { id: generateId(), name: name.trim(), subtopics: [] };
    updateCourseTopics([...chapters, newTopic]);
    setNewTopicName(''); setShowAddTopic(false);
  }, [chapters, updateCourseTopics]);

  const updateTopicName = useCallback((topicId: string, name: string) => {
    updateCourseTopics(chapters.map(t => t.id === topicId ? { ...t, name } : t));
    setEditingTopicId(null);
  }, [chapters, updateCourseTopics]);

  const deleteTopic = useCallback((topicId: string) => {
    if (!confirm('Delete this topic and all its subtopics?')) return;
    if (!data) {
      updateCourseTopics(chapters.filter(t => t.id !== topicId));
      return;
    }
    // Merge topic deletion, note cascade, module cleanup, and knowledge web cleanup
    setData((prev: NousAIData) => {
      const updatedChapters = chapters.filter(t => t.id !== topicId);
      const updatedNotes = (prev.pluginData.notes || []).map((n: Note) =>
        n.topicIds?.includes(topicId) ? { ...n, topicIds: n.topicIds.filter(id => id !== topicId) } : n
      );
      const updatedWeb = (prev.pluginData.knowledgeWeb || []).filter(
        (e: { from: string; to: string }) => e.from !== topicId && e.to !== topicId
      );
      const courseIdx = (prev.pluginData.coachData?.courses || []).findIndex((c: Course) => c.id === course.id);
      if (courseIdx >= 0) {
        const courses = [...prev.pluginData.coachData.courses];
        const updatedModules = (courses[courseIdx].modules || []).map(m => ({
          ...m,
          topicIds: m.topicIds.filter(id => id !== topicId),
        }));
        courses[courseIdx] = { ...courses[courseIdx], topics: updatedChapters, modules: updatedModules };
        return {
          ...prev,
          pluginData: {
            ...prev.pluginData,
            coachData: { ...prev.pluginData.coachData, courses },
            notes: updatedNotes,
            knowledgeWeb: updatedWeb,
          },
        };
      }
      // Fallback: just update topics via courses
      return {
        ...prev,
        pluginData: {
          ...prev.pluginData,
          coachData: {
            ...prev.pluginData.coachData,
            courses: prev.pluginData.coachData.courses.map(c => {
              if (c.id !== course.id) return c;
              return { ...c, topics: updatedChapters };
            }),
          },
          notes: updatedNotes,
          knowledgeWeb: updatedWeb,
        },
      };
    });
  }, [chapters, updateCourseTopics, data, setData, course.id]);

  const addSubtopic = useCallback((topicId: string, name: string) => {
    if (!name.trim()) return;
    const newSt = { id: generateId(), name: name.trim() };
    updateCourseTopics(chapters.map(t => t.id === topicId
      ? { ...t, subtopics: [...(t.subtopics || []), newSt] }
      : t
    ));
    setNewSubtopicName(''); setShowAddSubtopic(null);
  }, [chapters, updateCourseTopics]);

  const updateSubtopicName = useCallback((topicId: string, stId: string, name: string) => {
    updateCourseTopics(chapters.map(t => t.id === topicId
      ? { ...t, subtopics: (t.subtopics || []).map(st => st.id === stId ? { ...st, name } : st) }
      : t
    ));
    setEditingSubtopicId(null);
  }, [chapters, updateCourseTopics]);

  const deleteSubtopic = useCallback((topicId: string, stId: string) => {
    updateCourseTopics(chapters.map(t => t.id === topicId
      ? { ...t, subtopics: (t.subtopics || []).filter(st => st.id !== stId) }
      : t
    ));
  }, [chapters, updateCourseTopics]);

  const updateSubtopicContent = useCallback((topicId: string, stId: string, content: string) => {
    updateCourseTopics(chapters.map(t => t.id === topicId
      ? { ...t, subtopics: (t.subtopics || []).map(st => st.id === stId ? { ...st, content } : st) }
      : t
    ));
    setEditingContentId(null);
  }, [chapters, updateCourseTopics]);

  const importBulkTopics = useCallback((text: string) => {
    if (!text.trim()) return;
    const lines = text.split('\n').filter(l => l.trim());
    const newTopics: import('../../types').CourseTopic[] = [];
    let currentTopic: import('../../types').CourseTopic | null = null;
    lines.forEach(line => {
      if (line.startsWith('  ') || line.startsWith('\t')) {
        if (currentTopic) {
          currentTopic.subtopics = currentTopic.subtopics || [];
          currentTopic.subtopics.push({ id: generateId(), name: line.trim() });
        }
      } else {
        currentTopic = { id: generateId(), name: line.trim(), subtopics: [] };
        newTopics.push(currentTopic);
      }
    });
    if (newTopics.length > 0) {
      updateCourseTopics([...chapters, ...newTopics]);
      setBulkImportText('');
    }
  }, [chapters, updateCourseTopics]);

  const copyAllTopics = useCallback(() => {
    const text = chapters.map(t => {
      const subs = (t.subtopics || []).map(st => {
        let line = `  ${st.name}`;
        if (st.content) line += `\n    ${st.content.replace(/\n/g, '\n    ')}`;
        return line;
      }).join('\n');
      return t.name + (subs ? '\n' + subs : '');
    }).join('\n');
    navigator.clipboard.writeText(text).catch(() => { /* clipboard not available in some contexts */ });
  }, [chapters]);

  const loadTextbookChapters = useCallback(() => {
    if (!data) return;
    if (!confirm('This will replace all current topics with the textbook chapters. Continue?')) return;
    const tbChapters = getTextbookChapters(course.name);
    if (!tbChapters) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return { ...c, topics: [...tbChapters] };
          }),
        },
      },
    }));
  }, [data, setData, course.id, course.name]);

  const hasTextbook = !!getTextbookChapters(course.name);

  const updateTopicLinks = useCallback((topicId: string, links: string[]) => {
    if (!data) return;
    setData((prev: NousAIData) => ({
      ...prev,
      pluginData: {
        ...prev.pluginData,
        coachData: {
          ...prev.pluginData.coachData,
          courses: prev.pluginData.coachData.courses.map(c => {
            if (c.id !== course.id) return c;
            return {
              ...c,
              topics: c.topics.map(t => t.id === topicId ? { ...t, links } : t),
            };
          }),
        },
      },
    }));
  }, [data, setData, course.id]);

  // --- Note linking helpers ---
  const linkNoteToTopic = useCallback((noteId: string, topicId: string) => {
    if (!data) return;
    const updatedNotes = (data.pluginData.notes || []).map((n: Note) => {
      if (n.id !== noteId) return n;
      const existing = n.topicIds || [];
      if (existing.includes(topicId)) return n;
      return { ...n, topicIds: [...existing, topicId], courseId: n.courseId || course.id };
    });
    updatePluginData({ notes: updatedNotes });
    setNotePickerFor(null);
  }, [data, updatePluginData, course.id]);

  const unlinkNoteFromTopic = useCallback((noteId: string, topicId: string) => {
    if (!data) return;
    const updatedNotes = (data.pluginData.notes || []).map((n: Note) => {
      if (n.id !== noteId) return n;
      return { ...n, topicIds: (n.topicIds || []).filter(id => id !== topicId) };
    });
    updatePluginData({ notes: updatedNotes });
  }, [data, updatePluginData]);

  // #40 Drag-and-drop topic reordering
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapters.findIndex(t => t.id === active.id);
    const newIndex = chapters.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(chapters, oldIndex, newIndex);
    updateCourseTopics(reordered);
  }

  // Calculate which chapters are unlocked
  const chapterStates = useMemo(() => {
    return chapters.map((ch, i) => {
      const prof = getTopicProficiency(ch.name);
      const mastered = prof >= 80;
      const prevMastered = i === 0 ? true : getTopicProficiency(chapters[i - 1].name) >= 80;
      const unlocked = true; // All chapters available
      const status = !unlocked ? 'locked' : mastered ? 'mastered' : prof > 0 ? 'in-progress' : 'available';
      return { ...ch, prof, mastered, unlocked, status };
    });
  }, [chapters, getTopicProficiency]);

  const completedCount = chapterStates.filter(c => c.mastered).length;
  const overallProgress = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0;

  return (
    <div>
      {/* Overall progress */}
      <div className="card mb-4">
        <div className="card-header">
          <span className="card-title"><Map size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Course Path</span>
          <span className="badge" style={{ borderColor: `${accentColor}50`, color: accentColor }}>
            {overallProgress}% Complete
          </span>
        </div>
        <div className="progress-bar" style={{ height: 6, marginBottom: 8 }}>
          <div className="progress-fill" style={{ width: `${overallProgress}%`, background: accentColor }} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {completedCount} of {chapters.length} chapters mastered
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddTopic(true)}>
          <Plus size={13} /> Add Topic
        </button>
        <button className="btn btn-sm" onClick={() => setShowAllTopics(!showAllTopics)} style={{ gap: 4 }}>
          <Eye size={13} /> {showAllTopics ? 'Hide' : 'All Topics'}
        </button>
        {hasTextbook && chapters.length === 0 && (
          <button onClick={loadTextbookChapters} className="btn btn-sm" style={{ gap: 4 }}>
            <Download size={13} /> Load Textbook
          </button>
        )}
        {hasTextbook && chapters.length > 0 && (
          <button onClick={loadTextbookChapters} className="btn btn-sm" style={{ fontSize: 11, color: 'var(--text-muted)', gap: 4 }} title="Replace current chapters with textbook structure">
            <RotateCcw size={11} /> Reset to Textbook
          </button>
        )}
      </div>

      {/* Add Topic form */}
      {showAddTopic && (
        <div className="card mb-4" style={{ padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>New Topic</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newTopicName} onChange={e => setNewTopicName(e.target.value)} placeholder="Topic name..." autoFocus
              onKeyDown={e => { if (e.key === 'Enter') addTopic(newTopicName); if (e.key === 'Escape') setShowAddTopic(false); }}
              style={{ flex: 1, fontSize: 13 }} />
            <button className="btn btn-primary btn-sm" onClick={() => addTopic(newTopicName)}>Add</button>
            <button className="btn btn-sm" onClick={() => { setShowAddTopic(false); setNewTopicName(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* All Topics Panel */}
      {showAllTopics && (
        <div className="card mb-4" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>All Topics & Subtopics ({chapters.length} topics, {chapters.reduce((s, t) => s + (t.subtopics?.length || 0), 0)} subtopics)</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm" onClick={copyAllTopics} style={{ fontSize: 11, gap: 3 }}><Copy size={11} /> Copy All</button>
              <button className="btn btn-sm" onClick={() => setShowAllTopics(false)} style={{ padding: '2px 6px' }}><X size={12} /></button>
            </div>
          </div>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input value={topicSearch} onChange={e => setTopicSearch(e.target.value)} placeholder="Search topics..." style={{ width: '100%', paddingLeft: 28, fontSize: 12 }} />
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', fontSize: 12 }}>
            {chapters.filter(t => {
              if (!topicSearch) return true;
              const q = topicSearch.toLowerCase();
              return t.name.toLowerCase().includes(q) || (t.subtopics || []).some(st => st.name.toLowerCase().includes(q));
            }).map((t, ti) => (
              <div key={t.id} style={{ marginBottom: 6, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', width: 24 }}>{ti + 1}.</span>
                  {editingTopicId === t.id ? (
                    <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)} autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') updateTopicName(t.id, editTopicName); if (e.key === 'Escape') setEditingTopicId(null); }}
                      onBlur={() => updateTopicName(t.id, editTopicName)}
                      style={{ flex: 1, fontSize: 12, padding: '2px 6px' }} />
                  ) : (
                    <span style={{ flex: 1, fontWeight: 600, cursor: 'pointer' }} onClick={() => { setEditingTopicId(t.id); setEditTopicName(t.name); }}>{t.name}</span>
                  )}
                  <span style={{ fontSize: 10, color: getTopicProficiency(t.name) >= 80 ? 'var(--green)' : getTopicProficiency(t.name) > 0 ? 'var(--yellow)' : 'var(--text-dim)', fontWeight: 700 }}>
                    {getTopicProficiency(t.name)}%
                  </span>
                  <button onClick={() => { setEditingTopicId(t.id); setEditTopicName(t.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}><Edit3 size={11} /></button>
                  <button onClick={() => deleteTopic(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}><Trash2 size={11} /></button>
                </div>
                {(t.subtopics || []).map(st => (
                  <div key={st.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 30, marginTop: 3 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>&#8226;</span>
                      {editingSubtopicId === st.id ? (
                        <input value={editSubtopicName} onChange={e => setEditSubtopicName(e.target.value)} autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') updateSubtopicName(t.id, st.id, editSubtopicName); if (e.key === 'Escape') setEditingSubtopicId(null); }}
                          onBlur={() => updateSubtopicName(t.id, st.id, editSubtopicName)}
                          style={{ flex: 1, fontSize: 11, padding: '1px 4px' }} />
                      ) : (
                        <span style={{ flex: 1, fontSize: 11, cursor: 'pointer' }} onClick={() => setExpandedSubtopic(expandedSubtopic === st.id ? null : st.id)}>
                          {st.name}
                          {st.content && <FileText size={8} style={{ marginLeft: 3, verticalAlign: 'middle', color: accentColor, opacity: 0.6 }} />}
                        </span>
                      )}
                      <span style={{ fontSize: 10, color: getTopicProficiency(st.name) >= 80 ? 'var(--green)' : getTopicProficiency(st.name) > 0 ? 'var(--yellow)' : 'var(--text-dim)' }}>
                        {getTopicProficiency(st.name)}%
                      </span>
                      <button onClick={() => setExpandedSubtopic(expandedSubtopic === st.id ? null : st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: 'var(--text-dim)' }}>
                        {expandedSubtopic === st.id ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                      </button>
                      <button onClick={() => { setEditingSubtopicId(st.id); setEditSubtopicName(st.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: 'var(--text-dim)' }}><Edit3 size={10} /></button>
                      <button onClick={() => deleteSubtopic(t.id, st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: 'var(--text-dim)' }}><Trash2 size={10} /></button>
                    </div>
                    {expandedSubtopic === st.id && (
                      <div style={{ marginLeft: 38, marginTop: 3, marginBottom: 4, padding: '6px 8px', borderRadius: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 11 }}>
                        {editingContentId === st.id ? (
                          <div>
                            <textarea value={editContentText} onChange={e => setEditContentText(e.target.value)} autoFocus rows={4}
                              placeholder="Add notes, key terms, definitions..." style={{ width: '100%', fontSize: 11, fontFamily: 'inherit', resize: 'vertical', marginBottom: 4 }} />
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button className="btn btn-primary btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => updateSubtopicContent(t.id, st.id, editContentText)}>Save</button>
                              <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => setEditingContentId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {st.content ? (
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4, color: 'var(--text-secondary)', marginBottom: 4 }}>{st.content}</div>
                            ) : (
                              <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 4 }}>No content yet.</div>
                            )}
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <button className="btn btn-sm" style={{ fontSize: 10, padding: '1px 5px', gap: 2 }} onClick={() => { setEditingContentId(st.id); setEditContentText(st.content || ''); }}>
                                <Edit3 size={9} /> {st.content ? 'Edit' : 'Add'}
                              </button>
                              {st.content && (
                                <ReadAloudButton text={st.content} label="Read" />
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={() => { setShowAddSubtopic(t.id); setNewSubtopicName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', color: accentColor, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3, marginLeft: 30, marginTop: 3 }}>
                  <Plus size={9} /> Add Subtopic
                </button>
                {showAddSubtopic === t.id && (
                  <div style={{ display: 'flex', gap: 4, paddingLeft: 30, marginTop: 4 }}>
                    <input value={newSubtopicName} onChange={e => setNewSubtopicName(e.target.value)} placeholder="Subtopic name..." autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') addSubtopic(t.id, newSubtopicName); if (e.key === 'Escape') setShowAddSubtopic(null); }}
                      style={{ flex: 1, fontSize: 11, padding: '3px 6px' }} />
                    <button className="btn btn-sm" style={{ fontSize: 10, padding: '2px 6px' }} onClick={() => addSubtopic(t.id, newSubtopicName)}>Add</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {/* Bulk import */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Bulk Import (paste topics, indent subtopics with spaces/tab)</div>
            <textarea value={bulkImportText} onChange={e => setBulkImportText(e.target.value)} placeholder={"Topic 1\n  Subtopic A\n  Subtopic B\nTopic 2\n  Subtopic C"} rows={5}
              style={{ width: '100%', fontSize: 11, fontFamily: 'monospace', resize: 'vertical' }} />
            <button className="btn btn-primary btn-sm" style={{ marginTop: 4, fontSize: 11 }} onClick={() => importBulkTopics(bulkImportText)} disabled={!bulkImportText.trim()}>
              <Upload size={11} /> Import Topics
            </button>
          </div>
        </div>
      )}

      {/* Chapter timeline */}
      {chapters.length === 0 && !showAddTopic ? (
        <div className="empty-state">
          <Map size={40} />
          <h3>No chapters defined</h3>
          <p>Add topics to this course to build the learning path.</p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={chapterStates.map(ch => ch.id)} strategy={verticalListSortingStrategy}>
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Vertical line */}
          <div style={{
            position: 'absolute', left: 11, top: 0, bottom: 0, width: 2,
            background: 'var(--border)',
          }} />

          {chapterStates.map((ch, i) => {
            const isExpanded = expandedChapter === ch.id;
            const statusColor = ch.status === 'mastered' ? 'var(--green)' :
              ch.status === 'in-progress' ? 'var(--yellow)' :
              ch.status === 'available' ? accentColor : 'var(--text-dim)';
            const StatusIcon = ch.status === 'mastered' ? CheckCircle2 :
              ch.status === 'locked' ? Lock :
              ch.status === 'in-progress' ? Clock : Unlock;

            return (
              <SortableChapterRow key={ch.id} id={ch.id}>{(dragHandleProps) => (<>
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute', left: -24, top: 14, width: 22, height: 22,
                  borderRadius: '50%', background: 'var(--bg-primary)',
                  border: `2px solid ${statusColor}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 1,
                }}>
                  <StatusIcon size={12} style={{ color: statusColor }} />
                </div>

                {/* Chapter card */}
                <div
                  onClick={() => ch.unlocked && setExpandedChapter(isExpanded ? null : ch.id)}
                  style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                    background: ch.unlocked ? 'var(--bg-card)' : 'var(--bg-secondary)',
                    border: `1px solid ${ch.status === 'mastered' ? 'var(--green)20' : 'var(--border)'}`,
                    cursor: ch.unlocked ? 'pointer' : 'default',
                    opacity: ch.unlocked ? 1 : 0.5,
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {/* Drag handle */}
                      <button {...dragHandleProps} onClick={e => e.stopPropagation()}
                        style={{ background: 'none', border: 'none', cursor: 'grab', color: 'var(--text-dim)', padding: '2px 2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                        title="Drag to reorder">
                        <GripVertical size={14} />
                      </button>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
                          Ch. {i + 1}
                        </span>
                        {editingTopicId === ch.id ? (
                          <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)} autoFocus
                            onClick={e => e.stopPropagation()}
                            onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') updateTopicName(ch.id, editTopicName); if (e.key === 'Escape') setEditingTopicId(null); }}
                            style={{ fontSize: 13, fontWeight: 700, padding: '2px 6px', flex: 1 }} />
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700 }}>{ch.name}</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); speak(ch.name, { voiceLang: 'ja-JP', rate: 0.9 }); }}
                          title="Read aloud"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)', display: 'inline-flex' }}
                        >
                          <Volume2 size={12} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); setEditingTopicId(ch.id); setEditTopicName(ch.name); }} title="Edit topic" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)', display: 'inline-flex' }}>
                          <Edit3 size={11} />
                        </button>
                        <button onClick={e => { e.stopPropagation(); deleteTopic(ch.id); }} title="Delete topic" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)', display: 'inline-flex' }}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                        <span className="badge" style={{
                          fontSize: 9, borderColor: `${statusColor}40`, color: statusColor,
                        }}>
                          {ch.status === 'locked' ? 'Locked' : ch.status === 'mastered' ? 'Mastered' : ch.status === 'in-progress' ? 'In Progress' : 'Available'}
                        </span>
                        {ch.unlocked && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: statusColor }}>
                            {ch.prof}%
                          </span>
                        )}
                        {/* #6 Difficulty stars */}
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 1 }}>
                            {[1,2,3,4,5].map(d => (
                              <button key={d} title={`Difficulty ${d}`}
                                onClick={() => {
                                  const topics = (course.topics || []).map(t => t.id === ch.id ? { ...t, difficulty: (t.difficulty === d ? undefined : d) as 1|2|3|4|5|undefined } : t)
                                  setData((prev: any) => ({ ...prev, pluginData: { ...prev.pluginData, coachData: { ...prev.pluginData.coachData, courses: prev.pluginData.coachData.courses.map((c: any) => c.id === course.id ? { ...c, topics } : c) } } }))
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', fontSize: 10, color: (ch as any).difficulty >= d ? '#F5A623' : 'var(--text-dim)' }}
                              >★</button>
                            ))}
                          </div>
                        {/* #7 Estimated time */}
                        <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={9} style={{ color: 'var(--text-dim)' }} />
                            <input
                              type="number" min={1} max={999} placeholder="min"
                              value={(ch as any).estimatedMinutes || ''}
                              onChange={e => {
                                const val = e.target.value ? parseInt(e.target.value) : undefined
                                const topics = (course.topics || []).map(t => t.id === ch.id ? { ...t, estimatedMinutes: val } : t)
                                setData((prev: any) => ({ ...prev, pluginData: { ...prev.pluginData, coachData: { ...prev.pluginData.coachData, courses: prev.pluginData.coachData.courses.map((c: any) => c.id === course.id ? { ...c, topics } : c) } } }))
                              }}
                              style={{ width: 38, fontSize: 10, padding: '1px 3px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                            />
                            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>min</span>
                          </div>
                        {/* #5 Prerequisite chips */}
                        {(ch as any).prerequisites?.length > 0 && (
                          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                            {((ch as any).prerequisites as string[]).map((prereqId: string) => {
                              const prereq = (course.topics || []).find(t => t.id === prereqId)
                              return prereq ? (
                                <span key={prereqId} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-dim)' }}>
                                  requires: {prereq.name}
                                </span>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                    </div>{/* end drag-handle+content wrapper */}
                    {ch.unlocked && (
                      isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </div>

                  {ch.unlocked && (
                    <div className="progress-bar" style={{ marginTop: 8 }}>
                      <div className="progress-fill" style={{ width: `${ch.prof}%`, background: statusColor }} />
                    </div>
                  )}

                  {/* Expanded subtopics */}
                  {isExpanded && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      {(ch.subtopics || []).map(st => {
                        const stProf = getTopicProficiency(st.name);
                        const stStatus = st.status || (stProf >= 80 ? 'mastered' : stProf > 0 ? 'learning' : 'not_started');
                        const stColor = stStatus === 'mastered' ? 'var(--green)' : stStatus === 'learning' ? 'var(--yellow)' : 'var(--text-dim)';
                        const isStExpanded = expandedSubtopic === st.id;
                        return (
                          <div key={st.id} style={{ marginBottom: 2 }}>
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 0', fontSize: 12,
                            }}>
                              {stStatus === 'mastered' ? <CheckCircle2 size={13} style={{ color: stColor }} /> : <Circle size={13} style={{ color: stColor }} />}
                              {editingSubtopicId === st.id ? (
                                <input value={editSubtopicName} onChange={e => setEditSubtopicName(e.target.value)} autoFocus
                                  onKeyDown={e => { if (e.key === 'Enter') updateSubtopicName(ch.id, st.id, editSubtopicName); if (e.key === 'Escape') setEditingSubtopicId(null); }}
                                  onBlur={() => updateSubtopicName(ch.id, st.id, editSubtopicName)}
                                  style={{ flex: 1, fontSize: 12, padding: '2px 6px' }} />
                              ) : (
                                <span style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedSubtopic(isStExpanded ? null : st.id)}>
                                  {st.name}
                                  {st.content && <FileText size={9} style={{ marginLeft: 4, verticalAlign: 'middle', color: accentColor, opacity: 0.6 }} />}
                                </span>
                              )}
                              <span style={{ fontSize: 11, fontWeight: 600, color: stColor }}>{stProf}%</span>
                              <button onClick={() => setExpandedSubtopic(isStExpanded ? null : st.id)} title={isStExpanded ? 'Collapse' : 'Expand content'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}>
                                {isStExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              </button>
                              <button onClick={() => { setEditingSubtopicId(st.id); setEditSubtopicName(st.name); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}><Edit3 size={10} /></button>
                              <button onClick={() => deleteSubtopic(ch.id, st.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--text-dim)' }}><Trash2 size={10} /></button>
                            </div>
                            {/* Subtopic content area */}
                            {isStExpanded && (
                              <div style={{
                                marginLeft: 21, marginBottom: 8, padding: '8px 10px',
                                borderRadius: 6, background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)', fontSize: 12,
                              }}>
                                {editingContentId === st.id ? (
                                  <div>
                                    <textarea
                                      value={editContentText}
                                      onChange={e => setEditContentText(e.target.value)}
                                      autoFocus
                                      rows={5}
                                      placeholder="Add notes, key terms, definitions, or study content for this subtopic..."
                                      style={{ width: '100%', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', marginBottom: 6 }}
                                    />
                                    <div style={{ display: 'flex', gap: 4 }}>
                                      <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => updateSubtopicContent(ch.id, st.id, editContentText)}>Save</button>
                                      <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setEditingContentId(null)}>Cancel</button>
                                      {st.content && (
                                        <button className="btn btn-sm" style={{ fontSize: 11, color: 'var(--red)', marginLeft: 'auto' }} onClick={() => { updateSubtopicContent(ch.id, st.id, ''); setEditingContentId(null); }}>Clear</button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    {st.content ? (
                                      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5, color: 'var(--text-secondary)', marginBottom: 6 }}>
                                        {st.content}
                                      </div>
                                    ) : (
                                      <div style={{ color: 'var(--text-dim)', fontStyle: 'italic', marginBottom: 6 }}>
                                        No content yet. Click edit to add notes for this subtopic.
                                      </div>
                                    )}
                                    <button className="btn btn-sm" style={{ fontSize: 11, gap: 3 }} onClick={() => { setEditingContentId(st.id); setEditContentText(st.content || ''); }}>
                                      <Edit3 size={10} /> {st.content ? 'Edit' : 'Add Content'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Add subtopic */}
                      {showAddSubtopic === ch.id ? (
                        <div style={{ display: 'flex', gap: 4, marginTop: 6, paddingLeft: 21 }}>
                          <input value={newSubtopicName} onChange={e => setNewSubtopicName(e.target.value)} placeholder="Subtopic name..." autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') addSubtopic(ch.id, newSubtopicName); if (e.key === 'Escape') setShowAddSubtopic(null); }}
                            style={{ flex: 1, fontSize: 12, padding: '4px 8px' }} />
                          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => addSubtopic(ch.id, newSubtopicName)}>Add</button>
                          <button className="btn btn-sm" style={{ fontSize: 11 }} onClick={() => setShowAddSubtopic(null)}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setShowAddSubtopic(ch.id); setNewSubtopicName(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', color: accentColor, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, paddingLeft: 21 }}>
                          <Plus size={11} /> Add Subtopic
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI Topic Summary */}
                  {isExpanded && (
                    <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          <Sparkles size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />AI Summary
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {ch.summary && (
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedSummary(prev => { const s = new Set(prev); s.has(ch.id) ? s.delete(ch.id) : s.add(ch.id); return s; }); }}
                              className="btn btn-sm"
                              style={{ fontSize: 11, padding: '2px 8px' }}
                            >
                              {expandedSummary.has(ch.id) ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                              {expandedSummary.has(ch.id) ? 'Hide' : 'Show'}
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); generateTopicSummary(ch); }}
                            className="btn btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px', color: 'var(--accent)' }}
                            disabled={generatingSummary === ch.id}
                          >
                            {generatingSummary === ch.id
                              ? <><RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</>
                              : <><Sparkles size={11} /> {ch.summary ? 'Regenerate' : 'Generate Summary'}</>
                            }
                          </button>
                        </div>
                      </div>
                      {ch.summary && expandedSummary.has(ch.id) && (
                        <div style={{
                          fontSize: 12, lineHeight: 1.6, color: 'var(--text-secondary)',
                          padding: '10px 12px', borderRadius: 6,
                          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        }}>
                          {ch.summary}
                        </div>
                      )}
                      {ch.summary && !expandedSummary.has(ch.id) && (
                        <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                          Summary available — click Show to view
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- Combined Links Section (Topics + Notes) --- */}
                  {isExpanded && (() => {
                    const linkedNotes = getLinkedNotes(ch.id);
                    const subLinked = (ch.subtopics || []).flatMap(st => getLinkedNotes(st.id));
                    const allLinkedNotes = [...linkedNotes, ...subLinked.filter(n => !linkedNotes.some(l => l.id === n.id))];
                    const linkedTopicIds = ch.links || [];
                    const totalLinks = linkedTopicIds.length + allLinkedNotes.length;
                    // Notes available to link (not already linked to this topic)
                    const courseNotes = allNotes.filter(n => n.courseId === course.id || !n.courseId);
                    const unlinkableNotes = courseNotes.filter(n => !n.topicIds?.includes(ch.id));

                    return (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            <Link size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            Links {totalLinks > 0 && `(${totalLinks})`}
                          </span>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={e => { e.stopPropagation(); setNotePickerFor(notePickerFor === ch.id ? null : ch.id); setLinkPickerFor(null); }}
                              className="btn btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11, background: notePickerFor === ch.id ? `${accentColor}20` : undefined }}
                            >
                              <FileText size={11} /> Note
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setLinkPickerFor(linkPickerFor === ch.id ? null : ch.id); setNotePickerFor(null); }}
                              className="btn btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11, background: linkPickerFor === ch.id ? `${accentColor}20` : undefined }}
                            >
                              <GitBranch size={11} /> Topic
                            </button>
                          </div>
                        </div>

                        {/* Linked topic chips */}
                        {linkedTopicIds.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            {linkedTopicIds.map(linkedId => {
                              const lt = chapters.find(c => c.id === linkedId);
                              if (!lt) return null;
                              return (
                                <span key={linkedId} style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                                  background: `${accentColor}15`, border: `1px solid ${accentColor}30`, color: accentColor, cursor: 'pointer',
                                }} onClick={e => { e.stopPropagation(); setExpandedChapter(linkedId); }}>
                                  <GitBranch size={10} />
                                  {lt.name}
                                  <button onClick={ev => { ev.stopPropagation(); updateTopicLinks(ch.id, linkedTopicIds.filter(l => l !== linkedId)); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: accentColor, display: 'inline-flex', marginLeft: 2 }}>
                                    <X size={10} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Linked note chips */}
                        {allLinkedNotes.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                            {allLinkedNotes.map(n => (
                              <div key={n.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                                borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 11,
                              }}>
                                <FileText size={12} style={{ color: accentColor, flexShrink: 0 }} />
                                <span style={{ fontWeight: 600, cursor: 'pointer' }} onClick={() => {
                                  if ((n.type as string) === 'lecture') {
                                    // Navigate to lectures tab in this course
                                    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
                                    params.set('tab', 'lectures');
                                    navigate(`/course/${course.id}?${params.toString()}`);
                                  } else {
                                    navigate('/library?tab=notes');
                                  }
                                }}>{n.title}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto', whiteSpace: 'nowrap', marginRight: 4 }}>{(n.type as string) === 'lecture' ? '📝 Lecture' : n.type === 'note' ? '📄' : ''} {formatDateShort(n.updatedAt)}</span>
                                <button onClick={ev => { ev.stopPropagation(); unlinkNoteFromTopic(n.id, ch.id); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'var(--text-dim)', display: 'inline-flex' }}
                                  title="Unlink note">
                                  <X size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {totalLinks === 0 && notePickerFor !== ch.id && linkPickerFor !== ch.id && (
                          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
                            No links yet. Add a linked topic or note.
                          </div>
                        )}

                        {/* Note picker dropdown */}
                        {notePickerFor === ch.id && (
                          <div style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 180, overflowY: 'auto', marginBottom: 8,
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, padding: '0 4px' }}>
                              Link a Note
                            </div>
                            {unlinkableNotes.length > 0 ? unlinkableNotes.map(n => (
                              <button key={n.id}
                                onClick={e => { e.stopPropagation(); linkNoteToTopic(n.id, ch.id); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                  padding: '6px 8px', background: 'none', border: 'none',
                                  borderRadius: 4, cursor: 'pointer', fontSize: 12,
                                  color: 'var(--text-secondary)', fontFamily: 'inherit', textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                <FileText size={12} style={{ color: 'var(--text-dim)' }} />
                                <span>{n.title}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{n.type}</span>
                              </button>
                            )) : (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 8, textAlign: 'center' }}>
                                {allNotes.length === 0 ? 'No notes yet. Create one in Library first.' : 'All notes already linked'}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Topic link picker dropdown */}
                        {linkPickerFor === ch.id && (
                          <div style={{
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', padding: 8, maxHeight: 160, overflowY: 'auto',
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4, padding: '0 4px' }}>
                              Link a Topic
                            </div>
                            {chapters.filter(other => other.id !== ch.id && !linkedTopicIds.includes(other.id)).map(other => (
                              <button key={other.id}
                                onClick={e => { e.stopPropagation(); updateTopicLinks(ch.id, [...linkedTopicIds, other.id]); setLinkPickerFor(null); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                  padding: '6px 8px', background: 'none', border: 'none',
                                  borderRadius: 4, cursor: 'pointer', fontSize: 12,
                                  color: 'var(--text-secondary)', fontFamily: 'inherit', textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                <GitBranch size={12} style={{ color: 'var(--text-dim)' }} />
                                {other.name}
                              </button>
                            ))}
                            {chapters.filter(other => other.id !== ch.id && !linkedTopicIds.includes(other.id)).length === 0 && (
                              <div style={{ fontSize: 11, color: 'var(--text-dim)', padding: 8, textAlign: 'center' }}>
                                All topics already linked
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Study Content (Key Terms & Concepts) */}
                  {isExpanded && (() => {
                    const sc = getStudyContent(course.name, ch.name, i);
                    if (!sc || (sc.keyTerms.length === 0 && sc.keyConcepts.length === 0)) return null;
                    return (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        {sc.keyConcepts.length > 0 && (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                              <Sparkles size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              Key Concepts
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                              {sc.keyConcepts.map((c, ci) => (
                                <span key={ci} style={{
                                  fontSize: 11, padding: '3px 8px', borderRadius: 6,
                                  background: `${accentColor}12`, border: `1px solid ${accentColor}25`,
                                  color: 'var(--text-secondary)',
                                }}>{c}</span>
                              ))}
                            </div>
                          </>
                        )}
                        {sc.keyTerms.length > 0 && (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                              <BookOpen size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              Key Terms ({sc.keyTerms.length})
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                              {sc.keyTerms.slice(0, 20).map((t, ti) => {
                                const catColors: Record<string, string> = {
                                  concept: '#6366f1', process: '#22c55e', molecule: '#f59e0b',
                                  structure: '#3b82f6', technique: '#a855f7', organism: '#14b8a6',
                                  disease: '#ef4444', equation: '#f59e0b', unit: '#06b6d4',
                                  device: '#8b5cf6', phenomenon: '#ec4899',
                                };
                                const col = catColors[t.category || ''] || 'var(--text-muted)';
                                return (
                                  <span key={ti} style={{
                                    fontSize: 10, padding: '2px 7px', borderRadius: 4,
                                    background: 'var(--bg-secondary)', border: `1px solid var(--border)`,
                                    color: 'var(--text-secondary)',
                                  }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block', marginRight: 4, verticalAlign: 'middle' }} />
                                    {t.term}
                                  </span>
                                );
                              })}
                              {sc.keyTerms.length > 20 && (
                                <span style={{ fontSize: 10, padding: '2px 7px', color: 'var(--text-dim)' }}>
                                  +{sc.keyTerms.length - 20} more
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        {sc.keyEquationsOrExperiments.length > 0 && (
                          <>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                              <Microscope size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                              {course.name.toUpperCase().includes('PHYS') ? 'Key Equations' : 'Key Experiments'}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {sc.keyEquationsOrExperiments.map((e, ei) => (
                                <div key={ei} style={{ padding: '2px 0' }}>• {e}</div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Related Lectures (cross-link) */}
                  {isExpanded && (() => {
                    // Try extracting chapter number from topic name (e.g. "Lecture 5: ..." → 5)
                    const numMatch = ch.name.match(/(?:Lecture|Ch|Chapter)\s*(\d+)/i);
                    const chapterNum = numMatch ? parseInt(numMatch[1], 10) : (i + 1);
                    const relLectures = getLecturesForChapter(course.name, chapterNum);
                    if (relLectures.length === 0) return null;
                    return (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                          <GraduationCap size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          Related Lectures ({relLectures.length})
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {relLectures.map((rl: LectureItem) => (
                            <div key={rl.id} style={{
                              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
                              borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                              fontSize: 11,
                            }}>
                              <BookOpen size={12} style={{ color: rl.type === 'exam' ? '#ef4444' : accentColor, flexShrink: 0 }} />
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rl.title}</span>
                              {rl.unit && <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>{rl.unit}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Old linked topics section removed — merged into combined Links section above */}
                </div>
              </>)}</SortableChapterRow>
            );
          })}
        </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
