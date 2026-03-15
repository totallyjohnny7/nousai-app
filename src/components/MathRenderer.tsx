/**
 * MathRenderer — Renders LaTeX/math expressions using KaTeX
 * Usage: <MathRenderer text="The area is $A = \pi r^2$ and volume..." />
 * Supports inline math ($...$) and display math ($$...$$)
 */
import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { CSSProperties } from 'react';
import { escapeHtml } from '../utils/sanitize';

interface MathRendererProps {
  text: string;
  displayMode?: boolean;
  style?: CSSProperties;
  className?: string;
}

// Render a single math expression
export function MathExpression({ tex, displayMode = false, style }: { tex: string; displayMode?: boolean; style?: CSSProperties }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (ref.current) {
      try {
        katex.render(tex, ref.current, {
          displayMode,
          throwOnError: false,
          errorColor: '#ef4444',
        });
      } catch {
        if (ref.current) ref.current.textContent = tex;
      }
    }
  }, [tex, displayMode]);

  return <span ref={ref} style={style} />;
}

// Render text with inline and display math
export default function MathRenderer({ text, style, className }: MathRendererProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    // Split text into math and non-math segments, sanitize non-math parts
    const DISPLAY_RE = /\$\$([\s\S]*?)\$\$/g;
    const INLINE_RE = /\$([^\$\n]+?)\$/g;

    // Step 1: Replace display math with placeholders
    const displayParts: string[] = [];
    let step1 = text.replace(DISPLAY_RE, (_: string, tex: string) => {
      const placeholder = `\x00DMATH${displayParts.length}\x00`;
      try {
        displayParts.push(katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false }));
      } catch { displayParts.push(escapeHtml(tex)); }
      return placeholder;
    });

    // Step 2: Replace inline math with placeholders
    const inlineParts: string[] = [];
    step1 = step1.replace(INLINE_RE, (_: string, tex: string) => {
      const placeholder = `\x00IMATH${inlineParts.length}\x00`;
      try {
        inlineParts.push(katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false }));
      } catch { inlineParts.push(escapeHtml(tex)); }
      return placeholder;
    });

    // Step 3: Escape non-math text to prevent XSS
    let html = escapeHtml(step1);

    // Step 4: Restore math placeholders (they were escaped, unescape them)
    displayParts.forEach((rendered, i) => {
      html = html.replace(escapeHtml(`\x00DMATH${i}\x00`), rendered);
    });
    inlineParts.forEach((rendered, i) => {
      html = html.replace(escapeHtml(`\x00IMATH${i}\x00`), rendered);
    });

    ref.current.innerHTML = html;
  }, [text]);

  return <div ref={ref} style={style} className={className} />;
}
