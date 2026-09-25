import { DECK, applyAction, createGame, createInitialState, key, legalActions, single, toPlayerView } from '@dcv/engine'
import type { GameState, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { medium } from './medium.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

describe('medium', () => {
  it('always picks one of the offered actions', () => {
    let rng = 11
    for (let seed = 0; seed < 15; seed++) {
      const state = createGame(seed)
      const actions = legalActions(state)
      const chosen = medium.chooseAction(toPlayerView(state, state.current), actions, rng)
      rng = chosen.rng
      expect(actions).toContainEqual(chosen.action)
    }
  })

  it('places the token where it completes a card in hand', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
      },
      players: [{ ...base.players[0], hand: [card('line-bread'), card('tri-plant')] }, base.players[1]],
      current: 0,
      phase: 'play',
      pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: true }],
    }
    const chosen = medium.chooseAction(toPlayerView(staged, 0), legalActions(staged), 1)
    expect(chosen.action).toEqual({ type: 'place', at: { q: 0, r: 0 } })
  })

  it('scores a matching card rather than passing', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
      },
      // Keep the hand at HAND_SIZE (2 cards): shrinking it to just the
      // scoreable card, without also adjusting the deck, breaks the
      // conservation invariant determinize relies on (hand + deck + scored
      // must total the full deck), producing a state no real game can reach.
      players: [
        { ...base.players[0], hand: [card('line-bread'), card('tri-plant')], coins: 0 },
        base.players[1],
      ],
      current: 0,
      phase: 'score',
      pending: [],
    }
    const chosen = medium.chooseAction(toPlayerView(staged, 0), legalActions(staged), 1)
    expect(chosen.action).toEqual({ type: 'scoreCard', cardId: 'line-bread' })
  })

  it('is deterministic for the same rng state', () => {
    const state = createGame(8)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    expect(medium.chooseAction(view, actions, 5)).toEqual(medium.chooseAction(view, actions, 5))
  })

  it('never sees the opponent hand: it plays the same whatever that hand is', () => {
    const state = createGame(9)
    const swapped: GameState = {
      ...state,
      players: [state.players[0], { ...state.players[1], hand: [card('tri-iron'), card('tri-meat')] }],
    }
    const seat = state.current
    const a = medium.chooseAction(toPlayerView(state, seat), legalActions(state), 3)
    const b = medium.chooseAction(toPlayerView(swapped, seat), legalActions(swapped), 3)
    if (seat === 0) expect(a.action).toEqual(b.action)
  })
})
