import { useState } from 'react';
import { Edit3, ArrowRight } from 'lucide-react';
import { useStore } from '../../store';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

function RenameTool() {
  const { courses } = useStore();
  const [notes, setNotes] = useState<{ id: string; original: string; suggested: string; selected: boolean }[]>([]);
  const [generated, setGenerated] = useState(false);

  function generateSuggestions() {
    // Build note list from courses and their topics
    const noteList: { id: string; original: string; suggested: string; selected: boolean }[] = [];

    courses.forEach(course => {
      course.topics?.forEach(topic => {
        const original = topic.name;
        // Generate a "smart" rename suggestion
        const suggested = smartRename(original, course.shortName || course.name);
        noteList.push({ id: topic.id, original, suggested, selected: false });

        topic.subtopics?.forEach(sub => {
          const subOriginal = sub.name;
          const subSuggested = smartRename(subOriginal, `${course.shortName || course.name} - ${topic.name}`);
          noteList.push({ id: sub.id, original: subOriginal, suggested: subSuggested, selected: false });
        });
      });
    });

    // If no course data, provide sample notes
    if (noteList.length === 0) {
      const samples = [
        'chapter 1 notes', 'bio lecture 3/5', 'untitled', 'misc notes',
        'IMG_2045 scan', 'todo list school', 'review for final',
        'study guide - test 2', 'lab report draft',
      ];
      samples.forEach((s, i) => {
        noteList.push({
          id: `sample-${i}`,
          original: s,
          suggested: smartRename(s, ''),
          selected: false,
        });
      });
    }

    setNotes(noteList);
    setGenerated(true);
  }

  function smartRename(name: string, context: string): string {
    let clean = name.trim();
    // Capitalize words
    clean = clean.replace(/\b\w/g, c => c.toUpperCase());
    // Remove file extensions if present
    clean = clean.replace(/\.(md|txt|pdf|docx?)$/i, '');
    // Replace underscores and dashes with spaces
    clean = clean.replace(/[_-]+/g, ' ');
    // Expand common abbreviations
    clean = clean.replace(/\bCh\b/gi, 'Chapter');
    clean = clean.replace(/\bLec\b/gi, 'Lecture');
    clean = clean.replace(/\bBio\b/gi, 'Biology');
    clean = clean.replace(/\bChem\b/gi, 'Chemistry');
    clean = clean.replace(/\bPhys\b/gi, 'Physics');
    clean = clean.replace(/\bMisc\b/gi, 'Miscellaneous');
    clean = clean.replace(/\bImg\b/gi, 'Image');
    // Handle date patterns
    clean = clean.replace(/(\d{1,2})\/(\d{1,2})/g, 'Week $1');
    // Add prefix if context
    if (context && !clean.toLowerCase().includes(context.toLowerCase().slice(0, 4))) {
      clean = `${context} - ${clean}`;
    }
    return clean || name;
  }

  function toggleNote(id: string) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, selected: !n.selected } : n));
  }

  function selectAll() {
    setNotes(prev => prev.map(n => ({ ...n, selected: true })));
  }

  function applyRenames() {
    // In a real app this would rename the actual files
    const renamed = notes.filter(n => n.selected);
    alert(`Renamed ${renamed.length} note(s). (In production, this would update actual file names.)`);
    setNotes(prev => prev.map(n => n.selected ? { ...n, original: n.suggested, selected: false } : n));
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Edit3 size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Smart Note Renamer
        </div>
        <p className="text-sm text-muted mb-3">
          Analyzes your note names and suggests cleaner, more descriptive titles.
        </p>
        <button
          className="btn btn-primary"
          onClick={generateSuggestions}
          style={{ width: '100%' }}
        >
          <Edit3 size={14} /> {generated ? 'Regenerate Suggestions' : 'Scan & Suggest Names'}
        </button>
      </div>

      {notes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">{notes.length} notes found</span>
            <div className="flex gap-2">
              <button className="btn btn-sm btn-secondary" onClick={selectAll}>Select All</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={applyRenames}
                disabled={!notes.some(n => n.selected)}
              >
                Apply ({notes.filter(n => n.selected).length})
              </button>
            </div>
          </div>
          {notes.map(n => (
            <div
              key={n.id}
              className="card mb-2"
              style={{
                cursor: 'pointer',
                borderColor: n.selected ? 'var(--accent)' : undefined,
                background: n.selected ? 'var(--accent-glow)' : undefined,
              }}
              onClick={() => toggleNote(n.id)}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={n.selected}
                  onChange={() => toggleNote(n.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, color: 'var(--text-muted)',
                    textDecoration: 'line-through', marginBottom: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {n.original}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    <ArrowRight size={12} style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--green)' }} />
                    {n.suggested}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RenameToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Rename">
      <RenameTool />
    </ToolErrorBoundary>
  );
}
