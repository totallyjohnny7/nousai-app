import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ICONS_DIR = join(import.meta.dirname, 'imgs', 'actions');
mkdirSync(ICONS_DIR, { recursive: true });

// Icon definitions: id → { emoji, label, bgColor (hex) }
const ICONS = {
  // Flashcard Mode (amber)
  'fc_flip':        { emoji: '🔄', label: 'FLIP',     bg: '#F5A623' },
  'fc_next':        { emoji: '➡️', label: 'NEXT',     bg: '#F5A623' },
  'fc_prev':        { emoji: '⬅️', label: 'PREV',     bg: '#F5A623' },
  'fc_type_recall': { emoji: '✍️', label: 'TYPE',     bg: '#F5A623' },
  'fc_conf1':       { emoji: '❌', label: 'AGAIN',    bg: '#EF4444' },
  'fc_conf2':       { emoji: '😰', label: 'HARD',     bg: '#F97316' },
  'fc_conf3':       { emoji: '✅', label: 'GOOD',     bg: '#22C55E' },
  'fc_conf4':       { emoji: '🚀', label: 'EASY',     bg: '#3B82F6' },
  'fc_zen':         { emoji: '🧘', label: 'ZEN',      bg: '#F5A623' },
  'fc_cram':        { emoji: '⚡', label: 'CRAM',     bg: '#F5A623' },
  'fc_rsvp':        { emoji: '⏩', label: 'RSVP',     bg: '#F5A623' },

  // Quiz Mode (red)
  'qz_opt1':     { emoji: '🅰️', label: 'OPT A',   bg: '#EF4444' },
  'qz_opt2':     { emoji: '🅱️', label: 'OPT B',   bg: '#EF4444' },
  'qz_opt3':     { emoji: '©️',  label: 'OPT C',   bg: '#EF4444' },
  'qz_opt4':     { emoji: '🇩',  label: 'OPT D',   bg: '#EF4444' },
  'qz_submit':   { emoji: '📤', label: 'SUBMIT',  bg: '#EF4444' },
  'qz_continue': { emoji: '⏭️', label: 'NEXT Q',  bg: '#EF4444' },
  'qz_hint':     { emoji: '💡', label: 'HINT',    bg: '#EAB308' },

  // Drawing Mode (green)
  'draw_pen':       { emoji: '🖊️', label: 'PEN',     bg: '#22C55E' },
  'draw_highlight': { emoji: '🖍️', label: 'HILITE',  bg: '#22C55E' },
  'draw_erase':     { emoji: '🧽', label: 'ERASE',   bg: '#22C55E' },
  'draw_color':     { emoji: '🎨', label: 'COLOR',   bg: '#22C55E' },
  'draw_clear':     { emoji: '🗑️', label: 'CLEAR',   bg: '#22C55E' },
  'draw_undo':      { emoji: '↩️', label: 'UNDO',    bg: '#22C55E' },
  'draw_redo':      { emoji: '↪️', label: 'REDO',    bg: '#22C55E' },
  'draw_save':      { emoji: '💾', label: 'SAVE',    bg: '#22C55E' },

  // Navigation Mode (blue)
  'nav_home':     { emoji: '🏠', label: 'HOME',     bg: '#3B82F6' },
  'nav_quiz':     { emoji: '📝', label: 'QUIZ',     bg: '#3B82F6' },
  'nav_cards':    { emoji: '🃏', label: 'CARDS',    bg: '#3B82F6' },
  'nav_notes':    { emoji: '📚', label: 'LIBRARY',  bg: '#3B82F6' },
  'nav_timer':    { emoji: '⏱️', label: 'TIMER',    bg: '#3B82F6' },
  'nav_calendar': { emoji: '📅', label: 'CALENDAR', bg: '#3B82F6' },
  'nav_learn':    { emoji: '🧠', label: 'LEARN',    bg: '#3B82F6' },
  'nav_settings': { emoji: '⚙️', label: 'SETTINGS', bg: '#3B82F6' },

  // Notes Mode (purple)
  'notes_new':    { emoji: '📝', label: 'NEW',    bg: '#A855F7' },
  'notes_search': { emoji: '🔍', label: 'SEARCH', bg: '#A855F7' },
  'notes_bold':   { emoji: '𝐁',  label: 'BOLD',   bg: '#A855F7' },
  'notes_italic': { emoji: '𝐼',  label: 'ITALIC', bg: '#A855F7' },
  'notes_save':   { emoji: '💾', label: 'SAVE',   bg: '#A855F7' },
  'notes_speak':  { emoji: '🔊', label: 'SPEAK',  bg: '#A855F7' },

  // Universal
  'relay_send':    { emoji: '📤', label: 'RELAY',  bg: '#6366F1' },
  'screen_lasso':  { emoji: '✂️', label: 'LASSO',  bg: '#6366F1' },

  // Omni Protocol
  'omni_start':    { emoji: '⚡', label: 'OMNI',   bg: '#F5A623' },
  'focus_lock':    { emoji: '🔒', label: 'FOCUS',  bg: '#F5A623' },
  'interleave':    { emoji: '🔀', label: 'MIX',    bg: '#F5A623' },

  // Omni Protocol Phases
  'phase_prime':   { emoji: '📋', label: 'PRIME',   bg: '#F5A623' },
  'phase_chunk':   { emoji: '🎼', label: 'CHUNK',   bg: '#F5A623' },
  'phase_encode':  { emoji: '🧠', label: 'ENCODE',  bg: '#F5A623' },
  'phase_connect': { emoji: '🌉', label: 'CONNECT', bg: '#F5A623' },
  'phase_break':   { emoji: '☕', label: 'BREAK',   bg: '#6B7280' },
  'phase_test':    { emoji: '🔍', label: 'TEST',    bg: '#F5A623' },
  'phase_anchor':  { emoji: '🏛️', label: 'ANCHOR',  bg: '#F5A623' },
  'phase_report':  { emoji: '📊', label: 'REPORT',  bg: '#F5A623' },
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function generateSVG(id, { emoji, label, bg }) {
  const { r, g, b } = hexToRgb(bg);
  // Darker version for gradient bottom
  const dr = Math.max(0, r - 80);
  const dg = Math.max(0, g - 80);
  const db = Math.max(0, b - 80);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgb(${r},${g},${b})" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="rgb(${dr},${dg},${db})" stop-opacity="0.95"/>
    </linearGradient>
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="144" height="144" rx="16" fill="url(#bg)"/>
  <!-- Subtle inner border -->
  <rect x="2" y="2" width="140" height="140" rx="14" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <!-- Emoji icon -->
  <text x="72" y="62" text-anchor="middle" dominant-baseline="central" font-size="52" filter="url(#shadow)">${emoji}</text>
  <!-- Label -->
  <text x="72" y="118" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="bold" fill="white" letter-spacing="1.5" filter="url(#shadow)">${label}</text>
  <!-- Bottom accent line -->
  <rect x="32" y="134" width="80" height="2" rx="1" fill="rgba(255,255,255,0.3)"/>
</svg>`;
}

// Generate all icons
let count = 0;
for (const [id, def] of Object.entries(ICONS)) {
  const svg = generateSVG(id, def);
  const filename = join(ICONS_DIR, `${id}.svg`);
  writeFileSync(filename, svg, 'utf-8');
  count++;
}

console.log(`Generated ${count} SVG icons in ${ICONS_DIR}`);
