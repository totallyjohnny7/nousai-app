import React from 'react'
import type { DragState, SwipeHandlers } from '../../hooks/useSwipeGesture'
import './SwipeableCard.css'

interface SwipeableCardProps {
  dragState: DragState
  handlers: SwipeHandlers
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function SwipeableCard({
  dragState,
  handlers,
  children,
  className,
  style,
}: SwipeableCardProps) {
  const { deltaX, progress, direction, phase, fastMode } = dragState

  const isDragging = phase === 'dragging'
  const isCommitting = phase === 'committing'
  const isCancelling = phase === 'cancelling'

  // Rotation: clamp to ±20deg
  const rawRotate = isDragging ? deltaX * 0.07 : 0
  const rotateDeg = Math.min(Math.max(rawRotate, -20), 20)

  // Overlay opacity:
  // - During drag: progress * 0.85 (natural fade-in with drag distance)
  // - During commit: 0.85 (full — keep overlay visible during fly-off animation)
  // - During cancel/idle: 0 (hidden)
  const overlayOpacity = isCommitting ? 0.85 : progress * 0.85

  // Label opacity: fades in after 20% progress threshold
  const labelOpacity = isCommitting ? 1 : Math.max(0, (progress - 0.2) / 0.8)

  // Shadow amplifies with drag progress — "lifted card" feel
  const shadowOffset = 8 + progress * 24
  const shadowBlur = 16 + progress * 32
  const shadowAlpha = (0.15 + progress * 0.25).toFixed(2)

  // Build class name
  const dirClass = direction === 'right' ? 'swipe-right' : direction === 'left' ? 'swipe-left' : ''
  const phaseClass = isCommitting ? 'swipe-committing' : isCancelling ? 'swipe-cancelling' : ''
  const fastClass = fastMode ? 'swipe-fast' : ''
  const wrapperClass = ['swipe-wrapper', phaseClass, dirClass, fastClass, className]
    .filter(Boolean)
    .join(' ')

  // Inline styles — only applied during drag; CSS classes handle animated states
  const wrapperStyle: React.CSSProperties = {
    boxShadow: `0 ${shadowOffset}px ${shadowBlur}px rgba(0,0,0,${shadowAlpha})`,
    ...(isDragging
      ? { transform: `translateX(${deltaX}px) rotate(${rotateDeg}deg)` }
      : {}),
    ...style,
  }

  // Show overlays only when dragging or committing in a direction
  const showRight = direction === 'right' && (isDragging || isCommitting)
  const showLeft = direction === 'left' && (isDragging || isCommitting)

  return (
    <div className={wrapperClass} style={wrapperStyle} {...handlers}>
      {children}

      {/* Right overlay — Know It */}
      <div
        className="swipe-overlay swipe-overlay-right"
        style={{ opacity: showRight ? overlayOpacity : 0 }}
        aria-hidden="true"
      >
        <span
          className="swipe-label swipe-label-right"
          style={{ opacity: showRight ? labelOpacity : 0 }}
        >
          ✓ KNOW IT
        </span>
      </div>

      {/* Left overlay — Review */}
      <div
        className="swipe-overlay swipe-overlay-left"
        style={{ opacity: showLeft ? overlayOpacity : 0 }}
        aria-hidden="true"
      >
        <span
          className="swipe-label swipe-label-left"
          style={{ opacity: showLeft ? labelOpacity : 0 }}
        >
          ✗ REVIEW
        </span>
      </div>
    </div>
  )
}
