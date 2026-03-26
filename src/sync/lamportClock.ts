/**
 * Lamport-style monotonic sync counter.
 * Used to order sync operations and detect concurrent edits.
 * Stored in localStorage so it persists across page reloads.
 */

const STORAGE_KEY = 'nousai_lamport'

function read(): number {
  return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0
}

function write(v: number): number {
  localStorage.setItem(STORAGE_KEY, String(v))
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
