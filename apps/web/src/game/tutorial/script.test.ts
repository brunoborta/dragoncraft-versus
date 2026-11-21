import type { Action } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { accepts, matches, offered, uiMatches } from './script.js'
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
  it('previews the next step while waiting on the screen', () => {
    const waiting: Step[] = [
      { kind: 'do', text: 'Tap the gear.', expect: [{ ui: { kind: 'openSettings' } }] },
      { kind: 'do', text: 'Put it here.', expect: [{ action: { type: 'place', at: { q: 0, r: 1 } } }] },
    ]
    expect(offered(waiting, 0, 0, actions)).toEqual([place(0, 1)])
  })
  it('offers nothing while the step waits on the screen before Maple plays, or Maple plays', () => {
    expect(offered(steps, 2, 0, actions)).toEqual([])
    expect(offered(steps, 3, 0, actions)).toEqual([])
    expect(offered(steps, 4, 0, actions)).toEqual([])
  })
  it('shows what a step lists beside what it expects, and accepts only the expected', () => {
    const step: Step = {
      kind: 'do',
      text: 'Skip it.',
      expect: [{ action: { type: 'skipFireUp' } }],
      show: [{ type: 'fireUp' }],
    }
    const now: Action[] = [{ type: 'skipFireUp' }, { type: 'fireUp', ability: 'bread' }, { type: 'spendCoin' }]
    expect(offered([step], 0, 0, now)).toEqual([{ type: 'skipFireUp' }, { type: 'fireUp', ability: 'bread' }])
    expect(accepts(step, 0, { type: 'skipFireUp' })).toBe(true)
    expect(accepts(step, 0, { type: 'fireUp', ability: 'bread' })).toBe(false)
  })
  it('falls back on what the lesson shows while idle', () => {
    expect(offered([{ kind: 'say', text: 'Hi.' }], 0, 0, actions, { type: 'place' })).toEqual([place(0, 0), place(0, 1)])
  })
  it('takes a swap either way round', () => {
    const swap: Action = { type: 'potionSwap', a: { q: 1, r: 1 }, b: { q: -2, r: 2 } }
    expect(matches(swap, { type: 'potionSwap', a: { q: -2, r: 2 }, b: { q: 1, r: 1 } })).toBe(true)
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
