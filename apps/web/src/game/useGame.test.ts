import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useGame } from './useGame.js'

describe('useGame', () => {
  it('starts a game and offers its legal actions', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.state.pending).toHaveLength(1)
    expect(result.current.actions.length).toBeGreaterThan(0)
  })

  it('shows the current seat its own view, never the full state', () => {
    const { result } = renderHook(() => useGame(42))
    expect(result.current.view.seat).toBe(result.current.state.current)
    expect('rng' in result.current.view).toBe(false)
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

  it('undoUntil rewinds past a run of states to the first matching one', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.perform(result.current.actions[0]))
    act(() => result.current.perform(result.current.actions[0]))
    const target = result.current.state.phase
    act(() => result.current.undoUntil((state) => state.pending.length === 1))
    expect(result.current.state.pending).toHaveLength(1)
    expect(result.current.state.phase).not.toBe(target)
  })

  it('undoUntil never rewinds past the opening position', () => {
    const { result } = renderHook(() => useGame(42))
    act(() => result.current.undoUntil(() => false))
    expect(result.current.canUndo).toBe(false)
  })
})
