import { searchTurn, type SearchConfig } from './search.js'
import type { Strategy } from './types.js'

/**
 * Tuned against the clock, not against taste: the interface gives the opponent
 * 400ms to think, and the search has to finish inside that on a phone.
 * Simulating is nearly free — `applyAction` costs a hundredth of a
 * millisecond — while scoring a position costs a tenth of one, so the budget
 * is spent almost entirely on how many positions get scored.
 */
export const HARD_CONFIG: SearchConfig = {
  width: 4,
  candidateCap: 72,
  samples: 2,
  maxDepth: 10,
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
