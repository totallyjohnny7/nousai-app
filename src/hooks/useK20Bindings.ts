/**
 * useK20Bindings — React hook for K20 key binding management.
 *
 * Reads/writes bindings from localStorage.
 * Merges user overrides with defaults on load.
 * Exposes update/reset functions for the Settings UI.
 * Both useK20Hotkeys and the Settings UI consume this hook.
 */

import { useState, useCallback, useEffect } from 'react';
import { K20_DEFAULT_BINDINGS, type K20BindingsMap, type K20ActionId } from '../utils/k20Types';
import { scanK20Conflicts } from '../utils/k20ConflictScanner';

const LS_KEY = 'k20-key-bindings';

/** Read bindings from localStorage, merged with defaults */
function loadBindings(): K20BindingsMap {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate: only merge string values (corrupted data could contain objects)
      const overrides: Record<string, K20ActionId> = {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') overrides[k] = v as K20ActionId;
        }
      }
      return { ...K20_DEFAULT_BINDINGS, ...overrides };
    }
  } catch { /* corrupt — use defaults */ }
  return { ...K20_DEFAULT_BINDINGS };
}

/** Save only the overrides (keys that differ from defaults) */
function saveBindings(bindings: K20BindingsMap): void {
  const overrides: Partial<K20BindingsMap> = {};
  for (const [keyId, actionId] of Object.entries(bindings)) {
    if (K20_DEFAULT_BINDINGS[keyId] !== actionId) {
      overrides[keyId] = actionId;
    }
  }
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(LS_KEY);
  } else {
    localStorage.setItem(LS_KEY, JSON.stringify(overrides));
  }
}

/** BroadcastChannel for cross-tab sync of binding changes */
const K20_SYNC_CHANNEL = 'k20-bindings-sync';

export interface UseK20BindingsReturn {
  bindings: K20BindingsMap;
  conflicts: string[];
  updateBinding: (keyId: string, actionId: K20ActionId) => void;
  resetToDefaults: () => void;
  /** Version counter — increments on every change, used by useK20Hotkeys to re-register */
  version: number;
}

export function useK20Bindings(): UseK20BindingsReturn {
  const [bindings, setBindings] = useState<K20BindingsMap>(loadBindings);
  const [version, setVersion] = useState(0);
  const [conflicts, setConflicts] = useState<string[]>(() => scanK20Conflicts());

  // Cross-tab sync: listen for changes from other tabs
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(K20_SYNC_CHANNEL);
      channel.onmessage = () => {
        const fresh = loadBindings();
        setBindings(fresh);
        setConflicts(scanK20Conflicts());
        setVersion(v => v + 1);
      };
    } catch { /* BroadcastChannel not supported */ }
    return () => { channel?.close(); };
  }, []);

  const updateBinding = useCallback((keyId: string, actionId: K20ActionId) => {
    setBindings(prev => {
      const next = { ...prev, [keyId]: actionId };
      saveBindings(next);
      setConflicts(scanK20Conflicts());
      setVersion(v => v + 1);
      // Notify other tabs
      try { new BroadcastChannel(K20_SYNC_CHANNEL).postMessage('updated'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = { ...K20_DEFAULT_BINDINGS };
    setBindings(defaults);
    saveBindings(defaults);
    setConflicts(scanK20Conflicts());
    setVersion(v => v + 1);
    try { new BroadcastChannel(K20_SYNC_CHANNEL).postMessage('reset'); } catch { /* ignore */ }
  }, []);

  return { bindings, conflicts, updateBinding, resetToDefaults, version };
}

/** Standalone function to read bindings (for non-React contexts) */
export function getK20Bindings(): K20BindingsMap {
  return loadBindings();
}
