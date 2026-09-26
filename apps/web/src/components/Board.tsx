import { BOARD, hexEq, key } from '@dcv/engine'
import type { Board as BoardState, Hex, Token } from '@dcv/engine'
import { BOARD_VIEWBOX, HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { HexCell, type Highlight } from './HexCell.js'

export function Board({
  board,
  highlights,
  preview,
  onSelectHex,
}: {
  board: BoardState
  highlights: Record<string, Highlight>
  /** What the spec calls the preview: the held token, shown on the space it would land on. */
  preview?: { hex: Hex; token: Token }
  onSelectHex: (hex: Hex) => void
}) {
  return (
    <svg className="board" viewBox={BOARD_VIEWBOX} role="group" aria-label="Game board">
      {BOARD.map((hex) => (
        <HexCell
          key={key(hex)}
          hex={hex}
          stack={board[key(hex)] ?? []}
          highlight={highlights[key(hex)]}
          preview={preview && hexEq(preview.hex, hex) ? preview.token : undefined}
          onSelect={onSelectHex}
        />
      ))}
      {/*
        Drawn after every cell, so nothing can paint over it. Rings and badges
        rendered inside their own cell lose whatever a later neighbour covers.
        `pointer-events: none` keeps the cells underneath clickable.
      */}
      <g className="board-overlay" aria-hidden="true">
        {BOARD.filter((hex) => highlights[key(hex)]).map((hex) => (
          <polygon
            key={`ring-${key(hex)}`}
            className="hex-ring"
            data-highlight={highlights[key(hex)]}
            points={hexPoints(hex)}
          />
        ))}
        {BOARD.map((hex) => {
          const stack = board[key(hex)] ?? []
          // one token buries nothing, so there is no count worth showing
          if (stack.length < 2) return null
          const center = hexCenter(hex)
          return (
            <g
              key={`badge-${key(hex)}`}
              className="stack-badge"
              transform={`translate(${center.x + HEX_SIZE * 0.48} ${center.y - HEX_SIZE * 0.48})`}
            >
              <circle r={HEX_SIZE * 0.3} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={HEX_SIZE * 0.36}>
                {stack.length}
              </text>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
