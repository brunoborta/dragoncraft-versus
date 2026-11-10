import type { Action, PlayerView } from '@dcv/engine'
import { CardView } from './CardView.js'

/** How far each card turns from the middle of the fan, in degrees. */
const FAN_STEP = 4

/**
 * Your cards in a fan above your bar. Sized for two or three — the Fancy
 * dragon that allows a third does not exist in the engine yet, but the hand is
 * built so a third card fits without squeezing (plan 1.1, Konzepttafel).
 *
 * The hand stays on screen through every decision: the cards are what tell you
 * whether the space you are about to pick completes one.
 */
export function Hand({
  view,
  actions,
  onAct,
  completing = new Set(),
}: {
  view: PlayerView
  actions: readonly Action[]
  onAct: (action: Action) => void
  /** Cards the hovering token would complete: they glow and rise (the card-glow option). */
  completing?: ReadonlySet<string>
}) {
  const scoring = actions.filter((action) => action.type === 'scoreCard')
  const cards = view.you.hand
  const middle = (cards.length - 1) / 2

  return (
    <section className="hand" aria-label="Your hand" data-count={cards.length}>
      <div className="hand-cards">
        {cards.map((card, index) => {
          const action = scoring.find((candidate) => candidate.cardId === card.id)
          const offset = index - middle
          return (
            <div
              key={card.id}
              className="fan-slot"
              style={{ '--fan-angle': `${offset * FAN_STEP}deg`, '--fan-drop': `${Math.abs(offset) * 4}px` } as React.CSSProperties}
            >
              <CardView
                card={card}
                scoreable={action !== undefined}
                completes={completing.has(card.id)}
                onScore={action ? () => onAct(action) : undefined}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
