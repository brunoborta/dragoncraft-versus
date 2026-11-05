import {
  DECK,
  applyAction,
  canScore,
  createGame,
  createInitialState,
  key,
  legalActions,
  single,
  toPlayerView,
} from '@dcv/engine'
import type { GameState, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { isOneAway } from './evaluate.js'
import { easy } from './easy.js'
import { opponentThreat, outlook, positionScore, serves } from './score.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

/** Boards from real play, which is where the awkward cases live. */
function boardsFromPlay(seeds: number): GameState['board'][] {
  const boards: GameState['board'][] = []
  let rng = 31
  for (let seed = 0; seed < seeds; seed++) {
    let state = createGame(seed)
    let steps = 0
    while (state.phase !== 'ended' && steps < 60) {
      boards.push(state.board)
      const chosen = easy.chooseAction(
        toPlayerView(state, state.current),
        legalActions(state),
        rng,
      )
      rng = chosen.rng
      state = applyAction(state, chosen.action)
      steps += 1
    }
  }
  return boards
}

describe('serves and outlook', () => {
  /**
   * The fast path exists only because it is the same answer for a fiftieth of
   * the work. If it ever stops agreeing with the engine, Hard is evaluating a
   * game nobody is playing — so this is checked against every card on a few
   * hundred boards taken from real games, not on a handful of fixtures.
   */
  it('agrees with the engine on every card, on boards taken from real games', () => {
    const boards = boardsFromPlay(4)
    expect(boards.length).toBeGreaterThan(100)

    for (const board of boards) {
      for (const candidate of DECK) {
        const how = outlook(board, candidate)
        expect(serves(board, candidate), `serves disagreed on ${candidate.id}`).toBe(
          canScore(board, candidate),
        )
        expect(how === 'ready', `outlook ready disagreed on ${candidate.id}`).toBe(
          canScore(board, candidate),
        )
        expect(how === 'close', `outlook close disagreed on ${candidate.id}`).toBe(
          isOneAway(board, candidate),
        )
      }
    }
  })

  it('calls a full stack unreachable rather than close', () => {
    // two thirds of the line are there, but the third space is capped at 3
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
      [key({ q: 0, r: 0 })]: [single('iron'), single('iron'), single('iron')],
    }
    expect(outlook(board, card('line-bread'))).toBe('far')
  })
})

describe('positionScore', () => {
  const base = createInitialState(2)
  const staged = (over: Partial<GameState['players'][0]>, over2: Partial<GameState> = {}): GameState => ({
    ...base,
    players: [{ ...base.players[0], ...over }, base.players[1]],
    ...over2,
  })

  /**
   * The whole reason this file sits next to `evaluate.ts`: the rules pay one
   * reputation per unspent coin, so a coin has to be worth about what a point
   * of reputation is worth, not a tenth of it.
   */
  it('prices a coin like a point of banked reputation', () => {
    const withCoin = staged({ hand: [], scored: [], coins: 1 })
    const withPoint = staged({ hand: [], scored: [card('line-bread-bread-crystal')], coins: 0 })
    // a 2-reputation card against 1 coin: the card is ahead, but only by about 1
    expect(positionScore(withPoint, 0) - positionScore(withCoin, 0)).toBeCloseTo(1, 5)
  })

  it('stops paying for cards that are close once the game is ending', () => {
    const board = {
      [key({ q: -2, r: 0 })]: [single('bread')],
      [key({ q: -1, r: 0 })]: [single('bread')],
    }
    const hand = [card('line-bread')]
    const midGame = staged({ hand, scored: [], coins: 0 }, { board, endTriggered: false })
    const ending = staged({ hand, scored: [], coins: 0 }, { board, endTriggered: true })
    expect(positionScore(midGame, 0)).toBeGreaterThan(positionScore(ending, 0))
    expect(positionScore(ending, 0)).toBe(0)
  })
})

describe('opponentThreat', () => {
  it('rises when the board starts serving patterns the unseen deck wants', () => {
    const base = createInitialState(2)
    // Our own hand has to stay clear of bread: a card we are holding is a card
    // they cannot be holding, so it leaves the pool the estimate is built from.
    const mine: GameState = {
      ...base,
      players: [{ ...base.players[0], hand: [card('tri-iron'), card('tri-meat')], scored: [] }, base.players[1]],
    }
    const bare: GameState = { ...mine, board: {} }
    const generous: GameState = {
      ...mine,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
      },
    }
    expect(opponentThreat(bare, 0)).toBe(0)
    expect(opponentThreat(generous, 0)).toBeGreaterThan(0)
  })

  it('is nothing when the opponent is holding nothing', () => {
    const base = createInitialState(2)
    const empty: GameState = { ...base, players: [base.players[0], { ...base.players[1], hand: [] }] }
    expect(opponentThreat(empty, 0)).toBe(0)
  })

  /**
   * The estimate is built from the unseen pool and the opponent's hand *size*.
   * If it ever starts reading the hand itself, Hard is cheating.
   */
  it('does not depend on what the opponent is actually holding', () => {
    const base = createInitialState(2)
    const one: GameState = {
      ...base,
      players: [base.players[0], { ...base.players[1], hand: [card('tri-iron'), card('tri-meat')] }],
    }
    const other: GameState = {
      ...base,
      players: [base.players[0], { ...base.players[1], hand: [card('line-plant'), card('tri-crystal')] }],
    }
    expect(opponentThreat(one, 0)).toBe(opponentThreat(other, 0))
  })
})
