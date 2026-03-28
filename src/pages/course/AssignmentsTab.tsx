import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Download, Trash2, CheckCircle2, Circle } from 'lucide-react';
import type { Course } from '../../types';
import { generateId, formatDate } from '../../components/course/courseHelpers';

interface AssignmentItem {
  id: string;
  name: string;
  dueDate: string;
  weight: number;
  completed: boolean;
}

export default function AssignmentsTab({ course, accentColor, canvasUrl, canvasToken }: { course: Course; accentColor: string; canvasUrl?: string; canvasToken?: string }) {
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
      const { syncCanvasCourses, matchCanvasCourse, syncCanvasAssignments } = await import('../../utils/canvasSync');
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
