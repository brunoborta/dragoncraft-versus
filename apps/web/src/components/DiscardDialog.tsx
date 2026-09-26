import type { ShopCard } from '@dcv/engine'
import { CardView } from './CardView.js'

/** A discard returns exactly two cards, so everything else in hand stays. */
export function keepCount(hand: readonly ShopCard[]): number {
  return Math.max(0, hand.length - 2)
}

/**
 * Spending a coin used to offer a button per pair — up to six of them, with
 * near-identical text, standing next to the very cards they named. The cards
 * are the control instead, on their own surface: pick the ones that stay, and
 * the two left over go back to the bottom of the deck.
 */
export function DiscardDialog({
  hand,
  keeping,
  onToggle,
  onFinish,
}: {
  hand: readonly ShopCard[]
  keeping: readonly string[]
  onToggle: (cardId: string) => void
  onFinish: () => void
}) {
  const wanted = keepCount(hand)
  const ready = keeping.length === wanted

  return (
    <div className="modal-backdrop">
      <section
        className="modal discard-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Choose the cards to keep"
      >
        <div className="modal-head">
          <h2>Choose the cards to keep</h2>
        </div>
        <p className="modal-note">
          {wanted === 0
            ? 'Both of these go back to the bottom of the deck.'
            : `Keep ${wanted}. The other two go back to the bottom of the deck.`}
        </p>
        <div className="discard-cards">
          {hand.map((card) => (
            <CardView
              key={card.id}
              card={card}
              scoreable={false}
              picked={keeping.includes(card.id)}
              onPick={() => onToggle(card.id)}
            />
          ))}
        </div>
        <button type="button" className="discard-finish" onClick={onFinish} disabled={!ready}>
          Finish
        </button>
      </section>
    </div>
  )
}
