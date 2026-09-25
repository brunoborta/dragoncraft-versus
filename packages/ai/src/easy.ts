import { pick } from '@dcv/engine'
import type { Strategy } from './types.js'

/** Uniform among the legal actions, with a single bias: always score if you can. */
export const easy: Strategy = {
  level: 'easy',
  chooseAction(_view, actions, rng) {
    if (actions.length === 0) throw new Error('chooseAction called with no legal actions')
    const scoring = actions.filter((action) => action.type === 'scoreCard')
    const pool = scoring.length > 0 ? scoring : actions
    const choice = pick(pool, rng)
    return { action: choice.item, rng: choice.rng }
  },
}
