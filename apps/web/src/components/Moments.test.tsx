import { key, single } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// the travellers only fly when motion is allowed; the test suite runs with it off
vi.mock('../motion.js', async (original) => ({ ...(await original<typeof import('../motion.js')>()), useReducedMotion: () => false }))
import type { PresentationEvent } from '../game/presentation.js'
import { Board } from './Board.js'
import { BoardMoment, arrivals, landingLife } from './Moments.js'

const at = (q: number, r: number) => ({ q, r })
const entry: LogEntry = { seat: 1, action: { type: 'endTurn' } }
const base = { seat: 1 as const, entry, seq: 0 }

const place: PresentationEvent = { ...base, kind: 'place', at: at(0, 0), id: 'p1', token: single('meat'), board: { '0,0': [{ token: single('meat'), id: 'p1' }] } }
const move: PresentationEvent = { ...base, kind: 'move', from: at(0, 0), to: at(1, 0), id: 'p1', by: 'meat', board: { '1,0': [{ token: single('meat'), id: 'p1' }] } }
const swap: PresentationEvent = {
  ...base,
  kind: 'swap',
  a: at(0, 0),
  b: at(1, 0),
  ids: ['p1', 'p2'],
  board: { '0,0': [{ token: single('iron'), id: 'p2' }], '1,0': [{ token: single('meat'), id: 'p1' }] },
}
const fire: PresentationEvent = { ...base, kind: 'fireUp', ability: 'meat', at: at(0, 0), board: {} }
const vine: PresentationEvent = { ...base, kind: 'fireUp', ability: 'meat', at: at(1, 0), from: at(0, 0), board: {} }

describe('arrivals', () => {
  it("drops your placed token, and flies the opponent's in from their slot first", () => {
    expect(arrivals(place, 1)).toEqual({ '0,0': 'drop' })
    expect(arrivals(place, 0)).toEqual({ '0,0': 'fly' })
  })

  it('drops a placed token, slides a moved one, and marks both ends of a swap', () => {
    expect(arrivals(place)).toEqual({ '0,0': 'drop' })
    // what a move leaves behind on its old space was there all along: uncovered, not arriving
    expect(arrivals(move)).toEqual({ '1,0': 'slide', '0,0': 'uncover' })
    expect(arrivals(swap)).toEqual({ '0,0': 'swap', '1,0': 'swap' })
    expect(arrivals(fire)).toEqual({})
    expect(arrivals(null)).toEqual({})
  })
})

describe('BoardMoment', () => {
  const inSvg = (node: React.ReactElement) => render(<svg>{node}</svg>).container

  it('sends a traveller across the board for a move, carrying the moved token', () => {
    const c = inSvg(<BoardMoment event={move} />)
    expect(c.querySelectorAll('.traveller')).toHaveLength(1)
  })

  it('sends two travellers for a swap', () => {
    const c = inSvg(<BoardMoment event={swap} />)
    expect(c.querySelectorAll('.traveller')).toHaveLength(2)
  })

  it('bursts into flame where a token fires up', () => {
    const c = inSvg(<BoardMoment event={fire} />)
    expect(c.querySelector('.flame-burst')?.getAttribute('data-ability')).toBe('meat')
    expect(c.querySelector('.vine')).toBeNull()
  })

  it('grows a vine first when the ability came through a plant', () => {
    const c = inSvg(<BoardMoment event={vine} />)
    expect(c.querySelector('.vine')).not.toBeNull()
    expect(c.querySelector('.flame-burst')).not.toBeNull()
  })

  it('draws nothing for a fire-up whose token it does not know', () => {
    const c = inSvg(<BoardMoment event={{ ...fire, at: null }} />)
    expect(c.querySelector('.flame-burst')).toBeNull()
  })
})

describe('Board, under an event', () => {
  const meatOn00 = { [key(at(0, 0))]: [single('meat')] }

  it('lands a placed token in a puff of dust and a flash, the board dimming only for the opponent', () => {
    const yours = render(<Board board={meatOn00} event={place} viewer={1} highlights={{}} onSelectHex={() => {}} />).container
    expect(yours.querySelector('.landing')?.getAttribute('data-side')).toBe('you')
    expect(yours.querySelector('.landing-puff')).not.toBeNull()
    expect(yours.querySelector('.landing-flash')).not.toBeNull()
    expect(yours.querySelector('.landing-dim')).toBeNull()

    const theirs = render(<Board board={meatOn00} event={place} viewer={0} highlights={{}} onSelectHex={() => {}} />).container
    expect(theirs.querySelector('.landing')?.getAttribute('data-side')).toBe('opponent')
    expect(theirs.querySelector('.landing-dim')).not.toBeNull()
  })

  it('dims the other eighteen spaces, never a square around the board', () => {
    const theirs = render(<Board board={meatOn00} event={place} viewer={0} highlights={{}} onSelectHex={() => {}} />).container
    const dim = theirs.querySelector('.landing-dim')
    expect(dim?.tagName.toLowerCase()).not.toBe('rect')
    expect(theirs.querySelectorAll('.landing-dim polygon')).toHaveLength(18)
  })

  it('keeps the landing after the placement is over, until its dust has settled', () => {
    vi.useFakeTimers()
    try {
      const { container, rerender } = render(<Board board={meatOn00} event={place} viewer={1} highlights={{}} onSelectHex={() => {}} />)
      rerender(<Board board={meatOn00} event={null} viewer={1} highlights={{}} onSelectHex={() => {}} />)
      expect(container.querySelector('.landing')).not.toBeNull()
      act(() => vi.advanceTimersByTime(landingLife(true) + 1))
      expect(container.querySelector('.landing')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('tells the placed token to drop, and the dust rises where it lands', () => {
    const board = { [key(at(0, 0))]: [single('meat')] }
    const { container } = render(
      <Board board={board} ids={{ '0,0': ['p1'] }} event={place} viewer={1} highlights={{}} onSelectHex={() => {}} />,
    )
    const cell = screen.getByLabelText('0,0: Meat, stack of 1')
    expect(cell.querySelector('.token-arrive')?.getAttribute('data-arrival')).toBe('drop')
    // the dust is the board's: drawn over every cell, so no neighbour hides it
    expect(container.querySelector('.board-overlay .landing-puff')).not.toBeNull()
  })

  describe('a token moved off the top of a stack', () => {
    // meat had iron and bread under it at 0,0; it moved alone to 1,0, onto a plant
    const stackMove: PresentationEvent = {
      ...base,
      kind: 'move',
      from: at(0, 0),
      to: at(1, 0),
      id: 'm',
      by: 'meat',
      board: {
        '0,0': [{ token: single('iron'), id: 'i' }, { token: single('bread'), id: 'b' }],
        '1,0': [{ token: single('plant'), id: 'p' }, { token: single('meat'), id: 'm' }],
      },
    }
    const after = {
      '0,0': [single('iron'), single('bread')],
      '1,0': [single('plant'), single('meat')],
    }
    const ids = { '0,0': ['i', 'b'], '1,0': ['p', 'm'] }
    const draw = () =>
      render(<Board board={after} ids={ids} event={stackMove} viewer={1} highlights={{}} onSelectHex={() => {}} />).container

    it('sends only the top token across, never the stack it came from', () => {
      const c = draw()
      const travellers = c.querySelectorAll('.traveller')
      expect(travellers).toHaveLength(1)
      // one face, and no buried edges under it
      expect(travellers[0].querySelector('.token')?.hasAttribute('data-buried')).toBe(false)
    })

    it('leaves what was under it standing still: the uncovered token does not fade or slide in', () => {
      draw()
      const from = screen.getByLabelText('0,0: Bread, stack of 2')
      expect(from.querySelector('.token-arrive')?.getAttribute('data-arrival')).toBe('uncover')
      // nothing to wait for, so nothing is shown in the meantime
      expect(from.querySelector('.token-arrive-before')).toBeNull()
      expect(from.querySelector('.token-arrive-body .token')?.getAttribute('data-buried')).toBe('1')
    })

    it('keeps the stack it lands on as it was, face and all, until the traveller lands', () => {
      draw()
      const to = screen.getByLabelText('1,0: Meat, stack of 2')
      expect(to.querySelector('.token-arrive')?.getAttribute('data-arrival')).toBe('slide')
      // meanwhile: the plant that was on top, drawn whole — a face, not a bare edge
      const before = to.querySelector('.token-arrive-before .token')
      expect(before).not.toBeNull()
      expect(before?.hasAttribute('data-buried')).toBe(false)
      expect(before?.querySelector('.token-icon')).not.toBeNull()
      // and the stack as it will be, waiting to show
      expect(to.querySelector('.token-arrive-body .token')?.getAttribute('data-buried')).toBe('1')
    })

    it('shows nothing in the meantime on a space that was empty', () => {
      const ids2 = { '1,0': ['m'] }
      const lone: PresentationEvent = { ...stackMove, board: { '1,0': [{ token: single('meat'), id: 'm' }] } }
      render(<Board board={{ '1,0': [single('meat')] }} ids={ids2} event={lone} viewer={1} highlights={{}} onSelectHex={() => {}} />)
      expect(screen.getByLabelText('1,0: Meat, stack of 1').querySelector('.token-arrive-before')).toBeNull()
    })
  })
})
