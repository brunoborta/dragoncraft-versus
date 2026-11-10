import type { DragonType } from '@dcv/engine'

/**
 * An illustrated icon, drawn white on the token in a [-1, 1] box. `shape` is
 * the filled silhouette and carries the identity on its own; `detail` is a few
 * strokes in the token's dark shade (facets, crust scores, a leaf's midrib)
 * that make it read as a thing rather than a stamp.
 */
export type DragonIcon = { shape: string; detail: string }

export type DragonTheme = {
  /** The face of the token. White on it clears 3:1 (`contrast.test.ts`). */
  color: string
  /** The token's edge and the strokes inside its icon. */
  dark: string
  icon: DragonIcon
  label: string
  effect: string
}

/** A circle as path data, so a silhouette can be one `<path>`. */
function circle(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
}

/** Corners of a gem shard: a prism pointed at both ends, rotated about its centre. */
function shardCorners(cx: number, cy: number, halfWidth: number, halfHeight: number, degrees: number) {
  const tip = halfHeight * 0.45
  const local: [number, number][] = [
    [0, -halfHeight],
    [halfWidth, -halfHeight + tip],
    [halfWidth, halfHeight - tip * 0.5],
    [0, halfHeight],
    [-halfWidth, halfHeight - tip * 0.5],
    [-halfWidth, -halfHeight + tip],
  ]
  const a = (degrees * Math.PI) / 180
  return local.map(([x, y]) => [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)])
}

const fmt = ([x, y]: number[]) => `${x.toFixed(3)} ${y.toFixed(3)}`

function shard(cx: number, cy: number, halfWidth: number, halfHeight: number, degrees: number): string {
  return `M ${shardCorners(cx, cy, halfWidth, halfHeight, degrees).map(fmt).join(' L ')} Z`
}

/** The ridge down the middle of a shard and the line across its shoulders. */
function facets(cx: number, cy: number, halfWidth: number, halfHeight: number, degrees: number): string {
  const [top, right, , bottom, , left] = shardCorners(cx, cy, halfWidth, halfHeight, degrees)
  return `M ${fmt(top)} L ${fmt(bottom)} M ${fmt(left)} L ${fmt(top)} L ${fmt(right)}`
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
 * `effect` is one line saying what firing this dragon up does. Where you put a
 * token depends on what you are about to fire up, so the player needs it at the
 * moment of deciding, not in a rulebook.
 */
export const DRAGON_THEME: Record<DragonType, DragonTheme> = {
  bread: {
    color: '#c47010',
    dark: shade('#c47010', 0.45),
    icon: {
      shape:
        'M -0.9 0.3 C -0.9 -0.42 -0.42 -0.66 0 -0.66 C 0.42 -0.66 0.9 -0.42 0.9 0.3 Q 0.9 0.5 0.72 0.5 L -0.72 0.5 Q -0.9 0.5 -0.9 0.3 Z',
      detail: 'M -0.5 -0.02 L -0.28 -0.4 M -0.12 0.06 L 0.12 -0.44 M 0.26 0.06 L 0.48 -0.32',
    },
    label: 'Bread',
    effect: 'Draw another dragon and place it',
  },
  crystal: {
    color: '#2a7fd4',
    dark: shade('#2a7fd4', 0.5),
    icon: {
      shape: [
        shard(0, -0.08, 0.3, 0.86, 0),
        shard(-0.52, 0.22, 0.2, 0.56, -30),
        shard(0.52, 0.22, 0.2, 0.56, 30),
      ].join(' '),
      detail: [
        facets(0, -0.08, 0.3, 0.86, 0),
        facets(-0.52, 0.22, 0.2, 0.56, -30),
        facets(0.52, 0.22, 0.2, 0.56, 30),
      ].join(' '),
    },
    label: 'Crystal',
    effect: 'Draw 3, keep 1, place it without firing up',
  },
  meat: {
    color: '#c8352b',
    dark: shade('#c8352b', 0.5),
    icon: {
      shape: [
        'M 0.12 -0.86 C 0.62 -0.94 1 -0.48 0.9 -0.04 C 0.8 0.4 0.36 0.52 0.06 0.32 L -0.1 0.16 C -0.32 -0.1 -0.36 -0.76 0.12 -0.86 Z',
        'M -0.02 0.1 L 0.14 0.26 L -0.5 0.8 L -0.66 0.64 Z',
        circle(-0.74, 0.58, 0.17),
        circle(-0.56, 0.84, 0.17),
      ].join(' '),
      detail: 'M 0.22 -0.6 Q 0.62 -0.58 0.66 -0.18 M -0.12 0.12 Q 0.04 0.34 0.24 0.36',
    },
    label: 'Meat',
    effect: 'Move one neighbour anywhere',
  },
  iron: {
    color: '#6a717d',
    dark: shade('#6a717d', 0.5),
    icon: {
      shape: 'M -0.92 0.48 L -0.56 -0.4 L 0.56 -0.4 L 0.92 0.48 Z',
      detail: 'M -0.7 -0.06 L 0.7 -0.06 M -0.56 -0.4 L -0.7 -0.06 M 0.56 -0.4 L 0.7 -0.06',
    },
    label: 'Iron',
    effect: 'Move up to two neighbours one space each',
  },
  potion: {
    color: '#8446d4',
    dark: shade('#8446d4', 0.5),
    icon: {
      shape: [
        'M -0.18 -0.56 L -0.18 -0.22 C -0.6 -0.06 -0.76 0.24 -0.66 0.5 C -0.56 0.86 0.56 0.86 0.66 0.5 C 0.76 0.24 0.6 -0.06 0.18 -0.22 L 0.18 -0.56 Z',
        'M -0.27 -0.94 L 0.27 -0.94 L 0.22 -0.62 L -0.22 -0.62 Z',
      ].join(' '),
      detail: 'M -0.62 0.2 Q 0 0.36 0.62 0.2 M -0.26 -0.56 L 0.26 -0.56',
    },
    label: 'Potion',
    effect: 'Swap any two dragons',
  },
  plant: {
    color: '#2f8a3a',
    dark: shade('#2f8a3a', 0.5),
    icon: {
      shape: [
        'M 0.04 0.12 C 0.1 -0.5 0.5 -0.82 0.95 -0.76 C 0.9 -0.24 0.56 0.12 0.04 0.12 Z',
        'M -0.04 0.28 C -0.1 -0.24 -0.46 -0.5 -0.9 -0.44 C -0.86 -0.04 -0.5 0.28 -0.04 0.28 Z',
        'M -0.08 0.04 L 0.08 0.04 L 0.08 0.88 L -0.08 0.88 Z',
      ].join(' '),
      detail: 'M 0.1 0.06 Q 0.46 -0.34 0.8 -0.64 M -0.1 0.22 Q -0.44 -0.04 -0.76 -0.34',
    },
    label: 'Plant',
    effect: "Use a neighbour's ability",
  },
}
