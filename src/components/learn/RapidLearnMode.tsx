/**
 * RapidLearnMode — Quick cram session with AI-powered summary.
 * Extracted from LearnPage.tsx for use in UnifiedLearnPage.
 */
import { useState, useEffect, useMemo } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { sanitizeHtml } from '../../utils/sanitize';
import { renderMd } from '../../utils/renderMd';

// ── Shared local styles ───────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function SubjectPicker({ courses, value, onChange }: {
  courses: { id: string; name: string; shortName: string; topics?: any[]; flashcards?: any[] }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const course = courses.find(c => c.id === value);
  const topicCount = (course?.topics || []).length;
  const cardCount = (course?.flashcards || []).length;

  return (
    <div style={{ marginBottom: 12 }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}
      >
        <option value="">All subjects</option>
        {courses.map(c => {
          const tc = (c.topics || []).length;
          const fc = (c.flashcards || []).length;
          const label = `${c.shortName || c.name}${tc ? ` (${tc} topics · ${fc} cards)` : ''}`;
          return <option key={c.id} value={c.id}>{label}</option>;
        })}
      </select>
      {value && course && topicCount === 0 && cardCount === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          No content found for this course yet.
        </div>
      )}
    </div>
  );
}

export default function RapidLearnMode() {
  const { courses, data } = useStore();
  const [topic, setTopic] = useState('');
  const [subject, setSubject] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [weakSpots, setWeakSpots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const quizHistory = data?.pluginData?.quizHistory || [];
    const weak: string[] = [];
    quizHistory.forEach((q: any) => {
      if (q.score !== undefined && q.score < 60 && q.name) {
        if (!weak.includes(q.name)) weak.push(q.name);
      }
    });
    if (weak.length === 0) {
      courses.forEach(c => {
        if ((c.flashcards?.length || 0) > 0) {
          const topicNames = (c.topics || []).slice(0, 2).map((t: any) => t.name);
          topicNames.forEach((n: string) => { if (!weak.includes(n)) weak.push(n); });
        }
      });
    }
    setWeakSpots(weak.slice(0, 5));
  }, [courses, data]);

  async function generate() {
    setLoading(true);
    const course = courses.find(c => c.id === subject);
    const topicLower = topic.toLowerCase();
    const items: { front: string; back: string }[] = [];

    const cards = course?.flashcards || courses.flatMap(c => c.flashcards || []);
    cards.forEach(c => { if (c.front && c.back) items.push({ front: c.front, back: c.back }); });

    const quizBank = data?.pluginData?.quizBank as Record<string, unknown> | undefined;
    const bankQuizzes = (quizBank?.quizzes || []) as { name?: string; subject?: string; questions?: { question?: string; correctAnswer?: string; explanation?: string }[] }[];
    for (const quiz of bankQuizzes) {
      if (course && quiz.subject !== course.name && quiz.subject !== course.shortName && quiz.name !== course.name) continue;
      for (const q of (quiz.questions || [])) {
        if (q.question && q.correctAnswer) {
          items.push({ front: q.question, back: q.correctAnswer + (q.explanation ? ` — ${q.explanation}` : '') });
        }
      }
    }

    const quizHistory = data?.pluginData?.quizHistory || [];
    for (const attempt of quizHistory as any[]) {
      if (course && attempt.subject !== course.name && attempt.subject !== course.shortName) continue;
      for (const a of (attempt.answers || [])) {
        if (a.question?.question && a.question?.correctAnswer) {
          items.push({ front: a.question.question, back: a.question.correctAnswer + (a.question.explanation ? ` — ${a.question.explanation}` : '') });
        }
      }
    }

    const matchSets = (data?.pluginData?.matchSets || []) as { name?: string; subject?: string; pairs?: { term: string; definition: string }[] }[];
    for (const ms of matchSets) {
      if (course && ms.subject !== course.name && ms.subject !== course.shortName) continue;
      for (const p of (ms.pairs || [])) {
        if (p.term && p.definition) items.push({ front: p.term, back: p.definition });
      }
    }

    const notes = (data?.pluginData?.notes || []) as { title?: string; content?: string; courseId?: string }[];
    for (const note of notes) {
      if (course && note.courseId !== course.id) continue;
      if (note.content && note.title) {
        const plainText = note.content.replace(/<[^>]+>/g, '').trim();
        if (plainText.length > 20) items.push({ front: note.title, back: plainText.slice(0, 200) });
      }
    }

    const seen = new Set<string>();
    const unique = items.filter(item => {
      const key = item.front.trim().toLowerCase().slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const relevant = unique.filter(c => topicLower ? (c.front + c.back).toLowerCase().includes(topicLower) : true);
    const selected = shuffleArray(relevant.length > 0 ? relevant : unique).slice(0, 15);

    if (selected.length === 0) {
      setOutput(['No matching content found. Try a different topic or add courses with content.']);
      setLoading(false);
      return;
    }

    const sourceText = selected.map(c => `${c.front}: ${c.back}`).join('\n');

    if (isAIConfigured()) {
      try {
        let result = '';
        await callAI([{
          role: 'system',
          content: 'You are a study cram assistant. Given study material (quiz questions, notes, flashcards), produce a concise, high-impact study summary. Include: 1) Key concepts overview (2-3 sentences), 2) Important relationships between concepts, 3) Common pitfalls/mistakes to avoid, 4) A memory aid or mnemonic. Be direct and concise. Use markdown formatting.',
        }, {
          role: 'user',
          content: `Topic: ${topic || 'General Review'}\nCourse: ${course?.name || 'All courses'}\nContent sources: ${selected.length} items from quizzes, notes, and flashcards\n\nStudy material:\n${sourceText}`,
        }], {
          onChunk: (chunk: string) => { result += chunk; setOutput(result.split('\n')); },
        }, 'analysis');
        if (!result) setOutput(result.split('\n'));
        setLoading(false);
        return;
      } catch { /* fall through */ }
    }

    const points: string[] = [
      `Topic: ${topic || 'General Review'}`, `---`,
      ...selected.map((c, i) => `${i + 1}. ${c.front}: ${c.back}`),
      `---`, `Key takeaway: Focus on understanding the relationships between these ${selected.length} concepts.`,
    ];
    setOutput(points);
    setLoading(false);
  }

  return (
    <div>
      <p className="text-sm text-muted mb-3">
        Quick cram session — get AI-powered summaries and identify weak spots.
        Uses quizzes, notes, flashcards, and match sets as source material.
      </p>
      <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
      {weakSpots.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--red-dim)', marginBottom: 10, padding: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Weak Spots — review these topics:
          </div>
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            {weakSpots.map(w => (
              <button key={w} className="btn btn-sm btn-secondary"
                onClick={() => setTopic(w)} style={{ fontSize: 10, padding: '2px 8px' }}>
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2 mb-3">
        <input
          type="text" value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="Enter topic (e.g., mitosis, recursion, WW2)..."
          style={{ ...inputStyle, flex: 1 }}
          onKeyDown={e => e.key === 'Enter' && generate()}
        />
        <button className="btn btn-primary btn-sm" onClick={generate} disabled={loading}>
          <Zap size={14} /> {loading ? '...' : 'Cram'}
        </button>
      </div>
      {output.length > 0 && (
        <div style={{ ...cardStyle, background: 'var(--bg-primary)', marginTop: 8 }}>
          {output.map((line, i) => (
            <div key={i} style={{
              fontSize: 13, lineHeight: 1.7, padding: '4px 0',
              borderBottom: line === '---' ? '1px solid var(--border)' : undefined,
              color: line === '---' ? 'transparent' : 'var(--text-primary)',
            }}
              dangerouslySetInnerHTML={{ __html: line === '---' ? '' : sanitizeHtml(renderMd(line)) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
