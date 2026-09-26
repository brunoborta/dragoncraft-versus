import { describe, expect, it } from 'vitest'
import { DECK, patternKey } from './cards.js'
import { DRAGON_TYPES } from './types.js'
import { areAdjacent } from './hex.js'

describe('deck', () => {
  it('has 42 cards', () => {
    expect(DECK).toHaveLength(42)
  })

  it('sums to 96 reputation', () => {
    expect(DECK.reduce((sum, c) => sum + c.reputation, 0)).toBe(96)
  })

  it('has 42 distinct patterns', () => {
    expect(new Set(DECK.map((c) => patternKey(c.pattern))).size).toBe(42)
  })

  it('has 42 distinct ids', () => {
    expect(new Set(DECK.map((c) => c.id)).size).toBe(42)
  })

  it('every card has exactly 3 icons', () => {
    for (const card of DECK) expect(card.pattern, card.id).toHaveLength(3)
  })

  it('splits into the three families the spec describes', () => {
    const monos = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 1)
    const mixed = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 2)
    expect(monos).toHaveLength(12)
    expect(mixed).toHaveLength(30)
    for (const c of monos) expect(c.reputation, c.id).toBe(3)
    for (const c of mixed) expect(c.reputation, c.id).toBe(2)
  })

  it('has one mono line card and one mono triangle card per type', () => {
    for (const type of DRAGON_TYPES) {
      const perType = DECK.filter((c) => c.pattern.every((p) => p.type === type))
      expect(perType, `type ${type}`).toHaveLength(2)
    }
  })

  it('puts the odd icon at an end on every mixed card', () => {
    const mixed = DECK.filter((c) => new Set(c.pattern.map((p) => p.type)).size === 2)
    for (const card of mixed) {
      const [a, b, c] = card.pattern
      expect(a.type, card.id).toBe(b.type)
      expect(c.type, card.id).not.toBe(b.type)
    }
  })

  it('keeps every pattern connected: each cell touches the previous or the first', () => {
    for (const card of DECK) {
      const [a, b, c] = card.pattern.map((p) => p.offset)
      expect(areAdjacent(a, b), card.id).toBe(true)
      expect(areAdjacent(b, c) || areAdjacent(a, c), card.id).toBe(true)
    }
  })

  it('has no mixed triangle', () => {
    const triangles = DECK.filter((c) => {
      const [a, b, cc] = c.pattern.map((p) => p.offset)
      return areAdjacent(a, b) && areAdjacent(b, cc) && areAdjacent(a, cc)
    })
    expect(triangles).toHaveLength(6)
    for (const t of triangles) expect(new Set(t.pattern.map((p) => p.type)).size).toBe(1)
  })
})
