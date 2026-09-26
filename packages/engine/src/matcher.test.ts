import { describe, expect, it } from 'vitest'
import { DECK } from './cards.js'
import { key } from './hex.js'
import { canScore, findMatch, rotations, wouldComplete } from './matcher.js'
import { dual, single } from './tokens.js'
import type { Board, Hex, ShopCard, Token } from './types.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

const boardOf = (entries: Array<[Hex, Token[]]>): Board =>
  Object.fromEntries(entries.map(([h, stack]) => [key(h), stack]))

describe('rotations', () => {
  it('are 6, and the sixth returns to the original pattern', () => {
    const all = rotations(card('line-bread').pattern)
    expect(all).toHaveLength(6)
    expect(rotations(all[5])[1]).toEqual(all[0])
  })
})

describe('findMatch', () => {
  it('finds 3 alike in a line in the base orientation', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('bread')]],
    ])
    expect(findMatch(board, card('line-bread'))).not.toBeNull()
  })

  it('finds the same line rotated', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, [single('bread')]],
      [{ q: 0, r: 1 }, [single('bread')]],
      [{ q: 0, r: 2 }, [single('bread')]],
    ])
    expect(findMatch(board, card('line-bread'))).not.toBeNull()
  })

  it('finds the triangle', () => {
    const board = boardOf([
      [{ q: 0, r: 0 }, [single('iron')]],
      [{ q: 1, r: 0 }, [single('iron')]],
      [{ q: 0, r: 1 }, [single('iron')]],
    ])
    expect(canScore(board, card('tri-iron'))).toBe(true)
    expect(canScore(board, card('line-iron'))).toBe(false)
  })

  it('accepts a dual as either of its 2 types', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('crystal')]],
      [{ q: -1, r: 0 }, [single('crystal')]],
      [{ q: 0, r: 0 }, [dual('crystal', 'iron')]],
    ])
    expect(canScore(board, card('line-crystal'))).toBe(true)
  })

  it('looks only at the top of a stack', () => {
    const buried = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('meat')]],
      [{ q: 0, r: 0 }, [single('meat'), single('plant')]],
    ])
    expect(canScore(buried, card('line-meat'))).toBe(false)

    const onTop = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('meat')]],
      [{ q: 0, r: 0 }, [single('plant'), single('meat')]],
    ])
    expect(canScore(onTop, card('line-meat'))).toBe(true)
  })

  it('does not match a pattern that would run off the board', () => {
    const board = boardOf([
      [{ q: 1, r: 0 }, [single('potion')]],
      [{ q: 2, r: 0 }, [single('potion')]],
    ])
    expect(canScore(board, card('line-potion'))).toBe(false)
  })

  it('matches a mixed card with the odd icon at either end', () => {
    const c = card('line-plant-plant-meat')
    const leftEnd = boardOf([
      [{ q: -2, r: 0 }, [single('meat')]],
      [{ q: -1, r: 0 }, [single('plant')]],
      [{ q: 0, r: 0 }, [single('plant')]],
    ])
    const rightEnd = boardOf([
      [{ q: -2, r: 0 }, [single('plant')]],
      [{ q: -1, r: 0 }, [single('plant')]],
      [{ q: 0, r: 0 }, [single('meat')]],
    ])
    expect(canScore(leftEnd, c)).toBe(true)
    expect(canScore(rightEnd, c)).toBe(true)
  })
})

describe('wouldComplete', () => {
  it('is true when the placement closes the pattern', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 0 }, single('bread'))).toBe(true)
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 1 }, single('bread'))).toBe(false)
  })

  it('is false when the card was already scoreable', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('bread')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 1, r: 0 }, single('bread'))).toBe(false)
  })

  it('is false when the space already holds 3 tokens', () => {
    const board = boardOf([
      [{ q: -2, r: 0 }, [single('bread')]],
      [{ q: -1, r: 0 }, [single('bread')]],
      [{ q: 0, r: 0 }, [single('iron'), single('iron'), single('iron')]],
    ])
    expect(wouldComplete(board, card('line-bread'), { q: 0, r: 0 }, single('bread'))).toBe(false)
  })
})
