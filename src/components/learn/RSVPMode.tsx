/**
 * RSVP Speed Preview Mode — NousAI
 *
 * Rapid Serial Visual Presentation: flash through an entire deck fast
 * to build pre-exposure familiarity before active recall.
 * Research: pre-exposure reduces cognitive load by ~20% during active recall.
 *
 * Controls: Space=pause, →=skip, dial=adjust WPM
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { FlashcardItem } from '../../types';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface Props {
  cards: FlashcardItem[];
  courseId?: string;
  onComplete: () => void;
  onClose?: () => void;
}

const MIN_WPM = 100;
const MAX_WPM = 600;
const DEFAULT_WPM = 300;

function wpmToMs(card: FlashcardItem, wpm: number): number {
  const words = (card.front + ' ' + card.back).split(/\s+/).length;
  return Math.max(400, (words / wpm) * 60_000);
}

function RSVPModeInner({ cards, onComplete, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [paused, setPaused] = useState(false);
  const [wpm, setWpm] = useState(DEFAULT_WPM);
  const [done, setDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setShowBack((prev) => {
      if (!prev) {
        return true; // Show back
      } else {
        setIndex((i) => {
          const next = i + 1;
          if (next >= cards.length) {
            setDone(true);
            return i;
          }
          return next;
        });
        return false; // Back to front of next card
      }
    });
  }, [cards.length]);

  useEffect(() => {
    if (paused || done || cards.length === 0) return;
    const card = cards[index];
    const delay = showBack
      ? wpmToMs({ front: card.back, back: '' }, wpm) * 0.6 // Back shown shorter
      : wpmToMs(card, wpm);

    timerRef.current = setTimeout(advance, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [index, showBack, paused, wpm, done, advance, cards]);

  useEffect(() => {
    // Quick Keys dial support
    const handleDial = (e: Event) => {
      const { delta } = (e as CustomEvent).detail;
      setWpm((w) => Math.max(MIN_WPM, Math.min(MAX_WPM, w + delta * 10)));
    };
    window.addEventListener('nousai-dial', handleDial);
    return () => window.removeEventListener('nousai-dial', handleDial);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
      if (e.key === 'ArrowRight') advance();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [advance]);

  if (cards.length === 0) {
    return (
      <div className="rsvp-empty">
        <p>No cards in this deck. Add some first.</p>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rsvp-done">
        <h2>Preview Complete!</h2>
        <p>You've seen all {cards.length} cards. Ready for active recall?</p>
        <button className="btn btn-primary" onClick={onComplete}>Start Reviewing</button>
        {onClose && <button className="btn btn-ghost" onClick={onClose}>Exit</button>}
      </div>
    );
  }

  const card = cards[index];
  const progressPct = ((index + (showBack ? 0.5 : 0)) / cards.length) * 100;

  return (
    <div className="rsvp-wrapper">
      {/* Progress bar — CSS animation drains over card duration */}
      <div className="rsvp-progress">
        <div className="rsvp-progress__bar" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Speed control */}
      <div className="rsvp-controls">
        <input
          type="range"
          min={MIN_WPM}
          max={MAX_WPM}
          step={25}
          value={wpm}
          onChange={(e) => setWpm(Number(e.target.value))}
          className="rsvp-speed-slider"
        />
        <span className="rsvp-wpm">{wpm} WPM</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setPaused((p) => !p)}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
      </div>

      {/* Card content */}
      <div className={`rsvp-card${paused ? ' rsvp-card--paused' : ''}`}>
        <div className="rsvp-card__counter">{index + 1} / {cards.length}</div>
        <div className="rsvp-card__face">{showBack ? 'Answer' : 'Term'}</div>
        <div className="rsvp-card__content">{showBack ? card.back : card.front}</div>
      </div>

      <p className="rsvp-hint">Space = pause · → = skip · Dial = speed</p>
    </div>
  );
}

export default function RSVPMode(props: Props) {
  return (
    <ToolErrorBoundary toolName="RSVP Speed Preview">
      <RSVPModeInner {...props} />
    </ToolErrorBoundary>
  );
}
