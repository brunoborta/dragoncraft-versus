import { single } from '@dcv/engine'
import type { LogEntry, Seat } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { describeLogEntry, groupLog, groupRounds } from './log.js'

const entry = (seat: Seat, action: LogEntry['action']): LogEntry => ({ seat, action })

const aTurn = (seat: Seat): LogEntry[] => [
  entry(seat, { type: 'draw', token: single('bread') }),
  entry(seat, { type: 'place', at: { q: 0, r: 0 } }),
  entry(seat, { type: 'endTurn' }),
]

describe('groupLog', () => {
  it('puts consecutive entries by the same seat into one turn', () => {
    const turns = groupLog([...aTurn(0), ...aTurn(1)], 0)
    expect(turns.map((turn) => turn.who)).toEqual(['You', 'Opponent'])
    expect(turns[0].lines).toHaveLength(3)
    expect(turns[1].lines).toHaveLength(3)
  })

  it('starts a new turn every time the seat changes back', () => {
    const turns = groupLog([...aTurn(0), ...aTurn(1), ...aTurn(0)], 0)
    expect(turns.map((turn) => turn.who)).toEqual(['You', 'Opponent', 'You'])
  })

  it('names nobody inside a turn, because the heading already did', () => {
    const [turn] = groupLog([entry(1, { type: 'draw', token: single('iron') })], 0)
    expect(turn.who).toBe('Opponent')
    expect(turn.lines[0]).toBe('Drew Iron')
    for (const line of turn.lines) expect(line).not.toMatch(/You|Opponent|Player/)
  })

  it('reads from the seat of whoever is looking', () => {
    const log = aTurn(0)
    expect(groupLog(log, 0)[0].who).toBe('You')
    expect(groupLog(log, 1)[0].who).toBe('Opponent')
  })

  it('has nothing to group in an empty log', () => {
    expect(groupLog([], 0)).toEqual([])
  })
})

describe('describeLogEntry', () => {
  it('says You and Opponent rather than a seat number', () => {
    expect(describeLogEntry(entry(0, { type: 'endTurn' }), 0)).toBe('You: End turn')
    expect(describeLogEntry(entry(1, { type: 'endTurn' }), 0)).toBe('Opponent: End turn')
  })
})

describe('groupRounds', () => {
  it('pairs the two turns of a round', () => {
    const rounds = groupRounds([...aTurn(0), ...aTurn(1)], 0)
    expect(rounds).toHaveLength(1)
    expect(rounds[0].number).toBe(1)
    expect(rounds[0].turns.map((turn) => turn.who)).toEqual(['You', 'Opponent'])
  })

  it('opens every round with whoever opened the game', () => {
    // the Fire Up Chart sometimes gives the machine the first turn, and then
    // every round in that game reads Opponent first
    const rounds = groupRounds([...aTurn(1), ...aTurn(0), ...aTurn(1), ...aTurn(0)], 0)
    expect(rounds.map((round) => round.turns.map((turn) => turn.who))).toEqual([
      ['Opponent', 'You'],
      ['Opponent', 'You'],
    ])
  })

  it('leaves the round in progress half full', () => {
    const rounds = groupRounds([...aTurn(0), ...aTurn(1), ...aTurn(0)], 0)
    expect(rounds).toHaveLength(2)
    expect(rounds[1].number).toBe(2)
    expect(rounds[1].turns.map((turn) => turn.who)).toEqual(['You'])
  })

  it('has no rounds before anyone has moved', () => {
    expect(groupRounds([], 0)).toEqual([])
  })
})
