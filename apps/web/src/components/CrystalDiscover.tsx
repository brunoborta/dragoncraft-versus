import type { Action, Token } from '@dcv/engine'
import { PeekButton } from './PeekButton.js'
import { AbilityEffects } from './Prompt.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** How far each token turns from the middle of the fan, in degrees. */
const FAN_STEP = 6

/**
 * The crystal's choice, as Hearthstone's Discover (plan M6): the tokens it
 * drew, big, fanned over the darkened board, each with what it would do. Tap
 * one to keep it; the others go back in the bag. The board stays visible
 * behind, because where the kept token can go is the whole question.
 *
 * Usually three, but fewer when the bag ran short — the fan takes whatever
 * the engine drew.
 */
export function CrystalDiscover({
  tokens,
  actions,
  onAct,
  onPeek,
}: {
  tokens: readonly Token[]
  actions: readonly Action[]
  onAct: (action: Action) => void
  /** Puts the choice aside to look at the board; the choice comes back after. */
  onPeek?: () => void
}) {
  const middle = (tokens.length - 1) / 2
  return (
    <div className="modal-backdrop discover-backdrop">
      {/* the dialog and its eye, which sits on the dialog's top edge, outside it */}
      <div className="choice-frame">
        {onPeek ? <PeekButton onPeek={onPeek} /> : null}
      <section className="discover" role="dialog" aria-modal="true" aria-label="Keep one of these">
        <h2>Keep one</h2>
        <p className="discover-note">
          {tokens.length > 1 ? 'The others go back in the bag. ' : null}
          You place it next, without firing it up.
        </p>
        <div className="discover-fan">
          {tokens.map((token, index) => {
            const action = actions.find((candidate) => candidate.type === 'crystalPick' && candidate.index === index)
            const offset = index - middle
            return (
              <button
                key={`${index}-${tokenLabel(token)}`}
                type="button"
                className="discover-choice"
                disabled={!action}
                style={
                  {
                    '--fan-angle': `${offset * FAN_STEP}deg`,
                    '--fan-drop': `${Math.abs(offset) * 10}px`,
                  } as React.CSSProperties
                }
                onClick={() => {
                  if (action) onAct(action)
                }}
              >
                <svg viewBox="-11 -11 22 24" aria-hidden="true">
                  <TokenGlyph token={token} radius={9.5} />
                </svg>
                <span className="discover-name">Keep {tokenLabel(token)}</span>
                <AbilityEffects token={token} />
              </button>
            )
          })}
        </div>
      </section>
      </div>
    </div>
  )
}

