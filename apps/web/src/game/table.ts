import type { Action, PlayerView, Seat } from '@dcv/engine'

/**
 * The turn's clock, online: `seat` has until `deadline` (on `performance.now`'s
 * clock, this device's) out of `totalMs`. Past it, the server plays the turn
 * out. Against the machine there is none.
 */
export type TableClock = { seat: Seat; deadline: number; totalMs: number }

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
  /** Takes back one play: a placement or a move, with the answers that followed it. */
  undo: () => void
  canUndo: boolean
  /**
   * How many takebacks this game has seen, whoever made them: it moves when
   * one lands, so the screen can show it — online, to both seats.
   */
  undos: number
  /** This seat gives up: the game ends and the other seat wins. */
  forfeit: () => void
  status: TableStatus
  opponentConnected: boolean
  /** 'Easy AI', 'Medium AI', 'Hard AI' or 'Opponent': what the final screen calls the other seat. */
  opponentLabel: string
  /**
   * The screen is still showing something (a turn banner, moves landing). The
   * machine waits for it before it moves; online there is nothing to wait.
   */
  setScreenBusy?: (busy: boolean) => void
  /** The turn's clock, where there is one: online. */
  clock?: TableClock | null
}
