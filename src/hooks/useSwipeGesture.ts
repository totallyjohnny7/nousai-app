import { useState, useRef, useCallback, useEffect } from 'react'

// JS-side constants (match CSS vars — not read via getComputedStyle)
const THRESHOLD = 120          // px — commit point
const MAX_DRAG = 200           // px — visual clamp when answer visible
const RESIST_MAX = 30          // px — clamp before flip
const VELOCITY_THRESHOLD = 0.5 // px/ms — velocity assist threshold
const VELOCITY_MIN_DELTA = 60  // px — min distance for velocity assist
const FAST_MODE_MS = 400       // ms — rapid swipe detection window

export interface DragState {
  deltaX: number
  progress: number        // 0–1, capped at 1 (Math.min(|deltaX| / THRESHOLD, 1))
  direction: 'left' | 'right' | null
  phase: 'idle' | 'dragging' | 'committing' | 'cancelling'
  thresholdCrossed: boolean
  fastMode: boolean
}

// Typed for HTMLDivElement so spreading onto <div> passes TypeScript strict mode
export interface SwipeHandlers {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void
  onTransitionEnd: (e: React.TransitionEvent<HTMLDivElement>) => void
}

interface UseSwipeGestureOptions {
  onCommit: (direction: 'left' | 'right') => void
  onAnimationComplete: () => void
  isAnswerVisible: boolean
  disabled: boolean
}

const REST: DragState = {
  deltaX: 0,
  progress: 0,
  direction: null,
  phase: 'idle',
  thresholdCrossed: false,
  fastMode: false,
}

export function useSwipeGesture({
  onCommit,
  onAnimationComplete,
  isAnswerVisible,
  disabled,
}: UseSwipeGestureOptions): {
  dragState: DragState
  handlers: SwipeHandlers
  triggerKeySwipe: (direction: 'left' | 'right') => void
} {
  const [dragState, setDragState] = useState<DragState>(REST)

  const originXRef = useRef(0)
  const startTimeRef = useRef(0)
  const lastCommitTimeRef = useRef(0)
  const phaseRef = useRef<DragState['phase']>('idle')

  // Keep callback refs current — avoids stale closures without re-running effects
  const onCommitRef = useRef(onCommit)
  const onAnimationCompleteRef = useRef(onAnimationComplete)
  const isAnswerVisibleRef = useRef(isAnswerVisible)
  onCommitRef.current = onCommit
  onAnimationCompleteRef.current = onAnimationComplete
  isAnswerVisibleRef.current = isAnswerVisible

  const snapBack = useCallback(() => {
    phaseRef.current = 'cancelling'
    setDragState({ ...REST, phase: 'cancelling' })
  }, [])

  const commit = useCallback((direction: 'left' | 'right') => {
    const now = Date.now()
    const fastMode = now - lastCommitTimeRef.current < FAST_MODE_MS
    lastCommitTimeRef.current = now
    phaseRef.current = 'committing'

    // onCommit fires BEFORE animation — for data persistence only.
    // Consumers MUST NOT call card-advance (next()/setIndex) here.
    // Card advance belongs in onAnimationComplete.
    onCommitRef.current(direction)

    setDragState({
      deltaX: 0,
      progress: 0,
      direction,
      phase: 'committing',
      thresholdCrossed: false,
      fastMode,
    })
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || phaseRef.current !== 'idle') return
      if (!e.isPrimary) return   // ignore secondary touch points

      e.currentTarget.setPointerCapture(e.pointerId)
      originXRef.current = e.clientX
      startTimeRef.current = Date.now()
      phaseRef.current = 'dragging'
      setDragState({ ...REST, phase: 'dragging' })
    },
    [disabled],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phaseRef.current !== 'dragging') return

      const rawDelta = e.clientX - originXRef.current
      const maxDrag = isAnswerVisibleRef.current ? MAX_DRAG : RESIST_MAX
      const deltaX = Math.sign(rawDelta) * Math.min(Math.abs(rawDelta), maxDrag)
      const progress = Math.min(Math.abs(deltaX) / THRESHOLD, 1)
      const direction: 'left' | 'right' | null =
        deltaX > 0 ? 'right' : deltaX < 0 ? 'left' : null
      const thresholdCrossed =
        isAnswerVisibleRef.current && Math.abs(deltaX) >= THRESHOLD

      setDragState({ deltaX, progress, direction, phase: 'dragging', thresholdCrossed, fastMode: false })
    },
    [],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (phaseRef.current !== 'dragging') return

      const rawDelta = e.clientX - originXRef.current
      const elapsed = Date.now() - startTimeRef.current
      const velocity = elapsed > 0 ? Math.abs(rawDelta) / elapsed : 0
      const direction: 'left' | 'right' = rawDelta >= 0 ? 'right' : 'left'
      const velocityAssist =
        velocity > VELOCITY_THRESHOLD && Math.abs(rawDelta) > VELOCITY_MIN_DELTA
      const shouldCommit =
        isAnswerVisibleRef.current &&
        (Math.abs(rawDelta) >= THRESHOLD || velocityAssist)

      if (shouldCommit) {
        commit(direction)
      } else {
        snapBack()
      }
    },
    [commit, snapBack],
  )

  const handlePointerCancel = useCallback(
    (_e: React.PointerEvent<HTMLDivElement>) => {
      if (phaseRef.current === 'dragging') snapBack()
    },
    [snapBack],
  )

  // transitionend handler:
  // 1. Check e.target === e.currentTarget — ignore events bubbled from children
  //    (e.g. the .flashcard 3D flip transition that also transitions 'transform')
  // 2. Filter e.propertyName === 'transform' — avoid firing multiple times per transition
  const handleTransitionEnd = useCallback(
    (e: React.TransitionEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return  // ignore child transitions (card flip, etc.)
      if (e.propertyName !== 'transform') return
      if (phaseRef.current === 'committing') {
        // Card advance logic fires here — after the fly-off animation completes
        onAnimationCompleteRef.current()
      }
      phaseRef.current = 'idle'
      setDragState(REST)
    },
    [],
  )

  // triggerKeySwipe — Phase 2 keyboard listener will call this.
  // Available as a stub in Phase 1.
  const triggerKeySwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (disabled || phaseRef.current !== 'idle' || !isAnswerVisibleRef.current)
        return
      commit(direction)
    },
    [disabled, commit],
  )

  // Window blur: snap back if pointer leaves window mid-drag
  useEffect(() => {
    const handleBlur = () => {
      if (phaseRef.current === 'dragging') snapBack()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [snapBack])

  const handlers: SwipeHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onTransitionEnd: handleTransitionEnd,
  }

  return { dragState, handlers, triggerKeySwipe }
}
