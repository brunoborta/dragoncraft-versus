import { applyAction, createGame, legalActions } from '@dcv/engine'
import type { Action, GameState } from '@dcv/engine'
import { useCallback, useMemo, useState } from 'react'
import { undoFloor } from './undoFloor.js'

/**
 * No `view` here on purpose. A session-level view could only be the *current*
 * seat's, which during the machine's turn is the machine's hand; every consumer
 * has to build the view for the seat it is drawing.
 */
export type GameSession = {
  state: GameState
  actions: Action[]
  perform: (action: Action) => void
  /** Steps back one action, never past what `undoFloor` allows. */
  undo: () => void
  canUndo: boolean
  reset: (seed: number) => void
  /** Replaces the history with a state from elsewhere, losing what came before. */
  load: (state: GameState) => void
}

/**
 * The whole state layer. Because engine states are immutable, keeping the
 * history is all undo needs — no inverse operations, no snapshots to build.
 */
export function useGame(seed: number): GameSession {
  const [history, setHistory] = useState<GameState[]>(() => [createGame(seed)])

  const state = history[history.length - 1]
  const actions = useMemo(() => legalActions(state), [state])

  const perform = useCallback((action: Action) => {
    setHistory((past) => [...past, applyAction(past[past.length - 1], action)])
  }, [])

  const undo = useCallback(() => {
    setHistory((past) => (past.length - 1 > undoFloor(past) ? past.slice(0, -1) : past))
  }, [])

  const reset = useCallback((nextSeed: number) => {
    setHistory([createGame(nextSeed)])
  }, [])

  const load = useCallback((state: GameState) => {
    setHistory([state])
  }, [])

  const canUndo = useMemo(() => history.length - 1 > undoFloor(history), [history])

  return { state, actions, perform, undo, canUndo, reset, load }
}
