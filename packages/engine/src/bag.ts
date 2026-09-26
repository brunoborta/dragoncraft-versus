import { pick } from './rng.js'
import type { GameState, Token } from './types.js'

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

/** Draws up to `count` tokens, stopping early when the bag runs dry for good. */
export function drawMany(state: GameState, count: number): { state: GameState; tokens: Token[] } {
  let current = state
  const tokens: Token[] = []
  for (let i = 0; i < count; i++) {
    const drawn = drawToken(current)
    if (!drawn.token) break
    current = drawn.state
    tokens.push(drawn.token)
  }
  return { state: current, tokens }
}

/** Puts tokens back. Never clears an end trigger that already fired. */
export function returnToBag(state: GameState, tokens: readonly Token[]): GameState {
  return { ...state, bag: [...state.bag, ...tokens] }
}
