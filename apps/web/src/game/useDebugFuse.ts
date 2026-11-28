import { AWAY_AGAIN_MS, FUSE_MS, TURN_MS } from '@dcv/protocol'
import { timeOut } from '@dcv/engine'
import type { GameState, Seat } from '@dcv/engine'
import { useEffect, useMemo, useState } from 'react'
import type { TableClock } from './table.js'

/**
 * A turn's clock as the server keeps it (apps/server's Room), on this device's
 * `performance.now`. `spent`: its turn is over, and it stays only while its
 * burst plays out.
 */
type Fuse = { seat: Seat; startedAt: number; deadline: number; away: boolean; spent?: boolean }

/** How long a spent fuse stays, for its burst to play out. */
const BURST_MS = 1500

/**
 * After the deadline, how long before the turn is played out: the server's
 * clock ticks every half second, so online the fuse has always burst first.
 */
const LATE_MS = 300

export type FuseLight = 'last' | 'end' | 'away' | 'awayAgain'

/**
 * The turn's clock against the machine, for the debug panel: online only the
 * server keeps one, and this plays its part, so the fuse can be watched
 * without two devices. It is lit for one turn only: run out, the turn is
 * played out by the engine's `timeOut`, exactly as online, and once the turn
 * has passed (run out or played) there is no clock again. A game against the
 * machine has none.
 *
 * `light` starts it on the turn now on: 'last' with FUSE_MS left (the fuse
 * catching), 'end' with a few seconds left (straight to the burst), 'away' as
 * a turn begins for someone who was away (lit at once; the first touch puts
 * it out and gives the turn its whole time back), 'awayAgain' the same for
 * someone away twice running (15s).
 */
export function useDebugFuse(state: GameState, push: (change: (state: GameState) => GameState) => void) {
  const [fuse, setFuse] = useState<Fuse | null>(null)
  const over = state.phase === 'ended'

  function light(how: FuseLight): void {
    const now = performance.now()
    const left = how === 'end' ? 5000 : how === 'awayAgain' ? AWAY_AGAIN_MS : FUSE_MS
    const away = how === 'away' || how === 'awayAgain'
    setFuse({ seat: state.current, startedAt: away ? now : now + left - TURN_MS, deadline: now + left, away })
  }

  // the turn passed: the clock is gone, after a moment for its burst if it ran out; at once if the game is over
  useEffect(() => {
    setFuse((current) => {
      if (!current || over) return null
      if (current.seat === state.current) return current
      return current.deadline <= performance.now() ? { ...current, spent: true } : null
    })
  }, [state.current, over])
  useEffect(() => {
    if (!fuse?.spent) return
    const timer = setTimeout(() => setFuse(null), BURST_MS)
    return () => clearTimeout(timer)
  }, [fuse?.spent])

  // run out: the turn is played out
  useEffect(() => {
    if (!fuse || fuse.spent) return
    const timer = setTimeout(
      () => push((now) => (now.phase !== 'ended' && now.current === fuse.seat ? timeOut(now) : now)),
      Math.max(0, fuse.deadline - performance.now()) + LATE_MS,
    )
    return () => clearTimeout(timer)
  }, [fuse, push])

  // away: the first touch says someone is here, and the turn has its whole time
  useEffect(() => {
    if (!fuse?.away || fuse.spent) return
    const here = () => setFuse((current) => current && { ...current, away: false, deadline: current.startedAt + TURN_MS })
    window.addEventListener('pointerdown', here, true)
    window.addEventListener('keydown', here, true)
    return () => {
      window.removeEventListener('pointerdown', here, true)
      window.removeEventListener('keydown', here, true)
    }
  }, [fuse?.away])

  const clock = useMemo<TableClock | null>(
    () => (fuse ? { seat: fuse.seat, deadline: fuse.deadline, totalMs: fuse.deadline - fuse.startedAt } : null),
    [fuse],
  )

  return { clock, light, putOut: () => setFuse(null) }
}
