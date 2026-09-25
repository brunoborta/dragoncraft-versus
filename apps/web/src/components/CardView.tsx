import type { ShopCard } from '@dcv/engine'
import { cardName } from '../game/labels.js'
import { PatternGlyph } from './PatternGlyph.js'

export function CardView({
  card,
  scoreable,
  onScore,
}: {
  card: ShopCard
  scoreable: boolean
  onScore?: () => void
}) {
  return (
    <article className="card" data-scoreable={scoreable}>
      <PatternGlyph pattern={card.pattern} />
      <p className="card-name">{cardName(card)}</p>
      <span className="card-rep" aria-label={`${card.reputation} reputation`}>
        {card.reputation}
      </span>
      {scoreable && onScore ? (
        <button type="button" onClick={onScore}>
          Score
        </button>
      ) : null}
    </article>
  )
}
