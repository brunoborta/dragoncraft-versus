import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { App } from './App.js'

describe('App', () => {
  /**
   * The game opens on a difficulty modal and does not start until it is
   * answered, so every test has to choose an opponent before anything else.
   */
  function startGame(level: 'Easy' | 'Medium' = 'Easy') {
    const rendered = render(<App />)
    fireEvent.click(screen.getByText(level))
    return rendered
  }

  it('asks where to place the opening token, and says which token it is', () => {
    const { container } = startGame()
    const text = container.querySelector('.prompt-text')
    expect(text?.textContent).toContain('Choose where to place the token')
    // the token being placed has to be on screen, not only in the log
    expect(text?.querySelectorAll('.token-chip svg')).toHaveLength(1)
    expect(text?.textContent).toMatch(/Bread|Crystal|Meat|Iron|Potion|Plant/)
  })

  it('draws the held token translucent on the previewed space', () => {
    const { container } = startGame()
    expect(container.querySelector('.token-preview')).toBeNull()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    const selectedCell = container.querySelector('.hex-cell[data-highlight="selected"]')
    expect(selectedCell?.querySelector('.token-preview')).not.toBeNull()
  })

  it('marks every legal space', () => {
    startGame()
    const legal = screen.getAllByRole('button').filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(19)
  })

  it('previews on the first tap and commits on the second', () => {
    startGame()
    const target = screen.getByLabelText('2,-2: empty')

    fireEvent.click(target)
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText('2,-2: empty')).toBeNull()
    expect(screen.getByText('Fire up this dragon?')).toBeDefined()
  })

  it('moves the preview when a different space is tapped', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('0,2: empty'))
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('legal')
    expect(screen.getByLabelText('0,2: empty').getAttribute('data-highlight')).toBe('selected')
  })

  it('offers the non-spatial decisions as buttons', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.getByText('Do not fire up')).toBeDefined()
  })

  it('does not put spatial actions in the decision bar', () => {
    startGame()
    expect(screen.queryByText(/^Place on /)).toBeNull()
  })

  /**
   * Places the opening token onto 1,0, which already holds one, leaving a stack
   * of two. The board starts with a single token on every occupied space, and
   * the inspector only opens once something is actually buried.
   */
  function stackTwoOnInnerRing(): void {
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
  }

  it('does not start until an opponent is chosen', () => {
    render(<App />)
    expect(screen.getByLabelText('Choose your opponent')).toBeDefined()
    const legal = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(0)
  })

  it('shows the chosen opponent as a label, with nothing to change mid-game', () => {
    startGame('Medium')
    expect(screen.queryByLabelText('Choose your opponent')).toBeNull()
    expect(screen.getByText('Opponent: Medium')).toBeDefined()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('opens the full log grouped into rounds, naming each side once per turn', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByText('Do not fire up'))
    fireEvent.click(screen.getByText('Full log'))

    const dialog = screen.getByLabelText('Move log')
    expect(dialog.querySelector('.log-round')?.textContent).toBe('Round 1')
    expect(dialog.querySelectorAll('.log-who')).toHaveLength(1)
    expect(dialog.querySelector('.log-who')?.textContent).toBe('You')
    expect(dialog.textContent).not.toMatch(/Player/)
  })

  it('closes the full log', () => {
    startGame()
    fireEvent.click(screen.getByText('Full log'))
    fireEvent.click(screen.getByLabelText('Close log'))
    expect(screen.queryByLabelText('Move log')).toBeNull()
  })

  it('does not open a stack for a space holding a single token', () => {
    startGame()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens a stack once a space buries something', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('shows the stack bottom to top without naming a coordinate on screen', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.textContent).toContain('Bottom to top')
    expect(panel.textContent).not.toMatch(/\d,-?\d/)
  })

  it('shows nothing for an empty space', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail from its own button, leaving the game untouched', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText('Close stack'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
    expect(screen.getByText('Your turn')).toBeDefined()
  })

  it('closes the stack detail when the commit comes from the decision bar', () => {
    startGame()
    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this dragon?')).toBeDefined()

    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByText('Do not fire up'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail when the turn is undone', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByText('Undo'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  /**
   * Clicks whatever the interface is offering, in the order a player would find
   * it. Returns false when there is nothing to click, which means the machine
   * is on turn and the test should let its timer run.
   */
  function takeAnyTurnAction(): boolean {
    // a coin discard takes over the screen: pick the keepers, then finish
    const dialog = document.querySelector('.discard-dialog')
    if (dialog) {
      const finish = dialog.querySelector<HTMLButtonElement>('.discard-finish')
      if (finish && !finish.disabled) {
        fireEvent.click(finish)
        return true
      }
      const unpicked = dialog.querySelector<HTMLElement>('.card[data-picked="false"]')
      if (unpicked) fireEvent.click(unpicked)
      return true
    }

    const scoreButton = document.querySelector<HTMLButtonElement>('.card button')
    if (scoreButton) {
      fireEvent.click(scoreButton)
      return true
    }

    const barButton = document.querySelector<HTMLButtonElement>('.prompt-actions button')
    if (barButton) {
      fireEvent.click(barButton)
      return true
    }

    const offered = '.hex-cell[data-highlight="legal"]'
    const first = document.querySelector<SVGGElement>(offered)
    if (!first) return false

    // a placement confirms on a second tap of the same space; a two-hex move
    // leaves that space selected and wants a different one for the destination
    fireEvent.click(first)
    fireEvent.click(first)
    if (first.getAttribute('data-highlight') === 'selected') {
      const destination = document.querySelector<SVGGElement>(offered)
      if (destination) fireEvent.click(destination)
    }
    return true
  }

  it('puts two cards back by picking the ones to keep in a dialog', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByText('Do not fire up'))
    fireEvent.click(screen.getByText('Spend a coin'))

    const dialog = screen.getByLabelText('Choose the cards to keep')
    const cards = [...dialog.querySelectorAll<HTMLElement>('.card')]
    expect(cards).toHaveLength(4)
    expect(screen.getByText(/^Keep 2\./)).toBeDefined()

    const finish = screen.getByText('Finish') as HTMLButtonElement
    expect(finish.disabled).toBe(true)

    const names = cards.map((card) => card.querySelector('.card-name')?.textContent)
    fireEvent.click(cards[0])
    fireEvent.click(cards[1])
    expect(finish.disabled).toBe(false)

    // a third pick is refused: exactly two stay
    fireEvent.click(cards[2])
    expect(cards[2].getAttribute('data-picked')).toBe('false')

    fireEvent.click(finish)
    expect(screen.queryByLabelText('Choose the cards to keep')).toBeNull()

    const left = [...document.querySelectorAll('.hand .card-name')].map((el) => el.textContent)
    expect(left).toEqual([names[0], names[1]])
  })

  it('plays a whole game and asks for an opponent again on a new one', () => {
    vi.useFakeTimers()
    try {
      startGame('Easy')

      let steps = 0
      while (!screen.queryByRole('dialog', { name: 'Final score' })) {
        steps += 1
        expect(steps, 'the game never reached its end').toBeLessThan(3000)
        if (takeAnyTurnAction()) continue
        // nothing on offer: the machine is deciding
        act(() => {
          vi.advanceTimersByTime(500)
        })
      }

      // guards the loop against passing by exiting on its first turn: a real
      // game runs to something like a hundred decisions
      expect(steps).toBeGreaterThan(50)

      fireEvent.click(screen.getByText('New game'))
      expect(screen.getByLabelText('Choose your opponent')).toBeDefined()
      expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
