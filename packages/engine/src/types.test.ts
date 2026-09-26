import { describe, expect, it } from 'vitest'
import { DRAGON_TYPES } from './types.js'

describe('DRAGON_TYPES', () => {
  it('has exactly the 6 game types, with no repeats', () => {
    expect(DRAGON_TYPES).toEqual(['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'])
    expect(new Set(DRAGON_TYPES).size).toBe(6)
  })
})
