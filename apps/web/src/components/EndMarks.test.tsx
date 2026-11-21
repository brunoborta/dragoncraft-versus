import { single } from '@dcv/engine'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Bag, DeckCount } from './Bag.js'

describe('the crosses over what ran out', () => {
  it('crosses the bag and says the game is ending', () => {
    render(<Bag bag={[single('iron')]} spent />)
    const bag = screen.getByRole('img', { name: 'Bag, 1 tokens left, ran out: the game ends this turn' })
    expect(bag.getAttribute('data-spent')).toBe('true')
  })

  it('leaves a bag that has not run out alone', () => {
    render(<Bag bag={[single('iron')]} />)
    expect(screen.getByRole('img', { name: 'Bag, 1 tokens left' }).getAttribute('data-spent')).toBeNull()
  })

  it('crosses the deck and says the game is ending', () => {
    render(<DeckCount count={0} spent />)
    const deck = screen.getByRole('img', { name: 'Deck, 0 cards left, none left: the game ends this turn' })
    expect(deck.getAttribute('data-spent')).toBe('true')
  })
})
