import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'
import { scenario } from './game/tutorial/scenario.js'
import type { Lesson } from './game/tutorial/script.js'
import { NEXT_LESSON_PAUSE } from './game/tutorial/useTutorialTable.js'
import { SETTLE_MS } from './components/Coach.js'

const SHORT: Lesson[] = [
  { id: 'class', act: 1, build: () => scenario({ held: 'bread' }), steps: [{ kind: 'say', text: 'Welcome, apprentice.' }] },
]

const FIRST_LINE = 'Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.'

/** Opens the tutorial and taps the first chapter's card away, as a player would. */
function openTutorial() {
  fireEvent.click(screen.getByText('Tutorial'))
  expect(screen.getByText('Chapter 1')).toBeDefined()
  fireEvent.click(screen.getByText('The Menu'))
  // Maple speaks once the screen has been still a moment
  act(() => vi.advanceTimersByTime(SETTLE_MS + 1))
}

describe('the tutorial, from the front door', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("opens on the first chapter's card, then Maple's first line", () => {
    render(<App seed={2} />)
    openTutorial()
    expect(screen.getByText(FIRST_LINE)).toBeDefined()
    expect(screen.getByText('Ch. 1 · The Menu')).toBeDefined()
    // he speaks in the ribbon; the seat at the top is still an ordinary opponent's until he flies there
    expect(screen.getAllByRole('region', { name: 'Professor Maple' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Opponent' })).toBeDefined()
  })

  it('goes back to the line before', () => {
    render(<App seed={2} />)
    openTutorial()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(FIRST_LINE)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText(FIRST_LINE)).toBeDefined()
  })

  it('leaves for the front door on Skip, and starts over from the first line', () => {
    render(<App seed={2} />)
    openTutorial()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.queryByText(FIRST_LINE)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Skip tutorial' }))
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(screen.getByText('Against the computer')).toBeDefined()

    openTutorial()
    expect(screen.getByText(FIRST_LINE)).toBeDefined()
  })

  it('offers a warm-up game at the end, against Maple', () => {
    render(<App seed={2} lessons={SHORT} />)
    openTutorial()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    act(() => vi.advanceTimersByTime(NEXT_LESSON_PAUSE + 1))
    fireEvent.click(screen.getByText('Dessert'))
    act(() => vi.advanceTimersByTime(SETTLE_MS + 1))
    fireEvent.click(screen.getByRole('button', { name: 'Let’s play' }))
    expect(screen.queryByText('Skip tutorial')).toBeNull()
    expect(screen.getByRole('region', { name: 'Professor Maple' })).toBeDefined()
    expect(screen.getByText('Choose where to place the token')).toBeDefined()
  })
})
