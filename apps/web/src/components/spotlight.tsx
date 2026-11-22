import { useLayoutEffect, useState } from 'react'
import { AROUND, STILL } from '../game/tutorial/spots.js'

/*
 * The spotlight's geometry: where the lit spots are on screen, the shape each
 * one is cut in, and what blocks a tap around them. The coach only draws what
 * this measures.
 *
 * An element says how it is lit with `data-spot`:
 *   - `hex`: a space of the board, cut as its hexagon — a box around it would
 *     take in the corners of its neighbours;
 *   - `card`: a card, cut along its own rounded border, turned with the fan;
 *   - `own`: its own box only — what moves inside it (a hover's lift) must not
 *     move the spotlight.
 * Anything else is lit by its box, grown to take in what sticks out of a small
 * element (the drawn token floats above its tray). A spot of the form
 * `around:a|b` lights several things in one plain box.
 */

/** Room around a lit element, and the roundness of its box. */
export const PAD = 8
export const RADIUS = 14
/** How often the spots are measured again: the screen animates under them. */
const MEASURE_EVERY = 150
/** How much a lit space's hexagon is grown around its centre, so the ring sits just outside the stone. */
const HEX_GROW = 1.1
/** How far a card's ring stands off its border. */
const CARD_PAD = 3
/** A small element's parts can stick out of it and are lit too; a large one's (the board) are not looked at. */
const MAX_PARTS = 40

/** A lit spot: its box on screen, and the shape it is cut in when it is not a plain rounded box. */
export type Hole = {
  x: number
  y: number
  w: number
  h: number
  /** A space's hexagon, as SVG points on screen. */
  shape?: string
  /** A card's own border: its box turned with the fan, and its rounding. */
  turned?: { cx: number; cy: number; w: number; h: number; angle: number; r: number }
  /** Shown, not pointed at: its ring holds still where something is to be done. */
  still?: true
}

type Box = { left: number; top: number; right: number; bottom: number }

const padded = ({ left, top, right, bottom }: Box): Hole => ({
  x: left - PAD,
  y: top - PAD,
  w: right - left + PAD * 2,
  h: bottom - top + PAD * 2,
})

/** The box an element shows on screen: its own, grown to take in whatever of a small one sticks out. */
function extent(element: Element): Box {
  const own = element.getBoundingClientRect()
  const box = { left: own.left, top: own.top, right: own.left + own.width, bottom: own.top + own.height }
  if (element.getAttribute('data-spot') === 'own') return box
  const parts = element.querySelectorAll('*')
  if (parts.length > MAX_PARTS) return box
  for (const part of parts) {
    // a tooltip is not part of what is lit
    if (part.closest('[role="tooltip"]')) continue
    const rect = part.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    box.left = Math.min(box.left, rect.left)
    box.top = Math.min(box.top, rect.top)
    box.right = Math.max(box.right, rect.left + rect.width)
    box.bottom = Math.max(box.bottom, rect.top + rect.height)
  }
  return box
}

/** A space's hexagon on screen, grown a little; null where the browser cannot say (a test's DOM). */
function hexShape(element: Element): Hole | null {
  const polygon = element.querySelector('.hex-hit') as SVGPolygonElement | null
  const matrix = polygon?.getScreenCTM?.()
  if (!polygon || !matrix || !polygon.points?.numberOfItems) return null
  const corners = Array.from(polygon.points, (p) => new DOMPoint(p.x, p.y).matrixTransform(matrix))
  const cx = corners.reduce((sum, p) => sum + p.x, 0) / corners.length
  const cy = corners.reduce((sum, p) => sum + p.y, 0) / corners.length
  const grown = corners.map((p) => ({ x: cx + (p.x - cx) * HEX_GROW, y: cy + (p.y - cy) * HEX_GROW }))
  const xs = grown.map((p) => p.x)
  const ys = grown.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    w: Math.max(...xs) - x,
    h: Math.max(...ys) - y,
    shape: grown.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
  }
}

/**
 * A card's own outline on screen: its laid-out size, turned by the fan (the
 * rotations of it and its ancestors), around the centre of its box. Null where
 * nothing is laid out (a test's DOM).
 */
function cardShape(element: Element): Hole | null {
  const card = element as HTMLElement
  const w = card.offsetWidth
  const h = card.offsetHeight
  if (!w || !h) return null
  let angle = 0
  for (let node: Element | null = card; node && node !== document.body; node = node.parentElement) {
    const transform = getComputedStyle(node).transform
    if (transform && transform !== 'none') {
      const m = new DOMMatrix(transform)
      angle += (Math.atan2(m.b, m.a) * 180) / Math.PI
    }
  }
  const box = card.getBoundingClientRect()
  const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 10
  return {
    x: box.left - CARD_PAD,
    y: box.top - CARD_PAD,
    w: box.width + CARD_PAD * 2,
    h: box.height + CARD_PAD * 2,
    turned: {
      cx: box.left + box.width / 2,
      cy: box.top + box.height / 2,
      w: w + CARD_PAD * 2,
      h: h + CARD_PAD * 2,
      angle,
      r: r + CARD_PAD,
    },
  }
}

/**
 * Not to be lit yet: still fading in (an entrance animation from nothing), or
 * saying it is not in its place yet (`data-spot-pending`) — lit then, the hole
 * would open where it is not, or around nothing.
 */
function notReady(element: Element): boolean {
  if (element.closest('[data-spot-pending]')) return true
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    const opacity = parseFloat(getComputedStyle(node).opacity)
    // not there at all
    if (opacity < 0.05) return true
    // still fading in, and not nearly done: an entrance also grows, and a ring caught early would hop as it
    // settles. Something meant to be faint (a disabled button) is not animating, and is lit as it is.
    if (opacity < 0.95 && node.getAnimations?.().length) return true
  }
  return false
}

/** An element's hole, in the shape it says it is (`data-spot`); null when it is not on screen, or not yet. */
function holeOf(element: Element): Hole | null {
  if (notReady(element)) return null
  const kind = element.getAttribute('data-spot')
  const shaped = kind === 'hex' ? hexShape(element) : kind === 'card' ? cardShape(element) : null
  if (shaped) return shaped
  const box = extent(element)
  return box.right > box.left || box.bottom > box.top ? padded(box) : null
}

/** The holes the spotlight opens: every element each spot finds. Nothing found, no hole. */
export function measureHoles(spots: readonly string[]): Hole[] {
  const holes: Hole[] = []
  for (const spot of spots) {
    if (spot.startsWith(AROUND)) {
      const boxes = spot
        .slice(AROUND.length)
        .split('|')
        .flatMap((part) => [...document.querySelectorAll(part)].filter((element) => !notReady(element)).map(extent))
        .filter((box) => box.right > box.left && box.bottom > box.top)
      if (boxes.length) {
        holes.push(
          padded({
            left: Math.min(...boxes.map((b) => b.left)),
            top: Math.min(...boxes.map((b) => b.top)),
            right: Math.max(...boxes.map((b) => b.right)),
            bottom: Math.max(...boxes.map((b) => b.bottom)),
          }),
        )
      }
      continue
    }
    const still = spot.startsWith(STILL)
    for (const element of document.querySelectorAll(still ? spot.slice(STILL.length) : spot)) {
      const hole = holeOf(element)
      if (hole) holes.push(still ? { ...hole, still: true } : hole)
    }
  }
  return holes
}

/**
 * The holes of `spots`, measured again and again while `active` — the screen
 * animates under them — and measured before the paint, so a page that changes
 * (a Back, a Next) never shows a frame with the last page's holes.
 */
export function useHoles(spots: readonly string[], active: boolean): Hole[] {
  const [holes, setHoles] = useState<Hole[]>([])
  // a spot can hold `|` (several things in one box), so the list is kept by lines
  const key = spots.join('\n')
  useLayoutEffect(() => {
    if (!active) {
      setHoles([])
      return
    }
    const list = key ? key.split('\n') : []
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
 * holes stay open — a fill rule would close them again where they overlap.
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

/** A hole drawn in its shape: a space's hexagon, a card's turned border, or a rounded box. */
export function HoleShape({ hole, className, fill }: { hole: Hole; className?: string; fill?: string }) {
  const turned = hole.turned
  if (turned) {
    // turned in a group, so a ring's own breathing transform does not undo the turn
    return (
      <g transform={`rotate(${turned.angle} ${turned.cx} ${turned.cy})`}>
        <rect
          x={turned.cx - turned.w / 2}
          y={turned.cy - turned.h / 2}
          width={turned.w}
          height={turned.h}
          rx={turned.r}
          className={className}
          fill={fill}
        />
      </g>
    )
  }
  if (hole.shape) return <polygon points={hole.shape} className={className} fill={fill} />
  return <rect x={hole.x} y={hole.y} width={hole.w} height={hole.h} rx={RADIUS} className={className} fill={fill} />
}
