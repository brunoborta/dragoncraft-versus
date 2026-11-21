import { actionKey } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import type { ReactNode } from 'react'
import { describeAction, promptFor } from '../game/labels.js'

/**
 * Answered somewhere other than this panel: on the board (placing, moving,
 * swapping, firing up — around the token that just landed — a plant's
 * borrowing, over the neighbour it borrows from, and the crystal's pick, on
 * the arch of tokens it drew), on the cards (scoring), or by a control with a
 * fixed place of its own — End turn beside your bar, the coins in the corner
 * of the board. Those two are offered at many points of a turn, so they cannot
 * live in a panel whose content changes with every decision.
 */
const HANDLED_ELSEWHERE = new Set([
  'place',
  'fireUp',
  'skipFireUp',
  'crystalPick',
  'meatMove',
  'ironMove',
  'potionSwap',
  'plantTarget',
  'scoreCard',
  'endTurn',
  'spendCoin',
])

const WAITING_TEXT = {
  thinking: 'Opponent is thinking…',
  playing: 'Opponent is playing…',
  drawing: 'Drawing from the bag…',
  choosingCards: 'Opponent spent a coin and is choosing cards…',
  choosingToken: 'Opponent is choosing a token to keep…',
  undoing: 'Undoing the last play…',
} as const

/**
 * Holds the decision slot while nothing is yours to decide, so a pending of
 * the other seat — or one of yours the screen has not caught up with — never
 * reads as an instruction. Wine for the opponent's moment, parchment for yours.
 * No hourglass: their token waiting in its slot already says they are deciding.
 */
export function OpponentThinking({
  mode = 'thinking',
  side,
  name = 'Opponent',
}: {
  mode?: keyof typeof WAITING_TEXT
  /** Whose moment it is, when the mode alone does not say (a takeback is either side's). */
  side?: 'you' | 'opponent'
  /** Who the other side is: "Professor Maple is thinking…" in the tutorial and its warm-up. */
  name?: string
}) {
  return (
    <section className="prompt" data-side={side ?? (mode === 'drawing' ? 'you' : 'opponent')} aria-label="Current decision">
      <div className="prompt-head">
        <p className="prompt-text prompt-waiting" aria-live="polite">
          {WAITING_TEXT[mode].replace(/^Opponent/, name)}
        </p>
      </div>
    </section>
  )
}

export function Prompt({
  view,
  actions,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
}) {
  const buttons = actions.filter((action) => {
    return !HANDLED_ELSEWHERE.has(action.type)
  })

  function label(action: Action): ReactNode {
    // the cards marked are the ones that stay: the label says so, not which two go
    if (action.type === 'coinDiscard') return 'Keep these'
    return describeAction(action)
  }

  /*
   * A reminder, one line: the question, and a button only for the few answers
   * that have nowhere else to go (stop moving, keeping the marked cards after
   * a coin). The token itself is in your tray, and what it does is a hold
   * away; the rules are behind the ? button.
   */
  return (
    <section className="prompt" aria-label="Current decision">
      <div className="prompt-head">
        <p className="prompt-text">{promptFor(view)}</p>
        {buttons.length > 0 ? (
          <div className="prompt-actions">
            {buttons.map((action) => (
              <button key={actionKey(action)} type="button" className="btn-secondary" onClick={() => onAct(action)}>
                {label(action)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}
