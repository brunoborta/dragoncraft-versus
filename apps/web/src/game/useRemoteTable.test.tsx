import { createGame, legalActions, toPlayerView } from '@dcv/engine'
import type { ClientMessage, ServerMessage } from '@dcv/protocol'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoomStorage, SeatMemory } from './roomStorage.js'
import { useRemoteTable } from './useRemoteTable.js'
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

    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: 0, token: 'tok-a', role: 'player' }))
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
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player' }))
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

  it('reconnects with the token after a drop, backing off, and withdraws the actions meanwhile', () => {
    const h = harness(null)
    act(() => h.latest().onopen?.())
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 'tok', role: 'player' }))
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
    act(() => h.latest().receive({ type: 'seated', room: 'ROOM01', seat: state.current, token: 't', role: 'player' }))
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
