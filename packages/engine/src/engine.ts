import { canReceive, pushToken } from './board.js'
import { BOARD } from './hex.js'
import { pick } from './rng.js'
import { HAND_SIZE, createInitialState } from './setup.js'
import type { Action, GameState, Pending, PlayerState, RngState, Seat, Token } from './types.js'

/** Stable serialization: compares actions regardless of key order. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  const obj = value as Record<string, unknown>
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(obj[k])}`)
    .join(',')}}`
}

export function actionKey(action: Action): string {
  return stable(action)
}

export class IllegalActionError extends Error {
  constructor(readonly action: Action) {
    super(`illegal action in this state: ${actionKey(action)}`)
    this.name = 'IllegalActionError'
  }
}

export function topPending(state: GameState): Pending | undefined {
  return state.pending[state.pending.length - 1]
}

export function replacePlayer(
  players: readonly [PlayerState, PlayerState],
  seat: Seat,
  next: PlayerState,
): [PlayerState, PlayerState] {
  return seat === 0 ? [next, players[1]] : [players[0], next]
}

/**
 * Draws a token from the bag. If the bag is empty, injects the 6 extras —
 * once only. Emptying the bag triggers the end of the game, even when the
 * extras go in right after and the bag holds tokens again.
 * Returns `null` when there is nothing left to draw anywhere.
 */
export function drawToken(state: GameState): { state: GameState; token: Token | null } {
  let bag = state.bag
  let extras = state.extras
  let extrasAdded = state.extrasAdded

  if (bag.length === 0) {
    if (extrasAdded || extras.length === 0) return { state, token: null }
    bag = [...extras]
    extras = []
    extrasAdded = true
  }

  const drawn = pick(bag, state.rng)
  const rest = bag.filter((_, i) => i !== drawn.index)

  return {
    state: {
      ...state,
      rng: drawn.rng,
      bag: rest,
      extras,
      extrasAdded,
      endTriggered: state.endTriggered || rest.length === 0,
    },
    token: drawn.item,
  }
}

/** Opens the current player's turn by drawing the token they will place. */
export function beginTurn(state: GameState): GameState {
  const drawn = drawToken(state)
  if (!drawn.token) return { ...drawn.state, phase: 'score', pending: [] }
  return {
    ...drawn.state,
    phase: 'play',
    pending: [{ kind: 'place', token: drawn.token, fireUpAllowed: true }],
    log: [...drawn.state.log, { seat: state.current, action: { type: 'draw', token: drawn.token } }],
  }
}

export function createGame(seed: RngState): GameState {
  return beginTurn(createInitialState(seed))
}

function pendingActions(state: GameState, pending: Pending): Action[] {
  switch (pending.kind) {
    case 'place':
      return BOARD.filter((hex) => canReceive(state.board, hex)).map((at) => ({ type: 'place', at }))
    default:
      throw new Error(`pending with no actions defined: ${pending.kind}`)
  }
}

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'ended') return []
  const pending = topPending(state)
  if (pending) return pendingActions(state, pending)
  if (state.phase === 'score' || state.phase === 'final-score') return [{ type: 'endTurn' }]
  return []
}

/** Draws up to a full hand. Emptying the deck also triggers the end of the game. */
function refresh(state: GameState): GameState {
  const player = state.players[state.current]
  const hand = [...player.hand]
  let deck = state.deck
  let endTriggered = state.endTriggered

  while (hand.length < HAND_SIZE && deck.length > 0) {
    hand.push(deck[0])
    deck = deck.slice(1)
    if (deck.length === 0) endTriggered = true
  }

  return {
    ...state,
    deck,
    players: replacePlayer(state.players, state.current, { ...player, hand }),
    endTriggered,
  }
}

function endTurn(state: GameState): GameState {
  if (state.phase === 'final-score') {
    return {
      ...state,
      phase: 'ended',
      pending: [],
      log: [...state.log, { seat: state.current, action: { type: 'gameOver' } }],
    }
  }

  const refreshed = refresh(state)
  const next = (1 - refreshed.current) as Seat
  const handed: GameState = {
    ...refreshed,
    current: next,
    players: replacePlayer(refreshed.players, next, {
      ...refreshed.players[next],
      coinSpentThisTurn: false,
    }),
    pending: [],
    log: [...refreshed.log, { seat: refreshed.current, action: { type: 'endTurn' } }],
  }

  if (refreshed.endTriggered) return { ...handed, phase: 'final-score' }
  return beginTurn({ ...handed, phase: 'play' })
}

function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'place': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'place') throw new Error('place without a place pending')
      return {
        ...state,
        board: pushToken(state.board, action.at, pending.token),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'endTurn':
      return endTurn(state)
    default:
      throw new Error(`action with no reducer: ${action.type}`)
  }
}

/** PLAY ends by itself once the pending stack empties. */
function settle(state: GameState): GameState {
  if (state.phase === 'play' && state.pending.length === 0) return { ...state, phase: 'score' }
  return state
}

export function applyAction(state: GameState, action: Action): GameState {
  const key = actionKey(action)
  if (!legalActions(state).some((candidate) => actionKey(candidate) === key)) {
    throw new IllegalActionError(action)
  }
  return settle(reduce(state, action))
}
