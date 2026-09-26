import type { ShopCard } from '@dcv/engine'
import { cardName } from '../game/labels.js'
import { PatternGlyph } from './PatternGlyph.js'

export function CardView({
  card,
  scoreable,
  onScore,
  returning,
  onToggleReturn,
  toggleDisabled,
}: {
  card: ShopCard
  scoreable: boolean
  onScore?: () => void
  /** Marked to go back to the bottom of the deck. */
  returning?: boolean
  /** Present only while a coin discard is pending: the card is the control. */
  onToggleReturn?: () => void
  toggleDisabled?: boolean
}) {
  return (
    <article className="card" data-scoreable={scoreable} data-returning={returning ? 'true' : 'false'}>
      <PatternGlyph pattern={card.pattern} />
      <p className="card-name">{cardName(card)}</p>
      <span className="card-rep" aria-label={`${card.reputation} reputation`}>
        {card.reputation}
      </span>
      {onToggleReturn ? (
        <button
          type="button"
          className="card-return"
          onClick={onToggleReturn}
          aria-pressed={returning ?? false}
          disabled={toggleDisabled && !returning}
        >
          {returning ? 'Keep it' : 'Put it back'}
        </button>
      ) : scoreable && onScore ? (
        <button type="button" onClick={onScore}>
          Score
        </button>
      ) : null}
    </article>
  )
}
