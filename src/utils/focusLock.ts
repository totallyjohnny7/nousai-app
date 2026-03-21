/**
 * Focus Lock — enters deep study mode.
 * - Requests Screen Wake Lock API (prevents screen sleep)
 * - Enters fullscreen
 * - Updates document title
 * - Tracks lock state
 */

let wakeLockSentinel: any = null;
let _isLocked = false;

export function isFocusLocked(): boolean {
  return _isLocked;
}

export async function enterFocusLock(): Promise<void> {
  _isLocked = true;

  // Wake Lock API (Chrome 84+)
  if ('wakeLock' in navigator) {
    try {
      wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => { wakeLockSentinel = null; });
    } catch (e) {
      console.warn('[FocusLock] Wake Lock not available:', e);
    }
  }

  // Fullscreen
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) {
    console.warn('[FocusLock] Fullscreen not available:', e);
  }

  document.title = '🔒 FOCUS — NOUS AI';
}

export async function exitFocusLock(): Promise<void> {
  _isLocked = false;

  if (wakeLockSentinel) {
    try { await wakeLockSentinel.release(); } catch {}
    wakeLockSentinel = null;
  }

  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  }

  document.title = 'NousAI Study Companion';
}

export function toggleFocusLock(): Promise<void> {
  return _isLocked ? exitFocusLock() : enterFocusLock();
}
