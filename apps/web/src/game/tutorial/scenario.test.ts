import { applyAction, dual, legalActions, single, tokenId } from '@dcv/engine'
import type { GameState, Token } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { rig, scenario } from './scenario.js'

const ids = (tokens: readonly Token[]) => tokens.map(tokenId)

describe('scenario', () => {
  const state = scenario({
    board: { '0,0': ['plant'], '1,0': ['iron', 'meat'] },
    held: 'bread',
    hand: ['line-plant', 'tri-iron'],
    opponentHand: ['line-meat'],
  })

  it('puts the board, the held token and the hands in place', () => {
    expect(state.board['0,0']).toEqual([single('plant')])
    expect(state.board['1,0']).toEqual([single('iron'), single('meat')])
    expect(state.pending).toEqual([{ kind: 'place', token: single('bread'), fireUpAllowed: true }])
    expect(state.players[0].hand.map((c) => c.id)).toEqual(['line-plant', 'tri-iron'])
    expect(state.players[1].hand.map((c) => c.id)).toEqual(['line-meat'])
    expect(state.deck.some((c) => c.id === 'line-plant')).toBe(false)
    expect(state.bag).toHaveLength(12)
  })

  it('opens the turn the way the engine does: placing on any space with room', () => {
    const places = legalActions(state).filter((a) => a.type === 'place')
    expect(places).toHaveLength(19)
  })

  it('builds duals', () => {
    expect(scenario({ held: ['plant', 'meat'] }).pending[0]).toMatchObject({ token: dual('plant', 'meat') })
  })
})

describe('rig', () => {
  function fireUp(state: GameState, ability: 'bread' | 'crystal'): GameState {
    const placed = applyAction(state, { type: 'place', at: { q: 0, r: 0 } })
    return applyAction(placed, { type: 'fireUp', ability })
  }

  it("makes a bread's draw the token asked for", () => {
    const state = scenario({ held: 'bread', bag: ['potion'] })
    const after = fireUp(rig(state, [single('potion')]), 'bread')
    expect(after.pending.at(-1)).toMatchObject({ kind: 'place', token: single('potion') })
  })

  it("lays a crystal's three out in the order asked for", () => {
    const state = scenario({ held: 'crystal', bag: ['meat', 'iron', 'plant'] })
    const wanted = [single('meat'), single('iron'), single('plant')]
    const after = fireUp(rig(state, wanted), 'crystal')
    expect(after.pending.at(-1)).toMatchObject({ kind: 'crystalPick' })
    const pick = after.pending.at(-1)
    expect(pick?.kind === 'crystalPick' ? ids(pick.tokens) : []).toEqual(ids(wanted))
  })

  it('keeps every token in the bag, only reordered', () => {
    const state = scenario({ held: 'bread', bag: ['potion'] })
    expect(ids(rig(state, [single('potion')]).bag).sort()).toEqual(ids(state.bag).sort())
  })

  it('refuses a token that is not in the bag', () => {
    const state = scenario({ held: 'bread', filler: 0 })
    expect(() => rig(state, [single('potion')])).toThrow(/not in the bag/)
  })
})
