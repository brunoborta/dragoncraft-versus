import type { RngState } from './types.js'

/**
 * mulberry32. The state is a 32-bit integer; every function returns the next
 * state instead of holding it. There is no `Math.random` anywhere in the engine.
 */
function nextUint(state: RngState): { value: number; rng: RngState } {
  const rng = (state + 0x6d2b79f5) | 0
  let x = Math.imul(rng ^ (rng >>> 15), 1 | rng)
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
  return { value: (x ^ (x >>> 14)) >>> 0, rng }
}

export function nextInt(state: RngState, bound: number): { value: number; rng: RngState } {
  if (bound <= 0) throw new Error(`nextInt needs a positive bound, got ${bound}`)
  const { value, rng } = nextUint(state)
  return { value: value % bound, rng }
}

export function pick<T>(items: readonly T[], state: RngState): { item: T; index: number; rng: RngState } {
  if (items.length === 0) throw new Error('pick from an empty list')
  const { value, rng } = nextInt(state, items.length)
  return { item: items[value], index: value, rng }
}

/** Fisher-Yates. Returns a fresh array; the input is never touched. */
export function shuffle<T>(items: readonly T[], state: RngState): { items: T[]; rng: RngState } {
  const out = [...items]
  let rng = state
  for (let i = out.length - 1; i > 0; i--) {
    const step = nextInt(rng, i + 1)
    rng = step.rng
    const j = step.value
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return { items: out, rng }
}

/** FNV-1a hash: turns a game identifier into a seed. */
export function seedFrom(text: string): RngState {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h | 0
}
