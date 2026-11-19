import { describe, expect, it } from 'vitest'
import { createGame, legalActions } from './engine.js'
import { forfeit, forfeitedBy } from './forfeit.js'
import { winner, winnerOfView } from './scoring.js'
import { toPlayerView } from './view.js'

describe('forfeit', () => {
  it('ends the game with the other seat as the winner, whatever the score', () => {
    const state = forfeit(createGame(7), 0)
    expect(state.phase).toBe('ended')
    expect(state.pending).toEqual([])
    expect(legalActions(state)).toEqual([])
    expect(forfeitedBy(state.log)).toBe(0)
    expect(winner(state)).toBe(1)
  })

  it('may be done by the seat whose turn it is not', () => {
    const game = createGame(7)
    const other = (1 - game.current) as 0 | 1
    const state = forfeit(game, other)
    expect(winner(state)).toBe(game.current)
  })

  it('is told in the log, so each seat can read the verdict from its own view', () => {
    const state = forfeit(createGame(7), 1)
    expect(state.log[state.log.length - 1]).toEqual({ seat: 1, action: { type: 'forfeit' } })
    expect(winnerOfView(toPlayerView(state, 0))).toBe(0)
    expect(winnerOfView(toPlayerView(state, 1))).toBe(0)
  })

  it('cannot end a game that is already over', () => {
    const state = forfeit(createGame(7), 0)
    expect(() => forfeit(state, 1)).toThrow()
  })

  it('names nobody in a game that ended on the board', () => {
    expect(forfeitedBy(createGame(7).log)).toBeNull()
  })
})
