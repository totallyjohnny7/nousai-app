import type { SliderConfig } from './types';

interface SimSlidersProps {
  sliders: SliderConfig[];
  params: Record<string, number>;
  onChange: (params: Record<string, number>) => void;
}

export function SimSliders({ sliders, params, onChange }: SimSlidersProps) {
  if (sliders.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {sliders.map(s => (
        <div key={s.key} className="flex items-center gap-2">
          <label className="text-xs text-muted" style={{ minWidth: 80 }}>{s.label}:</label>
          <input
            type="range"
            min={s.min}
            max={s.max}
            step={s.step}
            value={params[s.key] ?? s.default}
            onChange={e => onChange({ ...params, [s.key]: parseFloat(e.target.value) })}
            style={{ flex: 1 }}
          />
          <span className="text-xs" style={{ minWidth: 50, fontWeight: 600 }}>
            {(params[s.key] ?? s.default).toFixed(s.step < 1 ? 1 : 0)} {s.unit}
          </span>
        </div>
      ))}
    </div>
  );
}
