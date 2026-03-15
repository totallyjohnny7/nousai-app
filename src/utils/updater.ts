/**
 * Auto-update checker for NousAI Companion
 *
 * For PWA: The service worker handles updates automatically (vite-plugin-pwa autoUpdate).
 * For Capacitor: Check a version.json file hosted on your server/GitHub.
 *
 * How to set up auto-updates:
 * 1. Host a version.json file at a public URL (e.g., GitHub Pages, your own server)
 * 2. Set the UPDATE_URL below to point to it
 * 3. When you build a new version, update version.json with the new version number and APK URL
 *
 * version.json format:
 * {
 *   "version": "1.1.0",
 *   "minVersion": "1.0.0",
 *   "releaseNotes": "Added new flashcard modes",
 *   "androidUrl": "https://your-server.com/nousai-v1.1.0.apk",
 *   "iosUrl": "https://apps.apple.com/app/nousai/id123456",
 *   "webUrl": "https://your-app-url.com"
 * }
 */

// Injected at build time from package.json via vite.config.ts define
declare const __APP_VERSION__: string;
const APP_VERSION = __APP_VERSION__;

// Hardcoded update URL — do not load from localStorage (XSS risk)
const UPDATE_URL = '';

interface UpdateInfo {
  version: string;
  minVersion?: string;
  releaseNotes?: string;
  androidUrl?: string;
  iosUrl?: string;
  webUrl?: string;
}

export function getAppVersion(): string {
  return APP_VERSION;
}

export async function checkForUpdates(): Promise<{ available: boolean; info?: UpdateInfo }> {
  if (!UPDATE_URL) {
    return { available: false };
  }

  try {
    const res = await fetch(UPDATE_URL, { cache: 'no-cache' });
    if (!res.ok) return { available: false };

    const info: UpdateInfo = await res.json();
    const available = compareVersions(info.version, APP_VERSION) > 0;

    if (available) {
      // Store update info for display
      localStorage.setItem('nousai-update-available', JSON.stringify(info));
    }

    return { available, info };
  } catch {
    return { available: false };
  }
}

export function getStoredUpdate(): UpdateInfo | null {
  try {
    const stored = localStorage.getItem('nousai-update-available');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export function dismissUpdate(): void {
  localStorage.removeItem('nousai-update-available');
}

// setUpdateUrl removed — URL is hardcoded to prevent XSS-based redirect

export function getUpdateUrl(): string {
  return UPDATE_URL;
}

/** Compare semver strings: returns positive if a > b, negative if a < b, 0 if equal */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Detect if running inside Capacitor native shell */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).Capacitor;
}

/** Detect platform */
export function getPlatform(): 'android' | 'ios' | 'web' {
  if (isCapacitor()) {
    const cap = (window as unknown as Record<string, unknown>).Capacitor as Record<string, unknown>;
    const platform = cap.getPlatform as () => string;
    if (platform) {
      const p = platform();
      if (p === 'android') return 'android';
      if (p === 'ios') return 'ios';
    }
  }
  return 'web';
}
