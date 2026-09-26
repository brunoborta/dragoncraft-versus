import type { ShopCard } from '@dcv/engine'
import type React from 'react'
import { cardName } from '../game/labels.js'
import { PatternGlyph } from './PatternGlyph.js'

export function CardView({
  card,
  scoreable,
  onScore,
  picked,
  onPick,
}: {
  card: ShopCard
  scoreable: boolean
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
      <p className="card-name">{cardName(card)}</p>
      <span className="card-rep" aria-label={`${card.reputation} reputation`}>
        {card.reputation}
      </span>
      {!pickable && scoreable && onScore ? (
        <button type="button" onClick={onScore}>
          Score
        </button>
      ) : null}
    </article>
  )
}
