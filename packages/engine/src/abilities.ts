import { drawMany, drawToken, returnToBag } from './bag.js'
import { canReceive, moveTop, occupiedHexes, swapTops, topOf } from './board.js'
import { BOARD, hexEq, neighbors, onBoard } from './hex.js'
import { abilitiesOf } from './tokens.js'
import type { Action, DragonType, GameState, Hex, Pending } from './types.js'

/**
 * Fires up `ability` as if from the token on `at`. Movement abilities open a
 * pending; drawing abilities touch the bag first. Recursion through plant is
 * just this function calling itself through the pending stack.
 */
export function fireUpAbility(state: GameState, ability: DragonType, at: Hex): GameState {
  const push = (pending: Pending, next: GameState = state): GameState => ({
    ...next,
    pending: [...next.pending, pending],
  })

  switch (ability) {
    case 'meat':
      return push({ kind: 'meat', at })
    case 'iron':
      return push({ kind: 'iron', at, movesLeft: 2 })
    case 'potion':
      return push({ kind: 'potion' })
    case 'plant':
      return push({ kind: 'plant', at })
    case 'bread': {
      const drawn = drawToken(state)
      if (!drawn.token) return drawn.state
      return push({ kind: 'place', token: drawn.token, fireUpAllowed: true }, drawn.state)
    }
    case 'crystal': {
      const drawn = drawMany(state, 3)
      if (drawn.tokens.length === 0) return drawn.state
      return push({ kind: 'crystalPick', tokens: drawn.tokens }, drawn.state)
    }
  }
}

/** Occupied spaces neighbouring `at`. */
function movableNeighbors(state: GameState, at: Hex): Hex[] {
  return neighbors(at).filter((hex) => onBoard(hex) && topOf(state.board, hex) !== undefined)
}

/**
 * Valid destinations for the top of `from`. The limit of 3 is checked on the
 * board with the moved token already lifted, which is what allows stacking
 * back onto the origin in other contexts.
 */
function destinations(state: GameState, from: Hex, restrictToAdjacent: boolean): Hex[] {
  const candidates = restrictToAdjacent ? neighbors(from) : BOARD
  return candidates.filter((to) => {
    if (!onBoard(to) || hexEq(to, from)) return false
    return canReceive(state.board, to)
  })
}

export function abilityActions(state: GameState, pending: Pending): Action[] | null {
  switch (pending.kind) {
    case 'meat': {
      const actions: Action[] = []
      for (const from of movableNeighbors(state, pending.at)) {
        for (const to of destinations(state, from, false)) {
          actions.push({ type: 'meatMove', from, to })
        }
      }
      return actions
    }
    case 'iron': {
      const actions: Action[] = [{ type: 'ironDone' }]
      for (const from of movableNeighbors(state, pending.at)) {
        for (const to of destinations(state, from, true)) {
          actions.push({ type: 'ironMove', from, to })
        }
      }
      return actions
    }
    case 'potion': {
      const occupied = occupiedHexes(state.board)
      const actions: Action[] = []
      for (let i = 0; i < occupied.length; i++) {
        for (let j = i + 1; j < occupied.length; j++) {
          actions.push({ type: 'potionSwap', a: occupied[i], b: occupied[j] })
        }
      }
      return actions
    }
    case 'crystalPick':
      return pending.tokens.map((_, index) => ({ type: 'crystalPick', index }))
    case 'plant': {
      const actions: Action[] = []
      for (const hex of movableNeighbors(state, pending.at)) {
        const token = topOf(state.board, hex)
        if (!token) continue
        for (const ability of abilitiesOf(token)) actions.push({ type: 'plantTarget', at: hex, ability })
      }
      return actions
    }
    default:
      return null
  }
}

export function reduceAbility(state: GameState, action: Action): GameState | null {
  switch (action.type) {
    case 'meatMove':
      return {
        ...state,
        board: moveTop(state.board, action.from, action.to),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    case 'potionSwap':
      return {
        ...state,
        board: swapTops(state.board, action.a, action.b),
        pending: state.pending.slice(0, -1),
        log: [...state.log, { seat: state.current, action }],
      }
    case 'ironMove': {
      const pending = state.pending[state.pending.length - 1]
      if (!pending || pending.kind !== 'iron') throw new Error('ironMove outside an iron pending')
      const movesLeft = pending.movesLeft - 1
      const rest = state.pending.slice(0, -1)
      return {
        ...state,
        board: moveTop(state.board, action.from, action.to),
        pending: movesLeft > 0 ? [...rest, { ...pending, movesLeft }] : rest,
        log: [...state.log, { seat: state.current, action }],
      }
    }
    case 'ironDone':
      return { ...state, pending: state.pending.slice(0, -1) }
    case 'crystalPick': {
      const pending = state.pending[state.pending.length - 1]
      if (!pending || pending.kind !== 'crystalPick') throw new Error('crystalPick outside a crystalPick pending')
      const chosen = pending.tokens[action.index]
      const returned = pending.tokens.filter((_, i) => i !== action.index)
      const withReturned = returnToBag({ ...state, pending: state.pending.slice(0, -1) }, returned)
      return {
        ...withReturned,
        // the crystal's token is placed without being fired up
        pending: [...withReturned.pending, { kind: 'place', token: chosen, fireUpAllowed: false }],
        log: [...withReturned.log, { seat: state.current, action }],
      }
    }
    case 'plantTarget': {
      const popped: GameState = { ...state, pending: state.pending.slice(0, -1) }
      const fired = fireUpAbility(popped, action.ability, action.at)
      return { ...fired, log: [...fired.log, { seat: state.current, action }] }
    }
    default:
      return null
  }
}
