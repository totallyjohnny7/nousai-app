import { useState, useCallback } from 'react';
import { CheckCircle, Save, ExternalLink, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { searchWeb } from '../../utils/valyu';
import type { Note } from '../../types';
import { inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface FactResult {
  claim: string;
  verdict: 'likely-true' | 'uncertain' | 'likely-false';
  confidence: number;
  reasoning: string;
  sources?: Array<{ title: string; url: string; snippet: string }>;
  citationsAvailable: boolean;
}

function FactCheckTool() {
  const { data, updatePluginData } = useStore();
  const [claim, setClaim] = useState('');
  const [results, setResults] = useState<FactResult[]>([]);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(false);

  const checkFacts = useCallback(async () => {
    if (!claim.trim()) return;
    setChecking(true);
    setSaved(false);

    // Split into individual claims for per-claim Valyu + AI analysis
    const rawClaims = claim.split(/[.\n]+/).map(c => c.trim()).filter(c => c.length > 5);
    const claimsToCheck = rawClaims.length > 0 ? rawClaims : [claim.trim()];

    if (isAIConfigured()) {
      try {
        // Enrich with Valyu web search for the overall topic
        const valyuCtx = await searchWeb(claimsToCheck[0]);
        const sourceSnippets = valyuCtx.isVerified && valyuCtx.sources.length > 0
          ? valyuCtx.sources.slice(0, 3).map((s, i) => `[${i + 1}] ${s.title}: ${s.snippet}`).join('\n')
          : '';

        const contextBlock = sourceSnippets
          ? `\n\nRelevant web sources for context:\n${sourceSnippets}\n\nUse these sources to inform your analysis.`
          : '';

        const prompt = `Fact-check the following claim(s). For each claim, provide a JSON array response.

Each item must have:
- "claim": the original claim text
- "verdict": one of "likely-true", "uncertain", or "likely-false"
- "confidence": number 1-100 (rate confidence carefully — lower if sources conflict or evidence is weak)
- "reasoning": brief explanation of your verdict (cite sources by [1], [2] etc. when relevant). Note where sources conflict or disagree with each other.

Claims to check:
${claimsToCheck.join('\n')}${contextBlock}

Return ONLY a valid JSON array.`;

        const response = await callAI([{ role: 'user', content: prompt }], { json: true }, 'analysis');
        try {
          let jsonStr = response.trim();
          const codeBlock = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
          if (codeBlock) jsonStr = codeBlock[1].trim();
          const arrMatch = jsonStr.match(/\[[\s\S]*\]/);
          if (arrMatch) jsonStr = arrMatch[0];
          const parsed = JSON.parse(jsonStr);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setResults(parsed.map((r: Record<string, unknown>) => ({
              claim: String(r.claim || ''),
              verdict: (['likely-true', 'uncertain', 'likely-false'].includes(String(r.verdict)) ? r.verdict : 'uncertain') as FactResult['verdict'],
              confidence: Math.max(5, Math.min(95, Number(r.confidence) || 50)),
              reasoning: String(r.reasoning || 'No reasoning provided.'),
              sources: valyuCtx.isVerified ? valyuCtx.sources : [],
              citationsAvailable: valyuCtx.isVerified,
            })));
            setChecking(false);
            return;
          }
        } catch { /* fall through to heuristic */ }
      } catch { /* fall through to heuristic */ }
    }

    // Heuristic fallback — also try Valyu for citations
    const valyuCtx = await searchWeb(claimsToCheck[0]);
    const newResults: FactResult[] = claimsToCheck.map(c => {
      let confidence = 50;
      let verdict: FactResult['verdict'] = 'uncertain';
      const reasons: string[] = [];

      if (/\b(always|never|all|none|every|no one)\b/i.test(c)) {
        confidence -= 15;
        reasons.push('Contains absolute language which is rarely accurate');
      }
      if (/\b(often|usually|typically|generally|may|might|can)\b/i.test(c)) {
        confidence += 10;
        reasons.push('Uses qualified language suggesting nuanced understanding');
      }
      if (/\d+%|\d+\s*(million|billion|thousand|percent)/i.test(c)) {
        reasons.push('Contains specific statistics that need verification');
        confidence += 5;
      }
      if (/\b(hypothesis|theory|study|research|evidence|according to)\b/i.test(c)) {
        confidence += 10;
        reasons.push('References scientific framework or evidence');
      }
      reasons.push('Recommend verifying with authoritative sources');

      if (confidence >= 65) verdict = 'likely-true';
      else if (confidence <= 35) verdict = 'likely-false';

      return {
        claim: c,
        verdict,
        confidence: Math.max(5, Math.min(95, confidence)),
        reasoning: reasons.join('. ') + '.',
        sources: valyuCtx.isVerified ? valyuCtx.sources : [],
        citationsAvailable: valyuCtx.isVerified,
      };
    });

    setResults(newResults);
    setChecking(false);
  }, [claim]);

  const saveToLibrary = useCallback(() => {
    if (!data || results.length === 0) return;
    const content = results.map(r => {
      let text = `## ${r.verdict === 'likely-true' ? '✓' : r.verdict === 'likely-false' ? '✗' : '?'} ${r.claim}\n**Verdict:** ${r.verdict} (${r.confidence}%)\n${r.reasoning}`;
      if (r.sources && r.sources.length > 0) {
        text += '\n\n**Sources:**\n' + r.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n');
      }
      return text;
    }).join('\n\n---\n\n');
    const note: Note = {
      id: `factcheck-${Date.now()}`,
      title: `Fact Check — ${new Date().toLocaleDateString()}`,
      content,
      folder: 'AI Outputs',
      tags: ['fact-check'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    };
    const existing = (data.pluginData as Record<string, unknown>).notes as Note[] | undefined || [];
    updatePluginData({ notes: [...existing, note] });
    setSaved(true);
  }, [data, updatePluginData, results]);

  const verdictColors = {
    'likely-true': 'var(--green)',
    'uncertain': 'var(--yellow)',
    'likely-false': 'var(--red)',
  };

  const verdictLabels = {
    'likely-true': 'Likely True',
    'uncertain': 'Uncertain',
    'likely-false': 'Likely False',
  };

  // Check if any result lacks citations (for degradation banner)
  const showDegradationBanner = results.length > 0 && results.some(r => !r.citationsAvailable);

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Fact Checker
        </div>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value.slice(0, 20000))}
          placeholder="Enter claims to verify (one per line or sentence)...&#10;&#10;Example: Water boils at 100 degrees Celsius at sea level."
          rows={5}
          maxLength={20000}
          style={{ ...inputStyle, resize: 'vertical', marginBottom: 4 }}
        />
        <div style={{ fontSize: 11, color: claim.length > 18000 ? 'var(--red, #ef4444)' : 'var(--text-muted)', textAlign: 'right', marginBottom: 8 }}>
          {claim.length.toLocaleString()} / 20,000 chars{claim.length > 18000 ? ' — approaching limit' : ''}
        </div>
        <button
          className="btn btn-primary"
          onClick={checkFacts}
          disabled={!claim.trim() || checking}
          style={{ width: '100%' }}
        >
          <CheckCircle size={14} /> {checking ? 'Analyzing...' : 'Check Facts'}
        </button>
        <p className="text-xs text-muted" style={{ marginTop: 8 }}>
          {isAIConfigured() ? 'AI-powered analysis with web source enrichment.' : 'Heuristic analysis. Configure AI in Settings for smarter fact-checking.'}
          {' '}Always verify with authoritative sources.
        </p>
      </div>

      {/* Degradation banner — shown when Valyu is unavailable */}
      {showDegradationBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 'var(--radius-sm)',
          background: 'var(--yellow)18', border: '1px solid var(--yellow)40',
          marginBottom: 12,
        }}>
          <AlertTriangle size={13} style={{ color: 'var(--yellow)', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--yellow)' }}>
            Using LLM General Knowledge (Citations Unavailable) — add <code>VITE_VALYU_API_KEY</code> to .env for source citations.
          </span>
        </div>
      )}

      {/* Save to Library */}
      {results.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button className="btn btn-sm" onClick={saveToLibrary} disabled={saved}>
            <Save size={13} /> {saved ? 'Saved!' : 'Save to Library'}
          </button>
        </div>
      )}

      {/* Results */}
      {results.map((r, i) => (
        <div key={i} className="card mb-2" style={{ borderLeftColor: verdictColors[r.verdict], borderLeftWidth: 3 }}>
          <div className="flex items-center justify-between mb-2">
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: verdictColors[r.verdict],
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {verdictLabels[r.verdict]}
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px',
              borderRadius: 12, background: verdictColors[r.verdict] + '22',
              color: verdictColors[r.verdict],
            }}>
              {r.confidence}% confidence
            </span>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
            "{r.claim}"
          </p>
          {/* Confidence bar */}
          <div style={{
            height: 4, borderRadius: 2, background: 'var(--border)', marginBottom: 8, overflow: 'hidden',
          }}>
            <div style={{
              width: `${r.confidence}%`, height: '100%',
              background: verdictColors[r.verdict],
              borderRadius: 2, transition: 'width 0.5s',
            }} />
          </div>
          <p className="text-sm text-muted" style={{ lineHeight: 1.6, marginBottom: r.sources && r.sources.length > 0 ? 8 : 0 }}>
            {r.reasoning}
          </p>

          {/* Source citations */}
          {r.sources && r.sources.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Sources</div>
              {r.sources.map((s, si) => (
                <div key={si} style={{ marginBottom: 4 }}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: 12, color: 'var(--accent)', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}
                  >
                    <ExternalLink size={11} />
                    {s.title}
                  </a>
                  {s.snippet && (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0 15px', lineHeight: 1.5 }}>
                      {s.snippet.slice(0, 120)}{s.snippet.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function FactCheckToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Fact Check">
      <FactCheckTool />
    </ToolErrorBoundary>
  );
}
