import { DECK } from './cards.js'
import { INNER_RING, key } from './hex.js'
import { pick, shuffle } from './rng.js'
import { ALL_TOKENS, fireUpRank, single, tokenId } from './tokens.js'
import { DRAGON_TYPES, type Board, type GameState, type PlayerState, type RngState, type Seat, type Token } from './types.js'

export const STARTING_COINS = 3
export const HAND_SIZE = 2

/** One artisan of each type. Used twice: starting board and extra tokens. */
export function oneOfEach(): Token[] {
  return DRAGON_TYPES.map(single)
}

function emptyPlayer(): PlayerState {
  return { hand: [], scored: [], coins: STARTING_COINS, coinSpentThisTurn: false }
}

/** Removes one instance of each given token, compared by type identity. */
function removeTokens(pool: readonly Token[], remove: readonly Token[]): Token[] {
  const out = [...pool]
  for (const token of remove) {
    const index = out.findIndex((t) => tokenId(t) === tokenId(token))
    if (index === -1) throw new Error(`token ${tokenId(token)} is not in the pool`)
    out.splice(index, 1)
  }
  return out
}

/**
 * Each player draws a token; the higher one on the Fire Up Chart goes first.
 * A dual counts as the higher of its 2 types and beats a single on a tie.
 * A genuine tie: both return their tokens and draw again.
 */
function determineFirstPlayer(bag: readonly Token[], seed: RngState): { seat: Seat; rng: RngState } {
  let rng = seed
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = pick(bag, rng)
    rng = a.rng
    const b = pick(bag.filter((_, i) => i !== a.index), rng)
    rng = b.rng

    const rankA = fireUpRank(a.item)
    const rankB = fireUpRank(b.item)
    if (rankA !== rankB) return { seat: rankA < rankB ? 0 : 1, rng }

    const dualA = a.item.kind === 'dual'
    const dualB = b.item.kind === 'dual'
    if (dualA !== dualB) return { seat: dualA ? 0 : 1, rng }
  }
  return { seat: 0, rng }
}

/**
 * State right after setup, before the first token is drawn.
 * `createGame` (Task 8) is what opens the turn.
 */
export function createInitialState(seed: RngState): GameState {
  let rng = seed

  const placed = shuffle(oneOfEach(), rng)
  rng = placed.rng
  const board: Board = {}
  INNER_RING.forEach((hex, i) => {
    board[key(hex)] = [placed.items[i]]
  })

  const extras = oneOfEach()
  const bag = removeTokens(ALL_TOKENS, [...placed.items, ...extras])

  const shuffled = shuffle(DECK, rng)
  rng = shuffled.rng

  const players: [PlayerState, PlayerState] = [
    { ...emptyPlayer(), hand: shuffled.items.slice(0, HAND_SIZE) },
    { ...emptyPlayer(), hand: shuffled.items.slice(HAND_SIZE, HAND_SIZE * 2) },
  ]
  const deck = shuffled.items.slice(HAND_SIZE * 2)

  const first = determineFirstPlayer(bag, rng)
  rng = first.rng

  return {
    rng,
    board,
    bag,
    extras,
    extrasAdded: false,
    deck,
    players,
    current: first.seat,
    phase: 'play',
    pending: [],
    endTriggered: false,
    log: [],
  }
}
