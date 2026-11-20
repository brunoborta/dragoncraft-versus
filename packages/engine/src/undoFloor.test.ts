import { describe, expect, it } from 'vitest'
import { single } from './tokens.js'
import { undoFloor, undoTarget, type UndoableState } from './undoFloor.js'
import type { LogEntry, Seat } from './types.js'

const draw = (seat: Seat): LogEntry => ({ seat, action: { type: 'draw', token: single('bread') } })
const move = (seat: Seat): LogEntry => ({ seat, action: { type: 'skipFireUp' } })
const coin = (seat: Seat): LogEntry => ({ seat, action: { type: 'spendCoin' } })
const discard = (seat: Seat): LogEntry => ({ seat, action: { type: 'coinDiscard', cardIds: ['a', 'b'] } })
const score = (seat: Seat): LogEntry => ({ seat, action: { type: 'scoreCard', cardId: 'a' } })

/** Builds the history as a running log, one state per entry appended. */
function history(entries: LogEntry[], seats: Seat[]): UndoableState[] {
  return entries.map((_, index) => ({
    current: seats[index],
    log: entries.slice(0, index + 1),
  }))
}

describe('undoFloor', () => {
  it('lets you take back anything since the token was drawn', () => {
    // draw, place, fire up a meat, move a neighbour — no second draw anywhere
    const states = history([draw(0), move(0), move(0), move(0)], [0, 0, 0, 0])
    expect(undoFloor(states)).toBe(0)
  })

  it('stops at a draw, so firing up a bread cannot be taken back', () => {
    // draw, place, fire up bread which draws again, place that one
    const states = history([draw(0), move(0), draw(0), move(0)], [0, 0, 0, 0])
    // index 2 is the state the second draw produced: undo may reach it, not pass it
    expect(undoFloor(states)).toBe(2)
  })

  it('stops at a spent coin, so the cards it drew cannot be unseen', () => {
    const states = history([draw(0), move(0), coin(0), discard(0)], [0, 0, 0, 0])
    // index 2 is the state the spend produced: the discard may be re-chosen, the spend may not
    expect(undoFloor(states)).toBe(2)
  })

  it('stops at a scored card: a card once scored stays scored', () => {
    const states = history([draw(0), move(0), move(0), score(0)], [0, 0, 0, 0])
    // index 3 is the state the score produced: nothing before it can be taken back
    expect(undoFloor(states)).toBe(3)
    expect(undoTarget(states)).toBeNull()
  })

  it('stops at the start of your turn, so the machine keeps what it did', () => {
    const states = history([move(1), draw(0), move(0)], [1, 0, 0])
    expect(undoFloor(states)).toBe(1)
  })

  it('has nowhere to go from the opening position', () => {
    expect(undoFloor(history([draw(0)], [0]))).toBe(0)
  })

  it('stops at a turn change even when nothing could be drawn', () => {
    // the bag ran dry, so the turn opened without a draw
    const states = history([move(0), move(1), move(1)], [0, 1, 1])
    expect(undoFloor(states)).toBe(1)
  })
})

const place = (seat: Seat): LogEntry => ({ seat, action: { type: 'place', at: { q: 0, r: 0 } } })
const fireUp = (seat: Seat): LogEntry => ({ seat, action: { type: 'fireUp', ability: 'iron' } })
const ironMove = (seat: Seat): LogEntry => ({ seat, action: { type: 'ironMove', from: { q: 1, r: 0 }, to: { q: 2, r: 0 } } })
const ironDone = (seat: Seat): LogEntry => ({ seat, action: { type: 'ironDone' } })

describe('undoTarget', () => {
  it('takes back the last move of an iron, leaving the iron fired up', () => {
    // drawn, placed, fired up, one token moved
    const states = history([draw(0), place(0), fireUp(0), ironMove(0)], [0, 0, 0, 0])
    expect(undoTarget(states)).toBe(2)
  })

  it('takes back an answer together with the placement it answered', () => {
    // drawn, placed, fired up: nothing has moved yet, so the token goes back to the hand
    const states = history([draw(0), place(0), fireUp(0)], [0, 0, 0])
    expect(undoTarget(states)).toBe(0)
  })

  it('takes back "done" together with the move before it', () => {
    const states = history([draw(0), place(0), fireUp(0), ironMove(0), ironDone(0)], [0, 0, 0, 0, 0])
    expect(undoTarget(states)).toBe(2)
  })

  it('never goes past the floor, even in the middle of a play', () => {
    // a bread drew a second token; its fire-up answer sits right on the floor
    const states = history([draw(0), place(0), draw(0), fireUp(0)], [0, 0, 0, 0])
    expect(undoTarget(states)).toBe(2)
  })

  it('has nothing to take back at the floor', () => {
    expect(undoTarget(history([draw(0)], [0]))).toBeNull()
    expect(undoTarget(history([move(1), draw(0)], [1, 0]))).toBeNull()
  })
})
