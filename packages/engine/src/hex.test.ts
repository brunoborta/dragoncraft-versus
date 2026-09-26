import { describe, expect, it } from 'vitest'
import { BOARD, CENTER, INNER_RING, areAdjacent, key, neighbors, onBoard, parseKey, rotate } from './hex.js'

describe('board', () => {
  it('has 19 spaces: centre, inner ring of 6 and outer ring of 12', () => {
    expect(BOARD).toHaveLength(19)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 0)).toHaveLength(1)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 1)).toHaveLength(6)
    expect(BOARD.filter((h) => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r)) === 2)).toHaveLength(12)
  })

  it('the 6 starting spaces are exactly the neighbours of the centre', () => {
    expect(INNER_RING.map(key).sort()).toEqual(neighbors(CENTER).map(key).sort())
  })

  it('rejects spaces outside the board', () => {
    expect(onBoard({ q: 3, r: 0 })).toBe(false)
    expect(onBoard({ q: 2, r: 1 })).toBe(false)
    expect(onBoard({ q: 2, r: -2 })).toBe(true)
  })
})

describe('adjacency', () => {
  it('the centre has 6 neighbours and a corner has 3 on the board', () => {
    expect(neighbors(CENTER).filter(onBoard)).toHaveLength(6)
    expect(neighbors({ q: 2, r: -2 }).filter(onBoard)).toHaveLength(3)
  })

  it('spaces sharing a side are adjacent, nothing else is', () => {
    expect(areAdjacent({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(true)
    expect(areAdjacent({ q: 0, r: 0 }, { q: 2, r: 0 })).toBe(false)
    expect(areAdjacent({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(false)
  })
})

describe('rotation', () => {
  it('six rotations return to the original', () => {
    let h = { q: 2, r: -1 }
    for (let i = 0; i < 6; i++) h = rotate(h)
    expect(h).toEqual({ q: 2, r: -1 })
  })

  it('turns one inner-ring step into the next neighbour', () => {
    expect(rotate({ q: 1, r: 0 })).toEqual({ q: 0, r: 1 })
  })

  it('preserves distance from the centre', () => {
    for (const h of BOARD) {
      const d = (x: { q: number; r: number }) => Math.max(Math.abs(x.q), Math.abs(x.r), Math.abs(x.q + x.r))
      expect(d(rotate(h))).toBe(d(h))
    }
  })
})

describe('keys', () => {
  it('round-trips a space unchanged', () => {
    for (const h of BOARD) expect(parseKey(key(h))).toEqual(h)
  })
})
