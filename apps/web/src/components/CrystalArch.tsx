import type { Action, Token } from '@dcv/engine'
import type { CSSProperties } from 'react'
import { TokenInfo, useLongPress } from './HeldToken.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** The arch's shape: how far a token rises toward the crown, and turns, per step from the middle. */
const ARCH_RISE = 14
const ARCH_TURN = 8

/**
 * The crystal's choice: the tokens it drew, bare, in an arch over the tray —
 * where the drawn token's cushion lives, between the coins and the bag. No
 * dialog, no backdrop, no descriptions. Each token flies here out of the bag
 * like any drawn token (`DrawFlight` aims at its slot) and waits hidden until
 * its flight lands. Tap one to keep it — it slides onto the cushion — and the
 * others go back in the bag. Hold one to see what it does, like the token in
 * the tray.
 *
 * Usually three, but fewer when the bag ran short — the arch takes whatever
 * the engine drew.
 */
export function CrystalArch({
  tokens,
  actions,
  onAct,
  arrival,
}: {
  tokens: readonly Token[]
  actions: readonly Action[]
  onAct: (action: Action) => void
  /** Per slot: 0 landed, >0 ms until its flight lands here, <0 still queued behind. */
  arrival?: (index: number) => number
}) {
  const middle = (tokens.length - 1) / 2
  return (
    <div className="crystal-arch" role="group" aria-label="Choose a token to keep">
      {tokens.map((token, index) => (
        <ArchToken
          key={`${index}-${tokenLabel(token)}`}
          token={token}
          index={index}
          // the outer tokens stand on the tray; the middle rises toward the crown
          rise={(middle - Math.abs(index - middle)) * ARCH_RISE}
          turn={(index - middle) * ARCH_TURN}
          action={actions.find((candidate) => candidate.type === 'crystalPick' && candidate.index === index)}
          arrival={arrival?.(index) ?? 0}
          onAct={onAct}
        />
      ))}
    </div>
  )
}

/** One token of the arch: tap keeps it, hold shows its card, like the tray's. */
function ArchToken({
  token,
  index,
  rise,
  turn,
  action,
  arrival,
  onAct,
}: {
  token: Token
  index: number
  rise: number
  turn: number
  action: Action | undefined
  arrival: number
  onAct: (action: Action) => void
}) {
  const press = useLongPress()
  return (
    <div
      className="crystal-slot-frame"
      // a spotlight on it holds still: the token rising under a hover stays inside its padding
      data-spot="own"
      style={{ '--arch-rise': `${rise}px`, '--arch-turn': `${turn}deg` } as CSSProperties}
    >
      <button
        type="button"
        className="crystal-slot"
        data-slot={index}
        data-waiting={arrival < 0 || undefined}
        data-arriving={arrival > 0 || undefined}
        style={{ '--arrive-ms': `${Math.max(arrival, 0)}ms` } as CSSProperties}
        aria-label={`Keep ${tokenLabel(token)}`}
        disabled={!action}
        {...press.handlers}
        onClick={() => {
          if (!press.wasHold() && action) onAct(action)
        }}
      >
        <svg viewBox="-10 -10 20 21.5" aria-hidden="true">
          <TokenGlyph token={token} radius={9} />
        </svg>
      </button>
      {press.showing ? <TokenInfo token={token} placement="above" /> : null}
    </div>
  )
}
