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
  /** `prepare` reshapes the state just before the action applies: the tutorial rigs the bag with it. */
  perform: (action: Action, prepare?: (state: GameState) => GameState) => void
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
  /** Every state so far, oldest first: the tutorial keeps a copy at each page to go back to. */
  history: readonly GameState[]
  /** Puts back a whole history kept earlier, undo and all. */
  restore: (history: readonly GameState[]) => void
}

/**
 * The whole state layer. Because engine states are immutable, keeping the
 * history is all undo needs — no inverse operations, no snapshots to build.
 */
export function useGame(seed: number, start?: () => GameState): LocalGame {
  const [history, setHistory] = useState<GameState[]>(() => [start ? start() : createGame(seed)])
  const [undos, setUndos] = useState(0)

  const state = history[history.length - 1]
  const actions = useMemo(() => legalActions(state), [state])

  const perform = useCallback((action: Action, prepare?: (state: GameState) => GameState) => {
    setHistory((past) => {
      const last = past[past.length - 1]
      return [...past, applyAction(prepare ? prepare(last) : last, action)]
    })
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

  const restore = useCallback((kept: readonly GameState[]) => {
    setHistory([...kept])
  }, [])

  return { state, actions, perform, undo, canUndo: target !== null, undos, forfeit, reset, load, history, restore }
}
