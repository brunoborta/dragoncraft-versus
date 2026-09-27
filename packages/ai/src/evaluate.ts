import { BOARD, bankedReputation, canReceive, canScore, single, wouldComplete } from '@dcv/engine'
import type { Board, GameState, Seat, ShopCard } from '@dcv/engine'

/** Is there a single placement that would complete this card? */
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

/**
 * How good this position is for `seat`. Reputation already banked dominates;
 * a card that matches right now is worth most of a card scored; a card one
 * placement away is worth a little. Coins count because they score at the end.
 */
export function evaluate(state: GameState, seat: Seat): number {
  const player = state.players[seat]

  const banked = bankedReputation(player)
  let ready = 0
  let close = 0
  for (const card of player.hand) {
    if (canScore(state.board, card)) ready += card.reputation
    else if (isOneAway(state.board, card)) close += card.reputation
  }

  return banked * SCORED_WEIGHT + ready * READY_WEIGHT + close * CLOSE_WEIGHT + player.coins
}
