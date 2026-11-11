import { DECK } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CardView } from './CardView.js'

const card = (id: string) => {
  const found = DECK.find((c) => c.id === id)
  if (!found) throw new Error(`no card with id ${id}`)
  return found
}

describe('CardView', () => {
  it('names a single-type card by its shape', () => {
    render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(screen.getByText('Three Bread in a triangle')).toBeDefined()
    render(<CardView card={card('line-bread')} scoreable={false} />)
    expect(screen.getByText('Three Bread in a line')).toBeDefined()
  })

  it('names a mixed card by its two types', () => {
    render(<CardView card={card('line-plant-plant-meat')} scoreable={false} />)
    expect(screen.getByText('Two Plant and one Meat')).toBeDefined()
  })

  it('shows the reputation value', () => {
    render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(screen.getByText('3')).toBeDefined()
  })

  it('is a control only when the card can be scored, with no Score button inside', () => {
    const { rerender } = render(<CardView card={card('tri-bread')} scoreable={false} onScore={() => {}} />)
    expect(screen.queryByRole('button')).toBeNull()
    rerender(<CardView card={card('tri-bread')} scoreable onScore={() => {}} />)
    expect(screen.getByRole('button', { name: 'Score Three Bread in a triangle, 3 reputation' })).toBeDefined()
    expect(screen.queryByText('Score')).toBeNull()
  })

  it('scores from a tap anywhere on the card, or from the keyboard', () => {
    const onScore = vi.fn()
    const { container } = render(<CardView card={card('tri-bread')} scoreable onScore={onScore} />)
    fireEvent.click(container.querySelector('.pattern')!)
    fireEvent.click(container.querySelector('.card-rep')!)
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onScore).toHaveBeenCalledTimes(3)
  })

  it('draws one hex per pattern cell', () => {
    const { container } = render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(container.querySelectorAll('.pattern-hex')).toHaveLength(3)
  })
})
