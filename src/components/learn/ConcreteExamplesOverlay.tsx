import React, { useState, useEffect } from 'react';
import { callAI, isAIConfigured } from '../../utils/ai';

interface ConcreteExamplesOverlayProps {
  front: string;
  back: string;
  visible: boolean;
}

export default function ConcreteExamplesOverlay({ front, back, visible }: ConcreteExamplesOverlayProps) {
  const [examples, setExamples] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !isAIConfigured()) {
      setExamples(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    callAI([
      { role: 'system', content: 'You generate concrete, real-world examples for study concepts. Give exactly 2 examples that a non-expert would understand. Format: "1. [example]\\n2. [example]". No jargon. Each example should be 1-2 sentences.' },
      { role: 'user', content: `Concept: "${front}"\nAnswer: "${back}"\n\nGive 2 real-world examples:` }
    ], { temperature: 0.8, maxTokens: 200 })
      .then(result => { if (!cancelled) setExamples(result); })
      .catch(e => { if (!cancelled) setError('AI unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [front, back, visible]);

  if (!visible) return null;

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 8,
      background: 'rgba(34, 197, 94, 0.08)',
      border: '1px solid rgba(34, 197, 94, 0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span>🔍</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#22C55E', textTransform: 'uppercase', letterSpacing: 1 }}>
          Concrete Examples
        </span>
      </div>
      {loading && (
        <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>
          Generating examples...
        </div>
      )}
      {error && (
        <div style={{ color: '#EF4444', fontSize: 13 }}>{error}</div>
      )}
      {examples && (
        <div style={{ color: '#D1D5DB', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {examples}
        </div>
      )}
    </div>
  );
}
