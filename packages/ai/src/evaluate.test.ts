import { DECK, createInitialState, key, single } from '@dcv/engine'
import type { GameState, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { evaluate, isOneAway } from './evaluate.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

function withHand(hand: ShopCard[], board: GameState['board'] = {}): GameState {
  const base = createInitialState(2)
  return { ...base, board, players: [{ ...base.players[0], hand }, base.players[1]] }
}

describe('isOneAway', () => {
  it('is true when a single placement would complete the pattern', () => {
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
    }
    expect(isOneAway(board, card('line-bread'))).toBe(true)
  })

  it('is false when two placements are still needed', () => {
    const board = { [key({ q: -2, r: 0 })]: [single('bread')] }
    expect(isOneAway(board, card('line-bread'))).toBe(false)
  })

  it('is false when the card already matches', () => {
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    }
    expect(isOneAway(board, card('line-bread'))).toBe(false)
  })
})

describe('evaluate', () => {
  it('rates a scored card above a merely scoreable one', () => {
    const base = createInitialState(2)
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    }
    const scored: GameState = {
      ...base,
      board,
      players: [{ ...base.players[0], hand: [], scored: [card('line-bread')] }, base.players[1]],
    }
    const holding: GameState = {
      ...base,
      board,
      players: [{ ...base.players[0], hand: [card('line-bread')], scored: [] }, base.players[1]],
    }
    expect(evaluate(scored, 0)).toBeGreaterThan(evaluate(holding, 0))
  })

  it('rates a scoreable card above one that is merely close', () => {
    const complete = withHand([card('line-bread')], {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    })
    const close = withHand([card('line-bread')], {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
    })
    expect(evaluate(complete, 0)).toBeGreaterThan(evaluate(close, 0))
  })

  it('counts unspent coins', () => {
    const base = createInitialState(2)
    const rich: GameState = { ...base, players: [{ ...base.players[0], coins: 3 }, base.players[1]] }
    const broke: GameState = { ...base, players: [{ ...base.players[0], coins: 0 }, base.players[1]] }
    expect(evaluate(rich, 0)).toBeGreaterThan(evaluate(broke, 0))
  })
})
