/**
 * useStreamDeckProfile — Save, load, export, and import the Stream Deck shortcut profile.
 *
 * Persists to localStorage. Export → JSON file. Import → JSON file → updates state + storage.
 * Reset → restores defaults. No external dependencies.
 */
import { useState, useCallback } from 'react';
import { DEFAULT_STREAM_DECK_PROFILE, type StreamDeckProfile } from '../utils/streamDeckProfile';

const STORAGE_KEY = 'nous_streamdeck_profile';

function loadFromStorage(): StreamDeckProfile {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_STREAM_DECK_PROFILE as StreamDeckProfile;
    const parsed = JSON.parse(saved) as StreamDeckProfile;
    // Guard: if version mismatch, reset to defaults
    if (parsed.version !== DEFAULT_STREAM_DECK_PROFILE.version) return DEFAULT_STREAM_DECK_PROFILE as StreamDeckProfile;
    return parsed;
  } catch {
    return DEFAULT_STREAM_DECK_PROFILE as StreamDeckProfile;
  }
}

export function useStreamDeckProfile() {
  const [profile, setProfile] = useState<StreamDeckProfile>(loadFromStorage);

  const save = useCallback((updated: StreamDeckProfile) => {
    setProfile(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch { /* quota */ }
  }, []);

  /** Download the current profile as a JSON file */
  const download = useCallback(() => {
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nous-streamdeck-profile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [profile]);

  /** Import a profile from a JSON file — validates structure before saving */
  const importProfile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as StreamDeckProfile;
        if (!parsed.version || !parsed.pages) throw new Error('Invalid structure');
        save(parsed);
      } catch {
        // Surface error visibly but don't crash
        window.dispatchEvent(new CustomEvent('nousai-toast', { detail: 'Invalid profile file — import failed' }));
      }
    };
    reader.readAsText(file);
  }, [save]);

  /** Reset everything back to the built-in defaults */
  const reset = useCallback(() => {
    save(DEFAULT_STREAM_DECK_PROFILE as StreamDeckProfile);
  }, [save]);

  return { profile, save, download, importProfile, reset };
}
