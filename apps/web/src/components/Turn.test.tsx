import type { Action } from '@dcv/engine'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nothingLeft } from './PlayerBar.js'
import { BANNER_HOLD, useTurnBanner } from './TurnBanner.js'

describe('useTurnBanner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  type Props = Parameters<typeof useTurnBanner>[0]
  const start: Props = { current: 0, seat: 0, ended: false, blocked: false }

  it('says whose turn it is once at the start, then takes the banner down', () => {
    const { result } = renderHook((props: Props) => useTurnBanner(props), { initialProps: start })
    expect(result.current.banner?.side).toBe('you')
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    expect(result.current.banner).toBeNull()
  })

  it("waits for the opponent's moves to finish playing before saying it is your turn", () => {
    const { result, rerender } = renderHook((props: Props) => useTurnBanner(props), {
      initialProps: { ...start, current: 1 },
    })
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))

    rerender({ ...start, current: 0, blocked: true })
    expect(result.current.banner).toBeNull()

    rerender({ ...start, current: 0, blocked: false })
    expect(result.current.banner?.side).toBe('you')
  })

  it('is pending from the moment a banner is owed until it has gone', () => {
    const { result, rerender } = renderHook((props: Props) => useTurnBanner(props), {
      initialProps: { ...start, current: 1 },
    })
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    expect(result.current.pending).toBe(false)
    rerender({ ...start, current: 0, blocked: true })
    expect(result.current.pending).toBe(true)
    rerender({ ...start, current: 0, blocked: false })
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    expect(result.current.pending).toBe(false)
  })

  it("announces the opponent's turn in its own banner", () => {
    const { result, rerender } = renderHook((props: Props) => useTurnBanner(props), { initialProps: start })
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    rerender({ ...start, current: 1 })
    expect(result.current.banner?.side).toBe('opponent')
  })

  it('goes away on a tap', () => {
    const { result } = renderHook((props: Props) => useTurnBanner(props), { initialProps: start })
    act(() => result.current.dismiss())
    expect(result.current.banner).toBeNull()
  })

  it('stays down once the game is over', () => {
    const { result } = renderHook((props: Props) => useTurnBanner(props), { initialProps: { ...start, ended: true } })
    expect(result.current.banner).toBeNull()
  })
})

describe('nothingLeft (M12)', () => {
  const end: Action = { type: 'endTurn' }
  const coin: Action = { type: 'spendCoin' }
  const score: Action = { type: 'scoreCard', cardId: 'tri-bread' }

  it('lights End turn when ending, or at most spending a coin, is all that is left', () => {
    expect(nothingLeft([end])).toBe(true)
    expect(nothingLeft([coin, end])).toBe(true)
  })

  it('stays dark while a card can still be scored, or before ending is allowed', () => {
    expect(nothingLeft([score, end])).toBe(false)
    expect(nothingLeft([coin])).toBe(false)
  })
})
