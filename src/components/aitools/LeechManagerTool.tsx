/**
 * LeechManagerTool — UnifiedLearnPage wrapper for LeechPanel
 *
 * Pulls SRCards from Zustand store, writes updates back via updatePluginData.
 * Registered in UnifiedLearnPage "Analyze" category.
 */

import React from 'react';
import { useStore } from '../../store';
import LeechPanel from '../flashcards/LeechPanel';
import { ToolErrorBoundary } from '../ToolErrorBoundary';
import type { SRCard } from '../../types';

type CardRow = { key: string; lapses: number; state?: string; history?: { grade: number }[]; front?: string; back?: string };

interface Props {
  cards?: CardRow[];
}

function LeechManagerToolInner({ cards: propCards }: Props) {
  const { data, updatePluginData } = useStore();
  const srCards = (data?.pluginData?.srData?.cards ?? []) as SRCard[];

  const mappedRows: CardRow[] = srCards.map((c: SRCard) => ({
    key: c.key,
    lapses: c.lapses,
    state: c.state,
    history: c.history,
    front: c.questionText,
  }));
  const cards: CardRow[] = propCards ?? mappedRows;

  const handleUpdateCards = (updated: CardRow[]) => {
    const updatedMap = new Map(updated.map((c: CardRow) => [c.key, c]));
    const merged: SRCard[] = srCards.map((c: SRCard) => {
      const u = updatedMap.get(c.key);
      return u ? { ...c, state: u.state ?? c.state, lapses: u.lapses } : c;
    });
    updatePluginData({ srData: { ...(data?.pluginData?.srData ?? { cards: [] }), cards: merged } });
  };

  return <LeechPanel cards={cards} onUpdateCards={handleUpdateCards} />;
}

export default function LeechManagerTool(props: Props) {
  return (
    <ToolErrorBoundary toolName="Leech Manager">
      <LeechManagerToolInner {...props} />
    </ToolErrorBoundary>
  );
}
