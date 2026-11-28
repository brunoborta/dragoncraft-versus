import type { Action, PlayerView, Seat } from '@dcv/engine'

/**
 * How the table is shown, chosen by whoever opens the room and the same for
 * both players — never the rules. The server checks the shape and passes the
 * record on; what each option does is the client's business.
 */
export type TableOptions = {
  /** Tapping the bag lists what is left in it, by type. */
  bagComposition: boolean
  /** With a token hovering over a space, the card it would complete glows. */
  cardGlow: boolean
  /** Both players' reputation is on screen during the game. */
  showReputation: boolean
}

export const DEFAULT_TABLE_OPTIONS: TableOptions = { bagComposition: false, cardGlow: true, showReputation: true }

/** How long a turn may take, online: past it, the turn is played out for its player (the engine's `timeOut`). */
export const TURN_MS = 3 * 60 * 1000
/** The last stretch of a turn, when its fuse burns on screen; and the whole of the turn of a player away from the table. */
export const FUSE_MS = 30 * 1000
/** The whole of the turn of a player away from the table more than once in a row: hurried on, the opponent has waited enough. */
export const AWAY_AGAIN_MS = 15 * 1000
/** A player away from the table this many turns in a row loses the game. */
export const AWAY_TURNS = 3

/**
 * How long a turn is, for a player away from the table `away` turns in a row
 * before it: the whole TURN_MS when they were not; a fuse alone when they
 * were, FUSE_MS the first time and AWAY_AGAIN_MS after.
 */
export function turnMs(away: number): number {
  return away === 0 ? TURN_MS : away === 1 ? FUSE_MS : AWAY_AGAIN_MS
}

/**
 * The turn's clock, as the server holds it, said from where it stands when
 * the message leaves: how long `seat` has left, out of how long it had. A
 * turn begun by a player who was away from the table is a fuse alone
 * (`total` is FUSE_MS, or AWAY_AGAIN_MS: see `turnMs`) until they touch the
 * screen.
 */
export type TurnClock = { seat: Seat; remainingMs: number; totalMs: number }

/**
 * What a client may say. `join` without a token asks for the free seat;
 * with a token it is the same person coming back. `create` carries the
 * table's options; left out, the room takes the defaults.
 */
export type ClientMessage =
  | { type: 'create'; options?: TableOptions }
  | { type: 'join'; room: string; token?: string }
  | { type: 'action'; action: Action }
  /** Take back the last play. The server decides how far that is, and whether the floor allows it. */
  | { type: 'undo' }
  /** After the end: this seat wants another game at the same table. */
  | { type: 'rematch' }
  /** This seat gives up: the game ends and the other seat wins. Either seat, any time the game is on. */
  | { type: 'forfeit' }
  /** This seat is done with the table: no rematch, and the other seat is told so. */
  | { type: 'leave' }
  /** Someone is at this seat: they touched the screen. Their turn's clock knows they are not away. */
  | { type: 'awake' }

export type ErrorCode =
  | 'bad-message'
  | 'room-not-found'
  | 'room-full'
  | 'bad-token'
  | 'not-seated'
  | 'not-started'
  | 'not-your-turn'
  | 'illegal-action'
  /** There is nothing undo may take back right now. */
  | 'cannot-undo'
  /** A rematch was asked for while the game is still on. */
  | 'not-ended'
  /** Giving up a game that is already over. */
  | 'already-ended'
  /** Coming back to a table this seat already left. */
  | 'left'
  /** Someone else reconnected with this seat's token; this connection is done. */
  | 'replaced'
  /** The server will not open another room right now. */
  | 'busy'

/** Only players for now; the field is here so spectators can come without a breaking change. */
export type Role = 'player'

/**
 * What the server says. Every `view` carries the legal actions for that
 * seat right now — empty off-turn — because `legalActions` needs the full
 * state and the client never has it.
 */
export type ServerMessage =
  /** `options`: the table's, as the room's creator chose them — the same for both seats. */
  | { type: 'seated'; room: string; seat: Seat; token: string; role: Role; options: TableOptions }
  | { type: 'waiting' }
  /**
   * `canUndo`: whether this seat may take back an action right now.
   * `game`: how many games this table has seen before this one — it changes
   * when a rematch starts, so the client knows to begin afresh.
   * An older server sends neither.
   */
  | {
      type: 'view'
      view: PlayerView
      actions: Action[]
      opponentConnected: boolean
      canUndo?: boolean
      game?: number
      /** The turn's clock; none once the game is over, or from an older server. */
      clock?: TurnClock
    }
  /** The turn's clock changed with no move: a player back at the table had their fuse put out. */
  | { type: 'clock'; clock: TurnClock }
  /** Who at the table is asking to play again, said to each seat from where it sits. */
  | { type: 'rematch'; youWant: boolean; opponentWants: boolean }
  | { type: 'presence'; opponentConnected: boolean }
  /** The other seat left the table for good: there will be no rematch here. */
  | { type: 'opponentLeft' }
  | { type: 'error'; code: ErrorCode; message: string }
