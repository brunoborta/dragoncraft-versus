import type { LogEntry, Seat } from './types.js'

/** All undo needs of a state: whose turn it is, and what has happened. */
export type UndoableState = { current: Seat; log: readonly LogEntry[] }

/**
 * The oldest state undo may return to.
 *
 * Three things stop it. The start of your turn, because what the other side
 * did is history. A draw from the bag, because stepping back across one would
 * hand you information you had not paid for: the generator is deterministic,
 * so the same token comes back, and undoing the fire-up that drew it would
 * leave you knowing what comes next without having spent the ability to learn
 * it. And a spent coin, for the same reason with cards instead of tokens: the
 * two cards it drew from the deck are seen, and undoing the spend would hand
 * the coin back with the knowledge kept. Everything since is yours to take
 * back — which is why meat, iron and potion, none of which reveal anything,
 * can be undone in full, and why the pick after a crystal or the discard
 * after a coin can be re-chosen: that information is already paid for.
 */
export function undoFloor(history: readonly UndoableState[]): number {
  let floor = 0

  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]
    const current = history[index]

    const added = current.log.slice(previous.log.length)
    const revealed = added.some((entry) => entry.action.type === 'draw' || entry.action.type === 'spendCoin')
    const changedHands = current.current !== previous.current

    if (revealed || changedHands) floor = index
  }

  return floor
}
