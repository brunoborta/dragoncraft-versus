import { winner } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { findGame, isDebugEnabled, playOut } from './debug.js'

describe('isDebugEnabled', () => {
  it('is off unless the fragment asks for it', () => {
    expect(isDebugEnabled('')).toBe(false)
    expect(isDebugEnabled('#seed=4')).toBe(false)
    expect(isDebugEnabled('#debug')).toBe(true)
  })
})

describe('playOut', () => {
  it('reaches a real ending', () => {
    const state = playOut(7)
    expect(state.phase).toBe('ended')
    expect(state.endTriggered).toBe(true)
  })
})

describe('findGame', () => {
  it('finds a finished game the given seat won', () => {
    const found = findGame('win', 0, 1)
    expect(found).not.toBeNull()
    expect(found?.state.phase).toBe('ended')
    expect(winner(found?.state!)).toBe(0)
  })

  it('finds a finished game the given seat lost', () => {
    const found = findGame('lose', 0, 1)
    expect(found).not.toBeNull()
    expect(winner(found?.state!)).toBe(1)
  })

  it('replays to the same game from the seed it reports', () => {
    // the state handed over is one the game really produces, not a built one
    const found = findGame('win', 0, 1)
    expect(JSON.stringify(playOut(found?.seed ?? 0))).toBe(JSON.stringify(found?.state))
  })
})
