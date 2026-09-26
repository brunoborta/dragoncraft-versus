import { createGame, legalActions, toPlayerView } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'

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
})
