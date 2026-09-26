import { describe, expect, it } from 'vitest'
import { topOf } from './board.js'
import { applyAction, legalActions } from './engine.js'
import { key } from './hex.js'
import { createInitialState } from './setup.js'
import { dual, single } from './tokens.js'
import type { Board, DragonType, GameState, Token } from './types.js'

function staged(opts: {
  board?: Board
  held: DragonType
  bag?: Token[]
  extrasAdded?: boolean
}): GameState {
  const base = createInitialState(1)
  return {
    ...base,
    board: opts.board ?? {},
    bag: opts.bag ?? base.bag,
    extrasAdded: opts.extrasAdded ?? false,
    current: 0,
    phase: 'play',
    pending: [{ kind: 'place', token: single(opts.held), fireUpAllowed: true }],
  }
}

const A = { q: 0, r: 0 }
const B = { q: 1, r: 0 }
const C = { q: 2, r: 0 }

const fire = (state: GameState, ability: DragonType) =>
  applyAction(applyAction(state, { type: 'place', at: A }), { type: 'fireUp', ability })

describe('bread', () => {
  it('draws a token from the bag and asks where to place it', () => {
    const state = staged({ held: 'bread' })
    const after = fire(state, 'bread')
    expect(after.bag).toHaveLength(state.bag.length - 1)
    expect(after.pending.at(-1)?.kind).toBe('place')
  })

  it('lets the newly placed token be fired up in turn, so bread chains', () => {
    let state = fire(staged({ held: 'bread' }), 'bread')
    const spot = legalActions(state).find((a) => a.type === 'place')
    if (!spot) throw new Error('expected a placement to be offered')
    state = applyAction(state, spot)
    expect(legalActions(state).some((a) => a.type === 'fireUp')).toBe(true)
  })

  it('logs the token it drew, so the draw is not an invisible step', () => {
    const after = fire(staged({ held: 'bread' }), 'bread')
    const pending = after.pending.at(-1)
    if (pending?.kind !== 'place') throw new Error('expected a place pending')
    expect(after.log.at(-1)?.action).toEqual({ type: 'draw', token: pending.token })
  })

  it('does nothing when there is nothing left to draw', () => {
    const state = staged({ held: 'bread', bag: [], extrasAdded: true })
    expect(fire(state, 'bread').phase).toBe('score')
  })
})

describe('crystal', () => {
  it('draws 3 tokens and offers exactly those 3 choices', () => {
    const state = staged({ held: 'crystal' })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    expect(pending?.kind).toBe('crystalPick')
    expect(after.bag).toHaveLength(state.bag.length - 3)
    expect(legalActions(after).filter((a) => a.type === 'crystalPick')).toHaveLength(3)
  })

  it('logs all three tokens it drew', () => {
    const after = fire(staged({ held: 'crystal' }), 'crystal')
    const pending = after.pending.at(-1)
    if (pending?.kind !== 'crystalPick') throw new Error('expected a crystalPick pending')
    expect(after.log.slice(-3).map((entry) => entry.action)).toEqual(
      pending.tokens.map((token) => ({ type: 'draw', token })),
    )
  })

  it('returns the two unchosen tokens to the bag', () => {
    const state = staged({ held: 'crystal' })
    const picking = fire(state, 'crystal')
    const after = applyAction(picking, { type: 'crystalPick', index: 0 })
    expect(after.bag).toHaveLength(state.bag.length - 1)
  })

  it('does not let the placed token be fired up', () => {
    let state = fire(staged({ held: 'crystal' }), 'crystal')
    state = applyAction(state, { type: 'crystalPick', index: 1 })
    const spot = legalActions(state).find((a) => a.type === 'place')
    if (!spot) throw new Error('expected a placement to be offered')
    state = applyAction(state, spot)
    expect(state.phase).toBe('score')
  })

  it('injects the 6 extras when the bag runs short, and still triggers the end', () => {
    const state = staged({ held: 'crystal', bag: [single('iron'), single('meat')] })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    expect(pending?.kind).toBe('crystalPick')
    if (pending?.kind === 'crystalPick') expect(pending.tokens).toHaveLength(3)
    expect(after.extrasAdded).toBe(true)
    expect(after.endTriggered).toBe(true)
    expect(after.bag).toHaveLength(5)
  })

  it('injects the extras only once', () => {
    const state = staged({ held: 'crystal', bag: [single('iron')], extrasAdded: true })
    const after = fire(state, 'crystal')
    const pending = after.pending.at(-1)
    if (pending?.kind === 'crystalPick') expect(pending.tokens).toHaveLength(1)
    expect(after.endTriggered).toBe(true)
  })
})

describe('plant', () => {
  it('offers every ability of every occupied neighbour', () => {
    const state = staged({ board: { [key(B)]: [dual('potion', 'plant')] }, held: 'plant' })
    const after = fire(state, 'plant')
    const targets = legalActions(after).filter((a) => a.type === 'plantTarget')
    expect(targets).toHaveLength(2)
  })

  it('fires up the chosen neighbour ability', () => {
    const state = staged({ board: { [key(B)]: [single('bread')] }, held: 'plant' })
    const before = state.bag.length
    const after = applyAction(fire(state, 'plant'), { type: 'plantTarget', at: B, ability: 'bread' })
    expect(after.bag).toHaveLength(before - 1)
    expect(after.pending.at(-1)?.kind).toBe('place')
  })

  it('chains plant into plant into a third ability', () => {
    const state = staged({
      board: { [key(B)]: [single('plant')], [key(C)]: [single('bread')] },
      held: 'plant',
    })
    const before = state.bag.length
    let after = applyAction(fire(state, 'plant'), { type: 'plantTarget', at: B, ability: 'plant' })
    expect(after.pending.at(-1)?.kind).toBe('plant')
    after = applyAction(after, { type: 'plantTarget', at: C, ability: 'bread' })
    expect(after.bag).toHaveLength(before - 1)
  })

  it('stays legal and resolves to nothing when no neighbour is occupied', () => {
    const after = fire(staged({ held: 'plant' }), 'plant')
    expect(after.phase).toBe('score')
  })

  it('ignores a neighbour whose top is buried under another token', () => {
    const state = staged({ board: { [key(B)]: [single('bread'), single('meat')] }, held: 'plant' })
    const after = fire(state, 'plant')
    const targets = legalActions(after).filter((a) => a.type === 'plantTarget')
    expect(targets).toHaveLength(1)
    expect(targets[0]).toEqual({ type: 'plantTarget', at: B, ability: 'meat' })
  })
})
