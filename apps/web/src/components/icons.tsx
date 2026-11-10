import { useArt } from '../art/ArtContext.js'

/**
 * The small interface icons of the HUD, in a 24-unit box, drawn in
 * `currentColor` unless they carry a colour of their own (coin, star). Every one
 * is decorative: the text next to it, visible or screen-reader only, says what
 * it means.
 */

type IconProps = { className?: string }

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg className={`icon ${className ?? ''}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

/** A card seen from the back, with another behind it. */
export function CardIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="2.5" width="12" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <rect x="4" y="5" width="12" height="16.5" rx="2" fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 10.2l1.1 2.2 2.4.3-1.8 1.6.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.6 2.4-.3z" fill="currentColor" />
    </Svg>
  )
}

/** The painted coin, at icon size. */
export function CoinIcon({ className }: IconProps) {
  const art = useArt()
  return <img className={`icon coin-img ${className ?? ''}`} src={art.coin} alt="" aria-hidden="true" draggable={false} />
}

export function StarIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.2l2.9 6.2 6.7.8-5 4.6 1.4 6.7L12 17.1l-6 3.4 1.4-6.7-5-4.6 6.7-.8z"
        fill="#f3c64a"
        stroke="#8a5a12"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function HourglassIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6 2.5h12 M6 21.5h12 M7 2.5c0 4 2.2 6 5 9.5-2.8 3.5-5 5.5-5 9.5 M17 2.5c0 4-2.2 6-5 9.5 2.8 3.5 5 5.5 5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path d="M9.2 19.5c.6-2 1.6-3 2.8-4.2 1.2 1.2 2.2 2.2 2.8 4.2z" fill="currentColor" />
    </Svg>
  )
}

/** A scroll with lines on it: the move log. */
export function LogIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6 3.5h11a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H7.5A2.5 2.5 0 0 1 5 18V4.5 M9 8h7 M9 11.5h7 M9 15h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function UndoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M9 14L4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function ChevronsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 6l6 6-6 6 M12 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function LockIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </Svg>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.5c1 3.2 4.8 5.4 4.8 10.3A4.8 4.8 0 0 1 12 17.6a4.8 4.8 0 0 1-4.8-4.8c0-2.3 1.2-3.6 2.2-4.8.2 1.6.9 2.6 1.9 3.1C11.1 8.6 11 5.4 12 2.5z"
        fill="#ffcf5a"
        stroke="#9a3a10"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M12 21.5c-2.6 0-4-1.4-4-3.2h8c0 1.8-1.4 3.2-4 3.2z" fill="#e0612a" />
    </Svg>
  )
}

/** An eye: look at the board behind a choice that still has to be made. */
export function EyeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    </Svg>
  )
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 2.8l1.8 1 2-.5 1.3 1.6-.2 2.1 1.7 1.3-.5 2 1.4 1.6-1.4 1.6.5 2-1.7 1.3.2 2.1-1.3 1.6-2-.5-1.8 1-1.8-1-2 .5-1.3-1.6.2-2.1-1.7-1.3.5-2L3.4 12l1.4-1.6-.5-2 1.7-1.3-.2-2.1 1.3-1.6 2 .5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
    </Svg>
  )
}

export function HelpIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 9.2a3 3 0 1 1 4.4 2.7c-.9.5-1.4 1.1-1.4 2.1v.6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="18.2" r="1.4" fill="currentColor" />
    </Svg>
  )
}
