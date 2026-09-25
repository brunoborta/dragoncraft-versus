import { actionKey, hexEq } from '@dcv/engine'
import type { Action, Hex, PlayerView } from '@dcv/engine'
import { describeAction, promptFor } from '../game/labels.js'

const HANDLED_BY_BOARD = new Set(['place', 'meatMove', 'ironMove', 'potionSwap', 'scoreCard'])

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
  const buttons = actions.filter((action) => {
    if (HANDLED_BY_BOARD.has(action.type)) return false
    // a dual neighbour needs the bar to ask which of its two abilities to use
    if (action.type === 'plantTarget') return selected !== null && hexEq(action.at, selected)
    return true
  })

  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text">{promptFor(view)}</p>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={actionKey(action)} type="button" onClick={() => onAct(action)}>
            {describeAction(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
