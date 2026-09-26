import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

export type Highlight = 'legal' | 'selected'

/**
 * A cell paints its own shape and token only. The highlight ring and the stack
 * badge live in the board's overlay, drawn after every cell: rendered here they
 * would be overpainted along each edge by whichever neighbour comes later,
 * which is what made a ring thick on three sides and thin on the other three,
 * and what clipped the stack numbers.
 */

export function HexCell({
  hex,
  stack,
  highlight,
  preview,
  onSelect,
}: {
  hex: Hex
  stack: Token[]
  highlight?: Highlight
  /** The token about to land here, drawn translucent until the second tap confirms. */
  preview?: Token
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
        </g>
      ) : null}
      {preview ? (
        <g className="token-preview" transform={`translate(${center.x} ${center.y})`}>
          <TokenGlyph token={preview} radius={HEX_SIZE * 0.6} />
          <circle r={HEX_SIZE * 0.6} className="token-preview-ring" />
        </g>
      ) : null}
    </g>
  )
}
