import { DRAGON_TYPES, single } from '@dcv/engine'
import { DRAGON_THEME } from '../theme.js'
import { TokenGlyph } from './TokenGlyph.js'

/**
 * The rules on one screen, behind the ? button: enough to play, not the
 * rulebook. The six abilities come from the theme, the same lines the
 * decision panel shows, so the two can never disagree.
 */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal help" role="dialog" aria-modal="true" aria-label="How to play" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>How to play</h2>
          <button type="button" onClick={onClose} aria-label="Close help">
            ✕
          </button>
        </div>
        <ol className="help-steps">
          <li>
            <strong>Draw and place.</strong> Your turn starts with a dragon from the bag. Put it on any space — on top of
            others too, up to three high. Only the top one of a stack counts.
          </li>
          <li>
            <strong>Fire it up, if you like.</strong> The dragon you just placed may use its ability once.
          </li>
          <li>
            <strong>Score.</strong> A card in your hand scores when its three dragons stand on the board in its shape, in
            any rotation. Three of one kind is worth 3, a mix is worth 2. Your hand refills to two at the end of your turn.
          </li>
          <li>
            <strong>Coins.</strong> Once a turn you may spend a coin: draw two cards, then put two back under the deck.
            Each coin you still hold at the end is worth 1.
          </li>
          <li>
            <strong>The end.</strong> When the cards or the dragons run out, the other player gets one last chance to
            score. Most points wins; a tie goes to whoever scored more cards.
          </li>
        </ol>
        <h3 className="help-subhead">The dragons</h3>
        <ul className="help-dragons">
          {DRAGON_TYPES.map((type) => (
            <li key={type}>
              <svg viewBox="-10 -10 20 22" aria-hidden="true">
                <TokenGlyph token={single(type)} radius={8.5} />
              </svg>
              <span>
                <strong>{DRAGON_THEME[type].label}</strong> {DRAGON_THEME[type].effect}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
