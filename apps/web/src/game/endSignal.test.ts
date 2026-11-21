import { single } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { endCause, endMarks, triggerPoint } from './endSignal.js'

const two = [single('bread'), single('iron')]
const entry = (action: LogEntry['action']): LogEntry => ({ seat: 0, action })
const draw = entry({ type: 'draw', token: single('meat') })

describe('endCause', () => {
  it('is the bag when the bag is empty', () => {
    expect(endCause({ deckCount: 20, bag: [], extrasAdded: false })).toBe('bag')
  })
  it('is the bag once the extras went in, even with tokens back in it', () => {
    expect(endCause({ deckCount: 0, bag: two, extrasAdded: true })).toBe('bag')
  })
  it("is the bag after a crystal's two unpicked tokens went back", () => {
    expect(endCause({ deckCount: 20, bag: two, extrasAdded: false })).toBe('bag')
  })
  it('is the deck when the deck is empty and the bag is not', () => {
    expect(endCause({ deckCount: 0, bag: two, extrasAdded: false })).toBe('deck')
  })
})

describe('triggerPoint', () => {
  it("is the first draw of a crystal's fire-up", () => {
    const added = [entry({ type: 'fireUp', ability: 'crystal' }), draw, draw, draw]
    expect(triggerPoint(added, 10, 'bag')).toBe(11)
  })
  it('is right after the end of the turn that refilled the hand', () => {
    expect(triggerPoint([entry({ type: 'scoreCard', cardId: 'x' }), entry({ type: 'endTurn' })], 4, 'deck')).toBe(6)
  })
  it('is right after a coin that drew the last cards', () => {
    const added = [entry({ type: 'spendCoin' }), entry({ type: 'coinDiscard', cardIds: ['a', 'b'] })]
    expect(triggerPoint(added, 0, 'deck')).toBe(1)
  })
  it('falls after the whole batch when nothing in it explains the end', () => {
    expect(triggerPoint([entry({ type: 'skipFireUp' })], 7, 'bag')).toBe(8)
    expect(triggerPoint([draw], 7, 'deck')).toBe(8)
  })
})

describe('endMarks', () => {
  const ended = { endTriggered: true, deckCount: 20, bag: [], extrasAdded: false }
  it('marks nothing until the end has been shown', () => {
    expect(endMarks(ended, false)).toEqual({ bag: false, deck: false })
  })
  it('marks nothing while the end has not triggered', () => {
    expect(endMarks({ ...ended, endTriggered: false }, true)).toEqual({ bag: false, deck: false })
  })
  it('marks the bag when the bag ended it', () => {
    expect(endMarks({ ...ended, bag: two }, true)).toEqual({ bag: true, deck: false })
  })
  it('marks the deck when the deck ended it', () => {
    expect(endMarks({ ...ended, deckCount: 0, bag: two }, true)).toEqual({ bag: false, deck: true })
  })
  it('marks both when both ran out', () => {
    expect(endMarks({ ...ended, deckCount: 0, extrasAdded: true, bag: two }, true)).toEqual({ bag: true, deck: true })
  })
})
