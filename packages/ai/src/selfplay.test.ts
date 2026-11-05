import { applyAction, createGame, finalScore, legalActions, toPlayerView, winner } from '@dcv/engine'
import type { GameState, Seat } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { easy } from './easy.js'
import { hard } from './hard.js'
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

/** Alternates seats so that going first is not what is being measured. */
function record(a: Strategy, b: Strategy, games: number) {
  let aWins = 0
  let bWins = 0
  let aScore = 0
  let bScore = 0

  for (let seed = 0; seed < games; seed++) {
    const aSeat = (seed % 2) as Seat
    const seats: [Strategy, Strategy] = aSeat === 0 ? [a, b] : [b, a]
    const state = playGame(seed, seats)
    const result = winner(state)
    if (result === aSeat) aWins += 1
    else if (result !== 'draw') bWins += 1
    aScore += finalScore(state, aSeat)
    bScore += finalScore(state, (1 - aSeat) as Seat)
  }

  return { aWins, bWins, aScore: aScore / games, bScore: bScore / games }
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
    { timeout: 300_000 },
  )

  /**
   * Hard searches whole turns and so costs a hundred times what a random move
   * costs. Fewer games than the suite above on purpose: this one is here to
   * show it never produces an illegal action over a long run, and the strength
   * claims below are measured separately.
   */
  it(
    'plays hard against medium with no illegal action and no hang',
    () => {
      for (let seed = 0; seed < 8; seed++) {
        const seats: [Strategy, Strategy] = seed % 2 === 0 ? [hard, medium] : [medium, hard]
        const state = playGame(seed, seats)
        expect(state.phase).toBe('ended')
        expect(['draw', 0, 1]).toContain(winner(state))
      }
    },
    { timeout: 300_000 },
  )

  /**
   * The ladder has to be a ladder: three rungs the player can feel, rather
   * than one real opponent with a shrug on either side. Easy used to average
   * about 3 reputation a game, which is less an easy opponent than an absent
   * one; sharing Medium's judgement and discarding it at random puts it within
   * reach of Medium without catching it.
   *
   * Both duels are measured once and then asserted on twice, because each
   * costs minutes and the win rate and the scoreline are two readings of the
   * same games.
   */
  it(
    'puts the three levels in order, by win rate and by score',
    () => {
      const easyVsMedium = record(easy, medium, 16)
      const hardVsMedium = record(hard, medium, 12)

      expect(
        easyVsMedium.bWins,
        `medium won ${easyVsMedium.bWins} to easy's ${easyVsMedium.aWins}`,
      ).toBeGreaterThan(easyVsMedium.aWins)
      expect(
        hardVsMedium.aWins,
        `hard won ${hardVsMedium.aWins} to medium's ${hardVsMedium.bWins}`,
      ).toBeGreaterThan(hardVsMedium.bWins)

      const easyScore = easyVsMedium.aScore
      const mediumScore = (easyVsMedium.bScore + hardVsMedium.bScore) / 2
      const hardScore = hardVsMedium.aScore

      // the floor is the point of the rework: uniform-random Easy sat near 3
      expect(easyScore, `easy averaged ${easyScore}`).toBeGreaterThan(5)
      expect(mediumScore, `medium ${mediumScore} should beat easy ${easyScore}`).toBeGreaterThan(easyScore)
      expect(hardScore, `hard ${hardScore} should beat medium ${mediumScore}`).toBeGreaterThan(mediumScore)
    },
    { timeout: 900_000 },
  )
})
