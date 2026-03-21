/**
 * Stream Deck Icon Renderer — NousAI
 *
 * Renders rich 72×72 pixel icons on Stream Deck MK.2 LCD keys
 * using HTML Canvas. Each key shows:
 *   - Emoji icon (top, large)
 *   - Short label (bottom, small caps)
 *   - Mode-colored background gradient
 *
 * Science backing:
 * - Dual coding (Paivio, 1986): icon + text = two retrieval pathways
 * - Fitts's Law: distinct icons reduce visual search time vs solid colors
 * - Preattentive processing: color + shape detected in <200ms
 *
 * Usage:
 *   const canvas = renderKeyIcon('fc_flip', [245, 166, 35]);
 *   await device.fillKeyCanvas(keyIndex, canvas);
 */

const KEY_SIZE = 72;

/**
 * Icon definitions: actionId → { emoji, label }
 * Labels are max 8 chars to fit the 72px width.
 */
const ACTION_ICONS: Record<string, { emoji: string; label: string }> = {
  // ─── Flashcard Mode ─────
  fc_flip:        { emoji: '🔄', label: 'FLIP' },
  fc_type_recall: { emoji: '✍️', label: 'TYPE' },
  fc_next:        { emoji: '➡️', label: 'NEXT' },
  fc_prev:        { emoji: '⬅️', label: 'PREV' },
  fc_conf1:       { emoji: '❌', label: 'AGAIN' },
  fc_conf2:       { emoji: '😰', label: 'HARD' },
  fc_conf3:       { emoji: '✅', label: 'GOOD' },
  fc_conf4:       { emoji: '🚀', label: 'EASY' },
  fc_zen:         { emoji: '🧘', label: 'ZEN' },
  fc_cram:        { emoji: '⚡', label: 'CRAM' },
  fc_rsvp:        { emoji: '⏩', label: 'RSVP' },

  // ─── Quiz Mode ─────
  qz_opt1:     { emoji: '🅰️', label: 'OPT A' },
  qz_opt2:     { emoji: '🅱️', label: 'OPT B' },
  qz_opt3:     { emoji: '©️', label: 'OPT C' },
  qz_opt4:     { emoji: '🇩', label: 'OPT D' },
  qz_submit:   { emoji: '📤', label: 'SUBMIT' },
  qz_continue: { emoji: '⏭️', label: 'NEXT' },
  qz_hint:     { emoji: '💡', label: 'HINT' },

  // ─── Drawing Mode ─────
  draw_undo:      { emoji: '↩️', label: 'UNDO' },
  draw_redo:      { emoji: '↪️', label: 'REDO' },
  draw_pen:       { emoji: '🖊️', label: 'PEN' },
  draw_highlight: { emoji: '🖍️', label: 'HILITE' },
  draw_erase:     { emoji: '🧽', label: 'ERASE' },
  draw_color:     { emoji: '🎨', label: 'COLOR' },
  draw_clear:     { emoji: '🗑️', label: 'CLEAR' },
  draw_save:      { emoji: '💾', label: 'SAVE' },

  // ─── Navigation Mode ─────
  nav_home:     { emoji: '🏠', label: 'HOME' },
  nav_quiz:     { emoji: '📝', label: 'QUIZ' },
  nav_cards:    { emoji: '🃏', label: 'CARDS' },
  nav_notes:    { emoji: '📚', label: 'LIBRARY' },
  nav_timer:    { emoji: '⏱️', label: 'TIMER' },
  nav_calendar: { emoji: '📅', label: 'CALENDAR' },
  nav_learn:    { emoji: '🧠', label: 'LEARN' },
  nav_settings: { emoji: '⚙️', label: 'SETTINGS' },

  // ─── Notes Mode ─────
  notes_new:    { emoji: '📝', label: 'NEW' },
  notes_search: { emoji: '🔍', label: 'SEARCH' },
  relay_send:   { emoji: '📤', label: 'RELAY' },
  screen_lasso: { emoji: '✂️', label: 'LASSO' },
  notes_bold:   { emoji: '𝐁', label: 'BOLD' },
  notes_italic: { emoji: '𝐼', label: 'ITALIC' },
  notes_save:   { emoji: '💾', label: 'SAVE' },
  notes_speak:  { emoji: '🔊', label: 'SPEAK' },

  // ─── Omni Protocol ─────
  omni_start:   { emoji: '⚡', label: 'OMNI' },
  focus_lock:   { emoji: '🔒', label: 'FOCUS' },
  interleave:   { emoji: '🔀', label: 'MIX' },
};

/**
 * Render a 72×72 icon canvas for a Stream Deck key.
 *
 * Layout (72×72):
 * ┌──────────────────┐
 * │    (gradient bg)  │
 * │                   │
 * │     😰  (32px)    │  ← emoji at y=28
 * │                   │
 * │    HARD (10px)    │  ← label at y=58
 * │                   │
 * └──────────────────┘
 *
 * @param actionId — the action identifier (e.g., 'fc_flip')
 * @param modeColor — [r, g, b] accent color for the current mode
 * @returns HTMLCanvasElement ready for device.fillKeyCanvas()
 */
export function renderKeyIcon(
  actionId: string,
  modeColor: [number, number, number],
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = KEY_SIZE;
  canvas.height = KEY_SIZE;
  const ctx = canvas.getContext('2d')!;

  const [r, g, b] = modeColor;
  const iconDef = ACTION_ICONS[actionId];

  // ─── Background gradient ─────
  // Dark bottom → mode color top (subtle, not overwhelming)
  const grad = ctx.createLinearGradient(0, 0, 0, KEY_SIZE);
  grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`);
  grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.08)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, KEY_SIZE, KEY_SIZE);

  // ─── Subtle border ─────
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.4)`;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, KEY_SIZE - 1, KEY_SIZE - 1);

  if (!iconDef) {
    // Unknown action — show a dim placeholder
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(actionId.slice(0, 8), KEY_SIZE / 2, KEY_SIZE / 2 + 4);
    return canvas;
  }

  // ─── Emoji icon (center-top) ─────
  ctx.font = '28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(iconDef.emoji, KEY_SIZE / 2, 28);

  // ─── Label text (bottom) ─────
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillText(iconDef.label, KEY_SIZE / 2, 58);

  return canvas;
}

/**
 * Render an "unassigned" key — dim, no icon.
 */
export function renderEmptyKey(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = KEY_SIZE;
  canvas.height = KEY_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Very dark background
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, KEY_SIZE, KEY_SIZE);

  // Subtle dot in center to show key is active but unassigned
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.beginPath();
  ctx.arc(KEY_SIZE / 2, KEY_SIZE / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  return canvas;
}

/**
 * Get the icon definition for an action (for use in virtual panels).
 */
export function getActionIcon(actionId: string): { emoji: string; label: string } | null {
  return ACTION_ICONS[actionId] ?? null;
}

/**
 * Check if an action has a defined icon.
 */
export function hasActionIcon(actionId: string): boolean {
  return actionId in ACTION_ICONS;
}
