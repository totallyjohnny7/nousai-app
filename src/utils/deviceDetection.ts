/**
 * Device Detection — NousAI
 * Detects device profile and capabilities for adaptive UX.
 * Boox EMR stylus, iPad Apple Pencil, Windows/Mac Wacom, mobile.
 */

export type DeviceProfile = 'boox' | 'ipad' | 'windows' | 'macos' | 'ios' | 'android' | 'generic';

export interface DeviceCapabilities {
  profile: DeviceProfile;
  isEink: boolean;
  hasPressure: boolean;           // true on Windows/iPad with stylus
  hasApplePencil: boolean;        // iPad Safari with PencilKit-style touch force
  hasQuickKeys: boolean;          // set to true by quickKeysService after connect
  prefersPalmRejection: boolean;  // true on iPad; also user-configurable in Settings
  pixelRatio: number;             // window.devicePixelRatio
  supportsWebHID: boolean;        // 'hid' in navigator (Chrome/Edge desktop only)
  supportsGetDisplayMedia: boolean; // screen capture API
}

let _profile: DeviceProfile | null = null;
let _caps: DeviceCapabilities | null = null;

export function detectDeviceProfile(): DeviceProfile {
  if (_profile) return _profile;

  const ua = navigator.userAgent;

  if (ua.includes('BOOX') || ua.includes('Onyx')) {
    _profile = 'boox';
  } else if (/iPad/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)) {
    _profile = 'ipad';
  } else if (/iPhone/.test(ua)) {
    _profile = 'ios';
  } else if (/Android/.test(ua)) {
    _profile = 'android';
  } else if (/Windows/.test(ua)) {
    _profile = 'windows';
  } else if (/Mac/.test(ua)) {
    _profile = 'macos';
  } else if (window.matchMedia?.('(update: slow)').matches) {
    // E-ink displays update slowly — catch-all for unlabeled Boox / Kobo devices
    _profile = 'boox';
  } else {
    _profile = 'generic';
  }

  return _profile;
}

export function getDeviceCapabilities(): DeviceCapabilities {
  if (_caps) return _caps;

  const profile = detectDeviceProfile();
  const isEink = profile === 'boox';

  _caps = {
    profile,
    isEink,
    hasPressure: profile === 'windows' || profile === 'macos' || profile === 'ipad',
    hasApplePencil: profile === 'ipad',
    hasQuickKeys: false, // updated by quickKeysService on connect
    prefersPalmRejection: profile === 'ipad',
    pixelRatio: window.devicePixelRatio ?? 1,
    supportsWebHID: 'hid' in navigator,
    supportsGetDisplayMedia: !!(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices),
  };

  return _caps;
}

/** Called by quickKeysService after a device connects/disconnects */
export function setQuickKeysConnected(connected: boolean): void {
  if (_caps) _caps.hasQuickKeys = connected;
}

/**
 * Normalize pointer pressure per device profile.
 * Boox EMR returns inconsistent values — always 1.0.
 * iPad maps Apple Pencil force naturally.
 * Others: use raw event.pressure with 0.5 fallback.
 */
export function normalizePressure(e: React.PointerEvent, profile: DeviceProfile): number {
  if (profile === 'boox') return 1.0;
  if (e.pressure === 0 || e.pressure === undefined) return 0.5;
  return Math.max(0.1, Math.min(1.0, e.pressure));
}
