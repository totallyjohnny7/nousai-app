import { useState } from 'react';
import { CalendarDays, Save } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Course } from '../../types';
import { selectStyle, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import { parseJsonArray } from '../../utils/parseJson';

interface WeekBlock {
  week: number;
  focus: string;
  hours: number;
  tasks: string[];
}

function StudyScheduleTool() {
  const { data, updatePluginData } = useStore();
  const [goalName, setGoalName] = useState('');
  const [examDate, setExamDate] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState(10);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [schedule, setSchedule] = useState<WeekBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const courses: Course[] = data?.pluginData?.coachData?.courses || [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  const daysUntilExam = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  const weeksUntilExam = Math.ceil(daysUntilExam / 7);

  async function generate() {
    if (!goalName.trim() || !examDate || !selectedCourseId || !selectedCourse) return;
    setLoading(true);
    setError('');
    setSaved(false);
    setSchedule([]);

    try {
      const profData = data?.pluginData?.proficiencyData;
      const topicsWithProf = (selectedCourse.topics || []).map(t => {
        const entry = profData?.subjects?.[selectedCourse.name]?.[t.name];
        const score = entry ? Math.round(entry.proficiencyScore) : 0;
        return `${t.name} (proficiency: ${score}%)`;
      }).join('\n');

      const prompt = `Create a ${weeksUntilExam}-week study schedule for the goal and course below.
<goal>${goalName}</goal>
<course>${selectedCourse.name}</course>
Exam/Goal date: ${examDate} (${daysUntilExam} days from now)
Available hours per week: ${hoursPerWeek}

Topics and current proficiency:
${topicsWithProf || 'No topics listed'}

Create a realistic weekly plan. Prioritize lower-proficiency topics. Schedule high-yield topics (most likely to appear on exams or most foundational) earlier.
Flag any topics that are commonly under-studied or frequently missed by students in the tasks.
Include specific study strategies per topic type (e.g., "use spaced repetition for vocabulary", "practice problems for calculation-heavy topics", "diagram-based review for anatomy").

Return ONLY a valid JSON array with one object per week:
[{"week":1,"focus":"Topic A, Topic B","hours":${hoursPerWeek},"tasks":["Task 1","Task 2","Task 3"]},...]

Include all ${weeksUntilExam} weeks. Distribute hours realistically (total should sum to ~${hoursPerWeek * weeksUntilExam}).`;

      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      const parsed = parseJsonArray(response);
      if (!parsed || parsed.length === 0) {
        setError('Could not parse schedule from AI response. Please try again.');
        return;
      }
      const blocks: WeekBlock[] = (parsed as Record<string, unknown>[]).map(item => ({
        week: Number(item.week) || 1,
        focus: String(item.focus || ''),
        hours: Number(item.hours) || hoursPerWeek,
        tasks: Array.isArray(item.tasks) ? (item.tasks as unknown[]).map(String) : [],
      }));
      setSchedule(blocks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function saveSchedule() {
    if (!data || schedule.length === 0 || !selectedCourse) return;
    const existing = data.pluginData?.studySchedules || [];
    const newSchedule = {
      id: crypto.randomUUID(),
      courseName: selectedCourse.name,
      examDate,
      hoursPerWeek,
      blocks: [],
      createdAt: new Date().toISOString(),
    };
    updatePluginData({ studySchedules: [...existing, newSchedule] });
    setSaved(true);
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <CalendarDays size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <CalendarDays size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          AI Study Schedule
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              EXAM / GOAL NAME
            </label>
            <input
              type="text"
              value={goalName}
              onChange={e => setGoalName(e.target.value)}
              placeholder="e.g., Midterm Exam, Final Project..."
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              EXAM DATE
            </label>
            <input
              type="date"
              value={examDate}
              onChange={e => { setExamDate(e.target.value); setSaved(false); setSchedule([]); }}
              style={inputStyle}
              min={new Date().toISOString().split('T')[0]}
            />
            {examDate && daysUntilExam > 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {daysUntilExam} days ({weeksUntilExam} weeks) from today
              </p>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              HOURS AVAILABLE PER WEEK
            </label>
            <input
              type="number"
              min={1}
              max={40}
              value={hoursPerWeek}
              onChange={e => setHoursPerWeek(Math.min(40, Math.max(1, parseInt(e.target.value) || 10)))}
              style={{ ...inputStyle, width: 100 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              COURSE
            </label>
            {courses.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses found. Create a course first.</p>
            ) : (
              <select
                value={selectedCourseId}
                onChange={e => { setSelectedCourseId(e.target.value); setSchedule([]); setSaved(false); }}
                style={selectStyle}
              >
                <option value="">Select a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={!goalName.trim() || !examDate || !selectedCourseId || loading || daysUntilExam === 0}
          >
            {loading ? 'Generating Schedule...' : 'Generate Schedule'}
          </button>
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {schedule.length > 0 && (
        <div>
          <div style={{ overflowX: 'auto', marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Week', 'Focus Areas', 'Hours', 'Tasks'].map(h => (
                    <th key={h} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {schedule.map((block, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: i % 2 === 0 ? 'transparent' : 'var(--bg-input)',
                    }}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent-light)', whiteSpace: 'nowrap' }}>
                      Week {block.week}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                      {block.focus}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {block.hours}h
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-secondary)' }}>
                        {block.tasks.map((task, ti) => (
                          <li key={ti} style={{ marginBottom: 2 }}>{task}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            className="btn btn-primary"
            onClick={saveSchedule}
            disabled={saved}
          >
            <Save size={14} /> {saved ? 'Schedule Saved!' : 'Save Schedule'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StudyScheduleToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Study Schedule">
      <StudyScheduleTool />
    </ToolErrorBoundary>
  );
}
