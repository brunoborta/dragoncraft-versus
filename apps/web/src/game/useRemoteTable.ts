import type { Action, PlayerView, Seat } from '@dcv/engine'
import type { ClientMessage, ServerMessage } from '@dcv/protocol'
import { useCallback, useEffect, useRef, useState } from 'react'
import { roomStorage } from './roomStorage.js'
import type { RoomStorage } from './roomStorage.js'
import type { Table, TableStatus } from './table.js'

/** The slice of `WebSocket` this hook touches, so a test can hand in a fake. */
export type SocketLike = {
  send: (data: string) => void
  close: () => void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

export type Connect = (url: string) => SocketLike

export type RemoteTable = Table & {
  /** Known once the server has seated us; the share link needs it. */
  roomId: string | null
  seat: Seat | null
}

/** These mean the seat is not ours to come back to. Everything else is a hiccup. */
const FATAL = new Set(['room-not-found', 'room-full', 'bad-token', 'replaced', 'busy'])

const FIRST_RETRY_MS = 1000
const MAX_RETRY_MS = 30_000

const defaultConnect: Connect = (url) => new WebSocket(url) as unknown as SocketLike

/**
 * A table whose game lives on the server. The hook holds a socket open,
 * says who we are, and mirrors what comes back; when the socket drops it
 * reopens it with the seat's token and asks for the whole view again, so
 * a phone that slept through three turns is current on waking.
 *
 * `room` null means "open a new one"; the id the server picks is exposed
 * as `roomId`. Later changes to `room` are ignored: the table is bound to
 * the room it started in.
 */
export function useRemoteTable({
  url,
  room,
  connect = defaultConnect,
  storage = roomStorage,
}: {
  url: string
  room: string | null
  connect?: Connect
  storage?: RoomStorage
}): RemoteTable {
  const [view, setView] = useState<PlayerView | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [status, setStatus] = useState<TableStatus>({ kind: 'connecting' })
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(room)
  const [seat, setSeat] = useState<Seat | null>(null)

  const socketRef = useRef<SocketLike | null>(null)
  const roomRef = useRef<string | null>(room)
  const initialRoom = useRef(room)

  useEffect(() => {
    let cancelled = false
    let finished = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined

    function send(message: ClientMessage): void {
      socketRef.current?.send(JSON.stringify(message))
    }

    function handle(message: ServerMessage): void {
      switch (message.type) {
        case 'seated':
          roomRef.current = message.room
          storage.remember(message.room, { token: message.token, seat: message.seat })
          setRoomId(message.room)
          setSeat(message.seat)
          return
        case 'waiting':
          setStatus({ kind: 'waiting' })
          return
        case 'view':
          setView(message.view)
          setActions(message.actions)
          setOpponentConnected(message.opponentConnected)
          setStatus({ kind: 'playing' })
          return
        case 'presence':
          setOpponentConnected(message.opponentConnected)
          return
        case 'error':
          if (FATAL.has(message.code)) {
            finished = true
            setStatus({ kind: 'closed', reason: message.message })
            setActions([])
            socketRef.current?.close()
          }
          // the rest arrive with a fresh view right behind them
          return
      }
    }

    function open(): void {
      if (cancelled || finished) return
      const socket = connect(url)
      socketRef.current = socket

      socket.onopen = () => {
        attempt = 0
        const known = roomRef.current
        if (known === null) {
          send({ type: 'create' })
          return
        }
        const remembered = storage.recall(known)
        send(remembered ? { type: 'join', room: known, token: remembered.token } : { type: 'join', room: known })
      }
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        try {
          handle(JSON.parse(event.data) as ServerMessage)
        } catch {
          // not ours to understand; the next view sets things right
        }
      }
      socket.onerror = () => {
        // `close` follows an error on every browser; the retry lives there
      }
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null
        if (cancelled || finished) return
        // nothing may be sent down a closed socket, and the view may be stale
        setActions([])
        setStatus({ kind: 'connecting' })
        const delay = Math.min(FIRST_RETRY_MS * 2 ** attempt, MAX_RETRY_MS)
        attempt += 1
        timer = setTimeout(open, delay)
      }
    }

    open()

    return () => {
      cancelled = true
      clearTimeout(timer)
      socketRef.current?.close()
      socketRef.current = null
    }
    // bound to the room it started in, on purpose — see the doc comment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, connect, storage, initialRoom])

  const perform = useCallback((action: Action) => {
    const socket = socketRef.current
    if (!socket) return
    socket.send(JSON.stringify({ type: 'action', action } satisfies ClientMessage))
    // one tap, one move: nothing more is offered until the server answers
    setActions([])
  }, [])

  const undo = useCallback(() => {}, [])

  return {
    view,
    actions,
    perform,
    undo,
    canUndo: false,
    status,
    opponentConnected,
    opponentLabel: 'Opponent',
    roomId,
    seat,
  }
}
