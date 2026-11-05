import { searchTurn, type SearchConfig } from './search.js'
import type { Strategy } from './types.js'

/**
 * Tuned against the clock: the interface gives the opponent 400ms to think and
 * the search runs on the main thread, so what matters is the worst move of a
 * game, not the average one. This settles at about 9ms a decision and 81ms at
 * worst.
 *
 * Measured over 20 games against Medium, widening from 4/2 to 8/3 took the
 * scoreline from 25.8 to 28.8 for two and a half times the work. Going on to
 * 16/4 bought 1.4 more points and pushed the worst decision to 248ms, which is
 * long enough to feel like a dropped frame — so it stops here.
 */
export const HARD_CONFIG: SearchConfig = {
  width: 8,
  candidateCap: 96,
  samples: 3,
  maxDepth: 12,
}

/**
 * Searches the whole turn, prices coins at what the rules pay for them, and
 * subtracts what the board is handing the opponent.
 */
export const hard: Strategy = {
  level: 'hard',
  chooseAction(view, actions, rng) {
    return searchTurn(view, actions, rng, HARD_CONFIG)
  },
}
