import { single } from '@dcv/engine'
import type { Action, DragonType, Hex, Token } from '@dcv/engine'
import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'
import { hexOnScreen } from '../geometry.js'
import { describeAction } from '../game/labels.js'
import { AbilityInfo, useLongPress } from './HeldToken.js'
import { TOKEN_RADIUS } from './HexCell.js'
import { FlameIcon } from './icons.js'
import { TokenGlyph } from './TokenGlyph.js'

type FireUp = Extract<Action, { type: 'fireUp' }>

/** Size of a fire button and the gap kept between it and the token, in px. */
const BUTTON = 56
const GAP = 10

/**
 * One way to fire the token up: the ability's own token, crowned with flame.
 * Tap fires; hold shows what it would do, and the click that ends a hold is
 * not a tap.
 */
function FireButton({
  action,
  at,
  infoBelow,
  onAct,
}: {
  action: FireUp
  at: { x: number; y: number }
  infoBelow: boolean
  onAct: (action: Action) => void
}) {
  const press = useLongPress()
  return (
    <div className="fire-slot" style={{ left: at.x, top: at.y }}>
      <button
        type="button"
        className="fire-up"
        data-ability={action.ability}
        aria-label={describeAction(action)}
        {...press.handlers}
        onClick={() => {
          if (!press.wasHold()) onAct(action)
        }}
      >
        <FlameIcon className="fire-up-flame" />
        <svg className="fire-up-token" viewBox="-10 -10 20 21" aria-hidden="true">
          <TokenGlyph token={single(action.ability)} radius={8.6} />
        </svg>
      </button>
      {press.showing ? <AbilityInfo ability={action.ability} placement={infoBelow ? 'below' : 'above'} /> : null}
    </div>
  )
}

/**
 * "Fire up this token?", asked on the board, around the token that just
 * landed (plan: the token has a home). A single token is an I: the fire above
 * it, Skip below. A dual is a Y: one fire per half, up and out on the side of
 * the half it fires, Skip below — the halves' colours already say which is
 * which. On the top row there is no room above, so the shape turns over.
 *
 * HTML over the board, placed by measuring where the board drew the space. It
 * appears once the token has landed and its dust has risen, so the landing is
 * seen first and the question right after.
 */
export function FireChoice({
  at,
  token,
  actions,
  onAct,
  area,
}: {
  at: Hex
  token: Token
  actions: readonly Action[]
  onAct: (action: Action) => void
  /** The board's row: the choice is drawn inside it, over the board. */
  area: RefObject<HTMLElement>
}) {
  const fires = actions.filter((action): action is FireUp => action.type === 'fireUp')
  const skip = actions.find((action) => action.type === 'skipFireUp')

  // the halves of a dual are left and right: each fire goes out on its own half's side
  const types: DragonType[] = token.kind === 'single' ? [token.type] : [...token.types]
  fires.sort((a, b) => types.indexOf(a.ability) - types.indexOf(b.ability))

  const [where, setWhere] = useState<{ x: number; y: number; r: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const box = area.current
      const spot = hexOnScreen(box?.querySelector<SVGSVGElement>('svg.board'), box, at)
      setWhere(spot && box ? { x: spot.x, y: spot.y, r: TOKEN_RADIUS * spot.unit, width: box.clientWidth } : null)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [area, at])

  // nothing laid out to measure (under test): the stylesheet sets the answers in a row instead
  const { x, y, r, width } = where ?? { x: 0, y: 0, r: 0, width: 0 }
  const clampX = (value: number) => (width ? Math.min(width - BUTTON / 2 - 4, Math.max(BUTTON / 2 + 4, value)) : value)

  // up, unless the space is too near the top of the board for the fires to fit above it
  const flipped = where !== null && y - r - GAP - BUTTON < 0
  const up = flipped ? 1 : -1
  const fireY = y + up * (r + GAP + BUTTON / 2)
  const dual = fires.length > 1
  const firePositions = fires.map((_, index) => ({
    // a Y's arms reach out to the side of their half
    x: clampX(dual ? x + (index === 0 ? -1 : 1) * BUTTON * 0.78 : x),
    // and rise a little less than an I's stem, so they read as arms
    y: dual ? fireY - up * BUTTON * 0.12 : fireY,
  }))
  const skipAt = { x: clampX(x), y: y - up * (r + GAP + 17) }

  return (
    <div
      className="fire-choice"
      data-shape={dual ? 'Y' : 'I'}
      data-flipped={flipped || undefined}
      data-measured={where ? 'true' : undefined}
    >
      {fires.map((action, index) => (
        <FireButton key={action.ability} action={action} at={firePositions[index]} infoBelow={flipped} onAct={onAct} />
      ))}
      {skip ? (
        <div className="fire-slot" style={{ left: skipAt.x, top: skipAt.y }}>
          <button type="button" className="fire-skip" onClick={() => onAct(skip)}>
            Skip
          </button>
        </div>
      ) : null}
    </div>
  )
}
