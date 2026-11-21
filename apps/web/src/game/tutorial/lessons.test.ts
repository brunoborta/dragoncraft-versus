import { applyAction, legalActions, undoTarget, winner } from '@dcv/engine'
import type { GameState } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons.js'
import { rig, token } from './scenario.js'
import { accepts, matches, offered } from './script.js'
import type { Lesson } from './script.js'

/**
 * Plays a lesson the way the tutorial table will: each `do` step answered with
 * the one action it offers, each `play` step applied for Maple, the bag rigged
 * before every step that draws.
 */
function walk(lesson: Lesson): GameState[] {
  let history = [lesson.build()]
  const now = () => history[history.length - 1]

  lesson.steps.forEach((step, index) => {
    const where = `${lesson.id} #${index}: ${step.kind === 'play' ? step.action.type : step.text}`
    if (step.kind === 'say') return
    const rigged = (state: GameState) => (step.draws ? rig(state, step.draws.map(token)) : state)

    if (step.kind === 'play') {
      const state = rigged(now())
      expect(state.current, where).toBe(1)
      expect(legalActions(state).some((action) => matches(action, step.action)), where).toBe(true)
      history = [...history, applyAction(state, step.action)]
      return
    }

    step.expect.forEach((want, done) => {
      if ('ui' in want) return
      if ('undo' in want) {
        const target = undoTarget(history)
        expect(target, where).not.toBeNull()
        history = history.slice(0, (target ?? 0) + 1)
        return
      }
      const state = done === 0 ? rigged(now()) : now()
      expect(state.current, where).toBe(0)
      const answers = offered(lesson.steps, index, done, legalActions(state)).filter((a) => accepts(step, done, a))
      expect(answers, where).toHaveLength(1)
      history = [...history, applyAction(state, answers[0])]
    })
  })
  return history
}

const scoredBy = (state: GameState, seat: 0 | 1) => state.players[seat].scored.map((card) => card.id)

describe('the lessons', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id} plays through, legal at every step`, () => {
      const history = walk(lesson)
      const last = history[history.length - 1]
      if (lesson.id !== 'the-end') expect(last.endTriggered).toBe(false)
    })
  }

  const end = (id: string) => {
    const lesson = LESSONS.find((candidate) => candidate.id === id)
    if (!lesson) throw new Error(id)
    const history = walk(lesson)
    return history[history.length - 1]
  }

  it('scores the card each scoring lesson is about', () => {
    expect(scoredBy(end('scoring'), 0)).toEqual(['line-plant'])
    expect(scoredBy(end('meat-card'), 0)).toEqual(['line-iron-iron-plant'])
    expect(scoredBy(end('iron'), 0)).toEqual(['tri-potion'])
    expect(scoredBy(end('potion'), 0)).toEqual(['line-bread'])
    expect(scoredBy(end('plant'), 0)).toEqual(['line-crystal'])
    expect(scoredBy(end('dual'), 0)).toEqual(['line-meat-meat-plant'])
  })

  it('finishes two cards with one placement after the undo', () => {
    expect(scoredBy(end('undo'), 0)).toEqual(['line-meat', 'tri-meat'])
  })

  it('keeps the two new cards after the coin', () => {
    expect(end('coins').players[0].hand.map((card) => card.id).sort()).toEqual(['line-plant', 'tri-iron'])
  })

  it('ends the last lesson on the bag running out, with the player winning', () => {
    const last = end('the-end')
    expect(last.extrasAdded).toBe(true)
    expect(last.phase).toBe('ended')
    expect(scoredBy(last, 1)).toEqual(['tri-iron'])
    expect(winner(last)).toBe(0)
  })

  it('opens with the class, alone in act 1', () => {
    expect(LESSONS[0].id).toBe('class')
    expect(LESSONS.filter((lesson) => lesson.act === 1)).toHaveLength(1)
  })
})
