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

/**
 * What a client may say. `join` without a token asks for the free seat;
 * with a token it is the same person coming back. `create` carries the
 * table's options; left out, the room takes the defaults.
 */
export type ClientMessage =
  | { type: 'create'; options?: TableOptions }
  | { type: 'join'; room: string; token?: string }
  | { type: 'action'; action: Action }

export type ErrorCode =
  | 'bad-message'
  | 'room-not-found'
  | 'room-full'
  | 'bad-token'
  | 'not-seated'
  | 'not-started'
  | 'not-your-turn'
  | 'illegal-action'
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
  | { type: 'view'; view: PlayerView; actions: Action[]; opponentConnected: boolean }
  | { type: 'presence'; opponentConnected: boolean }
  | { type: 'error'; code: ErrorCode; message: string }
