import { createGame, legalActions, toPlayerView } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { ClientMessage, ServerMessage } from '@dcv/protocol'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomStorage, SeatMemory } from './roomStorage.js'
import { AWAKE_EVERY_MS, useRemoteTable } from './useRemoteTable.js'
import type { SocketLike } from './useRemoteTable.js'

class FakeSocket implements SocketLike {
  sent: ClientMessage[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ClientMessage)
  }
  close(): void {
    this.closed = true
  }
  /** The server side of the conversation. */
  receive(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) })
  }
}

function memoryStorage(): RoomStorage & { store: Map<string, SeatMemory> } {
  const store = new Map<string, SeatMemory>()
  return {
    store,
    remember: (id, memory) => void store.set(id, memory),
    recall: (id) => store.get(id) ?? null,
  }
}

function harness(room: string | null, storage = memoryStorage()) {
  const sockets: FakeSocket[] = []
  const connect = () => {
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  }
  const rendered = renderHook(() => useRemoteTable({ url: 'ws://test', room, connect, storage }))
  return { ...rendered, sockets, storage, latest: () => sockets[sockets.length - 1] }
}

const state = createGame(5)
const viewMessage = (seat: 0 | 1): ServerMessage => ({
  type: 'view',
  view: toPlayerView(state, seat),
  actions: state.current === seat ? legalActions(state) : [],
  opponentConnected: true,
})

describe('useRemoteTable', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('asks for a new room when given none, and exposes the id the server picks', () => {
    const h = harness(null)
    expect(h.result.current.status).toEqual({ kind: 'connecting' })
    act(() => h.latest().onopen?.())
    expect(h.latest().sent).toEqual([{ type: 'create' }])

    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: 0, token: 'tok-a', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive({ type: 'waiting' }))
    expect(h.result.current.roomId).toBe('ROOM01')
    expect(h.result.current.seat).toBe(0)
    expect(h.result.current.status).toEqual({ kind: 'waiting' })
    expect(h.storage.recall('ROOM01')).toEqual({ token: 'tok-a', seat: 0 })
  })

  it('joins the room it was given, with the token it remembers for it', () => {
    const storage = memoryStorage()
    storage.remember('ROOM01', { token: 'old', seat: 1 })
    const h = harness('ROOM01', storage)
    act(() => h.latest().onopen?.())
    expect(h.latest().sent).toEqual([{ type: 'join', room: 'ROOM01', token: 'old' }])
  })

  it('joins without a token when it has none', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    expect(h.latest().sent).toEqual([{ type: 'join', room: 'ROOM01' }])
  })

  it('mirrors the view and its actions, sends a move, and offers nothing until the next view', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive(viewMessage(state.current)))

    expect(h.result.current.status).toEqual({ kind: 'playing' })
    expect(h.result.current.view?.seat).toBe(state.current)
    expect(h.result.current.actions.length).toBeGreaterThan(0)
    expect(h.result.current.canUndo).toBe(false)

    const action = h.result.current.actions[0]
    act(() => h.result.current.perform(action))
    expect(h.latest().sent.at(-1)).toEqual({ type: 'action', action })
    expect(h.result.current.actions).toEqual([])
  })

  it('offers undo when the server says so, sends it, and offers nothing until the next view', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() =>
      h.latest().receive({
        type: 'view',
        view: toPlayerView(state, state.current),
        actions: legalActions(state),
        opponentConnected: true,
        canUndo: true,
      }),
    )

    expect(h.result.current.canUndo).toBe(true)
    act(() => h.result.current.undo())
    expect(h.latest().sent.at(-1)).toEqual({ type: 'undo' })
    expect(h.result.current.canUndo).toBe(false)
    expect(h.result.current.actions).toEqual([])
  })

  it('relays who is asking to play again, asks itself, and starts over when the game moves', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive(viewMessage(state.current)))

    act(() => h.latest().receive({ type: 'rematch', youWant: false, opponentWants: true }))
    expect(h.result.current.rematch.opponentWants).toBe(true)

    act(() => h.result.current.rematch.request())
    expect(h.latest().sent.at(-1)).toEqual({ type: 'rematch' })
    // said at once, so the button answers the tap
    expect(h.result.current.rematch.youWant).toBe(true)

    // the server starts the next game: the asking is spent
    act(() =>
      h.latest().receive({
        type: 'view',
        view: toPlayerView(state, state.current),
        actions: legalActions(state),
        opponentConnected: true,
        game: 1,
      }),
    )
    expect(h.result.current.game).toBe(1)
    expect(h.result.current.rematch).toMatchObject({ youWant: false, opponentWants: false })
  })

  it('says leaving, and hears when the opponent left: the asking is off', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive(viewMessage(state.current)))
    act(() => h.latest().receive({ type: 'rematch', youWant: false, opponentWants: true }))

    act(() => h.latest().receive({ type: 'opponentLeft' }))
    expect(h.result.current.rematch).toMatchObject({ opponentLeft: true, opponentWants: false, youWant: false })

    act(() => h.result.current.rematch.leave())
    expect(h.latest().sent.at(-1)).toEqual({ type: 'leave' })
  })

  it('reconnects with the token after a drop, backing off, and withdraws the actions meanwhile', () => {
    const h = harness(null)
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 'tok', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive(viewMessage(state.current)))
    expect(h.result.current.actions.length).toBeGreaterThan(0)

    act(() => h.latest().onclose?.())
    expect(h.result.current.status).toEqual({ kind: 'connecting' })
    expect(h.result.current.actions).toEqual([])
    // the last view stays on screen while we are away
    expect(h.result.current.view).not.toBeNull()
    expect(h.sockets).toHaveLength(1)

    act(() => void vi.advanceTimersByTime(999))
    expect(h.sockets).toHaveLength(1)
    act(() => void vi.advanceTimersByTime(1))
    expect(h.sockets).toHaveLength(2)

    // the second attempt waits twice as long
    act(() => h.latest().onclose?.())
    act(() => void vi.advanceTimersByTime(1999))
    expect(h.sockets).toHaveLength(2)
    act(() => void vi.advanceTimersByTime(1))
    expect(h.sockets).toHaveLength(3)

    act(() => h.latest().onopen?.())
    expect(h.latest().sent).toEqual([{ type: 'join', room: 'ROOM01', token: 'tok' }])
  })

  it('gives up on a refusal that will not change, and closes the socket', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'error', code: 'room-full', message: 'Both seats in this room are taken' }))
    expect(h.result.current.status).toEqual({ kind: 'closed', reason: 'Both seats in this room are taken' })
    expect(h.latest().closed).toBe(true)

    // and does not try again
    act(() => h.latest().onclose?.())
    act(() => void vi.advanceTimersByTime(60_000))
    expect(h.sockets).toHaveLength(1)
  })

  it('shrugs off a refusal of one move: the view that follows is the truth', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => h.latest().receive(viewMessage(state.current)))
    act(() => h.latest().receive({ type: 'error', code: 'illegal-action', message: 'no' }))
    expect(h.result.current.status).toEqual({ kind: 'playing' })
    act(() => h.latest().receive(viewMessage(state.current)))
    expect(h.result.current.actions.length).toBeGreaterThan(0)
  })

  it('tracks the other seat coming and going', () => {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive(viewMessage(0)))
    expect(h.result.current.opponentConnected).toBe(true)
    act(() => h.latest().receive({ type: 'presence', opponentConnected: false }))
    expect(h.result.current.opponentConnected).toBe(false)
  })

  it('closes the socket when unmounted', () => {
    const h = harness('ROOM01')
    h.unmount()
    expect(h.latest().closed).toBe(true)
  })
})

describe('useRemoteTable: takebacks and giving up', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function seated() {
    const h = harness('ROOM01')
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: 0, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    return h
  }

  it('counts a takeback when the log comes back shorter, whoever made it', () => {
    const h = seated()
    const placed = state
    const moved = { ...toPlayerView(placed, 0), log: [...placed.log, { seat: placed.current, action: { type: 'skipFireUp' as const } }] }
    act(() => h.latest().receive({ type: 'view', view: moved, actions: [], opponentConnected: true }))
    expect(h.result.current.undos).toBe(0)

    act(() => h.latest().receive(viewMessage(0)))
    expect(h.result.current.undos).toBe(1)

    // a move is not a takeback
    act(() => h.latest().receive({ type: 'view', view: moved, actions: [], opponentConnected: true }))
    expect(h.result.current.undos).toBe(1)
  })

  it('counts no takeback when a rematch starts a new game', () => {
    const h = seated()
    const ended = { ...toPlayerView(state, 0), phase: 'ended' as const, log: [...state.log, { seat: 0 as const, action: { type: 'gameOver' as const } }] }
    act(() => h.latest().receive({ type: 'view', view: ended, actions: [], opponentConnected: true, game: 0 }))
    act(() => h.latest().receive({ ...viewMessage(0), game: 1 } as ServerMessage))
    expect(h.result.current.undos).toBe(0)
  })

  it('sends a forfeit and offers nothing more until the server answers', () => {
    const h = seated()
    act(() => h.latest().receive(viewMessage(state.current)))
    act(() => h.result.current.forfeit())
    expect(h.latest().sent.at(-1)).toEqual({ type: 'forfeit' })
    expect(h.result.current.actions).toEqual([])
  })

  describe('the turn clock', () => {
    function mine() {
      const h = harness('ROOM01')
      act(() => h.latest().onopen?.())
      act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
      return h
    }
    const clock = (remainingMs: number, totalMs = 180_000) => ({ seat: state.current, remainingMs, totalMs })
    const left = (h: ReturnType<typeof mine>) => h.result.current.clock!.deadline - performance.now()

    it('reads the clock off each view as a deadline on this device, and takes a new one when the server sends it', () => {
      const h = mine()
      act(() => h.latest().receive({ ...viewMessage(state.current), clock: clock(30_000, 30_000) } as ServerMessage))
      expect(h.result.current.clock).toMatchObject({ seat: state.current, totalMs: 30_000 })
      expect(left(h)).toBeCloseTo(30_000, -2)
      act(() => h.latest().receive({ type: 'clock', clock: clock(170_000) }))
      expect(h.result.current.clock?.totalMs).toBe(180_000)
      expect(left(h)).toBeCloseTo(170_000, -2)
      // a view with none (the game is over) takes it away
      act(() => h.latest().receive(viewMessage(state.current)))
      expect(h.result.current.clock).toBeNull()
    })

    it('tells the server someone is here when the screen is touched on our turn, at most every few seconds', () => {
      const h = mine()
      act(() => h.latest().receive({ ...viewMessage(state.current), clock: clock(180_000) } as ServerMessage))
      const awake = () => h.latest().sent.filter((message) => message.type === 'awake').length
      act(() => void window.dispatchEvent(new Event('pointerdown')))
      act(() => void window.dispatchEvent(new Event('pointerdown')))
      expect(awake()).toBe(1)
      act(() => vi.advanceTimersByTime(AWAKE_EVERY_MS))
      act(() => void window.dispatchEvent(new Event('keydown')))
      expect(awake()).toBe(2)
    })

    it("says nothing on the opponent's turn", () => {
      const h = harness('ROOM01')
      act(() => h.latest().onopen?.())
      const other = (1 - state.current) as 0 | 1
      act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: other, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
      act(() => h.latest().receive(viewMessage(other)))
      act(() => void window.dispatchEvent(new Event('pointerdown')))
      expect(h.latest().sent.some((message) => message.type === 'awake')).toBe(false)
    })
  })
})
