import { useState } from 'react';
import { Zap, BookOpen, Eye, Hash, RotateCcw, Save } from 'lucide-react';
import { useStore } from '../../store';
import { callAI, isAIConfigured } from '../../utils/ai';
import { BackBtn, SubjectPicker, cardStyle, inputStyle } from './learnHelpers';
import type { Note } from '../../types';

interface MnemonicResult {
  acronym: string;
  acronymExplanation: string;
  story: string;
  visualAssociation: string;
}

export default function MnemonicsMode({ onBack }: { onBack: () => void }) {
  const { courses, data, updatePluginData } = useStore();
  const [subject, setSubject] = useState('');
  const [concept, setConcept] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MnemonicResult | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function generate() {
    if (!concept.trim()) return;
    setLoading(true);
    setError('');
    setSaved(false);
    try {
      const prompt = `Generate memory aids for this concept: "${concept}". Respond with JSON only, no markdown: {"acronym": "string", "acronymExplanation": "string", "story": "string", "visualAssociation": "string"}`;
      const raw = await callAI([{ role: 'user', content: prompt }], { json: true }, 'analysis');
      const cleaned = raw.replace(/```json|```/g, '').trim();
      setResult(JSON.parse(cleaned));
    } catch {
      setError('Failed to generate mnemonics. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function saveToNotes() {
    if (!result) return;
    const existing: Note[] = data?.pluginData?.notes ?? [];
    const note: Note = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: `Mnemonics: ${concept}`,
      content: `**Acronym**: ${result.acronym}\n${result.acronymExplanation}\n\n**Story**: ${result.story}\n\n**Visual**: ${result.visualAssociation}`,
      folder: 'Mnemonics',
      tags: ['mnemonic', subject].filter(Boolean),
      courseId: subject || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output',
    };
    updatePluginData({ notes: [...existing, note] });
    setSaved(true);
  }

  if (!isAIConfigured()) {
    return (
      <div>
        <BackBtn onClick={onBack} />
        <p style={{ color: '#a0a0a0' }}>Please configure an AI provider in Settings.</p>
      </div>
    );
  }

  return (
    <div>
      <BackBtn onClick={onBack} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Zap size={18} style={{ color: '#fbbf24' }} />
        <span style={{ fontWeight: 700, fontSize: 15 }}>Mnemonic Generator</span>
      </div>
      <p style={{ color: '#a0a0a0', fontSize: 13, marginBottom: 12 }}>
        Enter a concept you struggle with — AI creates 3 types of memory aids.
      </p>
      <SubjectPicker courses={courses} value={subject} onChange={setSubject} />
      <input
        type="text"
        placeholder="Concept to remember (e.g. Mitosis stages, Ohm's Law...)"
        value={concept}
        onChange={e => setConcept(e.target.value)}
        style={{ ...inputStyle, marginBottom: 12 }}
        onKeyDown={e => { if (e.key === 'Enter') generate(); }}
      />
      <button
        className="btn btn-primary w-full"
        onClick={generate}
        disabled={loading || !concept.trim()}
        style={{ marginBottom: 16 }}
      >
        {loading ? 'Generating...' : <><Zap size={14} /> Generate Mnemonics</>}
      </button>

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}

      {result && (
        <div>
          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Hash size={16} style={{ color: '#60a5fa' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#60a5fa' }}>Acronym / Acrostic</span>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>{result.acronym}</div>
            <p style={{ fontSize: 13, color: '#a0a0a0', lineHeight: 1.6 }}>{result.acronymExplanation}</p>
          </div>

          <div style={{ ...cardStyle, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOpen size={16} style={{ color: '#4ade80' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#4ade80' }}>Story Mnemonic</span>
            </div>
            <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.7 }}>{result.story}</p>
          </div>

          <div style={{ ...cardStyle, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Eye size={16} style={{ color: '#a78bfa' }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#a78bfa' }}>Visual Association</span>
            </div>
            <p style={{ fontSize: 13, color: '#e8e8e8', lineHeight: 1.7 }}>{result.visualAssociation}</p>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={generate} disabled={loading}>
              <RotateCcw size={14} /> Generate Another
            </button>
            <button
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={saveToNotes}
              disabled={saved}
            >
              <Save size={14} /> {saved ? 'Saved!' : 'Save to Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
