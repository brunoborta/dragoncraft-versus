import { BOARD, key } from '@dcv/engine'
import type { Board as BoardState, Hex } from '@dcv/engine'
import { BOARD_VIEWBOX } from '../geometry.js'
import { HexCell, type Highlight } from './HexCell.js'

export function Board({
  board,
  highlights,
  onSelectHex,
}: {
  board: BoardState
  highlights: Record<string, Highlight>
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
          onSelect={onSelectHex}
        />
      ))}
    </svg>
  )
}
