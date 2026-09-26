export const DRAGON_TYPES = ['bread', 'crystal', 'meat', 'iron', 'potion', 'plant'] as const

export type DragonType = (typeof DRAGON_TYPES)[number]

export type Token =
  | { kind: 'single'; type: DragonType }
  | { kind: 'dual'; types: [DragonType, DragonType] }

/** Axial coordinate. The board is the set where max(|q|,|r|,|q+r|) <= 2. */
export type Hex = { q: number; r: number }

/** `${q},${r}` — canonical key for a space. */
export type HexKey = string

/** Stack from bottom to top, at most 3 tokens. Empty spaces are absent from the map. */
export type Board = Record<HexKey, Token[]>

export type PatternCell = { offset: Hex; type: DragonType }

export type ShopCard = {
  id: string
  reputation: number
  pattern: PatternCell[]
}

export type Seat = 0 | 1

export type RngState = number

export type PlayerState = {
  hand: ShopCard[]
  scored: ShopCard[]
  coins: number
  coinSpentThisTurn: boolean
}

export type Phase = 'play' | 'score' | 'final-score' | 'ended'

/**
 * Stack of open decisions. The last element is the top, and it is the only
 * one `legalActions` ever reads.
 */
export type Pending =
  | { kind: 'place'; token: Token; fireUpAllowed: boolean }
  | { kind: 'mayFireUp'; at: Hex }
  | { kind: 'crystalPick'; tokens: Token[] }
  | { kind: 'meat'; at: Hex }
  /**
   * `movedTo` is the trail of the tokens this iron has already shifted: the
   * rule asks for 2 *distinct* tokens, and a moved token often lands on
   * another space adjacent to the iron.
   */
  | { kind: 'iron'; at: Hex; movesLeft: number; movedTo: Hex[] }
  | { kind: 'potion' }
  | { kind: 'plant'; at: Hex }
  | { kind: 'coinDiscard' }

export type Action =
  | { type: 'place'; at: Hex }
  | { type: 'fireUp'; ability: DragonType }
  | { type: 'skipFireUp' }
  | { type: 'crystalPick'; index: number }
  | { type: 'meatMove'; from: Hex; to: Hex }
  | { type: 'ironMove'; from: Hex; to: Hex }
  | { type: 'ironDone' }
  | { type: 'potionSwap'; a: Hex; b: Hex }
  | { type: 'plantTarget'; at: Hex; ability: DragonType }
  | { type: 'spendCoin' }
  | { type: 'coinDiscard'; cardIds: [string, string] }
  | { type: 'scoreCard'; cardId: string }
  | { type: 'endTurn' }

export type LogEntry = {
  seat: Seat
  action: Action | { type: 'draw'; token: Token } | { type: 'gameOver' }
}

export type GameState = {
  rng: RngState
  board: Board
  bag: Token[]
  extras: Token[]
  extrasAdded: boolean
  deck: ShopCard[]
  players: [PlayerState, PlayerState]
  current: Seat
  phase: Phase
  pending: Pending[]
  endTriggered: boolean
  log: LogEntry[]
}

export type PlayerView = {
  seat: Seat
  board: Board
  /** Bag composition, canonically ordered: derivable from the board, therefore public. */
  bag: Token[]
  extrasAdded: boolean
  deckCount: number
  you: PlayerState
  opponent: {
    handCount: number
    scored: ShopCard[]
    coins: number
    coinSpentThisTurn: boolean
  }
  current: Seat
  phase: Phase
  pending: Pending[]
  endTriggered: boolean
  log: LogEntry[]
}
