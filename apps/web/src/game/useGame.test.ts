import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGame } from './useGame.js'

describe('useGame', () => {
  it('starts a game and offers its legal actions', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.state.pending).toHaveLength(1)
    expect(result.current.actions.length).toBeGreaterThan(0)
  })

  it('exposes no view of its own: during the machine turn it would be the machine hand', () => {
    const { result } = renderHook(() => useGame(42))
    expect('view' in result.current).toBe(false)
  })

  it('advances the game when an action is performed', () => {
    const { result } = renderHook(() => useGame(42))
    const first = result.current.actions[0]
    act(() => result.current.perform(first))
    expect(result.current.state).not.toEqual(renderHook(() => useGame(42)).result.current.state)
  })

  it('undoes the last action', () => {
    const { result } = renderHook(() => useGame(42))
    const before = JSON.stringify(result.current.state)
    act(() => result.current.perform(result.current.actions[0]))
    expect(result.current.canUndo).toBe(true)
    act(() => result.current.undo())
    expect(JSON.stringify(result.current.state)).toBe(before)
  })

  it('cannot undo from the opening position', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.canUndo).toBe(false)
  })

  it('resets to a fresh game on a new seed', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.perform(result.current.actions[0]))
    act(() => result.current.reset(43))
    expect(result.current.canUndo).toBe(false)
    expect(result.current.state.pending).toHaveLength(1)
  })

  it('will not step back into the turn before this one, however often it is asked', () => {
    const { result } = renderHook(() => useGame(42))
    const opener = result.current.state.current

    // play on until the turn changes hands, which both ends a turn and draws
    for (let step = 0; step < 40 && result.current.state.current === opener; step += 1) {
      act(() => result.current.perform(result.current.actions[0]))
    }
    expect(result.current.state.current, 'the turn never changed hands').not.toBe(opener)

    const atTurnStart = result.current.state.log.length
    act(() => result.current.perform(result.current.actions[0]))
    expect(result.current.state.log.length).toBeGreaterThan(atTurnStart)

    for (let attempt = 0; attempt < 10; attempt += 1) act(() => result.current.undo())

    expect(result.current.state.current).not.toBe(opener)
    expect(result.current.state.log).toHaveLength(atTurnStart)
    expect(result.current.canUndo).toBe(false)
  })
})
