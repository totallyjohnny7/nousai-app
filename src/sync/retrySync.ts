/**
 * Exponential backoff wrapper for sync operations.
 * Retries with 500ms, 1s, 2s, 4s delays + random jitter.
 */

export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt === maxRetries) break
      const baseMs = Math.pow(2, attempt) * 500
      const jitter = Math.random() * 200
      const waitMs = baseMs + jitter
      console.warn(`[Sync] Retry ${attempt + 1}/${maxRetries} in ${Math.round(waitMs)}ms`, err)
      await new Promise(r => setTimeout(r, waitMs))
    }
  }
  throw new Error(`Sync failed after ${maxRetries} retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}
