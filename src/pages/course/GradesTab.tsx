import { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart2, Plus, Download, Trash2 } from 'lucide-react';
import type { Course } from '../../types';
import { generateId } from '../../components/course/courseHelpers';

interface GradeItem {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: number;
  category: string;
}

export default function GradesTab({ course, accentColor, canvasUrl, canvasToken }: { course: Course; accentColor: string; canvasUrl?: string; canvasToken?: string }) {
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
      const { syncCanvasCourses, matchCanvasCourse, syncCanvasGrades } = await import('../../utils/canvasSync');
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
