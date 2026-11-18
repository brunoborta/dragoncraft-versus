import { key } from '@dcv/engine'
import type { Hex, Token } from '@dcv/engine'
import type { CSSProperties } from 'react'
import { HEX_SIZE } from '../geometry.js'
import { TokenGlyph, tokenLabel } from './TokenGlyph.js'

/**
 * The tapped stack as small tokens in the board's top-right corner — the one
 * corner the hexagon leaves empty that nothing else took. No words: the chips
 * are the information, drawn as the pile is, top on top, the top of the stack
 * bright and a little larger and what is buried dimmer beneath it. They arrive
 * bottom first, the way the stack was built. It is not a dialog and has no
 * close button: tapping the stack again, tapping elsewhere, or making any move
 * puts it away.
 *
 * `ghost` is the token you are about to place here, while this space is the
 * one chosen for it. It sits on top and takes the light: the question in that
 * moment is where yours goes, so the corner says what the preview hovering
 * over the board says, with the same emphasis. The stack's own top steps back
 * into the pile until the move is made.
 *
 * The hex coordinate is in the accessible name but not on screen, and a reader
 * hears the order spelled out, as the old panel said it.
 */
export function StackPeek({ hex, stack, ghost }: { hex: Hex; stack: Token[]; ghost?: Token }) {
  // the top of the stack is the top of the screen
  const topDown = stack.map((token, index) => ({ token, index })).reverse()
  const order = stack.map((token) => tokenLabel(token)).join(', ')

  return (
    <section className="stack-peek" aria-label={`Stack at ${key(hex)}`}>
      <p className="sr-only">{ghost ? `Bottom to top: ${order}; yours would go on top: ${tokenLabel(ghost)}` : `Bottom to top: ${order}`}</p>
      <span className="stack-chips" aria-hidden="true">
        {ghost ? (
          <span className="stack-chip" data-ghost="true" data-top="true" style={{ '--i': stack.length, zIndex: stack.length + 1 } as CSSProperties}>
            <svg viewBox={`${-HEX_SIZE} ${-HEX_SIZE} ${HEX_SIZE * 2} ${HEX_SIZE * 2}`}>
              <TokenGlyph token={ghost} radius={HEX_SIZE * 0.7} />
            </svg>
          </span>
        ) : null}
        {topDown.map(({ token, index }) => (
          <span
            key={index}
            className="stack-chip"
            data-top={(!ghost && index === stack.length - 1) || undefined}
            style={{ '--i': index, zIndex: index + 1 } as CSSProperties}
          >
            <svg viewBox={`${-HEX_SIZE} ${-HEX_SIZE} ${HEX_SIZE * 2} ${HEX_SIZE * 2}`}>
              <TokenGlyph token={token} radius={HEX_SIZE * 0.7} />
            </svg>
          </span>
        ))}
      </span>
    </section>
  )
}
