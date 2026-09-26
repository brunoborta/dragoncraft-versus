import type { DragonType } from '@dcv/engine'

export type DragonTheme = { color: string; symbol: string; label: string; effect: string }

/**
 * Deliberately provisional: colour plus a distinct shape, nothing more.
 * Shape carries the identity on its own so the board stays readable without
 * colour, which is the accessibility requirement and also what survives at
 * 40 pixels on a phone.
 *
 * `effect` is one line saying what firing this dragon up does. Where you put a
 * token depends on what you are about to fire up, so the player needs it at the
 * moment of deciding, not in a rulebook.
 */
export const DRAGON_THEME: Record<DragonType, DragonTheme> = {
  bread: {
    color: '#c8862f',
    symbol: '▲',
    label: 'Bread',
    effect: 'Draw another dragon and place it',
  },
  crystal: {
    color: '#3f8fd0',
    symbol: '◆',
    label: 'Crystal',
    effect: 'Draw 3, keep 1, place it without firing up',
  },
  meat: {
    color: '#c0503f',
    symbol: '●',
    label: 'Meat',
    effect: 'Move one neighbour anywhere',
  },
  iron: {
    color: '#6b7280',
    symbol: '■',
    label: 'Iron',
    effect: 'Move up to two neighbours one space each',
  },
  potion: {
    color: '#8a5cd0',
    symbol: '▼',
    label: 'Potion',
    effect: 'Swap any two dragons',
  },
  plant: {
    color: '#4a9a5c',
    symbol: '✦',
    label: 'Plant',
    effect: "Use a neighbour's ability",
  },
}
