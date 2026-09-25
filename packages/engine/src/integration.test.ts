import { describe, expect, it } from 'vitest'
import { applyAction, createGame, legalActions } from './engine.js'
import { nextInt } from './rng.js'
import { finalScore, winner } from './scoring.js'
import type { GameState } from './types.js'

const TOTAL_TOKENS = 42
const TOTAL_CARDS = 42

function tokensInPlay(state: GameState): number {
  const onBoard = Object.values(state.board).reduce((sum, stack) => sum + stack.length, 0)
  const held = state.pending.reduce((sum, pending) => {
    if (pending.kind === 'place') return sum + 1
    if (pending.kind === 'crystalPick') return sum + pending.tokens.length
    return sum
  }, 0)
  return onBoard + state.bag.length + state.extras.length + held
}

function cardsInPlay(state: GameState): number {
  return (
    state.deck.length +
    state.players.reduce((sum, player) => sum + player.hand.length + player.scored.length, 0)
  )
}

function expectInvariants(state: GameState): void {
  for (const [hex, stack] of Object.entries(state.board)) {
    expect(stack.length, `stack at ${hex}`).toBeLessThanOrEqual(3)
  }
  expect(tokensInPlay(state)).toBe(TOTAL_TOKENS)
  expect(cardsInPlay(state)).toBe(TOTAL_CARDS)
}

/** Plays a whole game choosing uniformly among the legal actions. */
function playOut(seed: number): { state: GameState; steps: number } {
  let state = createGame(seed)
  let rng = seed ^ 0x9e3779b9
  let steps = 0

  while (state.phase !== 'ended') {
    expectInvariants(state)
    const actions = legalActions(state)
    expect(actions.length, `no legal action in phase ${state.phase}`).toBeGreaterThan(0)
    const choice = nextInt(rng, actions.length)
    rng = choice.rng
    state = applyAction(state, actions[choice.value])
    steps += 1
    expect(steps, 'game did not terminate').toBeLessThan(5000)
  }

  return { state, steps }
}

describe('a full game', () => {
  it('always reaches the end, across many seeds', () => {
    for (let seed = 0; seed < 40; seed++) {
      const result = playOut(seed)
      expect(result.state.phase).toBe('ended')
      expect(result.state.endTriggered).toBe(true)
      expectInvariants(result.state)
    }
  })

  it('never offers an action that applyAction then rejects', () => {
    // playOut only ever applies what legalActions returned; reaching the end
    // without IllegalActionError is the assertion.
    expect(() => playOut(123)).not.toThrow()
  })

  it('produces a byte-identical state from the same seed', () => {
    expect(JSON.stringify(playOut(4242).state)).toBe(JSON.stringify(playOut(4242).state))
  })

  it('produces different games from different seeds', () => {
    expect(JSON.stringify(playOut(1).state)).not.toBe(JSON.stringify(playOut(2).state))
  })

  it('finishes with a declared result', () => {
    const { state } = playOut(77)
    const result = winner(state)
    expect(['draw', 0, 1]).toContain(result)
    expect(finalScore(state, 0)).toBeGreaterThanOrEqual(0)
    expect(finalScore(state, 1)).toBeGreaterThanOrEqual(0)
  })
})
