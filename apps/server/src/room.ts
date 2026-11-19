import { actionKey, applyAction, createGame, forfeit, legalActions, undoTarget } from '@dcv/engine'
import { toPlayerView } from '@dcv/engine'
import type { Action, GameState, Seat } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { ErrorCode, ServerMessage, TableOptions } from '@dcv/protocol'

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
  'cannot-undo': 'There is nothing to take back right now',
  'not-ended': 'The game is not over yet',
  'already-ended': 'The game is already over',
  left: 'You left this game',
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
  /** Every state the game has been in; the last is current. Undo pops one play. */
  private history: GameState[]
  /** Who is asking to play again; both at once starts the next game. */
  private wantsRematch: [boolean, boolean] = [false, false]
  /** Seats that left the table for good; one gone means no rematch here. */
  private left: [boolean, boolean] = [false, false]
  /** How many games this table has seen before the current one. */
  private gameNumber = 0
  /** When the room last had nobody connected; sweeping reads it. */
  idleSince: number

  constructor(
    readonly id: string,
    seed: number,
    private readonly newToken: () => string,
    readonly createdAt: number,
    /** How the table is shown, as the creator chose; relayed to every seat as it sits. */
    readonly options: TableOptions = DEFAULT_TABLE_OPTIONS,
    /** Where a rematch's seed comes from; the first game got its own in `seed`. */
    private readonly newSeed: () => number = () => Math.floor(Math.random() * 0x7fffffff),
  ) {
    this.history = [createGame(seed)]
    this.idleSince = createdAt
  }

  private get state(): GameState {
    return this.history[this.history.length - 1]
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

  /** Whether undo has anywhere to go, same rule as against the machine. */
  private get undoable(): boolean {
    return undoTarget(this.history) !== null
  }

  private viewFor(seat: Seat): ServerMessage {
    const mine = this.state.current === seat && this.state.phase !== 'ended'
    return {
      type: 'view',
      view: toPlayerView(this.state, seat),
      actions: mine ? legalActions(this.state) : [],
      opponentConnected: this.clientAt((1 - seat) as Seat) !== null,
      canUndo: mine && this.undoable,
      game: this.gameNumber,
    }
  }

  private rematchFor(seat: Seat): ServerMessage {
    return {
      type: 'rematch',
      youWant: this.wantsRematch[seat],
      opponentWants: this.wantsRematch[(1 - seat) as Seat],
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
    const out: Outbound[] = [{ to: client, message: this.viewFor(seat) }]
    // a rematch asked for while this seat was away is still on the table
    if (this.wantsRematch[0] || this.wantsRematch[1]) out.push({ to: client, message: this.rematchFor(seat) })
    if (this.left[(1 - seat) as Seat]) out.push({ to: client, message: { type: 'opponentLeft' } })
    return out
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
    const seated: Outbound = { to: client, message: { type: 'seated', room: this.id, seat, token, role: 'player', options: this.options } }

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
    if (this.left[seat]) return [{ to: client, message: errorMessage('left') }]

    const record = this.seats[seat]!
    const out: Outbound[] = []
    if (record.client !== null && record.client !== client) {
      out.push({ to: record.client, message: errorMessage('replaced') })
    }
    record.client = client

    out.push({ to: client, message: { type: 'seated', room: this.id, seat, token, role: 'player', options: this.options } })
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
    this.history = [...this.history, applyAction(this.state, legal)]
    return this.broadcastViews()
  }

  /**
   * One play back, exactly as against the machine (`undoTarget`): only the
   * player whose turn it is, and never across a draw, a spent coin, or into
   * the other player's turn. Both seats get the rewound view, so a takeback happens
   * in the open.
   */
  undo(client: ClientId): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return [{ to: client, message: errorMessage('not-seated') }]
    if (!this.started) return [{ to: client, message: errorMessage('not-started') }]

    const refuse = (code: ErrorCode): Outbound[] => [
      { to: client, message: errorMessage(code) },
      { to: client, message: this.viewFor(seat) },
    ]

    if (this.state.phase === 'ended' || this.state.current !== seat) return refuse('not-your-turn')
    if (!this.undoable) return refuse('cannot-undo')

    this.history = this.history.slice(0, undoTarget(this.history)! + 1)
    return this.broadcastViews()
  }

  /**
   * A seat gives up. Unlike everything else it does not wait for a turn:
   * either seat, any time the game is on. Both get the final view, and the
   * log in it says who gave up.
   */
  forfeit(client: ClientId): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return [{ to: client, message: errorMessage('not-seated') }]
    if (!this.started) return [{ to: client, message: errorMessage('not-started') }]
    if (this.state.phase === 'ended') {
      return [
        { to: client, message: errorMessage('already-ended') },
        { to: client, message: this.viewFor(seat) },
      ]
    }

    this.history = [...this.history, forfeit(this.state, seat)]
    return this.broadcastViews()
  }

  /**
   * A seat asking to play again, once the game is over. The first to ask
   * waits, and both seats hear who is asking; when the second agrees, the
   * table starts over on a fresh seed — same seats, same options, and the
   * game number moves so clients know this is a new game, not a correction.
   */
  rematch(client: ClientId): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return [{ to: client, message: errorMessage('not-seated') }]
    if (!this.started) return [{ to: client, message: errorMessage('not-started') }]
    if (this.state.phase !== 'ended') return [{ to: client, message: errorMessage('not-ended') }]
    // the other seat is gone: nobody is left to agree
    if (this.left[(1 - seat) as Seat]) return [{ to: client, message: { type: 'opponentLeft' } }]

    this.wantsRematch[seat] = true
    if (this.wantsRematch[0] && this.wantsRematch[1]) {
      this.wantsRematch = [false, false]
      this.gameNumber += 1
      this.history = [createGame(this.newSeed())]
      return this.broadcastViews()
    }

    const out: Outbound[] = []
    for (const other of [0, 1] as const) {
      const at = this.clientAt(other)
      if (at) out.push({ to: at, message: this.rematchFor(other) })
    }
    return out
  }

  /**
   * A seat done with the table: it asked for a new game elsewhere, or turned
   * a rematch down. Any asking is over, the seat cannot come back, and the
   * other seat hears that it is alone.
   */
  leave(client: ClientId, now: number): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return [{ to: client, message: errorMessage('not-seated') }]
    this.left[seat] = true
    this.wantsRematch = [false, false]
    this.seats[seat]!.client = null
    if (this.connectedCount() === 0) this.idleSince = now
    const other = this.clientAt((1 - seat) as Seat)
    return other ? [{ to: other, message: { type: 'opponentLeft' } }] : []
  }

  disconnect(client: ClientId, now: number): Outbound[] {
    const seat = this.seatOf(client)
    if (seat === null) return []
    this.seats[seat]!.client = null
    if (this.connectedCount() === 0) this.idleSince = now
    return this.presenceFor(seat)
  }
}
