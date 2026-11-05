import { nextInt, pick } from '@dcv/engine'
import { medium } from './medium.js'
import type { Strategy } from './types.js'

/**
 * How often Easy throws the plan away, in hundredths.
 *
 * This is per *decision*, and a turn is about five of them, so the noise
 * compounds: at 45 only some 5% of turns come out exactly as Medium would have
 * played them. That is the intended shape — recognisable intentions, rarely
 * carried all the way through. Measured over 20 games it scores about 9
 * reputation to Medium's 15, where the old uniform Easy scored 3.
 */
const NOISE = 45

/**
 * Medium's judgement, used about half the time.
 *
 * Easy used to be uniformly random, which made it not so much an easy opponent
 * as an absent one — it averaged about 3 reputation a game against Medium's
 * 14, so the first rung of the ladder was a cliff. Borrowing Medium's brain and
 * then ignoring it at random gives a player something that builds towards
 * patterns and then fumbles them, which is both beatable and worth beating.
 *
 * Scoring is never fumbled: leaving a finished card in hand reads as a bug
 * rather than as a weak opponent.
 */
export const easy: Strategy = {
  level: 'easy',
  chooseAction(view, actions, rng) {
    if (actions.length === 0) throw new Error('chooseAction called with no legal actions')

    const scoring = actions.filter((action) => action.type === 'scoreCard')
    if (scoring.length > 0) {
      const choice = pick(scoring, rng)
      return { action: choice.item, rng: choice.rng }
    }

    const roll = nextInt(rng, 100)
    if (roll.value < NOISE) {
      const choice = pick(actions, roll.rng)
      return { action: choice.item, rng: choice.rng }
    }

    return medium.chooseAction(view, actions, roll.rng)
  },
}
