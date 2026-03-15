import { useState } from 'react';
import { GitMerge } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import type { Course, CourseTopic } from '../../types';
import { selectStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface Prerequisite {
  name: string;
  checked: boolean;
  matchedTopicProficiency: number | null;
}

function PrerequisiteTool() {
  const { data } = useStore();
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [prerequisites, setPrerequisites] = useState<Prerequisite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const courses: Course[] = data?.pluginData?.coachData?.courses || [];
  const selectedCourse = courses.find(c => c.id === selectedCourseId);
  const topics: CourseTopic[] = selectedCourse?.topics || [];
  const selectedTopic = topics.find(t => t.id === selectedTopicId);

  function findTopicProficiency(prereqName: string): number | null {
    const profData = data?.pluginData?.proficiencyData;
    if (!profData) return null;
    const prereqLower = prereqName.toLowerCase();
    for (const subjectKey of Object.keys(profData.subjects || {})) {
      for (const topicKey of Object.keys(profData.subjects[subjectKey] || {})) {
        if (topicKey.toLowerCase().includes(prereqLower) || prereqLower.includes(topicKey.toLowerCase())) {
          return Math.round(profData.subjects[subjectKey][topicKey].proficiencyScore);
        }
      }
    }
    // Also check all courses for a topic with similar name
    for (const course of courses) {
      for (const topic of course.topics || []) {
        if (
          topic.name.toLowerCase().includes(prereqLower) ||
          prereqLower.includes(topic.name.toLowerCase())
        ) {
          const entry = profData.subjects?.[course.name]?.[topic.name];
          if (entry) return Math.round(entry.proficiencyScore);
        }
      }
    }
    return null;
  }

  async function checkPrerequisites() {
    if (!selectedTopicId || !selectedTopic) return;
    setLoading(true);
    setError('');
    setPrerequisites([]);

    try {
      const prompt = `For studying the topic and course below, what prerequisite concepts should I know first?
<topic>${selectedTopic.name}</topic>
<course>${selectedCourse?.name ?? ''}</course> List 5-8 specific concepts that are directly needed to understand this topic well.

Return your answer as a simple numbered list, one concept per line. Do not include any other text or explanations.`;

      const response = await callAI([{ role: 'user', content: prompt }], {}, 'generation');
      // Parse numbered list
      const lines = response
        .split('\n')
        .map(l => l.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '').trim())
        .filter(l => l.length > 3)
        .slice(0, 8);

      if (lines.length === 0) {
        setError('Could not parse prerequisites from AI response. Please try again.');
        return;
      }

      const prereqs: Prerequisite[] = lines.map(name => ({
        name,
        checked: false,
        matchedTopicProficiency: findTopicProficiency(name),
      }));
      setPrerequisites(prereqs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred.');
    } finally {
      setLoading(false);
    }
  }

  function toggleCheck(index: number) {
    setPrerequisites(prev => prev.map((p, i) => i === index ? { ...p, checked: !p.checked } : p));
  }

  if (!isAIConfigured()) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
        <GitMerge size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
        <p style={{ fontSize: 14 }}>Configure your AI provider in Settings to use this feature.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <GitMerge size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Prerequisite Check
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {courses.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No courses found. Create a course first.</p>
          ) : (
            <>
              <select
                value={selectedCourseId}
                onChange={e => { setSelectedCourseId(e.target.value); setSelectedTopicId(''); setPrerequisites([]); }}
                style={selectStyle}
              >
                <option value="">Select a course...</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              {selectedCourseId && (
                <select
                  value={selectedTopicId}
                  onChange={e => { setSelectedTopicId(e.target.value); setPrerequisites([]); }}
                  style={selectStyle}
                >
                  <option value="">Select a topic...</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              <button
                className="btn btn-primary"
                onClick={checkPrerequisites}
                disabled={!selectedTopicId || loading}
              >
                {loading ? 'Checking...' : 'Check Prerequisites'}
              </button>
            </>
          )}
        </div>

        {error && (
          <p style={{ marginTop: 8, fontSize: 13, color: 'var(--red)' }}>{error}</p>
        )}
      </div>

      {prerequisites.length > 0 && (
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Prerequisites for <span style={{ color: 'var(--accent-light)' }}>{selectedTopic?.name}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Check off concepts you already know. Green dot = proficiency tracked in your courses.
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {prerequisites.map((prereq, i) => {
              const hasProficiency = prereq.matchedTopicProficiency !== null;
              const isProficient = hasProficiency && (prereq.matchedTopicProficiency ?? 0) > 60;
              return (
                <div
                  key={i}
                  onClick={() => toggleCheck(i)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${prereq.checked ? 'var(--accent)' : 'var(--border)'}`,
                    background: prereq.checked ? 'var(--accent-glow)' : 'var(--bg-input)',
                    cursor: 'pointer', transition: 'all 0.2s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={prereq.checked}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
                  />
                  <span style={{
                    flex: 1, fontSize: 13,
                    color: prereq.checked ? 'var(--accent-light)' : 'var(--text-primary)',
                    textDecoration: prereq.checked ? 'line-through' : 'none',
                    fontWeight: prereq.checked ? 400 : 500,
                  }}>
                    {prereq.name}
                  </span>
                  {hasProficiency && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: isProficient ? 'var(--green)' : 'var(--yellow)',
                      }} />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {prereq.matchedTopicProficiency}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            {prerequisites.filter(p => p.checked).length} / {prerequisites.length} concepts checked off
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrerequisiteToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Prerequisites">
      <PrerequisiteTool />
    </ToolErrorBoundary>
  );
}
