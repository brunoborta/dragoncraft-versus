import { key } from './hex.js'
import { DRAGON_TYPES, type DragonType, type Hex, type PatternCell, type ShopCard } from './types.js'

/** Three spaces in a straight line. */
export const LINE_OFFSETS: readonly Hex[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 2, r: 0 },
]

/** Three mutually adjacent spaces. */
export const TRIANGLE_OFFSETS: readonly Hex[] = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
]

function cells(offsets: readonly Hex[], types: readonly DragonType[]): PatternCell[] {
  return offsets.map((offset, i) => ({ offset, type: types[i] }))
}

/** Canonical signature of a pattern, for comparison and duplicate detection. */
export function patternKey(pattern: readonly PatternCell[]): string {
  return [...pattern]
    .map((p) => `${key(p.offset)}:${p.type}`)
    .sort()
    .join('|')
}

function buildDeck(): ShopCard[] {
  const deck: ShopCard[] = []

  for (const type of DRAGON_TYPES) {
    deck.push({
      id: `line-${type}`,
      reputation: 3,
      pattern: cells(LINE_OFFSETS, [type, type, type]),
    })
    deck.push({
      id: `tri-${type}`,
      reputation: 3,
      pattern: cells(TRIANGLE_OFFSETS, [type, type, type]),
    })
  }

  // 2 alike plus 1 different, in a line, with the odd one at an end.
  // `pair` and `odd` distinct: 6 x 5 = 30 cards.
  for (const pair of DRAGON_TYPES) {
    for (const odd of DRAGON_TYPES) {
      if (pair === odd) continue
      deck.push({
        id: `line-${pair}-${pair}-${odd}`,
        reputation: 2,
        pattern: cells(LINE_OFFSETS, [pair, pair, odd]),
      })
    }
  }

  return deck
}

/** The 42 shop cards, summing to 96 reputation. */
export const DECK: readonly ShopCard[] = buildDeck()
