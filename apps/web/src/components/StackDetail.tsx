import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/**
 * The whole stack, bottom to top. It overlays the footer rather than sitting in
 * it: growing the footer would shrink the board row and move every hex centre
 * mid-gesture, which turns the two-tap confirm into a mis-tap on a neighbour.
 *
 * The hex coordinate is in the accessible name but not on screen. A player who
 * can see the board knows which space they tapped and `1,0` tells them nothing;
 * a player who cannot has no other anchor for which space this is.
 */
export function StackDetail({
  hex,
  stack,
  onClose,
}: {
  hex: Hex
  stack: Token[]
  onClose: () => void
}) {
  return (
    <section className="stack-detail" aria-label={`Stack at ${key(hex)}`}>
      <div className="stack-detail-head">
        <p className="stack-detail-title">Bottom to top</p>
        <button type="button" onClick={onClose} aria-label="Close stack">
          ✕
        </button>
      </div>
      <ol>
        {[...stack].map((token, index) => (
          <li key={`${index}-${tokenLabel(token)}`}>
            <svg viewBox={`${-HEX_SIZE} ${-HEX_SIZE} ${HEX_SIZE * 2} ${HEX_SIZE * 2}`} aria-hidden="true">
              <TokenGlyph token={token} radius={HEX_SIZE * 0.7} />
            </svg>
            <span>{tokenLabel(token)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
