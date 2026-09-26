import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/**
 * The whole stack, bottom to top, for a space the board is not asking about.
 * It overlays the footer rather than sitting in it: growing the footer would
 * shrink the board row and move every hex centre mid-gesture, which turns the
 * two-tap confirm into a mis-tap on a neighbour.
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
        <p className="stack-detail-title">{key(hex)} — bottom to top</p>
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
