import { key, single } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// the travellers only fly when motion is allowed; the test suite runs with it off
vi.mock('../motion.js', async (original) => ({ ...(await original<typeof import('../motion.js')>()), useReducedMotion: () => false }))
import type { PresentationEvent } from '../game/presentation.js'
import { Board } from './Board.js'
import { hexCenter } from '../geometry.js'
import { TOKEN_RADIUS } from './HexCell.js'
import { BoardMoment, UndoMoment, UnplaceFlight, arrivals, landingLife } from './Moments.js'
import { useBlaze, useSmoulder } from './TokenBlaze.js'

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

  it('leaves a fire-up to the fire over the board, and grows the vine when it came through a plant', () => {
    // the flames themselves are TokenBlaze's, in HTML over the board
    expect(inSvg(<BoardMoment event={fire} />).querySelector('.vine')).toBeNull()
    expect(inSvg(<BoardMoment event={vine} />).querySelector('.vine')).not.toBeNull()
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

describe('a takeback', () => {
  /*
   * A screen with both pillows and a board, each placed by hand: jsdom lays
   * nothing out. The board maps a board unit to 2px, offset by (10, 20).
   */
  function table() {
    const within = document.createElement('div')
    within.innerHTML = `
      <div class="held-slot" data-side="you"><div class="held-anchor"></div></div>
      <div class="held-slot" data-side="opponent"><div class="held-anchor"></div></div>
      <svg class="board"></svg>`
    const rect = (node: Element, left: number, top: number, size: number) => {
      node.getBoundingClientRect = () =>
        ({ left, top, width: size, height: size, right: left + size, bottom: top + size, x: left, y: top, toJSON: () => ({}) }) as DOMRect
    }
    rect(within, 0, 0, 1000)
    rect(within.querySelector('[data-side="you"] .held-anchor')!, 200, 700, 48)
    rect(within.querySelector('[data-side="opponent"] .held-anchor')!, 20, 40, 48)
    ;(within.querySelector('svg.board') as unknown as { getScreenCTM: () => DOMMatrix }).getScreenCTM = () =>
      ({ a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 }) as DOMMatrix
    document.body.append(within)
    return within
  }

  /** Where a drawn element is and how big, from the style motion writes. */
  function placed(node: Element | null | undefined) {
    const style = (node as HTMLElement | null)?.style
    const transform = style?.transform ?? ''
    return {
      x: Number(/translateX\((-?[\d.]+)px\)/.exec(transform)?.[1]),
      y: Number(/translateY\((-?[\d.]+)px\)/.exec(transform)?.[1]),
      width: parseFloat(style?.width ?? 'NaN'),
    }
  }

  /** The middle of a pillow and the token's size there, as `heldSpot` reads them: 2/3 of the anchor, standing on it. */
  const pillow = (left: number, top: number) => ({ x: left + 24, y: top + 48 - 48 * 0.12 - (32 * 1.075) / 2, size: 32 })
  const yours = pillow(200, 700)
  const theirs = pillow(20, 40)
  /** A space on the board, in px, and a token's size there. */
  const space = (q: number, r: number) => {
    const c = hexCenter(at(q, r))
    return { x: 2 * c.x + 10, y: 2 * c.y + 20, size: TOKEN_RADIUS * 2 * 2 }
  }

  const undoEntry: LogEntry = { seat: 0, action: { type: 'place', at: at(0, 0) } }
  const undo = (seat: 0 | 1): Extract<PresentationEvent, { kind: 'undo' }> => ({
    seat,
    entry: undoEntry,
    seq: -1,
    undo: true,
    kind: 'undo',
    board: {},
  })

  function arrows(seat: 0 | 1) {
    const within = table()
    const shown = render(<UndoMoment event={undo(seat)} seat={0} within={within} />)
    const found = [...document.querySelectorAll('.undo-spinning')].map(placed)
    shown.unmount()
    within.remove()
    return found
  }

  const expectAt = (found: ReturnType<typeof placed> | undefined, spot: { x: number; y: number; size: number }) => {
    expect(found?.x).toBeCloseTo(spot.x)
    expect(found?.y).toBeCloseTo(spot.y)
    expect(found?.width).toBeCloseTo(spot.size)
  }

  describe('the arrow', () => {
    it("turns on your pillow when you took it back, and on theirs when they did, at the pillow token's size", () => {
      expect(arrows(0)).toHaveLength(1)
      expectAt(arrows(0)[0], yours)
      expectAt(arrows(1)[0], theirs)
    })

    it('is the arrow alone: no disc behind it to hide the pillow', () => {
      const within = table()
      render(<UndoMoment event={undo(0)} seat={0} within={within} />)
      const arrow = document.querySelector('.undo-spinning') as HTMLElement
      expect(arrow.style.background).toBe('')
      expect(arrow.style.border).toBe('')
      expect(arrow.querySelector('svg')).not.toBeNull()
    })

    it('shows nothing when it has no screen to measure', () => {
      render(<UndoMoment event={undo(0)} seat={0} within={null} />)
      expect(document.querySelector('.undo-spinning')).toBeNull()
    })
  })

  describe('a placement flying home', () => {
    const unplace = (seat: 0 | 1): Extract<PresentationEvent, { kind: 'unplace' }> => ({
      seat,
      entry: undoEntry,
      seq: -2,
      undo: true,
      kind: 'unplace',
      at: at(1, 0),
      id: 'p1',
      token: single('meat'),
      board: {},
      held: single('meat'),
    })

    function flight(seat: 0 | 1) {
      const within = table()
      const shown = render(<UnplaceFlight event={unplace(seat)} seat={0} within={within} />)
      const token = document.querySelector('.unplace-flight')
      const side = document.querySelector('.draw-flight')?.getAttribute('data-side')
      const found = placed(token)
      shown.unmount()
      within.remove()
      return { found, side }
    }

    it('lifts off the space it was placed on, drawn at the size of the pillow it is going to', () => {
      const { found, side } = flight(0)
      expect(side).toBe('you')
      expect(found.x).toBeCloseTo(space(1, 0).x)
      expect(found.y).toBeCloseTo(space(1, 0).y)
      expect(found.width).toBeCloseTo(yours.size)
    })

    it("flies to the opponent's pillow when it was theirs", () => {
      expect(flight(1).side).toBe('opponent')
    })

    it('shows itself on the board as a space with what was under it, from the first frame', () => {
      expect(arrivals(unplace(0))).toEqual({ '1,0': 'uncover' })
    })
  })
})

describe('useBlaze', () => {
  function Probe({ event }: { event: PresentationEvent | null }) {
    const blaze = useBlaze(event)
    return <p>{blaze ? `${blaze.at.q},${blaze.at.r} after ${blaze.delay}` : 'none'}</p>
  }

  it('sets the fired token alight, after its vine when it came through a plant, and lets it burn out after the event', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<Probe event={fire} />)
      expect(screen.getByText('0,0 after 0')).toBeDefined()
      // the event is over before the fire is
      rerender(<Probe event={null} />)
      expect(screen.getByText('0,0 after 0')).toBeDefined()
      // its last embers cool for a while after the flames are out
      act(() => vi.advanceTimersByTime(2000))
      expect(screen.getByText('0,0 after 0')).toBeDefined()
      act(() => vi.advanceTimersByTime(300))
      expect(screen.getByText('none')).toBeDefined()

      rerender(<Probe event={{ ...vine, seq: 1 }} />)
      expect(screen.getByText('1,0 after 420')).toBeDefined()
      rerender(<Probe event={{ ...fire, at: null, seq: 2 }} />)
      expect(screen.getByText('1,0 after 420')).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('useSmoulder', () => {
  function Probe({ spot }: { spot: { at: { q: number; r: number }; ability: 'meat' } | null }) {
    const shown = useSmoulder(spot)
    return <p>{shown ? `${shown.ability} ${shown.out ? 'going out' : 'burning'}` : 'none'}</p>
  }

  it('keeps a smouldering token a moment once it is no longer wanted, going out', () => {
    vi.useFakeTimers()
    try {
      const { rerender } = render(<Probe spot={{ at: at(0, 0), ability: 'meat' }} />)
      expect(screen.getByText('meat burning')).toBeDefined()
      rerender(<Probe spot={null} />)
      expect(screen.getByText('meat going out')).toBeDefined()
      act(() => vi.advanceTimersByTime(800))
      expect(screen.getByText('none')).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })
})
