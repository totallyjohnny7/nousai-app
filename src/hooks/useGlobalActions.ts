/**
 * useGlobalActions — Global StreamDeck / shortcut action interceptor.
 *
 * Listens for 'nousai-sd' CustomEvents from useSD (StreamDeck keys). If
 * the action requires a page that is NOT
 * currently mounted, navigates there first and stores the action in
 * sessionStorage. The target page reads and clears this on mount, then
 * re-fires the event so its own registerActions() handlers execute normally.
 *
 * If the correct page IS already mounted, this hook is a no-op — the page's
 * own registerActions() listener handles the event directly.
 *
 * Special actions (omni_start, focus_lock) dispatch secondary CustomEvents
 * that App.tsx listens for — no navigation needed.
 *
 * Science basis: Consistent shortcut response regardless of current screen
 * reduces cognitive load by eliminating the need to track app state before
 * pressing a key — users build reliable motor memory without context-
 * switching overhead (Fitts' Law pointing cost elimination; MacLeod et al.
 * motor consolidation). sessionStorage is used (not localStorage) so pending
 * intent is tab-scoped and cleared on window close — idempotent intent:
 * each action executes exactly once or not at all.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';

/** Actions that open overlays or toggle state — no navigation needed */
const OVERLAY_ACTIONS: Record<string, string> = {
  omni_start:  'nousai-open-omni',
  focus_lock:  'nousai-toggle-focus',
};

/**
 * Base path for each action — used to check if the correct page is mounted.
 * nav_* actions are NOT listed here (handled upstream by useSD → NAV_ROUTES).
 */
const ACTION_BASE_PATH: Record<string, string> = {
  // Flashcard page
  fc_flip:        '/flashcards',
  fc_next:        '/flashcards',
  fc_prev:        '/flashcards',
  fc_conf1:       '/flashcards',
  fc_conf2:       '/flashcards',
  fc_conf3:       '/flashcards',
  fc_conf4:       '/flashcards',
  fc_type_recall: '/flashcards',
  fc_zen:         '/flashcards',
  fc_fullscreen:  '/flashcards',
  ai_explain:     '/flashcards',
  // Quiz page
  qz_opt1:     '/quiz',
  qz_opt2:     '/quiz',
  qz_opt3:     '/quiz',
  qz_opt4:     '/quiz',
  qz_submit:   '/quiz',
  qz_continue: '/quiz',
  // Library page — notes
  notes_new:    '/library',
  notes_search: '/library',
  notes_save:   '/library',
  notes_bold:   '/library',
  notes_italic: '/library',
  notes_speak:  '/library',
  // Library page — drawings
  draw_pen:       '/library',
  draw_highlight: '/library',
  draw_erase:     '/library',
  draw_clear:     '/library',
  draw_undo:      '/library',
  draw_redo:      '/library',
  draw_save:      '/library',
  draw_color:     '/library',
  // Interleaving — no specific page required, pass through
};

/**
 * Full navigation target for actions that require a specific tab.
 * Falls back to ACTION_BASE_PATH[action] if not listed here.
 */
const ACTION_NAV_ROUTE: Record<string, string> = {
  notes_bold:   '/library?tab=notes',
  notes_italic: '/library?tab=notes',
  notes_speak:  '/library?tab=notes',
  draw_pen:       '/library?tab=drawings',
  draw_highlight: '/library?tab=drawings',
  draw_erase:     '/library?tab=drawings',
  draw_clear:     '/library?tab=drawings',
  draw_undo:      '/library?tab=drawings',
  draw_redo:      '/library?tab=drawings',
  draw_save:      '/library?tab=drawings',
  draw_color:     '/library?tab=drawings',
};

/** sessionStorage key for cross-page pending action */
export const PENDING_SD_ACTION_KEY = 'nousai_pending_sd_action';

function currentBasePath(): string {
  return window.location.hash.replace('#', '').split('?')[0] || '/';
}

export function useGlobalActions(): void {
  const navigate = useNavigate();
  const { activePageContext } = useStore();

  useEffect(() => {
    function onSD(e: Event): void {
      const action = (e as CustomEvent<string>).detail;
      if (!action) return;

      // Special: overlay / toggle actions don't need navigation
      if (action in OVERLAY_ACTIONS) {
        window.dispatchEvent(new CustomEvent(OVERLAY_ACTIONS[action]));
        return;
      }

      // Navigate-to-tool actions — open specific Learn tools regardless of current page
      // Navigate first, then dispatch nousai-switch-tool after mount to auto-open the tool
      if (action === 'fc_rsvp') {
        navigate('/learn');
        setTimeout(() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'rsvp' })), 300);
        return;
      }
      if (action === 'screen_lasso') {
        navigate('/learn');
        setTimeout(() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'screen-lasso' })), 300);
        return;
      }
      if (action === 'interleave') {
        navigate('/learn');
        setTimeout(() => window.dispatchEvent(new CustomEvent('nousai-switch-tool', { detail: 'interleave' })), 300);
        return;
      }
      // AI Explain: works from any page — on /flashcards the page handler fires,
      // on other pages we build a fallback message from activePageContext
      if (action === 'ai_explain' && currentBasePath() !== '/flashcards') {
        const message = activePageContext?.activeItem
          ? `Explain this content:\n\n${activePageContext.activeItem}`
          : activePageContext?.summary
            ? `Help me understand: ${activePageContext.summary}`
            : 'No readable content found on this page.';
        window.dispatchEvent(new CustomEvent('nousai-ai-explain', { detail: { message } }));
        return;
      }

      const targetBasePath = ACTION_BASE_PATH[action];
      if (!targetBasePath) return; // nav_* handled by useSD; unknown actions ignored

      if (currentBasePath() === targetBasePath) return; // page is mounted, its listener fires

      // Cross-page: store intent and navigate — page will execute on mount
      sessionStorage.setItem(PENDING_SD_ACTION_KEY, action);
      navigate(ACTION_NAV_ROUTE[action] ?? targetBasePath);
    }

    window.addEventListener('nousai-sd', onSD);
    return () => window.removeEventListener('nousai-sd', onSD);
  }, [navigate, activePageContext]);
}
