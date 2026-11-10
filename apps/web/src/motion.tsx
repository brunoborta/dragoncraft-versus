import type { ReactNode } from 'react'
import { MotionConfig, useReducedMotion as usePrefersReducedMotion } from 'motion/react'

/**
 * Motion tokens (v3 plan, section 3.4), in milliseconds. The same values live in
 * `styles.css` as `--t-*` for the transitions CSS handles on its own; these are
 * for the choreography `motion` drives from React.
 */
export const DURATION = {
  /** Answer to a tap: the scale-down of a pressed button. */
  tap: 100,
  /** Panels opening, a state changing. */
  ui: 200,
  /** A token travelling across the board. */
  move: 350,
  /** The moments: turn banner, bag draw, scoring. */
  show: 900,
} as const

/** Tokens landing, cards settling. */
export const SPRING = { type: 'spring', stiffness: 400, damping: 28 } as const

/** Whatever leaves the screen does it in 60% of the time it took to arrive. */
export const EXIT_FACTOR = 0.6

/**
 * Animation never gates the game, and the tests play whole matches through the
 * DOM: under vitest every animation takes zero time, so nothing a test waits on
 * can be left mid-flight.
 */
export const ANIMATIONS_OFF = import.meta.env.MODE === 'test'

/**
 * True when movement should give way to a short crossfade: the player asked for
 * reduced motion, or this is a test run. Particles and ambient effects check
 * this and simply do not start.
 */
export function useReducedMotion(): boolean {
  const prefersReduced = usePrefersReducedMotion()
  return ANIMATIONS_OFF || prefersReduced === true
}

/**
 * Wraps the app once. `reducedMotion="user"` makes every `motion` component drop
 * transform animations when the device asks for reduced motion; `skipAnimations`
 * makes them land instantly in tests.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" skipAnimations={ANIMATIONS_OFF}>
      {children}
    </MotionConfig>
  )
}
