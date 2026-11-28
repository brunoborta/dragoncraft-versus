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
  renameBoard,
  sameBoard,
  script,
  takeBack,
  takenBack,
  toBoard,
  unscript,
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
    const { events, board } = script(
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
    // the pick is its own moment: the kept token to the cushion, the others back to the bag
    expect(events[4]).toMatchObject({
      kind: 'crystalKeep',
      tokens: [single('bread'), single('iron'), single('plant')],
      index: 1,
      held: single('iron'),
    })
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

describe('renameBoard', () => {
  it('keeps the name of every token the takeback left where it was', () => {
    const shown = presentBoard({ '0,0': [single('bread'), single('plant')], '1,0': [single('potion')] }, counter())
    // the plant placed on 0,0 is taken back: 1,0 and the bread under it never moved
    const after = renameBoard(shown, { '0,0': [single('bread')], '1,0': [single('potion')] }, counter())
    expect(idsOf(after)).toEqual({ '0,0': [shown['0,0']![0]!.id], '1,0': [shown['1,0']![0]!.id] })
  })

  it('names anew only the token that changed, and whatever sits on top of it', () => {
    const shown = presentBoard({ '0,0': [single('bread'), single('plant'), single('iron')] }, counter())
    const fresh = counter()
    const after = renameBoard(shown, { '0,0': [single('bread'), single('potion'), single('iron')] }, fresh)
    // the bread below is untouched; the potion is not the plant, so it and the iron above it are new
    expect(idsOf(after)).toEqual({ '0,0': [shown['0,0']![0]!.id, 't1', 't2'] })
  })

  it('gives a token that was not on screen a name of its own', () => {
    const after = renameBoard({}, { '0,0': [single('bread')] }, counter())
    expect(idsOf(after)).toEqual({ '0,0': ['t1'] })
  })

  it('leaves the board the engine speaks untouched', () => {
    const board = { '0,0': [single('bread')], '2,0': [single('iron'), single('meat')] }
    expect(toBoard(renameBoard(presentBoard({ '0,0': [single('bread')] }, counter()), board, counter()))).toEqual(board)
  })
})

describe('takenBack', () => {
  const draw = entry({ type: 'draw', token: single('meat') })
  const place = entry({ type: 'place', at: at(0, 0) })
  const skip = entry({ type: 'skipFireUp' })

  it('is what a takeback cut off the end of the log', () => {
    expect(takenBack([draw, place, skip], [draw])).toEqual([place, skip])
  })

  it('is nothing when the log grew or stayed the same: that is a play, not a takeback', () => {
    expect(takenBack([draw], [draw, place])).toBeNull()
    expect(takenBack([draw, place], [draw, place])).toBeNull()
  })

  it('is nothing when the shorter log is not the same game: a new table, not a takeback', () => {
    expect(takenBack([draw, place], [entry({ type: 'draw', token: single('iron') })])).toBeNull()
  })
})

describe('unscript', () => {
  const seqs = () => {
    let n = 0
    return () => -++n
  }

  it('lifts a placement off its space and gives the token back to the hand, keeping its name', () => {
    const start = presentBoard({ '0,0': [single('bread'), single('meat')] }, counter())
    const { events, board } = unscript(start, [entry({ type: 'place', at: at(0, 0) })], seqs())
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ kind: 'unplace', at: at(0, 0), id: 't2', token: single('meat'), held: single('meat'), undo: true })
    // the bread under it never moved, so it keeps its name
    expect(idsOf(board)).toEqual({ '0,0': ['t1'] })
  })

  it('slides a move back where it came from, the same token travelling', () => {
    const start = presentBoard({ '1,0': [single('iron')] }, counter())
    const { events, board } = unscript(start, [entry({ type: 'ironMove', from: at(0, 0), to: at(1, 0) })], seqs())
    expect(events[0]).toMatchObject({ kind: 'move', from: at(1, 0), to: at(0, 0), id: 't1', by: 'iron' })
    expect(idsOf(board)).toEqual({ '0,0': ['t1'] })
  })

  it('swaps a swap back', () => {
    const start = presentBoard({ '0,0': [single('potion')], '1,0': [single('plant')] }, counter())
    const { events, board } = unscript(start, [entry({ type: 'potionSwap', a: at(0, 0), b: at(1, 0) })], seqs())
    expect(events[0]).toMatchObject({ kind: 'swap', a: at(0, 0), b: at(1, 0), ids: ['t1', 't2'] })
    expect(toBoard(board)).toEqual({ '0,0': [single('plant')], '1,0': [single('potion')] })
  })

  it('runs a whole play backwards, last thing first', () => {
    // placed on 0,0, fired up, the meat moved to 1,0: back, the move goes first, then the placement
    const start = presentBoard({ '1,0': [single('meat')] }, counter())
    const undone = [
      entry({ type: 'place', at: at(0, 0) }),
      entry({ type: 'fireUp', ability: 'meat' }),
      entry({ type: 'meatMove', from: at(0, 0), to: at(1, 0) }),
    ]
    const { events, board } = unscript(start, undone, seqs())
    expect(events.map((event) => event.kind)).toEqual(['move', 'unplace'])
    expect(board).toEqual({})
  })

  it('plays nothing for what leaves the board and the hand alone: the answers, a discard', () => {
    const start = presentBoard({ '0,0': [single('bread')] }, counter())
    const undone = [entry({ type: 'skipFireUp' }), entry({ type: 'ironDone' }), entry({ type: 'coinDiscard', cardIds: ['a', 'b'] })]
    const { events, board } = unscript(start, undone, seqs())
    expect(events).toEqual([])
    expect(board).toBe(start)
  })

  it('gives every event a negative seq of its own: the log positions are about to be reused', () => {
    const start = presentBoard({ '1,0': [single('meat')] }, counter())
    const undone = [entry({ type: 'place', at: at(0, 0) }), entry({ type: 'meatMove', from: at(0, 0), to: at(1, 0) })]
    expect(unscript(start, undone, seqs()).events.map((event) => event.seq)).toEqual([-1, -2])
  })
})

describe('takeBack', () => {
  const seqs = () => {
    let n = 0
    return () => -++n
  }

  it('turns the arrow over the board as it was, then runs the play backwards, then settles the hand', () => {
    const start = presentBoard({ '0,0': [single('meat')], '1,0': [single('bread')] }, counter())
    const { events, board } = takeBack(start, [entry({ type: 'place', at: at(0, 0) })], { board: { '1,0': [single('bread')] }, held: single('meat'), draws: [] }, counter(), seqs())

    expect(events.map((event) => event.kind)).toEqual(['undo', 'unplace', 'other'])
    expect(events.every((event) => event.undo)).toBe(true)
    // the arrow turns over the board before anything goes back
    expect(events[0]).toMatchObject({ kind: 'undo', board: start })
    expect(events[0]!.held).toBeUndefined()
    // and the hand ends as the view has it
    expect(events[2]).toMatchObject({ held: single('meat'), board })
    // the bread was never part of it: it keeps its name the whole way
    expect(idsOf(board)).toEqual({ '1,0': ['t2'] })
  })

  it('slides a move back where it came from, after the arrow', () => {
    const start = presentBoard({ '1,0': [single('meat')] }, counter())
    const { events } = takeBack(start, [entry({ type: 'meatMove', from: at(0, 0), to: at(1, 0) })], { board: { '0,0': [single('meat')] }, held: null, draws: [] }, counter(), seqs())
    expect(events.map((event) => event.kind)).toEqual(['undo', 'move', 'other'])
    expect(events[1]).toMatchObject({ from: at(1, 0), to: at(0, 0) })
  })

  it("runs a crystal's pick backwards: the kept token back to the arch, the others out of the bag", () => {
    const start = presentBoard({ '0,0': [single('bread')] }, counter())
    const draws = [single('iron'), single('plant'), single('potion')]
    const { events, board } = takeBack(
      start,
      [entry({ type: 'crystalPick', index: 1 })],
      { board: { '0,0': [single('bread')] }, held: null, draws },
      counter(),
      seqs(),
    )
    expect(events.map((event) => event.kind)).toEqual(['undo', 'crystalUnkeep', 'other'])
    // the kept token leaves the cushion with the flight back
    expect(events[1]).toMatchObject({ tokens: draws, index: 1, held: null })
    expect(board).toBe(start)
  })

  it('still turns the arrow when a pick cannot be run backwards, the draws it offered being unknown', () => {
    const start = presentBoard({ '0,0': [single('bread')] }, counter())
    const { events } = takeBack(start, [entry({ type: 'crystalPick', index: 1 })], { board: { '0,0': [single('bread')] }, held: null, draws: [] }, counter(), seqs())
    expect(events.map((event) => event.kind)).toEqual(['undo', 'other'])
    expect(events[1]!.held).toBeNull()
  })

  it('still turns the arrow, then simply goes back, when the play cannot be run backwards onto the view', () => {
    const start = presentBoard({ '0,0': [single('meat')], '1,0': [single('bread')] }, counter())
    // the view disagrees with what taking the placement back would leave
    const target = { '1,0': [single('bread')], '2,0': [single('iron')] }
    const { events, board } = takeBack(start, [entry({ type: 'place', at: at(0, 0) })], { board: target, held: null, draws: [] }, counter(), seqs())
    expect(events.map((event) => event.kind)).toEqual(['undo', 'other'])
    expect(toBoard(board)).toEqual(target)
    // even then, what the takeback left alone keeps its name
    expect(idsOf(board)['1,0']).toEqual(['t2'])
  })
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
  it('gives the Undo arrow its turn, the same for both sides, and a placement taken back its flight home', () => {
    expect(eventDuration({ kind: 'undo', seat: 0 }, 0, false)).toBe(HOLD.undo)
    expect(eventDuration({ kind: 'undo', seat: 1 }, 0, false)).toBe(HOLD.undo)
    expect(eventDuration({ kind: 'unplace', seat: 1 }, 0, false)).toBeGreaterThan(FLIGHT)
    // under reduced motion both are short, but the arrow still long enough to be seen
    expect(eventDuration({ kind: 'undo', seat: 0 }, 0, true)).toBe(HOLD.reduced * 2)
    expect(eventDuration({ kind: 'unplace', seat: 0 }, 0, true)).toBe(HOLD.reduced)
  })

  it("gives a pick taken back the pick's own time, on the drawer's screen only: the other side has no arch", () => {
    expect(eventDuration({ kind: 'crystalUnkeep', seat: 0 }, 0, false)).toBe(HOLD.crystalKeep)
    expect(eventDuration({ kind: 'crystalUnkeep', seat: 1 }, 0, false)).toBe(0)
  })

  it('gives the bag its moment on a draw, shorter for the opponent', () => {
    const mine = eventDuration({ kind: 'draw', seat: 0, crystal: false }, 0, false)
    const theirs = eventDuration({ kind: 'draw', seat: 1, crystal: false }, 0, false)
    expect(mine).toBeGreaterThan(theirs)
    expect(theirs).toBeGreaterThan(0)
  })

  it("gives your own crystal's draws their flights to the arch, and none to the opponent's", () => {
    expect(eventDuration({ kind: 'draw', seat: 0, crystal: true }, 0, false)).toBe(HOLD.crystalDraw)
    expect(eventDuration({ kind: 'draw', seat: 1, crystal: true }, 0, false)).toBe(0)
    // under reduced motion the arch simply appears, whole
    expect(eventDuration({ kind: 'draw', seat: 0, crystal: true }, 0, true)).toBe(0)
  })

  it("gives your own crystal's pick its resolving moment, and none to the opponent's", () => {
    expect(eventDuration({ kind: 'crystalKeep', seat: 0 }, 0, false)).toBe(HOLD.crystalKeep)
    expect(eventDuration({ kind: 'crystalKeep', seat: 1 }, 0, false)).toBe(0)
    expect(eventDuration({ kind: 'crystalKeep', seat: 0 }, 0, true)).toBe(0)
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
    for (const kind of ['move', 'swap', 'score'] as const) {
      expect(eventDuration({ kind, seat: 1 }, 0, false)).toBeLessThan(eventDuration({ kind, seat: 0 }, 0, false))
    }
  })

  it("gives the opponent's coin as long as yours: it is easy to miss, and it changes their hand", () => {
    expect(eventDuration({ kind: 'coin', seat: 1 }, 0, false)).toBe(eventDuration({ kind: 'coin', seat: 0 }, 0, false))
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

  it("marks a crystal's draws as the arch's, not the tray's", () => {
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

  it('shows a fire-up through a plant before the draws it caused, though it is logged after them', () => {
    const { events } = script(
      {},
      [
        entry({ type: 'draw', token: single('bread') }),
        entry({ type: 'draw', token: single('iron') }),
        entry({ type: 'draw', token: single('meat') }),
        entry({ type: 'plantTarget', at: at(1, 0), ability: 'crystal' }),
      ],
      { ...EMPTY_MEMORY, plantAt: at(0, 0) },
      counter(),
    )
    // the vine reaches the crystal and it catches, and only then are its three drawn
    expect(events.map((e) => e.kind)).toEqual(['fireUp', 'draw', 'draw', 'draw'])
    expect(events[0]).toMatchObject({ ability: 'crystal', at: at(1, 0), from: at(0, 0) })
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

  it('is still in hand while a coin’s cards are chosen over it', () => {
    const view = toPlayerView(createGame(3), 0)
    const top = view.pending[view.pending.length - 1]
    const held = heldFromView(view)
    expect(heldFromView({ ...view, pending: [...view.pending, { kind: 'coinDiscard' }] })).toEqual(held)
    expect(top?.kind).toBe('place')
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
