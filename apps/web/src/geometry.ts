import { BOARD } from '@dcv/engine'
import type { Hex } from '@dcv/engine'

export const HEX_SIZE = 10

const SQRT3 = Math.sqrt(3)

/** Flat-top layout: neighbouring centres sit sqrt(3) * HEX_SIZE apart. */
export function hexCenter(hex: Hex): { x: number; y: number } {
  return {
    x: HEX_SIZE * 1.5 * hex.q,
    y: HEX_SIZE * SQRT3 * (hex.r + hex.q / 2),
  }
}

/**
 * The corners of a space. `scale` below 1 draws it inset around its centre:
 * the stone tiles are inset so the joint between them shows.
 */
export function hexPoints(hex: Hex, scale = 1): string {
  const center = hexCenter(hex)
  const size = HEX_SIZE * scale
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * 60 * i
    const x = center.x + size * Math.cos(angle)
    const y = center.y + size * Math.sin(angle)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(' ')
}

/** Tight box around all 19 spaces plus one hex of breathing room. */
export const BOARD_VIEWBOX = (() => {
  const centers = BOARD.map(hexCenter)
  const pad = HEX_SIZE * 1.4
  const minX = Math.min(...centers.map((c) => c.x)) - pad
  const maxX = Math.max(...centers.map((c) => c.x)) + pad
  const minY = Math.min(...centers.map((c) => c.y)) - pad
  const maxY = Math.max(...centers.map((c) => c.y)) + pad
  return `${minX.toFixed(2)} ${minY.toFixed(2)} ${(maxX - minX).toFixed(2)} ${(maxY - minY).toFixed(2)}`
})()

/**
 * The outline of the whole board as one closed path: every hex edge that is not
 * shared with a neighbour, chained corner to corner. The gold frame is drawn
 * along it, so its gradient spans the board instead of restarting on each hex.
 */
export const BOARD_OUTLINE = (() => {
  const corner = (hex: Hex, i: number) => {
    const center = hexCenter(hex)
    const angle = (Math.PI / 180) * 60 * i
    return `${(center.x + HEX_SIZE * Math.cos(angle)).toFixed(2)},${(center.y + HEX_SIZE * Math.sin(angle)).toFixed(2)}`
  }
  // every edge, in each hex's own winding; a shared edge appears once each way
  const edges = BOARD.flatMap((hex) => Array.from({ length: 6 }, (_, i) => [corner(hex, i), corner(hex, (i + 1) % 6)]))
  const seen = new Set(edges.map(([a, b]) => `${a}>${b}`))
  const next = new Map<string, string>()
  for (const [a, b] of edges) if (!seen.has(`${b}>${a}`)) next.set(a, b)

  const start = next.keys().next().value as string
  const points = [start]
  for (let at = next.get(start); at && at !== start; at = next.get(at)) points.push(at)
  return `M ${points.join(' L ')} Z`
})()

/**
 * Where a space's centre is on screen, in px relative to `box`, and how many px
 * one board unit takes. The board scales with its row, so anything drawn over
 * it in HTML — the fire-up choice, a token flying in — asks here rather than
 * guessing. Null where nothing is laid out (under test).
 */
export function hexOnScreen(
  board: SVGSVGElement | null | undefined,
  box: Element | null | undefined,
  hex: Hex,
): { x: number; y: number; unit: number } | null {
  const ctm = board?.getScreenCTM?.()
  if (!ctm || !box) return null
  const c = hexCenter(hex)
  const r = box.getBoundingClientRect()
  return {
    x: ctm.a * c.x + ctm.c * c.y + ctm.e - r.left,
    y: ctm.b * c.x + ctm.d * c.y + ctm.f - r.top,
    unit: ctm.a,
  }
}
