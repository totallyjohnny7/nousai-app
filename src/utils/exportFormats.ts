/**
 * #86 Export Formats utility
 * Notes → Markdown, Quizzes → CSV, Flashcards → Anki (.txt)
 */

import type { Note, QuizAttempt, SRCard } from '../types';

/** Download a string as a file */
function downloadText(content: string, filename: string, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a single note as Markdown */
export function exportNoteAsMarkdown(note: Note): void {
  const tags = (note.tags || []).map(t => `#${t}`).join(' ');
  const md = [
    `# ${note.title}`,
    '',
    tags ? `Tags: ${tags}` : '',
    note.folder ? `Folder: ${note.folder}` : '',
    `Date: ${note.updatedAt.slice(0, 10)}`,
    '',
    '---',
    '',
    note.content,
  ].filter(l => l !== undefined).join('\n');
  downloadText(md, `${note.title.replace(/[^a-z0-9]/gi, '_')}.md`, 'text/markdown');
}

/** Export all notes as a zip-like combined Markdown */
export function exportAllNotesAsMarkdown(notes: Note[]): void {
  const md = notes.map(n => {
    const tags = (n.tags || []).map(t => `#${t}`).join(' ');
    return [`# ${n.title}`, tags ? `Tags: ${tags}` : '', `Date: ${n.updatedAt.slice(0, 10)}`, '', n.content, '', '---', ''].join('\n');
  }).join('\n');
  downloadText(md, 'notes_export.md', 'text/markdown');
}

/** Escape a CSV field */
function csvEscape(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Export quiz history as CSV */
export function exportQuizzesAsCSV(quizzes: QuizAttempt[]): void {
  const headers = ['Date', 'Subject', 'Subtopic', 'Score%', 'Correct', 'Total', 'Mode'];
  const rows = quizzes.map(q => [
    q.date?.slice(0, 10) ?? '',
    q.subject ?? '',
    q.subtopic ?? '',
    String(q.score ?? 0),
    String(q.correct ?? 0),
    String(q.questionCount ?? 0),
    q.mode ?? '',
  ].map(csvEscape).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  downloadText(csv, 'quiz_history.csv', 'text/csv');
}

/** Export SR cards in Anki-compatible tab-separated format */
export function exportFlashcardsAsAnki(cards: SRCard[]): void {
  // Anki import format: front\tback (tab-separated, one per line)
  const lines = cards.map(c => `${c.key}\t${c.subject}: ${c.subtopic}`);
  const content = lines.join('\n');
  downloadText(content, 'flashcards_anki.txt', 'text/plain');
}

/** Export a single note as a LaTeX .tex file */
export function exportNoteAsLatex(note: { title?: string; content?: string; createdAt?: string }): void {
  const title = (note.title || 'Untitled').replace(/[_&%$#{}]/g, s => `\\${s}`);
  const content = (note.content || '')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}');
  const latex = `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb}
\\usepackage{geometry}
\\geometry{margin=1in}
\\title{${title}}
\\date{${note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}}
\\begin{document}
\\maketitle
${content}
\\end{document}`;

  const blob = new Blob([latex], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title || 'note'}.tex`;
  a.click();
  URL.revokeObjectURL(url);
}
