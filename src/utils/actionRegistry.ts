/**
 * actionRegistry — lightweight bridge between 'nousai-sd' CustomEvents and page handlers.
 *
 * Pages call registerActions([['fc_flip', handler], ...]) in a useEffect.
 * The returned cleanup function removes those handlers on unmount.
 */

type ActionMap = [string, () => void][];

/**
 * Register one or more action handlers for the current mounted page.
 * Returns a cleanup function (suitable for returning from useEffect).
 */
export function registerActions(entries: ActionMap): () => void {
  function onSD(e: Event): void {
    const action = (e as CustomEvent<string>).detail;
    for (const [id, handler] of entries) {
      if (id === action) { handler(); return; }
    }
  }
  window.addEventListener('nousai-sd', onSD);
  return () => window.removeEventListener('nousai-sd', onSD);
}

/**
 * Register a single action handler.
 * Returns a cleanup function.
 */
export function registerAction(id: string, handler: () => void): () => void {
  return registerActions([[id, handler]]);
}
