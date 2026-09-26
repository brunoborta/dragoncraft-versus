import { canScore } from './matcher.js'
import type { GameState, Seat, ShopCard } from './types.js'

/** Cards in a seat's hand whose pattern is currently on the board. */
export function scoreableCards(state: GameState, seat: Seat): ShopCard[] {
  return state.players[seat].hand.filter((card) => canScore(state.board, card))
}

/**
 * Scored reputation plus 1 per unspent coin. The single home of the rule: the
 * live panels in the UI read it too, so the board can never disagree with the
 * final screen. It asks for only the two fields the rule uses, because a
 * `PlayerView`'s opponent is not a whole `PlayerState` — it has no hand.
 */
export function scoreOf(player: { scored: readonly ShopCard[]; coins: number }): number {
  return player.scored.reduce((sum, card) => sum + card.reputation, 0) + player.coins
}

export function finalScore(state: GameState, seat: Seat): number {
  return scoreOf(state.players[seat])
}

/** Most reputation wins; ties break on scored cards, then it is a shared victory. */
export function winner(state: GameState): Seat | 'draw' {
  const a = finalScore(state, 0)
  const b = finalScore(state, 1)
  if (a !== b) return a > b ? 0 : 1

  const cardsA = state.players[0].scored.length
  const cardsB = state.players[1].scored.length
  if (cardsA !== cardsB) return cardsA > cardsB ? 0 : 1

  return 'draw'
}
