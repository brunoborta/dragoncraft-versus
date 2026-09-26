import { scoreOf } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { CardView } from './CardView.js'

export function Hand({
  view,
  actions,
  onAct,
  returning = [],
  onToggleReturn,
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
  /** Card ids marked to go back to the bottom of the deck. */
  returning?: readonly string[]
  onToggleReturn?: (cardId: string) => void
}) {
  const scoring = actions.filter((action) => action.type === 'scoreCard')
  const pending = view.pending[view.pending.length - 1]
  // the cards are the control for a discard: a list of pairs to pick from is
  // unreadable when the cards themselves are already on screen
  const discarding = pending?.kind === 'coinDiscard' && onToggleReturn !== undefined

  return (
    <section className="hand" aria-label="Your hand">
      <p className="hand-meta">
        You — {view.you.coins} coins, {scoreOf(view.you)} reputation
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
              returning={returning.includes(card.id)}
              onToggleReturn={
                discarding && onToggleReturn ? () => onToggleReturn(card.id) : undefined
              }
              toggleDisabled={returning.length >= 2}
            />
          )
        })}
      </div>
    </section>
  )
}
