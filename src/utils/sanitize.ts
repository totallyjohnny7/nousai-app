/**
 * Simple HTML sanitizer to prevent XSS attacks.
 * Strips all tags except a safe allowlist and removes dangerous attributes.
 */

// Trusted video embed src prefixes — only these iframes are allowed through
const TRUSTED_EMBED_PREFIXES = [
  'https://www.youtube.com/embed/',
  'https://youtube.com/embed/',
  'https://player.vimeo.com/video/',
  'https://drive.google.com/file/d/',
];

const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'code', 'pre', 'blockquote',
  'a', 'img',
  'mark',
  'iframe',
  // KaTeX MathML elements
  'math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'ms', 'mtext',
  'mfrac', 'msup', 'msub', 'msubsup', 'munder', 'mover', 'munderover',
  'msqrt', 'mroot', 'mtable', 'mtr', 'mtd', 'mspace', 'mpadded',
  'menclose', 'mglyph', 'annotation',
  // KaTeX SVG elements
  'svg', 'path', 'line', 'rect', 'circle', 'g', 'use', 'defs',
]);

const ALLOWED_ATTRS = new Set([
  'style', 'class', 'href', 'src', 'alt', 'width', 'height',
  'colspan', 'rowspan', 'target', 'rel',
  'data-color', 'data-video-embed', 'data-embed-type',
  'frameborder', 'allowfullscreen', 'allow',
  // KaTeX MathML attributes
  'mathvariant', 'encoding', 'xmlns', 'displaystyle', 'scriptlevel',
  'stretchy', 'fence', 'separator', 'lspace', 'rspace', 'accent',
  'accentunder', 'linethickness', 'notation', 'minsize', 'maxsize',
  // KaTeX SVG attributes
  'viewbox', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'preserveaspectratio', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'transform',
]);

const DANGEROUS_ATTR_PATTERN = /^on/i;
const DANGEROUS_PROTOCOL_PATTERN = /^\s*(javascript|vbscript):/i;
const DANGEROUS_DATA_SRC_PATTERN = /^\s*data:(?!image\/)/i;  // allow data:image/* but block data:text/html etc.
const DANGEROUS_HREF_PROTOCOL_PATTERN = /^\s*(javascript|vbscript|data):/i;

// Safe CSS properties whitelist — blocks url(), position:fixed/absolute, z-index abuse
const SAFE_CSS_PROPERTIES = new Set([
  'color', 'background-color', 'background', 'font-size', 'font-weight', 'font-style',
  'font-family', 'text-align', 'text-decoration', 'text-transform', 'line-height',
  'letter-spacing', 'word-spacing', 'white-space', 'vertical-align',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-width', 'border-style', 'border-radius',
  'width', 'max-width', 'min-width', 'height', 'max-height', 'min-height',
  'display', 'overflow', 'opacity', 'list-style', 'list-style-type',
  'table-layout', 'border-collapse', 'border-spacing', 'text-indent',
  // KaTeX layout properties
  'position', 'top', 'left', 'right', 'bottom',
  'flex', 'flex-direction', 'flex-wrap', 'align-items', 'justify-content', 'gap',
]);

/** Sanitize a CSS style string, keeping only safe properties */
function sanitizeStyle(style: string): string {
  return style.split(';')
    .map(decl => decl.trim())
    .filter(decl => {
      if (!decl) return false;
      const colonIdx = decl.indexOf(':');
      if (colonIdx < 0) return false;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const val = decl.slice(colonIdx + 1).trim().toLowerCase();
      // Block url() values (data exfiltration)
      if (/url\s*\(/i.test(val)) return false;
      // Block expression() (IE)
      if (/expression\s*\(/i.test(val)) return false;
      return SAFE_CSS_PROPERTIES.has(prop);
    })
    .join('; ');
}

/**
 * Escape HTML special characters to prevent injection
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Sanitize HTML string by stripping dangerous tags and attributes.
 * Uses DOM-based parsing for correctness.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Use DOMParser for safe HTML parsing
  const doc = new DOMParser().parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'iframe') {
        const src = el.getAttribute('src') || '';
        const trusted = TRUSTED_EMBED_PREFIXES.some(prefix => src.startsWith(prefix));
        if (!trusted) {
          el.remove();
          continue;
        }
        // Strip on* event handlers from trusted iframes, keep everything else
        Array.from(el.attributes).forEach(attr => {
          if (DANGEROUS_ATTR_PATTERN.test(attr.name)) el.removeAttribute(attr.name);
        });
        continue;
      }

      if (!ALLOWED_TAGS.has(tagName)) {
        // Replace dangerous element with its text content
        if (tagName === 'script' || tagName === 'style' || tagName === 'object' || tagName === 'embed') {
          el.remove();
        } else {
          // Keep text content but remove the tag
          const fragment = document.createDocumentFragment();
          while (el.firstChild) fragment.appendChild(el.firstChild);
          node.replaceChild(fragment, el);
        }
        continue;
      }

      // Remove dangerous attributes
      const attrs = Array.from(el.attributes);
      for (const attr of attrs) {
        if (DANGEROUS_ATTR_PATTERN.test(attr.name)) {
          el.removeAttribute(attr.name);
        } else if (!ALLOWED_ATTRS.has(attr.name.toLowerCase())) {
          el.removeAttribute(attr.name);
        } else if (attr.name === 'href' && DANGEROUS_HREF_PROTOCOL_PATTERN.test(attr.value)) {
          el.removeAttribute(attr.name);
        } else if (attr.name === 'src' && (DANGEROUS_PROTOCOL_PATTERN.test(attr.value) || DANGEROUS_DATA_SRC_PATTERN.test(attr.value))) {
          el.removeAttribute(attr.name);
        } else if (attr.name === 'style') {
          // Sanitize CSS to prevent data exfiltration and UI redressing
          const safe = sanitizeStyle(attr.value);
          if (safe) {
            el.setAttribute('style', safe);
          } else {
            el.removeAttribute('style');
          }
        }
      }

      // Add rel="noopener noreferrer" to links
      if (tagName === 'a') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      sanitizeNode(el);
    }
  }
}
