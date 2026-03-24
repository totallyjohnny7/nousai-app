/**
 * streamDeckProfile.ts — Stream Deck shortcut profile data.
 * Single source of truth for user's customized hotkey assignments.
 * Stored in localStorage, exportable as JSON, importable from JSON.
 *
 * 4 pages × 15 keys (5 cols × 3 rows) = 60 total keys.
 */

export const DEFAULT_STREAM_DECK_PROFILE = {
  version: '3.0',
  pages: {
    studyMode: {
      flip: 'F13', prev: 'F14', next: 'F15', lasso: 'F16', fullscr: 'Alt+F13',
      again: 'F17', hard: 'F18', good: 'F19', easy: 'F20', type: 'Alt+F14',
      aiExplain: 'F21', rsvp: 'F22', zen: 'F23', pagePrev: 'F24', pageNext: 'Alt+F15',
    },
    tools: {
      bold: 'Shift+F13', hilite: 'Shift+F14', pen: 'Shift+F15', clear: 'Shift+F16', fill: 'Alt+Shift+F13',
      search: 'Shift+F17', italic: 'Shift+F18', save: 'Shift+F19', color: 'Shift+F20', snap: 'Alt+Shift+F14',
      undo: 'Shift+F21', redo: 'Shift+F22', erase: 'Shift+F23', pagePrev: 'Shift+F24', pageNext: 'Alt+Shift+F15',
    },
    navigation: {
      home: 'Ctrl+F13', cards: 'Ctrl+F14', quiz: 'Ctrl+F15', learn: 'Ctrl+F16', dash: 'Alt+Ctrl+F13',
      timer: 'Ctrl+F17', notes: 'Ctrl+F18', calendar: 'Ctrl+F19', settings: 'Ctrl+F20', ai: 'Alt+Ctrl+F14',
      focus: 'Ctrl+F21', omni: 'Ctrl+F23', pagePrev: 'Ctrl+F24', pageNext: 'Alt+Ctrl+F15',
    },
    aiTools: {
      summ: 'Ctrl+Shift+F13', flash: 'Ctrl+Shift+F14', quizGen: 'Ctrl+Shift+F15', dict: 'Ctrl+Shift+F16', note: 'Alt+Ctrl+Shift+F13',
      hint: 'Ctrl+Shift+F17', cram: 'Ctrl+Shift+F18', study: 'Ctrl+Shift+F19', speed: 'Ctrl+Shift+F20', tutor: 'Alt+Ctrl+Shift+F14',
      inter: 'Ctrl+Shift+F21', stats: 'Ctrl+Shift+F22', review: 'Ctrl+Shift+F23', pagePrev: 'Ctrl+Shift+F24', pageNext: 'Alt+Ctrl+Shift+F15',
    },
  },
} as const;

export type StreamDeckProfile = {
  version: string;
  pages: {
    studyMode: Record<string, string>;
    tools: Record<string, string>;
    navigation: Record<string, string>;
    aiTools: Record<string, string>;
  };
};

/** Human-readable labels per action key */
export const PROFILE_LABELS: Record<string, Record<string, string>> = {
  studyMode: {
    flip: 'Flip Card', prev: 'Prev Card', next: 'Next Card', lasso: 'Select Text', fullscr: 'Full Screen',
    again: 'Grade: Again', hard: 'Grade: Hard', good: 'Grade: Good', easy: 'Grade: Easy', type: 'Type Recall',
    aiExplain: 'AI Explain', rsvp: 'RSVP Mode', zen: 'Zen Mode', pagePrev: '◄ Page', pageNext: 'Page ►',
  },
  tools: {
    bold: 'Bold', hilite: 'Highlighter', pen: 'Pen Tool', clear: 'Clear Canvas', fill: 'Fill Tool',
    search: 'Search Notes', italic: 'Italic', save: 'Save', color: 'Color Picker', snap: 'Snap to Grid',
    undo: 'Undo', redo: 'Redo', erase: 'Eraser', pagePrev: '◄ Page', pageNext: 'Page ►',
  },
  navigation: {
    home: 'Home', cards: 'Flashcards', quiz: 'Quiz', learn: 'Learn', dash: 'Dashboard',
    timer: 'Timer', notes: 'Library', calendar: 'Calendar', settings: 'Settings', ai: 'AI Tools',
    focus: 'Focus Lock', omni: 'Omni Protocol', pagePrev: '◄ Page', pageNext: 'Page ►',
  },
  aiTools: {
    summ: 'Summarize', flash: 'Gen Flashcards', quizGen: 'Gen Quiz', dict: 'Dictionary', note: 'Gen Notes',
    hint: 'Hint', cram: 'Cram Mode', study: 'Study Plan', speed: 'Speed Preview', tutor: 'AI Tutor',
    inter: 'Interleave', stats: 'Statistics', review: 'AI Review', pagePrev: '◄ Page', pageNext: 'Page ►',
  },
};

export const PAGE_DISPLAY: Record<string, { label: string; emoji: string; color: string }> = {
  studyMode:  { label: 'Study Mode',      emoji: '📖', color: '#F5A623' },
  tools:      { label: 'Drawing & Notes', emoji: '✏️',  color: '#22C55E' },
  navigation: { label: 'Navigation',      emoji: '🧭', color: '#3B82F6' },
  aiTools:    { label: 'AI Tools',        emoji: '🤖', color: '#A855F7' },
};
