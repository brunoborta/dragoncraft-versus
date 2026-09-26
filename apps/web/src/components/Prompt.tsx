import { actionKey, hexEq } from '@dcv/engine'
import type { Action, Hex, PlayerView, Token } from '@dcv/engine'
import type { ReactNode } from 'react'
import { describeAction, describeCoinDiscard, promptFor } from '../game/labels.js'
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
   * `describeAction` cannot name what it is choosing between: the three crystal
   * tokens live on the pending and the discard pairs live in the hand, and it
   * sees neither. So those two labels are built here.
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
    if (action.type === 'coinDiscard') return describeCoinDiscard(action, view.you.hand)
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
