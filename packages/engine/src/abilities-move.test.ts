import { describe, expect, it } from 'vitest'
import { heightAt, topOf } from './board.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { single } from './tokens.js'
import type { Action, GameState } from './types.js'
import { createInitialState } from './setup.js'

/** Tailored state: a controlled board and a held token waiting to be placed. */
function staged(board: Record<string, ReturnType<typeof single>[]>, held: Parameters<typeof single>[0]): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    board,
    current: 0,
    phase: 'play',
    pending: [{ kind: 'place', token: single(held), fireUpAllowed: true }],
  }
}

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }
const D = { q: 1, r: -1 }

describe('firing up is optional', () => {
  it('offers both firing up and skipping after a placement', () => {
    const state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    const types = legalActions(state).map((a) => a.type)
    expect(types).toContain('fireUp')
    expect(types).toContain('skipFireUp')
  })

  it('ends the PLAY phase when skipped', () => {
    let state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    state = applyAction(state, { type: 'skipFireUp' })
    expect(state.phase).toBe('score')
  })

  it('logs the decision not to fire up', () => {
    let state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    state = applyAction(state, { type: 'skipFireUp' })
    expect(state.log.at(-1)?.action).toEqual({ type: 'skipFireUp' })
  })
})

describe('meat', () => {
  it('moves 1 adjacent token to any space with room', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'meat')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    const moves = legalActions(state).filter((a): a is Extract<Action, { type: 'meatMove' }> => a.type === 'meatMove')
    expect(moves.every((m) => m.from.q === B.q && m.from.r === B.r)).toBe(true)
    state = applyAction(state, { type: 'meatMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(topOf(state.board, B)).toBeUndefined()
  })

  it('can move the neighbour on top of the meat token itself', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'meat')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    state = applyAction(state, { type: 'meatMove', from: B, to: A })
    expect(heightAt(state.board, A)).toBe(2)
    expect(topOf(state.board, A)).toEqual(single('bread'))
  })

  it('offers no destination that would break the limit of 3', () => {
    let state = staged(
      { [key(B)]: [single('bread')], [key(C)]: [single('iron'), single('iron'), single('iron')] },
      'meat',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    const targets = legalActions(state)
      .filter((a): a is Extract<Action, { type: 'meatMove' }> => a.type === 'meatMove')
      .map((m) => key(m.to))
    expect(targets).not.toContain(key(C))
  })

  it('stays legal and does nothing when there is no neighbour', () => {
    let state = applyAction(staged({}, 'meat'), { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'meat' })
    expect(state.phase).toBe('score')
  })
})

describe('potion', () => {
  it('swaps the tops of any two spaces without changing heights', () => {
    let state = staged(
      { [key(B)]: [single('bread'), single('plant')], [key(C)]: [single('iron')] },
      'potion',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    state = applyAction(state, { type: 'potionSwap', a: B, b: C })
    expect(topOf(state.board, B)).toEqual(single('iron'))
    expect(topOf(state.board, C)).toEqual(single('plant'))
    expect(heightAt(state.board, B)).toBe(2)
    expect(heightAt(state.board, C)).toBe(1)
  })

  it('can involve the potion token just placed', () => {
    let state = staged({ [key(C)]: [single('iron')] }, 'potion')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    const involvesA = legalActions(state).some(
      (x) => x.type === 'potionSwap' && (key(x.a) === key(A) || key(x.b) === key(A)),
    )
    expect(involvesA).toBe(true)
  })

  it('never offers swapping a space with itself', () => {
    let state = staged({ [key(C)]: [single('iron')] }, 'potion')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'potion' })
    expect(legalActions(state).some((x) => x.type === 'potionSwap' && key(x.a) === key(x.b))).toBe(false)
  })
})

describe('iron', () => {
  it('moves up to 2 adjacent tokens 1 space each, and may stop after one', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(legalActions(state).some((x) => x.type === 'ironDone')).toBe(true)
    state = applyAction(state, { type: 'ironDone' })
    expect(state.phase).toBe('score')
  })

  it('only moves to a space adjacent to the token current position', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    const targets = legalActions(state)
      .filter((x): x is Extract<Action, { type: 'ironMove' }> => x.type === 'ironMove')
      .map((m) => key(m.to))
    expect(targets).toContain(key(C))
    expect(targets).not.toContain(key({ q: -2, r: 0 }))
  })

  it('moves the top and then the revealed token of the same stack', () => {
    let state = staged({ [key(B)]: [single('bread'), single('plant')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('plant'))
    expect(topOf(state.board, B)).toEqual(single('bread'))
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(topOf(state.board, C)).toEqual(single('bread'))
    expect(topOf(state.board, B)).toBeUndefined()
  })

  it('offers no destination that would break the limit of 3', () => {
    let state = staged(
      { [key(B)]: [single('bread')], [key(C)]: [single('iron'), single('iron'), single('iron')] },
      'iron',
    )
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    const targets = legalActions(state)
      .filter((x): x is Extract<Action, { type: 'ironMove' }> => x.type === 'ironMove')
      .map((m) => key(m.to))
    expect(targets).not.toContain(key(C))
  })

  it('never offers a second move to the token it just moved', () => {
    // D neighbours both B and the iron on A, so before this guard existed the
    // token that landed on D was offered up for a second move of its own.
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: D })
    expect(topOf(state.board, D)).toEqual(single('bread'))
    const froms = legalActions(state)
      .filter((x): x is Extract<Action, { type: 'ironMove' }> => x.type === 'ironMove')
      .map((m) => key(m.from))
    expect(froms).not.toContain(key(D))
  })

  it('logs stopping, so a declined second move is not silence', () => {
    let state = staged({ [key(B)]: [single('bread')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    state = applyAction(state, { type: 'ironDone' })
    expect(state.log.at(-1)?.action).toEqual({ type: 'ironDone' })
  })

  it('ends by itself after 2 moves', () => {
    let state = staged({ [key(B)]: [single('bread'), single('plant')] }, 'iron')
    state = applyAction(state, { type: 'place', at: A })
    state = applyAction(state, { type: 'fireUp', ability: 'iron' })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    state = applyAction(state, { type: 'ironMove', from: B, to: C })
    expect(state.phase).toBe('score')
  })
})
