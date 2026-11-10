import { abilitiesOf, actionKey, hexEq } from '@dcv/engine'
import type { Action, Hex, PlayerView, Token } from '@dcv/engine'
import type { ReactNode } from 'react'
import { describeAction, promptFor } from '../game/labels.js'
import { DRAGON_THEME } from '../theme.js'
import { FlameIcon, HourglassIcon } from './icons.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/**
 * Answered somewhere other than this panel: on the board (placing, moving,
 * swapping), on the cards (scoring), or by a control with a fixed place of its
 * own — End turn beside your bar, the coins in the corner of the board. Those
 * two are offered at many points of a turn, so they cannot live in a panel
 * whose content changes with every decision.
 */
const HANDLED_ELSEWHERE = new Set(['place', 'meatMove', 'ironMove', 'potionSwap', 'scoreCard', 'endTurn', 'spendCoin'])

/** The look of a decision button: firing up burns, everything else is parchment. */
function variant(action: Action): string {
  return action.type === 'fireUp' ? 'btn-fire' : 'btn-secondary'
}

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

const WAITING_TEXT = {
  thinking: 'Opponent is thinking…',
  playing: 'Opponent is playing…',
  drawing: 'Drawing from the bag…',
} as const

/**
 * Holds the decision slot while nothing is yours to decide, so a pending of
 * the other seat — or one of yours the screen has not caught up with — never
 * reads as an instruction. Wine for the opponent's moment, parchment for yours.
 */
export function OpponentThinking({
  aside,
  mode = 'thinking',
}: {
  aside?: ReactNode
  mode?: keyof typeof WAITING_TEXT
}) {
  return (
    <section className="prompt" data-side={mode === 'drawing' ? 'you' : 'opponent'} aria-label="Current decision">
      <div className="prompt-head">
        <p className="prompt-text prompt-waiting" aria-live="polite">
          {mode === 'drawing' ? null : <HourglassIcon className="hourglass" />}
          {WAITING_TEXT[mode]}
        </p>
        {aside}
      </div>
    </section>
  )
}

export function Prompt({
  view,
  actions,
  selected,
  onAct,
  aside,
}: {
  view: PlayerView
  actions: readonly Action[]
  selected: Hex | null
  onAct: (action: Action) => void
  /** Sits at the end of the question's line: the Undo button. */
  aside?: ReactNode
}) {
  const pending = view.pending[view.pending.length - 1]

  const buttons = actions.filter((action) => {
    if (HANDLED_ELSEWHERE.has(action.type)) return false
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
          {action.type === 'fireUp' ? <FlameIcon className="action-icon" /> : null}
          <span className="action-text">
            <span className="action-name">{describeAction(action)}</span>
            <span className="action-effect">{DRAGON_THEME[action.ability].effect}</span>
          </span>
        </>
      )
    }
    return describeAction(action)
  }

  return (
    <section className="prompt" aria-label="Current decision">
      <div className="prompt-head">
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
        {aside}
      </div>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={actionKey(action)} type="button" className={variant(action)} onClick={() => onAct(action)}>
            {label(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
