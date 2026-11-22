import { useEffect, useRef, useState } from 'react'
import { useArt } from '../art/ArtContext.js'
import type { MaplePose } from '../art/poses.js'
import { DESSERT } from '../game/tutorial/chapters.js'
import type { Step } from '../game/tutorial/script.js'
import type { ChapterCard } from '../game/tutorial/useTutorialTable.js'
import { useReducedMotion } from '../motion.js'
import { HoleShape, blockers, useHoles } from './spotlight.js'
import type { Hole } from './spotlight.js'

/** How long Maple takes to fly from the class to the opponent's seat. */
export const FLY_MS = 700
/**
 * The height the class places Maple and his ribbon by: his bust and a ribbon
 * of three lines. A line that wraps differently grows the ribbon downwards and
 * leaves him where he stands.
 */
const STANDING_HEIGHT = 320
/** How long the screen must have been still before Maple speaks. */
export const SETTLE_MS = 150
/** The longest a line waits for what it lights to be there. */
export const SPOT_PATIENCE = 1000
/** How long his portrait shows as the seat portrait before it lifts off. */
export const SWAP_MS = 450

const EDGE = 16

/**
 * Where the ribbon goes: the first of its places that covers none of the lit
 * spots — or, if each covers one, the one that covers least. In the class and
 * at the offer, the middle first, then the foot and the top of the screen; in
 * the lessons, under Maple's plate first, then the foot.
 */
export function ribbonTop(
  holes: readonly Hole[],
  act: 1 | 2 | 3,
  ribbon: number,
  screen: number,
  underPlate: number,
): number {
  const places =
    act === 2 ? [underPlate, screen - ribbon - EDGE] : [(screen - ribbon) / 2, screen - ribbon - EDGE, EDGE]
  const covered = (top: number) =>
    holes.reduce((sum, hole) => sum + Math.max(0, Math.min(top + ribbon, hole.y + hole.h) - Math.max(top, hole.y)), 0)
  return places.reduce((best, top) => (covered(top) < covered(best) ? top : best), places[0])
}

/** The bottom of the opponent's plate: where the ribbon hangs in the lessons. */
function plateBottom(): number {
  const bar = document.querySelector('.top-bar')
  return bar ? bar.getBoundingClientRect().bottom + 6 : 72
}

/**
 * Professor Maple over the game (spec, "Layout"): the screen dark but for the
 * spotlight, and her line in the green ribbon. In the class (act 1) and at
 * the warm-up offer (act 3) she stands in the middle, large; in the lessons
 * (act 2) she sits in the opponent's seat and the ribbon hangs under her
 * plate. A line to read goes on with a tap anywhere; a thing to do lets only
 * the lit spots be touched. While the game is still animating she waits.
 */
export function Coach({
  act,
  step,
  busy,
  onNext,
  onSkip,
  onPlay,
  onMenu,
  page = null,
  canBack = false,
  onBack = () => {},
  card = null,
  onDismissCard = () => {},
  departing = false,
  onLanded = () => {},
}: {
  /** The class is over: Maple flies from over the ribbon to his seat at the top. */
  departing?: boolean
  /** He is in his seat (at once under reduced motion). */
  onLanded?: () => void
  act: 1 | 2 | 3
  step: Step | null
  busy: boolean
  onNext: () => void
  onSkip: () => void
  onPlay: () => void
  onMenu: () => void
  /** Where the line stands in its chapter: "Ch. 4 · Main Course", "2/7". */
  page?: { chapter: { number: number; title: string }; page: number; pages: number } | null
  canBack?: boolean
  onBack?: () => void
  /** A chapter's title card, on the way in. */
  card?: ChapterCard | null
  onDismissCard?: () => void
}) {
  const art = useArt()
  const reduced = useReducedMotion()
  const [asking, setAsking] = useState(false)
  /*
   * The screen says it is busy a frame or two after a move — the banner a move
   * owes is only known on the next render. Appearing the moment it reads idle
   * would flash the coach for that frame, so it waits for the screen to have
   * been still a moment; it goes away at once.
   */
  const [settled, setSettled] = useState(!busy)
  useEffect(() => {
    if (busy) {
      setSettled(false)
      return
    }
    const timer = setTimeout(() => setSettled(true), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [busy])
  // Maple's own moves are watched as the player will see them in a game: nothing of the coach on screen
  const speaking = !busy && settled && ((step !== null && step.kind !== 'play') || act === 3)
  const spots = step?.spots ?? []
  const holes = useHoles(spots, speaking)
  /*
   * A line that lights something waits for it to be there: an answer still
   * fading in, or not yet in its place, would otherwise be ringed where it is
   * not. Never longer than a moment — a spot that does not come does not hold
   * the lesson up.
   */
  const [waitedOut, setWaitedOut] = useState(false)
  useEffect(() => {
    setWaitedOut(false)
    if (!speaking || spots.length === 0) return
    const timer = setTimeout(() => setWaitedOut(true), SPOT_PATIENCE)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the wait is per line, not per spot list identity
  }, [speaking, step])
  const shown = speaking && (spots.length === 0 || holes.length > 0 || waitedOut)
  const wrap = useRef<HTMLElement>(null)
  const [ribbonHeight, setRibbonHeight] = useState(0)
  useEffect(() => {
    const height = wrap.current?.offsetHeight ?? 0
    if (height !== ribbonHeight) setRibbonHeight(height)
  })

  /*
   * The class is over: over his last line, Maple's portrait turns into his
   * round seat portrait, and that flies from where it stands to the
   * opponent's plate. Once it lands the lessons begin (`onLanded`).
   */
  const [flying, setFlying] = useState<{ from: DOMRect; to: DOMRect } | null>(null)
  const [gone, setGone] = useState(false)
  const portrait = useRef<HTMLImageElement>(null)
  const landed = useRef(onLanded)
  landed.current = onLanded
  useEffect(() => {
    if (!departing) {
      // a flight cut short (a jump, a restart) does not leave his portrait hanging over the top bar
      setGone(false)
      setFlying(null)
      return
    }
    if (reduced) {
      const timer = setTimeout(() => landed.current(), 0)
      return () => clearTimeout(timer)
    }
    let landing: ReturnType<typeof setTimeout> | undefined
    // a beat for the swap to be seen, then the flight
    const lift = setTimeout(() => {
      const from = portrait.current?.getBoundingClientRect()
      const seat = document.querySelector('.top-bar .avatar')
      if (!from || !seat) {
        landed.current()
        return
      }
      setFlying({ from, to: seat.getBoundingClientRect() })
      setGone(true)
      landing = setTimeout(() => {
        setFlying(null)
        landed.current()
      }, FLY_MS)
    }, SWAP_MS)
    return () => {
      clearTimeout(lift)
      if (landing) clearTimeout(landing)
    }
  }, [departing, reduced])

  useEffect(() => setAsking(false), [step])

  const kind = act === 3 ? 'offer' : step?.kind ?? 'say'
  const clear = step?.kind === 'say' && step.clear === true
  const pose: MaplePose = act === 3 ? 'welcoming' : step && step.kind !== 'play' ? (step.pose ?? 'explaining') : 'explaining'
  const line =
    act === 3
      ? 'You did it! You’re now a Drachelor of Culinary Arts. Fancy a warm-up game against me? I’ll go easy on you.'
      : step && step.kind !== 'play'
        ? step.text
        : ''
  const width = typeof window === 'undefined' ? 0 : window.innerWidth
  const height = typeof window === 'undefined' ? 0 : window.innerHeight

  const skip = (
    <div className="coach-skip">
      {asking ? (
        <>
          <span>Leave the lesson?</span>
          <button type="button" onClick={onSkip}>
            Yes
          </button>
          <button type="button" onClick={() => setAsking(false)}>
            Keep going
          </button>
        </>
      ) : (
        <button type="button" className="coach-skip-link" onClick={() => setAsking(true)}>
          Skip tutorial
        </button>
      )}
    </div>
  )

  return (
    <div className="coach" data-act={act} data-kind={kind} data-shown={shown || undefined}>
      {shown ? (
        <>
          <svg className="coach-dim" aria-hidden="true" width="100%" height="100%">
            <defs>
              <mask id="coach-mask">
                <rect width="100%" height="100%" fill="white" />
                {holes.map((hole, i) => (
                  <HoleShape key={i} hole={hole} className="coach-hole" fill="black" />
                ))}
              </mask>
            </defs>
            {/* a clear line leaves the screen as the player sees it: no shade, no ring */}
            {clear ? null : (
              <>
                <rect width="100%" height="100%" mask="url(#coach-mask)" className="coach-shade" />
                {holes.map((hole, i) => (
                  <HoleShape key={i} hole={hole} className={hole.still ? 'coach-ring coach-ring-still' : 'coach-ring'} />
                ))}
              </>
            )}
          </svg>
          {/* what a tap outside the lit spots meets: a line to read goes on; a thing to do lets only the spots through */}
          {kind === 'do' && holes.length ? (
            <svg className="coach-catcher coach-catcher-holes" data-testid="coach-catcher" width="100%" height="100%">
              {blockers(holes, width, height).map((cell, i) => (
                <rect key={i} x={cell.x} y={cell.y} width={cell.w} height={cell.h} />
              ))}
            </svg>
          ) : (
            <div
              className="coach-catcher"
              data-testid="coach-catcher"
              onClick={() => {
                if (kind === 'say') onNext()
              }}
            />
          )}
          {line ? (
            <section
              ref={wrap}
              className="coach-ribbon-wrap"
              style={
                ribbonHeight
                  ? {
                      top: ribbonTop(
                        holes,
                        act,
                        // standing in the middle, Maple keeps his place as lines come and go: the block is
                        // placed by a fixed height, and only a line longer than that moves him
                        act === 2 ? ribbonHeight : Math.max(ribbonHeight, STANDING_HEIGHT),
                        height,
                        plateBottom(),
                      ),
                    }
                  : undefined
              }
              aria-label="Professor Maple"
            >
              {/* Maple, in the pose for what he is talking about: large in the class and at dessert, beside the ribbon in the lessons */}
              <img
                ref={act === 2 ? undefined : portrait}
                className={act === 2 ? 'coach-bust' : departing ? 'coach-portrait coach-seat' : 'coach-portrait'}
                src={departing ? art.mapleAvatar : art.maple[pose]}
                alt=""
                draggable={false}
                data-pose={departing ? 'seat' : pose}
                style={gone ? { visibility: 'hidden' } : undefined}
              />
              <div className="coach-ribbon" onClick={kind === 'say' ? onNext : undefined}>
                <p className="coach-head">
                  {act === 3 ? (
                    <span>{DESSERT}</span>
                  ) : page ? (
                    <>
                      <span>
                        Ch. {page.chapter.number} · {page.chapter.title}
                      </span>
                      <span className="coach-page">
                        {page.page}/{page.pages}
                      </span>
                    </>
                  ) : null}
                </p>
                <p className="coach-line" aria-live="polite">
                  {line}
                </p>
                {kind === 'offer' ? (
                  <div className="coach-offer" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="primary" onClick={onPlay}>
                      Let’s play
                    </button>
                    <button type="button" onClick={onMenu}>
                      Back to menu
                    </button>
                  </div>
                ) : (
                  <div className="coach-foot" onClick={(event) => event.stopPropagation()}>
                    {skip}
                    {asking ? null : (
                      <div className="coach-steps">
                        <button type="button" className="coach-back" aria-label="Back" disabled={!canBack || departing} onClick={onBack}>
                          ◂ Back
                        </button>
                        {/* a thing to do is done on the board, not skipped: Next waits for it */}
                        <button
                          type="button"
                          className="coach-next"
                          aria-label="Next"
                          disabled={kind !== 'say' || departing}
                          onClick={onNext}
                        >
                          Next ▸
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {card ? (
        // the chapter's title, as a banner is: a beat, or a tap
        <div className="coach-card-layer" onClick={onDismissCard}>
          <div className="coach-card">
            {card.number !== null ? <span className="coach-card-number">Chapter {card.number}</span> : null}
            <span className="coach-card-title">{card.title}</span>
          </div>
        </div>
      ) : null}
      {flying ? (
        <img
          className="coach-flight"
          src={art.mapleAvatar}
          alt=""
          aria-hidden="true"
          style={
            {
              '--from-x': `${flying.from.left}px`,
              '--from-y': `${flying.from.top}px`,
              '--from-size': `${flying.from.width}px`,
              '--to-x': `${flying.to.left}px`,
              '--to-y': `${flying.to.top}px`,
              '--to-size': `${flying.to.width}px`,
              animationDuration: `${FLY_MS}ms`,
            } as React.CSSProperties
          }
        />
      ) : null}
    </div>
  )
}
