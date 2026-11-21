import { createStrategy } from '@dcv/ai'
import { applyAction, createGame, legalActions, seedFrom, toPlayerView, winner } from '@dcv/engine'
import type { GameState, Seat } from '@dcv/engine'

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
