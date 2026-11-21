import { useEffect, useRef, useState } from 'react'
import { useArt } from '../art/ArtContext.js'
import type { Step } from '../game/tutorial/script.js'
import { useReducedMotion } from '../motion.js'

/** Room around a lit element, and the roundness of its hole. */
const PAD = 8
const RADIUS = 14
/** How often the holes are measured again: the screen animates under them. */
const MEASURE_EVERY = 150
/** How long Maple takes to fly from the class to the opponent's seat. */
export const FLY_MS = 700

type Hole = { x: number; y: number; w: number; h: number }

/** The holes the spotlight opens: every element each selector finds, padded. Nothing found, no hole. */
export function measureHoles(spots: readonly string[]): Hole[] {
  const holes: Hole[] = []
  for (const selector of spots) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue
      holes.push({ x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 })
    }
  }
  return holes
}

function useHoles(spots: readonly string[], active: boolean): Hole[] {
  const [holes, setHoles] = useState<Hole[]>([])
  const key = spots.join('|')
  useEffect(() => {
    if (!active) {
      setHoles([])
      return
    }
    const list = key ? key.split('|') : []
    const measure = () =>
      setHoles((current) => {
        const next = measureHoles(list)
        return JSON.stringify(next) === JSON.stringify(current) ? current : next
      })
    measure()
    const timer = setInterval(measure, MEASURE_EVERY)
    window.addEventListener('resize', measure)
    return () => {
      clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  }, [key, active])
  return holes
}

/**
 * What blocks a tap while something is to be done: the screen cut into a grid
 * along every hole's edges, keeping the cells outside all holes. Overlapping
 * holes (a space and the token hovering over it are found twice) stay open —
 * a fill rule would close them again where they overlap.
 */
export function blockers(holes: readonly Hole[], width: number, height: number): Hole[] {
  const edges = (lo: number, hi: number, cuts: number[]) =>
    [...new Set([lo, hi, ...cuts.map((c) => Math.min(hi, Math.max(lo, c)))])].sort((a, b) => a - b)
  const xs = edges(0, width, holes.flatMap((h) => [h.x, h.x + h.w]))
  const ys = edges(0, height, holes.flatMap((h) => [h.y, h.y + h.h]))
  const open = (x: number, y: number) => holes.some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h)
  const cells: Hole[] = []
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const cell = { x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] }
      if (cell.w > 0 && cell.h > 0 && !open(cell.x + cell.w / 2, cell.y + cell.h / 2)) cells.push(cell)
    }
  }
  return cells
}

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
}: {
  act: 1 | 2 | 3
  step: Step | null
  busy: boolean
  onNext: () => void
  onSkip: () => void
  onPlay: () => void
  onMenu: () => void
}) {
  const art = useArt()
  const reduced = useReducedMotion()
  const [asking, setAsking] = useState(false)
  const shown = !busy && (step !== null || act === 3)
  const holes = useHoles(step?.spots ?? [], shown)
  const wrap = useRef<HTMLElement>(null)
  const [ribbonHeight, setRibbonHeight] = useState(0)
  useEffect(() => {
    const height = wrap.current?.offsetHeight ?? 0
    if (height !== ribbonHeight) setRibbonHeight(height)
  })

  // the class is over: Maple flies to her seat
  const [flying, setFlying] = useState<{ from: DOMRect; to: DOMRect } | null>(null)
  const lastAct = useRef(act)
  const portrait = useRef<HTMLImageElement>(null)
  // where the portrait last stood: it is gone by the time act 2 renders
  const lastPortrait = useRef<DOMRect | null>(null)
  useEffect(() => {
    if (portrait.current) lastPortrait.current = portrait.current.getBoundingClientRect()
  })
  useEffect(() => {
    const was = lastAct.current
    lastAct.current = act
    if (was !== 1 || act !== 2 || reduced) return
    const seat = document.querySelector('.top-bar .avatar')
    const from = lastPortrait.current
    if (!seat || !from) return
    setFlying({ from, to: seat.getBoundingClientRect() })
    const timer = setTimeout(() => setFlying(null), FLY_MS)
    return () => clearTimeout(timer)
  }, [act, reduced])

  useEffect(() => setAsking(false), [step])

  const kind = act === 3 ? 'offer' : step?.kind ?? 'say'
  const line =
    act === 3
      ? 'You’ve got the knack of it. Fancy a warm-up game against me? I’ll go easy on you.'
      : step && step.kind !== 'play'
        ? step.text
        : ''
  const width = typeof window === 'undefined' ? 0 : window.innerWidth
  const height = typeof window === 'undefined' ? 0 : window.innerHeight

  const skip = (
    <div className="coach-skip" onClick={(event) => event.stopPropagation()}>
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
                  <rect key={i} className="coach-hole" x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} fill="black" />
                ))}
              </mask>
            </defs>
            <rect width="100%" height="100%" mask="url(#coach-mask)" className="coach-shade" />
            {holes.map((hole, i) => (
              <rect key={i} className="coach-ring" x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} />
            ))}
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
              style={ribbonHeight ? { top: ribbonTop(holes, act, ribbonHeight, height, plateBottom()) } : undefined}
              aria-label="Professor Maple"
            >
              {act !== 2 ? <img ref={portrait} className="coach-portrait" src={art.avatarOpponent} alt="" draggable={false} /> : null}
              <div className="coach-ribbon" onClick={kind === 'say' ? onNext : undefined}>
                <p className="coach-line" aria-live="polite">
                  {line}
                </p>
                {kind === 'say' ? (
                  <button
                    type="button"
                    className="coach-next"
                    aria-label="Next"
                    onClick={(event) => {
                      event.stopPropagation()
                      onNext()
                    }}
                  >
                    ▸
                  </button>
                ) : null}
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
                  skip
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
      {flying ? (
        <img
          className="coach-flight"
          src={art.avatarOpponent}
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
