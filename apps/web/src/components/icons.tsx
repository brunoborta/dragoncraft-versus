import { UI_ICON_PATHS } from '../art/icon-paths.js'
import { useArt } from '../art/ArtContext.js'

/**
 * The small interface icons of the HUD, in a 24-unit box, drawn in
 * `currentColor` unless they carry a colour of their own (coin, star, flame).
 * All but the help mark are traced from `designs/art/icons-ui.png` by
 * `scripts/icons.mjs`. Every one is decorative: the text next to it, visible
 * or screen-reader only, says what it means.
 */

type IconProps = { className?: string }
type Traced = keyof typeof UI_ICON_PATHS

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** One traced silhouette; its holes are subpaths, hence even-odd. */
function TracedIcon({ name, className, ...paint }: IconProps & { name: Traced } & React.SVGProps<SVGPathElement>) {
  return (
    <Svg className={className}>
      <path d={UI_ICON_PATHS[name]} fill="currentColor" fillRule="evenodd" {...paint} />
    </Svg>
  )
}

/** Two cards fanned, a star on the front one. */
export function CardIcon(props: IconProps) {
  return <TracedIcon name="cards" {...props} />
}

/** The painted coin, at icon size. */
export function CoinIcon({ className }: IconProps) {
  const art = useArt()
  return <img className={`icon coin-img ${className ?? ''}`} src={art.coin} alt="" aria-hidden="true" draggable={false} />
}

/**
 * Reputation. Flat and in `currentColor`, like the sheet it came from and like
 * the cards and coins beside it on a plate — an outline of its own made it read
 * as the drawn star it replaced. On parchment, where brass would vanish, the
 * stylesheet gives it its amber back with a dark outline (`.card-rep`).
 */
export function StarIcon(props: IconProps) {
  return <TracedIcon name="star" {...props} />
}

/** A scroll with lines on it: the move log. */
export function LogIcon(props: IconProps) {
  return <TracedIcon name="scroll" {...props} />
}

export function UndoIcon(props: IconProps) {
  return <TracedIcon name="undo" {...props} />
}

export function ChevronsIcon(props: IconProps) {
  return <TracedIcon name="chevrons" {...props} />
}

export function LockIcon(props: IconProps) {
  return <TracedIcon name="lock" {...props} />
}

export function FlameIcon(props: IconProps) {
  return <TracedIcon name="flame" fill="#ffcf5a" stroke="#9a3a10" strokeWidth={0.9} strokeLinejoin="round" paintOrder="stroke" {...props} />
}

/** An eye: look at the board behind a choice that still has to be made. */
export function EyeIcon(props: IconProps) {
  return <TracedIcon name="eye" {...props} />
}

export function GearIcon(props: IconProps) {
  return <TracedIcon name="gear" {...props} />
}

/**
 * Not on the sheet: drawn here. A stroked glyph reads smaller than a filled
 * silhouette of the same size, so this one fills more of its box and the
 * stylesheet draws it a few pixels larger (`.icon-help`), to carry the same
 * weight as the traced icons beside it.
 */
export function HelpIcon({ className }: IconProps) {
  return (
    <Svg className={`icon-help ${className ?? ''}`}>
      <path d="M7.6 9.4A4.5 4.5 0 1 1 12 13.6L12 15.8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="12" cy="20" r="2" fill="currentColor" />
    </Svg>
  )
}
