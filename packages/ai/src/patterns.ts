import { BOARD, DRAGON_TYPES, MAX_STACK, add, key, onBoard, rotations } from '@dcv/engine'
import type { Board, DragonType, ShopCard, Token } from '@dcv/engine'

/**
 * Pattern matching for the search, rebuilt around integers.
 *
 * The engine answers "does this board serve this card" by walking the card's
 * six orientations over nineteen anchors and, for each of the three cells,
 * adding two hexes into a fresh object, formatting a `"q,r"` string and
 * looking it up in a record. That is three allocations and a hash per cell
 * check, and Hard needs something like thirteen thousand of them to estimate
 * what one board offers the opponent — about half a millisecond, which it then
 * pays dozens of times per move.
 *
 * Nothing about that work depends on the position. Which spaces a card can
 * occupy, and which token each of those spaces then needs, is fixed the
 * moment the deck is defined. So it is all computed once, into flat arrays of
 * board indices, and a position becomes nineteen small integers. The check
 * that cost an allocation and a hash becomes an array read and a bitwise and.
 *
 * The engine keeps its own readable version; `score.test.ts` holds the two to
 * the same answers.
 */

/** Board index of each space, 0..18. */
const INDEX_OF = new Map<string, number>()
BOARD.forEach((hex, i) => INDEX_OF.set(key(hex), i))

const TYPE_BIT = new Map<DragonType, number>()
DRAGON_TYPES.forEach((type, i) => TYPE_BIT.set(type, 1 << i))

function maskOf(token: Token): number {
  if (token.kind === 'single') return TYPE_BIT.get(token.type) ?? 0
  return (TYPE_BIT.get(token.types[0]) ?? 0) | (TYPE_BIT.get(token.types[1]) ?? 0)
}

/**
 * Every way a card fits on the board, as `[space, needed types]` triples laid
 * end to end — six numbers per placement. Orientations that hang off the edge
 * are dropped here rather than rediscovered on every check.
 */
const PLACEMENTS = new Map<string, Int32Array>()

function placementsOf(card: ShopCard): Int32Array {
  const cached = PLACEMENTS.get(card.id)
  if (cached) return cached

  const flat: number[] = []
  for (const pattern of rotations(card.pattern)) {
    for (const anchor of BOARD) {
      const triple: number[] = []
      for (const cell of pattern) {
        const hex = add(anchor, cell.offset)
        if (!onBoard(hex)) break
        const index = INDEX_OF.get(key(hex))
        if (index === undefined) break
        triple.push(index, TYPE_BIT.get(cell.type) ?? 0)
      }
      if (triple.length === pattern.length * 2) flat.push(...triple)
    }
  }

  const packed = Int32Array.from(flat)
  PLACEMENTS.set(card.id, packed)
  return packed
}

/**
 * A position reduced to what pattern matching needs: what each space's top
 * token matches, and whether each space can still take another token.
 */
export type BoardScan = {
  tops: Int32Array
  open: Uint8Array
}

export function scanBoard(board: Board): BoardScan {
  const tops = new Int32Array(BOARD.length)
  const open = new Uint8Array(BOARD.length).fill(1)

  for (const spaceKey of Object.keys(board)) {
    const index = INDEX_OF.get(spaceKey)
    if (index === undefined) continue
    const stack = board[spaceKey]
    if (stack.length === 0) continue
    tops[index] = maskOf(stack[stack.length - 1])
    if (stack.length >= MAX_STACK) open[index] = 0
  }

  return { tops, open }
}

/** Is the card's pattern on the board right now? */
export function servesScan(scan: BoardScan, card: ShopCard): boolean {
  const places = placementsOf(card)
  const { tops } = scan
  for (let i = 0; i < places.length; i += 6) {
    if (
      (tops[places[i]] & places[i + 1]) !== 0 &&
      (tops[places[i + 2]] & places[i + 3]) !== 0 &&
      (tops[places[i + 4]] & places[i + 5]) !== 0
    ) {
      return true
    }
  }
  return false
}

export type Outlook = 'ready' | 'close' | 'far'

/**
 * Whether the board serves this card, is one placement from serving it, or
 * neither. `close` means a single cell is unmatched and its space can still
 * take a token — it does not ask whether the bag can still supply one, which
 * is the engine's reading too.
 */
export function outlookScan(scan: BoardScan, card: ShopCard): Outlook {
  const places = placementsOf(card)
  const { tops, open } = scan
  let close = false

  for (let i = 0; i < places.length; i += 6) {
    let missing = 0
    let gap = -1

    if ((tops[places[i]] & places[i + 1]) === 0) {
      missing += 1
      gap = places[i]
    }
    if ((tops[places[i + 2]] & places[i + 3]) === 0) {
      missing += 1
      gap = places[i + 2]
    }
    if ((tops[places[i + 4]] & places[i + 5]) === 0) {
      missing += 1
      gap = places[i + 4]
    }

    if (missing === 0) return 'ready'
    if (missing === 1 && open[gap] === 1) close = true
  }

  return close ? 'close' : 'far'
}
