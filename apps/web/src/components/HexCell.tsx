import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { useState } from 'react'
import type { Arrival } from './Moments.js'
import { HEX_SIZE, hexCenter, hexPoints } from '../geometry.js'
import { FLIGHT } from '../game/presentation.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

export type Highlight = 'legal' | 'selected' | 'inspected'

/** The stone tile is inset this much, so the joint between tiles shows. */
export const STONE_SCALE = 0.92

/** Radius of a token on the board. */
export const TOKEN_RADIUS = HEX_SIZE * 0.6

/**
 * A cell paints its own shape and stack only. The highlight ring, the stack
 * badge and the hovering preview live in the board's overlay, drawn after every
 * cell: rendered here they would be overpainted by whichever neighbour comes
 * later, which is what made a ring thick on three sides and thin on the other
 * three, and what clipped the stack numbers.
 *
 * The tap target is the whole hexagon, joint included. Only the stone is
 * inset, so the touch target never shrinks below the 44px the board's minimum
 * height guarantees.
 */
export function HexCell({
  hex,
  stack,
  topId,
  arrival,
  highlight,
  onSelect,
}: {
  hex: Hex
  stack: Token[]
  /**
   * The identity of the top token. Keyed on it, a token that arrives here —
   * placed, moved in, swapped in — is a new element, and fades in.
   */
  topId?: string
  /** How the top token got here, under the event playing now. */
  arrival?: Arrival
  highlight?: Highlight
  onSelect: (hex: Hex) => void
}) {
  const top = stack[stack.length - 1]
  // the token under the top: what the space showed before the top arrived
  const under = stack[stack.length - 2]
  const center = hexCenter(hex)
  const label = top ? `${key(hex)}: ${tokenLabel(top)}, stack of ${stack.length}` : `${key(hex)}: empty`

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      data-hex={key(hex)}
      // lit as its hexagon, not a box that takes in its neighbours' corners
      data-spot="hex"
      data-highlight={highlight ?? 'none'}
      className="hex-cell"
      onClick={() => onSelect(hex)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onSelect(hex)
      }}
    >
      <polygon points={hexPoints(hex)} className="hex-hit" />
      <polygon points={hexPoints(hex, STONE_SCALE)} className="hex-shape" />
      {/* light on the stone: bright in the middle, falling off to the edge */}
      <polygon points={hexPoints(hex, STONE_SCALE)} className="hex-shade" />
      {top ? (
        <ArrivingToken key={topId ?? 'top'} arrival={arrival} x={center.x} y={center.y}>
          {/*
            Until the arriving token lands, the space looks as it did before:
            whatever was on top then keeps its face. A token moved off a stack
            never takes the stack along, and one landing on a stack never
            leaves it flat and blank while it is on its way.
          */}
          {under && arrival && arrival !== 'uncover' ? (
            <g className="token-arrive-before">
              <TokenGlyph token={under} buried={stack.slice(0, -2)} radius={TOKEN_RADIUS} />
            </g>
          ) : null}
          <g className="token-arrive-body">
            <TokenGlyph token={top} buried={stack.slice(0, -1)} radius={TOKEN_RADIUS} />
          </g>
        </ArrivingToken>
      ) : null}
    </g>
  )
}

/**
 * The top token of a space. Keyed on the token's identity by its parent, so it
 * mounts when a token arrives — and the way it arrived is read once, at mount:
 * the event that said so ends before the animation needs to, and the
 * animation must not change under it.
 *
 * - `drop`: placed from the hand, falls in and squashes (M4); the board's
 *   landing moment draws the dust.
 * - `fly`: the opponent's, the same drop once its flight from their slot is
 *   over (`FLIGHT`).
 * - `slide`/`swap`: moved or swapped; hidden while its traveller crosses the
 *   board, then shown where it landed (M7, M8). Until then the space shows
 *   its `.token-arrive-before`: the stack as it was, the old top with its face.
 * - `uncover`: a move took the token above it away; it was there all along,
 *   so it simply stays.
 * - none: a crossfade (anything the queue did not stage, and reduced motion).
 */
function ArrivingToken({
  arrival,
  x,
  y,
  children,
}: {
  arrival?: Arrival
  x: number
  y: number
  children: React.ReactNode
}) {
  const [how] = useState(arrival ?? 'fade')
  return (
    <g
      className="token-arrive"
      data-arrival={how}
      transform={`translate(${x} ${y})`}
      style={how === 'fly' ? ({ '--fly-ms': `${FLIGHT}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </g>
  )
}
