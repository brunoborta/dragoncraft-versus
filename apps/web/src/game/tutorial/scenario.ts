import { DECK, DRAGON_TYPES, STARTING_COINS, dual, pick, seedFrom, single, tokenId } from '@dcv/engine'
import type { DragonType, GameState, HexKey, ShopCard, Token } from '@dcv/engine'

/** A token as a lesson writes it: one type, or the two of a dual. */
export type TokenSpec = DragonType | readonly [DragonType, DragonType]

export function token(spec: TokenSpec): Token {
  return typeof spec === 'string' ? single(spec) : dual(spec[0], spec[1])
}

function card(id: string): ShopCard {
  const found = DECK.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`no card ${id}`)
  return found
}

export type ScenarioSpec = {
  /** What stands on each space, bottom to top. */
  board?: Record<HexKey, readonly TokenSpec[]>
  /** The token seat 0 has just drawn and is about to place. */
  held: TokenSpec
  /** Tokens the lesson will draw: they are put in the bag, with filler around them. */
  bag?: readonly TokenSpec[]
  /** Singles added to the bag so it never runs dry by accident (default 12). */
  filler?: number
  hand?: readonly string[]
  opponentHand?: readonly string[]
  /** The deck, top first. Defaults to every card in neither hand. */
  deck?: readonly string[]
  coins?: number
  opponentCoins?: number
}

/**
 * A lesson's table, built by hand: the tutorial is not a game, so nothing in
 * it comes from a seed (spec, approach A). Seat 0 has just drawn `held` and is
 * to place it, exactly as a turn opens in the engine — the log says so, so
 * the screen shows the token in hand.
 */
export function scenario(spec: ScenarioSpec): GameState {
  const held = token(spec.held)
  const board: GameState['board'] = {}
  for (const [at, stack] of Object.entries(spec.board ?? {})) board[at] = stack.map(token)

  const filler = Array.from({ length: spec.filler ?? 12 }, (_, i) => single(DRAGON_TYPES[i % DRAGON_TYPES.length]))
  const hand = (spec.hand ?? []).map(card)
  const opponentHand = (spec.opponentHand ?? []).map(card)
  const used = new Set([...hand, ...opponentHand].map((c) => c.id))
  const deck = spec.deck ? spec.deck.map(card) : DECK.filter((c) => !used.has(c.id))
  const coins = spec.coins ?? STARTING_COINS

  return {
    rng: seedFrom('tutorial'),
    board,
    bag: [...(spec.bag ?? []).map(token), ...filler],
    extras: DRAGON_TYPES.map(single),
    extrasAdded: false,
    deck,
    players: [
      { hand, scored: [], coins, coinSpentThisTurn: false },
      { hand: opponentHand, scored: [], coins: spec.opponentCoins ?? STARTING_COINS, coinSpentThisTurn: false },
    ],
    current: 0,
    phase: 'play',
    pending: [{ kind: 'place', token: held, fireUpAllowed: true }],
    endTriggered: false,
    log: [{ seat: 0, action: { type: 'draw', token: held } }],
  }
}

/**
 * Arranges the bag so its next draws are `wanted`, in order. A pick reads only
 * the bag's length and the rng, so the slot each draw will take is known in
 * advance; the wanted token is put there. The bag's order is the one thing a
 * view never shows (it is sorted), so this changes nothing anyone can see.
 */
export function rig(state: GameState, wanted: readonly Token[]): GameState {
  const rest = [...state.bag]
  const placed: (Token | null)[] = state.bag.map(() => null)
  const free = state.bag.map((_, i) => i)
  let rng = state.rng

  for (const want of wanted) {
    const index = rest.findIndex((candidate) => tokenId(candidate) === tokenId(want))
    if (index === -1) throw new Error(`${tokenId(want)} is not in the bag`)
    rest.splice(index, 1)
    const drawn = pick(free, rng)
    rng = drawn.rng
    placed[drawn.item] = want
    free.splice(drawn.index, 1)
  }

  free.forEach((slot, i) => {
    placed[slot] = rest[i]
  })
  return { ...state, bag: placed as Token[] }
}
