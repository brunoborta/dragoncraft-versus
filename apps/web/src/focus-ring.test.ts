import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'apps/web/src/styles.css'), 'utf8')

function block(selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? null
}

/**
 * The ring exists for keyboard navigation, where it is the only thing saying
 * where you are. Plain `:focus` also fires for a tap, and a tapped board space
 * already says it is selected in its own colour — so the ring there is noise,
 * and it showed up as noise in the browser's device emulator.
 */
describe('the focus ring', () => {
  it('is not drawn for plain focus', () => {
    const rule = block(':focus')
    expect(rule, ':focus declares nothing, so the browser default still draws').not.toBeNull()
    expect(rule).toMatch(/outline:\s*none/)
  })

  it('is drawn for keyboard focus, in a colour the design already uses', () => {
    const rule = block(':focus-visible')
    expect(rule, 'keyboard users would be left with no ring at all').not.toBeNull()
    expect(rule).toMatch(/outline:\s*[^;]*var\(--(selected|completes|ink)\)/)
  })
})
