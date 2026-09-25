import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { INNER_RING } from './hex.js'
import { createInitialState } from './setup.js'
import { DRAGON_TYPES } from './types.js'
import { tokenMatches } from './tokens.js'

describe('createInitialState', () => {
  const state = createInitialState(12345)

  it('puts one artisan of each type on the 6 inner-ring spaces', () => {
    for (const hex of INNER_RING) expect(heightAt(state.board, hex)).toBe(1)
    const types = INNER_RING.map((h) => topOf(state.board, h))
    for (const type of DRAGON_TYPES) {
      expect(types.filter((t) => t && tokenMatches(t, type))).toHaveLength(1)
    }
  })

  it('leaves the rest of the board empty', () => {
    expect(Object.keys(state.board)).toHaveLength(6)
  })

  it('leaves 30 tokens in the bag: 24 artisans and the 6 duals', () => {
    expect(state.bag).toHaveLength(30)
    expect(state.bag.filter((t) => t.kind === 'dual')).toHaveLength(6)
    for (const type of DRAGON_TYPES) {
      expect(state.bag.filter((t) => t.kind === 'single' && t.type === type)).toHaveLength(4)
    }
  })

  it('sets aside 6 extra tokens, one per type, outside the bag', () => {
    expect(state.extras).toHaveLength(6)
    expect(state.extrasAdded).toBe(false)
  })

  it('deals 2 cards and 3 coins to each player, leaving 38 in the deck', () => {
    for (const player of state.players) {
      expect(player.hand).toHaveLength(2)
      expect(player.coins).toBe(3)
      expect(player.scored).toEqual([])
      expect(player.coinSpentThisTurn).toBe(false)
    }
    expect(state.deck).toHaveLength(38)
  })

  it('deals no card to both hands', () => {
    const ids = [...state.players[0].hand, ...state.players[1].hand].map((c) => c.id)
    expect(new Set(ids).size).toBe(4)
  })

  it('starts in the play phase, with no pending and no end trigger', () => {
    expect(state.phase).toBe('play')
    expect(state.pending).toEqual([])
    expect(state.endTriggered).toBe(false)
  })

  it('is deterministic: the same seed gives the same state', () => {
    expect(createInitialState(999)).toEqual(createInitialState(999))
  })

  it('gives different setups for different seeds', () => {
    expect(createInitialState(1)).not.toEqual(createInitialState(2))
  })

  it('picks the first player by the chart, and both seats do occur', () => {
    const seats = new Set(Array.from({ length: 60 }, (_, i) => createInitialState(i).current))
    expect(seats).toEqual(new Set([0, 1]))
  })
})
