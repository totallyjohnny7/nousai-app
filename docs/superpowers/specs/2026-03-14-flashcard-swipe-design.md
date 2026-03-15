# Flashcard Swipe System — Design Document

**Date:** 2026-03-14
**Feature ID:** FSS
**Status:** Approved for implementation
**Affects:** Flashcards.tsx (FlashcardReview), SpacedRepMode.tsx
**Devices:** Mobile (touch) + Desktop (mouse + keyboard)

---

## Overview

Replace the existing basic swipe-to-navigate gesture in `Flashcards.tsx` with a full swipe-to-rate system across both review modes. Swipe RIGHT = Good (grade 3), Swipe LEFT = Again (grade 1). The existing 4-button rating system (Again/Hard/Good/Easy) remains available — swipe is a fast-lane shortcut for the two most common ratings.

---

## Architecture

Three new files, two existing files modified, one existing file amended:

```
src/
  hooks/
    useSwipeGesture.ts           -- gesture detection + state
  components/flashcards/
    SwipeableCard.tsx             -- visual layer (overlays, rotation, shadow, ghost stack)
    SwipeableCard.css             -- component-scoped animation classes (plain CSS import)
  index.css                      -- amended: swipe CSS custom properties added to :root
  pages/
    Flashcards.tsx                -- modified: wrap card in SwipeableCard, remove old swipe
  components/learn/
    SpacedRepMode.tsx             -- modified: wrap card in SwipeableCard
```

### `useSwipeGesture` hook

Owns all stateful gesture logic. Exposes:

```ts
interface UseSwipeGestureOptions {
  onCommit: (direction: 'left' | 'right') => void
  onAnimationComplete: () => void
  isAnswerVisible: boolean
  disabled: boolean
}

interface DragState {
  deltaX: number
  progress: number       // 0-1, capped
  direction: 'left' | 'right' | null
  phase: 'idle' | 'dragging' | 'committing' | 'cancelling'
  thresholdCrossed: boolean
}

const {
  dragState,                                      // read by SwipeableCard for visual rendering
  handlers,                                       // { onPointerDown } -- spread onto SwipeableCard
  triggerKeySwipe,                                // (direction: 'left' | 'right') => void
} = useSwipeGesture(options)
```

**Usage pattern:**
```tsx
const { dragState, handlers, triggerKeySwipe } = useSwipeGesture({ ... })

<SwipeableCard dragState={dragState} {...handlers}>
  {/* existing card content */}
</SwipeableCard>
```
`dragState` is passed as a prop. `handlers` spreads `onPointerDown` onto `SwipeableCard`'s root element. `SwipeableCard` does not call `useSwipeGesture` internally.

**`isAnswerVisible`:** Consumer-agnostic prop name. Pass `flipped` in Flashcards.tsx, `showAnswer` in SpacedRepMode.tsx. Semantics: "has the user seen the answer?" Both are equivalent for the hook's purposes.

**`disabled` behavior:** When `disabled=true`, the hook attaches no event listeners and always returns `dragState` at rest (`phase: 'idle'`, `deltaX: 0`). `SwipeableCard` renders children without any transform. Use `disabled` during the overview/done phases of SpacedRepMode or when the deck is empty.

**`triggerKeySwipe(direction: 'left' | 'right'): void`** — programmatically triggers a swipe commit. Plays the fly-off animation and calls `onCommit(direction)` followed by `onAnimationComplete()` on the same timing contract as a real gesture commit. Used by the Phase 2 keyboard listener.

**Event API:** Uses Pointer Events (`pointerdown` / `pointermove` / `pointerup`) with `setPointerCapture`. This unifies touch + mouse in one code path and prevents dual-firing on hybrid touch/mouse devices. No raw `touchstart`/`mousedown` listeners needed.

**Responsibilities:**
- Pointer events: `pointerdown` / `pointermove` / `pointerup` + `setPointerCapture`
- deltaX, progress (0-1), direction, velocity
- 120px threshold commit + velocity assist (>0.5 px/ms at >60px)
- `isAnimating` guard — via `useRef`, not React state (no re-render on phase change)
- Swipe-before-flip resistance: cap deltaX at 30px when `isAnswerVisible=false`
- `fastMode` detection (see below)
- Window blur snap-back
- Haptic feedback at threshold (`navigator.vibrate`) — **Phase 2**
- ArrowKey + 1-4 keyboard listeners — **Phase 2**

**`fastMode`:** Set when the time between successive `onCommit` calls is <400ms. In fastMode, fly-off uses `--anim-fast-flyoff` (0.18s) instead of `--anim-flyoff-duration` (0.32s). Entrance animation is skipped. No other behavior changes.

---

### `SwipeableCard` component

Pure visual component. Receives `dragState` and `onPointerDown` handler from parent. Does not call `useSwipeGesture` internally.

**DOM nesting for Flashcards.tsx (critical — two transform contexts must not collide):**

```
<SwipeableCard>                      <- swipe transform applied here (translateX + rotate)
  <div class="flashcard-container">  <- existing element, perspective: 1000px preserved as-is
    <div class="flashcard [flipped]"> <- existing 3D flip, rotateY unchanged
      <div class="flashcard-front"> ... </div>
      <div class="flashcard-back">  ... </div>
    </div>
  </div>
  <div class="swipe-overlay-right" />  <- sibling to flashcard-container, not child
  <div class="swipe-overlay-left" />
  {/* ghost cards (Phase 2) */}
</SwipeableCard>
```

`SwipeableCard`'s `transform` is on the outer wrapper only. The `.flashcard-container`'s `perspective` and `.flashcard`'s `rotateY` are on different DOM elements — no collision.

For `SpacedRepMode.tsx`: `SwipeableCard` wraps the plain card `<div>` directly. No 3D flip complexity.

**Visual rendering driven by `dragState.progress`:**
- Outer wrapper: `transform: translateX(${deltaX}px) rotate(${deltaX * 0.07}deg)`, clamped to `--swipe-rotate-max`
- `transform-origin: center 150%` (bottom-center pivot)
- Right overlay: `background: rgba(var(--overlay-color-right), ${progress * 0.85})`
- Right label "CHECK KNOW IT": `opacity: Math.max(0, (progress - 0.2) / 0.8)`
- Left overlay: `background: rgba(var(--overlay-color-left), ${progress * 0.85})`
- Left label "X REVIEW": same label opacity formula
- Shadow: `0 calc(8px + ${progress * 24}px) calc(16px + ${progress * 32}px) rgba(0,0,0,calc(0.15 + ${progress * 0.25}))`
- Animation classes: `.swipe-committing` / `.swipe-cancelling` / `.swipe-keyboard`
  - All prefixed `.swipe-*` to avoid collision with existing `.flashcard-*` classes in `App.css`
- Ghost card stack (Phase 2): 2 ghost layers behind outer wrapper

---

### CSS Strategy

**CSS custom properties** go in `src/index.css` `:root` per project convention (`CLAUDE.md`).

**Animation classes** go in `src/components/flashcards/SwipeableCard.css` — plain CSS file, imported directly in `SwipeableCard.tsx`. No CSS Modules (no Vite config for them).

All class names in `SwipeableCard.css` prefixed `.swipe-*` to avoid collision with existing `.flashcard-*` in `App.css` (lines ~132-150).

CSS custom properties added to `src/index.css` `:root`:

```css
/* Swipe gesture system */
--swipe-threshold:          120px;
--swipe-max-drag:           200px;
--swipe-velocity-threshold: 0.5;
--swipe-intent-threshold:   8px;
--swipe-rotate-multiplier:  0.07;
--swipe-rotate-max:         20deg;
--swipe-pivot:              center 150%;
--overlay-max-opacity:      0.85;
--overlay-label-start:      0.2;
--overlay-color-right:      34, 197, 94;
--overlay-color-left:       239, 68, 68;
--anim-flyoff-duration:     0.32s;
--anim-snapback-duration:   0.15s;
--anim-entrance-duration:   0.28s;
--anim-fast-flyoff:         0.18s;
--anim-fast-threshold:      400ms;
--ghost-1-scale:            0.95;
--ghost-1-offset:           6px;
--ghost-2-scale:            0.90;
--ghost-2-offset:           12px;
--progress-bar-height:      3px;
--progress-color-start:     #22c55e;
--progress-color-end:       #16a34a;
--undo-window:              2000ms;
```

---

## Data Flow & Timing Contract

```
pointerdown
  -> setPointerCapture, originX captured, phase = 'dragging'

pointermove
  -> deltaX updated in real time
  -> SwipeableCard re-renders: transform + overlay + shadow

pointerup
  -> |deltaX| >= 120px OR velocity assist:
       onCommit(direction) called IMMEDIATELY  <- rating saved before animation
       phase = 'committing', fly-off animation starts (0.32s or 0.18s fastMode)
       onTransitionEnd -> onAnimationComplete() called -> consumer advances card
       phase = 'idle'
  -> else:
       phase = 'cancelling', spring-back animation (0.15s)
       onTransitionEnd -> phase = 'idle'
```

**Key invariant:** `onCommit` fires before animation. Rating is never lost if user navigates away mid-animation.

**`isAnimating` guard:** `phase !== 'idle'` is checked via `useRef` — React state is not used for phase tracking so phase changes don't cause re-renders. New gesture input is silently dropped while animating.

---

## Integration with Existing Components

### Flashcards.tsx

```ts
// Existing state/functions -- unchanged
const [flipped, setFlipped] = useState(false)
const [showConfidence, setShowConfidence] = useState(false)
function rateConfidence(rating: number) { ... }  // internally calls next(), setFlipped(false), setShowConfidence(false)

// Swipe adapters
const onSwipeCommit = (direction: 'left' | 'right') => {
  rateConfidence(direction === 'right' ? 3 : 1)
  // rateConfidence handles all cleanup: calls next(), setFlipped(false), setShowConfidence(false)
  // Swipe deliberately bypasses the showConfidence UI gate -- that is the intended behavior
}

const onSwipeAnimationComplete = () => {
  // No-op: rateConfidence already called next() which resets flipped + showConfidence
  // If next() does NOT reset flipped, add: setFlipped(false); setShowConfidence(false) here
  // IMPLEMENTATION NOTE: verify next() resets flipped before shipping Phase 1
}

const { dragState, handlers, triggerKeySwipe } = useSwipeGesture({
  onCommit: onSwipeCommit,
  onAnimationComplete: onSwipeAnimationComplete,
  isAnswerVisible: flipped,
  disabled: false,
})
```

**`showConfidence` gate:** `rateConfidence` does NOT guard on `showConfidence` as a precondition (confirmed: it calls `setShowConfidence(false)` to clean up, not to check). Swipe can call it unconditionally.

**`flipped` reset:** `next()` inside `rateConfidence` must reset `flipped` to `false`. Verify during implementation. If it does not, `onAnimationComplete` must call `setFlipped(false)` explicitly.

Remove existing touchstart/touchend swipe code (~lines 1200-1230 of Flashcards.tsx).

---

### SpacedRepMode.tsx

```ts
// Existing state/functions -- unchanged
const [showAnswer, setShowAnswer] = useState(false)
function handleGrade(grade: Grade) { ... }  // calls setShowAnswer(false), setCurrentIdx(prev => prev + 1) synchronously

// Swipe adapters
const onSwipeCommit = (direction: 'left' | 'right') => {
  handleGrade(direction === 'right' ? 3 : 1)
  // handleGrade advances card and resets showAnswer synchronously
}

const onSwipeAnimationComplete = () => {
  // STRICT NO-OP. Do not read or write component state here.
  // handleGrade has already advanced currentIdx synchronously at onCommit time.
  // Any state read here will be stale (pointing to the already-advanced card).
}

const { dragState, handlers, triggerKeySwipe } = useSwipeGesture({
  onCommit: onSwipeCommit,
  onAnimationComplete: onSwipeAnimationComplete,
  isAnswerVisible: showAnswer,
  disabled: phase !== 'review',  // disable during overview/done phases
})
```

---

### Rating Mapping

| Action | Grade | Label |
|--------|-------|-------|
| Swipe right | 3 (Good) | CHECK KNOW IT |
| Swipe left | 1 (Again) | X REVIEW |
| Hard button (tap) | 2 | unchanged |
| Easy button (tap) | 4 | unchanged |

---

## Keyboard Shortcuts

### Phase 1
No keyboard shortcuts shipped in Phase 1. `triggerKeySwipe` is part of the hook API (built in Phase 1) but the internal ArrowKey listener is not added until Phase 2.

### Phase 2

**Conflict resolution with existing shortcuts (`fc_next`/`fc_prev`, `fc_conf1-4`):**

The ArrowKey listener inside `useSwipeGesture` checks `isAnswerVisible` before consuming the event:

| Key | `isAnswerVisible` | Behavior |
|-----|-------------------|----------|
| ArrowRight | `true` | `stopPropagation()`, trigger swipe right (good) |
| ArrowRight | `false` | propagate, existing `fc_next` fires |
| ArrowLeft | `true` | `stopPropagation()`, trigger swipe left (again) |
| ArrowLeft | `false` | propagate, existing `fc_prev` fires |
| `1`-`4` | `true` | `stopPropagation()`, direct grade submission |
| `1`-`4` | `false` | ignored (no action, no propagation) |
| `Space` | any | unchanged, stays in each component |

This matches the existing pattern in Flashcards.tsx where `fc_conf1-4` already guards on `flipped`.

**Keyboard swipe animation:**
- Phase 1 (0.08s ease-out): card tilts 20px + 4deg in direction, overlay fades to 40%
- Phase 2 (0.28s fly-off easing): card flies to ±160vw

**Hint bar:** First review session only. Shows: "< Again | Space: Flip | > Know It | 1-4: Rate". Dismissed on first swipe or keypress. localStorage flag `nousai-swipe-hint-shown`.

---

## Ghost Card Stack (Phase 2)

```
Layer 0 (active):  z-index: 30  scale(1.00)  translateY(0px)
Layer 1 (ghost 1): z-index: 20  scale(0.95)  translateY(6px)
Layer 2 (ghost 2): z-index: 10  scale(0.90)  translateY(12px)
```

**During drag** (anticipation):
- Ghost 1: `scale(0.95 + progress * 0.05)` / `translateY(6px - progress * 6px)`
- Ghost 2: `scale(0.90 + progress * 0.05)` / `translateY(12px - progress * 6px)`

**On commit:** ghosts promote up simultaneously with fly-off (0.28s `cubic-bezier(0.22, 1, 0.36, 1)`).

**Stack rendering rules:**
- 0 cards: no ghosts, show completion state
- 1 card: no ghosts
- 2 cards: 1 ghost
- 3+ cards: 2 ghosts

---

## Animations

| Animation | Duration | Easing |
|-----------|----------|--------|
| Spring-back | 0.15s | `cubic-bezier(0.34, 1.56, 0.64, 1)` |
| Fly-off | 0.32s | `cubic-bezier(0.55, 0, 1, 0.45)` |
| Card entrance | 0.28s | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Fast fly-off | 0.18s | same as fly-off |
| Keyboard phase 1 | 0.08s | ease-out |
| Keyboard phase 2 | 0.28s | same as fly-off |
| Ghost promotion | 0.28s | `cubic-bezier(0.22, 1, 0.36, 1)` |

Fly-off targets: `translateX(±160vw) rotate(±28deg) opacity(0)`

Entrance: starts at `translateY(20px) scale(0.96) opacity(0)`, animates to rest.

`prefers-reduced-motion`: disable all transforms and transitions. Overlays (color + label) still function. Ratings still submit correctly.

---

## Session Experience (Phase 3)

**Progress bar:** 3px bar at top of review container. `width: cardsReviewed/total * 100%`. Green gradient. Updates after each `onAnimationComplete`.

**Card counter:** Top-right "12 / 50". Tap to show "38 remaining".

**Mini result stream:** Bottom icons. Swipe right -> green checkmark slides in from right, fades (0.6s total). Swipe left -> red X from left. Max 5 icons visible.

**Completion state:** Rises from stack after last card. Shows: Know It count, Review count, Accuracy %, Time, XP Earned. Buttons: [Review Again] [Back to Deck].

**Undo toast:** 2s window after each swipe. "Marked as [Know It/Review] -- Undo". Tap -> reverse rating + card slides back in from the direction it left. localStorage key `nousai-undo-last`.

**Session resume:** On return to incomplete session -> "You reviewed X/Y cards. Continue where you left off?" [Continue] [Start Over].

**Background hint zones:** Faint red (left) + green (right) gradients behind card stack. `opacity: 0.08` always visible. Teaches swipe direction before first use.

---

## Edge Cases & Guards

| Case | Behavior |
|------|----------|
| Swipe before flip | deltaX capped 30px, rubber-band back, no overlay, pulse hint on flip button |
| Spam swipe during animation | `isAnimating` guard (useRef) blocks all input until `onTransitionEnd` |
| Rapid swipes (<400ms) | fastMode: shorter fly-off (0.18s), skip entrance animation |
| Multi-touch / multi-pointer | Ignore if >1 pointer active |
| Touch drifts >80px vertically | Cancel, snap back |
| Window/pointer blur during drag | Snap back |
| Horizontal scroll conflict | First 12px don't `preventDefault`, lock axis after |
| Empty deck (0 cards) | Skip to completion state, `disabled=true` |
| Single card | No ghost cards |
| `prefers-reduced-motion` | All motion disabled, full functionality retained |
| `showConfidence` gate (Flashcards.tsx) | Swipe bypasses intentionally; `rateConfidence` does not guard on it |
| ArrowKey conflict | Resolved by `isAnswerVisible` check -- navigate pre-flip, rate post-flip |
| SpacedRepMode state advance | `onAnimationComplete` is strict no-op; `handleGrade` already advanced synchronously |

---

## Implementation Phases

### Phase 1 -- Core (ship first)
- `useSwipeGesture` hook: Pointer Events, deltaX, threshold, velocity assist, `isAnimating` guard, flip resistance, `onAnimationComplete`, fastMode, disabled, `triggerKeySwipe` stub
- `SwipeableCard` component: DOM nesting (outer wrapper, overlays as siblings), transform, shadow, overlays
- `.swipe-committing` / `.swipe-cancelling` / `.swipe-keyboard` animation classes in `SwipeableCard.css`
- CSS custom properties added to `src/index.css`
- Wire into `Flashcards.tsx`: remove touchstart/touchend swipe code, add adapters, verify `next()` resets `flipped`
- Wire into `SpacedRepMode.tsx`: add adapters, `disabled={phase !== 'review'}`
- No keyboard shortcuts

### Phase 2 -- Keyboard + Stack + Polish
- ArrowKey + 1-4 listeners in hook with `isAnswerVisible` guard + `stopPropagation`
- `triggerKeySwipe` implementation (abbreviated 2-phase animation)
- Ghost card stack (2 layers, drag anticipation, promotion on commit)
- Fast-rate mode finalization (timing + animation wiring)
- Haptic feedback at threshold (`navigator.vibrate`)
- Keyboard hint bar (first session, `nousai-swipe-hint-shown` localStorage flag)

### Phase 3 -- Session Experience
- Progress bar + card counter
- Mini result stream (bottom icons)
- Completion state card
- Undo toast + reverse slide-in animation
- Session resume prompt
- `prefers-reduced-motion` media query support
- Background hint zones (faint left/right tints)

---

## Files Changed Summary

| File | Change |
|------|--------|
| `src/hooks/useSwipeGesture.ts` | New -- gesture hook |
| `src/components/flashcards/SwipeableCard.tsx` | New -- visual wrapper |
| `src/components/flashcards/SwipeableCard.css` | New -- `.swipe-*` animation classes (plain CSS import) |
| `src/index.css` | Amended -- swipe CSS custom properties added to `:root` |
| `src/pages/Flashcards.tsx` | Modified -- wrap card, remove old swipe (~lines 1200-1230), add adapters |
| `src/components/learn/SpacedRepMode.tsx` | Modified -- wrap card, add adapters, `disabled` prop |
