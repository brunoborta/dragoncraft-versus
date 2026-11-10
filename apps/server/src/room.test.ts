import { nextInt } from '@dcv/engine'
import type { Action, PlayerView } from '@dcv/engine'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import type { ServerMessage } from '@dcv/protocol'
import { describe, expect, it } from 'vitest'
import { Room } from './room.js'
import type { Outbound } from './room.js'

let tokenCounter = 0
const newToken = () => `token-${tokenCounter++}`

function makeRoom(seed = 7): Room {
  return new Room('ROOM01', seed, newToken, 0)
}

function to(out: Outbound[], client: string): ServerMessage[] {
  return out.filter((o) => o.to === client).map((o) => o.message)
}

function lastView(messages: ServerMessage[]) {
  const views = messages.filter((m): m is Extract<ServerMessage, { type: 'view' }> => m.type === 'view')
  return views[views.length - 1]
}

function tokenOf(messages: ServerMessage[]): string {
  const seated = messages.find((m) => m.type === 'seated')
  if (!seated || seated.type !== 'seated') throw new Error('not seated')
  return seated.token
}

/** Both seats taken; returns the first views each got. */
function seatBoth(room: Room) {
  const a = room.sit('A')
  const b = room.sit('B')
  return { a, b }
}

describe('Room', () => {
  it("hands the creator's table options to both seats, the joiner's included", () => {
    const options = { bagComposition: true, cardGlow: false, showReputation: false }
    const room = new Room('ROOM02', 7, newToken, 0, options)
    const { a, b } = seatBoth(room)
    for (const messages of [to(a, 'A'), to(b, 'B')]) {
      const seated = messages.find((m) => m.type === 'seated')
      expect(seated && seated.type === 'seated' && seated.options).toEqual(options)
    }
  })

  it('opens with the default options when the creator sent none', () => {
    const seated = to(makeRoom().sit('A'), 'A').find((m) => m.type === 'seated')
    expect(seated && seated.type === 'seated' && seated.options).toEqual(DEFAULT_TABLE_OPTIONS)
  })

  it('seats the creator, tells them to wait, and sends no view until the table is full', () => {
    const room = makeRoom()
    const out = room.sit('A')
    expect(to(out, 'A').map((m) => m.type)).toEqual(['seated', 'waiting'])
    expect(room.started).toBe(false)
  })

  it('starts the game when the second player sits, and each seat gets its own view', () => {
    const room = makeRoom()
    const { a, b } = seatBoth(room)
    expect(room.started).toBe(true)
    // A was already seated, so on B's arrival only a view reaches A
    expect(to(b, 'A').map((m) => m.type)).toEqual(['view'])
    expect(to(b, 'B').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(to(a, 'A').map((m) => m.type)).toEqual(['seated', 'waiting'])

    const viewA = lastView(to(b, 'A')).view
    const viewB = lastView(to(b, 'B')).view
    expect(viewA.seat).toBe(0)
    expect(viewB.seat).toBe(1)
    expect(viewA.current).toBe(viewB.current)
  })

  it('hands the legal actions only to the seat whose turn it is', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const a = lastView(to(b, 'A'))
    const bb = lastView(to(b, 'B'))
    const mover = a.view.current === 0 ? a : bb
    const waiter = a.view.current === 0 ? bb : a
    expect(mover.actions.length).toBeGreaterThan(0)
    expect(waiter.actions).toEqual([])
  })

  it('refuses a third person with room-full, silently to the players', () => {
    const room = makeRoom()
    seatBoth(room)
    const out = room.sit('C')
    expect(out).toEqual([{ to: 'C', message: expect.objectContaining({ type: 'error', code: 'room-full' }) }])
  })

  it('refuses an action from whoever is not the player of the turn, without moving the state', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const idle = viewA.view.current === 0 ? 'B' : 'A'
    const mover = idle === 'A' ? 'B' : 'A'
    const moverView = lastView(to(b, mover))

    const out = room.act(idle, moverView.actions[0])
    expect(to(out, idle).map((m) => m.type)).toEqual(['error', 'view'])
    expect(to(out, idle)[0]).toMatchObject({ code: 'not-your-turn' })
    expect(to(out, mover)).toEqual([])
    // the refusal's view is the same position as before
    expect(lastView(to(out, idle)).view.board).toEqual(moverView.view.board)
  })

  it('refuses an action that is well-formed but not legal here', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'

    const out = room.act(mover, { type: 'endTurn' })
    expect(to(out, mover)[0]).toMatchObject({ type: 'error', code: 'illegal-action' })
    expect(lastView(to(out, mover)).actions.length).toBeGreaterThan(0)
  })

  it('does not fall over on an action shaped like nothing the engine knows', () => {
    const room = makeRoom()
    const { b } = seatBoth(room)
    const viewA = lastView(to(b, 'A'))
    const mover = viewA.view.current === 0 ? 'A' : 'B'

    const weird = { type: 'place', at: { q: 'x', r: [1, 2], nested: { deep: true } } } as unknown as Action
    const out = room.act(mover, weird)
    expect(to(out, mover)[0]).toMatchObject({ type: 'error', code: 'illegal-action' })
  })

  it('refuses an action from someone not seated, or before the game starts', () => {
    const room = makeRoom()
    expect(room.act('nobody', { type: 'endTurn' })[0].message).toMatchObject({ code: 'not-seated' })
    room.sit('A')
    expect(room.act('A', { type: 'endTurn' })[0].message).toMatchObject({ code: 'not-started' })
  })

  it('lets a player back in with their token, on a new connection, and tells the other', () => {
    const room = makeRoom()
    const { a, b } = seatBoth(room)
    const tokenA = tokenOf(to(a, 'A'))

    const gone = room.disconnect('A', 1000)
    expect(gone).toEqual([{ to: 'B', message: { type: 'presence', opponentConnected: false } }])
    expect(room.connectedCount()).toBe(1)

    const back = room.rejoin('A2', tokenA)
    expect(to(back, 'A2').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(lastView(to(back, 'A2')).view.seat).toBe(0)
    expect(to(back, 'B')).toEqual([{ type: 'presence', opponentConnected: true }])
    expect(to(back, 'A')).toEqual([])

    // the new connection is the seat now
    const viewB = lastView(to(b, 'B'))
    const mover = viewB.view.current === 1 ? 'B' : 'A2'
    const moverView = mover === 'B' ? viewB : lastView(to(back, 'A2'))
    const out = room.act(mover, moverView.actions[0])
    expect(to(out, 'A2').map((m) => m.type)).toEqual(['view'])
  })

  it('tells a still-open connection it was replaced when its token is used elsewhere', () => {
    const room = makeRoom()
    const { a } = seatBoth(room)
    const tokenA = tokenOf(to(a, 'A'))

    const out = room.rejoin('A2', tokenA)
    expect(to(out, 'A')).toEqual([expect.objectContaining({ type: 'error', code: 'replaced' })])
    expect(to(out, 'A2').map((m) => m.type)).toEqual(['seated', 'view'])
    expect(room.connectedCount()).toBe(2)
  })

  it('refuses a token it never issued', () => {
    const room = makeRoom()
    seatBoth(room)
    const out = room.rejoin('X', 'forged')
    expect(out).toEqual([{ to: 'X', message: expect.objectContaining({ code: 'bad-token' }) }])
  })

  it('answers a seated player who sits again with where they are', () => {
    const room = makeRoom()
    room.sit('A')
    expect(room.sit('A').map((o) => o.message.type)).toEqual(['waiting'])
  })

  it('tracks when the room was last empty', () => {
    const room = makeRoom()
    seatBoth(room)
    room.disconnect('A', 500)
    expect(room.idleSince).toBe(0)
    room.disconnect('B', 900)
    expect(room.idleSince).toBe(900)
  })
})

/**
 * Everything a view may not carry. The log is left out of the hand check:
 * a card the opponent returned with a coin and drew again later would be
 * in both, legitimately.
 */
function assertNothingLeaks(view: PlayerView, otherHandIds: string[]): void {
  const text = JSON.stringify({ ...view, log: undefined })
  expect(text).not.toContain('"rng"')
  expect(text).not.toContain('"deck":')
  expect(text).not.toContain('"extras":')
  for (const id of otherHandIds) expect(text).not.toContain(`"${id}"`)
}

describe('a whole game through a room', () => {
  it('is playable from the views alone, with no refused action and nothing leaked', () => {
    for (const seed of [1, 2, 3]) {
      const room = makeRoom(seed)
      const latest: Record<'A' | 'B', Extract<ServerMessage, { type: 'view' }> | undefined> = {
        A: undefined,
        B: undefined,
      }
      const take = (out: Outbound[]) => {
        for (const client of ['A', 'B'] as const) {
          const view = lastView(to(out, client))
          if (view) latest[client] = view
          for (const m of to(out, client)) expect(m.type).not.toBe('error')
        }
      }

      take(room.sit('A'))
      take(room.sit('B'))

      let rng = seed
      let steps = 0
      while (latest.A!.view.phase !== 'ended' && steps < 3000) {
        const mover = latest.A!.actions.length > 0 ? 'A' : 'B'
        const actions = latest[mover]!.actions
        expect(actions.length).toBeGreaterThan(0)
        const pick = nextInt(rng, actions.length)
        rng = pick.rng
        take(room.act(mover, actions[pick.value]))

        assertNothingLeaks(latest.A!.view, latest.B!.view.you.hand.map((c) => c.id))
        assertNothingLeaks(latest.B!.view, latest.A!.view.you.hand.map((c) => c.id))
        steps += 1
      }

      expect(latest.A!.view.phase).toBe('ended')
      expect(latest.B!.view.phase).toBe('ended')
      expect(latest.A!.actions).toEqual([])
      expect(latest.B!.actions).toEqual([])
    }
  })
})
