import { abilitiesOf, single } from '@dcv/engine'
import type { DragonType, Token } from '@dcv/engine'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { DRAGON_THEME } from '../theme.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** How long a press has to last before it is a hold, not a tap. */
export const HOLD_MS = 420

/**
 * Press and hold to see: the card shows while the finger stays down and goes
 * when it lifts. A hold that ended is not a tap, so `wasHold` lets a button
 * ignore the click its own long press finishes with.
 *
 * Also suppresses the long-press menu a phone would otherwise open on top.
 */
export function useLongPress(delay = HOLD_MS) {
  const [showing, setShowing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const held = useRef(false)

  useEffect(() => () => clearTimeout(timer.current), [])

  const end = () => {
    clearTimeout(timer.current)
    setShowing(false)
  }

  return {
    showing,
    wasHold: () => held.current,
    handlers: {
      onPointerDown: (event: ReactPointerEvent) => {
        // only the primary button or a finger: a right click is not a hold
        if (event.button > 0) return
        held.current = false
        clearTimeout(timer.current)
        timer.current = setTimeout(() => {
          held.current = true
          setShowing(true)
        }, delay)
      },
      onPointerUp: end,
      onPointerLeave: end,
      onPointerCancel: end,
      onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
    },
  }
}

/** What a token does, one line per ability, named when there are two. */
export function effectLines(token: Token): string[] {
  const abilities = abilitiesOf(token)
  return abilities.map((ability) =>
    abilities.length > 1 ? `${DRAGON_THEME[ability].label}: ${DRAGON_THEME[ability].effect}` : DRAGON_THEME[ability].effect,
  )
}

/**
 * The small parchment card a hold brings up: the token and what firing it up
 * does. Placed against its trigger, above or below it.
 */
export function TokenInfo({
  token,
  placement = 'above',
}: {
  token: Token
  placement?: 'above' | 'below' | 'below-start'
}) {
  return (
    <div className="token-info" data-placement={placement} role="tooltip">
      <svg className="token-info-glyph" viewBox="-10 -10 20 21" aria-hidden="true">
        <TokenGlyph token={token} radius={8.6} />
      </svg>
      <div className="token-info-text">
        {effectLines(token).map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </div>
  )
}

/** The card for one ability of a token: what a single fire-up button would do. */
export function AbilityInfo({ ability, placement }: { ability: DragonType; placement?: 'above' | 'below' }) {
  return <TokenInfo token={single(ability)} placement={placement} />
}

/**
 * Where a held token lives (plan: "the token has a home"). Yours on a brass
 * tray under the board, the opponent's in a slot under their portrait at the
 * board's top left. It stays there from the draw that brought it until the
 * placement that takes it, so what each side holds can be seen at any time
 * without reading a word.
 *
 * - `arriving`: a token is flying in from the bag; the one here waits for it,
 *   then appears (`--arrive-ms`).
 * - `away`: yours is hovering over a space (the first tap); the tray keeps an
 *   echo of it, so it is clear where it went and that it is not placed yet.
 *
 * Hold it to see what it does.
 */
export function HeldSlot({
  side,
  token,
  arriving = 0,
  away = false,
}: {
  side: 'you' | 'opponent'
  token: Token | null
  /** Milliseconds until the flying token lands here; 0 when nothing is flying. */
  arriving?: number
  away?: boolean
}) {
  const press = useLongPress()
  const [focused, setFocused] = useState(false)
  const label = token
    ? `${side === 'you' ? 'Your token' : "Opponent's token"}: ${tokenLabel(token)}. ${effectLines(token).join('. ')}`
    : side === 'you'
      ? 'Your tray: empty'
      : "Opponent's slot: empty"
  return (
    <div className="held-slot" data-side={side} data-empty={token ? undefined : 'true'}>
      <div
        className="held-anchor"
        role="img"
        aria-label={label}
        tabIndex={token ? 0 : -1}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...(token ? press.handlers : {})}
      >
        <span className="held-plinth" aria-hidden="true" />
        {token ? (
          <svg
            // keyed on the token, so a new one arrives as a new element
            key={tokenLabel(token) + arriving}
            className="held-glyph"
            data-arriving={arriving > 0 || undefined}
            data-away={away || undefined}
            style={{ '--arrive-ms': `${arriving}ms` } as CSSProperties}
            viewBox="-10 -10 20 21.5"
            aria-hidden="true"
          >
            <TokenGlyph token={token} radius={9} />
          </svg>
        ) : null}
      </div>
      {token && (press.showing || focused) ? (
        <TokenInfo token={token} placement={side === 'you' ? 'above' : 'below-start'} />
      ) : null}
    </div>
  )
}
