import type { ShopCard } from '@dcv/engine'
import type React from 'react'
import { cardName } from '../game/labels.js'
import { StarIcon } from './icons.js'
import { PatternGlyph } from './PatternGlyph.js'

/**
 * A card on parchment: the pattern drawn with the same tokens as the board, and
 * the reputation as a big number with a star (plan decision 7.2). The name is
 * not printed — the pattern says it to the eye — but it stays in the card for
 * screen readers.
 *
 * The footer has a fixed height and the Score button lives inside it, so a card
 * becoming scoreable never changes the hand's height. A taller hand would
 * shrink the board and move every hex under a half-finished two-tap gesture.
 */
export function CardView({
  card,
  scoreable,
  completes = false,
  onScore,
  picked,
  onPick,
}: {
  card: ShopCard
  scoreable: boolean
  /** The token hovering over the board would complete this card there. */
  completes?: boolean
  onScore?: () => void
  /** Chosen to stay in hand. Only meaningful inside the discard dialog. */
  picked?: boolean
  /** Present only in the discard dialog, where the whole card is the control. */
  onPick?: () => void
}) {
  const pickable = onPick !== undefined

  return (
    <article
      className="card"
      data-scoreable={scoreable}
      data-completes={completes || undefined}
      data-picked={pickable ? (picked ? 'true' : 'false') : undefined}
      {...(pickable
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-pressed': picked ?? false,
            onClick: onPick,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') onPick?.()
            },
          }
        : {})}
    >
      <PatternGlyph pattern={card.pattern} />
      <p className="card-name sr-only">{cardName(card)}</p>
      <div className="card-foot">
        <span className="card-rep" aria-label={`${card.reputation} reputation`}>
          <StarIcon />
          <span>{card.reputation}</span>
        </span>
        {!pickable && scoreable && onScore ? (
          <button type="button" onClick={onScore}>
            Score
          </button>
        ) : null}
      </div>
    </article>
  )
}
