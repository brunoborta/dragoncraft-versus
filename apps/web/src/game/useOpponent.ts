import { legalActions, seedFrom, toPlayerView } from '@dcv/engine'
import type { RngState, Seat } from '@dcv/engine'
import { createStrategy, type Difficulty } from '@dcv/ai'
import { useEffect, useRef } from 'react'
import type { GameSession } from './useGame.js'

/** Long enough to read what it did, short enough not to feel stuck. */
const THINK_MS = 400

export function useOpponent({
  session,
  seat,
  level,
  enabled,
}: {
  session: GameSession
  seat: Seat
  level: Difficulty
  enabled: boolean
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
    }, THINK_MS)

    return () => clearTimeout(timer)
  }, [state, seat, level, enabled, perform])
}
