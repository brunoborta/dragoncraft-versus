import { applyAction, canScore, createGame, legalActions, winner } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { findGame, findNearEnd, isDebugEnabled, playOut, withCoin, withHeld, withLastToken, withScorable } from './debug.js'

describe('isDebugEnabled', () => {
  it('is off unless the fragment asks for it', () => {
    expect(isDebugEnabled('')).toBe(false)
    expect(isDebugEnabled('#seed=4')).toBe(false)
    expect(isDebugEnabled('#debug')).toBe(true)
  })
})

describe('findNearEnd', () => {
  it("stops a real game at the start of the seat's turn, a few tokens before the bag runs out", () => {
    const found = findNearEnd(0, 1)
    expect(found).not.toBeNull()
    const state = found!.state
    expect(state.current).toBe(0)
    expect(state.pending).toMatchObject([{ kind: 'place' }])
    expect(state.endTriggered).toBe(false)
    expect(state.bag.length).toBeGreaterThan(0)
    expect(state.bag.length).toBeLessThanOrEqual(3)
  })
})

describe('playOut', () => {
  it('reaches a real ending', () => {
    const state = playOut(7)
    expect(state.phase).toBe('ended')
    expect(state.endTriggered).toBe(true)
  })
})

describe('findGame', () => {
  it('finds a finished game the given seat won', () => {
    const found = findGame('win', 0, 1)
    expect(found).not.toBeNull()
    expect(found?.state.phase).toBe('ended')
    expect(winner(found?.state!)).toBe(0)
  })

  it('finds a finished game the given seat lost', () => {
    const found = findGame('lose', 0, 1)
    expect(found).not.toBeNull()
    expect(winner(found?.state!)).toBe(1)
  })

  it('finds a finished game that ended level', () => {
    const found = findGame('draw', 0, 1)
    expect(found).not.toBeNull()
    expect(winner(found?.state!)).toBe('draw')
  })

  it('replays to the same game from the seed it reports', () => {
    // the state handed over is one the game really produces, not a built one
    const found = findGame('win', 0, 1)
    expect(JSON.stringify(playOut(found?.seed ?? 0))).toBe(JSON.stringify(found?.state))
  })
})

describe('withHeld', () => {
  it('puts the token asked for in hand, and it plays as one', () => {
    const state = withHeld(createGame(3), 'plant')
    expect(state.pending[state.pending.length - 1]).toMatchObject({ kind: 'place', token: { kind: 'single', type: 'plant' } })
    const placed = applyAction(state, legalActions(state)[0])
    expect(Object.values(placed.board).flat()).toContainEqual({ kind: 'single', type: 'plant' })
  })

  it('leaves the state alone when nothing is in hand', () => {
    const state = createGame(3)
    const placed = applyAction(state, legalActions(state)[0])
    expect(withHeld(placed, 'iron')).toBe(placed)
  })
})

describe('withCoin', () => {
  it('gives the seat a coin it may spend this turn', () => {
    const state = createGame(3)
    const more = withCoin(state, 1)
    expect(more.players[1].coins).toBe(state.players[1].coins + 1)
    expect(more.players[0]).toBe(state.players[0])
  })
})

describe('withLastToken', () => {
  it('leaves the bag one draw from empty, and that draw sets off the end', () => {
    const state = withLastToken(createGame(3))
    expect(state.bag).toHaveLength(1)
    expect(state.endTriggered).toBe(false)
    let played = applyAction(state, legalActions(state)[0])
    while (played.current === state.current) played = applyAction(played, legalActions(played).find((a) => a.type === 'endTurn' || a.type === 'skipFireUp') ?? legalActions(played)[0])
    expect(played.endTriggered).toBe(true)
  })
})

describe('withScorable', () => {
  /** A game some way in: a board with tokens enough to fit a card, at the start of seat 0's turn. */
  const midGame = () => playOut(3, (state) => Object.keys(state.board).length >= 10 && state.current === 0 && state.pending.length === 1)

  it('hands the seat a card the board fits, the one it replaces going under the deck', () => {
    const state = midGame()
    const rigged = withScorable(state, 0)
    const hand = rigged.players[0].hand
    expect(hand.some((card) => canScore(rigged.board, card))).toBe(true)
    expect(rigged.deck[rigged.deck.length - 1]).toBe(state.players[0].hand[state.players[0].hand.length - 1])
  })

  it('makes one up when the deck has none, and does nothing on the opening ring, where none can fit', () => {
    const state = midGame()
    const rigged = withScorable({ ...state, deck: [] }, 0)
    expect(rigged.players[0].hand.some((card) => canScore(rigged.board, card))).toBe(true)
    const opening = createGame(3)
    expect(withScorable(opening, 0)).toBe(opening)
  })
})
