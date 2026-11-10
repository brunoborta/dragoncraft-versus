import { toPlayerView } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import type { Difficulty } from '@dcv/ai'
import { useMemo, useState } from 'react'
import { HUMAN_SEAT, MACHINE_SEAT } from './seats.js'
import type { Table } from './table.js'
import { useGame } from './useGame.js'
import { useOpponent } from './useOpponent.js'
import type { Pace } from './useOpponent.js'

export type LocalTable = Table & {
  reset: (seed: number) => void
  /** Jumps to a state from elsewhere; the debug hatch uses it. */
  load: (state: GameState) => void
}

/**
 * The whole game in the browser: the engine, the history that gives undo,
 * and the machine playing the other seat. `level` null means the opponent
 * has not been chosen yet, and the machine stays still until it is.
 */
export function useLocalTable({
  seed,
  level,
  pace = 'thinking',
}: {
  seed: number
  level: Difficulty | null
  pace?: Pace
}): LocalTable {
  const game = useGame(seed)
  // the machine never moves while the screen is still showing something
  const [busy, setScreenBusy] = useState(false)

  // `level ?? 'easy'` is never read: the hook returns on `enabled` first
  useOpponent({ session: game, seat: MACHINE_SEAT, level: level ?? 'easy', enabled: level !== null && !busy, pace })

  const { state } = game
  const view = useMemo(() => toPlayerView(state, HUMAN_SEAT), [state])
  const myTurn = level !== null && state.current === HUMAN_SEAT && state.phase !== 'ended'

  return {
    view,
    actions: myTurn ? game.actions : [],
    perform: game.perform,
    undo: game.undo,
    canUndo: game.canUndo && myTurn,
    status: { kind: 'playing' },
    opponentConnected: true,
    opponentLabel: 'Machine',
    setScreenBusy,
    reset: game.reset,
    load: game.load,
  }
}
