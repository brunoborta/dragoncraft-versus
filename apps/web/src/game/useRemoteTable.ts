import type { Action, PlayerView, Seat } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { ClientMessage, ServerMessage, TableOptions, TurnClock } from '@dcv/protocol'
import { useCallback, useEffect, useRef, useState } from 'react'
import { roomStorage } from './roomStorage.js'
import type { RoomStorage } from './roomStorage.js'
import type { Table, TableClock, TableStatus } from './table.js'

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
  /** The table's options as the room's creator chose them: read-only for both players. */
  options: TableOptions
  /** Counts the games this table has seen: a rematch moves it, and the screen starts afresh. */
  game: number
  /** Who is asking to play again, and the asking itself. */
  /**
   * `opponentLeft`: the other seat is done with this table, so no rematch.
   * `leave` says this seat is done with it, before the screen moves on.
   */
  rematch: { youWant: boolean; opponentWants: boolean; opponentLeft: boolean; request: () => void; leave: () => void }
}

/** These mean the seat is not ours to come back to. Everything else is a hiccup. */
const FATAL = new Set(['room-not-found', 'room-full', 'bad-token', 'replaced', 'busy', 'left'])

/** How often, at most, a touch of the screen is told to the server: it only needs to know someone is there. */
export const AWAKE_EVERY_MS = 4000

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
  options: chosen,
}: {
  url: string
  room: string | null
  /** For a new room: the options it opens with. Ignored when joining. */
  options?: TableOptions
  connect?: Connect
  storage?: RoomStorage
}): RemoteTable {
  const [view, setView] = useState<PlayerView | null>(null)
  const [actions, setActions] = useState<Action[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [undos, setUndos] = useState(0)
  const [game, setGame] = useState(0)
  const [wants, setWants] = useState({ youWant: false, opponentWants: false })
  const [opponentLeft, setOpponentLeft] = useState(false)
  const [status, setStatus] = useState<TableStatus>({ kind: 'connecting' })
  const [opponentConnected, setOpponentConnected] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(room)
  const [seat, setSeat] = useState<Seat | null>(null)
  const [options, setOptions] = useState<TableOptions>(chosen ?? DEFAULT_TABLE_OPTIONS)
  const [clock, setClock] = useState<TableClock | null>(null)
  const chosenRef = useRef(chosen)

  const socketRef = useRef<SocketLike | null>(null)
  const roomRef = useRef<string | null>(room)
  const gameRef = useRef(0)
  // the last view, to tell a takeback (the log got shorter) from a move
  const viewRef = useRef<PlayerView | null>(null)
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
          // an older server sends none: the defaults, then
          if (message.options) setOptions(message.options)
          return
        case 'waiting':
          setStatus({ kind: 'waiting' })
          return
        case 'view': {
          /*
           * A takeback, whoever made it: the same game, not over, and the log
           * shorter than it was. A rematch also shortens the log, but it moves
           * the game number and starts from a game that had ended.
           */
          const before = viewRef.current
          const sameGame = (message.game ?? gameRef.current) === gameRef.current
          if (before && sameGame && before.phase !== 'ended' && message.view.log.length < before.log.length) {
            setUndos((n) => n + 1)
          }
          viewRef.current = message.view
          setView(message.view)
          setActions(message.actions)
          // an older server sends none: then there is no undo to offer
          setCanUndo(message.canUndo ?? false)
          // a moved game number is a rematch that began: the old asking is spent
          if ((message.game ?? gameRef.current) !== gameRef.current) {
            gameRef.current = message.game!
            setGame(message.game!)
            setWants({ youWant: false, opponentWants: false })
          }
          setOpponentConnected(message.opponentConnected)
          setStatus({ kind: 'playing' })
          // the time left as the server said it, counted from now on this device's own clock
          setClock(message.clock ? clockFrom(message.clock) : null)
          return
        }
        case 'clock':
          setClock(clockFrom(message.clock))
          return
        case 'rematch':
          setWants({ youWant: message.youWant, opponentWants: message.opponentWants })
          return
        case 'presence':
          setOpponentConnected(message.opponentConnected)
          return
        case 'opponentLeft':
          setOpponentLeft(true)
          setWants({ youWant: false, opponentWants: false })
          return
        case 'error':
          if (FATAL.has(message.code)) {
            finished = true
            setStatus({ kind: 'closed', reason: message.message })
            setActions([])
            setCanUndo(false)
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
          send(chosenRef.current ? { type: 'create', options: chosenRef.current } : { type: 'create' })
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
        setCanUndo(false)
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

  const undo = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.send(JSON.stringify({ type: 'undo' } satisfies ClientMessage))
    // one tap, one play back: nothing more until the server answers
    setActions([])
    setCanUndo(false)
  }, [])

  const forfeit = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.send(JSON.stringify({ type: 'forfeit' } satisfies ClientMessage))
    // the end comes back as a view; nothing more is offered until then
    setActions([])
    setCanUndo(false)
  }, [])

  const requestRematch = useCallback(() => {
    const socket = socketRef.current
    if (!socket) return
    socket.send(JSON.stringify({ type: 'rematch' } satisfies ClientMessage))
    // said at once, so the button answers the tap; the server's word follows
    setWants((current) => ({ ...current, youWant: true }))
  }, [])

  /*
   * Someone is here: on our turn, a touch or a key tells the server so (at
   * most every AWAKE_EVERY_MS), and a turn begun with only a fuse, after one
   * we were away for, gets its full time.
   */
  const ourTurn = view !== null && seat !== null && view.phase !== 'ended' && view.current === seat
  useEffect(() => {
    if (!ourTurn) return
    let last = -Infinity
    const awake = () => {
      const now = Date.now()
      if (now - last < AWAKE_EVERY_MS) return
      last = now
      socketRef.current?.send(JSON.stringify({ type: 'awake' } satisfies ClientMessage))
    }
    window.addEventListener('pointerdown', awake, true)
    window.addEventListener('keydown', awake, true)
    return () => {
      window.removeEventListener('pointerdown', awake, true)
      window.removeEventListener('keydown', awake, true)
    }
  }, [ourTurn])

  const leave = useCallback(() => {
    socketRef.current?.send(JSON.stringify({ type: 'leave' } satisfies ClientMessage))
  }, [])

  return {
    view,
    actions,
    perform,
    undo,
    canUndo,
    undos,
    forfeit,
    status,
    opponentConnected,
    opponentLabel: 'Opponent',
    clock,
    roomId,
    seat,
    options,
    game,
    rematch: { ...wants, opponentLeft, request: requestRematch, leave },
  }
}

/** The server's clock, as a deadline on this device's: the time it took to arrive is not counted against anyone. */
function clockFrom(clock: TurnClock): TableClock {
  return { seat: clock.seat, deadline: performance.now() + clock.remainingMs, totalMs: clock.totalMs }
}
