import { DECK, createInitialState, dual, single, toPlayerView } from '@dcv/engine'
import type { Action } from '@dcv/engine'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CrystalArch } from './CrystalArch.js'
import { GameOver } from './GameOver.js'

describe('CrystalArch', () => {
  const tokens = [single('bread'), dual('iron', 'potion'), single('plant')]
  const actions: Action[] = tokens.map((_, index) => ({ type: 'crystalPick', index }))

  it('offers every token the crystal drew, bare: named for the reader, no dialog, no description', () => {
    const { container } = render(<CrystalArch tokens={tokens} actions={actions} onAct={() => {}} />)
    const names = [...container.querySelectorAll('button')].map((el) => el.getAttribute('aria-label'))
    expect(names).toEqual(['Keep Bread', 'Keep Iron/Potion', 'Keep Plant'])
    expect(container.querySelector('[role=dialog]')).toBeNull()
    expect(container.textContent).not.toContain('Swap any two tokens')
  })

  it('keeps the token tapped', () => {
    const onAct = vi.fn()
    render(<CrystalArch tokens={tokens} actions={actions} onAct={onAct} />)
    fireEvent.click(screen.getByRole('button', { name: 'Keep Plant' }))
    expect(onAct).toHaveBeenCalledWith({ type: 'crystalPick', index: 2 })
  })

  it('takes fewer than three when the bag ran short', () => {
    render(<CrystalArch tokens={[single('meat')]} actions={[{ type: 'crystalPick', index: 0 }]} onAct={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('arches the tokens: the middle one risen to the crown, the outer ones on the tray, turned', () => {
    const { container } = render(<CrystalArch tokens={tokens} actions={actions} onAct={() => {}} />)
    const frames = [...container.querySelectorAll<HTMLElement>('.crystal-slot-frame')]
    expect(frames.map((el) => el.style.getPropertyValue('--arch-rise'))).toEqual(['0px', '14px', '0px'])
    expect(frames.map((el) => el.style.getPropertyValue('--arch-turn'))).toEqual(['-8deg', '0deg', '8deg'])
  })

  it('hides a slot whose token has not landed yet, but keeps its place for the flight to aim at', () => {
    const { container } = render(
      <CrystalArch tokens={tokens} actions={actions} onAct={() => {}} arrival={(index) => (index === 0 ? 0 : -1)} />,
    )
    const slots = [...container.querySelectorAll<HTMLElement>('.crystal-slot')]
    expect(slots.map((el) => el.hasAttribute('data-waiting'))).toEqual([false, true, true])
    expect(slots.map((el) => el.getAttribute('data-slot'))).toEqual(['0', '1', '2'])
  })
})

describe('GameOver, over the board', () => {
  const base = createInitialState(1)
  const tri = DECK.find((card) => card.id === 'tri-bread')
  if (!tri) throw new Error('missing card')
  const view = toPlayerView({ ...base, phase: 'ended', players: [{ ...base.players[0], scored: [tri] }, base.players[1]] }, 0)

  it('can be put away to look at the final board', () => {
    const onClose = vi.fn()
    render(<GameOver view={view} opponentLabel="Machine" restartLabel="New game" onRestart={() => {}} onClose={onClose} />)
    expect(screen.queryByRole('button', { name: 'View board' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('marks the result, so a loss is drawn in wine', () => {
    const { container } = render(<GameOver view={view} opponentLabel="Machine" restartLabel="New game" onRestart={() => {}} />)
    expect(container.querySelector('.game-over')?.getAttribute('data-result')).toBe('win')
  })
})
