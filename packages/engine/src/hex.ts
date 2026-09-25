import type { Hex, HexKey } from './types.js'

export const BOARD_RADIUS = 2

export const CENTER: Hex = { q: 0, r: 0 }

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function distance(h: Hex): number {
  return Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r))
}

export function onBoard(h: Hex): boolean {
  return distance(h) <= BOARD_RADIUS
}

function buildBoard(): Hex[] {
  const cells: Hex[] = []
  for (let q = -BOARD_RADIUS; q <= BOARD_RADIUS; q++) {
    for (let r = -BOARD_RADIUS; r <= BOARD_RADIUS; r++) {
      const h = { q, r }
      if (onBoard(h)) cells.push(h)
    }
  }
  return cells
}

/** The 19 spaces, in stable order. */
export const BOARD: readonly Hex[] = buildBoard()

export function add(a: Hex, b: Hex): Hex {
  return { q: a.q + b.q, r: a.r + b.r }
}

export function sub(a: Hex, b: Hex): Hex {
  return { q: a.q - b.q, r: a.r - b.r }
}

export function hexEq(a: Hex, b: Hex): boolean {
  return a.q === b.q && a.r === b.r
}

export function neighbors(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => add(h, d))
}

export function areAdjacent(a: Hex, b: Hex): boolean {
  return DIRECTIONS.some((d) => hexEq(add(a, d), b))
}

/** The 6 starting spaces: the ring around the centre. */
export const INNER_RING: readonly Hex[] = neighbors(CENTER)

/** 60-degree rotation about the centre. Six applications return to the original. */
export function rotate(h: Hex): Hex {
  return { q: (-h.r) + 0, r: (h.q + h.r) + 0 }
}

export function key(h: Hex): HexKey {
  return `${h.q},${h.r}`
}

export function parseKey(k: HexKey): Hex {
  const [q, r] = k.split(',').map(Number)
  return { q, r }
}
