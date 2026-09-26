import { key, single } from '@dcv/engine'
import type { PatternCell } from '@dcv/engine'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { TokenGlyph } from './TokenGlyph.js'

/** The card pattern in miniature, drawn with the same geometry as the board. */
export function PatternGlyph({ pattern }: { pattern: readonly PatternCell[] }) {
  const centers = pattern.map((cell) => hexCenter(cell.offset))
  const pad = HEX_SIZE * 1.2
  const minX = Math.min(...centers.map((c) => c.x)) - pad
  const maxX = Math.max(...centers.map((c) => c.x)) + pad
  const minY = Math.min(...centers.map((c) => c.y)) - pad
  const maxY = Math.max(...centers.map((c) => c.y)) + pad

  return (
    <svg className="pattern" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} aria-hidden="true">
      {pattern.map((cell) => {
        const center = hexCenter(cell.offset)
        return (
          <g key={key(cell.offset)}>
            <polygon className="pattern-hex" points={hexPoints(cell.offset)} />
            <g transform={`translate(${center.x} ${center.y})`}>
              <TokenGlyph token={single(cell.type)} radius={HEX_SIZE * 0.6} />
            </g>
          </g>
        )
      })}
    </svg>
  )
}
