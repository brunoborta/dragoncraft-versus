import { key } from '@dcv/engine'
import type { Action } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { boardTargets, resolveTap } from './selection.js'

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

describe('single-hex actions', () => {
  const actions: Action[] = [
    { type: 'place', at: A },
    { type: 'place', at: B },
  ]

  it('offers every destination when nothing is selected', () => {
    expect(boardTargets(actions, null).map(key)).toEqual([key(A), key(B)])
  })

  it('selects on the first tap and acts on the second', () => {
    expect(resolveTap(actions, null, A)).toEqual({ select: A })
    expect(resolveTap(actions, A, A)).toEqual({ action: actions[0], select: null })
  })

  it('moves the selection when another target is tapped', () => {
    expect(resolveTap(actions, A, B)).toEqual({ select: B })
  })

  it('clears the selection when a non-target is tapped', () => {
    expect(resolveTap(actions, A, C)).toEqual({ select: null })
  })
})

describe('two-hex actions', () => {
  const actions: Action[] = [
    { type: 'meatMove', from: B, to: A },
    { type: 'meatMove', from: B, to: C },
  ]

  it('offers the origins first', () => {
    expect(boardTargets(actions, null).map(key)).toEqual([key(B)])
  })

  it('offers only that origin destinations once it is picked', () => {
    expect(boardTargets(actions, B).map(key)).toEqual([key(A), key(C)])
  })

  it('acts when the destination is tapped', () => {
    expect(resolveTap(actions, B, C)).toEqual({ action: actions[1], select: null })
  })
})

describe('potion swaps, which have no direction', () => {
  const actions: Action[] = [{ type: 'potionSwap', a: A, b: C }]

  it('offers both ends as a starting point', () => {
    expect(boardTargets(actions, null).map(key).sort()).toEqual([key(A), key(C)].sort())
  })

  it('completes the swap from either end', () => {
    expect(resolveTap(actions, A, C)).toEqual({ action: actions[0], select: null })
    expect(resolveTap(actions, C, A)).toEqual({ action: actions[0], select: null })
  })
})

describe('plant targets', () => {
  it('acts on the second tap when the neighbour offers one ability', () => {
    const actions: Action[] = [{ type: 'plantTarget', at: B, ability: 'meat' }]
    expect(resolveTap(actions, B, B)).toEqual({ action: actions[0], select: null })
  })

  it('keeps the selection when the neighbour is a dual, so the bar can ask which', () => {
    const actions: Action[] = [
      { type: 'plantTarget', at: B, ability: 'potion' },
      { type: 'plantTarget', at: B, ability: 'plant' },
    ]
    expect(resolveTap(actions, B, B)).toEqual({ select: B })
  })
})
