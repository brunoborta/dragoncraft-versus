import { createServer } from 'node:http'
import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
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

type Connection = { socket: WebSocket; room: Room | null; alive: boolean }

/**
 * Sockets in, sockets out, and nothing about the game: every decision is
 * the room's. This layer only knows which socket is which client, refuses
 * origins it was not told about, and keeps the connections honest with a
 * ping. The HTTP server underneath exists for the host's health check.
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

  function handle(client: ClientId, text: string): void {
    const message = parseClientMessage(text)
    if (!message) {
      send(client, errorMessage('bad-message'))
      return
    }
    const connection = connections.get(client)
    if (!connection) return

    switch (message.type) {
      case 'create': {
        const room = rooms.create(now())
        if (!room) {
          send(client, errorMessage('busy'))
          return
        }
        const out = room.sit(client)
        bind(client, room, out)
        deliver(out)
        log(`room ${room.id} opened (${rooms.size} live)`)
        return
      }
      case 'join': {
        const room = rooms.get(message.room)
        if (!room) {
          send(client, errorMessage('room-not-found'))
          return
        }
        const out = message.token === undefined ? room.sit(client) : room.rejoin(client, message.token)
        bind(client, room, out)
        deliver(out)
        return
      }
      case 'action': {
        if (!connection.room) {
          send(client, errorMessage('not-seated'))
          return
        }
        deliver(connection.room.act(client, message.action))
        return
      }
    }
  }

  wss.on('connection', (socket) => {
    const client: ClientId = `c${nextClient++}`
    const connection: Connection = { socket, room: null, alive: true }
    connections.set(client, connection)

    socket.on('pong', () => {
      connection.alive = true
    })
    socket.on('message', (data) => handle(client, data.toString()))
    socket.on('close', () => {
      connections.delete(client)
      if (connection.room) deliver(connection.room.disconnect(client, now()))
    })
    socket.on('error', () => socket.terminate())
  })

  const pinger = setInterval(() => {
    for (const connection of connections.values()) {
      if (!connection.alive) {
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
