import React from 'react';
import { calculateEfficiency, efficiencyColor, efficiencyLabel, type EfficiencyState } from '../utils/efficiencyScore';

interface EfficiencyBadgeProps {
  cardsReviewed: number;
  correctCount: number;
  minutesSpent: number;
  compact?: boolean; // true = just the number, false = full badge
}

export default function EfficiencyBadge({ cardsReviewed, correctCount, minutesSpent, compact }: EfficiencyBadgeProps) {
  const eff = calculateEfficiency(cardsReviewed, correctCount, minutesSpent);

  if (minutesSpent < 5) {
    return compact ? null : (
      <span style={{ color: '#666', fontSize: 12, fontFamily: 'DM Mono, monospace' }}>
        Eff: calculating...
      </span>
    );
  }

  const color = efficiencyColor(eff.status);

  if (compact) {
    return (
      <span style={{ color, fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 14 }}>
        {eff.score}%
      </span>
    );
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '4px 12px', borderRadius: 8,
      background: `${color}15`, border: `1px solid ${color}40`,
    }}>
      <span style={{ color, fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 16 }}>
        Eff: {eff.score}%
      </span>
      <span style={{ color: '#999', fontSize: 12 }}>
        {efficiencyLabel(eff.status)}
      </span>
      {eff.shouldBreak && (
        <span style={{ color: '#EF4444', fontSize: 12, fontWeight: 600 }}>
          ⚠️ Break recommended
        </span>
      )}
    </div>
  );
}
