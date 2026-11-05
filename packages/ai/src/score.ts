import { DECK, HAND_SIZE, bankedReputation } from '@dcv/engine'
import type { Board, GameState, Seat, ShopCard } from '@dcv/engine'
import { outlookScan, scanBoard, servesScan, type BoardScan, type Outlook } from './patterns.js'

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

export type { Outlook } from './patterns.js'

/** Is the card's pattern on the board right now? */
export function serves(board: Board, card: ShopCard): boolean {
  return servesScan(scanBoard(board), card)
}

/** Whether the board serves this card, is one placement away, or neither. */
export function outlook(board: Board, card: ShopCard): Outlook {
  return outlookScan(scanBoard(board), card)
}

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

function handValue(scan: BoardScan, state: GameState, seat: Seat): number {
  const close = closeWeight(state)
  let ready = 0
  let pending = 0

  for (const card of state.players[seat].hand) {
    const how = outlookScan(scan, card)
    if (how === 'ready') ready += card.reputation
    else if (how === 'close') pending += card.reputation
  }

  return ready * READY + pending * close
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
function threatValue(scan: BoardScan, state: GameState, seat: Seat): number {
  const other = (1 - seat) as Seat
  const handCount = state.players[other].hand.length
  if (handCount === 0) return 0

  const seen = new Set(
    [...state.players[seat].hand, ...state.players[seat].scored, ...state.players[other].scored].map(
      (card) => card.id,
    ),
  )

  let served = 0
  let unseen = 0
  for (const card of DECK) {
    if (seen.has(card.id)) continue
    unseen += 1
    if (servesScan(scan, card)) served += card.reputation
  }
  if (unseen === 0) return 0

  // probability any one unseen card sits in their hand
  return (served * handCount) / unseen
}

/**
 * What `seat` is worth right now, in reputation: banked, plus coins at their
 * true end-game value, plus credit for cards the board is already serving.
 * Reads only fields a `PlayerView` exposes for the seat it is asked about.
 */
export function positionScore(state: GameState, seat: Seat): number {
  const player = state.players[seat]
  return (
    bankedReputation(player) + player.coins + handValue(scanBoard(state.board), state, seat)
  )
}

export function opponentThreat(state: GameState, seat: Seat): number {
  return threatValue(scanBoard(state.board), state, seat)
}

/**
 * The full leaf evaluation: our position, less what the board hands them.
 *
 * Both halves ask questions about the same board, so the board is reduced to
 * integers once and both read that. The threat term costs a sweep of the
 * unseen deck, so the search only pays for it on the lines that survive
 * pruning.
 */
export function leafScore(state: GameState, seat: Seat): number {
  const scan = scanBoard(state.board)
  const player = state.players[seat]
  return (
    bankedReputation(player) +
    player.coins +
    handValue(scan, state, seat) -
    THREAT * threatValue(scan, state, seat)
  )
}
