import type { PlayerView } from '@dcv/engine'
import { useCallback, useEffect, useRef, useState } from 'react'
import { endCause, triggerPoint } from '../game/endSignal.js'
import type { EndCause } from '../game/endSignal.js'
import { BANNER_HOLD, BannerLayer } from './TurnBanner.js'

type Due = { cause: EndCause; point: number }
type Up = Due & { key: number }

export const END_LINE: Record<EndCause, string> = {
  bag: 'The bag is empty',
  deck: 'The deck is empty',
}

/**
 * "Final turn!" the moment the end of the game goes off (spec
 * 2026-11-21-end-banner-design). The view knows ahead of the screen, so the
 * banner is owed when `endTriggered` flips and goes up at the point of the play
 * that set it off: once every queued event before that point has played. The
 * events from that point on wait behind it (`holds`, read by the presentation
 * gate) — a crystal's three draws come after the banner, not before.
 *
 * Against the turn banner: when the bag ran out the turn has just begun, and
 * its banner goes first; when the deck ran out the turn has just ended, and
 * this one goes before the next turn's (the screen holds that one back).
 *
 * A screen that opens on a game already ending, or a view that jumps rather
 * than moves on, shows no banner — only the crosses (`revealed`).
 */
export function useEndBanner({
  view,
  remaining,
  menuOver,
  turn,
}: {
  view: Pick<PlayerView, 'endTriggered' | 'log' | 'deckCount' | 'bag' | 'extrasAdded' | 'phase'>
  /** The presentation's queue: what is still to play, by log position. */
  remaining: readonly { seq: number }[]
  menuOver: boolean
  /** The turn banner: owed or up, and up. */
  turn: { pending: boolean; up: boolean }
}): {
  banner: Up | null
  pending: boolean
  cause: EndCause | null
  holds: (seq: number) => boolean
  revealed: boolean
  dismiss: () => void
} {
  const [due, setDue] = useState<Due | null>(null)
  const [banner, setBanner] = useState<Up | null>(null)
  const [revealed, setRevealed] = useState(view.endTriggered)
  const seen = useRef({ endTriggered: view.endTriggered, length: view.log.length })
  const count = useRef(0)

  useEffect(() => {
    const before = seen.current
    seen.current = { endTriggered: view.endTriggered, length: view.log.length }
    if (!view.endTriggered) {
      // a new game on the same screen
      setDue(null)
      setRevealed(false)
      return
    }
    if (before.endTriggered) return
    if (view.log.length < before.length) {
      setRevealed(true)
      return
    }
    const cause = endCause(view)
    setDue({ cause, point: triggerPoint(view.log.slice(before.length), before.length, cause) })
  }, [view])

  const blocked = menuOver || turn.up || (due?.cause === 'bag' && turn.pending)
  const earlier = due !== null && remaining.some((event) => event.seq >= 0 && event.seq < due.point)
  const ended = view.phase === 'ended'

  useEffect(() => {
    if (!due) return
    if (ended) {
      setDue(null)
      setRevealed(true)
      return
    }
    if (blocked || earlier) return
    setBanner({ ...due, key: ++count.current })
    setRevealed(true)
    setDue(null)
  }, [due, blocked, earlier, ended])

  useEffect(() => {
    if (!banner) return
    const timer = setTimeout(() => setBanner(null), BANNER_HOLD)
    return () => clearTimeout(timer)
  }, [banner])

  const active = due ?? banner
  const holds = useCallback((seq: number) => active !== null && seq >= 0 && seq >= active.point, [active])

  return {
    banner,
    pending: active !== null,
    cause: active?.cause ?? null,
    holds,
    revealed,
    dismiss: () => setBanner(null),
  }
}

/** The ember banner: "Final turn!" and why. Decorative, as the turn banner is: the live line says it. */
export function EndBanner({ banner, onDismiss }: { banner: Up | null; onDismiss: () => void }) {
  return (
    <BannerLayer side="end" bannerKey={banner?.key ?? null} onDismiss={onDismiss}>
      Final turn!
      {banner ? <span className="turn-banner-sub">{END_LINE[banner.cause]}</span> : null}
    </BannerLayer>
  )
}
