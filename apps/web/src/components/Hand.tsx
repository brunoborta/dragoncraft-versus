import { bankedReputation } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { CardView } from './CardView.js'

export function Hand({
  view,
  actions,
  onAct,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
}) {
  const scoring = actions.filter((action) => action.type === 'scoreCard')

  return (
    <section className="hand" aria-label="Your hand">
      <p className="hand-meta">
        You — {view.you.coins} coins, {bankedReputation(view.you)} reputation
      </p>
      <div className="hand-cards">
        {view.you.hand.map((card) => {
          const action = scoring.find((candidate) => candidate.cardId === card.id)
          return (
            <CardView
              key={card.id}
              card={card}
              scoreable={action !== undefined}
              onScore={action ? () => onAct(action) : undefined}
            />
          )
        })}
      </div>
    </section>
  )
}
