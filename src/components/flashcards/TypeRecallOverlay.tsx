/**
 * TypeRecallOverlay — Active Recall Typing Mode
 *
 * The generation effect: typing an answer before seeing it improves
 * retention 40-60% over passive flip-and-rate (Slamecka & Graf, 1978).
 *
 * Two modes:
 * - AI grading: auto-grades EXACT(4) / PARTIAL(2) / WRONG(1); user can override
 * - Self-grade: shows correct answer, user self-grades 1-4
 */

import React, { useState, useRef, useEffect } from 'react';
import { callAI } from '../../utils/ai';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface Props {
  front: string;
  back: string;
  useAIGrading: boolean;
  onGrade: (grade: 1 | 2 | 3 | 4) => void;
}

type AIResult = 'EXACT' | 'PARTIAL' | 'WRONG';

function TypeRecallOverlayInner({ front, back, useAIGrading, onGrade }: Props) {
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);
  const [aiResult, setAIResult] = useState<AIResult | null>(null);
  const [aiMissing, setAIMissing] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<1 | 2 | 3 | 4 | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleCheck = async () => {
    if (!typed.trim()) return;
    setChecked(true);

    if (useAIGrading) {
      setLoading(true);
      try {
        const result = await callAI([{
          role: 'user',
          content: `Does this typed answer match the correct answer?
Typed: "${typed}"
Correct: "${back}"

Respond with EXACTLY one of:
- EXACT (answer is correct or close enough)
- PARTIAL: missing <what was missing in 1-5 words>
- WRONG`,
        }], { temperature: 0.1, maxTokens: 60 });
        const trimmed = result.trim();
        if (trimmed.startsWith('EXACT')) {
          setAIResult('EXACT');
          setSelectedGrade(4);
        } else if (trimmed.startsWith('PARTIAL')) {
          setAIResult('PARTIAL');
          const missing = trimmed.replace(/^PARTIAL:?\s*/i, '').trim();
          setAIMissing(missing);
          setSelectedGrade(2);
        } else {
          setAIResult('WRONG');
          setSelectedGrade(1);
        }
      } catch {
        // AI failed — fall back to self-grade silently (no crash)
        setAIResult(null);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !checked) {
      e.preventDefault();
      handleCheck();
    }
  };

  const finalGrade = selectedGrade;

  return (
    <div className="type-recall-overlay">
      {/* Card front */}
      <div className="type-recall-front">{front}</div>

      {/* Typing area */}
      <textarea
        ref={textareaRef}
        className="type-recall-textarea"
        placeholder="Type your answer… (Enter to check)"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={checked}
        rows={3}
      />

      {!checked ? (
        <button
          className="btn btn-primary"
          onClick={handleCheck}
          disabled={!typed.trim() || loading}
        >
          {loading ? 'Checking…' : 'Check Answer'}
        </button>
      ) : (
        <div className="type-recall-result">
          {/* Show correct answer */}
          <div className="type-recall-answer">
            <span className="type-recall-answer__label">Correct answer:</span>
            <div className="type-recall-answer__text">{back}</div>
          </div>

          {/* AI verdict */}
          {useAIGrading && aiResult && (
            <div className={`type-recall-verdict type-recall-verdict--${aiResult.toLowerCase()}`}>
              {aiResult === 'EXACT' && '✓ Correct'}
              {aiResult === 'PARTIAL' && `⚡ Partial — missing: ${aiMissing}`}
              {aiResult === 'WRONG' && '✗ Incorrect'}
            </div>
          )}

          {/* Grade buttons */}
          <div className="type-recall-grades">
            <span className="type-recall-grades__label">How well did you know it?</span>
            <div className="type-recall-grades__buttons">
              {([1, 2, 3, 4] as const).map((g) => (
                <button
                  key={g}
                  className={`btn type-recall-grade-btn${finalGrade === g ? ' type-recall-grade-btn--selected' : ''}`}
                  onClick={() => setSelectedGrade(g)}
                >
                  {g === 1 && 'Again'}
                  {g === 2 && 'Hard'}
                  {g === 3 && 'Good'}
                  {g === 4 && 'Easy'}
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              disabled={!finalGrade}
              onClick={() => finalGrade && onGrade(finalGrade)}
              style={{ marginTop: 8 }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TypeRecallOverlay(props: Props) {
  return (
    <ToolErrorBoundary toolName="Type Recall">
      <TypeRecallOverlayInner {...props} />
    </ToolErrorBoundary>
  );
}
