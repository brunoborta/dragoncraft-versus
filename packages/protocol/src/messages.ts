import type { Action, PlayerView, Seat } from '@dcv/engine'

/**
 * What a client may say. `join` without a token asks for the free seat;
 * with a token it is the same person coming back.
 */
export type ClientMessage =
  | { type: 'create' }
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
  | { type: 'seated'; room: string; seat: Seat; token: string; role: Role }
  | { type: 'waiting' }
  | { type: 'view'; view: PlayerView; actions: Action[]; opponentConnected: boolean }
  | { type: 'presence'; opponentConnected: boolean }
  | { type: 'error'; code: ErrorCode; message: string }
