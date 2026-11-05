import {
  BOARD,
  DECK,
  HAND_SIZE,
  add,
  bankedReputation,
  canReceive,
  onBoard,
  rotations,
  tokenMatches,
  topOf,
} from '@dcv/engine'
import type { Board, GameState, PatternCell, Seat, ShopCard } from '@dcv/engine'

/**
 * Everything here is denominated in reputation, the unit `finalScore` actually
 * pays out. That is the whole point of this file existing next to
 * `evaluate.ts`: the medium evaluation weights banked reputation at 10 and a
 * coin at 1, but the rules score a coin at exactly 1 reputation, so medium
 * sells its coins for a tenth of what they are worth. Hard prices them right.
 */

/** A card whose pattern is already on the board is nearly banked. */
const READY = 0.8

/** A card one placement away still needs a turn and a cooperative board. */
const CLOSE = 0.35

/**
 * How much of the opponent's expected haul to subtract. Below 1 on purpose:
 * the estimate is over a hand we cannot see, and a machine that treats a
 * guess as a certainty plays scared.
 */
const THREAT = 0.6

/**
 * A card one placement away is worth nothing once there is no turn left to
 * complete it in. Without this the machine spends the last turn of the game
 * arranging a board it will never get to use.
 */
function closeWeight(state: GameState): number {
  if (state.endTriggered || state.phase === 'final-score') return 0
  if (state.deck.length < HAND_SIZE) return CLOSE / 2
  return CLOSE
}

/** The 6 orientations of a card, computed once per card for the whole run. */
const ROTATION_CACHE = new Map<string, PatternCell[][]>()

function rotationsOf(card: ShopCard): PatternCell[][] {
  let cached = ROTATION_CACHE.get(card.id)
  if (!cached) {
    cached = rotations(card.pattern)
    ROTATION_CACHE.set(card.id, cached)
  }
  return cached
}

/**
 * Is the card's pattern on the board right now? Same answer as the engine's
 * `canScore`, over the cached orientations: the threat estimate asks this of
 * every unseen card, so the allocation `rotations` would do each time shows up.
 */
export function serves(board: Board, card: ShopCard): boolean {
  for (const pattern of rotationsOf(card)) {
    for (const anchor of BOARD) {
      let hit = true
      for (const cell of pattern) {
        const hex = add(anchor, cell.offset)
        const top = onBoard(hex) ? topOf(board, hex) : undefined
        if (!top || !tokenMatches(top, cell.type)) {
          hit = false
          break
        }
      }
      if (hit) return true
    }
  }
  return false
}

export type Outlook = 'ready' | 'close' | 'far'

/**
 * Whether the board already serves this card, is one placement from serving
 * it, or neither.
 *
 * `evaluate.ts` answers the same question with `canScore` plus `isOneAway`,
 * and `isOneAway` tries every token type on every free space and rescans the
 * whole board each time — about fifty full pattern scans for one card. This
 * walks the card's orientations once and counts the cells each anchor is
 * missing, which is the same answer for a fiftieth of the work. The search
 * calls it thousands of times per move, so that ratio is the difference
 * between Hard fitting in the think time and not.
 *
 * `close` means one cell is unmatched and its space can still take a token,
 * exactly as before: neither version asks whether the bag can still supply
 * the token it would need.
 */
export function outlook(board: Board, card: ShopCard): Outlook {
  let close = false

  for (const pattern of rotationsOf(card)) {
    for (const anchor of BOARD) {
      let missing = 0
      let reachable = true
      let fits = true

      for (const cell of pattern) {
        const hex = add(anchor, cell.offset)
        if (!onBoard(hex)) {
          fits = false
          break
        }
        const top = topOf(board, hex)
        if (top && tokenMatches(top, cell.type)) continue
        missing += 1
        if (missing > 1) break
        if (!canReceive(board, hex)) reachable = false
      }

      if (!fits) continue
      if (missing === 0) return 'ready'
      if (missing === 1 && reachable) close = true
    }
  }

  return close ? 'close' : 'far'
}

/**
 * What `seat` is worth right now, in reputation: banked, plus coins at their
 * true end-game value, plus credit for cards the board is already serving.
 * Reads only fields a `PlayerView` exposes for the seat it is asked about.
 */
export function positionScore(state: GameState, seat: Seat): number {
  const player = state.players[seat]
  const close = closeWeight(state)

  let ready = 0
  let pending = 0
  for (const card of player.hand) {
    const how = outlook(state.board, card)
    if (how === 'ready') ready += card.reputation
    else if (how === 'close') pending += card.reputation
  }

  return bankedReputation(player) + player.coins + ready * READY + pending * close
}

/**
 * Expected reputation the opponent could bank off this board, averaged over
 * every card we have not seen.
 *
 * Medium estimates the same thing by dealing the opponent a random pair and
 * asking what that pair can do — a sample of two out of forty, which swings
 * wildly between candidate moves. This instead asks what fraction of the
 * unseen pool the board is serving, which is the same question answered with
 * all the information the view legally carries.
 *
 * It never reads the opponent's hand, only its size.
 */
export function opponentThreat(state: GameState, seat: Seat): number {
  const other = (1 - seat) as Seat
  const handCount = state.players[other].hand.length
  if (handCount === 0) return 0

  const seen = new Set(
    [...state.players[seat].hand, ...state.players[seat].scored, ...state.players[other].scored].map(
      (card) => card.id,
    ),
  )
  const pool = DECK.filter((card) => !seen.has(card.id))
  if (pool.length === 0) return 0

  let served = 0
  for (const card of pool) {
    if (serves(state.board, card)) served += card.reputation
  }

  // probability any one unseen card sits in their hand
  return (served * handCount) / pool.length
}

/**
 * The full leaf evaluation: our position, less what the board hands them.
 * Costs a scan of the unseen deck, so the search only pays for it on the
 * handful of lines that survive pruning.
 */
export function leafScore(state: GameState, seat: Seat): number {
  return positionScore(state, seat) - THREAT * opponentThreat(state, seat)
}
