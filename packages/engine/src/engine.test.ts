import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { IllegalActionError, applyAction, createGame, legalActions } from './engine.js'
import { BOARD } from './hex.js'
import type { Action, GameState } from './types.js'

const placeAt = (state: GameState, q: number, r: number): Action => ({ type: 'place', at: { q, r } })

describe('createGame', () => {
  const game = createGame(2026)

  it('starts with a token already drawn, waiting to be placed', () => {
    expect(game.pending).toHaveLength(1)
    expect(game.pending[0].kind).toBe('place')
    expect(game.bag).toHaveLength(29)
  })

  it('records the draw in the log', () => {
    expect(game.log.at(-1)?.action.type).toBe('draw')
  })
})

describe('legalActions while placing', () => {
  it('offers all 19 spaces while no stack is full', () => {
    const actions = legalActions(createGame(1))
    expect(actions).toHaveLength(BOARD.length)
    expect(actions.every((a) => a.type === 'place')).toBe(true)
  })

  it('stops offering a space once it holds 3 tokens', () => {
    let state = createGame(5)
    for (let i = 0; i < 3; i++) {
      state = applyAction(state, placeAt(state, 0, 0))
      state = applyAction(state, { type: 'skipFireUp' })
      state = applyAction(state, { type: 'endTurn' })
    }
    expect(heightAt(state.board, { q: 0, r: 0 })).toBe(3)
    const offered = legalActions(state).filter((a) => a.type === 'place' && a.at.q === 0 && a.at.r === 0)
    expect(offered).toHaveLength(0)
  })
})

describe('applyAction', () => {
  it('places the token, then skipping fire-up ends the PLAY phase', () => {
    const game = createGame(7)
    const placed = applyAction(game, placeAt(game, 0, 0))
    expect(topOf(placed.board, { q: 0, r: 0 })).toBeDefined()
    const after = applyAction(placed, { type: 'skipFireUp' })
    expect(after.pending).toEqual([])
    expect(after.phase).toBe('score')
  })

  it('does not mutate the state it receives', () => {
    const game = createGame(8)
    const snapshot = JSON.stringify(game)
    applyAction(game, placeAt(game, 0, 0))
    expect(JSON.stringify(game)).toBe(snapshot)
  })

  it('rejects an action that is not in legalActions', () => {
    const game = createGame(9)
    expect(() => applyAction(game, { type: 'place', at: { q: 5, r: 5 } })).toThrow(IllegalActionError)
    expect(() => applyAction(game, { type: 'endTurn' })).toThrow(IllegalActionError)
  })
})

describe('end of turn', () => {
  it('passes the turn and draws a token for the other player', () => {
    const game = createGame(11)
    const placed = applyAction(game, placeAt(game, 0, 0))
    const skipped = applyAction(placed, { type: 'skipFireUp' })
    const next = applyAction(skipped, { type: 'endTurn' })
    expect(next.current).toBe(1 - game.current)
    expect(next.phase).toBe('play')
    expect(next.pending[0].kind).toBe('place')
    expect(next.bag).toHaveLength(28)
  })

  it('offers spending a coin and ending the turn in the SCORE phase', () => {
    const game = createGame(12)
    const placed = applyAction(game, placeAt(game, 0, 0))
    const skipped = applyAction(placed, { type: 'skipFireUp' })
    expect(legalActions(skipped)).toEqual([{ type: 'spendCoin' }, { type: 'endTurn' }])
  })

  it('fills the hand back to 2 cards on REFRESH', () => {
    const game = createGame(13)
    const short: GameState = {
      ...game,
      players: [
        { ...game.players[0], hand: game.players[0].hand.slice(0, 1) },
        game.players[1],
      ],
      current: 0,
    }
    const placed = applyAction(short, placeAt(short, 0, 0))
    const skipped = applyAction(placed, { type: 'skipFireUp' })
    const after = applyAction(skipped, { type: 'endTurn' })
    expect(after.players[0].hand).toHaveLength(2)
    expect(after.deck).toHaveLength(game.deck.length - 1)
  })

  it('clears the incoming player coin-spent flag', () => {
    const game = createGame(14)
    const spent: GameState = {
      ...game,
      players: [
        { ...game.players[0], coinSpentThisTurn: true },
        { ...game.players[1], coinSpentThisTurn: true },
      ],
    }
    const placed = applyAction(spent, placeAt(spent, 0, 0))
    const skipped = applyAction(placed, { type: 'skipFireUp' })
    const after = applyAction(skipped, { type: 'endTurn' })
    expect(after.players[after.current].coinSpentThisTurn).toBe(false)
  })
})

describe('determinism', () => {
  it('produces identical states from the same seed and action sequence', () => {
    const run = () => {
      let state = createGame(31337)
      for (let i = 0; i < 12; i++) {
        const actions = legalActions(state)
        if (actions.length === 0) break
        state = applyAction(state, actions[i % actions.length])
      }
      return state
    }
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()))
  })
})
