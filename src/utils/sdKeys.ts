/**
 * sdKeys.ts — Stream Deck Hotkey Map (F13-F24 + modifier combos)
 *
 * Four pages, 15 buttons each (5 cols × 3 rows).
 * F13-F24 keys are ideal for Stream Deck: not present on regular keyboards,
 * so there are zero browser/OS conflicts. Easy to assign in Elgato software.
 *
 * Key scheme:
 *   Page 0 (Study):    F13-F24  + Alt+F13/F14/F15
 *   Page 1 (Drawing):  Shift+F13-F24  + Alt+Shift+F13/F14/F15
 *   Page 2 (Nav):      Ctrl+F13-F24   + Alt+Ctrl+F13/F14/F15
 *   Page 3 (AI Tools): Ctrl+Shift+F13-F24 + Alt+Ctrl+Shift+F13/F14/F15
 *
 * ◄PAGE and PAGE► are fixed at slots 13-14 on every page.
 *
 * PAGE 0 — Study Mode
 * ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 * │  FLIP    │  PREV    │  NEXT    │  LASSO   │ FULL SCR │
 * │   F13    │   F14    │   F15    │   F16    │ Alt+F13  │
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  AGAIN   │  HARD    │  GOOD    │  EASY    │  TYPE    │
 * │   F17    │   F18    │   F19    │   F20    │ Alt+F14  │
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │AI EXPLAIN│  RSVP    │   ZEN    │  ◄PAGE   │  PAGE►   │
 * │   F21    │   F22    │   F23    │   F24    │ Alt+F15  │
 * └──────────┴──────────┴──────────┴──────────┴──────────┘
 *
 * PAGE 1 — Drawing & Notes
 * ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 * │  BOLD    │  HILITE  │   PEN    │  CLEAR   │  FILL    │
 * │ Shift+F13│ Shift+F14│ Shift+F15│ Shift+F16│Alt+Sh+F13│
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  SEARCH  │  ITALIC  │  SAVE    │  COLOR   │  SNAP    │
 * │ Shift+F17│ Shift+F18│ Shift+F19│ Shift+F20│Alt+Sh+F14│
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  UNDO    │  REDO    │  ERASE   │  ◄PAGE   │  PAGE►   │
 * │ Shift+F21│ Shift+F22│ Shift+F23│ Shift+F24│Alt+Sh+F15│
 * └──────────┴──────────┴──────────┴──────────┴──────────┘
 *
 * PAGE 2 — Navigation
 * ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 * │  HOME    │  CARDS   │  QUIZ    │  LEARN   │  DASH    │
 * │ Ctrl+F13 │ Ctrl+F14 │ Ctrl+F15 │ Ctrl+F16 │Alt+Ct+F13│
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  TIMER   │  NOTES   │   CAL    │   SET    │    AI    │
 * │ Ctrl+F17 │ Ctrl+F18 │ Ctrl+F19 │ Ctrl+F20 │Alt+Ct+F14│
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  FOCUS   │    —     │  OMNI    │  ◄PAGE   │  PAGE►   │
 * │ Ctrl+F21 │ Ctrl+F22 │ Ctrl+F23 │ Ctrl+F24 │Alt+Ct+F15│
 * └──────────┴──────────┴──────────┴──────────┴──────────┘
 *
 * PAGE 3 — AI Tools
 * ┌──────────┬──────────┬──────────┬──────────┬──────────┐
 * │  SUMM    │  FLASH   │  QUIZ+   │  DICT    │  NOTE    │
 * │CS+F13   │CS+F14   │CS+F15   │CS+F16   │ACS+F13  │
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  HINT    │  CRAM    │  STUDY   │  SPEED   │  TUTOR   │
 * │CS+F17   │CS+F18   │CS+F19   │CS+F20   │ACS+F14  │
 * ├──────────┼──────────┼──────────┼──────────┼──────────┤
 * │  INTER   │  STATS   │  REVIEW  │  ◄PAGE   │  PAGE►   │
 * │CS+F21   │CS+F22   │CS+F23   │CS+F24   │ACS+F15  │
 * └──────────┴──────────┴──────────┴──────────┴──────────┘
 *   (CS = Ctrl+Shift, ACS = Alt+Ctrl+Shift)
 */

/** Number of columns in the Stream Deck grid */
export const SD_COLS = 5;
/** Number of rows in the Stream Deck grid */
export const SD_ROWS = 3;
/** Total keys per page */
export const SD_KEYS_PER_PAGE = SD_COLS * SD_ROWS;

/** Profile page name for each page index */
export const SD_PAGE_KEYS = ['studyMode', 'tools', 'navigation', 'aiTools'] as const;
export type SDPageKey = (typeof SD_PAGE_KEYS)[number];

export interface SDKey {
  /** Normalized combo for useStreamDeckShortcuts (e.g. "f13", "shift+f13") */
  key: string;
  /** Human-readable default key label (e.g. "F13", "Shift+F13") */
  sdLabel: string;
  /** NousAI action ID dispatched as 'nousai-sd' CustomEvent detail */
  action: string;
  /** Short word shown on the Settings grid tile */
  label: string;
  /** Tooltip description */
  tip: string;
  /** Page index: 0=Study 1=Tools 2=Navigation 3=AI Tools */
  page: number;
  /** Slot in 5-col grid (row*5+col), 0–14 */
  slot: number;
  /** Category for grouping */
  category: string;
  /** Emoji icon */
  emoji: string;
  /** Key in profile.pages[pageName] for this action */
  profileKey: string;
}

export const SD_KEYS: SDKey[] = [
  // ── PAGE 0 — Study Mode (F13-F24 + Alt combos) ─────────────────────────
  // Row 0: FLIP, PREV, NEXT, LASSO, FULL SCR
  { key: 'f13',     sdLabel: 'F13',     action: 'fc_flip',        label: 'FLIP',      tip: 'Flip card to reveal answer',              page: 0, slot: 0,  category: 'Flashcards', emoji: '🔄', profileKey: 'flip'      },
  { key: 'f14',     sdLabel: 'F14',     action: 'fc_prev',        label: 'PREV',      tip: 'Go back to previous flashcard',           page: 0, slot: 1,  category: 'Flashcards', emoji: '◀',  profileKey: 'prev'      },
  { key: 'f15',     sdLabel: 'F15',     action: 'fc_next',        label: 'NEXT',      tip: 'Go to next flashcard',                    page: 0, slot: 2,  category: 'Flashcards', emoji: '▶',  profileKey: 'next'      },
  { key: 'f16',     sdLabel: 'F16',     action: 'screen_lasso',   label: 'LASSO',     tip: 'Select/highlight text on card',           page: 0, slot: 3,  category: 'Flashcards', emoji: '✂️', profileKey: 'lasso'     },
  { key: 'alt+f13', sdLabel: 'Alt+F13', action: 'fc_fullscreen',  label: 'FULL SCR',  tip: 'Toggle browser fullscreen',               page: 0, slot: 4,  category: 'Flashcards', emoji: '⛶',  profileKey: 'fullscr'   },
  // Row 1: AGAIN, HARD, GOOD, EASY, TYPE
  { key: 'f17',     sdLabel: 'F17',     action: 'fc_conf1',       label: 'AGAIN',     tip: 'Grade: Again — card resets to start',     page: 0, slot: 5,  category: 'Grading',    emoji: '❌', profileKey: 'again'     },
  { key: 'f18',     sdLabel: 'F18',     action: 'fc_conf2',       label: 'HARD',      tip: 'Grade: Hard — shorter interval',          page: 0, slot: 6,  category: 'Grading',    emoji: '😰', profileKey: 'hard'      },
  { key: 'f19',     sdLabel: 'F19',     action: 'fc_conf3',       label: 'GOOD',      tip: 'Grade: Good — normal interval growth',    page: 0, slot: 7,  category: 'Grading',    emoji: '✅', profileKey: 'good'      },
  { key: 'f20',     sdLabel: 'F20',     action: 'fc_conf4',       label: 'EASY',      tip: 'Grade: Easy — fast interval growth',      page: 0, slot: 8,  category: 'Grading',    emoji: '🚀', profileKey: 'easy'      },
  { key: 'alt+f14', sdLabel: 'Alt+F14', action: 'fc_type_recall', label: 'TYPE',      tip: 'Type-recall mode — active recall',        page: 0, slot: 9,  category: 'Flashcards', emoji: '✍️', profileKey: 'type'      },
  // Row 2: AI EXPLAIN, RSVP, ZEN, ◄PAGE, PAGE►
  { key: 'f21',     sdLabel: 'F21',     action: 'ai_explain',     label: 'AI EXPLAIN',tip: 'Ask AI to explain current content',       page: 0, slot: 10, category: 'Flashcards', emoji: '🧠', profileKey: 'aiExplain' },
  { key: 'f22',     sdLabel: 'F22',     action: 'fc_rsvp',        label: 'RSVP',      tip: 'Rapid Serial Visual Presentation mode',   page: 0, slot: 11, category: 'Flashcards', emoji: '⏩', profileKey: 'rsvp'      },
  { key: 'f23',     sdLabel: 'F23',     action: 'fc_zen',         label: 'ZEN',       tip: 'Zen mode — distraction-free review',      page: 0, slot: 12, category: 'Flashcards', emoji: '🧘', profileKey: 'zen'       },
  { key: 'f24',     sdLabel: 'F24',     action: 'sd_page_prev',   label: '◄PAGE',     tip: 'Previous Stream Deck page',               page: 0, slot: 13, category: 'Navigation', emoji: '⏪', profileKey: 'pagePrev'  },
  { key: 'alt+f15', sdLabel: 'Alt+F15', action: 'sd_page_next',   label: 'PAGE►',     tip: 'Next Stream Deck page',                   page: 0, slot: 14, category: 'Navigation', emoji: '⏩', profileKey: 'pageNext'  },

  // ── PAGE 1 — Drawing & Notes (Shift+F13-F24 + Alt+Shift combos) ────────
  // Row 0: BOLD, HILITE, PEN, CLEAR, FILL
  { key: 'shift+f13',     sdLabel: 'Shift+F13',     action: 'notes_bold',     label: 'BOLD',   tip: 'Toggle bold text in note editor',   page: 1, slot: 0,  category: 'Notes',   emoji: '𝐁',  profileKey: 'bold'   },
  { key: 'shift+f14',     sdLabel: 'Shift+F14',     action: 'draw_highlight', label: 'HILITE', tip: 'Select highlighter tool',            page: 1, slot: 1,  category: 'Drawing', emoji: '🖍️', profileKey: 'hilite' },
  { key: 'shift+f15',     sdLabel: 'Shift+F15',     action: 'draw_pen',       label: 'PEN',    tip: 'Select freehand pen tool',          page: 1, slot: 2,  category: 'Drawing', emoji: '🖊️', profileKey: 'pen'    },
  { key: 'shift+f16',     sdLabel: 'Shift+F16',     action: 'draw_clear',     label: 'CLEAR',  tip: 'Clear entire canvas',               page: 1, slot: 3,  category: 'Drawing', emoji: '🗑️', profileKey: 'clear'  },
  { key: 'alt+shift+f13', sdLabel: 'Alt+Shift+F13', action: 'draw_fill',      label: 'FILL',   tip: 'Bucket fill tool',                  page: 1, slot: 4,  category: 'Drawing', emoji: '🪣', profileKey: 'fill'   },
  // Row 1: SEARCH, ITALIC, SAVE, COLOR, SNAP
  { key: 'shift+f17',     sdLabel: 'Shift+F17',     action: 'notes_search',   label: 'SEARCH', tip: 'Open notes search/filter',          page: 1, slot: 5,  category: 'Notes',   emoji: '🔍', profileKey: 'search' },
  { key: 'shift+f18',     sdLabel: 'Shift+F18',     action: 'notes_italic',   label: 'ITALIC', tip: 'Toggle italic text in note editor', page: 1, slot: 6,  category: 'Notes',   emoji: '𝐼',  profileKey: 'italic' },
  { key: 'shift+f19',     sdLabel: 'Shift+F19',     action: 'draw_save',      label: 'SAVE',   tip: 'Save current drawing or note',      page: 1, slot: 7,  category: 'Drawing', emoji: '💾', profileKey: 'save'   },
  { key: 'shift+f20',     sdLabel: 'Shift+F20',     action: 'draw_color',     label: 'COLOR',  tip: 'Open color picker',                 page: 1, slot: 8,  category: 'Drawing', emoji: '🎨', profileKey: 'color'  },
  { key: 'alt+shift+f14', sdLabel: 'Alt+Shift+F14', action: 'draw_snap',      label: 'SNAP',   tip: 'Snap to grid / alignment guides',   page: 1, slot: 9,  category: 'Drawing', emoji: '📐', profileKey: 'snap'   },
  // Row 2: UNDO, REDO, ERASE, ◄PAGE, PAGE►
  { key: 'shift+f21',     sdLabel: 'Shift+F21',     action: 'draw_undo',      label: 'UNDO',   tip: 'Undo last action',                  page: 1, slot: 10, category: 'Drawing',    emoji: '↩️', profileKey: 'undo'     },
  { key: 'shift+f22',     sdLabel: 'Shift+F22',     action: 'draw_redo',      label: 'REDO',   tip: 'Redo last undone action',           page: 1, slot: 11, category: 'Drawing',    emoji: '↪️', profileKey: 'redo'     },
  { key: 'shift+f23',     sdLabel: 'Shift+F23',     action: 'draw_erase',     label: 'ERASE',  tip: 'Select eraser tool',                page: 1, slot: 12, category: 'Drawing',    emoji: '🧽', profileKey: 'erase'    },
  { key: 'shift+f24',     sdLabel: 'Shift+F24',     action: 'sd_page_prev',   label: '◄PAGE',  tip: 'Previous Stream Deck page',         page: 1, slot: 13, category: 'Navigation', emoji: '⏪', profileKey: 'pagePrev' },
  { key: 'alt+shift+f15', sdLabel: 'Alt+Shift+F15', action: 'sd_page_next',   label: 'PAGE►',  tip: 'Next Stream Deck page',             page: 1, slot: 14, category: 'Navigation', emoji: '⏩', profileKey: 'pageNext' },

  // ── PAGE 2 — Navigation (Ctrl+F13-F24 + Alt+Ctrl combos) ───────────────
  // Row 0: HOME, CARDS, QUIZ, LEARN, DASH
  { key: 'ctrl+f13',     sdLabel: 'Ctrl+F13',     action: 'nav_home',      label: 'HOME',  tip: 'Go to Dashboard',                   page: 2, slot: 0,  category: 'Navigation', emoji: '🏠', profileKey: 'home'     },
  { key: 'ctrl+f14',     sdLabel: 'Ctrl+F14',     action: 'nav_cards',     label: 'CARDS', tip: 'Go to Flashcards',                  page: 2, slot: 1,  category: 'Navigation', emoji: '🃏', profileKey: 'cards'    },
  { key: 'ctrl+f15',     sdLabel: 'Ctrl+F15',     action: 'nav_quiz',      label: 'QUIZ',  tip: 'Go to Quiz mode',                   page: 2, slot: 2,  category: 'Navigation', emoji: '📝', profileKey: 'quiz'     },
  { key: 'ctrl+f16',     sdLabel: 'Ctrl+F16',     action: 'nav_learn',     label: 'LEARN', tip: 'Go to Learn page',                  page: 2, slot: 3,  category: 'Navigation', emoji: '📖', profileKey: 'learn'    },
  { key: 'alt+ctrl+f13', sdLabel: 'Alt+Ctrl+F13', action: 'nav_dash',      label: 'DASH',  tip: 'Go to Dashboard overview',          page: 2, slot: 4,  category: 'Navigation', emoji: '📊', profileKey: 'dash'     },
  // Row 1: TIMER, NOTES, CAL, SET, AI
  { key: 'ctrl+f17',     sdLabel: 'Ctrl+F17',     action: 'nav_timer',     label: 'TIMER', tip: 'Go to Pomodoro Timer',              page: 2, slot: 5,  category: 'Navigation', emoji: '⏱️', profileKey: 'timer'    },
  { key: 'ctrl+f18',     sdLabel: 'Ctrl+F18',     action: 'nav_notes',     label: 'NOTES', tip: 'Go to Library (notes & drawings)',  page: 2, slot: 6,  category: 'Navigation', emoji: '📚', profileKey: 'notes'    },
  { key: 'ctrl+f19',     sdLabel: 'Ctrl+F19',     action: 'nav_calendar',  label: 'CAL',   tip: 'Go to Calendar',                    page: 2, slot: 7,  category: 'Navigation', emoji: '📅', profileKey: 'calendar' },
  { key: 'ctrl+f20',     sdLabel: 'Ctrl+F20',     action: 'nav_settings',  label: 'SET',   tip: 'Go to Settings',                    page: 2, slot: 8,  category: 'Navigation', emoji: '⚙️', profileKey: 'settings' },
  { key: 'alt+ctrl+f14', sdLabel: 'Alt+Ctrl+F14', action: 'nav_ai',        label: 'AI',    tip: 'Go to AI Tools page',               page: 2, slot: 9,  category: 'Navigation', emoji: '🤖', profileKey: 'ai'       },
  // Row 2: FOCUS, —, OMNI, ◄PAGE, PAGE►
  { key: 'ctrl+f21',     sdLabel: 'Ctrl+F21',     action: 'focus_lock',    label: 'FOCUS', tip: 'Toggle focus lock mode',            page: 2, slot: 10, category: 'Features',   emoji: '🔒', profileKey: 'focus'    },
  { key: 'ctrl+f22',     sdLabel: 'Ctrl+F22',     action: 'noop',          label: '—',     tip: 'Unassigned',                       page: 2, slot: 11, category: 'Features',   emoji: '—',  profileKey: 'slot11'   },
  { key: 'ctrl+f23',     sdLabel: 'Ctrl+F23',     action: 'omni_start',    label: 'OMNI',  tip: 'Start 60-min Omni Study Protocol',  page: 2, slot: 12, category: 'Features',   emoji: '🌐', profileKey: 'omni'     },
  { key: 'ctrl+f24',     sdLabel: 'Ctrl+F24',     action: 'sd_page_prev',  label: '◄PAGE', tip: 'Previous Stream Deck page',         page: 2, slot: 13, category: 'Navigation', emoji: '⏪', profileKey: 'pagePrev' },
  { key: 'alt+ctrl+f15', sdLabel: 'Alt+Ctrl+F15', action: 'sd_page_next',  label: 'PAGE►', tip: 'Next Stream Deck page',             page: 2, slot: 14, category: 'Navigation', emoji: '⏩', profileKey: 'pageNext' },

  // ── PAGE 3 — AI Tools (Ctrl+Shift+F13-F24 + Alt+Ctrl+Shift combos) ─────
  // Row 0: SUMM, FLASH, QUIZ+, DICT, NOTE
  { key: 'ctrl+shift+f13',     sdLabel: 'Ctrl+Shift+F13',     action: 'ai_summarize',    label: 'SUMM',   tip: 'AI summarize current content',         page: 3, slot: 0,  category: 'AI Tools', emoji: '📋', profileKey: 'summ'     },
  { key: 'ctrl+shift+f14',     sdLabel: 'Ctrl+Shift+F14',     action: 'ai_flashcards',   label: 'FLASH',  tip: 'AI generate flashcards',               page: 3, slot: 1,  category: 'AI Tools', emoji: '⚡', profileKey: 'flash'    },
  { key: 'ctrl+shift+f15',     sdLabel: 'Ctrl+Shift+F15',     action: 'ai_quiz_gen',     label: 'QUIZ+',  tip: 'AI generate quiz questions',           page: 3, slot: 2,  category: 'AI Tools', emoji: '❓', profileKey: 'quizGen'  },
  { key: 'ctrl+shift+f16',     sdLabel: 'Ctrl+Shift+F16',     action: 'ai_dictionary',   label: 'DICT',   tip: 'AI dictionary / define term',          page: 3, slot: 3,  category: 'AI Tools', emoji: '📖', profileKey: 'dict'     },
  { key: 'alt+ctrl+shift+f13', sdLabel: 'Alt+Ctrl+Shift+F13', action: 'ai_notes',        label: 'NOTE',   tip: 'AI auto-generate notes',               page: 3, slot: 4,  category: 'AI Tools', emoji: '📝', profileKey: 'note'     },
  // Row 1: HINT, CRAM, STUDY, SPEED, TUTOR
  { key: 'ctrl+shift+f17',     sdLabel: 'Ctrl+Shift+F17',     action: 'ai_hint',         label: 'HINT',   tip: 'AI provide hint for current card',     page: 3, slot: 5,  category: 'AI Tools', emoji: '💡', profileKey: 'hint'     },
  { key: 'ctrl+shift+f18',     sdLabel: 'Ctrl+Shift+F18',     action: 'ai_cram',         label: 'CRAM',   tip: 'AI cram mode — rapid study session',   page: 3, slot: 6,  category: 'AI Tools', emoji: '🏃', profileKey: 'cram'     },
  { key: 'ctrl+shift+f19',     sdLabel: 'Ctrl+Shift+F19',     action: 'ai_study_plan',   label: 'STUDY',  tip: 'AI generate study plan',               page: 3, slot: 7,  category: 'AI Tools', emoji: '📅', profileKey: 'study'    },
  { key: 'ctrl+shift+f20',     sdLabel: 'Ctrl+Shift+F20',     action: 'nav_speed',       label: 'SPEED',  tip: 'Launch Speed Preview mode',            page: 3, slot: 8,  category: 'AI Tools', emoji: '⚡', profileKey: 'speed'    },
  { key: 'alt+ctrl+shift+f14', sdLabel: 'Alt+Ctrl+Shift+F14', action: 'ai_tutor',        label: 'TUTOR',  tip: 'AI Socratic tutor session',            page: 3, slot: 9,  category: 'AI Tools', emoji: '🎓', profileKey: 'tutor'    },
  // Row 2: INTER, STATS, REVIEW, ◄PAGE, PAGE►
  { key: 'ctrl+shift+f21',     sdLabel: 'Ctrl+Shift+F21',     action: 'ai_interleave',   label: 'INTER',  tip: 'AI interleaved practice session',      page: 3, slot: 10, category: 'AI Tools',   emoji: '🔀', profileKey: 'inter'    },
  { key: 'ctrl+shift+f22',     sdLabel: 'Ctrl+Shift+F22',     action: 'nav_analytics',   label: 'STATS',  tip: 'Go to Analytics / statistics',         page: 3, slot: 11, category: 'AI Tools',   emoji: '📊', profileKey: 'stats'    },
  { key: 'ctrl+shift+f23',     sdLabel: 'Ctrl+Shift+F23',     action: 'ai_review',       label: 'REVIEW', tip: 'AI-powered review session',            page: 3, slot: 12, category: 'AI Tools',   emoji: '🔁', profileKey: 'review'   },
  { key: 'ctrl+shift+f24',     sdLabel: 'Ctrl+Shift+F24',     action: 'sd_page_prev',    label: '◄PAGE',  tip: 'Previous Stream Deck page',            page: 3, slot: 13, category: 'Navigation', emoji: '⏪', profileKey: 'pagePrev' },
  { key: 'alt+ctrl+shift+f15', sdLabel: 'Alt+Ctrl+Shift+F15', action: 'sd_page_next',    label: 'PAGE►',  tip: 'Next Stream Deck page',                page: 3, slot: 14, category: 'Navigation', emoji: '⏩', profileKey: 'pageNext' },
];

/** Navigation action → hash route (handled globally in useSD) */
export const NAV_ROUTES: Record<string, string> = {
  nav_home:      '#/',
  nav_dash:      '#/',
  nav_cards:     '#/flashcards',
  nav_quiz:      '#/quiz',
  nav_learn:     '#/learn',
  nav_ai:        '#/learn',
  nav_notes:     '#/library',
  nav_timer:     '#/timer',
  nav_settings:  '#/settings',
  nav_calendar:  '#/calendar',
  nav_speed:     '#/speed-preview',
  nav_analytics: '#/?tab=analytics',
};

/** Page metadata for Settings UI */
export const SD_PAGE_META = [
  { label: 'Study Mode',      emoji: '📖', color: '#F5A623', description: 'Flashcard controls & grading' },
  { label: 'Drawing & Notes', emoji: '✏️',  color: '#22C55E', description: 'Drawing tools & note formatting' },
  { label: 'Navigation',      emoji: '🧭', color: '#3B82F6', description: 'Navigate anywhere in NousAI' },
  { label: 'AI Tools',        emoji: '🤖', color: '#A855F7', description: 'AI-powered study actions' },
];
