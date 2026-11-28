import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { applyAction, createGame, timeOut } from './engine.js'
import { key } from './hex.js'
import { createInitialState } from './setup.js'
import { single } from './tokens.js'
import type { DragonType, GameState } from './types.js'

/** Seat 0 to play, holding `held`, on a board of our own. */
function staged(held: DragonType, board: GameState['board'] = {}): GameState {
  const base = createInitialState(1)
  return { ...base, board, current: 0, phase: 'play', pending: [{ kind: 'place', token: single(held), fireUpAllowed: true }] }
}

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }

const placedCount = (state: GameState) => Object.values(state.board).reduce((sum, stack) => sum + stack.length, 0)
const kinds = (state: GameState, from: number) => state.log.slice(from).map((entry) => entry.action.type)

describe('timeOut', () => {
  it('places the token in hand on a space drawn at random, does not fire it up, and hands the turn on', () => {
    const state = staged('meat')
    const after = timeOut(state)
    expect(placedCount(after)).toBe(1)
    expect(after.current).toBe(1)
    expect(kinds(after, state.log.length)).toEqual(['timeOut', 'place', 'skipFireUp', 'endTurn', 'draw'])
  })

  it('draws its random choices from the game, so the same state times out the same way', () => {
    expect(timeOut(staged('bread')).board).toEqual(timeOut(staged('bread')).board)
  })

  it('cancels an ability waiting on its target', () => {
    let state = staged('meat', { [key(B)]: [single('bread')] })
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    const after = timeOut(state)
    // the neighbour the meat would have moved is where it was
    expect(topOf(after.board, B)).toEqual(single('bread'))
    expect(after.current).toBe(1)
    expect(kinds(after, state.log.length)).toEqual(['timeOut', 'endTurn', 'draw'])
  })

  it("picks one of the crystal's draws at random and places it", () => {
    let state = staged('crystal')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'crystal' })
    expect(state.pending.at(-1)?.kind).toBe('crystalPick')
    const after = timeOut(state)
    expect(placedCount(after)).toBe(2)
    expect(kinds(after, state.log.length).slice(0, 3)).toEqual(['timeOut', 'crystalPick', 'place'])
    expect(after.current).toBe(1)
  })

  it("keeps a pair drawn at random from a coin's discard", () => {
    let state = staged('bread')
    state = applyAction(state, { type: 'spendCoin' })
    const offered = state.players[0].hand.map((card) => card.id)
    const after = timeOut(state)
    // two of the cards offered went back under the deck, and the turn went on
    expect(after.deck.slice(-2).every((card) => offered.includes(card.id))).toBe(true)
    expect(after.current).toBe(1)
  })

  it('scores nothing in the scoring phase: it goes straight to the end of the turn', () => {
    let state = staged('bread')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'skipFireUp' })
    expect(state.phase).toBe('score')
    const after = timeOut(state)
    expect(after.players[0].scored).toHaveLength(0)
    expect(kinds(after, state.log.length)).toEqual(['timeOut', 'endTurn', 'draw'])
  })

  it('plays out the first turn of a real game', () => {
    const game = createGame(42)
    const after = timeOut(game)
    expect(after.current).toBe(1 - game.current)
    expect(heightAt(after.board, A) + placedCount(after)).toBeGreaterThan(0)
  })

  it('refuses a game that is over', () => {
    expect(() => timeOut({ ...staged('bread'), phase: 'ended' })).toThrow()
  })
})
