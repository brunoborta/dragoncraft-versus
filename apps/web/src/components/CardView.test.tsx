import { DECK } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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

  it('offers a score button only when the card matches', () => {
    const { rerender } = render(<CardView card={card('tri-bread')} scoreable={false} onScore={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Score' })).toBeNull()
    rerender(<CardView card={card('tri-bread')} scoreable onScore={() => {}} />)
    expect(screen.getByRole('button', { name: 'Score' })).toBeDefined()
  })

  it('draws one hex per pattern cell', () => {
    const { container } = render(<CardView card={card('tri-bread')} scoreable={false} />)
    expect(container.querySelectorAll('.pattern-hex')).toHaveLength(3)
  })
})
