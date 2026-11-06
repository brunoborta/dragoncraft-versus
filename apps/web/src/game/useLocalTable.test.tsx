import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLocalTable } from './useLocalTable.js'

describe('useLocalTable', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('offers nothing before an opponent is chosen, and the machine does not move', () => {
    // seed 1 opens on seat 1, the machine's
    const { result } = renderHook(() => useLocalTable({ seed: 1, level: null }))
    expect(result.current.view?.current).toBe(1)
    expect(result.current.actions).toEqual([])
    act(() => void vi.advanceTimersByTime(2000))
    expect(result.current.view?.log.filter((e) => e.action.type !== 'draw')).toHaveLength(0)
  })

  it('offers the legal actions on the human turn, and none on the machine turn', () => {
    // seed 2 opens on seat 0, the human's
    const { result } = renderHook(() => useLocalTable({ seed: 2, level: 'easy' }))
    expect(result.current.view?.seat).toBe(0)
    expect(result.current.actions.length).toBeGreaterThan(0)

    // play the human turn out until the seat changes
    for (let step = 0; step < 20 && result.current.view?.current === 0; step += 1) {
      const action = result.current.actions.find((a) => a.type !== 'spendCoin') ?? result.current.actions[0]
      act(() => result.current.perform(action))
    }
    expect(result.current.view?.current).toBe(1)
    expect(result.current.actions).toEqual([])

    const before = result.current.view?.log.length ?? 0
    act(() => void vi.advanceTimersByTime(500))
    expect(result.current.view?.log.length).toBeGreaterThan(before)
  })

  it('always shows the human seat, even during the machine turn', () => {
    const { result } = renderHook(() => useLocalTable({ seed: 1, level: 'easy' }))
    expect(result.current.view?.current).toBe(1)
    expect(result.current.view?.seat).toBe(0)
    expect(result.current.status).toEqual({ kind: 'playing' })
    expect(result.current.opponentLabel).toBe('Machine')
  })
})
