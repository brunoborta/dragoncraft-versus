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
    const highlights = { [key({ q: 1, r: 0 })]: 'completes' as const }
    render(<Board board={{}} highlights={highlights} onSelectHex={() => {}} />)
    expect(screen.getByLabelText('1,0: empty').getAttribute('data-highlight')).toBe('completes')
  })
})
