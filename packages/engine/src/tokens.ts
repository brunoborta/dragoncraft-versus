import { DRAGON_TYPES, type DragonType, type Token } from './types.js'

/**
 * Fire Up Chart precedence, highest to lowest.
 * Used for exactly one thing: deciding who goes first.
 */
export const FIRE_UP_ORDER: readonly DragonType[] = ['bread', 'crystal', 'meat', 'iron', 'potion', 'plant']

/**
 * Ring that generates the dual tokens: each dual joins two neighbouring types.
 * NOT the same order as the Fire Up Chart — `meat` and `iron` swap places.
 */
export const DUAL_RING: readonly DragonType[] = ['bread', 'crystal', 'iron', 'potion', 'plant', 'meat']

export function single(type: DragonType): Token {
  return { kind: 'single', type }
}

export function dual(a: DragonType, b: DragonType): Token {
  return { kind: 'dual', types: [a, b] }
}

function buildDuals(): Token[] {
  return DUAL_RING.map((type, i) => dual(type, DUAL_RING[(i + 1) % DUAL_RING.length]))
}

export const DUAL_TOKENS: readonly Token[] = buildDuals()

/** 36 artisans (6 per type) plus the 6 duals. */
export const ALL_TOKENS: readonly Token[] = [
  ...DRAGON_TYPES.flatMap((type) => Array.from({ length: 6 }, () => single(type))),
  ...DUAL_TOKENS,
]

export function tokenMatches(token: Token, type: DragonType): boolean {
  return token.kind === 'single' ? token.type === type : token.types.includes(type)
}

/** The abilities this token offers. A dual offers 2; only one may be used. */
export function abilitiesOf(token: Token): DragonType[] {
  return token.kind === 'single' ? [token.type] : [...token.types]
}

/** Lower is higher on the chart. A dual counts as the higher of its 2 types. */
export function fireUpRank(token: Token): number {
  return Math.min(...abilitiesOf(token).map((t) => FIRE_UP_ORDER.indexOf(t)))
}

export function tokenId(token: Token): string {
  return token.kind === 'single' ? token.type : `${token.types[0]}+${token.types[1]}`
}
