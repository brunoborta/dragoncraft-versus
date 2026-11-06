import { actionKey, applyAction, createGame, legalActions } from '@dcv/engine'
import { toPlayerView } from '@dcv/engine'
import type { Action, GameState, Seat } from '@dcv/engine'
import type { ErrorCode, ServerMessage } from '@dcv/protocol'

export type ClientId = string

/** A message and who it is for. The room never touches a socket. */
export type Outbound = { to: ClientId; message: ServerMessage }

type SeatRecord = { token: string; client: ClientId | null }

const MESSAGES: Record<ErrorCode, string> = {
  'bad-message': 'That is not a message this server understands',
  'room-not-found': 'No game is open with this PIN',
  'room-full': 'This game already has two players',
  'bad-token': 'This token does not belong to a seat in this room',
  'not-seated': 'Take a seat before playing',
  'not-started': 'The game has not started yet',
  'not-your-turn': 'It is not your turn',
  'illegal-action': 'That move is not legal right now',
  replaced: 'You reconnected from somewhere else',
  busy: 'The server has no room for another game right now',
}

export function errorMessage(code: ErrorCode): ServerMessage {
  return { type: 'error', code, message: MESSAGES[code] }
}

/**
 * One game and the two people playing it. The room holds the real
 * `GameState`; everything that leaves goes through `toPlayerView`, so no
 * client ever sees the seed, the deck or the other hand.
 *
 * The state exists from the start, but no view goes out until both seats
 * are taken — the first player waits, and sees nothing they could plan on.
 */
export class Room {
  private readonly seats: [SeatRecord | null, SeatRecord | null] = [null, null]
  private state: GameState
  /** When the room last had nobody connected; sweeping reads it. */
  idleSince: number

  constructor(
    readonly id: string,
    seed: number,
    private readonly newToken: () => string,
    readonly createdAt: number,
  ) {
    this.state = createGame(seed)
    this.idleSince = createdAt
  }

  get started(): boolean {
    return this.seats[0] !== null && this.seats[1] !== null
  }

  connectedCount(): number {
    return this.clients().length
  }

  /** Everyone connected, for the transport to reach when the room closes. */
  clients(): ClientId[] {
    return this.seats.flatMap((seat) => (seat?.client != null ? [seat.client] : []))
  }

  private seatOf(client: ClientId): Seat | null {
    if (this.seats[0]?.client === client) return 0
    if (this.seats[1]?.client === client) return 1
    return null
  }

  private clientAt(seat: Seat): ClientId | null {
    return this.seats[seat]?.client ?? null
  }

  private viewFor(seat: Seat): ServerMessage {
    const mine = this.state.current === seat && this.state.phase !== 'ended'
    return {
      type: 'view',
      view: toPlayerView(this.state, seat),
      actions: mine ? legalActions(this.state) : [],
      opponentConnected: this.clientAt((1 - seat) as Seat) !== null,
    }
  }

  /** The current view to everyone connected. */
  private broadcastViews(): Outbound[] {
    const out: Outbound[] = []
    for (const seat of [0, 1] as const) {
      const client = this.clientAt(seat)
      if (client) out.push({ to: client, message: this.viewFor(seat) })
    }
    return out
  }

  /** What a seat sees on arrival: the game if it is on, otherwise that it is not. */
  private arrival(client: ClientId, seat: Seat): Outbound[] {
    if (!this.started) return [{ to: client, message: { type: 'waiting' } }]
    return [{ to: client, message: this.viewFor(seat) }]
  }

  private presenceFor(seat: Seat): Outbound[] {
    const other = this.clientAt((1 - seat) as Seat)
    if (!other) return []
    return [{ to: other, message: { type: 'presence', opponentConnected: this.clientAt(seat) !== null } }]
  }

  /**
   * Takes the free seat. The first to sit is seat 0, which is the room's
   * creator; the second completes the table, and both get their first view.
   * Who moves first was decided by the seed when the game was created.
   */
  sit(client: ClientId): Outbound[] {
    const already = this.seatOf(client)
    if (already !== null) return this.arrival(client, already)

    const seat: Seat | null = this.seats[0] === null ? 0 : this.seats[1] === null ? 1 : null
    if (seat === null) return [{ to: client, message: errorMessage('room-full') }]

    const token = this.newToken()
    this.seats[seat] = { token, client }
    const seated: Outbound = { to: client, message: { type: 'seated', room: this.id, seat, token, role: 'player' } }

    if (this.started) return [seated, ...this.broadcastViews()]
    return [seated, ...this.arrival(client, seat)]
  }

  /**
   * The same person coming back. Whoever still holds the seat's connection
   * is told they were replaced; the transport closes them on that message.
   */
  rejoin(client: ClientId, token: string): Outbound[] {
    const seat: Seat | null = this.seats[0]?.token === token ? 0 : this.seats[1]?.token === token ? 1 : null
    if (seat === null) return [{ to: client, message: errorMessage('bad-token') }]

    const record = this.seats[seat]!
    const out: Outbound[] = []
    if (record.client !== null && record.client !== client) {
      out.push({ to: record.client, message: errorMessage('replaced') })
    }
    record.client = client

    out.push({ to: client, message: { type: 'seated', room: this.id, seat, token, role: 'player' } })
    out.push(...this.arrival(client, seat))
    out.push(...this.presenceFor(seat))
    return out
  }

  /**
   * The server's whole defence: the action has to be on the list the engine
   * would offer this seat right now. Anything else is refused and the state
   * does not move. The refusal carries a fresh view, so a client that got
   * out of step is back in it.
   */
  act(client: ClientId, action: Action): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return [{ to: client, message: errorMessage('not-seated') }]
    if (!this.started) return [{ to: client, message: errorMessage('not-started') }]

    const refuse = (code: ErrorCode): Outbound[] => [
      { to: client, message: errorMessage(code) },
      { to: client, message: this.viewFor(seat) },
    ]

    if (this.state.phase === 'ended' || this.state.current !== seat) return refuse('not-your-turn')

    let wanted: string
    try {
      wanted = actionKey(action)
    } catch {
      return refuse('illegal-action')
    }
    const legal = legalActions(this.state).find((candidate) => actionKey(candidate) === wanted)
    if (!legal) return refuse('illegal-action')

    // apply the engine's own object, not the client's: same key, no stray fields
    this.state = applyAction(this.state, legal)
    return this.broadcastViews()
  }

  disconnect(client: ClientId, now: number): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return []
    this.seats[seat]!.client = null
    if (this.connectedCount() === 0) this.idleSince = now
    return this.presenceFor(seat)
  }
}
