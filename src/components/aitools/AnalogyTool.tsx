import { useState } from 'react';
import { Lightbulb, Copy, Save } from 'lucide-react';
import { useStore } from '../../store';
import type { Note } from '../../types';
import { uid, copyText, inputStyle } from './shared';
import { ToolErrorBoundary } from '../ToolErrorBoundary';

interface AnalogyCard {
  id: string;
  concept: string;
  analogy: string;
  domain: string;
}

function AnalogyTool() {
  const { data, updatePluginData } = useStore();
  const [topic, setTopic] = useState('');
  const [analogies, setAnalogies] = useState<AnalogyCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Template-based analogy generator (no AI API needed)
  const analogyTemplates = [
    {
      pattern: (t: string) => `${t} is like a library. Each part has its own section, and you need an index (understanding) to find what you need quickly.`,
      domain: 'Organization',
    },
    {
      pattern: (t: string) => `Think of ${t} as a recipe. You need specific ingredients (concepts) combined in the right order (process) to get the desired result.`,
      domain: 'Cooking',
    },
    {
      pattern: (t: string) => `${t} works like a river system. The main concept flows like the river, with tributaries (sub-topics) feeding into it, all moving toward the ocean (mastery).`,
      domain: 'Nature',
    },
    {
      pattern: (t: string) => `Imagine ${t} as building a house. You start with the foundation (basics), then frame the walls (structure), and finally add the roof (advanced concepts).`,
      domain: 'Construction',
    },
    {
      pattern: (t: string) => `${t} is like learning a musical instrument. First you learn individual notes (fundamentals), then chords (combinations), then full songs (application).`,
      domain: 'Music',
    },
    {
      pattern: (t: string) => `Think of ${t} as a map. The main roads are core concepts, side streets are details, and landmarks are key examples that help you navigate.`,
      domain: 'Navigation',
    },
    {
      pattern: (t: string) => `${t} resembles a tree. The trunk represents the core principle, branches are major topics, and leaves are the specific details and examples.`,
      domain: 'Biology',
    },
    {
      pattern: (t: string) => `Consider ${t} like a sports team. Each player (concept) has a role, and they must work together (interact) to win the game (solve problems).`,
      domain: 'Sports',
    },
  ];

  function generateAnalogies() {
    if (!topic.trim()) return;
    setLoading(true);

    // Simulate a brief delay for realism
    setTimeout(() => {
      const shuffled = [...analogyTemplates].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 4);
      const newAnalogies: AnalogyCard[] = selected.map((tmpl) => ({
        id: uid(),
        concept: topic,
        analogy: tmpl.pattern(topic),
        domain: tmpl.domain,
      }));
      setAnalogies(newAnalogies);
      setSaved(false);
      setLoading(false);
    }, 600);
  }

  function saveToLibrary() {
    if (!analogies.length || !data) return;
    const content = analogies.map(a => `[${a.domain}]\n${a.analogy}`).join('\n\n');
    const note: Note = {
      id: uid(),
      title: `Analogies — ${topic}`,
      content,
      folder: 'AI Tools',
      tags: ['analogy', topic],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: 'ai-output' as const,
    };
    const notes = [...(data.pluginData?.notes || []), note];
    updatePluginData({ notes });
    setSaved(true);
  }

  return (
    <div>
      <div className="card mb-3">
        <div className="card-title mb-3">
          <Lightbulb size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          Generate Analogies
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generateAnalogies()}
            placeholder="Enter a concept (e.g., Photosynthesis, Neural Networks)..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            className="btn btn-primary"
            onClick={generateAnalogies}
            disabled={!topic.trim() || loading}
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Analogy cards */}
      {analogies.length > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          {analogies.map((a) => (
            <div key={a.id} className="card" style={{ borderLeftColor: 'var(--accent)', borderLeftWidth: 3 }}>
              <div className="flex items-center justify-between mb-2">
                <span className="badge" style={{
                  background: 'var(--accent-glow)', color: 'var(--accent-light)',
                  padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                }}>
                  {a.domain}
                </span>
                <button
                  onClick={() => copyText(a.analogy)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
                >
                  <Copy size={14} />
                </button>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)' }}>
                {a.analogy}
              </p>
            </div>
          ))}
        </div>
      )}

      {analogies.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button className="btn btn-sm btn-secondary" onClick={saveToLibrary} disabled={saved}>
            <Save size={14} /> {saved ? 'Saved!' : 'Save to Library'}
          </button>
        </div>
      )}

      {analogies.length === 0 && !loading && (
        <div className="text-center" style={{ padding: 40, color: 'var(--text-muted)' }}>
          <Lightbulb size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p className="text-sm">Enter a topic to generate helpful analogies</p>
        </div>
      )}
    </div>
  );
}

export default function AnalogyToolWrapped() {
  return (
    <ToolErrorBoundary toolName="Analogy">
      <AnalogyTool />
    </ToolErrorBoundary>
  );
}
