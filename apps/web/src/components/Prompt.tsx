import type { Action, PlayerView } from '@dcv/engine'
import { describeAction, promptFor } from '../game/labels.js'

/** Everything the pending stack asks that is not a tap on the board. */
export function Prompt({
  view,
  actions,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
}) {
  const buttons = actions.filter((action) => action.type !== 'place' && action.type !== 'scoreCard')

  return (
    <section className="prompt" aria-label="Current decision">
      <p className="prompt-text">{promptFor(view)}</p>
      <div className="prompt-actions">
        {buttons.map((action) => (
          <button key={describeAction(action)} type="button" onClick={() => onAct(action)}>
            {describeAction(action)}
          </button>
        ))}
      </div>
    </section>
  )
}
