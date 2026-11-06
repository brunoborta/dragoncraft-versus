import type { Action, PlayerView } from '@dcv/engine'

export type TableStatus =
  /** A game is on (or over: `view.phase` says which). */
  | { kind: 'playing' }
  /** Seated, no opponent yet. Online only. */
  | { kind: 'waiting' }
  /** The connection is down and coming back. Online only. */
  | { kind: 'connecting' }
  /** Not coming back: the room is gone, the seat was refused or taken over. */
  | { kind: 'closed'; reason: string }

/**
 * The port the interface plays through. One implementation runs the engine
 * in the browser against the machine; the other is a socket to a server
 * that runs it. The screens cannot tell which, and that is the point.
 *
 * `actions` is already filtered to this seat, right now — empty when it is
 * not our move — so no screen ever asks whose turn it is to decide what to
 * offer.
 */
export type Table = {
  view: PlayerView | null
  actions: Action[]
  perform: (action: Action) => void
  undo: () => void
  canUndo: boolean
  status: TableStatus
  opponentConnected: boolean
  /** 'Machine' or 'Opponent': what the final screen calls the other seat. */
  opponentLabel: string
}
