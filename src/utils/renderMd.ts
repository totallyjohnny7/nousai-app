/**
 * Shared markdown + LaTeX renderer for AI chat bubbles.
 * Handles $inline$ and $$display$$ math via KaTeX, code blocks with syntax
 * highlighting (lowlight), markdown tables, blockquotes, numbered lists,
 * and basic markdown formatting.
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { createLowlight, common } from 'lowlight';
import { sanitizeHtml } from './sanitize';

const lowlight = createLowlight(common);

/** Convert HAST nodes (from lowlight) to HTML string */
function hastToHtml(node: any): string {
  if (!node) return '';
  if (node.type === 'text') return escHtml(node.value || '');
  if (node.type === 'element') {
    const tag = node.tagName || 'span';
    const cls = node.properties?.className;
    const attr = cls ? ` class="${Array.isArray(cls) ? cls.join(' ') : cls}"` : '';
    const children = (node.children || []).map(hastToHtml).join('');
    return `<${tag}${attr}>${children}</${tag}>`;
  }
  if (node.type === 'root' || node.children) {
    return (node.children || []).map(hastToHtml).join('');
  }
  return '';
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Convert markdown + LaTeX text to sanitized HTML string */
export function renderMd(text: string): string {
  const preserved: string[] = []; // holds pre-rendered HTML blocks (latex, code, tables)

  function stash(html: string): string {
    const idx = preserved.length;
    preserved.push(html);
    return `%%PRESERVED_${idx}%%`;
  }

  let processed = text;

  // 1. Extract LaTeX (before anything else)
  processed = processed
    .replace(/\$\$([^$]+?)\$\$/g, (_, expr) => {
      try { return stash(katex.renderToString(expr.trim(), { throwOnError: false, displayMode: true })); }
      catch { return stash(expr); }
    })
    .replace(/\$([^$\n]+?)\$/g, (_, expr) => {
      try { return stash(katex.renderToString(expr.trim(), { throwOnError: false, displayMode: false })); }
      catch { return stash(expr); }
    });

  // 2. Extract fenced code blocks (```lang ... ```)
  processed = processed.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.replace(/\n$/, '');
    let highlighted: string;
    try {
      const tree = lang && lowlight.listLanguages().includes(lang)
        ? lowlight.highlight(lang, trimmed)
        : lowlight.highlightAuto(trimmed);
      highlighted = hastToHtml(tree);
    } catch {
      highlighted = escHtml(trimmed);
    }
    const langLabel = lang ? `<div style="position:absolute;top:4px;right:8px;font-size:10px;color:#6c7086;text-transform:uppercase">${escHtml(lang)}</div>` : '';
    return stash(
      `<pre style="position:relative;background:rgba(17,17,27,.8);border:1px solid var(--border);border-radius:8px;padding:12px 14px;overflow-x:auto;margin:8px 0;font-size:12px;line-height:1.5">${langLabel}<code class="hljs">${highlighted}</code></pre>`
    );
  });

  // 3. Extract markdown tables (lines starting with |)
  processed = processed.replace(/((?:^\|.+\|[ \t]*$\n?){2,})/gm, (tableBlock) => {
    const rows = tableBlock.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return tableBlock;
    // Skip separator rows (|---|---|)
    const dataRows = rows.filter(r => !/^\|[\s\-:|]+\|$/.test(r));
    if (dataRows.length === 0) return tableBlock;
    const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim());
    const headerCells = parseRow(dataRows[0]);
    const bodyRows = dataRows.slice(1);
    const thStyle = 'padding:6px 10px;border-bottom:2px solid var(--border);text-align:left;font-weight:700;font-size:12px;white-space:nowrap';
    const tdStyle = 'padding:5px 10px;border-bottom:1px solid var(--border);font-size:12px';
    let html = `<table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid var(--border);border-radius:6px"><thead><tr>${
      headerCells.map(c => `<th style="${thStyle}">${escHtml(c)}</th>`).join('')
    }</tr></thead><tbody>`;
    bodyRows.forEach(r => {
      const cells = parseRow(r);
      html += `<tr>${cells.map(c => `<td style="${tdStyle}">${escHtml(c)}</td>`).join('')}</tr>`;
    });
    html += '</tbody></table>';
    return stash(html);
  });

  // 4. HTML-escape remaining text
  let h = escHtml(processed);

  // 5. Blockquotes (> text)
  h = h.replace(/^&gt;\s+(.+)$/gm, '<blockquote style="border-left:3px solid var(--accent);padding:4px 12px;margin:8px 0;color:var(--text-secondary);font-style:italic">$1</blockquote>');

  // 6. Headings
  h = h.replace(/^####\s+(.+)$/gm, '<strong style="font-size:0.95em;color:var(--accent-light)">$1</strong>');
  h = h.replace(/^###\s+(.+)$/gm, '<strong style="font-size:1.05em;color:var(--accent-light)">$1</strong>');
  h = h.replace(/^##\s+(.+)$/gm, '<strong style="font-size:1.1em;color:var(--accent-light)">$1</strong>');
  h = h.replace(/^#\s+(.+)$/gm, '<strong style="font-size:1.2em;color:var(--accent-light)">$1</strong>');

  // 7. Lists
  h = h.replace(/^\*\s+/gm, '&bull; ');
  h = h.replace(/^-\s+/gm, '&bull; ');
  h = h.replace(/^(\d+)\.\s+(.+)$/gm, '<div style="padding-left:16px;margin:2px 0"><span style="color:var(--accent-light);font-weight:700;margin-right:6px">$1.</span>$2</div>');

  // 8. Inline formatting
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,.08);padding:1px 4px;border-radius:3px;font-size:0.92em">$1</code>');

  // 9. Newlines to <br>
  h = h.replace(/\n/g, '<br>');

  // 10. Restore preserved blocks (they contain pre-rendered HTML)
  preserved.forEach((html, i) => {
    h = h.replace(`%%PRESERVED_${i}%%`, html);
  });

  return h;
}

/** Safe wrapper: renderMd + sanitize, with fallback on error */
export function safeRenderMd(text: string): string {
  try {
    return sanitizeHtml(renderMd(text));
  } catch {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
  }
}
