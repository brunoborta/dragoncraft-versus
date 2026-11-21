import { tokenId } from '@dcv/engine'
import type { Token } from '@dcv/engine'
import { useArt } from '../art/ArtContext.js'
import { CardIcon, CrossIcon } from './icons.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** How many of each token are left, in the bag's own canonical order. */
export function bagComposition(bag: readonly Token[]): { token: Token; count: number }[] {
  const groups = new Map<string, { token: Token; count: number }>()
  for (const token of bag) {
    const id = tokenId(token)
    const group = groups.get(id)
    if (group) group.count += 1
    else groups.set(id, { token, count: 1 })
  }
  return [...groups.values()]
}

/**
 * The bag with how many tokens are left. Tapping it shows what is left — the
 * composition, which the board already gives away — and never the order, which
 * is the one thing that stays secret (plan 1.2, item 7).
 */
export function Bag({
  bag,
  onOpen,
  drawing = false,
  spent = false,
}: {
  bag: readonly Token[]
  /**
   * Opens the composition. Absent when the setting is off: then the bag is a
   * figure, not a control — the count is always there, the counting is not.
   */
  onOpen?: () => void
  /** True while a token is being drawn: the bag shakes and glows (M2). */
  drawing?: boolean
  /**
   * The bag ran out and set off the end: it wears a cross until the game is
   * over, even once the six extras are in it and the count climbs again.
   */
  spent?: boolean
}) {
  const art = useArt()
  const inside = (
    <>
      <img className="bag-art" src={art.bag} alt="" draggable={false} />
      <span className="bag-count" aria-hidden="true">
        Bag {bag.length}
      </span>
    </>
  )
  const label = `Bag, ${bag.length} tokens left${spent ? ', ran out: the game ends this turn' : ''}`
  const marks = { 'data-drawing': drawing || undefined, 'data-spent': spent || undefined }
  if (!onOpen) {
    return (
      <p className="bag" {...marks} aria-label={label} role="img">
        {inside}
      </p>
    )
  }
  return (
    <button type="button" className="bag" {...marks} onClick={onOpen} aria-label={label}>
      {inside}
    </button>
  )
}

/**
 * How many cards are left in the deck. Like the bag it is a race against the
 * end: the game is over once either runs out, so the figure sits right above
 * the bag. Only the count is public — never which cards.
 */
export function DeckCount({ count, spent = false }: { count: number; /** The deck ran out: crossed until the end. */ spent?: boolean }) {
  return (
    <p
      className="deck-count"
      role="img"
      data-spent={spent || undefined}
      aria-label={`Deck, ${count} cards left${spent ? ', none left: the game ends this turn' : ''}`}
    >
      <CardIcon />
      <span aria-hidden="true">{count}</span>
    </p>
  )
}

export function BagDialog({ bag, onClose }: { bag: readonly Token[]; onClose: () => void }) {
  const groups = bagComposition(bag)
  return (
    <div className="modal-backdrop menu-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="What is left in the bag"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>In the bag: {bag.length}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close bag">
            <CrossIcon />
          </button>
        </div>
        <p className="modal-note">What is left, not the order it comes out in.</p>
        {groups.length === 0 ? (
          <p className="modal-note">The bag is empty.</p>
        ) : (
          <ul className="bag-list">
            {groups.map(({ token, count }) => (
              <li key={tokenId(token)}>
                <svg viewBox="-10 -10 20 22" aria-hidden="true">
                  <TokenGlyph token={token} radius={8} />
                </svg>
                <span className="bag-list-name">{tokenLabel(token)}</span>
                <span className="bag-list-count">× {count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
