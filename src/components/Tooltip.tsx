import { useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface TooltipState {
  content: React.ReactNode
  left: number
  top?: number
  bottom?: number
}

const TIP_W = 268
const GAP   = 8

function calcPos(rect: DOMRect) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  // Center tooltip horizontally over the trigger element, clamped to viewport
  const center = rect.left + rect.width / 2
  const left = Math.max(GAP, Math.min(center - TIP_W / 2, vw - TIP_W - GAP))
  // Anchor bottom edge just above element; drop below if too close to top
  if (rect.top > 120) {
    return { left, bottom: vh - rect.top + GAP }
  } else {
    return { left, top: rect.bottom + GAP }
  }
}

// Renders via createPortal so it always escapes any stacking context / overflow
// container. z-index: 99999 applies to the root stacking context.
export function TooltipPopup({ tip }: { tip: TooltipState }) {
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: tip.left,
        top: tip.top,
        bottom: tip.bottom,
        width: TIP_W,
        zIndex: 99999,
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        padding: '8px 10px',
        fontSize: 12,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
        pointerEvents: 'none',
        lineHeight: 1.55,
      }}
    >
      {tip.content}
    </div>,
    document.body
  )
}

export function useTip() {
  const [tip, setTip] = useState<TooltipState | null>(null)

  const show = useCallback((e: React.MouseEvent, content: React.ReactNode) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setTip({ ...calcPos(rect), content })
  }, [])

  // Kept for callers that bind onMouseMove — element-anchored positioning means
  // we no longer need to track cursor movement, so this is a no-op.
  const move = useCallback((_e: React.MouseEvent) => {}, [])

  const hide = useCallback(() => setTip(null), [])

  return { tip, show, move, hide }
}
