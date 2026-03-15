/**
 * Deep-link utilities for NousAI Companion.
 *
 * Supports:
 * - Hash-based routes (already handled by HashRouter)
 * - Capacitor App URL listener for native deep links
 * - Shareable link generation
 *
 * Recognised routes:
 *   #/flashcards/:courseId
 *   #/quizzes/:quizId
 *   #/timer
 *   #/calendar
 */

/* ─── types ───────────────────────────────────────────────── */

/**
 * Minimal shape of the Capacitor App plugin so we can use it
 * without a hard compile-time dependency on @capacitor/app.
 */
interface CapacitorAppPlugin {
  addListener(
    event: 'appUrlOpen',
    handler: (data: { url: string }) => void,
  ): Promise<{ remove: () => void }> | { remove: () => void }
}

/* ─── internal helpers ────────────────────────────────────── */

/**
 * Try to dynamically import @capacitor/app.
 * Returns `null` when the package is not installed or unavailable
 * (e.g. running as a plain web app).
 */
async function getCapacitorApp(): Promise<CapacitorAppPlugin | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await (Function('return import("@capacitor/app")')() as Promise<any>)
    return mod?.App ?? null
  } catch {
    return null
  }
}

/**
 * Detect whether we are running inside a Capacitor native shell.
 */
function isCapacitorNative(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as unknown as Record<string, unknown>).Capacitor
  )
}

/**
 * Extract the hash-route portion from an arbitrary URL string.
 *
 * Examples:
 *   "nousai://app#/flashcards/cs101"  ->  "/flashcards/cs101"
 *   "https://example.com/#/timer"     ->  "/timer"
 *   "/timer"                          ->  "/timer"
 */
function extractHashRoute(url: string): string | null {
  const hashIdx = url.indexOf('#')
  if (hashIdx === -1) return null
  const route = url.slice(hashIdx + 1)
  return route.startsWith('/') ? route : `/${route}`
}

/* ─── public API ──────────────────────────────────────────── */

/**
 * Initialise deep-link handling.
 *
 * On Capacitor this sets up an `appUrlOpen` listener that navigates
 * the HashRouter to the route embedded in the incoming URL.
 *
 * On the web, HashRouter already handles deep links out of the box,
 * so this function is a no-op (but safe to call).
 */
export function initDeepLinks(): void {
  if (!isCapacitorNative()) return

  // Fire-and-forget — we just need to register the listener
  void (async () => {
    const app = await getCapacitorApp()
    if (!app) return

    await app.addListener('appUrlOpen', (data: { url: string }) => {
      const route = extractHashRoute(data.url)
      if (route) {
        // HashRouter watches window.location.hash, so we can navigate
        // simply by updating the hash.
        window.location.hash = route
      }
    })
  })()
}

/**
 * Generate a shareable deep-link URL for a given route.
 *
 * @param route - The in-app route, e.g. "/flashcards/cs101" or "/timer".
 * @returns A full URL string that can be shared / bookmarked.
 *
 * In a web context this returns the current origin + hash route.
 * In a Capacitor context this returns a custom-scheme URL
 * (nousai://app#/...) that the native app can intercept.
 */
export function createShareLink(route: string): string {
  const normalised = route.startsWith('/') ? route : `/${route}`

  if (isCapacitorNative()) {
    return `nousai://app#${normalised}`
  }

  return `${window.location.origin}${window.location.pathname}#${normalised}`
}
