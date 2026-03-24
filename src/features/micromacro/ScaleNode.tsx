import { memo } from 'react'

interface Props {
  emoji: string
  color: string
  label: string
  position: number
  selected: boolean
  opacity: number
  onClick: () => void
}

const ScaleNodeComponent = memo(function ScaleNodeComponent({ emoji, color, label, position, selected, opacity, onClick }: Props) {
  return (
    <g
      onClick={onClick}
      style={{ cursor: 'pointer', opacity, transition: 'opacity 0.3s ease' }}
      role="button"
      tabIndex={0}
      aria-label={`${label} at position ${position}`}
      onKeyDown={e => { if (e.key === 'Enter') onClick() }}
    >
      <circle
        cx={0} cy={0} r={28}
        fill={`${color}33`}
        stroke={color}
        strokeWidth={selected ? 2.5 : 1.5}
        style={selected ? {
          filter: `drop-shadow(0 0 12px ${color}66)`,
        } : undefined}
      />
      {selected && (
        <circle
          cx={0} cy={0} r={32}
          fill="none"
          stroke={color}
          strokeWidth={1}
          opacity={0.4}
        >
          <animate attributeName="r" values="32;36;32" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.15;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={22}
        style={{ pointerEvents: 'none' }}
      >
        {emoji}
      </text>
      <text
        y={44}
        textAnchor="middle"
        fontSize={10}
        fill="var(--text-secondary)"
        fontFamily="var(--font-heading)"
        fontWeight={500}
        style={{ pointerEvents: 'none' }}
      >
        {label.length > 16 ? label.slice(0, 14) + '…' : label}
      </text>
    </g>
  )
})

export default ScaleNodeComponent
