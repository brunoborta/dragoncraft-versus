import { FUSE_MS, TURN_MS } from '@dcv/protocol'
import { describe, expect, it } from 'vitest'
import { fuseBurnt } from './TurnFuse.js'

describe('fuseBurnt', () => {
  it('is unlit until the last stretch of the turn, then burns through it to the end', () => {
    expect(fuseBurnt(TURN_MS)).toBe(0)
    expect(fuseBurnt(FUSE_MS)).toBe(0)
    expect(fuseBurnt(FUSE_MS / 2)).toBeCloseTo(0.5)
    expect(fuseBurnt(0)).toBe(1)
    expect(fuseBurnt(-500)).toBe(1)
  })

  it('goes all the way round a turn shorter than that: someone away again has 15s', () => {
    expect(fuseBurnt(15_000, 15_000)).toBe(0)
    expect(fuseBurnt(7_500, 15_000)).toBeCloseTo(0.5)
    expect(fuseBurnt(0, 15_000)).toBe(1)
    // given its whole time back by a touch, it is out
    expect(fuseBurnt(TURN_MS - 5_000, TURN_MS)).toBe(0)
  })
})
