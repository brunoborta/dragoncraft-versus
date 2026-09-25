import { canReceive, pushToken, topOf } from './board.js'
import { BOARD, add, onBoard, rotate } from './hex.js'
import { tokenMatches } from './tokens.js'
import type { Board, Hex, PatternCell, ShopCard, Token } from './types.js'

function rotatePattern(pattern: readonly PatternCell[]): PatternCell[] {
  return pattern.map((cell) => ({ offset: rotate(cell.offset), type: cell.type }))
}

/** The card's 6 orientations. Symmetric patterns repeat some; that is harmless. */
export function rotations(pattern: readonly PatternCell[]): PatternCell[][] {
  const out: PatternCell[][] = []
  let current: PatternCell[] = [...pattern]
  for (let i = 0; i < 6; i++) {
    out.push(current)
    current = rotatePattern(current)
  }
  return out
}

function matchAt(board: Board, pattern: readonly PatternCell[], anchor: Hex): Hex[] | null {
  const hexes: Hex[] = []
  for (const cell of pattern) {
    const hex = add(anchor, cell.offset)
    if (!onBoard(hex)) return null
    const top = topOf(board, hex)
    if (!top || !tokenMatches(top, cell.type)) return null
    hexes.push(hex)
  }
  return hexes
}

/** The spaces satisfying the card, or null. 6 rotations x 19 anchors x 3 cells. */
export function findMatch(board: Board, card: ShopCard): Hex[] | null {
  for (const pattern of rotations(card.pattern)) {
    for (const anchor of BOARD) {
      const hit = matchAt(board, pattern, anchor)
      if (hit) return hit
    }
  }
  return null
}

export function canScore(board: Board, card: ShopCard): boolean {
  return findMatch(board, card) !== null
}

/**
 * Does placing `token` on `hex` make `card` scoreable when it was not before?
 * Drives the board highlight and one term of the machine's evaluation.
 */
export function wouldComplete(board: Board, card: ShopCard, hex: Hex, token: Token): boolean {
  if (!canReceive(board, hex)) return false
  if (canScore(board, card)) return false
  return canScore(pushToken(board, hex, token), card)
}
