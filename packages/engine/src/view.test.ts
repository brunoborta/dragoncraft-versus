import { describe, expect, it } from 'vitest'
import { createInitialState } from './setup.js'
import { determinize, toPlayerView } from './view.js'

describe('toPlayerView', () => {
  const state = createInitialState(4242)
  const view = toPlayerView(state, 0)

  it('shows your whole hand', () => {
    expect(view.you.hand).toEqual(state.players[0].hand)
  })

  it('shows only the count of the opponent hand', () => {
    expect(view.opponent.handCount).toBe(2)
    expect(JSON.stringify(view)).not.toContain(state.players[1].hand[0].id)
  })

  it('shows only the deck count, never its order', () => {
    expect(view.deckCount).toBe(38)
    expect(JSON.stringify(view)).not.toContain(state.deck[0].id)
  })

  it('exposes the bag composition, which is derivable from the board', () => {
    expect(view.bag).toHaveLength(30)
  })

  it('orders the bag canonically, so draw order does not leak', () => {
    const ids = view.bag.map((t) => (t.kind === 'single' ? t.type : t.types.join('+')))
    expect([...ids].sort()).toEqual(ids)
  })

  it('does not expose the random generator', () => {
    expect('rng' in view).toBe(false)
  })
})

describe('determinize', () => {
  it('produces a full state that reproduces the source view exactly', () => {
    const state = createInitialState(777)
    const view = toPlayerView(state, 1)
    const guessed = determinize(view, 31337)
    expect(toPlayerView(guessed.state, 1)).toEqual(view)
  })

  it('fills the opponent hand with plausible cards, never a known one', () => {
    const state = createInitialState(555)
    const view = toPlayerView(state, 0)
    const guessed = determinize(view, 8)
    const known = new Set(view.you.hand.map((c) => c.id))
    for (const card of guessed.state.players[1].hand) expect(known.has(card.id)).toBe(false)
    expect(guessed.state.players[1].hand).toHaveLength(view.opponent.handCount)
    expect(guessed.state.deck).toHaveLength(view.deckCount)
  })

  it('produces different guesses for different seeds', () => {
    const view = toPlayerView(createInitialState(11), 0)
    expect(determinize(view, 1).state.players[1].hand).not.toEqual(determinize(view, 2).state.players[1].hand)
  })
})
