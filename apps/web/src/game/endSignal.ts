import type { LogEntry, PlayerView } from '@dcv/engine'

/**
 * What set off the end of the game: the last token out of the bag, or the
 * last card out of the deck (spec §Fim de jogo). The view carries only
 * `endTriggered`, so the cause is read off what ran out.
 */
export type EndCause = 'bag' | 'deck'

type Supplies = Pick<PlayerView, 'deckCount' | 'bag' | 'extrasAdded'>

/** The bag is spent once it has stood empty: it is empty now, or the extras had to go in. */
function bagSpent(view: Supplies): boolean {
  return view.bag.length === 0 || view.extrasAdded
}

/**
 * The deck, when it is empty and the bag is not spent; otherwise the bag. With
 * the deck still holding cards, only the bag can have ended it, even when a
 * crystal's two unpicked tokens have gone back in since.
 */
export function endCause(view: Supplies): EndCause {
  return view.deckCount === 0 && !bagSpent(view) ? 'deck' : 'bag'
}

/**
 * Where, in the log, the end went off — as the `seq` of the presentation
 * event the banner goes up before. The bag: the first draw of the batch (a
 * crystal's fire-up is followed by its three, and the banner comes before
 * them). The deck: right after the last end of turn or coin, the two things
 * that draw cards. Nothing that explains it: after the whole batch.
 */
export function triggerPoint(added: readonly LogEntry[], offset: number, cause: EndCause): number {
  if (cause === 'bag') {
    const index = added.findIndex((entry) => entry.action.type === 'draw')
    if (index !== -1) return offset + index
  } else {
    for (let index = added.length - 1; index >= 0; index--) {
      const type = added[index].action.type
      if (type === 'endTurn' || type === 'spendCoin') return offset + index + 1
    }
  }
  return offset + added.length
}

/**
 * Which of the bag and the deck wear a cross: whatever ran out, once the end
 * has been shown on screen — not the moment the view knows, which is ahead of
 * the animation.
 */
export function endMarks(
  view: Supplies & Pick<PlayerView, 'endTriggered'>,
  revealed: boolean,
): { bag: boolean; deck: boolean } {
  if (!revealed || !view.endTriggered) return { bag: false, deck: false }
  return { bag: view.deckCount > 0 || bagSpent(view), deck: view.deckCount === 0 }
}
