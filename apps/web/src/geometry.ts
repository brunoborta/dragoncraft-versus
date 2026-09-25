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

export function hexPoints(hex: Hex): string {
  const center = hexCenter(hex)
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * 60 * i
    const x = center.x + HEX_SIZE * Math.cos(angle)
    const y = center.y + HEX_SIZE * Math.sin(angle)
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
