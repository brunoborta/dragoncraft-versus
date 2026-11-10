import { createGame, key, single, toPlayerView } from '@dcv/engine'
import type { LogEntry, PlayerView } from '@dcv/engine'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Animation is off under test (that is what keeps the DOM tests instant), so
 * to see the queue actually play, these tests switch it on with a mock and
 * drive the clock by hand.
 */
const motion = vi.hoisted(() => ({ off: true }))
vi.mock('../motion.js', () => ({
  get ANIMATIONS_OFF() {
    return motion.off
  },
  useReducedMotion: () => false,
}))

const { usePresentation } = await import('./usePresentation.js')
const { HOLD } = await import('./presentation.js')

const base = toPlayerView(createGame(4), 0)
const empty: PlayerView = { ...base, board: {}, log: [], pending: [] }

/** A view after these entries, with the board they produce. */
function after(entries: LogEntry[], board: PlayerView['board']): PlayerView {
  return { ...empty, log: entries, board }
}

const drawMeat: LogEntry = { seat: 1, action: { type: 'draw', token: single('meat') } }
const placeMeat: LogEntry = { seat: 1, action: { type: 'place', at: { q: 0, r: 0 } } }
const moveMeat: LogEntry = { seat: 1, action: { type: 'meatMove', from: { q: 0, r: 0 }, to: { q: 1, r: 0 } } }
const at00 = key({ q: 0, r: 0 })
const at10 = key({ q: 1, r: 0 })

describe('usePresentation, animation off (as in every other test)', () => {
  it('shows the real board at once', () => {
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: empty } })
    rerender({ view: after([drawMeat, placeMeat], { [at00]: [single('meat')] }) })
    expect(result.current.board).toEqual({ [at00]: [single('meat')] })
    expect(result.current.playing).toBe(false)
  })

  it("announces the opponent's moves for a screen reader", () => {
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: empty } })
    rerender({ view: after([drawMeat, placeMeat], { [at00]: [single('meat')] }) })
    expect(result.current.announcement).toMatch(/Opponent: .*Meat.*Opponent: Place on 0,0/)
  })

  it('snaps on an undo, where the log shrinks', () => {
    const one = after([drawMeat, placeMeat], { [at00]: [single('meat')] })
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: one } })
    rerender({ view: after([drawMeat], {}) })
    expect(result.current.board).toEqual({})
  })

  it('snaps when the script cannot explain the new view', () => {
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: empty } })
    // a move from an empty space: the script refuses it, the view wins
    rerender({ view: after([moveMeat], { [at10]: [single('meat')] }) })
    expect(result.current.board).toEqual({ [at10]: [single('meat')] })
  })
})

describe('usePresentation, animation on', () => {
  beforeEach(() => {
    motion.off = false
    vi.useFakeTimers()
  })
  afterEach(() => {
    motion.off = true
    vi.useRealTimers()
  })

  it('plays one event at a time, keeping a token identity across a move', () => {
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: empty } })
    rerender({ view: after([drawMeat, placeMeat, moveMeat], { [at10]: [single('meat')] }) })

    // the opponent's draw is the bag's moment first
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.event?.kind).toBe('draw')
    act(() => vi.advanceTimersByTime(HOLD.drawTheirs + 1))
    expect(result.current.event?.kind).toBe('place')
    expect(result.current.board).toEqual({ [at00]: [single('meat')] })
    const placed = result.current.ids[at00]?.[0]

    act(() => vi.advanceTimersByTime(HOLD.place + 1))
    expect(result.current.event?.kind).toBe('move')
    expect(result.current.board).toEqual({ [at10]: [single('meat')] })
    expect(result.current.ids[at10]?.[0]).toBe(placed)

    act(() => vi.advanceTimersByTime(HOLD.move + 1))
    expect(result.current.playing).toBe(false)
  })

  it('holds an event back while the gate says so, and asks again when woken', () => {
    let closed = true
    const { result, rerender } = renderHook(
      ({ view, wake }) => usePresentation(view, { gate: () => closed, wake }),
      { initialProps: { view: empty, wake: 0 } },
    )
    rerender({ view: after([drawMeat, placeMeat], { [at00]: [single('meat')] }), wake: 0 })
    act(() => vi.advanceTimersByTime(50))
    expect(result.current.event).toBeNull()
    expect(result.current.remaining).toHaveLength(2)
    expect(result.current.board).toEqual({})

    closed = false
    rerender({ view: after([drawMeat, placeMeat], { [at00]: [single('meat')] }), wake: 1 })
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.event?.kind).toBe('draw')
  })

  it('jumps to the end on a skip: a tap never waits on an animation', () => {
    const { result, rerender } = renderHook(({ view }) => usePresentation(view), { initialProps: { view: empty } })
    rerender({ view: after([drawMeat, placeMeat, moveMeat], { [at10]: [single('meat')] }) })
    act(() => vi.advanceTimersByTime(1))
    expect(result.current.playing).toBe(true)

    act(() => result.current.skip())
    expect(result.current.playing).toBe(false)
    expect(result.current.board).toEqual({ [at10]: [single('meat')] })
  })
})
