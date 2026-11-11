import type { ShopCard } from '@dcv/engine'
import type React from 'react'
import { cardName } from '../game/labels.js'
import { StarIcon } from './icons.js'
import { PatternGlyph } from './PatternGlyph.js'

/**
 * A card on parchment: the pattern drawn with the same tokens as the board,
 * filling the card, and the reputation on a star in the top-left corner (plan
 * decision 7.2). The name is not printed — the pattern says it to the eye —
 * but it stays in the card for screen readers.
 *
 * A card that can be scored glows, and the whole card is the control: a tap
 * anywhere on it scores it. There is no Score button to find or to make room
 * for, so the card keeps one fixed height and the hand never changes height —
 * a taller hand would shrink the board and move every hex under a
 * half-finished two-tap gesture.
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
  /** Scores the card; the whole card is the control while it is scoreable. */
  onScore?: () => void
  /** Chosen to stay in hand. Only meaningful inside the discard dialog. */
  picked?: boolean
  /** Present only in the discard dialog, where the whole card is the control. */
  onPick?: () => void
}) {
  const pickable = onPick !== undefined
  // in the discard dialog a tap picks; in the hand, a tap on a card that can be scored scores it
  const press = pickable ? onPick : scoreable ? onScore : undefined

  return (
    <article
      className="card"
      data-scoreable={scoreable}
      data-completes={completes || undefined}
      data-picked={pickable ? (picked ? 'true' : 'false') : undefined}
      {...(press
        ? {
            role: 'button',
            tabIndex: 0,
            ...(pickable
              ? { 'aria-pressed': picked ?? false }
              : { 'aria-label': `Score ${cardName(card)}, ${card.reputation} reputation` }),
            onClick: press,
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                press()
              }
            },
          }
        : {})}
    >
      <span className="card-rep" aria-label={`${card.reputation} reputation`}>
        <StarIcon />
        <span>{card.reputation}</span>
      </span>
      <PatternGlyph pattern={card.pattern} />
      <p className="card-name sr-only">{cardName(card)}</p>
    </article>
  )
}
