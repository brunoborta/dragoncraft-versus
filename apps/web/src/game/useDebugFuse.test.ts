import { act, renderHook } from '@testing-library/react'
import { FUSE_MS, TURN_MS } from '@dcv/protocol'
import { createGame } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { useDebugFuse } from './useDebugFuse.js'

/** The hook over a game it may step on, as the local table gives it. */
function harness() {
  return renderHook(() => {
    const [state, setState] = useState<GameState>(() => createGame(3))
    const fuse = useDebugFuse(state, (change) => setState(change))
    return { state, fuse }
  })
}

describe('useDebugFuse', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('has no clock until lit, then the last stretch of the turn, run out as the server would, and none after', () => {
    const h = harness()
    expect(h.result.current.fuse.clock).toBeNull()
    const seat = h.result.current.state.current
    act(() => h.result.current.fuse.light('last'))
    const clock = h.result.current.fuse.clock!
    expect(clock).toMatchObject({ seat, totalMs: TURN_MS })
    expect(clock.deadline - performance.now()).toBeCloseTo(FUSE_MS)

    act(() => void vi.advanceTimersByTime(FUSE_MS + 400))
    const { state, fuse } = h.result.current
    expect(state.log.some((entry) => entry.action.type === 'timeOut')).toBe(true)
    expect(state.current).toBe(1 - seat)
    // a moment for the burst, then no clock: against the machine there is none
    expect(fuse.clock).not.toBeNull()
    act(() => void vi.advanceTimersByTime(2000))
    expect(h.result.current.fuse.clock).toBeNull()
  })

  it('lit as for someone away, a touch puts it out and gives the turn its whole time', () => {
    const h = harness()
    act(() => h.result.current.fuse.light('away'))
    expect(h.result.current.fuse.clock!.totalMs).toBe(FUSE_MS)
    act(() => void vi.advanceTimersByTime(5000))
    act(() => void window.dispatchEvent(new Event('pointerdown')))
    expect(h.result.current.fuse.clock!.totalMs).toBe(TURN_MS)
    expect(h.result.current.fuse.clock!.deadline - performance.now()).toBeCloseTo(TURN_MS - 5000)
  })

  it('goes out when told', () => {
    const h = harness()
    act(() => h.result.current.fuse.light('end'))
    act(() => h.result.current.fuse.putOut())
    expect(h.result.current.fuse.clock).toBeNull()
    act(() => void vi.advanceTimersByTime(10_000))
    expect(h.result.current.state.log.some((entry) => entry.action.type === 'timeOut')).toBe(false)
  })
})
