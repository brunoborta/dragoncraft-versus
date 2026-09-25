import type { DragonType } from '@dcv/engine'

export type DragonTheme = { color: string; symbol: string; label: string }

/**
 * Deliberately provisional: colour plus a distinct shape, nothing more.
 * Shape carries the identity on its own so the board stays readable without
 * colour, which is the accessibility requirement and also what survives at
 * 40 pixels on a phone.
 */
export const DRAGON_THEME: Record<DragonType, DragonTheme> = {
  bread: { color: '#c8862f', symbol: '▲', label: 'Bread' },
  crystal: { color: '#3f8fd0', symbol: '◆', label: 'Crystal' },
  meat: { color: '#c0503f', symbol: '●', label: 'Meat' },
  iron: { color: '#6b7280', symbol: '■', label: 'Iron' },
  potion: { color: '#8a5cd0', symbol: '▼', label: 'Potion' },
  plant: { color: '#4a9a5c', symbol: '✦', label: 'Plant' },
}
