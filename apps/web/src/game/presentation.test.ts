import { createStrategy } from '@dcv/ai'
import { DECK, applyAction, createGame, key, legalActions, seedFrom, single, toPlayerView } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_MEMORY,
  FLIGHT,
  HOLD,
  THEIRS,
  eventDuration,
  heldFromView,
  idsOf,
  markCrystalDraws,
  memoryFromView,
  newEntries,
  presentBoard,
  sameBoard,
  script,
  toBoard,
} from './presentation.js'

function counter() {
  let n = 0
  return () => `t${++n}`
}

const at = (q: number, r: number) => ({ q, r })
const entry = (action: LogEntry['action'], seat: 0 | 1 = 0): LogEntry => ({ seat, action })

describe('newEntries', () => {
  const a = entry({ type: 'endTurn' })
  const b = entry({ type: 'spendCoin' }, 1)

  it('returns what the next log adds', () => {
    expect(newEntries([a], [a, b])).toEqual([b])
    expect(newEntries([], [a])).toEqual([a])
  })

  it('refuses a log that is not a continuation: an undo, a reconnection, a new game', () => {
    expect(newEntries([a, b], [a])).toBeNull()
    expect(newEntries([a], [b, a])).toBeNull()
  })
})

describe('script', () => {
  it('places the drawn token, giving it an identity', () => {
    const { events, board } = script(
      {},
      [entry({ type: 'draw', token: single('meat') }), entry({ type: 'place', at: at(0, 0) })],
      EMPTY_MEMORY,
      counter(),
    )
    expect(events.map((e) => e.kind)).toEqual(['draw', 'place'])
    expect(toBoard(board)).toEqual({ [key(at(0, 0))]: [single('meat')] })
    expect(idsOf(board)[key(at(0, 0))]).toEqual(['t1'])
  })

  it('carries a token identity along a move, so it can be shown travelling', () => {
    const start = presentBoard({ [key(at(0, 0))]: [single('iron')] }, counter())
    const { events, board } = script(start, [entry({ type: 'meatMove', from: at(0, 0), to: at(1, 0) })], EMPTY_MEMORY, counter())
    expect(events[0]).toMatchObject({ kind: 'move', id: 't1', by: 'meat' })
    expect(idsOf(board)).toEqual({ [key(at(1, 0))]: ['t1'] })
  })

  it('swaps the tops and their identities, leaving what is under them', () => {
    const ids = counter()
    const start = presentBoard({ '0,0': [single('bread'), single('plant')], '1,0': [single('potion')] }, ids)
    const { board } = script(start, [entry({ type: 'potionSwap', a: at(0, 0), b: at(1, 0) })], EMPTY_MEMORY, ids)
    expect(toBoard(board)).toEqual({ '0,0': [single('bread'), single('potion')], '1,0': [single('plant')] })
    expect(idsOf(board)).toEqual({ '0,0': ['t1', 't3'], '1,0': ['t2'] })
  })

  it('places the token the crystal kept, not the last one it drew', () => {
    const { board } = script(
      {},
      [
        entry({ type: 'fireUp', ability: 'crystal' }),
        entry({ type: 'draw', token: single('bread') }),
        entry({ type: 'draw', token: single('iron') }),
        entry({ type: 'draw', token: single('plant') }),
        entry({ type: 'crystalPick', index: 1 }),
        entry({ type: 'place', at: at(0, 0) }),
      ],
      EMPTY_MEMORY,
      counter(),
    )
    expect(toBoard(board)).toEqual({ '0,0': [single('iron')] })
  })

  it('picks from draws a plant caused, though the plant is logged after them', () => {
    const { board } = script(
      {},
      [
        entry({ type: 'draw', token: single('bread') }),
        entry({ type: 'draw', token: single('meat') }),
        entry({ type: 'plantTarget', at: at(1, 0), ability: 'crystal' }),
        entry({ type: 'crystalPick', index: 0 }),
        entry({ type: 'place', at: at(0, 0) }),
      ],
      EMPTY_MEMORY,
      counter(),
    )
    expect(toBoard(board)).toEqual({ '0,0': [single('bread')] })
  })

  it('refuses an entry that does not fit the board, so the caller snaps instead', () => {
    expect(() => script({}, [entry({ type: 'meatMove', from: at(0, 0), to: at(1, 0) })], EMPTY_MEMORY, counter())).toThrow()
  })

  it('remembers the token in hand across calls: a draw and its placement can arrive in two views', () => {
    const ids = counter()
    const first = script({}, [entry({ type: 'draw', token: single('plant') })], EMPTY_MEMORY, ids)
    const second = script(first.board, [entry({ type: 'place', at: at(0, 0) })], first.memory, ids)
    expect(toBoard(second.board)).toEqual({ '0,0': [single('plant')] })
  })
})

describe('the script against the engine', () => {
  /**
   * The property that matters: walking the log one view at a time, exactly as
   * the screen receives it, always lands on the engine's own board. Whole games,
   * several seeds, both seats' views.
   */
  it('reproduces the engine board after every single action of whole games', () => {
    for (const [seed, seat] of Array.from({ length: 12 }, (_, i) => [i + 1, (i % 2) as 0 | 1] as const)) {
      const strategy = createStrategy('easy')
      let state = createGame(seed)
      let rng = seedFrom(`presentation-${seed}`)
      const ids = counter()
      let log = toPlayerView(state, seat).log
      let board = presentBoard(state.board, ids)
      // the opening draw is in the log before the screen ever sees it
      let memory = memoryFromView(toPlayerView(state, seat))

      for (let step = 0; state.phase !== 'ended' && step < 3000; step += 1) {
        const actions = legalActions(state)
        if (actions.length === 0) break
        const chosen = strategy.chooseAction(toPlayerView(state, state.current), actions, rng)
        rng = chosen.rng
        state = applyAction(state, chosen.action)

        const view = toPlayerView(state, seat)
        const added = newEntries(log, view.log)
        expect(added, `seed ${seed} step ${step}: the log should only grow`).not.toBeNull()
        const played = script(board, added ?? [], memory, ids)
        board = played.board
        memory = played.memory
        log = view.log
        expect(sameBoard(toBoard(board), view.board), `seed ${seed} step ${step}`).toBe(true)
      }
      expect(state.phase).toBe('ended')
    }
  }, 30_000)
})

describe('memoryFromView', () => {
  it('knows the token in hand from the open placement', () => {
    expect(memoryFromView({ pending: [{ kind: 'place', token: single('bread'), fireUpAllowed: true }] }).held).toEqual(single('bread'))
  })

  it('knows what the crystal drew from its open pick', () => {
    const tokens = [single('bread'), single('iron')]
    expect(memoryFromView({ pending: [{ kind: 'crystalPick', tokens }] }).draws).toEqual(tokens)
  })
})

describe('eventDuration', () => {
  it('gives the bag its moment on a draw, shorter for the opponent, none for a crystal draw', () => {
    const mine = eventDuration({ kind: 'draw', seat: 0, crystal: false }, 0, false)
    const theirs = eventDuration({ kind: 'draw', seat: 1, crystal: false }, 0, false)
    expect(mine).toBeGreaterThan(theirs)
    expect(theirs).toBeGreaterThan(0)
    expect(eventDuration({ kind: 'draw', seat: 0, crystal: true }, 0, false)).toBe(0)
  })

  it('gives time to what moves on the board, less under reduced motion', () => {
    for (const kind of ['place', 'move', 'swap'] as const) {
      expect(eventDuration({ kind }, 0, false)).toBeGreaterThan(eventDuration({ kind }, 0, true))
      expect(eventDuration({ kind }, 0, true)).toBeGreaterThan(0)
    }
  })

  it('gives a fire-up its flame only where it knows the token, and a vine more time', () => {
    expect(eventDuration({ kind: 'fireUp', at: null }, 0, false)).toBe(0)
    const flame = eventDuration({ kind: 'fireUp', at: at(0, 0) }, 0, false)
    const vine = eventDuration({ kind: 'fireUp', at: at(0, 0), from: at(1, 0) }, 0, false)
    expect(vine).toBeGreaterThan(flame)
  })

  it('gives scoring and the coin their moments, and nothing to the end of a turn', () => {
    expect(eventDuration({ kind: 'score', seat: 0 }, 0, false)).toBe(HOLD.score)
    expect(eventDuration({ kind: 'coin', seat: 0 }, 0, false)).toBe(HOLD.coin)
    for (const kind of ['endTurn', 'other'] as const) expect(eventDuration({ kind }, 0, false)).toBe(0)
  })

  it("plays the opponent's moments a little quicker (M13)", () => {
    for (const kind of ['move', 'swap', 'score', 'coin'] as const) {
      expect(eventDuration({ kind, seat: 1 }, 0, false)).toBeLessThan(eventDuration({ kind, seat: 0 }, 0, false))
    }
  })

  it("gives the opponent's placement its flight from their slot on top of the drop", () => {
    const yours = eventDuration({ kind: 'place', seat: 0 }, 0, false)
    const theirs = eventDuration({ kind: 'place', seat: 1 }, 0, false)
    expect(theirs).toBe(FLIGHT + Math.round(HOLD.place * THEIRS))
    expect(theirs).toBeGreaterThan(yours)
    expect(eventDuration({ kind: 'place', seat: 1 }, 0, true)).toBe(HOLD.reduced)
  })
})

describe('what the script tells the choreography', () => {
  it('finds the card scored and the three spaces it matched', () => {
    const card = DECK.find((c) => c.id === 'line-bread')!
    const start = presentBoard({ '0,0': [single('bread')], '1,0': [single('bread')], '2,0': [single('bread')] }, counter())
    // a line of three breads: whichever way the card's line runs, these three spaces are it
    const { events } = script(start, [entry({ type: 'scoreCard', cardId: card.id })], EMPTY_MEMORY, counter())
    const event = events[0]
    if (event.kind !== 'score') throw new Error('expected a score')
    expect(event.card?.id).toBe('line-bread')
    expect(event.hexes.map(key).sort()).toEqual(['0,0', '1,0', '2,0'])
  })

  it('numbers each event by its place in the log, so a moment keeps its identity while more arrive', () => {
    const { events } = script({}, [entry({ type: 'draw', token: single('meat') }), entry({ type: 'place', at: at(0, 0) })], EMPTY_MEMORY, counter(), 7)
    expect(events.map((e) => e.seq)).toEqual([7, 8])
  })

  it('says which token a fire-up refers to: the one just placed', () => {
    const { events } = script(
      {},
      [entry({ type: 'draw', token: single('meat') }), entry({ type: 'place', at: at(1, 0) }), entry({ type: 'fireUp', ability: 'meat' })],
      EMPTY_MEMORY,
      counter(),
    )
    expect(events[2]).toMatchObject({ kind: 'fireUp', ability: 'meat', at: at(1, 0) })
  })

  it('knows the placed token from the view, when the script starts at the fire-up decision', () => {
    const memory = memoryFromView({ pending: [{ kind: 'mayFireUp', at: at(2, -1) }] })
    const { events } = script({}, [entry({ type: 'fireUp', ability: 'iron' })], memory, counter())
    expect(events[0]).toMatchObject({ kind: 'fireUp', at: at(2, -1) })
  })

  it('grows a vine from the plant to the neighbour it borrows from, and on along a chain', () => {
    const { events } = script(
      {},
      [
        entry({ type: 'draw', token: single('plant') }),
        entry({ type: 'place', at: at(0, 0) }),
        entry({ type: 'fireUp', ability: 'plant' }),
        entry({ type: 'plantTarget', at: at(1, 0), ability: 'plant' }),
        entry({ type: 'plantTarget', at: at(1, -1), ability: 'meat' }),
      ],
      EMPTY_MEMORY,
      counter(),
    )
    expect(events[3]).toMatchObject({ kind: 'fireUp', ability: 'plant', at: at(1, 0), from: at(0, 0) })
    expect(events[4]).toMatchObject({ kind: 'fireUp', ability: 'meat', at: at(1, -1), from: at(1, 0) })
  })

  it("marks a crystal's draws as the Discover's, not the bag's", () => {
    const { events } = script(
      {},
      [
        entry({ type: 'fireUp', ability: 'crystal' }),
        entry({ type: 'draw', token: single('bread') }),
        entry({ type: 'draw', token: single('iron') }),
        entry({ type: 'crystalPick', index: 0 }),
      ],
      EMPTY_MEMORY,
      counter(),
    )
    expect(events.filter((e) => e.kind === 'draw').map((e) => e.kind === 'draw' && e.crystal)).toEqual([true, true])
  })

  it('marks them too when the crystal came through a plant, which is logged after its draws', () => {
    const { events } = script(
      {},
      [
        entry({ type: 'draw', token: single('bread') }),
        entry({ type: 'draw', token: single('iron') }),
        entry({ type: 'plantTarget', at: at(1, 0), ability: 'crystal' }),
      ],
      EMPTY_MEMORY,
      counter(),
    )
    expect(events.filter((e) => e.kind === 'draw').every((e) => e.kind === 'draw' && e.crystal)).toBe(true)
  })

  it('leaves an ordinary draw to the bag', () => {
    const { events } = script({}, [entry({ type: 'draw', token: single('bread') })], EMPTY_MEMORY, counter())
    expect(events[0]).toMatchObject({ kind: 'draw', crystal: false })
  })

  it('can mark the last draws afterwards, for a pick that is still open', () => {
    const { events } = script(
      {},
      [entry({ type: 'draw', token: single('bread') }), entry({ type: 'draw', token: single('iron') }), entry({ type: 'draw', token: single('meat') })],
      EMPTY_MEMORY,
      counter(),
    )
    markCrystalDraws(events, 2)
    expect(events.map((e) => e.kind === 'draw' && e.crystal)).toEqual([false, true, true])
  })
})

describe('the token in hand', () => {
  it('is what the open placement names, and whose turn it is', () => {
    const view = toPlayerView(createGame(3), 0)
    const top = view.pending[view.pending.length - 1]
    expect(top?.kind).toBe('place')
    expect(heldFromView(view)).toEqual({ seat: view.current, token: top?.kind === 'place' ? top.token : null })
    expect(heldFromView({ ...view, pending: [] })).toBeNull()
  })

  it('is carried by every event: drawn into the hand, out of it on the placement', () => {
    const entries: LogEntry[] = [
      { seat: 1, action: { type: 'draw', token: single('meat') } },
      { seat: 1, action: { type: 'place', at: { q: 0, r: 0 } } },
      { seat: 1, action: { type: 'endTurn' } },
    ]
    let n = 0
    const { events } = script({}, entries, { held: null, draws: [], placedAt: null, plantAt: null }, () => `t${++n}`)
    expect(events.map((event) => event.held)).toEqual([single('meat'), null, null])
  })
})
