import { legalActions, seedFrom, toPlayerView } from '@dcv/engine'
import type { LogEntry, RngState, Seat } from '@dcv/engine'
import { createStrategy, type Difficulty } from '@dcv/ai'
import { useEffect, useRef } from 'react'
import type { LocalGame } from './useGame.js'

import { ANIMATIONS_OFF } from '../motion.js'

/**
 * How long the machine waits before each move, once the screen has finished
 * showing the last one. `thinking`: a pause at the start of its turn, as a
 * person would take, and a shorter one between moves. `instant`: barely a
 * breath. Under test, a fixed 400ms, which the full-game tests step through.
 */
export const PACE = {
  thinking: { first: 1500, next: 700 },
  instant: { first: 250, next: 250 },
} as const
const TEST_MS = 400

export type Pace = keyof typeof PACE

/** True when the machine has not yet done anything this turn but draw. */
export function firstOfTurn(log: readonly LogEntry[], seat: Seat): boolean {
  for (let i = log.length - 1; i >= 0; i--) {
    const { seat: who, action } = log[i]
    if (who !== seat || action.type === 'endTurn') return true
    if (action.type !== 'draw') return false
  }
  return true
}

export function useOpponent({
  session,
  seat,
  level,
  enabled,
  pace = 'thinking',
}: {
  session: LocalGame
  seat: Seat
  level: Difficulty
  enabled: boolean
  pace?: Pace
}): void {
  const rng = useRef<RngState>(seedFrom(`opponent-${level}`))
  const { state, perform } = session

  useEffect(() => {
    if (!enabled) return
    if (state.phase === 'ended' || state.current !== seat) return

    const timer = setTimeout(() => {
      const strategy = createStrategy(level)
      const chosen = strategy.chooseAction(toPlayerView(state, seat), legalActions(state), rng.current)
      rng.current = chosen.rng
      perform(chosen.action)
    }, ANIMATIONS_OFF ? TEST_MS : PACE[pace][firstOfTurn(state.log, seat) ? 'first' : 'next'])

    return () => clearTimeout(timer)
  }, [state, seat, level, enabled, perform, pace])
}
