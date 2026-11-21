import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Step } from '../game/tutorial/script.js'
import { Coach, measureHoles } from './Coach.js'

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
