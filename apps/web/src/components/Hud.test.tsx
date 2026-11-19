import { createGame, dual, single, toPlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TABLE_OPTIONS } from '../game/settings.js'
import { Bag, BagDialog, DeckCount, bagComposition } from './Bag.js'
import { CoinPurse } from './CoinPurse.js'
import { SettingsDialog } from './SettingsDialog.js'
import { TopBar } from './TopBar.js'

const view = toPlayerView(createGame(1), 0)

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

  it('is a figure, not a control, unless told otherwise: the count is always there', () => {
    render(<Bag bag={[single('meat'), single('iron')]} />)
    expect(screen.getByRole('img', { name: 'Bag, 2 tokens left' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('starts off, as the printed game leaves the counting to the player; the card glow starts on', () => {
    expect(DEFAULT_TABLE_OPTIONS.bagComposition).toBe(false)
    expect(DEFAULT_TABLE_OPTIONS.cardGlow).toBe(true)
    expect(DEFAULT_TABLE_OPTIONS.showReputation).toBe(true)
  })

  it('lists the composition, never an order', () => {
    render(<BagDialog bag={bag} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'What is left in the bag' })
    const rows = [...dialog.querySelectorAll('.bag-list li')].map((li) => li.textContent)
    expect(rows).toEqual(['Bread× 2', 'Crystal× 1', 'Iron/Potion× 1'])
  })
})

describe('DeckCount', () => {
  it('says how many cards are left in the deck, and nothing of which', () => {
    const { container } = render(<DeckCount count={17} />)
    expect(screen.getByRole('img', { name: 'Deck, 17 cards left' })).toBeDefined()
    expect(container.textContent).toBe('17')
  })
})

describe('the options during a game', () => {
  it('can be changed against the machine', () => {
    const onChange = vi.fn()
    render(<SettingsDialog options={DEFAULT_TABLE_OPTIONS} onChange={onChange} onClose={() => {}} />)
    fireEvent.click(screen.getByLabelText(/Show what is left in the bag/))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_TABLE_OPTIONS, bagComposition: true })
  })

  it('are read-only online, where the host chose for both players', () => {
    render(<SettingsDialog options={DEFAULT_TABLE_OPTIONS} onClose={() => {}} />)
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(3)
    for (const box of boxes) expect(box.disabled).toBe(true)
    expect(screen.getByText(/Chosen by whoever opened this game/)).toBeDefined()
  })
})

describe('the top of the screen', () => {
  it('carries no title: the name belongs to the screens before the game', () => {
    render(<TopBar view={view} onOpenLog={() => {}} label="Medium" detail="Seed 1" />)
    expect(screen.queryByText('Dragoncraft Versus')).toBeNull()
  })

  it('names the opponent and the game on the plate, under the name', () => {
    render(<TopBar view={view} onOpenLog={() => {}} label="Medium" detail="Seed 1" />)
    const plate = screen.getByLabelText('Opponent')
    expect(plate.textContent).toContain('Medium')
    expect(plate.textContent).toContain('Seed 1')
  })

  it('offers the log, and settings when there is somewhere to open them', () => {
    const onOpenSettings = vi.fn()
    render(<TopBar view={view} onOpenLog={() => {}} onOpenSettings={onOpenSettings} />)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onOpenSettings).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Full log' })).toBeDefined()
  })
})
