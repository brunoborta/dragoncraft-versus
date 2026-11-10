/**
 * Ids of the shared gradients and filters. Every token, cell and ring on the
 * page refers to these, so they are declared once rather than inside each
 * `<svg>`: duplicated ids resolve to whichever comes first, and that one may be
 * in an SVG that is not on screen.
 *
 * None of them carries a colour of its own. The shading is white and black at
 * varying opacity laid over the token's flat colour, so twelve tokens (six
 * singles, six duals) share two gradients.
 */
export const DEF = {
  shade: 'dcv-shade',
  bevel: 'dcv-bevel',
  stone: 'dcv-stone',
  frame: 'dcv-frame',
  glow: 'dcv-glow',
} as const

/**
 * Rendered once at the root of the app. Zero-sized rather than `display: none`,
 * which in some browsers switches the gradients inside it off as well.
 */
export function SvgDefs() {
  return (
    <svg className="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={DEF.shade} cx="0.35" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.85" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.3" />
        </radialGradient>
        {/* darker at the top, lighter at the bottom: reads as a dip in the face */}
        <linearGradient id={DEF.bevel} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.14" />
        </linearGradient>
        {/* laid over the stone texture: a lit middle and a darker, bevelled edge */}
        <radialGradient id={DEF.stone} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#3a2a12" stopOpacity="0.28" />
        </radialGradient>
        <linearGradient id={DEF.frame} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#f3dfa2" />
          <stop offset="0.45" stopColor="#d9b45a" />
          <stop offset="1" stopColor="#8a6a26" />
        </linearGradient>
        <filter id={DEF.glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}
