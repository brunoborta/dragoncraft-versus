import { abilityActions, fireUpAbility, reduceAbility } from './abilities.js'
import { drawToken } from './bag.js'
import { canReceive, pushToken, topOf } from './board.js'
import { BOARD } from './hex.js'
import { scoreableCards } from './scoring.js'
import { HAND_SIZE, createInitialState } from './setup.js'
import { abilitiesOf } from './tokens.js'
import type { Action, GameState, Pending, PlayerState, RngState, Seat } from './types.js'

export { drawToken } from './bag.js'

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
  if (pending.kind === 'place') {
    return BOARD.filter((hex) => canReceive(state.board, hex)).map((at) => ({ type: 'place', at }))
  }
  if (pending.kind === 'mayFireUp') {
    const token = topOf(state.board, pending.at)
    if (!token) throw new Error('mayFireUp on an empty space')
    const actions: Action[] = [{ type: 'skipFireUp' }]
    for (const ability of abilitiesOf(token)) actions.push({ type: 'fireUp', ability })
    return actions
  }
  if (pending.kind === 'coinDiscard') {
    const hand = state.players[state.current].hand
    const actions: Action[] = []
    for (let i = 0; i < hand.length; i++) {
      for (let j = i + 1; j < hand.length; j++) {
        actions.push({ type: 'coinDiscard', cardIds: [hand[i].id, hand[j].id] })
      }
    }
    return actions
  }
  const fromAbility = abilityActions(state, pending)
  if (fromAbility) return fromAbility
  throw new Error(`pending with no actions defined: ${pending.kind}`)
}

const SCORING_PHASES = new Set(['score', 'final-score'])

export function legalActions(state: GameState): Action[] {
  if (state.phase === 'ended') return []

  const pending = topPending(state)
  if (pending) return pendingActions(state, pending)
  if (!SCORING_PHASES.has(state.phase)) return []

  const player = state.players[state.current]
  const actions: Action[] = scoreableCards(state, state.current).map((card) => ({
    type: 'scoreCard',
    cardId: card.id,
  }))
  if (player.coins > 0 && !player.coinSpentThisTurn) actions.push({ type: 'spendCoin' })
  actions.push({ type: 'endTurn' })
  return actions
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
      const rest = state.pending.slice(0, -1)
      return {
        ...state,
        board: pushToken(state.board, action.at, pending.token),
        pending: pending.fireUpAllowed ? [...rest, { kind: 'mayFireUp', at: action.at }] : rest,
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'skipFireUp':
      return { ...state, pending: state.pending.slice(0, -1) }
    case 'fireUp': {
      const pending = topPending(state)
      if (!pending || pending.kind !== 'mayFireUp') throw new Error('fireUp outside a mayFireUp pending')
      const popped: GameState = {
        ...state,
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
      return fireUpAbility(popped, action.ability, pending.at)
    }
    case 'scoreCard': {
      const player = state.players[state.current]
      const card = player.hand.find((c) => c.id === action.cardId)
      if (!card) throw new Error(`card ${action.cardId} is not in hand`)
      return {
        ...state,
        players: replacePlayer(state.players, state.current, {
          ...player,
          hand: player.hand.filter((c) => c.id !== action.cardId),
          scored: [...player.scored, card],
        }),
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'spendCoin': {
      const player = state.players[state.current]
      const drawn = state.deck.slice(0, 2)
      const deck = state.deck.slice(drawn.length)
      return {
        ...state,
        deck,
        endTriggered: state.endTriggered || deck.length === 0,
        players: replacePlayer(state.players, state.current, {
          ...player,
          coins: player.coins - 1,
          coinSpentThisTurn: true,
          hand: [...player.hand, ...drawn],
        }),
        pending: [...state.pending, { kind: 'coinDiscard' }],
        // the discarded cards stay out of the log: they are private information
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'coinDiscard': {
      const player = state.players[state.current]
      const returned = action.cardIds
        .map((id) => player.hand.find((c) => c.id === id))
        .filter((card): card is NonNullable<typeof card> => card !== undefined)
      if (returned.length !== 2) throw new Error('coinDiscard needs two cards from hand')
      return {
        ...state,
        deck: [...state.deck, ...returned],
        players: replacePlayer(state.players, state.current, {
          ...player,
          hand: player.hand.filter((c) => !action.cardIds.includes(c.id)),
        }),
        pending: state.pending.slice(0, -1),
      }
    }
    case 'endTurn':
      return endTurn(state)
    default: {
      const handled = reduceAbility(state, action)
      if (handled) return handled
      throw new Error(`action with no reducer: ${action.type}`)
    }
  }
}

/** PLAY ends by itself once the pending stack empties. */
function settle(state: GameState): GameState {
  let current = state
  // A pending with no possible action resolves itself.
  while (current.pending.length > 0 && legalActions(current).length === 0) {
    current = { ...current, pending: current.pending.slice(0, -1) }
  }
  if (current.phase === 'play' && current.pending.length === 0) return { ...current, phase: 'score' }
  return current
}

export function applyAction(state: GameState, action: Action): GameState {
  const key = actionKey(action)
  if (!legalActions(state).some((candidate) => actionKey(candidate) === key)) {
    throw new IllegalActionError(action)
  }
  return settle(reduce(state, action))
}
