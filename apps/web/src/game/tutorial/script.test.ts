import type { Action } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { matches, offered, uiMatches } from './script.js'
import type { Step } from './script.js'

const place = (q: number, r: number): Action => ({ type: 'place', at: { q, r } })

describe('matches', () => {
  it('compares the fields asked for, hexes included', () => {
    expect(matches(place(0, 1), { type: 'place', at: { q: 0, r: 1 } })).toBe(true)
    expect(matches(place(0, 1), { type: 'place', at: { q: 1, r: 0 } })).toBe(false)
    expect(matches(place(0, 1), { type: 'place' })).toBe(true)
    expect(matches({ type: 'endTurn' }, { type: 'place' })).toBe(false)
  })
  it("takes a coin's two cards in either order", () => {
    expect(matches({ type: 'coinDiscard', cardIds: ['b', 'a'] }, { type: 'coinDiscard', cardIds: ['a', 'b'] })).toBe(true)
    expect(matches({ type: 'coinDiscard', cardIds: ['a', 'c'] }, { type: 'coinDiscard', cardIds: ['a', 'b'] })).toBe(false)
  })
  it('compares screen events', () => {
    expect(uiMatches({ kind: 'inspect', hex: '0,0' }, { kind: 'inspect', hex: '0,0' })).toBe(true)
    expect(uiMatches({ kind: 'openSettings' }, { kind: 'closeSettings' })).toBe(false)
  })
})

describe('offered', () => {
  const actions: Action[] = [place(0, 0), place(0, 1), { type: 'spendCoin' }]
  const steps: Step[] = [
    { kind: 'say', text: 'Look.' },
    { kind: 'do', text: 'Put it here.', expect: [{ action: { type: 'place', at: { q: 0, r: 1 } } }] },
    { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
    { kind: 'play', action: { type: 'endTurn' } },
  ]

  it('offers exactly what a do step waits for', () => {
    expect(offered(steps, 1, 0, actions)).toEqual([place(0, 1)])
  })
  it('previews the next step while Maple talks', () => {
    expect(offered(steps, 0, 0, actions)).toEqual([place(0, 1)])
  })
  it('offers nothing while the step waits on the screen, or Maple plays', () => {
    expect(offered(steps, 2, 0, actions)).toEqual([])
    expect(offered(steps, 3, 0, actions)).toEqual([])
    expect(offered(steps, 4, 0, actions)).toEqual([])
  })
  it('moves on through a do step that waits for several actions', () => {
    const two: Step[] = [
      { kind: 'do', text: 'End turn.', expect: [{ action: { type: 'skipFireUp' } }, { action: { type: 'endTurn' } }] },
    ]
    const now: Action[] = [{ type: 'skipFireUp' }, { type: 'endTurn' }]
    expect(offered(two, 0, 0, now)).toEqual([{ type: 'skipFireUp' }])
    expect(offered(two, 0, 1, now)).toEqual([{ type: 'endTurn' }])
  })
})
