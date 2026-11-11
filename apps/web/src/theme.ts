import type { DragonType } from '@dcv/engine'
import { TOKEN_ICON_PATHS } from './art/icon-paths.js'

/**
 * An illustrated icon, drawn white on the token in a [-1, 1] box: one filled
 * silhouette whose cut-outs (facets, crust scores, a leaf's midrib) let the
 * token's colour show through, traced from `designs/art/icons-tokens.png`
 * by `scripts/icons.mjs`. Draw it with `fill-rule="evenodd"`.
 */
export type DragonIcon = { shape: string }

export type DragonTheme = {
  /** The face of the token. White on it clears 3:1 (`contrast.test.ts`). */
  color: string
  /** The token's edge. */
  dark: string
  icon: DragonIcon
  label: string
  effect: string
}

/** Darkens a `#rrggbb` colour toward black by `amount` (0 to 1). */
export function shade(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - amount)))
  return `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/**
 * The six silhouettes of the v3 plan (decision 7.1): crystal, ingot, loaf,
 * sprout, drumstick and potion flask. Each has to be told apart by shape alone
 * at 40 pixels, which is what makes the board readable without colour.
 *
 * `effect` is one line saying what firing this token up does. Where you put a
 * token depends on what you are about to fire up, so the player needs it at the
 * moment of deciding, not in a rulebook.
 */
export const DRAGON_THEME: Record<DragonType, DragonTheme> = {
  bread: {
    color: '#c47010',
    dark: shade('#c47010', 0.45),
    icon: { shape: TOKEN_ICON_PATHS.bread },
    label: 'Bread',
    effect: 'Draw another token and place it',
  },
  crystal: {
    color: '#2a7fd4',
    dark: shade('#2a7fd4', 0.5),
    icon: { shape: TOKEN_ICON_PATHS.crystal },
    label: 'Crystal',
    effect: 'Draw 3, keep 1, place it without firing up',
  },
  meat: {
    color: '#c8352b',
    dark: shade('#c8352b', 0.5),
    icon: { shape: TOKEN_ICON_PATHS.meat },
    label: 'Meat',
    effect: 'Move one neighbour anywhere',
  },
  iron: {
    color: '#6a717d',
    dark: shade('#6a717d', 0.5),
    icon: { shape: TOKEN_ICON_PATHS.iron },
    label: 'Iron',
    effect: 'Move up to two neighbours one space each',
  },
  potion: {
    color: '#8446d4',
    dark: shade('#8446d4', 0.5),
    icon: { shape: TOKEN_ICON_PATHS.potion },
    label: 'Potion',
    effect: 'Swap any two tokens',
  },
  plant: {
    color: '#2f8a3a',
    dark: shade('#2f8a3a', 0.5),
    icon: { shape: TOKEN_ICON_PATHS.plant },
    label: 'Plant',
    effect: "Use a neighbour's ability",
  },
}
