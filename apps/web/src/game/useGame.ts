import { applyAction, createGame, forfeit as giveUp, legalActions, undoTarget } from '@dcv/engine'
import type { Action, GameState, Seat } from '@dcv/engine'
import { useCallback, useMemo, useState } from 'react'

/**
 * No `view` here on purpose. A session-level view could only be the *current*
 * seat's, which during the machine's turn is the machine's hand; every consumer
 * has to build the view for the seat it is drawing.
 */
export type LocalGame = {
  state: GameState
  actions: Action[]
  perform: (action: Action) => void
  /** Takes back one play — a placement or a move with the answers after it — never past the floor. */
  undo: () => void
  canUndo: boolean
  /** How many takebacks this game has seen: it moves when one lands, for the screen to show it. */
  undos: number
  /** The seat gives up: the game ends and the other seat wins. */
  forfeit: (seat: Seat) => void
  reset: (seed: number) => void
  /** Replaces the history with a state from elsewhere, losing what came before. */
  load: (state: GameState) => void
}

/**
 * The whole state layer. Because engine states are immutable, keeping the
 * history is all undo needs — no inverse operations, no snapshots to build.
 */
export function useGame(seed: number): LocalGame {
  const [history, setHistory] = useState<GameState[]>(() => [createGame(seed)])
  const [undos, setUndos] = useState(0)

  const state = history[history.length - 1]
  const actions = useMemo(() => legalActions(state), [state])

  const perform = useCallback((action: Action) => {
    setHistory((past) => [...past, applyAction(past[past.length - 1], action)])
  }, [])

  const target = useMemo(() => undoTarget(history), [history])

  const undo = useCallback(() => {
    if (target === null) return
    setHistory((past) => past.slice(0, target + 1))
    setUndos((n) => n + 1)
  }, [target])

  const forfeit = useCallback((seat: Seat) => {
    setHistory((past) => {
      const last = past[past.length - 1]
      return last.phase === 'ended' ? past : [...past, giveUp(last, seat)]
    })
  }, [])

  const reset = useCallback((nextSeed: number) => {
    setHistory([createGame(nextSeed)])
  }, [])

  const load = useCallback((state: GameState) => {
    setHistory([state])
  }, [])

  return { state, actions, perform, undo, canUndo: target !== null, undos, forfeit, reset, load }
}
