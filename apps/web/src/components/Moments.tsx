import type { Hex, Seat, ShopCard } from '@dcv/engine'
import { motion } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { useArt } from '../art/ArtContext.js'
import { HEX_SIZE, hexCenter } from '../geometry.js'
import type { PresentationEvent } from '../game/presentation.js'
import { HOLD } from '../game/presentation.js'
import { useReducedMotion } from '../motion.js'
import { DRAGON_THEME } from '../theme.js'
import { TOKEN_RADIUS } from './HexCell.js'
import { DEF } from './SvgDefs.js'
import { StarIcon } from './icons.js'
import { PatternGlyph } from './PatternGlyph.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/**
 * The moments drawn over the board while an event plays (plan section 4).
 * None of them is the truth: the cells underneath already show the result,
 * and a tap anywhere skips the lot. Everything here is `aria-hidden`; the
 * screen reader hears the announcement the presentation hook writes.
 */

/* ------------------------------------------------------------------ M2 ----- */

/**
 * A token out of the bag (M2): the bag shakes (CSS, on the bag itself), the
 * token rises from the bag's corner to the middle of the board, a ribbon says
 * what it is, and the token shrinks away toward the decision panel below.
 * HTML, not SVG: it travels across the board area, bag corner to centre, in
 * screen pixels.
 */
export function DrawMoment({ event, seat }: { event: Extract<PresentationEvent, { kind: 'draw' }>; seat: Seat }) {
  const reduced = useReducedMotion()
  const mine = event.seat === seat
  const area = useRef<HTMLDivElement>(null)
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null)

  // where the bag is, relative to the centre: bottom right of the board area
  useLayoutEffect(() => {
    const box = area.current?.getBoundingClientRect()
    if (box) setFrom({ x: box.width / 2 - 48, y: box.height / 2 - 56 })
  }, [])

  const hold = (mine ? HOLD.draw : HOLD.drawTheirs) / 1000
  const label = tokenLabel(event.token)

  return (
    <div ref={area} className="draw-moment" data-side={mine ? 'you' : 'opponent'} aria-hidden="true">
      {from ? (
        <motion.div
          className="draw-token"
          initial={reduced ? { opacity: 0, scale: 1 } : { x: from.x, y: from.y, scale: 0.3, rotate: -200, opacity: 0 }}
          animate={
            reduced
              ? { opacity: [0, 1, 1, 0], transition: { duration: hold, times: [0, 0.2, 0.8, 1] } }
              : {
                  x: [from.x, 0, 0, 0],
                  y: [from.y, 0, 0, 120],
                  scale: [0.3, 1.15, 1, 0.45],
                  rotate: [-200, 10, 0, 0],
                  opacity: [0, 1, 1, 0],
                  transition: { duration: hold, times: [0, 0.35, 0.78, 1], ease: ['easeOut', 'easeOut', 'easeIn'] },
                }
          }
        >
          <svg viewBox="-11 -11 22 24">
            <TokenGlyph token={event.token} radius={9.5} />
          </svg>
        </motion.div>
      ) : null}
      <motion.p
        className="draw-ribbon"
        initial={{ opacity: 0, scaleX: 0.6 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scaleX: [0.6, 1, 1, 1],
          transition: { duration: hold, times: [0.25, 0.4, 0.85, 1] },
        }}
      >
        {mine ? 'You drew ' : 'Opponent drew '}
        <strong>{label}</strong>
      </motion.p>
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

/* ------------------------------------------------- the overlay for the board */

/**
 * Whatever the current event needs drawn on the board, in board units:
 * travellers for moves and swaps, the flame of a fire-up, the vine of a plant.
 * (The bag's moment is HTML and lives in `DrawMoment`.)
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

/** How the top token of a cell got there: decides the arrival animation. */
export type Arrival = 'drop' | 'slide' | 'swap'

/**
 * The arrival of each space's top token under the current event: the placed
 * token drops in, a moved token appears when its traveller lands, swapped
 * tokens the same.
 */
export function arrivals(event: PresentationEvent | null): Record<string, Arrival> {
  if (!event) return {}
  const k = (hex: Hex) => `${hex.q},${hex.r}`
  switch (event.kind) {
    case 'place':
      return { [k(event.at)]: 'drop' }
    case 'move':
      return { [k(event.to)]: 'slide' }
    case 'swap':
      return { [k(event.a)]: 'swap', [k(event.b)]: 'swap' }
    default:
      return {}
  }
}

/* ------------------------------------------------------- M10: scoring ----- */

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
            <span key={i} className="score-star" style={{ '--i': i } as React.CSSProperties} />
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
