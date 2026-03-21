# Omni Learning System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Omni Protocol (60-min auto-sequencer), Focus Lock, Efficiency Score, AI-enhanced card features (Dual Coding, Concrete Examples), and the Stream Deck plugin scaffold — then deploy.

**Architecture:** New features are React components in `src/components/learn/` following existing patterns. State via Zustand `updatePluginData()`. AI features use existing `callAI()`. The Omni Protocol is a new coordinator component that sequences existing learn modes (InterleaveMode, RSVPMode, PreTestMode, FeynmanMode) into a timed session. The Stream Deck plugin is a separate Node.js project in `nous-streamdeck-plugin/`.

**Tech Stack:** React 19, TypeScript 5.9, Zustand, Vite 7, FSRS, callAI(), @elgato/streamdeck SDK

**Existing infrastructure (DO NOT rebuild):**
- InterleaveMode, FeynmanMode, PreTestMode, RSVPMode, MnemonicsMode — already in `src/components/learn/`
- FSRS with `getDueInterleaved()` — interleaving built into scheduler
- `callAI()` with streaming and per-slot routing
- GamificationData with XP, streak, badges
- `ToolErrorBoundary` for crash isolation
- UnifiedLearnPage as central dispatcher for all learn modes

---

## Chunk 1: Omni Protocol + Focus Lock + Efficiency Score

### Task 1: Omni Protocol Component

The flagship feature. One button → 60-min auto-sequenced study session cycling through 7 phases.

**Files:**
- Create: `src/components/learn/OmniProtocol.tsx`
- Modify: `src/pages/UnifiedLearnPage.tsx` (add to tool list)

- [ ] **Step 1: Create OmniProtocol.tsx with phase sequencer**

The component manages a state machine that auto-advances through phases on timer:

```typescript
// src/components/learn/OmniProtocol.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '../../store';
import { getDueCards } from '../../utils/fsrs';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

type OmniPhase = 'prime' | 'chunk' | 'encode' | 'connect' | 'break' | 'test' | 'anchor' | 'report';

interface PhaseConfig {
  name: string;
  durationSec: number;
  description: string;
  icon: string;
}

const PHASES: Record<OmniPhase, PhaseConfig> = {
  prime:   { name: 'PRIME',   durationSec: 600,  description: 'Pre-test baseline', icon: '📋' },
  chunk:   { name: 'CHUNK',   durationSec: 300,  description: 'Pattern compression', icon: '🎼' },
  encode:  { name: 'ENCODE',  durationSec: 900,  description: 'Active recall + visualization', icon: '🧠' },
  connect: { name: 'CONNECT', durationSec: 600,  description: 'Cross-subject bridges', icon: '🌉' },
  break:   { name: 'BREAK',   durationSec: 300,  description: 'Rest — brain consolidates', icon: '☕' },
  test:    { name: 'TEST',    durationSec: 600,  description: 'Retrieval practice', icon: '🔍' },
  anchor:  { name: 'ANCHOR',  durationSec: 300,  description: 'Memory palace for hardest cards', icon: '🏛️' },
  report:  { name: 'REPORT',  durationSec: 300,  description: 'Session summary', icon: '📊' },
};

const PHASE_ORDER: OmniPhase[] = ['prime', 'chunk', 'encode', 'connect', 'break', 'test', 'anchor', 'report'];
```

The component renders:
- A phase indicator bar showing all 8 phases with current highlighted
- A countdown timer for current phase
- Phase-specific content area (delegates to existing learn mode components)
- Session stats (cards reviewed, retention, time)
- Auto-advance with chime sound on phase transition

- [ ] **Step 2: Wire phase content to existing learn modes**

Each phase renders an existing component:
- `prime` → PreTestMode (already exists)
- `chunk` → show pattern summary (AI-generated from callAI)
- `encode` → SpacedRepMode with interleaved cards
- `connect` → show bridge cards (AI-generated)
- `break` → break screen with countdown
- `test` → SpacedRepMode (harder cards)
- `anchor` → MnemonicsMode for hardest cards
- `report` → session summary stats

- [ ] **Step 3: Add to UnifiedLearnPage tool list**

Add entry to the tools array so it appears in the learn modes list.

- [ ] **Step 4: Commit**

```bash
git add src/components/learn/OmniProtocol.tsx src/pages/UnifiedLearnPage.tsx
git commit -m "feat: add Omni Protocol 60-min auto-sequenced study session"
```

### Task 2: Focus Lock Mode

**Files:**
- Create: `src/components/learn/FocusLock.tsx`
- Create: `src/utils/focusLock.ts`

- [ ] **Step 1: Create focusLock utility**

```typescript
// src/utils/focusLock.ts
export async function enterFocusLock(): Promise<void> {
  // Request Screen Wake Lock API
  if ('wakeLock' in navigator) {
    try { await (navigator as any).wakeLock.request('screen'); } catch {}
  }
  // Request fullscreen
  try { await document.documentElement.requestFullscreen(); } catch {}
  // Update document title
  document.title = '🔒 FOCUS — NOUS AI';
}

export function exitFocusLock(): void {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  document.title = 'NousAI Study Companion';
}
```

- [ ] **Step 2: Create FocusLock component**

Wraps any study mode with a focus overlay — dims non-essential UI, shows timer, blocks navigation.

- [ ] **Step 3: Commit**

### Task 3: Efficiency Score

**Files:**
- Create: `src/utils/efficiencyScore.ts`
- Create: `src/components/EfficiencyBadge.tsx`

- [ ] **Step 1: Create efficiency calculator**

```typescript
// src/utils/efficiencyScore.ts
export interface EfficiencyState {
  score: number;          // 0-100
  cardsReviewed: number;
  retentionRate: number;  // 0-1
  minutesSpent: number;
  status: 'excellent' | 'good' | 'warning' | 'critical';
}

// Rolling 5-min window, starts after 5 min to avoid infinity spike
export function calculateEfficiency(
  cardsReviewed: number,
  correctCount: number,
  minutesSpent: number
): EfficiencyState;
```

- [ ] **Step 2: Create EfficiencyBadge component**

Small badge showing live efficiency score — can be embedded in any study mode header.

- [ ] **Step 3: Commit**

---

## Chunk 2: AI-Enhanced Card Features

### Task 4: Dual Coding (AI Visual per Card)

**Files:**
- Create: `src/components/learn/DualCodingOverlay.tsx`

- [ ] **Step 1: Create DualCodingOverlay**

When enabled, after a card flip, calls `callAI()` to generate a visual description/analogy alongside the text answer. Renders as a collapsible panel below the answer.

```typescript
// Prompt template
const DUAL_CODING_PROMPT = `Generate a vivid, visual mental image for this concept in 2-3 sentences.
Make it concrete and memorable — like describing a scene from a movie.
Concept: {front}
Answer: {back}`;
```

- [ ] **Step 2: Integrate with SpacedRepMode card display**

Add a toggle button [👁 Dual] that enables the overlay on card flip.

- [ ] **Step 3: Commit**

### Task 5: Concrete Examples (AI Examples per Card)

**Files:**
- Create: `src/components/learn/ConcreteExamplesOverlay.tsx`

- [ ] **Step 1: Create ConcreteExamplesOverlay**

Calls `callAI()` to generate 2 real-world examples. Similar architecture to DualCoding but different prompt.

- [ ] **Step 2: Integrate with SpacedRepMode**

Add toggle button [🔍 Examples].

- [ ] **Step 3: Commit**

---

## Chunk 3: Adaptive Pomodoro + Progressive Disclosure

### Task 6: Adaptive Pomodoro

**Files:**
- Create: `src/utils/adaptivePomodoro.ts`
- Create: `src/components/AdaptiveTimer.tsx`

- [ ] **Step 1: Create adaptive timer logic**

Timer that auto-extends when retention >90%, auto-breaks when <70%, forces 20-min break at 90+ min.

- [ ] **Step 2: Create AdaptiveTimer component**

Renders as a small timer widget embeddable in any study mode.

- [ ] **Step 3: Commit**

### Task 7: Progressive Disclosure System

**Files:**
- Create: `src/utils/progressiveDisclosure.ts`

- [ ] **Step 1: Create feature gate system**

```typescript
// src/utils/progressiveDisclosure.ts
type FeatureTier = 'day1' | 'day7' | 'day30';

export function getUnlockedFeatures(
  streakDays: number,
  totalCardsReviewed: number,
  averageRetention: number
): Set<string>;

export function isFeatureUnlocked(featureId: string, ...args): boolean;
```

Day 1: 10 core features. Day 7: +10. Day 30: +11 genius techniques.

- [ ] **Step 2: Commit**

---

## Chunk 4: Stream Deck Plugin Scaffold

### Task 8: Create Plugin Project

**Files:**
- Create: `nous-streamdeck-plugin/package.json`
- Create: `nous-streamdeck-plugin/manifest.json`
- Create: `nous-streamdeck-plugin/src/plugin.ts`
- Create: `nous-streamdeck-plugin/src/nous-client.ts`
- Create: `nous-streamdeck-plugin/src/actions/omni-start.ts`
- Create: `nous-streamdeck-plugin/src/actions/grade-good.ts`

- [ ] **Step 1: Scaffold plugin project with @elgato/streamdeck**

The plugin is a Node.js process. Uses WebSocket to communicate with Nous web app.

- [ ] **Step 2: Create WebSocket client (nous-client.ts)**

Connects to `ws://localhost:8765`. Sends actions, receives state updates.

- [ ] **Step 3: Create core action files**

Each action corresponds to a Stream Deck button. Start with omni-start and grade-good.

- [ ] **Step 4: Commit**

### Task 9: WebSocket Bridge in Nous Web App

**Files:**
- Create: `src/utils/streamDeckBridge.ts`

- [ ] **Step 1: Create WS client in browser**

```typescript
// src/utils/streamDeckBridge.ts
// Browser connects as WS client to plugin's server on localhost:8765
export class StreamDeckBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

  connect(): void;
  disconnect(): void;
  sendState(state: NousState): void;
  onAction(handler: (action: DeckAction) => void): void;
}
```

- [ ] **Step 2: Integrate with App.tsx**

Initialize bridge on app load, send state updates every second during study sessions.

- [ ] **Step 3: Commit**

---

## Chunk 5: Build + Deploy

### Task 10: Build Verification + Deploy

- [ ] **Step 1: Run `npm run build`** — zero TS errors
- [ ] **Step 2: Deploy `vercel --prod --yes`**
- [ ] **Step 3: Clear PWA cache**
- [ ] **Step 4: Final commit with all changes**
