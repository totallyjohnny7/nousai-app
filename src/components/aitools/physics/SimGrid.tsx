import { SIM_REGISTRY } from './registry';

interface SimGridProps {
  active: string;
  onSelect: (id: string) => void;
}

export function SimGrid({ active, onSelect }: SimGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {SIM_REGISTRY.map(s => {
        const isActive = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
              padding: '10px 14px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              background: isActive ? '#fff' : '#1a1a1a',
              color: isActive ? '#0f0f0f' : '#999',
              transition: 'all 0.15s',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 12, color: isActive ? '#0f0f0f' : '#e0e0e0' }}>
              {s.title}
            </div>
            <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 400, marginTop: 2 }}>
              {s.subtitle}
            </div>
          </button>
        );
      })}
    </div>
  );
}
