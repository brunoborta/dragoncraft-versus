import { createStrategy } from '@dcv/ai'
import { BOARD, add, applyAction, canScore, createGame, legalActions, rotations, seedFrom, toPlayerView, topOf, winner } from '@dcv/engine'
import type { DragonType, GameState, Hex, Seat, ShopCard, Token } from '@dcv/engine'

/** `#debug` anywhere in the fragment. Kept pure so it can be tested. */
export function isDebugEnabled(hash: string): boolean {
  return hash.includes('debug')
}

const MAX_STEPS = 5000

/** Plays a whole game with both seats on the easy strategy, or until `stop` says so. */
export function playOut(seed: number, stop: (state: GameState) => boolean = () => false): GameState {
  const strategy = createStrategy('easy')
  let state = createGame(seed)
  let rng = seedFrom(`debug-${seed}`)

  for (let step = 0; state.phase !== 'ended' && step < MAX_STEPS && !stop(state); step += 1) {
    const actions = legalActions(state)
    if (actions.length === 0) break
    const chosen = strategy.chooseAction(toPlayerView(state, state.current), actions, rng)
    rng = chosen.rng
    state = applyAction(state, chosen.action)
  }

  return state
}

/** Tokens left in the bag where the jump to the end of the bag lands. */
const NEAR_END = 3

/**
 * A real game stopped at the start of `seat`'s turn with the bag a few draws
 * from empty and the end not yet set off — to watch the Final Round banner
 * and the crossed bag without playing forty turns. Like `findGame`, the state
 * is one the rules really produce.
 */
export function findNearEnd(seat: Seat, from: number): { seed: number; state: GameState } | null {
  const near = (state: GameState) =>
    state.current === seat &&
    !state.endTriggered &&
    state.bag.length > 0 &&
    state.bag.length <= NEAR_END &&
    state.pending.length === 1 &&
    state.pending[0].kind === 'place'
  for (let offset = 0; offset < MAX_SEEDS; offset += 1) {
    const seed = from + offset
    const state = playOut(seed, near)
    if (near(state)) return { seed, state }
  }
  return null
}

export type Outcome = 'win' | 'lose' | 'draw'

const MAX_SEEDS = 200

/**
 * A finished game with the outcome asked for, found by playing real games
 * rather than by building a final state by hand. A fabricated one would show a
 * screen the game cannot produce, which proves nothing about the ending —
 * and the ending is the thing being looked at.
 *
 * Roughly half of games go each way, so a win or a loss lands in a couple of
 * tries. A shared victory needs the same final score and the same number of
 * cards scored on both sides: about one game in twenty, so it takes a few
 * dozen — still well inside the cap, and fast, since a play-out is milliseconds.
 */
export function findGame(
  outcome: Outcome,
  seat: Seat,
  from: number,
): { seed: number; state: GameState } | null {
  for (let offset = 0; offset < MAX_SEEDS; offset += 1) {
    const seed = from + offset
    const state = playOut(seed)
    if (state.phase !== 'ended') continue

    const result = winner(state)
    const matches =
      outcome === 'win' ? result === seat : outcome === 'draw' ? result === 'draw' : result !== seat && result !== 'draw'
    if (matches) return { seed, state }
  }

  return null
}

/**
 * The token being placed swapped for a single of `type`, to see what it does
 * without waiting for the bag to hand one over. Only while a token is in hand
 * (the turn's first decision); otherwise the state as it was. The bag is not
 * told: a debug game is not a fair one.
 */
export function withHeld(state: GameState, type: DragonType): GameState {
  const top = state.pending[state.pending.length - 1]
  if (state.phase === 'ended' || top?.kind !== 'place') return state
  const token: Token = { kind: 'single', type }
  // the draw that put it in hand says so too: the screen tells what is in hand, and plays what is
  // placed, from the log
  let drawn = state.log.length - 1
  while (drawn >= 0 && !(state.log[drawn].seat === state.current && state.log[drawn].action.type === 'draw')) drawn--
  const log = drawn < 0 ? state.log : state.log.map((entry, i) => (i === drawn ? { ...entry, action: { type: 'draw' as const, token } } : entry))
  return { ...state, log, pending: [...state.pending.slice(0, -1), { ...top, token }] }
}

/** One more coin for `seat`, and this turn's spending forgotten, to spend one again. */
export function withCoin(state: GameState, seat: Seat): GameState {
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], coins: players[seat].coins + 1, coinSpentThisTurn: false }
  return { ...state, players }
}

/**
 * The bag down to its last token: the next draw empties it and sets off the
 * end, as it would, with its banner (the start of the next turn, or a crystal
 * fired up now). The tokens taken out are simply gone.
 */
export function withLastToken(state: GameState): GameState {
  if (state.phase === 'ended' || state.endTriggered || state.bag.length <= 1) return state
  return { ...state, bag: state.bag.slice(0, 1) }
}

/** The two shapes a card asks for (engine/cards): three in a line, three around a point. */
const SHAPES: readonly Hex[][] = [
  [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
  [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
]

/** A card for three tokens already standing in one of the shapes, turned any way: what the deck lacks, made up. */
function madeUp(board: GameState['board']): ShopCard | null {
  const topType = (hex: Hex) => {
    const top = topOf(board, hex)
    return top ? (top.kind === 'single' ? top.type : top.types[0]) : null
  }
  for (const shape of SHAPES) {
    for (const turned of rotations(shape.map((offset) => ({ offset, type: 'bread' as const })))) {
      for (const anchor of BOARD) {
        const types = turned.map((cell) => topType(add(anchor, cell.offset)))
        if (types.every((type) => type !== null)) {
          return { id: 'debug-card', reputation: 3, pattern: turned.map((cell, i) => ({ offset: cell.offset, type: types[i]! })) }
        }
      }
    }
  }
  return null
}

/**
 * A card the board fits right now in `seat`'s hand, in place of their last
 * one, which goes to the bottom of the deck: to watch a card score without
 * building its pattern. Taken from the deck, or, when none there fits, made up
 * for three tokens already in a line or a triangle. The state as it was when
 * one in hand already fits, or the board has no three to fit (the opening
 * ring has none).
 */
export function withScorable(state: GameState, seat: Seat): GameState {
  const hand = state.players[seat].hand
  if (state.phase === 'ended' || hand.length === 0 || hand.some((card) => canScore(state.board, card))) return state
  const fromDeck = state.deck.find((card) => canScore(state.board, card))
  const found = fromDeck ?? madeUp(state.board)
  if (!found) return state
  const given = hand[hand.length - 1]
  const players = [...state.players] as GameState['players']
  players[seat] = { ...players[seat], hand: [...hand.slice(0, -1), found] }
  return { ...state, players, deck: [...state.deck.filter((card) => card !== found), given] }
}
