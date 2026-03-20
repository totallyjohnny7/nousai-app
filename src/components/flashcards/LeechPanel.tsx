/**
 * LeechPanel — Leech Card Manager
 *
 * Displays cards with lapses >= 4 or avg recall < 50%.
 * Allows: Suspend, AI Rewrite suggestion, Dismiss.
 * Integrated into FlashcardAnalytics as a tab.
 */

import React, { useState, useEffect } from 'react';
import type { LeechAnalysis } from '../../types';
import { detectLeeches, getAIRewriteSuggestion, suspendCard } from '../../utils/leechDetection';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface Props {
  cards: Array<{ key: string; lapses: number; state?: string; history?: { grade: number }[]; front?: string; back?: string }>;
  onUpdateCards: (updatedCards: Props['cards']) => void;
}

function LeechPanelInner({ cards, onUpdateCards }: Props) {
  const [leeches, setLeeches] = useState<LeechAnalysis[]>([]);
  const [rewriteLoading, setRewriteLoading] = useState<string | null>(null);
  const [rewriteResult, setRewriteResult] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLeeches(detectLeeches(cards));
  }, [cards]);

  const visibleLeeches = leeches.filter((l) => !dismissed.has(l.cardKey));

  const handleSuspend = (cardKey: string) => {
    const updated = suspendCard(cardKey, cards);
    onUpdateCards(updated);
    setLeeches((prev) => prev.filter((l) => l.cardKey !== cardKey));
  };

  const handleSuspendAll = () => {
    let updated = [...cards];
    for (const l of visibleLeeches) {
      updated = suspendCard(l.cardKey, updated);
    }
    onUpdateCards(updated);
    setLeeches([]);
  };

  const handleGetRewrite = async (leech: LeechAnalysis) => {
    const cardData = cards.find((c) => c.key === leech.cardKey);
    if (!cardData) return;
    setRewriteLoading(leech.cardKey);
    try {
      const suggestion = await getAIRewriteSuggestion({
        front: cardData.front ?? '',
        back: cardData.back ?? '',
      });
      setRewriteResult((prev) => ({ ...prev, [leech.cardKey]: suggestion }));
    } catch {
      setRewriteResult((prev) => ({ ...prev, [leech.cardKey]: 'AI unavailable — try again.' }));
    } finally {
      setRewriteLoading(null);
    }
  };

  if (visibleLeeches.length === 0) {
    return (
      <div className="leech-panel leech-panel--empty">
        <p>No leech cards detected. Your deck is healthy!</p>
      </div>
    );
  }

  return (
    <div className="leech-panel">
      <div className="leech-panel__header">
        <span>{visibleLeeches.length} leech{visibleLeeches.length !== 1 ? 'es' : ''} detected</span>
        <button className="btn btn-sm" onClick={handleSuspendAll}>Suspend All</button>
      </div>

      <div className="leech-panel__list">
        {visibleLeeches.map((leech) => {
          const cardData = cards.find((c) => c.key === leech.cardKey);
          return (
            <div key={leech.cardKey} className="leech-card">
              <div className="leech-card__header">
                <div className="leech-card__severity-bar" style={{ width: `${leech.severity}%` }} />
                <span className="leech-card__stats">
                  {leech.lapseCount} lapses · {Math.round(leech.avgRetrieval * 100)}% avg recall · severity {leech.severity}
                </span>
              </div>

              {cardData && (
                <div className="leech-card__preview">
                  <strong>Q:</strong> {(cardData.front ?? '').slice(0, 80)}
                  {(cardData.front ?? '').length > 80 && '…'}
                </div>
              )}

              <div className="leech-card__suggestion">
                Suggested: <em>{leech.suggestedAction}</em>
              </div>

              {rewriteResult[leech.cardKey] && (
                <div className="leech-card__rewrite">
                  {rewriteResult[leech.cardKey]}
                </div>
              )}

              <div className="leech-card__actions">
                <button className="btn btn-sm" onClick={() => handleSuspend(leech.cardKey)}>
                  Suspend
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => handleGetRewrite(leech)}
                  disabled={rewriteLoading === leech.cardKey}
                >
                  {rewriteLoading === leech.cardKey ? 'Thinking…' : 'AI Rewrite'}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setDismissed((prev) => new Set([...prev, leech.cardKey]))}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LeechPanel(props: Props) {
  return (
    <ToolErrorBoundary toolName="Leech Panel">
      <LeechPanelInner {...props} />
    </ToolErrorBoundary>
  );
}
