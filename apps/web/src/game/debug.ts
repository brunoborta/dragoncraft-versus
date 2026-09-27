import { createStrategy } from '@dcv/ai'
import { applyAction, createGame, legalActions, seedFrom, toPlayerView, winner } from '@dcv/engine'
import type { GameState, Seat } from '@dcv/engine'

/** `#debug` anywhere in the fragment. Kept pure so it can be tested. */
export function isDebugEnabled(hash: string): boolean {
  return hash.includes('debug')
}

const MAX_STEPS = 5000

/** Plays a whole game with both seats on the easy strategy. */
export function playOut(seed: number): GameState {
  const strategy = createStrategy('easy')
  let state = createGame(seed)
  let rng = seedFrom(`debug-${seed}`)

  for (let step = 0; state.phase !== 'ended' && step < MAX_STEPS; step += 1) {
    const actions = legalActions(state)
    if (actions.length === 0) break
    const chosen = strategy.chooseAction(toPlayerView(state, state.current), actions, rng)
    rng = chosen.rng
    state = applyAction(state, chosen.action)
  }

  return state
}

export type Outcome = 'win' | 'lose'

const MAX_SEEDS = 200

/**
 * A finished game with the outcome asked for, found by playing real games
 * rather than by building a final state by hand. A fabricated one would show a
 * screen the game cannot produce, which proves nothing about the ending —
 * and the ending is the thing being looked at.
 *
 * Roughly half of games go each way, so this lands in a couple of tries.
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
    const matches = outcome === 'win' ? result === seat : result !== seat && result !== 'draw'
    if (matches) return { seed, state }
  }

  return null
}
