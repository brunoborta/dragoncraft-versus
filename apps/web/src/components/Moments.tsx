import { BOARD, hexEq, key } from '@dcv/engine'
import type { Hex, Seat, ShopCard } from '@dcv/engine'
import { motion } from 'motion/react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { useArt } from '../art/ArtContext.js'
import { HEX_SIZE, hexCenter, hexOnScreen, hexPoints } from '../geometry.js'
import type { PresentationEvent } from '../game/presentation.js'
import { FLIGHT, HOLD } from '../game/presentation.js'
import { useReducedMotion } from '../motion.js'
import { DRAGON_THEME } from '../theme.js'
import { STONE_SCALE, TOKEN_RADIUS } from './HexCell.js'
import { DEF } from './SvgDefs.js'
import { StarIcon } from './icons.js'
import { PatternGlyph } from './PatternGlyph.js'
import { TokenGlyph } from './TokenGlyph.js'

/**
 * The moments drawn over the board while an event plays (plan section 4).
 * None of them is the truth: the cells underneath already show the result,
 * and a tap anywhere skips the lot. Everything here is `aria-hidden`; the
 * screen reader hears the announcement the presentation hook writes.
 */

/* ------------------------------------------------------------------ M2 ----- */

/** A token's size in its slot, in px: the flights start or end at this size. */
function slotSize(selector: string, within: HTMLElement | null): number {
  return within?.querySelector(selector)?.getBoundingClientRect().width || 48
}

const SLOT = { you: '.held-slot[data-side="you"] .held-anchor', opponent: '.held-slot[data-side="opponent"] .held-anchor' }

/**
 * A token out of the bag (M2), on its way to the hand that drew it: it rises
 * from the bag, shows itself big over the board for a beat — the one moment
 * everybody looks at what came out — and settles into its home: your tray
 * under the board, or the opponent's slot under their portrait. The bag
 * shakes meanwhile (CSS, on the bag). No caption: the token says what it is.
 *
 * Drawn over the whole screen, since it travels from the board's corner to a
 * slot outside the board.
 */
export function DrawFlight({
  event,
  seat,
  within,
}: {
  event: Extract<PresentationEvent, { kind: 'draw' }>
  seat: Seat
  within: HTMLElement | null
}) {
  const reduced = useReducedMotion()
  const mine = event.seat === seat
  const [path, setPath] = useState<{ from: Point; mid: Point; to: Point; size: number } | null>(null)

  useLayoutEffect(() => {
    const from = centreOf('.bag-art', within)
    const mid = centreOf('.board', within)
    const to = centreOf(mine ? SLOT.you : SLOT.opponent, within)
    if (from && mid && to) setPath({ from, mid, to, size: slotSize(mine ? SLOT.you : SLOT.opponent, within) })
  }, [within, mine])

  if (!path) return null
  const hold = (mine ? HOLD.draw : HOLD.drawTheirs) / 1000
  const { from, mid, to, size } = path
  // the reveal: big over the board, bigger for your own draw
  const big = mine ? 2.3 : 1.8
  return (
    <div className="draw-flight" data-side={mine ? 'you' : 'opponent'} aria-hidden="true">
      <motion.div
        className="draw-token"
        style={{ left: 0, top: 0, width: size, height: size * 1.075, margin: `${-size / 2}px 0 0 ${-size / 2}px` }}
        initial={reduced ? { x: to.x, y: to.y, opacity: 0 } : { x: from.x, y: from.y, scale: 0.4, rotate: -200, opacity: 0 }}
        animate={
          reduced
            ? { opacity: [0, 1, 0], transition: { duration: hold } }
            : {
                x: [from.x, mid.x, mid.x, to.x],
                y: [from.y, mid.y, mid.y, to.y],
                scale: [0.4, big * 1.08, big, 1],
                rotate: [-200, 8, 0, 0],
                opacity: [0, 1, 1, 1],
                transition: { duration: hold, times: [0, 0.38, 0.66, 1], ease: ['easeOut', 'easeInOut', 'easeIn'] },
              }
        }
      >
        <svg viewBox="-10 -10 20 21.5">
          <TokenGlyph token={event.token} radius={9} />
        </svg>
      </motion.div>
    </div>
  )
}

/**
 * The opponent's token leaving their slot for the space it lands on, before it
 * drops there (`FLIGHT` long; the cell's own drop takes over after). Yours
 * needs no flight: it was already hovering over the space. Drawn over the
 * whole screen, since the slot is outside the board.
 */
export function PlaceFlight({
  event,
  within,
}: {
  event: Extract<PresentationEvent, { kind: 'place' }>
  within: HTMLElement | null
}) {
  const reduced = useReducedMotion()
  const [path, setPath] = useState<{ from: Point; to: Point; size: number; land: number } | null>(null)

  useLayoutEffect(() => {
    const from = centreOf(SLOT.opponent, within)
    const to = hexOnScreen(within?.querySelector<SVGSVGElement>('svg.board'), within, event.at)
    if (from && to) setPath({ from, to, size: slotSize(SLOT.opponent, within), land: TOKEN_RADIUS * 2 * to.unit })
  }, [within, event.at])

  if (!path || reduced) return null
  const { from, to, size, land } = path
  const lift = Math.max(40, Math.abs(to.x - from.x) * 0.25)
  return (
    <div className="draw-flight" data-side="opponent" aria-hidden="true">
      <motion.div
        className="draw-token place-flight"
        style={{ left: 0, top: 0, width: size, height: size * 1.075, margin: `${-size / 2}px 0 0 ${-size / 2}px` }}
        initial={{ x: from.x, y: from.y, scale: 1, opacity: 1 }}
        animate={{
          x: [from.x, (from.x + to.x) / 2, to.x, to.x],
          y: [from.y, Math.min(from.y, to.y) - lift, to.y, to.y],
          // lands a little bigger than its cell's token: the cell's drop shrinks it into place
          scale: [1, 1.35, (land / size) * 1.3, (land / size) * 1.3],
          // solid all the way down; it hands over to the cell's token only as it arrives
          opacity: [1, 1, 1, 0],
          transition: { duration: FLIGHT / 1000, times: [0, 0.5, 0.94, 1], ease: 'easeInOut' },
        }}
      >
        <svg viewBox="-10 -10 20 21.5">
          <TokenGlyph token={event.token} radius={9} />
        </svg>
      </motion.div>
    </div>
  )
}

/* ------------------------------------------------------- M7, M8: travel ----- */

/**
 * A token on its way from one space to another, in board units. The cell it
 * lands on keeps its own token hidden until this arrives (`arrival="slide"`),
 * so what the eye sees is one token travelling. The arc lifts it off the board
 * and scales it up a little at the top, as if it came toward you.
 */
function Traveller({
  id,
  from,
  to,
  token,
  duration,
  delay = 0,
  trail,
}: {
  id: string
  from: Hex
  to: Hex
  token: Extract<PresentationEvent, { kind: 'place' }>['token']
  duration: number
  delay?: number
  /** A colour for the glow left behind it (the potion's purple). */
  trail?: string
}) {
  const reduced = useReducedMotion()
  const a = hexCenter(from)
  const b = hexCenter(to)
  const lift = HEX_SIZE * 1.1
  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2 - lift
  if (reduced) return null
  return (
    <motion.g
      key={id}
      className="traveller"
      initial={{ x: a.x, y: a.y, scale: 1 }}
      animate={{
        x: [a.x, midX, b.x],
        y: [a.y, midY, b.y],
        scale: [1, 1.25, 1],
        transition: { duration: duration / 1000, delay: delay / 1000, times: [0, 0.5, 1], ease: 'easeInOut' },
      }}
    >
      {trail ? <circle r={TOKEN_RADIUS * 1.25} fill={trail} opacity={0.45} filter={`url(#${DEF.glow})`} /> : null}
      <TokenGlyph token={token} radius={TOKEN_RADIUS} shadow={false} />
    </motion.g>
  )
}

/* --------------------------------------------------------- M5: fire up ----- */

/** A burst of flame around a token (M5), drawn with CSS keyframes on each tongue. */
export function FlameBurst({ at, ability }: { at: Hex; ability: string }) {
  const c = hexCenter(at)
  const tongues = Array.from({ length: 8 }, (_, i) => i)
  return (
    <g className="flame-burst" transform={`translate(${c.x} ${c.y})`} data-ability={ability}>
      <circle className="flame-ring" r={TOKEN_RADIUS} />
      {/* the position is on a group of its own: a CSS transform animation would override a transform attribute */}
      {tongues.map((i) => (
        <g key={i} transform={`rotate(${i * 45}) translate(0 ${-TOKEN_RADIUS * 0.9})`}>
          <path
            className="flame-tongue"
            style={{ '--i': i } as React.CSSProperties}
            d="M0 0 C 2.2 -2 2.4 -5 0 -8 C -2.4 -5 -2.2 -2 0 0 Z"
          />
        </g>
      ))}
    </g>
  )
}

/* ---------------------------------------------------------- M9: vine ----- */

/** A vine growing from the plant to the neighbour whose ability it borrows (M9). */
export function Vine({ from, to }: { from: Hex; to: Hex }) {
  const a = hexCenter(from)
  const b = hexCenter(to)
  // a gentle curve: the control point sits off the straight line
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cx = (a.x + b.x) / 2 - dy * 0.3
  const cy = (a.y + b.y) / 2 + dx * 0.3
  const d = `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`
  return (
    <g className="vine">
      <path className="vine-stem vine-stem-shadow" d={d} />
      <path className="vine-stem" d={d} />
      {[0.35, 0.7].map((t) => {
        // a leaf part way along the curve
        const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cx + t * t * b.x
        const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cy + t * t * b.y
        return (
          <g key={t} transform={`translate(${x} ${y}) rotate(${(Math.atan2(dy, dx) * 180) / Math.PI - 50})`}>
            <path className="vine-leaf" style={{ '--t': t } as React.CSSProperties} d="M0 0 C 2 -3 5 -3 6 0 C 5 2.5 2 2.5 0 0 Z" />
          </g>
        )
      })}
    </g>
  )
}

/* ------------------------------------------------------- M4: landing ----- */

/** Milliseconds from the start of a placement to the moment the token hits the stone. */
export function landingDelay(mine: boolean): number {
  // the drop squashes at 55% of its 400ms; theirs flies in from the slot first
  return (mine ? 0 : FLIGHT) + 220
}

/** How long a landing stays drawn: until its dust has settled, well after the placement's own slot. */
export function landingLife(mine: boolean): number {
  return landingDelay(mine) + 950
}

export type LandingSpot = { at: Hex; mine: boolean; seq: number }

/**
 * The landing of the latest placement, kept after its event: the placement
 * holds the screen for less time than its dust takes to settle, and dust that
 * vanishes mid-air looks like a glitch.
 */
export function useLanding(event: PresentationEvent | null, viewer?: Seat): LandingSpot | null {
  const [spot, setSpot] = useState<LandingSpot | null>(null)
  useEffect(() => {
    if (event?.kind === 'place') setSpot({ at: event.at, mine: viewer === undefined || event.seat === viewer, seq: event.seq })
  }, [event, viewer])
  useEffect(() => {
    if (!spot) return
    const timer = setTimeout(() => setSpot(null), landingLife(spot.mine))
    return () => clearTimeout(timer)
  }, [spot])
  return spot
}

/**
 * A token hitting the board (M4): a puff of gold dust, the space flashing in
 * the colour of whoever put it there — gold for you, wine for the opponent —
 * and, for the opponent's, the rest of the board dimming for a moment so the
 * eye goes to where they played. Starts as the token hits (`--land-ms`).
 */
export function Landing({ at, mine }: { at: Hex; mine: boolean }) {
  const art = useArt()
  const c = hexCenter(at)
  const width = HEX_SIZE * 4.4
  const height = width * (123 / 320)
  const style = { '--land-ms': `${landingDelay(mine)}ms` } as React.CSSProperties
  return (
    <g className="landing" data-side={mine ? 'you' : 'opponent'} style={style}>
      {mine ? null : (
        // the other spaces of the board, and only those: a rectangle would darken a square around it
        <g className="landing-dim">
          {BOARD.filter((hex) => !hexEq(hex, at)).map((hex) => (
            <polygon key={key(hex)} points={hexPoints(hex)} />
          ))}
        </g>
      )}
      <polygon className="landing-flash" points={hexPoints(at, STONE_SCALE)} />
      {/* the dust sits low, at the token's foot, and spreads */}
      <image
        className="landing-puff"
        href={art.puff}
        x={c.x - width / 2}
        y={c.y + TOKEN_RADIUS * 0.45 - height / 2}
        width={width}
        height={height}
        preserveAspectRatio="none"
      />
    </g>
  )
}

/* ------------------------------------------------- the overlay for the board */

/**
 * Whatever the current event needs drawn on the board, in board units:
 * travellers for moves and swaps, the flame of a fire-up, the vine of a plant.
 * (A placement's landing outlives its event: `useLanding`. The flights to and
 * from a hand are HTML: `DrawFlight`, `PlaceFlight`.)
 */
export function BoardMoment({ event }: { event: PresentationEvent | null }) {
  if (!event) return null
  const tokenAt = (hex: Hex, id: string) => event.board[`${hex.q},${hex.r}`]?.find((entry) => entry.id === id)?.token

  switch (event.kind) {
    case 'move': {
      const token = tokenAt(event.to, event.id)
      return token ? <Traveller id={event.id} from={event.from} to={event.to} token={token} duration={HOLD.move - 60} /> : null
    }
    case 'swap': {
      const [idA, idB] = event.ids
      // after the swap, a's old token is on b and b's on a
      const tokenToB = tokenAt(event.b, idA)
      const tokenToA = tokenAt(event.a, idB)
      const purple = DRAGON_THEME.potion.color
      return (
        <>
          {tokenToB ? <Traveller id={idA} from={event.a} to={event.b} token={tokenToB} duration={HOLD.swap - 80} trail={purple} /> : null}
          {tokenToA ? <Traveller id={idB} from={event.b} to={event.a} token={tokenToA} duration={HOLD.swap - 80} trail={purple} /> : null}
        </>
      )
    }
    case 'score':
      // M10: the three spaces of the pattern light up one after the other
      return (
        <g className="score-rings" data-side={event.seat}>
          {event.hexes.map((hex, index) => {
            const c = hexCenter(hex)
            return (
              <circle
                key={`${hex.q},${hex.r}`}
                className="score-ring"
                style={{ '--i': index } as React.CSSProperties}
                cx={c.x}
                cy={c.y}
                r={TOKEN_RADIUS * 1.2}
                filter={`url(#${DEF.glow})`}
              />
            )
          })}
        </g>
      )
    case 'fireUp':
      if (!event.at) return null
      return (
        <>
          {event.from ? <Vine from={event.from} to={event.at} /> : null}
          <FlameBurst at={event.at} ability={event.ability} />
        </>
      )
    default:
      return null
  }
}

/**
 * How the top token of a cell got there: decides the arrival animation.
 * `fly` is the opponent's: it waits for the token flying in from their slot,
 * then drops like yours.
 */
export type Arrival = 'drop' | 'fly' | 'slide' | 'swap'

/**
 * The arrival of each space's top token under the current event: the placed
 * token drops in (after its flight, if it is the opponent's), a moved token
 * appears when its traveller lands, swapped tokens the same.
 */
export function arrivals(event: PresentationEvent | null, viewer?: Seat): Record<string, Arrival> {
  if (!event) return {}
  const k = (hex: Hex) => `${hex.q},${hex.r}`
  switch (event.kind) {
    case 'place':
      return { [k(event.at)]: viewer === undefined || event.seat === viewer ? 'drop' : 'fly' }
    case 'move':
      return { [k(event.to)]: 'slide' }
    case 'swap':
      return { [k(event.a)]: 'swap', [k(event.b)]: 'swap' }
    default:
      return {}
  }
}

/* ------------------------------------------------------- M10: scoring ----- */

type Point = { x: number; y: number }

/** Where an element is, relative to `within`, in px: the centre of its box. */
function centreOf(selector: string, within: HTMLElement | null): { x: number; y: number } | null {
  const target = within?.querySelector(selector)
  if (!target || !within) return null
  const a = target.getBoundingClientRect()
  const b = within.getBoundingClientRect()
  return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top }
}

/**
 * The scored card (M10): it appears over the board, big, then flies to the
 * scorer's plate and shrinks into it, where stars burst — and the reputation
 * figure counts up (the plate's own `useCountUp`). Drawn over the whole game
 * screen, since it travels from the board to a plate.
 */
export function ScoreMoment({
  event,
  seat,
  within,
}: {
  event: Extract<PresentationEvent, { kind: 'score' }>
  seat: Seat
  within: HTMLElement | null
}) {
  const reduced = useReducedMotion()
  const mine = event.seat === seat
  const [path, setPath] = useState<{ from: { x: number; y: number }; to: { x: number; y: number } } | null>(null)

  useLayoutEffect(() => {
    const from = centreOf('.board', within)
    const to = centreOf(mine ? '.player-bar .plate' : '.top-row .plate', within)
    if (from && to) setPath({ from, to })
  }, [within, mine])

  if (!event.card || !path) return null
  const hold = (event.seat === seat ? HOLD.score : HOLD.score * 0.8) / 1000
  return (
    <div className="score-moment" data-side={mine ? 'you' : 'opponent'} aria-hidden="true">
      <motion.div
        className="score-card"
        style={{ left: 0, top: 0 }}
        initial={{ x: path.from.x, y: path.from.y, scale: 0.6, opacity: 0 }}
        animate={
          reduced
            ? { opacity: [0, 1, 1, 0], transition: { duration: hold } }
            : {
                x: [path.from.x, path.from.x, path.from.x, path.to.x],
                y: [path.from.y, path.from.y - 10, path.from.y - 10, path.to.y],
                scale: [0.6, 1.1, 1, 0.25],
                opacity: [0, 1, 1, 0.2],
                transition: { duration: hold, times: [0, 0.3, 0.6, 0.92], ease: 'easeInOut' },
              }
        }
      >
        <CardFace card={event.card} />
      </motion.div>
      {reduced ? null : (
        <div className="score-burst" style={{ left: path.to.x, top: path.to.y }}>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="score-star" style={{ '--i': i } as React.CSSProperties}>
              <StarIcon />
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** A card as it looks in the hand, for the moments: no controls, no names. */
function CardFace({ card }: { card: ShopCard }) {
  return (
    <div className="card score-card-face">
      <PatternGlyph pattern={card.pattern} />
      <div className="card-foot">
        <span className="card-rep">
          <StarIcon />
          <span>{card.reputation}</span>
        </span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- M11: coin ----- */

/**
 * A coin spent (M11): it leaves the purse (or the opponent's plate) spinning,
 * rises and fades — on its way to buy two cards. For you, the cards then slide
 * into the "keep two" dialog, which waits for this to finish.
 */
export function CoinMoment({
  event,
  seat,
  within,
}: {
  event: Extract<PresentationEvent, { kind: 'coin' }>
  seat: Seat
  within: HTMLElement | null
}) {
  const art = useArt()
  const reduced = useReducedMotion()
  const mine = event.seat === seat
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    setFrom(centreOf(mine ? '.coin-purse' : '.top-row .plate-stats', within))
  }, [within, mine])

  if (!from) return null
  const hold = (mine ? HOLD.coin : HOLD.coin * 0.8) / 1000
  return (
    <div className="coin-moment" aria-hidden="true">
      <motion.img
        className="coin-flying"
        src={art.coin}
        alt=""
        style={{ left: 0, top: 0 }}
        initial={{ x: from.x, y: from.y, scale: 0.6, rotateY: 0, opacity: 0 }}
        animate={
          reduced
            ? { opacity: [0, 1, 0], transition: { duration: hold } }
            : {
                x: [from.x, from.x + (mine ? 20 : 0), from.x + (mine ? 60 : 0)],
                y: [from.y, from.y - 90, from.y - 180],
                scale: [0.8, 1.6, 1],
                rotateY: [0, 540, 1080],
                opacity: [1, 1, 0],
                transition: { duration: hold, times: [0, 0.55, 1], ease: 'easeOut' },
              }
        }
      />
    </div>
  )
}
