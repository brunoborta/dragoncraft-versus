import type { LogEntry, Seat } from '@dcv/engine'

/** All undo needs of a state: whose turn it is, and what has happened. */
export type UndoableState = { current: Seat; log: readonly LogEntry[] }

/**
 * The oldest state undo may return to.
 *
 * Two things stop it. The start of your turn, because what the machine did is
 * history. And a draw from the bag, because stepping back across one would
 * hand you information you had not paid for: the generator is deterministic,
 * so the same token comes back, and undoing the fire-up that drew it would
 * leave you knowing what comes next without having spent the ability to learn
 * it. Everything since the last draw is yours to take back — which is why
 * meat, iron and potion, none of which draw, can be undone in full.
 */
export function undoFloor(history: readonly UndoableState[]): number {
  let floor = 0

  for (let index = 1; index < history.length; index += 1) {
    const previous = history[index - 1]
    const current = history[index]

    const added = current.log.slice(previous.log.length)
    const drew = added.some((entry) => entry.action.type === 'draw')
    const changedHands = current.current !== previous.current

    if (drew || changedHands) floor = index
  }

  return floor
}
