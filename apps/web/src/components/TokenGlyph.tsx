import type { Token } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'

export function tokenLabel(token: Token): string {
  return token.kind === 'single'
    ? DRAGON_THEME[token.type].label
    : `${DRAGON_THEME[token.types[0]].label}/${DRAGON_THEME[token.types[1]].label}`
}

/** A token is a disc; a dual token is the same disc split down the middle. */
export function TokenGlyph({ token, radius }: { token: Token; radius: number }) {
  if (token.kind === 'single') {
    const theme = DRAGON_THEME[token.type]
    return (
      <g>
        <circle r={radius} fill={theme.color} />
        <text textAnchor="middle" dominantBaseline="central" fontSize={radius} fill="#fff">
          {theme.symbol}
        </text>
      </g>
    )
  }

  const [left, right] = token.types
  return (
    <g>
      <path d={`M 0 ${-radius} A ${radius} ${radius} 0 0 0 0 ${radius} Z`} fill={DRAGON_THEME[left].color} />
      <path d={`M 0 ${-radius} A ${radius} ${radius} 0 0 1 0 ${radius} Z`} fill={DRAGON_THEME[right].color} />
      <text x={-radius * 0.42} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.8} fill="#fff">
        {DRAGON_THEME[left].symbol}
      </text>
      <text x={radius * 0.42} textAnchor="middle" dominantBaseline="central" fontSize={radius * 0.8} fill="#fff">
        {DRAGON_THEME[right].symbol}
      </text>
    </g>
  )
}
