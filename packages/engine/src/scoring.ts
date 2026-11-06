import { canScore } from './matcher.js'
import type { GameState, PlayerView, Seat, ShopCard } from './types.js'

/** Cards in a seat's hand whose pattern is currently on the board. */
export function scoreableCards(state: GameState, seat: Seat): ShopCard[] {
  return state.players[seat].hand.filter((card) => canScore(state.board, card))
}

/**
 * Reputation actually banked: what scored cards are worth, and nothing else.
 * This is the number a player watches during the game. It asks for only the
 * field the rule uses, because a `PlayerView`'s opponent is not a whole
 * `PlayerState` — it has no hand.
 */
export function bankedReputation(player: { scored: readonly ShopCard[] }): number {
  return player.scored.reduce((sum, card) => sum + card.reputation, 0)
}

/**
 * Banked reputation plus 1 per unspent coin. Coins convert at the end of the
 * game and not before, so this line is the single place that knows they ever
 * do — a live panel showing it would start every player at 3 and dock them a
 * point for spending a coin.
 */
export function finalScore(player: Scorable): number {
  return bankedReputation(player) + player.coins
}

/**
 * The fields the final tally reads. A `PlayerView`'s opponent has them, so
 * the screen a remote player ends on can be settled from the view alone.
 */
export type Scorable = { scored: readonly ShopCard[]; coins: number }

/** Most reputation wins; ties break on scored cards, then it is a shared victory. */
function decide(first: Scorable, second: Scorable): 0 | 1 | 'draw' {
  const a = finalScore(first)
  const b = finalScore(second)
  if (a !== b) return a > b ? 0 : 1

  if (first.scored.length !== second.scored.length) return first.scored.length > second.scored.length ? 0 : 1

  return 'draw'
}

export function winner(state: GameState): Seat | 'draw' {
  return decide(state.players[0], state.players[1])
}

/** The same verdict as `winner`, from what one seat can see. */
export function winnerOfView(view: PlayerView): Seat | 'draw' {
  const result = decide(view.you, view.opponent)
  if (result === 'draw') return 'draw'
  return result === 0 ? view.seat : ((1 - view.seat) as Seat)
}
