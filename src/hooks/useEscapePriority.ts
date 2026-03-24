import { useEffect } from 'react'

export interface UseEscapePriorityOptions {
  modalOpen: boolean
  nousChatOpen: boolean
  closeNousChat?: () => void
  annotationPanelOpen?: boolean
  closeAnnotationPanel?: () => void
  navigateBack?: () => void
}

/**
 * Escape priority queue (works alongside K20 hardware hotkeys):
 *   1. Close modal (if open)
 *   2. Minimize Nous chat (if open)
 *   3. Close annotation panel (if open)
 *   4. Navigate back
 *
 * Registers in capture phase so it fires before textarea/input handlers.
 */
export function useEscapePriority(opt: UseEscapePriorityOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return

      // 1. Modal takes highest priority
      if (opt.modalOpen) return // let the modal's own handler close it

      // 2. Nous chat — minimize
      if (opt.nousChatOpen && opt.closeNousChat) {
        e.preventDefault()
        opt.closeNousChat()
        return
      }

      // 3. Annotation panel
      if (opt.annotationPanelOpen && opt.closeAnnotationPanel) {
        e.preventDefault()
        opt.closeAnnotationPanel()
        return
      }

      // 4. Navigate back
      if (opt.navigateBack) {
        e.preventDefault()
        opt.navigateBack()
        return
      }
    }

    window.addEventListener('keydown', handler, true) // capture phase
    return () => window.removeEventListener('keydown', handler, true)
  }, [opt])
}
