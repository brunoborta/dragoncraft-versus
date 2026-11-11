import { tokenId } from '@dcv/engine'
import type { Token } from '@dcv/engine'
import { useArt } from '../art/ArtContext.js'
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
}: {
  bag: readonly Token[]
  /**
   * Opens the composition. Absent when the setting is off: then the bag is a
   * figure, not a control — the count is always there, the counting is not.
   */
  onOpen?: () => void
  /** True while a token is being drawn: the bag shakes and glows (M2). */
  drawing?: boolean
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
  const label = `Bag, ${bag.length} tokens left`
  if (!onOpen) {
    return (
      <p className="bag" data-drawing={drawing || undefined} aria-label={label} role="img">
        {inside}
      </p>
    )
  }
  return (
    <button type="button" className="bag" data-drawing={drawing || undefined} onClick={onOpen} aria-label={label}>
      {inside}
    </button>
  )
}

export function BagDialog({ bag, onClose }: { bag: readonly Token[]; onClose: () => void }) {
  const groups = bagComposition(bag)
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="What is left in the bag"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-head">
          <h2>In the bag: {bag.length}</h2>
          <button type="button" onClick={onClose} aria-label="Close bag">
            ✕
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
