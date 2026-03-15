import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retry + cache-bust on chunk load failures.
 * After a deploy, old cached JS may reference chunk filenames that no longer exist.
 * This detects that error, clears SW caches, and reloads the page ONCE.
 */

const RELOAD_FLAG = 'nousai-chunk-reload';

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    // Network errors during chunk fetch
    (msg.includes('failed to fetch') && error.name === 'TypeError')
  );
}

export async function clearCachesAndReload(): Promise<void> {
  try {
    // Unregister all service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    }
    // Clear all caches
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    console.warn('[NousAI] Cache clear failed:', e);
  }
  // Force full reload from server
  window.location.reload();
}

export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      if (isChunkLoadError(error)) {
        // Check if we already tried reloading this session
        const alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG);
        if (!alreadyReloaded) {
          console.warn('[NousAI] Chunk load failed, clearing caches and reloading...', error);
          sessionStorage.setItem(RELOAD_FLAG, Date.now().toString());
          await clearCachesAndReload();
          // Won't reach here — page reloads
          return { default: (() => null) as unknown as T };
        }
        // Already reloaded once — clear the flag for next time and let error propagate
        sessionStorage.removeItem(RELOAD_FLAG);
      }
      throw error;
    }
  });
}

/**
 * Call this on successful app load to clear the reload flag.
 * This ensures future chunk failures get a fresh reload attempt.
 */
export function markAppLoaded(): void {
  sessionStorage.removeItem(RELOAD_FLAG);
}

/**
 * Detect if an error is a chunk load failure (for ErrorBoundary use).
 */
export { isChunkLoadError };
