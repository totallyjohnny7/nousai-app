import { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { SliderConfig, SimDef } from './types';
import { createCustomSimClass } from './sims/CustomSim';

interface SliderRow {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  default: number;
}

interface CustomSimModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (simDef: SimDef) => void;
}

export function CustomSimModal({ open, onClose, onCreated }: CustomSimModalProps) {
  const [name, setName] = useState('');
  const [equation, setEquation] = useState('A*sin(k*x - w*t)');
  const [sliders, setSliders] = useState<SliderRow[]>([
    { key: 'A', label: 'Amplitude', unit: '', min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'k', label: 'Wave Number', unit: '', min: 0.1, max: 10, step: 0.1, default: 2 },
    { key: 'w', label: 'Angular Freq', unit: '', min: 0.1, max: 10, step: 0.1, default: 3 },
  ]);
  const [error, setError] = useState('');

  if (!open) return null;

  function addSlider() {
    setSliders(s => [...s, { key: '', label: '', unit: '', min: 0, max: 10, step: 0.1, default: 1 }]);
  }

  function removeSlider(i: number) {
    setSliders(s => s.filter((_, idx) => idx !== i));
  }

  function updateSlider(i: number, field: keyof SliderRow, value: string | number) {
    setSliders(s => s.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function handleSubmit() {
    if (!name.trim()) { setError('Enter a simulation name'); return; }
    if (!equation.trim()) { setError('Enter an equation'); return; }

    try {
      const sim = createCustomSimClass(equation);
      // Test evaluation
      const testParams: Record<string, number> = {};
      sliders.forEach(s => { testParams[s.key] = s.default; });
      sim.init(700, 360, testParams);

      const id = `custom-${Date.now()}`;
      const simDef: SimDef = {
        id,
        title: name.trim(),
        subtitle: equation,
        type: 'canvas',
        sliders: sliders.filter(s => s.key.trim()) as SliderConfig[],
        sim,
      };

      // Save to localStorage
      const saved = JSON.parse(localStorage.getItem('nousai-custom-sims') || '[]');
      saved.push({ id, name: name.trim(), equation, sliders: sliders.filter(s => s.key.trim()) });
      localStorage.setItem('nousai-custom-sims', JSON.stringify(saved));

      onCreated(simDef);
      onClose();
      setName('');
      setEquation('A*sin(k*x - w*t)');
      setError('');
    } catch (e: any) {
      setError(`Invalid equation: ${e.message}`);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        style={{
          background: '#1a1a1a', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500,
          maxHeight: '80vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', margin: 0 }}>Custom Simulation</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {/* Name */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Simulation Name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Simple Harmonic Motion"
            style={{
              width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #333',
              borderRadius: 6, color: '#fff', fontSize: 13, fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Equation */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Equation (y = ...)</label>
          <input
            value={equation}
            onChange={e => setEquation(e.target.value)}
            placeholder="A*sin(k*x - w*t)"
            style={{
              width: '100%', padding: '8px 12px', background: '#0f0f0f', border: '1px solid #333',
              borderRadius: 6, color: '#22d3ee', fontSize: 13, fontFamily: 'DM Mono, monospace',
            }}
          />
          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
            Use x (position), t (time), and slider variable names. Math functions: sin, cos, exp, sqrt, PI, etc.
          </div>
        </div>

        {/* Sliders */}
        <div style={{ marginBottom: 16 }}>
          <div className="flex items-center justify-between mb-2">
            <label style={{ fontSize: 11, color: '#888' }}>Parameters (Sliders)</label>
            <button onClick={addSlider} className="btn btn-sm btn-secondary" style={{ padding: '2px 8px', fontSize: 11 }}>
              <Plus size={12} /> Add
            </button>
          </div>
          {sliders.map((s, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                value={s.key} onChange={e => updateSlider(i, 'key', e.target.value)}
                placeholder="var" style={{ width: 45, padding: '4px 6px', background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, color: '#22d3ee', fontSize: 11, fontFamily: 'DM Mono, monospace' }}
              />
              <input
                value={s.label} onChange={e => updateSlider(i, 'label', e.target.value)}
                placeholder="Label" style={{ flex: 1, padding: '4px 6px', background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11 }}
              />
              <input
                type="number" value={s.min} onChange={e => updateSlider(i, 'min', parseFloat(e.target.value) || 0)}
                style={{ width: 50, padding: '4px 4px', background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11 }}
              />
              <input
                type="number" value={s.max} onChange={e => updateSlider(i, 'max', parseFloat(e.target.value) || 10)}
                style={{ width: 50, padding: '4px 4px', background: '#0f0f0f', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 11 }}
              />
              <button onClick={() => removeSlider(i)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 2 }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {error && <div style={{ color: '#f87171', fontSize: 12, marginBottom: 12 }}>{error}</div>}

        <button onClick={handleSubmit} className="btn btn-primary" style={{ width: '100%' }}>
          Create Simulation
        </button>
      </div>
    </div>
  );
}
