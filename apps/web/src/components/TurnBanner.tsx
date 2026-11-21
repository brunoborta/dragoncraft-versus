import type { Seat } from '@dcv/engine'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ANIMATIONS_OFF, DURATION, EXIT_FACTOR, useReducedMotion } from '../motion.js'

/** How long the banner stays up, in milliseconds (plan M1: one to two seconds). */
export const BANNER_HOLD = 1400

type Banner = { side: 'you' | 'opponent'; key: number }

/**
 * Which banner is due, if any. A banner is owed when the seat on turn changes
 * (and once at the very start), but it only goes up once `blocked` clears —
 * while the previous turn's moves are still landing, "Your Turn" would
 * announce the turn before the turn has come. `pending` is true from the
 * moment a banner is owed until it has gone: the new turn's own moves wait on
 * it (Hearthstone: banner first, then the card is drawn).
 */
export function useTurnBanner({
  current,
  seat,
  ended,
  blocked,
  opening = true,
}: {
  current: Seat
  seat: Seat
  ended: boolean
  blocked: boolean
  /** False: no banner owed at the start, only on a change of turn (the tutorial's class has no turn to announce). */
  opening?: boolean
}): { banner: Banner | null; pending: boolean; dismiss: () => void } {
  const [owed, setOwed] = useState<Banner['side'] | null>(
    ended || !opening ? null : current === seat ? 'you' : 'opponent',
  )
  const [banner, setBanner] = useState<Banner | null>(null)
  const lastCurrent = useRef(current)
  const count = useRef(0)

  useEffect(() => {
    if (current === lastCurrent.current) return
    lastCurrent.current = current
    setOwed(ended ? null : current === seat ? 'you' : 'opponent')
  }, [current, seat, ended])

  useEffect(() => {
    if (owed === null || blocked) return
    setBanner({ side: owed, key: ++count.current })
    setOwed(null)
  }, [owed, blocked])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), BANNER_HOLD)
    return () => clearTimeout(timer)
  }, [banner])

  return { banner, pending: owed !== null || banner !== null, dismiss: () => setBanner(null) }
}

/**
 * "Your Turn" in green, "Opponent's Turn" in wine (plan M1, colours from 3.1),
 * over a darkened screen with light rays behind it. An overlay, never part of
 * the layout: nothing above the board may change height during a game.
 *
 * Decorative for assistive technology — the turn is already announced by the
 * live line in the top bar — and absent under test for the same reason.
 */
export function TurnBanner({
  banner,
  onDismiss,
  opponentTitle = "Opponent's Turn",
}: {
  banner: Banner | null
  onDismiss: () => void
  /** What the other side's banner says: "Professor's Turn" in the tutorial. */
  opponentTitle?: string
}) {
  return (
    <BannerLayer side={banner?.side ?? 'you'} bannerKey={banner?.key ?? null} onDismiss={onDismiss}>
      {banner?.side === 'opponent' ? opponentTitle : 'Your Turn'}
    </BannerLayer>
  )
}

/**
 * The layer every banner shares: the dimmed screen, the rays, the ribbon
 * springing in, a tap to put it away. `bannerKey` null is no banner; a new key
 * is a new banner, played afresh.
 */
export function BannerLayer({
  side,
  bannerKey,
  onDismiss,
  children,
}: {
  side: 'you' | 'opponent' | 'end'
  bannerKey: number | null
  onDismiss: () => void
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  if (ANIMATIONS_OFF) return null
  const enter = DURATION.show / 1000

  return (
    <AnimatePresence>
      {bannerKey !== null ? (
        <motion.div
          key={bannerKey}
          className="turn-banner-layer"
          data-side={side}
          aria-hidden="true"
          onPointerDown={onDismiss}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: (enter * EXIT_FACTOR) / 2 } }}
          transition={{ duration: enter / 3 }}
        >
          {reduced ? null : <span className="turn-banner-rays" />}
          <motion.div
            className="turn-banner"
            initial={reduced ? { opacity: 0 } : { y: -70, scale: 0.7, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { y: 0, scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: -24, scale: 0.92, opacity: 0 }}
            transition={reduced ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 16 }}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
