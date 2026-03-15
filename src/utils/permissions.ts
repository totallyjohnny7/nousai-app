/**
 * Central PWA Permissions Manager for NousAI
 *
 * Manages: Screen Wake Lock, Persistent Storage, Microphone,
 * Background Sync, Clipboard, File System Access
 */

export interface PermissionResult {
  granted: boolean
  error?: string
}

export interface AllPermissions {
  notification: PermissionState | 'unsupported'
  microphone: PermissionState | 'unsupported'
  persistentStorage: boolean | 'unsupported'
  wakeLock: 'supported' | 'unsupported'
  clipboard: 'supported' | 'unsupported'
  backgroundSync: 'supported' | 'unsupported'
  fileSystemAccess: 'supported' | 'unsupported'
}

type PermissionState = 'granted' | 'denied' | 'prompt'

// ─── Feature Detection ──────────────────────────────────

export function isWakeLockSupported(): boolean {
  return 'wakeLock' in navigator
}

export function isPersistentStorageSupported(): boolean {
  return 'storage' in navigator && 'persist' in navigator.storage
}

export function isClipboardSupported(): boolean {
  return 'clipboard' in navigator
}

export function isBackgroundSyncSupported(): boolean {
  return 'serviceWorker' in navigator && 'SyncManager' in window
}

export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window
}

// ─── Check All Permissions ──────────────────────────────

export async function checkAllPermissions(): Promise<AllPermissions> {
  const result: AllPermissions = {
    notification: 'unsupported',
    microphone: 'unsupported',
    persistentStorage: 'unsupported',
    wakeLock: isWakeLockSupported() ? 'supported' : 'unsupported',
    clipboard: isClipboardSupported() ? 'supported' : 'unsupported',
    backgroundSync: isBackgroundSyncSupported() ? 'supported' : 'unsupported',
    fileSystemAccess: isFileSystemAccessSupported() ? 'supported' : 'unsupported',
  }

  // Notification
  if ('Notification' in window) {
    result.notification = Notification.permission as PermissionState
  }

  // Microphone — use Permissions API if available
  try {
    const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName })
    result.microphone = mic.state as PermissionState
  } catch {
    // Permissions API may not support 'microphone' query in all browsers
    result.microphone = 'prompt'
  }

  // Persistent Storage
  if (isPersistentStorageSupported()) {
    result.persistentStorage = await navigator.storage.persisted()
  }

  return result
}

// ─── Screen Wake Lock ───────────────────────────────────

let wakeLockSentinel: WakeLockSentinel | null = null

export async function requestWakeLock(): Promise<PermissionResult> {
  if (!isWakeLockSupported()) {
    return { granted: false, error: 'Wake Lock API not supported' }
  }
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen')
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null
    })
    return { granted: true }
  } catch (e: any) {
    return { granted: false, error: e?.message || 'Failed to acquire wake lock' }
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release()
    wakeLockSentinel = null
  }
}

export function isWakeLockActive(): boolean {
  return wakeLockSentinel !== null && !wakeLockSentinel.released
}

// ─── Persistent Storage ─────────────────────────────────

export async function requestPersistentStorage(): Promise<PermissionResult> {
  if (!isPersistentStorageSupported()) {
    return { granted: false, error: 'Persistent Storage not supported' }
  }
  try {
    const persisted = await navigator.storage.persist()
    return { granted: persisted }
  } catch (e: any) {
    return { granted: false, error: e?.message || 'Failed to request persistent storage' }
  }
}

export async function isPersisted(): Promise<boolean> {
  if (!isPersistentStorageSupported()) return false
  return navigator.storage.persisted()
}

// ─── Microphone ─────────────────────────────────────────

export async function requestMicrophone(): Promise<PermissionResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Release the stream immediately — we only need the permission grant
    stream.getTracks().forEach(t => t.stop())
    return { granted: true }
  } catch (e: any) {
    if (e.name === 'NotAllowedError') {
      return { granted: false, error: 'Microphone permission denied' }
    }
    return { granted: false, error: e?.message || 'Failed to access microphone' }
  }
}

// ─── Clipboard ──────────────────────────────────────────

export async function writeClipboard(text: string): Promise<PermissionResult> {
  if (!isClipboardSupported()) {
    // Fallback
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return { granted: true }
    } catch {
      return { granted: false, error: 'Clipboard not supported' }
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return { granted: true }
  } catch (e: any) {
    return { granted: false, error: e?.message || 'Failed to write to clipboard' }
  }
}

export async function readClipboard(): Promise<{ granted: boolean; text?: string; error?: string }> {
  if (!isClipboardSupported()) {
    return { granted: false, error: 'Clipboard API not supported' }
  }
  try {
    const text = await navigator.clipboard.readText()
    return { granted: true, text }
  } catch (e: any) {
    return { granted: false, error: e?.message || 'Failed to read clipboard' }
  }
}

// ─── Background Sync ────────────────────────────────────

export async function registerBackgroundSync(tag: string = 'nousai-sync'): Promise<PermissionResult> {
  if (!isBackgroundSyncSupported()) {
    return { granted: false, error: 'Background Sync not supported' }
  }
  try {
    const reg = await navigator.serviceWorker.ready
    await (reg as any).sync.register(tag)
    return { granted: true }
  } catch (e: any) {
    return { granted: false, error: e?.message || 'Failed to register background sync' }
  }
}

// ─── File System Access ─────────────────────────────────

export async function openFilePicker(
  accept?: { description: string; accept: Record<string, string[]> }[]
): Promise<{ granted: boolean; file?: File; error?: string }> {
  if (isFileSystemAccessSupported()) {
    try {
      const [handle] = await (window as any).showOpenFilePicker({
        types: accept,
        multiple: false,
      })
      const file = await handle.getFile()
      return { granted: true, file }
    } catch (e: any) {
      if (e.name === 'AbortError') return { granted: false, error: 'Cancelled' }
      return { granted: false, error: e?.message || 'Failed to open file' }
    }
  }

  // Fallback: <input type="file">
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    if (accept?.length) {
      input.accept = Object.keys(accept[0].accept).join(',')
    }
    input.onchange = () => {
      const file = input.files?.[0]
      resolve(file ? { granted: true, file } : { granted: false, error: 'No file selected' })
    }
    input.click()
  })
}

export async function saveFilePicker(
  data: string,
  suggestedName: string = 'nousai-export.json'
): Promise<PermissionResult> {
  if (isFileSystemAccessSupported()) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      })
      const writable = await handle.createWritable()
      await writable.write(data)
      await writable.close()
      return { granted: true }
    } catch (e: any) {
      if (e.name === 'AbortError') return { granted: false, error: 'Cancelled' }
      return { granted: false, error: e?.message || 'Failed to save file' }
    }
  }

  // Fallback: download link
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedName
  a.click()
  URL.revokeObjectURL(url)
  return { granted: true }
}

// ─── localStorage Pref Helpers ──────────────────────────

const PREF_PREFIX = 'nousai-perm-'

export function getPermPref(key: string, defaultVal: boolean = true): boolean {
  const v = localStorage.getItem(PREF_PREFIX + key)
  return v === null ? defaultVal : v === 'true'
}

export function setPermPref(key: string, val: boolean): void {
  localStorage.setItem(PREF_PREFIX + key, String(val))
}
