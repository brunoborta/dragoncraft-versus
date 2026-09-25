import { applyAction, createGame, finalScore, legalActions, toPlayerView, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'
import { medium } from './medium.js'
import type { Strategy } from './types.js'

const GAMES = 100

function playGame(seed: number, seats: [Strategy, Strategy]): GameState {
  let state = createGame(seed)
  let rng = seed ^ 0x51ed270b
  let steps = 0

  while (state.phase !== 'ended') {
    const actions = legalActions(state)
    expect(actions.length, `no legal action in phase ${state.phase}`).toBeGreaterThan(0)

    const strategy = seats[state.current]
    const chosen = strategy.chooseAction(toPlayerView(state, state.current), actions, rng)
    rng = chosen.rng
    expect(actions, `${strategy.level} offered an action that was not legal`).toContainEqual(chosen.action)

    state = applyAction(state, chosen.action)
    steps += 1
    expect(steps, 'game did not terminate').toBeLessThan(5000)
  }

  return state
}

describe('self-play', () => {
  it(
    `plays ${GAMES} easy-versus-medium games with no illegal action and no hang`,
    () => {
      for (let seed = 0; seed < GAMES; seed++) {
        const seats: [Strategy, Strategy] = seed % 2 === 0 ? [easy, medium] : [medium, easy]
        const state = playGame(seed, seats)
        expect(state.phase).toBe('ended')
        expect(['draw', 0, 1]).toContain(winner(state))
      }
    },
    { timeout: 180_000 },
  )

  it(
    'has medium beating easy more often than not',
    () => {
      let mediumWins = 0
      let easyWins = 0
      for (let seed = 0; seed < 40; seed++) {
        const mediumSeat = seed % 2
        const seats: [Strategy, Strategy] = mediumSeat === 0 ? [medium, easy] : [easy, medium]
        const result = winner(playGame(seed, seats))
        if (result === mediumSeat) mediumWins += 1
        else if (result !== 'draw') easyWins += 1
      }
      expect(mediumWins).toBeGreaterThan(easyWins)
    },
    { timeout: 180_000 },
  )
})
