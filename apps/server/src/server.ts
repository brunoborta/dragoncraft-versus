import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import { winnerOfView } from '@dcv/engine'
import { parseClientMessage } from '@dcv/protocol'
import type { ServerMessage } from '@dcv/protocol'
import { WebSocket, WebSocketServer } from 'ws'
import { errorMessage } from './room.js'
import type { ClientId, Outbound, Room } from './room.js'
import { Rooms } from './rooms.js'

export type ServerOptions = {
  port: number
  /** Empty means anyone, which is what local development wants. */
  allowedOrigins: string[]
  rooms?: Rooms
  now?: () => number
  pingMs?: number
  sweepMs?: number
  log?: (line: string) => void
}

export type RunningServer = {
  port: number
  rooms: Rooms
  close: () => Promise<void>
}

type Connection = { socket: WebSocket; room: Room | null; alive: boolean; timedOut: boolean }

/** Why a socket closed, in words someone reading the host's logs can act on. */
function closeReason(code: number, timedOut: boolean): string {
  if (timedOut) return 'no answer to ping'
  // 1005 is a close with no code, which is what a bare `socket.close()` sends
  if (code === 1000 || code === 1001 || code === 1005) return 'closed by the client'
  if (code === 4000) return 'replaced by a newer connection'
  if (code === 1006) return 'connection lost'
  return `code ${code}`
}

/**
 * Sockets in, sockets out, and nothing about the game: every decision is
 * the room's. This layer only knows which socket is which client, refuses
 * origins it was not told about, and keeps the connections honest with a
 * ping. The HTTP server underneath exists for the host's health check.
 *
 * It is also what logs: one line per thing that happened to a player, so
 * "I dropped" can be traced in the host's logs to when and why.
 */
export function startServer(options: ServerOptions): Promise<RunningServer> {
  const rooms = options.rooms ?? new Rooms()
  const now = options.now ?? Date.now
  const log = options.log ?? (() => {})
  const connections = new Map<ClientId, Connection>()
  let nextClient = 1

  const http: Server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
      return
    }
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true })

  function originAllowed(req: IncomingMessage): boolean {
    if (options.allowedOrigins.length === 0) return true
    const origin = req.headers.origin
    return origin !== undefined && options.allowedOrigins.includes(origin)
  }

  http.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!originAllowed(req)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  })

  function send(client: ClientId, message: ServerMessage): void {
    const connection = connections.get(client)
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) return
    connection.socket.send(JSON.stringify(message))
    // the seat is someone else's now; keeping this socket would only confuse it
    if (message.type === 'error' && message.code === 'replaced') {
      log(`${client} replaced in room ${connection.room?.id ?? '-'}`)
      connection.room = null
      connection.socket.close(4000, 'replaced')
    }
  }

  function deliver(out: Outbound[]): void {
    for (const { to, message } of out) send(to, message)
  }

  /** Binds the client to the room once the room said they are in it. */
  function bind(client: ClientId, room: Room, out: Outbound[]): void {
    const seated = out.some((o) => o.to === client && o.message.type === 'seated')
    const connection = connections.get(client)
    if (seated && connection) connection.room = room
  }

  /** What a join came to, from the messages the room answered with. */
  function logJoin(client: ClientId, room: Room, out: Outbound[], rejoin: boolean): void {
    for (const { to, message } of out) {
      if (to !== client) continue
      if (message.type === 'seated') {
        log(`${client} ${rejoin ? 'rejoined' : 'joined'} room ${room.id} as seat ${message.seat}`)
        return
      }
      if (message.type === 'error') {
        log(`${client} refused in room ${room.id}: ${message.code}`)
        return
      }
    }
  }

  /** A refused move, or the move that ended the game. */
  function logAction(client: ClientId, room: Room, out: Outbound[]): void {
    const refused = out.find((o) => o.message.type === 'error')
    if (refused?.message.type === 'error') {
      log(`${client} move refused in room ${room.id}: ${refused.message.code}`)
      return
    }
    // once ended every move is refused, so a view that says ended here is the last move
    const view = out.find((o) => o.message.type === 'view')?.message
    if (view?.type === 'view' && view.view.phase === 'ended') {
      const result = winnerOfView(view.view)
      log(`room ${room.id} game over: ${result === 'draw' ? 'draw' : `seat ${result} won`}`)
    }
  }

  function handle(client: ClientId, text: string): void {
    const message = parseClientMessage(text)
    if (!message) {
      log(`${client} sent a message the server cannot read`)
      send(client, errorMessage('bad-message'))
      return
    }
    const connection = connections.get(client)
    if (!connection) return

    switch (message.type) {
      case 'create': {
        const room = rooms.create(now(), message.options)
        if (!room) {
          log(`${client} could not open a room: busy (${rooms.size} live)`)
          send(client, errorMessage('busy'))
          return
        }
        const out = room.sit(client)
        bind(client, room, out)
        deliver(out)
        log(`room ${room.id} opened by ${client} (${rooms.size} live)`)
        return
      }
      case 'join': {
        const room = rooms.get(message.room)
        if (!room) {
          log(`${client} tried room ${message.room}: not found`)
          send(client, errorMessage('room-not-found'))
          return
        }
        const rejoin = message.token !== undefined
        const out = message.token === undefined ? room.sit(client) : room.rejoin(client, message.token)
        bind(client, room, out)
        logJoin(client, room, out, rejoin)
        deliver(out)
        return
      }
      case 'action': {
        if (!connection.room) {
          send(client, errorMessage('not-seated'))
          return
        }
        const out = connection.room.act(client, message.action)
        logAction(client, connection.room, out)
        deliver(out)
        return
      }
    }
  }

  wss.on('connection', (socket) => {
    const client: ClientId = `c${nextClient++}`
    const connection: Connection = { socket, room: null, alive: true, timedOut: false }
    connections.set(client, connection)
    log(`${client} connected (${connections.size} online)`)

    socket.on('pong', () => {
      connection.alive = true
    })
    socket.on('message', (data) => handle(client, data.toString()))
    socket.on('close', (code) => {
      connections.delete(client)
      const where = connection.room ? ` from room ${connection.room.id}` : ''
      log(`${client} disconnected${where}: ${closeReason(code, connection.timedOut)} (${connections.size} online)`)
      if (connection.room) deliver(connection.room.disconnect(client, now()))
    })
    socket.on('error', (error) => {
      log(`${client} socket error: ${error.message}`)
      socket.terminate()
    })
  })

  const pinger = setInterval(() => {
    for (const connection of connections.values()) {
      if (!connection.alive) {
        connection.timedOut = true
        connection.socket.terminate()
        continue
      }
      connection.alive = false
      connection.socket.ping()
    }
  }, options.pingMs ?? 30_000)

  const sweeper = setInterval(() => {
    for (const room of rooms.sweep(now())) {
      for (const client of room.clients()) {
        send(client, errorMessage('room-not-found'))
        const connection = connections.get(client)
        if (connection) connection.room = null
      }
      log(`room ${room.id} swept (${rooms.size} live)`)
    }
  }, options.sweepMs ?? 60_000)

  return new Promise((resolve) => {
    http.listen(options.port, () => {
      const address = http.address()
      const port = typeof address === 'object' && address ? address.port : options.port
      log(`listening on ${port}`)
      resolve({
        port,
        rooms,
        close: () =>
          new Promise<void>((done) => {
            clearInterval(pinger)
            clearInterval(sweeper)
            for (const connection of connections.values()) connection.socket.terminate()
            wss.close(() => http.close(() => done()))
          }),
      })
    })
  })
}
