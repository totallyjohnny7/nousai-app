/**
 * PreTestMode — Hypercorrection Effect Implementation
 *
 * Testing BEFORE learning improves subsequent retention 15-20%.
 * High-confidence wrong answers get corrected most strongly (hypercorrection effect).
 * Anki doesn't implement this — strong differentiator for NousAI.
 */

import React, { useState } from 'react';
import type { FlashcardItem, PreTestResult } from '../../types';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface Props {
  cards: FlashcardItem[];
  onComplete: (results: PreTestResult[]) => void;
  onClose?: () => void;
}

type Phase = 'pretest' | 'summary' | 'done';

function PreTestModeInner({ cards, onComplete, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('pretest');
  const [index, setIndex] = useState(0);
  const [highConfidence, setHighConfidence] = useState<boolean | null>(null);
  const [typed, setTyped] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<PreTestResult[]>([]);

  if (cards.length === 0) {
    return (
      <div className="pretest-empty">
        <p>No cards to pre-test. Add some first.</p>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  const card = cards[index];

  const handleReveal = () => {
    setRevealed(true);
  };

  const handleMark = (wasCorrect: boolean) => {
    const hcVal = highConfidence ?? false;
    const hypercorrectionScore = hcVal && !wasCorrect ? 1.0 : 0;
    const result: PreTestResult = {
      cardKey: `pretest-${index}`,
      typedAnswer: typed,
      wasCorrect,
      wasHighConfidence: hcVal,
      hypercorrectionScore,
    };

    const newResults = [...results, result];
    setResults(newResults);

    if (index + 1 >= cards.length) {
      setPhase('summary');
      onComplete(newResults);
    } else {
      setIndex((i) => i + 1);
      setTyped('');
      setRevealed(false);
      setHighConfidence(null);
    }
  };

  if (phase === 'summary') {
    const correct = results.filter((r) => r.wasCorrect).length;
    const hypercorrect = results.filter((r) => r.hypercorrectionScore > 0);
    return (
      <div className="pretest-summary">
        <h2>Pre-Test Complete</h2>
        <div className="pretest-summary__stats">
          <div className="pretest-stat">
            <span className="pretest-stat__value">{correct}</span>
            <span className="pretest-stat__label">Knew correctly</span>
          </div>
          <div className="pretest-stat pretest-stat--warning">
            <span className="pretest-stat__value">{hypercorrect.length}</span>
            <span className="pretest-stat__label">Thought you knew — got wrong</span>
          </div>
          <div className="pretest-stat">
            <span className="pretest-stat__value">{results.length - correct - hypercorrect.length}</span>
            <span className="pretest-stat__label">Knew you didn't know</span>
          </div>
        </div>
        {hypercorrect.length > 0 && (
          <div className="pretest-hypercorrect-notice">
            ⚡ {hypercorrect.length} card{hypercorrect.length !== 1 ? 's' : ''} marked high-priority — these will appear first in your review session.
          </div>
        )}
        <button className="btn btn-primary" onClick={() => setPhase('done')}>Start Studying</button>
        {onClose && <button className="btn btn-ghost" onClick={onClose}>Exit</button>}
      </div>
    );
  }

  return (
    <div className="pretest-wrapper">
      <div className="pretest-header">
        <span>Pre-Test: {index + 1} / {cards.length}</span>
        {onClose && <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>}
      </div>

      {/* Confidence prediction before answering */}
      {highConfidence === null && (
        <div className="pretest-confidence">
          <p>Do you think you know this?</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm" onClick={() => setHighConfidence(true)}>Yes, I know it</button>
            <button className="btn btn-sm" onClick={() => setHighConfidence(false)}>Not sure</button>
          </div>
        </div>
      )}

      {/* Card front */}
      <div className="pretest-front">{card.front}</div>

      {/* Answer input */}
      {highConfidence !== null && !revealed && (
        <>
          <textarea
            className="pretest-textarea"
            placeholder="Type your answer…"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            rows={3}
            autoFocus
          />
          <button className="btn btn-primary" onClick={handleReveal}>
            Reveal Answer
          </button>
        </>
      )}

      {/* Revealed answer */}
      {revealed && (
        <div className="pretest-revealed">
          <div className="pretest-answer">
            <strong>Correct answer:</strong> {card.back}
          </div>
          <div className="pretest-mark-buttons">
            <button className="btn btn-sm" style={{ color: 'var(--color-success, #22c55e)' }} onClick={() => handleMark(true)}>
              ✓ Got it right
            </button>
            <button className="btn btn-sm" style={{ color: 'var(--color-danger, #ef4444)' }} onClick={() => handleMark(false)}>
              ✗ Got it wrong
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreTestMode(props: Props) {
  return (
    <ToolErrorBoundary toolName="Pre-Test Mode">
      <PreTestModeInner {...props} />
    </ToolErrorBoundary>
  );
}
