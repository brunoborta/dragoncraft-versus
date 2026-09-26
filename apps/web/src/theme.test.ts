import { DRAGON_TYPES } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { DRAGON_THEME } from './theme.js'

describe('DRAGON_THEME', () => {
  it('covers all 6 dragon types', () => {
    for (const type of DRAGON_TYPES) expect(DRAGON_THEME[type], type).toBeDefined()
  })

  it('gives every type its own colour', () => {
    const colours = DRAGON_TYPES.map((type) => DRAGON_THEME[type].color)
    expect(new Set(colours).size).toBe(6)
  })

  it('gives every type its own shape, so colour is never the only cue', () => {
    const symbols = DRAGON_TYPES.map((type) => DRAGON_THEME[type].symbol)
    expect(new Set(symbols).size).toBe(6)
  })

  it('says what firing every type up does, in its own words', () => {
    const effects = DRAGON_TYPES.map((type) => DRAGON_THEME[type].effect)
    for (const effect of effects) expect(effect.length).toBeGreaterThan(10)
    expect(new Set(effects).size).toBe(6)
  })

  it('labels every type in English for assistive technology', () => {
    for (const type of DRAGON_TYPES) expect(DRAGON_THEME[type].label.length).toBeGreaterThan(2)
  })
})
