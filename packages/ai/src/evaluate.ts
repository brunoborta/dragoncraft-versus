import { BOARD, bankedReputation, canReceive, canScore, single, wouldComplete } from '@dcv/engine'
import type { Board, GameState, Seat, ShopCard } from '@dcv/engine'
import { outlookScan, scanBoard, type BoardScan } from './patterns.js'

/**
 * Is there a single placement that would complete this card?
 *
 * The readable statement of the question, straight out of the engine's own
 * primitives. `patterns.ts` answers it something like sixty times faster and
 * is what both strategies actually call; this is what that answer is checked
 * against in `score.test.ts`, for every card over several hundred boards taken
 * from real games. Keeping it is the point — a fast path with nothing to
 * compare itself to is a fast path nobody can trust.
 */
export function isOneAway(board: Board, card: ShopCard): boolean {
  if (canScore(board, card)) return false
  const types = [...new Set(card.pattern.map((cell) => cell.type))]
  for (const hex of BOARD) {
    if (!canReceive(board, hex)) continue
    for (const type of types) {
      if (wouldComplete(board, card, hex, single(type))) return true
    }
  }
  return false
}

const SCORED_WEIGHT = 10
const READY_WEIGHT = 6
const CLOSE_WEIGHT = 2

/** `evaluate` for a board already reduced to integers, so both seats share one. */
export function evaluateWith(scan: BoardScan, state: GameState, seat: Seat): number {
  const player = state.players[seat]

  let ready = 0
  let close = 0
  for (const card of player.hand) {
    const how = outlookScan(scan, card)
    if (how === 'ready') ready += card.reputation
    else if (how === 'close') close += card.reputation
  }

  return (
    bankedReputation(player) * SCORED_WEIGHT +
    ready * READY_WEIGHT +
    close * CLOSE_WEIGHT +
    player.coins
  )
}

/**
 * How good this position is for `seat`. Reputation already banked dominates;
 * a card that matches right now is worth most of a card scored; a card one
 * placement away is worth a little. Coins count because they score at the end.
 */
export function evaluate(state: GameState, seat: Seat): number {
  return evaluateWith(scanBoard(state.board), state, seat)
}
