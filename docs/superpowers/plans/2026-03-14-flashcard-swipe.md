# Flashcard Swipe System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full swipe-to-rate gestures to both flashcard review modes (Flashcards.tsx + SpacedRepMode.tsx), where swipe right = Good and swipe left = Again, with fly-off animations and color overlays.

**Architecture:** A shared `useSwipeGesture` hook handles Pointer Events and phase state. A `SwipeableCard` visual wrapper receives `dragState` + `handlers` as props and renders overlays + animation classes. Both review components split their rating logic: FSRS data is saved in `onCommit` (before animation), card advance is called in `onAnimationComplete` (after fly-off completes) to prevent mid-animation card swaps.

**Tech Stack:** React 19, TypeScript 5.9 strict, Vite 7, plain CSS (no CSS Modules), Pointer Events API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-14-flashcard-swipe-design.md`

**Verification:** `npm run build` (TypeScript strict + Vite bundle). No unit test framework.

**Deploy:** `cd NousAI-App && npm run build && vercel --prod --yes` then clear PWA cache.

---

## Chunk 1: Foundation — Hook + Component + CSS

### Task 1: Add swipe CSS custom properties to `src/index.css`

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1.1: Find the `:root` block in `src/index.css` and add swipe vars before its closing `}`**

These vars are read by `SwipeableCard.css` for animation durations. The JS hook uses hardcoded constants (same values) and does NOT read these via `getComputedStyle`.

```css
  /* Swipe gesture system */
  --swipe-pivot: center 150%;
  --overlay-color-right: 34, 197, 94;
  --overlay-color-left: 239, 68, 68;
  --anim-flyoff-duration: 0.32s;
  --anim-flyoff-fast: 0.18s;
  --anim-snapback-duration: 0.15s;
```

- [ ] **Step 1.2: Verify build passes**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | tail -3
```

Expected: `✓ built in` with no errors.

---

### Task 2: Create `src/components/flashcards/` directory and `SwipeableCard.css`

**Files:**
- Create: `src/components/flashcards/SwipeableCard.css`

All classes prefixed `.swipe-` to avoid collision with existing `.flashcard-*` classes in `App.css`.

- [ ] **Step 2.1: Create directory**

```bash
mkdir -p /c/Users/johnn/Desktop/NousAI-App/src/components/flashcards
```

- [ ] **Step 2.2: Create `src/components/flashcards/SwipeableCard.css`**

```css
/* SwipeableCard — swipe gesture visual layer
   Prefixed .swipe-* to avoid collision with .flashcard-* in App.css */

.swipe-wrapper {
  position: relative;
  touch-action: pan-y;        /* allow vertical scroll; JS handles horizontal */
  user-select: none;
  transform-origin: var(--swipe-pivot);
  will-change: transform;
  cursor: grab;
}

.swipe-wrapper:active {
  cursor: grabbing;
}

/* Overlays: always in DOM, opacity driven by inline style from JS */
.swipe-overlay {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition: opacity 0.12s ease;
  display: flex;
  align-items: flex-start;
  padding: 20px 24px;
}

.swipe-overlay-right {
  background: rgba(var(--overlay-color-right), 1);
  justify-content: flex-start;
}

.swipe-overlay-left {
  background: rgba(var(--overlay-color-left), 1);
  justify-content: flex-end;
}

/* Overlay label: styled badge */
.swipe-label {
  font-size: 22px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 0.08em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 3px solid rgba(255, 255, 255, 0.85);
  border-radius: 8px;
  padding: 6px 14px;
  line-height: 1;
  transition: opacity 0.1s ease;
}

.swipe-label-right {
  transform: rotate(-12deg);
}

.swipe-label-left {
  transform: rotate(12deg);
}

/* Spring-back: cancel animation — CSS class overrides inline transform */
.swipe-cancelling {
  transition:
    transform var(--anim-snapback-duration) cubic-bezier(0.34, 1.56, 0.64, 1),
    box-shadow var(--anim-snapback-duration) ease;
  transform: translateX(0px) rotate(0deg) !important;
}

/* Fly-off: commit animation — direction class applied alongside */
.swipe-committing {
  pointer-events: none;
  transition:
    transform var(--anim-flyoff-duration) cubic-bezier(0.55, 0, 1, 0.45),
    opacity var(--anim-flyoff-duration) ease-out;
  opacity: 0 !important;
}

.swipe-committing.swipe-right {
  transform: translateX(160vw) rotate(28deg) !important;
}

.swipe-committing.swipe-left {
  transform: translateX(-160vw) rotate(-28deg) !important;
}

/* Fast mode: shorter fly-off */
.swipe-committing.swipe-fast {
  transition-duration: var(--anim-flyoff-fast) !important;
}

/* Reduced motion: disable all animation, keep overlays */
@media (prefers-reduced-motion: reduce) {
  .swipe-wrapper,
  .swipe-cancelling,
  .swipe-committing {
    transition: none !important;
    animation: none !important;
  }
  .swipe-committing {
    transform: none !important;
    opacity: 0 !important;
  }
}
```

- [ ] **Step 2.3: Verify file exists**

```bash
ls /c/Users/johnn/Desktop/NousAI-App/src/components/flashcards/
```

Expected: `SwipeableCard.css`

---

### Task 3: Create `src/hooks/useSwipeGesture.ts`

**Files:**
- Create: `src/hooks/useSwipeGesture.ts`

Key design notes:
- Uses Pointer Events (`pointerdown`/`pointermove`/`pointerup` + `setPointerCapture`) — unifies touch and mouse, prevents dual-firing on hybrid devices
- `phaseRef` (useRef) tracks phase without causing re-renders on phase change
- `onCommit` fires immediately on gesture release — consumers MUST NOT call card advance here (only persist data)
- `onAnimationComplete` fires after `transitionend` on the wrapper element — card advance logic goes here
- `transitionend` handler checks `e.target === e.currentTarget` to ignore events bubbled from child elements (e.g. the 3D card-flip transition inside `.flashcard`)

- [ ] **Step 3.1: Create `src/hooks/` directory**

```bash
mkdir -p /c/Users/johnn/Desktop/NousAI-App/src/hooks
```

- [ ] **Step 3.2: Create `src/hooks/useSwipeGesture.ts`**

```typescript
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
```

- [ ] **Step 3.3: Run build — confirm zero TypeScript errors**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: `✓ built in` — no `error TS` lines.

---

### Task 4: Create `src/components/flashcards/SwipeableCard.tsx`

**Files:**
- Create: `src/components/flashcards/SwipeableCard.tsx`

Pure visual component. Receives `dragState` and `handlers` as props — does NOT call `useSwipeGesture` internally.

Rendering rules:
- Inline `transform` only during `phase === 'dragging'`; CSS animation classes handle `committing`/`cancelling`
- Overlay opacity driven by `progress` during drag; bumped to max (0.85) during `committing` so overlay stays visible during fly-off
- `e.target !== e.currentTarget` guard in `handleTransitionEnd` (in the hook) prevents child `transitionend` events from firing `onAnimationComplete` — but SwipeableCard itself also needs the `onTransitionEnd` handler on its root element so the event is received

- [ ] **Step 4.1: Create `src/components/flashcards/SwipeableCard.tsx`**

```tsx
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
```

- [ ] **Step 4.2: Run build — confirm zero TypeScript errors**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | grep -E "error TS|✓ built"
```

Expected: `✓ built in` — no `error TS` lines.

---

## Chunk 2: Integration + Build + Deploy

### Task 5: Integrate SwipeableCard into `Flashcards.tsx`

**Files:**
- Modify: `src/pages/Flashcards.tsx`

**IMPORTANT — Timing contract:** `rateConfidence` calls `next()` synchronously (with a 100ms setTimeout). If called from `onCommit` (before animation), the card content changes mid-fly-off, causing a visible flash. The integration must split the logic:
- `onCommit`: save FSRS data, update confidence state — but do NOT call `next()`
- `onAnimationComplete`: call `next()` — advances card after fly-off completes

The FSRS save logic is duplicated from `rateConfidence` — this is intentional. The `rateConfidence` function is left untouched (used by the tap-to-rate buttons).

- [ ] **Step 5.1: Add imports at the top of `Flashcards.tsx`**

Find the last `import` statement. Add after it:

```tsx
import { useSwipeGesture } from '../hooks/useSwipeGesture'
import { SwipeableCard } from '../components/flashcards/SwipeableCard'
```

- [ ] **Step 5.2: Remove the old touch swipe `useEffect` and `touchStartRef`**

In `FlashcardReview`, remove:

1. The `touchStartRef` declaration at line ~1193:
   ```tsx
   const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null)
   ```

2. The entire `// Touch swipe gestures` `useEffect` block (lines ~1246–1273):
   ```tsx
   // Touch swipe gestures
   useEffect(() => {
     const el = cardContainerRef.current
     ...
   }, [next, prev])
   ```

- [ ] **Step 5.3: Add swipe hook and adapters inside `FlashcardReview`, after `rateConfidence`**

Find the closing of `rateConfidence`:
```tsx
  }, [index, next, courseId, deck])
```

Add immediately after:

```tsx
  // Swipe-to-rate adapters
  // Split into onCommit (save data) + onAnimationComplete (advance card)
  // to prevent card content changing mid fly-off animation.
  const onSwipeCommit = useCallback((direction: 'left' | 'right') => {
    const rating = direction === 'right' ? 3 : 1
    setConfidenceRatings(prev => ({ ...prev, [index]: rating }))
    setShowConfidence(false)
    const card = deck[index]
    if (card) {
      const key = fcCardKey(courseId, card)
      const allFSRS = loadFcFSRS()
      const existing = allFSRS[key] ?? initFcFSRSCard(key, card)
      saveFcFSRS({ ...allFSRS, [key]: reviewCard(existing, rating as Grade) })
      const cardCourseId = (card as FlashcardItem & { courseId?: string }).courseId ?? courseId
      onCardReviewed?.(cardCourseId)
    }
  }, [index, deck, courseId, onCardReviewed])

  const { dragState, handlers: swipeHandlers } = useSwipeGesture({
    onCommit: onSwipeCommit,
    onAnimationComplete: next,   // advance card only after fly-off completes
    isAnswerVisible: flipped,
    disabled: false,
  })
```

**Note:** `fcCardKey`, `loadFcFSRS`, `initFcFSRSCard`, `saveFcFSRS`, `reviewCard`, `Grade`, `FlashcardItem` are already imported/used elsewhere in `Flashcards.tsx` — no new imports needed for these.

- [ ] **Step 5.4: Wrap the flashcard-container in SwipeableCard**

Find the flashcard JSX (line ~1378):
```tsx
      <div ref={cardContainerRef} className="flashcard-container" onClick={() => { setFlipped(f => !f); if (!flipped) setShowConfidence(true); }}>
        <div className={`flashcard${flipped ? ' flipped' : ''}`}>
          <div className="flashcard-face flashcard-front">
```

Wrap the entire `flashcard-container` div in `SwipeableCard`. Add `<SwipeableCard>` before the div and `</SwipeableCard>` after the `</div>` that closes `.flashcard-container`:

```tsx
      <SwipeableCard
        dragState={dragState}
        handlers={swipeHandlers}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      >
        <div ref={cardContainerRef} className="flashcard-container" onClick={() => { setFlipped(f => !f); if (!flipped) setShowConfidence(true); }}>
          <div className={`flashcard${flipped ? ' flipped' : ''}`}>
            <div className="flashcard-face flashcard-front">
              ...
            </div>
            <div className="flashcard-face flashcard-back">
              ...
            </div>
          </div>
        </div>
      </SwipeableCard>
```

The closing `</SwipeableCard>` goes immediately after the closing `</div>` of `.flashcard-container` and before the `{/* Confidence rating */}` comment.

- [ ] **Step 5.5: Run build — confirm zero TypeScript errors**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | grep -E "error TS|✓ built"
```

If `error TS2345` on `onSwipeCommit` — check `useCallback` dependency array types match.
If `error TS2740` on `handlers` spread — confirm `SwipeHandlers` uses `React.PointerEvent<HTMLDivElement>` types.

---

### Task 6: Integrate SwipeableCard into `SpacedRepMode.tsx`

**Files:**
- Modify: `src/components/learn/SpacedRepMode.tsx`

**IMPORTANT — Hook placement:** The hook must be called at the top of the component body, before any conditional `return` statements. In SpacedRepMode, `if (phase === 'overview') { return ... }` appears at line ~220. Place the hook call between `handleGrade` (line ~218) and the first `if (phase === ...)` block.

**IMPORTANT — Timing contract:** Same as Flashcards.tsx. `handleGrade` calls `setCurrentIdx(prev => prev + 1)` synchronously. Call only the data-update part in `onCommit`, and advance card in `onAnimationComplete`.

- [ ] **Step 6.1: Add imports at the top of `SpacedRepMode.tsx`**

After the existing imports, add:

```tsx
import { useSwipeGesture } from '../../hooks/useSwipeGesture'
import { SwipeableCard } from '../flashcards/SwipeableCard'
```

- [ ] **Step 6.2: Add swipe hook inside `SpacedRepMode`, after `handleGrade` and BEFORE the first `if (phase === 'overview')` return**

Find `handleGrade`'s closing `}` (line ~218). Add immediately after, before line ~220 `if (phase === 'overview')`:

```tsx
  // Swipe-to-rate adapters for spaced rep mode.
  // onCommit: update card data only — do NOT advance currentIdx (prevents mid-animation swap).
  // onAnimationComplete: advance after fly-off completes.
  const pendingAdvanceRef = useRef<(() => void) | null>(null)

  const onSwipeCommit = useCallback((direction: 'left' | 'right') => {
    const grade = (direction === 'right' ? 3 : 1) as Grade
    const card = dueCards[currentIdx]
    if (!card) return
    const updated = reviewCard(card, grade)
    reviewedCardsRef.current.set(updated.key, updated)
    const newCards = cards.map(c => c.key === updated.key ? updated : c)
    setCards(newCards)
    setReviewed(prev => prev + 1)
    setShowAnswer(false)
    // Store the advance function to call after animation
    if (currentIdx + 1 >= dueCards.length) {
      pendingAdvanceRef.current = () => {
        setDueCards(getDueCards(newCards))
        setPhase('done')
        persistReviewed()
      }
    } else {
      pendingAdvanceRef.current = () => setCurrentIdx(prev => prev + 1)
    }
  }, [cards, currentIdx, dueCards, persistReviewed])

  const onSwipeAnimationComplete = useCallback(() => {
    pendingAdvanceRef.current?.()
    pendingAdvanceRef.current = null
  }, [])

  const { dragState, handlers: swipeHandlers } = useSwipeGesture({
    onCommit: onSwipeCommit,
    onAnimationComplete: onSwipeAnimationComplete,
    isAnswerVisible: showAnswer,
    disabled: phase !== 'review',
  })
```

**Note:** `getDueCards`, `reviewCard`, `Grade` are already imported in `SpacedRepMode.tsx`.

- [ ] **Step 6.3: Restructure the `phase === 'review'` JSX**

Find the `if (phase === 'review') { ... return (...) }` block (lines ~260–311).

Replace the card content area (lines ~276–308 — the question div, Show Answer button, answer div, and grade buttons) with the following. Keep the surrounding header (counter + badge) and progress bar unchanged:

```tsx
        {/* Swipeable card area — question always shown, answer shown after flip */}
        <SwipeableCard
          dragState={dragState}
          handlers={swipeHandlers}
          style={{ borderRadius: 8, marginBottom: 12 }}
        >
          <div style={{ ...cardStyle, background: 'var(--bg-primary)', minHeight: 100, textAlign: 'center', padding: 20, marginBottom: showAnswer ? 8 : 0 }}>
            <div className="text-xs text-muted mb-2">{card.topic}</div>
            <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.5 }}>{card.front}</div>
          </div>
          {showAnswer && (
            <div style={{ ...cardStyle, background: 'var(--accent-glow)', padding: 16, textAlign: 'center' }}>
              {/<[a-z][\s\S]*>/i.test(card.back)
                ? <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.back) }} />
                : <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.5 }}>{card.back}</div>}
            </div>
          )}
        </SwipeableCard>

        {/* Controls outside SwipeableCard — buttons remain tappable, not carried by swipe */}
        {!showAnswer ? (
          <button className="btn btn-secondary w-full" onClick={() => setShowAnswer(true)}>
            <Eye size={14} /> Show Answer
          </button>
        ) : (
          <>
            <div className="text-xs text-center text-muted mb-2">How well did you recall?</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
              {[
                { grade: 1 as Grade, label: 'Again', color: 'var(--red)' },
                { grade: 2 as Grade, label: 'Hard', color: 'var(--orange)' },
                { grade: 3 as Grade, label: 'Good', color: 'var(--green)' },
                { grade: 4 as Grade, label: 'Easy', color: 'var(--blue)' },
              ].map(g => (
                <button key={g.grade} className="btn btn-secondary btn-sm"
                  onClick={() => handleGrade(g.grade)}
                  style={{ fontSize: 11, padding: '8px 4px', color: g.color, borderColor: g.color }}>
                  {g.label}
                </button>
              ))}
            </div>
          </>
        )}
```

- [ ] **Step 6.4: Run build — confirm zero TypeScript errors**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1 | grep -E "error TS|✓ built"
```

Common TypeScript fixes:
- `useCallback` for `onAnimationComplete` inline — if TypeScript complains about hook rules, extract to a named callback
- `pendingAdvanceRef` type: `useRef<(() => void) | null>(null)` — confirm this is inside the component body, not inside a conditional

---

### Task 7: Final build verification

- [ ] **Step 7.1: Clean build**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build 2>&1
```

Expected: `✓ built in X.Xs` with no TypeScript errors and no Vite import warnings.

- [ ] **Step 7.2: Local preview smoke test**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run preview
```

Open the URL shown (usually `http://localhost:4173`). Verify:

**Flashcards page:**
- [ ] Open any flashcard deck — cards render normally
- [ ] Click card to flip — 3D flip animation still works
- [ ] Drag card right slightly and release — snaps back with spring
- [ ] Flip card, then drag right past 120px — green overlay appears, card flies off right, next card appears
- [ ] Flip card, then drag left past 120px — red overlay appears, card flies off left
- [ ] Tap the 4 confidence buttons — still works (not broken by SwipeableCard wrapper)
- [ ] Vertical page scroll works (not hijacked by swipe)

**Spaced Rep mode (LearnPage → Spaced Rep):**
- [ ] Cards render normally in review phase
- [ ] "Show Answer" button works
- [ ] Swipe right after showing answer — card flies off, next card / done state appears
- [ ] Grade buttons (Again/Hard/Good/Easy) still work

---

### Task 8: Deploy to production

- [ ] **Step 8.1: Deploy**

```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build && vercel --prod --yes
```

- [ ] **Step 8.2: Clear PWA cache after deploy**

Open https://nousai-app.vercel.app in browser DevTools console:

```js
navigator.serviceWorker.getRegistrations().then(r => r.forEach(x => x.unregister()));
caches.keys().then(k => k.forEach(x => caches.delete(x)));
```

Then hard-refresh (`Ctrl+Shift+R` / `Cmd+Shift+R`).

- [ ] **Step 8.3: Verify on production**

On https://nousai-app.vercel.app:
- [ ] Flashcards: flip card → swipe right → green overlay + fly-off
- [ ] Flashcards: flip card → swipe left → red overlay + fly-off
- [ ] SpacedRep: show answer → swipe to rate
- [ ] 4-button ratings still work in both modes
- [ ] Vertical scroll not hijacked on mobile
- [ ] Card 3D flip still works

---

## Quick Reference

**Files created:**
- `src/hooks/useSwipeGesture.ts`
- `src/components/flashcards/SwipeableCard.tsx`
- `src/components/flashcards/SwipeableCard.css`

**Files modified:**
- `src/index.css` — CSS vars added to `:root`
- `src/pages/Flashcards.tsx` — old swipe removed, SwipeableCard integrated, split save/advance pattern
- `src/components/learn/SpacedRepMode.tsx` — SwipeableCard integrated, hook before early returns, split save/advance pattern

**Deploy:**
```bash
cd /c/Users/johnn/Desktop/NousAI-App && npm run build && vercel --prod --yes
```
