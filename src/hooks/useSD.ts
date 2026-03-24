/**
 * useSD — Global Stream Deck shortcut handler. Mount once in App.tsx.
 *
 * Reads from the saved profile in localStorage on mount, so any custom key
 * assignments the user configured in Settings are respected.
 * Navigation actions are handled directly; all others dispatch 'nousai-sd'.
 *
 * Key changes in Settings take effect after page reload (localStorage is
 * read once on mount for performance).
 */
import { useMemo } from 'react';
import { useStreamDeckShortcuts } from './useStreamDeckShortcuts';
import { SD_KEYS, SD_PAGE_KEYS, NAV_ROUTES } from '../utils/sdKeys';

const PROFILE_STORAGE_KEY = 'nous_streamdeck_profile';

/**
 * Load profile from localStorage and return a map of action → normalized key.
 * Falls back to SD_KEYS default if no profile saved or key missing.
 */
function loadActionKeys(): Record<string, string> {
  const result: Record<string, string> = {};
  // Default from static SD_KEYS
  for (const k of SD_KEYS) result[k.action] = k.key;

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return result;
    const profile = JSON.parse(raw) as { pages: Record<string, Record<string, string>> };
    if (!profile?.pages) return result;

    for (const k of SD_KEYS) {
      const pageName = SD_PAGE_KEYS[k.page];
      const humanKey = profile.pages[pageName]?.[k.profileKey];
      if (humanKey) {
        // "Shift+F13" → "shift+f13"  |  "F13" → "f13"
        result[k.action] = humanKey.toLowerCase();
      }
    }
  } catch { /* ignore parse errors, use defaults */ }

  return result;
}

export function useSD(): void {
  const handlers = useMemo(() => {
    const actionKeys = loadActionKeys();
    const map: Record<string, () => void> = {};

    for (const k of SD_KEYS) {
      const activeKey = actionKeys[k.action] ?? k.key;
      if (k.action in NAV_ROUTES) {
        map[activeKey] = () => { window.location.hash = NAV_ROUTES[k.action]; };
      } else {
        const action = k.action;
        map[activeKey] = () => {
          window.dispatchEvent(new CustomEvent('nousai-sd', { detail: action }));
        };
      }
    }

    return map;
  }, []); // Read localStorage once on mount — profile changes need page reload

  useStreamDeckShortcuts(handlers);
}
