import { render, screen } from '@testing-library/react'
import { key, single } from '@dcv/engine'
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
})
