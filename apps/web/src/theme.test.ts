import { DRAGON_TYPES } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { DRAGON_THEME, shade } from './theme.js'

describe('DRAGON_THEME', () => {
  it('covers all 6 dragon types', () => {
    for (const type of DRAGON_TYPES) expect(DRAGON_THEME[type], type).toBeDefined()
  })

  it('gives every type its own colour', () => {
    const colours = DRAGON_TYPES.map((type) => DRAGON_THEME[type].color)
    expect(new Set(colours).size).toBe(6)
  })

  it('gives every type its own silhouette, so colour is never the only cue', () => {
    const shapes = DRAGON_TYPES.map((type) => DRAGON_THEME[type].icon.shape)
    expect(new Set(shapes).size).toBe(6)
  })

  it('keeps every icon inside the face of its token', () => {
    for (const type of DRAGON_TYPES) {
      const { shape } = DRAGON_THEME[type].icon
      const numbers = shape.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
      for (const n of numbers) expect(Math.abs(n), type).toBeLessThanOrEqual(1)
    }
  })

  it('shades every edge darker than its face', () => {
    for (const type of DRAGON_TYPES) {
      const { color, dark } = DRAGON_THEME[type]
      expect(shade(color, 0)).toBe(color)
      expect(parseInt(dark.slice(1), 16), type).toBeLessThan(parseInt(color.slice(1), 16))
    }
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
