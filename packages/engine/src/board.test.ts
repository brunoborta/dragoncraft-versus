import { describe, expect, it } from 'vitest'
import { canReceive, heightAt, moveTop, popToken, pushToken, stackAt, swapTops, topOf } from './board.js'
import { key } from './hex.js'
import { dual, single } from './tokens.js'
import type { Board } from './types.js'

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }

describe('stacks', () => {
  it('reports height 0 and no top for an empty space', () => {
    expect(heightAt({}, A)).toBe(0)
    expect(topOf({}, A)).toBeUndefined()
  })

  it('does not mutate the board it receives', () => {
    const before: Board = {}
    const after = pushToken(before, A, single('bread'))
    expect(before).toEqual({})
    expect(stackAt(after, A)).toHaveLength(1)
  })

  it('makes the last token pushed the top', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('plant'))
    expect(topOf(board, A)).toEqual(single('plant'))
  })

  it('refuses to stack above 3', () => {
    let board: Board = {}
    for (let i = 0; i < 3; i++) board = pushToken(board, A, single('iron'))
    expect(canReceive(board, A)).toBe(false)
    expect(() => pushToken(board, A, single('iron'))).toThrow()
  })

  it('refuses a space off the board', () => {
    expect(canReceive({}, { q: 3, r: 0 })).toBe(false)
  })

  it('returns the top and drops the space once it empties', () => {
    const board = pushToken({}, A, single('meat'))
    const out = popToken(board, A)
    expect(out.token).toEqual(single('meat'))
    expect(key(A) in out.board).toBe(false)
  })

  it('moves only the top, revealing the token underneath', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('plant'))
    board = moveTop(board, A, B)
    expect(topOf(board, A)).toEqual(single('bread'))
    expect(topOf(board, B)).toEqual(single('plant'))
  })

  it('swaps only the tops and preserves both heights', () => {
    let board: Board = {}
    board = pushToken(board, A, single('bread'))
    board = pushToken(board, A, single('iron'))
    board = pushToken(board, B, dual('potion', 'plant'))
    const after = swapTops(board, A, B)
    expect(topOf(after, A)).toEqual(dual('potion', 'plant'))
    expect(topOf(after, B)).toEqual(single('iron'))
    expect(heightAt(after, A)).toBe(2)
    expect(heightAt(after, B)).toBe(1)
  })
})
