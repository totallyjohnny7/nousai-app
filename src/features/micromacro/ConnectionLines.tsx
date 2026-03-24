import { memo } from 'react'
import type { ScaleNode } from '../../types'

interface Props {
  nodes: ScaleNode[]
  getX: (position: number) => number
  canvasHeight: number
}

const ConnectionLines = memo(function ConnectionLines({ nodes, getX, canvasHeight }: Props) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const cy = canvasHeight / 2
  const lines: { x1: number; x2: number; color: string; key: string }[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    for (const targetId of node.links_to) {
      const pairKey = [node.id, targetId].sort().join('-')
      if (seen.has(pairKey)) continue
      seen.add(pairKey)
      const target = nodeMap.get(targetId)
      if (!target) continue
      lines.push({
        x1: getX(node.position),
        x2: getX(target.position),
        color: node.color,
        key: pairKey,
      })
    }
  }

  return (
    <g>
      {lines.map(l => (
        <line
          key={l.key}
          x1={l.x1} y1={cy}
          x2={l.x2} y2={cy}
          stroke={l.color}
          strokeWidth={1}
          strokeDasharray="6 4"
          opacity={0.25}
        />
      ))}
    </g>
  )
})

export default ConnectionLines
