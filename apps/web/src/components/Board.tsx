import { BOARD, hexEq, key } from '@dcv/engine'
import type { Board as BoardState, Hex, Token } from '@dcv/engine'
import { BOARD_VIEWBOX } from '../geometry.js'
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
    </svg>
  )
}
