import { describe, expect, it } from 'vitest'
import { nextInt, pick, seedFrom, shuffle } from './rng.js'

describe('nextInt', () => {
  it('is deterministic for the same seed', () => {
    const a = nextInt(42, 100)
    const b = nextInt(42, 100)
    expect(a).toEqual(b)
  })

  it('advances the state, producing different values', () => {
    const first = nextInt(42, 1000)
    const second = nextInt(first.rng, 1000)
    expect(second.value).not.toBe(first.value)
  })

  it('always stays within the bound', () => {
    let rng = seedFrom('limite')
    for (let i = 0; i < 2000; i++) {
      const out = nextInt(rng, 7)
      expect(out.value).toBeGreaterThanOrEqual(0)
      expect(out.value).toBeLessThan(7)
      rng = out.rng
    }
  })

  it('covers every possible value across many draws', () => {
    let rng = seedFrom('cobertura')
    const seen = new Set<number>()
    for (let i = 0; i < 2000; i++) {
      const out = nextInt(rng, 6)
      seen.add(out.value)
      rng = out.rng
    }
    expect(seen.size).toBe(6)
  })
})

describe('shuffle', () => {
  it('does not mutate the input and preserves every element', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const frozen = [...input]
    const out = shuffle(input, seedFrom('baralho'))
    expect(input).toEqual(frozen)
    expect([...out.items].sort((a, b) => a - b)).toEqual(frozen)
  })

  it('the same seed produces the same order', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(shuffle(input, 7).items).toEqual(shuffle(input, 7).items)
  })

  it('different seeds produce different orders', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items)
  })
})

describe('pick', () => {
  it('returns an element of the list along with its index', () => {
    const out = pick(['a', 'b', 'c'], seedFrom('escolha'))
    expect(['a', 'b', 'c'][out.index]).toBe(out.item)
  })
})

describe('seedFrom', () => {
  it('maps the same text to the same seed, and different text to different seeds', () => {
    expect(seedFrom('sala-123')).toBe(seedFrom('sala-123'))
    expect(seedFrom('sala-123')).not.toBe(seedFrom('sala-124'))
  })
})
