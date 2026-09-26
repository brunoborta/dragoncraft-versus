import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useGame } from './useGame.js'
import { useOpponent } from './useOpponent.js'

function harness(seed: number, enabled = true) {
  return renderHook(() => {
    const session = useGame(seed)
    useOpponent({ session, seat: 1, level: 'easy', enabled })
    return session
  })
}

describe('useOpponent', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not act while it is the human turn', () => {
    // seed 1 hands the opening move to seat 1 (the machine), which would
    // make this test vacuously true; seed 2 opens on seat 0 (the human).
    const { result } = harness(2)
    expect(result.current.state.current).toBe(0)
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(2000))
    expect(JSON.stringify(result.current.state)).toBe(before)
  })

  it('plays on its own turn after a pause', () => {
    const { result } = harness(1)
    // drive the human seat until the machine is on turn
    while (result.current.state.current === 0 && result.current.state.phase !== 'ended') {
      act(() => result.current.perform(result.current.actions[0]))
    }
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(1000))
    expect(JSON.stringify(result.current.state)).not.toBe(before)
  })

  it('stays out of it when disabled', () => {
    const { result } = harness(1, false)
    while (result.current.state.current === 0 && result.current.state.phase !== 'ended') {
      act(() => result.current.perform(result.current.actions[0]))
    }
    const before = JSON.stringify(result.current.state)
    act(() => void vi.advanceTimersByTime(2000))
    expect(JSON.stringify(result.current.state)).toBe(before)
  })
})
