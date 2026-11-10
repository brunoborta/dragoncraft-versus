import { describe, expect, it } from 'vitest'
import { BOARD_OUTLINE, hexPoints } from './geometry.js'

describe('BOARD_OUTLINE', () => {
  it('traces the 30 outer edges of the 3-4-5-4-3 board as one closed path', () => {
    const corners = BOARD_OUTLINE.replace(/^M /, '').replace(/ Z$/, '').split(' L ')
    expect(corners).toHaveLength(30)
    expect(new Set(corners).size).toBe(30)
    expect(BOARD_OUTLINE.endsWith('Z')).toBe(true)
  })
})

describe('hexPoints', () => {
  it('insets a space around its own centre', () => {
    expect(hexPoints({ q: 0, r: 0 }, 0.5).split(' ')[0]).toBe('5.00,0.00')
  })
})
