import { DECK } from './cards.js'
import { shuffle } from './rng.js'
import { oneOfEach } from './setup.js'
import { tokenId } from './tokens.js'
import type { GameState, PlayerState, PlayerView, RngState, Seat, Token } from './types.js'

/**
 * Code-unit order, deliberately not `localeCompare`: bag order decides which
 * token a simulation draws, so the comparator has to be locale-independent.
 */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function sortTokens(tokens: readonly Token[]): Token[] {
  return [...tokens].sort((a, b) => compareIds(tokenId(a), tokenId(b)))
}

/**
 * What a seat may see. The opponent hand and the deck order stay out; the
 * bag composition goes in, because counting the board already reveals it.
 */
export function toPlayerView(state: GameState, seat: Seat): PlayerView {
  const opponent = state.players[1 - seat]
  return {
    seat,
    board: state.board,
    bag: sortTokens(state.bag),
    extrasAdded: state.extrasAdded,
    deckCount: state.deck.length,
    you: state.players[seat],
    opponent: {
      handCount: opponent.hand.length,
      scored: opponent.scored,
      coins: opponent.coins,
      coinSpentThisTurn: opponent.coinSpentThisTurn,
    },
    current: state.current,
    phase: state.phase,
    pending: state.pending,
    endTriggered: state.endTriggered,
    log: state.log,
  }
}

/**
 * Fills in what the view hides with a consistent guess: the machine guesses,
 * it never peeks. This is what makes simulating from a view possible.
 */
export function determinize(view: PlayerView, seed: RngState): { state: GameState; rng: RngState } {
  const known = new Set([...view.you.hand, ...view.you.scored, ...view.opponent.scored].map((c) => c.id))
  const unknown = DECK.filter((card) => !known.has(card.id))

  const shuffled = shuffle(unknown, seed)
  const opponentHand = shuffled.items.slice(0, view.opponent.handCount)
  const deck = shuffled.items.slice(view.opponent.handCount)
  if (deck.length !== view.deckCount) {
    throw new Error(`inconsistent view: deck of ${deck.length} where the view says ${view.deckCount}`)
  }

  const opponent: PlayerState = {
    hand: opponentHand,
    scored: view.opponent.scored,
    coins: view.opponent.coins,
    coinSpentThisTurn: view.opponent.coinSpentThisTurn,
  }
  const players: [PlayerState, PlayerState] =
    view.seat === 0 ? [view.you, opponent] : [opponent, view.you]

  return {
    state: {
      rng: shuffled.rng,
      board: view.board,
      bag: view.bag,
      extras: view.extrasAdded ? [] : oneOfEach(),
      extrasAdded: view.extrasAdded,
      deck,
      players,
      current: view.current,
      phase: view.phase,
      pending: view.pending,
      endTriggered: view.endTriggered,
      log: view.log,
    },
    rng: shuffled.rng,
  }
}
