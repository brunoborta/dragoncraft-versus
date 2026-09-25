import { applyAction, createGame, legalActions, toPlayerView } from '@dcv/engine'
import type { Action, GameState, PlayerView } from '@dcv/engine'
import { useCallback, useMemo, useState } from 'react'

export type GameSession = {
  state: GameState
  view: PlayerView
  actions: Action[]
  perform: (action: Action) => void
  undo: () => void
  undoUntil: (predicate: (state: GameState) => boolean) => void
  canUndo: boolean
  reset: (seed: number) => void
}

/**
 * The whole state layer. Because engine states are immutable, keeping the
 * history is all undo needs — no inverse operations, no snapshots to build.
 */
export function useGame(seed: number): GameSession {
  const [history, setHistory] = useState<GameState[]>(() => [createGame(seed)])

  const state = history[history.length - 1]
  const view = useMemo(() => toPlayerView(state, state.current), [state])
  const actions = useMemo(() => legalActions(state), [state])

  const perform = useCallback((action: Action) => {
    setHistory((past) => [...past, applyAction(past[past.length - 1], action)])
  }, [])

  const undo = useCallback(() => {
    setHistory((past) => (past.length > 1 ? past.slice(0, -1) : past))
  }, [])

  /** Steps back at least once, then keeps stepping until `predicate` holds. */
  const undoUntil = useCallback((predicate: (state: GameState) => boolean) => {
    setHistory((past) => {
      if (past.length <= 1) return past
      let next = past.slice(0, -1)
      while (next.length > 1 && !predicate(next[next.length - 1])) next = next.slice(0, -1)
      return next
    })
  }, [])

  const reset = useCallback((nextSeed: number) => {
    setHistory([createGame(nextSeed)])
  }, [])

  return { state, view, actions, perform, undo, undoUntil, canUndo: history.length > 1, reset }
}
