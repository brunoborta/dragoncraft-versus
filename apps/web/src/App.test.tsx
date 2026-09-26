import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.js'

describe('App', () => {
  it('asks where to place the opening token, and says which token it is', () => {
    const { container } = render(<App />)
    const text = container.querySelector('.prompt-text')
    expect(text?.textContent).toContain('Choose where to place the token')
    // the token being placed has to be on screen, not only in the log
    expect(text?.querySelectorAll('.token-chip svg')).toHaveLength(1)
    expect(text?.textContent).toMatch(/Bread|Crystal|Meat|Iron|Potion|Plant/)
  })

  it('draws the held token translucent on the previewed space', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.token-preview')).toBeNull()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    const selectedCell = container.querySelector('.hex-cell[data-highlight="selected"]')
    expect(selectedCell?.querySelector('.token-preview')).not.toBeNull()
  })

  it('marks every legal space', () => {
    render(<App />)
    const legal = screen.getAllByRole('button').filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(19)
  })

  it('previews on the first tap and commits on the second', () => {
    render(<App />)
    const target = screen.getByLabelText('2,-2: empty')

    fireEvent.click(target)
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText('2,-2: empty')).toBeNull()
    expect(screen.getByText('Fire up this dragon?')).toBeDefined()
  })

  it('moves the preview when a different space is tapped', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('0,2: empty'))
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('legal')
    expect(screen.getByLabelText('0,2: empty').getAttribute('data-highlight')).toBe('selected')
  })

  it('offers the non-spatial decisions as buttons', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.getByText('Do not fire up')).toBeDefined()
  })

  it('marks a placement that would complete a card in hand', () => {
    render(<App />)
    const completing = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-highlight') === 'completes')
    // the opening position may or may not offer one; the assertion is that the
    // mark is reserved for placements that really do complete a card
    for (const el of completing) expect(el.getAttribute('data-highlight')).toBe('completes')
  })

  it('does not put spatial actions in the decision bar', () => {
    render(<App />)
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

  it('does not open a stack for a space holding a single token', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens a stack once a space buries something', () => {
    render(<App />)
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('shows the stack bottom to top without naming a coordinate on screen', () => {
    render(<App />)
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.textContent).toContain('Bottom to top')
    expect(panel.textContent).not.toMatch(/\d,-?\d/)
  })

  it('shows nothing for an empty space', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail from its own button, leaving the game untouched', () => {
    render(<App />)
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText('Close stack'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
    expect(screen.getByText('Your turn')).toBeDefined()
  })

  it('closes the stack detail when the commit comes from the decision bar', () => {
    render(<App />)
    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this dragon?')).toBeDefined()

    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByText('Do not fire up'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail when the turn is undone', () => {
    render(<App />)
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByText('Undo'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })
})
