import React, { useState, useEffect } from 'react';
import { callAI, isAIConfigured } from '../../utils/ai';

interface DualCodingOverlayProps {
  front: string;
  back: string;
  visible: boolean; // only render when card is flipped
}

export default function DualCodingOverlay({ front, back, visible }: DualCodingOverlayProps) {
  const [visual, setVisual] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !isAIConfigured()) {
      setVisual(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    callAI([
      { role: 'system', content: 'You generate vivid, visual mental images for study concepts. Respond with ONLY 2-3 sentences describing a concrete, memorable scene — like a movie scene. No labels, no meta-commentary.' },
      { role: 'user', content: `Concept: "${front}"\nAnswer: "${back}"\n\nGenerate a vivid mental image:` }
    ], { temperature: 0.8, maxTokens: 150 })
      .then(result => { if (!cancelled) setVisual(result); })
      .catch(e => { if (!cancelled) setError('AI unavailable'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [front, back, visible]);

  if (!visible) return null;

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 8,
      background: 'rgba(59, 130, 246, 0.08)',
      border: '1px solid rgba(59, 130, 246, 0.2)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span>👁️</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#3B82F6', textTransform: 'uppercase', letterSpacing: 1 }}>
          Dual Coding — Visual
        </span>
      </div>
      {loading && (
        <div style={{ color: '#666', fontSize: 13, fontStyle: 'italic' }}>
          Generating visualization...
        </div>
      )}
      {error && (
        <div style={{ color: '#EF4444', fontSize: 13 }}>{error}</div>
      )}
      {visual && (
        <div style={{ color: '#D1D5DB', fontSize: 14, lineHeight: 1.5 }}>
          🎬 {visual}
        </div>
      )}
    </div>
  );
}
