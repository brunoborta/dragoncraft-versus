import { DECK, createGame, single, toPlayerView } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TABLE_OPTIONS } from '../game/settings.js'
import { SettingsDialog } from './SettingsDialog.js'
import { Bag } from './Bag.js'
import { CrystalDiscover } from './CrystalDiscover.js'
import { DiscardDialog } from './DiscardDialog.js'
import { TopBar } from './TopBar.js'

const view = toPlayerView(createGame(1), 0)

describe('the eye: looking at the board behind a choice', () => {
  it('is offered on the crystal choice, and puts it aside', () => {
    const onPeek = vi.fn()
    render(<CrystalDiscover tokens={[single('meat')]} actions={[{ type: 'crystalPick', index: 0 }]} onAct={() => {}} onPeek={onPeek} />)
    fireEvent.click(screen.getByRole('button', { name: /Look at the board/ }))
    expect(onPeek).toHaveBeenCalledOnce()
  })

  it('is offered on the coin choice too', () => {
    const onPeek = vi.fn()
    render(<DiscardDialog hand={DECK.slice(0, 4)} keeping={[]} onToggle={() => {}} onFinish={() => {}} onPeek={onPeek} />)
    fireEvent.click(screen.getByRole('button', { name: /Look at the board/ }))
    expect(onPeek).toHaveBeenCalledOnce()
  })
})

describe('the bag and the option that opens it', () => {
  it('is a figure, not a control, unless told otherwise: the count is always there', () => {
    render(<Bag bag={[single('meat'), single('iron')]} />)
    expect(screen.getByRole('img', { name: 'Bag, 2 tokens left' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('opens when given a way to', () => {
    const onOpen = vi.fn()
    render(<Bag bag={[single('meat')]} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bag, 1 tokens left' }))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('starts off, as the printed game leaves the counting to the player; the card glow starts on', () => {
    expect(DEFAULT_TABLE_OPTIONS.bagComposition).toBe(false)
    expect(DEFAULT_TABLE_OPTIONS.cardGlow).toBe(true)
    expect(DEFAULT_TABLE_OPTIONS.showReputation).toBe(true)
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

describe('the eye', () => {
  it('is one button, icon only, named for screen readers, outside the dialog', () => {
    render(<CrystalDiscover tokens={[single('meat')]} actions={[{ type: 'crystalPick', index: 0 }]} onAct={() => {}} onPeek={() => {}} />)
    const eye = screen.getByRole('button', { name: 'Look at the board' })
    expect(eye.textContent).toBe('')
    expect(eye.closest('[role=dialog]')).toBeNull()
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
