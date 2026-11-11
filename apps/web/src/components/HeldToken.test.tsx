import { createGame, dual, single, toPlayerView } from '@dcv/engine'
import type { Action } from '@dcv/engine'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FireChoice } from './FireChoice.js'
import { HOLD_MS, HeldSlot } from './HeldToken.js'
import { PlayerBar } from './PlayerBar.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

/** A press held long enough to count, then let go. */
function hold(element: Element, release = true): void {
  fireEvent.pointerDown(element, { button: 0 })
  act(() => vi.advanceTimersByTime(HOLD_MS + 10))
  if (release) fireEvent.pointerUp(element)
}

describe('HeldSlot', () => {
  it('shows the token held, and names it with what it does for a screen reader', () => {
    render(<HeldSlot side="you" token={single('meat')} />)
    expect(screen.getByRole('img', { name: 'Your token: Meat. Move one neighbour anywhere' })).toBeDefined()
  })

  it('is an empty dish when nothing is held', () => {
    const { container } = render(<HeldSlot side="opponent" token={null} />)
    expect(container.querySelector('.held-slot')?.getAttribute('data-empty')).toBe('true')
    expect(container.querySelector('.held-glyph')).toBeNull()
  })

  it('shows what the token does while it is held, and not after a mere tap', () => {
    render(<HeldSlot side="you" token={dual('bread', 'potion')} />)
    const token = screen.getByRole('img')

    fireEvent.pointerDown(token, { button: 0 })
    fireEvent.pointerUp(token)
    act(() => vi.advanceTimersByTime(HOLD_MS + 10))
    expect(screen.queryByRole('tooltip')).toBeNull()

    hold(token, false)
    const card = screen.getByRole('tooltip')
    // a dual names each of its two abilities
    expect(card.textContent).toContain('Bread: Draw another token and place it')
    expect(card.textContent).toContain('Potion: Swap any two tokens')
    fireEvent.pointerUp(token)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('waits for the token flying in before showing it', () => {
    const { container } = render(<HeldSlot side="opponent" token={single('iron')} arriving={900} />)
    const glyph = container.querySelector<SVGElement>('.held-glyph')
    expect(glyph?.hasAttribute('data-arriving')).toBe(true)
    expect(glyph?.style.getPropertyValue('--arrive-ms')).toBe('900ms')
  })
})

describe('FireChoice', () => {
  const area = createRef<HTMLDivElement>()
  const at = { q: 0, r: 0 }

  it('is an I for a single token: one fire, and Skip', () => {
    const actions: Action[] = [{ type: 'fireUp', ability: 'meat' }, { type: 'skipFireUp' }]
    const { container } = render(<FireChoice at={at} token={single('meat')} actions={actions} onAct={() => {}} area={area} />)
    expect(container.querySelector('.fire-choice')?.getAttribute('data-shape')).toBe('I')
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Fire up Meat',
      'Skip',
    ])
  })

  it("is a Y for a dual: a fire for each half, in the halves' order, and Skip", () => {
    // offered in the other order: the left half's fire still goes on the left
    const actions: Action[] = [
      { type: 'fireUp', ability: 'plant' },
      { type: 'fireUp', ability: 'iron' },
      { type: 'skipFireUp' },
    ]
    const { container } = render(<FireChoice at={at} token={dual('iron', 'plant')} actions={actions} onAct={() => {}} area={area} />)
    expect(container.querySelector('.fire-choice')?.getAttribute('data-shape')).toBe('Y')
    const fires = [...container.querySelectorAll('.fire-up')].map((b) => b.getAttribute('data-ability'))
    expect(fires).toEqual(['iron', 'plant'])
  })

  it('fires on a tap, and shows what it would do on a hold without firing', () => {
    const onAct = vi.fn()
    const actions: Action[] = [{ type: 'fireUp', ability: 'potion' }, { type: 'skipFireUp' }]
    render(<FireChoice at={at} token={single('potion')} actions={actions} onAct={onAct} area={area} />)
    const fire = screen.getByRole('button', { name: 'Fire up Potion' })

    hold(fire, false)
    expect(screen.getByRole('tooltip').textContent).toContain('Swap any two tokens')
    fireEvent.pointerUp(fire)
    fireEvent.click(fire)
    expect(onAct).not.toHaveBeenCalled()

    fireEvent.pointerDown(fire, { button: 0 })
    fireEvent.pointerUp(fire)
    fireEvent.click(fire)
    expect(onAct).toHaveBeenCalledWith({ type: 'fireUp', ability: 'potion' })

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(onAct).toHaveBeenLastCalledWith({ type: 'skipFireUp' })
  })
})

describe('PlayerBar', () => {
  const view = toPlayerView(createGame(2), 0)

  it('carries Undo beside End turn, always in the same place', () => {
    const onUndo = vi.fn()
    const { container } = render(<PlayerBar view={view} actions={[]} myTurn={false} onAct={() => {}} canUndo onUndo={onUndo} />)
    const undo = screen.getByRole('button', { name: 'Undo' })
    expect(undo.nextElementSibling?.classList.contains('end-turn')).toBe(true)
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledOnce()
    expect(container.querySelector('.player-bar .undo-button')).toBe(undo)
  })

  it('greys Undo out when there is nothing to take back', () => {
    render(<PlayerBar view={view} actions={[]} myTurn={false} onAct={() => {}} canUndo={false} onUndo={() => {}} />)
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
