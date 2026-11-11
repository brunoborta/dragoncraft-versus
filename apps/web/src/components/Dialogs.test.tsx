import { DECK, createInitialState, dual, single, toPlayerView } from '@dcv/engine'
import type { Action } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CrystalDiscover } from './CrystalDiscover.js'
import { GameOver } from './GameOver.js'

describe('CrystalDiscover', () => {
  const tokens = [single('bread'), dual('iron', 'potion'), single('plant')]
  const actions: Action[] = tokens.map((_, index) => ({ type: 'crystalPick', index }))

  it('offers every token the crystal drew, by name, with what it would do', () => {
    render(<CrystalDiscover tokens={tokens} actions={actions} onAct={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Keep one of these' })
    const names = [...dialog.querySelectorAll('.discover-name')].map((el) => el.textContent)
    expect(names).toEqual(['Keep Bread', 'Keep Iron/Potion', 'Keep Plant'])
    expect(dialog.textContent).toContain('Swap any two tokens')
  })

  it('keeps the token tapped', () => {
    const onAct = vi.fn()
    render(<CrystalDiscover tokens={tokens} actions={actions} onAct={onAct} />)
    fireEvent.click(screen.getByRole('button', { name: /Keep Plant/ }))
    expect(onAct).toHaveBeenCalledWith({ type: 'crystalPick', index: 2 })
  })

  it('takes fewer than three when the bag ran short, and says nothing goes back', () => {
    render(<CrystalDiscover tokens={[single('meat')]} actions={[{ type: 'crystalPick', index: 0 }]} onAct={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.queryByText(/go back in the bag/)).toBeNull()
  })

  it('fans the choices from the middle', () => {
    const { container } = render(<CrystalDiscover tokens={tokens} actions={actions} onAct={() => {}} />)
    const angles = [...container.querySelectorAll<HTMLElement>('.discover-choice')].map((el) =>
      el.style.getPropertyValue('--fan-angle'),
    )
    expect(angles).toEqual(['-6deg', '0deg', '6deg'])
  })
})

describe('GameOver, over the board', () => {
  const base = createInitialState(1)
  const tri = DECK.find((card) => card.id === 'tri-bread')
  if (!tri) throw new Error('missing card')
  const view = toPlayerView({ ...base, phase: 'ended', players: [{ ...base.players[0], scored: [tri] }, base.players[1]] }, 0)

  it('can be put away to look at the final board', () => {
    const onViewBoard = vi.fn()
    render(<GameOver view={view} opponentLabel="Machine" restartLabel="New game" onRestart={() => {}} onViewBoard={onViewBoard} />)
    fireEvent.click(screen.getByRole('button', { name: 'View board' }))
    expect(onViewBoard).toHaveBeenCalledOnce()
  })

  it('marks the result, so a loss is drawn in wine', () => {
    const { container } = render(<GameOver view={view} opponentLabel="Machine" restartLabel="New game" onRestart={() => {}} />)
    expect(container.querySelector('.game-over')?.getAttribute('data-result')).toBe('win')
  })
})
