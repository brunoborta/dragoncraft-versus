import { describe, expect, it } from 'vitest'
import { DECK } from './cards.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { bankedReputation, finalScore, scoreableCards, winner } from './scoring.js'
import { createInitialState } from './setup.js'
import { single } from './tokens.js'
import type { GameState, ShopCard } from './types.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

/** A board where `line-bread` already matches, and a player holding that card. */
function readyToScore(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    board: {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('bread')],
    },
    players: [
      { ...base.players[0], hand: [card('line-bread'), card('tri-plant')] },
      base.players[1],
    ],
    current: 0,
    phase: 'score',
    pending: [],
    ...overrides,
  }
}

describe('scoring a card', () => {
  it('offers only the cards that actually match', () => {
    const state = readyToScore()
    expect(scoreableCards(state, 0).map((c) => c.id)).toEqual(['line-bread'])
    const offered = legalActions(state).filter((a) => a.type === 'scoreCard')
    expect(offered).toEqual([{ type: 'scoreCard', cardId: 'line-bread' }])
  })

  it('moves the card to the scored pile and out of the hand', () => {
    const after = applyAction(readyToScore(), { type: 'scoreCard', cardId: 'line-bread' })
    expect(after.players[0].scored.map((c) => c.id)).toEqual(['line-bread'])
    expect(after.players[0].hand.map((c) => c.id)).toEqual(['tri-plant'])
  })

  it('is optional: ending the turn with a scoreable card in hand is legal', () => {
    const state = readyToScore()
    expect(legalActions(state).some((a) => a.type === 'endTurn')).toBe(true)
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.players[0].scored).toEqual([])
  })

  it('allows scoring more than one card in the same turn', () => {
    const state = readyToScore({
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 1 })]: [single('bread')],
      },
    })
    const withTwo: GameState = {
      ...state,
      players: [{ ...state.players[0], hand: [card('line-bread'), card('tri-bread')] }, state.players[1]],
    }
    let after = applyAction(withTwo, { type: 'scoreCard', cardId: 'line-bread' })
    after = applyAction(after, { type: 'scoreCard', cardId: 'tri-bread' })
    expect(after.players[0].scored).toHaveLength(2)
  })
})

describe('spending a coin', () => {
  it('discards the coin, draws 2, then asks which 2 go back', () => {
    const after = applyAction(readyToScore(), { type: 'spendCoin' })
    expect(after.players[0].coins).toBe(2)
    expect(after.players[0].hand).toHaveLength(4)
    expect(after.pending.at(-1)?.kind).toBe('coinDiscard')
    expect(legalActions(after).every((a) => a.type === 'coinDiscard')).toBe(true)
  })

  it('puts the two chosen cards at the bottom of the deck', () => {
    const start = readyToScore()
    let after = applyAction(start, { type: 'spendCoin' })
    const [a, b] = after.players[0].hand
    after = applyAction(after, { type: 'coinDiscard', cardIds: [a.id, b.id] })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.deck.slice(-2).map((c) => c.id)).toEqual([a.id, b.id])
    expect(after.pending).toEqual([])
  })

  it('is limited to once per turn', () => {
    let after = applyAction(readyToScore(), { type: 'spendCoin' })
    const [a, b] = after.players[0].hand
    after = applyAction(after, { type: 'coinDiscard', cardIds: [a.id, b.id] })
    expect(legalActions(after).some((x) => x.type === 'spendCoin')).toBe(false)
  })

  it('is unavailable with no coins left', () => {
    const broke = readyToScore()
    const state: GameState = {
      ...broke,
      players: [{ ...broke.players[0], coins: 0 }, broke.players[1]],
    }
    expect(legalActions(state).some((a) => a.type === 'spendCoin')).toBe(false)
  })

  it('draws what it can when the deck is nearly empty, and triggers the end', () => {
    const start = readyToScore()
    const state: GameState = { ...start, deck: [card('line-iron')] }
    const after = applyAction(state, { type: 'spendCoin' })
    expect(after.players[0].hand).toHaveLength(3)
    expect(after.endTriggered).toBe(true)
  })
})

describe('end of game', () => {
  it('gives the opponent a final score phase after the triggering turn', () => {
    const start = readyToScore()
    const state: GameState = { ...start, endTriggered: true }
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.phase).toBe('final-score')
    expect(after.current).toBe(1)
    expect(legalActions(after).some((a) => a.type === 'endTurn')).toBe(true)
  })

  it('lets the opponent score and spend a coin, but not place anything', () => {
    const start = readyToScore()
    const state: GameState = { ...start, endTriggered: true }
    const after = applyAction(state, { type: 'endTurn' })
    expect(legalActions(after).some((a) => a.type === 'place')).toBe(false)
  })

  it('ends the game after the final score phase', () => {
    const start = readyToScore()
    let after = applyAction({ ...start, endTriggered: true }, { type: 'endTurn' })
    after = applyAction(after, { type: 'endTurn' })
    expect(after.phase).toBe('ended')
    expect(legalActions(after)).toEqual([])
  })

  it('empties the deck on REFRESH and triggers the end', () => {
    const start = readyToScore()
    const state: GameState = {
      ...start,
      deck: [card('line-iron')],
      players: [{ ...start.players[0], hand: [card('line-bread')] }, start.players[1]],
    }
    const after = applyAction(state, { type: 'endTurn' })
    expect(after.deck).toEqual([])
    expect(after.endTriggered).toBe(true)
  })
})

describe('banked reputation', () => {
  it('counts scored cards and nothing else', () => {
    const base = createInitialState(6)
    const player = { ...base.players[0], scored: [card('line-bread'), card('tri-plant')], coins: 3 }
    // coins become reputation at the end of the game, not while it is running
    expect(bankedReputation(player)).toBe(6)
  })

  it('is zero for a player who has scored nothing, however many coins they hold', () => {
    const base = createInitialState(6)
    expect(bankedReputation(base.players[0])).toBe(0)
    expect(base.players[0].coins).toBe(3)
  })
})

describe('final score', () => {
  it('sums scored reputation plus one per unspent coin', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread'), card('line-iron-iron-meat')], coins: 2 },
        { ...base.players[1], scored: [card('tri-plant')], coins: 0 },
      ],
    }
    expect(finalScore(state, 0)).toBe(3 + 2 + 2)
    expect(finalScore(state, 1)).toBe(3)
    expect(winner(state)).toBe(0)
  })

  it('is banked reputation plus the coins, and the coins only count here', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread')], coins: 2 },
        { ...base.players[1], scored: [card('tri-plant'), card('line-iron')], coins: 0 },
      ],
    }
    expect(finalScore(state, 0)).toBe(bankedReputation(state.players[0]) + 2)
    expect(finalScore(state, 1)).toBe(bankedReputation(state.players[1]))
    expect(bankedReputation(state.players[0])).toBe(3)
    expect(finalScore(state, 0)).toBe(5)
  })

  it('breaks a tie by number of scored cards', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread')], coins: 3 },
        { ...base.players[1], scored: [card('line-iron-iron-meat'), card('line-meat-meat-iron')], coins: 2 },
      ],
    }
    expect(finalScore(state, 0)).toBe(6)
    expect(finalScore(state, 1)).toBe(6)
    expect(winner(state)).toBe(1)
  })

  it('reports a shared victory when cards tie as well', () => {
    const base = createInitialState(6)
    const state: GameState = {
      ...base,
      players: [
        { ...base.players[0], scored: [card('line-bread')], coins: 0 },
        { ...base.players[1], scored: [card('tri-plant')], coins: 0 },
      ],
    }
    expect(winner(state)).toBe('draw')
  })
})
