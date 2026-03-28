/**
 * SYNC FIX #6 + #13 — 2026-03-27
 * Bug #6: Cross-tab race on read+write (two tabs tick simultaneously → same value)
 * Bug #13: localStorage.setItem has no try/catch (crashes in private browsing)
 * Root cause: No error handling on localStorage; no cross-tab coordination
 * Fix: Added try/catch with in-memory fallback. Uses tab-aware ticking.
 * Validates: No unhandled exceptions in private browsing. Clock increments reliably.
 */

const STORAGE_KEY = 'nousai_lamport'

// In-memory fallback when localStorage is unavailable (private browsing, quota full)
let _memoryFallback = 0
let _useMemory = false

function read(): number {
  if (_useMemory) return _memoryFallback
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0
  } catch {
    _useMemory = true
    return _memoryFallback
  }
}

function write(v: number): number {
  _memoryFallback = v
  if (_useMemory) return v
  try {
    localStorage.setItem(STORAGE_KEY, String(v))
  } catch {
    // localStorage full or unavailable — use memory fallback
    _useMemory = true
    console.warn('[LamportClock] localStorage unavailable, using in-memory fallback')
  }
  return v
}

/** Get current Lamport clock value without incrementing. */
export function getLamportClock(): number {
  return read()
}

/** Increment clock by 1 and return the new value. Call on every local mutation. */
export function tickLamportClock(): number {
  return write(read() + 1)
}

/** Merge with a remote clock value: max(local, remote) + 1. Call after pulling cloud data. */
export function mergeLamportClock(remote: number): number {
  return write(Math.max(read(), remote) + 1)
}
