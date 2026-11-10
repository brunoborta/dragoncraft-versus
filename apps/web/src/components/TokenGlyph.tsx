import type { DragonType, Token } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'
import { DEF } from './SvgDefs.js'

export function tokenLabel(token: Token): string {
  return token.kind === 'single'
    ? DRAGON_THEME[token.type].label
    : `${DRAGON_THEME[token.types[0]].label}/${DRAGON_THEME[token.types[1]].label}`
}

/** How thick a token is, as a share of its radius. */
export const THICKNESS = 0.14

function typesOf(token: Token): DragonType[] {
  return token.kind === 'single' ? [token.type] : [...token.types]
}

/** Left and right halves of a disc centred at (0, cy). */
function halves(radius: number, cy: number): [string, string] {
  const top = `0 ${cy - radius}`
  const bottom = `0 ${cy + radius}`
  return [
    `M ${top} A ${radius} ${radius} 0 0 0 ${bottom} Z`,
    `M ${top} A ${radius} ${radius} 0 0 1 ${bottom} Z`,
  ]
}

/**
 * A disc in the token's colours: one fill for a single, two halves for a dual.
 * `pick` chooses which shade of each type to use.
 */
function Disc({
  token,
  radius,
  cy = 0,
  pick,
  className,
}: {
  token: Token
  radius: number
  cy?: number
  pick: 'color' | 'dark'
  className?: string
}) {
  const types = typesOf(token)
  if (types.length === 1) {
    return <circle className={className} cy={cy} r={radius} fill={DRAGON_THEME[types[0]][pick]} />
  }
  const [left, right] = halves(radius, cy)
  return (
    <g className={className}>
      <path d={left} fill={DRAGON_THEME[types[0]][pick]} />
      <path d={right} fill={DRAGON_THEME[types[1]][pick]} />
    </g>
  )
}

/** The illustrated icon, white, with a soft drop under it and its detail strokes. */
function Icon({ type, size, x = 0 }: { type: DragonType; size: number; x?: number }) {
  const { icon, dark } = DRAGON_THEME[type]
  return (
    <g transform={`translate(${x} 0) scale(${size})`} className="token-icon">
      <path d={icon.shape} transform="translate(0 0.07)" fill="rgb(0 0 0 / 0.3)" />
      <path d={icon.shape} fill="#fff" />
      <path
        d={icon.detail}
        fill="none"
        stroke={dark}
        strokeWidth={0.09}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </g>
  )
}

/** The top of a token: face, bevel, shine and icon. Centred on (0, 0). */
function Face({ token, radius }: { token: Token; radius: number }) {
  const types = typesOf(token)
  return (
    <g>
      <Disc token={token} radius={radius} pick="color" />
      {/* light from the upper left, falling off to the rim */}
      <circle r={radius} fill={`url(#${DEF.shade})`} />
      {/* the bevel: a recessed inner face inside a raised rim */}
      <circle r={radius * 0.8} fill={`url(#${DEF.bevel})`} />
      <circle r={radius * 0.8} fill="none" stroke="rgb(0 0 0 / 0.22)" strokeWidth={radius * 0.05} />
      <circle r={radius - radius * 0.03} fill="none" stroke="rgb(0 0 0 / 0.4)" strokeWidth={radius * 0.06} />
      {types.length === 1 ? (
        <Icon type={types[0]} size={radius * 0.6} />
      ) : (
        <>
          <line y1={-radius} y2={radius} stroke="rgb(0 0 0 / 0.35)" strokeWidth={radius * 0.05} />
          <Icon type={types[0]} size={radius * 0.36} x={-radius * 0.42} />
          <Icon type={types[1]} size={radius * 0.36} x={radius * 0.42} />
        </>
      )}
      <ellipse
        cx={-radius * 0.34}
        cy={-radius * 0.5}
        rx={radius * 0.42}
        ry={radius * 0.18}
        transform={`rotate(-28 ${-radius * 0.34} ${-radius * 0.5})`}
        fill="#fff"
        opacity={0.28}
      />
    </g>
  )
}

/**
 * A token with volume: a thick disc with a bevelled face, a shine and a shadow
 * on the ground. A dual is the same disc split down the middle, both icons on
 * its face.
 *
 * `buried` are the tokens underneath, bottom first. Only the top one counts in
 * the game, so the buried ones show only as edges in their own colours under
 * it — enough to see there is a stack and what it is made of, with the
 * inspector for the detail.
 *
 * `lift` raises the token off the ground (the preview hovering before the
 * second tap); the shadow stays where it would land.
 */
export function TokenGlyph({
  token,
  radius,
  buried = [],
  lift = 0,
  shadow = true,
}: {
  token: Token
  radius: number
  buried?: readonly Token[]
  lift?: number
  shadow?: boolean
}) {
  const step = radius * THICKNESS
  const depth = (buried.length + 1) * step
  return (
    <g className="token" data-buried={buried.length || undefined}>
      {shadow ? (
        <ellipse
          className="token-shadow"
          cy={depth + radius * 0.12}
          rx={radius * (1.02 - Math.min(lift / radius, 1) * 0.2)}
          ry={radius * 0.88}
          fill="rgb(20 12 4 / 0.38)"
        />
      ) : null}
      <g transform={lift ? `translate(0 ${-lift})` : undefined}>
        {buried.map((under, index) => {
          // index 0 is the bottom of the stack, the deepest edge
          const offset = (buried.length - index + 1) * step
          return (
            <g key={index}>
              <Disc token={under} radius={radius} cy={offset} pick="dark" />
              <Disc token={under} radius={radius} cy={offset - step * 0.5} pick="color" />
              <circle cy={offset - step * 0.5} r={radius} fill="none" stroke="rgb(0 0 0 / 0.45)" strokeWidth={radius * 0.04} />
            </g>
          )
        })}
        {/* the token's own edge, then its face on top */}
        <Disc token={token} radius={radius} cy={step} pick="dark" />
        <Face token={token} radius={radius} />
      </g>
    </g>
  )
}
