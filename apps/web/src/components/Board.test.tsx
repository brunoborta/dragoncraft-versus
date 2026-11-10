import { render, screen } from '@testing-library/react'
import { dual, key, single } from '@dcv/engine'
import { describe, expect, it } from 'vitest'
import { Board } from './Board.js'

describe('Board', () => {
  it('draws all 19 spaces', () => {
    render(<Board board={{}} highlights={{}} onSelectHex={() => {}} />)
    expect(screen.getAllByRole('button')).toHaveLength(19)
  })

  it('names an empty space and a stacked one for assistive technology', () => {
    const board = { [key({ q: 0, r: 0 })]: [single('bread'), single('plant')] }
    render(<Board board={board} highlights={{}} onSelectHex={() => {}} />)
    expect(screen.getByLabelText('0,0: Plant, stack of 2')).toBeDefined()
    expect(screen.getByLabelText('1,0: empty')).toBeDefined()
  })

  it('marks a highlighted space', () => {
    const highlights = { [key({ q: 1, r: 0 })]: 'selected' as const }
    render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    expect(screen.getByLabelText('1,0: empty').getAttribute('data-highlight')).toBe('selected')
  })

  it('draws rings and badges above every cell, so nothing can paint over them', () => {
    const { container } = render(<Board board={{}} highlights={{}} onSelectHex={() => {}} />)
    const svg = container.querySelector('svg.board')
    expect(svg?.lastElementChild?.classList.contains('board-overlay')).toBe(true)
  })

  it('gives a highlighted space one ring, carrying its kind', () => {
    const highlights = { [key({ q: 1, r: 0 })]: 'selected' as const }
    const { container } = render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    const rings = container.querySelectorAll('.board-overlay .hex-ring')
    expect(rings).toHaveLength(1)
    expect(rings[0].getAttribute('data-highlight')).toBe('selected')
  })

  it('badges a buried stack with its count, and leaves a lone token alone', () => {
    const board = {
      [key({ q: 0, r: 0 })]: [single('bread'), single('plant')],
      [key({ q: 1, r: 0 })]: [single('iron')],
    }
    const { container } = render(<Board board={board} highlights={{}} onSelectHex={() => {}} />)
    const badges = container.querySelectorAll('.board-overlay .stack-badge')
    expect(badges).toHaveLength(1)
    expect(badges[0].querySelector('text')?.textContent).toBe('2')
  })

  it('paints the selected ring last, so no neighbour covers two of its sides', () => {
    // (0,0) comes before (0,1) and (1,0) on the board, so without a paint order
    // its ring would be drawn first and lose the edges it shares with them
    const highlights = {
      [key({ q: 0, r: 0 })]: 'selected' as const,
      [key({ q: 0, r: 1 })]: 'legal' as const,
      [key({ q: 1, r: 0 })]: 'legal' as const,
    }
    const { container } = render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    const kinds = [...container.querySelectorAll('.board-overlay .hex-ring')].map((ring) =>
      ring.getAttribute('data-highlight'),
    )
    expect(kinds).toEqual(['legal', 'legal', 'selected'])
  })

  it('shows the buried tokens of a stack under the top one', () => {
    const board = { [key({ q: 0, r: 0 })]: [single('bread'), dual('iron', 'potion'), single('plant')] }
    const { container } = render(<Board board={board} highlights={{}} onSelectHex={() => {}} />)
    const cell = screen.getByLabelText('0,0: Plant, stack of 3')
    expect(cell.querySelector('.token')?.getAttribute('data-buried')).toBe('2')
    expect(container.querySelectorAll('.token')).toHaveLength(1)
  })

  it('keeps the whole hexagon as the tap target, though the stone is inset', () => {
    render(<Board board={{}} highlights={{}} onSelectHex={() => {}} />)
    const cell = screen.getByLabelText('0,0: empty')
    const hit = cell.querySelector('.hex-hit')?.getAttribute('points')
    const stone = cell.querySelector('.hex-shape')?.getAttribute('points')
    expect(hit).toBeTruthy()
    expect(hit).not.toBe(stone)
    expect(hit?.split(' ')[0]).toBe('10.00,0.00')
  })

  it('hovers the preview over a stack and says which level it would take', () => {
    const hex = { q: 0, r: 0 }
    const board = { [key(hex)]: [single('bread'), single('meat')] }
    const { container } = render(
      <Board board={board} highlights={{}} preview={{ hex, token: single('crystal') }} onSelectHex={() => {}} />,
    )
    const preview = container.querySelector('.board-overlay .token-preview')
    expect(preview?.getAttribute('data-hex')).toBe('0,0')
    expect(preview?.querySelector('.token-preview-level text')?.textContent).toBe('3 of 3')
  })

  it('gives a preview over an empty space no level seal', () => {
    const hex = { q: 1, r: 0 }
    const { container } = render(
      <Board board={{}} highlights={{}} preview={{ hex, token: single('crystal') }} onSelectHex={() => {}} />,
    )
    expect(container.querySelector('.token-preview')).not.toBeNull()
    expect(container.querySelector('.token-preview-level')).toBeNull()
  })

  it('blurs only the selected ring: the pulsing legal rings stay cheap to draw', () => {
    const highlights = { [key({ q: 0, r: 0 })]: 'selected' as const, [key({ q: 1, r: 0 })]: 'legal' as const }
    const { container } = render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    const filters = [...container.querySelectorAll('.hex-ring')].map((ring) => [ring.getAttribute('data-highlight'), ring.hasAttribute('filter')])
    expect(filters).toEqual([['legal', false], ['selected', true]])
  })
})
