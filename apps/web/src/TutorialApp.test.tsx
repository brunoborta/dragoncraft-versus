import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'
import { scenario } from './game/tutorial/scenario.js'
import type { Lesson } from './game/tutorial/script.js'
import { NEXT_LESSON_PAUSE } from './game/tutorial/useTutorialTable.js'

const SHORT: Lesson[] = [
  { id: 'class', act: 1, build: () => scenario({ held: 'bread' }), steps: [{ kind: 'say', text: 'Welcome, apprentice.' }] },
]

describe('the tutorial, from the front door', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("opens on Maple's first line", () => {
    render(<App seed={2} />)
    fireEvent.click(screen.getByText('Tutorial'))
    expect(screen.getByText('Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.')).toBeDefined()
    // her plate at the top, and the ribbon she speaks in
    expect(screen.getAllByRole('region', { name: 'Professor Maple' })).toHaveLength(2)
  })

  it('leaves for the front door on Skip, and starts over from the first line', () => {
    render(<App seed={2} />)
    fireEvent.click(screen.getByText('Tutorial'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText('Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(screen.getByText('Against the computer')).toBeDefined()

    fireEvent.click(screen.getByText('Tutorial'))
    expect(screen.getByText('Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.')).toBeDefined()
  })

  it('offers a warm-up game at the end, against Maple', () => {
    render(<App seed={2} lessons={SHORT} />)
    fireEvent.click(screen.getByText('Tutorial'))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    expect(screen.queryByText('Skip tutorial')).toBeNull()
    expect(screen.getByRole('region', { name: 'Professor Maple' })).toBeDefined()
    expect(screen.getByText('Choose where to place the token')).toBeDefined()
  })
})
