import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

export type Highlight = 'legal' | 'completes' | 'selected'

export function HexCell({
  hex,
  stack,
  highlight,
  onSelect,
}: {
  hex: Hex
  stack: Token[]
  highlight?: Highlight
  onSelect: (hex: Hex) => void
}) {
  const top = stack[stack.length - 1]
  const center = hexCenter(hex)
  const label = top ? `${key(hex)}: ${tokenLabel(top)}, stack of ${stack.length}` : `${key(hex)}: empty`

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      data-highlight={highlight ?? 'none'}
      className="hex-cell"
      onClick={() => onSelect(hex)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(hex)
      }}
    >
      <polygon points={hexPoints(hex)} className="hex-shape" />
      {top ? (
        <g transform={`translate(${center.x} ${center.y})`}>
          <TokenGlyph token={top} radius={HEX_SIZE * 0.6} />
          {stack.length > 1 ? (
            <text
              className="stack-depth"
              x={HEX_SIZE * 0.62}
              y={HEX_SIZE * 0.62}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={HEX_SIZE * 0.45}
            >
              {stack.length}
            </text>
          ) : null}
        </g>
      ) : null}
    </g>
  )
}
