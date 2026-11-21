import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Step } from '../game/tutorial/script.js'
import { Coach, blockers, measureHoles, ribbonTop } from './Coach.js'

const say: Step = { kind: 'say', text: 'Hello, apprentice.' }
const doIt: Step = { kind: 'do', text: 'Tap the gear.', spots: ['.gear'], expect: [{ ui: { kind: 'openSettings' } }] }

function coach(props: Partial<Parameters<typeof Coach>[0]> = {}) {
  const handlers = { onNext: vi.fn(), onSkip: vi.fn(), onPlay: vi.fn(), onMenu: vi.fn() }
  render(<Coach act={1} step={say} busy={false} {...handlers} {...props} />)
  return handlers
}

describe('Coach', () => {
  it("says Maple's line and goes on with a tap anywhere", () => {
    const { onNext } = coach()
    expect(screen.getByText('Hello, apprentice.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('coach-catcher'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onNext).toHaveBeenCalledTimes(2)
  })

  it('does not go on by a tap when something is to be done', () => {
    const { onNext } = coach({ step: doIt })
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull()
    fireEvent.click(screen.getByTestId('coach-catcher'))
    expect(onNext).not.toHaveBeenCalled()
  })

  it('asks before leaving, and leaves on Yes', () => {
    const { onSkip, onNext } = coach()
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    expect(onNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep going' }))
    expect(onSkip).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('offers the warm-up game once the lessons are over', () => {
    const { onPlay, onMenu } = coach({ act: 3, step: null })
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back to menu' }))
    expect(onPlay).toHaveBeenCalledOnce()
    expect(onMenu).toHaveBeenCalledOnce()
  })

  it('waits while the game is still animating', () => {
    coach({ busy: true })
    expect(screen.queryByText('Hello, apprentice.')).toBeNull()
  })

  it('says nothing during a move of its own', () => {
    coach({ act: 2, step: { kind: 'play', action: { type: 'endTurn' } } })
    expect(screen.queryByRole('region', { name: 'Professor Maple' })).toBeNull()
  })
})

describe('blockers', () => {
  const inside = (cells: { x: number; y: number; w: number; h: number }[], x: number, y: number) =>
    cells.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)

  it('covers everything but the hole', () => {
    const cells = blockers([{ x: 100, y: 100, w: 50, h: 50 }], 400, 800)
    expect(inside(cells, 125, 125)).toBe(false)
    expect(inside(cells, 10, 10)).toBe(true)
    expect(inside(cells, 125, 300)).toBe(true)
  })
  it('keeps two overlapping holes open where they overlap', () => {
    const holes = [
      { x: 100, y: 100, w: 50, h: 50 },
      { x: 110, y: 105, w: 50, h: 50 },
    ]
    const cells = blockers(holes, 400, 800)
    expect(inside(cells, 125, 125)).toBe(false)
    expect(inside(cells, 155, 150)).toBe(false)
  })
})

describe('ribbonTop', () => {
  const screenHeight = 860
  it('stands in the middle of the class when nothing lit is there', () => {
    expect(ribbonTop([], 1, 200, screenHeight, 70)).toBe(330)
  })
  it('moves to the foot of the screen when the middle is lit', () => {
    expect(ribbonTop([{ x: 0, y: 300, w: 100, h: 200 }], 1, 200, screenHeight, 70)).toBe(644)
  })
  it('goes to the top when the middle and the foot are both lit', () => {
    const holes = [
      { x: 0, y: 300, w: 100, h: 200 },
      { x: 0, y: 700, w: 100, h: 100 },
    ]
    expect(ribbonTop(holes, 1, 200, screenHeight, 70)).toBe(16)
  })
  it('hangs under the plate in the lessons, unless that hides the spot', () => {
    expect(ribbonTop([], 2, 90, screenHeight, 70)).toBe(70)
    expect(ribbonTop([{ x: 0, y: 100, w: 50, h: 50 }], 2, 90, screenHeight, 70)).toBe(754)
  })
})

describe('measureHoles', () => {
  it('opens a padded hole on every element found, and none for what is not on screen', () => {
    const gear = document.createElement('button')
    gear.className = 'gear'
    gear.getBoundingClientRect = () => ({ left: 100, top: 20, width: 40, height: 40 }) as DOMRect
    document.body.append(gear)
    expect(measureHoles(['.gear', '.missing'])).toEqual([{ x: 92, y: 12, w: 56, h: 56 }])
    gear.remove()
  })
})
