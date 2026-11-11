import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DRAGON_TYPES } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { DRAGON_THEME } from './theme.js'

// vitest does not process CSS, so `?raw` comes back empty; read it off disk
const css = readFileSync(resolve(process.cwd(), 'apps/web/src/styles.css'), 'utf8')

/** The custom properties declared on :root, by name without the leading dashes. */
function tokens(): Record<string, string> {
  const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')))
  const found: Record<string, string> = {}
  for (const [, name, value] of root.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)) {
    found[name] = value
  }
  return found
}

function channel(value: number): number {
  const c = value / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const AA_NORMAL = 4.5

/**
 * jsdom renders no colour, so nothing else in this suite can see a contrast
 * failure — and one shipped: the gold buttons drew their label in near-white
 * at 1.62:1. These are the token pairs the stylesheet actually puts together.
 */
const PAIRS: [string, string, string][] = [
  ['body text', 'ink', 'bg'],
  ['text on a panel', 'ink', 'surface'],
  ['secondary text on a panel', 'muted', 'surface'],
  ['label on a gold button', 'bg', 'completes'],
  // v3 skin
  ['text on parchment', 'parchment-ink', 'parchment'],
  ['brass numbers on a forest plate', 'brass-400', 'forest-900'],
  ['light label on a forest button', 'ink', 'forest-600'],
  ['light label on a wine banner', 'ink', 'wine-700'],
  ['effect line on parchment', 'parchment-muted', 'parchment'],
  ['label on the fire button', 'ember-ink', 'ember-500'],
  ['label on the Undo button', 'stone-ink', 'stone-500'],
  ['figures on a player plate', 'brass-200', 'forest-900'],
]

describe('colour contrast', () => {
  const palette = tokens()

  it('declares every token the pairs refer to', () => {
    for (const [, fg, bg] of PAIRS) {
      expect(palette[fg], `--${fg}`).toBeDefined()
      expect(palette[bg], `--${bg}`).toBeDefined()
    }
  })

  for (const [what, fg, bg] of PAIRS) {
    it(`clears AA for ${what}`, () => {
      const ratio = contrast(palette[fg], palette[bg])
      expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }

  /**
   * Checking the tokens alone would pass while the bug is still there: the
   * defect was an omission, not a wrong value. These rules put a light label
   * on gold by declaring no `color` at all and inheriting the page's.
   */
  const GOLD_BUTTONS = ['.game-over button', '.discard-finish']

  for (const selector of GOLD_BUTTONS) {
    it(`gives ${selector} a label that can be read on gold`, () => {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const rule = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css)
      expect(rule, `${selector} has no rule`).not.toBeNull()

      const declared = /color:\s*var\(--([\w-]+)\)/.exec(rule?.[1] ?? '')
      expect(declared, `${selector} declares no color, so it inherits --ink`).not.toBeNull()

      const ratio = contrast(palette[declared?.[1] ?? ''], palette.completes)
      expect(ratio, `${ratio.toFixed(2)}:1 on gold`).toBeGreaterThanOrEqual(AA_NORMAL)
    })
  }
})

/**
 * The token icons are white on the token's colour. They are graphics, not text,
 * so the bar is WCAG's 3:1 for non-text contrast — and the icon is what still
 * tells the six apart for someone who cannot tell the colours apart.
 */
describe('token icon contrast', () => {
  for (const type of DRAGON_TYPES) {
    it(`clears 3:1 for the white ${type} icon`, () => {
      const ratio = contrast('#ffffff', DRAGON_THEME[type].color)
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    })
  }
})
