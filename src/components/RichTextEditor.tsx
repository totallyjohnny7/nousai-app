/**
 * RichTextEditor — TipTap-powered WYSIWYG editor (v2)
 * Features: formatting toolbar, find & replace, font family/size,
 *   tables with context menu, code syntax highlighting, images, links, math
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import ImageExt from '@tiptap/extension-image';
import LinkExt from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3, List, ListOrdered, CheckSquare,
  Quote, Code, Minus, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Highlighter, Undo2, Redo2, Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon, Paintbrush, Type, X, ChevronDown,
  Maximize, Minimize, Search, Replace, Plus, Trash2, Columns,
  Rows, ChevronsDownUp, Languages, Copy, ClipboardPaste, Video,
} from 'lucide-react';
import { callAI, isAIConfigured } from '../utils/ai';
import type { ImeMode } from '../utils/japaneseIme';
import { getImeMode, setImeMode, convertBuffer, flushBuffer } from '../utils/japaneseIme';

const lowlight = createLowlight(common);

/* ── Styles ─────────────────────────────────────────── */
const toolBtnStyle: React.CSSProperties = {
  padding: '4px 6px', background: 'none', border: 'none',
  borderRadius: 4, cursor: 'pointer', display: 'inline-flex',
  alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
  transition: 'all 0.1s', minWidth: 26, height: 26,
};
const toolBtnActiveStyle: React.CSSProperties = {
  ...toolBtnStyle,
  background: 'var(--accent-subtle, rgba(99,102,241,0.12))',
  color: 'var(--accent, #6366f1)',
};
const separatorStyle: React.CSSProperties = {
  width: 1, height: 20, background: 'var(--border)', margin: '0 4px',
  flexShrink: 0,
};

/* ── Color palette ──────────────────────────────────── */
const TEXT_COLORS = [
  // Row 1: Neutrals
  { label: 'Default', value: '' },
  { label: 'White', value: '#ffffff' },
  { label: 'Light Gray', value: '#d1d5db' },
  { label: 'Gray', value: '#9ca3af' },
  { label: 'Dark Gray', value: '#6b7280' },
  { label: 'Charcoal', value: '#374151' },
  { label: 'Near Black', value: '#1f2937' },
  { label: 'Black', value: '#111827' },
  // Row 2: Reds & Pinks
  { label: 'Light Red', value: '#fca5a5' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Dark Red', value: '#dc2626' },
  { label: 'Deep Red', value: '#991b1b' },
  { label: 'Light Pink', value: '#f9a8d4' },
  { label: 'Pink', value: '#ec4899' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Dark Rose', value: '#be123c' },
  // Row 3: Oranges & Yellows
  { label: 'Light Orange', value: '#fdba74' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Dark Orange', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Light Yellow', value: '#fde047' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Gold', value: '#ca8a04' },
  { label: 'Brown', value: '#92400e' },
  // Row 4: Greens
  { label: 'Light Lime', value: '#bef264' },
  { label: 'Lime', value: '#84cc16' },
  { label: 'Light Green', value: '#86efac' },
  { label: 'Green', value: '#22c55e' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Dark Green', value: '#166534' },
  { label: 'Teal', value: '#14b8a6' },
  { label: 'Dark Teal', value: '#0f766e' },
  // Row 5: Blues & Purples
  { label: 'Light Cyan', value: '#67e8f9' },
  { label: 'Cyan', value: '#06b6d4' },
  { label: 'Light Blue', value: '#93c5fd' },
  { label: 'Blue', value: '#3b82f6' },
  { label: 'Dark Blue', value: '#1e40af' },
  { label: 'Indigo', value: '#6366f1' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Violet', value: '#7c3aed' },
];

const HIGHLIGHT_COLORS = [
  // Row 1: Yellows & Oranges (most common highlights)
  { label: 'Pale Yellow', value: '#fef9c3' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Gold', value: '#fde047' },
  { label: 'Dark Yellow', value: '#facc15' },
  { label: 'Light Orange', value: '#ffedd5' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Deep Orange', value: '#fdba74' },
  { label: 'Amber', value: '#fbbf24' },
  // Row 2: Greens & Teals
  { label: 'Pale Green', value: '#dcfce7' },
  { label: 'Light Green', value: '#bbf7d0' },
  { label: 'Green', value: '#86efac' },
  { label: 'Dark Green', value: '#4ade80' },
  { label: 'Lime', value: '#d9f99d' },
  { label: 'Pale Teal', value: '#ccfbf1' },
  { label: 'Teal', value: '#99f6e4' },
  { label: 'Dark Teal', value: '#5eead4' },
  // Row 3: Blues & Cyans
  { label: 'Pale Blue', value: '#dbeafe' },
  { label: 'Light Blue', value: '#bfdbfe' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Dark Blue', value: '#60a5fa' },
  { label: 'Pale Cyan', value: '#e0f2fe' },
  { label: 'Cyan', value: '#a5f3fc' },
  { label: 'Dark Cyan', value: '#67e8f9' },
  { label: 'Sky', value: '#7dd3fc' },
  // Row 4: Purples & Pinks
  { label: 'Pale Purple', value: '#ede9fe' },
  { label: 'Light Purple', value: '#ddd6fe' },
  { label: 'Purple', value: '#c4b5fd' },
  { label: 'Dark Purple', value: '#a78bfa' },
  { label: 'Pale Pink', value: '#fce7f3' },
  { label: 'Light Pink', value: '#fbcfe8' },
  { label: 'Pink', value: '#f9a8d4' },
  { label: 'Rose', value: '#fda4af' },
  // Row 5: Reds & Neutrals
  { label: 'Pale Red', value: '#fee2e2' },
  { label: 'Light Red', value: '#fecaca' },
  { label: 'Red', value: '#fca5a5' },
  { label: 'Dark Red', value: '#f87171' },
  { label: 'White', value: '#ffffff' },
  { label: 'Light Gray', value: '#f3f4f6' },
  { label: 'Gray', value: '#e5e7eb' },
  { label: 'Dark Gray', value: '#d1d5db' },
];

/* ── Font families ──────────────────────────────────── */
const FONT_FAMILIES = [
  { label: 'Sans Serif', value: '' },
  { label: 'Serif', value: 'Georgia, Times New Roman, serif' },
  { label: 'Monospace', value: 'SF Mono, Fira Code, monospace' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
];

const FONT_SIZES = [
  { label: 'Small', value: '12px' },
  { label: 'Normal', value: '' },
  { label: 'Large', value: '18px' },
  { label: 'Huge', value: '24px' },
];

/* ── JP Format prompt ──────────────────────────────── */
const JP_COLOR_PROMPT = `You are a Japanese text color-coder. Your ONLY job is to wrap each word/morpheme in the input with a <mark> tag. You must preserve the EXACT original text, spacing, punctuation, and line breaks. Do NOT add any extra content — no legends, no breakdowns, no romaji, no translations, no explanations.

Color rules — wrap each word in <mark style="background-color:[color];padding:2px 4px;border-radius:3px">:
- Verb (Red #be123c) — action words including conjugated forms
- Particle (Blue #1e3a8a) — は, が, を, に, で, へ, と, も, の, か, etc.
- Place (Green #14532d) — location nouns
- Time (Amber #78350f) — time/frequency words
- Object/Noun (Purple #581c87) — object nouns, things
- Adjective (Orange #7c2d12) — descriptive words (i-adj, na-adj)
- Adverb (Pink #831843) — modifying words
- Greeting (Teal #134e4a) — set phrases
- Other (Gray #374151) — copula です, conjunctions, counters, etc.

CRITICAL RULES:
- Return ONLY the color-coded text. Nothing else.
- Do NOT add a legend, title, breakdown, romaji, or translation.
- Do NOT add extra spaces between words — keep spacing exactly as the original.
- Do NOT wrap the output in \`\`\` fences or <div> containers.
- Preserve all original line breaks as <br> tags.
- If the text contains HTML tags, preserve them as-is and only wrap the text content.`;

const JP_LEGEND_HTML = `<div style="margin-top:10px;padding:8px 12px;border-radius:6px;border:1px solid #333;background:#1a1a2e;display:flex;flex-wrap:wrap;gap:6px 12px;font-size:11px;line-height:1.6"><span style="font-weight:700;color:#aaa;width:100%;margin-bottom:2px">🎨 Color Key</span><span><mark style="background-color:#fecaca;padding:1px 5px;border-radius:3px;font-size:10px">Verb</mark></span><span><mark style="background-color:#bfdbfe;padding:1px 5px;border-radius:3px;font-size:10px">Particle</mark></span><span><mark style="background-color:#bbf7d0;padding:1px 5px;border-radius:3px;font-size:10px">Place</mark></span><span><mark style="background-color:#fef08a;padding:1px 5px;border-radius:3px;font-size:10px">Time</mark></span><span><mark style="background-color:#ddd6fe;padding:1px 5px;border-radius:3px;font-size:10px">Noun</mark></span><span><mark style="background-color:#fed7aa;padding:1px 5px;border-radius:3px;font-size:10px">Adjective</mark></span><span><mark style="background-color:#fbcfe8;padding:1px 5px;border-radius:3px;font-size:10px">Adverb</mark></span><span><mark style="background-color:#99f6e4;padding:1px 5px;border-radius:3px;font-size:10px">Greeting</mark></span><span><mark style="background-color:#d1d5db;padding:1px 5px;border-radius:3px;font-size:10px">Other</mark></span></div>`;

/* ── Toolbar Button Component ───────────────────────── */
function ToolBtn({
  icon: Icon, title, isActive, onClick, disabled, label, size = 14,
}: {
  icon?: React.ComponentType<{ size?: number }>;
  title: string;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  size?: number;
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={e => e.preventDefault()}
      onPointerDown={e => e.preventDefault()}
      title={title}
      disabled={disabled}
      style={{
        ...(isActive ? toolBtnActiveStyle : toolBtnStyle),
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      onMouseEnter={e => !disabled && (e.currentTarget.style.background = isActive ? 'var(--accent-subtle, rgba(99,102,241,0.15))' : 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = isActive ? 'var(--accent-subtle, rgba(99,102,241,0.12))' : 'none')}
    >
      {Icon && <Icon size={size} />}
      {label && <span style={{ fontSize: 11, fontWeight: 700, marginLeft: Icon ? 2 : 0 }}>{label}</span>}
    </button>
  );
}

/* ── Select Dropdown ──────────────────────────────── */
function ToolSelect({ value, options, onChange, title, width = 100 }: {
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  title: string;
  width?: number;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      title={title}
      style={{
        height: 26, fontSize: 11, padding: '2px 4px',
        border: '1px solid var(--border)', borderRadius: 4,
        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
        cursor: 'pointer', width, outline: 'none',
      }}
    >
      {options.map(o => <option key={o.label} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ── Find & Replace Bar ──────────────────────────── */
function FindReplaceBar({ editor, onClose }: { editor: any; onClose: () => void }) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => { findRef.current?.focus(); }, []);

  // Highlight matches using decorations
  const doFind = useCallback(() => {
    if (!editor || !findText) { setMatchCount(0); setCurrentMatch(0); return; }
    const content = editor.getText();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...content.matchAll(regex)];
    setMatchCount(matches.length);
    if (matches.length > 0) {
      // Scroll to first match by selecting it
      setCurrentMatch(1);
      selectNthMatch(1);
    } else {
      setCurrentMatch(0);
    }
  }, [editor, findText]);

  const selectNthMatch = useCallback((n: number) => {
    if (!editor || !findText || n < 1) return;
    const content = editor.getText();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = [...content.matchAll(regex)];
    if (n > matches.length) return;
    const match = matches[n - 1];
    if (match?.index !== undefined) {
      // Find position in editor doc (text positions differ from getText positions)
      let pos = 0;
      let found = false;
      editor.state.doc.descendants((node: any, nodePos: number) => {
        if (found) return false;
        if (node.isText) {
          const idx = node.text?.indexOf(findText) ?? -1;
          // Count through text to find the nth occurrence
          let textSearchPos = 0;
          let occurrencesHere = 0;
          while (textSearchPos < (node.text?.length || 0)) {
            const searchIdx = node.text!.toLowerCase().indexOf(findText.toLowerCase(), textSearchPos);
            if (searchIdx === -1) break;
            occurrencesHere++;
            pos++;
            if (pos === n) {
              const from = nodePos + searchIdx;
              const to = from + findText.length;
              editor.chain().focus().setTextSelection({ from, to }).run();
              found = true;
              return false;
            }
            textSearchPos = searchIdx + 1;
          }
        }
      });
    }
  }, [editor, findText]);

  const findNext = () => {
    if (matchCount === 0) return;
    const next = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    selectNthMatch(next);
  };

  const findPrev = () => {
    if (matchCount === 0) return;
    const prev = currentMatch <= 1 ? matchCount : currentMatch - 1;
    setCurrentMatch(prev);
    selectNthMatch(prev);
  };

  const replaceCurrent = () => {
    if (!editor || matchCount === 0) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to);
    if (selectedText.toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().deleteSelection().insertContent(replaceText).run();
      doFind();
    }
  };

  const replaceAll = () => {
    if (!editor || !findText) return;
    const html = editor.getHTML();
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const newHtml = html.replace(regex, replaceText);
    editor.commands.setContent(newHtml);
    setMatchCount(0);
    setCurrentMatch(0);
  };

  const inputStyle: React.CSSProperties = {
    flex: 1, padding: '4px 8px', fontSize: 12,
    border: '1px solid var(--border)', borderRadius: 4,
    background: 'var(--bg-primary)', color: 'var(--text-primary)',
    outline: 'none', minWidth: 0,
  };

  const smallBtnStyle: React.CSSProperties = {
    padding: '3px 8px', fontSize: 11, border: '1px solid var(--border)',
    borderRadius: 4, background: 'var(--bg-primary)', color: 'var(--text-secondary)',
    cursor: 'pointer', whiteSpace: 'nowrap',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '6px 10px', borderBottom: '1px solid var(--border)',
      background: 'var(--bg-secondary)',
    }}>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <Search size={13} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
        <input
          ref={findRef}
          value={findText}
          onChange={e => setFindText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.shiftKey ? findPrev() : (matchCount === 0 ? doFind() : findNext()); }
            if (e.key === 'Escape') onClose();
          }}
          placeholder="Find..."
          style={inputStyle}
        />
        <span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0, minWidth: 40, textAlign: 'center' }}>
          {findText ? `${currentMatch}/${matchCount}` : ''}
        </span>
        <button onClick={doFind} style={smallBtnStyle}>Find</button>
        <button onClick={findPrev} style={smallBtnStyle} disabled={matchCount === 0}>↑</button>
        <button onClick={findNext} style={smallBtnStyle} disabled={matchCount === 0}>↓</button>
        <button onClick={() => setShowReplace(!showReplace)} style={{ ...smallBtnStyle, color: showReplace ? 'var(--accent)' : undefined }}>
          <Replace size={12} />
        </button>
        <button onClick={onClose} style={{ ...smallBtnStyle, border: 'none' }}>
          <X size={14} />
        </button>
      </div>
      {showReplace && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', paddingLeft: 17 }}>
          <input
            value={replaceText}
            onChange={e => setReplaceText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') replaceCurrent(); if (e.key === 'Escape') onClose(); }}
            placeholder="Replace with..."
            style={inputStyle}
          />
          <button onClick={replaceCurrent} style={smallBtnStyle} disabled={matchCount === 0}>Replace</button>
          <button onClick={replaceAll} style={smallBtnStyle} disabled={matchCount === 0}>All</button>
        </div>
      )}
    </div>
  );
}

/* ── Table Context Menu ──────────────────────────── */
function TableContextMenu({ editor, position, onClose }: {
  editor: any;
  position: { x: number; y: number };
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as unknown as globalThis.Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: '+ Row Above', icon: Plus, action: () => editor.chain().focus().addRowBefore().run() },
    { label: '+ Row Below', icon: Plus, action: () => editor.chain().focus().addRowAfter().run() },
    { label: '+ Column Left', icon: Plus, action: () => editor.chain().focus().addColumnBefore().run() },
    { label: '+ Column Right', icon: Plus, action: () => editor.chain().focus().addColumnAfter().run() },
    { label: 'sep1', icon: null, action: () => {} },
    { label: 'Delete Row', icon: Trash2, action: () => editor.chain().focus().deleteRow().run() },
    { label: 'Delete Column', icon: Trash2, action: () => editor.chain().focus().deleteColumn().run() },
    { label: 'sep2', icon: null, action: () => {} },
    { label: 'Merge Cells', icon: ChevronsDownUp, action: () => editor.chain().focus().mergeCells().run() },
    { label: 'Split Cell', icon: Columns, action: () => editor.chain().focus().splitCell().run() },
    { label: 'sep3', icon: null, action: () => {} },
    { label: 'Toggle Header Row', icon: Rows, action: () => editor.chain().focus().toggleHeaderRow().run() },
    { label: 'Delete Table', icon: Trash2, action: () => editor.chain().focus().deleteTable().run(), danger: true },
  ];

  return (
    <div ref={menuRef} style={{
      position: 'fixed', left: position.x, top: position.y, zIndex: 1000,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      padding: '4px 0', minWidth: 180,
    }}>
      {items.map((item, i) => {
        if (item.label.startsWith('sep')) return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />;
        const Ic = item.icon;
        return (
          <button key={item.label} onClick={() => { item.action(); onClose(); }} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '6px 12px', border: 'none', background: 'none',
            cursor: 'pointer', fontSize: 12,
            color: (item as any).danger ? '#ef4444' : 'var(--text-primary)',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {Ic && <Ic size={13} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Editor CSS (injected once) ─────────────────────── */
const editorCSS = `
.tiptap-editor .ProseMirror {
  outline: none;
  min-height: var(--editor-min-height, 300px);
  padding: 20px 24px;
  font-size: 14px;
  line-height: 1.75;
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}
.tiptap-editor .ProseMirror p { margin: 0 0 8px; }
.tiptap-editor .ProseMirror h1 {
  font-size: 1.8em; font-weight: 800; margin: 24px 0 12px;
  border-bottom: 1px solid var(--border); padding-bottom: 8px;
}
.tiptap-editor .ProseMirror h2 { font-size: 1.4em; font-weight: 700; margin: 20px 0 8px; }
.tiptap-editor .ProseMirror h3 { font-size: 1.15em; font-weight: 700; margin: 16px 0 6px; }
.tiptap-editor .ProseMirror blockquote {
  border-left: 3px solid var(--accent, #6366f1); padding-left: 16px;
  margin: 12px 0; color: var(--text-secondary); font-style: italic;
}
.tiptap-editor .ProseMirror code {
  background: var(--bg-primary); padding: 2px 6px; border-radius: 4px;
  font-size: 0.9em; font-family: 'SF Mono', 'Fira Code', monospace;
  border: 1px solid var(--border);
}
.tiptap-editor .ProseMirror pre {
  background: #1e1e2e; border: 1px solid var(--border);
  border-radius: 8px; padding: 14px 16px; margin: 12px 0;
  overflow-x: auto; font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px; line-height: 1.6; color: #cdd6f4;
}
.tiptap-editor .ProseMirror pre code {
  background: none; padding: 0; border: none; font-size: inherit; color: inherit;
}
/* Syntax highlighting (catppuccin-inspired) */
.tiptap-editor .ProseMirror pre .hljs-keyword { color: #cba6f7; }
.tiptap-editor .ProseMirror pre .hljs-string { color: #a6e3a1; }
.tiptap-editor .ProseMirror pre .hljs-number { color: #fab387; }
.tiptap-editor .ProseMirror pre .hljs-comment { color: #6c7086; font-style: italic; }
.tiptap-editor .ProseMirror pre .hljs-function { color: #89b4fa; }
.tiptap-editor .ProseMirror pre .hljs-title { color: #89b4fa; }
.tiptap-editor .ProseMirror pre .hljs-params { color: #f9e2af; }
.tiptap-editor .ProseMirror pre .hljs-built_in { color: #f38ba8; }
.tiptap-editor .ProseMirror pre .hljs-type { color: #f9e2af; }
.tiptap-editor .ProseMirror pre .hljs-attr { color: #89dceb; }
.tiptap-editor .ProseMirror pre .hljs-variable { color: #cdd6f4; }
.tiptap-editor .ProseMirror pre .hljs-operator { color: #89dceb; }
.tiptap-editor .ProseMirror pre .hljs-punctuation { color: #9399b2; }
.tiptap-editor .ProseMirror pre .hljs-property { color: #89dceb; }
.tiptap-editor .ProseMirror pre .hljs-regexp { color: #f38ba8; }
.tiptap-editor .ProseMirror pre .hljs-literal { color: #fab387; }
.tiptap-editor .ProseMirror pre .hljs-tag { color: #cba6f7; }
.tiptap-editor .ProseMirror pre .hljs-name { color: #f38ba8; }
.tiptap-editor .ProseMirror pre .hljs-selector-class { color: #a6e3a1; }
.tiptap-editor .ProseMirror pre .hljs-selector-id { color: #89b4fa; }
.tiptap-editor .ProseMirror ul, .tiptap-editor .ProseMirror ol {
  padding-left: 24px; margin: 8px 0;
}
.tiptap-editor .ProseMirror li { margin-bottom: 4px; }
.tiptap-editor .ProseMirror ul[data-type="taskList"] {
  list-style: none; padding-left: 4px;
}
.tiptap-editor .ProseMirror ul[data-type="taskList"] li {
  display: flex; align-items: flex-start; gap: 8px;
}
.tiptap-editor .ProseMirror ul[data-type="taskList"] li label {
  margin-top: 3px;
}
.tiptap-editor .ProseMirror ul[data-type="taskList"] li input[type="checkbox"] {
  width: 16px; height: 16px; cursor: pointer; accent-color: var(--accent, #6366f1);
}
.tiptap-editor .ProseMirror hr {
  border: none; border-top: 1px solid var(--border); margin: 16px 0;
}
.tiptap-editor .ProseMirror a {
  color: var(--accent-light, #818cf8); text-decoration: underline;
  cursor: pointer;
}
.tiptap-editor .ProseMirror img {
  max-width: 100%; border-radius: 8px; margin: 8px 0;
}
.tiptap-editor .ProseMirror table {
  border-collapse: collapse; width: 100%; margin: 12px 0;
}
.tiptap-editor .ProseMirror th, .tiptap-editor .ProseMirror td {
  border: 1px solid var(--border); padding: 8px 12px; text-align: left;
  min-width: 80px; position: relative;
}
.tiptap-editor .ProseMirror th {
  background: var(--bg-secondary); font-weight: 700; font-size: 12px;
  text-transform: uppercase; letter-spacing: 0.5px;
}
.tiptap-editor .ProseMirror .selectedCell {
  background: rgba(99,102,241,0.08) !important;
}
.tiptap-editor .ProseMirror .column-resize-handle {
  position: absolute; right: -2px; top: 0; bottom: 0;
  width: 4px; background: var(--accent, #6366f1); cursor: col-resize;
}
.tiptap-editor .ProseMirror mark {
  padding: 1px 2px; border-radius: 2px;
}
.tiptap-editor .ProseMirror .is-empty::before {
  content: attr(data-placeholder);
  color: var(--text-dim);
  float: left;
  height: 0;
  pointer-events: none;
}
.tiptap-editor .ProseMirror sup { font-size: 0.75em; }
.tiptap-editor .ProseMirror sub { font-size: 0.75em; }

/* Fullscreen mode */
.tiptap-fullscreen {
  position: fixed !important; top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999; background: var(--bg-primary);
  display: flex; flex-direction: column;
}

/* Find highlight (manual) */
.tiptap-editor .ProseMirror .search-highlight {
  background: rgba(234, 179, 8, 0.4) !important;
  border-radius: 2px;
}

/* Video embed — editor selection highlight only (sizing is in index.css) */
.tiptap-editor .ProseMirror div[data-video-embed].ProseMirror-selectednode {
  outline: 2px solid var(--accent, #6366f1);
  outline-offset: 2px;
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = editorCSS;
  document.head.appendChild(style);
  cssInjected = true;
}

/* ── FontSize Extension (global attribute, compatible with Color) ── */
import { Extension, Node as TipTapNode, mergeAttributes } from '@tiptap/core';
const FontSizeExt = Extension.create({
  name: 'fontSizeExt',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, any>) => {
            if (!attrs.fontSize) return {};
            return { style: `font-size: ${attrs.fontSize}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: size }).run();
      },
      unsetFontSize: () => ({ chain }: any) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    } as any;
  },
});

/* ── Table style preservation ──────────────────────── */
const styleAttr = {
  default: null,
  parseHTML: (el: HTMLElement) => el.getAttribute('style'),
  renderHTML: (attrs: Record<string, any>) => attrs.style ? { style: attrs.style } : {},
};
const StyledTableCell = TableCell.extend({
  addAttributes() { return { ...this.parent?.(), style: styleAttr }; },
});
const StyledTableHeader = TableHeader.extend({
  addAttributes() { return { ...this.parent?.(), style: styleAttr }; },
});

/* ── Video URL Parser ───────────────────────────────── */
function parseVideoUrl(url: string): { embedType: 'iframe' | 'video'; src: string } | null {
  const u = url.trim();
  // YouTube watch or shortened
  const yt = u.match(/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { embedType: 'iframe', src: `https://www.youtube.com/embed/${yt[1]}?rel=0` };
  // YouTube Shorts
  const yts = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (yts) return { embedType: 'iframe', src: `https://www.youtube.com/embed/${yts[1]}?rel=0` };
  // Vimeo
  const vimeo = u.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  if (vimeo) return { embedType: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` };
  // Google Drive
  const gdrive = u.match(/drive\.google\.com\/file\/d\/([^/?#\s]+)/);
  if (gdrive) return { embedType: 'iframe', src: `https://drive.google.com/file/d/${gdrive[1]}/preview` };
  // Direct video file extension or data URL
  if (/\.(mp4|webm|mov|avi|mkv|ogv|ogg)([?#].*)?$/i.test(u) || u.startsWith('data:video/')) {
    return { embedType: 'video', src: u };
  }
  return null;
}

/* ── Video TipTap Node Extension ────────────────────── */
const VideoExtension = TipTapNode.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      embedType: { default: 'video' }, // 'video' | 'iframe'
    };
  },

  parseHTML() {
    return [{
      tag: 'div[data-video-embed]',
      getAttrs: (node) => {
        const el = node as HTMLElement;
        const embedType = (el.getAttribute('data-embed-type') || 'video') as 'iframe' | 'video';
        const src =
          el.querySelector('iframe')?.getAttribute('src') ||
          el.querySelector('video')?.getAttribute('src') ||
          null;
        return { src, embedType };
      },
    }];
  },

  renderHTML({ HTMLAttributes }) {
    const { src, embedType } = HTMLAttributes;
    if (embedType === 'iframe') {
      return [
        'div',
        mergeAttributes({ 'data-video-embed': '', 'data-embed-type': 'iframe' }),
        ['iframe', {
          src,
          frameborder: '0',
          allowfullscreen: '',
          allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        }],
      ];
    }
    return [
      'div',
      mergeAttributes({ 'data-video-embed': '', 'data-embed-type': 'video' }),
      ['video', { src, controls: '', playsinline: '' }],
    ];
  },

  addCommands() {
    return {
      setVideo: (opts: { src: string; embedType: 'video' | 'iframe' }) => ({ commands }: any) =>
        commands.insertContent({ type: 'videoEmbed', attrs: opts }),
    } as any;
  },
});

/* ── Video Modal ─────────────────────────────────────── */
function VideoModal({
  onClose,
  onInsert,
}: {
  onClose: () => void;
  onInsert: (src: string, embedType: 'video' | 'iframe') => void;
}) {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState('');
  const [urlPreview, setUrlPreview] = useState<{ embedType: 'iframe' | 'video'; src: string } | null>(null);
  const [uploadError, setUploadError] = useState('');

  const handleUrlChange = (val: string) => {
    setUrlInput(val);
    setUrlError('');
    setUrlPreview(val.trim() ? parseVideoUrl(val.trim()) : null);
  };

  const handleInsertUrl = () => {
    if (!urlPreview) {
      setUrlError('Could not detect a valid video URL. Try YouTube, Vimeo, Google Drive, or a direct .mp4 link.');
      return;
    }
    onInsert(urlPreview.src, urlPreview.embedType);
    onClose();
  };

  const handleFileUpload = (file: File) => {
    setUploadError('');
    if (file.size > 50 * 1024 * 1024) {
      setUploadError('File exceeds 50 MB. For large videos, use the "Embed URL" tab with a hosted link instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onInsert(reader.result as string, 'video');
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 600,
    background: active ? 'var(--accent-subtle, rgba(99,102,241,0.12))' : 'none',
    color: active ? 'var(--accent, #6366f1)' : 'var(--text-secondary)',
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: 24,
          width: 480, maxWidth: '92vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          border: '1px solid var(--border)',
        }}
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Video size={18} color="var(--accent, #6366f1)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Insert Video</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
          <button style={tabStyle(activeTab === 'url')} onClick={() => setActiveTab('url')}>Embed URL</button>
          <button style={tabStyle(activeTab === 'upload')} onClick={() => setActiveTab('upload')}>Upload File</button>
        </div>

        {/* Embed URL Tab */}
        {activeTab === 'url' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
              Paste a YouTube, Vimeo, Google Drive, or direct video URL
            </p>
            <input
              autoFocus
              value={urlInput}
              onChange={e => handleUrlChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInsertUrl()}
              placeholder="https://www.youtube.com/watch?v=..."
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13, borderRadius: 6,
                border: `1px solid ${urlError ? 'var(--error, #ef4444)' : 'var(--border)'}`,
                background: 'var(--bg-primary)', color: 'var(--text-primary)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {urlError && (
              <p style={{ color: 'var(--error, #ef4444)', fontSize: 12, margin: '6px 0 0 0' }}>{urlError}</p>
            )}
            {urlPreview && !urlError && (
              <div style={{
                marginTop: 8, padding: '6px 10px',
                background: 'rgba(99,241,150,0.1)', borderRadius: 6,
                fontSize: 12, color: 'var(--text-secondary)',
                border: '1px solid rgba(99,241,150,0.2)',
              }}>
                ✓ Detected: {urlPreview.embedType === 'iframe' ? 'Embedded player (YouTube / Vimeo / Drive)' : 'Direct video file'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleInsertUrl}
                className="btn btn-primary"
                style={{ flex: 1, padding: '8px 0', fontSize: 13 }}
              >
                Insert Video
              </button>
              <button onClick={onClose} className="btn" style={{ padding: '8px 16px', fontSize: 13 }}>
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '12px 0 0 0' }}>
              Supported: YouTube · Vimeo · Google Drive · Direct .mp4 / .webm links
            </p>
          </div>
        )}

        {/* Upload File Tab */}
        {activeTab === 'upload' && (
          <div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
              Upload a video file (max 50 MB). For larger videos, use the Embed URL tab.
            </p>
            <label style={{
              display: 'block', padding: '28px 20px',
              border: '2px dashed var(--border)', borderRadius: 10,
              textAlign: 'center', cursor: 'pointer',
              background: 'var(--bg-primary)',
              transition: 'border-color 0.15s',
            }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent, #6366f1)'; }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              onDrop={e => {
                e.preventDefault();
                e.currentTarget.style.borderColor = 'var(--border)';
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith('video/')) handleFileUpload(file);
              }}
            >
              <Video size={28} color="var(--text-muted)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Click or drag to upload
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>MP4 · WebM · MOV · MKV · AVI</div>
              <input
                type="file"
                accept=".mp4,.webm,.mov,.mkv,.avi,video/*"
                style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
              />
            </label>
            {uploadError && (
              <p style={{ color: 'var(--error, #ef4444)', fontSize: 12, margin: '8px 0 0 0' }}>{uploadError}</p>
            )}
            <button onClick={onClose} className="btn" style={{ width: '100%', marginTop: 12, padding: '8px 0', fontSize: 13 }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────── */
export interface RichTextEditorProps {
  initialContent?: string;
  onSave?: (html: string, plainText: string) => void;
  onContentChange?: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  minHeight?: number;
  insertHtmlTrigger?: { html: string; id: number } | null;
}

export default function RichTextEditor({
  initialContent = '',
  onSave,
  onContentChange,
  placeholder = 'Start typing your note...',
  readOnly = false,
  autoFocus = true,
  minHeight = 300,
  insertHtmlTrigger,
}: RichTextEditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const savedColorSelection = useRef<{ from: number; to: number } | null>(null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [showFindReplace, setShowFindReplace] = useState(false);
  const [tableMenu, setTableMenu] = useState<{ x: number; y: number } | null>(null);
  const [showJpPanel, setShowJpPanel] = useState(false);
  const [jpLoading, setJpLoading] = useState(false);
  const [jpPasteMode, setJpPasteMode] = useState(false);
  const [jpPastedHtml, setJpPastedHtml] = useState('');
  const [jpCopied, setJpCopied] = useState(false);
  const [imeMode, setImeModeState] = useState<ImeMode>(() => getImeMode());
  const imeBufferRef = useRef('');
  const imeDisplayLenRef = useRef(0);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const highlightPickerRef = useRef<HTMLDivElement>(null);
  const jpPanelRef = useRef<HTMLDivElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const editorWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { injectCSS(); }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      ImageExt.configure({ inline: true, allowBase64: true }),
      VideoExtension,
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Highlight.configure({ multicolor: true }),
      Table.configure({ resizable: true }),
      TableRow,
      StyledTableCell,
      StyledTableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      Subscript,
      Superscript,
      TextStyle,
      Color,
      FontFamily,
      FontSizeExt,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: initialContent,
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const text = ed.getText();
      setWordCount(text.split(/\s+/).filter(Boolean).length);
      onContentChange?.(html);
    },
    editorProps: {
      attributes: {
        spellcheck: 'true',
      },
    },
  });

  // Image paste handler
  useEffect(() => {
    if (!editor) return;
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = () => {
            const src = reader.result as string;
            editor.chain().focus().setImage({ src }).run();
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    };
    let el: HTMLElement;
    try {
      el = editor.view.dom;
    } catch {
      return; // TipTap view not mounted yet — will re-run when editor updates
    }
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [editor]);

  // Japanese IME — flush helper
  const flushIme = useCallback(() => {
    if (!editor || !imeBufferRef.current || imeMode === 'off') return;
    try {
      const mode = imeMode as 'hiragana' | 'katakana';
      const flushed = flushBuffer(imeBufferRef.current, mode);
      const pos = editor.state.selection.from;
      const { tr } = editor.state;
      tr.insertText(flushed, pos - imeDisplayLenRef.current, pos);
      editor.view.dispatch(tr);
    } catch { /* editor destroyed */ }
    imeBufferRef.current = '';
    imeDisplayLenRef.current = 0;
  }, [editor, imeMode]);

  // Flush IME buffer on blur
  useEffect(() => {
    if (!editor) return;
    const onBlur = () => flushIme();
    editor.on('blur', onBlur);
    return () => { editor.off('blur', onBlur); };
  }, [editor, flushIme]);

  const cycleIme = useCallback(() => {
    flushIme();
    const next: ImeMode = imeMode === 'off' ? 'hiragana' : imeMode === 'hiragana' ? 'katakana' : 'off';
    setImeModeState(next);
    setImeMode(next);
  }, [imeMode, flushIme]);

  // Keyboard shortcuts + Japanese IME key handling
  useEffect(() => {
    if (!editor) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        onSave?.(editor.getHTML(), editor.getText());
        return;
      }
      if (mod && e.key === 'f') {
        e.preventDefault();
        setShowFindReplace(true);
        return;
      }
      if (mod && e.key === 'h') {
        e.preventDefault();
        setShowFindReplace(true);
        return;
      }
      if (mod && e.key === 'j') {
        e.preventDefault();
        cycleIme();
        return;
      }
      // Let all other modifier combos through normally
      if (mod || e.altKey) return;

      // Japanese IME buffer input
      if (imeMode !== 'off' && editor.isFocused) {
        const mode = imeMode as 'hiragana' | 'katakana';
        const key = e.key;

        if (/^[a-zA-Z]$/.test(key)) {
          e.preventDefault();
          imeBufferRef.current += key.toLowerCase();
          const converted = convertBuffer(imeBufferRef.current, mode);
          try {
            const pos = editor.state.selection.from;
            const { tr } = editor.state;
            tr.insertText(converted, pos - imeDisplayLenRef.current, pos);
            editor.view.dispatch(tr);
            imeDisplayLenRef.current = converted.length;
          } catch { /* safety */ }
          return;
        }

        if (key === 'Backspace' && imeBufferRef.current.length > 0) {
          e.preventDefault();
          imeBufferRef.current = imeBufferRef.current.slice(0, -1);
          try {
            const pos = editor.state.selection.from;
            const { tr } = editor.state;
            if (imeBufferRef.current) {
              const converted = convertBuffer(imeBufferRef.current, mode);
              tr.insertText(converted, pos - imeDisplayLenRef.current, pos);
              imeDisplayLenRef.current = converted.length;
            } else {
              tr.delete(pos - imeDisplayLenRef.current, pos);
              imeDisplayLenRef.current = 0;
            }
            editor.view.dispatch(tr);
          } catch { /* safety */ }
          return;
        }

        // Any other key (space, enter, numbers, punctuation) → flush buffer
        if (imeBufferRef.current) {
          try {
            const flushed = flushBuffer(imeBufferRef.current, mode);
            const pos = editor.state.selection.from;
            const { tr } = editor.state;
            tr.insertText(flushed, pos - imeDisplayLenRef.current, pos);
            editor.view.dispatch(tr);
          } catch { /* safety */ }
          imeBufferRef.current = '';
          imeDisplayLenRef.current = 0;
        }
        // Don't return — let the key through (space, enter, etc.)
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave, cycleIme, imeMode, flushIme]);

  // Close popups on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as unknown as globalThis.Node)) setShowColorPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  useEffect(() => {
    if (!showHighlightPicker) return;
    const handler = (e: MouseEvent) => {
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(e.target as unknown as globalThis.Node)) setShowHighlightPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showHighlightPicker]);

  useEffect(() => {
    if (!showJpPanel) return;
    const handler = (e: MouseEvent) => {
      if (jpPanelRef.current && !jpPanelRef.current.contains(e.target as unknown as globalThis.Node)) {
        setShowJpPanel(false);
        setJpPasteMode(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showJpPanel]);

  // Right-click on table cells -> context menu
  useEffect(() => {
    if (!editor) return;
    const wrapper = editorWrapperRef.current;
    if (!wrapper) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('td') || target.closest('th')) {
        if (editor.isActive('table')) {
          e.preventDefault();
          setTableMenu({ x: e.clientX, y: e.clientY });
        }
      }
    };
    wrapper.addEventListener('contextmenu', handler);
    return () => wrapper.removeEventListener('contextmenu', handler);
  }, [editor]);

  // Insert HTML at cursor when trigger changes
  useEffect(() => {
    if (!insertHtmlTrigger || !editor) return;
    editor.chain().focus().insertContent(insertHtmlTrigger.html).run();
  }, [insertHtmlTrigger?.id]);

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl.trim()) return;
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const insertTable = useCallback(() => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertVideo = useCallback((src: string, embedType: 'video' | 'iframe') => {
    (editor?.chain().focus() as any).setVideo({ src, embedType }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        editor?.chain().focus().setImage({ src: reader.result as string }).run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [editor]);

  // Current font info
  const currentFontFamily = editor?.getAttributes('textStyle')?.fontFamily || '';
  const currentFontSize = editor?.getAttributes('textStyle')?.fontSize || '';

  if (!editor) return null;

  const charCount = editor.getText().length;
  // Detect if editor has JP color-coded marks to show persistent legend
  const hasColorMarks = useMemo(() => {
    try { return editor.getHTML().includes('<mark '); } catch { return false; }
  }, [editor, charCount]); // charCount changes on edit, triggering re-check

  return (
    <div
      className={`tiptap-editor${isFullscreen ? ' tiptap-fullscreen' : ''}`}
      ref={editorWrapperRef}
      style={{
        display: 'flex', flexDirection: 'column',
        height: isFullscreen ? '100%' : 'calc(100vh - 200px)',
        maxHeight: isFullscreen ? '100%' : 'calc(100vh - 200px)',
        border: isFullscreen ? 'none' : '1px solid var(--border)',
        borderRadius: isFullscreen ? 0 : 'var(--radius-md, 8px)',
        background: 'var(--bg-card)',
        overflow: 'visible',
      }}
    >
      {/* ── Toolbar ─────────────────────────────────────── */}
      <div className="rte-toolbar" style={{
        display: 'flex', flexWrap: 'wrap', gap: 2, padding: '4px 6px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        position: 'relative',
        alignItems: 'center',
        flexShrink: 0, zIndex: 20,
      }}>
        {/* Undo/Redo */}
        <ToolBtn icon={Undo2} title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <ToolBtn icon={Redo2} title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <div style={separatorStyle} />

        {/* Font Family & Size */}
        <ToolSelect
          value={currentFontFamily}
          options={FONT_FAMILIES}
          onChange={v => v ? editor.chain().focus().setFontFamily(v).run() : editor.chain().focus().unsetFontFamily().run()}
          title="Font Family"
          width={95}
        />
        <ToolSelect
          value={currentFontSize}
          options={FONT_SIZES}
          onChange={v => {
            if (v) (editor.chain().focus() as any).setFontSize(v).run();
            else (editor.chain().focus() as any).unsetFontSize().run();
          }}
          title="Font Size"
          width={70}
        />
        <div style={separatorStyle} />

        {/* Text formatting */}
        <ToolBtn icon={Bold} title="Bold (Ctrl+B)" isActive={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolBtn icon={Italic} title="Italic (Ctrl+I)" isActive={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolBtn icon={UnderlineIcon} title="Underline (Ctrl+U)" isActive={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} />
        <ToolBtn icon={Strikethrough} title="Strikethrough" isActive={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} />
        <ToolBtn icon={SuperscriptIcon} title="Superscript" isActive={editor.isActive('superscript')} onClick={() => editor.chain().focus().toggleSuperscript().run()} size={12} />
        <ToolBtn icon={SubscriptIcon} title="Subscript" isActive={editor.isActive('subscript')} onClick={() => editor.chain().focus().toggleSubscript().run()} size={12} />
        <div style={separatorStyle} />

        {/* Headings */}
        <ToolBtn icon={Heading1} title="Heading 1" isActive={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <ToolBtn icon={Heading2} title="Heading 2" isActive={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <ToolBtn icon={Heading3} title="Heading 3" isActive={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
        <div style={separatorStyle} />

        {/* Lists */}
        <ToolBtn icon={List} title="Bullet List" isActive={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolBtn icon={ListOrdered} title="Numbered List" isActive={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolBtn icon={CheckSquare} title="Task List" isActive={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} />
        <div style={separatorStyle} />

        {/* Alignment */}
        <ToolBtn icon={AlignLeft} title="Align Left" isActive={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} />
        <ToolBtn icon={AlignCenter} title="Align Center" isActive={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} />
        <ToolBtn icon={AlignRight} title="Align Right" isActive={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} />
        <ToolBtn icon={AlignJustify} title="Justify" isActive={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} />
        <div style={separatorStyle} />

        {/* Block elements */}
        <ToolBtn icon={Quote} title="Block Quote" isActive={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
        <ToolBtn icon={Code} title="Code Block" isActive={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} />
        <ToolBtn icon={Minus} title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <div style={separatorStyle} />

        {/* Highlight with multi-color */}
        <div style={{ position: 'relative' }} ref={highlightPickerRef}>
          <ToolBtn icon={Highlighter} title="Highlight / Background Color" isActive={editor.isActive('highlight')}
            onClick={() => setShowHighlightPicker(!showHighlightPicker)} />
        </div>

        {/* Text Color */}
        <div style={{ position: 'relative' }} ref={colorPickerRef}>
          <ToolBtn icon={Paintbrush} title="Text Color" onClick={() => {
            if (!showColorPicker && editor) {
              savedColorSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to };
            }
            setShowColorPicker(!showColorPicker);
          }} />
        </div>

        {/* Japanese IME Toggle */}
        <button
          onClick={cycleIme}
          title={
            imeMode === 'off' ? 'Enable Japanese IME — Hiragana (Ctrl+J)'
            : imeMode === 'hiragana' ? 'Switch to Katakana IME (Ctrl+J)'
            : 'Disable Japanese IME (Ctrl+J)'
          }
          style={{
            ...(imeMode !== 'off' ? toolBtnActiveStyle : toolBtnStyle),
            fontWeight: 700, fontSize: 14, minWidth: 28,
          }}
        >
          {imeMode === 'off' ? 'A' : imeMode === 'hiragana' ? 'あ' : 'ア'}
        </button>

        {/* JP Format */}
        <div style={{ position: 'relative' }} ref={jpPanelRef}>
          <ToolBtn icon={Languages} title="JP Format — Color-code Japanese text" isActive={showJpPanel}
            onClick={() => { setShowJpPanel(!showJpPanel); setJpPasteMode(false); setJpPastedHtml(''); setJpCopied(false); }} />
        </div>
        <div style={separatorStyle} />

        {/* Insert elements */}
        <div style={{ position: 'relative' }}>
          <ToolBtn icon={LinkIcon} title="Insert Link" isActive={showLinkInput} onClick={() => { setShowLinkInput(!showLinkInput); setTimeout(() => linkInputRef.current?.focus(), 50); }} />
          {showLinkInput && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, zIndex: 100,
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
              display: 'flex', gap: 4, minWidth: 200, maxWidth: 'calc(100vw - 32px)',
            }}>
              <input
                ref={linkInputRef}
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') insertLink(); if (e.key === 'Escape') setShowLinkInput(false); }}
                placeholder="https://..."
                style={{
                  flex: 1, padding: '4px 8px', fontSize: 12,
                  border: '1px solid var(--border)', borderRadius: 4,
                  background: 'var(--bg-primary)',
                }}
              />
              <button onClick={insertLink} className="btn btn-sm btn-primary" style={{ padding: '4px 10px', fontSize: 11 }}>
                Add
              </button>
              {editor.isActive('link') && (
                <button
                  onClick={() => { editor.chain().focus().unsetLink().run(); setShowLinkInput(false); }}
                  className="btn btn-sm"
                  style={{ padding: '4px 6px', fontSize: 11 }}
                  title="Remove link"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
        <ToolBtn icon={ImageIcon} title="Insert Image" onClick={addImage} />
        <ToolBtn icon={Video} title="Insert Video (YouTube, Vimeo, upload)" onClick={() => setShowVideoModal(true)} />
        <ToolBtn icon={TableIcon} title="Insert Table (right-click table to edit)" onClick={insertTable} />
        <div style={separatorStyle} />

        {/* Find & Replace */}
        <ToolBtn icon={Search} title="Find & Replace (Ctrl+F)" isActive={showFindReplace} onClick={() => setShowFindReplace(!showFindReplace)} />

        {/* Fullscreen */}
        <ToolBtn
          icon={isFullscreen ? Minimize : Maximize}
          title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
          onClick={() => setIsFullscreen(!isFullscreen)}
        />
      </div>

      {/* ── Highlight Color Panel ── */}
      {showHighlightPicker && (
        <div style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          padding: '10px 12px', flexShrink: 0, zIndex: 19,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Background / Highlight</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
            {HIGHLIGHT_COLORS.map(c => (
              <button key={c.label} onMouseDown={e => e.preventDefault()} onClick={() => {
                editor.chain().focus().toggleHighlight({ color: c.value }).run();
                setShowHighlightPicker(false);
              }} title={c.label} style={{
                width: 26, height: 26, borderRadius: 4, cursor: 'pointer',
                border: c.value === '#ffffff' ? '2px solid var(--border)' : '1px solid var(--border)',
                background: c.value,
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="color"
                defaultValue="#fef08a"
                onMouseDown={e => e.stopPropagation()}
                onChange={e => { editor.chain().focus().toggleHighlight({ color: e.target.value }).run(); }}
                title="Custom highlight color"
                style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Custom</span>
            </div>
            <button onMouseDown={e => e.preventDefault()} onClick={() => {
              editor.chain().focus().unsetHighlight().run();
              setShowHighlightPicker(false);
            }} title="Remove highlight" style={{
              padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 10,
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <X size={10} /> Clear
            </button>
          </div>
        </div>
      )}

      {/* ── Text Color Panel ── */}
      {showColorPicker && (
        <div onMouseDown={e => e.stopPropagation()} style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          padding: '10px 12px', flexShrink: 0, zIndex: 19,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>Text Color</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 3 }}>
            {TEXT_COLORS.map(c => (
              <button
                key={c.label}
                onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => {
                  const sel = savedColorSelection.current;
                  if (c.value) {
                    sel ? editor.chain().focus().setTextSelection(sel).setColor(c.value).run()
                        : editor.chain().focus().setColor(c.value).run();
                  } else {
                    sel ? editor.chain().focus().setTextSelection(sel).unsetColor().run()
                        : editor.chain().focus().unsetColor().run();
                  }
                  setShowColorPicker(false);
                }}
                title={c.label}
                style={{
                  width: 26, height: 26, borderRadius: 4, cursor: 'pointer',
                  border: c.value === '#ffffff' ? '2px solid var(--border)' : '1px solid var(--border)',
                  background: c.value || 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {!c.value && <Type size={12} style={{ color: 'var(--text-secondary)' }} />}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input
                type="color"
                defaultValue="#3b82f6"
                onPointerDown={e => { e.stopPropagation(); if (editor) savedColorSelection.current = { from: editor.state.selection.from, to: editor.state.selection.to }; }}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => {
                  const sel = savedColorSelection.current;
                  sel ? editor.chain().focus().setTextSelection(sel).setColor(e.target.value).run()
                      : editor.chain().focus().setColor(e.target.value).run();
                }}
                title="Custom text color"
                style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', background: 'none' }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Custom</span>
            </div>
            <button onMouseDown={e => e.preventDefault()} onClick={() => {
              const sel = savedColorSelection.current;
              sel ? editor.chain().focus().setTextSelection(sel).unsetColor().run()
                  : editor.chain().focus().unsetColor().run();
              setShowColorPicker(false);
            }} title="Reset to default" style={{
              padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
              background: 'var(--bg-primary)', cursor: 'pointer', fontSize: 10,
              color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3,
            }}>
              <X size={10} /> Reset
            </button>
          </div>
        </div>
      )}

      {/* ── JP Format Panel (rendered outside toolbar to avoid clipping) ── */}
      {showJpPanel && (
        <div ref={jpPanelRef} style={{
          background: 'var(--bg-card)', borderBottom: '1px solid var(--border)',
          padding: 12, flexShrink: 0, zIndex: 19,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            <Languages size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            JP Color Format
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
            Select Japanese text first, then use AI or copy the prompt.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 6px', marginBottom: 10, padding: '6px 8px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            {[
              { label: 'Verb', color: '#be123c' },
              { label: 'Particle', color: '#1e3a8a' },
              { label: 'Place', color: '#14532d' },
              { label: 'Time', color: '#78350f' },
              { label: 'Noun', color: '#581c87' },
              { label: 'Adj', color: '#7c2d12' },
              { label: 'Adverb', color: '#831843' },
              { label: 'Greeting', color: '#134e4a' },
              { label: 'Other', color: '#374151' },
            ].map(c => (
              <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            {isAIConfigured() && (
              <button
                onClick={async () => {
                  if (!editor) return;
                  const { from, to } = editor.state.selection;
                  const selectedText = editor.state.doc.textBetween(from, to, '\n');
                  if (!selectedText.trim()) { alert('Select some Japanese text first'); return; }
                  setJpLoading(true);
                  try {
                    const prompt = `${JP_COLOR_PROMPT}\n\nText to format:\n${selectedText}`;
                    const response = await callAI([{ role: 'user', content: prompt }], {}, 'analysis');
                    let html = response.trim();
                    const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/);
                    if (fenceMatch) html = fenceMatch[1].trim();
                    html = html.replace(/^<div[^>]*>/, '').replace(/<\/div>\s*$/, '');
                    html = html.replace(/<(?:div|p|span)[^>]*>.*?(?:Legend|Color|legend|color).*?<\/(?:div|p|span)>\s*/gi, '');
                    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, html + JP_LEGEND_HTML).run();
                    setShowJpPanel(false);
                  } catch (e) {
                    alert(`AI error: ${e instanceof Error ? e.message : 'Unknown error'}`);
                  }
                  setJpLoading(false);
                }}
                disabled={jpLoading}
                className="btn btn-sm btn-primary"
                style={{ flex: 1, fontSize: 11, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Languages size={12} /> {jpLoading ? 'Formatting...' : 'Format with AI'}
              </button>
            )}
            <button
              onClick={() => {
                if (!editor) return;
                const { from, to } = editor.state.selection;
                const selectedText = editor.state.doc.textBetween(from, to, '\n');
                const text = selectedText.trim() || '(select Japanese text first)';
                const prompt = `${JP_COLOR_PROMPT}\n\nText to format:\n${text}`;
                navigator.clipboard.writeText(prompt).catch(() => {});
                setJpCopied(true);
                setTimeout(() => setJpCopied(false), 2000);
              }}
              className="btn btn-sm btn-secondary"
              style={{ flex: 1, fontSize: 11, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Copy size={12} /> {jpCopied ? 'Copied!' : 'Copy Prompt'}
            </button>
          </div>

          <button
            onClick={() => setJpPasteMode(!jpPasteMode)}
            className="btn btn-sm btn-secondary"
            style={{ width: '100%', fontSize: 11, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}
          >
            <ClipboardPaste size={12} /> {jpPasteMode ? 'Hide Paste Area' : 'Paste AI Response'}
          </button>

          {jpPasteMode && (
            <div style={{ marginTop: 8 }}>
              <textarea
                value={jpPastedHtml}
                onChange={e => setJpPastedHtml(e.target.value)}
                placeholder="Paste the AI-generated HTML here..."
                style={{
                  width: '100%', minHeight: 80, padding: 8, fontSize: 11,
                  border: '1px solid var(--border)', borderRadius: 6,
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  fontFamily: 'monospace', resize: 'vertical',
                }}
              />
              {jpPastedHtml.trim() && (
                <button
                  onClick={() => {
                    if (!editor) return;
                    let html = jpPastedHtml.trim();
                    if (!html.startsWith('<')) html = `<div>${html}</div>`;
                    editor.chain().focus().insertContent(html + JP_LEGEND_HTML).run();
                    setJpPastedHtml('');
                    setJpPasteMode(false);
                    setShowJpPanel(false);
                  }}
                  className="btn btn-sm btn-primary"
                  style={{ marginTop: 6, width: '100%', fontSize: 11, padding: '6px 8px' }}
                >
                  Insert into Note
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Find & Replace Bar ────────────────────────── */}
      {showFindReplace && (
        <FindReplaceBar editor={editor} onClose={() => setShowFindReplace(false)} />
      )}

      {/* ── Editor Content ──────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', ['--editor-min-height' as any]: `${minHeight}px` }}>
        <EditorContent editor={editor} />
      </div>

      {/* ── Table Context Menu ──────────────────────────── */}
      {tableMenu && (
        <TableContextMenu editor={editor} position={tableMenu} onClose={() => setTableMenu(null)} />
      )}

      {/* ── Video Modal ──────────────────────────────────── */}
      {showVideoModal && (
        <VideoModal
          onClose={() => setShowVideoModal(false)}
          onInsert={insertVideo}
        />
      )}

      {/* ── JP Color Legend (persistent, shown when content has color marks) ── */}
      {hasColorMarks && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '4px 10px', padding: '5px 12px',
          borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', marginRight: 2 }}>🎨 Color Key:</span>
          {[
            { label: 'Verb', color: '#be123c' },
            { label: 'Particle', color: '#1e3a8a' },
            { label: 'Place', color: '#14532d' },
            { label: 'Time', color: '#78350f' },
            { label: 'Noun', color: '#581c87' },
            { label: 'Adj', color: '#7c2d12' },
            { label: 'Adverb', color: '#831843' },
            { label: 'Greeting', color: '#134e4a' },
            { label: 'Other', color: '#374151' },
          ].map(c => (
            <span key={c.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.15)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Status Bar ──────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '4px 12px', borderTop: '1px solid var(--border)',
        fontSize: 11, color: 'var(--text-dim)',
        background: 'var(--bg-secondary)',
      }}>
        <span>{wordCount} words &middot; {charCount} characters</span>
        <span style={{ display: 'flex', gap: 8 }}>
          {imeMode !== 'off' && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>IME: {imeMode === 'hiragana' ? 'あ Hiragana' : 'ア Katakana'}</span>}
          {editor.isActive('table') && <span style={{ color: 'var(--accent)' }}>Right-click table for options</span>}
          {onSave && <span style={{ color: 'var(--text-dim)' }}>Ctrl+S save &middot; Ctrl+F find</span>}
        </span>
      </div>
    </div>
  );
}

/**
 * Convert HTML content to plain markdown (for backward compatibility)
 */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u>(.*?)<\/u>/gi, '$1')
    .replace(/<s>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    .replace(/<hr\s*\/?>/gi, '---\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert plain markdown to basic HTML (for loading old notes into TipTap)
 */
export function markdownToHtml(md: string): string {
  if (!md || md.startsWith('<')) return md;
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/^>\s*(.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    .replace(/^---+$/gm, '<hr>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}
