import { DECK, createGame, single, toPlayerView } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PresentationEvent } from '../game/presentation.js'
import { Hand } from './Hand.js'
import { BoardMoment } from './Moments.js'

const motion = vi.hoisted(() => ({ off: true }))
vi.mock('../motion.js', async (original) => ({
  ...(await original<typeof import('../motion.js')>()),
  get ANIMATIONS_OFF() {
    return motion.off
  },
  useReducedMotion: () => false,
}))
const { useCountUp } = await import('../game/useCountUp.js')

describe('useCountUp (M10, M14)', () => {
  beforeEach(() => {
    motion.off = false
    // the count runs on animation frames: the fake clock has to drive those too
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  })
  afterEach(() => {
    motion.off = true
    vi.useRealTimers()
  })

  it('counts up to a higher value after its delay, not at once', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { delay: 100, duration: 300 }), { initialProps: { v: 2 } })
    rerender({ v: 5 })
    expect(result.current).toBe(2)
    act(() => vi.advanceTimersByTime(100 + 400))
    expect(result.current).toBe(5)
  })

  it('snaps down: an undo celebrates nothing', () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { delay: 100 }), { initialProps: { v: 5 } })
    rerender({ v: 2 })
    expect(result.current).toBe(2)
  })

  it('is instant when animation is off, as in every other test', () => {
    motion.off = true
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, { delay: 100 }), { initialProps: { v: 2 } })
    rerender({ v: 5 })
    expect(result.current).toBe(5)
  })
})

describe('the card-glow option', () => {
  it('lifts the cards the hovering token would complete, and only those', () => {
    const view = toPlayerView(createGame(1), 0)
    const [first, second] = view.you.hand
    const { container } = render(<Hand view={view} actions={[]} onAct={() => {}} completing={new Set([first.id])} />)
    const cards = [...container.querySelectorAll('.card')]
    expect(cards[0].getAttribute('data-completes')).toBe('true')
    expect(cards[1].hasAttribute('data-completes')).toBe(false)
    expect(second).toBeDefined()
  })
})

describe('the score moment on the board', () => {
  it('lights the three spaces the card matched, in turn', () => {
    const entry: LogEntry = { seat: 0, action: { type: 'scoreCard', cardId: 'line-bread' } }
    const card = DECK.find((c) => c.id === 'line-bread')!
    const event: PresentationEvent = {
      seat: 0,
      entry,
      seq: 0,
      kind: 'score',
      cardId: card.id,
      card,
      hexes: [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }],
      board: { '0,0': [{ token: single('bread'), id: 'a' }] },
    }
    const { container } = render(
      <svg>
        <BoardMoment event={event} />
      </svg>,
    )
    const rings = [...container.querySelectorAll<SVGCircleElement>('.score-ring')]
    expect(rings).toHaveLength(3)
    expect(rings.map((ring) => ring.style.getPropertyValue('--i'))).toEqual(['0', '1', '2'])
  })
})
