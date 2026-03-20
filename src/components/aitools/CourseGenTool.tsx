import { useState } from 'react';
import { BookOpen, ChevronRight, Save, FlaskConical, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { searchAcademic } from '../../utils/valyu';
import type { Note } from '../../types';
import { uid, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface CourseModule {
  id: string;
  title: string;
  topics: { id: string; name: string; subtopics: string[] }[];
}

function CourseGeneratorTool() {
  const { data, updatePluginData } = useStore();
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [academicVerified, setAcademicVerified] = useState(false);

  async function generateCourse() {
    if (!subject.trim()) return;
    setGenerating(true);
    setAcademicVerified(false);

    // Fetch academic context from Valyu to enrich module descriptions
    const valyuCtx = await searchAcademic(subject);
    const academicSources = valyuCtx.isVerified ? valyuCtx.sources : [];
    setAcademicVerified(valyuCtx.isVerified);

    setTimeout(() => {
      const diffConfig = {
        beginner: { moduleCount: 4, topicCount: 3, subtopicCount: 2 },
        intermediate: { moduleCount: 6, topicCount: 4, subtopicCount: 3 },
        advanced: { moduleCount: 8, topicCount: 5, subtopicCount: 4 },
      }[difficulty];

      const moduleTemplates = [
        'Introduction & Foundations',
        'Core Concepts',
        'Fundamental Principles',
        'Methods & Techniques',
        'Analysis & Application',
        'Advanced Topics',
        'Practical Projects',
        'Case Studies & Real-World Applications',
        'Integration & Synthesis',
        'Assessment & Review',
      ];

      const topicTemplates = [
        'Overview & Definitions', 'Historical Context', 'Key Terminology',
        'Basic Principles', 'Core Frameworks', 'Theoretical Models',
        'Practical Methods', 'Problem-Solving Strategies', 'Common Patterns',
        'Data Analysis', 'Experimental Design', 'Research Methods',
        'Advanced Techniques', 'Optimization', 'Edge Cases',
        'Hands-on Exercise', 'Group Project', 'Capstone Assignment',
        'Review & Summary', 'Practice Questions', 'Further Reading',
      ];

      const generated: CourseModule[] = [];
      for (let m = 0; m < diffConfig.moduleCount; m++) {
        const topics: CourseModule['topics'] = [];
        for (let t = 0; t < diffConfig.topicCount; t++) {
          const subtopics: string[] = [];
          for (let s = 0; s < diffConfig.subtopicCount; s++) {
            // Use academic paper titles/snippets to enrich subtopic descriptions where available
            const sourceIdx = (m * diffConfig.topicCount * diffConfig.subtopicCount + t * diffConfig.subtopicCount + s);
            const source = academicSources[sourceIdx % (academicSources.length || 1)];
            const enriched = source && valyuCtx.isVerified
              ? `${subject}: ${source.title.slice(0, 60)}${source.title.length > 60 ? '…' : ''}`
              : `${subject} - Detail ${t + 1}.${s + 1}`;
            subtopics.push(enriched);
          }
          topics.push({
            id: uid(),
            name: topicTemplates[(m * diffConfig.topicCount + t) % topicTemplates.length],
            subtopics,
          });
        }
        generated.push({
          id: uid(),
          title: `Module ${m + 1}: ${moduleTemplates[m % moduleTemplates.length]}`,
          topics,
        });
      }

      setModules(generated);
      setSaved(false);
      setGenerating(false);
    }, 800);
  }

  function saveCourse() {
    if (!data) return;
    const courseText = modules.map(m => {
      let text = `# ${m.title}\n`;
      (m.topics || []).forEach((t, ti) => {
        text += `  ${ti + 1}. ${t.name}\n`;
        (t.subtopics || []).forEach((s, si) => {
          text += `    ${ti + 1}.${si + 1} ${s}\n`;
        });
      });
      return text;
    }).join('\n');

    const note: Note = {
      id: uid(),
      title: `${subject} — ${difficulty} Course Outline`,
      content: `# ${subject} - ${difficulty} Course\n\n${courseText}`,
      folder: 'AI Tools',
      tags: ['course-outline', subject, difficulty],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output' as const,
    };
    const notes = [...(data.pluginData?.notes || []), note];
    updatePluginData({ notes });
    setSaved(true);
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <BookOpen size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Study Course Generator
        </div>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && generateCourse()}
          placeholder="Enter subject (e.g., Organic Chemistry, Machine Learning)..."
          style={{ ...inputStyle, marginBottom: 12 }}
        />
        <div className="flex gap-2 mb-3">
          {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`btn btn-sm ${difficulty === d ? 'btn-primary' : 'btn-secondary'}`}
              style={{ flex: 1, textTransform: 'capitalize' }}
            >
              {d}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={generateCourse}
          disabled={!subject.trim() || generating}
          style={{ width: '100%' }}
        >
          {generating ? 'Generating...' : 'Generate Course Outline'}
        </button>
      </div>

      {/* Generated modules */}
      {modules.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                {subject} <span className="text-muted" style={{ fontWeight: 400, fontSize: 12 }}>({difficulty})</span>
              </h3>
              {academicVerified ? (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 600, padding: '2px 7px',
                  borderRadius: 10, background: 'var(--blue)18', color: 'var(--blue)',
                }}>
                  <FlaskConical size={10} /> Powered by academic research
                </span>
              ) : (
                <span title="Add VITE_VALYU_API_KEY to .env for academic enrichment" style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, padding: '2px 7px', borderRadius: 10,
                  background: 'var(--yellow)18', color: 'var(--yellow)',
                }}>
                  <AlertTriangle size={10} /> Template-based
                </span>
              )}
            </div>
            <button className="btn btn-sm btn-secondary" onClick={saveCourse} disabled={saved}>
              <Save size={14} /> {saved ? 'Saved!' : 'Save to Library'}
            </button>
          </div>
          {modules.map((m, mi) => (
            <ModuleCard key={m.id} module={m} index={mi} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModuleCard({ module, index }: { module: CourseModule; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);

  return (
    <div className="card mb-2" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
          fontFamily: 'inherit', padding: 0,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>{module.title}</span>
        <ChevronRight
          size={16}
          style={{
            color: 'var(--text-muted)',
            transform: expanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {(module.topics || []).map((t, ti) => (
            <div key={t.id} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {ti + 1}. {t.name}
              </div>
              <div style={{ paddingLeft: 16 }}>
                {(t.subtopics || []).map((s, si) => (
                  <div key={si} className="text-xs text-muted" style={{ lineHeight: 2 }}>
                    {ti + 1}.{si + 1} {s}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseGenToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Course Generator">
      <CourseGeneratorTool />
    </ToolErrorBoundary>
  );
}
