import { nextInt } from '@dcv/engine'
import type { ServerMessage } from '@dcv/protocol'
import { afterEach, describe, expect, it } from 'vitest'
import { WebSocket } from 'ws'
import { Rooms } from './rooms.js'
import { startServer } from './server.js'
import type { RunningServer } from './server.js'

/** A socket whose messages arrive as a queue, so a test can await the next one. */
class Client {
  readonly socket: WebSocket
  private readonly queue: ServerMessage[] = []
  private waiting: ((message: ServerMessage) => void) | null = null
  closed = false

  constructor(port: number, origin?: string) {
    this.socket = new WebSocket(`ws://127.0.0.1:${port}`, origin ? { origin } : {})
    this.socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage
      if (this.waiting) {
        const resolve = this.waiting
        this.waiting = null
        resolve(message)
      } else {
        this.queue.push(message)
      }
    })
    this.socket.on('close', () => {
      this.closed = true
    })
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket.once('open', () => resolve())
      this.socket.once('error', reject)
    })
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<ServerMessage> {
    const queued = this.queue.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve) => {
      this.waiting = resolve
    })
  }

  async nextOf<T extends ServerMessage['type']>(type: T): Promise<Extract<ServerMessage, { type: T }>> {
    for (;;) {
      const message = await this.next()
      if (message.type === type) return message as Extract<ServerMessage, { type: T }>
    }
  }

  close(): void {
    this.socket.close()
  }
}

describe('the server over real sockets', () => {
  let server: RunningServer | null = null
  afterEach(async () => {
    await server?.close()
    server = null
  })

  it('answers the health check', async () => {
    server = await startServer({ port: 0, allowedOrigins: [] })
    const response = await fetch(`http://127.0.0.1:${server.port}/health`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('ok')
  })

  it('refuses an origin it was not told about, and accepts one it was', async () => {
    server = await startServer({ port: 0, allowedOrigins: ['https://game.example'] })
    const stranger = new Client(server.port, 'https://evil.example')
    await expect(stranger.open()).rejects.toThrow()

    const friend = new Client(server.port, 'https://game.example')
    await friend.open()
    friend.close()
  })

  it('tells a client off for a message it cannot read, and for a room that does not exist', async () => {
    server = await startServer({ port: 0, allowedOrigins: [] })
    const client = new Client(server.port)
    await client.open()

    client.socket.send('garbage')
    expect(await client.next()).toMatchObject({ type: 'error', code: 'bad-message' })

    client.send({ type: 'join', room: 'NOPE00' })
    expect(await client.next()).toMatchObject({ type: 'error', code: 'room-not-found' })

    client.send({ type: 'action', action: { type: 'endTurn' } })
    expect(await client.next()).toMatchObject({ type: 'error', code: 'not-seated' })
    client.close()
  })

  it('plays a whole game between two sockets, and a reconnection in the middle keeps the seat', async () => {
    server = await startServer({ port: 0, allowedOrigins: [], rooms: new Rooms({ newSeed: () => 11 }) })
    const a = new Client(server.port)
    await a.open()
    a.send({ type: 'create' })
    const seatedA = await a.nextOf('seated')
    expect(seatedA.seat).toBe(0)
    expect(await a.next()).toEqual({ type: 'waiting' })

    const b = new Client(server.port)
    await b.open()
    b.send({ type: 'join', room: seatedA.room })
    const seatedB = await b.nextOf('seated')
    expect(seatedB.seat).toBe(1)

    const clients = { A: a, B: b }
    const latest = { A: await a.nextOf('view'), B: await b.nextOf('view') }
    expect(latest.A.actions.length > 0 || latest.B.actions.length > 0).toBe(true)

    let rng = 11
    let steps = 0
    let reconnected = false
    while (latest.A.view.phase !== 'ended' && steps < 3000) {
      // halfway-ish through, A drops and comes back on a fresh socket
      if (!reconnected && steps === 40) {
        clients.A.close()
        expect(await clients.B.nextOf('presence')).toEqual({ type: 'presence', opponentConnected: false })
        const again = new Client(server.port)
        await again.open()
        again.send({ type: 'join', room: seatedA.room, token: seatedA.token })
        expect((await again.nextOf('seated')).seat).toBe(0)
        latest.A = await again.nextOf('view')
        expect(await clients.B.nextOf('presence')).toEqual({ type: 'presence', opponentConnected: true })
        clients.A = again
        reconnected = true
      }

      const mover = latest.A.actions.length > 0 ? 'A' : 'B'
      const pick = nextInt(rng, latest[mover].actions.length)
      rng = pick.rng
      clients[mover].send({ type: 'action', action: latest[mover].actions[pick.value] })
      latest.A = await clients.A.nextOf('view')
      latest.B = await clients.B.nextOf('view')
      steps += 1
    }

    expect(reconnected).toBe(true)
    expect(latest.A.view.phase).toBe('ended')
    expect(latest.B.view.phase).toBe('ended')
    clients.A.close()
    clients.B.close()
  })

  it('logs who joined which room, and when and why they dropped', async () => {
    const lines: string[] = []
    const logged = (pattern: RegExp) =>
      new Promise<void>((resolve) => {
        const check = () => (lines.some((line) => pattern.test(line)) ? resolve() : setTimeout(check, 5))
        check()
      })
    server = await startServer({ port: 0, allowedOrigins: [], log: (line) => lines.push(line) })
    const a = new Client(server.port)
    await a.open()
    a.send({ type: 'create' })
    const seated = await a.nextOf('seated')

    const b = new Client(server.port)
    await b.open()
    b.send({ type: 'join', room: seated.room })
    await b.nextOf('seated')
    b.socket.terminate()
    await logged(/disconnected from room/)

    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^room ${seated.room} opened by c1`)))
    expect(lines).toContain(`c2 joined room ${seated.room} as seat 1`)
    expect(lines).toContainEqual(expect.stringMatching(new RegExp(`^c2 disconnected from room ${seated.room}: connection lost`)))
    a.close()
  })

  it('closes the old socket when its seat is taken over with the token', async () => {
    server = await startServer({ port: 0, allowedOrigins: [] })
    const a = new Client(server.port)
    await a.open()
    a.send({ type: 'create' })
    const seated = await a.nextOf('seated')

    const again = new Client(server.port)
    await again.open()
    again.send({ type: 'join', room: seated.room, token: seated.token })
    await again.nextOf('seated')

    await a.nextOf('error')
    await new Promise((resolve) => a.socket.once('close', resolve))
    expect(a.closed).toBe(true)
    again.close()
  })
})
