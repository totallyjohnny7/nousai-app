import { useCallback } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  microLabel: string
  macroLabel: string
}

export default function ScaleSlider({ value, onChange, microLabel, macroLabel }: Props) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value))
  }, [onChange])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
      background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
    }}>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', color: '#06b6d4',
        minWidth: 60, textAlign: 'right', textTransform: 'uppercase',
      }}>{microLabel}</span>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: 2, transform: 'translateY(-50%)',
          background: 'linear-gradient(to right, #06b6d4, #a855f7)',
          borderRadius: 1, pointerEvents: 'none',
          filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.3)) drop-shadow(0 0 6px rgba(168,85,247,0.3))',
        }} />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={handleChange}
          aria-label="Scale position"
          style={{
            width: '100%', position: 'relative', zIndex: 1,
            appearance: 'none', background: 'transparent', cursor: 'pointer', height: 20,
          }}
        />
      </div>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', color: '#a855f7',
        minWidth: 60, textTransform: 'uppercase',
      }}>{macroLabel}</span>
      <span style={{
        fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)',
        minWidth: 28, textAlign: 'center',
      }}>{value}</span>
    </div>
  )
}
