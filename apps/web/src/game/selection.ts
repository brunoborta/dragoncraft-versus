import { hexEq, key } from '@dcv/engine'
import type { Action, Hex } from '@dcv/engine'

/** Actions the board answers, rather than the decision bar. */
export const SPATIAL_TYPES = ['place', 'meatMove', 'ironMove', 'potionSwap', 'plantTarget'] as const

type Pair = { from: Hex; to: Hex; action: Action }

/** Two-hex actions, listed from both ends when the action has no direction. */
function pairs(actions: readonly Action[]): Pair[] {
  const out: Pair[] = []
  for (const action of actions) {
    if (action.type === 'meatMove' || action.type === 'ironMove') {
      out.push({ from: action.from, to: action.to, action })
    } else if (action.type === 'potionSwap') {
      out.push({ from: action.a, to: action.b, action })
      out.push({ from: action.b, to: action.a, action })
    }
  }
  return out
}

function singles(actions: readonly Action[]): { at: Hex; action: Action }[] {
  return actions
    .filter((action) => action.type === 'place' || action.type === 'plantTarget')
    .map((action) => ({ at: action.type === 'place' ? action.at : action.at, action }))
}

function unique(hexes: readonly Hex[]): Hex[] {
  const seen = new Set<string>()
  const out: Hex[] = []
  for (const hex of hexes) {
    if (seen.has(key(hex))) continue
    seen.add(key(hex))
    out.push(hex)
  }
  return out
}

/** Which spaces are tappable right now, given what is already selected. */
export function boardTargets(actions: readonly Action[], first: Hex | null): Hex[] {
  const twoHex = pairs(actions)
  if (twoHex.length > 0) {
    if (!first) return unique(twoHex.map((pair) => pair.from))
    return unique(twoHex.filter((pair) => hexEq(pair.from, first)).map((pair) => pair.to))
  }
  return unique(singles(actions).map((entry) => entry.at))
}

/**
 * What a tap does. Every commitment takes two taps: one to say where, one to
 * confirm — a mis-tap on a phone should never cost a placement.
 */
export function resolveTap(
  actions: readonly Action[],
  first: Hex | null,
  hex: Hex,
): { action?: Action; select: Hex | null } {
  const twoHex = pairs(actions)
  if (twoHex.length > 0) {
    if (first && !hexEq(first, hex)) {
      const match = twoHex.find((pair) => hexEq(pair.from, first) && hexEq(pair.to, hex))
      if (match) return { action: match.action, select: null }
    }
    return { select: twoHex.some((pair) => hexEq(pair.from, hex)) ? hex : null }
  }

  const here = singles(actions).filter((entry) => hexEq(entry.at, hex))
  if (here.length === 0) return { select: null }
  if (first && hexEq(first, hex) && here.length === 1) return { action: here[0].action, select: null }
  return { select: hex }
}
