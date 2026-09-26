import { describe, expect, it } from 'vitest'
import { DRAGON_TYPES } from './types.js'
import {
  ALL_TOKENS,
  DUAL_RING,
  DUAL_TOKENS,
  FIRE_UP_ORDER,
  abilitiesOf,
  dual,
  fireUpRank,
  single,
  tokenMatches,
} from './tokens.js'

describe('dual tokens', () => {
  it('are 6, one per neighbouring pair on the ring', () => {
    expect(DUAL_TOKENS).toHaveLength(6)
  })

  it('every type appears in exactly 2 duals', () => {
    for (const type of DRAGON_TYPES) {
      const count = DUAL_TOKENS.filter((t) => tokenMatches(t, type)).length
      expect(count, `type ${type}`).toBe(2)
    }
  })

  it('no dual repeats the same type on both sides', () => {
    for (const token of DUAL_TOKENS) {
      expect(token.kind).toBe('dual')
      if (token.kind === 'dual') expect(token.types[0]).not.toBe(token.types[1])
    }
  })

  it('the 6 pairs are distinct', () => {
    const keys = DUAL_TOKENS.map((t) => (t.kind === 'dual' ? [...t.types].sort().join('+') : ''))
    expect(new Set(keys).size).toBe(6)
  })

  it('the dual ring is not the Fire Up Chart', () => {
    expect([...DUAL_RING]).not.toEqual([...FIRE_UP_ORDER])
  })
})

describe('full token set', () => {
  it('are 42: 36 artisans (6 per type) and 6 duals', () => {
    expect(ALL_TOKENS).toHaveLength(42)
    expect(ALL_TOKENS.filter((t) => t.kind === 'single')).toHaveLength(36)
    expect(ALL_TOKENS.filter((t) => t.kind === 'dual')).toHaveLength(6)
    for (const type of DRAGON_TYPES) {
      expect(ALL_TOKENS.filter((t) => t.kind === 'single' && t.type === type)).toHaveLength(6)
    }
  })
})

describe('tokenMatches', () => {
  it('a single token matches only its own type', () => {
    expect(tokenMatches(single('bread'), 'bread')).toBe(true)
    expect(tokenMatches(single('bread'), 'plant')).toBe(false)
  })

  it('a dual matches either of its 2 types', () => {
    const t = dual('crystal', 'iron')
    expect(tokenMatches(t, 'crystal')).toBe(true)
    expect(tokenMatches(t, 'iron')).toBe(true)
    expect(tokenMatches(t, 'meat')).toBe(false)
  })
})

describe('abilitiesOf', () => {
  it('a single offers 1 ability, a dual offers 2', () => {
    expect(abilitiesOf(single('meat'))).toEqual(['meat'])
    expect(abilitiesOf(dual('potion', 'plant'))).toEqual(['potion', 'plant'])
  })
})

describe('fireUpRank', () => {
  it('bread is highest and plant lowest', () => {
    expect(fireUpRank(single('bread'))).toBeLessThan(fireUpRank(single('plant')))
  })

  it('the chart is bread > crystal > meat > iron > potion > plant', () => {
    expect([...FIRE_UP_ORDER]).toEqual(['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'])
  })

  it('a dual counts as the higher of its 2 types', () => {
    expect(fireUpRank(dual('plant', 'meat'))).toBe(fireUpRank(single('meat')))
  })
})
