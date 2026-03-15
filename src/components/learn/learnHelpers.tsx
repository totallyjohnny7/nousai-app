/**
 * Shared helpers, styles, and small components for LearnPage modes.
 */
import { useState, useMemo } from 'react';

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: 16,
};
export const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px', border: '2px solid var(--border)',
  borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
  fontFamily: 'inherit',
};
export const textareaStyle: React.CSSProperties = {
  ...inputStyle, resize: 'vertical' as const, lineHeight: 1.7,
};

import { ChevronLeft } from 'lucide-react';

export function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn btn-sm btn-secondary mb-3" style={{ gap: 4 }}>
      <ChevronLeft size={14} /> Back
    </button>
  );
}

export function SubjectPicker({ courses, value, onChange, showTopics, onTopicsChange }: {
  courses: { id: string; name: string; shortName: string; topics?: any[]; flashcards?: any[] }[];
  value: string;
  onChange: (v: string) => void;
  showTopics?: boolean;
  onTopicsChange?: (topics: Set<string>) => void;
}) {
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());

  const course = courses.find(c => c.id === value);
  const availableTopics = useMemo(() => {
    if (!course || !showTopics) return [];
    const counts = new Map<string, number>();
    (course.flashcards || []).forEach((f: any) => {
      if (f.topic) counts.set(f.topic, (counts.get(f.topic) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([name, count]) => ({ name, count }));
  }, [course, showTopics]);

  function handleCourseChange(v: string) {
    onChange(v);
    setSelectedTopics(new Set());
    onTopicsChange?.(new Set());
  }

  function toggleTopic(topic: string) {
    setSelectedTopics(prev => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      onTopicsChange?.(next);
      return next;
    });
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <select
        value={value}
        onChange={e => handleCourseChange(e.target.value)}
        style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer', width: '100%' }}
      >
        <option value="">All subjects</option>
        {courses.map(c => {
          const topicCount = (c.topics || []).length;
          const cardCount = (c.flashcards || []).length;
          const label = `${c.shortName || c.name}${topicCount ? ` (${topicCount} topics · ${cardCount} cards)` : ''}`;
          return <option key={c.id} value={c.id}>{label}</option>;
        })}
      </select>
      {showTopics && value && availableTopics.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
          <button
            className={`btn btn-sm ${selectedTopics.size === 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setSelectedTopics(new Set()); onTopicsChange?.(new Set()); }}
            style={{ padding: '3px 8px', fontSize: 10 }}
          >All ({course?.flashcards?.length || 0})</button>
          {availableTopics.map(t => (
            <button key={t.name}
              className={`btn btn-sm ${selectedTopics.has(t.name) ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => toggleTopic(t.name)}
              style={{ padding: '3px 8px', fontSize: 10 }}
            >{t.name} ({t.count})</button>
          ))}
        </div>
      )}
    </div>
  );
}
