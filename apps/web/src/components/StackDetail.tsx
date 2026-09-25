import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import { HEX_SIZE } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/** The whole stack, bottom to top, for a space the board is not asking about. */
export function StackDetail({ hex, stack }: { hex: Hex; stack: Token[] }) {
  return (
    <section className="stack-detail" aria-label={`Stack at ${key(hex)}`}>
      <p className="stack-detail-title">{key(hex)} — bottom to top</p>
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
