import { useEffect, useState } from 'react'
import { useReducedMotion } from '../motion.js'

/** Fixed, not random: the same motes on every render, and nothing for a test to chase. */
const MOTES = [
  [8, 22, 0, 3], [18, 64, 2.1, 2], [27, 38, 4.3, 4], [36, 82, 1.2, 2], [44, 14, 5.8, 3],
  [53, 56, 3.4, 2], [61, 30, 0.7, 4], [70, 74, 2.9, 3], [79, 46, 6.2, 2], [88, 18, 1.8, 3],
  [93, 68, 4.9, 2], [12, 90, 3.7, 3],
] as const

/**
 * The greenhouse is alive (plan M15): specks of light drifting up through the
 * sunbeams, behind everything. Minimal on purpose — a dozen motes, CSS only.
 * Gone under reduced motion, and paused while the tab is hidden, so a phone in
 * a pocket spends nothing on it.
 */
export function Ambience() {
  const reduced = useReducedMotion()
  const [hidden, setHidden] = useState(() => globalThis.document?.visibilityState === 'hidden')

  useEffect(() => {
    const onChange = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  if (reduced) return null
  return (
    <div className="ambience" data-paused={hidden || undefined} aria-hidden="true">
      {MOTES.map(([x, y, delay, size], index) => (
        <span
          key={index}
          className="mote"
          style={
            {
              left: `${x}%`,
              top: `${y}%`,
              '--delay': `${-delay}s`,
              '--size': `${size}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
