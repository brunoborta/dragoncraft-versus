import { key, onBoard, parseKey } from './hex.js'
import type { Board, Hex, Token } from './types.js'

export const MAX_STACK = 3

export function stackAt(board: Board, hex: Hex): Token[] {
  return board[key(hex)] ?? []
}

export function heightAt(board: Board, hex: Hex): number {
  return stackAt(board, hex).length
}

export function topOf(board: Board, hex: Hex): Token | undefined {
  const stack = stackAt(board, hex)
  return stack.length > 0 ? stack[stack.length - 1] : undefined
}

export function canReceive(board: Board, hex: Hex): boolean {
  return onBoard(hex) && heightAt(board, hex) < MAX_STACK
}

export function occupiedHexes(board: Board): Hex[] {
  return Object.keys(board).map(parseKey)
}

export function pushToken(board: Board, hex: Hex, token: Token): Board {
  if (!canReceive(board, hex)) throw new Error(`space ${key(hex)} cannot take another token`)
  return { ...board, [key(hex)]: [...stackAt(board, hex), token] }
}

export function popToken(board: Board, hex: Hex): { board: Board; token: Token } {
  const stack = stackAt(board, hex)
  const token = stack[stack.length - 1]
  if (!token) throw new Error(`space ${key(hex)} is empty`)
  const next: Board = { ...board }
  const rest = stack.slice(0, -1)
  if (rest.length === 0) delete next[key(hex)]
  else next[key(hex)] = rest
  return { board: next, token }
}

/** Moves the top of `from` onto `to`. The limit of 3 is checked after removal. */
export function moveTop(board: Board, from: Hex, to: Hex): Board {
  const popped = popToken(board, from)
  return pushToken(popped.board, to, popped.token)
}

/**
 * Swaps the tops of two spaces. Since heights do not change, this operation
 * can never violate the limit of 3.
 */
export function swapTops(board: Board, a: Hex, b: Hex): Board {
  const ta = topOf(board, a)
  const tb = topOf(board, b)
  if (!ta || !tb) throw new Error('a swap needs a token on each space')
  return {
    ...board,
    [key(a)]: [...stackAt(board, a).slice(0, -1), tb],
    [key(b)]: [...stackAt(board, b).slice(0, -1), ta],
  }
}
