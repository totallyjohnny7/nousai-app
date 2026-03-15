/**
 * Shared helpers for CoursePage sub-tab components
 */
import katex from 'katex';
import { escapeHtml } from '../../utils/sanitize';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function inlineFormat(text: string): string {
  // 1. Extract LaTeX math before escaping (to preserve $ delimiters)
  const mathParts: string[] = [];
  let processed = text.replace(/\$([^\$\n]+?)\$/g, (_: string, tex: string) => {
    const placeholder = `\x00MATH${mathParts.length}\x00`;
    try { mathParts.push(katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false })); }
    catch { mathParts.push(escapeHtml(tex)); }
    return placeholder;
  });
  // 2. Escape HTML, apply markdown formatting
  processed = escapeHtml(processed)
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-input);padding:1px 4px;border-radius:3px;font-size:12px;font-family:monospace">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // 3. Restore LaTeX placeholders
  mathParts.forEach((rendered, i) => {
    processed = processed.replace(escapeHtml(`\x00MATH${i}\x00`), rendered);
  });
  return processed;
}

/** Simple markdown-ish rendering: headers, bold, italic, lists, code */
export function renderSimpleMarkdown(text: string): string {
  return text
    .split('\n')
    .map(line => {
      // Headers
      if (line.startsWith('### ')) return `<h4 style="font-size:14px;font-weight:700;margin:8px 0 4px">${inlineFormat(line.slice(4))}</h4>`;
      if (line.startsWith('## ')) return `<h3 style="font-size:16px;font-weight:700;margin:10px 0 4px">${inlineFormat(line.slice(3))}</h3>`;
      if (line.startsWith('# ')) return `<h2 style="font-size:18px;font-weight:800;margin:12px 0 6px">${inlineFormat(line.slice(2))}</h2>`;
      // Unordered list
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const content = line.slice(2);
        return `<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--text-muted)">&#8226;</span><span>${inlineFormat(content)}</span></div>`;
      }
      // Ordered list
      const olMatch = line.match(/^(\d+)\.\s(.+)/);
      if (olMatch) {
        return `<div style="display:flex;gap:6px;margin:2px 0"><span style="color:var(--text-muted)">${olMatch[1]}.</span><span>${inlineFormat(olMatch[2])}</span></div>`;
      }
      // Empty line
      if (line.trim() === '') return '<div style="height:8px"></div>';
      // Regular paragraph
      return `<p style="margin:2px 0;line-height:1.6">${inlineFormat(line)}</p>`;
    })
    .join('');
}
