import { abilitiesOf, actionKey, hexEq } from '@dcv/engine'
import type { Action, Hex, PlayerView, Token } from '@dcv/engine'
import type { ReactNode } from 'react'
import { describeAction, promptFor } from '../game/labels.js'
import { DRAGON_THEME } from '../theme.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

const HANDLED_BY_BOARD = new Set(['place', 'meatMove', 'ironMove', 'potionSwap', 'scoreCard'])

/** A token inline in a label: never the glyph without the name, never a bare index. */
export function TokenChip({ token }: { token: Token }) {
  return (
    <span className="token-chip">
      <svg viewBox="-10 -10 20 20" aria-hidden="true">
        <TokenGlyph token={token} radius={8} />
      </svg>
      {tokenLabel(token)}
    </span>
  )
}

/**
 * What firing this token up would do — one line, or two for a dual. Where you
 * put a token depends on what you are about to fire up, so this belongs next to
 * the token at the moment of deciding rather than in a rulebook.
 */
export function AbilityEffects({ token }: { token: Token }) {
  const abilities = abilitiesOf(token)
  return (
    <span className="prompt-effects">
      {abilities.map((ability) => (
        <span key={ability} className="prompt-effect">
          {abilities.length > 1 ? `${DRAGON_THEME[ability].label}: ` : null}
          {DRAGON_THEME[ability].effect}
        </span>
      ))}
    </span>
  )
}

/** Holds the decision slot while the machine plays, so its pending never reads as an instruction. */
export function OpponentThinking() {
  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text" aria-live="polite">
        Opponent is thinking…
      </p>
    </section>
  )
}

export function Prompt({
  view,
  actions,
  selected,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  selected: Hex | null
  onAct: (action: Action) => void
}) {
  const pending = view.pending[view.pending.length - 1]

  const buttons = actions.filter((action) => {
    if (HANDLED_BY_BOARD.has(action.type)) return false
    // a dual neighbour needs the bar to ask which of its two abilities to use
    if (action.type === 'plantTarget') return selected !== null && hexEq(action.at, selected)
    return true
  })

  /**
   * `describeAction` cannot name the three crystal tokens: they live on the
   * pending, which it does not see. So that label is built here.
   */
  function label(action: Action): ReactNode {
    if (action.type === 'crystalPick' && pending?.kind === 'crystalPick') {
      const token = pending.tokens[action.index]
      if (token) {
        return (
          <>
            Keep <TokenChip token={token} />
          </>
        )
      }
    }
    if (action.type === 'fireUp' || action.type === 'plantTarget') {
      return (
        <>
          <span className="action-name">{describeAction(action)}</span>
          <span className="action-effect">{DRAGON_THEME[action.ability].effect}</span>
        </>
      )
    }
    return describeAction(action)
  }

  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text">
        {promptFor(view)}
        {pending?.kind === 'place' ? (
          <>
            {': '}
            <TokenChip token={pending.token} />
            <AbilityEffects token={pending.token} />
          </>
        ) : null}
      </p>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={actionKey(action)} type="button" onClick={() => onAct(action)}>
            {label(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
