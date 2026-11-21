import type { Action, GameState, HexKey } from '@dcv/engine'
import type { TokenSpec } from './scenario.js'

/** What the screen does that the engine never hears about. */
export type UiEvent = { kind: 'openSettings' } | { kind: 'closeSettings' } | { kind: 'inspect'; hex: HexKey }

/** One thing a `do` step waits for: an action (matched partially), a tap on the screen, or Undo. */
export type Expect = { action: Partial<Action> } | { ui: UiEvent } | { undo: true }

/**
 * A line of the lesson (spec, "Roteiro"). `say`: Maple talks, a tap goes on.
 * `do`: the player does exactly what `expect` lists, in order. `play`: Maple
 * makes one scripted move. `spots` are the CSS selectors the spotlight opens
 * on; `draws` are the tokens the step's first action must bring out of the bag.
 */
export type Step =
  | { kind: 'say'; text: string; spots?: string[] }
  | {
      kind: 'do'
      text: string
      spots?: string[]
      expect: Expect[]
      draws?: TokenSpec[]
      /** Shown on screen beside what is expected (the flame next to Skip), but not accepted. */
      show?: Partial<Action>[]
    }
  | { kind: 'play'; action: Action; spots?: string[]; draws?: TokenSpec[] }

/**
 * `idle`: what the screen shows while nothing in particular is asked — in the
 * class, the token waiting to be placed, so End turn shows its lock.
 */
export type Lesson = { id: string; act: 1 | 2; build: () => GameState; steps: Step[]; idle?: Partial<Action> }

function same(have: unknown, want: unknown): boolean {
  if (Array.isArray(want)) {
    if (!Array.isArray(have) || have.length !== want.length) return false
    // a coin's two cards are a pair, not a sequence
    if (want.every((item) => typeof item === 'string')) return [...have].sort().join() === [...want].sort().join()
    return want.every((item, i) => same(have[i], item))
  }
  if (want !== null && typeof want === 'object') {
    if (have === null || typeof have !== 'object') return false
    return Object.entries(want).every(([k, v]) => same((have as Record<string, unknown>)[k], v))
  }
  return have === want
}

/**
 * True when every field `want` names has the same value in `action`. A swap
 * is the same swap either way round: the engine lists each pair once, in its
 * own order.
 */
export function matches(action: Action, want: Partial<Action>): boolean {
  if (same(action, want)) return true
  if (action.type !== 'potionSwap' || !('a' in want) || !('b' in want)) return false
  return same({ ...action, a: action.b, b: action.a }, want)
}

export function uiMatches(event: UiEvent, want: UiEvent): boolean {
  return same(event, want)
}

/**
 * What the screen offers on this step. A `do` step: exactly the actions that
 * answer what it waits for next. A `say` step: what the next step will offer,
 * shown but not tappable (the coach covers the screen), so the End turn button
 * or the fire-up choice Maple is talking about is already there. Anything
 * else: nothing.
 */
export function offered(
  steps: readonly Step[],
  index: number,
  done: number,
  actions: readonly Action[],
  idle?: Partial<Action>,
): Action[] {
  const step = steps[index]
  const fallback = () => (idle ? actions.filter((action) => matches(action, idle)) : [])
  if (!step) return fallback()
  if (step.kind === 'say') {
    const next = offered(steps, index + 1, 0, actions)
    return next.length ? next : fallback()
  }
  if (step.kind !== 'do') return []
  const want = step.expect[done]
  if (!want || !('action' in want)) return []
  const wanted = [want.action, ...(done === 0 ? (step.show ?? []) : [])]
  return actions.filter((action) => wanted.some((w) => matches(action, w)))
}

/** True when `action` answers what the step waits for now: shown-only actions are not. */
export function accepts(step: Step | undefined, done: number, action: Action): boolean {
  if (step?.kind !== 'do') return false
  const want = step.expect[done]
  return want !== undefined && 'action' in want && matches(action, want.action)
}
