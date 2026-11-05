import { createGame, legalActions, nextInt, toPlayerView } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'
import { medium } from './medium.js'

describe('easy', () => {
  it('always picks one of the offered actions', () => {
    let rng = 5
    for (let seed = 0; seed < 20; seed++) {
      const state = createGame(seed)
      const actions = legalActions(state)
      const chosen = easy.chooseAction(toPlayerView(state, state.current), actions, rng)
      rng = chosen.rng
      expect(actions).toContainEqual(chosen.action)
    }
  })

  it('always scores when scoring is on offer', () => {
    const state = createGame(1)
    const view = toPlayerView(state, state.current)
    const actions = [
      { type: 'endTurn' } as const,
      { type: 'scoreCard', cardId: 'line-bread' } as const,
      { type: 'spendCoin' } as const,
    ]
    expect(easy.chooseAction(view, actions, 9).action).toEqual({ type: 'scoreCard', cardId: 'line-bread' })
  })

  it('is deterministic for the same rng state', () => {
    const state = createGame(3)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    expect(easy.chooseAction(view, actions, 77)).toEqual(easy.chooseAction(view, actions, 77))
  })

  it('advances the rng so consecutive calls can differ', () => {
    const state = createGame(3)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    const first = easy.chooseAction(view, actions, 77)
    expect(first.rng).not.toBe(77)
  })

  /**
   * Easy is Medium with a shaky hand, not a dice roll. Over a spread of
   * positions it should land on Medium's move far more often than chance would
   * — and still not always, or it would not be Easy.
   */
  it('follows medium most of the time, but not always', () => {
    let agreed = 0
    let total = 0
    let chance = 0
    let rng = 101

    for (let seed = 0; seed < 60; seed++) {
      const state = createGame(seed)
      const view = toPlayerView(state, state.current)
      const actions = legalActions(state)
      if (actions.length < 3) continue

      // Medium is asked with the rng state Easy will be holding by the time it
      // delegates, so that "followed Medium" means exactly that and not
      // "happened to agree with Medium on a different roll".
      const mediumPick = medium.chooseAction(view, actions, nextInt(rng, 100).rng).action
      const easyPick = easy.chooseAction(view, actions, rng)
      rng = easyPick.rng

      if (JSON.stringify(easyPick.action) === JSON.stringify(mediumPick)) agreed += 1
      chance += 1 / actions.length
      total += 1
    }

    expect(total).toBeGreaterThan(20)
    expect(agreed).toBeGreaterThan(chance)
    expect(agreed).toBeLessThan(total)
  })
})
