import { single } from '@dcv/engine'
import type { LogEntry } from '@dcv/engine'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEndBanner } from './EndBanner.js'
import { BANNER_HOLD } from './TurnBanner.js'

type Props = Parameters<typeof useEndBanner>[0]

const entry = (action: LogEntry['action']): LogEntry => ({ seat: 0, action })
const draw = entry({ type: 'draw', token: single('meat') })
const opening: LogEntry[] = [draw, entry({ type: 'place', at: { q: 0, r: 0 } })]
// placed a crystal, fired it up, and its draws emptied the bag: seq 2 is the fire-up, 3 the first draw
const crystal: LogEntry[] = [...opening, entry({ type: 'fireUp', ability: 'crystal' }), draw, draw, draw]

const playing: Props['view'] = {
  endTriggered: false,
  log: opening,
  deckCount: 20,
  bag: [single('iron'), single('plant')],
  extrasAdded: false,
  phase: 'play',
}
const bagRanOut: Props['view'] = { ...playing, endTriggered: true, log: crystal, bag: [] }
const start: Props = { view: playing, remaining: [], menuOver: false, turn: { pending: false, up: false } }

describe('useEndBanner', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('says nothing while the end has not triggered', () => {
    const { result } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(false)
    expect(result.current.revealed).toBe(false)
  })

  it('goes up when the end triggers, says why, and comes down after the hold', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut })
    expect(result.current.banner?.cause).toBe('bag')
    expect(result.current.revealed).toBe(true)
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(false)
    expect(result.current.revealed).toBe(true)
  })

  it('waits for the plays before the trigger, and holds back the ones from it on', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut, remaining: [{ seq: 2 }, { seq: 3 }, { seq: 4 }] })
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(true)
    expect(result.current.revealed).toBe(false)
    expect(result.current.holds(3)).toBe(true)
    expect(result.current.holds(2)).toBe(false)

    rerender({ ...start, view: bagRanOut, remaining: [{ seq: 3 }, { seq: 4 }] })
    expect(result.current.banner?.cause).toBe('bag')
    expect(result.current.holds(3)).toBe(true)
    act(() => vi.advanceTimersByTime(BANNER_HOLD + 1))
    expect(result.current.holds(3)).toBe(false)
  })

  it('never holds a takeback', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut, remaining: [{ seq: 2 }] })
    expect(result.current.holds(-1)).toBe(false)
  })

  it('shows no banner on a game that had already triggered when the screen opened', () => {
    const { result } = renderHook((props: Props) => useEndBanner(props), { initialProps: { ...start, view: bagRanOut } })
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(false)
    expect(result.current.revealed).toBe(true)
  })

  it('shows no banner when the view jumps instead of moving on', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), {
      initialProps: { ...start, view: { ...playing, log: crystal } },
    })
    rerender({ ...start, view: { ...bagRanOut, log: opening } })
    expect(result.current.banner).toBeNull()
    expect(result.current.revealed).toBe(true)
  })

  it('lets the turn banner go first when the bag ran out', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut, turn: { pending: true, up: false } })
    expect(result.current.banner).toBeNull()
    rerender({ ...start, view: bagRanOut, turn: { pending: false, up: false } })
    expect(result.current.banner?.cause).toBe('bag')
  })

  it('goes before the turn banner when the deck ran out', () => {
    const deckRanOut: Props['view'] = {
      ...playing,
      endTriggered: true,
      deckCount: 0,
      log: [...opening, entry({ type: 'endTurn' })],
    }
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: deckRanOut, turn: { pending: true, up: false } })
    expect(result.current.banner?.cause).toBe('deck')
  })

  it('never goes up over a turn banner or a menu', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut, turn: { pending: false, up: true } })
    expect(result.current.banner).toBeNull()
    rerender({ ...start, view: bagRanOut, menuOver: true })
    expect(result.current.banner).toBeNull()
    rerender({ ...start, view: bagRanOut })
    expect(result.current.banner?.cause).toBe('bag')
  })

  it('is dropped if the game is over before it could go up', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut, menuOver: true })
    rerender({ ...start, view: { ...bagRanOut, phase: 'ended' } })
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(false)
    expect(result.current.revealed).toBe(true)
  })

  it('goes away on a tap', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: start })
    rerender({ ...start, view: bagRanOut })
    act(() => result.current.dismiss())
    expect(result.current.banner).toBeNull()
    expect(result.current.pending).toBe(false)
  })

  it('forgets the end when a new game starts on the same screen', () => {
    const { result, rerender } = renderHook((props: Props) => useEndBanner(props), { initialProps: { ...start, view: bagRanOut } })
    rerender({ ...start, view: { ...playing, log: [draw] } })
    expect(result.current.revealed).toBe(false)
  })
})
