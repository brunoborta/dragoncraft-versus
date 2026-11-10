import { dual, single } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Bag, BagDialog, bagComposition } from './Bag.js'
import { CoinPurse } from './CoinPurse.js'

describe('CoinPurse', () => {
  it('draws a coin per coin held and an empty slot per coin spent', () => {
    const { container } = render(<CoinPurse coins={1} canSpend onSpend={() => {}} />)
    expect(container.querySelectorAll('.coin')).toHaveLength(1)
    expect(container.querySelectorAll('.coin-slot[data-empty="true"]')).toHaveLength(2)
  })

  it('spends a coin when tapped, if spending is allowed', () => {
    const onSpend = vi.fn()
    render(<CoinPurse coins={3} canSpend onSpend={onSpend} />)
    fireEvent.click(screen.getByRole('button', { name: 'Spend a coin' }))
    expect(onSpend).toHaveBeenCalledOnce()
  })

  it('stays on screen but does nothing when spending is not allowed', () => {
    render(<CoinPurse coins={3} canSpend={false} onSpend={() => {}} />)
    expect((screen.getByRole('button', { name: 'Spend a coin' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Bag', () => {
  const bag = [single('bread'), single('bread'), single('crystal'), dual('iron', 'potion')]

  it('counts what is left of each token', () => {
    expect(bagComposition(bag).map(({ token, count }) => [token.kind, count])).toEqual([
      ['single', 2],
      ['single', 1],
      ['dual', 1],
    ])
  })

  it('shows how many tokens are left and opens on a tap', () => {
    const onOpen = vi.fn()
    render(<Bag bag={bag} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bag, 4 tokens left' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('lists the composition, never an order', () => {
    render(<BagDialog bag={bag} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'What is left in the bag' })
    const rows = [...dialog.querySelectorAll('.bag-list li')].map((li) => li.textContent)
    expect(rows).toEqual(['Bread× 2', 'Crystal× 1', 'Iron/Potion× 1'])
  })
})
