import { canReceive, moveTop, occupiedHexes, swapTops, topOf } from './board.js'
import { BOARD, hexEq, neighbors, onBoard } from './hex.js'
import type { Action, DragonType, GameState, Hex, Pending } from './types.js'

/** The pending an ability opens when fired up, or null if it resolves at once. */
export function abilityPending(ability: DragonType, at: Hex): Pending | null {
  switch (ability) {
    case 'meat':
      return { kind: 'meat', at }
    case 'iron':
      return { kind: 'iron', at, movesLeft: 2 }
    case 'potion':
      return { kind: 'potion' }
    default:
      return null
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
    default:
      return null
  }
}

/** An ability that opens no pending (none in this task) resolves here. */
export function isMovementAbility(ability: DragonType): boolean {
  return ability === 'meat' || ability === 'iron' || ability === 'potion'
}
