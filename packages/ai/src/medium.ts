import { applyAction, determinize, shuffle } from '@dcv/engine'
import type { Action, Seat } from '@dcv/engine'
import { evaluate } from './evaluate.js'
import type { Strategy } from './types.js'

/**
 * Cap on how many candidate actions get simulated. Potion alone can offer
 * over 170 swaps, and evaluating every one buys very little on a phone.
 */
const MAX_CANDIDATES = 40

const OPPONENT_WEIGHT = 0.5

/**
 * One ply of greed over a single determinization: guess a plausible hidden
 * state, try each candidate action, keep the one whose resulting position
 * scores best for us and worst for them.
 *
 * Known limitation, accepted: a turn is a sequence of decisions, so choosing
 * where to place without knowing what the fire-up will do is myopic. That is
 * part of what makes this the medium opponent.
 */
export const medium: Strategy = {
  level: 'medium',
  chooseAction(view, actions, rng) {
    if (actions.length === 0) throw new Error('chooseAction called with no legal actions')

    const order = shuffle(actions, rng)
    const candidates = order.items.slice(0, MAX_CANDIDATES)
    const guess = determinize(view, order.rng)
    const opponent = (1 - view.seat) as Seat

    let best: Action = candidates[0]
    let bestScore = -Infinity

    for (const action of candidates) {
      const next = applyAction(guess.state, action)
      const score = evaluate(next, view.seat) - evaluate(next, opponent) * OPPONENT_WEIGHT
      if (score > bestScore) {
        bestScore = score
        best = action
      }
    }

    return { action: best, rng: guess.rng }
  },
}
