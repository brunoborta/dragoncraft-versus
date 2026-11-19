import type { GameState, LogEntry, Seat } from './types.js'

/**
 * A seat gives up. Either seat may, at any moment of a game still on —
 * nothing about it waits for a turn. The game ends where it stands and the
 * other seat wins whatever the score; the log says so, which is how every
 * view can tell a game given up from one played to the end.
 */
export function forfeit(state: GameState, seat: Seat): GameState {
  if (state.phase === 'ended') throw new Error('the game is already over')
  return {
    ...state,
    phase: 'ended',
    pending: [],
    log: [...state.log, { seat, action: { type: 'forfeit' } }],
  }
}

/** The seat that gave up, or `null` when nobody did. */
export function forfeitedBy(log: readonly LogEntry[]): Seat | null {
  const last = log[log.length - 1]
  return last?.action.type === 'forfeit' ? last.seat : null
}
