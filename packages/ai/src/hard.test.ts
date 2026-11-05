import {
  DECK,
  applyAction,
  createGame,
  createInitialState,
  key,
  legalActions,
  single,
  toPlayerView,
} from '@dcv/engine'
import type { GameState, Seat, ShopCard } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { hard } from './hard.js'
import { medium } from './medium.js'
import type { Strategy } from './types.js'

const card = (id: string): ShopCard => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

/** Runs one seat's turn to its end, so a whole turn can be asserted on. */
function playTurn(start: GameState, strategy: Strategy, rng: number): GameState {
  const seat = start.current
  let state = start
  let steps = 0
  while (state.phase !== 'ended' && state.current === seat && steps < 40) {
    const chosen = strategy.chooseAction(toPlayerView(state, seat), legalActions(state), rng)
    rng = chosen.rng
    state = applyAction(state, chosen.action)
    steps += 1
    if (chosen.action.type === 'endTurn') break
  }
  return state
}

describe('hard', () => {
  it('always picks one of the offered actions', () => {
    let rng = 23
    for (let seed = 0; seed < 8; seed++) {
      const state = createGame(seed)
      const actions = legalActions(state)
      const chosen = hard.chooseAction(toPlayerView(state, state.current), actions, rng)
      rng = chosen.rng
      expect(actions).toContainEqual(chosen.action)
    }
  })

  it('is deterministic for the same rng state', () => {
    const state = createGame(8)
    const view = toPlayerView(state, state.current)
    const actions = legalActions(state)
    expect(hard.chooseAction(view, actions, 5)).toEqual(hard.chooseAction(view, actions, 5))
  })

  it('never sees the opponent hand: it plays the same whatever that hand is', () => {
    const state = createGame(9)
    const swapped: GameState = {
      ...state,
      players: [state.players[0], { ...state.players[1], hand: [card('tri-iron'), card('tri-meat')] }],
    }
    const seat = state.current
    const a = hard.chooseAction(toPlayerView(state, seat), legalActions(state), 3)
    const b = hard.chooseAction(toPlayerView(swapped, seat), legalActions(swapped), 3)
    if (seat === 0) expect(a.action).toEqual(b.action)
  })

  it('scores a matching card rather than passing', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 0 })]: [single('bread')],
      },
      players: [
        { ...base.players[0], hand: [card('line-bread'), card('tri-plant')], coins: 0 },
        base.players[1],
      ],
      current: 0,
      phase: 'score',
      pending: [],
    }
    const chosen = hard.chooseAction(toPlayerView(staged, 0), legalActions(staged), 1)
    expect(chosen.action).toEqual({ type: 'scoreCard', cardId: 'line-bread' })
  })

  /**
   * The point of the whole turn search, in one position.
   *
   * `line-bread` needs a third bread on (0,0). The token in hand is an iron,
   * which matches nothing — so no placement completes anything, and judged on
   * the position it leaves, every space on the board looks much the same. The
   * card is only reachable through what comes *after* the placement: drop the
   * iron next to the stray bread on (0,1), fire it up, and walk that bread
   * onto (0,0).
   *
   * Medium is asked where to place while the fire-up is still an open
   * question, so it cannot see that line — on one of these seeds it puts the
   * iron down and then walks its own two bread apart. Hard plays the turn out
   * before committing, and banks the card from every seed.
   */
  it('places for the sake of the ability that follows, and banks the card', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
        [key({ q: 0, r: 1 })]: [single('bread')],
      },
      players: [
        { ...base.players[0], hand: [card('line-bread'), card('tri-plant')], coins: 0 },
        base.players[1],
      ],
      current: 0,
      phase: 'play',
      pending: [{ kind: 'place', token: single('iron'), fireUpAllowed: true }],
    }

    for (const rng of [17, 4, 99, 1234]) {
      const byHard = playTurn(staged, hard, rng)
      expect(byHard.players[0].scored.map((c) => c.id), `hard missed it from rng ${rng}`).toContain(
        'line-bread',
      )

      const byMedium = playTurn(staged, medium, rng)
      expect(
        byMedium.players[0].scored.map((c) => c.id),
        `medium found it from rng ${rng}, so this position no longer shows the difference`,
      ).not.toContain('line-bread')
    }
  })

  /**
   * An unspent coin is worth exactly one reputation at the end of the game.
   * Here the game is already ending, so a fresh pair of cards cannot be
   * completed in the time left and is worth nothing at all — the coin is
   * strictly better kept. Medium, which prices a coin at a tenth of a point of
   * reputation and has no notion of the game running out, spends it.
   */
  it('keeps its last coin when the game is ending', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
      },
      players: [
        { ...base.players[0], hand: [card('tri-iron'), card('tri-meat')], coins: 1, scored: [] },
        base.players[1],
      ],
      current: 0,
      phase: 'final-score',
      pending: [],
      endTriggered: true,
    }

    const actions = legalActions(staged)
    expect(actions).toContainEqual({ type: 'spendCoin' })

    const chosen = hard.chooseAction(toPlayerView(staged, 0), actions, 2)
    expect(chosen.action).toEqual({ type: 'endTurn' })
  })

  /**
   * Two placements that do nothing for us, one of which finishes a line most of
   * the unseen deck would love to have. Hard subtracts what the board hands the
   * opponent, so it takes the harmless space.
   */
  it('declines to finish a pattern for the opponent when it gains nothing itself', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
      },
      // nothing in hand cares about bread, so completing the line is pure gift
      players: [
        { ...base.players[0], hand: [card('tri-iron'), card('tri-meat')], coins: 0, scored: [] },
        base.players[1],
      ],
      current: 0,
      phase: 'play',
      pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: false }],
    }

    const chosen = hard.chooseAction(toPlayerView(staged, 0), legalActions(staged), 6)
    expect(chosen.action).not.toEqual({ type: 'place', at: { q: 0, r: 0 } })
  })
})

describe('the ladder', () => {
  it('agrees with medium on the easy calls', () => {
    const base = createInitialState(4)
    const staged: GameState = {
      ...base,
      board: {
        [key({ q: -2, r: 0 })]: [single('bread')],
        [key({ q: -1, r: 0 })]: [single('bread')],
      },
      players: [
        { ...base.players[0], hand: [card('line-bread'), card('tri-plant')], coins: 0 },
        base.players[1],
      ],
      current: 0,
      phase: 'play',
      pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: true }],
    }
    const view = toPlayerView(staged, 0 as Seat)
    const actions = legalActions(staged)
    // the bread that completes the line goes on (0,0) for both of them
    expect(medium.chooseAction(view, actions, 1).action).toEqual({ type: 'place', at: { q: 0, r: 0 } })
    expect(hard.chooseAction(view, actions, 1).action).toEqual({ type: 'place', at: { q: 0, r: 0 } })
  })
})
