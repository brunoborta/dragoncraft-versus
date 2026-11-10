import { useEffect, useRef, useState } from 'react'
import { ANIMATIONS_OFF, useReducedMotion } from '../motion.js'

/**
 * A number that counts up to its new value instead of jumping (plan M10, M14):
 * reputation gained, a final score revealed. It waits `delay` ms first, so the
 * count can start when the card lands on the plate rather than when the move
 * was made. Going down (an undo) it snaps: nothing is being celebrated.
 */
export function useCountUp(value: number, { delay = 0, duration = 600, from }: { delay?: number; duration?: number; from?: number } = {}): number {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(from ?? value)
  const last = useRef(from ?? value)

  useEffect(() => {
    const start = last.current
    last.current = value
    if (ANIMATIONS_OFF || reduced || value <= start) {
      setShown(value)
      return
    }
    let frame = 0
    let began = 0
    const timer = setTimeout(() => {
      const tick = (now: number) => {
        if (!began) began = now
        const t = Math.min(1, (now - began) / duration)
        // ease out: quick at first, settling on the number
        setShown(Math.round(start + (value - start) * (1 - (1 - t) ** 3)))
        if (t < 1) frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
    }, delay)
    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(frame)
      setShown(value)
    }
  }, [value, delay, duration, reduced])

  return shown
}
