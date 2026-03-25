import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import type { ScaleNode } from '../../types'
import ScaleNodeComponent from './ScaleNode'
import ConnectionLines from './ConnectionLines'

interface Props {
  nodes: ScaleNode[]
  currentPosition: number
  selectedNodeId: string | null
  onSelectNode: (id: string) => void
  onPositionChange: (pos: number) => void
}

const CANVAS_PADDING = 80
const NODE_VISIBILITY_RANGE = 20

export default function ScaleCanvas({ nodes, currentPosition, selectedNodeId, onSelectNode, onPositionChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width: w, height: h } = entries[0].contentRect
      setWidth(Math.max(w, 200))
      setHeight(Math.max(h, 200))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const getX = useCallback((position: number) => {
    return CANVAS_PADDING + (position / 100) * (width - CANVAS_PADDING * 2)
  }, [width])

  const cy = height / 2

  const getOpacity = useCallback((nodePos: number) => {
    const dist = Math.abs(nodePos - currentPosition)
    if (dist <= NODE_VISIBILITY_RANGE) return 1
    return Math.max(0.15, 1 - (dist - NODE_VISIBILITY_RANGE) / 40)
  }, [currentPosition])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 2 : -2
    onPositionChange(Math.max(0, Math.min(100, currentPosition + delta)))
  }, [currentPosition, onPositionChange])

  // Drag support
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('g[role="button"]')) return
    draggingRef.current = true
    lastXRef.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return
    const dx = e.clientX - lastXRef.current
    lastXRef.current = e.clientX
    const range = width - CANVAS_PADDING * 2
    const dPos = -(dx / range) * 100
    onPositionChange(Math.max(0, Math.min(100, currentPosition + dPos)))
  }, [currentPosition, onPositionChange, width])

  const handlePointerUp = useCallback(() => { draggingRef.current = false }, [])

  const gradientX = useMemo(() => `${(currentPosition / 100) * 100}%`, [currentPosition])
  const indicatorX = getX(currentPosition)

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      style={{
        flex: 1, position: 'relative', overflow: 'hidden', cursor: 'grab',
        background: `radial-gradient(ellipse at ${gradientX} 50%, rgba(168,85,247,0.04) 0%, transparent 60%)`,
        backgroundColor: '#08080f',
        touchAction: 'none',
      }}
    >
      <svg width={width} height={height} style={{ display: 'block', willChange: 'transform' }}>
        {/* Axis line */}
        <defs>
          <linearGradient id="axis-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <filter id="axis-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <line
          x1={CANVAS_PADDING} y1={cy}
          x2={width - CANVAS_PADDING} y2={cy}
          stroke="url(#axis-grad)"
          strokeWidth={2}
          filter="url(#axis-glow)"
        />

        {/* Position indicator */}
        <line
          x1={indicatorX} y1={cy - 60}
          x2={indicatorX} y2={cy + 60}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <circle
          cx={indicatorX} cy={cy}
          r={4}
          fill="rgba(255,255,255,0.3)"
        />

        {/* Connection lines */}
        <ConnectionLines nodes={nodes} getX={getX} canvasHeight={height} />

        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id} transform={`translate(${getX(node.position)}, ${cy})`}>
            <ScaleNodeComponent
              emoji={node.emoji}
              color={node.color}
              label={node.label}
              position={node.position}
              selected={node.id === selectedNodeId}
              opacity={getOpacity(node.position)}
              onClick={() => onSelectNode(node.id)}
            />
          </g>
        ))}

        {/* End labels */}
        <text x={CANVAS_PADDING} y={cy + 80} textAnchor="middle" fontSize={10}
          fill="#06b6d4" fontFamily="var(--font-mono)" opacity={0.6}>
          0
        </text>
        <text x={width - CANVAS_PADDING} y={cy + 80} textAnchor="middle" fontSize={10}
          fill="#a855f7" fontFamily="var(--font-mono)" opacity={0.6}>
          100
        </text>
      </svg>
    </div>
  )
}
