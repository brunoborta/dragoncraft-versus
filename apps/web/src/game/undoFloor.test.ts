import { single } from '@dcv/engine'
import type { LogEntry, Seat } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { undoFloor, type UndoableState } from './undoFloor.js'

const draw = (seat: Seat): LogEntry => ({ seat, action: { type: 'draw', token: single('bread') } })
const move = (seat: Seat): LogEntry => ({ seat, action: { type: 'skipFireUp' } })

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
